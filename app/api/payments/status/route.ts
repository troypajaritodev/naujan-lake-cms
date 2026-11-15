import { NextResponse } from "next/server";
import { cleanText } from "@/lib/sanitize";

/**
 * Verifies a returning PayMongo checkout session after the visitor comes back
 * from `/inquire?checkout=success&session_id=...`.
 */
export async function GET(request: Request) {
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
          payment_intent?: {
            attributes?: { status?: string };
          };
          payments?: { id?: string; attributes?: { status?: string } }[];
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
    const paidPayment = attrs?.payments?.find(
      (item) => item.attributes?.status === "paid",
    );
    const intentSucceeded =
      attrs?.payment_intent?.attributes?.status === "succeeded";

    return NextResponse.json({
      paid: Boolean(paidPayment || intentSucceeded),
      paymentReference: paidPayment?.id ?? payload.data.id ?? sessionId,
    });
  } catch {
    return NextResponse.json(
      { paid: false, error: "Gateway verification request failed." },
      { status: 502 },
    );
  }
}
