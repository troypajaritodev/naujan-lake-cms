import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export function getSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Admin database access is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
  }

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function getSupabaseAdminSigningKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Admin database access is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server.",
    );
  }
  return key;
}
