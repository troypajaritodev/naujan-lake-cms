import { z } from "zod";
import type { Tour } from "@/lib/tours";

const tourIdSchema = z.string().uuid();

const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase, hyphen-separated slug.");

const moneySchema = z
  .number()
  .finite()
  .min(0)
  .max(99_999_999.99)
  .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, {
    message: "Use no more than two decimal places.",
  });

export const tourAdminInputSchema = z
  .object({
    id: tourIdSchema.optional(),
    title: z.string().trim().min(1, "Enter a tour title.").max(160),
    slug: slugSchema,
    category: z.string().trim().min(1, "Enter a category.").max(100),
    summary: z.string().trim().min(1, "Enter a summary.").max(2000),
    duration: z.string().trim().min(1, "Enter a duration.").max(100),
    departure: z.string().trim().min(1, "Enter departure details.").max(160),
    ratePerPerson: moneySchema,
    maxCapacity: z.number().int().min(1).max(60),
    difficulty: z.enum(["EASY", "MODERATE", "CHALLENGING"]),
    inclusions: z.array(z.string().trim().min(1).max(200)).max(40),
    whatToBring: z.array(z.string().trim().min(1).max(200)).max(40),
    notes: z.array(z.string().trim().min(1).max(500)).max(40),
    speciesSlugs: z.array(slugSchema).max(60),
    itinerary: z
      .array(
        z.object({
          time: z.string().trim().min(1, "Enter a time.").max(80),
          title: z.string().trim().min(1, "Enter a stop title.").max(160),
          detail: z.string().trim().min(1, "Enter a stop description.").max(1000),
        }),
      )
      .max(40),
    tariff: z
      .array(
        z.object({
          label: z.string().trim().min(1, "Enter a tariff label.").max(160),
          amount: moneySchema,
        }),
      )
      .max(40),
    featuredImage: z
      .string()
      .trim()
      .min(1, "Enter a featured image path or URL.")
      .max(500)
      .regex(/^(\/(?!\/)|https:\/\/)/i, "Use a local path or an HTTPS image URL."),
  })
  .superRefine((tour, context) => {
    const tariffCents = tour.tariff.reduce(
      (total, line) => total + Math.round(line.amount * 100),
      0,
    );
    if (tariffCents !== Math.round(tour.ratePerPerson * 100)) {
      context.addIssue({
        code: "custom",
        path: ["tariff"],
        message: "Tariff lines must total the per-person rate.",
      });
    }
  });

export type TourAdminInput = z.infer<typeof tourAdminInputSchema>;

export type TourAdminRecord = Tour & {
  id: string;
  isActive: boolean;
};

export type TourSpeciesOption = {
  slug: string;
  commonName: string;
  scientificName: string;
};
