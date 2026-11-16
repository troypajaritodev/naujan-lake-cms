import "server-only";

import crypto from "node:crypto";
import type { SessionUser } from "@/lib/auth-seeds";
import {
  canCancelInquiry,
  CANCELLABLE_STATUSES,
  computeBookingPricing,
  computeReservedBySlot,
  FACILITATION_FEE_PHP,
  getReservedSeatsForDate,
  hydrateInquiry,
  MAX_PARTY_SIZE,
  SEED_INQUIRIES,
  slotKey,
  stampInquiryStatus,
  type FirstPaymentSubmission,
  type Inquiry,
  type InquiryActor,
  type InquiryMessage,
  type InquiryStatus,
  type InquiryTimelineEntry,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/inquiries-shared";
import { JsonFileStore } from "@/lib/json-store";
import { cleanEmail, cleanPhone, cleanText } from "@/lib/sanitize";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/lib/supabase/types";
import { getTours, type Tour } from "@/lib/tours";

export class ServerInquiryError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ServerInquiryError";
    this.status = status;
  }
}

const VALID_STATUSES: readonly InquiryStatus[] = [
  "PENDING",
  "ON_PROCESS",
  "CONTACTED",
  "CONFIRMED",
  "COMPLETED",
  "DECLINED",
  "CANCELLED",
];

const VALID_METHODS: readonly PaymentMethod[] = [
  "GCASH",
  "MAYA",
  "BANK_TRANSFER",
  "ON_SITE_CASH",
];

