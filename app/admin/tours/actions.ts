"use server";

/**
 * Server actions behind `/admin/tours` (PRD Module 2, "Manage tour packages").
 *
 * Scope is deliberately narrow: staff adjust the commercial facts of a package
 * — price, seats, timing, difficulty, summary — and take it off sale. The
 * itinerary, tariff breakdown and species links stay in the seed/schema because
 * they are structured content that a text field would only damage.
 *
 * As with advisories, validation runs here rather than in the form: a server
 * action is a reachable endpoint, and a price of -1 would render on the public
 * package page.
 */

import { updateTag } from "next/cache";
import { readOverrides, updateOverrides } from "@/lib/content-store";
import { cleanText, slugify, toCleanLines } from "@/lib/sanitize";
import {
  getToursForAdmin,
  TOUR_IMAGE_OPTIONS,
  type TariffLine,
  type Tour,
  type TourDifficulty,
} from "@/lib/tours";

export type TourActionResult =
  | { ok: true; slug: string; message: string }
  | { ok: false; message: string; field?: string };

const DIFFICULTIES: TourDifficulty[] = ["EASY", "MODERATE", "CHALLENGING"];

function field(formData: FormData, name: string, maxLength: number): string {
  return cleanText(String(formData.get(name) ?? ""), maxLength);
}

/**
 * Keeps the itemised tariff reconciled with the headline rate.
 *
 * The package page prints the rate and then the breakdown that adds up to it.
 * If staff raise the rate without touching the breakdown the two disagree on
 * the same card, so the split is rebalanced proportionally and the rounding
 * remainder is absorbed by the last line — which keeps the total exact.
 */
function rebalanceTariff(tariff: TariffLine[], target: number): TariffLine[] {
  const current = tariff.reduce((sum, line) => sum + line.amount, 0);
  if (tariff.length === 0 || current === target || current <= 0) return tariff;

  const scaled = tariff.map((line) => ({
    ...line,
    amount: Math.round((line.amount * target) / current),
  }));

  const drift = target - scaled.reduce((sum, line) => sum + line.amount, 0);
  scaled[scaled.length - 1].amount += drift;

  return scaled;
}

function buildDefaultTariff(rate: number): TariffLine[] {
  const entrance = Math.max(50, Math.round(rate * 0.2));
  const boat = Math.round(rate * 0.55);
  const guide = rate - entrance - boat;
  return [
    { label: "Park entrance & wetland conservation fee", amount: entrance },
    { label: "Licensed local boat & operator share", amount: boat },
    { label: "Accredited park guide & briefing logistics", amount: guide },
  ];
}

function resolveTourImage(candidate: string): { image: string; imageAlt: string } {
  const matched = TOUR_IMAGE_OPTIONS.find((option) => option.path === candidate);
  if (matched) {
    return { image: matched.path, imageAlt: matched.alt };
  }
  const fallback = TOUR_IMAGE_OPTIONS[0];
  return { image: fallback.path, imageAlt: fallback.alt };
}

function wholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function saveTourAction(
  formData: FormData,
): Promise<TourActionResult> {
  const slug = field(formData, "slug", 72);
  const mode = field(formData, "mode", 16);
  const isCreate = mode === "create" || !slug;
  const title = field(formData, "title", 90);
  const category = field(formData, "category", 40) || "Eco-Tour";
  const summary = field(formData, "summary", 320);
  const duration = field(formData, "duration", 60);
  const departure = field(formData, "departure", 60);
  const difficulty = field(formData, "difficulty", 16) as TourDifficulty;
  const rawImage = field(formData, "image", 120);
  const inclusionsInput = cleanText(String(formData.get("inclusions") ?? ""), 1200);
  const rate = wholeNumber(field(formData, "ratePerPerson", 12));
  const capacity = wholeNumber(field(formData, "maxCapacity", 4));

  if (isCreate && title.length < 4) {
    return {
      ok: false,
      field: "title",
      message: "Give the package a clear title (at least 4 characters).",
    };
  }
  if (rate === null || rate < 100 || rate > 50_000) {
    return {
      ok: false,
      field: "ratePerPerson",
      message: "The rate must be a whole peso amount between ₱100 and ₱50,000.",
    };
  }
  if (capacity === null || capacity < 1 || capacity > 40) {
    return {
      ok: false,
      field: "maxCapacity",
      message: "Seats per departure must be between 1 and 40 — the boats are licensed for 40.",
    };
  }
  if (duration.length < 3) {
    return { ok: false, field: "duration", message: "How long does the trip run?" };
  }
  if (departure.length < 3) {
    return { ok: false, field: "departure", message: "Where and when does it leave?" };
  }
  if (!DIFFICULTIES.includes(difficulty)) {
    return { ok: false, field: "difficulty", message: "Pick a difficulty." };
  }
  if (summary.length < 20) {
    return {
      ok: false,
      field: "summary",
      message: "The summary is the package card — give it at least a sentence.",
    };
  }

  const tours = await getToursForAdmin();

  if (isCreate) {
    const newSlug = slugify(title, 64);
    if (!newSlug) {
      return {
        ok: false,
        field: "title",
        message: "Use letters or numbers in the package title.",
      };
    }
    if (tours.some((tour) => tour.slug === newSlug)) {
      return {
        ok: false,
        field: "title",
        message: `A package named “${newSlug}” already exists. Choose a distinct title.`,
      };
    }

    const { image, imageAlt } = resolveTourImage(rawImage);
    const parsedInclusions = toCleanLines(inclusionsInput, 10, 120);
    const inclusions =
      parsedInclusions.length > 0
        ? parsedInclusions
        : [
            "Accredited park ranger or local guide",
            "Park entrance and conservation fee",
            "Life vests and shoreline safety briefing",
          ];

    const created: Tour = {
      slug: newSlug,
      title,
      category,
      summary,
      duration,
      departure,
      ratePerPerson: rate,
      maxCapacity: capacity,
      difficulty,
      inclusions,
      image,
      imageAlt,
      itinerary: [
        {
          time: departure,
          title: "Park jetty registration & safety check",
          detail: "Confirm booking pass, fit life vests, and review zoning boundaries before departure.",
        },
        {
          time: "Main session",
          title: title,
          detail: summary,
        },
        {
          time: "Wrap-up",
          title: "Return to jetty & catch-up briefing",
          detail: "Disembark at the visitor dock and record observations with your guide.",
        },
      ],
      tariff: buildDefaultTariff(rate),
      bring: [
        "Refillable water bottle (single-use plastic is restricted inside the park)",
        "Sun protection, hat, and non-slip footwear",
      ],
      notes: [
        "Departures remain subject to wind and advisory status on the morning of the trip.",
      ],
      speciesSlugs: [],
    };

    await updateOverrides((current) => ({
      ...current,
      tours: {
        ...current.tours,
        created: [created, ...current.tours.created],
      },
    }));

    updateTag("tours");

    return {
      ok: true,
      slug: newSlug,
      message: `Created “${title}”. Visitors can now browse and inquire on /tours/${newSlug}.`,
    };
  }

  // Confirm the slug is a real package before storing a patch for it: an edit
  // against an unknown slug would sit in the file forever and never render.
  const existing = tours.find((tour) => tour.slug === slug);
  if (!existing) {
    return { ok: false, message: "That package no longer exists." };
  }

  const imageUpdate = rawImage ? resolveTourImage(rawImage) : {};

  await updateOverrides((current) => ({
    ...current,
    tours: {
      ...current.tours,
      edited: {
        ...current.tours.edited,
        [slug]: {
          ...(title.length >= 4 ? { title } : {}),
          ...(category ? { category } : {}),
          ratePerPerson: rate,
          maxCapacity: capacity,
          duration,
          departure,
          difficulty,
          summary,
          ...imageUpdate,
          // `existing` is the row with any earlier staff edits already applied,
          // so re-saving twice does not compound the rebalance.
          tariff: rebalanceTariff(existing.tariff, rate),
        },
      },
    },
  }));

  updateTag("tours");

  return {
    ok: true,
    slug,
    message: `Saved “${title.length >= 4 ? title : existing.title}”. The public package page is live.`,
  };
}

export async function setTourPublishedAction(
  slug: string,
  published: boolean,
): Promise<TourActionResult> {
  const cleanSlug = cleanText(slug, 72);
  if (!cleanSlug) {
    return { ok: false, message: "Missing package." };
  }

  const tours = await getToursForAdmin();
  const tour = tours.find((entry) => entry.slug === cleanSlug);
  if (!tour) {
    return { ok: false, message: "That package no longer exists." };
  }

  await updateOverrides((current) => {
    const others = current.tours.unpublished.filter((item) => item !== cleanSlug);
    return {
      ...current,
      tours: {
        ...current.tours,
        unpublished: published ? others : [...others, cleanSlug],
      },
    };
  });

  updateTag("tours");

  return {
    ok: true,
    slug: cleanSlug,
    message: published
      ? `“${tour.title}” is back on the public catalogue.`
      : `“${tour.title}” is off the catalogue. Existing inquiries are untouched.`,
  };
}

/** Used by the screen to show how many packages carry staff edits. */
export async function countTourOverridesAction(): Promise<number> {
  const overrides = await readOverrides();
  return (
    overrides.tours.created.length +
    Object.keys(overrides.tours.edited).length +
    overrides.tours.unpublished.length
  );
}
