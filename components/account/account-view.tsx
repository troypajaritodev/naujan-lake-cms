"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Ban,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock3,
  Compass,
  Copy,
  CreditCard,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  MapPin,
  MessageSquareText,
  Phone,
  Printer,
  Receipt,
  Search,
  Send,
  ShieldCheck,
  Ticket,
  Trash2,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { AuthField } from "@/components/auth-shell";
import BookingQrPass, { buildVerifyPath } from "@/components/booking-qr-pass";
import BrandMark from "@/components/brand-mark";
import { useAuth } from "@/components/auth-provider";
import { AuthError, type SessionUser } from "@/lib/auth";
import {
  addInquiryMessage,
  canCancelInquiry,
  cancelInquiry,
  deleteInquiry,
  InquiryError,
  submitFirstPayment,
  useInquiries,
  type Inquiry,
  type PaymentMethod,
} from "@/lib/inquiries";
import {
  BOOKING_TRACKER_STEPS,
  INQUIRY_STATUS_META,
  PAYMENT_METHOD_META,
  PAYMENT_STATUS_META,
  trackerStepIndex,
} from "@/lib/inquiry-status";

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-PH", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function formatDate(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormat.format(parsed);
}

function formatDateTime(iso: string) {
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "—" : dateTimeFormat.format(parsed);
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** One plain sentence per status, so the visitor knows exactly where things stand. */
function statusSummary(inquiry: Inquiry): string {
  const at =
    inquiry.status === "COMPLETED"
      ? inquiry.completedAt
      : inquiry.status === "CONFIRMED"
        ? inquiry.confirmedAt
        : inquiry.status === "ON_PROCESS"
          ? inquiry.onProcessAt
          : inquiry.status === "CANCELLED"
            ? inquiry.cancelledAt
            : inquiry.updatedAt;
  const when = at ? formatDate(at) : null;

  switch (inquiry.status) {
    case "ON_PROCESS":
      return when
        ? `Accepted by admin on ${when} and now On Process — park staff are preparing your boat, guide, and permit.`
        : "Accepted by admin and now On Process — park staff are preparing your boat, guide, and permit.";
    case "CONFIRMED":
      return when
        ? `Confirmed by the park on ${when}. Bring reference ${inquiry.reference} to the jetty.`
        : `Confirmed by the park. Bring reference ${inquiry.reference} to the jetty.`;
    case "COMPLETED":
      return when
        ? `Trip completed on ${when}. Thank you for visiting Naujan Lake!`
        : "Trip completed. Thank you for visiting Naujan Lake!";
    case "DECLINED":
      return when
        ? `The park office could not accommodate this request (${when}). Send another date or package.`
        : "The park office could not accommodate this request. Send another date or package.";
    case "CANCELLED":
      if (inquiry.decidedBy === "visitor") {
        return when
          ? `You cancelled this request on ${when}.`
          : "You cancelled this request.";
      }
      return when
        ? `The park office cancelled this request on ${when}.`
        : "The park office cancelled this request.";
    case "CONTACTED":
      return "The park office has replied — check your email for the details.";
    default:
      return "Pending admin review — once accepted and your first payment is checked, status moves to On Process.";
  }
}

type AccountTab = "bookings" | "payments" | "profile";
type BookingFilter =
  | "ALL"
  | "PENDING"
  | "ON_PROCESS"
  | "CONFIRMED"
  | "COMPLETED"
  | "ENDED";

const BOOKING_FILTERS: { value: BookingFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "ON_PROCESS", label: "On Process" },
  { value: "CONFIRMED", label: "Confirmed" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ENDED", label: "Cancelled / Declined" },
];

export default function AccountView() {
  const router = useRouter();
  const { user, ready } = useAuth();

  useEffect(() => {
    if (ready && !user) router.replace("/login?next=/account");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <section className="grid min-h-[70svh] place-items-center bg-sand-50">
        <p className="flex items-center gap-2 text-[13px] text-sand-600">
          <Loader2 className="size-4 animate-spin" strokeWidth={2} />
          {ready ? "Taking you to sign in…" : "Loading your account…"}
        </p>
      </section>
    );
  }

  return <AccountDashboard user={user} />;
}

function AccountDashboard({ user }: { user: SessionUser }) {
  const { updateProfile, changePassword, signOut } = useAuth();
  const [tab, setTab] = useState<AccountTab>("bookings");

  const [profile, setProfile] = useState({
    fullName: user.fullName,
    phone: user.phone,
    address: user.address ?? "",
    emergencyContact: user.emergencyContact ?? "",
  });
  const [profileStatus, setProfileStatus] = useState<"idle" | "saved">("idle");
  const [profileError, setProfileError] = useState<string | null>(null);

  const [passwords, setPasswords] = useState({
    current: "",
    next: "",
    confirm: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<"idle" | "saved">("idle");
  const [passwordPending, setPasswordPending] = useState(false);

  const allInquiries = useInquiries();
  const inquiries = useMemo(
    () =>
      allInquiries.filter(
        (inquiry) => inquiry.userEmail === user.email.trim().toLowerCase(),
      ),
    [allInquiries, user.email],
  );

  const [filter, setFilter] = useState<BookingFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedTimelineId, setExpandedTimelineId] = useState<string | null>(
    null,
  );
  const [openChatId, setOpenChatId] = useState<string | null>(null);
  const [messageDrafts, setMessageDrafts] = useState<Record<string, string>>({});
  const [sendingMessageId, setSendingMessageId] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [passModal, setPassModal] = useState<Inquiry | null>(null);
  const [receiptModal, setReceiptModal] = useState<{
    reference: string;
    url: string;
  } | null>(null);
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [payFormId, setPayFormId] = useState<string | null>(null);
  const [payDraft, setPayDraft] = useState({
    paymentMethod: "GCASH" as PaymentMethod,
    paymentReference: "",
    paymentAccountName: user.fullName,
    rate: 0.5 as 0.5 | 1,
  });
  const [payError, setPayError] = useState<string | null>(null);
  const [payPending, setPayPending] = useState(false);

  const stats = useMemo(() => {
    let pending = 0;
    let onProcess = 0;
    let confirmed = 0;
    let totalFirstPaid = 0;
    let verifiedCount = 0;
    let remainingBalances = 0;

    for (const item of inquiries) {
      if (item.status === "PENDING" || item.status === "CONTACTED") pending += 1;
      if (item.status === "ON_PROCESS") onProcess += 1;
      if (item.status === "CONFIRMED") confirmed += 1;

      const paid = item.firstPaymentAmount ?? 0;
      if (
        paid > 0 &&
        item.paymentStatus !== "UNPAID" &&
        item.paymentStatus !== "REFUNDED"
      ) {
        totalFirstPaid += paid;
      }
      if (item.paymentStatus === "VERIFIED") verifiedCount += 1;
      if (
        item.status !== "CANCELLED" &&
        item.status !== "DECLINED" &&
        item.status !== "COMPLETED"
      ) {
        remainingBalances += item.balanceAmount ?? 0;
      }
    }

    return {
      total: inquiries.length,
      pending,
      onProcess,
      confirmed,
      activeCount: pending + onProcess + confirmed,
      totalFirstPaid,
      verifiedCount,
      remainingBalances,
    };
  }, [inquiries]);

  const filteredInquiries = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    return inquiries.filter((item) => {
      const matchesStatus =
        filter === "ALL"
          ? true
          : filter === "ENDED"
            ? item.status === "CANCELLED" || item.status === "DECLINED"
            : item.status === filter;
      const matchesSearch =
        !needle ||
        item.reference.toLowerCase().includes(needle) ||
        item.tourTitle.toLowerCase().includes(needle) ||
        (item.paymentReference ?? "").toLowerCase().includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [inquiries, filter, searchQuery]);

  async function withdraw(inquiry: Inquiry) {
    setCancellingId(inquiry.id);
    setCancelError(null);

    try {
      const cancelled = await cancelInquiry(inquiry.id, user.email);
      setConfirmId(null);

      void fetch("/api/inquiries/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...cancelled,
          status: "CANCELLED",
          actor: "visitor",
        }),
        keepalive: true,
      }).catch(() => { });
    } catch (error) {
      setCancelError(
        error instanceof InquiryError
          ? error.message
          : "Could not cancel this request.",
      );
    } finally {
      setCancellingId(null);
    }
  }

  async function removeBooking(inquiry: Inquiry) {
    setDeletingId(inquiry.id);
    setDeleteError(null);

    try {
      await deleteInquiry(inquiry.id, user.email);
      setDeleteConfirmId(null);
      setConfirmId(null);
    } catch (error) {
      setDeleteError(
        error instanceof InquiryError
          ? error.message
          : "Could not delete this booking.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSubmitFirstPayment(
    inquiry: Inquiry,
    overrideReference?: string,
  ) {
    setPayError(null);
    const refToUse = (overrideReference ?? payDraft.paymentReference).trim();
    if (refToUse.length < 4) {
      setPayError(
        "Enter a valid reference number (at least 4 characters) or use Instant pay.",
      );
      return;
    }
    setPayPending(true);
    try {
      const ratePerPerson = inquiry.ratePerPerson ?? 0;
      const totalAmount =
        inquiry.totalAmount ?? ratePerPerson * inquiry.partySize;
      const firstPaymentAmount = Math.round(totalAmount * payDraft.rate);
      await submitFirstPayment(inquiry.id, user.email, {
        paymentMethod: payDraft.paymentMethod,
        paymentReference: refToUse,
        paymentAccountName: payDraft.paymentAccountName.trim() || user.fullName,
        firstPaymentRate: payDraft.rate,
        firstPaymentAmount,
        totalAmount,
        ratePerPerson,
      });
      setPayFormId(null);
      setPayDraft((d) => ({ ...d, paymentReference: "" }));
    } catch (error) {
      setPayError(
        error instanceof InquiryError
          ? error.message
          : "Could not submit first payment.",
      );
    } finally {
      setPayPending(false);
    }
  }

  function copyReference(ref: string) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(ref);
      setCopiedRef(ref);
      window.setTimeout(() => setCopiedRef(null), 1600);
    }
  }

  async function handleSendMessage(inquiry: Inquiry) {
    const draft = messageDrafts[inquiry.id] ?? "";
    setMessageError(null);
    setSendingMessageId(inquiry.id);
    try {
      await addInquiryMessage(inquiry.id, "visitor", user.fullName, draft);
      setMessageDrafts((current) => ({ ...current, [inquiry.id]: "" }));
    } catch (error) {
      setMessageError(
        error instanceof InquiryError
          ? error.message
          : "Could not send message.",
      );
    } finally {
      setSendingMessageId(null);
    }
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileError(null);
    setProfileStatus("idle");

    try {
      await updateProfile(profile);
      setProfileStatus("saved");
      window.setTimeout(() => setProfileStatus("idle"), 2600);
    } catch (error) {
      setProfileError(
        error instanceof AuthError
          ? error.message
          : "Could not save your profile.",
      );
    }
  }

  async function savePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordStatus("idle");

    if (passwords.next !== passwords.confirm) {
      setPasswordError("The new passwords do not match.");
      return;
    }

    setPasswordPending(true);
    try {
      await changePassword(passwords.current, passwords.next);
      setPasswords({ current: "", next: "", confirm: "" });
      setPasswordStatus("saved");
      window.setTimeout(() => setPasswordStatus("idle"), 2600);
    } catch (error) {
      setPasswordError(
        error instanceof AuthError
          ? error.message
          : "Could not change your password.",
      );
    } finally {
      setPasswordPending(false);
    }
  }

  return (
    <section className="bg-sand-50 pb-20">
      {/* Atmospheric Account Hero */}
      <div className="grain-overlay relative isolate overflow-hidden bg-lake-950 pt-28 pb-20 lg:pt-36 lg:pb-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(85%_70%_at_18%_0%,rgba(51,135,133,0.32),transparent_62%)]"
        />
        <div className="relative mx-auto w-full max-w-6xl px-5 sm:px-8 lg:px-12">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-4 sm:gap-5">
              <span
                aria-hidden="true"
                className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/10 font-display text-[20px] text-sand-50 ring-1 ring-white/20 backdrop-blur-sm sm:size-16 sm:text-[22px]"
              >
                {initials(user.fullName)}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.18em] text-reed-200 uppercase ring-1 ring-white/15">
                    <span className="size-1.5 rounded-full bg-moss-400" />
                    {user.role === "admin" ? "Park staff account" : "Verified visitor"}
                  </span>
                  <span className="text-[11.5px] text-sand-300/75">
                    Member since {formatDate(user.createdAt)}
                  </span>
                </div>
                <h1 className="mt-2 font-display text-[clamp(1.85rem,4vw,2.65rem)] leading-tight font-light text-sand-50">
                  Hello, {user.fullName.split(" ")[0]}.
                </h1>
                <p className="mt-1 text-[13px] text-sand-200/75">
                  {user.email}
                  {user.address ? ` · ${user.address}` : ""}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              {user.role === "admin" && (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-[12.5px] font-semibold text-sand-50 backdrop-blur-sm transition-colors hover:bg-white/18"
                >
                  <LayoutDashboard
                    className="size-3.5"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                  Admin panel
                </Link>
              )}
              <Link
                href="/inquire"
                className="inline-flex items-center gap-2 rounded-full bg-sand-50 px-5 py-2.5 text-[12.5px] font-semibold text-ink shadow-[0_10px_28px_-12px_rgba(0,0,0,0.5)] transition-colors hover:bg-white"
              >
                Book a trip
                <ArrowUpRight
                  className="size-3.5"
                  strokeWidth={2.2}
                  aria-hidden="true"
                />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-10 w-full max-w-6xl px-5 sm:px-8 lg:px-12">
        {/* Summary KPI Strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => {
              setTab("bookings");
              setFilter("ALL");
            }}
            className="surface-card group rounded-2xl p-5 text-left ring-1 ring-ink/10"
          >
            <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              <span className="size-2 rounded-full bg-ink/40 ring-4 ring-ink/10" />
              Total bookings
            </p>
            <p className="mt-3 font-display text-[32px] leading-none font-light text-ink tabular-nums">
              {stats.total}
            </p>
            <p className="mt-2.5 text-[11.5px] text-ink-soft/65 group-hover:text-lake-700 transition-colors">
              {stats.activeCount} active in tracker →
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("bookings");
              setFilter("PENDING");
            }}
            className="surface-card group rounded-2xl p-5 text-left ring-1 ring-ink/10"
          >
            <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              <span className="size-2 rounded-full bg-reed-400 ring-4 ring-reed-400/20" />
              Pending
            </p>
            <p className="mt-3 font-display text-[32px] leading-none font-light text-ink tabular-nums">
              {stats.pending}
            </p>
            <p className="mt-2.5 text-[11.5px] text-ink-soft/65 group-hover:text-lake-700 transition-colors">
              Awaiting admin acceptance →
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              setTab("bookings");
              setFilter("ON_PROCESS");
            }}
            className="surface-card group rounded-2xl p-5 text-left ring-1 ring-ink/10"
          >
            <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              <span className="size-2 rounded-full bg-lake-500 ring-4 ring-lake-500/15" />
              On Process &amp; Confirmed
            </p>
            <p className="mt-3 font-display text-[32px] leading-none font-light text-ink tabular-nums">
              {stats.onProcess + stats.confirmed}
            </p>
            <p className="mt-2.5 text-[11.5px] text-ink-soft/65 group-hover:text-lake-700 transition-colors">
              {stats.onProcess} on process · {stats.confirmed} confirmed →
            </p>
          </button>

          <button
            type="button"
            onClick={() => setTab("payments")}
            className="surface-card group rounded-2xl p-5 text-left ring-1 ring-ink/10"
          >
            <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
              <span className="size-2 rounded-full bg-moss-500 ring-4 ring-moss-500/15" />
              First payments sent
            </p>
            <p className="mt-3 font-display text-[32px] leading-none font-light text-ink tabular-nums">
              {peso.format(stats.totalFirstPaid)}
            </p>
            <p className="mt-2.5 text-[11.5px] text-ink-soft/65 group-hover:text-lake-700 transition-colors">
              {stats.verifiedCount} verified by park staff →
            </p>
          </button>
        </div>

        {/* Section Tabs */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div
            role="tablist"
            aria-label="Account sections"
            className="inline-flex flex-wrap gap-1.5 rounded-2xl bg-sand-200/75 p-1.5 ring-1 ring-ink/8"
          >
            {(
              [
                {
                  id: "bookings" as const,
                  label: "Bookings & Tracker",
                  icon: Ticket,
                  badge: stats.activeCount > 0 ? stats.activeCount : undefined,
                },
                {
                  id: "payments" as const,
                  label: "Payment Ledger",
                  icon: CreditCard,
                  badge: undefined,
                },
                {
                  id: "profile" as const,
                  label: "Profile & Security",
                  icon: UserRound,
                  badge: undefined,
                },
              ] as const
            ).map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.id)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[13px] font-semibold transition-all ${
                    active
                      ? "bg-white text-ink shadow-[0_6px_18px_-8px_rgba(12,26,23,0.35)] ring-1 ring-ink/8"
                      : "text-ink-soft/80 hover:bg-white/60 hover:text-ink"
                  }`}
                >
                  <item.icon
                    className={`size-3.5 ${active ? "text-lake-700" : "text-sand-600"}`}
                    strokeWidth={2}
                  />
                  {item.label}
                  {item.badge !== undefined && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 font-mono text-[10px] ${
                        active
                          ? "bg-lake-800 text-sand-50"
                          : "bg-white/80 text-lake-800"
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: Bookings & Live Tracker */}
        {tab === "bookings" && (() => {
          const spotlight =
            inquiries.find((b) => b.status === "CONFIRMED") ??
            inquiries.find((b) => b.status === "ON_PROCESS") ??
            inquiries.find((b) => b.status === "PENDING") ??
            null;
          const totalTripValue = inquiries
            .filter((b) => b.status !== "CANCELLED" && b.status !== "DECLINED")
            .reduce((sum, b) => sum + (b.totalAmount ?? 0), 0);
          const paidRatio =
            totalTripValue > 0
              ? Math.min(100, Math.round((stats.totalFirstPaid / totalTripValue) * 100))
              : 0;

          return (
            <div className="mt-6 space-y-6">
              {/* Featured Next Active Trip Spotlight */}
              {spotlight && (
                <div className="grain-overlay relative overflow-hidden rounded-3xl bg-gradient-to-br from-lake-950 via-lake-900 to-[#0d2e2c] p-6 text-sand-50 shadow-[0_24px_60px_-28px_rgba(8,33,31,0.7)] ring-1 ring-white/15 sm:p-7">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-20 right-0 size-72 rounded-full bg-reed-400/10 blur-3xl"
                  />
                  <div className="relative flex flex-wrap items-start justify-between gap-5">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/12 px-3 py-1 text-[10.5px] font-semibold tracking-[0.16em] text-reed-200 uppercase ring-1 ring-white/15 backdrop-blur-sm">
                          <span className="relative flex size-2">
                            <span className="absolute inline-flex size-full animate-ping rounded-full bg-reed-300 opacity-75" />
                            <span className="relative inline-flex size-2 rounded-full bg-reed-300" />
                          </span>
                          Active Trip Spotlight · {INQUIRY_STATUS_META[spotlight.status].label}
                        </span>
                        <span className="font-mono text-[12px] text-sand-300/85">
                          {spotlight.reference}
                        </span>
                      </div>
                      <h2 className="font-display text-[25px] leading-tight font-light text-sand-50 sm:text-[28px]">
                        {spotlight.tourTitle}
                      </h2>
                      <p className="text-[13px] text-sand-200/80">
                        {formatDate(`${spotlight.preferredDate}T00:00:00`)} ·{" "}
                        {spotlight.partySize}{" "}
                        {spotlight.partySize === 1 ? "guest" : "guests"} ·{" "}
                        <span className="text-reed-200 font-medium">
                          {statusSummary(spotlight)}
                        </span>
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      {(spotlight.status === "ON_PROCESS" ||
                        spotlight.status === "CONFIRMED") && (
                        <button
                          type="button"
                          onClick={() => setPassModal(spotlight)}
                          className="inline-flex items-center gap-2 rounded-full bg-sand-50 px-4 py-2 text-[12.5px] font-semibold text-ink shadow-md transition-colors hover:bg-white"
                        >
                          <Ticket className="size-3.5 text-lake-800" />
                          Open entry pass
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setMessageError(null);
                          setOpenChatId(spotlight.id);
                          setFilter("ALL");
                        }}
                        className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-2 text-[12.5px] font-semibold text-sand-50 backdrop-blur-sm transition-colors hover:bg-white/20"
                      >
                        <MessageSquareText className="size-3.5" />
                        Message Park Desk
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid items-start gap-6 lg:grid-cols-[1fr_310px]">
                <div className="space-y-5 min-w-0">
                  {/* Filters & Search */}
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 ring-1 ring-ink/8">
              <div
                role="group"
                aria-label="Filter bookings by status"
                className="flex flex-wrap gap-1.5"
              >
                {BOOKING_FILTERS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFilter(opt.value)}
                    aria-pressed={filter === opt.value}
                    className={`rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors ${filter === opt.value
                      ? "bg-lake-800 text-sand-50"
                      : "bg-sand-100/80 text-ink-soft hover:bg-sand-200 hover:text-ink"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-64">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-sand-500"
                  strokeWidth={2}
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search reference or package"
                  aria-label="Search bookings"
                  className="w-full rounded-full border border-ink/12 bg-sand-50/50 py-2 pr-3 pl-9 text-[13px] text-ink outline-none placeholder:text-sand-500 focus:border-lake-600 focus:bg-white focus:ring-3 focus:ring-lake-600/15"
                />
              </div>
            </div>

            {filteredInquiries.length === 0 ? (
              <div className="rounded-2xl bg-white p-10 text-center ring-1 ring-ink/8">
                <Ticket
                  className="mx-auto size-7 text-sand-400"
                  strokeWidth={1.6}
                />
                <h2 className="mt-3 font-display text-[21px] text-ink">
                  {inquiries.length === 0
                    ? "No travel bookings yet"
                    : "No bookings match your filter"}
                </h2>
                <p className="mx-auto mt-1.5 max-w-md text-[13px] leading-relaxed text-ink-soft/75">
                  {inquiries.length === 0
                    ? "Book a guided eco-tour with a first payment deposit to track it here from Pending to On Process and Confirmed."
                    : "Try switching status filters or clearing your search."}
                </p>
                {inquiries.length === 0 && (
                  <Link
                    href="/inquire"
                    className="mt-5 inline-flex items-center gap-2 rounded-full bg-lake-800 px-5 py-2.5 text-[13px] font-semibold text-sand-50 hover:bg-lake-700"
                  >
                    Plan your first trip
                    <ArrowRight className="size-4" strokeWidth={2} />
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredInquiries.map((inquiry) => {
                  const statusMeta = INQUIRY_STATUS_META[inquiry.status];
                  const paymentStatus = inquiry.paymentStatus ?? "UNPAID";
                  const paymentMeta = PAYMENT_STATUS_META[paymentStatus];
                  const stepIdx = trackerStepIndex(inquiry.status);
                  const confirming = confirmId === inquiry.id;
                  const cancelling = cancellingId === inquiry.id;
                  const deleteConfirming = deleteConfirmId === inquiry.id;
                  const deleting = deletingId === inquiry.id;
                  const showTimeline = expandedTimelineId === inquiry.id;
                  const showPayForm = payFormId === inquiry.id;
                  const lastMessage =
                    inquiry.messages && inquiry.messages.length > 0
                      ? inquiry.messages[inquiry.messages.length - 1]
                      : null;
                  const hasParkReply = lastMessage?.sender === "park";
                  const progressPct =
                    stepIdx < 0
                      ? 0
                      : Math.min(
                          100,
                          Math.round(
                            ((stepIdx + 1) / BOOKING_TRACKER_STEPS.length) * 100,
                          ),
                        );
                  const topBorderClass =
                    inquiry.status === "CONFIRMED" ||
                    inquiry.status === "COMPLETED"
                      ? "border-t-[3px] border-t-moss-600"
                      : inquiry.status === "ON_PROCESS" ||
                          inquiry.status === "CONTACTED"
                        ? "border-t-[3px] border-t-lake-600"
                        : inquiry.status === "DECLINED" ||
                            inquiry.status === "CANCELLED"
                          ? "border-t-[3px] border-t-sand-400"
                          : "border-t-[3px] border-t-reed-400";

                  return (
                    <article
                      key={inquiry.id}
                      className={`surface-card overflow-hidden rounded-2xl ring-1 ring-ink/10 ${topBorderClass}`}
                    >
                      {/* Top Header Bar */}
                      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink/8 px-5 py-4 sm:px-6">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[12px] font-medium text-lake-800">
                              {inquiry.reference}
                            </span>
                            <button
                              type="button"
                              onClick={() => copyReference(inquiry.reference)}
                              className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 text-[10.5px] font-medium text-sand-700 hover:bg-sand-200"
                              title="Copy booking reference"
                            >
                              {copiedRef === inquiry.reference ? (
                                <>
                                  <Check className="size-3 text-moss-700" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3" />
                                  Copy
                                </>
                              )}
                            </button>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] uppercase ring-1 ring-inset ${statusMeta.chip}`}
                            >
                              {statusMeta.label}
                            </span>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.08em] uppercase ring-1 ring-inset ${paymentMeta.chip}`}
                            >
                              {paymentMeta.label}
                            </span>
                          </div>

                          <h2 className="mt-2 font-display text-[21px] leading-tight text-ink">
                            {inquiry.tourTitle}
                          </h2>

                          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-ink-soft/75">
                            <span className="inline-flex items-center gap-1.5">
                              <CalendarDays className="size-3.5 text-lake-600" />
                              Departure: {formatDate(`${inquiry.preferredDate}T00:00:00`)}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Users className="size-3.5 text-lake-600" />
                              {inquiry.partySize}{" "}
                              {inquiry.partySize === 1 ? "guest" : "guests"}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <Clock3 className="size-3.5 text-sand-500" />
                              Booked {formatDate(inquiry.createdAt)}
                            </span>
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <p className="text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                            Total booking amount
                          </p>
                          <p className="mt-1 font-display text-[24px] leading-none text-ink">
                            {peso.format(inquiry.totalAmount ?? 0)}
                          </p>
                          {(inquiry.facilitationFee ?? 0) > 0 && (
                            <p className="mt-1 text-[11px] text-sand-600">
                              Incl. {peso.format(inquiry.facilitationFee ?? 0)} facilitation fee
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-5 p-5 sm:p-6">
                        {/* Visual Booking Tracker */}
                        {stepIdx >= 0 ? (
                          <div className="rounded-xl bg-sand-50/85 p-4 ring-1 ring-ink/8">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <p className="text-[10.5px] font-semibold tracking-[0.14em] text-sand-700 uppercase">
                                  Booking tracker
                                </p>
                                <span className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-lake-800 ring-1 ring-ink/10">
                                  {progressPct}%
                                </span>
                              </div>
                              <p className="text-[12px] font-medium text-lake-800">
                                {statusSummary(inquiry)}
                              </p>
                            </div>

                            {/* Connected progress bar */}
                            <div
                              className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-sand-200"
                              role="progressbar"
                              aria-valuenow={progressPct}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className={`h-full rounded-full transition-all duration-500 ${
                                  stepIdx >= 2 ? "bg-moss-600" : "bg-lake-700"
                                }`}
                                style={{ width: `${progressPct}%` }}
                              />
                            </div>

                            <ol className="mt-4 grid gap-3 sm:grid-cols-4">
                              {BOOKING_TRACKER_STEPS.map((step, index) => {
                                const done = index < stepIdx;
                                const current = index === stepIdx;
                                return (
                                  <li
                                    key={step.status}
                                    className={`relative rounded-xl p-3 ring-1 transition-colors ${current
                                      ? "bg-white ring-2 ring-lake-700"
                                      : done
                                        ? "bg-moss-50/70 ring-moss-600/20"
                                        : "bg-white/50 opacity-60 ring-ink/8"
                                      }`}
                                  >
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold ${done
                                          ? "bg-moss-600 text-white"
                                          : current
                                            ? "bg-lake-800 text-sand-50"
                                            : "bg-sand-200 text-sand-700"
                                          }`}
                                      >
                                        {done ? (
                                          <Check className="size-3.5" strokeWidth={2.5} />
                                        ) : (
                                          index + 1
                                        )}
                                      </span>
                                      <span className="text-[12.5px] font-semibold text-ink">
                                        {step.title}
                                      </span>
                                      {current && (
                                        <span className="ml-auto inline-flex size-2 rounded-full bg-lake-600" />
                                      )}
                                    </div>
                                    <p className="mt-1.5 text-[11px] leading-snug text-ink-soft/75">
                                      {step.subtitle}
                                    </p>
                                  </li>
                                );
                              })}
                            </ol>
                          </div>
                        ) : (
                          <div className="rounded-xl bg-alert-50/60 p-4 ring-1 ring-alert-500/20">
                            <p className="text-[12.5px] font-medium text-alert-700">
                              {statusSummary(inquiry)}
                            </p>
                          </div>
                        )}

                        {/* Staff Update / Admin Note */}
                        {inquiry.adminNote && (
                          <div className="flex items-start gap-2.5 rounded-xl bg-lake-50/70 px-4 py-3 ring-1 ring-lake-600/20">
                            <MessageSquareText
                              className="mt-0.5 size-4 shrink-0 text-lake-700"
                              strokeWidth={2}
                            />
                            <div>
                              <p className="text-[10.5px] font-semibold tracking-[0.12em] text-lake-800 uppercase">
                                Update from park office
                              </p>
                              <p className="mt-0.5 text-[13px] leading-relaxed text-ink">
                                {inquiry.adminNote}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* First Payment Summary */}
                        <div className="grid gap-4 rounded-xl border border-ink/8 bg-white p-4 sm:grid-cols-3">
                          <div>
                            <p className="text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                              First payment
                            </p>
                            <p className="mt-1 font-mono text-[15px] font-semibold text-moss-700">
                              {peso.format(inquiry.firstPaymentAmount ?? 0)}
                            </p>
                            {inquiry.paymentMethod && (
                              <p className="mt-0.5 text-[11.5px] text-ink-soft/75">
                                {PAYMENT_METHOD_META[inquiry.paymentMethod].label}
                                {inquiry.paymentReference
                                  ? ` · Ref ${inquiry.paymentReference}`
                                  : ""}
                              </p>
                            )}
                          </div>

                          <div>
                            <p className="text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                              Payment verification
                            </p>
                            <p className="mt-1 text-[13px] font-medium text-ink">
                              {paymentMeta.label}
                            </p>
                            <p className="mt-0.5 text-[11.5px] text-ink-soft/70">
                              {inquiry.paymentVerifiedAt
                                ? `Verified ${formatDate(inquiry.paymentVerifiedAt)}`
                                : paymentMeta.hint}
                            </p>
                          </div>

                          <div>
                            <p className="text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                              Balance due at jetty
                            </p>
                            <p className="mt-1 font-mono text-[15px] font-medium text-ink">
                              {peso.format(inquiry.balanceAmount ?? 0)}
                            </p>
                            {inquiry.paymentProofUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  setReceiptModal({
                                    reference: inquiry.reference,
                                    url: inquiry.paymentProofUrl!,
                                  })
                                }
                                className="mt-1 inline-flex items-center gap-1 text-[11.5px] font-semibold text-lake-700 hover:text-lake-900"
                              >
                                <Receipt className="size-3.5" />
                                View receipt
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Fallback: submit first payment if an older booking is UNPAID */}
                        {paymentStatus === "UNPAID" &&
                          canCancelInquiry(inquiry) && (
                            <div className="rounded-xl bg-reed-50/70 p-4 ring-1 ring-reed-600/25">
                              {!showPayForm ? (
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <p className="text-[12.5px] text-reed-900">
                                    No first payment recorded yet for this booking.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPayFormId(inquiry.id);
                                      setPayError(null);
                                    }}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-lake-800 px-3.5 py-1.5 text-[12px] font-semibold text-sand-50 hover:bg-lake-700"
                                  >
                                    <CreditCard className="size-3.5" />
                                    Submit first payment
                                  </button>
                                </div>
                              ) : (
                                <div className="space-y-3">
                                  <p className="text-[12.5px] font-semibold text-ink">
                                    Submit first payment deposit
                                  </p>
                                  {payError && (
                                    <p className="text-[12px] text-alert-700">
                                      {payError}
                                    </p>
                                  )}
                                  <div className="grid gap-3 sm:grid-cols-3">
                                    <select
                                      value={payDraft.paymentMethod}
                                      onChange={(e) =>
                                        setPayDraft((d) => ({
                                          ...d,
                                          paymentMethod: e.target
                                            .value as PaymentMethod,
                                        }))
                                      }
                                      aria-label="Payment channel"
                                      className="rounded-xl border border-ink/12 bg-white px-3 py-2 text-[13px] text-ink"
                                    >
                                      <option value="GCASH">GCash</option>
                                      <option value="MAYA">Maya</option>
                                      <option value="BANK_TRANSFER">
                                        Bank Transfer
                                      </option>
                                    </select>
                                    <input
                                      type="text"
                                      value={payDraft.paymentReference}
                                      onChange={(e) =>
                                        setPayDraft((d) => ({
                                          ...d,
                                          paymentReference: e.target.value,
                                        }))
                                      }
                                      placeholder="Reference number"
                                      className="rounded-xl border border-ink/12 bg-white px-3 py-2 text-[13px] text-ink"
                                    />
                                    <select
                                      value={payDraft.rate}
                                      onChange={(e) =>
                                        setPayDraft((d) => ({
                                          ...d,
                                          rate: Number(e.target.value) as 0.5 | 1,
                                        }))
                                      }
                                      aria-label="Deposit option"
                                      className="rounded-xl border border-ink/12 bg-white px-3 py-2 text-[13px] text-ink"
                                    >
                                      <option value={0.5}>
                                        50% Deposit (
                                        {peso.format(
                                          Math.round(
                                            (inquiry.totalAmount ?? 0) * 0.5,
                                          ),
                                        )}
                                        )
                                      </option>
                                      <option value={1}>
                                        100% Full (
                                        {peso.format(inquiry.totalAmount ?? 0)})
                                      </option>
                                    </select>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={payPending}
                                      onClick={() => {
                                        const prefix =
                                          payDraft.paymentMethod === "GCASH"
                                            ? "GC"
                                            : payDraft.paymentMethod === "MAYA"
                                              ? "MY"
                                              : "LBP";
                                        const instantRef = `${prefix}-${Math.floor(100_000_000 + Math.random() * 900_000_000)}`;
                                        void handleSubmitFirstPayment(
                                          inquiry,
                                          instantRef,
                                        );
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-full bg-moss-700 px-4 py-1.5 text-[12px] font-semibold text-white hover:bg-moss-800 disabled:opacity-60"
                                    >
                                      {payPending && (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      )}
                                      Instant pay now
                                    </button>
                                    <button
                                      type="button"
                                      disabled={payPending}
                                      onClick={() =>
                                        void handleSubmitFirstPayment(inquiry)
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-full bg-lake-800 px-4 py-1.5 text-[12px] font-semibold text-sand-50 hover:bg-lake-700 disabled:opacity-60"
                                    >
                                      {payPending && (
                                        <Loader2 className="size-3.5 animate-spin" />
                                      )}
                                      Save manual ref
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPayFormId(null)}
                                      className="rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-[12px] font-medium text-ink"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                        {/* Actions & Timeline Toggle */}
                        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/8 pt-3">
                          <div className="flex flex-wrap items-center gap-3.5">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTimelineId(
                                  showTimeline ? null : inquiry.id,
                                )
                              }
                              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-lake-700 hover:text-lake-900"
                            >
                              <History className="size-3.5" />
                              Tracking log ({inquiry.timeline?.length ?? 1})
                              {showTimeline ? (
                                <ChevronUp className="size-3.5" />
                              ) : (
                                <ChevronDown className="size-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setMessageError(null);
                                setOpenChatId(
                                  openChatId === inquiry.id ? null : inquiry.id,
                                );
                              }}
                              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink hover:text-lake-800"
                            >
                              <MessageSquareText className="size-3.5 text-lake-700" />
                              Messages ({inquiry.messages?.length ?? 0})
                              {hasParkReply && (
                                <span
                                  className="size-1.5 rounded-full bg-lake-600"
                                  title="New reply from park desk"
                                />
                              )}
                              {openChatId === inquiry.id ? (
                                <ChevronUp className="size-3.5" />
                              ) : (
                                <ChevronDown className="size-3.5" />
                              )}
                            </button>

                            {(inquiry.status === "ON_PROCESS" ||
                              inquiry.status === "CONFIRMED" ||
                              inquiry.status === "COMPLETED") && (
                              <button
                                type="button"
                                onClick={() => setPassModal(inquiry)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-lake-50 px-2.5 py-1 text-[11.5px] font-semibold text-lake-800 ring-1 ring-lake-600/20 hover:bg-lake-100"
                              >
                                <Ticket className="size-3.5" />
                                Booking pass
                              </button>
                            )}

                            <Link
                              href={`/tours/${inquiry.tourSlug}`}
                              className="inline-flex items-center gap-1 text-[12px] font-medium text-ink-soft/75 hover:text-ink"
                            >
                              Package details
                              <ArrowUpRight className="size-3" />
                            </Link>
                          </div>

                          <div className="flex flex-wrap items-center gap-3">
                            {canCancelInquiry(inquiry) && !confirming && (
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmId(inquiry.id);
                                  setDeleteConfirmId(null);
                                  setCancelError(null);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full border border-alert-500/30 bg-alert-50/70 px-3 py-1 text-[11.5px] font-semibold text-alert-700 transition-colors hover:bg-alert-100"
                              >
                                <Ban className="size-3.5" strokeWidth={2} />
                                Cancel booking
                              </button>
                            )}
                            {!deleteConfirming && (
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteConfirmId(inquiry.id);
                                  setConfirmId(null);
                                  setDeleteError(null);
                                }}
                                className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3 py-1 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-alert-500/40 hover:bg-alert-50 hover:text-alert-700"
                              >
                                <Trash2 className="size-3.5" strokeWidth={2} />
                                Delete
                              </button>
                            )}
                          </div>
                        </div>

                        {confirming && (
                          <div
                            role="group"
                            aria-label={`Cancel ${inquiry.reference}`}
                            className="rounded-xl bg-sand-50 p-3.5 ring-1 ring-ink/8"
                          >
                            <p className="text-[12.5px] leading-relaxed text-ink-soft/85">
                              Cancel this booking? The park office is notified
                              immediately so the boat slot is released.
                            </p>
                            <div className="mt-2.5 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void withdraw(inquiry)}
                                disabled={cancelling}
                                className="inline-flex items-center gap-1.5 rounded-full bg-alert-600 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-alert-700 disabled:opacity-60"
                              >
                                {cancelling && (
                                  <Loader2 className="size-3.5 animate-spin" />
                                )}
                                Yes, cancel booking
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setConfirmId(null);
                                  setCancelError(null);
                                }}
                                disabled={cancelling}
                                className="inline-flex items-center rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-sand-100"
                              >
                                Keep booking
                              </button>
                            </div>
                            {cancelError && (
                              <p
                                role="alert"
                                className="mt-2 flex items-center gap-1.5 text-[12px] text-alert-600"
                              >
                                <AlertCircle className="size-3.5" />
                                {cancelError}
                              </p>
                            )}
                          </div>
                        )}

                        {deleteConfirming && (
                          <div
                            role="group"
                            aria-label={`Delete ${inquiry.reference}`}
                            className="rounded-xl bg-alert-50/60 p-3.5 ring-1 ring-alert-500/25"
                          >
                            <p className="text-[12.5px] leading-relaxed text-ink">
                              Delete booking <strong>{inquiry.reference}</strong> permanently?
                              This removes it from your booking list and releases any held boat seats.
                            </p>
                            <div className="mt-2.5 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void removeBooking(inquiry)}
                                disabled={deleting}
                                className="inline-flex items-center gap-1.5 rounded-full bg-alert-700 px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-alert-800 disabled:opacity-60"
                              >
                                {deleting && (
                                  <Loader2 className="size-3.5 animate-spin" />
                                )}
                                Yes, delete permanently
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeleteConfirmId(null);
                                  setDeleteError(null);
                                }}
                                disabled={deleting}
                                className="inline-flex items-center rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-ink hover:bg-sand-100"
                              >
                                Keep booking
                              </button>
                            </div>
                            {deleteError && (
                              <p
                                role="alert"
                                className="mt-2 flex items-center gap-1.5 text-[12px] text-alert-700"
                              >
                                <AlertCircle className="size-3.5" />
                                {deleteError}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Expanded Tracking Timeline */}
                        {showTimeline && inquiry.timeline && (
                          <ol className="space-y-3 border-l-2 border-lake-200 pl-4">
                            {inquiry.timeline.map((event) => (
                              <li key={event.id} className="relative text-[12px]">
                                <span
                                  aria-hidden="true"
                                  className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-lake-600 ring-4 ring-white"
                                />
                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                  <p className="font-semibold text-ink">
                                    {event.label}
                                  </p>
                                  <p className="font-mono text-[11px] text-sand-600">
                                    {formatDateTime(event.at)}
                                  </p>
                                </div>
                                {event.note && (
                                  <p className="mt-0.5 text-ink-soft/80">
                                    {event.note}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ol>
                        )}

                        {/* Two-Way Park Correspondence Thread */}
                        {openChatId === inquiry.id && (
                          <div className="rounded-xl border border-ink/8 bg-sand-50/70 p-4 space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-[11px] font-semibold tracking-[0.14em] text-sand-700 uppercase">
                                Correspondence with Park Desk
                              </p>
                              <span className="text-[11px] text-ink-soft/65">
                                Ref {inquiry.reference}
                              </span>
                            </div>

                            {inquiry.messages && inquiry.messages.length > 0 ? (
                              <ul className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                                {inquiry.messages.map((msg) => {
                                  const isPark = msg.sender === "park";
                                  return (
                                    <li
                                      key={msg.id}
                                      className={`rounded-xl px-3.5 py-2.5 text-[12.5px] ${
                                        isPark
                                          ? "bg-white ring-1 ring-lake-600/20"
                                          : "bg-lake-800 text-sand-50 ml-4 sm:ml-10"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2 text-[10.5px]">
                                        <span
                                          className={`font-semibold ${
                                            isPark ? "text-lake-800" : "text-sand-200"
                                          }`}
                                        >
                                          {isPark ? msg.senderName : "You"}
                                        </span>
                                        <span
                                          className={`font-mono ${
                                            isPark ? "text-sand-600" : "text-sand-200/75"
                                          }`}
                                        >
                                          {formatDateTime(msg.at)}
                                        </span>
                                      </div>
                                      <p
                                        className={`mt-1 leading-relaxed ${
                                          isPark ? "text-ink" : "text-sand-50"
                                        }`}
                                      >
                                        {msg.body}
                                      </p>
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="text-[12.5px] text-ink-soft/70">
                                No messages yet. Send a question about boat boarding, weather, or gear.
                              </p>
                            )}

                            {messageError && (
                              <p className="text-[12px] text-alert-700">{messageError}</p>
                            )}

                            <div className="flex items-end gap-2">
                              <textarea
                                rows={2}
                                value={messageDrafts[inquiry.id] ?? ""}
                                onChange={(e) =>
                                  setMessageDrafts((current) => ({
                                    ...current,
                                    [inquiry.id]: e.target.value,
                                  }))
                                }
                                placeholder="Write a message to park staff…"
                                className="flex-1 resize-none rounded-xl border border-ink/12 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-lake-600 focus:ring-2 focus:ring-lake-600/15"
                              />
                              <button
                                type="button"
                                disabled={sendingMessageId === inquiry.id}
                                onClick={() => void handleSendMessage(inquiry)}
                                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-lake-800 px-3.5 text-[12px] font-semibold text-sand-50 hover:bg-lake-700 disabled:opacity-60"
                              >
                                {sendingMessageId === inquiry.id ? (
                                  <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                  <Send className="size-3.5" />
                                )}
                                Send
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
                </div>

                {/* Sticky Park & Financial Companion Rail */}
                <aside className="space-y-4 lg:sticky lg:top-24">
                  <div className="surface-card rounded-2xl p-5 ring-1 ring-ink/8">
                    <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                      <CreditCard className="size-3.5 text-lake-700" />
                      Deposit coverage meter
                    </p>
                    <div className="mt-3 flex items-baseline justify-between gap-2">
                      <p className="font-display text-[26px] font-light text-ink tabular-nums">
                        {peso.format(stats.totalFirstPaid)}
                      </p>
                      <span className="rounded-full bg-moss-50 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-moss-700 ring-1 ring-moss-600/20">
                        {paidRatio}% settled
                      </span>
                    </div>
                    <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-sand-200">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-lake-700 to-moss-600 transition-all duration-500"
                        style={{ width: `${paidRatio}%` }}
                      />
                    </div>
                    <div className="mt-3 flex justify-between text-[11.5px] text-ink-soft/75">
                      <span>Jetty balance</span>
                      <span className="font-mono font-semibold text-ink">
                        {peso.format(stats.remainingBalances)}
                      </span>
                    </div>
                  </div>

                  <div className="surface-card rounded-2xl p-5 ring-1 ring-ink/8 space-y-3">
                    <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                      <Compass className="size-3.5 text-lake-700" />
                      Park dispatch desk
                    </p>
                    <div className="space-y-2 text-[12.5px] text-ink-soft/85">
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 size-3.5 shrink-0 text-lake-700" />
                        <span>Brgy. Bambanin Jetty, Naujan, Oriental Mindoro</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Phone className="size-3.5 shrink-0 text-lake-700" />
                        <span className="font-mono">+63 917 555 0142</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-ink/8">
                      <Link
                        href="/advisories"
                        className="rounded-full bg-sand-100 px-3 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-sand-200"
                      >
                        Lake advisories
                      </Link>
                      <Link
                        href="/guidelines"
                        className="rounded-full bg-sand-100 px-3 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-sand-200"
                      >
                        Visitor rules
                      </Link>
                    </div>
                  </div>
                </aside>
              </div>
            </div>
          );
        })()}

        {/* Tab 2: Payment Ledger */}
        {tab === "payments" && (
          <div className="mt-6 space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                  Total first payments
                </p>
                <p className="mt-2 font-display text-[28px] font-light text-ink">
                  {peso.format(stats.totalFirstPaid)}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                  Verified deposits
                </p>
                <p className="mt-2 font-display text-[28px] font-light text-moss-700">
                  {stats.verifiedCount}
                </p>
              </div>
              <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                  Remaining jetty balance
                </p>
                <p className="mt-2 font-display text-[28px] font-light text-ink">
                  {peso.format(stats.remainingBalances)}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/10">
              <div className="border-b border-ink/8 px-5 py-4">
                <h2 className="font-display text-[19px] text-ink">
                  First payment history
                </h2>
                <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
                  Every deposit and remaining balance across your bookings
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] text-left">
                  <thead>
                    <tr className="border-b border-ink/8 text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                      <th className="px-5 py-3">Booking</th>
                      <th className="px-5 py-3">Channel &amp; Ref</th>
                      <th className="px-5 py-3 text-right">Total</th>
                      <th className="px-5 py-3 text-right">First Payment</th>
                      <th className="px-5 py-3 text-right">Balance</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink/6">
                    {inquiries.map((item) => {
                      const pMeta =
                        PAYMENT_STATUS_META[item.paymentStatus ?? "UNPAID"];
                      return (
                        <tr key={item.id} className="hover:bg-sand-50/60">
                          <td className="px-5 py-3.5">
                            <p className="font-mono text-[12px] text-lake-800">
                              {item.reference}
                            </p>
                            <p className="text-[12.5px] font-medium text-ink">
                              {item.tourTitle}
                            </p>
                          </td>
                          <td className="px-5 py-3.5 text-[12.5px] text-ink-soft">
                            {item.paymentMethod
                              ? PAYMENT_METHOD_META[item.paymentMethod].label
                              : "—"}
                            {item.paymentReference && (
                              <span className="block font-mono text-[11px] text-sand-600">
                                {item.paymentReference}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-[12.5px] text-ink">
                            {peso.format(item.totalAmount ?? 0)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-[12.5px] font-semibold text-moss-700">
                            {peso.format(item.firstPaymentAmount ?? 0)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-[12.5px] text-ink-soft">
                            {peso.format(item.balanceAmount ?? 0)}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${pMeta.chip}`}
                            >
                              {pMeta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {inquiries.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-5 py-10 text-center text-[13px] text-ink-soft/65"
                        >
                          No payment records yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Profile & Security */}
        {tab === "profile" && (
          <div className="mt-6 grid gap-6 lg:grid-cols-12">
            <div className="space-y-6 lg:col-span-8">
              <form
                onSubmit={saveProfile}
                className="rounded-2xl bg-white p-6 ring-1 ring-ink/10 sm:p-7"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-[21px] leading-tight text-ink">
                    Profile &amp; manifest details
                  </h2>
                  {profileStatus === "saved" && (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-moss-700">
                      <Check className="size-3.5" strokeWidth={2.4} />
                      Saved
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-ink-soft/70">
                  Prefilled into your bookings and used for park boat manifests.
                </p>

                <div className="mt-6 space-y-5">
                  <AuthField
                    id="fullName"
                    label="Full name"
                    value={profile.fullName}
                    onChange={(fullName) =>
                      setProfile((current) => ({ ...current, fullName }))
                    }
                    autoComplete="name"
                  />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label
                        htmlFor="accountEmail"
                        className="block text-[11px] font-semibold tracking-[0.14em] text-sand-700 uppercase"
                      >
                        Email
                      </label>
                      <input
                        id="accountEmail"
                        value={user.email}
                        readOnly
                        className="mt-2 w-full cursor-not-allowed rounded-xl border border-ink/10 bg-sand-100/70 px-4 py-3 text-[14.5px] text-ink-soft/70"
                      />
                      <p className="mt-1.5 text-[12px] text-sand-600">
                        Sign-in ID — cannot be changed here.
                      </p>
                    </div>
                    <AuthField
                      id="phone"
                      label="Mobile"
                      type="tel"
                      value={profile.phone}
                      onChange={(phone) =>
                        setProfile((current) => ({ ...current, phone }))
                      }
                      autoComplete="tel"
                      inputMode="tel"
                      required={false}
                    />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <AuthField
                      id="address"
                      label="City / Province"
                      value={profile.address}
                      onChange={(address) =>
                        setProfile((current) => ({ ...current, address }))
                      }
                      placeholder="e.g. Calapan City, Oriental Mindoro"
                      required={false}
                    />
                    <AuthField
                      id="emergencyContact"
                      label="Emergency contact"
                      value={profile.emergencyContact}
                      onChange={(emergencyContact) =>
                        setProfile((current) => ({
                          ...current,
                          emergencyContact,
                        }))
                      }
                      placeholder="Name & mobile number"
                      required={false}
                    />
                  </div>
                </div>

                {profileError && (
                  <p className="mt-4 flex items-center gap-2 text-[12.5px] text-alert-600">
                    <AlertCircle className="size-3.5" strokeWidth={2} />
                    {profileError}
                  </p>
                )}

                <button
                  type="submit"
                  className="mt-6 inline-flex items-center gap-2 rounded-full bg-lake-800 px-5 py-3 text-[13px] font-semibold text-sand-50 transition-colors hover:bg-lake-700"
                >
                  Save changes
                  <ArrowRight className="size-4" strokeWidth={2} />
                </button>
              </form>

              <form
                onSubmit={savePassword}
                className="rounded-2xl bg-white p-6 ring-1 ring-ink/10 sm:p-7"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-[21px] leading-tight text-ink">
                    Password
                  </h2>
                  {passwordStatus === "saved" && (
                    <span className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-moss-700">
                      <Check className="size-3.5" strokeWidth={2.4} />
                      Password updated
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-ink-soft/70">
                  The stored digest is replaced — nothing is ever saved in clear
                  text.
                </p>

                <div className="mt-6 space-y-5">
                  <AuthField
                    id="currentPassword"
                    label="Current password"
                    type="password"
                    value={passwords.current}
                    onChange={(current) =>
                      setPasswords((values) => ({ ...values, current }))
                    }
                    autoComplete="current-password"
                  />
                  <div className="grid gap-5 sm:grid-cols-2">
                    <AuthField
                      id="newPassword"
                      label="New password"
                      type="password"
                      value={passwords.next}
                      onChange={(next) =>
                        setPasswords((values) => ({ ...values, next }))
                      }
                      hint="8+ characters, with a letter and a number."
                      autoComplete="new-password"
                    />
                    <AuthField
                      id="confirmNewPassword"
                      label="Confirm new password"
                      type="password"
                      value={passwords.confirm}
                      onChange={(confirm) =>
                        setPasswords((values) => ({ ...values, confirm }))
                      }
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                {passwordError && (
                  <p className="mt-4 flex items-center gap-2 text-[12.5px] text-alert-600">
                    <AlertCircle className="size-3.5" strokeWidth={2} />
                    {passwordError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={passwordPending}
                  className="mt-6 inline-flex items-center gap-2 rounded-full border border-ink/15 px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:bg-sand-100 disabled:opacity-60"
                >
                  {passwordPending && (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                  )}
                  Update password
                </button>
              </form>
            </div>

            <aside className="space-y-6 lg:col-span-4">
              <div className="rounded-2xl bg-lake-950 p-6 text-sand-100">
                <p className="flex items-center gap-2 text-[10px] font-semibold tracking-[0.18em] text-sand-300/70 uppercase">
                  <ShieldCheck className="size-3.5" strokeWidth={2} />
                  Session
                </p>
                <p className="mt-4 font-display text-[22px] leading-tight text-sand-50">
                  {user.role === "admin" ? "Park administrator" : "Visitor"}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-sand-300/70">
                  {user.role === "admin"
                    ? "Full access to bookings, payment verification, and park CMS."
                    : "Book eco-tours with first payment and track Pending to On Process."}
                </p>
                <div className="mt-4 space-y-1 border-t border-white/10 pt-4 font-mono text-[11.5px] text-sand-300/65">
                  <p className="truncate">{user.email}</p>
                  {user.lastLoginAt && (
                    <p>Last sign-in: {formatDateTime(user.lastLoginAt)}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => signOut()}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/10 px-4 py-3 text-[13px] font-semibold text-sand-50 transition-colors hover:bg-white/15"
                >
                  <LogOut className="size-4" strokeWidth={2} />
                  Sign out
                </button>
              </div>
            </aside>
          </div>
        )}
      </div>

      {/* Receipt Preview Modal */}
      {receiptModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Receipt for ${receiptModal.reference}`}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-ink/10">
            <div className="flex items-center justify-between border-b border-ink/8 px-5 py-3.5">
              <p className="font-mono text-[12.5px] font-medium text-ink">
                Receipt · {receiptModal.reference}
              </p>
              <button
                type="button"
                onClick={() => setReceiptModal(null)}
                aria-label="Close receipt"
                className="grid size-8 place-items-center rounded-full hover:bg-sand-100"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="p-4">
              <Image
                src={receiptModal.url}
                alt={`Payment receipt for ${receiptModal.reference}`}
                width={520}
                height={520}
                unoptimized
                className="max-h-[70vh] w-full rounded-xl object-contain bg-sand-50"
              />
            </div>
          </div>
        </div>
      )}

      {/* Printable Booking Pass & Official Deposit Summary Modal */}
      {passModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Booking pass for ${passModal.reference}`}
          className="fixed inset-0 z-50 grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-ink/10">
            <div className="flex items-center justify-between border-b border-ink/8 bg-lake-950 px-6 py-4 text-sand-50">
              <div className="flex items-center gap-3.5">
                <BrandMark className="size-11 ring-white/25" />
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-sand-300 uppercase">
                    Naujan Lake National Park · Entry Pass
                  </p>
                  <p className="mt-0.5 font-mono text-[14px] font-semibold">
                    {passModal.reference}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPassModal(null)}
                aria-label="Close booking pass"
                className="grid size-8 place-items-center rounded-full bg-white/10 text-sand-100 hover:bg-white/20"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-display text-[22px] leading-tight text-ink">
                    {passModal.tourTitle}
                  </h3>
                  <p className="mt-1 text-[13px] text-ink-soft/80">
                    Lead guest: <strong className="text-ink">{passModal.fullName}</strong> ·{" "}
                    {passModal.partySize}{" "}
                    {passModal.partySize === 1 ? "guest" : "guests"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10.5px] font-semibold tracking-[0.12em] uppercase ring-1 ring-inset ${
                    INQUIRY_STATUS_META[passModal.status].chip
                  }`}
                >
                  {INQUIRY_STATUS_META[passModal.status].label}
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-xl bg-sand-50/90 p-4 text-[12.5px] ring-1 ring-ink/8">
                <div>
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                    Departure date
                  </dt>
                  <dd className="mt-1 font-medium text-ink">
                    {formatDate(`${passModal.preferredDate}T00:00:00`)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                    Payment status
                  </dt>
                  <dd className="mt-1 font-medium text-moss-700">
                    {PAYMENT_STATUS_META[passModal.paymentStatus ?? "UNPAID"].label}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                    First payment settled
                  </dt>
                  <dd className="mt-1 font-mono font-semibold text-moss-700">
                    {peso.format(passModal.firstPaymentAmount ?? 0)}
                    {passModal.paymentReference ? ` (${passModal.paymentReference})` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                    Balance due at jetty
                  </dt>
                  <dd className="mt-1 font-mono font-semibold text-ink">
                    {peso.format(passModal.balanceAmount ?? 0)}
                  </dd>
                </div>
              </dl>

              {passModal.adminNote && (
                <div className="rounded-xl bg-lake-50/70 px-4 py-3 text-[12.5px] text-lake-900 ring-1 ring-lake-600/20">
                  <p className="text-[10px] font-semibold tracking-[0.14em] uppercase text-lake-700">
                    Ranger Dispatch Note
                  </p>
                  <p className="mt-1">{passModal.adminNote}</p>
                </div>
              )}

              {/* Perforated Ticket Divider */}
              <div className="relative flex items-center py-1" aria-hidden="true">
                <span className="-ml-8 size-4 rounded-full bg-sand-200/80 ring-1 ring-ink/10" />
                <div className="flex-1 border-t-2 border-dashed border-sand-300" />
                <span className="-mr-8 size-4 rounded-full bg-sand-200/80 ring-1 ring-ink/10" />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 text-[12px] text-ink-soft/80">
                <div className="min-w-[200px] flex-1 space-y-1.5">
                  <p className="font-semibold text-ink">Park Jetty Check-in Checklist</p>
                  <p>• Present reference ({passModal.reference}) and a valid ID at the Naujan Park Office.</p>
                  <p>• Arrive at least 15 minutes before departure for ranger briefing and boat manifest.</p>
                  <p>• Remaining balance of {peso.format(passModal.balanceAmount ?? 0)} settles on arrival.</p>
                  {passModal.paymentStatus === "VERIFIED" && (
                    <span className="mt-1 inline-block rounded-full border border-moss-600/35 bg-moss-50 px-3 py-1 text-[10px] font-bold tracking-[0.14em] text-moss-800 uppercase">
                      Deposit Seal · VERIFIED
                    </span>
                  )}
                </div>
                <BookingQrPass inquiry={passModal} size={116} />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-ink/8 pt-4 print:hidden">
                <Link
                  href={buildVerifyPath(passModal)}
                  className="text-[12px] font-semibold text-lake-800 underline underline-offset-4 hover:text-lake-700"
                >
                  Open live dock verification link
                </Link>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-2 rounded-full bg-lake-800 px-5 py-2.5 text-[12.5px] font-semibold text-sand-50 hover:bg-lake-700"
                  >
                    <Printer className="size-4" />
                    Print pass / Save PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => setPassModal(null)}
                    className="rounded-full border border-ink/15 px-4 py-2.5 text-[12.5px] font-medium text-ink hover:bg-sand-100"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
