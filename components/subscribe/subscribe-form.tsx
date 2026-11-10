"use client";

import { useState } from "react";
import { Check, Loader2, Mail, RotateCcw } from "lucide-react";
import {
  subscribe,
  SubscribeError,
  topicDescriptions,
  topicLabels,
  type SubscriberTopic,
} from "@/lib/subscribers";

const ALL_TOPICS: SubscriberTopic[] = ["advisories", "tours", "events"];

type Result = {
  email: string;
  topics: SubscriberTopic[];
  outcome: "created" | "resubscribed" | "updated";
};

const outcomeCopy: Record<Result["outcome"], { title: string; body: string }> = {
  created: {
    title: "You're on the list",
    body: "We'll only write when there is something worth the trip — no monthly filler.",
  },
  resubscribed: {
    title: "Welcome back",
    body: "That address was unsubscribed earlier. It is active again with the topics below.",
  },
  updated: {
    title: "Topics updated",
    body: "You were already subscribed, so we changed your topics instead of adding a duplicate.",
  },
};

export default function SubscribeForm() {
  const [email, setEmail] = useState("");
  const [topics, setTopics] = useState<SubscriberTopic[]>(["advisories"]);
  const [errors, setErrors] = useState<{ email?: string; topics?: string }>({});
  const [result, setResult] = useState<Result | null>(null);
  const [pending, setPending] = useState(false);

  function toggle(topic: SubscriberTopic) {
    setTopics((current) =>
      current.includes(topic)
        ? current.filter((entry) => entry !== topic)
        : [...current, topic],
    );
    setErrors((current) => ({ ...current, topics: undefined }));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    setPending(true);
    try {
      const { subscriber, outcome } = await subscribe(email, topics);
      setResult({ email: subscriber.email, topics: subscriber.topics, outcome });
      setErrors({});
    } catch (error) {
      if (error instanceof SubscribeError) {
        setErrors({ [error.field]: error.message });
      } else {
        setErrors({ email: "Something went wrong. Try again." });
      }
    } finally {
      setPending(false);
    }
  }

  if (result) {
    const copy = outcomeCopy[result.outcome];

    return (
      <div className="rounded-2xl bg-white p-6 ring-1 ring-ink/8 sm:p-7">
        <span className="grid size-10 place-items-center rounded-full bg-moss-50 text-moss-700 ring-1 ring-moss-600/20">
          <Check className="size-5" strokeWidth={2.6} aria-hidden="true" />
        </span>

        <h2 className="mt-4 font-display text-[22px] leading-tight text-ink">
          {copy.title}
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft/80">
          {copy.body}
        </p>

        <dl className="mt-6 space-y-3 border-t border-ink/8 pt-5 text-[12.5px]">
          <div className="flex items-start justify-between gap-4">
            <dt className="text-sand-600">Address</dt>
            <dd className="truncate font-medium text-ink">{result.email}</dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-sand-600">Topics</dt>
            <dd className="text-right font-medium text-ink">
              {result.topics.map((topic) => topicLabels[topic]).join(", ")}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={() => {
            setResult(null);
            setEmail("");
          }}
          className="mt-6 inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-4 py-2 text-[12.5px] font-medium text-ink transition-colors hover:border-ink/30 hover:bg-sand-50"
        >
          <RotateCcw className="size-3.5" strokeWidth={2} aria-hidden="true" />
          Use another address
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="rounded-2xl bg-white p-6 ring-1 ring-ink/8 sm:p-7"
    >
      <div>
        <label
          htmlFor="subscriber-email"
          className="text-[10.5px] font-semibold tracking-[0.16em] text-sand-600 uppercase"
        >
          Email address
        </label>
        <div className="relative mt-2">
          <Mail
            className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-sand-500"
            strokeWidth={1.9}
            aria-hidden="true"
          />
          <input
            id="subscriber-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              setErrors((current) => ({ ...current, email: undefined }));
            }}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "subscriber-email-error" : undefined}
            className={`w-full rounded-xl border bg-sand-50/60 py-2.5 pr-3.5 pl-10 text-[13.5px] text-ink placeholder:text-sand-500 focus:bg-white focus:ring-2 focus:ring-lake-600/25 focus:outline-none ${
              errors.email ? "border-alert-500/60" : "border-ink/12"
            }`}
          />
        </div>
        {errors.email ? (
          <p
            id="subscriber-email-error"
            role="alert"
            className="mt-1.5 text-[12px] text-alert-700"
          >
            {errors.email}
          </p>
        ) : null}
      </div>

      <fieldset className="mt-6">
        <legend className="text-[10.5px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
          What should we send?
        </legend>

        <div className="mt-3 space-y-2">
          {ALL_TOPICS.map((topic) => {
            const checked = topics.includes(topic);

            return (
              <label
                key={topic}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                  checked
                    ? "border-lake-700/30 bg-lake-50/60"
                    : "border-ink/10 hover:border-ink/20 hover:bg-sand-50"
                }`}
              >
                <input
                  type="checkbox"
                  name="topics"
                  value={topic}
                  checked={checked}
                  onChange={() => toggle(topic)}
                  className="mt-0.5 size-4 shrink-0 accent-lake-800"
                />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-ink">
                    {topicLabels[topic]}
                  </span>
                  <span className="mt-0.5 block text-[12px] leading-relaxed text-ink-soft/70">
                    {topicDescriptions[topic]}
                  </span>
                </span>
              </label>
            );
          })}
        </div>

        {errors.topics ? (
          <p role="alert" className="mt-2 text-[12px] text-alert-700">
            {errors.topics}
          </p>
        ) : null}
      </fieldset>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-lake-900 px-5 py-3 text-[13.5px] font-semibold text-sand-50 transition-colors hover:bg-lake-800 focus-visible:ring-2 focus-visible:ring-lake-700/40 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
        {pending ? "Subscribing" : "Subscribe"}
      </button>

      <p className="mt-3 text-center text-[11.5px] leading-relaxed text-sand-600">
        One address per subscription. Unsubscribe from any message.
      </p>
    </form>
  );
}
