"use server";

/**
 * Server actions behind `/admin/advisories` (PRD Module 4, UC "Publish
 * advisories").
 *
 * These are the first mutations in the app that change content the public
 * portal renders, so each one finishes with `updateTag("advisories")` — that is
 * the Next 16 read-your-own-writes invalidation, and it means a notice is on
 * `/advisories` by the time the admin's click returns, not after the hourly
 * `cacheLife` expires.
 *
 * Validation happens here rather than in the form because a server action is a
 * public endpoint: the browser can post anything to it.
 */

import { updateTag } from "next/cache";
import {
  formatAdvisoryDate,
  getArchivedAdvisories,
  getSortedAdvisories,
  severityLabels,
  type Advisory,
  type AdvisorySeverity,
} from "@/lib/advisories";
import {
  readOverrides,
  updateOverrides,
  type AdvisoryPatch,
} from "@/lib/content-store";
import {
  formatGhostSyncSuffix,
  pushAdvisoryToGhost,
  syncGhostStatusOrUpsert,
} from "@/lib/ghost-cms";
import { dispatchAdvisoryDigest } from "@/lib/notifications";
import { cleanEmail, cleanText } from "@/lib/sanitize";
import { requireAdminSession } from "@/lib/server-auth";
import { listServerSubscribers } from "@/lib/server-subscribers";

export type ActionResult =
  | { ok: true; slug: string; message: string }
  | { ok: false; message: string; field?: string };

const SEVERITIES: AdvisorySeverity[] = ["CRITICAL", "WARNING", "INFO"];
const CATEGORIES: Advisory["category"][] = [
  "Wildlife",
  "Water",
  "Access",
  "Operations",
];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function field(formData: FormData, name: string, maxLength: number): string {
  return cleanText(String(formData.get(name) ?? ""), maxLength);
}

/** "Reed beds closed to landings" → "reed-beds-closed-to-landings". */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
}

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime());
}

/** One non-empty line per action, capped so the detail page stays readable. */
function toLines(value: string, max: number): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

function toParagraphs(value: string): string[] {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\n/g, " ").trim())
    .filter(Boolean);
}

