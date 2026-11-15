# Backend & database status

Last checked: 15 Nov 2026 · `npm run db:status`

## Verdict in one line

The backend is **not live yet** — the Supabase project exists and its public key
works, but the schema has not been applied, so every read and write still runs
on demo stores. Nothing is broken; the app is designed to work this way until
Milestone 4 (Supabase Auth) lands.

## What is verified

| Check | Result |
| :--- | :--- |
| Supabase project reachable | ✅ `ubdprclsrobwwnygykev.supabase.co` answers |
| Publishable key valid | ✅ accepted by PostgREST (auth works, 404s are table misses) |
| `supabase/schema.sql` applied | ❌ all 7 tables missing (`PGRST205`) |
| Public reads on Supabase | ❌ falling back to seed rows in `lib/*.ts` |
| Visitor/admin accounts | ⚠️ demo `localStorage` store (`lib/auth.ts`) |
| Tour inquiries & cancellation | ⚠️ demo `localStorage` store (`lib/inquiries.ts`) |
| Admin content writes | ⚠️ `.data/content.json` overrides (`lib/content-store.ts`) |
| Transactional email | ⚠️ demo mode — `RESEND_API_KEY`/`EMAIL_FROM` unset |

## What was fixed on 15 Nov 2026

1. **Key-name mismatch.** The code only read `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   but the project uses the newer `sb_publishable_…` key stored as
   `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Both names are now accepted
   (`lib/supabase/config.ts`), so the moment the schema is applied the public
   catalogue reads live data with no further code change.
2. **`npm run db:status`.** New diagnostic (`scripts/check-supabase.mjs`) that
   checks every table against PostgREST and prints which are missing. It never
   prints the key.
3. **Sign-out behaviour.** Signing out (site header menu, `/account`, admin
   sidebar) now always lands on `/login?signedOut=1` via a hard navigation, so
   no protected screen is left mounted, and the sign-in page confirms
   "You have been signed out."
4. **Demo credentials hidden in production.** The login form's demo-account
   block and the register note about `localStorage` now render in development
   only.

## Checklist to make the backend live (owner: Marc)

1. Run `supabase/schema.sql` in the Supabase SQL editor (idempotent; creates
   the 7 tables, enums, RLS policies and seed rows). The publishable key cannot
   create tables, so this step needs the SQL editor or the database password.
2. Re-run `npm run db:status` — it should print `Schema is live.` and row
   counts for the seeded tables.
3. Send `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (already in `.env.local`) to whoever deploys, and the Resend values
   (`RESEND_API_KEY`, `EMAIL_FROM`, `PARK_NOTIFICATION_EMAIL`) when ready.
4. Promote the test admin: `update public.users set role = 'admin' where email = '<email>';`
   — required before Phase 4, when the admin panel reads from Supabase.

## Remaining engineering work (tracked in issue #1)

- **Milestone 4 — Supabase Auth**: swap `lib/auth.ts` for `@supabase/ssr`
  (email/password + role lookups), protect `/admin` with server middleware,
  and move `tour_inquiries`/`subscribers` writes behind RLS.
- **Server actions → database**: point `lib/content-store.ts` at the
  `advisories` and `tours` tables with the service role on the server, and
  delete the JSON override store.
- **RLS verification**: exercise every policy with the anon key
  (`is_admin()` reads, public read-only on the catalogue).
