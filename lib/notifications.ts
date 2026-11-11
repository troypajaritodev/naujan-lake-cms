/**
 * Fan-out helper for the advisory newsletter (FR-6.3).
 *
 * Recipients are passed in rather than read here: `lib/subscribers.ts` is still
 * the demo localStorage store, so a server-side read returns nothing until the
 * audience moves to Supabase (Milestone 2). The transport, template and
 * batching are independent of that swap — the CMS publish action only has to
 * hand over the addresses.
 */

import type { AdvisoryPreview } from "@/lib/advisories";
import { sendEmail } from "@/lib/email";
import { advisoryDigestEmail } from "@/lib/email-templates";

const BATCH_SIZE = 20;

export type DigestResult = { sent: number; failed: number };

export async function dispatchAdvisoryDigest(
  advisory: AdvisoryPreview,
  recipients: string[],
): Promise<DigestResult> {
  const unique = [...new Set(recipients.map((email) => email.trim().toLowerCase()))]
    .filter(Boolean);

  let sent = 0;
  let failed = 0;

  for (let start = 0; start < unique.length; start += BATCH_SIZE) {
    const batch = unique.slice(start, start + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((email) => sendEmail(advisoryDigestEmail(email, advisory))),
    );

    for (const result of results) {
      if (result.delivered) {
        sent += 1;
      } else {
        failed += 1;
      }
    }
  }

  return { sent, failed };
}
