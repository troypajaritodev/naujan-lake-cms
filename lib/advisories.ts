/**
 * Park advisories (PRD Module 4 / FR-4.1).
 *
 * Reads the `advisories` table when Supabase is configured, otherwise the seed
 * notices below. Dates are stored as ISO strings and formatted with a fixed
 * table so the output is identical on the server and in the browser.
 *
 * The schema stores the body as one `content` column; paragraphs are split on
 * blank lines. Fields the table does not carry yet — badge label, category,
 * expiry and action list — fall back to neutral values until Milestone 2 adds
 * them to the CMS.
 */

import { cacheLife, cacheTag } from "next/cache";
import {
  archivedAdvisories,
  mergeAdvisories,
  readOverrides,
} from "@/lib/content-store";
import { getSupabaseClient, type Tables } from "@/lib/supabase";
import { fetchOrFallback, queryError } from "@/lib/supabase/query";

export type AdvisorySeverity = "CRITICAL" | "WARNING" | "INFO";

export type Advisory = {
  slug: string;
  title: string;
  severity: AdvisorySeverity;
  /** Short label for the badge — "Seasonal", "Warning", "Closure"… */
  severityLabel: string;
  category: "Wildlife" | "Water" | "Access" | "Operations";
  /** ISO date (yyyy-mm-dd) the notice was published. */
  publishedAt: string;
  /** ISO date the notice stops applying, when it has one. */
  effectiveUntil?: string;
  excerpt: string;
  body: string[];
  /** Concrete things a visitor has to do differently. */
  actions?: string[];
  /** Pins the notice to the site-wide banner (FR-4.2). */
  isActiveBanner?: boolean;
};

/** Shape consumed by the home-page preview list. */
export type AdvisoryPreview = {
  slug: string;
  title: string;
  severity: AdvisorySeverity;
  severityLabel: string;
  /** ISO date for <time dateTime>. */
  dateISO: string;
  /** Pre-formatted label so rendering stays deterministic. */
  date: string;
  excerpt: string;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-10-14" → "14 Oct 2026", without touching the runtime locale. */
export function formatAdvisoryDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const monthName = MONTHS[Number(month) - 1];
  if (!year || !monthName || !day) return iso;
  return `${day} ${monthName} ${year}`;
}

