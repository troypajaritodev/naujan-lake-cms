import { NextResponse } from "next/server";
import { cleanText } from "@/lib/sanitize";
import { requireSession } from "@/lib/server-auth";

/**
 * Verifies a returning PayMongo checkout session after the visitor comes back
 * from `/inquire?checkout=success&session_id=...`.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json(
      { paid: false, error: "Sign in to verify a payment session." },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const sessionId = cleanText(searchParams.get("session_id") ?? "", 120);
  if (!sessionId) {
    return NextResponse.json({ error: "Missing session_id." }, { status: 400 });
  }

  const secretKey = process.env.PAYMONGO_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.json(
      { error: "PayMongo gateway is not configured on this server." },
      { status: 503 },
    );
  }

  const authHeader = `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;

  try {
    const response = await fetch(
      `https://api.paymongo.com/v1/checkout_sessions/${encodeURIComponent(sessionId)}`,
      {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    const payload = (await response.json()) as {
      data?: {
        id?: string;
        attributes?: {
          metadata?: { user_email?: string };
          payment_intent?: {
            attributes?: { status?: string; amount?: number };
          };
          payments?: {
            id?: string;
            attributes?: { status?: string; amount?: number };
          }[];
        };
      };
    };

    if (!response.ok || !payload.data) {
      return NextResponse.json(
        { paid: false, error: "Could not verify checkout session." },
        { status: 404 },
      );
    }

    const attrs = payload.data.attributes;
    const ownerEmail = attrs?.metadata?.user_email?.trim().toLowerCase();
    if (
      ownerEmail &&
      session.role !== "admin" &&
      ownerEmail !== session.email.toLowerCase()
    ) {
      return NextResponse.json(
        { paid: false, error: "You cannot verify another user's payment session." },
        { status: 403 },
      );
    }

    const paidPayment = attrs?.payments?.find(
      (item) => item.attributes?.status === "paid",
    );
    const intentSucceeded =
      attrs?.payment_intent?.attributes?.status === "succeeded";
    const centavos =
      paidPayment?.attributes?.amount ??
      attrs?.payment_intent?.attributes?.amount;

    return NextResponse.json({
      paid: Boolean(paidPayment || intentSucceeded),
      paymentReference: paidPayment?.id ?? payload.data.id ?? sessionId,
      ...(typeof centavos === "number" && centavos > 0
        ? { paidAmountPhp: Math.round(centavos / 100) }
        : {}),
    });
  } catch {
    return NextResponse.json(
      { paid: false, error: "Gateway verification request failed." },
      { status: 502 },
    );
  }
}
