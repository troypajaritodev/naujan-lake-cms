/**
 * Tour inquiries & bookings submitted from the visitor portal (Requirement B —
 * customer transactions).
 *
 * The production table is `tour_inquiries` in `supabase/schema.sql`, but the
 * staff-facing reads are gated by `is_admin()`. Switching this module to
 * Supabase before Supabase Auth lands (Milestone 4) would show an empty admin
 * queue, so the demo store below stays authoritative for now. The API is
 * already asynchronous so that swap needs no callsite changes.
 *
 * Supports:
 * - First payment / downpayment tracking on booking submission
 * - Admin acceptance into `ON_PROCESS`, confirmation (`CONFIRMED`), and completion (`COMPLETED`)
 * - Chronological tracking timeline & staff remarks visible on `/account`
 */

import { useSyncExternalStore } from "react";

import { cleanEmail, cleanPhone, cleanText } from "@/lib/sanitize";

export type InquiryStatus =
  | "PENDING"
  | "ON_PROCESS"
  | "CONTACTED"
  | "CONFIRMED"
  | "COMPLETED"
  | "DECLINED"
  | "CANCELLED";

/** Who last moved an inquiry — the park through the queue, or the visitor. */
export type InquiryActor = "visitor" | "park";

export type PaymentMethod = "GCASH" | "MAYA" | "BANK_TRANSFER";

export type PaymentStatus =
  | "UNPAID"
  | "PENDING_VERIFICATION"
  | "VERIFIED"
  | "REFUNDED";

export type InquiryTimelineEntry = {
  id: string;
  status: InquiryStatus | "PAYMENT_SUBMITTED" | "PAYMENT_VERIFIED" | "NOTE_UPDATED";
  label: string;
  note?: string;
  at: string;
  actor: InquiryActor;
};

export type InquiryMessage = {
  id: string;
  sender: InquiryActor;
  senderName: string;
  body: string;
  at: string;
};

export type Inquiry = {
  id: string;
  reference: string;
  userEmail: string;
  fullName: string;
  email: string;
  phone: string;
  tourSlug: string;
  tourTitle: string;
  preferredDate: string;
  partySize: number;
  message: string;
  status: InquiryStatus;
  createdAt: string;
  /** When the status last changed. */
  updatedAt?: string;
  /** When the park accepted the booking and started processing it. */
  onProcessAt?: string;
  /** When the park confirmed the booking — cleared if the status moves back. */
  confirmedAt?: string;
  /** When the trip was marked completed. */
  completedAt?: string;
  /** When the request was withdrawn or cancelled. */
  cancelledAt?: string;
  /** Who made the latest change, so the guest can tell park from self. */
  decidedBy?: InquiryActor;
  /** Pricing & First Payment details. */
  ratePerPerson?: number;
  totalAmount?: number;
  firstPaymentRate?: number;
  firstPaymentAmount?: number;
  balanceAmount?: number;
  paymentMethod?: PaymentMethod;
  paymentReference?: string;
  paymentAccountName?: string;
  paymentProofUrl?: string;
  paymentStatus?: PaymentStatus;
  paymentSubmittedAt?: string;
  paymentVerifiedAt?: string;
  /** Latest staff remark shown on the visitor's tracking card. */
  adminNote?: string;
  /** Chronological history of booking and payment events. */
  timeline?: InquiryTimelineEntry[];
  /** Two-way conversation messages between visitor and park staff. */
  messages?: InquiryMessage[];
};

/** Thrown for guard failures the UI should phrase to a person, not a dev. */
export class InquiryError extends Error {}

/**
 * A request stays withdrawable while the trip has not completed or ended.
 * `COMPLETED`, `DECLINED`, and `CANCELLED` are terminal states.
 */
export const CANCELLABLE_STATUSES: readonly InquiryStatus[] = [
  "PENDING",
  "ON_PROCESS",
  "CONTACTED",
  "CONFIRMED",
];

export function canCancelInquiry(
  inquiry: Pick<Inquiry, "status">,
): boolean {
  return CANCELLABLE_STATUSES.includes(inquiry.status);
}

/** True once the request has reached a final or ready decision. */
export function isDecidedStatus(status: InquiryStatus): boolean {
  return (
    status === "CONFIRMED" ||
    status === "COMPLETED" ||
    status === "DECLINED" ||
    status === "CANCELLED"
  );
}

