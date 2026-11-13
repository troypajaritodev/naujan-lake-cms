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
import { cleanText } from "@/lib/sanitize";
import {
  getToursForAdmin,
  type TariffLine,
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

function wholeNumber(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

export async function saveTourAction(
  formData: FormData,
): Promise<TourActionResult> {
  const slug = field(formData, "slug", 72);
  const summary = field(formData, "summary", 320);
  const duration = field(formData, "duration", 60);
  const departure = field(formData, "departure", 60);
  const difficulty = field(formData, "difficulty", 16) as TourDifficulty;
  const rate = wholeNumber(field(formData, "ratePerPerson", 12));
  const capacity = wholeNumber(field(formData, "maxCapacity", 4));

  if (!slug) {
    return { ok: false, message: "Missing package." };
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

  // Confirm the slug is a real package before storing a patch for it: an edit
  // against an unknown slug would sit in the file forever and never render.
  const tours = await getToursForAdmin();
  const existing = tours.find((tour) => tour.slug === slug);
  if (!existing) {
    return { ok: false, message: "That package no longer exists." };
  }

  await updateOverrides((current) => ({
    ...current,
    tours: {
      ...current.tours,
      edited: {
        ...current.tours.edited,
        [slug]: {
          // Only the fields this screen owns. Everything else keeps coming from
          // the base row.
          ratePerPerson: rate,
          maxCapacity: capacity,
          duration,
          departure,
          difficulty,
          summary,
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
    message: `Saved “${existing.title}”. The public package page is live.`,
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
    Object.keys(overrides.tours.edited).length +
    overrides.tours.unpublished.length
  );
}
