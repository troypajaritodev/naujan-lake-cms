import type { Advisory, AdvisoryCategory, AdvisorySeverity } from "@/lib/advisories";
import {
  decodeGhostMeta,
  encodeGhostMeta,
  escapeHtml,
  getGhostStatus,
  ghostAdminFetch,
  ghostContentFetch,
  htmlToParagraphs,
  paragraphsToHtml,
  type GhostPost,
  type GhostTag,
} from "@/lib/ghost";
import type { ParkRule, Zone } from "@/lib/guidelines";
import type { ConservationStatus, Seasonality, Species, SpeciesPhoto } from "@/lib/species-meta";
import { photoFor, speciesPhotos } from "@/lib/species-photos";
import type { ItineraryStop, TariffLine, Tour, TourDifficulty } from "@/lib/tours-meta";

export type GhostCollectionKind = "advisories" | "tours" | "species" | "guidelines";

export type GhostSyncResult = {
  synced: boolean;
  skipped?: boolean;
  error?: string;
};

export type GhostCollectionPayload<T> = {
  items: T[];
  draftedSlugs: Set<string>;
  draftedItems: T[];
};

const TAG_SLUGS: Record<GhostCollectionKind, readonly string[]> = {
  advisories: ["hash-nl-advisory", "nl-advisory", "advisory", "advisories"],
  tours: ["hash-nl-tour", "nl-tour", "tour", "tours"],
  species: ["hash-nl-species", "nl-species", "species", "wildlife"],
  guidelines: ["hash-nl-guideline", "nl-guideline", "guideline", "guidelines"],
};

const PRIMARY_TAG_NAME: Record<GhostCollectionKind, string> = {
  advisories: "#nl-advisory",
  tours: "#nl-tour",
  species: "#nl-species",
  guidelines: "#nl-guideline",
};

const SEVERITY_LABELS: Record<AdvisorySeverity, string> = {
  CRITICAL: "Closure",
  WARNING: "Warning",
  INFO: "Advisory",
};

const VALID_SEVERITIES = new Set<string>(["CRITICAL", "WARNING", "INFO"]);
const VALID_CATEGORIES = new Set<string>([
  "Wildlife",
  "Water",
  "Access",
  "Operations",
]);
const VALID_DIFFICULTIES = new Set<string>(["EASY", "MODERATE", "CHALLENGING"]);
const VALID_CONSERVATION = new Set<string>(["CR", "EN", "VU", "NT", "LC", "DD"]);
const VALID_SEASONALITY = new Set<string>(["RESIDENT", "MIGRATORY", "SEASONAL"]);

export const GHOST_RULES_SLUG = "nl-park-rules";
export const GHOST_ZONES_SLUG = "nl-lake-zones";
export const GHOST_STARTER_SLUG = "coming-soon";

