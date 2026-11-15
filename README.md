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
npm run db:status  # check the Supabase schema and key
```

## Status

Phase 1 (public portal), Phase 2 (admin shell), and all Admin CMS modules (`/admin/users`, `/admin/inquiries`, `/admin/subscribers`, `/admin/advisories`, `/admin/tours`, `/admin/species`, `/admin/rules`) are implemented, along with booking first-payment tracking, visitor–park messaging, QR boarding passes (`/verify`), live weather (`/api/weather`), interactive lake zoning map (`/guidelines`), and formal capstone documentation (`docs/SRS.md`, `docs/SYSTEM_DESIGN.md`). Remaining items in Milestone 4/backend setup (`supabase/schema.sql` execution, Supabase Auth, and live Resend credentials) are tracked in [`docs/BACKEND_STATUS.md`](./docs/BACKEND_STATUS.md) and [`docs/PRD.md` §12.4](./docs/PRD.md#124-implementation-status). [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) has the Vercel steps and demo-versus-live notes.

No database or `.env.local` is required to run the site — see *Data layer* below.

## Data layer

The public catalogue reads from Supabase when a project is configured, and
falls back to the seed rows in `lib/` when it is not. Nothing breaks without a
database: that is demo mode.

1. Create a Supabase project and run [`supabase/schema.sql`](./supabase/schema.sql)
   in the SQL editor. It creates the seven tables, the RLS policies and the demo
   seed rows.
2. Copy `.env.example` to `.env.local` and fill in the two public values from
   Supabase → Project Settings → API. Newer projects call the browser key
   **publishable** (`sb_publishable_…`); older ones call it **anon**. Either
   variable name works. Never expose the `service_role` key.
3. Restart `npm run dev`.
4. Run `npm run db:status` to confirm the schema is reachable. It prints one
   line per table and names the missing ones without printing any key.

| Module | Supabase table | Fallback |
| :--- | :--- | :--- |
| `lib/species.ts` | `categories`, `species` | seed catalogue in the same file |
| `lib/tours.ts` | `tours` (active rows only) | seed packages in the same file |
| `lib/advisories.ts` | `advisories` (published rows only) | seed notices in the same file |
| `lib/guidelines.ts` / `lib/guidelines-data.ts` | — | static rules/zones + `.data/content.json` CMS overrides |
| `lib/inquiries.ts` | `tour_inquiries` (planned, needs auth) | `localStorage` demo store |
| `lib/subscribers.ts` | `subscribers` (planned, needs auth) | `localStorage` demo store |

Reads are memoised with Next.js `use cache` (`cacheLife("hours")`) and tagged
`species`, `categories`, `tours` and `advisories`, so the admin CRUD can
invalidate them with `revalidateTag` once it lands.

## Email

Inquiry confirmations, accept/decline notices and withdrawal alerts (FR-2.3)
go through one transport in `lib/email.ts`:

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
