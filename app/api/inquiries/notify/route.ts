import { NextResponse } from "next/server";

/**
 * Legacy endpoint retained for compatibility. Inquiry emails are now sent by
 * the server-side persistence action after a successful database insert.
 *
 * Abuse guard: the endpoint is unauthenticated by design (visitors are not
 * signed in when they book), so each client address is capped per window. The
 * map lives per server instance — it blunts accidental loops, not a botnet.
 */

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is no longer used. Submit inquiries through the inquiry form." },
    { status: 410 },
  );
}
