"use client";

/**
 * The admin landing page (issue 001).
 *
 * Two data sources meet here: notices and packages are resolved on the server
 * and arrive as props, while the inquiry queue and the account list live in
 * `localStorage` and are read through the same store the other screens use. The
 * queue is deliberately the loudest thing on the page — a booking nobody triages
 * is the only failure mode this panel really has.
 */

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Inbox,
  Megaphone,
  Route,
  Users,
} from "lucide-react";
import StatCard from "@/components/admin/stat-card";
import { listUsers, summariseUsers } from "@/lib/auth";
import { useInquiries } from "@/lib/inquiries";

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
function age(createdAt: string): string {
  const created = Date.parse(createdAt);
  if (!Number.isFinite(created)) return "—";

  const minutes = Math.max(0, Math.round((Date.now() - created) / 60_000));
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
  const [accounts] = useState(() => summariseUsers(listUsers()));

  const pending = inquiries
    .filter((inquiry) => inquiry.status === "PENDING")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const newest = pending[0];
  const oldest = pending[pending.length - 1];

  const modules = [
    {
      href: "/admin/users",
      label: "Users",
      hint: "Accounts, roles and access",
      value: accounts.total,
      unit: accounts.total === 1 ? "account" : "accounts",
      icon: Users,
    },
    {
      href: "/admin/inquiries",
      label: "Inquiries",
      hint: pending.length > 0 ? "Waiting on a decision" : "All triaged",
      value: pending.length,
      unit: pending.length === 1 ? "pending" : "pending",
      icon: Inbox,
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
          label="Pending inquiries"
          value={pending.length}
          hint={
            newest
              ? `Newest arrived ${age(newest.createdAt)}`
              : "Every request has been triaged"
          }
          tone="alert"
        />
        <StatCard
          label="Published notices"
          value={notices.published}
          hint={
            notices.expiring > 0
              ? `${notices.expiring} ${notices.expiring === 1 ? "expires" : "expire"} within 30 days`
              : `${notices.archived} archived`
          }
          tone="lake"
        />
        <StatCard
          label="Packages on sale"
          value={packages.onSale}
          hint={
            packages.total === packages.onSale
              ? "Every departure is bookable"
              : `${packages.total - packages.onSale} off sale`
          }
          tone="moss"
        />
        <StatCard
          label="Accounts"
          value={accounts.total}
          hint={`${accounts.staff} staff · ${accounts.customers} customers`}
          tone="ink"
        />
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
                Needs attention
                {pending.length > 0 ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-alert-50 px-2 py-0.5 text-[10px] font-semibold tracking-[0.1em] text-alert-700 uppercase ring-1 ring-alert-500/25 ring-inset tabular-nums">
                    <span className="size-1.5 rounded-full bg-alert-500" />
                    {pending.length}
                  </span>
                ) : null}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
                {oldest
                  ? `Oldest request arrived ${age(oldest.createdAt)} · ${today}`
                  : today}
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
              {pending.slice(0, 4).map((inquiry) => (
                <li
                  key={inquiry.id}
                  className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3.5 transition-colors hover:bg-sand-50/70"
                >
                  <span
                    className="mt-1 size-1.5 shrink-0 rounded-full bg-alert-500"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] font-medium text-ink">
                      {inquiry.fullName}
                      <span className="font-mono text-[10.5px] font-normal text-ink-soft/45">
                        {inquiry.reference}
                      </span>
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-soft/60">
                      {inquiry.tourTitle} · {inquiry.partySize}{" "}
                      {inquiry.partySize === 1 ? "guest" : "guests"} · prefers{" "}
                      {formatDay(inquiry.preferredDate)}
                    </p>
                  </div>
                  <span className="shrink-0 text-[11px] text-ink-soft/45 tabular-nums">
                    {age(inquiry.createdAt)}
                  </span>
                </li>
              ))}
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
                Every tour request has been triaged. New bookings appear here and
                in the header badge as they arrive.
              </p>
            </div>
          )}

          {pending.length > 4 ? (
            <p className="border-t border-ink/6 px-5 py-3 text-[11.5px] text-ink-soft/50">
              and {pending.length - 4} more in the queue
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
                    <module.icon className="size-4" strokeWidth={1.9} aria-hidden="true" />
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
