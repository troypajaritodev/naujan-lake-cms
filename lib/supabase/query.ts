/**
 * Small helper for the "database first, seed data second" pattern.
 *
 * Every read in the data layer is allowed to fail: a missing Supabase project,
 * a network error or an RLS rejection must not take the public portal down.
 * Callers pass the live query plus the seed rows they want as a fallback.
 */

export async function fetchOrFallback<T>(
  label: string,
  fetcher: () => Promise<T>,
  fallback: () => T,
): Promise<T> {
  try {
    return await fetcher();
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[supabase] ${label} failed — falling back to seed data.`,
        error instanceof Error ? error.message : error,
      );
    }
    return fallback();
  }
}

/** Turns a PostgREST/network failure into a throwable with a readable message. */
export function queryError(context: string, message: string): Error {
  return new Error(`${context}: ${message}`);
}
