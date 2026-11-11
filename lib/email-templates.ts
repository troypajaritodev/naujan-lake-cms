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
