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

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Advisory } from "@/lib/advisories";
import type { Tour } from "@/lib/tours";

const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_FILE = path.join(STORE_DIR, "content.json");
const TEMP_FILE = `${STORE_FILE}.tmp`;

/** Fields staff may change on an existing record. */
export type AdvisoryPatch = Partial<Omit<Advisory, "slug">>;
export type TourPatch = Partial<Omit<Tour, "slug">>;

export type ContentOverrides = {
  advisories: {
    /** Notices written from the admin panel — they have no database row. */
    created: Advisory[];
    /** Field-level edits applied over a base record, keyed by slug. */
    edited: Record<string, AdvisoryPatch>;
    /** Slugs hidden from the public site. Applies to seeds and new notices. */
    archived: string[];
  };
  tours: {
    edited: Record<string, TourPatch>;
    /** Packages pulled from the public catalogue without deleting them. */
    unpublished: string[];
  };
};

export function emptyOverrides(): ContentOverrides {
  return {
    advisories: { created: [], edited: {}, archived: [] },
    tours: { edited: {}, unpublished: [] },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Defensive read: the file is written by an older version of this module
 * whenever the shape changes, so every branch is checked before use.
 */
function normalise(raw: unknown): ContentOverrides {
  const empty = emptyOverrides();
  if (!isRecord(raw)) return empty;

  const advisories = isRecord(raw.advisories) ? raw.advisories : {};
  const tours = isRecord(raw.tours) ? raw.tours : {};

  return {
    advisories: {
      created: Array.isArray(advisories.created)
        ? (advisories.created as Advisory[])
        : [],
      edited: isRecord(advisories.edited)
        ? (advisories.edited as Record<string, AdvisoryPatch>)
        : {},
      archived: Array.isArray(advisories.archived)
        ? (advisories.archived as string[])
        : [],
    },
    tours: {
      edited: isRecord(tours.edited)
        ? (tours.edited as Record<string, TourPatch>)
        : {},
      unpublished: Array.isArray(tours.unpublished)
        ? (tours.unpublished as string[])
        : [],
    },
  };
}

export async function readOverrides(): Promise<ContentOverrides> {
  try {
    const raw = await readFile(STORE_FILE, "utf8");
    return normalise(JSON.parse(raw));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT" && process.env.NODE_ENV !== "production") {
      console.warn(
        "[content-store] could not read .data/content.json — starting empty.",
        error instanceof Error ? error.message : error,
      );
    }
    return emptyOverrides();
  }
}

export async function writeOverrides(
  next: ContentOverrides,
): Promise<ContentOverrides> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(TEMP_FILE, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  await rename(TEMP_FILE, STORE_FILE);
  return next;
}

/** Read-modify-write, so two panels open in different tabs cannot clobber. */
export async function updateOverrides(
  mutate: (current: ContentOverrides) => ContentOverrides,
): Promise<ContentOverrides> {
  const current = await readOverrides();
  return writeOverrides(mutate(current));
}

function applyPatch<T extends { slug: string }>(
  record: T,
  patch: Partial<Omit<T, "slug">> | undefined,
): T {
  if (!patch) return record;
  // `slug` is the key and is never part of a patch, so a spread is safe.
  return { ...record, ...patch, slug: record.slug };
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
  const archived = new Set(overrides.advisories.archived);
  const seen = new Set<string>();
  const merged: Advisory[] = [];

  for (const created of overrides.advisories.created) {
    if (archived.has(created.slug) || seen.has(created.slug)) continue;
    seen.add(created.slug);
    merged.push(applyPatch(created, overrides.advisories.edited[created.slug]));
  }

  for (const advisory of base) {
    if (archived.has(advisory.slug) || seen.has(advisory.slug)) continue;
    merged.push(applyPatch(advisory, overrides.advisories.edited[advisory.slug]));
  }

  return merged;
}

/** Notices staff have taken off the public site, for the archive list. */
export function archivedAdvisories(
  base: Advisory[],
  overrides: ContentOverrides,
): Advisory[] {
  const archived = new Set(overrides.advisories.archived);
  const byslug = new Map<string, Advisory>();

  for (const advisory of [
    ...overrides.advisories.created,
    ...base,
  ]) {
    if (archived.has(advisory.slug) && !byslug.has(advisory.slug)) {
      byslug.set(
        advisory.slug,
        applyPatch(advisory, overrides.advisories.edited[advisory.slug]),
      );
    }
  }

  return [...byslug.values()];
}

/** Base packages with staff edits applied, including unpublished ones. */
export function applyTourEdits(
  base: Tour[],
  overrides: ContentOverrides,
): Tour[] {
  return base.map((tour) => applyPatch(tour, overrides.tours.edited[tour.slug]));
}

/** Packages on sale: base rows minus unpublished, with staff edits applied. */
export function mergeTours(base: Tour[], overrides: ContentOverrides): Tour[] {
  const unpublished = new Set(overrides.tours.unpublished);

  return applyTourEdits(base, overrides).filter(
    (tour) => !unpublished.has(tour.slug),
  );
}
