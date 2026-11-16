import type { Metadata } from "next";
import { Suspense } from "react";
import { ClipboardCheck, Clock3, Wallet } from "lucide-react";
import InquiryForm from "@/components/inquire/inquiry-form";
import { getTours } from "@/lib/tours";

export const metadata: Metadata = {
  title: "Plan a visit",
  description:
    "Book a guided eco-tour at Naujan Lake National Park with a first payment deposit and track your booking status from Pending to On Process and Confirmed.",
  alternates: { canonical: "/inquire" },
};

const steps = [
  {
    icon: ClipboardCheck,
    title: "Book & choose payment",
    body: "Pick a package, date, and party size, then complete your 50% first payment (or full amount) via instant GCash, Maya, Bank Transfer, or Pay at Park Jetty.",
  },
  {
    icon: Clock3,
    title: "Pending → On Process",
    body: "Park staff verify your deposit and accept your booking. Your status updates from Pending to On Process in My Account while boat & guide are arranged.",
  },
  {
    icon: Wallet,
    title: "Confirm & settle balance",
    body: "Once marked Confirmed, bring your booking reference and settle any remaining balance at the park jetty on arrival.",
  },
];

type InquirePageProps = {
  searchParams: Promise<{
    tour?: string | string[];
    checkout?: string | string[];
  }>;
};

/** Awaiting `searchParams` suspends, so it is isolated behind a Suspense boundary. */
async function InquiryPanel({ searchParams }: InquirePageProps) {
  const [{ tour, checkout }, tours] = await Promise.all([
    searchParams,
    getTours(),
  ]);

  return (
    <InquiryForm
      initialTour={typeof tour === "string" ? tour : undefined}
      initialCheckoutError={
        checkout === "cancelled"
          ? "Online payment was cancelled. Choose another channel or retry checkout."
          : undefined
      }
      tours={tours}
    />
  );
}

export default function InquirePage({ searchParams }: InquirePageProps) {
  return (
    <>
      <section className="relative isolate overflow-hidden bg-lake-950 pt-32 pb-16 lg:pt-40 lg:pb-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_70%_at_15%_0%,rgba(51,135,133,0.3),transparent_60%)]"
        />
        <div className="relative mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.22em] text-sand-300/80 uppercase">
            <span aria-hidden="true" className="h-px w-7 bg-sand-300/50" />
            Plan a visit
          </p>
          <h1 className="mt-5 max-w-2xl font-display text-[clamp(2.1rem,4.6vw,3.3rem)] leading-[1.05] font-light tracking-[-0.02em] text-sand-50">
            Tell us when you&rsquo;re coming,
            <br />
            <span className="text-reed-200 italic">we&rsquo;ll hold the boat.</span>
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-[1.75] text-sand-200/75">
            Submit your travel details with a reservation first payment, then
            track your booking live from Pending to On Process and Confirmed in
            your account.
          </p>
        </div>
      </section>

      <section className="bg-sand-50 py-16 lg:py-20">
        <div className="mx-auto w-full max-w-7xl px-5 sm:px-8 lg:px-12">
          <div className="grid gap-10 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-7">
              <Suspense
                fallback={
                  <div className="h-[560px] animate-pulse rounded-2xl bg-white ring-1 ring-ink/10" />
                }
              >
                <InquiryPanel searchParams={searchParams} />
              </Suspense>
            </div>

            <aside className="lg:col-span-5">
              <div className="rounded-2xl border border-ink/8 bg-white p-6 lg:sticky lg:top-28">
                <h2 className="text-[11px] font-semibold tracking-[0.18em] text-sand-600 uppercase">
                  How it works
                </h2>
                <ol className="mt-5 space-y-5">
                  {steps.map((step, index) => (
                    <li key={step.title} className="flex gap-3.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sand-100 font-mono text-[11px] text-sand-700">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <div>
                        <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                          <step.icon
                            className="size-3.5 text-lake-600"
                            strokeWidth={1.9}
                            aria-hidden="true"
                          />
                          {step.title}
                        </p>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-soft/75">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>

                <p className="mt-6 border-t border-ink/8 pt-5 text-[12px] leading-relaxed text-sand-700">
                  Group bookings above the listed capacity are arranged directly
                  with the park office at{" "}
                  <span className="font-medium text-ink">
                    tours@naujanlake.gov.ph
                  </span>
                  .
                </p>
              </div>
            </aside>
          </div>
        </div>
      </section>
    </>
  );
}