function hasAnyTag(post: GhostPost, kind: GhostCollectionKind): boolean {
  const allowed = TAG_SLUGS[kind];
  const tags = post.tags ?? [];
  return tags.some((tag) => {
    const slug = typeof tag?.slug === "string" ? tag.slug.toLowerCase() : "";
    const name =
      typeof tag?.name === "string"
        ? tag.name.toLowerCase().replace(/^#/, "hash-")
        : "";
    return (
      (slug.length > 0 && allowed.includes(slug)) ||
      (name.length > 0 && allowed.includes(name))
    );
  });
}

function belongsToOtherCollection(post: GhostPost): boolean {
  return (
    hasAnyTag(post, "tours") ||
    hasAnyTag(post, "species") ||
    hasAnyTag(post, "guidelines") ||
    post.slug === GHOST_RULES_SLUG ||
    post.slug === GHOST_ZONES_SLUG
  );
}

/** Route tagged posts to their collection; untagged/general posts default to advisories. */
function matchesCollection(post: GhostPost, kind: GhostCollectionKind): boolean {
  if (hasAnyTag(post, kind)) return true;
  if (kind === "advisories") {
    return !belongsToOtherCollection(post) && post.slug !== GHOST_STARTER_SLUG;
  }
  return false;
}

/** Identify which Next.js cache tags should be invalidated for a Ghost post's tags. */
export function classifyGhostTags(
  tags: readonly GhostTag[] | undefined,
): GhostCollectionKind[] {
  if (!tags || tags.length === 0) return [];
  const fakePost = { id: "", title: "", slug: "", tags: [...tags] } satisfies GhostPost;
  const matched: GhostCollectionKind[] = [];
  for (const kind of ["advisories", "tours", "species", "guidelines"] as const) {
    if (hasAnyTag(fakePost, kind)) {
      matched.push(kind);
    }
  }
  return matched;
}

function tagFilter(kind: GhostCollectionKind): string {
  return `tag:[${TAG_SLUGS[kind].join(",")}]`;
}

async function fetchGhostPostsFor(kind: GhostCollectionKind): Promise<{
  published: GhostPost[];
  drafted: GhostPost[];
} | null> {
  const status = getGhostStatus();
  if (!status.contentApiReady) return null;

  const isDefaultAdvisoryFeed = kind === "advisories";
  const draftFilter = isDefaultAdvisoryFeed
    ? "status:draft"
    : `status:draft+${tagFilter(kind)}`;

  const [contentRes, adminRes] = await Promise.all([
    ghostContentFetch<{ posts?: GhostPost[] }>("posts/", {
      include: "tags",
      formats: "html",
      limit: "all",
      ...(isDefaultAdvisoryFeed ? {} : { filter: tagFilter(kind) }),
    }),
    status.adminApiReady
      ? ghostAdminFetch<{ posts?: GhostPost[] }>(
          `posts/?${new URLSearchParams({
            filter: draftFilter,
            include: "tags",
            formats: "html",
            limit: "all",
          }).toString()}`,
        )
      : Promise.resolve(null),
  ]);

  if (!contentRes || !Array.isArray(contentRes.posts)) {
    return null;
  }

  const drafted =
    adminRes && adminRes.ok && Array.isArray(adminRes.data.posts)
      ? adminRes.data.posts.filter((post) => matchesCollection(post, kind))
      : [];

  return {
    published: contentRes.posts.filter((post) =>
      matchesCollection(post, kind),
    ),
    drafted,
  };
}

/**
 * Ensures the internal `#nl-*` collection tags exist in Ghost before concurrent
 * bulk writes begin, avoiding Ghost Bookshelf nested-relation races when
 * parallel requests auto-create the same tag simultaneously.
 */
export async function ensureGhostCollectionTags(): Promise<void> {
  if (!getGhostStatus().adminApiReady) return;

  for (const name of Object.values(PRIMARY_TAG_NAME)) {
    const slug = name.toLowerCase().replace(/^#/, "hash-");
    const lookup = await ghostAdminFetch<{ tags?: GhostTag[] }>(
      `tags/slug/${encodeURIComponent(slug)}/`,
    );
    if (!lookup.ok && lookup.status === 404) {
      await ghostAdminFetch<{ tags?: GhostTag[] }>("tags/", {
        method: "POST",
        body: { tags: [{ name, slug }] },
      });
    }
  }
}

function mergeTagsPreservingCustom(
  existing: readonly GhostTag[] | undefined,
  requiredTagName: string,
): { name: string }[] {
  const seen = new Set<string>();
  const out: { name: string }[] = [];

  const pushTag = (name: string) => {
    const clean = name.trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name: clean });
  };

  pushTag(requiredTagName);
  for (const tag of existing ?? []) {
    pushTag(tag.name);
  }
  return out;
}

