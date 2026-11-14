/**
 * Tour inquiries submitted from the visitor portal (Requirement B — customer
 * transactions).
 *
 * The production table is `tour_inquiries` in `supabase/schema.sql`, but the
 * staff-facing reads are gated by `is_admin()`. Switching this module to
 * Supabase before Supabase Auth lands (Milestone 4) would show an empty admin
 * queue, so the demo store below stays authoritative for now. The API is
 * already asynchronous so that swap needs no callsite changes.
 *
 * The admin chrome reads this store live (`useInquiries`, `useInquiryAlerts`)
 * so a new booking lights up the pending badge without a reload. The snapshot
 * helpers exist for `useSyncExternalStore` and are intentionally exported from
 * here so `lib/inquiry-alerts.ts` can compose them.
 */

import { useSyncExternalStore } from "react";

import { cleanEmail, cleanPhone, cleanText } from "@/lib/sanitize";

export type InquiryStatus =
  | "PENDING"
  | "CONTACTED"
  | "CONFIRMED"
  | "DECLINED"
  | "CANCELLED";

/** Who last moved an inquiry — the park through the queue, or the visitor. */
export type InquiryActor = "visitor" | "park";

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
  /** When the park accepted the booking — cleared if the status moves on. */
  confirmedAt?: string;
  /** When the request was withdrawn. */
  cancelledAt?: string;
  /** Who made the latest change, so the guest can tell park from self. */
  decidedBy?: InquiryActor;
};

/** Thrown for guard failures the UI should phrase to a person, not a dev. */
export class InquiryError extends Error {}

/**
 * A request stays withdrawable while there is still something to withdraw.
 * `DECLINED` and `CANCELLED` are terminal: the park already turned it down,
 * or it has already been cancelled.
 */
export const CANCELLABLE_STATUSES: readonly InquiryStatus[] = [
  "PENDING",
  "CONTACTED",
  "CONFIRMED",
];

export function canCancelInquiry(
  inquiry: Pick<Inquiry, "status">,
): boolean {
  return CANCELLABLE_STATUSES.includes(inquiry.status);
}

/** True once the request has left the queue for good or for bad. */
export function isDecidedStatus(status: InquiryStatus): boolean {
  return (
    status === "CONFIRMED" || status === "DECLINED" || status === "CANCELLED"
  );
}

export const INQUIRIES_KEY = "nl.inquiries.v1";

/**
 * Demo requests so the admin dashboard has something to report on before a
 * real booking comes through. Replaced by the `tour_inquiries` table later.
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
    preferredDate: "2026-11-14",
    partySize: 2,
    message: "Coming from Calapan, can we leave a motorbike at the jetty?",
    status: "PENDING",
    createdAt: "2026-11-06T09:12:00.000Z",
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
    confirmedAt: "2026-11-03T02:10:00.000Z",
    decidedBy: "park",
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
    status: "CONFIRMED",
    createdAt: "2026-10-18T15:05:00.000Z",
    updatedAt: "2026-10-19T08:22:00.000Z",
    confirmedAt: "2026-10-19T08:22:00.000Z",
    decidedBy: "park",
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
  },
];

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readInquiries(): Inquiry[] {
  if (!canUseStorage()) return [];

  try {
    const raw = window.localStorage.getItem(INQUIRIES_KEY);
    if (!raw) {
      window.localStorage.setItem(INQUIRIES_KEY, JSON.stringify(SEED_INQUIRIES));
      return [...SEED_INQUIRIES];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Inquiry[]) : [];
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
    return (parsed as Inquiry[]).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
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

/**
 * Stamp a status change. Decision timestamps track the *current* status only:
 * re-queuing a booking clears the stamps so the account page never claims a
 * withdrawn request is still confirmed.
 */
function stamp(
  inquiry: Inquiry,
  status: InquiryStatus,
  at: string,
  actor: InquiryActor,
): Inquiry {
  const next: Inquiry = { ...inquiry, status, updatedAt: at, decidedBy: actor };

  if (status === "CONFIRMED") {
    next.confirmedAt = at;
    delete next.cancelledAt;
  } else if (status === "CANCELLED") {
    next.cancelledAt = at;
    delete next.confirmedAt;
  } else {
    delete next.confirmedAt;
    delete next.cancelledAt;
  }

  return next;
}

export async function setInquiryStatus(
  id: string,
  status: InquiryStatus,
  options?: { actor?: InquiryActor },
): Promise<Inquiry[]> {
  const at = new Date().toISOString();
  const actor: InquiryActor = options?.actor ?? "park";

  const next = readInquiries().map((inquiry) =>
    inquiry.id === id ? stamp(inquiry, status, at, actor) : inquiry,
  );

  writeInquiries(next);
  emit();

  return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Withdraw a booking request on the visitor's own account. Ownership is
 * checked against the email the request was filed under, and only while the
 * status is still cancellable — a confirmed booking can be withdrawn (the
 * park is emailed so the boat is freed), a declined or cancelled one cannot.
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

  const cancelled = stamp(inquiry, "CANCELLED", new Date().toISOString(), "visitor");
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
  "id" | "reference" | "status" | "createdAt"
>;

export async function createInquiry(input: InquiryInput): Promise<Inquiry> {
  const now = new Date();
  const inquiry: Inquiry = {
    ...input,
    fullName: cleanText(input.fullName, 120),
    email: cleanEmail(input.email),
    userEmail: cleanEmail(input.userEmail),
    phone: cleanPhone(input.phone),
    tourSlug: cleanText(input.tourSlug, 120),
    tourTitle: cleanText(input.tourTitle, 160),
    preferredDate: cleanText(input.preferredDate, 10),
    partySize: Math.min(50, Math.max(1, Math.trunc(input.partySize) || 1)),
    message: cleanText(input.message, 2000),
    id: `inq_${crypto.randomUUID().slice(0, 8)}`,
    reference: `NL-${now.getFullYear()}-${String(now.getTime()).slice(-6)}`,
    status: "PENDING",
    createdAt: now.toISOString(),
  };

  writeInquiries([inquiry, ...readInquiries()]);

  emit();
  return inquiry;
}
