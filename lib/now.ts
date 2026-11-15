"use client";

import { useSyncExternalStore } from "react";

/**
 * A minute-quantised clock for "3 minutes ago" labels.
 *
 * Reading `Date.now()` directly while rendering makes the server-rendered
 * markup disagree with the first client render (and re-renders every second).
 * Quantising to whole minutes keeps the snapshot stable, so the same label is
 * produced on the server and in the browser, and only refreshes when a minute
 * actually passes.
 *
 * The server snapshot is `null`: callers render a plain date until the client
 * takes over, which `useSyncExternalStore` handles without a hydration pass.
 */

const MINUTE = 60_000;

function subscribe(onStoreChange: () => void) {
  const timer = window.setInterval(onStoreChange, MINUTE);
  return () => window.clearInterval(timer);
}

let cached = 0;

function getSnapshot() {
  cached = Math.floor(Date.now() / MINUTE) * MINUTE;
  return cached;
}

function getServerSnapshot(): number | null {
  return null;
}

/** Whole-minute timestamp, or `null` before hydration. */
export function useMinuteNow(): number | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
