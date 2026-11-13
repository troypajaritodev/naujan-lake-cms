# Issue 001 — The admin panel has no landing page, and four smaller polish gaps

**Labels:** `enhancement`, `admin`, `ui`
**Branch:** `feature/admin-polish`
**Scope:** 3 commits

## Problem

The admin panel works, but it does not *open* well. `/admin` is a bare
`redirect("/admin/users")`, so an administrator who signs in and types the panel
root — or follows a link to it — is dropped straight into an account table with
no idea what needs their attention. The four modules (users, inquiries,
advisories, packages) exist as separate screens with no place that adds them up.

Four smaller things came out of the same review:

1. **No landing page.** `app/admin/page.tsx` is a redirect, so the shell header
   flashes "Administration" and the panel has no overview of pending work.
2. **No loading or error boundaries.** `app/` has no `loading.tsx` and no
   `error.tsx`. The admin pages are now request-time (`await connection()`), so
   moving between them leaves the content area blank until the server answers,
   and a thrown server action takes out the whole screen.
3. **The PRD is stale.** `docs/PRD.md` §12.4 still marks "Publish advisories"
   and "Manage tour packages" as **Planned**, but both shipped in
   `feature/admin-crud` (`bd00fde`, `557c478`).

## What "done" looks like

- `/admin` renders an overview: what needs attention (pending inquiries with
  guest, package and age), four module counters, and a way into each screen.
- Navigating between admin screens shows a skeleton instead of blank space, and
  a failure inside the segment shows a recoverable error card, not a white page.
- The PRD status table matches what is actually built.
- `tsc`, `eslint`, `next build` clean; the overview verified in a real browser
  against seeded data.

## Checked and dismissed

The sidebar footer looked like it clipped "View site" to "V site" in a
screenshot. It does not: the button measures 93 px with `scrollWidth ===
clientWidth` inside a 224 px row, and the overlap is the Next.js dev-tools
indicator in the bottom-left corner, which never renders in a production
build. No change made.

## Out of scope

- Supabase Auth / middleware (Requirement F).
- Moving inquiries off `localStorage`.
- New CMS features beyond what already ships.
