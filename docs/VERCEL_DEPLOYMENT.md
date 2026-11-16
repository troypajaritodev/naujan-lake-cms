# Production Deployment Guide (Vercel + Supabase + External Ghost CMS)

This portal runs as a **split architecture** in production:

1. **Vercel** — hosts the Next.js App Router frontend, Route Handlers, Server Actions, and signed session/QR pass verification.
2. **Supabase Postgres** — stores persistent relational data (`users`, `categories`, `species`, `tours`, `tour_inquiries`, `advisories`, `subscribers`, and server-only `portal_kv` overrides) using `SUPABASE_SERVICE_ROLE_KEY` on the server so Vercel serverless functions share state across cold starts and regions.
3. **External Persistent Ghost CMS Host** — runs Ghost 5 (`ghost:5-alpine` or Ghost(Pro) / Railway / Fly.io / VPS) with persistent `/var/lib/ghost/content` storage. Vercel cannot run stateful SQLite/MySQL containers directly.
4. **Resend** — delivers production transactional email (`RESEND_API_KEY` + `EMAIL_FROM`).

---

## 1. Run Database Migrations in Supabase

Before pointing Vercel at your Supabase project, apply the updated schema (`supabase/schema.sql`):

1. Open the **Supabase Dashboard → SQL Editor**.
2. Paste the contents of `supabase/schema.sql` and run it. The script is idempotent (`IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, guarded enum updates, and `ON CONFLICT DO NOTHING`).
3. Verify the new columns and table exist:
   - `public.users`: `address`, `emergency_contact`
   - `public.tour_inquiries`: `user_email`, `tour_slug`, `tour_title`, `first_payment_rate`, `payment_proof_url` (plus `ON_SITE_CASH` added to `public.payment_method`)
   - `public.portal_kv`: RLS enabled with no public policy (readable/writable only via `SUPABASE_SERVICE_ROLE_KEY`)
4. Copy the server-only key from **Supabase Dashboard → Project Settings → API → `service_role` / `secret` key** for `SUPABASE_SERVICE_ROLE_KEY`. Never prefix it with `NEXT_PUBLIC_`.

---

## 2. Host Ghost CMS Externally (HTTPS)

Deploy Ghost on a persistent container host (such as Railway, Fly.io, DigitalOcean/VPS, or Ghost(Pro)) rather than Vercel:

- **Public HTTPS URL**: Configure Ghost's external URL over HTTPS (`https://cms.<your-domain>`) and mount persistent storage at `/var/lib/ghost/content` so uploaded images, SQLite/MySQL data, and routes survive restarts.
- **Security**: Unlike local Docker development (`docker-compose.yml` sets `security__staffDeviceVerification: "false"`), keep staff device verification enabled (`true`) and configure real production SMTP credentials on Ghost so Ghost staff logins and password resets work properly.
- **Content Cleanup**: If you created local draft/test posts (such as test post `gyfyfyt`), delete or archive them in Ghost Studio before pushing or syncing production content.
- **API Keys**: In Ghost Studio (**Settings → Integrations → Add custom integration**), create an integration for Next.js and copy:
  - Content API key → `GHOST_CONTENT_API_KEY`
  - Admin API key → `GHOST_ADMIN_API_KEY`
- **Webhook on Ghost**: Add a webhook pointing to:
  ```text
  https://<your-vercel-domain>/api/webhooks/ghost
  ```
  with your generated `GHOST_WEBHOOK_SECRET` configured on both Ghost and Vercel so publishing/updating posts in Ghost immediately revalidates Next.js caches.

---

## 3. Configure Email & Optional Payments

- **Resend**: Verify your sending domain in Resend, create an API key (`RESEND_API_KEY`), and set `EMAIL_FROM` (e.g. `Naujan Lake National Park <noreply@naujanlake.gov.ph>`).
- **Do NOT set `MAILPIT_URL` on Vercel**: Leaving `MAILPIT_URL` unset in Vercel production ensures `lib/email.ts` sends through Resend instead of attempting to reach local Mailpit (`http://localhost:8025`).
- **PayMongo (optional)**: Leave `PAYMONGO_SECRET_KEY` unset if collecting GCash/Maya/Bank Transfer references with receipt verification or On-Site Cash at the jetty; set a live `sk_live_...` key only when ready for live PayMongo checkouts.

---

## 4. Vercel Environment Variables

In **Vercel → Project Settings → Environment Variables** (Production & Preview as needed):

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Production origin, e.g. `https://naujan-lake.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (`https://<ref>.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Public `sb_publishable_...` (or legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | **Server-only** `service_role` secret key (enables Postgres persistence across lambdas) |
| `AUTH_SESSION_SECRET` | Yes | Random 32+ byte secret (`openssl rand -hex 32`) for `nl_session` cookies & QR passes |
| `GHOST_URL` | Yes | External HTTPS Ghost URL (no trailing slash) |
| `GHOST_CONTENT_API_KEY` | Yes | Ghost Content API key |
| `GHOST_ADMIN_API_KEY` | Yes | Ghost Admin API key (enables "Push Catalogue to Ghost" sync) |
| `GHOST_WEBHOOK_SECRET` | Yes | Shared secret protecting `/api/webhooks/ghost` |
| `RESEND_API_KEY` | Yes | Resend API key for booking & advisory emails |
| `EMAIL_FROM` | Yes | Verified sender address in Resend |
| `PARK_NOTIFICATION_EMAIL` | Optional | Park staff inbox receiving booking alerts |
| `PAYMONGO_SECRET_KEY` | Optional | Live PayMongo secret key (`sk_live_...`) |

**Do not set `MAILPIT_URL` in Vercel.**

---

## 5. Rotate Seed Passwords & Verify Production

After deploying to Vercel:

1. **Verify `/api/health`**:
   Open `https://<your-vercel-domain>/api/health` and confirm HTTP `200` with:
   - `"storage": "supabase-postgres"`
   - `"supabasePublic": true`, `"supabaseAdmin": true`, `"sessionSecret": true`, `"ghostConfigured": true`, `"emailConfigured": true`
2. **Rotate Seed Credentials Immediately**:
   Sign in to `/auth/login` with the seeded staff account (`admin@naujanlake.ph`) and change its password in `/account` immediately, or promote a real staff account in `/admin` and suspend the demo accounts (`admin@naujanlake.ph`, `visitor@example.com`, `ana.reyes@example.com`).
3. **Sync & Test Ghost Webhook**:
   - In `/admin`, verify both badges show **Two-way sync active** and **Storage: Supabase Postgres**.
   - Publish or edit a post in Ghost Studio and confirm `/advisories` updates cleanly.
4. **Keep Local Dev Unchanged**:
   Your local `.env.local`, Docker `ghost` + `mailpit`, and `.data/*.json` fallback continue working locally whenever `SUPABASE_SERVICE_ROLE_KEY` is omitted.
