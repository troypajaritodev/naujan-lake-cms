/**
 * Staff-authored content overrides for the admin CMS (PRD Module 4 / 5).
 *
 * The public data modules (`lib/advisories.ts`, `lib/tours.ts`) read from
 * Supabase when it is configured and fall back to seed rows otherwise. Neither
 * path can be written to from the browser: the anon key is read-only by RLS and
 * the account store lives in `localStorage`. So the admin panel writes to this
 * store instead, and every read merges it over whichever base it loaded:
 *
 *   base (Supabase or seed)  →  apply created / edited / archived  →  page
 *
 * The merge is what makes a publish in `/admin/advisories` show up on
 * `/advisories` without a database. In production the same server actions
 * would write to the `advisories` and `tours` tables with the service role,
 * and this file disappears — see `docs/PRD.md` §12.4.
 *
 * Storage is a single JSON document under `.data/` (gitignored). Writes go
 * through a temp file and a rename so a crash mid-write cannot leave the store
 * half-parsed. Reads never throw: a missing or corrupt file is treated as "no
 * overrides yet", which is the state every fresh checkout is in.
 */

import type { Advisory } from "@/lib/advisories";
import type { ParkRule, Zone } from "@/lib/guidelines";
import { JsonFileStore } from "@/lib/json-store";
import type { Species } from "@/lib/species-meta";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import type { Tour } from "@/lib/tours";

/** Patch map where `null` deletes an optional property on merge. */
export type PatchFields<T> = { [K in keyof T]?: T[K] | null };

/** Fields staff may change on an existing record. */
export type AdvisoryPatch = PatchFields<Omit<Advisory, "slug">>;
export type TourPatch = PatchFields<Omit<Tour, "slug">>;
export type SpeciesPatch = PatchFields<Omit<Species, "slug">>;

type CollectionOverride<T extends { slug: string }> = {
  created: T[];
  edited: Record<string, PatchFields<Omit<T, "slug">>>;
  archived: string[];
};

export type ContentOverrides = {
  advisories: CollectionOverride<Advisory>;
  tours: {
    created: Tour[];
    edited: Record<string, TourPatch>;
    /** Packages pulled from the public catalogue without deleting them. */
    unpublished: string[];
  };
  species: CollectionOverride<Species>;
  guidelines: {
    /** Customised park rule cards; `null` falls back to code defaults. */
    rules: ParkRule[] | null;
    /** Customised zoning matrix; `null` falls back to code defaults. */
    zones: Zone[] | null;
  };
};

