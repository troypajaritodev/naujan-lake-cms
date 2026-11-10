import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, CalendarClock, Check } from "lucide-react";
import AdvisoryBadge from "@/components/advisory-badge";
import {
  formatAdvisoryDate,
  getAdvisory,
  getRelatedAdvisories,
  getSortedAdvisories,
} from "@/lib/advisories";

type AdvisoryPageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * The whole page is a function of the slug, so there is no useful shell to
 * stream before `params` resolves — opt out of the instant-navigation check
 * instead of wrapping the body in a Suspense boundary that would only ever
 * render a skeleton.
 */
export const instant = false;

export async function generateStaticParams() {
  const advisories = await getSortedAdvisories();
  return advisories.map((advisory) => ({ slug: advisory.slug }));
}

export async function generateMetadata({
  params,
}: AdvisoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const advisory = await getAdvisory(slug);

  if (!advisory) return { title: "Advisory not found" };

  return {
    title: advisory.title,
    description: advisory.excerpt,
    alternates: { canonical: `/advisories/${advisory.slug}` },
  };
}

export default async function AdvisoryDetailPage({ params }: AdvisoryPageProps) {
  const { slug } = await params;
  const advisory = await getAdvisory(slug);

  if (!advisory) notFound();

  const related = await getRelatedAdvisories(advisory.slug);

  return (
    <>
      <section className="relative isolate overflow-hidden bg-lake-950 pt-32 pb-14 lg:pt-36 lg:pb-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_85%_0%,rgba(51,135,133,0.24),transparent_60%)]"
        />

        <div className="relative mx-auto w-full max-w-3xl px-5 sm:px-8">
          <Link
            href="/advisories"
            className="group inline-flex items-center gap-2 text-[12px] font-medium tracking-[0.14em] text-sand-300/80 uppercase transition-colors hover:text-sand-100"
          >
            <ArrowLeft
              className="size-3.5 transition-transform group-hover:-translate-x-0.5"
              strokeWidth={2.2}
              aria-hidden="true"
            />
            All advisories
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <AdvisoryBadge
              severity={advisory.severity}
              label={advisory.severityLabel}
            />
            <span className="text-[10.5px] font-semibold tracking-[0.16em] text-sand-300/60 uppercase">
              {advisory.category}
            </span>
          </div>

          <h1 className="mt-5 font-display text-[clamp(1.9rem,4vw,2.9rem)] leading-[1.08] font-light tracking-[-0.02em] text-sand-50">
            {advisory.title}
          </h1>

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[12.5px] text-sand-300/70">
            <span>
              Published{" "}
              <time dateTime={advisory.publishedAt} className="font-mono">
                {formatAdvisoryDate(advisory.publishedAt)}
              </time>
            </span>
            {advisory.effectiveUntil ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock className="size-3.5" strokeWidth={1.9} aria-hidden="true" />
                Applies until{" "}
                <time dateTime={advisory.effectiveUntil} className="font-mono">
                  {formatAdvisoryDate(advisory.effectiveUntil)}
                </time>
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <article className="bg-sand-50 py-14 lg:py-16">
        <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
          <p className="border-l-2 border-reed-400 pl-5 text-[16px] leading-[1.7] font-medium text-ink">
            {advisory.excerpt}
          </p>

          <div className="mt-8 space-y-5">
            {advisory.body.map((paragraph) => (
              <p
                key={paragraph.slice(0, 40)}
                className="text-[14.5px] leading-[1.8] text-ink-soft/85"
              >
                {paragraph}
              </p>
            ))}
          </div>

          {advisory.actions && advisory.actions.length > 0 ? (
            <section className="mt-10 rounded-2xl bg-white p-6 ring-1 ring-ink/8">
              <h2 className="text-[10.5px] font-semibold tracking-[0.18em] text-sand-600 uppercase">
                What this means for you
              </h2>
              <ul className="mt-4 space-y-3">
                {advisory.actions.map((action) => (
                  <li key={action} className="flex items-start gap-2.5">
                    <span className="mt-0.5 grid size-4.5 shrink-0 place-items-center rounded-full bg-moss-50 text-moss-700">
                      <Check className="size-3" strokeWidth={3} aria-hidden="true" />
                    </span>
                    <span className="text-[13.5px] leading-relaxed text-ink-soft/85">
                      {action}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-ink/10 pt-8">
            <Link
              href="/tours"
              className="group inline-flex items-center gap-2 rounded-full bg-lake-900 px-5 py-2.5 text-[13px] font-semibold text-sand-50 transition-colors hover:bg-lake-800"
            >
              Book a guided tour
              <ArrowUpRight
                className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={1.9}
              />
            </Link>
            <Link
              href="/guidelines"
              className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-ink/30 hover:bg-white"
            >
              Park guidelines
            </Link>
          </div>
        </div>
      </article>

      {related.length > 0 ? (
        <section className="border-t border-ink/8 bg-sand-50 pb-16 lg:pb-20">
          <div className="mx-auto w-full max-w-3xl px-5 sm:px-8">
            <h2 className="mt-12 font-display text-[19px] leading-tight text-ink">
              Other notices
            </h2>

            <ul className="mt-5 divide-y divide-ink/8 border-y border-ink/8">
              {related.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`/advisories/${entry.slug}`}
                    className="group flex items-center justify-between gap-4 py-4 transition-colors hover:bg-white/60"
                  >
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium text-ink transition-colors group-hover:text-lake-800">
                        {entry.title}
                      </p>
                      <p className="mt-1 font-mono text-[11px] text-sand-600">
                        {formatAdvisoryDate(entry.publishedAt)}
                      </p>
                    </div>
                    <ArrowUpRight
                      className="size-4 shrink-0 text-sand-500 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </>
  );
}
