import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import {
  inquiryConfirmationEmail,
  inquiryNotificationEmail,
} from "@/lib/email-templates";
import type { Inquiry } from "@/lib/inquiries";
import { cleanEmail, cleanPhone, cleanText } from "@/lib/sanitize";

/**
 * Sends the two inquiry emails (FR-2.3). The inquiry itself is stored by the
 * demo store in the browser until the Supabase swap in Milestone 2, so this
 * route is the only server-side half of the flow.
 *
 * Abuse guard: the endpoint is unauthenticated by design (visitors are not
 * signed in when they book), so each client address is capped per window. The
 * map lives per server instance — it blunts accidental loops, not a botnet.
 */

const WINDOW_MS = 10 * 60 * 1000;
/**
 * A park kiosk can share one address with the whole queue, so this is a loose
 * cap: it stops a runaway loop without locking out a busy landing.
 */
const MAX_PER_WINDOW = 20;

const recentRequests = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const hits = (recentRequests.get(key) ?? []).filter(
    (at) => now - at < WINDOW_MS,
  );
  hits.push(now);
  recentRequests.set(key, hits);

  return hits.length > MAX_PER_WINDOW;
}

function asString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? cleanText(value, maxLength) : "";
}

export async function POST(request: Request) {
  const clientKey =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";

  if (isRateLimited(clientKey)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

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
    return NextResponse.json(
      { error: "Incomplete inquiry." },
      { status: 400 },
    );
  }

  const inquiry: Inquiry = {
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

  const [confirmation, notification] = await Promise.all([
    sendEmail(inquiryConfirmationEmail(inquiry)),
    sendEmail(inquiryNotificationEmail(inquiry)),
  ]);

  return NextResponse.json({ confirmation, notification });
}
