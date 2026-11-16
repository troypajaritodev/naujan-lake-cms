/**
 * Client-side reactive store for tour inquiries & bookings.
 *
 * All reads and mutations synchronize with `/api/inquiries` and
 * `/api/inquiries/[id]`, using `localStorage` strictly as a cross-tab cache
 * for the active session.
 */

import { useEffect, useSyncExternalStore } from "react";
import {
  canCancelInquiry,
  CANCELLABLE_STATUSES,
  computeBookingPricing,
  FACILITATION_FEE_PHP,
  formatPhpAmount,
  getBookingEconomics,
  getReservedSeatsForDate,
  hydrateInquiry,
  InquiryError,
  isDecidedStatus,
  OPERATOR_COMMISSION_RATE,
  slotKey,
  summarizePortfolioEconomics,
  VARIABLE_COST_PER_BOOKING_PHP,
  type BookingEconomics,
  type BookingPricingBreakdown,
  type FirstPaymentSubmission,
  type Inquiry,
  type InquiryActor,
  type InquiryInput,
  type InquiryMessage,
  type InquiryStatus,
  type InquiryTimelineEntry,
  type PaymentMethod,
  type PaymentStatus,
  type PortfolioEconomicsSummary,
} from "@/lib/inquiries-shared";

export {
  canCancelInquiry,
  CANCELLABLE_STATUSES,
  computeBookingPricing,
  FACILITATION_FEE_PHP,
  formatPhpAmount,
  getBookingEconomics,
  getReservedSeatsForDate,
  InquiryError,
  isDecidedStatus,
  OPERATOR_COMMISSION_RATE,
  slotKey,
  summarizePortfolioEconomics,
  VARIABLE_COST_PER_BOOKING_PHP,
  type BookingEconomics,
  type BookingPricingBreakdown,
  type FirstPaymentSubmission,
  type Inquiry,
  type InquiryActor,
  type InquiryInput,
  type InquiryMessage,
  type InquiryStatus,
  type InquiryTimelineEntry,
  type PaymentMethod,
  type PaymentStatus,
  type PortfolioEconomicsSummary,
};

export const INQUIRIES_KEY = "nl.inquiries.v1";
const RESERVED_SLOTS_KEY = "nl.reserved_slots.v1";

const EMPTY_INQUIRIES: Inquiry[] = [];
const EMPTY_SLOTS: Record<string, number> = {};

let cachedInquiriesRaw: string | null = null;
let cachedInquiries: Inquiry[] = EMPTY_INQUIRIES;

let cachedSlotsRaw: string | null = null;
let cachedSlots: Record<string, number> = EMPTY_SLOTS;

const listeners = new Set<() => void>();
let storageBound = false;
let inFlightRefresh: Promise<Inquiry[]> | null = null;
let hasSyncedOnce = false;

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function emit() {
  for (const listener of listeners) listener();
}

function bindStorage() {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;

  window.addEventListener("storage", (event) => {
    if (event.key === INQUIRIES_KEY) {
      cachedInquiriesRaw = null;
      emit();
    } else if (event.key === RESERVED_SLOTS_KEY) {
      cachedSlotsRaw = null;
      emit();
    }
  });
}

function setInquiriesCache(list: Inquiry[]): Inquiry[] {
  const hydrated = list.map(hydrateInquiry);
  const serialized = JSON.stringify(hydrated);
  cachedInquiriesRaw = serialized;
  cachedInquiries = hydrated;
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(INQUIRIES_KEY, serialized);
    } catch {
      const slim = hydrated.map((entry) => {
        if (!entry.paymentProofUrl) return entry;
        const copy = { ...entry };
        delete copy.paymentProofUrl;
        return copy;
      });
      try {
        const slimJson = JSON.stringify(slim);
        cachedInquiriesRaw = slimJson;
        cachedInquiries = slim;
        window.localStorage.setItem(INQUIRIES_KEY, slimJson);
      } catch {
        // Ignore quota failure; memory cache stays up to date.
      }
    }
  }
  return cachedInquiries;
}

function setReservedSlotsCache(slots: Record<string, number>) {
  const serialized = JSON.stringify(slots);
  cachedSlotsRaw = serialized;
  cachedSlots = slots;
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(RESERVED_SLOTS_KEY, serialized);
    } catch {
      // Ignore storage quota errors.
    }
  }
}

