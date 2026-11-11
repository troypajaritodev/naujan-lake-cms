"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Loader2,
  LogIn,
} from "lucide-react";
import { AuthField } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import type { SessionUser } from "@/lib/auth";
import { createInquiry, type Inquiry } from "@/lib/inquiries";
import type { Tour } from "@/lib/tours";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default function InquiryForm({
  initialTour,
  tours,
}: {
  initialTour?: string;
  tours: Tour[];
}) {
  const { user, ready } = useAuth();

  if (!ready) {
    return (
      <div className="grid min-h-64 place-items-center rounded-2xl bg-white ring-1 ring-ink/10">
        <Loader2 className="size-5 animate-spin text-sand-500" strokeWidth={2} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-2xl bg-white p-7 ring-1 ring-ink/10 sm:p-9">
        <span className="grid size-11 place-items-center rounded-full bg-lake-50 text-lake-700 ring-1 ring-lake-600/20">
          <LogIn className="size-5" strokeWidth={2} />
        </span>
        <h2 className="mt-5 font-display text-[26px] leading-tight font-light text-ink">
          Sign in to send an inquiry.
        </h2>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-soft/80">
          Inquiries are tied to an account so the park office can reach you and
          you can follow the booking from your own dashboard. It takes about a
          minute to register.
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            href="/login?next=/inquire"
            className="inline-flex items-center gap-2 rounded-full bg-lake-800 px-5 py-3 text-[13px] font-semibold text-sand-50 transition-colors hover:bg-lake-700"
          >
            Sign in
            <ArrowRight className="size-4" strokeWidth={2} />
          </Link>
          <Link
            href="/register?next=/inquire"
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:bg-sand-100"
          >
            Create an account
          </Link>
        </div>
      </div>
    );
  }

  return <InquiryFields user={user} initialTour={initialTour} tours={tours} />;
}