/**
 * Total seats currently held on a given tour + departure date across active
 * (non-declined, non-cancelled) bookings. Used to prevent overbooking.
 */
export function getReservedSeatsForDate(
  inquiries: readonly Inquiry[],
  tourSlug: string,
  preferredDate: string,
  excludeId?: string,
): number {
  if (!tourSlug || !preferredDate) return 0;
  return inquiries.reduce((sum, entry) => {
    if (entry.id === excludeId) return sum;
    if (entry.tourSlug !== tourSlug || entry.preferredDate !== preferredDate) {
      return sum;
    }
    if (!CANCELLABLE_STATUSES.includes(entry.status)) return sum;
    return sum + Math.max(0, entry.partySize);
  }, 0);
}

/** Fallback per-person rates matching seed tours for legacy records. */
const FALLBACK_TOUR_RATES: Record<string, number> = {
  "guided-birdwatching-expedition": 1850,
  "sunrise-boat-tour": 1200,
  "lakeside-community-homestay": 2400,
  "educational-research-trek": 1500,
};

export const INQUIRIES_KEY = "nl.inquiries.v1";

/**
 * Demo requests so the admin dashboard and visitor tracker have realistic
 * pending, on-process, confirmed, and declined bookings with first payments.
 */
const SEED_INQUIRIES: Inquiry[] = [
  {
    id: "inq_seed_1",
    reference: "NL-2026-104882",
    userEmail: "visitor@example.com",
    fullName: "Demo Visitor",
    email: "visitor@example.com",
    phone: "+63 917 000 0002",
    tourSlug: "sunrise-boat-tour",
    tourTitle: "Sunrise boat tour",
    preferredDate: "2026-11-24",
    partySize: 2,
    message: "Coming from Calapan, can we leave a motorbike at the jetty?",
    status: "PENDING",
    createdAt: "2026-11-14T09:12:00.000Z",
    ratePerPerson: 1200,
    totalAmount: 2400,
    firstPaymentRate: 0.5,
    firstPaymentAmount: 1200,
    balanceAmount: 1200,
    paymentMethod: "GCASH",
    paymentReference: "GC-884120934",
    paymentAccountName: "Demo Visitor",
    paymentStatus: "PENDING_VERIFICATION",
    paymentSubmittedAt: "2026-11-14T09:12:00.000Z",
    timeline: [
      {
        id: "tl_seed_1_1",
        status: "PENDING",
        label: "Booking & first payment submitted",
        note: "50% first payment (PHP 1,200) via GCash · Ref GC-884120934",
        at: "2026-11-14T09:12:00.000Z",
        actor: "visitor",
      },
    ],
  },
  {
    id: "inq_seed_5",
    reference: "NL-2026-104210",
    userEmail: "visitor@example.com",
    fullName: "Demo Visitor",
    email: "visitor@example.com",
    phone: "+63 917 000 0002",
    tourSlug: "guided-birdwatching-expedition",
    tourTitle: "Guided birdwatching expedition",
    preferredDate: "2026-11-28",
    partySize: 3,
    message: "We would love an early marsh run if the weather holds.",
    status: "ON_PROCESS",
    createdAt: "2026-11-10T06:30:00.000Z",
    updatedAt: "2026-11-11T02:15:00.000Z",
    onProcessAt: "2026-11-11T02:15:00.000Z",
    decidedBy: "park",
    ratePerPerson: 1850,
    totalAmount: 5550,
    firstPaymentRate: 0.5,
    firstPaymentAmount: 2775,
    balanceAmount: 2775,
    paymentMethod: "MAYA",
    paymentReference: "MY-552019481",
    paymentAccountName: "Demo Visitor",
    paymentStatus: "VERIFIED",
    paymentSubmittedAt: "2026-11-10T06:30:00.000Z",
    paymentVerifiedAt: "2026-11-11T02:15:00.000Z",
    adminNote:
      "First payment verified. Boat #2 and Licensed Spotter Marco are currently being scheduled.",
    timeline: [
      {
        id: "tl_seed_5_1",
        status: "PENDING",
        label: "Booking & first payment submitted",
        note: "50% first payment (PHP 2,775) via Maya · Ref MY-552019481",
        at: "2026-11-10T06:30:00.000Z",
        actor: "visitor",
      },
      {
        id: "tl_seed_5_2",
        status: "PAYMENT_VERIFIED",
        label: "First payment verified",
        note: "Confirmed PHP 2,775 deposit received via Maya.",
        at: "2026-11-11T02:15:00.000Z",
        actor: "park",
      },
      {
        id: "tl_seed_5_3",
        status: "ON_PROCESS",
        label: "Accepted · On Process",
        note: "Boat #2 and Licensed Spotter Marco are currently being scheduled.",
        at: "2026-11-11T02:15:00.000Z",
        actor: "park",
      },
    ],
    messages: [
      {
        id: "msg_seed_5_1",
        sender: "visitor",
        senderName: "Demo Visitor",
        body: "Hi! Do we need to bring our own rubber boots if the marsh trail is damp?",
        at: "2026-11-10T07:05:00.000Z",
      },
      {
        id: "msg_seed_5_2",
        sender: "park",
        senderName: "Park Ranger Desk",
        body: "Good morning! We have accepted your booking and verified your PHP 2,775 deposit. Water shoes or strapped sandals are great for the jetty boarding — boatmen will provide dry bags too.",
        at: "2026-11-11T02:18:00.000Z",
      },
    ],
  },
  {
    id: "inq_seed_2",
    reference: "NL-2026-103417",
    userEmail: "ana.reyes@example.com",
    fullName: "Ana Reyes",
    email: "ana.reyes@example.com",
    phone: "+63 918 442 1180",
    tourSlug: "guided-birdwatching-expedition",
    tourTitle: "Guided birdwatching expedition",
    preferredDate: "2026-11-21",
    partySize: 4,
    message: "Two of us have binoculars already.",
    status: "CONFIRMED",
    createdAt: "2026-11-02T07:40:00.000Z",
    updatedAt: "2026-11-03T02:10:00.000Z",
    onProcessAt: "2026-11-02T11:00:00.000Z",
    confirmedAt: "2026-11-03T02:10:00.000Z",
    decidedBy: "park",
    ratePerPerson: 1850,
    totalAmount: 7400,
    firstPaymentRate: 0.5,
    firstPaymentAmount: 3700,
    balanceAmount: 3700,
    paymentMethod: "GCASH",
    paymentReference: "GC-771024881",
    paymentAccountName: "Ana Reyes",
    paymentStatus: "VERIFIED",
    paymentSubmittedAt: "2026-11-02T07:40:00.000Z",
    paymentVerifiedAt: "2026-11-02T11:00:00.000Z",
    adminNote: "Cleared for 05:30 jetty departure. Remaining balance due on arrival.",
    timeline: [
      {
        id: "tl_seed_2_1",
        status: "PENDING",
        label: "Booking & first payment submitted",
        note: "50% first payment (PHP 3,700) via GCash · Ref GC-771024881",
        at: "2026-11-02T07:40:00.000Z",
        actor: "visitor",
      },
      {
        id: "tl_seed_2_2",
        status: "ON_PROCESS",
        label: "Accepted · On Process",
        note: "First payment verified and boat assignment started.",
        at: "2026-11-02T11:00:00.000Z",
        actor: "park",
      },
      {
        id: "tl_seed_2_3",
        status: "CONFIRMED",
        label: "Confirmed for departure",
        note: "Cleared for 05:30 jetty departure. Remaining balance due on arrival.",
        at: "2026-11-03T02:10:00.000Z",
        actor: "park",
      },
    ],
  },
  {
    id: "inq_seed_3",
    reference: "NL-2026-101905",
    userEmail: "carlo.mendoza@example.com",
    fullName: "Carlo Mendoza",
    email: "carlo.mendoza@example.com",
    phone: "+63 920 118 7743",
    tourSlug: "lakeside-community-homestay",
    tourTitle: "Lakeside community homestay",
    preferredDate: "2026-10-25",
    partySize: 3,
    message: "",
    status: "COMPLETED",
    createdAt: "2026-10-18T15:05:00.000Z",
    updatedAt: "2026-10-26T10:00:00.000Z",
    onProcessAt: "2026-10-19T01:00:00.000Z",
    confirmedAt: "2026-10-19T08:22:00.000Z",
    completedAt: "2026-10-26T10:00:00.000Z",
    decidedBy: "park",
    ratePerPerson: 2400,
    totalAmount: 7200,
    firstPaymentRate: 0.5,
    firstPaymentAmount: 3600,
    balanceAmount: 3600,
    paymentMethod: "BANK_TRANSFER",
    paymentReference: "LBP-9902145",
    paymentAccountName: "Carlo Mendoza",
    paymentStatus: "VERIFIED",
    paymentSubmittedAt: "2026-10-18T15:05:00.000Z",
    paymentVerifiedAt: "2026-10-19T01:00:00.000Z",
    adminNote: "Homestay completed with Barangay Bayani host family.",
  },
  {
    id: "inq_seed_4",
    reference: "NL-2026-100233",
    userEmail: "liza.bautista@example.com",
    fullName: "Liza Bautista",
    email: "liza.bautista@example.com",
    phone: "+63 915 903 2214",
    tourSlug: "educational-research-trek",
    tourTitle: "Educational research trek",
    preferredDate: "2026-10-11",
    partySize: 12,
    message: "Grade 11 field class, two teachers accompanying.",
    status: "DECLINED",
    createdAt: "2026-10-04T11:20:00.000Z",
    updatedAt: "2026-10-05T04:00:00.000Z",
    decidedBy: "park",
    ratePerPerson: 1500,
    totalAmount: 18000,
    firstPaymentRate: 0.5,
    firstPaymentAmount: 9000,
    balanceAmount: 9000,
    paymentMethod: "BANK_TRANSFER",
    paymentReference: "LBP-8834120",
    paymentAccountName: "Liza Bautista",
    paymentStatus: "REFUNDED",
    paymentSubmittedAt: "2026-10-04T11:20:00.000Z",
    adminNote: "Trail bridge closed for repair on requested date. Deposit refunded.",
  },
];

