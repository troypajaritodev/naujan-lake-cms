import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, MapPin, Users } from "lucide-react";
import { difficultyLabel, getTours, type TourDifficulty } from "@/lib/tours";

export const metadata: Metadata = {
  title: "Eco-tours",
  description:
    "Guided birdwatching expeditions, sunrise boat tours, lakeside homestays and research treks at Naujan Lake National Park — with durations, capacities and published tariffs.",
  alternates: { canonical: "/tours" },
};

const difficultyStyles: Record<TourDifficulty, string> = {
  EASY: "bg-moss-50 text-moss-700 ring-moss-600/25",
  MODERATE: "bg-reed-50 text-reed-800 ring-reed-600/25",
  CHALLENGING: "bg-alert-50 text-alert-700 ring-alert-600/25",
};

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export default async function ToursPage() {
  const tours = await getTours();

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
            Eco-tours
          </p>

          <div className="mt-5 grid gap-8 lg:grid-cols-12 lg:items-end">
            <h1 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] font-light tracking-[-0.02em] text-sand-50 lg:col-span-7">
              Go out with a guide
              <br />
              <span className="text-reed-200 italic">who knows the water.</span>
            </h1>
            <p className="max-w-md text-[15px] leading-[1.75] text-sand-200/75 lg:col-span-5">
              Four approved packages run from designated access points with
              accredited operators. Rates are per person and already include the
              environmental fee.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-sand-50 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="grid gap-6 md:grid-cols-2">
            {tours.map((tour) => (
              <article
                key={tour.slug}
                className="group flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_28px_60px_-34px_rgba(8,33,31,0.45)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-lake-900">
                  <Image
                    src={tour.image}
                    alt={tour.imageAlt}
                    fill
                    sizes="(min-width: 768px) 45vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                  <span className="absolute top-4 left-4 rounded-full bg-sand-50/90 px-3 py-1 text-[10px] font-semibold tracking-[0.16em] text-ink uppercase backdrop-blur-sm">
                    {tour.category}
                  </span>
                  <span
                    className={`absolute top-4 right-4 rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.14em] uppercase ring-1 ring-inset backdrop-blur-sm ${difficultyStyles[tour.difficulty]}`}
                  >
                    {difficultyLabel[tour.difficulty]}
                  </span>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <h2 className="font-display text-[22px] leading-snug text-ink">
                    {tour.title}
                  </h2>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft/80">
                    {tour.summary}
                  </p>

                  <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-ink-soft/85">
                    <div className="flex items-center gap-2">
                      <Clock className="size-3.5 text-lake-600" strokeWidth={1.9} />
                      <dt className="sr-only">Duration</dt>
                      <dd>{tour.duration}</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <Users className="size-3.5 text-lake-600" strokeWidth={1.9} />
                      <dt className="sr-only">Maximum capacity</dt>
                      <dd>Up to {tour.maxCapacity} guests</dd>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="size-3.5 text-lake-600" strokeWidth={1.9} />
                      <dt className="sr-only">Departure</dt>
                      <dd>{tour.departure}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {tour.inclusions.slice(0, 3).map((item) => (
                      <span
                        key={item}
                        className="rounded-full bg-sand-100 px-2.5 py-1 text-[11px] text-sand-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>

                  <div className="mt-6 flex items-end justify-between gap-4 border-t border-ink/8 pt-5">
                    <p>
                      <span className="font-display text-[22px] text-ink">
                        {peso.format(tour.ratePerPerson)}
                      </span>
                      <span className="ml-1.5 text-[12px] text-sand-600">
                        per person
                      </span>
                    </p>
                    <Link
                      href={`/tours/${tour.slug}`}
                      className="group/cta inline-flex items-center gap-2 text-[13px] font-medium text-lake-700 transition-colors hover:text-lake-900"
                    >
                      View package
                      <ArrowRight
                        className="size-4 transition-transform duration-300 group-hover/cta:translate-x-1"
                        strokeWidth={1.9}
                      />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-10 text-[12.5px] leading-relaxed text-sand-700">
            Booking is by inquiry only. Payment is settled on site at the park
            office — no online transaction is processed through this portal.
          </p>
        </div>
      </section>
    </>
  );
}
