import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Bird,
  Bug,
  CalendarDays,
  Fish,
  Leaf,
  MapPin,
  PawPrint,
} from "lucide-react";
import SectionHeading from "@/components/section-heading";
import {
  conservationLabels,
  getSpecies,
  getWildlifeGroups,
  groupSpecies,
  seasonalityLabels,
  speciesCountByStatus,
  type ConservationStatus,
} from "@/lib/species";

export const metadata: Metadata = {
  title: "Wildlife catalogue",
  description:
    "The birds, fish, reptiles, mammals and wetland plants recorded at Naujan Lake National Park — with scientific names, conservation status, seasonality and habitat.",
  alternates: { canonical: "/wildlife" },
};

const groupIcons: Record<string, typeof Bird> = {
  waterbirds: Bird,
  "freshwater-fish": Fish,
  "amphibians-reptiles": Bug,
  mammals: PawPrint,
  "wetland-flora": Leaf,
};

const statusStyles: Record<ConservationStatus, string> = {
  CR: "bg-alert-50 text-alert-700 ring-alert-600/25",
  EN: "bg-alert-50 text-alert-700 ring-alert-600/25",
  VU: "bg-reed-50 text-reed-800 ring-reed-600/25",
  NT: "bg-sand-100 text-sand-800 ring-sand-500/30",
  LC: "bg-moss-50 text-moss-700 ring-moss-600/25",
  DD: "bg-sand-100 text-sand-800 ring-sand-500/30",
};

