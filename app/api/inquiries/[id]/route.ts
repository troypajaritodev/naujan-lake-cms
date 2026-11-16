import { NextResponse } from "next/server";
import type { FirstPaymentSubmission, Inquiry } from "@/lib/inquiries-shared";
import { requireSession } from "@/lib/server-auth";
import {
  acceptServerInquiry,
  addServerInquiryMessage,
  deleteServerInquiry,
  getServerReservedBySlot,
  listServerInquiriesForSession,
  ServerInquiryError,
  setServerInquiryStatus,
  submitServerFirstPayment,
  updateServerInquiryAdminNote,
  updateServerInquiryPaymentStatus,
} from "@/lib/server-inquiries";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to update bookings." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
  }

  const action = typeof body.action === "string" ? body.action : "";

  try {
    let inquiry: Inquiry;

    switch (action) {
      case "accept":
        inquiry = await acceptServerInquiry(session, id, {
          note: typeof body.note === "string" ? body.note : undefined,
          verifyPayment:
            typeof body.verifyPayment === "boolean"
              ? body.verifyPayment
              : undefined,
        });
        break;

      case "status":
        inquiry = await setServerInquiryStatus(session, id, body.status, {
          note: typeof body.note === "string" ? body.note : undefined,
          paymentStatus: body.paymentStatus,
        });
        break;

      case "payment_status":
        inquiry = await updateServerInquiryPaymentStatus(
          session,
          id,
          body.paymentStatus,
          typeof body.note === "string" ? body.note : undefined,
        );
        break;

      case "admin_note":
        inquiry = await updateServerInquiryAdminNote(
          session,
          id,
          typeof body.adminNote === "string" ? body.adminNote : "",
        );
        break;

      case "first_payment":
        if (!body.payment || typeof body.payment !== "object") {
          throw new ServerInquiryError("Payment details are missing.", 400);
        }
        inquiry = await submitServerFirstPayment(
          session,
          id,
          body.payment as FirstPaymentSubmission,
        );
        break;

      case "message":
        inquiry = await addServerInquiryMessage(
          session,
          id,
          typeof body.body === "string" ? body.body : "",
        );
        break;

      default:
        return NextResponse.json(
          { error: "Unsupported booking update action." },
          { status: 400 },
        );
    }

    const [inquiries, reservedBySlot] = await Promise.all([
      listServerInquiriesForSession(session),
      getServerReservedBySlot(),
    ]);

    return NextResponse.json({
      ok: true,
      inquiry,
      inquiries,
      reservedBySlot,
    });
  } catch (err) {
    if (err instanceof ServerInquiryError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Could not update booking." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to remove a booking." },
      { status: 401 },
    );
  }

  const { id } = await context.params;

  try {
    const deleted = await deleteServerInquiry(session, id);
    const [inquiries, reservedBySlot] = await Promise.all([
      listServerInquiriesForSession(session),
      getServerReservedBySlot(),
    ]);

    return NextResponse.json({
      ok: true,
      deleted,
      inquiries,
      reservedBySlot,
    });
  } catch (err) {
    if (err instanceof ServerInquiryError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: "Could not delete booking." },
      { status: 500 },
    );
  }
}
