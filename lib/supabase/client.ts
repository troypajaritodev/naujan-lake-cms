/**
 * The single Supabase entry point used by the data modules (`lib/species.ts`,
 * `lib/tours.ts`, `lib/advisories.ts`).
 *
 * The client is created with the anon key and no persisted session: this
 * milestone only reads world-readable content. Session-aware clients arrive
 * with Supabase Auth (Milestone 4), when `@supabase/ssr` takes over.
 *
 * Returns `null` in demo mode so callers can fall back to seed data instead of
 * talking to a database that has not been configured yet.
 */

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseUrl,
} from "./config";
import type { Database } from "./types";

export type Client = SupabaseClient<Database>;

const clientOptions = {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
} as const;

/**
 * One browser client (it holds no per-request state) and a fresh, stateless
 * server client per call.
 */
let browserClient: Client | null = null;

export function getSupabaseClient(): Client | null {
  if (!isSupabaseConfigured() || !supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (typeof window === "undefined") {
    return createClient<Database>(supabaseUrl, supabaseAnonKey, clientOptions);
  }

  browserClient ??= createClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    clientOptions,
  );

  return browserClient;
}
