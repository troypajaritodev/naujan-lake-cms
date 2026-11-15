# Deployment

The app is a standard Next.js 16 project: any Node host works. These notes use
Vercel because the repository is already on GitHub and Vercel deploys every
push to `main` automatically.

## What deployment does *not* require

The database. Without Supabase variables the app runs in **demo mode**: the
public catalogue serves the seed rows in `lib/`, and accounts/inquiries live in
the visitor's browser. A demo deployment is therefore safe and instant.

## Option A — Vercel dashboard (≈4 clicks)

1. Sign in at [vercel.com](https://vercel.com) with the GitHub account that owns
   the repository (`troypajaritodev`).
2. **Add New… → Project** → import `naujan-lake-cms`.
3. Framework preset: **Next.js** (auto-detected). Leave build settings alone.
4. Add environment variables (see table) → **Deploy**.
5. After the first deploy, set `NEXT_PUBLIC_SITE_URL` to the production URL
   (`https://<project>.vercel.app`) and redeploy once, so links inside emails
   point at the live site.

## Option B — CLI / token

```bash
npx vercel login          # opens a browser confirmation
npx vercel --prod         # first run links the project
```

For a non-interactive deploy, create a token at **Vercel → Settings → Tokens**
and set `VERCEL_TOKEN` in the shell before running `npx vercel --prod`.

## Environment variables

| Variable | Needed | Notes |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | ✅ | `https://<project>.vercel.app` — used in email links and metadata |
| `NEXT_PUBLIC_SUPABASE_URL` | optional | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | optional | `sb_publishable_…` (older projects: `NEXT_PUBLIC_SUPABASE_ANON_KEY`) |
| `RESEND_API_KEY` | later | Leave unset for now — see the security note |
| `EMAIL_FROM` | later | Verified Resend sender, e.g. `Naujan Lake <no-reply@naujanlake.gov.ph>` |
| `PARK_NOTIFICATION_EMAIL` | later | Staff inbox for booking alerts |

Never add a `service_role` key to Vercel's client-visible environment. If a
future server action needs it, keep it unprefixed (`SUPABASE_SERVICE_ROLE_KEY`)
and use it only in server code.

## Verify after deploy

- [ ] `/`, `/tours`, `/wildlife`, `/advisories`, `/guidelines` load
- [ ] `/login` → demo visitor account → `/account` loads
- [ ] `/login` → demo admin account → `/admin` loads
- [ ] `/admin/inquiries` shows the seeded queue
- [ ] Sign out lands on `/login` with the "signed out" notice
- [ ] `npm run db:status` (locally) reports whether the database is live

## Security notes for a public demo

1. **Do not set `RESEND_API_KEY` yet.** The inquiry endpoints are intentionally
   unauthenticated and accept a recipient address in the payload; with a live
   key the URL could be used to send mail to arbitrary addresses. They are rate
   limited per instance, which is not enough for a public host. Email turns on
   after Phase 4 (Supabase Auth + server-side inquiry store).
2. Demo accounts and demo inquiries are stored **per browser**. Two visitors do
   not share an admin queue; that is expected until Phase 4. Do not present the
   demo as a multi-user system.
3. The seeded accounts are demo data. If the deployment will hold real visitor
   details, finish Supabase Auth first.

## Custom domain

Vercel → Project → Settings → Domains → add the domain, then update
`NEXT_PUBLIC_SITE_URL` and redeploy. The park office owns the DNS records.

## Rollback

Vercel keeps every deployment: Project → Deployments → choose a previous build
→ **Promote to Production**. Git history is the source of truth; `main` is
protected by the CI workflow (`.github/workflows/ci.yml`).
