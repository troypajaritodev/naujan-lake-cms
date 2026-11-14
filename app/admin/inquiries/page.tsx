"use client";

import { useMemo, useState } from "react";
import { AlertCircle, BellRing, Check, Inbox } from "lucide-react";
import StatCard from "@/components/admin/stat-card";
import {
  setInquiryStatus,
  useInquiries,
  type Inquiry,
  type InquiryStatus,
} from "@/lib/inquiries";
import {
  INQUIRY_STATUS_META,
  INQUIRY_STATUS_ORDER,
} from "@/lib/inquiry-status";
import {
  bookingCountLabel,
  markInquiriesSeen,
  useInquiryAlerts,
} from "@/lib/inquiry-alerts";

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDay(iso: string) {
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormat.format(parsed);
}

function formatStamp(iso?: string) {
  if (!iso) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : dateFormat.format(parsed);
}

/** The line under the status chip: what happened, and when. */
function statusDetail(inquiry: Inquiry) {
  const at = formatStamp(inquiry.updatedAt);

  switch (inquiry.status) {
    case "CONFIRMED":
      return at ? `Accepted ${at}` : "Accepted by the park office";
    case "DECLINED":
      return at ? `Declined ${at}` : INQUIRY_STATUS_META.DECLINED.blurb;
    case "CANCELLED":
      if (inquiry.decidedBy === "visitor") {
        return at ? `Withdrawn by visitor ${at}` : "Withdrawn by the visitor";
      }
      return at ? `Cancelled by park ${at}` : "Cancelled by the park office";
    case "CONTACTED":
      return at ? `Contacted ${at}` : INQUIRY_STATUS_META.CONTACTED.blurb;
    default:
      return INQUIRY_STATUS_META.PENDING.blurb;
  }
}

type EmailOutcome = { delivered: boolean; reason?: string };

