/**
 * Single source of truth for site-wide copy, navigation and park facts.
 * Facts here are deliberately limited to figures that are publicly documented.
 */

export const site = {
  name: "Naujan Lake Visitor Hub",
  park: "Naujan Lake National Park",
  tagline: "Eco-tourism & wildlife information",
  location: "Naujan, Oriental Mindoro, Philippines",
  region: "Oriental Mindoro · Philippines",
  ramsar: "Ramsar Site No. 1008",
  hours: "6:00 AM – 5:00 PM daily",
  emergency: "911",
  description:
    "The official visitor hub for Naujan Lake National Park — a Ramsar Wetland of International Importance in Oriental Mindoro, Philippines. Plan a guided boat tour, explore the wildlife catalog, and read current park advisories.",
} as const;

export type NavItem = {
  label: string;
  href: string;
  description: string;
};

export const navigation: NavItem[] = [
  {
    label: "Home",
    href: "/",
    description: "Park overview and latest highlights",
  },
  {
    label: "Wildlife",
    href: "/wildlife",
    description: "Birds, fish, reptiles and wetland flora",
  },
  {
    label: "Eco-Tours",
    href: "/tours",
    description: "Guided boat tours and accredited operators",
  },
  {
    label: "Guidelines",
    href: "/guidelines",
    description: "Park rules, lake zoning and safety",
  },
  {
    label: "Advisories",
    href: "/advisories",
    description: "Announcements and seasonal alerts",
  },
];

export const visitorLinks = [
  { label: "Plan a visit", href: "/inquire" },
  { label: "Park guidelines", href: "/guidelines" },
  { label: "Newsletter", href: "/subscribe" },
  { label: "Advisories", href: "/advisories" },
];

/** Hero figures shown in the stats rail. */
export const heroStats = [
  { value: "8,125", unit: "ha", label: "Lake surface area" },
  { value: "5th", unit: "", label: "Largest lake in the Philippines" },
  { value: "1008", unit: "", label: "Ramsar site number" },
  { value: "Oct–Mar", unit: "", label: "Migratory bird season" },
];

/**
 * Photography is served locally from /public/images.
 * Full attribution lives in /public/images/CREDITS.md (all CC BY-SA 4.0).
 */
export const imageCredits = [
  {
    file: "hero-lake.jpg",
    title: "Naujan Lake National Park View 2",
    author: "Orlan Rovira Frane",
    license: "CC BY-SA 4.0",
  },
  {
    file: "lake-canopy.jpg",
    title: "Naujan Lake National Park View 1",
    author: "Orlan Rovira Frane",
    license: "CC BY-SA 4.0",
  },
  {
    file: "shoreline.jpg",
    title: "Naujan Lake National Park View 3",
    author: "Orlan Rovira Frane",
    license: "CC BY-SA 4.0",
  },
  {
    file: "aerial.jpg",
    title: "Naujan Lake (Naujan, Oriental Mindoro; 10-06-2023)",
    author: "Patrickroque01",
    license: "CC BY-SA 4.0",
  },
  {
    file: "ducklings.jpg",
    title: "Philippine Duck and Ducklings",
    author: "Nardrey",
    license: "CC BY-SA 4.0",
  },
] as const;

/** Three ways into the park — the home page entry points. */
export const exploreCards = [
  {
    tag: "Biodiversity",
    title: "Wildlife catalog",
    description:
      "Every recorded bird, freshwater fish, reptile and plant, with conservation status, habitat and seasonality.",
    href: "/wildlife",
    cta: "Browse the catalog",
    image: "/images/ducklings.jpg",
    imageAlt:
      "A Philippine Duck leading ducklings through shallow water beneath acacia leaves",
  },
  {
    tag: "Experiences",
    title: "Eco-tours",
    description:
      "Guided birdwatching cruises, sunrise boat tours and community homestays, with published tariffs.",
    href: "/tours",
    cta: "See the packages",
    image: "/images/aerial.jpg",
    imageAlt:
      "Aerial view of Naujan Lake ringed by green shoreline and farmland",
  },
  {
    tag: "Before you go",
    title: "Guidelines",
    description:
      "Lake zoning, safety protocol and leave-no-trace rules to read before you step onto a boat.",
    href: "/guidelines",
    cta: "Read the rules",
    image: "/images/shoreline.jpg",
    imageAlt:
      "Reeds and vegetation along the shoreline of Naujan Lake",
  },
] as const;

/** Supporting points for the park overview section. */
export const overviewFacts = [
  {
    icon: "shield",
    title: "Protected area",
    body: "A national park with a strict protection zone kept closed to tourism.",
  },
  {
    icon: "bird",
    title: "Waterbird stopover",
    body: "Migratory arrivals build from October and peak through March.",
  },
  {
    icon: "anchor",
    title: "Accredited boats only",
    body: "Tours run with licensed operators and a life jacket for every passenger.",
  },
] as const;

/**
 * Advisories live in their own module now that they have a list page and a
 * detail route. Re-exported here so existing imports keep working.
 */
export type {
  Advisory,
  AdvisoryPreview,
  AdvisorySeverity,
} from "@/lib/advisories";
export { latestAdvisories } from "@/lib/advisories";

