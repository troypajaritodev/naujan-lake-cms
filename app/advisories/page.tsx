import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, CalendarClock } from "lucide-react";
import AdvisoryBadge from "@/components/advisory-badge";
import SectionHeading from "@/components/section-heading";
import {
  formatAdvisoryDate,
  getSortedAdvisories,
  type AdvisorySeverity,
} from "@/lib/advisories";

export const metadata: Metadata = {
  title: "Park advisories",
  description:
    "Weather, water level, access and wildlife notices from the Naujan Lake National Park management office — published here before they reach social media.",
  alternates: { canonical: "/advisories" },
};

const severityOrder: AdvisorySeverity[] = ["CRITICAL", "WARNING", "INFO"];

export default async function AdvisoriesPage() {
  const advisories = await getSortedAdvisories();

  const severityCounts = severityOrder.map((severity) => ({
    severity,
    count: advisories.filter((advisory) => advisory.severity === severity)
      .length,
  }));

  return (
    <>
      <section className="relative isolate overflow-hidden bg-lake-950 pt-32 pb-16 lg:pt-40 lg:pb-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_85%_0%,rgba(51,135,133,0.28),transparent_60%)]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-[-6rem] size-[320px] rounded-full border border-white/6"
        />

        <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-sand-300/80 uppercase">
            <span aria-hidden="true" className="h-px w-7 bg-sand-300/50" />
            Park advisories
          </p>

          <div className="mt-5 grid gap-8 lg:grid-cols-12 lg:items-end">
            <h1 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] font-light tracking-[-0.02em] text-sand-50 lg:col-span-7">
              Read this before
              <br />
              <span className="text-reed-200 italic">you board.</span>
            </h1>
            <p className="max-w-md text-[15px] leading-[1.75] text-sand-200/75 lg:col-span-5">
              Water levels, nesting closures and works on the trail, posted by
              the management office. Notices stay listed until they expire —
              check the date on anything older than a month.
            </p>
          </div>

          <ul className="mt-12 flex flex-wrap gap-3">
            {severityCounts.map(({ severity, count }) => (
              <li
                key={severity}
                className="rounded-xl border border-white/12 bg-white/5 px-4 py-2.5"
              >
                <p className="font-display text-[18px] leading-none text-sand-50">
                  {count}
                </p>
                <p className="mt-1 text-[10px] font-semibold tracking-[0.16em] text-sand-300/60 uppercase">
                  {severity === "CRITICAL"
                    ? "critical"
                    : severity === "WARNING"
                      ? "warnings"
                      : "information"}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-sand-50 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <SectionHeading
            eyebrow="Notice board"
            title="Current notices"
            description="Newest first. Each notice lists the date it was published and, where the office has set one, the date it stops applying."
            action={{ label: "Park guidelines", href: "/guidelines" }}
          />

          <ul className="mt-12 grid gap-4 lg:grid-cols-2">
            {advisories.map((advisory) => (
              <li key={advisory.slug}>
                <Link
                  href={`/advisories/${advisory.slug}`}
                  className="group flex h-full flex-col rounded-2xl bg-white p-6 ring-1 ring-ink/8 transition-shadow duration-300 hover:ring-ink/16"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <AdvisoryBadge
                      severity={advisory.severity}
                      label={advisory.severityLabel}
                    />
                    <time
                      dateTime={advisory.publishedAt}
                      className="font-mono text-[11.5px] tracking-wide text-sand-600"
                    >
                      {formatAdvisoryDate(advisory.publishedAt)}
                    </time>
                  </div>

                  <h2 className="mt-4 font-display text-[21px] leading-snug text-ink transition-colors group-hover:text-lake-800">
                    {advisory.title}
                  </h2>
                  <p className="mt-2.5 line-clamp-3 text-[13.5px] leading-relaxed text-ink-soft/80">
                    {advisory.excerpt}
                  </p>

                  <div className="mt-auto flex items-center justify-between gap-4 border-t border-ink/8 pt-4 text-[11.5px]">
                    <span className="font-semibold tracking-[0.12em] text-sand-600 uppercase">
                      {advisory.category}
                    </span>

                    <span className="flex items-center gap-3 text-sand-600">
                      {advisory.effectiveUntil ? (
                        <span className="inline-flex items-center gap-1.5">
                          <CalendarClock
                            className="size-3.5"
                            strokeWidth={1.9}
                            aria-hidden="true"
                          />
                          until {formatAdvisoryDate(advisory.effectiveUntil)}
                        </span>
                      ) : null}
                      <ArrowUpRight
                        className="size-4 shrink-0 text-sand-500 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-lake-700"
                        strokeWidth={1.9}
                        aria-hidden="true"
                      />
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <p className="mt-10 text-[12.5px] leading-relaxed text-sand-700">
            Advisories are published by the park management office. For
            anything urgent on the water, call the park office or dial{" "}
            <span className="font-semibold text-ink">911</span>.
          </p>
        </div>
      </section>
    </>
  );
}