/** Best-effort: the local status write already succeeded before this is called. */
async function sendStatusEmail(
  inquiry: Inquiry,
  status: InquiryStatus,
  actor: "park" | "visitor",
): Promise<EmailOutcome | null> {
  try {
    const response = await fetch("/api/inquiries/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...inquiry, status, actor }),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { email?: EmailOutcome };
    return data.email ?? null;
  } catch {
    return null;
  }
}

function emailFeedback(
  status: InquiryStatus,
  email: string,
  outcome: EmailOutcome | null,
) {
  const noun =
    status === "CONFIRMED"
      ? "Booking confirmation"
      : status === "DECLINED"
        ? "Decline notice"
        : "Cancellation notice";

  if (!outcome) {
    return {
      tone: "warn" as const,
      text: `${INQUIRY_STATUS_META[status].label} saved, but the email could not be sent.`,
    };
  }

  if (outcome.delivered) {
    return { tone: "ok" as const, text: `${noun} emailed to ${email}.` };
  }

  if (outcome.reason === "demo") {
    return {
      tone: "ok" as const,
      text: `${noun} printed to the server console (demo mode).`,
    };
  }

  return {
    tone: "warn" as const,
    text: `${INQUIRY_STATUS_META[status].label} saved, but the email could not be sent.`,
  };
}

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

/** "3 hours ago" / "just now" — keeps the banner honest about freshness. */
function arrivedAt(iso: string) {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "";

  const elapsed = Date.now() - parsed;
  if (elapsed < 60_000) return "just now";

  for (const [unit, size] of RELATIVE_STEPS) {
    if (elapsed >= size) {
      return relativeFormat.format(-Math.floor(elapsed / size), unit);
    }
  }

  return "just now";
}

export default function AdminInquiriesPage() {
  const inquiries = useInquiries();
  const { unread, unreadIds, latestUnread } = useInquiryAlerts();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "warn";
    text: string;
  } | null>(null);

  async function changeStatus(inquiry: Inquiry, status: InquiryStatus) {
    if (inquiry.status === status) return;

    setPendingId(inquiry.id);
    setFeedback(null);
    try {
      const next = await setInquiryStatus(inquiry.id, status);
      const updated = next.find((entry) => entry.id === inquiry.id) ?? inquiry;

      // Accepting, declining or cancelling has an email half. The status is
      // already saved, so a failed send is reported but never rolled back.
      if (status === "CONFIRMED" || status === "DECLINED" || status === "CANCELLED") {
        const outcome = await sendStatusEmail(updated, status, "park");
        setFeedback(emailFeedback(status, inquiry.email, outcome));
      } else {
        setFeedback({
          tone: "ok",
          text: `${inquiry.reference} is now ${INQUIRY_STATUS_META[status].label.toLowerCase()}.`,
        });
      }
    } catch {
      setFeedback({
        tone: "warn",
        text: `Could not update ${inquiry.reference}. Try again.`,
      });
    } finally {
      setPendingId(null);
    }
  }

  const stats = useMemo(() => {
    const counts = Object.fromEntries(
      INQUIRY_STATUS_ORDER.map((status) => [status, 0]),
    ) as Record<InquiryStatus, number>;

    for (const inquiry of inquiries) counts[inquiry.status] += 1;

    return {
      counts,
      total: inquiries.length,
      guests: inquiries.reduce((sum, inquiry) => sum + inquiry.partySize, 0),
      confirmedGuests: inquiries
        .filter((inquiry) => inquiry.status === "CONFIRMED")
        .reduce((sum, inquiry) => sum + inquiry.partySize, 0),
    };
  }, [inquiries]);

  const byPackage = useMemo(() => {
    const groups = new Map<string, { title: string; count: number; guests: number }>();

    for (const inquiry of inquiries) {
      const entry = groups.get(inquiry.tourSlug) ?? {
        title: inquiry.tourTitle,
        count: 0,
        guests: 0,
      };
      entry.count += 1;
      entry.guests += inquiry.partySize;
      groups.set(inquiry.tourSlug, entry);
    }

    return [...groups.values()].sort((a, b) => b.count - a.count);
  }, [inquiries]);

  return (
    <div className="space-y-6">
      {unread > 0 && (
        <section
          aria-labelledby="new-bookings-heading"
          className="relative overflow-hidden rounded-2xl bg-alert-50 p-5 pl-6 ring-1 ring-alert-500/30"
        >
          <span
            className="absolute inset-y-0 left-0 w-1.5 bg-alert-500"
            aria-hidden="true"
          />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="relative mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-alert-500/12 text-alert-600 ring-1 ring-alert-500/25">
                <BellRing className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                <span
                  className="absolute -top-0.5 -right-0.5 flex size-2.5"
                  aria-hidden="true"
                >
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-alert-500/70" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-alert-500" />
                </span>
              </span>

              <div>
                <p className="text-[9.5px] font-semibold tracking-[0.18em] text-alert-700/80 uppercase">
                  New since your last visit
                </p>
                <h2
                  id="new-bookings-heading"
                  className="mt-1 font-display text-[20px] leading-tight text-ink"
                >
                  {bookingCountLabel(unread)} to review
                </h2>
                {latestUnread && (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft/85">
                    Latest from{" "}
                    <span className="font-semibold text-ink">
                      {latestUnread.fullName}
                    </span>{" "}
                    — {latestUnread.tourTitle}, {latestUnread.partySize}{" "}
                    {latestUnread.partySize === 1 ? "guest" : "guests"},{" "}
                    {arrivedAt(latestUnread.createdAt)}.
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => markInquiriesSeen()}
              className="inline-flex items-center gap-1.5 rounded-full bg-alert-500 px-3.5 py-2 text-[11.5px] font-semibold text-white transition-colors hover:bg-alert-600 focus-visible:ring-2 focus-visible:ring-alert-600/40 focus-visible:ring-offset-2 focus-visible:ring-offset-alert-50 focus-visible:outline-none"
            >
              <Check className="size-3.5" strokeWidth={2.6} aria-hidden="true" />
              Mark all as seen
            </button>
          </div>
        </section>
      )}

      {feedback && (
        <p
          role="status"
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-[12.5px] ring-1 ring-inset ${
            feedback.tone === "ok"
              ? "bg-moss-50 text-moss-800 ring-moss-600/20"
              : "bg-alert-50 text-alert-700 ring-alert-500/20"
          }`}
        >
          {feedback.tone === "ok" ? (
            <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} aria-hidden="true" />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          )}
          {feedback.text}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="All inquiries"
          value={stats.total}
          hint={`${stats.guests} guests requested in total`}
          tone="ink"
        />
        <StatCard
          label="Pending"
          value={stats.counts.PENDING}
          hint="Waiting on the park office"
          tone="reed"
        />
        <StatCard
          label="Confirmed"
          value={stats.counts.CONFIRMED}
          hint={`${stats.confirmedGuests} guests booked`}
          tone="moss"
        />
        <StatCard
          label="Declined"
          value={stats.counts.DECLINED}
          hint="Could not be accommodated"
          tone="alert"
        />
        <StatCard
          label="Cancelled"
          value={stats.counts.CANCELLED}
          hint="Withdrawn by visitors"
          tone="ink"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-ink/8 lg:col-span-5">
          <h2 className="font-display text-[19px] leading-tight text-ink">
            Inquiries by status
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
            Share of the {stats.total} request{stats.total === 1 ? "" : "s"} on
            file
          </p>

          <ul className="mt-5 space-y-4">
            {INQUIRY_STATUS_ORDER.map((status) => {
              const count = stats.counts[status];
              const percent = stats.total
                ? Math.round((count / stats.total) * 100)
                : 0;

              return (
                <li key={status}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[12.5px] font-medium text-ink">
                      {INQUIRY_STATUS_META[status].label}
                    </p>
                    <p className="font-mono text-[11.5px] text-ink-soft/70">
                      {count} · {percent}%
                    </p>
                  </div>
                  <div
                    className="mt-2 h-1.5 overflow-hidden rounded-full bg-sand-200"
                    role="presentation"
                  >
                    <div
                      className={`h-full rounded-full ${INQUIRY_STATUS_META[status].bar}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8 lg:col-span-7">
          <div className="border-b border-ink/8 px-5 py-4">
            <h2 className="font-display text-[19px] leading-tight text-ink">
              Demand by package
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              Which tours visitors ask for most
            </p>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-ink/8 text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  Package
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  Inquiries
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  Guests
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/6">
              {byPackage.map((row) => (
                <tr key={row.title}>
                  <td className="px-5 py-3 text-[13px] text-ink">{row.title}</td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-ink">
                    {row.count}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-ink-soft/75">
                    {row.guests}
                  </td>
                </tr>
              ))}

              {byPackage.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-5 py-10 text-center text-[13px] text-ink-soft/65">
                    No inquiries yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-[19px] leading-tight text-ink">
              Recent inquiries
              {unread > 0 && (
                <span className="rounded-full bg-alert-500 px-2 py-0.5 text-[9.5px] font-bold tracking-[0.1em] text-white uppercase">
                  {unread} new
                </span>
              )}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              Newest first · accepting or declining emails the guest
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-ink/8 text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Reference
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Guest
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Package
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Preferred date
                </th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">
                  Guests
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/6">
              {inquiries.map((inquiry) => {
                const isNew = unreadIds.has(inquiry.id);

                return (
                <tr
                  key={inquiry.id}
                  className={
                    isNew
                      ? "bg-alert-50/70 transition-colors hover:bg-alert-50"
                      : "transition-colors hover:bg-sand-50/70"
                  }
                >
                  <td className="px-5 py-3.5 font-mono text-[12px] text-ink-soft/80">
                    <span
                      className={
                        isNew
                          ? "border-l-2 border-alert-500 pl-2.5"
                          : undefined
                      }
                    >
                      {inquiry.reference}
                    </span>
                    {isNew && (
                      <span className="ml-2 inline-flex items-center rounded-full bg-alert-500 px-1.5 py-0.5 align-middle text-[8.5px] font-bold tracking-[0.1em] text-white uppercase">
                        New
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-[13px] font-medium text-ink">
                      {inquiry.fullName}
                    </p>
                    <p className="text-[11.5px] text-ink-soft/60">{inquiry.email}</p>
                  </td>
                  <td className="px-5 py-3.5 text-[12.5px] text-ink-soft/85">
                    {inquiry.tourTitle}
                  </td>
                  <td className="px-5 py-3.5 text-[12.5px] text-ink-soft/75">
                    {formatDay(inquiry.preferredDate)}
                  </td>
                  <td className="px-5 py-3.5 text-right font-mono text-[12.5px] text-ink">
                    {inquiry.partySize}
                  </td>
                  <td className="px-5 py-3.5">
                    <select
                      value={inquiry.status}
                      onChange={(event) => {
                        void changeStatus(
                          inquiry,
                          event.target.value as InquiryStatus,
                        );
                      }}
                      disabled={pendingId === inquiry.id}
                      aria-label={`Status for ${inquiry.reference}`}
                      className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.1em] uppercase ring-1 ring-inset outline-none disabled:cursor-wait disabled:opacity-60 ${INQUIRY_STATUS_META[inquiry.status].chip}`}
                    >
                      {INQUIRY_STATUS_ORDER.map((status) => (
                        <option key={status} value={status}>
                          {INQUIRY_STATUS_META[status].label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1.5 text-[10.5px] text-ink-soft/55">
                      {statusDetail(inquiry)}
                    </p>
                  </td>
                </tr>
                );
              })}

              {inquiries.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <Inbox
                      className="mx-auto size-6 text-sand-400"
                      strokeWidth={1.6}
                      aria-hidden="true"
                    />
                    <p className="mt-3 text-[13.5px] font-medium text-ink">
                      No inquiries yet
                    </p>
                    <p className="mt-1 text-[12.5px] text-ink-soft/65">
                      Requests sent from the public inquiry form appear here.
                    </p>
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
