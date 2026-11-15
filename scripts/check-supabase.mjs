#!/usr/bin/env node
/**
 * Supabase connection check.
 *
 * Reads the same public variables as the app, asks PostgREST for one row from
 * every table in `supabase/schema.sql`, and reports which ones exist. It never
 * prints the key, only the project host and per-table status — safe to paste
 * into an issue.
 *
 * Usage: npm run db:status
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

const TABLES = [
  "users",
  "categories",
  "species",
  "tours",
  "tour_inquiries",
  "advisories",
  "subscribers",
];

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
      // A missing file is normal — demo mode needs neither.
    }
  }

  return merged;
}

const env = await loadEnv();
const url = (
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL ||
  ""
).replace(/\/+$/, "");
const key =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

if (!url || !key) {
  console.log("Supabase is not configured — the app runs in demo mode.");
  console.log("Set NEXT_PUBLIC_SUPABASE_URL and one public key in .env.local.");
  process.exit(0);
}

let host = url;
try {
  host = new URL(url).host;
} catch {
  console.error(`NEXT_PUBLIC_SUPABASE_URL is not a valid URL: ${url}`);
  process.exit(1);
}

console.log(`Project: ${host}`);
console.log("");

let missing = 0;

for (const table of TABLES) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Prefer: "count=exact",
    Range: "0-0",
  };

  try {
    const response = await fetch(
      `${url}/rest/v1/${encodeURIComponent(table)}?select=*`,
      { headers },
    );

    if (response.ok) {
      const range = response.headers.get("content-range") ?? "";
      const total = range.includes("/") ? range.split("/")[1] : "?";
      console.log(`  ok      ${table.padEnd(15)} ${total} row(s)`);
      continue;
    }

    const payload = await response.json().catch(() => ({}));
    const code = payload?.code ? ` (${payload.code})` : "";
    console.log(
      `  missing ${table.padEnd(15)} HTTP ${response.status}${code} — run supabase/schema.sql`,
    );
    missing += 1;
  } catch (error) {
    console.log(
      `  error   ${table.padEnd(15)} ${error instanceof Error ? error.message : error}`,
    );
    missing += 1;
  }
}

console.log("");

if (missing === 0) {
  console.log("Schema is live. Public reads are using Supabase.");
} else {
  console.log(
    `${missing} table(s) could not be read. The app will keep serving seed data until the schema is applied.`,
  );
  process.exitCode = 1;
}
