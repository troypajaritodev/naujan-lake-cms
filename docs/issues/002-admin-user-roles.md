# Issue 002 — The account table lists roles but cannot change them

**Labels:** `enhancement`, `admin`, `auth`
**Branch:** `feature/admin-user-roles`
**Scope:** 3 commits

## Problem

`/admin/users` shows every account with a role chip, but the chip is text. The only way an account
becomes staff is to edit `nl.users.v1` in `localStorage` by hand, and the only way staff loses
access is to clear that key. That leaves the panel in a strange position: it gates every screen on
`role === 'admin'`, yet the one action required to run it — granting that role — is not in the UI.

It is also the last row in the PRD's implementation table still marked **planned**.

## What "done" looks like

- The role chip is a control: pick Customer or Staff and the account changes immediately, with the
  greeting in the header and the route guard following on the next render.
- The change is reported back in the panel — who was promoted or demoted, and what they can do.
- A failed change says why, in the caller's words, not a generic error.
- You cannot change your own role, and the last staff account cannot be demoted. Without those
  two rules a single administrator can lock themselves out of the panel permanently.
- `tsc`, `eslint`, `next build` clean; the flow verified in a real browser.

## Out of scope

- Supabase Auth and the `users` table (Milestone 4) — roles still live in `localStorage`.
- Deleting accounts, suspending access, and editing another person's profile fields.
- Inviting staff by email; promotion works on an account that already exists.