function hydrateInquiry(raw: Inquiry): Inquiry {
  const rate =
    typeof raw.ratePerPerson === "number" && raw.ratePerPerson >= 0
      ? raw.ratePerPerson
      : (FALLBACK_TOUR_RATES[raw.tourSlug] ?? 0);
  const total =
    typeof raw.totalAmount === "number" && raw.totalAmount >= 0
      ? raw.totalAmount
      : rate * raw.partySize;
  const firstPaymentAmount =
    typeof raw.firstPaymentAmount === "number" && raw.firstPaymentAmount >= 0
      ? raw.firstPaymentAmount
      : 0;
  const balanceAmount =
    typeof raw.balanceAmount === "number" && raw.balanceAmount >= 0
      ? raw.balanceAmount
      : Math.max(0, total - firstPaymentAmount);

  const paymentStatus: PaymentStatus =
    raw.paymentStatus ??
    (firstPaymentAmount > 0 && raw.paymentReference
      ? raw.status === "CONFIRMED" ||
        raw.status === "ON_PROCESS" ||
        raw.status === "COMPLETED"
        ? "VERIFIED"
        : "PENDING_VERIFICATION"
      : "UNPAID");

  const timeline =
    Array.isArray(raw.timeline) && raw.timeline.length > 0
      ? raw.timeline
      : buildFallbackTimeline(raw);

  return {
    ...raw,
    ratePerPerson: rate,
    totalAmount: total,
    firstPaymentRate:
      raw.firstPaymentRate ??
      (total > 0 && firstPaymentAmount > 0
        ? Math.round((firstPaymentAmount / total) * 100) / 100
        : 0.5),
    firstPaymentAmount,
    balanceAmount,
    paymentStatus,
    timeline,
    messages: Array.isArray(raw.messages) ? raw.messages : [],
  };
}

