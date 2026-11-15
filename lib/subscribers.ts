/**
 * Newsletter subscribers (PRD FR-4.3).
 *
 * Mirrors the `subscribers` table in `supabase/schema.sql`, but stays on the
 * demo store until Supabase Auth (Milestone 4): the table lets anyone insert
 * yet only staff may read the audience, so a live read would look empty to the
 * admin panel. The API is asynchronous so that swap needs no callsite changes.
 */

import { useSyncExternalStore } from "react";
import { cleanEmail } from "@/lib/sanitize";

export type SubscriberStatus = "ACTIVE" | "UNSUBSCRIBED";

export type SubscriberTopic = "advisories" | "tours" | "events";

export type Subscriber = {
  id: string;
  email: string;
  status: SubscriberStatus;
  topics: SubscriberTopic[];
  subscribedAt: string;
};

export const SUBSCRIBERS_KEY = "nl.subscribers.v1";

const SEED_SUBSCRIBERS: Subscriber[] = [
  {
    id: "sub_seed_1",
    email: "visitor@example.com",
    status: "ACTIVE",
    topics: ["advisories", "tours", "events"],
    subscribedAt: "2026-10-18T08:15:00.000Z",
  },
  {
    id: "sub_seed_2",
    email: "ana.reyes@example.com",
    status: "ACTIVE",
    topics: ["advisories", "tours"],
    subscribedAt: "2026-10-25T14:20:00.000Z",
  },
  {
    id: "sub_seed_3",
    email: "carlos.mendoza@example.com",
    status: "ACTIVE",
    topics: ["advisories", "events"],
    subscribedAt: "2026-11-01T06:45:00.000Z",
  },
  {
    id: "sub_seed_4",
    email: "liza.bautista@example.com",
    status: "UNSUBSCRIBED",
    topics: ["events"],
    subscribedAt: "2026-09-12T10:00:00.000Z",
  },
];

const SERVER_SNAPSHOT: Subscriber[] = [];
const STORE_EVENT = "nl:subscribers";
let cachedRaw: string | null = null;
let cachedList: Subscriber[] = [];

function emit() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STORE_EVENT));
  }
}

export const topicLabels: Record<SubscriberTopic, string> = {
  advisories: "Park advisories",
  tours: "Tour releases",
  events: "Counts & volunteer days",
};

export const topicDescriptions: Record<SubscriberTopic, string> = {
  advisories: "Water levels, closures and weather notices from the park office.",
  tours: "New packages, seasonal rates and operator announcements.",
  events: "Waterbird census dates, clean-ups and training invitations.",
};

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export class SubscribeError extends Error {
  field: "email" | "topics";

  constructor(message: string, field: "email" | "topics" = "email") {
    super(message);
    this.name = "SubscribeError";
    this.field = field;
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && "localStorage" in window;
}

function readSubscribers(): Subscriber[] {
  if (!canUseStorage()) return SERVER_SNAPSHOT;

  try {
    const raw = window.localStorage.getItem(SUBSCRIBERS_KEY);
    if (!raw) {
      const seededJson = JSON.stringify(SEED_SUBSCRIBERS);
      window.localStorage.setItem(SUBSCRIBERS_KEY, seededJson);
      cachedRaw = seededJson;
      cachedList = SEED_SUBSCRIBERS;
      return cachedList;
    }
    if (raw === cachedRaw) return cachedList;
    const parsed = JSON.parse(raw);
    cachedRaw = raw;
    cachedList = Array.isArray(parsed) ? (parsed as Subscriber[]) : [];
    return cachedList;
  } catch {
    return SERVER_SNAPSHOT;
  }
}

function writeSubscribers(next: Subscriber[]) {
  if (!canUseStorage()) return;
  const serialized = JSON.stringify(next);
  window.localStorage.setItem(SUBSCRIBERS_KEY, serialized);
  cachedRaw = serialized;
  cachedList = next;
  emit();
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

export function useSubscribers(): Subscriber[] {
  return useSyncExternalStore(
    subscribeStore,
    readSubscribers,
    () => SERVER_SNAPSHOT,
  );
}

export async function listSubscribers(): Promise<Subscriber[]> {
  return readSubscribers();
}

export async function isSubscribed(email: string): Promise<boolean> {
  const normalized = cleanEmail(email);
  return readSubscribers().some(
    (entry) => entry.email === normalized && entry.status === "ACTIVE",
  );
}

export type SubscribeOutcome = "created" | "resubscribed" | "updated";

/**
 * Adds or re-activates an address. Returns which of the three happened so the
 * form can say something specific instead of a generic "subscribed".
 */
export async function subscribe(
  email: string,
  topics: SubscriberTopic[],
): Promise<{ subscriber: Subscriber; outcome: SubscribeOutcome }> {
  const normalized = cleanEmail(email);

  if (!EMAIL_PATTERN.test(normalized)) {
    throw new SubscribeError("Enter a valid email address.", "email");
  }
  if (topics.length === 0) {
    throw new SubscribeError("Pick at least one topic.", "topics");
  }

  const subscribers = [...readSubscribers()];
  const existing = subscribers.find((entry) => entry.email === normalized);

  let subscriber: Subscriber;
  let outcome: SubscribeOutcome;

  if (!existing) {
    subscriber = {
      id: `sub_${Date.now().toString(36)}`,
      email: normalized,
      status: "ACTIVE",
      topics,
      subscribedAt: new Date().toISOString(),
    };
    subscribers.push(subscriber);
    outcome = "created";
  } else {
    outcome = existing.status === "ACTIVE" ? "updated" : "resubscribed";
    subscriber = {
      ...existing,
      status: "ACTIVE",
      topics,
      subscribedAt:
        existing.status === "ACTIVE"
          ? existing.subscribedAt
          : new Date().toISOString(),
    };
    const index = subscribers.findIndex((entry) => entry.id === existing.id);
    subscribers[index] = subscriber;
  }

  const next = [...subscribers];
  writeSubscribers(next);

  return { subscriber, outcome };
}

export async function setSubscriberStatus(
  id: string,
  status: SubscriberStatus,
): Promise<Subscriber[]> {
  const next = readSubscribers().map((entry) =>
    entry.id === id ? { ...entry, status } : entry,
  );
  writeSubscribers(next);
  return next;
}

export async function unsubscribe(email: string): Promise<boolean> {
  const normalized = cleanEmail(email);
  const subscribers = readSubscribers();
  const index = subscribers.findIndex((entry) => entry.email === normalized);

  if (index === -1) return false;

  const next = subscribers.map((entry, i) =>
    i === index ? { ...entry, status: "UNSUBSCRIBED" as const } : entry,
  );
  writeSubscribers(next);

  return true;
}
