/**
 * Park advisories (PRD Module 4 / FR-4.1).
 *
 * Mirrors the `advisories` table in `supabase/schema.sql`. Dates are stored as
 * ISO strings and formatted with a fixed table so the output is identical on
 * the server and in the browser.
 */

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

export const advisories: Advisory[] = [
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

/** Newest first — the order the list page and the preview both use. */
export const sortedAdvisories: Advisory[] = [...advisories].sort((a, b) =>
  b.publishedAt.localeCompare(a.publishedAt),
);

function toPreview(advisory: Advisory): AdvisoryPreview {
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

/** The three newest, for the home page. */
export const latestAdvisories: AdvisoryPreview[] =
  sortedAdvisories.slice(0, 3).map(toPreview);

export function getAdvisory(slug: string): Advisory | undefined {
  return advisories.find((advisory) => advisory.slug === slug);
}

export function relatedAdvisories(slug: string, limit = 3): Advisory[] {
  return sortedAdvisories
    .filter((advisory) => advisory.slug !== slug)
    .slice(0, limit);
}
