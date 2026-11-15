import { cacheLife, cacheTag } from "next/cache";
import {
  mergeLakeZones,
  mergeParkRules,
  readOverrides,
} from "@/lib/content-store";
import {
  lakeZones,
  parkRules,
  type ParkRule,
  type Zone,
} from "@/lib/guidelines";

/** Live park rules, merging admin CMS overrides over the baseline rules. */
export async function getParkRules(): Promise<ParkRule[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("guidelines");

  const overrides = await readOverrides();
  return mergeParkRules(parkRules, overrides);
}

/** Live lake zoning cards, merging admin CMS overrides over baseline zones. */
export async function getLakeZones(): Promise<Zone[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("guidelines");

  const overrides = await readOverrides();
  return mergeLakeZones(lakeZones, overrides);
}