function buildFallbackTimeline(raw: Inquiry): InquiryTimelineEntry[] {
  const entries: InquiryTimelineEntry[] = [
    {
      id: `tl_${raw.id}_created`,
      status: "PENDING",
      label: "Booking request submitted",
      at: raw.createdAt,
      actor: "visitor",
    },
  ];

  if (raw.onProcessAt) {
    entries.push({
      id: `tl_${raw.id}_process`,
      status: "ON_PROCESS",
      label: "Accepted · On Process",
      at: raw.onProcessAt,
      actor: "park",
    });
  }
  if (raw.confirmedAt) {
    entries.push({
      id: `tl_${raw.id}_confirmed`,
      status: "CONFIRMED",
      label: "Confirmed by the park office",
      at: raw.confirmedAt,
      actor: "park",
    });
  }
  if (raw.completedAt) {
    entries.push({
      id: `tl_${raw.id}_completed`,
      status: "COMPLETED",
      label: "Trip completed",
      at: raw.completedAt,
      actor: "park",
    });
  }
  if (raw.cancelledAt) {
    entries.push({
      id: `tl_${raw.id}_cancelled`,
      status: "CANCELLED",
      label:
        raw.decidedBy === "visitor"
          ? "Withdrawn by visitor"
          : "Cancelled by park office",
      at: raw.cancelledAt,
      actor: raw.decidedBy ?? "visitor",
    });
  } else if (raw.status !== "PENDING" && entries.length === 1 && raw.updatedAt) {
    entries.push({
      id: `tl_${raw.id}_updated`,
      status: raw.status,
      label: `Marked ${raw.status.toLowerCase().replace("_", " ")}`,
      at: raw.updatedAt,
      actor: raw.decidedBy ?? "park",
    });
  }

  return entries;
}

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readInquiries(): Inquiry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(INQUIRIES_KEY);
    if (!raw) {
      window.localStorage.setItem(INQUIRIES_KEY, JSON.stringify(SEED_INQUIRIES));
      return SEED_INQUIRIES.map(hydrateInquiry);
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? (parsed as Inquiry[]).map(hydrateInquiry)
      : [];
  } catch {
    return [];
  }
}

