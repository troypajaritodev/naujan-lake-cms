"use client";

/**
 * Admin notification state (Requirement G — CMS feedback loop).
 *
 * A request is "new" when the admin has not looked at the inquiry list since it
 * arrived. We keep that marker in `localStorage` so the badge survives reloads
 * and can be cleared the moment the admin opens the Inquiries page.
 */

import { useSyncExternalStore } from "react";
import {
  getInquiriesSnapshot,
  getServerInquiriesSnapshot,
  subscribeInquiries,
  type Inquiry,
} from "@/lib/inquiries";

export const INQUIRIES_SEEN_KEY = "nl.inquiries.seen.v1";

const seenListeners = new Set<() => void>();

function emitSeen() {
  for (const listener of seenListeners) listener();
}

function subscribeSeen(listener: () => void): () => void {
  seenListeners.add(listener);
  return () => seenListeners.delete(listener);
}

let seenCached = false;
let seenRaw: string | null = null;
let seenValue = 0;

/** Timestamp (ms) of the last time the admin opened the inquiry list. */
export function getSeenSnapshot(): number {
  if (typeof window === "undefined" || !("localStorage" in window)) return 0;

  const raw = window.localStorage.getItem(INQUIRIES_SEEN_KEY);
  if (!seenCached || raw !== seenRaw) {
    seenCached = true;
    seenRaw = raw;
    const parsed = Number(raw);
    seenValue = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  return seenValue;
}

export function getServerSeenSnapshot(): number {
  return 0;
}

/** Called once the admin has actually seen the list — clears every badge. */
export function markInquiriesSeen(at: number = Date.now()): void {
  if (typeof window === "undefined" || !("localStorage" in window)) return;

  window.localStorage.setItem(INQUIRIES_SEEN_KEY, String(at));
  emitSeen();
}

export type InquiryAlerts = {
  /** Bookings still waiting on a decision — the thing the admin must act on. */
  pending: number;
  /** Everything that arrived since the admin last opened the list. */
  unread: number;
  /** Ids of the unread requests, for highlighting rows. */
  unreadIds: Set<string>;
  /** Most recent pending request, used for the header alert text. */
  latest: Inquiry | null;
};

export function useInquiryAlerts(): InquiryAlerts {
  const inquiries = useSyncExternalStore(
    subscribeInquiries,
    getInquiriesSnapshot,
    getServerInquiriesSnapshot,
  );
  const seenAt = useSyncExternalStore(
    subscribeSeen,
    getSeenSnapshot,
    getServerSeenSnapshot,
  );

  let pending = 0;
  let unread = 0;
  let latest: Inquiry | null = null;
  const unreadIds = new Set<string>();

  for (const inquiry of inquiries) {
    if (inquiry.status === "PENDING") {
      pending += 1;
      if (!latest) latest = inquiry;
    }

    const createdAt = Date.parse(inquiry.createdAt);
    if (Number.isFinite(createdAt) && createdAt > seenAt) {
      unread += 1;
      unreadIds.add(inquiry.id);
    }
  }

  return { pending, unread, unreadIds, latest };
}

/** "3 new bookings" / "1 new booking" — shared by the header and the banner. */
export function bookingCountLabel(count: number): string {
  return `${count} new booking${count === 1 ? "" : "s"}`;
}