async function upsertGhostPost(input: {
  slug: string;
  title: string;
  html: string;
  customExcerpt?: string;
  featureImage?: string;
  featureImageAlt?: string;
  publishedAt?: string;
  status: "published" | "draft";
  requiredTag: string;
  meta: Record<string, unknown>;
}): Promise<GhostSyncResult> {
  if (!getGhostStatus().adminApiReady) {
    return { synced: false, skipped: true };
  }

  const writeOnce = async (): Promise<GhostSyncResult> => {
    const lookup = await ghostAdminFetch<{ posts?: GhostPost[] }>(
      `posts/slug/${encodeURIComponent(input.slug)}/?include=tags&formats=html`,
    );

    const existing =
      lookup.ok && Array.isArray(lookup.data.posts) ? lookup.data.posts[0] : undefined;

    if (!lookup.ok && lookup.status !== 404) {
      return { synced: false, error: lookup.error };
    }

    const postBody: Record<string, unknown> = {
      title: input.title,
      slug: input.slug,
      html: input.html,
      custom_excerpt: input.customExcerpt ?? null,
      status: input.status,
      tags: mergeTagsPreservingCustom(existing?.tags, input.requiredTag),
      codeinjection_foot: encodeGhostMeta(input.meta),
    };

    if (input.featureImage && /^https?:\/\//i.test(input.featureImage)) {
      postBody.feature_image = input.featureImage;
      if (input.featureImageAlt) {
        postBody.feature_image_alt = input.featureImageAlt;
      }
    }

    if (input.publishedAt && /^\d{4}-\d{2}-\d{2}/.test(input.publishedAt)) {
      postBody.published_at = input.publishedAt.includes("T")
        ? input.publishedAt
        : `${input.publishedAt}T08:00:00.000Z`;
    }

    if (existing) {
      postBody.updated_at = existing.updated_at;
      const updated = await ghostAdminFetch<{ posts?: GhostPost[] }>(
        `posts/${encodeURIComponent(existing.id)}/?source=html`,
        {
          method: "PUT",
          body: { posts: [postBody] },
        },
      );
      return updated.ok
        ? { synced: true }
        : { synced: false, error: updated.error };
    }

    const created = await ghostAdminFetch<{ posts?: GhostPost[] }>(
      "posts/?source=html",
      {
        method: "POST",
        body: { posts: [postBody] },
      },
    );
    return created.ok
      ? { synced: true }
      : { synced: false, error: created.error };
  };

  const first = await writeOnce();
  if (!first.synced && first.error?.toLowerCase().includes("nested relation")) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    return writeOnce();
  }
  return first;
}

export async function setGhostPostStatusBySlug(
  slug: string,
  status: "published" | "draft",
): Promise<GhostSyncResult> {
  if (!getGhostStatus().adminApiReady) {
    return { synced: false, skipped: true };
  }

  const lookup = await ghostAdminFetch<{ posts?: GhostPost[] }>(
    `posts/slug/${encodeURIComponent(slug)}/`,
  );

  if (!lookup.ok) {
    if (lookup.status === 404) {
      return { synced: false, skipped: true };
    }
    return { synced: false, error: lookup.error };
  }

  const existing = lookup.data.posts?.[0];
  if (!existing) {
    return { synced: false, skipped: true };
  }

  const updated = await ghostAdminFetch<{ posts?: GhostPost[] }>(
    `posts/${encodeURIComponent(existing.id)}/`,
    {
      method: "PUT",
      body: {
        posts: [{ status, updated_at: existing.updated_at }],
      },
    },
  );

  return updated.ok
    ? { synced: true }
    : { synced: false, error: updated.error };
}

/**
 * Updates an existing Ghost post's status without clobbering native HTML body
 * edits, or pushes the full record if the slug has not been seeded to Ghost yet.
 */
export async function syncGhostStatusOrUpsert(
  slug: string,
  status: "published" | "draft",
  fallbackPush?: () => Promise<GhostSyncResult>,
): Promise<GhostSyncResult> {
  const result = await setGhostPostStatusBySlug(slug, status);
  if (result.skipped && fallbackPush && getGhostStatus().adminApiReady) {
    return fallbackPush();
  }
  return result;
}

/**
 * Merges Ghost Content/Admin posts with fallback rows (Supabase or local seed):
 * published Ghost posts override matching slugs and append new Ghost slugs;
 * drafted Ghost posts (`draftedSlugs`) drop out of `active` into `drafted`.
 */
