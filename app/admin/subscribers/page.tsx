"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Mail,
  Plus,
  Search,
  UserCheck,
  UserX,
} from "lucide-react";
import StatCard from "@/components/admin/stat-card";
import { downloadCsv } from "@/lib/csv";
import {
  setSubscriberStatus,
  subscribe,
  SubscribeError,
  topicLabels,
  useSubscribers,
  type SubscriberStatus,
  type SubscriberTopic,
} from "@/lib/subscribers";

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDay(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormat.format(parsed);
}

const ALL_TOPICS: SubscriberTopic[] = ["advisories", "tours", "events"];

export default function AdminSubscribersPage() {
  const subscribers = useSubscribers();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SubscriberStatus>("ALL");
  const [topicFilter, setTopicFilter] = useState<"ALL" | SubscriberTopic>("ALL");
  const [newEmail, setNewEmail] = useState("");
  const [newTopics, setNewTopics] = useState<SubscriberTopic[]>(["advisories", "tours"]);
  const [feedback, setFeedback] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const stats = useMemo(() => {
    let active = 0;
    let unsubscribed = 0;
    const byTopic: Record<SubscriberTopic, number> = {
      advisories: 0,
      tours: 0,
      events: 0,
    };
    for (const item of subscribers) {
      if (item.status === "ACTIVE") {
        active += 1;
        for (const t of item.topics) {
          byTopic[t] += 1;
        }
      } else {
        unsubscribed += 1;
      }
    }
    return { total: subscribers.length, active, unsubscribed, byTopic };
  }, [subscribers]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return [...subscribers]
      .sort((a, b) => b.subscribedAt.localeCompare(a.subscribedAt))
      .filter((entry) => {
        if (statusFilter !== "ALL" && entry.status !== statusFilter) return false;
        if (topicFilter !== "ALL" && !entry.topics.includes(topicFilter)) return false;
        if (needle && !entry.email.toLowerCase().includes(needle)) return false;
        return true;
      });
  }, [subscribers, query, statusFilter, topicFilter]);

  async function handleAddSubscriber(event: React.FormEvent) {
    event.preventDefault();
    setFeedback(null);
    try {
      const { subscriber, outcome } = await subscribe(newEmail, newTopics);
      setNewEmail("");
      setFeedback({
        tone: "ok",
        text:
          outcome === "created"
            ? `Added ${subscriber.email} to park mailing list.`
            : `Updated ${subscriber.email} (${outcome}).`,
      });
    } catch (error) {
      setFeedback({
        tone: "warn",
        text:
          error instanceof SubscribeError
            ? error.message
            : "Could not add subscriber.",
      });
    }
  }

  async function toggleStatus(id: string, current: SubscriberStatus, email: string) {
    setBusyId(id);
    setFeedback(null);
    const nextStatus: SubscriberStatus =
      current === "ACTIVE" ? "UNSUBSCRIBED" : "ACTIVE";
    try {
      await setSubscriberStatus(id, nextStatus);
      setFeedback({
        tone: "ok",
        text: `${email} marked ${nextStatus === "ACTIVE" ? "active" : "unsubscribed"}.`,
      });
    } finally {
      setBusyId(null);
    }
  }

  function handleExportCsv() {
    downloadCsv(
      `naujan-subscribers-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Email", "Status", "Topics", "Subscribed At"],
      visible.map((entry) => [
        entry.email,
        entry.status,
        entry.topics.map((t) => topicLabels[t]).join("; "),
        entry.subscribedAt,
      ]),
    );
  }

  return (
    <div className="space-y-6">
      {feedback && (
        <p
          role="status"
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] ring-1 ${
            feedback.tone === "warn"
              ? "bg-alert-50 text-alert-700 ring-alert-500/20"
              : "bg-moss-50 text-moss-700 ring-moss-600/20"
          }`}
        >
          <CheckCircle2 className="size-4 shrink-0" />
          {feedback.text}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active subscribers"
          value={stats.active}
          hint={`${stats.unsubscribed} unsubscribed`}
          tone="moss"
        />
        <StatCard
          label="Park advisories"
          value={stats.byTopic.advisories}
          hint="Active advisory alerts"
          tone="lake"
        />
        <StatCard
          label="Tour releases"
          value={stats.byTopic.tours}
          hint="Subscribed to package updates"
        />
        <StatCard
          label="Events & counts"
          value={stats.byTopic.events}
          hint="Waterbird census & volunteer alerts"
        />
      </div>

      {/* Add / Update Subscriber Manually */}
      <form
        onSubmit={handleAddSubscriber}
        className="rounded-2xl bg-white p-5 ring-1 ring-ink/8"
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex-1 min-w-[220px]">
            <label
              htmlFor="adminAddSubscriberEmail"
              className="block text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase"
            >
              Add or reactivate visitor email
            </label>
            <input
              id="adminAddSubscriberEmail"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="guest@example.com"
              className="mt-2 w-full rounded-xl border border-ink/12 bg-white px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-lake-600 focus:ring-3 focus:ring-lake-600/15"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {ALL_TOPICS.map((topic) => {
              const checked = newTopics.includes(topic);
              return (
                <button
                  key={topic}
                  type="button"
                  onClick={() =>
                    setNewTopics((current) =>
                      checked
                        ? current.filter((t) => t !== topic)
                        : [...current, topic],
                    )
                  }
                  aria-pressed={checked}
                  className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                    checked
                      ? "bg-lake-800 text-sand-50"
                      : "bg-sand-100 text-ink-soft hover:bg-sand-200"
                  }`}
                >
                  {topicLabels[topic]}
                </button>
              );
            })}
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2.5 text-[12px] font-semibold text-sand-50 transition-colors hover:bg-ink/85"
          >
            <Plus className="size-3.5" />
            Save subscriber
          </button>
        </div>
      </form>

      {/* Subscriber Directory */}
      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8">
        <div className="space-y-4 border-b border-ink/8 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-[19px] leading-tight text-ink">
                Newsletter &amp; advisory audience
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
                {visible.length} of {stats.total} shown
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-sand-500"
                  strokeWidth={2}
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search email address"
                  aria-label="Search subscribers"
                  className="w-56 rounded-full border border-ink/12 bg-white py-2 pr-3 pl-9 text-[12.5px] text-ink outline-none placeholder:text-sand-400 focus:border-lake-600 focus:ring-3 focus:ring-lake-600/15"
                />
              </div>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={visible.length === 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 py-2 text-[12px] font-semibold text-ink transition-colors hover:bg-sand-50 disabled:opacity-45"
              >
                <Download className="size-3.5 text-sand-600" />
                Export CSV
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(["ALL", "ACTIVE", "UNSUBSCRIBED"] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                aria-pressed={statusFilter === status}
                className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-lake-900 text-sand-50"
                    : "bg-sand-100 text-ink-soft hover:bg-sand-200"
                }`}
              >
                {status === "ALL"
                  ? `All (${stats.total})`
                  : status === "ACTIVE"
                    ? `Active (${stats.active})`
                    : `Unsubscribed (${stats.unsubscribed})`}
              </button>
            ))}

            <span className="mx-1 h-4 w-px bg-ink/10" aria-hidden="true" />

            <button
              type="button"
              onClick={() => setTopicFilter("ALL")}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                topicFilter === "ALL"
                  ? "bg-sand-800 text-sand-50"
                  : "bg-sand-100 text-ink-soft hover:bg-sand-200"
              }`}
            >
              All topics
            </button>
            {ALL_TOPICS.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => setTopicFilter(topic)}
                className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                  topicFilter === topic
                    ? "bg-sand-800 text-sand-50"
                    : "bg-sand-100 text-ink-soft hover:bg-sand-200"
                }`}
              >
                {topicLabels[topic]}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left">
            <thead>
              <tr className="border-b border-ink/8 text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                <th className="px-5 py-3">Subscriber</th>
                <th className="px-5 py-3">Topics</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Subscribed</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/6">
              {visible.map((entry) => {
                const isActive = entry.status === "ACTIVE";
                const busy = busyId === entry.id;
                return (
                  <tr key={entry.id} className="hover:bg-sand-50/70">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 place-items-center rounded-full bg-lake-50 text-lake-700">
                          <Mail className="size-3.5" />
                        </span>
                        <span className="text-[13.5px] font-medium text-ink">
                          {entry.email}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1.5">
                        {entry.topics.map((topic) => (
                          <span
                            key={topic}
                            className="rounded-full bg-sand-100 px-2.5 py-0.5 text-[10.5px] font-medium text-sand-800"
                          >
                            {topicLabels[topic]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase ring-1 ring-inset ${
                          isActive
                            ? "bg-moss-50 text-moss-700 ring-moss-600/20"
                            : "bg-sand-200/70 text-sand-700 ring-ink/10"
                        }`}
                      >
                        {isActive ? "Active" : "Unsubscribed"}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12px] text-ink-soft/75">
                      {formatDay(entry.subscribedAt)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void toggleStatus(entry.id, entry.status, entry.email)
                        }
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11.5px] font-semibold ring-1 ring-inset transition-colors ${
                          isActive
                            ? "bg-alert-50 text-alert-700 ring-alert-500/20 hover:bg-alert-100"
                            : "bg-moss-50 text-moss-700 ring-moss-600/20 hover:bg-moss-100"
                        }`}
                      >
                        {isActive ? (
                          <>
                            <UserX className="size-3.5" />
                            Unsubscribe
                          </>
                        ) : (
                          <>
                            <UserCheck className="size-3.5" />
                            Reactivate
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}

              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-[13px] text-ink-soft/70"
                  >
                    No subscribers match this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
