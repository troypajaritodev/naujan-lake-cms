"use client";

/**
 * The admin landing page (issue 001).
 *
 * Two data sources meet here: notices and packages are resolved on the server
 * and arrive as props, while the inquiry queue and the account list live in
 * `localStorage` and are read through the same store the other screens use.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Inbox,
  Loader2,
  Mail,
  Megaphone,
  Route,
  Users,
} from "lucide-react";
import StatCard from "@/components/admin/stat-card";
import { summariseUsers, useUsers } from "@/lib/auth";
import { acceptInquiry, useInquiries, type Inquiry } from "@/lib/inquiries";
import { useMinuteNow } from "@/lib/now";
import { useSubscribers } from "@/lib/subscribers";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-11-13" → "13 Nov 2026", stable across server and browser. */
function formatDay(iso: string): string {
  const [year, month, day] = iso.split("-");
  const monthName = MONTHS[Number(month) - 1];
  return year && monthName && day ? `${day} ${monthName} ${year}` : iso;
}

/** How long a request has been sitting in the queue. */
function age(createdAt: string, now: number): string {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return "—";

  const minutes = Math.max(0, Math.round((now - created) / 60_000));
  if (minutes < 60) return minutes <= 1 ? "just now" : `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? "1 hour ago" : `${hours} hours ago`;

  const days = Math.round(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;

  return formatDay(createdAt.slice(0, 10));
}

type OverviewProps = {
  today: string;
  notices: {
    published: number;
    archived: number;
    critical: number;
    expiring: number;
    pinnedTitle: string | null;
  };
  packages: { total: number; onSale: number; averageRate: number };
};

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export default function AdminOverview({
  today,
  notices,
  packages,
}: OverviewProps) {
  const inquiries = useInquiries();
  const accounts = summariseUsers(useUsers());
  const subscribers = useSubscribers();
  const activeSubscribers = subscribers.filter(
    (entry) => entry.status === "ACTIVE",
  ).length;
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const now = useMinuteNow();

  const ageLabel = (iso: string) => {
    const day = iso.slice(0, 10);
    return now === null ? formatDay(day) : age(iso, now);
  };

  const pending = inquiries
    .filter((inquiry) => inquiry.status === "PENDING")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const onProcessCount = inquiries.filter(
    (inquiry) => inquiry.status === "ON_PROCESS",
  ).length;
  const verifiedDeposits = inquiries
    .filter((inquiry) => inquiry.paymentStatus === "VERIFIED")
    .reduce((sum, inquiry) => sum + (inquiry.firstPaymentAmount ?? 0), 0);

  const newest = pending[0];
  const oldest = pending[pending.length - 1];

  async function quickAccept(inquiry: Inquiry) {
    setAcceptingId(inquiry.id);
    try {
      const next = await acceptInquiry(inquiry.id, { verifyPayment: true });
      const updated = next.find((item) => item.id === inquiry.id) ?? inquiry;
      void fetch("/api/inquiries/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...updated,
          status: "ON_PROCESS",
          actor: "park",
        }),
        keepalive: true,
      }).catch(() => {});
    } finally {
      setAcceptingId(null);
    }
  }

  const modules = [
    {
      href: "/admin/users",
      label: "Users",
      hint: `${accounts.active} active · ${accounts.suspended} suspended`,
      value: accounts.total,
      unit: accounts.total === 1 ? "account" : "accounts",
      icon: Users,
    },
    {
      href: "/admin/inquiries",
      label: "Bookings & Payments",
      hint: `${pending.length} pending · ${onProcessCount} on process`,
      value: pending.length + onProcessCount,
      unit: "active",
      icon: Inbox,
    },
    {
      href: "/admin/subscribers",
      label: "Subscribers",
      hint: `${subscribers.length} total in mailing list`,
      value: activeSubscribers,
      unit: "active",
      icon: Mail,
    },
    {
      href: "/admin/advisories",
      label: "Advisories",
      hint: notices.pinnedTitle
        ? "One notice pinned to the banner"
        : "Nothing pinned to the banner",
      value: notices.published,
      unit: "live",
      icon: Megaphone,
    },
    {
      href: "/admin/tours",
      label: "Packages",
      hint: `${peso.format(packages.averageRate)} average rate`,
      value: packages.onSale,
      unit: "on sale",
      icon: Route,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pending bookings"
          value={pending.length}
          hint={
            newest
              ? `Newest arrived ${ageLabel(newest.createdAt)}`
              : "Every request has been triaged"
          }
          tone="alert"
        />
        <StatCard
          label="On Process"
          value={onProcessCount}
          hint="Accepted & preparing boat/guide"
          tone="lake"
        />
        <StatCard
          label="Verified deposits"
          value={peso.format(verifiedDeposits)}
          hint={`${packages.onSale} packages on sale`}
          tone="moss"
        />
        <StatCard
          label="Accounts"
          value={accounts.total}
          hint={`${accounts.staff} staff · ${accounts.customers} customers`}
          tone="ink"
        />
      </div>

      {/* Live Operations Pipeline Summary Strip */}
      <div className="surface-card rounded-2xl p-5 ring-1 ring-ink/8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              Booking Pipeline Health
            </p>
            <p className="mt-0.5 text-[13px] text-ink-soft/80">
              End-to-end traveler flow across Pending, On Process, and Confirmed trips
            </p>
          </div>
          <Link
            href="/admin/inquiries"
            className="inline-flex items-center gap-1.5 rounded-full bg-lake-50 px-3.5 py-1.5 text-[12px] font-semibold text-lake-800 ring-1 ring-lake-600/20 hover:bg-lake-100"
          >
            Manage all bookings
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          {(
            [
              {
                label: "Pending review",
                count: pending.length,
                dot: "bg-reed-400",
                tone: "bg-reed-50/70 ring-reed-600/20",
              },
              {
                label: "Accepted · On Process",
                count: onProcessCount,
                dot: "bg-lake-600",
                tone: "bg-lake-50/70 ring-lake-600/20",
              },
              {
                label: "Confirmed ready",
                count: inquiries.filter((i) => i.status === "CONFIRMED").length,
                dot: "bg-moss-600",
                tone: "bg-moss-50/70 ring-moss-600/20",
              },
              {
                label: "Completed trips",
                count: inquiries.filter((i) => i.status === "COMPLETED").length,
                dot: "bg-moss-800",
                tone: "bg-sand-100/80 ring-ink/10",
              },
            ] as const
          ).map((stage) => (
            <div
              key={stage.label}
              className={`rounded-xl px-4 py-3 ring-1 ${stage.tone}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-[11.5px] font-semibold text-ink">
                  <span className={`size-2 rounded-full ${stage.dot}`} />
                  {stage.label}
                </span>
                <span className="font-display text-[22px] font-light text-ink tabular-nums">
                  {stage.count}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[1.55fr_1fr]">
        <section
          aria-labelledby="attention-heading"
          className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/8 px-5 py-4">
            <div>
              <h2
                id="attention-heading"
                className="flex items-center gap-2 font-display text-[19px] leading-tight text-ink"
              >
                Needs acceptance
                {pending.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-alert-50 px-2 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-alert-700 uppercase ring-1 ring-alert-500/25 ring-inset tabular-nums">
                    <span className="size-1.5 rounded-full bg-alert-500" />
                    {pending.length}
                  </span>
                ) : null}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
                {oldest
                  ? `Oldest request arrived ${ageLabel(oldest.createdAt)} · ${today}`
                  : `${onProcessCount} currently on process · ${today}`}
              </p>
            </div>
            <Link
              href="/admin/inquiries"
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium text-ink-soft/70 transition hover:bg-sand-100 hover:text-ink"
            >
              Open the queue
              <ArrowRight className="size-3.5" strokeWidth={2.2} />
            </Link>
          </div>

          {pending.length > 0 ? (
            <ul className="divide-y divide-ink/6">
              {pending.slice(0, 5).map((inquiry) => {
                const busy = acceptingId === inquiry.id;
                return (
                  <li
                    key={inquiry.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-sand-50/70"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full bg-alert-500"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-medium text-ink">
                        {inquiry.fullName}
                        <span className="font-mono text-[10.5px] font-normal text-ink-soft/50">
                          {inquiry.reference}
                        </span>
                        {(inquiry.firstPaymentAmount ?? 0) > 0 && (
                          <span className="rounded-full bg-reed-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-reed-800 ring-1 ring-reed-600/20">
                            {peso.format(inquiry.firstPaymentAmount ?? 0)} first
                            payment
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-[12px] leading-relaxed text-ink-soft/65">
                        {inquiry.tourTitle} · {inquiry.partySize}{" "}
                        {inquiry.partySize === 1 ? "guest" : "guests"} ·{" "}
                        {formatDay(inquiry.preferredDate)} ·{" "}
                        <span className="text-ink-soft/45">
                          {ageLabel(inquiry.createdAt)}
                        </span>
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void quickAccept(inquiry)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-lake-800 px-3 py-1.5 text-[11px] font-semibold text-sand-50 transition-colors hover:bg-lake-700 disabled:opacity-60"
                    >
                      {busy && <Loader2 className="size-3 animate-spin" />}
                      Accept → On Process
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center gap-2 px-5 py-12 text-center">
              <CheckCircle2
                className="size-6 text-moss-500"
                strokeWidth={1.7}
                aria-hidden="true"
              />
              <p className="text-[13px] font-medium text-ink">
                Nothing waiting on you
              </p>
              <p className="max-w-[34ch] text-[12px] leading-relaxed text-ink-soft/60">
                Every pending booking has been reviewed. New bookings with first
                payments appear here as they arrive.
              </p>
            </div>
          )}

          {pending.length > 5 ? (
            <p className="border-t border-ink/6 px-5 py-3 text-[11.5px] text-ink-soft/50">
              and {pending.length - 5} more in the queue
            </p>
          ) : null}
        </section>

        <section
          aria-labelledby="modules-heading"
          className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8"
        >
          <div className="border-b border-ink/8 px-5 py-4">
            <h2
              id="modules-heading"
              className="font-display text-[19px] leading-tight text-ink"
            >
              Jump to
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              Everything this panel can change
            </p>
          </div>

          <ul className="divide-y divide-ink/6">
            {modules.map((module) => (
              <li key={module.href}>
                <Link
                  href={module.href}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-sand-50/70"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-ink-soft/70 transition-colors group-hover:bg-white group-hover:text-ink">
                    <module.icon
                      className="size-4"
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-ink">
                      {module.label}
                    </span>
                    <span className="block truncate text-[11.5px] text-ink-soft/55">
                      {module.hint}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] font-semibold text-ink tabular-nums">
                      {module.value}
                    </span>
                    <span className="block text-[10px] tracking-[0.08em] text-ink-soft/45 uppercase">
                      {module.unit}
                    </span>
                  </span>
                  <ArrowRight
                    className="size-3.5 shrink-0 text-ink-soft/30 transition group-hover:translate-x-0.5 group-hover:text-ink-soft/60"
                    strokeWidth={2.2}
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>

          <div className="flex items-start gap-2 border-t border-ink/6 bg-sand-50/60 px-5 py-3.5">
            <CalendarClock
              className="mt-0.5 size-3.5 shrink-0 text-ink-soft/40"
              strokeWidth={2}
              aria-hidden="true"
            />
            <p className="text-[11.5px] leading-relaxed text-ink-soft/55">
              {notices.critical > 0
                ? `${notices.critical} critical ${notices.critical === 1 ? "notice is" : "notices are"} live right now.`
                : "No critical notices are live."}{" "}
              {notices.pinnedTitle
                ? `The banner is showing “${notices.pinnedTitle}”.`
                : "The banner falls back to the newest critical notice."}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
