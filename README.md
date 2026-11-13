Project Title: Naujan Lake Eco-Tourism and Wildlife Information Management System Using Ghost Content Management System.

Student Name: Pajarito, Troy R.


Course and Section: BSIT-3F3


Project Description: The proposed system can generate income through eco-tourism packages, promotional listings for local tourism businesses, membership subscriptions, and partnerships with tour guides and local establishments. The platform may also provide paid promotional features for accredited resorts, restaurants, tour operators, and other tourism-related businesses. These revenue sources can help support the maintenance, hosting, content management, and future development of the system while promoting Naujan Lake as an eco-tourism destination.

Technologies Used: Next.js 16 (App Router, Turbopack), React 19, TypeScript 5, Tailwind CSS v4, Supabase (PostgreSQL + PostgREST), lucide-react.

---

## Running the project

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run lint     # eslint
```

## Status

Phase 1 (public portal) and Phase 2 (admin shell) are implemented. Phase 3 is in
progress: the Supabase read layer, the site-wide advisory banner, species
records with search and filters, related tours, inquiry emails, baseline
security and a WCAG notes pass have shipped; species CRUD now uses protected
server actions. Supabase Auth and the remaining RLS verification are next. The
per-use-case status table lives in
[`docs/PRD.md` §12.4](./docs/PRD.md#124-implementation-status).

No database or `.env.local` is required to run the site — see *Data layer* below.

## Data layer

The public catalogue reads from Supabase when a project is configured, and
falls back to the seed rows in `lib/` when it is not. Nothing breaks without a
database: that is demo mode.

1. Create a Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql)
   in the SQL editor. It creates the seven tables, the RLS policies and the demo
   seed rows.
2. Run [`supabase/seed_species.sql`](./supabase/seed_species.sql) in the SQL
   editor after the schema. It imports the 18 existing catalogue records with
   stable IDs and `ON CONFLICT (slug) DO NOTHING`, so re-running it does not
   duplicate records or overwrite edits.
3. Copy `.env.example` to `.env.local`. Set the public URL and anon key from
   Supabase → Project Settings → API. To enable admin species CRUD, also set
   `SUPABASE_SERVICE_ROLE_KEY` there and in the server deployment environment;
   never expose that key to the browser or use a `NEXT_PUBLIC_` prefix.
4. Restart `npm run dev`.

Admin sign-in verifies the active admin row and password hash in `public.users`
before issuing an eight-hour HttpOnly session cookie. CRUD uses the server-only
service-role client; the browser anon key and public RLS policies are not used
to authorize writes. Without the service-role key, public reads still work but
admin species CRUD reports a configuration error.

| Module | Supabase table | Fallback |
| :--- | :--- | :--- |
| `lib/species.ts` | `categories`, `species` | seed catalogue when unconfigured or a query fails |
| `lib/tours.ts` | `tours` (active rows only) | seed packages in the same file |
| `lib/advisories.ts` | `advisories` (published rows only) | seed notices in the same file |
| `lib/guidelines.ts` | — | static copy (no table yet) |
| `lib/inquiries.ts` | `tour_inquiries` (planned, needs auth) | `localStorage` demo store |
| `lib/subscribers.ts` | `subscribers` (planned, needs auth) | `localStorage` demo store |

Reads are memoised with Next.js `use cache` (`cacheLife("hours")`) and tagged
`species`, `categories`, `tours` and `advisories`. Species admin actions use
`updateTag("species")` so edits and deletes are visible on the public pages
immediately. A configured but empty species table remains empty until seeded;
it does not silently substitute the demo records.

## Email

Inquiry confirmations and staff alerts (FR-2.3) go through one transport in
`lib/email.ts`:

- With `RESEND_API_KEY` and `EMAIL_FROM` set, messages are sent through
  [Resend](https://resend.com) (plain text, 8 s timeout, never throws into the
  request that triggered them).
- Without them the full message is printed to the server console, so the flow
  can be exercised offline. `PARK_NOTIFICATION_EMAIL` chooses the staff inbox
  and `NEXT_PUBLIC_SITE_URL` the links inside the messages — see
  `.env.example`.

## Accessibility

`docs/accessibility.md` records the WCAG 2.1 AA pass and the automated
Lighthouse 13.6 audit against the production build: accessibility 1.0,
best-practices 1.0 and SEO 1.0 on every public route (auth/admin pages are
deliberately noindexed), with LCP ≤ 0.68s and CLS = 0 on all ten routes.
The doc also lists the contrast/aria fixes the audit surfaced and the
remaining follow-ups (admin table captions).

Inquiry and subscriber records stay in the browser until Supabase Auth is
wired up (Milestone 4 of issue #1): the staff-facing reads are protected by
`is_admin()`, so moving them now would show an empty admin panel.
