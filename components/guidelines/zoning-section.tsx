import { Check, X } from "lucide-react";
import SectionHeading from "@/components/section-heading";
import { lakeZones, type ZoneTone } from "@/lib/guidelines";

const tones: Record<
  ZoneTone,
  { bar: string; accent: string; badge: string; dot: string }
> = {
  core: {
    bar: "bg-lake-800",
    accent: "bg-lake-800",
    badge: "bg-lake-50 text-lake-800 ring-lake-700/20",
    dot: "bg-lake-800",
  },
  use: {
    bar: "bg-lake-400",
    accent: "bg-lake-400",
    badge: "bg-lake-50 text-lake-700 ring-lake-500/25",
    dot: "bg-lake-400",
  },
  buffer: {
    bar: "bg-sand-400",
    accent: "bg-sand-400",
    badge: "bg-sand-100 text-sand-800 ring-sand-500/25",
    dot: "bg-sand-400",
  },
};

export default function ZoningSection() {
  return (
    <section className="border-t border-ink/8 bg-sand-100/60 py-16 lg:py-20">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <SectionHeading
          eyebrow="Lake zoning"
          title="Three zones, one lake"
          description="The park is not a single permission. What you may do depends on which zone you are in — and the boundaries are enforced on the water."
        />

        <div className="mt-10">
          <div className="flex h-2.5 overflow-hidden rounded-full">
            {lakeZones.map((zone) => (
              <div
                key={zone.id}
                className={`${tones[zone.tone].bar} h-full`}
                style={{ width: zone.share }}
              />
            ))}
          </div>
          <div className="mt-3 flex text-[10px] font-medium tracking-[0.14em] text-sand-600 uppercase">
            {lakeZones.map((zone) => (
              <div
                key={zone.id}
                className="flex items-center gap-2 pr-4"
                style={{ width: zone.share }}
              >
                <span
                  className={`size-1.5 shrink-0 rounded-full ${tones[zone.tone].dot}`}
                />
                <span className="truncate">{zone.name.replace(" zone", "")}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {lakeZones.map((zone, index) => (
            <article
              key={zone.id}
              className="flex flex-col overflow-hidden rounded-2xl bg-sand-50 ring-1 ring-ink/10"
            >
              <div className={`h-1 w-full ${tones[zone.tone].accent}`} />
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.14em] uppercase ring-1 ring-inset ${tones[zone.tone].badge}`}
                  >
                    {zone.access}
                  </span>
                  <span className="font-mono text-[11px] text-sand-600">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>

                <h3 className="mt-4 font-display text-[20px] leading-snug text-ink">
                  {zone.name}
                </h3>
                <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft/80">
                  {zone.summary}
                </p>

                <div className="mt-5 space-y-1">
                  {zone.allowed.map((item) => (
                    <p
                      key={item}
                      className="flex items-start gap-2 text-[12.5px] leading-relaxed text-ink-soft/90"
                    >
                      <Check
                        className="mt-1 size-3.5 shrink-0 text-moss-600"
                        strokeWidth={2.4}
                        aria-hidden="true"
                      />
                      {item}
                    </p>
                  ))}
                </div>

                <div className="mt-4 space-y-1 border-t border-ink/8 pt-4">
                  {zone.restricted.map((item) => (
                    <p
                      key={item}
                      className="flex items-start gap-2 text-[12.5px] leading-relaxed text-sand-700"
                    >
                      <X
                        className="mt-1 size-3.5 shrink-0 text-alert-600"
                        strokeWidth={2.4}
                        aria-hidden="true"
                      />
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