const VALID_PAYMENT_STATUSES: readonly PaymentStatus[] = [
  "UNPAID",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "REFUNDED",
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type AdminClient = NonNullable<ReturnType<typeof getSupabaseAdminClient>>;
type TourLookup = Map<string, { slug: string; title: string }>;

const inquiryStore = new JsonFileStore<Inquiry[]>({
  filename: "inquiries.json",
  fallbackSubdir: "naujan-lake-inquiries",
  normalize: (raw) =>
    Array.isArray(raw)
      ? (raw as Inquiry[]).map(hydrateInquiry)
      : SEED_INQUIRIES.map(hydrateInquiry),
});

let supabaseInquiryWriteQueue: Promise<unknown> = Promise.resolve();

function withSupabaseBookingLock<T>(task: () => Promise<T>): Promise<T> {
  const run = supabaseInquiryWriteQueue.then(task, task);
  supabaseInquiryWriteQueue = run.catch(() => undefined);
  return run;
}

function sortNewestFirst(list: readonly Inquiry[]): Inquiry[] {
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function assertValidStatus(value: unknown): InquiryStatus {
  if (typeof value !== "string" || !VALID_STATUSES.includes(value as InquiryStatus)) {
    throw new ServerInquiryError("Invalid booking status.", 400);
  }
  return value as InquiryStatus;
}

function assertValidPaymentStatus(value: unknown): PaymentStatus {
  if (
    typeof value !== "string" ||
    !VALID_PAYMENT_STATUSES.includes(value as PaymentStatus)
  ) {
    throw new ServerInquiryError("Invalid payment status.", 400);
  }
  return value as PaymentStatus;
}

function sanitizeProofUrl(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > 2_500_000) {
    throw new ServerInquiryError("Payment receipt attachment is too large.", 400);
  }
  if (trimmed.startsWith("data:image/") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return undefined;
}

type TourLookupHintRow = {
  tour_id: string;
  tour_slug: string | null;
  tour_title?: string | null;
};

async function resolveMissingTourLookup(
  admin: AdminClient,
  rows: readonly TourLookupHintRow[],
  requireTitle = true,
): Promise<TourLookup> {
  const missingIds = new Set<string>();
  for (const row of rows) {
    if (!row.tour_slug || (requireTitle && !row.tour_title)) {
      missingIds.add(row.tour_id);
    }
  }
  if (missingIds.size === 0) return new Map();

  const { data, error } = await admin
    .from("tours")
    .select("id, slug, title")
    .in("id", [...missingIds]);
  const lookup: TourLookup = new Map();
  if (error || !data) return lookup;
  for (const row of data) {
    lookup.set(row.id, { slug: row.slug, title: row.title });
  }
  return lookup;
}

function rowToInquiry(row: Tables<"tour_inquiries">, tourMap?: TourLookup): Inquiry {
  const tourInfo = tourMap?.get(row.tour_id);
  return hydrateInquiry({
    id: row.id,
    reference: row.reference_code,
    userEmail: (row.user_email ?? row.email).toLowerCase(),
    fullName: row.full_name,
    email: row.email.toLowerCase(),
    phone: row.phone ?? "",
    tourSlug: row.tour_slug ?? tourInfo?.slug ?? row.tour_id,
    tourTitle: row.tour_title ?? tourInfo?.title ?? "Naujan Lake Tour",
    preferredDate: row.target_date,
    partySize: row.party_size,
    message: row.notes ?? "",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.on_process_at ? { onProcessAt: row.on_process_at } : {}),
    ...(row.confirmed_at ? { confirmedAt: row.confirmed_at } : {}),
    ...(row.completed_at ? { completedAt: row.completed_at } : {}),
    ...(row.cancelled_at ? { cancelledAt: row.cancelled_at } : {}),
    ...(row.decided_by ? { decidedBy: row.decided_by } : {}),
    ratePerPerson: Number(row.rate_per_person ?? 0),
    totalAmount: Number(row.total_amount ?? 0),
    firstPaymentRate: Number(row.first_payment_rate ?? 0.5),
    firstPaymentAmount: Number(row.first_payment_amount ?? 0),
    balanceAmount: Number(row.balance_amount ?? 0),
    ...(row.payment_method ? { paymentMethod: row.payment_method } : {}),
    ...(row.payment_reference ? { paymentReference: row.payment_reference } : {}),
    ...(row.payment_account_name
      ? { paymentAccountName: row.payment_account_name }
      : {}),
    ...(row.payment_proof_url ? { paymentProofUrl: row.payment_proof_url } : {}),
    paymentStatus: row.payment_status,
    ...(row.payment_submitted_at
      ? { paymentSubmittedAt: row.payment_submitted_at }
      : {}),
    ...(row.payment_verified_at
      ? { paymentVerifiedAt: row.payment_verified_at }
      : {}),
    ...(row.admin_note !== null && row.admin_note !== undefined
      ? { adminNote: row.admin_note }
      : {}),
    timeline: Array.isArray(row.timeline)
      ? (row.timeline as unknown as InquiryTimelineEntry[])
      : undefined,
    messages: Array.isArray(row.messages)
      ? (row.messages as unknown as InquiryMessage[])
      : undefined,
  });
}

function inquiryToUpdatePatch(
  inquiry: Inquiry,
): Database["public"]["Tables"]["tour_inquiries"]["Update"] {
  return {
    status: inquiry.status,
    on_process_at: inquiry.onProcessAt ?? null,
    confirmed_at: inquiry.confirmedAt ?? null,
    completed_at: inquiry.completedAt ?? null,
    cancelled_at: inquiry.cancelledAt ?? null,
    decided_by: inquiry.decidedBy ?? null,
    rate_per_person: inquiry.ratePerPerson ?? 0,
    total_amount: inquiry.totalAmount ?? 0,
    first_payment_rate: inquiry.firstPaymentRate ?? 0.5,
    first_payment_amount: inquiry.firstPaymentAmount ?? 0,
    balance_amount: inquiry.balanceAmount ?? 0,
    payment_method: inquiry.paymentMethod ?? null,
    payment_reference: inquiry.paymentReference ?? null,
    payment_account_name: inquiry.paymentAccountName ?? null,
    payment_proof_url: inquiry.paymentProofUrl ?? null,
    payment_status: inquiry.paymentStatus ?? "UNPAID",
    payment_submitted_at: inquiry.paymentSubmittedAt ?? null,
    payment_verified_at: inquiry.paymentVerifiedAt ?? null,
    admin_note: inquiry.adminNote ?? null,
    timeline: (inquiry.timeline ?? []) as unknown as Json,
    messages: (inquiry.messages ?? []) as unknown as Json,
  };
}

async function resolveOrEnsureSupabaseTourId(
  admin: AdminClient,
  tour: Tour,
): Promise<string> {
  const { data: existing, error: lookupError } = await admin
    .from("tours")
    .select("id")
    .eq("slug", tour.slug)
    .maybeSingle();

  if (lookupError) {
    throw new ServerInquiryError("Could not verify tour package.", 502);
  }
  if (existing?.id) return existing.id;

  const { data: inserted, error: upsertError } = await admin
    .from("tours")
    .upsert(
      {
        slug: tour.slug,
        title: tour.title,
        category: tour.category || "Guided Tour",
        summary: tour.summary || tour.title,
        duration: tour.duration || "Half day",
        departure: tour.departure || "06:00",
        rate_per_person: Math.max(0, tour.ratePerPerson),
        max_capacity: Math.max(1, Math.min(MAX_PARTY_SIZE, tour.maxCapacity || 12)),
        difficulty: tour.difficulty,
        inclusions: tour.inclusions,
        what_to_bring: tour.bring,
        notes: tour.notes,
        species_slugs: tour.speciesSlugs,
        itinerary: tour.itinerary as unknown as Json,
        tariff: tour.tariff as unknown as Json,
        featured_image: tour.image || "/images/tours/sunrise-boat.jpg",
        is_active: true,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (upsertError || !inserted) {
    throw new ServerInquiryError("Could not register tour package for booking.", 502);
  }

  return inserted.id;
}

async function fetchSupabaseInquiryById(
  admin: AdminClient,
  id: string,
): Promise<{ inquiry: Inquiry; tourMap: TourLookup }> {
  if (!UUID_PATTERN.test(id)) {
    throw new ServerInquiryError("We could not find that booking.", 404);
  }

  const { data, error } = await admin
    .from("tour_inquiries")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new ServerInquiryError("Booking storage is temporarily unavailable.", 502);
  }
  if (!data) {
    throw new ServerInquiryError("We could not find that booking.", 404);
  }

  const tourMap = await resolveMissingTourLookup(admin, [data]);
  return { inquiry: rowToInquiry(data, tourMap), tourMap };
}

async function mutateSupabaseInquiry(
  admin: AdminClient,
  id: string,
  transform: (existing: Inquiry) => Inquiry,
): Promise<Inquiry> {
  const { inquiry: existing, tourMap } = await fetchSupabaseInquiryById(admin, id);
  const updated = transform(existing);

  const { data: saved, error } = await admin
    .from("tour_inquiries")
    .update(inquiryToUpdatePatch(updated))
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error || !saved) {
    throw new ServerInquiryError("Could not update booking right now.", 502);
  }

  return rowToInquiry(saved, tourMap);
}

function applyAcceptTransform(
  existing: Inquiry,
  options?: { note?: string; verifyPayment?: boolean },
): Inquiry {
  const at = new Date().toISOString();
  const hydrated = hydrateInquiry(existing);
  if (
    hydrated.status === "CANCELLED" ||
    hydrated.status === "DECLINED" ||
    hydrated.status === "COMPLETED"
  ) {
    throw new ServerInquiryError(
      "Closed, declined, or cancelled bookings cannot be moved back to On Process.",
      400,
    );
  }
  const shouldVerify =
    options?.verifyPayment !== false &&
    (hydrated.firstPaymentAmount ?? 0) > 0 &&
    hydrated.paymentStatus === "PENDING_VERIFICATION";

  const updated = stampInquiryStatus(hydrated, "ON_PROCESS", at, "park", {
    note:
      options?.note ??
      (hydrated.adminNote ||
        "Booking accepted by park staff. Boat, guide, and permit are now being prepared."),
    paymentStatus: shouldVerify ? "VERIFIED" : hydrated.paymentStatus,
  });

  if (shouldVerify) {
    updated.paymentVerifiedAt = at;
    const timeline = [...(updated.timeline ?? [])];
    const last = timeline.pop();
    timeline.push({
      id: `tl_${crypto.randomUUID().slice(0, 8)}`,
      status: "PAYMENT_VERIFIED",
      label: "First payment verified",
      note: hydrated.paymentReference
        ? `Verified ${hydrated.paymentMethod ?? "payment"} ref ${hydrated.paymentReference}`
        : undefined,
      at,
      actor: "park",
    });
    if (last) timeline.push(last);
    updated.timeline = timeline;
  }

  return updated;
}

function applyStatusTransform(
  actor: SessionUser,
  existing: Inquiry,
  status: InquiryStatus,
  options?: { note?: string; paymentStatus?: PaymentStatus },
): Inquiry {
  const hydrated = hydrateInquiry(existing);
  const isAdmin = actor.role === "admin";
  const isOwner = hydrated.userEmail === actor.email.toLowerCase();

  if (!isAdmin) {
    if (!isOwner) {
      throw new ServerInquiryError(
        "You can only withdraw your own booking requests.",
        403,
      );
    }
    if (status !== "CANCELLED") {
      throw new ServerInquiryError(
        "Only park staff can set operational booking statuses.",
        403,
      );
    }
    if (!canCancelInquiry(hydrated)) {
      throw new ServerInquiryError("This request can no longer be withdrawn.", 400);
    }
  }

  const at = new Date().toISOString();
  const inquiryActor: InquiryActor = isAdmin ? "park" : "visitor";

  return stampInquiryStatus(hydrated, status, at, inquiryActor, {
    note: options?.note,
    paymentStatus: isAdmin ? options?.paymentStatus : undefined,
  });
}

function applyPaymentStatusTransform(
  existing: Inquiry,
  paymentStatus: PaymentStatus,
  cleanNote?: string,
): Inquiry {
  const at = new Date().toISOString();
  const hydrated = hydrateInquiry(existing);
  const timeline = [...(hydrated.timeline ?? [])];

  const label =
    paymentStatus === "VERIFIED"
      ? "First payment verified"
      : paymentStatus === "REFUNDED"
        ? "First payment marked refunded"
        : paymentStatus === "PENDING_VERIFICATION"
          ? "First payment set to pending review"
          : "Payment marked unpaid";

  timeline.push({
    id: `tl_${crypto.randomUUID().slice(0, 8)}`,
    status: "PAYMENT_VERIFIED",
    label,
    ...(cleanNote ? { note: cleanNote } : {}),
    at,
    actor: "park",
  });

  return {
    ...hydrated,
    paymentStatus,
    paymentVerifiedAt: paymentStatus === "VERIFIED" ? at : hydrated.paymentVerifiedAt,
    updatedAt: at,
    ...(cleanNote !== undefined ? { adminNote: cleanNote } : {}),
    timeline,
  };
}

function applyAdminNoteTransform(existing: Inquiry, cleanNote: string): Inquiry {
  const at = new Date().toISOString();
  const hydrated = hydrateInquiry(existing);
  const timeline = [...(hydrated.timeline ?? [])];
  if (cleanNote) {
    timeline.push({
      id: `tl_${crypto.randomUUID().slice(0, 8)}`,
      status: "NOTE_UPDATED",
      label: "Park office update",
      note: cleanNote,
      at,
      actor: "park",
    });
  }

  return {
    ...hydrated,
    adminNote: cleanNote,
    updatedAt: at,
    timeline,
  };
}

function applyFirstPaymentTransform(
  actor: SessionUser,
  existing: Inquiry,
  payment: FirstPaymentSubmission,
  ref: string,
  sender: string,
  proofUrl?: string,
): Inquiry {
  const hydrated = hydrateInquiry(existing);
  if (
    actor.role !== "admin" &&
    hydrated.userEmail !== actor.email.toLowerCase()
  ) {
    throw new ServerInquiryError(
      "You can only submit payment for your own booking.",
      403,
    );
  }
  if (
    hydrated.status === "CANCELLED" ||
    hydrated.status === "DECLINED" ||
    hydrated.status === "COMPLETED"
  ) {
    throw new ServerInquiryError(
      "Payments cannot be submitted for closed, declined, or cancelled bookings.",
      400,
    );
  }
  if (hydrated.paymentStatus === "VERIFIED") {
    throw new ServerInquiryError(
      "This booking's first payment has already been verified.",
      400,
    );
  }

  const at = new Date().toISOString();
  const ratePerPerson = hydrated.ratePerPerson ?? 0;
  const packageSubtotal =
    hydrated.packageSubtotal ?? Math.max(0, ratePerPerson * hydrated.partySize);
  const facilitationFee = hydrated.facilitationFee ?? FACILITATION_FEE_PHP;
  const totalAmount = hydrated.totalAmount ?? packageSubtotal + facilitationFee;
  const firstPaymentRate = payment.firstPaymentRate === 1 ? 1 : 0.5;
  const firstPaymentAmount = Math.max(0, Math.round(totalAmount * firstPaymentRate));
  const balanceAmount = Math.max(0, totalAmount - firstPaymentAmount);

  const timeline = [...(hydrated.timeline ?? [])];
  timeline.push({
    id: `tl_${crypto.randomUUID().slice(0, 8)}`,
    status: "PAYMENT_SUBMITTED",
    label: "First payment submitted",
    note: `PHP ${firstPaymentAmount.toLocaleString("en-PH")} via ${payment.paymentMethod.replace("_", " ")} · Ref ${ref}`,
    at,
    actor: "visitor",
  });

  return {
    ...hydrated,
    ratePerPerson,
    totalAmount,
    firstPaymentRate,
    firstPaymentAmount,
    balanceAmount,
    paymentMethod: payment.paymentMethod,
    paymentReference: ref,
    paymentAccountName: sender || hydrated.fullName,
    ...(proofUrl ? { paymentProofUrl: proofUrl } : {}),
    paymentStatus: "PENDING_VERIFICATION",
    paymentSubmittedAt: at,
    updatedAt: at,
    timeline,
  };
}

function applyMessageTransform(
  actor: SessionUser,
  existing: Inquiry,
  cleanedBody: string,
): Inquiry {
  const hydrated = hydrateInquiry(existing);
  const isAdmin = actor.role === "admin";
  if (!isAdmin && hydrated.userEmail !== actor.email.toLowerCase()) {
    throw new ServerInquiryError(
      "You can only message park staff on your own bookings.",
      403,
    );
  }

  const at = new Date().toISOString();
  const sender: InquiryActor = isAdmin ? "park" : "visitor";
  const nextMessage: InquiryMessage = {
    id: `msg_${crypto.randomUUID().slice(0, 8)}`,
    sender,
    senderName: isAdmin ? "Park Ranger Desk" : actor.fullName || hydrated.fullName,
    body: cleanedBody,
    at,
  };

  return {
    ...hydrated,
    updatedAt: at,
    messages: [...(hydrated.messages ?? []), nextMessage],
  };
}

export async function listServerInquiriesForSession(
  session: SessionUser,
): Promise<Inquiry[]> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    const email = session.email.toLowerCase();
    const escapedEmail = `"${email.replace(/"/g, "")}"`;
    const baseQuery = admin
      .from("tour_inquiries")
      .select("*")
      .order("created_at", { ascending: false });

    const query =
      session.role === "admin"
        ? baseQuery
        : baseQuery.or(
            `user_email.eq.${escapedEmail},and(user_email.is.null,email.eq.${escapedEmail})`,
          );

    const { data, error } = await query;

    if (error || !data) {
      throw new ServerInquiryError("Could not load booking history.", 502);
    }

    const tourMap = await resolveMissingTourLookup(admin, data);
    return data.map((row) => rowToInquiry(row, tourMap));
  }

  const all = await inquiryStore.read();
  if (session.role === "admin") {
    return sortNewestFirst(all);
  }
  const email = session.email.toLowerCase();
  return sortNewestFirst(all.filter((entry) => entry.userEmail === email));
}

