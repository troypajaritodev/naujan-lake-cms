"use server";

import { updateTag } from "next/cache";
import {
  conservationStatuses,
  seasonalities,
  type Species,
  type WildlifeGroup,
} from "@/lib/species-meta";
import { requireAdminClient } from "@/lib/admin-session";

export type SpeciesAdminInput = {
  id?: string;
  slug: string;
  group: string;
  commonName: string;
  localName: string;
  scientificName: string;
  status: Species["status"];
  seasonality: Species["seasonality"];
  habitat: string;
  description: string;
  featuredImage: string;
};

function toSpecies(
  row: {
    id: string;
    slug: string;
    category_id: string;
    common_name: string;
    local_name: string | null;
    scientific_name: string;
    conservation_status: Species["status"];
    seasonality: Species["seasonality"];
    habitat: string;
    description: string;
    featured_image: string;
  },
  groupSlugById: Map<string, string>,
): Species {
  const group = groupSlugById.get(row.category_id);
  if (!group) throw new Error(`Species ${row.slug} has an unknown category.`);

  return {
    id: row.id,
    slug: row.slug,
    group,
    commonName: row.common_name,
    localName: row.local_name ?? undefined,
    scientificName: row.scientific_name,
    status: row.conservation_status,
    seasonality: row.seasonality,
    habitat: row.habitat,
    description: row.description,
    featuredImage: row.featured_image,
  };
}

function normalizeInput(input: SpeciesAdminInput) {
  const slug = input.slug.trim().toLowerCase();
  const commonName = input.commonName.trim();
  const scientificName = input.scientificName.trim();
  const habitat = input.habitat.trim();
  const description = input.description.trim();
  const featuredImage = input.featuredImage.trim();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    throw new Error("Use a lowercase, hyphen-separated slug.");
  }
  if (!commonName || !scientificName || !habitat || !description) {
    throw new Error("Complete all required species fields.");
  }
  if (!conservationStatuses.includes(input.status)) {
    throw new Error("Choose a valid conservation status.");
  }
  if (!seasonalities.includes(input.seasonality)) {
    throw new Error("Choose a valid seasonality.");
  }
  if (!/^(\/(?!\/)|https:\/\/)/i.test(featuredImage)) {
    throw new Error("Use a local path or an HTTPS image URL.");
  }

  return {
    slug,
    common_name: commonName,
    local_name: input.localName.trim() || null,
    scientific_name: scientificName,
    conservation_status: input.status,
    seasonality: input.seasonality,
    habitat,
    description,
    featured_image: featuredImage,
  };
}

export async function listAdminSpeciesAction(): Promise<{
  groups: WildlifeGroup[];
  species: Species[];
}> {
  const client = await requireAdminClient();
  const { data: categoryRows, error: categoryError } = await client
    .from("categories")
    .select("id, slug, name, description, sort_order")
    .order("sort_order", { ascending: true });

  if (categoryError) {
    throw new Error(`Could not load wildlife groups: ${categoryError.message}`);
  }

  const groups = (categoryRows ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.name,
    description: row.description ?? "",
  }));
  const groupSlugById = new Map(groups.map((group) => [group.id, group.slug]));

  const { data: speciesRows, error: speciesError } = await client
    .from("species")
    .select("*")
    .order("common_name", { ascending: true });

  if (speciesError) {
    throw new Error(`Could not load species: ${speciesError.message}`);
  }

  return {
    groups,
    species: (speciesRows ?? []).map((row) => toSpecies(row, groupSlugById)),
  };
}

export async function saveAdminSpeciesAction(
  input: SpeciesAdminInput,
): Promise<Species> {
  const client = await requireAdminClient();
  const record = normalizeInput(input);
  const { data: category, error: categoryError } = await client
    .from("categories")
    .select("id")
    .eq("slug", input.group)
    .maybeSingle();

  if (categoryError) {
    throw new Error(`Could not verify the wildlife group: ${categoryError.message}`);
  }
  if (!category) throw new Error("Choose an existing wildlife group.");

  const values = { ...record, category_id: category.id };
  const query = input.id
    ? client.from("species").update(values).eq("id", input.id)
    : client.from("species").insert(values);
  const { data, error } = await query.select("*").single();

  if (error) throw new Error(`Could not save species: ${error.message}`);

  updateTag("species");
  return toSpecies(data, new Map([[category.id, input.group]]));
}

export async function deleteAdminSpeciesAction(id: string): Promise<void> {
  if (!id) throw new Error("Choose a species record to delete.");
  const client = await requireAdminClient();
  const { data, error } = await client
    .from("species")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) throw new Error(`Could not delete species: ${error.message}`);
  if (!data?.length) throw new Error("This species record no longer exists.");

  updateTag("species");
}
