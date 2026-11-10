/**
 * Supabase connection settings.
 *
 * Only the anon key is read here — it is safe to expose because every table is
 * protected by the row-level-security policies in `supabase/schema.sql`. A
 * service-role key must never reach the browser and is not used by this layer.
 *
 * `NEXT_PUBLIC_*` variables are inlined at build time, so they must be read as
 * literal `process.env.NEXT_PUBLIC_…` properties (not destructured or indexed)
 * for Next.js to substitute them.
 */

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || null;

export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || null;

/**
 * `false` means the app is running in demo mode: every query falls back to the
 * seed data in `lib/*.ts`, so the portal works without a database.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}
