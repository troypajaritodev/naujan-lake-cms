import Link from "next/link";
import { ArrowUpRight, Clock, MapPin, Phone } from "lucide-react";
import BrandMark from "@/components/brand-mark";
import { navigation, site, visitorLinks } from "@/lib/site";

export default function SiteFooter() {
  return (
    <footer className="relative isolate overflow-hidden bg-lake-950 text-sand-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_90%_at_15%_-10%,rgba(51,135,133,0.35),transparent_60%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -bottom-40 size-[420px] rounded-full border border-white/5"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -bottom-24 size-[280px] rounded-full border border-white/5"
      />

      <div className="relative mx-auto w-full max-w-7xl px-5 pt-16 pb-8 sm:px-8 lg:px-12 lg:pt-20">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <div className="flex items-center gap-3.5">
              <BrandMark className="size-12 ring-white/25" />
              <span className="flex flex-col leading-none">
                <span className="font-display text-xl text-sand-50">
                  Naujan Lake
                </span>
                <span className="mt-1 text-[9px] font-medium tracking-[0.28em] text-sand-300/70 uppercase">
                  National Park
                </span>
              </span>
            </div>
            <p className="mt-6 max-w-sm text-[14.5px] leading-relaxed text-sand-200/70">
              A visitor information hub for the fifth largest lake in the
              Philippines — balancing sustainable eco-tourism with the
              conservation of a wetland of international importance.
            </p>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-3.5 py-1.5 text-[10.5px] font-medium tracking-[0.18em] text-sand-200/80 uppercase">
              <span className="size-1.5 rounded-full bg-moss-400" />
              {site.ramsar}
            </p>
          </div>

          <nav aria-label="Explore" className="lg:col-span-2">
            <h2 className="text-[10.5px] font-semibold tracking-[0.2em] text-sand-400 uppercase">
              Explore
            </h2>
            <ul className="mt-5 space-y-3">
              {navigation.slice(1).map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[14px] text-sand-200/75 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <nav aria-label="Visitors" className="lg:col-span-2">
            <h2 className="text-[10.5px] font-semibold tracking-[0.2em] text-sand-400 uppercase">
              Visitors
            </h2>
            <ul className="mt-5 space-y-3">
              {visitorLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-[14px] text-sand-200/75 transition-colors hover:text-white"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="lg:col-span-3">
            <h2 className="text-[10.5px] font-semibold tracking-[0.2em] text-sand-400 uppercase">
              Park office
            </h2>
            <ul className="mt-5 space-y-4 text-[14px] text-sand-200/75">
              <li className="flex gap-3">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-lake-300"
                  strokeWidth={1.8}
                />
                <span>
                  Protected Area Management Office
                  <br />
                  {site.location}
                </span>
              </li>
              <li className="flex gap-3">
                <Clock
                  className="mt-0.5 size-4 shrink-0 text-lake-300"
                  strokeWidth={1.8}
                />
                <span>{site.hours}</span>
              </li>
              <li className="flex gap-3">
                <Phone
                  className="mt-0.5 size-4 shrink-0 text-lake-300"
                  strokeWidth={1.8}
                />
                <span>
                  Emergency hotline{" "}
                  <a
                    href={`tel:${site.emergency}`}
                    className="font-medium text-sand-50 underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-white"
                  >
                    {site.emergency}
                  </a>
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-6 text-[12px] text-sand-300/70 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {site.park}. Published for visitors, students and researchers.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span>
              Photography via Wikimedia Commons · CC BY-SA 4.0
            </span>
            <Link
              href="/guidelines"
              className="inline-flex items-center gap-1 text-sand-200/80 transition-colors hover:text-white"
            >
              Leave no trace
              <ArrowUpRight className="size-3.5" strokeWidth={2} />
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
