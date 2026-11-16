import { cacheLife, cacheTag } from "next/cache";
import {
  mergeLakeZones,
  mergeParkRules,
  readOverrides,
} from "@/lib/content-store";
import { fetchGhostGuidelines } from "@/lib/ghost-cms";
import {
  lakeZones,
  parkRules,
  type ParkRule,
  type Zone,
} from "@/lib/guidelines";

/** Live park rules, merging admin CMS overrides over Ghost CMS and baseline rules. */
export async function getParkRules(): Promise<ParkRule[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("guidelines", "ghost");

  const [overrides, ghost] = await Promise.all([
    readOverrides(),
    fetchGhostGuidelines(),
  ]);
  const base = ghost?.rules && ghost.rules.length > 0 ? ghost.rules : parkRules;
  return mergeParkRules(base, overrides);
}

/** Live lake zoning cards, merging admin CMS overrides over Ghost CMS and baseline zones. */
export async function getLakeZones(): Promise<Zone[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("guidelines", "ghost");

  const [overrides, ghost] = await Promise.all([
    readOverrides(),
    fetchGhostGuidelines(),
  ]);
  const base = ghost?.zones && ghost.zones.length > 0 ? ghost.zones : lakeZones;
  return mergeLakeZones(base, overrides);
}