export default async function WildlifePage() {
  const [groups, entries] = await Promise.all([
    getWildlifeGroups(),
    getSpecies(),
  ]);
  const grouped = groupSpecies(groups, entries);

  const threatened =
    speciesCountByStatus(entries, "EN") +
    speciesCountByStatus(entries, "VU") +
    speciesCountByStatus(entries, "CR");

  const facts = [
    { value: String(groups.length), label: "taxonomic groups" },
    { value: String(entries.length), label: "species on record" },
    { value: String(threatened), label: "globally threatened" },
    { value: "Oct–Mar", label: "peak birding season" },
  ];

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
            Wildlife catalogue
          </p>

          <div className="mt-5 grid gap-8 lg:grid-cols-12 lg:items-end">
            <h1 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] font-light tracking-[-0.02em] text-sand-50 lg:col-span-7">
              The lake is a habitat
              <br />
              <span className="text-reed-200 italic">before it is a postcard.</span>
            </h1>
            <p className="max-w-md text-[15px] leading-[1.75] text-sand-200/75 lg:col-span-5">
              Naujan Lake is a Ramsar wetland on the East Asian–Australasian
              flyway. What follows is what the park office has actually recorded
              — not everything that might pass through.
            </p>
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="bg-lake-950 px-5 py-4">
                <dt className="text-[10px] font-semibold tracking-[0.16em] text-sand-300/60 uppercase">
                  {fact.label}
                </dt>
                <dd className="mt-1.5 font-display text-[24px] leading-none text-sand-50">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="border-b border-ink/8 bg-sand-50 py-5">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-5 sm:px-8 lg:px-12">
          <span className="mr-1 text-[10.5px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
            Jump to
          </span>
          {grouped.map(({ group }) => {
            const Icon = groupIcons[group.slug] ?? Leaf;
            return (
              <a
                key={group.slug}
                href={`#${group.slug}`}
                className="group inline-flex items-center gap-1.5 rounded-full border border-ink/12 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-ink/25 hover:bg-white"
              >
                <Icon
                  className="size-3.5 text-sand-600 transition-colors group-hover:text-lake-700"
                  strokeWidth={1.9}
                  aria-hidden="true"
                />
                {group.shortName}
              </a>
            );
          })}
        </div>
      </section>

      <div className="bg-sand-50 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <SectionHeading
            eyebrow="Field records"
            title="Five groups, one water body"
            description="Conservation status follows the IUCN Red List categories used by the park's species table. Seasonality describes when the species is present on the lake, not where it lives the rest of the year."
          />

          <div className="mt-14 space-y-16">
            {grouped.map(({ group, species: entries }) => {
              const Icon = groupIcons[group.slug] ?? Leaf;

              return (
                <section
                  key={group.slug}
                  id={group.slug}
                  aria-labelledby={`${group.slug}-heading`}
                  className="scroll-mt-28"
                >
                  <div className="flex flex-col gap-3 border-b border-ink/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-lake-800 text-sand-50">
                        <Icon className="size-4.5" strokeWidth={1.8} aria-hidden="true" />
                      </span>
                      <div>
                        <h2
                          id={`${group.slug}-heading`}
                          className="font-display text-[24px] leading-tight text-ink"
                        >
                          {group.name}
                        </h2>
                        <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-soft/80">
                          {group.description}
                        </p>
                      </div>
                    </div>

                    <p className="shrink-0 font-mono text-[11.5px] text-sand-600">
                      {entries.length} species
                    </p>
                  </div>

                  <ul className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {entries.map((entry) => (
                      <li key={entry.slug}>
                        <article className="flex h-full flex-col rounded-2xl bg-white p-5 ring-1 ring-ink/8 transition-shadow duration-300 hover:ring-ink/16">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-[15.5px] leading-snug font-medium text-ink">
                                {entry.commonName}
                              </h3>
                              <p className="mt-0.5 text-[12.5px] leading-snug text-sand-600 italic">
                                {entry.scientificName}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.1em] uppercase ring-1 ring-inset ${statusStyles[entry.status]}`}
                              title={conservationLabels[entry.status]}
                            >
                              {entry.status}
                            </span>
                          </div>

                          {entry.localName ? (
                            <p className="mt-2 text-[11.5px] text-sand-600">
                              Local name · {entry.localName}
                            </p>
                          ) : null}

                          <p className="mt-3 text-[13px] leading-relaxed text-ink-soft/80">
                            {entry.description}
                          </p>

                          <div className="mt-auto space-y-1.5 border-t border-ink/8 pt-4 text-[11.5px] text-sand-700">
                            <p className="flex items-start gap-1.5">
                              <MapPin
                                className="mt-0.5 size-3.5 shrink-0 text-sand-500"
                                strokeWidth={1.9}
                                aria-hidden="true"
                              />
                              {entry.habitat}
                            </p>
                            <p className="flex items-start gap-1.5">
                              <CalendarDays
                                className="mt-0.5 size-3.5 shrink-0 text-sand-500"
                                strokeWidth={1.9}
                                aria-hidden="true"
                              />
                              {seasonalityLabels[entry.seasonality]}
                            </p>
                          </div>
                        </article>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </div>

      <section className="bg-lake-950 py-16 lg:py-20">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div className="max-w-xl">
            <p className="text-[11px] font-medium tracking-[0.22em] text-sand-300/70 uppercase">
              See them properly
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.7rem,3vw,2.4rem)] leading-tight font-light text-sand-50">
              A guide turns a stretch of water into a field list.
            </h2>
            <p className="mt-3 text-[14.5px] leading-relaxed text-sand-200/70">
              Accredited operators carry binoculars and know where the flocks
              settle at first light. Read the park rules before you board.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/tours"
              className="group inline-flex items-center gap-2 rounded-full bg-sand-50 px-5 py-3 text-[13px] font-semibold text-lake-950 transition-colors hover:bg-white"
            >
              Browse eco-tours
              <ArrowRight
                className="size-4 transition-transform group-hover:translate-x-0.5"
                strokeWidth={2}
              />
            </Link>
            <Link
              href="/guidelines"
              className="group inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-[13px] font-medium text-sand-100 transition-colors hover:border-white/45 hover:bg-white/5"
            >
              Park guidelines
              <ArrowUpRight
                className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                strokeWidth={1.9}
              />
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
