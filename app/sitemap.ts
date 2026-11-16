import type { MetadataRoute } from "next";
import { getSortedAdvisories } from "@/lib/advisories";
import { siteUrl } from "@/lib/site-url";
import { getSpecies } from "@/lib/species";
import { getTours } from "@/lib/tours";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [speciesList, tours, advisories] = await Promise.all([
    getSpecies(),
    getTours(),
    getSortedAdvisories(),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/wildlife`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/tours`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/advisories`, changeFrequency: "daily", priority: 0.9 },
    { url: `${siteUrl}/guidelines`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${siteUrl}/inquire`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${siteUrl}/subscribe`, changeFrequency: "monthly", priority: 0.6 },
  ];

  const speciesRoutes: MetadataRoute.Sitemap = speciesList.map((entry) => ({
    url: `${siteUrl}/wildlife/${entry.slug}`,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  const tourRoutes: MetadataRoute.Sitemap = tours.map((tour) => ({
    url: `${siteUrl}/tours/${tour.slug}`,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  const advisoryRoutes: MetadataRoute.Sitemap = advisories.map((advisory) => ({
    url: `${siteUrl}/advisories/${advisory.slug}`,
    lastModified: advisory.publishedAt,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  return [...staticRoutes, ...tourRoutes, ...speciesRoutes, ...advisoryRoutes];
}
