"use client";

import { useMemo, useState } from "react";
import { Inbox } from "lucide-react";
import StatCard from "@/components/admin/stat-card";
import {
  getAllInquiries,
  setInquiryStatus,
  type Inquiry,
  type InquiryStatus,
} from "@/lib/inquiries";

const STATUSES: InquiryStatus[] = ["PENDING", "CONFIRMED", "DECLINED"];

const statusMeta: Record<
  InquiryStatus,
  { label: string; bar: string; chip: string }
> = {
  PENDING: {
    label: "Pending",
    bar: "bg-reed-400",
    chip: "bg-reed-50 text-reed-800 ring-reed-600/25",
  },
  CONFIRMED: {
    label: "Confirmed",
    bar: "bg-moss-500",
    chip: "bg-moss-50 text-moss-700 ring-moss-600/25",
  },
  DECLINED: {
    label: "Declined",
    bar: "bg-alert-500",
    chip: "bg-alert-50 text-alert-700 ring-alert-500/25",
  },
};

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatDay(iso: string) {
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormat.format(parsed);
}

export default function AdminInquiriesPage() {
  const [inquiries, setInquiries] = useState<Inquiry[]>(() => getAllInquiries());

  const stats = useMemo(() => {
    const counts: Record<InquiryStatus, number> = {
      PENDING: 0,
      CONFIRMED: 0,
      DECLINED: 0,
    };

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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
            {STATUSES.map((status) => {
              const count = stats.counts[status];
              const percent = stats.total
                ? Math.round((count / stats.total) * 100)
                : 0;

              return (
                <li key={status}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[12.5px] font-medium text-ink">
                      {statusMeta[status].label}
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
                      className={`h-full rounded-full ${statusMeta[status].bar}`}
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
            <h2 className="font-display text-[19px] leading-tight text-ink">
              Recent inquiries
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              Newest first · change a status to update the report
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
              {inquiries.map((inquiry) => (
                <tr key={inquiry.id} className="transition-colors hover:bg-sand-50/70">
                  <td className="px-5 py-3.5 font-mono text-[12px] text-ink-soft/80">
                    {inquiry.reference}
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
                      onChange={(event) =>
                        setInquiries(
                          setInquiryStatus(
                            inquiry.id,
                            event.target.value as InquiryStatus,
                          ),
                        )
                      }
                      aria-label={`Status for ${inquiry.reference}`}
                      className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.1em] uppercase ring-1 ring-inset outline-none ${statusMeta[inquiry.status].chip}`}
                    >
                      {STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {statusMeta[status].label}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}

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
