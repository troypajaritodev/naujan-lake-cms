"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Building2,
  Check,
  Copy,
  CreditCard,
  ImagePlus,
  Loader2,
  LogIn,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import { AuthField } from "@/components/auth-shell";
import { useAuth } from "@/components/auth-provider";
import type { SessionUser } from "@/lib/auth";
import {
  computeBookingPricing,
  createInquiry,
  FACILITATION_FEE_PHP,
  getReservedSeatsForDate,
  slotKey,
  useInquiries,
  useReservedSeatsBySlot,
  type Inquiry,
  type PaymentMethod,
} from "@/lib/inquiries";
import { PAYMENT_METHOD_META } from "@/lib/inquiry-status";
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

const METHOD_OPTIONS: {
  value: PaymentMethod;
  icon: typeof Smartphone;
}[] = [
  { value: "GCASH", icon: Smartphone },
  { value: "MAYA", icon: Wallet },
  { value: "BANK_TRANSFER", icon: Building2 },
  { value: "ON_SITE_CASH", icon: Banknote },
];

const PENDING_CHECKOUT_KEY = "nl.pendingCheckout.v1";

function generateGatewayReference(method: PaymentMethod): string {
  const prefix =
    method === "GCASH" ? "GC" : method === "MAYA" ? "MY" : "LBP";
  const digits = String(Math.floor(100_000_000 + Math.random() * 900_000_000));
  return `${prefix}-${digits}`;
}

/** Compress an uploaded receipt image so it fits comfortably in browser storage. */
async function compressReceiptImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read image file."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Invalid image file."));
      img.onload = () => {
        const maxWidth = 640;
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(typeof reader.result === "string" ? reader.result : "");
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      if (typeof reader.result === "string") {
        img.src = reader.result;
      } else {
        reject(new Error("Unsupported image data."));
      }
    };
    reader.readAsDataURL(file);
  });
}