export async function getServerInquiryById(id: string): Promise<Inquiry | null> {
  const cleanId = id.trim();
  if (!cleanId) return null;

  const admin = getSupabaseAdminClient();
  if (admin) {
    if (!UUID_PATTERN.test(cleanId)) return null;
    const { data, error } = await admin
      .from("tour_inquiries")
      .select("*")
      .eq("id", cleanId)
      .maybeSingle();
    if (error || !data) return null;
    const tourMap = await resolveMissingTourLookup(admin, [data]);
    return rowToInquiry(data, tourMap);
  }

  const all = await inquiryStore.read();
  return all.find((entry) => entry.id === cleanId) ?? null;
}

export async function getServerInquiryByRef(
  reference: string,
): Promise<Inquiry | null> {
  const trimmed = reference.trim();
  const cleanRef = trimmed.toUpperCase();
  if (!cleanRef) return null;

  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data: byRef, error: refErr } = await admin
      .from("tour_inquiries")
      .select("*")
      .eq("reference_code", cleanRef)
      .maybeSingle();

    if (!refErr && byRef) {
      const tourMap = await resolveMissingTourLookup(admin, [byRef]);
      return rowToInquiry(byRef, tourMap);
    }

    if (UUID_PATTERN.test(trimmed)) {
      const { data: byId, error: idErr } = await admin
        .from("tour_inquiries")
        .select("*")
        .eq("id", trimmed)
        .maybeSingle();
      if (!idErr && byId) {
        const tourMap = await resolveMissingTourLookup(admin, [byId]);
        return rowToInquiry(byId, tourMap);
      }
    }

    return null;
  }

  const all = await inquiryStore.read();
  return (
    all.find(
      (entry) =>
        entry.reference.toUpperCase() === cleanRef || entry.id === trimmed,
    ) ?? null
  );
}

