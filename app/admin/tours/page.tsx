import type { Metadata } from "next";
import TourManager from "@/components/admin/tour-manager";

export const metadata: Metadata = {
  title: "Tours",
  robots: { index: false, follow: false },
};

export default function AdminToursPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
          Visitor experiences
        </p>
        <h2 className="mt-1 font-display text-[26px] text-ink">
          Tour management
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-soft/75">
          Manage package details, itinerary, pricing and availability from the
          Supabase records used by the public tours pages.
        </p>
      </div>
      <TourManager />
    </div>
  );
}
