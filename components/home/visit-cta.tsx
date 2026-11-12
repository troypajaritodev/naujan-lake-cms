import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Clock, Compass, Phone } from "lucide-react";
import { site } from "@/lib/site";

export default function VisitCta() {
  return (
    <section className="bg-sand-50 pb-20 lg:pb-24">
      <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="relative isolate overflow-hidden rounded-[1.75rem] bg-lake-950 lg:rounded-[2rem]">
          <Image
            src="/images/aerial.jpg"
            alt=""
            aria-hidden="true"
            fill
            sizes="(min-width: 1280px) 1216px, 100vw"
            className="-z-10 object-cover"
          />
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-lake-950/90" />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(100%_90%_at_12%_0%,rgba(51,135,133,0.35),transparent_58%)]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-32 -right-24 size-[360px] rounded-full border border-white/6"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-8 size-[240px] rounded-full border border-white/6"
          />

          <div className="relative grid gap-12 px-6 py-14 sm:px-10 lg:grid-cols-12 lg:items-end lg:gap-16 lg:px-14 lg:py-16">
            <div className="lg:col-span-7">
              <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-sand-300/80 uppercase">
                <span aria-hidden="true" className="h-px w-7 bg-sand-300/50" />
                Plan ahead
              </p>

              <h2 className="mt-5 max-w-xl font-display text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.04] font-light tracking-[-0.02em] text-sand-50">
                Check the water before you book the boat.
              </h2>

              <p className="mt-5 max-w-lg text-[15px] leading-[1.75] text-sand-200/75">
                Send an inquiry with your preferred date and party size. The
                park office replies with operator availability and the current
                tariff — fees are settled on site, never online.
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Link
                  href="/inquire"
                  className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-sand-50 px-6 py-3.5 text-sm font-semibold text-ink transition-colors duration-300 hover:bg-white"
                >
                  <Compass className="size-4" strokeWidth={2} />
                  Plan your visit
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                    strokeWidth={2}
                  />
                </Link>
                <Link
                  href="/guidelines"
                  className="inline-flex items-center justify-center rounded-full border border-white/25 px-6 py-3.5 text-sm font-medium text-sand-50 transition-colors duration-300 hover:border-white/50 hover:bg-white/10"
                >
                  Read the guidelines
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <dl className="rounded-2xl border border-white/12 bg-white/4 p-6 backdrop-blur-sm">
                <div className="border-b border-white/10 pb-4">
                  <dt className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-sand-300/70 uppercase">
                    <Clock
                      className="size-3.5 shrink-0 text-lake-300"
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                    Park hours
                  </dt>
                  <dd className="mt-1 text-[14px] text-sand-100">
                    {site.hours}
                  </dd>
                </div>

                <div className="border-b border-white/10 py-4">
                  <dt className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-sand-300/70 uppercase">
                    <Phone
                      className="size-3.5 shrink-0 text-lake-300"
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                    Emergency
                  </dt>
                  <dd className="mt-1 text-[14px] text-sand-100">
                    <a
                      href={`tel:${site.emergency}`}
                      className="underline decoration-white/25 underline-offset-4 transition-colors hover:decoration-white"
                    >
                      {site.emergency}
                    </a>{" "}
                    — municipal rescue and Coast Guard
                  </dd>
                </div>

                <div className="pt-4">
                  <dt className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-sand-300/70 uppercase">
                    <Compass
                      className="size-3.5 shrink-0 text-lake-300"
                      strokeWidth={1.9}
                      aria-hidden="true"
                    />
                    Access
                  </dt>
                  <dd className="mt-1 text-[14px] text-sand-100">
                    Accredited operators only, from designated access points
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