export async function getServerReservedBySlot(): Promise<Record<string, number>> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("tour_inquiries")
      .select("tour_id, tour_slug, target_date, party_size, status")
      .in("status", [...CANCELLABLE_STATUSES]);
    if (error || !data) return {};

    const tourMap = await resolveMissingTourLookup(admin, data, false);
    const counts: Record<string, number> = {};
    for (const row of data) {
      const slug = row.tour_slug ?? tourMap.get(row.tour_id)?.slug;
      if (!slug || !row.target_date) continue;
      const key = slotKey(slug, row.target_date);
      counts[key] = (counts[key] ?? 0) + Math.max(0, row.party_size);
    }
    return counts;
  }

  const all = await inquiryStore.read();
  return computeReservedBySlot(all);
}

export async function createServerInquiry(
  session: SessionUser,
  rawInput: unknown,
): Promise<Inquiry> {
  if (!rawInput || typeof rawInput !== "object" || Array.isArray(rawInput)) {
    throw new ServerInquiryError("Invalid booking payload.", 400);
  }
  const input = rawInput as Record<string, unknown>;

  const tourSlug = cleanText(String(input.tourSlug ?? ""), 120);
  const preferredDate = cleanText(String(input.preferredDate ?? ""), 10);
  const fullName = cleanText(String(input.fullName ?? ""), 120);
  const email = cleanEmail(String(input.email ?? ""));
  const phone = cleanPhone(String(input.phone ?? ""));
  const message = cleanText(String(input.message ?? ""), 2000);
  const rawPartySize = Number(input.partySize);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(preferredDate)) {
    throw new ServerInquiryError("Choose a valid preferred departure date.", 400);
  }
  const parsedDate = new Date(`${preferredDate}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    throw new ServerInquiryError("Choose a valid preferred departure date.", 400);
  }

  if (fullName.length < 2) {
    throw new ServerInquiryError("Enter your full name.", 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    throw new ServerInquiryError("Enter a valid contact email address.", 400);
  }
  if (!Number.isInteger(rawPartySize) || rawPartySize < 1 || rawPartySize > MAX_PARTY_SIZE) {
    throw new ServerInquiryError(
      `Party size must be between 1 and ${MAX_PARTY_SIZE} guests.`,
      400,
    );
  }

  const tours = await getTours();
  const tour = tours.find((entry) => entry.slug === tourSlug);
  if (!tour) {
    throw new ServerInquiryError("Select an active tour package.", 400);
  }

  if (rawPartySize > tour.maxCapacity) {
    throw new ServerInquiryError(
      `This package accepts up to ${tour.maxCapacity} guests per departure.`,
      400,
    );
  }

  const rawMethod = input.paymentMethod;
  const paymentMethod: PaymentMethod | undefined =
    typeof rawMethod === "string" && VALID_METHODS.includes(rawMethod as PaymentMethod)
      ? (rawMethod as PaymentMethod)
      : undefined;

  const isOnSiteCash = paymentMethod === "ON_SITE_CASH";
  const requestedRate = Number(input.firstPaymentRate);
  const firstPaymentRate = isOnSiteCash
    ? 0
    : requestedRate === 1
      ? 1
      : 0.5;

  // Compute financials strictly from authoritative tour pricing + ₱150 facilitation fee.
  const breakdown = computeBookingPricing(tour.ratePerPerson, rawPartySize);
  const ratePerPerson = breakdown.ratePerPerson;
  const totalAmount = breakdown.totalAmount;
  const firstPaymentAmount = isOnSiteCash
    ? 0
    : Math.round(totalAmount * firstPaymentRate);
  const balanceAmount = Math.max(0, totalAmount - firstPaymentAmount);

  const paymentReference = isOnSiteCash
    ? ""
    : cleanText(String(input.paymentReference ?? ""), 64);
  const paymentAccountName = cleanText(
    String(input.paymentAccountName ?? fullName),
    120,
  );
  const paymentProofUrl = isOnSiteCash
    ? undefined
    : sanitizeProofUrl(input.paymentProofUrl);

  const hasPayment =
    !isOnSiteCash && firstPaymentAmount > 0 && Boolean(paymentReference);
  const paymentStatus: PaymentStatus = hasPayment
    ? "PENDING_VERIFICATION"
    : "UNPAID";

  const buildDraftInquiry = (id: string, reference: string, now: Date): Inquiry => {
    const iso = now.toISOString();
    const paymentSummaryNote = isOnSiteCash
      ? `Reserved to pay at Park Jetty (PHP ${totalAmount.toLocaleString("en-PH")} total upon arrival)`
      : hasPayment
        ? `${Math.round(firstPaymentRate * 100)}% first payment (PHP ${firstPaymentAmount.toLocaleString("en-PH")}) via ${paymentMethod ?? "payment"} · Ref ${paymentReference}`
        : "Awaiting first payment submission";

    return hydrateInquiry({
      id,
      reference,
      userEmail: session.email.toLowerCase(),
      fullName,
      email,
      phone,
      tourSlug: tour.slug,
      tourTitle: tour.title,
      preferredDate,
      partySize: rawPartySize,
      message,
      status: "PENDING",
      createdAt: iso,
      ratePerPerson,
      packageSubtotal: breakdown.packageSubtotal,
      facilitationFee: breakdown.facilitationFee,
      operatorCommission: breakdown.operatorCommission,
      platformRevenue: breakdown.platformRevenue,
      totalAmount,
      firstPaymentRate,
      firstPaymentAmount,
      balanceAmount,
      ...(paymentMethod ? { paymentMethod } : {}),
      ...(paymentReference ? { paymentReference } : {}),
      ...(paymentAccountName ? { paymentAccountName } : {}),
      ...(paymentProofUrl ? { paymentProofUrl } : {}),
      paymentStatus,
      ...(hasPayment ? { paymentSubmittedAt: iso } : {}),
      timeline: [
        {
          id: `tl_${crypto.randomUUID().slice(0, 8)}`,
          status: "PENDING",
          label: hasPayment
            ? "Booking & first payment submitted"
            : "Booking request submitted",
          note: paymentSummaryNote,
          at: iso,
          actor: "visitor",
        },
      ],
      messages: [],
    });
  };

  const admin = getSupabaseAdminClient();
  if (admin) {
    return withSupabaseBookingLock(async () => {
      const [tourId, { data: sameDayRows, error: dayErr }] = await Promise.all([
        resolveOrEnsureSupabaseTourId(admin, tour),
        admin
          .from("tour_inquiries")
          .select("tour_id, tour_slug, party_size")
          .eq("target_date", preferredDate)
          .in("status", [...CANCELLABLE_STATUSES]),
      ]);

      if (dayErr) {
        throw new ServerInquiryError("Could not verify tour capacity.", 502);
      }

      const fallbackMap = await resolveMissingTourLookup(
        admin,
        sameDayRows ?? [],
        false,
      );
      let reserved = 0;
      for (const row of sameDayRows ?? []) {
        const slug =
          row.tour_slug ??
          (row.tour_id === tourId ? tour.slug : fallbackMap.get(row.tour_id)?.slug);
        if (slug === tour.slug) {
          reserved += Math.max(0, row.party_size);
        }
      }

      const remaining = Math.max(0, tour.maxCapacity - reserved);
      if (rawPartySize > remaining) {
        throw new ServerInquiryError(
          remaining === 0
            ? `${tour.title} is fully booked on ${preferredDate}. Pick another date.`
            : `Only ${remaining} seat${remaining === 1 ? "" : "s"} remain for ${tour.title} on ${preferredDate}.`,
          409,
        );
      }

      const tourMap: TourLookup = new Map([
        [tourId, { slug: tour.slug, title: tour.title }],
      ]);

      const userId = UUID_PATTERN.test(session.id) ? session.id : null;
      for (let attempt = 0; attempt < 3; attempt++) {
        const now = new Date();
        const baseRef = `NL-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
        const reference =
          attempt === 0 ? baseRef : `${baseRef}-${crypto.randomInt(10, 99)}`;
        const id = crypto.randomUUID();
        const draft = buildDraftInquiry(id, reference, now);

        const { data: inserted, error: insertErr } = await admin
          .from("tour_inquiries")
          .insert({
            id: draft.id,
            reference_code: draft.reference,
            tour_id: tourId,
            tour_slug: tour.slug,
            tour_title: tour.title,
            user_id: userId,
            user_email: session.email.toLowerCase(),
            full_name: draft.fullName,
            email: draft.email,
            phone: draft.phone || null,
            target_date: draft.preferredDate,
            party_size: draft.partySize,
            notes: draft.message || null,
            status: draft.status,
            rate_per_person: ratePerPerson,
            total_amount: totalAmount,
            first_payment_rate: firstPaymentRate,
            first_payment_amount: firstPaymentAmount,
            balance_amount: balanceAmount,
            payment_method: paymentMethod ?? null,
            payment_reference: paymentReference || null,
            payment_account_name: paymentAccountName || null,
            payment_proof_url: paymentProofUrl ?? null,
            payment_status: paymentStatus,
            payment_submitted_at: draft.paymentSubmittedAt ?? null,
            timeline: (draft.timeline ?? []) as unknown as Json,
            messages: [] as unknown as Json,
            created_at: draft.createdAt,
          })
          .select("*")
          .single();

        if (!insertErr && inserted) {
          return rowToInquiry(inserted, tourMap);
        }
        if (insertErr?.code === "23505" && attempt < 2) {
          continue;
        }
        throw new ServerInquiryError("Could not save booking right now.", 502);
      }

      throw new ServerInquiryError("Could not save booking right now.", 502);
    });
  }

  return inquiryStore.withLock((current) => {
    const reserved = getReservedSeatsForDate(current, tour.slug, preferredDate);
    const remaining = Math.max(0, tour.maxCapacity - reserved);
    if (rawPartySize > remaining) {
      throw new ServerInquiryError(
        remaining === 0
          ? `${tour.title} is fully booked on ${preferredDate}. Pick another date.`
          : `Only ${remaining} seat${remaining === 1 ? "" : "s"} remain for ${tour.title} on ${preferredDate}.`,
        409,
      );
    }

    const now = new Date();
    let reference = `NL-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`;
    if (current.some((entry) => entry.reference === reference)) {
      reference = `${reference}-${crypto.randomInt(10, 99)}`;
    }

    const inquiry = buildDraftInquiry(
      `inq_${crypto.randomUUID().slice(0, 8)}`,
      reference,
      now,
    );

    return {
      next: [inquiry, ...current],
      result: inquiry,
    };
  });
}