const seedAdvisories: Advisory[] = [
  {
    slug: "waterbird-arrivals-eastern-marsh",
    title: "Migratory waterbirds begin arriving on the eastern marsh",
    severity: "INFO",
    severityLabel: "Seasonal",
    category: "Wildlife",
    publishedAt: "2026-10-14",
    effectiveUntil: "2027-03-31",
    excerpt:
      "Early flocks of egrets and ducks have been recorded ahead of the usual November peak. Birdwatching boats are advised to keep distance from feeding groups.",
    body: [
      "The park office has logged the first flocks of the season on the eastern marsh — little egrets, great egrets and small parties of whistling duck — roughly three weeks earlier than the November peak of recent years.",
      "The birds arrive thin after the flight south and feed almost continuously for their first fortnight. Disturbance during this window costs them condition they cannot easily recover before the return migration.",
      "Boat operators holding a birdwatching booking should keep at least fifty metres from any raft of birds on open water, and cut engines rather than idling close by. The eastern marsh channel remains open to accredited boats only.",
    ],
    actions: [
      "Keep 50 m from feeding flocks and switch off the engine when drifting closer.",
      "Binoculars are required for the birdwatching package — do not approach to compensate for missing optics.",
      "Report unusual or tagged birds to the park office with the date and location.",
    ],
  },
  {
    slug: "boat-speed-restricted-river-mouths",
    title: "Boat speed restricted at the northern river mouths",
    severity: "WARNING",
    severityLabel: "Warning",
    category: "Water",
    publishedAt: "2026-10-09",
    effectiveUntil: "2026-12-15",
    excerpt:
      "Sustained rain has raised water levels and pushed debris into the channels. Operators must reduce speed and keep to the marked route.",
    body: [
      "Rain across the catchment has raised lake levels and carried floating timber and hyacinth mats into the northern river mouths. Two channels that were clear last month now carry debris below the surface.",
      "Until the levels drop, boats must travel at displacement speed through the marked route and give way to any floating vegetation mat, which can hide submerged logs.",
      "The park office is clearing the main access channel weekly. Report new obstructions at the boat landing rather than attempting to move them.",
    ],
    actions: [
      "Reduce to displacement speed between the river mouths and the main lake.",
      "Keep inside the marked route — the shortcuts are the ones with debris.",
      "Wear the life jacket for the whole crossing, not just the open water.",
    ],
  },
  {
    slug: "waterbird-census-volunteer-briefing",
    title: "Volunteer briefing for the Asian Waterbird Census",
    severity: "INFO",
    severityLabel: "Info",
    category: "Operations",
    publishedAt: "2026-09-28",
    effectiveUntil: "2027-01-20",
    excerpt:
      "Students and researchers joining the January count are invited to the orientation at the park office. Bring binoculars and a field notebook.",
    body: [
      "The annual Asian Waterbird Census takes place in the second week of January. Volunteers are counted in teams of three, each with one experienced counter and one GPS unit.",
      "A mandatory orientation is held at the park office covering the count protocol, the sector boundaries and the biosecurity rules for boots and tripods entering the marsh.",
      "Places are limited by boat capacity. Register through the park office before the end of December; transport from Naujan town is provided for registered volunteers.",
    ],
    actions: [
      "Register before 31 December — places are capped by available boats.",
      "Attend the orientation; counters cannot be deployed without it.",
      "Bring binoculars, a notebook, and footwear you can rinse at the landing.",
    ],
  },
  {
    slug: "gale-warning-boat-suspension",
    title: "Boat operations suspended under a gale warning",
    severity: "CRITICAL",
    severityLabel: "Closure",
    category: "Operations",
    publishedAt: "2026-11-09",
    effectiveUntil: "2026-11-12",
    excerpt:
      "PAGASA has raised a gale warning for the Naujan coast. All boat tours and lake crossings are suspended until the warning is lifted.",
    body: [
      "The park office has suspended all boat departures after PAGASA raised a gale warning for the Oriental Mindoro coast. This covers guided tours, research crossings and private landings.",
      "The shoreline trail and the viewing deck stay open while conditions allow. Do not move beyond the marked barrier at the jetty.",
      "The suspension is reviewed every morning at 6:00 AM. Bookings already confirmed are moved to the next safe departure at no extra cost.",
    ],
    actions: [
      "Do not board or launch any boat until the park office lifts the suspension.",
      "Call the park office before travelling if you have a booking this week.",
      "Follow the marked barrier at the jetty and keep children away from the water.",
    ],
    isActiveBanner: true,
  },
  {
    slug: "reed-bed-nesting-closure",
    title: "Reed beds closed to landing during the nesting season",
    severity: "WARNING",
    severityLabel: "Closure",
    category: "Access",
    publishedAt: "2026-09-12",
    effectiveUntil: "2026-12-31",
    excerpt:
      "The eastern reed beds are closed to landings while Philippine duck and purple heron are nesting. Boats may pass on the marked channel only.",
    body: [
      "Philippine duck — the park's flagship species and a Philippine endemic — nests in the eastern reed beds from September through December. Purple heron nest in the same stand.",
      "Landing, dragging boats onto the vegetation or pushing through the reeds destroys nests that are effectively invisible from the water. A single landing can flatten several.",
      "The marked channel through the eastern marsh stays open. The closure applies to landings and to any boat entering the vegetation, including kayaks and paddle craft.",
    ],
    actions: [
      "Stay in the marked channel through the eastern marsh.",
      "No landings, no dragging, no pushing into the reeds — including paddle craft.",
      "If a nest is visible from the channel, move on without stopping.",
    ],
  },
  {
    slug: "fishpen-harvest-schedule",
    title: "Fishpen harvest schedule for the lakeside operators",
    severity: "INFO",
    severityLabel: "Notice",
    category: "Operations",
    publishedAt: "2026-08-30",
    excerpt:
      "Registered operators harvest the shallow pens on a rotating schedule through September. Boat traffic at the southern landing will be heavier on those days.",
    body: [
      "The registered lakeside operators harvest the shallow pens on a rotating schedule through September, with landings concentrated at the southern jetty.",
      "Visitor boats are not excluded, but the landing area will be busy and parking limited on harvest days. Allow extra time before a morning departure.",
      "Buying fish directly at the landing is permitted. The park office asks that visitors do not enter the pens or walk on the netting.",
    ],
  },
  {
    slug: "trail-bridge-repair",
    title: "Shoreline trail bridge under repair until November",
    severity: "WARNING",
    severityLabel: "Detour",
    category: "Access",
    publishedAt: "2026-08-14",
    effectiveUntil: "2026-11-30",
    excerpt:
      "The timber bridge on the shoreline trail is being replaced. The research trek is rerouted onto the service road for the rest of the season.",
    body: [
      "The timber bridge carrying the shoreline trail over the western inlet has reached the end of its service life. Replacement work started this month and runs until the end of November.",
      "The educational research trek is rerouted onto the service road for the duration — a slightly longer walk with no shade in the middle section.",
      "The birdwatching and sunrise boat tours are unaffected, as neither uses the trail.",
    ],
    actions: [
      "Follow the detour signs; do not cross the closed bridge.",
      "Bring a hat and water for the exposed section of the service road.",
    ],
  },
];

