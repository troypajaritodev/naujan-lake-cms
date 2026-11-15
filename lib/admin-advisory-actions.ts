"use server";

import { updateTag } from "next/cache";
import { requireAdminClient } from "@/lib/admin-session";
import { severityLabels, type Advisory, type AdvisorySeverity } from "@/lib/advisories";
import { cleanText } from "@/lib/sanitize";

export type AdminAdvisory = Advisory & {
  id: string;
  isPublished: boolean;
};

export type AdvisoryActionResult =
  | { ok: true; advisory: AdminAdvisory; message: string }
  | { ok: false; message: string; field?: string; partial?: boolean };

const SEVERITIES: AdvisorySeverity[] = ["CRITICAL", "WARNING", "INFO"];
const ISO_DATE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function isRealDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function toAdminAdvisory(row: {
  id: string;
  title: string;
  slug: string;
  severity: AdvisorySeverity;
  excerpt: string;
  content: string;
  is_active_banner: boolean;
  published_at: string;
  created_at: string;
}): AdminAdvisory {
  const publishedAt = row.published_at.slice(0, 10);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    severity: row.severity,
    severityLabel: severityLabels[row.severity],
    category: "Operations",
    publishedAt,
    excerpt: row.excerpt,
    body: row.content.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean),
    isActiveBanner: row.is_active_banner,
    isPublished: row.published_at <= new Date().toISOString(),
  };
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 72);
}

function isPublishedAt(publishedAt: string): boolean {
  return publishedAt <= new Date().toISOString();
}

async function clearOtherBanners(
  client: Awaited<ReturnType<typeof requireAdminClient>>,
  keepId: string,
) {
  return client
    .from("advisories")
    .update({ is_active_banner: false })
    .eq("is_active_banner", true)
    .neq("id", keepId);
}

const ROW_SELECT = "id, title, slug, severity, excerpt, content, is_active_banner, published_at, created_at" as const;

export async function listAdminAdvisoriesAction(): Promise<AdminAdvisory[]> {
  const client = await requireAdminClient();
  const { data, error } = await client.from("advisories").select(ROW_SELECT).order("published_at", { ascending: false });
  if (error) throw new Error(`Could not load advisories: ${error.message}`);
  return (data ?? []).map(toAdminAdvisory);
}

export async function saveAdminAdvisoryAction(formData: FormData): Promise<AdvisoryActionResult> {
  const client = await requireAdminClient();
  const id = cleanText(String(formData.get("id") ?? ""), 64);
  const title = cleanText(String(formData.get("title") ?? ""), 120);
  const slugInput = cleanText(String(formData.get("slug") ?? ""), 72);
  const slug = slugInput || slugify(title);
  const severity = cleanText(String(formData.get("severity") ?? ""), 12) as AdvisorySeverity;
  const excerpt = cleanText(String(formData.get("excerpt") ?? ""), 320);
  const content = cleanText(String(formData.get("content") ?? ""), 6000);
  const publishedDate = cleanText(String(formData.get("publishedAt") ?? ""), 10);
  const isActiveBanner = formData.get("isActiveBanner") === "on";

  if (title.length < 8) return { ok: false, field: "title", message: "Give the notice a real headline (at least 8 characters)." };
  if (!slug) return { ok: false, field: "title", message: "That headline has no usable letters in it." };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return { ok: false, field: "slug", message: "Use a lowercase, hyphen-separated slug." };
  if (!SEVERITIES.includes(severity)) return { ok: false, field: "severity", message: "Pick a severity." };
  if (excerpt.length < 20) return { ok: false, field: "excerpt", message: "Write at least a sentence for the summary." };
  if (!content) return { ok: false, field: "content", message: "The detail page needs a body." };
  if (!isRealDate(publishedDate)) return { ok: false, field: "publishedAt", message: "Pick a valid publication date." };

  const values = {
    title,
    slug,
    severity,
    excerpt,
    content,
    author_id: null,
    published_at: `${publishedDate}T00:00:00.000Z`,
    is_active_banner: isActiveBanner,
  };

  if (isActiveBanner && !isPublishedAt(values.published_at)) {
    return {
      ok: false,
      field: "publishedAt",
      message: "Only a published advisory can be pinned to the site banner.",
    };
  }

  const query = id
    ? client.from("advisories").update(values).eq("id", id)
    : client.from("advisories").insert(values);
  const { data, error } = await query.select(ROW_SELECT).maybeSingle();
  if (error || !data) return { ok: false, message: `Could not save advisory: ${error?.message ?? "The record was not returned."}` };

  updateTag("advisories");
  const advisory = toAdminAdvisory(data);
  if (isActiveBanner) {
    const { error: cleanupError } = await clearOtherBanners(client, advisory.id);
    updateTag("advisories");
    if (cleanupError) {
      return {
        ok: false,
        partial: true,
        message: `The advisory was saved and pinned, but other banners could not be cleared: ${cleanupError.message}`,
      };
    }
  }
  return { ok: true, advisory, message: id ? `Updated “${title}”.` : `Published “${title}”.` };
}

export async function setAdminAdvisoryPublishedAction(id: string, published: boolean): Promise<AdvisoryActionResult> {
  const client = await requireAdminClient();
  // The schema has no separate publication flag. Unpublishing uses a far-future
  // timestamp, which overwrites the original publication date; republishing
  // assigns a new timestamp. A future schema/RPC can model this atomically.
  const publishedAt = published ? new Date().toISOString() : "9999-12-31T00:00:00.000Z";
  const { data, error } = await client.from("advisories").update({
    published_at: publishedAt,
    ...(published ? {} : { is_active_banner: false }),
  }).eq("id", id).select(ROW_SELECT).maybeSingle();
  if (error || !data) return { ok: false, message: `Could not change publication status: ${error?.message ?? "The record no longer exists."}` };
  updateTag("advisories");
  return { ok: true, advisory: toAdminAdvisory(data), message: published ? "Advisory published." : "Advisory unpublished." };
}

export async function setAdminAdvisoryBannerAction(id: string, pinned: boolean): Promise<AdvisoryActionResult> {
  const client = await requireAdminClient();
  const { data: target, error: targetError } = await client
    .from("advisories")
    .select("id, published_at")
    .eq("id", id)
    .maybeSingle();
  if (targetError || !target) {
    return { ok: false, message: `Could not find the advisory: ${targetError?.message ?? "The record no longer exists."}` };
  }
  if (pinned && !isPublishedAt(target.published_at)) {
    return { ok: false, message: "Only a published advisory can be pinned to the site banner." };
  }

  const { data, error } = await client
    .from("advisories")
    .update({ is_active_banner: pinned })
    .eq("id", id)
    .select(ROW_SELECT)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, message: `Could not update the banner: ${error?.message ?? "The advisory was not updated."}` };
  }

  const advisory = toAdminAdvisory(data);
  if (pinned) {
    const { error: cleanupError } = await clearOtherBanners(client, id);
    updateTag("advisories");
    if (cleanupError) {
      return {
        ok: false,
        partial: true,
        message: `The advisory was pinned, but other banners could not be cleared: ${cleanupError.message}`,
      };
    }
  }
  updateTag("advisories");
  return { ok: true, advisory, message: pinned ? "Advisory pinned to the site banner." : "Advisory removed from the site banner." };
}