export async function acceptServerInquiry(
  actor: SessionUser,
  id: string,
  options?: { note?: string; verifyPayment?: boolean },
): Promise<Inquiry> {
  if (actor.role !== "admin") {
    throw new ServerInquiryError("Park staff clearance is required.", 403);
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    return mutateSupabaseInquiry(admin, id, (existing) =>
      applyAcceptTransform(existing, options),
    );
  }

  return inquiryStore.withLock((current) => {
    const index = current.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new ServerInquiryError("We could not find that booking.", 404);
    }
    const updated = applyAcceptTransform(current[index], options);
    const next = [...current];
    next[index] = updated;
    return { next, result: updated };
  });
}

export async function setServerInquiryStatus(
  actor: SessionUser,
  id: string,
  rawStatus: unknown,
  options?: { note?: string; paymentStatus?: unknown },
): Promise<Inquiry> {
  const status = assertValidStatus(rawStatus);
  const paymentStatus =
    options?.paymentStatus !== undefined
      ? assertValidPaymentStatus(options.paymentStatus)
      : undefined;

  const admin = getSupabaseAdminClient();
  if (admin) {
    return mutateSupabaseInquiry(admin, id, (existing) =>
      applyStatusTransform(actor, existing, status, {
        note: options?.note,
        paymentStatus,
      }),
    );
  }

  return inquiryStore.withLock((current) => {
    const index = current.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new ServerInquiryError("We could not find that booking.", 404);
    }

    const updated = applyStatusTransform(actor, current[index], status, {
      note: options?.note,
      paymentStatus,
    });
    const next = [...current];
    next[index] = updated;
    return { next, result: updated };
  });
}

