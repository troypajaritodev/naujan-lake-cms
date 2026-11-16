import { revalidateTag } from "next/cache";
import { type NextRequest, NextResponse } from "next/server";
import {
  updateOverrides,
  type AdvisoryPatch,
  type SpeciesPatch,
  type TourPatch,
} from "@/lib/content-store";
import { verifyGhostWebhookRequest, type GhostPost } from "@/lib/ghost";
import {
  classifyGhostTags,
  GHOST_RULES_SLUG,
  GHOST_STARTER_SLUG,
  GHOST_ZONES_SLUG,
  type GhostCollectionKind,
} from "@/lib/ghost-cms";

type GhostWebhookBody = {
  post?: {
    current?: Partial<GhostPost>;
    previous?: Partial<GhostPost>;
  };
};

function omitKeys<T>(
  record: Record<string, T>,
  keys: readonly string[],
): Record<string, T> {
  if (keys.length === 0) return record;
  const next = { ...record };
  for (const key of keys) {
    delete next[key];
  }
  return next;
}

function reconcileOverrides<
  T extends { slug: string },
  P,
  K extends "archived" | "unpublished",
>(
  collection: { created: T[]; edited: Record<string, P> } & Record<K, string[]>,
  listKey: K,
  clearSlugs: readonly string[],
  activeSlug: string | undefined,
  hideSlug: boolean,
): { created: T[]; edited: Record<string, P> } & Record<K, string[]> {
  const clearSet = new Set(clearSlugs);
  const created = collection.created.filter((item) => !clearSet.has(item.slug));
  const edited = omitKeys(collection.edited, clearSlugs);
  const filtered = collection[listKey].filter((item) => !clearSet.has(item));

  if (activeSlug && hideSlug) {
    filtered.push(activeSlug);
  }

  return {
    ...collection,
    created,
    edited,
    [listKey]: filtered,
  } as { created: T[]; edited: Record<string, P> } & Record<K, string[]>;
}

/**
 * Ghost CMS Webhook endpoint (`POST /api/webhooks/ghost`).
 *
 * Verifies the Ghost webhook HMAC signature (`X-Ghost-Signature`) or shared
 * secret header, reconciles local overrides so Ghost Studio edits take effect
 * without stale patches, and expires matching Next.js cache tags immediately.
 */
export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Unable to read webhook request body." },
      { status: 400 },
    );
  }

  const verified = verifyGhostWebhookRequest({
    rawBody,
    signatureHeader: request.headers.get("x-ghost-signature"),
    secretHeader: request.headers.get("x-ghost-webhook-secret"),
  });

  if (!verified) {
    return NextResponse.json(
      { ok: false, error: "Invalid Ghost webhook signature." },
      { status: 401 },
    );
  }

  let body: GhostWebhookBody = {};
  if (rawBody.trim().length > 0) {
    try {
      const parsed: unknown = JSON.parse(rawBody);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as GhostWebhookBody;
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON webhook payload." },
        { status: 400 },
      );
    }
  }

  const current = body.post?.current;
  const previous = body.post?.previous;
  const currentSlug =
    typeof current?.slug === "string" && current.slug.trim()
      ? current.slug.trim()
      : undefined;
  const previousSlug =
    typeof previous?.slug === "string" && previous.slug.trim()
      ? previous.slug.trim()
      : undefined;

  const activeSlug = currentSlug ?? previousSlug;
  const clearSlugs = [
    ...new Set([currentSlug, previousSlug].filter((s): s is string => Boolean(s))),
  ];
  const hideSlug = !currentSlug || current?.status !== "published";

  const combinedTags = [...(current?.tags ?? []), ...(previous?.tags ?? [])];
  const domainSet = new Set<GhostCollectionKind>(classifyGhostTags(combinedTags));

  if (clearSlugs.includes(GHOST_RULES_SLUG) || clearSlugs.includes(GHOST_ZONES_SLUG)) {
    domainSet.add("guidelines");
  }

  const hasExplicitClassification = domainSet.size > 0;
  if (
    !hasExplicitClassification &&
    activeSlug &&
    activeSlug !== GHOST_STARTER_SLUG
  ) {
    domainSet.add("advisories");
  }

  const domains = [...domainSet];

  if (clearSlugs.length > 0 || domains.includes("guidelines")) {
    await updateOverrides((existing) => ({
      ...existing,
      ...(domainSet.has("advisories")
        ? {
            advisories: reconcileOverrides<typeof existing.advisories.created[number], AdvisoryPatch, "archived">(
              existing.advisories,
              "archived",
              clearSlugs,
              activeSlug,
              hideSlug,
            ),
          }
        : {}),
      ...(domainSet.has("tours")
        ? {
            tours: reconcileOverrides<typeof existing.tours.created[number], TourPatch, "unpublished">(
              existing.tours,
              "unpublished",
              clearSlugs,
              activeSlug,
              hideSlug,
            ),
          }
        : {}),
      ...(domainSet.has("species")
        ? {
            species: reconcileOverrides<typeof existing.species.created[number], SpeciesPatch, "archived">(
              existing.species,
              "archived",
              clearSlugs,
              activeSlug,
              hideSlug,
            ),
          }
        : {}),
      ...(domainSet.has("guidelines")
        ? {
            guidelines: {
              rules:
                clearSlugs.includes(GHOST_ZONES_SLUG) &&
                !clearSlugs.includes(GHOST_RULES_SLUG)
                  ? existing.guidelines.rules
                  : null,
              zones:
                clearSlugs.includes(GHOST_RULES_SLUG) &&
                !clearSlugs.includes(GHOST_ZONES_SLUG)
                  ? existing.guidelines.zones
                  : null,
            },
          }
        : {}),
    }));
  }

  const tagsToInvalidate: string[] = hasExplicitClassification
    ? [...domains, "ghost"]
    : ["advisories", "tours", "species", "guidelines", "ghost"];

  for (const tag of tagsToInvalidate) {
    revalidateTag(tag, { expire: 0 });
  }

  return NextResponse.json({
    ok: true,
    slug: activeSlug ?? null,
    domains,
    revalidated: tagsToInvalidate,
  });
}
