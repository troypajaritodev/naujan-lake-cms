import type { Metadata } from "next";
import {
  CameraOff,
  Fish,
  Footprints,
  LifeBuoy,
  Route,
  Trash2,
} from "lucide-react";
import SectionHeading from "@/components/section-heading";
import ZoningSection from "@/components/guidelines/zoning-section";
import { parkRules, type ParkRule } from "@/lib/guidelines";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Park guidelines",
  description:
    "The rules that protect Naujan Lake National Park: leave no trace, nesting season etiquette, fishing restrictions, life jacket requirements and marked-route navigation.",
  alternates: { canonical: "/guidelines" },
};

const icons: Record<ParkRule["icon"], typeof Trash2> = {
  litter: Trash2,
  camera: CameraOff,
  fish: Fish,
  lifejacket: LifeBuoy,
  route: Route,
  collect: Footprints,
};

export default function GuidelinesPage() {
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
            Park guidelines
          </p>

          <div className="mt-5 grid gap-8 lg:grid-cols-12 lg:items-end">
            <h1 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] font-light tracking-[-0.02em] text-sand-50 lg:col-span-7">
              Rules that keep the lake
              <br />
              <span className="text-reed-200 italic">a lake.</span>
            </h1>
            <p className="max-w-md text-[15px] leading-[1.75] text-sand-200/75 lg:col-span-5">
              Naujan Lake is a national park and a Ramsar wetland before it is a
              destination. These are the rules the park office enforces on the
              water — read them before you board.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-sand-50 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <SectionHeading
            eyebrow="On the water"
            title="Six rules, no exceptions"
            description="Applies to visitors, accredited operators and researchers alike. Violations can end a tour and forfeit the environmental fee."
          />

          <ul className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10 sm:grid-cols-2 lg:grid-cols-3">
            {parkRules.map((rule, index) => {
              const Icon = icons[rule.icon];
              return (
                <li
                  key={rule.title}
                  className="group relative bg-sand-50 p-6 transition-colors duration-300 hover:bg-white lg:p-7"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-10 place-items-center rounded-xl bg-lake-800 text-sand-50 transition-colors duration-300 group-hover:bg-lake-700">
                      <Icon className="size-5" strokeWidth={1.7} aria-hidden="true" />
                    </span>
                    <span className="font-mono text-[11px] text-sand-600">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <h3 className="mt-5 font-display text-[19px] leading-snug text-ink">
                    {rule.title}
                  </h3>
                  <p className="mt-2.5 text-[13.5px] leading-relaxed text-ink-soft/80">
                    {rule.body}
                  </p>
                  {rule.note ? (
                    <p className="mt-4 border-t border-ink/8 pt-3 text-[12px] leading-relaxed text-sand-600">
                      {rule.note}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="mt-8 flex items-start gap-2 text-[12.5px] leading-relaxed text-sand-700">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-reed-500" />
            Emergency? Call{" "}
            <a
              href={`tel:${site.emergency}`}
              className="font-semibold text-ink underline decoration-ink/20 underline-offset-4 hover:decoration-ink"
            >
              {site.emergency}
            </a>{" "}
            and notify the nearest accredited operator.
          </p>
        </div>
      </section>

      <ZoningSection />
    </>
  );
}