export async function updateServerInquiryPaymentStatus(
  actor: SessionUser,
  id: string,
  rawPaymentStatus: unknown,
  note?: string,
): Promise<Inquiry> {
  if (actor.role !== "admin") {
    throw new ServerInquiryError("Park staff clearance is required.", 403);
  }
  const paymentStatus = assertValidPaymentStatus(rawPaymentStatus);
  const cleanNote = note !== undefined ? cleanText(note, 500) : undefined;

  const admin = getSupabaseAdminClient();
  if (admin) {
    return mutateSupabaseInquiry(admin, id, (existing) =>
      applyPaymentStatusTransform(existing, paymentStatus, cleanNote),
    );
  }

  return inquiryStore.withLock((current) => {
    const index = current.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new ServerInquiryError("We could not find that booking.", 404);
    }

    const updated = applyPaymentStatusTransform(
      current[index],
      paymentStatus,
      cleanNote,
    );
    const next = [...current];
    next[index] = updated;
    return { next, result: updated };
  });
}

export async function updateServerInquiryAdminNote(
  actor: SessionUser,
  id: string,
  adminNote: string,
): Promise<Inquiry> {
  if (actor.role !== "admin") {
    throw new ServerInquiryError("Park staff clearance is required.", 403);
  }
  const cleanNote = cleanText(adminNote, 500);

  const admin = getSupabaseAdminClient();
  if (admin) {
    return mutateSupabaseInquiry(admin, id, (existing) =>
      applyAdminNoteTransform(existing, cleanNote),
    );
  }

  return inquiryStore.withLock((current) => {
    const index = current.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new ServerInquiryError("We could not find that booking.", 404);
    }

    const updated = applyAdminNoteTransform(current[index], cleanNote);
    const next = [...current];
    next[index] = updated;
    return { next, result: updated };
  });
}

