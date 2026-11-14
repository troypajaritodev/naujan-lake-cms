/**
 * Plain-text email bodies for the two notification flows.
 *
 * Plain text on purpose: it renders in every client, survives the Resend
 * dashboard untouched, and keeps the templates small enough to audit. HTML can
 * be layered on later without changing the callers.
 */

import type { AdvisoryPreview } from "@/lib/advisories";
import type { EmailMessage } from "@/lib/email";
import type { Inquiry } from "@/lib/inquiries";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
).replace(/\/$/, "");

const PARK_NAME = "Naujan Lake National Park";

/** Where staff alerts land. Set PARK_NOTIFICATION_EMAIL to override. */
const PARK_INBOX =
  process.env.PARK_NOTIFICATION_EMAIL ?? "tours@naujanlake.gov.ph";

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || "there";
}

function inquiryFacts(inquiry: Inquiry): string[] {
  return [
    `Reference: ${inquiry.reference}`,
    `Package: ${inquiry.tourTitle}`,
    `Preferred date: ${inquiry.preferredDate}`,
    `Guests: ${inquiry.partySize}`,
    `Name: ${inquiry.fullName}`,
    `Email: ${inquiry.email}`,
    ...(inquiry.phone ? [`Phone: ${inquiry.phone}`] : []),
    ...(inquiry.message ? [`Message: ${inquiry.message}`] : []),
  ];
}

/** Sent to the visitor as soon as the inquiry is filed (FR-2.3). */
export function inquiryConfirmationEmail(inquiry: Inquiry): EmailMessage {
  return {
    to: inquiry.email,
    subject: `Inquiry received · ${inquiry.reference}`,
    replyTo: PARK_INBOX,
    text: [
      `Hello ${firstName(inquiry.fullName)},`,
      "",
      `We have your booking inquiry for ${inquiry.tourTitle} on ${inquiry.preferredDate} for ${inquiry.partySize} guest${inquiry.partySize === 1 ? "" : "s"}.`,
      "",
      ...inquiryFacts(inquiry),
      "",
      "The park office replies within two working days to confirm the guides and the boat.",
      "Nothing is paid online — the tariff is settled at the jetty on the day.",
      "",
      `If the date no longer works, reply to this message or write to ${PARK_INBOX}.`,
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
    subject: `New booking inquiry · ${inquiry.reference} · ${inquiry.tourTitle}`,
    text: [
      "A visitor filed a booking inquiry.",
      "",
      ...inquiryFacts(inquiry),
      "",
      `Triage it in the admin queue: ${SITE_URL}/admin/inquiries`,
    ].join("\n"),
  };
}

/**
 * Sent to the visitor when the park accepts the request. This is the "yes"
 * that turns an inquiry into a booking, so it repeats the reference, date and
 * party size they need at the jetty.
 */
export function inquiryConfirmedEmail(inquiry: Inquiry): EmailMessage {
  return {
    to: inquiry.email,
    subject: `Booking confirmed · ${inquiry.reference}`,
    replyTo: PARK_INBOX,
    text: [
      `Hello ${firstName(inquiry.fullName)},`,
      "",
      `Good news — the park office has confirmed your booking for ${inquiry.tourTitle} on ${inquiry.preferredDate} for ${inquiry.partySize} guest${inquiry.partySize === 1 ? "" : "s"}.`,
      "",
      ...inquiryFacts(inquiry),
      "",
      "Please arrive at the jump-off point 15 minutes before departure and bring this reference.",
      "Nothing is paid online — the tariff is settled at the jetty on the day.",
      "",
      `If your plans change, withdraw the request from your account: ${SITE_URL}/account`,
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
    subject: `Update on your inquiry · ${inquiry.reference}`,
    replyTo: PARK_INBOX,
    text: [
      `Hello ${firstName(inquiry.fullName)},`,
      "",
      `The park office could not accommodate ${inquiry.tourTitle} on ${inquiry.preferredDate} for ${inquiry.partySize} guest${inquiry.partySize === 1 ? "" : "s"}.`,
      "",
      ...inquiryFacts(inquiry),
      "",
      "No payment has been taken. Reply to this message to ask about another date, or send a fresh request:",
      `${SITE_URL}/inquire`,
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
    subject: `Inquiry cancelled · ${inquiry.reference}`,
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
    subject: `Inquiry withdrawn · ${inquiry.reference} · ${inquiry.tourTitle}`,
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
