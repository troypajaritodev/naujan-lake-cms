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

function normalizeOrigin(raw: string): string | null {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const candidate = hasProtocol
    ? trimmed
    : `${/^(localhost|127\.0\.0\.1)(:|\/|$)/i.test(trimmed) ? "http" : "https"}://${trimmed}`;

  try {
    return new URL(candidate).origin;
  } catch {
    return null;
  }
}

function resolveSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    const normalized = normalizeOrigin(explicit);
    if (normalized) return normalized;
  }

  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) {
    const normalized = normalizeOrigin(vercel);
    if (normalized) return normalized;
  }

  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl();
