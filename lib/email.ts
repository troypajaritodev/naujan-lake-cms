/**
 * Transactional email (FR-2.3, FR-6.3).
 *
 * One transport, picked at call time: Resend's REST API when `RESEND_API_KEY`
 * and `EMAIL_FROM` are set, otherwise the server console. The console path
 * prints the whole message, so the inquiry flow can be exercised in demo mode
 * without an account. A send never throws into the request that triggered it —
 * an unreachable provider must not fail a booking.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  /** Where a reply should land — the visitor's address for staff alerts. */
  replyTo?: string;
};

export type EmailResult = {
  delivered: boolean;
  reason?: "demo" | "error";
  /** Provider message id, or the failure detail. */
  detail?: string;
};

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function emailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  if (!emailProviderConfigured()) {
    console.info(
      `[email:demo] to=${message.to} subject="${message.subject}"\n\n${message.text}\n`,
    );
    return { delivered: false, reason: "demo" };
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      return {
        delivered: false,
        reason: "error",
        detail: `${response.status} ${await response.text()}`,
      };
    }

    const data = (await response.json()) as { id?: string };
    return { delivered: true, detail: data.id };
  } catch (error) {
    return {
      delivered: false,
      reason: "error",
      detail: error instanceof Error ? error.message : "Unknown transport error",
    };
  }
}