function writeInquiries(inquiries: Inquiry[]) {
  if (!canUseStorage()) return;
  window.localStorage.setItem(INQUIRIES_KEY, JSON.stringify(inquiries));
}

const EMPTY: Inquiry[] = [];
const listeners = new Set<() => void>();
let storageBound = false;

function emit() {
  for (const listener of listeners) listener();
}

/**
 * One `storage` listener for the module, so an acceptance made in the staff
 * tab reaches an account page already open in another tab. The event only
 * fires in *other* documents; this tab's own writes notify through `emit()`.
 */
function bindStorage() {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;

  window.addEventListener("storage", (event) => {
    if (event.key === INQUIRIES_KEY) emit();
  });
}

/** Subscribe to inquiry changes (new submission or a status edit). */
export function subscribeInquiries(listener: () => void): () => void {
  bindStorage();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function sortRaw(raw: string | null): Inquiry[] {
  if (!raw) return EMPTY;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    return (parsed as Inquiry[])
      .map(hydrateInquiry)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    return EMPTY;
  }
}

let snapshotRaw: string | null = null;
let snapshotValue: Inquiry[] = EMPTY;

/**
 * Cached snapshot for `useSyncExternalStore` — the same array reference is
 * returned until the stored inquiries actually change.
 */
export function getInquiriesSnapshot(): Inquiry[] {
  if (!canUseStorage()) return EMPTY;

  let raw = window.localStorage.getItem(INQUIRIES_KEY);
  if (raw === null) {
    writeInquiries([...SEED_INQUIRIES]); // seeds the demo rows on first run
    raw = JSON.stringify(SEED_INQUIRIES);
  }

  if (raw !== snapshotRaw) {
    snapshotRaw = raw;
    snapshotValue = sortRaw(raw);
  }

  return snapshotValue;
}

export function getServerInquiriesSnapshot(): Inquiry[] {
  return EMPTY;
}

/** Live, newest-first inquiry list for client components. */
export function useInquiries(): Inquiry[] {
  return useSyncExternalStore(
    subscribeInquiries,
    getInquiriesSnapshot,
    getServerInquiriesSnapshot,
  );
}

