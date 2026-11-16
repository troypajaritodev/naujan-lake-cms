import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/email";
import {
  inquiryConfirmationEmail,
  inquiryNotificationEmail,
} from "@/lib/email-templates";
import { getServerSession, requireSession } from "@/lib/server-auth";
import {
  createServerInquiry,
  getServerReservedBySlot,
  listServerInquiriesForSession,
  ServerInquiryError,
} from "@/lib/server-inquiries";

export async function GET() {
  const [session, reservedBySlot] = await Promise.all([
    getServerSession(),
    getServerReservedBySlot(),
  ]);

  if (!session) {
    return NextResponse.json({
      inquiries: [],
      reservedBySlot,
      scope: "anonymous" as const,
    });
  }

  const inquiries = await listServerInquiriesForSession(session);
  return NextResponse.json({
    inquiries,
    reservedBySlot,
    scope: session.role === "admin" ? ("all" as const) : ("own" as const),
  });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to submit a booking request." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  try {
    const inquiry = await createServerInquiry(session, body);

    const [confirmation, notification] = await Promise.all([
      sendEmail(inquiryConfirmationEmail(inquiry)),
      sendEmail(inquiryNotificationEmail(inquiry)),
    ]);

    return NextResponse.json(
      {
        ok: true,
        inquiry,
        email: { confirmation, notification },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof ServerInquiryError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Could not save your booking request. Try again." },
      { status: 500 },
    );
  }
}