export async function saveAdvisoryAction(
  formData: FormData,
): Promise<ActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, message: "Park staff access required." };
  }

  const existingSlug = field(formData, "slug", 72);
  const title = field(formData, "title", 120);
  const excerpt = field(formData, "excerpt", 320);
  const severity = field(formData, "severity", 12) as AdvisorySeverity;
  const category = field(formData, "category", 24) as Advisory["category"];
  const publishedAt = field(formData, "publishedAt", 10);
  const effectiveUntil = field(formData, "effectiveUntil", 10);
  const body = toParagraphs(cleanText(String(formData.get("body") ?? ""), 6000));
  const actions = toLines(
    cleanText(String(formData.get("actions") ?? ""), 1200),
    6,
  );
  const isActiveBanner = formData.get("isActiveBanner") === "on";
  const dispatchSubscribers = formData.get("dispatchSubscribers") === "on";
  const recipientRaw = cleanText(String(formData.get("recipients") ?? ""), 4000);
  const recipients = recipientRaw
    .split(",")
    .map((email) => cleanEmail(email))
    .filter((email) => email.includes("@"))
    .slice(0, 200);

  if (title.length < 8) {
    return { ok: false, field: "title", message: "Give the notice a real headline (at least 8 characters)." };
  }
  if (excerpt.length < 20) {
    return {
      ok: false,
      field: "excerpt",
      message: "The summary is what shows on the board — write at least a sentence.",
    };
  }
  if (!SEVERITIES.includes(severity)) {
    return { ok: false, field: "severity", message: "Pick a severity." };
  }
  if (!CATEGORIES.includes(category)) {
    return { ok: false, field: "category", message: "Pick a category." };
  }
  if (!isRealDate(publishedAt)) {
    return { ok: false, field: "publishedAt", message: "Pick the publication date." };
  }
  if (effectiveUntil && (!isRealDate(effectiveUntil) || effectiveUntil < publishedAt)) {
    return {
      ok: false,
      field: "effectiveUntil",
      message: "An expiry date cannot fall before the publication date.",
    };
  }
  if (body.length === 0) {
    return {
      ok: false,
      field: "body",
      message: "The detail page needs a body. Separate paragraphs with a blank line.",
    };
  }

  const record: Advisory = {
    slug: existingSlug || slugify(title),
    title,
    severity,
    severityLabel: severityLabels[severity],
    category,
    publishedAt,
    excerpt,
    body,
    isActiveBanner,
    ...(effectiveUntil ? { effectiveUntil } : {}),
    ...(actions.length > 0 ? { actions } : {}),
  };

  if (!record.slug) {
    return { ok: false, field: "title", message: "That headline has no usable letters in it." };
  }

  const nextOverrides = await updateOverrides((current) => {
    const createdIndex = current.advisories.created.findIndex(
      (advisory) => advisory.slug === record.slug,
    );

    if (createdIndex >= 0) {
      // A notice written from this panel: replace it outright.
      const created = [...current.advisories.created];
      created[createdIndex] = record;
      return {
        ...current,
        advisories: { ...current.advisories, created },
      };
    }

    if (!existingSlug) {
      // A brand-new notice has no base row to patch, so it has to be stored
      // whole — an `edited` entry keyed by an unknown slug would merge against
      // nothing and vanish.
      return {
        ...current,
        advisories: {
          ...current.advisories,
          created: [record, ...current.advisories.created],
        },
      };
    }

    // A seeded or database row: keep it as a patch so a later sync of the base
    // rows does not lose the edit, while passing `null` to clear optional fields.
    const patch: AdvisoryPatch = {
      title: record.title,
      severity: record.severity,
      severityLabel: record.severityLabel,
      category: record.category,
      publishedAt: record.publishedAt,
      excerpt: record.excerpt,
      body: record.body,
      isActiveBanner: record.isActiveBanner,
      effectiveUntil: effectiveUntil || null,
      actions: actions.length > 0 ? actions : null,
    };

    return {
      ...current,
      advisories: {
        ...current.advisories,
        edited: { ...current.advisories.edited, [record.slug]: patch },
      },
    };
  });

  const isArchived = nextOverrides.advisories.archived.includes(record.slug);
  const ghostRes = await pushAdvisoryToGhost(
    record,
    isArchived ? "draft" : "published",
  );

  updateTag("advisories");

  let dispatchNote = "";
  if (dispatchSubscribers) {
    const serverRecipients = (await listServerSubscribers())
      .filter(
        (sub) =>
          sub.status === "ACTIVE" && sub.topics.includes("advisories"),
      )
      .map((sub) => sub.email);
    const mergedRecipients = [...new Set([...serverRecipients, ...recipients])];

    if (mergedRecipients.length > 0) {
      const digest = await dispatchAdvisoryDigest(
        {
          slug: record.slug,
          title: record.title,
          severity: record.severity,
          severityLabel: record.severityLabel,
          dateISO: record.publishedAt,
          date: formatAdvisoryDate(record.publishedAt),
          excerpt: record.excerpt,
        },
        mergedRecipients,
      );
      if (digest.sent > 0) {
        dispatchNote = ` Advisory alert dispatched to ${digest.sent} subscriber${digest.sent === 1 ? "" : "s"}.`;
      } else if (digest.demoLogged > 0) {
        dispatchNote = ` Email delivery is running in demo mode (${digest.demoLogged} alert preview${digest.demoLogged === 1 ? "" : "s"} logged).`;
      } else if (digest.failed > 0) {
        dispatchNote = ` Saved, though ${digest.failed} alert email${digest.failed === 1 ? "" : "s"} failed to send.`;
      }
    }
  }

  return {
    ok: true,
    slug: record.slug,
    message:
      (existingSlug
        ? `Updated “${record.title}”. The public board is live.`
        : `Published “${record.title}”. It is on the board now.`) +
      dispatchNote +
      formatGhostSyncSuffix(ghostRes),
  };
}

export async function setAdvisoryArchivedAction(
  slug: string,
  archived: boolean,
): Promise<ActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, message: "Park staff access required." };
  }

  const cleanSlug = cleanText(slug, 72);
  if (!cleanSlug) {
    return { ok: false, message: "Missing notice." };
  }

  const candidates = archived
    ? await getSortedAdvisories()
    : await getArchivedAdvisories();
  const target = candidates.find((entry) => entry.slug === cleanSlug);

  await updateOverrides((current) => {
    const others = current.advisories.archived.filter((item) => item !== cleanSlug);
    return {
      ...current,
      advisories: {
        ...current.advisories,
        archived: archived ? [...others, cleanSlug] : others,
      },
    };
  });

  const ghostRes = await syncGhostStatusOrUpsert(
    cleanSlug,
    archived ? "draft" : "published",
    target
      ? () => pushAdvisoryToGhost(target, archived ? "draft" : "published")
      : undefined,
  );

  updateTag("advisories");

  return {
    ok: true,
    slug: cleanSlug,
    message:
      (archived
        ? "Taken off the public board. It stays here under Archived."
        : "Back on the public board.") + formatGhostSyncSuffix(ghostRes),
  };
}

/** Used by the panel to warn before overwriting someone else's edit. */
export async function countAdvisoryOverridesAction(): Promise<number> {
  if (!(await requireAdminSession())) return 0;

  const overrides = await readOverrides();
  return (
    overrides.advisories.created.length +
    Object.keys(overrides.advisories.edited).length
  );
}
