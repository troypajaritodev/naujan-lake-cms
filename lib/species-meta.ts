/**
 * Client-safe species vocabulary (PRD FR-1.1 / FR-1.2).
 *
 * The catalogue getters in `lib/species.ts` are `"use cache"` server functions,
 * so anything a Client Component imports from that module drags `next/cache`
 * and the Supabase server client into the browser bundle. Types and display
 * labels live here instead, and `lib/species.ts` re-exports them for server
 * callers that already import from there.
 */

export type ConservationStatus = "CR" | "EN" | "VU" | "NT" | "LC" | "DD";

export type Seasonality = "RESIDENT" | "MIGRATORY" | "SEASONAL";

export type WildlifeGroup = {
  /** Matches the `categories.id` UUID from the schema. */
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string;
};

export type Species = {
  /** Supabase row ID; absent only for the local demo catalogue. */
  id?: string;
  slug: string;
  /** Matches `WildlifeGroup.slug` — the `categories` foreign key. */
  group: string;
  commonName: string;
  localName?: string;
  scientificName: string;
  status: ConservationStatus;
  seasonality: Seasonality;
  habitat: string;
  description: string;
  featuredImage?: string;
};

export const conservationLabels: Record<ConservationStatus, string> = {
  CR: "Critically endangered",
  EN: "Endangered",
  VU: "Vulnerable",
  NT: "Near threatened",
  LC: "Least concern",
  DD: "Data deficient",
};

export const seasonalityLabels: Record<Seasonality, string> = {
  RESIDENT: "Resident year-round",
  MIGRATORY: "Migratory visitor",
  SEASONAL: "Seasonal",
};

/** Display order for facet pickers — most threatened first. */
export const conservationStatuses: ConservationStatus[] = [
  "CR",
  "EN",
  "VU",
  "NT",
  "LC",
  "DD",
];

export const seasonalities: Seasonality[] = [
  "RESIDENT",
  "MIGRATORY",
  "SEASONAL",
];
