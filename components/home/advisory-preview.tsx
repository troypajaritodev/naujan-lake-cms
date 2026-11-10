import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import AdvisoryBadge from "@/components/advisory-badge";
import SectionHeading from "@/components/section-heading";
import { getLatestAdvisories } from "@/lib/advisories";

export default async function AdvisoryPreview() {
  const latestAdvisories = await getLatestAdvisories(3);

  return (
    <section className="bg-sand-50 py-20 lg:py-24">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <SectionHeading
          eyebrow="Park advisories"
          title="What the management office is saying"
          description="Weather, water levels and seasonal wildlife notices, published by the park office before they reach social media."
          action={{ label: "All advisories", href: "/advisories" }}
        />

        <ul className="mt-12 divide-y divide-ink/8 border-y border-ink/8">
          {latestAdvisories.map((advisory) => (
            <li key={advisory.slug}>
              <Link
                href={`/advisories/${advisory.slug}`}
                className="group grid gap-4 py-6 transition-colors duration-300 hover:bg-sand-100/60 sm:grid-cols-[9.5rem_1fr_auto] sm:items-center sm:gap-6 sm:px-3"
              >
                <div>
                  <AdvisoryBadge
                    severity={advisory.severity}
                    label={advisory.severityLabel}
                  />
                </div>

                <div className="min-w-0">
                  <h3 className="text-[15.5px] font-medium text-ink transition-colors group-hover:text-lake-800">
                    {advisory.title}
                  </h3>
                  <p className="mt-1.5 line-clamp-1 text-[13.5px] leading-relaxed text-ink-soft/75">
                    {advisory.excerpt}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <time
                    dateTime={advisory.dateISO}
                    className="font-mono text-[11.5px] tracking-wide text-sand-600"
                  >
                    {advisory.date}
                  </time>
                  <ArrowUpRight
                    className="size-4 shrink-0 text-sand-500 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-lake-700"
                    strokeWidth={1.9}
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
