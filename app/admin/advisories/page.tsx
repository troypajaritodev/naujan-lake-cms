import type { Metadata } from "next";
import { connection } from "next/server";
import StatCard from "@/components/admin/stat-card";
import AdvisoryManager from "@/components/admin/advisory-manager";
import { getArchivedAdvisories, getSortedAdvisories } from "@/lib/advisories";

export const metadata: Metadata = {
  title: "Advisories · Admin",
};

/**
 * The page reads the clock (expiry window, "today"), so it can never render a
 * meaningful shell before the request. Opting out of instant-navigation
 * validation is the sanctioned way to say so.
 */
export const instant = false;

/** ISO date `days` from today, so the "expiring soon" count needs no library. */
function addDays(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export default async function AdminAdvisoriesPage() {
  // "Expiring in 30 days" and the published list both depend on the moment the
  // admin opens the screen, so this page renders per request. Without this,
  // Next 16 rejects `new Date()` during the static prerender — and worse, the
  // list would be frozen at whatever the build saw.
  await connection();

  const [published, archived] = await Promise.all([
    getSortedAdvisories(),
    getArchivedAdvisories(),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const horizon = addDays(30);
  const pinned = published.find((advisory) => advisory.isActiveBanner);
  const critical = published.filter(
    (advisory) => advisory.severity === "CRITICAL",
  ).length;
  const expiringSoon = published.filter(
    (advisory) =>
      advisory.effectiveUntil &&
      advisory.effectiveUntil >= today &&
      advisory.effectiveUntil <= horizon,
  ).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Published"
          value={published.length}
          hint="Live on the public notice board"
          tone="lake"
        />
        <StatCard
          label="Pinned to banner"
          value={pinned ? 1 : 0}
          hint={
            pinned
              ? `“${pinned.title}” — shows on every page`
              : "No notice pinned; a critical one is picked up automatically"
          }
          tone="moss"
        />
        <StatCard
          label="Critical"
          value={critical}
          hint="Closures and safety notices"
          tone="alert"
        />
        <StatCard
          label="Expiring in 30 days"
          value={expiringSoon}
          hint={`${archived.length} archived ${archived.length === 1 ? "notice" : "notices"}`}
          tone="ink"
        />
      </div>

      <AdvisoryManager published={published} archived={archived} />
    </div>
  );
}
