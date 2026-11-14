/**
 * Validation for inquiry payloads posted to the notification routes.
 *
 * The inquiry itself is stored in the browser (the demo store), so the server
 * only ever sees a re-posted copy. Both the "new inquiry" and "status changed"
 * routes must agree on what a valid copy looks like — this module is that
 * agreement, so a field added to one flow cannot silently go unchecked in the
 * other.
 */

import type { Inquiry } from "@/lib/inquiries";
import { cleanEmail, cleanPhone, cleanText } from "@/lib/sanitize";

function asString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? cleanText(value, maxLength) : "";
}

export function parseInquiryPayload(
  payload: Record<string, unknown>,
): Inquiry | null {
  const email = cleanEmail(asString(payload.email, 254));
  const reference = asString(payload.reference, 32);
  const tourTitle = asString(payload.tourTitle, 160);
  const preferredDate = asString(payload.preferredDate, 10);
  const partySize = Number(payload.partySize);

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ||
    !reference ||
    !tourTitle ||
    !/^\d{4}-\d{2}-\d{2}$/.test(preferredDate) ||
    !Number.isInteger(partySize) ||
    partySize < 1 ||
    partySize > 60
  ) {
    return null;
  }

  return {
    id: asString(payload.id, 64) || reference,
    reference,
    userEmail: cleanEmail(asString(payload.userEmail, 254)) || email,
    fullName: asString(payload.fullName, 120) || "Visitor",
    email,
    phone: cleanPhone(asString(payload.phone, 32)),
    tourSlug: asString(payload.tourSlug, 120),
    tourTitle,
    preferredDate,
    partySize,
    message: asString(payload.message, 2000),
    status: "PENDING",
    createdAt: asString(payload.createdAt, 40) || new Date().toISOString(),
  };
}
