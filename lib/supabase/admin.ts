import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";
import type { Database } from "./types";

/**
 * Server-only Supabase admin client powered by `SUPABASE_SERVICE_ROLE_KEY`.
 *
 * Returns `null` when running in local/demo mode without the service-role key,
 * allowing callers (`lib/server-auth.ts`, `lib/server-inquiries.ts`,
 * `lib/server-subscribers.ts`, `lib/content-store.ts`) to fall back cleanly to
 * the local `.data/*.json` store.
 */

let cachedAdminClient: SupabaseClient<Database> | null | undefined;
let cachedEnvSignature: string | null = null;

export function getSupabaseServiceRoleKey(): string | null {
  if (typeof window !== "undefined") {
    return null;
  }
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return key || null;
}

export function isSupabaseAdminConfigured(): boolean {
  return Boolean(supabaseUrl && getSupabaseServiceRoleKey());
}

export function getSupabaseAdminClient(): SupabaseClient<Database> | null {
  if (typeof window !== "undefined") {
    return null;
  }

  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) {
    cachedAdminClient = null;
    cachedEnvSignature = null;
    return null;
  }

  const signature = `${supabaseUrl}::${serviceRoleKey}`;
  if (cachedAdminClient && cachedEnvSignature === signature) {
    return cachedAdminClient;
  }

  cachedAdminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  cachedEnvSignature = signature;

  return cachedAdminClient;
}
