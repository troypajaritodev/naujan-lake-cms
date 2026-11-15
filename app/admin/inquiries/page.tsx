"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  Ban,
  BellRing,
  Check,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  Inbox,
  Loader2,
  MessageSquareText,
  QrCode,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import StatCard from "@/components/admin/stat-card";
import BookingQrPass, { buildVerifyPath } from "@/components/booking-qr-pass";
import { useAuth } from "@/components/auth-provider";
import { downloadCsv } from "@/lib/csv";
import {
  acceptInquiry,
  addInquiryMessage,
  canCancelInquiry,
  deleteInquiry,
  getReservedSeatsForDate,
  InquiryError,
  setInquiryStatus,
  updateInquiryAdminNote,
  updateInquiryPaymentStatus,
  useInquiries,
  type Inquiry,
  type InquiryStatus,
  type PaymentStatus,
} from "@/lib/inquiries";
import {
  INQUIRY_STATUS_META,
  INQUIRY_STATUS_ORDER,
  PAYMENT_METHOD_META,
  PAYMENT_STATUS_META,
} from "@/lib/inquiry-status";
import {
  bookingCountLabel,
  markInquiriesSeen,
  useInquiryAlerts,
} from "@/lib/inquiry-alerts";

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

function formatDay(iso: string) {
  const parsed = new Date(`${iso}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? "—" : dateFormat.format(parsed);
}

function formatStamp(iso?: string) {
  if (!iso) return null;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : dateFormat.format(parsed);
}

function formatDateTime(iso?: string) {
  if (!iso) return "—";
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? "—" : dateTimeFormat.format(parsed);
}

/** The line under the status chip: what happened, and when. */
function statusDetail(inquiry: Inquiry) {
  const at = formatStamp(inquiry.updatedAt);

  switch (inquiry.status) {
    case "ON_PROCESS":
      return at ? `Accepted · On Process (${at})` : INQUIRY_STATUS_META.ON_PROCESS.blurb;
    case "CONFIRMED":
      return at ? `Confirmed ${at}` : "Confirmed by the park office";
    case "COMPLETED":
      return at ? `Completed ${at}` : "Trip completed";
    case "DECLINED":
      return at ? `Declined ${at}` : INQUIRY_STATUS_META.DECLINED.blurb;
    case "CANCELLED":
      if (inquiry.decidedBy === "visitor") {
        return at ? `Withdrawn by visitor ${at}` : "Withdrawn by the visitor";
      }
      return at ? `Cancelled by park ${at}` : "Cancelled by the park office";
    case "CONTACTED":
      return at ? `Contacted ${at}` : INQUIRY_STATUS_META.CONTACTED.blurb;
    default:
      return INQUIRY_STATUS_META.PENDING.blurb;
  }
}

type EmailOutcome = { delivered: boolean; reason?: string };

/** Best-effort: the local status write already succeeded before this is called. */
async function sendStatusEmail(
  inquiry: Inquiry,
  status: InquiryStatus,
  actor: "park" | "visitor",
): Promise<EmailOutcome | null> {
  try {
    const response = await fetch("/api/inquiries/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...inquiry, status, actor }),
    });
    if (!response.ok) return null;

    const data = (await response.json()) as { email?: EmailOutcome };
    return data.email ?? null;
  } catch {
    return null;
  }
}

function emailFeedback(
  status: InquiryStatus,
  email: string,
  outcome: EmailOutcome | null,
) {
  const noun =
    status === "ON_PROCESS"
      ? "On Process update"
      : status === "CONFIRMED"
        ? "Booking confirmation"
        : status === "COMPLETED"
          ? "Trip completion notice"
          : status === "DECLINED"
            ? "Decline notice"
            : "Cancellation notice";

  if (!outcome) {
    return {
      tone: "warn" as const,
      text: `${INQUIRY_STATUS_META[status].label} saved, but the email could not be sent.`,
    };
  }

  if (outcome.delivered) {
    return { tone: "ok" as const, text: `${noun} emailed to ${email}.` };
  }

  if (outcome.reason === "demo") {
    return {
      tone: "ok" as const,
      text: `${INQUIRY_STATUS_META[status].label} saved (${noun} logged in demo console).`,
    };
  }

  return {
    tone: "warn" as const,
    text: `${INQUIRY_STATUS_META[status].label} saved, but the email could not be sent.`,
  };
}

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function arrivedAt(iso: string) {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return "";

  const elapsed = Date.now() - parsed;
  if (elapsed < 60_000) return "just now";

  for (const [unit, size] of RELATIVE_STEPS) {
    if (elapsed >= size) {
      return relativeFormat.format(-Math.floor(elapsed / size), unit);
    }
  }

  return "just now";
}

type PaymentFilter = "ALL" | "PENDING_VERIFICATION" | "VERIFIED" | "UNPAID";

export default function AdminInquiriesPage() {
  const { user: currentUser } = useAuth();
  const inquiries = useInquiries();
  const { unread, unreadIds, latestUnread } = useInquiryAlerts();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | InquiryStatus>("ALL");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("ALL");
  const [query, setQuery] = useState("");
  const [inspectId, setInspectId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteDirty, setNoteDirty] = useState(false);
  const [replyDraft, setReplyDraft] = useState("");
  const [replyPending, setReplyPending] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "ok" | "warn";
    text: string;
  } | null>(null);

  const inspected = useMemo(
    () => inquiries.find((entry) => entry.id === inspectId) ?? null,
    [inquiries, inspectId],
  );

  function openInspector(inquiry: Inquiry) {
    setInspectId(inquiry.id);
    setConfirmDeleteId(null);
    setNoteDraft(inquiry.adminNote ?? "");
    setNoteDirty(false);
    setReplyDraft("");
  }

  async function handleDeleteBooking(inquiry: Inquiry) {
    setPendingId(inquiry.id);
    setFeedback(null);
    try {
      await deleteInquiry(inquiry.id, inquiry.userEmail, { isAdmin: true });
      setConfirmDeleteId(null);
      if (inspectId === inquiry.id) setInspectId(null);
      setFeedback({
        tone: "ok",
        text: `Deleted booking ${inquiry.reference} (${inquiry.fullName}) from the queue.`,
      });
    } catch {
      setFeedback({
        tone: "warn",
        text: `Could not delete ${inquiry.reference}.`,
      });
    } finally {
      setPendingId(null);
    }
  }

  async function handleAcceptToOnProcess(inquiry: Inquiry, note?: string) {
    setPendingId(inquiry.id);
    setFeedback(null);
    try {
      const next = await acceptInquiry(inquiry.id, {
        note: note?.trim() ? note.trim() : undefined,
        verifyPayment: true,
      });
      const updated = next.find((entry) => entry.id === inquiry.id) ?? inquiry;
      const outcome = await sendStatusEmail(updated, "ON_PROCESS", "park");
      setFeedback(emailFeedback("ON_PROCESS", inquiry.email, outcome));
      if (inspectId === inquiry.id) {
        setNoteDraft(updated.adminNote ?? "");
        setNoteDirty(false);
      }
    } catch {
      setFeedback({
        tone: "warn",
        text: `Could not accept ${inquiry.reference}. Try again.`,
      });
    } finally {
      setPendingId(null);
    }
  }

  async function changeStatus(
    inquiry: Inquiry,
    status: InquiryStatus,
    note?: string,
  ) {
    if (inquiry.status === status && !note) return;

    setPendingId(inquiry.id);
    setFeedback(null);
    try {
      const next = await setInquiryStatus(inquiry.id, status, {
        actor: "park",
        ...(note !== undefined ? { note } : {}),
      });
      const updated = next.find((entry) => entry.id === inquiry.id) ?? inquiry;

      if (
        status === "ON_PROCESS" ||
        status === "CONFIRMED" ||
        status === "COMPLETED" ||
        status === "DECLINED" ||
        status === "CANCELLED"
      ) {
        const outcome = await sendStatusEmail(updated, status, "park");
        setFeedback(emailFeedback(status, inquiry.email, outcome));
      } else {
        setFeedback({
          tone: "ok",
          text: `${inquiry.reference} is now ${INQUIRY_STATUS_META[status].label.toLowerCase()}.`,
        });
      }
      if (inspectId === inquiry.id) {
        setNoteDraft(updated.adminNote ?? "");
        setNoteDirty(false);
      }
    } catch {
      setFeedback({
        tone: "warn",
        text: `Could not update ${inquiry.reference}. Try again.`,
      });
    } finally {
      setPendingId(null);
    }
  }

  async function handlePaymentUpdate(
    inquiry: Inquiry,
    paymentStatus: PaymentStatus,
  ) {
    setPendingId(inquiry.id);
    setFeedback(null);
    try {
      await updateInquiryPaymentStatus(inquiry.id, paymentStatus);
      setFeedback({
        tone: "ok",
        text: `Updated payment status for ${inquiry.reference} to ${PAYMENT_STATUS_META[paymentStatus].label}.`,
      });
    } catch {
      setFeedback({
        tone: "warn",
        text: `Could not update payment status for ${inquiry.reference}.`,
      });
    } finally {
      setPendingId(null);
    }
  }

  async function handleSaveNote(inquiry: Inquiry) {
    setPendingId(inquiry.id);
    setFeedback(null);
    try {
      await updateInquiryAdminNote(inquiry.id, noteDraft);
      setNoteDirty(false);
      setFeedback({
        tone: "ok",
        text: `Saved park update note on ${inquiry.reference}. Visible to the visitor in My Account.`,
      });
    } catch {
      setFeedback({
        tone: "warn",
        text: `Could not save note for ${inquiry.reference}.`,
      });
    } finally {
      setPendingId(null);
    }
  }

  async function handleSendReply(inquiry: Inquiry) {
    setReplyPending(true);
    setFeedback(null);
    try {
      await addInquiryMessage(
        inquiry.id,
        "park",
        currentUser?.fullName ? `${currentUser.fullName} (Park Desk)` : "Park Ranger Desk",
        replyDraft,
      );
      setReplyDraft("");
      setFeedback({
        tone: "ok",
        text: `Reply sent to ${inquiry.fullName} on ${inquiry.reference}.`,
      });
    } catch (error) {
      setFeedback({
        tone: "warn",
        text:
          error instanceof InquiryError
            ? error.message
            : `Could not send reply on ${inquiry.reference}.`,
      });
    } finally {
      setReplyPending(false);
    }
  }

  const stats = useMemo(() => {
    const counts = Object.fromEntries(
      INQUIRY_STATUS_ORDER.map((status) => [status, 0]),
    ) as Record<InquiryStatus, number>;

    let verifiedDeposits = 0;
    let pendingDeposits = 0;
    let pendingReviewCount = 0;

    for (const inquiry of inquiries) {
      counts[inquiry.status] += 1;
      const amt = inquiry.firstPaymentAmount ?? 0;
      if (inquiry.paymentStatus === "VERIFIED") {
        verifiedDeposits += amt;
      } else if (inquiry.paymentStatus === "PENDING_VERIFICATION") {
        pendingDeposits += amt;
        pendingReviewCount += 1;
      }
    }

    return {
      counts,
      total: inquiries.length,
      guests: inquiries.reduce((sum, inquiry) => sum + inquiry.partySize, 0),
      verifiedDeposits,
      pendingDeposits,
      pendingReviewCount,
    };
  }, [inquiries]);

  const byPackage = useMemo(() => {
    const groups = new Map<
      string,
      { title: string; count: number; guests: number; deposits: number }
    >();

    for (const inquiry of inquiries) {
      const entry = groups.get(inquiry.tourSlug) ?? {
        title: inquiry.tourTitle,
        count: 0,
        guests: 0,
        deposits: 0,
      };
      entry.count += 1;
      entry.guests += inquiry.partySize;
      if (inquiry.paymentStatus === "VERIFIED") {
        entry.deposits += inquiry.firstPaymentAmount ?? 0;
      }
      groups.set(inquiry.tourSlug, entry);
    }

    return [...groups.values()].sort((a, b) => b.count - a.count);
  }, [inquiries]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return inquiries.filter((item) => {
      const matchesStatus =
        statusFilter === "ALL" || item.status === statusFilter;
      const pStatus = item.paymentStatus ?? "UNPAID";
      const matchesPayment =
        paymentFilter === "ALL" || pStatus === paymentFilter;
      const matchesQuery =
        !needle ||
        item.reference.toLowerCase().includes(needle) ||
        item.fullName.toLowerCase().includes(needle) ||
        item.email.toLowerCase().includes(needle) ||
        item.tourTitle.toLowerCase().includes(needle) ||
        (item.paymentReference ?? "").toLowerCase().includes(needle);
      return matchesStatus && matchesPayment && matchesQuery;
    });
  }, [inquiries, statusFilter, paymentFilter, query]);

  function handleExportCsv() {
    downloadCsv(
      `naujan-bookings-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Reference",
        "Booking Status",
        "Payment Status",
        "Package",
        "Preferred Date",
        "Guests",
        "Lead Visitor",
        "Email",
        "Phone",
        "Total PHP",
        "First Payment PHP",
        "Balance Due PHP",
        "Payment Channel",
        "Payment Ref",
        "Submitted At",
      ],
      visible.map((item) => [
        item.reference,
        INQUIRY_STATUS_META[item.status].label,
        PAYMENT_STATUS_META[item.paymentStatus ?? "UNPAID"].label,
        item.tourTitle,
        item.preferredDate,
        item.partySize,
        item.fullName,
        item.email,
        item.phone,
        item.totalAmount ?? 0,
        item.firstPaymentAmount ?? 0,
        item.balanceAmount ?? 0,
        item.paymentMethod ? PAYMENT_METHOD_META[item.paymentMethod].label : "",
        item.paymentReference ?? "",
        item.createdAt,
      ]),
    );
  }

  return (
    <div className="space-y-6">
      {unread > 0 && (
        <section
          aria-labelledby="new-bookings-heading"
          className="relative overflow-hidden rounded-2xl bg-alert-50 p-5 pl-6 ring-1 ring-alert-500/30"
        >
          <span
            className="absolute inset-y-0 left-0 w-1.5 bg-alert-500"
            aria-hidden="true"
          />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <span className="relative mt-0.5 grid size-10 shrink-0 place-items-center rounded-full bg-alert-500/12 text-alert-600 ring-1 ring-alert-500/25">
                <BellRing className="size-[18px]" strokeWidth={2} aria-hidden="true" />
                <span
                  className="absolute -top-0.5 -right-0.5 flex size-2.5"
                  aria-hidden="true"
                >
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-alert-500/70" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-alert-500" />
                </span>
              </span>

              <div>
                <p className="text-[9.5px] font-semibold tracking-[0.18em] text-alert-700/80 uppercase">
                  New since your last visit
                </p>
                <h2
                  id="new-bookings-heading"
                  className="mt-1 font-display text-[20px] leading-tight text-ink"
                >
                  {bookingCountLabel(unread)} to review
                </h2>
                {latestUnread && (
                  <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-soft/85">
                    Latest from{" "}
                    <span className="font-semibold text-ink">
                      {latestUnread.fullName}
                    </span>{" "}
                    — {latestUnread.tourTitle}, {latestUnread.partySize}{" "}
                    {latestUnread.partySize === 1 ? "guest" : "guests"},{" "}
                    {arrivedAt(latestUnread.createdAt)}.
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => markInquiriesSeen()}
              className="inline-flex items-center gap-1.5 rounded-full bg-alert-500 px-3.5 py-2 text-[11.5px] font-semibold text-white transition-colors hover:bg-alert-600"
            >
              <Check className="size-3.5" strokeWidth={2.6} aria-hidden="true" />
              Mark all as seen
            </button>
          </div>
        </section>
      )}

      {feedback && (
        <p
          role="status"
          className={`flex items-start gap-2 rounded-xl px-4 py-3 text-[12.5px] ring-1 ring-inset ${
            feedback.tone === "ok"
              ? "bg-moss-50 text-moss-800 ring-moss-600/20"
              : "bg-alert-50 text-alert-700 ring-alert-500/20"
          }`}
        >
          {feedback.tone === "ok" ? (
            <Check className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
          ) : (
            <AlertCircle className="mt-0.5 size-4 shrink-0" strokeWidth={2} />
          )}
          {feedback.text}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="All bookings"
          value={stats.total}
          hint={`${stats.guests} guests requested in total`}
          tone="ink"
        />
        <StatCard
          label="Pending"
          value={stats.counts.PENDING}
          hint="Waiting to be accepted"
          tone="reed"
        />
        <StatCard
          label="On Process"
          value={stats.counts.ON_PROCESS}
          hint="Accepted · preparing boat & guide"
          tone="lake"
        />
        <StatCard
          label="Confirmed"
          value={stats.counts.CONFIRMED}
          hint={`${stats.counts.COMPLETED} completed trips`}
          tone="moss"
        />
        <StatCard
          label="Verified deposits"
          value={peso.format(stats.verifiedDeposits)}
          hint={
            stats.pendingReviewCount > 0
              ? `${peso.format(stats.pendingDeposits)} awaiting review (${stats.pendingReviewCount})`
              : "All submitted first payments reviewed"
          }
          tone="moss"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <section className="rounded-2xl bg-white p-5 ring-1 ring-ink/8 lg:col-span-5">
          <h2 className="font-display text-[19px] leading-tight text-ink">
            Bookings by status
          </h2>
          <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
            Share of the {stats.total} booking{stats.total === 1 ? "" : "s"} on
            file
          </p>

          <ul className="mt-5 space-y-3.5">
            {INQUIRY_STATUS_ORDER.map((status) => {
              const count = stats.counts[status];
              const percent = stats.total
                ? Math.round((count / stats.total) * 100)
                : 0;

              return (
                <li key={status}>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-[12.5px] font-medium text-ink">
                      {INQUIRY_STATUS_META[status].label}
                    </p>
                    <p className="font-mono text-[11.5px] text-ink-soft/70">
                      {count} · {percent}%
                    </p>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sand-200"
                    role="presentation"
                  >
                    <div
                      className={`h-full rounded-full ${INQUIRY_STATUS_META[status].bar}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8 lg:col-span-7">
          <div className="border-b border-ink/8 px-5 py-4">
            <h2 className="font-display text-[19px] leading-tight text-ink">
              Demand &amp; verified deposits by package
            </h2>
            <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
              Which tours visitors book most and deposits verified
            </p>
          </div>

          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-ink/8 text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                <th scope="col" className="px-5 py-2.5 font-semibold">
                  Package
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  Bookings
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  Guests
                </th>
                <th scope="col" className="px-5 py-2.5 text-right font-semibold">
                  Verified Deposits
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/6">
              {byPackage.map((row) => (
                <tr key={row.title}>
                  <td className="px-5 py-3 text-[13px] text-ink">{row.title}</td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-ink">
                    {row.count}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] text-ink-soft/75">
                    {row.guests}
                  </td>
                  <td className="px-5 py-3 text-right font-mono text-[12.5px] font-medium text-moss-700">
                    {peso.format(row.deposits)}
                  </td>
                </tr>
              ))}

              {byPackage.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-[13px] text-ink-soft/65"
                  >
                    No bookings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>

      {/* Bookings Management Queue */}
      <section className="overflow-hidden rounded-2xl bg-white ring-1 ring-ink/8">
        <div className="space-y-4 border-b border-ink/8 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-[19px] leading-tight text-ink">
                Booking &amp; payment queue
                {unread > 0 && (
                  <span className="rounded-full bg-alert-500 px-2 py-0.5 text-[9.5px] font-bold tracking-[0.1em] text-white uppercase">
                    {unread} new
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-[12.5px] text-ink-soft/65">
                {visible.length} of {stats.total} shown · Accepting moves a
                Pending booking to On Process and verifies its first payment
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-sand-500"
                  strokeWidth={2}
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search ref, guest, payment ref"
                  aria-label="Search bookings"
                  className="w-56 rounded-full border border-ink/12 bg-white py-2 pr-3 pl-9 text-[12.5px] text-ink outline-none placeholder:text-sand-400 focus:border-lake-600 focus:ring-3 focus:ring-lake-600/15"
                />
              </div>

              <div className="flex items-center gap-1.5 rounded-full border border-ink/12 bg-sand-50 px-3 py-1.5">
                <SlidersHorizontal className="size-3.5 text-sand-600" />
                <select
                  value={paymentFilter}
                  onChange={(e) =>
                    setPaymentFilter(e.target.value as PaymentFilter)
                  }
                  aria-label="Filter by payment status"
                  className="bg-transparent text-[12px] font-medium text-ink outline-none"
                >
                  <option value="ALL">All payments</option>
                  <option value="PENDING_VERIFICATION">For verification</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="UNPAID">Unpaid</option>
                </select>
              </div>

              <Link
                href="/verify"
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 py-2 text-[12px] font-semibold text-lake-800 transition-colors hover:bg-lake-50"
              >
                <QrCode className="size-3.5" />
                Verify QR Pass
              </Link>

              <button
                type="button"
                onClick={handleExportCsv}
                disabled={visible.length === 0}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink/12 bg-white px-3.5 py-2 text-[12px] font-semibold text-ink transition-colors hover:bg-sand-50 disabled:opacity-45"
              >
                <Download className="size-3.5 text-sand-600" />
                Export CSV
              </button>
            </div>
          </div>

          <div
            role="group"
            aria-label="Filter by booking status"
            className="flex flex-wrap gap-1.5"
          >
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              aria-pressed={statusFilter === "ALL"}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                statusFilter === "ALL"
                  ? "bg-lake-900 text-sand-50"
                  : "bg-sand-100 text-ink-soft hover:bg-sand-200"
              }`}
            >
              All ({stats.total})
            </button>
            {INQUIRY_STATUS_ORDER.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                aria-pressed={statusFilter === status}
                className={`rounded-full px-3 py-1.5 text-[11.5px] font-medium transition-colors ${
                  statusFilter === status
                    ? "bg-lake-900 text-sand-50"
                    : "bg-sand-100 text-ink-soft hover:bg-sand-200"
                }`}
              >
                {INQUIRY_STATUS_META[status].label} ({stats.counts[status]})
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr className="border-b border-ink/8 text-[10px] font-semibold tracking-[0.14em] text-sand-600 uppercase">
                <th scope="col" className="px-5 py-3 font-semibold">
                  Reference
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Guest
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Package &amp; Date
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  First Payment
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Status
                </th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink/6">
              {visible.map((inquiry) => {
                const isNew = unreadIds.has(inquiry.id);
                const pStatus = inquiry.paymentStatus ?? "UNPAID";
                const pMeta = PAYMENT_STATUS_META[pStatus];
                const busy = pendingId === inquiry.id;

                return (
                  <tr
                    key={inquiry.id}
                    className={
                      isNew
                        ? "bg-alert-50/70 transition-colors hover:bg-alert-50"
                        : "transition-colors hover:bg-sand-50/70"
                    }
                  >
                    <td className="px-5 py-3.5 font-mono text-[12px] text-ink-soft/80">
                      <span
                        className={
                          isNew
                            ? "border-l-2 border-alert-500 pl-2.5"
                            : undefined
                        }
                      >
                        {inquiry.reference}
                      </span>
                      {isNew && (
                        <span className="ml-2 inline-flex items-center rounded-full bg-alert-500 px-1.5 py-0.5 align-middle text-[8.5px] font-bold tracking-[0.1em] text-white uppercase">
                          New
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <span
                          aria-hidden="true"
                          className="grid size-8 shrink-0 place-items-center rounded-full bg-lake-100 font-mono text-[10.5px] font-semibold text-lake-800"
                        >
                          {inquiry.fullName
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((p) => p[0]?.toUpperCase() ?? "")
                            .join("")}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-ink">
                            {inquiry.fullName}
                          </p>
                          <p className="truncate text-[11.5px] text-ink-soft/60">
                            {inquiry.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-[12.5px] font-medium text-ink">
                        {inquiry.tourTitle}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-soft/65">
                        <span>
                          {formatDay(inquiry.preferredDate)} · {inquiry.partySize}{" "}
                          {inquiry.partySize === 1 ? "guest" : "guests"}
                        </span>
                        {inquiry.messages && inquiry.messages.length > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-lake-50 px-2 py-0.5 text-[10px] font-semibold text-lake-800 ring-1 ring-lake-600/20">
                            <MessageSquareText className="size-2.5" />
                            {inquiry.messages.length}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-[12.5px] font-semibold text-ink tabular-nums">
                        {peso.format(inquiry.firstPaymentAmount ?? 0)}
                        <span className="ml-1.5 font-sans text-[11px] font-normal text-sand-600">
                          / {peso.format(inquiry.totalAmount ?? 0)}
                        </span>
                      </p>
                      <div className="mt-1.5 h-1 w-28 overflow-hidden rounded-full bg-sand-200">
                        <div
                          className={`h-full rounded-full ${
                            pStatus === "VERIFIED" ? "bg-moss-600" : "bg-lake-600"
                          }`}
                          style={{
                            width: `${
                              (inquiry.totalAmount ?? 0) > 0
                                ? Math.min(
                                    100,
                                    Math.round(
                                      ((inquiry.firstPaymentAmount ?? 0) /
                                        (inquiry.totalAmount ?? 1)) *
                                        100,
                                    ),
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase ring-1 ring-inset ${pMeta.chip}`}
                        >
                          {pStatus === "VERIFIED"
                            ? "Verified"
                            : pStatus === "PENDING_VERIFICATION"
                              ? "For review"
                              : pStatus === "REFUNDED"
                                ? "Refunded"
                                : "Unpaid"}
                        </span>
                        {inquiry.paymentReference && (
                          <span className="font-mono text-[10.5px] text-sand-600">
                            {inquiry.paymentMethod
                              ? `${PAYMENT_METHOD_META[inquiry.paymentMethod].label} · `
                              : ""}
                            {inquiry.paymentReference}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={inquiry.status}
                        onChange={(event) => {
                          void changeStatus(
                            inquiry,
                            event.target.value as InquiryStatus,
                          );
                        }}
                        disabled={busy}
                        aria-label={`Status for ${inquiry.reference}`}
                        className={`cursor-pointer rounded-full border-0 px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.1em] uppercase ring-1 ring-inset outline-none disabled:cursor-wait disabled:opacity-60 ${INQUIRY_STATUS_META[inquiry.status].chip}`}
                      >
                        {INQUIRY_STATUS_ORDER.map((status) => (
                          <option key={status} value={status}>
                            {INQUIRY_STATUS_META[status].label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-[10.5px] text-ink-soft/60">
                        {statusDetail(inquiry)}
                      </p>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        {inquiry.status === "PENDING" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleAcceptToOnProcess(inquiry)}
                            className="inline-flex items-center gap-1 rounded-full bg-lake-800 px-3 py-1.5 text-[11px] font-semibold text-sand-50 transition-colors hover:bg-lake-700 disabled:opacity-60"
                          >
                            {busy ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="size-3" />
                            )}
                            Accept → On Process
                          </button>
                        )}
                        {inquiry.status === "ON_PROCESS" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void changeStatus(inquiry, "CONFIRMED")}
                            className="inline-flex items-center gap-1 rounded-full bg-moss-700 px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-moss-800 disabled:opacity-60"
                          >
                            Confirm ready
                          </button>
                        )}
                        {inquiry.status === "CONFIRMED" && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void changeStatus(inquiry, "COMPLETED")}
                            className="inline-flex items-center gap-1 rounded-full border border-moss-600/30 bg-moss-50 px-3 py-1.5 text-[11px] font-semibold text-moss-800 transition-colors hover:bg-moss-100 disabled:opacity-60"
                          >
                            Mark completed
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openInspector(inquiry)}
                          className="inline-flex items-center gap-1 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-ink transition-colors hover:bg-sand-100"
                        >
                          <Eye className="size-3" />
                          Manage
                        </button>
                        {confirmDeleteId === inquiry.id ? (
                          <div className="inline-flex items-center gap-1 rounded-full bg-alert-50 px-2 py-1 ring-1 ring-alert-500/25">
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleDeleteBooking(inquiry)}
                              className="rounded-full bg-alert-700 px-2 py-0.5 text-[10.5px] font-semibold text-white hover:bg-alert-800 disabled:opacity-60"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1 text-[10.5px] font-medium text-ink-soft hover:text-ink"
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(inquiry.id)}
                            aria-label={`Delete booking ${inquiry.reference}`}
                            title="Delete booking"
                            className="grid size-7 place-items-center rounded-full border border-ink/12 bg-white text-ink-soft/70 transition-colors hover:border-alert-500/35 hover:bg-alert-50 hover:text-alert-700"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center">
                    <Inbox
                      className="mx-auto size-6 text-sand-400"
                      strokeWidth={1.6}
                    />
                    <p className="mt-3 text-[13.5px] font-medium text-ink">
                      No matching bookings
                    </p>
                    <p className="mt-1 text-[12.5px] text-ink-soft/65">
                      Adjust your search or status filter.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Booking & Payment Inspector Modal */}
      {inspected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Manage booking ${inspected.reference}`}
          className="fixed inset-0 z-50 flex justify-end bg-ink/50 backdrop-blur-sm"
        >
          <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-sand-50 shadow-2xl">
            <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 bg-white/95 px-6 py-4 backdrop-blur-md">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-mono text-[11.5px] font-medium text-lake-700">
                    {inspected.reference}
                  </p>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold uppercase ring-1 ring-inset ${
                      INQUIRY_STATUS_META[inspected.status].chip
                    }`}
                  >
                    {INQUIRY_STATUS_META[inspected.status].label}
                  </span>
                </div>
                <h2 className="mt-0.5 truncate font-display text-[20px] text-ink">
                  {inspected.tourTitle}
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {inspected.status === "PENDING" && (
                  <button
                    type="button"
                    disabled={pendingId === inspected.id}
                    onClick={() => void handleAcceptToOnProcess(inspected, noteDraft)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-lake-800 px-3.5 py-1.5 text-[11.5px] font-semibold text-sand-50 hover:bg-lake-700 disabled:opacity-60"
                  >
                    Accept → On Process
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInspectId(null)}
                  aria-label="Close booking inspector"
                  className="grid size-9 place-items-center rounded-full border border-ink/12 hover:bg-sand-100"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="space-y-5 p-6">
              {/* Guest details */}
              <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                  Guest &amp; trip details
                </p>
                <dl className="mt-3 grid gap-3 text-[13px] sm:grid-cols-2">
                  <div>
                    <dt className="text-sand-600">Visitor</dt>
                    <dd className="font-medium text-ink">{inspected.fullName}</dd>
                  </div>
                  <div>
                    <dt className="text-sand-600">Email &amp; phone</dt>
                    <dd className="text-ink">{inspected.email}</dd>
                    {inspected.phone && (
                      <dd className="font-mono text-[12px] text-ink-soft">
                        {inspected.phone}
                      </dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-sand-600">Preferred departure</dt>
                    <dd className="font-medium text-ink">
                      {formatDay(inspected.preferredDate)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sand-600">Party size</dt>
                    <dd className="font-medium text-ink">
                      {inspected.partySize}{" "}
                      {inspected.partySize === 1 ? "guest" : "guests"}
                    </dd>
                    <dd className="mt-0.5 text-[11.5px] text-lake-800">
                      {getReservedSeatsForDate(
                        inquiries,
                        inspected.tourSlug,
                        inspected.preferredDate,
                      )}{" "}
                      total seats held on this date
                    </dd>
                  </div>
                </dl>
                {inspected.message && (
                  <div className="mt-3 rounded-xl bg-sand-50 p-3 text-[12.5px] text-ink-soft">
                    <span className="font-semibold text-ink">Guest note: </span>
                    {inspected.message}
                  </div>
                )}
              </div>

              {/* First Payment verification */}
              <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                    <CreditCard className="size-3.5 text-lake-700" />
                    First payment details
                  </p>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase ring-1 ring-inset ${
                      PAYMENT_STATUS_META[inspected.paymentStatus ?? "UNPAID"]
                        .chip
                    }`}
                  >
                    {
                      PAYMENT_STATUS_META[inspected.paymentStatus ?? "UNPAID"]
                        .label
                    }
                  </span>
                </div>

                <dl className="mt-3 grid gap-3 text-[13px] sm:grid-cols-3">
                  <div>
                    <dt className="text-sand-600">Total tariff</dt>
                    <dd className="font-mono font-medium text-ink">
                      {peso.format(inspected.totalAmount ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sand-600">First payment</dt>
                    <dd className="font-mono font-semibold text-moss-700">
                      {peso.format(inspected.firstPaymentAmount ?? 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-sand-600">Jetty balance</dt>
                    <dd className="font-mono text-ink">
                      {peso.format(inspected.balanceAmount ?? 0)}
                    </dd>
                  </div>
                </dl>

                {inspected.paymentReference && (
                  <div className="mt-3 rounded-xl bg-sand-50 p-3 text-[12.5px]">
                    <p className="text-ink">
                      <span className="font-semibold">
                        {inspected.paymentMethod
                          ? PAYMENT_METHOD_META[inspected.paymentMethod].label
                          : "Payment"}
                        :
                      </span>{" "}
                      <span className="font-mono">
                        {inspected.paymentReference}
                      </span>
                    </p>
                    {inspected.paymentAccountName && (
                      <p className="mt-0.5 text-ink-soft/75">
                        Sender: {inspected.paymentAccountName}
                      </p>
                    )}
                  </div>
                )}

                {inspected.paymentProofUrl && (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-semibold text-sand-600 uppercase">
                      Uploaded receipt
                    </p>
                    <Image
                      src={inspected.paymentProofUrl}
                      alt={`Payment receipt for ${inspected.reference}`}
                      width={420}
                      height={300}
                      unoptimized
                      className="max-h-56 w-full rounded-xl bg-sand-100 object-contain ring-1 ring-ink/10"
                    />
                  </div>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={
                      pendingId === inspected.id ||
                      inspected.paymentStatus === "VERIFIED"
                    }
                    onClick={() =>
                      void handlePaymentUpdate(inspected, "VERIFIED")
                    }
                    className="rounded-full bg-moss-700 px-3.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-moss-800 disabled:opacity-50"
                  >
                    Verify payment
                  </button>
                  <button
                    type="button"
                    disabled={
                      pendingId === inspected.id ||
                      inspected.paymentStatus === "PENDING_VERIFICATION"
                    }
                    onClick={() =>
                      void handlePaymentUpdate(
                        inspected,
                        "PENDING_VERIFICATION",
                      )
                    }
                    className="rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-sand-100 disabled:opacity-50"
                  >
                    Mark for review
                  </button>
                  <button
                    type="button"
                    disabled={
                      pendingId === inspected.id ||
                      inspected.paymentStatus === "REFUNDED"
                    }
                    onClick={() =>
                      void handlePaymentUpdate(inspected, "REFUNDED")
                    }
                    className="rounded-full border border-ink/15 bg-white px-3.5 py-1.5 text-[11.5px] font-semibold text-alert-700 hover:bg-alert-50 disabled:opacity-50"
                  >
                    Mark refunded
                  </button>
                </div>
              </div>

              {/* Staff update note & Status transition */}
              <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                <label
                  htmlFor="adminNote"
                  className="block text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase"
                >
                  Staff update note (visible in user&apos;s My Account)
                </label>
                <textarea
                  id="adminNote"
                  rows={3}
                  value={noteDraft}
                  onChange={(e) => {
                    setNoteDraft(e.target.value);
                    setNoteDirty(true);
                  }}
                  placeholder="e.g. Boat #2 & Guide Marco assigned. Preparing permit..."
                  className="mt-2 w-full rounded-xl border border-ink/12 bg-white px-3.5 py-2.5 text-[13px] text-ink outline-none focus:border-lake-600 focus:ring-3 focus:ring-lake-600/15"
                />
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={!noteDirty || pendingId === inspected.id}
                    onClick={() => void handleSaveNote(inspected)}
                    className="rounded-full border border-ink/15 px-3.5 py-1.5 text-[11.5px] font-semibold text-ink hover:bg-sand-100 disabled:opacity-45"
                  >
                    Save note only
                  </button>

                  <div className="flex flex-wrap gap-2">
                    {inspected.status !== "ON_PROCESS" && (
                      <button
                        type="button"
                        disabled={pendingId === inspected.id}
                        onClick={() =>
                          void handleAcceptToOnProcess(inspected, noteDraft)
                        }
                        className="rounded-full bg-lake-800 px-3.5 py-1.5 text-[11.5px] font-semibold text-sand-50 hover:bg-lake-700"
                      >
                        Accept → On Process
                      </button>
                    )}
                    {inspected.status !== "CONFIRMED" && (
                      <button
                        type="button"
                        disabled={pendingId === inspected.id}
                        onClick={() =>
                          void changeStatus(inspected, "CONFIRMED", noteDraft)
                        }
                        className="rounded-full bg-moss-700 px-3.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-moss-800"
                      >
                        Confirm ready
                      </button>
                    )}
                    {inspected.status !== "DECLINED" && (
                      <button
                        type="button"
                        disabled={pendingId === inspected.id}
                        onClick={() =>
                          void changeStatus(inspected, "DECLINED", noteDraft)
                        }
                        className="rounded-full bg-alert-50 px-3.5 py-1.5 text-[11.5px] font-semibold text-alert-700 ring-1 ring-alert-500/25 hover:bg-alert-100"
                      >
                        Decline
                      </button>
                    )}
                    {canCancelInquiry(inspected) && (
                      <button
                        type="button"
                        disabled={pendingId === inspected.id}
                        onClick={() =>
                          void changeStatus(inspected, "CANCELLED", noteDraft)
                        }
                        className="inline-flex items-center gap-1 rounded-full border border-alert-500/25 bg-white px-3.5 py-1.5 text-[11.5px] font-semibold text-alert-700 hover:bg-alert-50"
                      >
                        <Ban className="size-3" />
                        Cancel booking
                      </button>
                    )}
                  </div>
                </div>

                {/* Permanent delete inside inspector */}
                <div className="mt-4 border-t border-ink/8 pt-3.5">
                  {confirmDeleteId === inspected.id ? (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-alert-50/75 px-3.5 py-2.5 ring-1 ring-alert-500/25">
                      <span className="text-[12px] font-medium text-alert-800">
                        Permanently delete {inspected.reference}?
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          disabled={pendingId === inspected.id}
                          onClick={() => void handleDeleteBooking(inspected)}
                          className="rounded-full bg-alert-700 px-3 py-1 text-[11.5px] font-semibold text-white hover:bg-alert-800 disabled:opacity-60"
                        >
                          Yes, delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="rounded-full border border-ink/15 bg-white px-3 py-1 text-[11.5px] font-medium text-ink hover:bg-sand-100"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(inspected.id)}
                      className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-alert-700 hover:text-alert-800"
                    >
                      <Trash2 className="size-3.5" />
                      Delete booking record permanently
                    </button>
                  )}
                </div>
              </div>

              {/* Two-Way Visitor Correspondence */}
              <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/8 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                    <MessageSquareText className="size-3.5 text-lake-700" />
                    Visitor messages ({inspected.messages?.length ?? 0})
                  </p>
                </div>

                {inspected.messages && inspected.messages.length > 0 ? (
                  <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
                    {inspected.messages.map((msg) => {
                      const isPark = msg.sender === "park";
                      return (
                        <li
                          key={msg.id}
                          className={`rounded-xl px-3.5 py-2.5 text-[12.5px] ${
                            isPark
                              ? "ml-6 bg-lake-50/80 text-ink ring-1 ring-lake-600/20"
                              : "mr-6 bg-sand-50 text-ink ring-1 ring-ink/8"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10.5px]">
                            <span className="font-semibold text-ink">
                              {msg.senderName}
                            </span>
                            <span className="font-mono text-sand-600">
                              {formatDateTime(msg.at)}
                            </span>
                          </div>
                          <p className="mt-1 leading-relaxed text-ink-soft">
                            {msg.body}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-[12.5px] text-ink-soft/65">
                    No messages yet on this booking. Send a note directly to the visitor below.
                  </p>
                )}

                <div className="flex items-end gap-2 pt-1">
                  <textarea
                    rows={2}
                    value={replyDraft}
                    onChange={(e) => setReplyDraft(e.target.value)}
                    placeholder="Reply to visitor (visible in their My Account)…"
                    className="flex-1 resize-none rounded-xl border border-ink/12 bg-white px-3 py-2 text-[13px] text-ink outline-none focus:border-lake-600 focus:ring-2 focus:ring-lake-600/15"
                  />
                  <button
                    type="button"
                    disabled={replyPending || !replyDraft.trim()}
                    onClick={() => void handleSendReply(inspected)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-lake-800 px-3.5 text-[12px] font-semibold text-sand-50 hover:bg-lake-700 disabled:opacity-50"
                  >
                    {replyPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Send className="size-3.5" />
                    )}
                    Send
                  </button>
                </div>
              </div>

              {/* QR Entry Pass Verification */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                <div className="min-w-[200px] flex-1 space-y-1.5">
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                    Digital Boarding Pass
                  </p>
                  <p className="text-[13px] font-medium text-ink">
                    Dock check-in verification for {inspected.reference}
                  </p>
                  <p className="text-[12px] text-ink-soft/75">
                    Rangers can scan this code at the jetty or open the dock verifier directly.
                  </p>
                  <Link
                    href={buildVerifyPath(inspected)}
                    className="mt-1 inline-flex items-center gap-1.5 text-[12px] font-semibold text-lake-800 hover:underline"
                  >
                    <QrCode className="size-3.5" />
                    Open verifier view
                  </Link>
                </div>
                <BookingQrPass inquiry={inspected} size={108} showDownload={false} />
              </div>

              {/* Timeline */}
              {inspected.timeline && inspected.timeline.length > 0 && (
                <div className="rounded-2xl bg-white p-5 ring-1 ring-ink/8">
                  <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
                    Tracking timeline
                  </p>
                  <ol className="mt-4 space-y-3 border-l-2 border-lake-200 pl-4">
                    {inspected.timeline.map((event) => (
                      <li key={event.id} className="relative text-[12px]">
                        <span
                          aria-hidden="true"
                          className="absolute top-1.5 -left-[21px] size-2 rounded-full bg-lake-600 ring-4 ring-white"
                        />
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-semibold text-ink">
                            {event.label}
                          </span>
                          <span className="font-mono text-[11px] text-sand-600">
                            {formatDateTime(event.at)}
                          </span>
                        </div>
                        {event.note && (
                          <p className="mt-0.5 text-ink-soft/80">{event.note}</p>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