export function emptyOverrides(): ContentOverrides {
  return {
    advisories: { created: [], edited: {}, archived: [] },
    tours: { created: [], edited: {}, unpublished: [] },
    species: { created: [], edited: {}, archived: [] },
    guidelines: { rules: null, zones: null },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normaliseCollection<T extends { slug: string }>(
  raw: unknown,
): CollectionOverride<T> {
  const section = isRecord(raw) ? raw : {};
  return {
    created: Array.isArray(section.created) ? (section.created as T[]) : [],
    edited: isRecord(section.edited)
      ? (section.edited as Record<string, PatchFields<Omit<T, "slug">>>)
      : {},
    archived: Array.isArray(section.archived)
      ? (section.archived as string[])
      : [],
  };
}

/**
 * Defensive read: the file is written by an older version of this module
 * whenever the shape changes, so every branch is checked before use.
 */
function normalise(raw: unknown): ContentOverrides {
  const empty = emptyOverrides();
  if (!isRecord(raw)) return empty;

  const tours = isRecord(raw.tours) ? raw.tours : {};
  const guidelines = isRecord(raw.guidelines) ? raw.guidelines : {};

  return {
    advisories: normaliseCollection<Advisory>(raw.advisories),
    tours: {
      created: Array.isArray(tours.created) ? (tours.created as Tour[]) : [],
      edited: isRecord(tours.edited)
        ? (tours.edited as Record<string, TourPatch>)
        : {},
      unpublished: Array.isArray(tours.unpublished)
        ? (tours.unpublished as string[])
        : [],
    },
    species: normaliseCollection<Species>(raw.species),
    guidelines: {
      rules: Array.isArray(guidelines.rules)
        ? (guidelines.rules as ParkRule[])
        : null,
      zones: Array.isArray(guidelines.zones)
        ? (guidelines.zones as Zone[])
        : null,
    },
  };
}

const PORTAL_KV_OVERRIDES_KEY = "content_overrides";

const contentStore = new JsonFileStore<ContentOverrides>({
  filename: "content.json",
  fallbackSubdir: "naujan-lake-content",
  normalize: normalise,
});

let kvWriteQueue: Promise<unknown> = Promise.resolve();

async function readOverridesFromSupabase(): Promise<ContentOverrides | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  try {
    const { data, error } = await admin
      .from("portal_kv")
      .select("value")
      .eq("key", PORTAL_KV_OVERRIDES_KEY)
      .maybeSingle();

    if (error) return null;
    return normalise(data?.value ?? null);
  } catch {
    return null;
  }
}

async function writeOverridesToSupabase(next: ContentOverrides): Promise<boolean> {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;

  try {
    const { error } = await admin.from("portal_kv").upsert(
      {
        key: PORTAL_KV_OVERRIDES_KEY,
        value: next as unknown as Json,
      },
      { onConflict: "key" },
    );
    return !error;
  } catch {
    return false;
  }
}

export async function readOverrides(): Promise<ContentOverrides> {
  const remote = await readOverridesFromSupabase();
  if (remote !== null) return remote;
  return contentStore.read();
}

export async function writeOverrides(
  next: ContentOverrides,
): Promise<ContentOverrides> {
  const persistedRemotely = await writeOverridesToSupabase(next);
  if (persistedRemotely) return next;
  return contentStore.withLock(() => ({ next, result: next }));
}

/** Serialized read-modify-write so concurrent admin saves cannot clobber each other. */
export async function updateOverrides(
  mutate: (current: ContentOverrides) => ContentOverrides,
): Promise<ContentOverrides> {
  const admin = getSupabaseAdminClient();
  if (admin) {
    const run = kvWriteQueue.then(async () => {
      const current = await readOverrides();
      const next = mutate(current);
      const saved = await writeOverridesToSupabase(next);
      if (saved) return next;
      return contentStore.withLock(() => ({ next, result: next }));
    });
    kvWriteQueue = run.catch(() => undefined);
    return run;
  }

  return contentStore.withLock((current) => {
    const next = mutate(current);
    return { next, result: next };
  });
}

function applyPatch<T extends { slug: string }>(
  record: T,
  patch: PatchFields<Omit<T, "slug">> | undefined,
): T {
  if (!patch) return record;
  const merged: Record<string, unknown> = { ...record };
  for (const [key, value] of Object.entries(patch)) {
    if (key === "slug") continue;
    if (value === null) {
      delete merged[key];
    } else if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as T;
}

function mergeCollection<T extends { slug: string }>(
  base: T[],
  collection: CollectionOverride<T>,
): T[] {
  const archived = new Set(collection.archived);
  const seen = new Set<string>();
  const merged: T[] = [];

  for (const created of collection.created) {
    if (archived.has(created.slug) || seen.has(created.slug)) continue;
    seen.add(created.slug);
    merged.push(applyPatch(created, collection.edited[created.slug]));
  }

  for (const item of base) {
    if (archived.has(item.slug) || seen.has(item.slug)) continue;
    merged.push(applyPatch(item, collection.edited[item.slug]));
  }

  return merged;
}

function archivedFromCollection<T extends { slug: string }>(
  base: T[],
  collection: CollectionOverride<T>,
): T[] {
  const archived = new Set(collection.archived);
  const bySlug = new Map<string, T>();

  for (const item of [...collection.created, ...base]) {
    if (archived.has(item.slug) && !bySlug.has(item.slug)) {
      bySlug.set(item.slug, applyPatch(item, collection.edited[item.slug]));
    }
  }

  return [...bySlug.values()];
}

/**
 * Published notices: records written from the panel first (newest content wins
 * the top of the list anyway, since the caller sorts), then the base rows with
 * any edits applied. Archived slugs drop out of both.
 */
export function mergeAdvisories(
  base: Advisory[],
  overrides: ContentOverrides,
): Advisory[] {
  return mergeCollection(base, overrides.advisories);
}

/** Notices staff have taken off the public site, for the archive list. */
export function archivedAdvisories(
  base: Advisory[],
  overrides: ContentOverrides,
): Advisory[] {
  return archivedFromCollection(base, overrides.advisories);
}

/** Published wildlife species with staff additions and edits merged over base rows. */
export function mergeSpecies(
  base: Species[],
  overrides: ContentOverrides,
): Species[] {
  return mergeCollection(base, overrides.species);
}

/** Wildlife species archived by staff from the public catalogue. */
export function archivedSpecies(
  base: Species[],
  overrides: ContentOverrides,
): Species[] {
  return archivedFromCollection(base, overrides.species);
}

/** Park rules shown on `/guidelines`, using staff overrides when saved. */
export function mergeParkRules(
  base: ParkRule[],
  overrides: ContentOverrides,
): ParkRule[] {
  return overrides.guidelines.rules ?? base;
}

/** Lake zoning cards shown on `/guidelines`, using staff overrides when saved. */
export function mergeLakeZones(
  base: Zone[],
  overrides: ContentOverrides,
): Zone[] {
  return overrides.guidelines.zones ?? base;
}

/** Staff-created plus base packages with edits applied, including unpublished ones. */
export function applyTourEdits(
  base: Tour[],
  overrides: ContentOverrides,
): Tour[] {
  const seen = new Set<string>();
  const merged: Tour[] = [];

  for (const created of overrides.tours.created) {
    seen.add(created.slug);
    merged.push(applyPatch(created, overrides.tours.edited[created.slug]));
  }

  for (const tour of base) {
    if (seen.has(tour.slug)) continue;
    merged.push(applyPatch(tour, overrides.tours.edited[tour.slug]));
  }

  return merged;
}

/** Packages on sale: base rows minus unpublished, with staff edits applied. */
export function mergeTours(base: Tour[], overrides: ContentOverrides): Tour[] {
  const unpublished = new Set(overrides.tours.unpublished);

  return applyTourEdits(base, overrides).filter(
    (tour) => !unpublished.has(tour.slug),
  );
}
