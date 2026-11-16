export type SubscriberStatus = "ACTIVE" | "UNSUBSCRIBED";

export type SubscriberTopic = "advisories" | "tours" | "events";

export type Subscriber = {
  id: string;
  email: string;
  status: SubscriberStatus;
  topics: SubscriberTopic[];
  subscribedAt: string;
};

export const VALID_SUBSCRIBER_TOPICS: readonly SubscriberTopic[] = [
  "advisories",
  "tours",
  "events",
];

export const SEED_SUBSCRIBERS: Subscriber[] = [
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

export class SubscribeError extends Error {
  field: "email" | "topics";

  constructor(message: string, field: "email" | "topics" = "email") {
    super(message);
    this.name = "SubscribeError";
    this.field = field;
  }
}

export type SubscribeOutcome = "created" | "resubscribed" | "updated";