/** Badge label for a severity — the schema stores only the enum. */
export const severityLabels: Record<AdvisorySeverity, string> = {
  CRITICAL: "Critical",
  WARNING: "Warning",
  INFO: "Info",
};

export function sortNewestFirst(list: Advisory[]): Advisory[] {
  return [...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export function toAdvisoryPreview(advisory: Advisory): AdvisoryPreview {
  return {
    slug: advisory.slug,
    title: advisory.title,
    severity: advisory.severity,
    severityLabel: advisory.severityLabel,
    dateISO: advisory.publishedAt,
    date: formatAdvisoryDate(advisory.publishedAt),
    excerpt: advisory.excerpt,
  };
}

function toAdvisory(row: Tables<"advisories">): Advisory {
  return {
    slug: row.slug,
    title: row.title,
    severity: row.severity,
    severityLabel: severityLabels[row.severity],
    // The table has no category column yet; the CMS milestone adds it.
    category: "Operations",
    publishedAt: row.published_at.slice(0, 10),
    excerpt: row.excerpt,
    body: row.content
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.trim())
      .filter(Boolean),
    isActiveBanner: row.is_active_banner,
  };
}

/**
 * Rows exactly as the database (or the seeds) hold them, before any staff edit.
 * Kept separate so the archive list can name a notice that is no longer
 * published.
 */
async function baseAdvisories(): Promise<Advisory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("advisories");

  const client = getSupabaseClient();
  if (!client) return seedAdvisories;

  return fetchOrFallback(
    "advisories",
    async () => {
      const { data, error } = await client
        .from("advisories")
        .select("*")
        .order("published_at", { ascending: false });

      if (error) throw queryError("advisories", error.message);
      return data && data.length > 0 ? data.map(toAdvisory) : seedAdvisories;
    },
    () => seedAdvisories,
  );
}

/** Every published notice, newest first, with the admin panel's edits applied. */
export async function getSortedAdvisories(): Promise<Advisory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("advisories");

  const [base, overrides] = await Promise.all([
    baseAdvisories(),
    readOverrides(),
  ]);

  return sortNewestFirst(mergeAdvisories(base, overrides));
}

export async function getAdvisory(slug: string): Promise<Advisory | undefined> {
  "use cache";
  cacheLife("hours");
  cacheTag("advisories");

  // Resolved against the merged list so a notice published from the panel is
  // reachable, and an archived one 404s.
  const advisories = await getSortedAdvisories();
  return advisories.find((advisory) => advisory.slug === slug);
}

/** Notices staff have taken down, for the archive half of the CMS screen. */
export async function getArchivedAdvisories(): Promise<Advisory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("advisories");

  const [base, overrides] = await Promise.all([
    baseAdvisories(),
    readOverrides(),
  ]);

  return sortNewestFirst(archivedAdvisories(base, overrides));
}

/** The newest notices, shaped for the home-page preview list. */
export async function getLatestAdvisories(limit = 3): Promise<AdvisoryPreview[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("advisories");

  const advisories = await getSortedAdvisories();
  return advisories.slice(0, limit).map(toAdvisoryPreview);
}

export async function getRelatedAdvisories(
  slug: string,
  limit = 3,
): Promise<Advisory[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("advisories");

  const advisories = await getSortedAdvisories();
  return advisories.filter((advisory) => advisory.slug !== slug).slice(0, limit);
}

/**
 * The notice that pins the site-wide banner (FR-4.2). A staff-pinned advisory
 * wins; otherwise the newest CRITICAL notice is shown automatically so an
 * emergency never waits for someone to tick a box.
 */
export async function getBannerAdvisory(): Promise<AdvisoryPreview | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("advisories");

  const advisories = await getSortedAdvisories();
  const chosen =
    advisories.find((advisory) => advisory.isActiveBanner) ??
    advisories.find((advisory) => advisory.severity === "CRITICAL") ??
    null;

  return chosen ? toAdvisoryPreview(chosen) : null;
}
