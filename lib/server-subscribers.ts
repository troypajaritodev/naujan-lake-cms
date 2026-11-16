import "server-only";

import crypto from "node:crypto";
import { JsonFileStore } from "@/lib/json-store";
import { cleanEmail } from "@/lib/sanitize";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Tables } from "@/lib/supabase/types";
import {
  SEED_SUBSCRIBERS,
  SubscribeError,
  VALID_SUBSCRIBER_TOPICS,
  type Subscriber,
  type SubscriberStatus,
  type SubscriberTopic,
  type SubscribeOutcome,
} from "@/lib/subscribers-shared";

const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const subscriberStore = new JsonFileStore<Subscriber[]>({
  filename: "subscribers.json",
  fallbackSubdir: "naujan-lake-subscribers",
  normalize: (raw) =>
    Array.isArray(raw) ? (raw as Subscriber[]) : [...SEED_SUBSCRIBERS],
});

function normalizeTopics(topics: unknown): SubscriberTopic[] {
  if (!Array.isArray(topics)) return [];
  const unique = new Set<SubscriberTopic>();
  for (const item of topics) {
    if (
      typeof item === "string" &&
      VALID_SUBSCRIBER_TOPICS.includes(item as SubscriberTopic)
    ) {
      unique.add(item as SubscriberTopic);
    }
  }
  return [...unique];
}

function rowToSubscriber(row: Tables<"subscribers">): Subscriber {
  return {
    id: row.id,
    email: row.email.toLowerCase(),
    status: row.status === "UNSUBSCRIBED" ? "UNSUBSCRIBED" : "ACTIVE",
    topics: normalizeTopics(row.topics),
    subscribedAt: row.subscribed_at,
  };
}

export async function listServerSubscribers(): Promise<Subscriber[]> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("subscribers")
      .select("*")
      .order("subscribed_at", { ascending: false });
    if (error || !data) {
      throw new SubscribeError("Could not load subscribers right now.");
    }
    return data.map(rowToSubscriber);
  }

  const list = await subscriberStore.read();
  return [...list].sort((a, b) => b.subscribedAt.localeCompare(a.subscribedAt));
}

export async function isServerSubscribed(email: string): Promise<boolean> {
  const normalized = cleanEmail(email);
  if (!normalized) return false;

  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data, error } = await admin
      .from("subscribers")
      .select("status")
      .eq("email", normalized)
      .maybeSingle();
    return !error && data?.status === "ACTIVE";
  }

  const list = await subscriberStore.read();
  return list.some(
    (entry) => entry.email === normalized && entry.status === "ACTIVE",
  );
}

export async function subscribeServer(
  rawEmail: string,
  rawTopics: unknown,
): Promise<{ subscriber: Subscriber; outcome: SubscribeOutcome }> {
  const normalized = cleanEmail(rawEmail ?? "");
  const topics = normalizeTopics(rawTopics);

  if (!EMAIL_PATTERN.test(normalized)) {
    throw new SubscribeError("Enter a valid email address.", "email");
  }
  if (topics.length === 0) {
    throw new SubscribeError("Pick at least one topic.", "topics");
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data: existing, error: lookupError } = await admin
      .from("subscribers")
      .select("*")
      .eq("email", normalized)
      .maybeSingle();

    if (lookupError) {
      throw new SubscribeError("Subscription storage is unavailable right now.");
    }

    if (!existing) {
      const { data: created, error: insertError } = await admin
        .from("subscribers")
        .insert({
          email: normalized,
          status: "ACTIVE",
          topics,
          subscribed_at: new Date().toISOString(),
        })
        .select("*")
        .single();

      if (insertError || !created) {
        throw new SubscribeError("Could not save subscription right now.");
      }

      return {
        subscriber: rowToSubscriber(created),
        outcome: "created",
      };
    }

    const outcome: SubscribeOutcome =
      existing.status === "ACTIVE" ? "updated" : "resubscribed";
    const subscribedAt =
      existing.status === "ACTIVE"
        ? existing.subscribed_at
        : new Date().toISOString();

    const { data: updated, error: updateError } = await admin
      .from("subscribers")
      .update({
        status: "ACTIVE",
        topics,
        subscribed_at: subscribedAt,
      })
      .eq("id", existing.id)
      .select("*")
      .single();

    if (updateError || !updated) {
      throw new SubscribeError("Could not update subscription right now.");
    }

    return {
      subscriber: rowToSubscriber(updated),
      outcome,
    };
  }

  return subscriberStore.withLock((current) => {
    const existingIndex = current.findIndex((entry) => entry.email === normalized);
    const existing = existingIndex >= 0 ? current[existingIndex] : undefined;

    if (!existing) {
      const created: Subscriber = {
        id: `sub_${crypto.randomUUID().slice(0, 8)}`,
        email: normalized,
        status: "ACTIVE",
        topics,
        subscribedAt: new Date().toISOString(),
      };
      return {
        next: [...current, created],
        result: { subscriber: created, outcome: "created" as SubscribeOutcome },
      };
    }

    const outcome: SubscribeOutcome =
      existing.status === "ACTIVE" ? "updated" : "resubscribed";
    const updated: Subscriber = {
      ...existing,
      status: "ACTIVE",
      topics,
      subscribedAt:
        existing.status === "ACTIVE"
          ? existing.subscribedAt
          : new Date().toISOString(),
    };

    const next = [...current];
    next[existingIndex] = updated;
    return {
      next,
      result: { subscriber: updated, outcome },
    };
  });
}

export async function setServerSubscriberStatus(
  id: string,
  status: SubscriberStatus,
): Promise<Subscriber[]> {
  if (status !== "ACTIVE" && status !== "UNSUBSCRIBED") {
    throw new SubscribeError("Invalid subscriber status.");
  }

  const admin = getSupabaseAdminClient();
  if (admin) {
    if (UUID_PATTERN.test(id)) {
      const { error } = await admin
        .from("subscribers")
        .update({ status })
        .eq("id", id);
      if (error) {
        throw new SubscribeError("Could not update subscriber status right now.");
      }
    }
    return listServerSubscribers();
  }

  return subscriberStore.withLock((current) => {
    const next = current.map((entry) =>
      entry.id === id ? { ...entry, status } : entry,
    );
    return { next, result: next };
  });
}

export async function unsubscribeServer(email: string): Promise<boolean> {
  const normalized = cleanEmail(email ?? "");
  if (!EMAIL_PATTERN.test(normalized)) return false;

  const admin = getSupabaseAdminClient();
  if (admin) {
    const { data: existing, error: lookupError } = await admin
      .from("subscribers")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();

    if (lookupError || !existing) return false;

    const { error: updateError } = await admin
      .from("subscribers")
      .update({ status: "UNSUBSCRIBED" })
      .eq("id", existing.id);

    return !updateError;
  }

  return subscriberStore.withLock((current) => {
    const index = current.findIndex((entry) => entry.email === normalized);
    if (index === -1) {
      return { next: current, result: false, skipWrite: true };
    }
    const next = current.map((entry, i) =>
      i === index ? { ...entry, status: "UNSUBSCRIBED" as const } : entry,
    );
    return { next, result: true };
  });
}