/** Every inquiry, newest first — used by the admin dashboard. */
export async function getAllInquiries(): Promise<Inquiry[]> {
  return readInquiries().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function statusTimelineLabel(
  status: InquiryStatus,
  actor: InquiryActor,
): string {
  switch (status) {
    case "PENDING":
      return "Moved back to Pending";
    case "ON_PROCESS":
      return "Accepted · On Process";
    case "CONTACTED":
      return "Contacted by park office";
    case "CONFIRMED":
      return "Confirmed for departure";
    case "COMPLETED":
      return "Trip completed";
    case "DECLINED":
      return "Declined by park office";
    case "CANCELLED":
      return actor === "visitor"
        ? "Withdrawn by visitor"
        : "Cancelled by park office";
  }
}

/**
 * Stamp a status change. Decision timestamps track the *current* status only:
 * re-queuing a booking clears downstream stamps so the account page never
 * claims a withdrawn request is still confirmed.
 */
function stamp(
  inquiry: Inquiry,
  status: InquiryStatus,
  at: string,
  actor: InquiryActor,
  options?: { note?: string; paymentStatus?: PaymentStatus },
): Inquiry {
  const hydrated = hydrateInquiry(inquiry);
  const cleanNote =
    options?.note !== undefined ? cleanText(options.note, 500) : undefined;

  const next: Inquiry = {
    ...hydrated,
    status,
    updatedAt: at,
    decidedBy: actor,
    ...(cleanNote !== undefined ? { adminNote: cleanNote } : {}),
  };

  if (options?.paymentStatus) {
    next.paymentStatus = options.paymentStatus;
    if (options.paymentStatus === "VERIFIED" && !next.paymentVerifiedAt) {
      next.paymentVerifiedAt = at;
    }
  }

  if (status === "ON_PROCESS") {
    next.onProcessAt = hydrated.onProcessAt ?? at;
    delete next.confirmedAt;
    delete next.completedAt;
    delete next.cancelledAt;
  } else if (status === "CONFIRMED") {
    next.onProcessAt = hydrated.onProcessAt ?? at;
    next.confirmedAt = at;
    delete next.completedAt;
    delete next.cancelledAt;
  } else if (status === "COMPLETED") {
    next.onProcessAt = hydrated.onProcessAt ?? at;
    next.confirmedAt = hydrated.confirmedAt ?? at;
    next.completedAt = at;
    delete next.cancelledAt;
  } else if (status === "CANCELLED") {
    next.cancelledAt = at;
    delete next.confirmedAt;
    delete next.completedAt;
  } else {
    delete next.confirmedAt;
    delete next.completedAt;
    delete next.cancelledAt;
    if (status === "PENDING") {
      delete next.onProcessAt;
    }
  }

  const timeline = [...(hydrated.timeline ?? [])];
  timeline.push({
    id: `tl_${crypto.randomUUID().slice(0, 8)}`,
    status,
    label: statusTimelineLabel(status, actor),
    ...(cleanNote ? { note: cleanNote } : {}),
    at,
    actor,
  });
  next.timeline = timeline;

  return next;
}

export async function setInquiryStatus(
  id: string,
  status: InquiryStatus,
  options?: {
    actor?: InquiryActor;
    note?: string;
    paymentStatus?: PaymentStatus;
  },
): Promise<Inquiry[]> {
  const at = new Date().toISOString();
  const actor: InquiryActor = options?.actor ?? "park";

  const next = readInquiries().map((inquiry) =>
    inquiry.id === id
      ? stamp(inquiry, status, at, actor, {
          note: options?.note,
          paymentStatus: options?.paymentStatus,
        })
      : inquiry,
  );

  writeInquiries(next);
  emit();

  return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Admin accepts a pending booking: verifies the submitted first payment (if
 * present) and moves the booking into `ON_PROCESS` so the user sees it
 * progressing on `/account`.
 */
export async function acceptInquiry(
  id: string,
  options?: { note?: string; verifyPayment?: boolean },
): Promise<Inquiry[]> {
  const at = new Date().toISOString();
  const list = readInquiries();

  const next = list.map((inquiry) => {
    if (inquiry.id !== id) return inquiry;
    const hydrated = hydrateInquiry(inquiry);
    const shouldVerify =
      options?.verifyPayment !== false &&
      (hydrated.firstPaymentAmount ?? 0) > 0 &&
      hydrated.paymentStatus === "PENDING_VERIFICATION";

    const updated = stamp(hydrated, "ON_PROCESS", at, "park", {
      note:
        options?.note ??
        (hydrated.adminNote ||
          "Booking accepted by park staff. Boat, guide, and permit are now being prepared."),
      paymentStatus: shouldVerify ? "VERIFIED" : hydrated.paymentStatus,
    });

    if (shouldVerify) {
      updated.paymentVerifiedAt = at;
      const timeline = [...(updated.timeline ?? [])];
      // Insert payment verification right before the ON_PROCESS entry for clarity.
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
  });

  writeInquiries(next);
  emit();

  return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Admin verifies, rejects, or marks refunded a booking's first payment. */
export async function updateInquiryPaymentStatus(
  id: string,
  paymentStatus: PaymentStatus,
  note?: string,
): Promise<Inquiry[]> {
  const at = new Date().toISOString();
  const cleanNote = note !== undefined ? cleanText(note, 500) : undefined;

  const next = readInquiries().map((inquiry) => {
    if (inquiry.id !== id) return inquiry;
    const hydrated = hydrateInquiry(inquiry);
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
      paymentVerifiedAt:
        paymentStatus === "VERIFIED" ? at : hydrated.paymentVerifiedAt,
      updatedAt: at,
      ...(cleanNote !== undefined ? { adminNote: cleanNote } : {}),
      timeline,
    };
  });

  writeInquiries(next);
  emit();

  return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Save a staff progress note on a booking without changing its status. */
export async function updateInquiryAdminNote(
  id: string,
  adminNote: string,
): Promise<Inquiry[]> {
  const at = new Date().toISOString();
  const cleanNote = cleanText(adminNote, 500);

  const next = readInquiries().map((inquiry) => {
    if (inquiry.id !== id) return inquiry;
    const hydrated = hydrateInquiry(inquiry);
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
  });

  writeInquiries(next);
  emit();

  return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type FirstPaymentSubmission = {
  paymentMethod: PaymentMethod;
  paymentReference: string;
  paymentAccountName: string;
  firstPaymentRate: number;
  firstPaymentAmount: number;
  totalAmount: number;
  ratePerPerson: number;
  paymentProofUrl?: string;
};

/**
 * Allows a visitor to submit or update first payment details from `/account`
 * if an older booking was created without one.
 */
export async function submitFirstPayment(
  id: string,
  userEmail: string,
  payment: FirstPaymentSubmission,
): Promise<Inquiry> {
  const normalized = userEmail.trim().toLowerCase();
  const list = readInquiries();
  const existing = list.find((entry) => entry.id === id);

  if (!existing) {
    throw new InquiryError("We could not find that booking.");
  }
  if (existing.userEmail !== normalized) {
    throw new InquiryError("You can only submit payment for your own booking.");
  }

  const ref = cleanText(payment.paymentReference, 64);
  const sender = cleanText(payment.paymentAccountName, 120);
  if (!ref) {
    throw new InquiryError("Enter your payment reference or transaction number.");
  }

  const at = new Date().toISOString();
  const hydrated = hydrateInquiry(existing);
  const totalAmount = Math.max(0, Math.round(payment.totalAmount));
  const firstPaymentAmount = Math.max(0, Math.round(payment.firstPaymentAmount));
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

  const updated: Inquiry = {
    ...hydrated,
    ratePerPerson: payment.ratePerPerson,
    totalAmount,
    firstPaymentRate: payment.firstPaymentRate,
    firstPaymentAmount,
    balanceAmount,
    paymentMethod: payment.paymentMethod,
    paymentReference: ref,
    paymentAccountName: sender || hydrated.fullName,
    ...(payment.paymentProofUrl ? { paymentProofUrl: payment.paymentProofUrl } : {}),
    paymentStatus: "PENDING_VERIFICATION",
    paymentSubmittedAt: at,
    updatedAt: at,
    timeline,
  };

  const next = list.map((entry) => (entry.id === id ? updated : entry));
  writeInquiries(next);
  emit();

  return updated;
}

/**
 * Append a direct correspondence message between visitor and park staff.
 */
export async function addInquiryMessage(
  id: string,
  sender: InquiryActor,
  senderName: string,
  body: string,
): Promise<Inquiry> {
  const cleanedBody = cleanText(body, 1000);
  if (!cleanedBody) {
    throw new InquiryError("Enter a message before sending.");
  }

  const list = readInquiries();
  const existing = list.find((entry) => entry.id === id);
  if (!existing) {
    throw new InquiryError("We could not find that booking.");
  }

  const hydrated = hydrateInquiry(existing);
  const at = new Date().toISOString();
  const nextMessage: InquiryMessage = {
    id: `msg_${crypto.randomUUID().slice(0, 8)}`,
    sender,
    senderName:
      cleanText(senderName, 80) ||
      (sender === "park" ? "Park Ranger Desk" : hydrated.fullName),
    body: cleanedBody,
    at,
  };

  const updated: Inquiry = {
    ...hydrated,
    updatedAt: at,
    messages: [...(hydrated.messages ?? []), nextMessage],
  };

  const next = list.map((entry) => (entry.id === id ? updated : entry));
  writeInquiries(next);
  emit();

  return updated;
}

/**
 * Withdraw a booking request on the visitor's own account. Ownership is
 * checked against the email the request was filed under, and only while the
 * status is still cancellable.
 */
export async function cancelInquiry(
  id: string,
  userEmail: string,
): Promise<Inquiry> {
  const normalized = userEmail.trim().toLowerCase();
  const list = readInquiries();
  const inquiry = list.find((entry) => entry.id === id);

  if (!inquiry) {
    throw new InquiryError("We could not find that request.");
  }
  if (inquiry.userEmail !== normalized) {
    throw new InquiryError(
      "Only the visitor who made this request can withdraw it.",
    );
  }
  if (!canCancelInquiry(inquiry)) {
    throw new InquiryError("This request can no longer be withdrawn.");
  }

  const cancelled = stamp(
    inquiry,
    "CANCELLED",
    new Date().toISOString(),
    "visitor",
  );
  const next = list.map((entry) => (entry.id === id ? cancelled : entry));

  writeInquiries(next);
  emit();

  return cancelled;
}

export async function getInquiriesFor(email: string): Promise<Inquiry[]> {
  const normalized = email.trim().toLowerCase();
  return readInquiries()
    .filter((inquiry) => inquiry.userEmail === normalized)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type InquiryInput = Omit<
  Inquiry,
  "id" | "reference" | "status" | "createdAt" | "timeline" | "paymentSubmittedAt"
>;

export async function createInquiry(input: InquiryInput): Promise<Inquiry> {
  const now = new Date();
  const iso = now.toISOString();
  const partySize = Math.min(50, Math.max(1, Math.trunc(input.partySize) || 1));
  const ratePerPerson =
    typeof input.ratePerPerson === "number" && input.ratePerPerson >= 0
      ? input.ratePerPerson
      : (FALLBACK_TOUR_RATES[input.tourSlug] ?? 0);
  const totalAmount =
    typeof input.totalAmount === "number" && input.totalAmount >= 0
      ? Math.round(input.totalAmount)
      : ratePerPerson * partySize;
  const firstPaymentRate = input.firstPaymentRate ?? 0.5;
  const firstPaymentAmount =
    typeof input.firstPaymentAmount === "number" && input.firstPaymentAmount >= 0
      ? Math.round(input.firstPaymentAmount)
      : Math.round(totalAmount * firstPaymentRate);
  const balanceAmount = Math.max(0, totalAmount - firstPaymentAmount);
  const paymentReference = cleanText(input.paymentReference ?? "", 64);
  const paymentAccountName = cleanText(
    input.paymentAccountName ?? input.fullName,
    120,
  );
  const hasPayment = firstPaymentAmount > 0 && Boolean(paymentReference);
  const paymentMethod: PaymentMethod | undefined = input.paymentMethod;
  const paymentStatus: PaymentStatus = hasPayment
    ? "PENDING_VERIFICATION"
    : "UNPAID";

  const paymentSummaryNote = hasPayment
    ? `${Math.round(firstPaymentRate * 100)}% first payment (PHP ${firstPaymentAmount.toLocaleString("en-PH")}) via ${paymentMethod ?? "payment"} · Ref ${paymentReference}`
    : "Awaiting first payment submission";

  const inquiry: Inquiry = {
    ...input,
    fullName: cleanText(input.fullName, 120),
    email: cleanEmail(input.email),
    userEmail: cleanEmail(input.userEmail),
    phone: cleanPhone(input.phone),
    tourSlug: cleanText(input.tourSlug, 120),
    tourTitle: cleanText(input.tourTitle, 160),
    preferredDate: cleanText(input.preferredDate, 10),
    partySize,
    message: cleanText(input.message, 2000),
    ratePerPerson,
    totalAmount,
    firstPaymentRate,
    firstPaymentAmount,
    balanceAmount,
    ...(paymentMethod ? { paymentMethod } : {}),
    ...(paymentReference ? { paymentReference } : {}),
    ...(paymentAccountName ? { paymentAccountName } : {}),
    ...(input.paymentProofUrl ? { paymentProofUrl: input.paymentProofUrl } : {}),
    paymentStatus,
    ...(hasPayment ? { paymentSubmittedAt: iso } : {}),
    id: `inq_${crypto.randomUUID().slice(0, 8)}`,
    reference: `NL-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`,
    status: "PENDING",
    createdAt: iso,
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
  };

  writeInquiries([inquiry, ...readInquiries()]);

  emit();
  return inquiry;
}
