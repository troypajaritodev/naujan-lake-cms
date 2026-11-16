import { NextResponse } from "next/server";
import { isBoardableStatus } from "@/lib/inquiries-shared";
import { signPassToken, type PassTokenStatus } from "@/lib/pass-token";
import { requireSession } from "@/lib/server-auth";
import {
  getServerInquiryById,
  getServerInquiryByRef,
} from "@/lib/server-inquiries";

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to issue a boarding pass." },
      { status: 401 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const ref =
    typeof body.reference === "string"
      ? body.reference.trim()
      : typeof body.ref === "string"
        ? body.ref.trim()
        : "";

  const inquiry =
    (id ? await getServerInquiryById(id) : null) ??
    (ref ? await getServerInquiryByRef(ref) : null);

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
      { error: "You can only generate passes for your own bookings." },
      { status: 403 },
    );
  }

  if (!isBoardableStatus(inquiry.status)) {
    return NextResponse.json(
      {
        error:
          "Digital QR boarding passes are issued once the park accepts a booking.",
      },
      { status: 400 },
    );
  }

  const payLabel =
    inquiry.paymentStatus === "VERIFIED"
      ? "VERIFIED"
      : inquiry.paymentStatus === "PENDING_VERIFICATION"
        ? "PENDING"
        : "UNPAID";

  const token = await signPassToken({
    ref: inquiry.reference,
    guest: inquiry.fullName,
    tour: inquiry.tourTitle,
    date: inquiry.preferredDate,
    guests: inquiry.partySize,
    pay: payLabel,
    status: inquiry.status as PassTokenStatus,
  });

  return NextResponse.json({
    ok: true,
    token,
    verifyPath: `/verify?token=${encodeURIComponent(token)}`,
  });
}
