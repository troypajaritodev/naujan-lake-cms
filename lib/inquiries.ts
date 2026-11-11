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
  | "DECLINED";

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
};

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

function emit() {
  for (const listener of listeners) listener();
}

/** Subscribe to inquiry changes (new submission or a status edit). */
export function subscribeInquiries(listener: () => void): () => void {
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

export async function setInquiryStatus(
  id: string,
  status: InquiryStatus,
): Promise<Inquiry[]> {
  const next = readInquiries().map((inquiry) =>
    inquiry.id === id ? { ...inquiry, status } : inquiry,
  );

  writeInquiries(next);
  emit();

  return next.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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