function InquiryFields({
  user,
  initialTour,
  tours,
}: {
  user: SessionUser;
  initialTour?: string;
  tours: Tour[];
}) {
  const [values, setValues] = useState({
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    tourSlug:
      initialTour && tours.some((tour) => tour.slug === initialTour)
        ? initialTour
        : (tours[0]?.slug ?? ""),
    preferredDate: "",
    partySize: "2",
    message: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState<Inquiry | null>(null);

  const selected = useMemo(
    () => tours.find((tour) => tour.slug === values.tourSlug),
    [tours, values.tourSlug],
  );

  if (tours.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-7 ring-1 ring-ink/10 sm:p-9">
        <h2 className="font-display text-[24px] leading-tight font-light text-ink">
          No packages are open right now.
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-soft/80">
          The park office has not published a tour package yet. Please check
          back shortly or contact{" "}
          <span className="font-medium text-ink">tours@naujanlake.gov.ph</span>.
        </p>
      </div>
    );
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!values.fullName.trim()) return setError("Enter the name for the booking.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) {
      return setError("Enter a valid email so the park office can reply.");
    }
    if (!values.preferredDate) return setError("Choose a preferred date.");
    if (!selected) return setError("Choose a package.");

    const chosen = new Date(`${values.preferredDate}T00:00:00`);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (chosen < startOfToday) {
      return setError("Choose a date from today onwards.");
    }

    const party = Number(values.partySize);
    if (!Number.isFinite(party) || party < 1 || party > selected.maxCapacity) {
      return setError(
        `This package takes 1 to ${selected.maxCapacity} guests per booking.`,
      );
    }

    setPending(true);

    const inquiry = await createInquiry({
      userEmail: user.email,
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      phone: values.phone.trim(),
      tourSlug: selected.slug,
      tourTitle: selected.title,
      preferredDate: values.preferredDate,
      partySize: party,
      message: values.message.trim(),
    });

    // The record is already saved locally; the emails are a best-effort side
    // effect, so a failed send never blocks the confirmation screen.
    void fetch("/api/inquiries/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(inquiry),
      keepalive: true,
    }).catch(() => {});

    setSent(inquiry);
    setPending(false);
  }

  if (sent) {
    return (
      <div className="rounded-2xl bg-white p-7 ring-1 ring-ink/10 sm:p-9">
        <span className="grid size-11 place-items-center rounded-full bg-moss-50 text-moss-700 ring-1 ring-moss-600/20">
          <Check className="size-5" strokeWidth={2.4} />
        </span>
        <h2 className="mt-5 font-display text-[26px] leading-tight font-light text-ink">
          Inquiry received.
        </h2>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-soft/80">
          The park office replies within two working days. Nothing is paid
          online — the tariff is settled at the jetty on the day.
        </p>

        <dl className="mt-7 grid gap-4 border-t border-ink/8 pt-6 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              Reference
            </dt>
            <dd className="mt-1 font-mono text-[14px] text-ink">
              {sent.reference}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              Package
            </dt>
            <dd className="mt-1 text-[14px] text-ink">{sent.tourTitle}</dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              Preferred date
            </dt>
            <dd className="mt-1 text-[14px] text-ink">
              {dateFormat.format(new Date(`${sent.preferredDate}T00:00:00`))}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              Guests
            </dt>
            <dd className="mt-1 text-[14px] text-ink">{sent.partySize}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 rounded-full bg-lake-800 px-5 py-3 text-[13px] font-semibold text-sand-50 transition-colors hover:bg-lake-700"
          >
            See it in your account
            <ArrowRight className="size-4" strokeWidth={2} />
          </Link>
          <button
            type="button"
            onClick={() => {
              setSent(null);
              setValues((current) => ({ ...current, message: "" }));
            }}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:bg-sand-100"
          >
            Send another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-alert-50 px-4 py-3 text-[13px] text-alert-700 ring-1 ring-alert-500/20 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          {error}
        </div>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <AuthField
          id="fullName"
          label="Full name"
          value={values.fullName}
          onChange={(fullName) =>
            setValues((current) => ({ ...current, fullName }))
          }
          autoComplete="name"
        />
        <AuthField
          id="phone"
          label="Mobile"
          type="tel"
          value={values.phone}
          onChange={(phone) => setValues((current) => ({ ...current, phone }))}
          autoComplete="tel"
          inputMode="tel"
          required={false}
        />
      </div>

      <AuthField
        id="email"
        label="Email"
        type="email"
        value={values.email}
        onChange={(email) => setValues((current) => ({ ...current, email }))}
        autoComplete="email"
        inputMode="email"
      />

      <div>
        <label
          htmlFor="tourSlug"
          className="block text-[11px] font-semibold tracking-[0.14em] text-sand-700 uppercase"
        >
          Package
        </label>
        <select
          id="tourSlug"
          value={values.tourSlug}
          onChange={(event) =>
            setValues((current) => ({ ...current, tourSlug: event.target.value }))
          }
          className="mt-2 w-full appearance-none rounded-xl border border-ink/12 bg-white px-4 py-3 text-[14.5px] text-ink transition-colors outline-none focus:border-lake-600 focus:ring-3 focus:ring-lake-600/15"
        >
          {tours.map((tour) => (
            <option key={tour.slug} value={tour.slug}>
              {tour.title} — {peso.format(tour.ratePerPerson)} per person
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <AuthField
          id="preferredDate"
          label="Preferred date"
          type="date"
          value={values.preferredDate}
          onChange={(preferredDate) =>
            setValues((current) => ({ ...current, preferredDate }))
          }
          hint="Confirmed by the park office, not by this form."
        />
        <AuthField
          id="partySize"
          label="Guests"
          type="number"
          value={values.partySize}
          onChange={(partySize) =>
            setValues((current) => ({ ...current, partySize }))
          }
          min={1}
          max={selected?.maxCapacity}
          hint={
            selected
              ? `This package takes up to ${selected.maxCapacity}.`
              : undefined
          }
        />
      </div>

      <div>
        <label
          htmlFor="message"
          className="block text-[11px] font-semibold tracking-[0.14em] text-sand-700 uppercase"
        >
          Anything else
          <span className="ml-1.5 font-normal tracking-normal text-sand-500 normal-case">
            optional
          </span>
        </label>
        <textarea
          id="message"
          rows={4}
          value={values.message}
          onChange={(event) =>
            setValues((current) => ({ ...current, message: event.target.value }))
          }
          placeholder="Group size, mobility needs, preferred departure point…"
          className="mt-2 w-full resize-y rounded-xl border border-ink/12 bg-white px-4 py-3 text-[14.5px] leading-relaxed text-ink transition-colors outline-none placeholder:text-sand-400 focus:border-lake-600 focus:ring-3 focus:ring-lake-600/15"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-lake-800 px-5 py-3.5 text-sm font-semibold text-sand-50 transition-colors hover:bg-lake-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
        {pending ? "Sending" : "Send inquiry"}
        {!pending && (
          <ArrowRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2}
          />
        )}
      </button>
    </form>
  );
}
