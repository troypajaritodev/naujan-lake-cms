import type { Metadata } from "next";
import { connection } from "next/server";
import StatCard from "@/components/admin/stat-card";
import SpeciesManager, {
  type PhotoOption,
} from "@/components/admin/species-manager";
import {
  getArchivedSpecies,
  getSpecies,
  getWildlifeGroups,
  speciesCountByStatus,
} from "@/lib/species";
import { speciesPhotos } from "@/lib/species-photos";

export const metadata: Metadata = {
  title: "Wildlife · Admin",
};

/** Reflects live species additions, edits, and archives at request time. */
export const instant = false;

function formatPhotoLabel(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

export default async function AdminSpeciesPage() {
  await connection();

  const [published, archived, groups] = await Promise.all([
    getSpecies(),
    getArchivedSpecies(),
    getWildlifeGroups(),
  ]);

  const threatened =
    speciesCountByStatus(published, "CR") +
    speciesCountByStatus(published, "EN") +
    speciesCountByStatus(published, "VU");

  const photoLibrary: PhotoOption[] = Object.entries(speciesPhotos).map(
    ([slug, photo]) => ({
      slug,
      label: formatPhotoLabel(slug),
      src: photo.src,
      credit: photo.credit,
    }),
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Published species"
          value={published.length}
          hint="Live on the /wildlife catalogue"
          tone="lake"
        />
        <StatCard
          label="Globally threatened"
          value={threatened}
          hint="Critically endangered, endangered, or vulnerable"
          tone="alert"
        />
        <StatCard
          label="Taxonomic groups"
          value={groups.length}
          hint="Active ecological categories"
          tone="moss"
        />
        <StatCard
          label="Archived"
          value={archived.length}
          hint={
            archived.length === 1
              ? "1 record hidden from public view"
              : `${archived.length} records hidden from public view`
          }
          tone="ink"
        />
      </div>

      <SpeciesManager
        published={published}
        archived={archived}
        groups={groups}
        photoLibrary={photoLibrary}
      />
    </div>
  );
}
