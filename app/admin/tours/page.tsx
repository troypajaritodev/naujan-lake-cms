import type { Metadata } from "next";
import { connection } from "next/server";
import StatCard from "@/components/admin/stat-card";
import TourManager from "@/components/admin/tour-manager";
import { readOverrides } from "@/lib/content-store";
import { getToursForAdmin } from "@/lib/tours";

export const metadata: Metadata = {
  title: "Packages · Admin",
};

/** The screen is priced live and must never serve a build-time list. */
export const instant = false;

const peso = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

export default async function AdminToursPage() {
  await connection();

  const [tours, overrides] = await Promise.all([
    getToursForAdmin(),
    readOverrides(),
  ]);

  const unpublished = new Set(overrides.tours.unpublished);
  const onSale = tours.filter((tour) => !unpublished.has(tour.slug));
  const edited = Object.keys(overrides.tours.edited).length;
  const averageRate = onSale.length
    ? Math.round(
        onSale.reduce((sum, tour) => sum + tour.ratePerPerson, 0) / onSale.length,
      )
    : 0;
  const seats = onSale.reduce((sum, tour) => sum + tour.maxCapacity, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Packages"
          value={tours.length}
          hint={`${onSale.length} on sale · ${tours.length - onSale.length} unpublished`}
          tone="ink"
        />
        <StatCard
          label="Average rate"
          value={peso.format(averageRate)}
          hint="Per person, across the packages on sale"
          tone="lake"
        />
        <StatCard
          label="Seats per day"
          value={seats}
          hint="Sum of the licensed capacity of every departure"
          tone="moss"
        />
        <StatCard
          label="Staff edits"
          value={edited}
          hint="Packages whose price or timing differs from the source row"
          tone="reed"
        />
      </div>

      <TourManager tours={tours} unpublished={[...unpublished]} />
    </div>
  );
}
