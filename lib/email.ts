/**
 * Transactional email (FR-2.3, FR-6.3).
 *
 * Transport priority at call time:
 * 1. Mailpit REST API (`MAILPIT_URL`, e.g. `http://localhost:8025`) when set,
 *    capturing every portal email locally without calling external providers.
 * 2. Resend REST API when `RESEND_API_KEY` and `EMAIL_FROM` are set.
 * 3. Server console demo log otherwise. A send never throws into the request
 *    that triggered it — an unreachable provider must not fail a booking.
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

type MailpitAddress = { Name?: string; Email: string };

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_MAILPIT_FROM = "Naujan Lake <no-reply@naujanlake.gov.ph>";

function getMailpitUrl(): string | null {
  const raw = process.env.MAILPIT_URL?.trim();
  return raw ? raw.replace(/\/+$/, "") : null;
}

function parseMailpitAddress(raw: string): MailpitAddress {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(?:"?([^"<]+?)"?\s*)?<([^>\s]+@[^>\s]+)>$/);
  if (match) {
    const name = match[1]?.trim();
    const email = match[2].trim();
    return name ? { Name: name, Email: email } : { Email: email };
  }
  return { Email: trimmed };
}

async function sendViaMailpit(
  mailpitUrl: string,
  message: EmailMessage,
): Promise<EmailResult> {
  const fromRaw = process.env.EMAIL_FROM?.trim() || DEFAULT_MAILPIT_FROM;

  try {
    const response = await fetch(`${mailpitUrl}/api/v1/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        From: parseMailpitAddress(fromRaw),
        To: [parseMailpitAddress(message.to)],
        ...(message.replyTo ? { ReplyTo: [parseMailpitAddress(message.replyTo)] } : {}),
        Subject: message.subject,
        Text: message.text,
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

    const data = (await response.json()) as { ID?: string; id?: string };
    return { delivered: true, detail: data.ID ?? data.id ?? "mailpit" };
  } catch (error) {
    return {
      delivered: false,
      reason: "error",
      detail: error instanceof Error ? error.message : "Unknown Mailpit error",
    };
  }
}

export function emailProviderConfigured(): boolean {
  return Boolean(
    getMailpitUrl() || (process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
  );
}

export async function sendEmail(message: EmailMessage): Promise<EmailResult> {
  const mailpitUrl = getMailpitUrl();
  if (mailpitUrl) {
    return sendViaMailpit(mailpitUrl, message);
  }

  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
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
