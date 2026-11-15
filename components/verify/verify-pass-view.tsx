"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  QrCode,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import BrandMark from "@/components/brand-mark";
import { useAuth } from "@/components/auth-provider";
import { setInquiryStatus, useInquiries } from "@/lib/inquiries";
import { INQUIRY_STATUS_META, PAYMENT_STATUS_META } from "@/lib/inquiry-status";

type VerifyQuery = {
  ref?: string;
  guest?: string;
  tour?: string;
  date?: string;
  guests?: string;
  pay?: string;
};

export default function VerifyPassView({ initial }: { initial: VerifyQuery }) {
  const inquiries = useInquiries();
  const { user } = useAuth();
  const [lookup, setLookup] = useState(initial.ref ?? "");
  const [busy, setBusy] = useState(false);

  const normalizedRef = lookup.trim().toUpperCase();
  const matched = useMemo(
    () =>
      normalizedRef
        ? inquiries.find((item) => item.reference.toUpperCase() === normalizedRef)
        : undefined,
    [inquiries, normalizedRef],
  );

  const hasSignedPayload = Boolean(initial.ref && initial.tour && initial.guest);
  const displayGuest = matched?.fullName ?? initial.guest ?? "—";
  const displayTour = matched?.tourTitle ?? initial.tour ?? "—";
  const displayDate = matched?.preferredDate ?? initial.date ?? "—";
  const displayParty = matched?.partySize ?? (initial.guests ? Number(initial.guests) : 0);
  const displayPayment = matched?.paymentStatus ?? initial.pay ?? "UNPAID";

  const paymentMeta =
    PAYMENT_STATUS_META[
      displayPayment as keyof typeof PAYMENT_STATUS_META
    ] ?? PAYMENT_STATUS_META.UNPAID;

  const isBoardable = matched
    ? matched.status === "ON_PROCESS" ||
      matched.status === "CONFIRMED" ||
      matched.status === "COMPLETED"
    : hasSignedPayload;

  async function markCheckedIn(nextStatus: "CONFIRMED" | "COMPLETED") {
    if (!matched || user?.role !== "admin") return;
    setBusy(true);
    try {
      await setInquiryStatus(matched.id, nextStatus, { actor: "park" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="min-h-[82vh] bg-sand-50 pt-32 pb-20 lg:pt-36">
      <div className="mx-auto w-full max-w-2xl px-5 sm:px-8">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-lake-800 hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to Naujan Lake portal
        </Link>

        <div className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-ink/10">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-lake-950 px-6 py-5 text-sand-50">
            <div className="flex items-center gap-3.5">
              <BrandMark className="size-12 ring-white/25" />
              <div>
                <p className="text-[10px] font-semibold tracking-[0.18em] text-sand-300 uppercase">
                  Dock Check-In · QR Verification
                </p>
                <h1 className="font-display text-[22px] leading-tight">
                  Digital Boarding Pass Verifier
                </h1>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-sand-100">
              <QrCode className="size-3.5" />
              ISO 18004 Pass
            </span>
          </div>

          <div className="space-y-6 p-6">
            <div>
              <label
                htmlFor="verify-ref-input"
                className="block text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase"
              >
                Booking reference code
              </label>
              <div className="mt-1.5 flex gap-2">
                <div className="relative flex-1">
                  <Search
                    className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-sand-500"
                    strokeWidth={2}
                  />
                  <input
                    id="verify-ref-input"
                    type="text"
                    value={lookup}
                    onChange={(e) => setLookup(e.target.value)}
                    placeholder="INQ-1042"
                    className="w-full rounded-xl border border-ink/12 bg-sand-50 py-2.5 pr-4 pl-10 font-mono text-[13.5px] text-ink uppercase outline-none focus:border-lake-600 focus:bg-white focus:ring-3 focus:ring-lake-600/15"
                  />
                </div>
              </div>
            </div>

            {normalizedRef && (matched || hasSignedPayload) ? (
              <div className="space-y-5 rounded-2xl bg-sand-50 p-5 ring-1 ring-ink/10">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[12px] font-semibold text-lake-800">
                      {matched?.reference ?? normalizedRef}
                    </p>
                    <h2 className="mt-0.5 font-display text-[21px] leading-snug text-ink">
                      {displayTour}
                    </h2>
                  </div>

                  {matched ? (
                    <span
                      className={`rounded-full px-3 py-1 text-[10.5px] font-semibold tracking-[0.12em] uppercase ring-1 ring-inset ${
                        INQUIRY_STATUS_META[matched.status].chip
                      }`}
                    >
                      {INQUIRY_STATUS_META[matched.status].label}
                    </span>
                  ) : (
                    <span className="rounded-full bg-lake-50 px-3 py-1 text-[10.5px] font-semibold tracking-[0.12em] text-lake-800 uppercase ring-1 ring-lake-600/20">
                      Signed QR Payload
                    </span>
                  )}
                </div>

                <div
                  className={`flex items-start gap-3 rounded-xl px-4 py-3 text-[13px] ring-1 ring-inset ${
                    isBoardable
                      ? "bg-moss-50 text-moss-900 ring-moss-600/25"
                      : "bg-alert-50 text-alert-800 ring-alert-500/25"
                  }`}
                >
                  {isBoardable ? (
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-moss-700" />
                  ) : (
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-alert-700" />
                  )}
                  <div>
                    <p className="font-semibold">
                      {isBoardable
                        ? "Valid boarding pass — cleared for park briefing"
                        : `Pass not yet cleared for boarding (${matched ? INQUIRY_STATUS_META[matched.status].label : "Pending"})`}
                    </p>
                    <p className="mt-0.5 text-[12px] opacity-85">
                      {matched
                        ? "Matched directly against the active Naujan Lake booking ledger."
                        : "Decoded from QR ticket token. Rangers on duty can cross-check in /admin/inquiries."}
                    </p>
                  </div>
                </div>

                <dl className="grid gap-3 text-[13px] sm:grid-cols-3">
                  <div className="rounded-xl bg-white p-3.5 ring-1 ring-ink/8">
                    <dt className="text-[10px] font-semibold tracking-[0.12em] text-sand-600 uppercase">
                      Lead guest
                    </dt>
                    <dd className="mt-1 font-medium text-ink">{displayGuest}</dd>
                  </div>
                  <div className="rounded-xl bg-white p-3.5 ring-1 ring-ink/8">
                    <dt className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] text-sand-600 uppercase">
                      <CalendarDays className="size-3" />
                      Departure
                    </dt>
                    <dd className="mt-1 font-medium text-ink">{displayDate}</dd>
                  </div>
                  <div className="rounded-xl bg-white p-3.5 ring-1 ring-ink/8">
                    <dt className="flex items-center gap-1 text-[10px] font-semibold tracking-[0.12em] text-sand-600 uppercase">
                      <Users className="size-3" />
                      Manifest
                    </dt>
                    <dd className="mt-1 font-medium text-ink">
                      {displayParty || 1}{" "}
                      {displayParty === 1 ? "guest" : "guests"} ·{" "}
                      <span className="text-moss-700">{paymentMeta.label}</span>
                    </dd>
                  </div>
                </dl>

                {matched && user?.role === "admin" ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-4">
                    <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-lake-800">
                      <ShieldCheck className="size-4" />
                      Admin dock check-in actions
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {matched.status === "ON_PROCESS" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void markCheckedIn("CONFIRMED")}
                          className="rounded-full bg-lake-800 px-4 py-1.5 text-[12px] font-semibold text-sand-50 hover:bg-lake-700 disabled:opacity-50"
                        >
                          Confirm Ready
                        </button>
                      ) : null}
                      {matched.status === "CONFIRMED" ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void markCheckedIn("COMPLETED")}
                          className="rounded-full bg-moss-700 px-4 py-1.5 text-[12px] font-semibold text-sand-50 hover:bg-moss-800 disabled:opacity-50"
                        >
                          Mark Completed
                        </button>
                      ) : null}
                      <Link
                        href="/admin/inquiries"
                        className="rounded-full border border-ink/15 bg-white px-4 py-1.5 text-[12px] font-medium text-ink hover:bg-sand-100"
                      >
                        Open Admin Queue
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-ink/15 bg-sand-50/70 p-6 text-center text-[13px] text-ink-soft/75">
                {normalizedRef
                  ? `No local booking matched “${normalizedRef}”. Check the reference code or sign in on the park desk browser.`
                  : "Scan a visitor's QR Entry Pass or type a booking reference (e.g. INQ-1042) to verify jetty clearance."}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
