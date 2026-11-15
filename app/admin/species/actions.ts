"use server";

import { updateTag } from "next/cache";
import { readOverrides, updateOverrides } from "@/lib/content-store";
import { cleanText, slugify } from "@/lib/sanitize";
import { requireAdminSession } from "@/lib/server-auth";
import { getSpecies, getArchivedSpecies, getWildlifeGroups } from "@/lib/species";
import {
  conservationStatuses,
  seasonalities,
  type ConservationStatus,
  type Seasonality,
  type Species,
  type SpeciesPhoto,
} from "@/lib/species-meta";
import { speciesPhotos } from "@/lib/species-photos";

export type SpeciesActionResult =
  | { ok: true; slug: string; message: string }
  | { ok: false; message: string; field?: string };

function field(formData: FormData, name: string, maxLength: number): string {
  return cleanText(String(formData.get(name) ?? ""), maxLength);
}

function resolvePhoto(
  photoSrc: string,
  commonName: string,
  scientificName: string,
): SpeciesPhoto | undefined {
  if (!photoSrc) return undefined;

  const curated = Object.values(speciesPhotos).find((item) => item.src === photoSrc);
  if (curated) return curated;

  if (!photoSrc.startsWith("/images/") || photoSrc.includes("..")) {
    return undefined;
  }

  return {
    src: photoSrc,
    alt: `Illustrative photograph of ${commonName} (${scientificName})`,
    credit: "Naujan Lake park archive",
    license: "See image credits",
    licenseUrl: "/images/CREDITS.md",
    sourceUrl: "/images/CREDITS.md",
  };
}

export async function saveSpeciesAction(
  formData: FormData,
): Promise<SpeciesActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, message: "Park staff access required." };
  }

  const existingSlug = field(formData, "slug", 72);
  const commonName = field(formData, "commonName", 120);
  const localName = field(formData, "localName", 120);
  const scientificName = field(formData, "scientificName", 140);
  const group = field(formData, "group", 64);
  const status = field(formData, "status", 8) as ConservationStatus;
  const seasonality = field(formData, "seasonality", 16) as Seasonality;
  const habitat = field(formData, "habitat", 240);
  const description = field(formData, "description", 900);
  const photoSrc = field(formData, "photoSrc", 240);

  if (commonName.length < 2) {
    return { ok: false, field: "commonName", message: "Enter the species common name." };
  }
  if (scientificName.length < 3) {
    return {
      ok: false,
      field: "scientificName",
      message: "Enter the binomial scientific name (e.g. Anas luzonica).",
    };
  }

  const groups = await getWildlifeGroups();
  if (!groups.some((item) => item.slug === group)) {
    return { ok: false, field: "group", message: "Select a valid taxonomic group." };
  }
  if (!conservationStatuses.includes(status)) {
    return { ok: false, field: "status", message: "Select a valid IUCN status." };
  }
  if (!seasonalities.includes(seasonality)) {
    return { ok: false, field: "seasonality", message: "Select a seasonality option." };
  }
  if (habitat.length < 4) {
    return { ok: false, field: "habitat", message: "Describe the lake habitat briefly." };
  }
  if (description.length < 10) {
    return {
      ok: false,
      field: "description",
      message: "Add a short natural history note (at least 10 characters).",
    };
  }

  const targetSlug = existingSlug || slugify(commonName);
  if (!targetSlug) {
    return {
      ok: false,
      field: "commonName",
      message: "Common name must contain letters or numbers.",
    };
  }

  if (!existingSlug) {
    const [published, archived] = await Promise.all([
      getSpecies(),
      getArchivedSpecies(),
    ]);
    const taken = [...published, ...archived].some(
      (entry) => entry.slug === targetSlug,
    );
    if (taken) {
      return {
        ok: false,
        field: "commonName",
        message: `“${targetSlug}” is already in the catalogue — edit the existing entry instead.`,
      };
    }
  }

  const photo = resolvePhoto(photoSrc, commonName, scientificName);
  const record: Species = {
    slug: targetSlug,
    group,
    commonName,
    ...(localName ? { localName } : {}),
    scientificName,
    status,
    seasonality,
    habitat,
    description,
    ...(photo ? { photo } : {}),
  };

  await updateOverrides((current) => {
    const createdIndex = current.species.created.findIndex(
      (entry) => entry.slug === record.slug,
    );

    if (createdIndex >= 0) {
      const created = [...current.species.created];
      created[createdIndex] = record;
      return {
        ...current,
        species: { ...current.species, created },
      };
    }

    if (!existingSlug) {
      return {
        ...current,
        species: {
          ...current.species,
          created: [record, ...current.species.created],
        },
      };
    }

    const patch: Omit<Species, "slug"> = {
      group: record.group,
      commonName: record.commonName,
      localName: record.localName,
      scientificName: record.scientificName,
      status: record.status,
      seasonality: record.seasonality,
      habitat: record.habitat,
      description: record.description,
      photo: record.photo,
    };

    return {
      ...current,
      species: {
        ...current.species,
        edited: { ...current.species.edited, [record.slug]: patch },
      },
    };
  });

  updateTag("species");

  return {
    ok: true,
    slug: record.slug,
    message: existingSlug
      ? `Updated “${record.commonName}” on the public wildlife catalogue.`
      : `Added “${record.commonName}” to the public wildlife catalogue.`,
  };
}

export async function setSpeciesArchivedAction(
  slug: string,
  archived: boolean,
): Promise<SpeciesActionResult> {
  if (!(await requireAdminSession())) {
    return { ok: false, message: "Park staff access required." };
  }

  const cleanSlug = cleanText(slug, 72);
  if (!cleanSlug) {
    return { ok: false, message: "Missing species identifier." };
  }

  await updateOverrides((current) => {
    const others = current.species.archived.filter((item) => item !== cleanSlug);
    return {
      ...current,
      species: {
        ...current.species,
        archived: archived ? [...others, cleanSlug] : others,
      },
    };
  });

  updateTag("species");

  return {
    ok: true,
    slug: cleanSlug,
    message: archived
      ? "Removed from the public catalogue. You can restore it anytime under Archived."
      : "Restored to the public wildlife catalogue.",
  };
}

export async function countSpeciesOverridesAction(): Promise<number> {
  if (!(await requireAdminSession())) return 0;

  const overrides = await readOverrides();
  return (
    overrides.species.created.length +
    Object.keys(overrides.species.edited).length
  );
}
