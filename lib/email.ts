
import { request as httpsRequest } from "node:https";

/**
 * Transactional email (FR-2.3, FR-6.3).
 *
 * Uses Resend's REST API when RESEND_API_KEY and EMAIL_FROM are set.
 * Otherwise, messages are printed in demo mode.
 * Email failures never interrupt the inquiry workflow.
 */

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export type EmailResult = {
  delivered: boolean;
  reason?: "demo" | "error";
  detail?: string;
};

const RESEND_ENDPOINT = new URL("https://api.resend.com/emails");

export function emailProviderConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(
  message: EmailMessage,
): Promise<EmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    console.info(
      `[email:demo] to=${message.to} subject="${message.subject}"\n\n${message.text}\n`,
    );

    return { delivered: false, reason: "demo" };
  }

  try {
    const payload = JSON.stringify({
      from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    });

    return await new Promise<EmailResult>((resolve) => {
      const req = httpsRequest(
        {
          hostname: RESEND_ENDPOINT.hostname,
          path: RESEND_ENDPOINT.pathname,
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(payload),
          },
        },
        (res) => {
          const chunks: Buffer[] = [];

          res.on("data", (chunk: Buffer | string) => {
            chunks.push(
              Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk),
            );
          });

          res.on("end", () => {
            const responseBody = Buffer.concat(chunks).toString("utf8");
            const status = res.statusCode ?? 0;

            if (status < 200 || status >= 300) {
              resolve({
                delivered: false,
                reason: "error",
                detail: `${status} ${responseBody}`,
              });
              return;
            }

            let messageId: string | undefined;

            try {
              const data = JSON.parse(responseBody) as { id?: string };
              messageId = data.id;
            } catch {
              // A successful HTTP response still counts as delivered.
            }

            resolve({
              delivered: true,
              detail: messageId,
            });
          });

          res.on("error", (error) => {
            resolve({
              delivered: false,
              reason: "error",
              detail: error.message,
            });
          });
        },
      );

      req.setTimeout(15000, () => {
        req.destroy(new Error("Resend request timed out after 15 seconds"));
      });

      req.on("error", (error) => {
        resolve({
          delivered: false,
          reason: "error",
          detail: error.message,
        });
      });

      req.write(payload);
      req.end();
    });
  } catch (error) {
    return {
      delivered: false,
      reason: "error",
      detail: error instanceof Error ? error.message : "Unknown transport error",
    };
  }
}
