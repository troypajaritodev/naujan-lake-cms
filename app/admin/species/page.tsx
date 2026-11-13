import type { Metadata } from "next";
import SpeciesManager from "@/components/admin/species-manager";

export const metadata: Metadata = {
  title: "Species",
  robots: { index: false, follow: false },
};

export default function AdminSpeciesPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.16em] text-sand-600 uppercase">
          Wildlife catalogue
        </p>
        <h2 className="mt-1 font-display text-[26px] text-ink">
          Species management
        </h2>
        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-ink-soft/75">
          Maintain the public species catalogue, including taxonomy, conservation
          status and featured image.
        </p>
      </div>
      <SpeciesManager />
    </div>
  );
}