export async function submitServerFirstPayment(
  actor: SessionUser,
  id: string,
  payment: FirstPaymentSubmission,
): Promise<Inquiry> {
  if (!VALID_METHODS.includes(payment.paymentMethod)) {
    throw new ServerInquiryError("Select a valid payment channel.", 400);
  }
  const ref = cleanText(payment.paymentReference ?? "", 64);
  const sender = cleanText(payment.paymentAccountName ?? "", 120);
  if (!ref) {
    throw new ServerInquiryError(
      "Enter your payment reference or transaction number.",
      400,
    );
  }
  const proofUrl = sanitizeProofUrl(payment.paymentProofUrl);

  const admin = getSupabaseAdminClient();
  if (admin) {
    return mutateSupabaseInquiry(admin, id, (existing) =>
      applyFirstPaymentTransform(actor, existing, payment, ref, sender, proofUrl),
    );
  }

  return inquiryStore.withLock((current) => {
    const index = current.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new ServerInquiryError("We could not find that booking.", 404);
    }

    const updated = applyFirstPaymentTransform(
      actor,
      current[index],
      payment,
      ref,
      sender,
      proofUrl,
    );
    const next = [...current];
    next[index] = updated;
    return { next, result: updated };
  });
}

export async function addServerInquiryMessage(
  actor: SessionUser,
  id: string,
  body: string,
): Promise<Inquiry> {
  const cleanedBody = cleanText(body, 1000);
  if (!cleanedBody) {
    throw new ServerInquiryError("Enter a message before sending.", 400);
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    return mutateSupabaseInquiry(admin, id, (existing) =>
      applyMessageTransform(actor, existing, cleanedBody),
    );
  }

  return inquiryStore.withLock((current) => {
    const index = current.findIndex((entry) => entry.id === id);
    if (index === -1) {
      throw new ServerInquiryError("We could not find that booking.", 404);
    }

    const updated = applyMessageTransform(actor, current[index], cleanedBody);
    const next = [...current];
    next[index] = updated;
    return { next, result: updated };
  });
}

export async function deleteServerInquiry(
  actor: SessionUser,
  id: string,
): Promise<Inquiry> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    const { inquiry: target } = await fetchSupabaseInquiryById(admin, id);
    if (
      actor.role !== "admin" &&
      target.userEmail !== actor.email.toLowerCase()
    ) {
      throw new ServerInquiryError(
        "You can only delete bookings under your own account.",
        403,
      );
    }

    const { error } = await admin
      .from("tour_inquiries")
      .delete()
      .eq("id", target.id);
    if (error) {
      throw new ServerInquiryError("Could not delete booking right now.", 502);
    }
    return target;
  }

  return inquiryStore.withLock((current) => {
    const target = current.find((entry) => entry.id === id);
    if (!target) {
      throw new ServerInquiryError("We could not find that booking.", 404);
    }
    if (
      actor.role !== "admin" &&
      target.userEmail !== actor.email.toLowerCase()
    ) {
      throw new ServerInquiryError(
        "You can only delete bookings under your own account.",
        403,
      );
    }

    return {
      next: current.filter((entry) => entry.id !== id),
      result: target,
    };
  });
}
