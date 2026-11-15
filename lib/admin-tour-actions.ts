"use server";

import { updateTag } from "next/cache";
import { requireAdminClient } from "@/lib/admin-session";
import {
  tourAdminInputSchema,
  type TourAdminInput,
  type TourAdminRecord,
  type TourSpeciesOption,
} from "@/lib/tour-validation";
import { toTour } from "@/lib/tours";
import type { Tables } from "@/lib/supabase";

function toAdminTour(row: Tables<"tours">): TourAdminRecord {
  const tour = toTour(row);
  return {
    ...tour,
    id: row.id,
    isActive: row.is_active,
  };
}

function parseTourInput(input: TourAdminInput) {
  const result = tourAdminInputSchema.safeParse(input);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message ?? "Check the tour details and try again.");
  }

  const { id, ...tour } = result.data;
  return {
    id,
    values: {
      title: tour.title,
      slug: tour.slug,
      category: tour.category,
      summary: tour.summary,
      duration: tour.duration,
      departure: tour.departure,
      rate_per_person: tour.ratePerPerson,
      max_capacity: tour.maxCapacity,
      difficulty: tour.difficulty,
      inclusions: tour.inclusions,
      what_to_bring: tour.whatToBring,
      notes: tour.notes,
      species_slugs: tour.speciesSlugs,
      itinerary: tour.itinerary,
      tariff: tour.tariff,
      featured_image: tour.featuredImage,
    },
  };
}

export async function listAdminToursAction(): Promise<TourAdminRecord[]> {
  const client = await requireAdminClient();
  const { data, error } = await client
    .from("tours")
    .select("*")
    .order("title", { ascending: true });

  if (error) throw new Error(`Could not load tours: ${error.message}`);
  return (data ?? []).map(toAdminTour);
}

export async function listAdminTourSpeciesAction(): Promise<TourSpeciesOption[]> {
  const client = await requireAdminClient();
  const { data, error } = await client
    .from("species")
    .select("slug, common_name, scientific_name")
    .order("common_name", { ascending: true });

  if (error) throw new Error(`Could not load wildlife species: ${error.message}`);

  return (data ?? []).map((species) => ({
    slug: species.slug,
    commonName: species.common_name,
    scientificName: species.scientific_name,
  }));
}

export async function saveAdminTourAction(
  input: TourAdminInput,
): Promise<TourAdminRecord> {
  const client = await requireAdminClient();
  const { id, values } = parseTourInput(input);

  if (id) {
    const { data, error } = await client
      .from("tours")
      .update(values)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) throw new Error(`Could not save tour: ${error.message}`);
    if (!data) throw new Error("This tour no longer exists.");

    updateTag("tours");
    return toAdminTour(data);
  }

  const { data, error } = await client
    .from("tours")
    .insert(values)
    .select("*")
    .single();

  if (error) throw new Error(`Could not create tour: ${error.message}`);

  updateTag("tours");
  return toAdminTour(data);
}

export async function setAdminTourActiveAction(
  id: string,
  isActive: boolean,
): Promise<void> {
  const client = await requireAdminClient();
  const parsedId = tourAdminInputSchema.shape.id.unwrap().safeParse(id);
  if (!parsedId.success) throw new Error("Choose a valid tour.");
  if (typeof isActive !== "boolean") throw new Error("Choose a valid tour status.");

  const { data, error } = await client
    .from("tours")
    .update({ is_active: isActive })
    .eq("id", parsedId.data)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(`Could not update tour status: ${error.message}`);
  if (!data) throw new Error("This tour no longer exists.");

  updateTag("tours");
}
