import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import {
  conservationLabels,
  getRelatedSpecies,
  getSpecies,
  getSpeciesBySlug,
  getWildlifeGroups,
  seasonalityLabels,
  type ConservationStatus,
} from "@/lib/species";

type SpeciesPageProps = {
  params: Promise<{ slug: string }>;
};

/**
 * The page is a pure function of the slug, so there is no useful shell to
 * stream before `params` resolves — opt out of the instant-navigation check
 * instead of wrapping the body in a Suspense boundary.
 */
export const instant = false;

const statusStyles: Record<ConservationStatus, string> = {
  CR: "bg-alert-50 text-alert-700 ring-alert-600/25",
  EN: "bg-alert-50 text-alert-700 ring-alert-600/25",
  VU: "bg-reed-50 text-reed-800 ring-reed-600/25",
  NT: "bg-sand-100 text-sand-800 ring-sand-500/30",
  LC: "bg-moss-50 text-moss-700 ring-moss-600/25",
  DD: "bg-sand-100 text-sand-800 ring-sand-500/30",
};

/** One-line explanation of what the IUCN category means in this park. */
const statusNotes: Record<ConservationStatus, string> = {
  CR: "Critically endangered — faces an extremely high risk of extinction in the wild.",
  EN: "Endangered — faces a very high risk of extinction in the wild.",
  VU: "Vulnerable — faces a high risk of extinction in the wild.",
  NT: "Near threatened — close to qualifying for a threatened category.",
  LC: "Least concern — currently not at risk, but still monitored by the park office.",
  DD: "Data deficient — too little is known to assign a risk category.",
};

export async function generateStaticParams() {
  const entries = await getSpecies();
  return entries.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: SpeciesPageProps): Promise<Metadata> {
  const { slug } = await params;
  const entry = await getSpeciesBySlug(slug);

  if (!entry) return { title: "Species not found" };

  const title = entry.localName
    ? `${entry.commonName} (${entry.localName})`
    : entry.commonName;

  return {
    title,
    description: entry.description,
    alternates: { canonical: `/wildlife/${entry.slug}` },
    openGraph: {
      title: `${title} · Naujan Lake National Park`,
      description: entry.description,
    },
  };
}