function readInquiries(): Inquiry[] {
  if (!canUseStorage()) return EMPTY_INQUIRIES;

  try {
    const raw = window.localStorage.getItem(INQUIRIES_KEY);
    if (!raw) {
      cachedInquiriesRaw = null;
      cachedInquiries = EMPTY_INQUIRIES;
      return EMPTY_INQUIRIES;
    }
    if (raw === cachedInquiriesRaw) return cachedInquiries;
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? (parsed as Inquiry[]).map(hydrateInquiry)
      : EMPTY_INQUIRIES;
    cachedInquiriesRaw = raw;
    cachedInquiries = list;
    return cachedInquiries;
  } catch {
    return EMPTY_INQUIRIES;
  }
}

function readReservedSlots(): Record<string, number> {
  if (!canUseStorage()) return EMPTY_SLOTS;

  try {
    const raw = window.localStorage.getItem(RESERVED_SLOTS_KEY);
    if (!raw) {
      cachedSlotsRaw = null;
      cachedSlots = EMPTY_SLOTS;
      return EMPTY_SLOTS;
    }
    if (raw === cachedSlotsRaw) return cachedSlots;
    const parsed = JSON.parse(raw);
    const map =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, number>)
        : EMPTY_SLOTS;
    cachedSlotsRaw = raw;
    cachedSlots = map;
    return cachedSlots;
  } catch {
    return EMPTY_SLOTS;
  }
}

export function clearClientInquiries(): void {
  hasSyncedOnce = false;
  setInquiriesCache(EMPTY_INQUIRIES);
  emit();
}

