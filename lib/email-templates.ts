/**
 * Plain-text email bodies for the notification flows.
 *
 * Plain text on purpose: it renders in every client, survives the Resend
 * dashboard untouched, and keeps the templates small enough to audit.
 */

import type { AdvisoryPreview } from "@/lib/advisories";
import type { EmailMessage } from "@/lib/email";
import type { Inquiry } from "@/lib/inquiries";
import { siteUrl } from "@/lib/site-url";

const SITE_URL = siteUrl;

const PARK_NAME = "Naujan Lake National Park";

/** Where staff alerts land. Set PARK_NOTIFICATION_EMAIL to override. */
const PARK_INBOX =
  process.env.PARK_NOTIFICATION_EMAIL ?? "tours@naujanlake.gov.ph";

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "there";
}

function formatPhp(amount: number): string {
  return `PHP ${amount.toLocaleString("en-PH")}`;
}

function inquiryFacts(inquiry: Inquiry): string[] {
  const paymentLines: string[] = [];
  if (typeof inquiry.facilitationFee === "number" && inquiry.facilitationFee > 0) {
    if (typeof inquiry.packageSubtotal === "number" && inquiry.packageSubtotal > 0) {
      paymentLines.push(`Package tariff: ${formatPhp(inquiry.packageSubtotal)}`);
    }
    paymentLines.push(
      `Booking facilitation fee: ${formatPhp(inquiry.facilitationFee)}`,
    );
  }
  if (typeof inquiry.totalAmount === "number" && inquiry.totalAmount > 0) {
    paymentLines.push(`Total payable: ${formatPhp(inquiry.totalAmount)}`);
  }
  if (
    typeof inquiry.firstPaymentAmount === "number" &&
    inquiry.firstPaymentAmount > 0
  ) {
    paymentLines.push(
      `First payment: ${formatPhp(inquiry.firstPaymentAmount)}${
        inquiry.paymentMethod ? ` (${inquiry.paymentMethod})` : ""
      }${inquiry.paymentReference ? ` · Ref ${inquiry.paymentReference}` : ""}`,
    );
  }
  if (typeof inquiry.balanceAmount === "number") {
    paymentLines.push(`Balance on arrival: ${formatPhp(inquiry.balanceAmount)}`);
  }

  return [
    `Reference: ${inquiry.reference}`,
    `Package: ${inquiry.tourTitle}`,
    `Preferred date: ${inquiry.preferredDate}`,
    `Guests: ${inquiry.partySize}`,
    `Name: ${inquiry.fullName}`,
    `Email: ${inquiry.email}`,
    ...(inquiry.phone ? [`Phone: ${inquiry.phone}`] : []),
    ...paymentLines,
    ...(inquiry.message ? [`Message: ${inquiry.message}`] : []),
    ...(inquiry.adminNote ? [`Park note: ${inquiry.adminNote}`] : []),
  ];
}

/** Sent to the visitor as soon as the booking & first payment are filed. */
export function inquiryConfirmationEmail(inquiry: Inquiry): EmailMessage {
  return {
    to: inquiry.email,
    subject: `Booking received · ${inquiry.reference}`,
    replyTo: PARK_INBOX,
    text: [
      `Hello ${firstName(inquiry.fullName)},`,
      "",
      `We have received your booking and first payment submission for ${inquiry.tourTitle} on ${inquiry.preferredDate} for ${inquiry.partySize} guest${inquiry.partySize === 1 ? "" : "s"}.`,
      "",
      ...inquiryFacts(inquiry),
      "",
      "Status: Pending review. The park office will verify your first payment and move your booking to On Process once accepted.",
      `Track your booking status live in your account: ${SITE_URL}/account`,
      "",
      PARK_NAME,
      `${SITE_URL}/tours`,
    ].join("\n"),
  };
}

/** Sent to the park office so the queue is not only visible in the CMS. */
export function inquiryNotificationEmail(inquiry: Inquiry): EmailMessage {
  return {
    to: PARK_INBOX,
    replyTo: inquiry.email,
    subject: `New booking & first payment · ${inquiry.reference} · ${inquiry.tourTitle}`,
    text: [
      "A visitor filed a tour booking with first payment details.",
      "",
      ...inquiryFacts(inquiry),
      "",
      `Accept & verify in the admin queue: ${SITE_URL}/admin/inquiries`,
    ].join("\n"),
  };
}

/**
 * Sent to the visitor when the admin accepts the pending request and moves it
 * to On Process (boat, guide, and permit preparation).
 */
export function inquiryOnProcessEmail(inquiry: Inquiry): EmailMessage {
  return {
    to: inquiry.email,
    subject: `Booking accepted & on process · ${inquiry.reference}`,
    replyTo: PARK_INBOX,
    text: [
      `Hello ${firstName(inquiry.fullName)},`,
      "",
      `Your booking for ${inquiry.tourTitle} on ${inquiry.preferredDate} has been accepted by the park office and is now On Process.`,
      "",
      ...inquiryFacts(inquiry),
      "",
      "Our staff is now assigning your boat, licensed guide, and entry permit.",
      `Track your live progress in My Account: ${SITE_URL}/account`,
      "",
      PARK_NAME,
      `${SITE_URL}/tours`,
    ].join("\n"),
  };
}

