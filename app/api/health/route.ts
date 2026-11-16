import { connection, NextResponse } from "next/server";
import { isSupabaseAdminConfigured } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function GET() {
  await connection();

  const supabasePublic = isSupabaseConfigured();
  const supabaseAdmin = isSupabaseAdminConfigured();
  const sessionSecret = Boolean(
    process.env.AUTH_SESSION_SECRET?.trim() ||
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.PAYMONGO_SECRET_KEY?.trim() ||
      process.env.RESEND_API_KEY?.trim() ||
      process.env.NODE_ENV !== "production",
  );
  const ghostConfigured = Boolean(
    process.env.GHOST_URL?.trim() && process.env.GHOST_CONTENT_API_KEY?.trim(),
  );
  const emailConfigured = Boolean(
    process.env.MAILPIT_URL?.trim() || process.env.RESEND_API_KEY?.trim(),
  );
  const paymongoConfigured = Boolean(process.env.PAYMONGO_SECRET_KEY?.trim());

  const isVercel = Boolean(process.env.VERCEL);
  const ok = sessionSecret && (!isVercel || supabaseAdmin);

  return NextResponse.json(
    {
      ok,
      status: ok ? "ok" : "degraded",
      storage: supabaseAdmin ? "supabase-postgres" : "local-json",
      checks: {
        supabasePublic,
        supabaseAdmin,
        sessionSecret,
        ghostConfigured,
        emailConfigured,
        paymongoConfigured,
      },
    },
    {
      status: ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
