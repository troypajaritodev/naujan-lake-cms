#!/usr/bin/env node
/**
 * Read-only Go-Live Preflight Checklist (`npm run go-live:check`).
 *
 * Inspects environment readiness, schema/gitignore hygiene, and (when network
 * access is available) verifies Supabase schema migrations and Ghost CMS posts
 * without ever printing secret values.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[match[1]] = value;
  }
  return values;
}

async function loadEnv() {
  const merged = {};
  for (const file of [".env", ".env.local"]) {
    try {
      Object.assign(merged, parseEnv(await readFile(path.resolve(file), "utf8")));
    } catch {
      // Missing .env files are allowed.
    }
  }
  return { ...merged, ...process.env };
}

function report(level, area, message) {
  const tag = level.padEnd(4);
  console.log(`  [${tag}] ${area.padEnd(28)} ${message}`);
}

const env = await loadEnv();
const blockers = [];
const warnings = [];

console.log("Naujan Lake Portal — Go-Live Preflight Checklist\n");

// 1. Environment & Vercel configuration readiness
const siteUrl = (env.NEXT_PUBLIC_SITE_URL || "").trim();
if (!siteUrl) {
  warnings.push("NEXT_PUBLIC_SITE_URL is unset (will use Vercel URL or localhost).");
  report("WARN", "NEXT_PUBLIC_SITE_URL", "Unset locally; set production HTTPS origin on Vercel.");
} else if (/localhost|127\.0\.0\.1/i.test(siteUrl) || siteUrl.startsWith("http://")) {
  warnings.push(`NEXT_PUBLIC_SITE_URL points to local HTTP (${siteUrl}).`);
  report("WARN", "NEXT_PUBLIC_SITE_URL", `${siteUrl} (replace with https://<domain> on Vercel).`);
} else {
  report("PASS", "NEXT_PUBLIC_SITE_URL", siteUrl);
}

const supabaseUrl = (env.NEXT_PUBLIC_SUPABASE_URL || "").trim().replace(/\/+$/, "");
const supabasePubKey = (
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ""
).trim();
const supabaseServiceKey = (env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

if (!supabaseUrl || !supabasePubKey) {
  blockers.push("Supabase URL and publishable/anon key are required.");
  report("FAIL", "Supabase Public", "Missing NEXT_PUBLIC_SUPABASE_URL or publishable/anon key.");
} else {
  report("PASS", "Supabase Public", new URL(supabaseUrl).host);
}

if (!supabaseServiceKey) {
  blockers.push("SUPABASE_SERVICE_ROLE_KEY is unset (must be set on Vercel for Postgres persistence).");
  report("FAIL", "SUPABASE_SERVICE_ROLE_KEY", "Unset locally (using .data/*.json); REQUIRED on Vercel.");
} else {
  report("PASS", "SUPABASE_SERVICE_ROLE_KEY", "Configured (server-only).");
}

const authSecret = (env.AUTH_SESSION_SECRET || "").trim();
if (!authSecret) {
  blockers.push("AUTH_SESSION_SECRET is missing.");
  report("FAIL", "AUTH_SESSION_SECRET", "Missing.");
} else if (authSecret.length < 32) {
  warnings.push("AUTH_SESSION_SECRET is shorter than 32 characters.");
  report("WARN", "AUTH_SESSION_SECRET", "Present, but shorter than recommended 32+ chars.");
} else {
  report("PASS", "AUTH_SESSION_SECRET", "Strong (>= 32 chars).");
}

const ghostUrl = (env.GHOST_URL || "").trim().replace(/\/+$/, "");
const ghostContentKey = (env.GHOST_CONTENT_API_KEY || "").trim();
const ghostAdminKey = (env.GHOST_ADMIN_API_KEY || "").trim();
const ghostWebhookSecret = (env.GHOST_WEBHOOK_SECRET || "").trim();

if (!ghostUrl || !ghostContentKey) {
  warnings.push("Ghost Content API not fully configured.");
  report("WARN", "Ghost CMS", "GHOST_URL or GHOST_CONTENT_API_KEY missing.");
} else if (/localhost|127\.0\.0\.1/i.test(ghostUrl) || ghostUrl.startsWith("http://")) {
  warnings.push(`GHOST_URL points to local HTTP (${ghostUrl}); Vercel needs an external HTTPS Ghost host.`);
  report("WARN", "Ghost CMS", `${ghostUrl} (must use external HTTPS host for Vercel).`);
} else {
  report("PASS", "Ghost CMS", `${ghostUrl} (${ghostAdminKey ? "two-way" : "read-only"})`);
}

if (!ghostWebhookSecret) {
  warnings.push("GHOST_WEBHOOK_SECRET is unset.");
  report("WARN", "Ghost Webhook", "GHOST_WEBHOOK_SECRET missing.");
} else {
  report("PASS", "Ghost Webhook", "Secret configured.");
}

const resendKey = (env.RESEND_API_KEY || "").trim();
const emailFrom = (env.EMAIL_FROM || "").trim();
const mailpitUrl = (env.MAILPIT_URL || "").trim();

if (mailpitUrl) {
  warnings.push("MAILPIT_URL is set locally — do NOT copy MAILPIT_URL to Vercel.");
  report("WARN", "Email (Mailpit)", `Capturing locally via ${mailpitUrl}; omit on Vercel.`);
}
if (!resendKey || !emailFrom) {
  warnings.push("RESEND_API_KEY or EMAIL_FROM missing for production email.");
  report("WARN", "Email (Resend)", "Missing RESEND_API_KEY or EMAIL_FROM.");
} else {
  report("PASS", "Email (Resend)", `Configured (${emailFrom}).`);
}

const paymongoKey = (env.PAYMONGO_SECRET_KEY || "").trim();
if (!paymongoKey) {
  report("INFO", "PayMongo (Optional)", "Unset — portal uses interactive modal + manual receipts + jetty cash.");
} else if (paymongoKey.startsWith("sk_test_")) {
  warnings.push("PAYMONGO_SECRET_KEY is using a test key (sk_test_).");
  report("WARN", "PayMongo (Optional)", "Using test key (sk_test_); switch to sk_live_ when taking live payments.");
} else {
  report("PASS", "PayMongo (Optional)", "Configured.");
}

// 2. Repo & Schema Hygiene
try {
  const gitignore = await readFile(path.resolve(".gitignore"), "utf8");
  const ignoresSecrets = gitignore.includes(".env*") && gitignore.includes(".data/");
  report(ignoresSecrets ? "PASS" : "FAIL", ".gitignore", ignoresSecrets ? "Ignores .env* and .data/" : "Check .env* / .data/ exclusions.");
} catch {
  report("WARN", ".gitignore", "Could not read .gitignore");
}

try {
  const schema = await readFile(path.resolve("supabase/schema.sql"), "utf8");
  const hasAllMigrations =
    schema.includes("portal_kv") &&
    schema.includes("inquiries_status_date_idx") &&
    schema.includes("user_email");
  report(hasAllMigrations ? "PASS" : "WARN", "supabase/schema.sql", hasAllMigrations ? "Includes portal_kv & production columns." : "Missing expected production schema blocks.");
} catch {
  report("WARN", "supabase/schema.sql", "Could not read schema.sql");
}

// 3. Optional remote probes (fail gracefully if offline/sandboxed)
if (supabaseUrl && supabaseServiceKey) {
  const checks = [
    { name: "DB users cols", path: "/rest/v1/users?select=address,emergency_contact&limit=1" },
    { name: "DB inquiry cols", path: "/rest/v1/tour_inquiries?select=user_email,tour_slug,tour_title,first_payment_rate,payment_proof_url&limit=1" },
    { name: "DB portal_kv", path: "/rest/v1/portal_kv?select=key&limit=1" },
  ];

  for (const item of checks) {
    try {
      const res = await fetch(`${supabaseUrl}${item.path}`, {
        headers: {
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        report("PASS", item.name, "Live in Supabase Postgres.");
      } else {
        const body = await res.text();
        blockers.push(`Supabase schema check failed for ${item.name} (HTTP ${res.status}). Run supabase/schema.sql in SQL Editor.`);
        report("FAIL", item.name, `HTTP ${res.status} — apply supabase/schema.sql (${body.slice(0, 80)})`);
      }
    } catch {
      report("SKIP", item.name, "Network unreachable in current environment.");
      break;
    }
  }
}

if (ghostUrl && ghostContentKey) {
  try {
    const res = await fetch(
      `${ghostUrl}/ghost/api/content/posts/?key=${encodeURIComponent(ghostContentKey)}&limit=all&fields=slug,title`,
      {
        headers: { Accept: "application/json", "Accept-Version": "v5.0" },
        signal: AbortSignal.timeout(10000),
      },
    );
    if (res.ok) {
      const data = await res.json();
      const posts = Array.isArray(data.posts) ? data.posts : [];
      const testPost = posts.find((p) => p.slug === "gyfyfyt");
      if (testPost) {
        warnings.push("Test post `gyfyfyt` is still published in Ghost CMS — delete/unpublish before go-live.");
        report("WARN", "Ghost Content", `Reachable (${posts.length} posts), but test post 'gyfyfyt' is still published.`);
      } else {
        report("PASS", "Ghost Content", `Reachable (${posts.length} published post(s)).`);
      }
    } else {
      report("WARN", "Ghost Content", `Returned HTTP ${res.status}.`);
    }
  } catch {
    report("SKIP", "Ghost Content", "Host unreachable from current environment.");
  }
}

console.log(`\nSummary: ${blockers.length} production blocker(s), ${warnings.length} warning(s).`);
if (blockers.length > 0) {
  process.exitCode = 1;
}
