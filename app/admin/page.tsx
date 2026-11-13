import type { Metadata } from "next";
import { connection } from "next/server";
import AdminOverview from "@/components/admin/admin-overview";
import { getArchivedAdvisories, getSortedAdvisories } from "@/lib/advisories";
import { readOverrides } from "@/lib/content-store";
import { getToursForAdmin } from "@/lib/tours";

export const metadata: Metadata = {
  title: "Overview · Admin",
};

/** Counters and the expiry window are read at request time. */
export const instant = false;

const FULL_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function todayLabel(): string {
  const now = new Date();
  return `${now.getUTCDate()} ${FULL_MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;
}

function isoToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * The panel's landing page. Until this existed `/admin` redirected straight to
 * the account table, so a signed-in administrator had no view of the park's
 * state — only four separate screens.
 *
 * Server data (notices, packages) is resolved here and passed down; the
 * inquiry queue and the account list live in `localStorage`, so they are read
 * in the client component that renders them.
 */
export default async function AdminOverviewPage() {
  await connection();

  const [published, archived, tours, overrides] = await Promise.all([
    getSortedAdvisories(),
    getArchivedAdvisories(),
    getToursForAdmin(),
    readOverrides(),
  ]);

  const unpublished = new Set(overrides.tours.unpublished);
  const onSale = tours.filter((tour) => !unpublished.has(tour.slug));
  const pinned = published.find((advisory) => advisory.isActiveBanner);
  const critical = published.filter(
    (advisory) => advisory.severity === "CRITICAL",
  ).length;
  const today = isoToday();
  const horizon = addDays(30);
  const expiring = published.filter(
    (advisory) =>
      advisory.effectiveUntil &&
      advisory.effectiveUntil >= today &&
      advisory.effectiveUntil <= horizon,
  ).length;

  const averageRate = onSale.length
    ? Math.round(
        onSale.reduce((sum, tour) => sum + tour.ratePerPerson, 0) / onSale.length,
      )
    : 0;

  return (
    <AdminOverview
      today={todayLabel()}
      notices={{
        published: published.length,
        archived: archived.length,
        critical,
        expiring,
        pinnedTitle: pinned?.title ?? null,
      }}
      packages={{
        total: tours.length,
        onSale: onSale.length,
        averageRate,
      }}
    />
  );
}