export async function refreshInquiriesFromServer(): Promise<Inquiry[]> {
  if (typeof window === "undefined") return EMPTY_INQUIRIES;
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    try {
      const response = await fetch("/api/inquiries", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        return readInquiries();
      }
      const data = (await response.json()) as {
        inquiries?: Inquiry[];
        reservedBySlot?: Record<string, number>;
      };
      if (data.reservedBySlot && typeof data.reservedBySlot === "object") {
        setReservedSlotsCache(data.reservedBySlot);
      }
      const next = setInquiriesCache(
        Array.isArray(data.inquiries) ? data.inquiries : EMPTY_INQUIRIES,
      );
      hasSyncedOnce = true;
      emit();
      return next;
    } catch {
      return readInquiries();
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

function ensureInitialSync() {
  if (typeof window === "undefined" || hasSyncedOnce || inFlightRefresh) return;
  void refreshInquiriesFromServer();
}

/** Subscribe to inquiry & slot cache changes. */
export function subscribeInquiries(listener: () => void): () => void {
  bindStorage();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getInquiriesSnapshot(): Inquiry[] {
  return readInquiries();
}

export function getServerInquiriesSnapshot(): Inquiry[] {
  return EMPTY_INQUIRIES;
}

export function getReservedSlotsSnapshot(): Record<string, number> {
  return readReservedSlots();
}

export function getServerReservedSlotsSnapshot(): Record<string, number> {
  return EMPTY_SLOTS;
}

/** Reactive booking list synced with the server for the current session. */
export function useInquiries(): Inquiry[] {
  useEffect(() => {
    ensureInitialSync();
  }, []);

  return useSyncExternalStore(
    subscribeInquiries,
    getInquiriesSnapshot,
    getServerInquiriesSnapshot,
  );
}

/** Reactive map of `tourSlug::preferredDate` -> reserved seats across all bookings. */
export function useReservedSeatsBySlot(): Record<string, number> {
  useEffect(() => {
    ensureInitialSync();
  }, []);

  return useSyncExternalStore(
    subscribeInquiries,
    getReservedSlotsSnapshot,
    getServerReservedSlotsSnapshot,
  );
}

export async function getAllInquiries(): Promise<Inquiry[]> {
  const list = await refreshInquiriesFromServer();
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getInquiriesFor(email: string): Promise<Inquiry[]> {
  const normalized = email.trim().toLowerCase();
  const list = await getAllInquiries();
  return list.filter((inquiry) => inquiry.userEmail === normalized);
}

async function patchInquiry(
  id: string,
  payload: Record<string, unknown>,
  fallbackError: string,
): Promise<{ inquiry: Inquiry; inquiries: Inquiry[] }> {
  const response = await fetch(`/api/inquiries/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => ({}))) as {
    inquiry?: Inquiry;
    inquiries?: Inquiry[];
    reservedBySlot?: Record<string, number>;
    error?: string;
  };

  if (!response.ok || !data.inquiry) {
    throw new InquiryError(data.error ?? fallbackError);
  }

  if (data.reservedBySlot && typeof data.reservedBySlot === "object") {
    setReservedSlotsCache(data.reservedBySlot);
  }
  const inquiries = setInquiriesCache(data.inquiries ?? readInquiries());
  emit();

  return {
    inquiry: hydrateInquiry(data.inquiry),
    inquiries,
  };
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
  const { inquiries } = await patchInquiry(
    id,
    {
      action: "status",
      status,
      note: options?.note,
      paymentStatus: options?.paymentStatus,
    },
    "Could not update booking status.",
  );
  return [...inquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function acceptInquiry(
  id: string,
  options?: { note?: string; verifyPayment?: boolean },
): Promise<Inquiry[]> {
  const { inquiries } = await patchInquiry(
    id,
    {
      action: "accept",
      note: options?.note,
      verifyPayment: options?.verifyPayment,
    },
    "Could not accept this booking.",
  );
  return [...inquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateInquiryPaymentStatus(
  id: string,
  paymentStatus: PaymentStatus,
  note?: string,
): Promise<Inquiry[]> {
  const { inquiries } = await patchInquiry(
    id,
    {
      action: "payment_status",
      paymentStatus,
      note,
    },
    "Could not update payment status.",
  );
  return [...inquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateInquiryAdminNote(
  id: string,
  adminNote: string,
): Promise<Inquiry[]> {
  const { inquiries } = await patchInquiry(
    id,
    {
      action: "admin_note",
      adminNote,
    },
    "Could not save staff note.",
  );
  return [...inquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function submitFirstPayment(
  id: string,
  _userEmail: string,
  payment: FirstPaymentSubmission,
): Promise<Inquiry> {
  const { inquiry } = await patchInquiry(
    id,
    {
      action: "first_payment",
      payment,
    },
    "Could not submit your first payment details.",
  );
  return inquiry;
}

export async function addInquiryMessage(
  id: string,
  _sender: InquiryActor,
  _senderName: string,
  body: string,
): Promise<Inquiry> {
  const { inquiry } = await patchInquiry(
    id,
    {
      action: "message",
      body,
    },
    "Could not send message.",
  );
  return inquiry;
}

export async function cancelInquiry(
  id: string,
  _userEmail: string,
): Promise<Inquiry> {
  void _userEmail;
  const { inquiry } = await patchInquiry(
    id,
    {
      action: "status",
      status: "CANCELLED",
    },
    "Could not withdraw booking.",
  );
  return inquiry;
}

export async function deleteInquiry(
  id: string,
  _userEmail: string,
  _options?: { isAdmin?: boolean },
): Promise<Inquiry> {
  void _userEmail;
  void _options;
  const response = await fetch(`/api/inquiries/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  const data = (await response.json().catch(() => ({}))) as {
    deleted?: Inquiry;
    inquiries?: Inquiry[];
    reservedBySlot?: Record<string, number>;
    error?: string;
  };

  if (!response.ok || !data.deleted) {
    throw new InquiryError(data.error ?? "Could not delete booking.");
  }

  if (data.reservedBySlot && typeof data.reservedBySlot === "object") {
    setReservedSlotsCache(data.reservedBySlot);
  }
  setInquiriesCache(data.inquiries ?? readInquiries());
  emit();

  return hydrateInquiry(data.deleted);
}

export async function createInquiry(input: InquiryInput): Promise<Inquiry> {
  const response = await fetch("/api/inquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  const data = (await response.json().catch(() => ({}))) as {
    inquiry?: Inquiry;
    error?: string;
  };

  if (!response.ok || !data.inquiry) {
    throw new InquiryError(data.error ?? "Could not submit booking request.");
  }

  const created = hydrateInquiry(data.inquiry);
  const current = readInquiries();
  setInquiriesCache([created, ...current.filter((e) => e.id !== created.id)]);
  const nextSlots = { ...readReservedSlots() };
  const key = slotKey(created.tourSlug, created.preferredDate);
  nextSlots[key] = (nextSlots[key] ?? 0) + created.partySize;
  setReservedSlotsCache(nextSlots);
  emit();

  return created;
}
