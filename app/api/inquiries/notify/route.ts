import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import {
  inquiryConfirmationEmail,
  inquiryNotificationEmail,
} from "@/lib/email-templates";
import { parseInquiryPayload } from "@/lib/inquiry-payload";

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

  const inquiry = parseInquiryPayload(payload);
  if (!inquiry) {
    return NextResponse.json(
      { error: "Incomplete inquiry." },
      { status: 400 },
    );
  }

  const [confirmation, notification] = await Promise.all([
    sendEmail(inquiryConfirmationEmail(inquiry)),
    sendEmail(inquiryNotificationEmail(inquiry)),
  ]);

  return NextResponse.json({ confirmation, notification });
}