export default async function SpeciesPage({ params }: SpeciesPageProps) {
  const { slug } = await params;
  const entry = await getSpeciesBySlug(slug);

  if (!entry) notFound();

  const [groups, related] = await Promise.all([
    getWildlifeGroups(),
    getRelatedSpecies(entry.slug, 4),
  ]);
  const group = groups.find((candidate) => candidate.slug === entry.group);

  const facts = [
    { label: "Group", value: group?.name ?? "Uncategorised" },
    { label: "Habitat", value: entry.habitat },
    { label: "Seasonality", value: seasonalityLabels[entry.seasonality] },
    {
      label: "Conservation status",
      value: `${conservationLabels[entry.status]} (${entry.status})`,
    },
  ];

  return (
    <>
      <section className="relative isolate overflow-hidden bg-lake-950 pt-32 pb-16 lg:pt-40 lg:pb-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(90%_80%_at_85%_0%,rgba(51,135,133,0.28),transparent_60%)]"
        />

        <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <Link
            href="/wildlife"
            className="inline-flex items-center gap-2 text-[12px] font-medium tracking-[0.16em] text-sand-300/80 uppercase transition-colors hover:text-sand-50"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Wildlife catalogue
          </Link>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-[10.5px] font-semibold tracking-[0.14em] text-sand-100 uppercase ring-1 ring-white/15 ring-inset">
              {group?.name ?? "Wildlife"}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-[10.5px] font-semibold tracking-[0.14em] uppercase ring-1 ring-inset ${statusStyles[entry.status]}`}
            >
              {entry.status} · {conservationLabels[entry.status]}
            </span>
          </div>

          <h1 className="mt-5 font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] font-light tracking-[-0.02em] text-sand-50">
            {entry.commonName}
          </h1>

          <p className="mt-3 text-[16px] text-sand-200/80 italic">
            {entry.scientificName}
          </p>

          {entry.localName ? (
            <p className="mt-2 text-[13px] text-sand-300/70">
              Local name · <span className="text-sand-100">{entry.localName}</span>
            </p>
          ) : null}
        </div>
      </section>

      <div className="bg-sand-50 py-16 lg:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:gap-14 lg:px-12">
          <div className="lg:col-span-7">
            <p className="text-[11px] font-medium tracking-[0.22em] text-sand-600 uppercase">
              Field record
            </p>
            <p className="mt-4 font-display text-[clamp(1.4rem,2.2vw,1.9rem)] leading-[1.35] font-light text-ink">
              {entry.description}
            </p>

            <div className="mt-8 rounded-2xl bg-white p-6 ring-1 ring-ink/8">
              <h2 className="flex items-center gap-2 font-display text-[19px] text-ink">
                <ShieldCheck
                  className="size-4.5 text-lake-700"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                What the status means
              </h2>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft/80">
                {statusNotes[entry.status]}
              </p>
              <Link
                href="/guidelines"
                className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-lake-800 transition-colors hover:text-lake-950"
              >
                Read the park guidelines
                <ArrowUpRight
                  className="size-3.5"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>

          <aside className="lg:col-span-5">
            <div className="rounded-2xl bg-white p-6 ring-1 ring-ink/8">
              <h2 className="text-[10.5px] font-semibold tracking-[0.18em] text-sand-600 uppercase">
                At a glance
              </h2>
              <dl className="mt-4 divide-y divide-ink/8">
                {facts.map((fact) => (
                  <div key={fact.label} className="py-3.5 first:pt-0 last:pb-0">
                    <dt className="text-[10.5px] font-semibold tracking-[0.12em] text-sand-600 uppercase">
                      {fact.label}
                    </dt>
                    <dd className="mt-1 text-[13.5px] leading-relaxed text-ink">
                      {fact.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-5 flex items-center gap-2 border-t border-ink/8 pt-4 text-[11.5px] text-sand-700">
                <MapPin
                  className="size-3.5 shrink-0 text-sand-500"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                Naujan Lake National Park · Ramsar Site No. 1008
              </div>
            </div>
          </aside>
        </div>
      </div>

      {related.length > 0 ? (
        <section className="border-t border-ink/8 bg-sand-50 pb-16 lg:pb-20">
          <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="font-display text-[24px] leading-tight text-ink">
                More in {group?.shortName ?? "this group"}
              </h2>
              <Link
                href="/wildlife"
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-lake-800 transition-colors hover:text-lake-950"
              >
                Full catalogue
                <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden="true" />
              </Link>
            </div>

            <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {related.map((candidate) => (
                <li key={candidate.slug}>
                  <Link
                    href={`/wildlife/${candidate.slug}`}
                    className="group flex h-full flex-col rounded-2xl bg-white p-5 ring-1 ring-ink/8 transition-shadow duration-300 hover:ring-ink/16"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[14.5px] leading-snug font-medium text-ink">
                        {candidate.commonName}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] uppercase ring-1 ring-inset ${statusStyles[candidate.status]}`}
                      >
                        {candidate.status}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-sand-600 italic">
                      {candidate.scientificName}
                    </p>
                    <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-ink-soft/80">
                      {candidate.description}
                    </p>
                    <span className="mt-auto pt-4 text-[11.5px] font-semibold text-lake-800">
                      View record →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}

      <section className="bg-lake-950 py-14">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <p className="max-w-xl text-[14.5px] leading-relaxed text-sand-200/75">
            Most records here are easiest to see from a boat with a guide who
            knows the season.{" "}
            <span className="text-sand-50">
              Book a trip or read the rules before you arrive.
            </span>
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/tours"
              className="inline-flex items-center gap-2 rounded-full bg-sand-50 px-5 py-3 text-[13px] font-semibold text-lake-950 transition-colors hover:bg-white"
            >
              Browse eco-tours
              <ArrowRight className="size-4" strokeWidth={2} aria-hidden="true" />
            </Link>
            <Link
              href="/guidelines"
              className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-[13px] font-medium text-sand-100 transition-colors hover:border-white/45 hover:bg-white/5"
            >
              Park guidelines
              <CalendarDays className="size-4" strokeWidth={1.9} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
