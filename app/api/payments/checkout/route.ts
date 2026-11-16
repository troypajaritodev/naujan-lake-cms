import { NextResponse } from "next/server";
import type { PaymentMethod } from "@/lib/inquiries";
import { cleanEmail, cleanText } from "@/lib/sanitize";
import { requireSession } from "@/lib/server-auth";
import { siteUrl } from "@/lib/site-url";

type CheckoutRequest = {
  amount?: unknown;
  tourTitle?: unknown;
  paymentMethod?: unknown;
  customerEmail?: unknown;
  customerName?: unknown;
  origin?: unknown;
};

const DEV_LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Only allows loopback `http://localhost[:port]` or `http://127.0.0.1[:port]`
 * origins outside production so non-default dev ports still redirect cleanly
 * without ever trusting arbitrary client-supplied origins.
 */
function isAllowedDevOrigin(candidate: string): string | null {
  if (!candidate || process.env.NODE_ENV === "production") return null;

  try {
    const parsed = new URL(candidate);
    if (
      parsed.protocol === "http:" &&
      !parsed.username &&
      !parsed.password &&
      DEV_LOCALHOST_HOSTS.has(parsed.hostname)
    ) {
      return parsed.origin;
    }
  } catch {
    return null;
  }

  return null;
}

/**
 * Resolves the canonical origin for PayMongo `success_url` / `cancel_url`.
 * Prefers server-configured deployment URLs and never accepts untrusted
 * client `origin` values.
 */
function resolveCheckoutOrigin(clientOrigin: unknown): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();

  if (configured) {
    return siteUrl;
  }

  const rawOrigin =
    typeof clientOrigin === "string" ? cleanText(clientOrigin, 240) : "";
  return isAllowedDevOrigin(rawOrigin) ?? siteUrl;
}

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
  const session = await requireSession();
  if (!session) {
    return NextResponse.json(
      { error: "Sign in to initialize a payment checkout." },
      { status: 401 },
    );
  }

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

  const rawMethod = String(body.paymentMethod ?? "GCASH");
  const method: PaymentMethod =
    rawMethod === "GCASH" || rawMethod === "MAYA" || rawMethod === "BANK_TRANSFER"
      ? rawMethod
      : "GCASH";
  const tourTitle = cleanText(String(body.tourTitle ?? "Naujan Lake Tour"), 140);
  const customerName = cleanText(String(body.customerName ?? "Visitor"), 120);
  const customerEmail = cleanEmail(String(body.customerEmail ?? ""));
  const siteOrigin = resolveCheckoutOrigin(body.origin);

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
            metadata: {
              user_email: session.email.toLowerCase(),
              tour_title: tourTitle,
            },
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