export default function InquiryForm({
  initialTour,
  initialCheckoutError,
  tours,
}: {
  initialTour?: string;
  initialCheckoutError?: string;
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
          Sign in to book and track your trip.
        </h2>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-soft/80">
          Bookings and first payment records are tied to your account so you can
          track when the park office moves your trip from Pending to On Process
          and Confirmed.
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

  return (
    <InquiryFields
      user={user}
      initialTour={initialTour}
      initialCheckoutError={initialCheckoutError}
      tours={tours}
    />
  );
}

function InquiryFields({
  user,
  initialTour,
  initialCheckoutError,
  tours,
}: {
  user: SessionUser;
  initialTour?: string;
  initialCheckoutError?: string;
  tours: Tour[];
}) {
  const allInquiries = useInquiries();
  const reservedSlots = useReservedSeatsBySlot();
  const errorRef = useRef<HTMLDivElement | null>(null);
  const handledReturnRef = useRef<string | null>(null);
  const todayIso = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

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
    firstPaymentRate: 0.5 as 0.5 | 1,
    paymentMethod: "GCASH" as PaymentMethod,
    paymentFlow: "CHECKOUT" as "CHECKOUT" | "MANUAL",
    paymentReference: "",
    paymentAccountName: user.fullName,
    payerMobile: user.phone || "",
  });
  const [paymentProofUrl, setPaymentProofUrl] = useState<string | undefined>(
    undefined,
  );
  const [proofName, setProofName] = useState<string | null>(null);
  const [copiedAccount, setCopiedAccount] = useState(false);
  const [error, setError] = useState<string | null>(
    initialCheckoutError ?? null,
  );
  const [pending, setPending] = useState(false);
  const [gatewayModal, setGatewayModal] = useState(false);
  const [gatewayBusy, setGatewayBusy] = useState(false);
  const [sent, setSent] = useState<Inquiry | null>(null);

  function reportError(message: string) {
    setError(message);
    window.requestAnimationFrame(() => {
      errorRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const status = params.get("checkout");
    const sessionId = params.get("session_id");
    if (!status) return;

    const cleanUrl = window.location.pathname;

    if (status === "cancelled") {
      window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
      window.history.replaceState({}, "", cleanUrl);
      return;
    }

    if (status === "success" && sessionId) {
      if (handledReturnRef.current === sessionId) return;
      handledReturnRef.current = sessionId;

      const rawDraft = window.sessionStorage.getItem(PENDING_CHECKOUT_KEY);
      window.history.replaceState({}, "", cleanUrl);
      if (!rawDraft) return;

      void (async () => {
        setPending(true);
        try {
          const draft = JSON.parse(rawDraft) as Parameters<typeof createInquiry>[0];
          const verifyRes = await fetch(
            `/api/payments/status?session_id=${encodeURIComponent(sessionId)}`,
          );
          const verifyData = (await verifyRes.json().catch(() => ({}))) as {
            paid?: boolean;
            paymentReference?: string;
            error?: string;
          };
          if (!verifyRes.ok || !verifyData.paid) {
            reportError(
              verifyData.error ??
                "Payment verification is still pending. Enter your reference manually or try again.",
            );
            return;
          }
          const inquiry = await createInquiry({
            ...draft,
            paymentReference: verifyData.paymentReference ?? sessionId,
          });
          window.sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
          setSent(inquiry);
        } catch (err) {
          reportError(
            err instanceof Error
              ? err.message
              : "Could not finalize your returning payment session. Please retry.",
          );
        } finally {
          setPending(false);
        }
      })();
    }
  }, []);

  const selected = useMemo(
    () => tours.find((tour) => tour.slug === values.tourSlug),
    [tours, values.tourSlug],
  );

  const seatAvailability = useMemo(() => {
    if (!selected || !values.preferredDate) return null;
    const serverReserved =
      reservedSlots[slotKey(selected.slug, values.preferredDate)];
    const reserved =
      typeof serverReserved === "number"
        ? serverReserved
        : getReservedSeatsForDate(
            allInquiries,
            selected.slug,
            values.preferredDate,
          );
    const remaining = Math.max(0, selected.maxCapacity - reserved);
    return {
      capacity: selected.maxCapacity,
      reserved,
      remaining,
    };
  }, [allInquiries, reservedSlots, selected, values.preferredDate]);

  const pricing = useMemo(() => {
    const rate = selected?.ratePerPerson ?? 0;
    const rawParty = Number(values.partySize);
    const guests =
      Number.isFinite(rawParty) && rawParty >= 1 ? Math.trunc(rawParty) : 1;
    const breakdown = computeBookingPricing(
      rate,
      guests,
      selected ? FACILITATION_FEE_PHP : 0,
    );
    const firstPayment = Math.round(breakdown.totalAmount * values.firstPaymentRate);
    const balance = Math.max(0, breakdown.totalAmount - firstPayment);
    return {
      rate,
      guests,
      subtotal: breakdown.packageSubtotal,
      facilitationFee: breakdown.facilitationFee,
      total: breakdown.totalAmount,
      firstPayment,
      balance,
    };
  }, [selected, values.partySize, values.firstPaymentRate]);

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

  async function handleReceiptChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Upload an image screenshot (PNG or JPG) for your receipt.");
      return;
    }
    try {
      const dataUrl = await compressReceiptImage(file);
      setPaymentProofUrl(dataUrl);
      setProofName(file.name);
      setError(null);
    } catch {
      setError("Could not process that receipt image. Try another photo.");
    }
  }

  function copyAccountNumber() {
    const number = PAYMENT_METHOD_META[values.paymentMethod].accountNumber;
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(number);
      setCopiedAccount(true);
      window.setTimeout(() => setCopiedAccount(false), 1800);
    }
  }

  async function finalizeBooking(
    overrideReference?: string,
    overrideAccountName?: string,
  ) {
    if (!selected) return;
    const party = Number(values.partySize);
    const breakdown = computeBookingPricing(
      selected.ratePerPerson,
      party,
      FACILITATION_FEE_PHP,
    );
    const totalAmount = breakdown.totalAmount;
    const isCash = values.paymentMethod === "ON_SITE_CASH";
    const firstPaymentAmount = isCash
      ? 0
      : Math.round(totalAmount * values.firstPaymentRate);
    const balanceAmount = Math.max(0, totalAmount - firstPaymentAmount);

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
      ratePerPerson: selected.ratePerPerson,
      packageSubtotal: breakdown.packageSubtotal,
      facilitationFee: breakdown.facilitationFee,
      operatorCommission: breakdown.operatorCommission,
      platformRevenue: breakdown.platformRevenue,
      totalAmount,
      firstPaymentRate: values.firstPaymentRate,
      firstPaymentAmount,
      balanceAmount,
      paymentMethod: values.paymentMethod,
      paymentReference: isCash
        ? ""
        : (overrideReference ?? values.paymentReference).trim(),
      paymentAccountName:
        (overrideAccountName ?? values.paymentAccountName).trim() ||
        values.fullName.trim(),
      ...(!isCash && paymentProofUrl ? { paymentProofUrl } : {}),
    });

    setSent(inquiry);
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!values.fullName.trim()) {
      return reportError("Enter the name for the booking.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) {
      return reportError("Enter a valid email so the park office can reply.");
    }
    if (!values.preferredDate) return reportError("Choose a preferred date.");
    if (!selected) return reportError("Choose a package.");

    const chosen = new Date(`${values.preferredDate}T00:00:00`);
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    if (chosen < startOfToday) {
      return reportError("Choose a date from today onwards.");
    }

    const party = Number(values.partySize);
    if (!Number.isFinite(party) || party < 1 || party > selected.maxCapacity) {
      return reportError(
        `This package takes 1 to ${selected.maxCapacity} guests per booking.`,
      );
    }

    if (seatAvailability && party > seatAvailability.remaining) {
      return reportError(
        seatAvailability.remaining === 0
          ? `No seats left for ${selected.title} on ${values.preferredDate}. Please pick another date.`
          : `Only ${seatAvailability.remaining} ${seatAvailability.remaining === 1 ? "seat" : "seats"} left on ${values.preferredDate}. Lower your guest count or pick another date.`,
      );
    }

    const isOnSiteCash = values.paymentMethod === "ON_SITE_CASH";

    if (!isOnSiteCash && values.paymentFlow === "MANUAL") {
      if (values.paymentReference.trim().length < 4) {
        return reportError(
          "Enter your payment reference number (at least 4 characters), or switch to Instant Checkout.",
        );
      }
    }

    if (!isOnSiteCash && values.paymentFlow === "CHECKOUT") {
      setPending(true);
      try {
        const res = await fetch("/api/payments/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: pricing.firstPayment,
            tourTitle: selected.title,
            paymentMethod: values.paymentMethod,
            customerEmail: values.email.trim(),
            customerName: values.fullName.trim(),
            origin: window.location.origin,
          }),
        });
        const data = (await res.json()) as {
          mode?: "paymongo" | "sandbox";
          checkoutUrl?: string;
          error?: string;
        };

        if (!res.ok) {
          return reportError(
            data.error ?? "Payment gateway is unavailable right now.",
          );
        }

        if (data.mode === "paymongo" && data.checkoutUrl) {
          window.sessionStorage.setItem(
            PENDING_CHECKOUT_KEY,
            JSON.stringify({
              userEmail: user.email,
              fullName: values.fullName.trim(),
              email: values.email.trim(),
              phone: values.phone.trim(),
              tourSlug: selected.slug,
              tourTitle: selected.title,
              preferredDate: values.preferredDate,
              partySize: party,
              message: values.message.trim(),
              ratePerPerson: selected.ratePerPerson,
              totalAmount: selected.ratePerPerson * party,
              firstPaymentRate: values.firstPaymentRate,
              firstPaymentAmount: pricing.firstPayment,
              balanceAmount: pricing.balance,
              paymentMethod: values.paymentMethod,
              paymentAccountName:
                values.paymentAccountName.trim() || values.fullName.trim(),
            }),
          );
          window.location.href = data.checkoutUrl;
          return;
        }

        if (data.mode === "sandbox") {
          // Built-in interactive gateway authorization modal when PayMongo keys are not set.
          setGatewayModal(true);
          return;
        }

        return reportError(
          data.error ?? "Payment gateway returned an unexpected response.",
        );
      } catch {
        return reportError(
          "Unable to reach payment gateway right now. Try again or use Manual Transfer.",
        );
      } finally {
        setPending(false);
      }
    }

    setPending(true);
    try {
      await finalizeBooking();
    } catch (err) {
      reportError(
        err instanceof Error
          ? err.message
          : "Could not save your booking right now. Please try again.",
      );
    } finally {
      setPending(false);
    }
  }

  async function authorizeInteractivePayment() {
    setGatewayBusy(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 550));
      const generatedRef = generateGatewayReference(values.paymentMethod);
      await finalizeBooking(
        generatedRef,
        values.paymentAccountName.trim() || values.fullName.trim(),
      );
      setGatewayModal(false);
    } catch (err) {
      setGatewayModal(false);
      reportError(
        err instanceof Error
          ? err.message
          : "Could not save your booking. Please try again.",
      );
    } finally {
      setGatewayBusy(false);
    }
  }

  if (sent) {
    const isCash = sent.paymentMethod === "ON_SITE_CASH";
    const methodLabel = sent.paymentMethod
      ? PAYMENT_METHOD_META[sent.paymentMethod].label
      : "Payment";

    return (
      <div className="rounded-2xl bg-white p-7 ring-1 ring-ink/10 sm:p-9">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="grid size-11 place-items-center rounded-full bg-moss-50 text-moss-700 ring-1 ring-moss-600/20">
            <Check className="size-5" strokeWidth={2.4} />
          </span>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-reed-50 px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-reed-800 uppercase ring-1 ring-reed-600/25 ring-inset">
              Status: Pending
            </span>
            <span className="rounded-full bg-sand-100 px-3 py-1 text-[10px] font-semibold tracking-[0.12em] text-sand-800 uppercase ring-1 ring-ink/10 ring-inset">
              {isCash ? "Pay on arrival at jetty" : "First payment submitted"}
            </span>
          </div>
        </div>

        <h2 className="mt-5 font-display text-[26px] leading-tight font-light text-ink">
          {isCash ? "Booking request submitted." : "Booking & first payment submitted."}
        </h2>
        <p className="mt-2 max-w-lg text-[13.5px] leading-relaxed text-ink-soft/80">
          Your booking is now <strong>Pending</strong>. Once the park admin
          accepts it{isCash ? "" : " and verifies your first payment"}, the status in{" "}
          <strong>My Account</strong> will move to <strong>On Process</strong>{" "}
          so you can track, cancel, or manage your trip anytime.
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
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              {isCash ? "Payment channel" : "First payment sent"}
            </dt>
            <dd className="mt-1 font-mono text-[14px] font-medium text-moss-700">
              {isCash
                ? methodLabel
                : `${peso.format(sent.firstPaymentAmount ?? 0)} · ${methodLabel}`}
            </dd>
            {sent.paymentReference && (
              <dd className="mt-0.5 font-mono text-[11.5px] text-sand-600">
                Ref: {sent.paymentReference}
              </dd>
            )}
          </div>
          <div>
            <dt className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              Remaining balance at jetty
            </dt>
            <dd className="mt-1 font-mono text-[14px] text-ink">
              {peso.format(sent.balanceAmount ?? 0)}
              <span className="ml-1.5 font-sans text-[11.5px] text-sand-600">
                (of {peso.format(sent.totalAmount ?? 0)})
              </span>
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/account"
            className="inline-flex items-center gap-2 rounded-full bg-lake-800 px-5 py-3 text-[13px] font-semibold text-sand-50 transition-colors hover:bg-lake-700"
          >
            Track booking in My Account
            <ArrowRight className="size-4" strokeWidth={2} />
          </Link>
          <button
            type="button"
            onClick={() => {
              setSent(null);
              setPaymentProofUrl(undefined);
              setProofName(null);
              setValues((current) => ({
                ...current,
                message: "",
                paymentReference: "",
              }));
            }}
            className="inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:bg-sand-100"
          >
            Book another trip
          </button>
        </div>
      </div>
    );
  }

  const activeMethod = PAYMENT_METHOD_META[values.paymentMethod];
  const isCash = values.paymentMethod === "ON_SITE_CASH";
  const dueNowAmount = isCash ? 0 : pricing.firstPayment;

  return (
    <>
      <form onSubmit={onSubmit} noValidate className="space-y-6">
        {error && (
          <div
            ref={errorRef}
            role="alert"
            className="flex items-start gap-2 rounded-xl bg-alert-50 px-4 py-3 text-[13px] text-alert-700 ring-1 ring-alert-500/20 ring-inset"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
            <span>{error}</span>
          </div>
        )}

      {/* Step 1: Trip & Guest details */}
      <div className="surface-card space-y-5 rounded-2xl p-6 ring-1 ring-ink/10 sm:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/8 pb-4">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.18em] text-sand-600 uppercase">
              Step 01
            </p>
            <h2 className="mt-1 font-display text-[21px] leading-tight text-ink">
              Travel &amp; guest details
            </h2>
          </div>
          {selected && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-sand-100 px-3 py-1 text-[11px] font-medium text-sand-800">
                {selected.duration} · {selected.departure}
              </span>
              <span className="rounded-full bg-lake-50 px-3 py-1 font-mono text-[11.5px] font-medium text-lake-800 ring-1 ring-lake-600/20">
                {peso.format(selected.ratePerPerson)} / guest
              </span>
            </div>
          )}
        </div>

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
              setValues((current) => ({
                ...current,
                tourSlug: event.target.value,
              }))
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
            onChange={(preferredDate) => {
              setError(null);
              setValues((current) => ({ ...current, preferredDate }));
            }}
            min={todayIso}
            hint="Held once the park admin accepts your booking."
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

        {seatAvailability && (
          <div
            className={`flex flex-wrap items-center justify-between gap-2 rounded-xl px-4 py-2.5 text-[12px] ring-1 ring-inset ${
              seatAvailability.remaining === 0
                ? "bg-alert-50 text-alert-700 ring-alert-600/20"
                : seatAvailability.remaining <= 3
                  ? "bg-reed-50 text-reed-800 ring-reed-600/25"
                  : "bg-moss-50/70 text-moss-800 ring-moss-600/20"
            }`}
          >
            <span className="font-medium">
              {seatAvailability.remaining === 0
                ? `Full on ${values.preferredDate}`
                : `${seatAvailability.remaining} of ${seatAvailability.capacity} seats available on ${values.preferredDate}`}
            </span>
            <span className="font-mono text-[11px] opacity-80">
              {seatAvailability.reserved} already reserved
            </span>
          </div>
        )}

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
            rows={3}
            value={values.message}
            onChange={(event) =>
              setValues((current) => ({ ...current, message: event.target.value }))
            }
            placeholder="Arrival time, mobility needs, preferred departure point…"
            className="mt-2 w-full resize-y rounded-xl border border-ink/12 bg-white px-4 py-3 text-[14.5px] leading-relaxed text-ink transition-colors outline-none placeholder:text-sand-400 focus:border-lake-600 focus:ring-3 focus:ring-lake-600/15"
          />
        </div>
      </div>

      {/* Step 2: First Payment */}
      <div className="surface-card space-y-5 rounded-2xl p-6 ring-1 ring-ink/10 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink/8 pb-4">
          <div>
            <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.18em] text-lake-700 uppercase">
              <CreditCard className="size-3.5" strokeWidth={2} />
              Step 02 · Required first payment
            </p>
            <h2 className="mt-1 font-display text-[21px] leading-tight text-ink">
              Reservation deposit
            </h2>
          </div>
          <div className="text-right">
            <p className="text-[10.5px] tracking-[0.12em] text-sand-600 uppercase">
              {isCash ? "Pay on arrival" : "Due now"}
            </p>
            <p className="font-display text-[26px] leading-none text-lake-800">
              {peso.format(dueNowAmount)}
            </p>
          </div>
        </div>

        {/* Payment channel */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.14em] text-sand-700 uppercase">
            Payment channel
          </p>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            {METHOD_OPTIONS.map(({ value, icon: Icon }) => {
              const active = values.paymentMethod === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setError(null);
                    setValues((current) => ({ ...current, paymentMethod: value }));
                  }}
                  aria-pressed={active}
                  className={`flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-left text-[13px] font-medium transition-all ring-1 ${
                    active
                      ? "bg-lake-800 text-sand-50 ring-lake-800"
                      : "bg-white text-ink ring-ink/12 hover:bg-sand-50"
                  }`}
                >
                  <Icon className="size-4 shrink-0" strokeWidth={1.9} />
                  <span className="truncate">
                    {PAYMENT_METHOD_META[value].label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Payment plan selector (hidden for on-site cash reservation) */}
        {!isCash && (
          <div>
            <p className="text-[11px] font-semibold tracking-[0.14em] text-sand-700 uppercase">
              First payment amount
            </p>
            <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
              {(
                [
                  {
                    rate: 0.5 as const,
                    title: "50% First payment (Deposit)",
                    desc: `Pay ${peso.format(Math.round(pricing.total * 0.5))} now, settle ${peso.format(Math.max(0, pricing.total - Math.round(pricing.total * 0.5)))} at the jetty.`,
                  },
                  {
                    rate: 1 as const,
                    title: "100% Full payment",
                    desc: `Pay ${peso.format(pricing.total)} now — nothing else due on arrival.`,
                  },
                ] as const
              ).map((option) => {
                const active = values.firstPaymentRate === option.rate;
                return (
                  <button
                    key={option.rate}
                    type="button"
                    onClick={() =>
                      setValues((current) => ({
                        ...current,
                        firstPaymentRate: option.rate,
                      }))
                    }
                    aria-pressed={active}
                    className={`rounded-xl p-3.5 text-left transition-all ring-1 ${
                      active
                        ? "bg-lake-50/70 ring-2 ring-lake-700"
                        : "bg-sand-50/50 ring-ink/10 hover:bg-sand-50"
                    }`}
                  >
                    <p className="text-[13px] font-semibold text-ink">
                      {option.title}
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-soft/75">
                      {option.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Summary breakdown */}
        <div className="rounded-xl bg-sand-50 p-4 ring-1 ring-ink/8">
          <div className="flex justify-between text-[12.5px] text-ink-soft/80">
            <span>
              {selected?.title} ({pricing.guests}{" "}
              {pricing.guests === 1 ? "guest" : "guests"} ×{" "}
              {peso.format(pricing.rate)})
            </span>
            <span className="font-mono text-ink">
              {peso.format(pricing.subtotal)}
            </span>
          </div>
          {pricing.facilitationFee > 0 && (
            <div className="mt-1.5 flex justify-between text-[12.5px] text-ink-soft/80">
              <span>Booking facilitation fee</span>
              <span className="font-mono text-ink">
                {peso.format(pricing.facilitationFee)}
              </span>
            </div>
          )}
          <div className="mt-2 flex justify-between border-t border-ink/8 pt-2 text-[12.5px] font-medium text-ink">
            <span>Total booking payable</span>
            <span className="font-mono">{peso.format(pricing.total)}</span>
          </div>
          {!isCash ? (
            <>
              <div className="mt-2 flex justify-between text-[13px] font-semibold text-lake-800">
                <span>
                  First payment ({Math.round(values.firstPaymentRate * 100)}%)
                </span>
                <span className="font-mono">{peso.format(pricing.firstPayment)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-ink/8 pt-2 text-[12px] text-sand-700">
                <span>Remaining balance at the park jetty</span>
                <span className="font-mono">{peso.format(pricing.balance)}</span>
              </div>
            </>
          ) : (
            <div className="mt-2 flex justify-between border-t border-ink/8 pt-2 text-[12.5px] font-semibold text-lake-800">
              <span>Payable on arrival at Park Jetty</span>
              <span className="font-mono">{peso.format(pricing.total)}</span>
            </div>
          )}
        </div>

        {/* Channel execution mode */}
        {isCash ? (
          <div className="rounded-xl border border-moss-600/25 bg-moss-50/60 p-4 text-[12.5px] leading-relaxed text-moss-900">
            <p className="font-semibold text-moss-800">
              Reserve now &amp; pay at Brgy. Bambanin Park Jetty
            </p>
            <p className="mt-1 text-moss-900/80">
              {activeMethod.instructions} You can also switch to online deposit
              payment later from <strong>My Account</strong>.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold tracking-[0.14em] text-sand-700 uppercase">
                How would you like to pay?
              </p>
              <div className="inline-flex rounded-full bg-sand-100 p-1 ring-1 ring-ink/10">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setValues((c) => ({ ...c, paymentFlow: "CHECKOUT" }));
                  }}
                  className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                    values.paymentFlow === "CHECKOUT"
                      ? "bg-white text-lake-900 shadow-xs"
                      : "text-ink-soft/75 hover:text-ink"
                  }`}
                >
                  Instant checkout
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setValues((c) => ({ ...c, paymentFlow: "MANUAL" }));
                  }}
                  className={`rounded-full px-3 py-1 text-[11.5px] font-semibold transition-colors ${
                    values.paymentFlow === "MANUAL"
                      ? "bg-white text-lake-900 shadow-xs"
                      : "text-ink-soft/75 hover:text-ink"
                  }`}
                >
                  Enter ref no. / receipt
                </button>
              </div>
            </div>

            {values.paymentFlow === "CHECKOUT" ? (
              <div className="rounded-xl border border-lake-600/20 bg-lake-50/55 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-lake-800 text-sand-50">
                    <Sparkles className="size-4" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-ink">
                      Instant {activeMethod.label} checkout
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-ink-soft/80">
                      Click submit below to authorize {peso.format(pricing.firstPayment)} via{" "}
                      {activeMethod.label}. Your transaction reference is recorded
                      automatically upon payment confirmation — no manual reference
                      typing needed.
                    </p>
                  </div>
                </div>
                <AuthField
                  id="paymentAccountName"
                  label="Payer name"
                  value={values.paymentAccountName}
                  onChange={(paymentAccountName) =>
                    setValues((current) => ({ ...current, paymentAccountName }))
                  }
                  placeholder="Full name on wallet or bank account"
                  required={false}
                />
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-lake-600/20 bg-lake-50/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10.5px] font-semibold tracking-[0.14em] text-lake-800 uppercase">
                        Send {peso.format(pricing.firstPayment)} to
                      </p>
                      <p className="mt-1 text-[13.5px] font-semibold text-ink">
                        {activeMethod.accountName}
                      </p>
                      <p className="mt-0.5 font-mono text-[13px] text-lake-900">
                        {activeMethod.accountNumber}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={copyAccountNumber}
                      className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[11.5px] font-semibold text-lake-800 ring-1 ring-lake-600/25 transition-colors hover:bg-lake-50"
                    >
                      {copiedAccount ? (
                        <>
                          <Check className="size-3.5 text-moss-600" strokeWidth={2.4} />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="size-3.5" strokeWidth={2} />
                          Copy number
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-ink-soft/80">
                    {activeMethod.instructions}
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <AuthField
                    id="paymentReference"
                    label="Payment reference no."
                    value={values.paymentReference}
                    onChange={(paymentReference) => {
                      setError(null);
                      setValues((current) => ({ ...current, paymentReference }));
                    }}
                    placeholder="e.g. GC-884120934"
                    hint="Found on your GCash, Maya, or bank receipt."
                  />
                  <AuthField
                    id="paymentAccountName"
                    label="Sender account name"
                    value={values.paymentAccountName}
                    onChange={(paymentAccountName) =>
                      setValues((current) => ({ ...current, paymentAccountName }))
                    }
                    placeholder="Name on sending wallet/bank"
                    required={false}
                  />
                </div>

                <div>
                  <label
                    htmlFor="paymentProof"
                    className="block text-[11px] font-semibold tracking-[0.14em] text-sand-700 uppercase"
                  >
                    Receipt screenshot
                    <span className="ml-1.5 font-normal tracking-normal text-sand-500 normal-case">
                      optional
                    </span>
                  </label>
                  {paymentProofUrl ? (
                    <div className="mt-2 flex items-center gap-4 rounded-xl border border-ink/10 bg-sand-50 p-3">
                      <Image
                        src={paymentProofUrl}
                        alt="Uploaded payment receipt preview"
                        width={72}
                        height={72}
                        unoptimized
                        className="size-16 rounded-lg object-cover ring-1 ring-ink/10"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-ink">
                          {proofName ?? "Receipt uploaded"}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-moss-700">
                          Attached for admin verification
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentProofUrl(undefined);
                          setProofName(null);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-[11.5px] font-medium text-alert-700 hover:bg-alert-50"
                      >
                        <Trash2 className="size-3.5" strokeWidth={2} />
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label
                      htmlFor="paymentProof"
                      className="mt-2 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-ink/20 bg-sand-50/60 px-4 py-3.5 text-[13px] text-ink-soft/80 transition-colors hover:border-lake-600/50 hover:bg-lake-50/40"
                    >
                      <ImagePlus className="size-4 text-lake-700" strokeWidth={1.9} />
                      <span>Attach screenshot of your first payment receipt (JPG/PNG)</span>
                      <input
                        id="paymentProof"
                        type="file"
                        accept="image/*"
                        onChange={handleReceiptChange}
                        className="sr-only"
                      />
                    </label>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-alert-50 px-4 py-3 text-[13px] text-alert-700 ring-1 ring-alert-500/20 ring-inset"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          <span>{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-lake-800 px-5 py-3.5 text-sm font-semibold text-sand-50 transition-colors hover:bg-lake-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" strokeWidth={2} />}
        {pending
          ? "Processing booking…"
          : isCash
            ? "Submit booking (Pay at Park Jetty)"
            : values.paymentFlow === "CHECKOUT"
              ? `Pay & submit booking (${peso.format(pricing.firstPayment)})`
              : `Submit booking & first payment (${peso.format(pricing.firstPayment)})`}
        {!pending && (
          <ArrowRight
            className="size-4 transition-transform duration-300 group-hover:translate-x-1"
            strokeWidth={2}
          />
        )}
      </button>
    </form>

    {gatewayModal && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Authorize ${activeMethod.label} payment`}
        className="fixed inset-0 z-50 grid place-items-center bg-ink/55 p-4 backdrop-blur-sm"
      >
        <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-ink/10">
          <div className="flex items-center justify-between border-b border-ink/8 bg-lake-950 px-6 py-4 text-sand-50">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-reed-300 uppercase">
                {activeMethod.label} Checkout
              </p>
              <h3 className="mt-0.5 font-display text-[20px] font-light">
                Authorize First Payment
              </h3>
            </div>
            <button
              type="button"
              disabled={gatewayBusy}
              onClick={() => setGatewayModal(false)}
              aria-label="Close payment window"
              className="grid size-8 place-items-center rounded-full bg-white/10 text-sand-100 hover:bg-white/20 disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="space-y-4 p-6">
            <div className="rounded-2xl bg-sand-50 p-4 ring-1 ring-ink/8">
              <div className="flex items-center justify-between text-[12px] text-ink-soft/75">
                <span>Merchant</span>
                <span className="font-semibold text-ink">
                  {activeMethod.accountName}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[12px] text-ink-soft/75">
                <span>Package</span>
                <span className="truncate max-w-[220px] font-medium text-ink">
                  {selected?.title}
                </span>
              </div>
              <div className="mt-3 flex items-baseline justify-between border-t border-ink/8 pt-3">
                <span className="text-[11px] font-semibold tracking-[0.12em] text-sand-600 uppercase">
                  Amount to authorize
                </span>
                <span className="font-display text-[28px] leading-none text-lake-800">
                  {peso.format(pricing.firstPayment)}
                </span>
              </div>
            </div>

            <AuthField
              id="payerMobile"
              label={
                values.paymentMethod === "BANK_TRANSFER"
                  ? "Account holder / mobile no."
                  : `${activeMethod.label} registered mobile no.`
              }
              value={values.payerMobile}
              onChange={(payerMobile) =>
                setValues((c) => ({ ...c, payerMobile }))
              }
              placeholder="0917 000 0000"
              required={false}
            />

            <p className="flex items-start gap-2 rounded-xl bg-lake-50/70 px-3.5 py-2.5 text-[11.5px] leading-relaxed text-lake-900 ring-1 ring-lake-600/15">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-lake-700" />
              <span>
                Confirming generates a transaction reference and immediately
                saves your booking &amp; first payment record to your account.
              </span>
            </p>

            <div className="flex flex-wrap gap-2.5 pt-1">
              <button
                type="button"
                disabled={gatewayBusy}
                onClick={() => void authorizeInteractivePayment()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-lake-800 px-5 py-3 text-[13px] font-semibold text-sand-50 transition-colors hover:bg-lake-700 disabled:opacity-60"
              >
                {gatewayBusy && <Loader2 className="size-4 animate-spin" />}
                {gatewayBusy
                  ? "Authorizing payment…"
                  : `Confirm & pay ${peso.format(pricing.firstPayment)}`}
              </button>
              <button
                type="button"
                disabled={gatewayBusy}
                onClick={() => setGatewayModal(false)}
                className="rounded-full border border-ink/15 px-4 py-3 text-[13px] font-medium text-ink hover:bg-sand-100 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
