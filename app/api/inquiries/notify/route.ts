import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import {
  inquiryConfirmationEmail,
  inquiryNotificationEmail,
} from "@/lib/email-templates";
import { requireSession } from "@/lib/server-auth";
import {
  getServerInquiryById,
  getServerInquiryByRef,
} from "@/lib/server-inquiries";

/**
 * Re-dispatches confirmation & park office alert emails for a persisted booking.
 * Gated by an authenticated session + record ownership so it cannot act as an
 * open email relay.
 */

const WINDOW_MS = 10 * 60 * 1000;
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
  const session = await requireSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to send booking notifications." },
      { status: 401 },
    );
  }

  const clientKey = `${session.id}:${
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local"
  }`;

  if (isRateLimited(clientKey)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  const id = typeof payload.id === "string" ? payload.id.trim() : "";
  const reference =
    typeof payload.reference === "string" ? payload.reference.trim() : "";

  const inquiry =
    (id ? await getServerInquiryById(id) : null) ??
    (reference ? await getServerInquiryByRef(reference) : null);

  if (!inquiry) {
    return NextResponse.json(
      { error: "Booking record was not found." },
      { status: 404 },
    );
  }

  if (
    session.role !== "admin" &&
    inquiry.userEmail !== session.email.toLowerCase()
  ) {
    return NextResponse.json(
      { error: "You can only trigger notifications for your own booking." },
      { status: 403 },
    );
  }

  const [confirmation, notification] = await Promise.all([
    sendEmail(inquiryConfirmationEmail(inquiry)),
    sendEmail(inquiryNotificationEmail(inquiry)),
  ]);

  return NextResponse.json({ confirmation, notification });
}