export function mergeGhostBase<T extends { slug: string }>(
  base: readonly T[],
  ghost: GhostCollectionPayload<T> | null,
): { active: T[]; drafted: T[]; draftedSlugs: Set<string> } {
  if (!ghost) {
    return {
      active: [...base],
      drafted: [],
      draftedSlugs: new Set(),
    };
  }

  const seenActive = new Set<string>();
  const active: T[] = [];

  for (const item of ghost.items) {
    if (seenActive.has(item.slug) || ghost.draftedSlugs.has(item.slug)) continue;
    seenActive.add(item.slug);
    active.push(item);
  }

  for (const item of base) {
    if (seenActive.has(item.slug) || ghost.draftedSlugs.has(item.slug)) continue;
    seenActive.add(item.slug);
    active.push(item);
  }

  const draftedBySlug = new Map<string, T>();
  for (const item of ghost.draftedItems) {
    if (!draftedBySlug.has(item.slug)) {
      draftedBySlug.set(item.slug, item);
    }
  }
  for (const item of base) {
    if (ghost.draftedSlugs.has(item.slug) && !draftedBySlug.has(item.slug)) {
      draftedBySlug.set(item.slug, item);
    }
  }

  return {
    active,
    drafted: [...draftedBySlug.values()],
    draftedSlugs: new Set(ghost.draftedSlugs),
  };
}

/** Deduplicates merged collections by `slug`, preferring items in `primary`. */
export function dedupeBySlug<T extends { slug: string }>(
  primary: readonly T[],
  secondary: readonly T[],
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of [...primary, ...secondary]) {
    if (seen.has(item.slug)) continue;
    seen.add(item.slug);
    out.push(item);
  }
  return out;
}

/** Human-readable status suffix appended to admin Server Action responses. */
export function formatGhostSyncSuffix(result: GhostSyncResult): string {
  if (result.synced) return " Synced to Ghost CMS.";
  if (result.error) return ` (Ghost sync warning: ${result.error})`;
  return "";
}

/* -------------------------------------------------------------------------- */
/* Advisories                                                                  */
/* -------------------------------------------------------------------------- */

function getNormalizedTagNames(post: GhostPost): string[] {
  return (post.tags ?? [])
    .map((t) => (typeof t?.name === "string" ? t.name.toLowerCase() : ""))
    .filter(Boolean);
}

function inferAdvisorySeverity(post: GhostPost, metaSeverity?: unknown): AdvisorySeverity {
  if (typeof metaSeverity === "string" && VALID_SEVERITIES.has(metaSeverity)) {
    return metaSeverity as AdvisorySeverity;
  }
  const tagNames = getNormalizedTagNames(post);
  if (tagNames.some((n) => n.includes("critical") || n.includes("closure"))) {
    return "CRITICAL";
  }
  if (tagNames.some((n) => n.includes("warning") || n.includes("caution"))) {
    return "WARNING";
  }
  return "INFO";
}

function inferAdvisoryCategory(post: GhostPost, metaCategory?: unknown): AdvisoryCategory {
  if (typeof metaCategory === "string" && VALID_CATEGORIES.has(metaCategory)) {
    return metaCategory as AdvisoryCategory;
  }
  const tagNames = getNormalizedTagNames(post);
  for (const cat of VALID_CATEGORIES) {
    if (tagNames.includes(cat.toLowerCase())) {
      return cat as AdvisoryCategory;
    }
  }
  return "Operations";
}

export function mapGhostPostToAdvisory(post: GhostPost): Advisory {
  const meta = decodeGhostMeta<Advisory>(post.codeinjection_foot);
  const severity = inferAdvisorySeverity(post, meta?.severity);
  const category = inferAdvisoryCategory(post, meta?.category);
  const body = htmlToParagraphs(post.html);
  const effectiveBody =
    body.length > 0
      ? body
      : [post.custom_excerpt || post.excerpt || post.title];

  const publishedAt =
    typeof meta?.publishedAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(meta.publishedAt)
      ? meta.publishedAt
      : (post.published_at ?? post.updated_at ?? new Date().toISOString()).slice(0, 10);

  const effectiveUntil =
    typeof meta?.effectiveUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(meta.effectiveUntil)
      ? meta.effectiveUntil
      : undefined;

  const actions = Array.isArray(meta?.actions)
    ? meta.actions.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
    : undefined;

  return {
    slug: post.slug,
    title: post.title,
    severity,
    severityLabel: meta?.severityLabel || SEVERITY_LABELS[severity],
    category,
    publishedAt,
    ...(effectiveUntil ? { effectiveUntil } : {}),
    excerpt:
      (post.custom_excerpt?.trim() ||
        post.excerpt?.trim() ||
        effectiveBody[0] ||
        post.title).slice(0, 320),
    body: effectiveBody,
    ...(actions && actions.length > 0 ? { actions } : {}),
    isActiveBanner: Boolean(meta?.isActiveBanner),
  };
}

