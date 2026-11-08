import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Bird, CalendarDays, ShieldCheck } from "lucide-react";
import SubscribeForm from "@/components/subscribe/subscribe-form";

export const metadata: Metadata = {
  title: "Subscribe",
  description:
    "Get Naujan Lake park advisories, tour releases and volunteer dates by email — published by the park management office, never more than a few times a month.",
  alternates: { canonical: "/subscribe" },
};

const streams = [
  {
    icon: Bell,
    title: "Park advisories",
    body: "Water levels, nesting closures and weather notices — the same notices that appear on the advisory board, sent the day they are published.",
  },
  {
    icon: Bird,
    title: "Tour releases",
    body: "New packages, seasonal rates and operator announcements. Sent when the tariff table changes, not on a fixed schedule.",
  },
  {
    icon: CalendarDays,
    title: "Counts & volunteer days",
    body: "Waterbird census dates, shoreline clean-ups and the training sessions that come before them. Usually three or four emails a season.",
  },
];

export default function SubscribePage() {
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
            Newsletter
          </p>

          <div className="mt-5 grid gap-8 lg:grid-cols-12 lg:items-end">
            <h1 className="font-display text-[clamp(2.2rem,5vw,3.6rem)] leading-[1.02] font-light tracking-[-0.02em] text-sand-50 lg:col-span-7">
              Hear about the lake
              <br />
              <span className="text-reed-200 italic">before it is booked out.</span>
            </h1>
            <p className="max-w-md text-[15px] leading-[1.75] text-sand-200/75 lg:col-span-5">
              Advisories, tour releases and volunteer dates from the management
              office. Choose what you want — the rest stays out of your inbox.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-sand-50 py-16 lg:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-12 lg:gap-14 lg:px-12">
          <div className="lg:col-span-7">
            <h2 className="font-display text-[clamp(1.7rem,2.6vw,2.2rem)] leading-tight font-light text-ink">
              Three things, sent only when they change
            </h2>
            <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink-soft/85">
              There is no monthly digest and no marketing sequence. If nothing
              has changed on the lake, nothing is sent.
            </p>

            <ul className="mt-8 space-y-px overflow-hidden rounded-2xl border border-ink/10 bg-ink/10">
              {streams.map((stream) => (
                <li
                  key={stream.title}
                  className="flex items-start gap-4 bg-sand-50 p-5 lg:p-6"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-lake-800 text-sand-50">
                    <stream.icon
                      className="size-4"
                      strokeWidth={1.8}
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <h3 className="text-[14.5px] font-medium text-ink">
                      {stream.title}
                    </h3>
                    <p className="mt-1 text-[13px] leading-relaxed text-ink-soft/80">
                      {stream.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <p className="mt-6 flex items-start gap-2 text-[12.5px] leading-relaxed text-sand-700">
              <ShieldCheck
                className="mt-0.5 size-4 shrink-0 text-moss-600"
                strokeWidth={1.9}
                aria-hidden="true"
              />
              The address is stored for this list only and is never passed to
              operators. Unsubscribe from the footer of any message.
            </p>
          </div>

          <div className="lg:col-span-5">
            <SubscribeForm />

            <p className="mt-4 text-center text-[12px] text-sand-600">
              Already signed in?{" "}
              <Link
                href="/account"
                className="font-medium text-ink underline decoration-ink/20 underline-offset-4 hover:decoration-ink"
              >
                Manage your account
              </Link>
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
