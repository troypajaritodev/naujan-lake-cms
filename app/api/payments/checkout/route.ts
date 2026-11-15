import { NextResponse } from "next/server";
import type { PaymentMethod } from "@/lib/inquiries";
import { cleanEmail, cleanText } from "@/lib/sanitize";

type CheckoutRequest = {
  amount?: unknown;
  tourTitle?: unknown;
  paymentMethod?: unknown;
  customerEmail?: unknown;
  customerName?: unknown;
  origin?: unknown;
};

function paymongoPaymentTypes(method: PaymentMethod): string[] {
  switch (method) {
    case "GCASH":
      return ["gcash", "qrph"];
    case "MAYA":
      return ["paymaya", "qrph"];
    case "BANK_TRANSFER":
      return ["dob", "qrph", "card"];
    default:
      return ["gcash", "paymaya", "qrph", "card"];
  }
}

/**
 * Initiates a booking deposit checkout session.
 *
 * When `PAYMONGO_SECRET_KEY` is configured in the environment, this creates a
 * real PayMongo Checkout Session and returns `checkoutUrl` so the guest
 * authorizes via live GCash, Maya, QRPh, or Online Banking. Without a key, it
 * returns `{ mode: "sandbox" }` so the client launches its interactive gateway
 * authorization flow without dead-ending on static mock instructions.
 */
export async function POST(request: Request) {
  let body: CheckoutRequest;
  try {
    body = (await request.json()) as CheckoutRequest;
  } catch {
    return NextResponse.json({ error: "Expected JSON payload." }, { status: 400 });
  }

  const amountPhp = Math.round(Number(body.amount));
  if (!Number.isFinite(amountPhp) || amountPhp < 20) {
    return NextResponse.json(
      { error: "Minimum deposit amount is ₱20." },
      { status: 400 },
    );
  }

  const method = String(body.paymentMethod ?? "GCASH") as PaymentMethod;
  const tourTitle = cleanText(String(body.tourTitle ?? "Naujan Lake Tour"), 140);
  const customerName = cleanText(String(body.customerName ?? "Visitor"), 120);
  const customerEmail = cleanEmail(String(body.customerEmail ?? ""));
  const siteOrigin =
    cleanText(String(body.origin ?? ""), 240) ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "http://localhost:3000";

  const secretKey = process.env.PAYMONGO_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.json({
      ok: true,
      mode: "sandbox",
      method,
    });
  }

  const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;

  try {
    const response = await fetch("https://api.paymongo.com/v1/checkout_sessions", {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              name: customerName,
              ...(customerEmail ? { email: customerEmail } : {}),
            },
            send_email_receipt: Boolean(customerEmail),
            show_description: true,
            show_line_items: true,
            description: `Naujan Lake Eco-Tour First Payment · ${tourTitle}`,
            line_items: [
              {
                currency: "PHP",
                amount: amountPhp * 100,
                name: `${tourTitle} (First payment)`,
                quantity: 1,
              },
            ],
            payment_method_types: paymongoPaymentTypes(method),
            success_url: `${siteOrigin}/inquire?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${siteOrigin}/inquire?checkout=cancelled`,
          },
        },
      }),
    });

    const data = (await response.json()) as {
      data?: { id?: string; attributes?: { checkout_url?: string } };
      errors?: { detail?: string }[];
    };

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    const sessionId = data?.data?.id;

    if (!response.ok || !checkoutUrl || !sessionId) {
      return NextResponse.json(
        {
          error:
            data?.errors?.[0]?.detail ??
            "Could not initialize PayMongo checkout session.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "paymongo",
      checkoutUrl,
      sessionId,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to reach payment gateway right now." },
      { status: 502 },
    );
  }
}