export async function fetchGhostAdvisories(): Promise<GhostCollectionPayload<Advisory> | null> {
  const data = await fetchGhostPostsFor("advisories");
  if (!data) return null;

  return {
    items: data.published.map(mapGhostPostToAdvisory),
    draftedSlugs: new Set(data.drafted.map((p) => p.slug)),
    draftedItems: data.drafted.map(mapGhostPostToAdvisory),
  };
}

export async function pushAdvisoryToGhost(
  advisory: Advisory,
  status: "published" | "draft" = "published",
): Promise<GhostSyncResult> {
  const actionListHtml =
    advisory.actions && advisory.actions.length > 0
      ? `<h3>Visitor guidance</h3><ul>${advisory.actions
          .map((item) => `<li>${escapeHtml(item)}</li>`)
          .join("")}</ul>`
      : "";

  return upsertGhostPost({
    slug: advisory.slug,
    title: advisory.title,
    html: `${paragraphsToHtml(advisory.body)}${actionListHtml}`,
    customExcerpt: advisory.excerpt,
    publishedAt: advisory.publishedAt,
    status,
    requiredTag: PRIMARY_TAG_NAME.advisories,
    meta: {
      kind: "advisory",
      severity: advisory.severity,
      severityLabel: advisory.severityLabel,
      category: advisory.category,
      publishedAt: advisory.publishedAt,
      ...(advisory.effectiveUntil ? { effectiveUntil: advisory.effectiveUntil } : {}),
      ...(advisory.actions && advisory.actions.length > 0
        ? { actions: advisory.actions }
        : {}),
      isActiveBanner: Boolean(advisory.isActiveBanner),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Tours                                                                       */
/* -------------------------------------------------------------------------- */

function mapGhostPostToTour(post: GhostPost): Tour | null {
  const meta = decodeGhostMeta<Tour>(post.codeinjection_foot);
  // Require minimum package metadata (or ratePerPerson) so unrelated posts aren't misparsed.
  const rate = Number(meta?.ratePerPerson);
  const hasMeta = Boolean(meta && Number.isFinite(rate) && rate > 0);
  if (!hasMeta) return null;

  const difficulty: TourDifficulty =
    typeof meta?.difficulty === "string" && VALID_DIFFICULTIES.has(meta.difficulty)
      ? (meta.difficulty as TourDifficulty)
      : "EASY";

  const image =
    post.feature_image?.trim() ||
    (typeof meta?.image === "string" && meta.image.trim()
      ? meta.image.trim()
      : "/images/sunrise.jpg");

  return {
    slug: post.slug,
    title: post.title,
    category: typeof meta?.category === "string" && meta.category.trim() ? meta.category : "Eco-Tour",
    summary:
      post.custom_excerpt?.trim() ||
      (typeof meta?.summary === "string" && meta.summary) ||
      htmlToParagraphs(post.html)[0] ||
      post.title,
    duration: typeof meta?.duration === "string" ? meta.duration : "Half day",
    departure: typeof meta?.departure === "string" ? meta.departure : "06:00, park jetty",
    ratePerPerson: rate,
    maxCapacity:
      typeof meta?.maxCapacity === "number" && meta.maxCapacity >= 1
        ? meta.maxCapacity
        : 8,
    difficulty,
    inclusions: Array.isArray(meta?.inclusions) ? meta.inclusions : [],
    image,
    imageAlt:
      post.feature_image_alt?.trim() ||
      (typeof meta?.imageAlt === "string" && meta.imageAlt) ||
      `${post.title} at Naujan Lake National Park`,
    itinerary: Array.isArray(meta?.itinerary) ? (meta.itinerary as ItineraryStop[]) : [],
    tariff: Array.isArray(meta?.tariff) ? (meta.tariff as TariffLine[]) : [],
    bring: Array.isArray(meta?.bring) ? meta.bring : [],
    notes: Array.isArray(meta?.notes) ? meta.notes : [],
    speciesSlugs: Array.isArray(meta?.speciesSlugs) ? meta.speciesSlugs : [],
  };
}

export async function fetchGhostTours(): Promise<GhostCollectionPayload<Tour> | null> {
  const data = await fetchGhostPostsFor("tours");
  if (!data) return null;

  const items = data.published
    .map(mapGhostPostToTour)
    .filter((entry): entry is Tour => entry !== null);
  const draftedItems = data.drafted
    .map(mapGhostPostToTour)
    .filter((entry): entry is Tour => entry !== null);

  return {
    items,
    draftedSlugs: new Set(data.drafted.map((p) => p.slug)),
    draftedItems,
  };
}

export async function pushTourToGhost(
  tour: Tour,
  status: "published" | "draft" = "published",
): Promise<GhostSyncResult> {
  const itineraryHtml =
    tour.itinerary.length > 0
      ? `<h3>Itinerary</h3><ul>${tour.itinerary
          .map(
            (stop) =>
              `<li><strong>${escapeHtml(stop.time)} — ${escapeHtml(stop.title)}</strong>: ${escapeHtml(stop.detail)}</li>`,
          )
          .join("")}</ul>`
      : "";

  const metaHtml = `<p><strong>Rate:</strong> PHP ${tour.ratePerPerson.toLocaleString("en-PH")} · <strong>Capacity:</strong> ${tour.maxCapacity} guests · <strong>Duration:</strong> ${escapeHtml(tour.duration)}</p>`;

  return upsertGhostPost({
    slug: tour.slug,
    title: tour.title,
    html: `<p>${escapeHtml(tour.summary)}</p>${metaHtml}${itineraryHtml}`,
    customExcerpt: tour.summary,
    featureImage: tour.image,
    featureImageAlt: tour.imageAlt,
    status,
    requiredTag: PRIMARY_TAG_NAME.tours,
    meta: {
      kind: "tour",
      category: tour.category,
      summary: tour.summary,
      duration: tour.duration,
      departure: tour.departure,
      ratePerPerson: tour.ratePerPerson,
      maxCapacity: tour.maxCapacity,
      difficulty: tour.difficulty,
      inclusions: tour.inclusions,
      image: tour.image,
      imageAlt: tour.imageAlt,
      itinerary: tour.itinerary,
      tariff: tour.tariff,
      bring: tour.bring,
      notes: tour.notes,
      speciesSlugs: tour.speciesSlugs,
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Wildlife Species                                                            */
/* -------------------------------------------------------------------------- */

function mapGhostPostToSpecies(post: GhostPost): Species | null {
  const meta = decodeGhostMeta<Species>(post.codeinjection_foot);
  if (!meta?.scientificName || !meta?.group) return null;

  const status: ConservationStatus =
    typeof meta.status === "string" && VALID_CONSERVATION.has(meta.status)
      ? (meta.status as ConservationStatus)
      : "LC";
  const seasonality: Seasonality =
    typeof meta.seasonality === "string" && VALID_SEASONALITY.has(meta.seasonality)
      ? (meta.seasonality as Seasonality)
      : "RESIDENT";

  const curated = speciesPhotos[post.slug];
  const fallbackPhoto =
    meta.photo &&
    curated &&
    meta.photo.src === curated.src
      ? curated
      : (meta.photo ?? photoFor(post.slug));

  const photo: SpeciesPhoto | undefined = post.feature_image?.trim()
    ? {
        src: post.feature_image.trim(),
        alt: post.feature_image_alt?.trim() || `${post.title} photograph`,
        credit: meta.photo?.credit || "Ghost CMS Media",
        license: meta.photo?.license || "All rights reserved",
        licenseUrl: meta.photo?.licenseUrl || "",
        sourceUrl: meta.photo?.sourceUrl || "",
      }
    : fallbackPhoto;

  return {
    slug: post.slug,
    group: meta.group,
    commonName: meta.commonName || post.title,
    ...(meta.localName ? { localName: meta.localName } : {}),
    scientificName: meta.scientificName,
    status,
    seasonality,
    habitat: meta.habitat || "Naujan Lake wetlands",
    description:
      meta.description ||
      post.custom_excerpt?.trim() ||
      htmlToParagraphs(post.html)[0] ||
      "",
    ...(photo ? { photo } : {}),
  };
}

export async function fetchGhostSpecies(): Promise<GhostCollectionPayload<Species> | null> {
  const data = await fetchGhostPostsFor("species");
  if (!data) return null;

  const items = data.published
    .map(mapGhostPostToSpecies)
    .filter((entry): entry is Species => entry !== null);
  const draftedItems = data.drafted
    .map(mapGhostPostToSpecies)
    .filter((entry): entry is Species => entry !== null);

  return {
    items,
    draftedSlugs: new Set(data.drafted.map((p) => p.slug)),
    draftedItems,
  };
}

export async function pushSpeciesToGhost(
  entry: Species,
  status: "published" | "draft" = "published",
): Promise<GhostSyncResult> {
  const html = [
    `<p><em>${escapeHtml(entry.scientificName)}</em>${
      entry.localName ? ` · Local name: ${escapeHtml(entry.localName)}` : ""
    }</p>`,
    `<p>${escapeHtml(entry.description)}</p>`,
    `<p><strong>Habitat:</strong> ${escapeHtml(entry.habitat)}</p>`,
  ].join("\n");

  return upsertGhostPost({
    slug: entry.slug,
    title: entry.commonName,
    html,
    customExcerpt: entry.description.slice(0, 300),
    featureImage: entry.photo?.src,
    featureImageAlt: entry.photo?.alt,
    status,
    requiredTag: PRIMARY_TAG_NAME.species,
    meta: {
      kind: "species",
      group: entry.group,
      commonName: entry.commonName,
      ...(entry.localName ? { localName: entry.localName } : {}),
      scientificName: entry.scientificName,
      status: entry.status,
      seasonality: entry.seasonality,
      habitat: entry.habitat,
      description: entry.description,
      ...(entry.photo ? { photo: entry.photo } : {}),
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Park Rules & Lake Zoning                                                    */
/* -------------------------------------------------------------------------- */

export async function fetchGhostGuidelines(): Promise<{
  rules: ParkRule[] | null;
  zones: Zone[] | null;
} | null> {
  const data = await fetchGhostPostsFor("guidelines");
  if (!data) return null;

  let rules: ParkRule[] | null = null;
  let zones: Zone[] | null = null;

  for (const post of data.published) {
    const meta = decodeGhostMeta<{ rules?: ParkRule[]; zones?: Zone[] }>(
      post.codeinjection_foot,
    );
    if (post.slug === GHOST_RULES_SLUG && Array.isArray(meta?.rules)) {
      rules = meta.rules;
    }
    if (post.slug === GHOST_ZONES_SLUG && Array.isArray(meta?.zones)) {
      zones = meta.zones;
    }
  }

  return { rules, zones };
}

export async function pushRulesToGhost(rules: ParkRule[]): Promise<GhostSyncResult> {
  const html = `<ul>${rules
    .map(
      (rule) =>
        `<li><strong>${escapeHtml(rule.title)}</strong>: ${escapeHtml(rule.body)}${
          rule.note ? ` <em>(${escapeHtml(rule.note)})</em>` : ""
        }</li>`,
    )
    .join("")}</ul>`;

  return upsertGhostPost({
    slug: GHOST_RULES_SLUG,
    title: "Naujan Lake Park Rules",
    html,
    customExcerpt: `${rules.length} conservation guidelines active for Naujan Lake National Park.`,
    status: "published",
    requiredTag: PRIMARY_TAG_NAME.guidelines,
    meta: {
      kind: "rules",
      rules,
    },
  });
}

export async function pushZonesToGhost(zones: Zone[]): Promise<GhostSyncResult> {
  const html = zones
    .map(
      (zone) =>
        `<h3>${escapeHtml(zone.name)} (${escapeHtml(zone.share)}) — ${escapeHtml(zone.access)}</h3><p>${escapeHtml(zone.summary)}</p>`,
    )
    .join("\n");

  return upsertGhostPost({
    slug: GHOST_ZONES_SLUG,
    title: "Naujan Lake Ecological Zoning Plan",
    html,
    customExcerpt: `${zones.length} management zones across the Naujan Lake National Park watershed.`,
    status: "published",
    requiredTag: PRIMARY_TAG_NAME.guidelines,
    meta: {
      kind: "zones",
      zones,
    },
  });
}
