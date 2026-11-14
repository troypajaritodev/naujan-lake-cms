import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import {
  inquiryCancellationAlertEmail,
  inquiryCancelledEmail,
  inquiryConfirmedEmail,
  inquiryDeclinedEmail,
} from "@/lib/email-templates";
import type { InquiryActor, InquiryStatus } from "@/lib/inquiries";
import { parseInquiryPayload } from "@/lib/inquiry-payload";

/**
 * Emails the visitor (or the park, for a withdrawal) when a request changes
 * state. The status itself is stored in the browser alongside the inquiry, so
 * this route is the server-side half of an acceptance, decline or withdrawal:
 * the panel and the account page call it after the local write succeeds.
 *
 * Same abuse posture as the intake route: the demo has no server-side session
 * to check, so each client address is capped per window. Sends are best-effort
 * and never fail the status change they describe.
 */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 30;

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

const NOTIFIABLE_STATUSES: readonly InquiryStatus[] = [
  "CONFIRMED",
  "DECLINED",
  "CANCELLED",
];

function isNotifiableStatus(value: unknown): value is InquiryStatus {
  return (
    typeof value === "string" &&
    NOTIFIABLE_STATUSES.includes(value as InquiryStatus)
  );
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
  const status = payload.status;
  if (!inquiry || !isNotifiableStatus(status)) {
    return NextResponse.json(
      { error: "Incomplete status update." },
      { status: 400 },
    );
  }

  const actor: InquiryActor = payload.actor === "visitor" ? "visitor" : "park";

  let message;
  if (status === "CONFIRMED") {
    message = inquiryConfirmedEmail(inquiry);
  } else if (status === "DECLINED") {
    message = inquiryDeclinedEmail(inquiry);
  } else if (actor === "visitor") {
    message = inquiryCancellationAlertEmail(inquiry);
  } else {
    message = inquiryCancelledEmail(inquiry);
  }

  const email = await sendEmail(message);
  return NextResponse.json({ status, actor, email });
}
