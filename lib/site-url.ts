/**
 * The canonical public URL of this deployment.
 *
 * Order of preference:
 *   1. `NEXT_PUBLIC_SITE_URL` — set this explicitly in production.
 *   2. `VERCEL_PROJECT_PRODUCTION_URL` — provided automatically by Vercel, so a
 *      first deploy already renders correct canonical links.
 *   3. localhost for development.
 *
 * Only server code imports this (metadata and email templates); `NEXT_PUBLIC_`
 * variables are still read literally so Next.js can inline them.
 */

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;

  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl();
