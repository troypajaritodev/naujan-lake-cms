/**
 * Client-side reactive store for newsletter subscribers.
 *
 * All mutations and admin reads synchronize with `/api/subscribers`.
 */

import { useEffect, useSyncExternalStore } from "react";
import { cleanEmail } from "@/lib/sanitize";
import {
  SubscribeError,
  topicDescriptions,
  topicLabels,
  type Subscriber,
  type SubscriberStatus,
  type SubscriberTopic,
  type SubscribeOutcome,
} from "@/lib/subscribers-shared";

export {
  SubscribeError,
  topicDescriptions,
  topicLabels,
  type Subscriber,
  type SubscriberStatus,
  type SubscriberTopic,
  type SubscribeOutcome,
};

export const SUBSCRIBERS_KEY = "nl.subscribers.v1";

const EMPTY_SUBSCRIBERS: Subscriber[] = [];
const STORE_EVENT = "nl:subscribers";

let cachedRaw: string | null = null;
let cachedList: Subscriber[] = EMPTY_SUBSCRIBERS;
let hasSyncedOnce = false;
let inFlightRefresh: Promise<Subscriber[]> | null = null;

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STORE_EVENT));
  }
}

function setSubscribersCache(subscribers: Subscriber[]): Subscriber[] {
  const serialized = JSON.stringify(subscribers);
  cachedRaw = serialized;
  cachedList = subscribers;
  if (canUseStorage()) {
    try {
      window.localStorage.setItem(SUBSCRIBERS_KEY, serialized);
    } catch {
      // Ignore quota failure; memory cache stays fresh.
    }
  }
  return cachedList;
}

function readSubscribers(): Subscriber[] {
  if (!canUseStorage()) return EMPTY_SUBSCRIBERS;

  try {
    const raw = window.localStorage.getItem(SUBSCRIBERS_KEY);
    if (!raw) {
      cachedRaw = null;
      cachedList = EMPTY_SUBSCRIBERS;
      return EMPTY_SUBSCRIBERS;
    }
    if (raw === cachedRaw) return cachedList;
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed)
      ? (parsed as Subscriber[])
      : EMPTY_SUBSCRIBERS;
    cachedRaw = raw;
    cachedList = list;
    return cachedList;
  } catch {
    return EMPTY_SUBSCRIBERS;
  }
}

function subscribeStore(listener: () => void) {
  if (typeof window === "undefined") return () => {};

  const onStorage = (event: StorageEvent) => {
    if (event.key === SUBSCRIBERS_KEY) listener();
  };
  window.addEventListener(STORE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(STORE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Subscriber[] {
  return readSubscribers();
}

function getServerSnapshot(): Subscriber[] {
  return EMPTY_SUBSCRIBERS;
}

export function clearClientSubscribers(): void {
  hasSyncedOnce = false;
  setSubscribersCache(EMPTY_SUBSCRIBERS);
  emit();
}

export async function refreshSubscribersFromServer(): Promise<Subscriber[]> {
  if (typeof window === "undefined") return EMPTY_SUBSCRIBERS;
  if (inFlightRefresh) return inFlightRefresh;

  inFlightRefresh = (async () => {
    try {
      const response = await fetch("/api/subscribers", {
        method: "GET",
        cache: "no-store",
      });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setSubscribersCache(EMPTY_SUBSCRIBERS);
          emit();
        }
        return readSubscribers();
      }
      const data = (await response.json()) as { subscribers?: Subscriber[] };
      const next = setSubscribersCache(
        Array.isArray(data.subscribers) ? data.subscribers : EMPTY_SUBSCRIBERS,
      );
      hasSyncedOnce = true;
      emit();
      return next;
    } catch {
      return readSubscribers();
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

function ensureInitialSync() {
  if (typeof window === "undefined" || hasSyncedOnce || inFlightRefresh) return;
  void refreshSubscribersFromServer();
}

export function useSubscribers(): Subscriber[] {
  useEffect(() => {
    ensureInitialSync();
  }, []);

  return useSyncExternalStore(subscribeStore, getSnapshot, getServerSnapshot);
}

export async function listSubscribers(): Promise<Subscriber[]> {
  return refreshSubscribersFromServer();
}

export async function isSubscribed(email: string): Promise<boolean> {
  const normalized = cleanEmail(email);
  const cached = readSubscribers();
  if (cached.length > 0) {
    return cached.some(
      (entry) => entry.email === normalized && entry.status === "ACTIVE",
    );
  }
  try {
    const response = await fetch("/api/subscribers?mine=1", {
      cache: "no-store",
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { subscribed?: boolean };
    return Boolean(data.subscribed);
  } catch {
    return false;
  }
}

export async function subscribe(
  email: string,
  topics: SubscriberTopic[],
): Promise<{ subscriber: Subscriber; outcome: SubscribeOutcome }> {
  const response = await fetch("/api/subscribers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, topics }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    subscriber?: Subscriber;
    outcome?: SubscribeOutcome;
    error?: string;
    field?: "email" | "topics";
  };

  if (!response.ok || !data.subscriber || !data.outcome) {
    throw new SubscribeError(
      data.error ?? "Could not save your subscription.",
      data.field ?? "email",
    );
  }

  hasSyncedOnce = false;
  return {
    subscriber: data.subscriber,
    outcome: data.outcome,
  };
}

export async function setSubscriberStatus(
  id: string,
  status: SubscriberStatus,
): Promise<Subscriber[]> {
  const response = await fetch("/api/subscribers", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status }),
  });

  const data = (await response.json().catch(() => ({}))) as {
    subscribers?: Subscriber[];
    error?: string;
  };

  if (!response.ok || !Array.isArray(data.subscribers)) {
    throw new SubscribeError(
      data.error ?? "Could not update subscriber status.",
    );
  }

  const next = setSubscribersCache(data.subscribers);
  hasSyncedOnce = true;
  emit();
  return next;
}

export async function unsubscribe(email: string): Promise<boolean> {
  const response = await fetch("/api/subscribers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "unsubscribe", email }),
  });

  if (!response.ok) return false;
  const data = (await response.json().catch(() => ({}))) as {
    removed?: boolean;
  };
  hasSyncedOnce = false;
  return Boolean(data.removed);
}
