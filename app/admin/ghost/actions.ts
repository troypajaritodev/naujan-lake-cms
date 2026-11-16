"use server";

import { updateTag } from "next/cache";
import {
  getArchivedAdvisories,
  getSortedAdvisories,
} from "@/lib/advisories";
import { getGhostStatus } from "@/lib/ghost";
import {
  pushAdvisoryToGhost,
  pushRulesToGhost,
  pushSpeciesToGhost,
  pushTourToGhost,
  pushZonesToGhost,
  type GhostSyncResult,
} from "@/lib/ghost-cms";
import { getLakeZones, getParkRules } from "@/lib/guidelines-data";
import { requireAdminSession } from "@/lib/server-auth";
import { getArchivedSpecies, getSpecies } from "@/lib/species";
import { getTours, getToursForAdmin } from "@/lib/tours";

export type GhostBulkSyncResult = {
  ok: boolean;
  pushed: number;
  failed: number;
  message: string;
};

async function runLimited<T>(
  tasks: readonly (() => Promise<T>)[],
  concurrency = 4,
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const idx = cursor++;
      results[idx] = await tasks[idx]();
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, tasks.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return results;
}

/**
 * Pushes all current park advisories, tours, wildlife species, park rules, and
 * lake zones into Ghost CMS so Ghost Studio holds a complete editable mirror.
 */
export async function syncAllToGhostAction(): Promise<GhostBulkSyncResult> {
  if (!(await requireAdminSession())) {
    return {
      ok: false,
      pushed: 0,
      failed: 0,
      message: "Park staff access required.",
    };
  }

  if (!getGhostStatus().adminApiReady) {
    return {
      ok: false,
      pushed: 0,
      failed: 0,
      message:
        "Configure GHOST_URL and GHOST_ADMIN_API_KEY in .env.local before syncing to Ghost CMS.",
    };
  }

  const [
    publishedAdvisories,
    archivedAdvisories,
    allTours,
    onSaleTours,
    publishedSpecies,
    archivedSpecies,
    rules,
    zones,
  ] = await Promise.all([
    getSortedAdvisories(),
    getArchivedAdvisories(),
    getToursForAdmin(),
    getTours(),
    getSpecies(),
    getArchivedSpecies(),
    getParkRules(),
    getLakeZones(),
  ]);

  const onSaleSlugs = new Set(onSaleTours.map((tour) => tour.slug));

  const jobs: (() => Promise<GhostSyncResult>)[] = [
    ...publishedAdvisories.map(
      (entry) => () => pushAdvisoryToGhost(entry, "published"),
    ),
    ...archivedAdvisories.map(
      (entry) => () => pushAdvisoryToGhost(entry, "draft"),
    ),
    ...allTours.map(
      (tour) => () =>
        pushTourToGhost(tour, onSaleSlugs.has(tour.slug) ? "published" : "draft"),
    ),
    ...publishedSpecies.map(
      (entry) => () => pushSpeciesToGhost(entry, "published"),
    ),
    ...archivedSpecies.map(
      (entry) => () => pushSpeciesToGhost(entry, "draft"),
    ),
    () => pushRulesToGhost(rules),
    () => pushZonesToGhost(zones),
  ];

  const outcomes = await runLimited(jobs, 4);
  let pushed = 0;
  let failed = 0;
  let firstError = "";

  for (const outcome of outcomes) {
    if (outcome.synced) {
      pushed++;
    } else if (!outcome.skipped) {
      failed++;
      if (!firstError && outcome.error) {
        firstError = outcome.error;
      }
    }
  }

  for (const tag of ["advisories", "tours", "species", "guidelines", "ghost"]) {
    updateTag(tag);
  }

  if (failed > 0) {
    return {
      ok: false,
      pushed,
      failed,
      message: `Synced ${pushed} item${pushed === 1 ? "" : "s"} to Ghost CMS, with ${failed} failure${failed === 1 ? "" : "s"}${firstError ? `: ${firstError}` : "."}`,
    };
  }

  return {
    ok: true,
    pushed,
    failed: 0,
    message: `Synced all ${pushed} items (advisories, tours, wildlife species, rules & zones) to Ghost CMS.`,
  };
}
