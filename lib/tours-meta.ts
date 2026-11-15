/**
 * Client-safe types and media catalog constants for eco-tourism packages.
 *
 * Kept separate from `lib/tours.ts` so client components (such as the admin
 * tour editor) can use `Tour` types and `TOUR_IMAGE_OPTIONS` without pulling
 * `"use cache"` / `next/cache` APIs into the browser bundle.
 */

export type TourDifficulty = "EASY" | "MODERATE" | "CHALLENGING";

export type ItineraryStop = {
  time: string;
  title: string;
  detail: string;
};

export type TariffLine = {
  label: string;
  amount: number;
};

export type Tour = {
  slug: string;
  title: string;
  category: string;
  summary: string;
  duration: string;
  departure: string;
  ratePerPerson: number;
  maxCapacity: number;
  difficulty: TourDifficulty;
  inclusions: string[];
  image: string;
  imageAlt: string;
  itinerary: ItineraryStop[];
  tariff: TariffLine[];
  bring: string[];
  notes: string[];
  /**
   * Species slugs the package is built around (FR-1.3). Read from
   * `tours.species_slugs` when Supabase is configured.
   */
  speciesSlugs: string[];
};

export const difficultyLabel: Record<TourDifficulty, string> = {
  EASY: "Easy",
  MODERATE: "Moderate",
  CHALLENGING: "Challenging",
};

export const TOUR_IMAGE_OPTIONS = [
  {
    path: "/images/tours/sunrise-boat-tour.jpg",
    label: "Sunrise bangka boat on calm water",
    alt: "Traditional wooden outrigger bangka boat gliding across golden sunrise reflections on Naujan Lake",
  },
  {
    path: "/images/ducklings.jpg",
    label: "Philippine Duck wetland wildlife",
    alt: "Philippine Duck and ducklings in shallow wetland water",
  },
  {
    path: "/images/tours/lakeside-community-homestay.jpg",
    label: "Lakeside bamboo homestay & pier",
    alt: "Bamboo and nipa stilt homestay cottage and wooden pier overlooking calm morning water at Naujan Lake",
  },
  {
    path: "/images/tours/educational-research-trek.jpg",
    label: "Wetland boardwalk & mangrove trail",
    alt: "Wooden nature boardwalk curving alongside tall wetland reeds and freshwater mangroves on Naujan Lake",
  },
  {
    path: "/images/hero-lake.jpg",
    label: "Open lake horizon & mountains",
    alt: "Open water and distant mountains under a wide sky at Naujan Lake",
  },
  {
    path: "/images/shoreline.jpg",
    label: "Calm lakeside reeds & shoreline",
    alt: "Shoreline vegetation and quiet water along Naujan Lake",
  },
  {
    path: "/images/lake-canopy.jpg",
    label: "Dense forest canopy & cove",
    alt: "Dense shoreline canopy meeting the water at Naujan Lake",
  },
  {
    path: "/images/aerial.jpg",
    label: "Aerial overview of Naujan Lake",
    alt: "Aerial view of Naujan Lake ringed by green shoreline and farmland",
  },
] as const;

export const IMAGE_ALT: Record<string, string> = Object.fromEntries(
  TOUR_IMAGE_OPTIONS.map((option) => [option.path, option.alt]),
);