/**
 * Sent to the visitor when the park confirms the booking is cleared for
 * departure.
 */
export function inquiryConfirmedEmail(inquiry: Inquiry): EmailMessage {
  return {
    to: inquiry.email,
    subject: `Booking confirmed · ${inquiry.reference}`,
    replyTo: PARK_INBOX,
    text: [
      `Hello ${firstName(inquiry.fullName)},`,
      "",
      `Good news — your booking for ${inquiry.tourTitle} on ${inquiry.preferredDate} for ${inquiry.partySize} guest${inquiry.partySize === 1 ? "" : "s"} is now Confirmed.`,
      "",
      ...inquiryFacts(inquiry),
      "",
      "Please arrive at the jump-off point 15 minutes before departure and bring this reference.",
      "Any remaining balance is settled at the park office before boarding.",
      "",
      `View your booking pass and tracker in My Account: ${SITE_URL}/account`,
      "",
      PARK_NAME,
      `${SITE_URL}/tours`,
    ].join("\n"),
  };
}

/** Sent when the trip is marked Completed by the park office. */
export function inquiryCompletedEmail(inquiry: Inquiry): EmailMessage {
  return {
    to: inquiry.email,
    subject: `Trip completed · ${inquiry.reference}`,
    replyTo: PARK_INBOX,
    text: [
      `Hello ${firstName(inquiry.fullName)},`,
      "",
      `Thank you for visiting ${PARK_NAME} for ${inquiry.tourTitle}. Your booking ${inquiry.reference} is now marked Completed.`,
      "",
      ...inquiryFacts(inquiry),
      "",
      `View your trip record in My Account: ${SITE_URL}/account`,
      "",
      PARK_NAME,
      `${SITE_URL}/tours`,
    ].join("\n"),
  };
}

/** Sent when the park cannot accommodate the requested date or party size. */
export function inquiryDeclinedEmail(inquiry: Inquiry): EmailMessage {
  return {
    to: inquiry.email,
    subject: `Update on your booking · ${inquiry.reference}`,
    replyTo: PARK_INBOX,
    text: [
      `Hello ${firstName(inquiry.fullName)},`,
      "",
      `The park office could not accommodate ${inquiry.tourTitle} on ${inquiry.preferredDate} for ${inquiry.partySize} guest${inquiry.partySize === 1 ? "" : "s"}.`,
      "",
      ...inquiryFacts(inquiry),
      "",
      "If you sent a first payment, the park office will coordinate your refund or transfer to another date.",
      `Send a new booking request: ${SITE_URL}/inquire`,
      "",
      PARK_NAME,
      `${SITE_URL}/tours`,
    ].join("\n"),
  };
}

/** Tells the visitor the park has cancelled a request it had on file. */
export function inquiryCancelledEmail(inquiry: Inquiry): EmailMessage {
  return {
    to: inquiry.email,
    subject: `Booking cancelled · ${inquiry.reference}`,
    replyTo: PARK_INBOX,
    text: [
      `Hello ${firstName(inquiry.fullName)},`,
      "",
      `The park office has cancelled the request for ${inquiry.tourTitle} on ${inquiry.preferredDate}.`,
      "",
      ...inquiryFacts(inquiry),
      "",
      "If this is unexpected, reply to this message and the staff will pick it up.",
      `You can send a new request here: ${SITE_URL}/inquire`,
      "",
      PARK_NAME,
      `${SITE_URL}/tours`,
    ].join("\n"),
  };
}

/**
 * Sent to the park office when a visitor withdraws their own request, so the
 * boat and guide are freed without staff having to watch the account page.
 */
export function inquiryCancellationAlertEmail(inquiry: Inquiry): EmailMessage {
  return {
    to: PARK_INBOX,
    replyTo: inquiry.email,
    subject: `Booking withdrawn · ${inquiry.reference} · ${inquiry.tourTitle}`,
    text: [
      "The visitor withdrew this booking request.",
      "",
      ...inquiryFacts(inquiry),
      "",
      `The slot is free again. Open the queue: ${SITE_URL}/admin/inquiries`,
    ].join("\n"),
  };
}

/** One message per subscriber when a CRITICAL advisory is published (FR-6.3). */
export function advisoryDigestEmail(
  to: string,
  advisory: AdvisoryPreview,
): EmailMessage {
  return {
    to,
    subject: `${advisory.severityLabel}: ${advisory.title}`,
    replyTo: PARK_INBOX,
    text: [
      `A ${advisory.severity.toLowerCase()} advisory is in force at ${PARK_NAME}.`,
      "",
      advisory.title,
      `Published ${advisory.date}.`,
      "",
      advisory.excerpt,
      "",
      `Read the full notice: ${SITE_URL}/advisories/${advisory.slug}`,
      "",
      `You are receiving this because you subscribed to park advisories. Manage your subscription: ${SITE_URL}/subscribe`,
    ].join("\n"),
  };
}
