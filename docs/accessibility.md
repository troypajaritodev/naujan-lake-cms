# Accessibility notes

A static WCAG 2.1 AA pass over the public portal and the admin shell,
followed by an automated Lighthouse 13.6 audit against a production build
(`next start`). Everything below was checked by reading the markup, computing
the contrast ratios from the tokens in `app/globals.css`, and running the
Lighthouse/axe category audits (2026-11-12).

## What is in place

| Area | Where | Note |
| :--- | :--- | :--- |
| Language | `app/layout.tsx` | `<html lang="en">` |
| Skip link | `app/layout.tsx` | "Skip to content" → `#main`, visible on focus |
| Landmarks | `SiteHeader`, `SiteChrome` | `header` / `nav` / `main#main` / `footer` |
| Focus indicator | `app/globals.css` | `:focus-visible { outline: 2px solid var(--color-lake-600); outline-offset: 3px }` |
| Current page | `SiteHeader` | `aria-current="page"` on desktop and mobile nav |
| Menu button | `SiteHeader` | `aria-expanded`, `aria-controls`, label swaps Open/Close, Escape closes |
| Mobile drawer | `SiteHeader` | Closed links are `tabIndex={-1}` and the wrapper is `aria-hidden` |
| Icon buttons | header, auth forms, admin shell | visible text or `aria-label`; decorative icons are `aria-hidden` |
| Toggle filters | `app/admin/users`, wildlife filter bar | `aria-pressed` / native controls |
| Forms | auth, inquiry, subscribe | every control has a `<label>`; errors use `role="alert"`; email field sets `aria-invalid` + `aria-describedby` |
| Result counts | wildlife filter bar | `aria-live="polite"` |
| Images | all `next/image` uses | meaningful `alt` from the record, `alt=""` for the decorative visit banner |
| Motion | `app/globals.css` | `prefers-reduced-motion` disables animation and smooth scrolling |
| Text wrapping | `app/globals.css` | `text-wrap: balance` on headings, `pretty` on paragraphs |

## Contrast

Normal text needs 4.5:1, large text and UI graphics 3:1.

- `--color-sand-600` was `#8d7a61`, which measured **3.96:1** on `sand-50` — below
  AA for the small uppercase labels that use it. It is now `#7c6a54`
  (**4.65:1** on `sand-100`, **4.9:1** on `sand-50`, **5:1** on white).
- The focus outline (`lake-600`) measures **4.55:1** on `sand-50` and **3.56:1**
  on `lake-950`, so one colour works on both light and dark surfaces.
- Body copy on dark sections uses `sand-200/75` or lighter, all above 6:1.
- `alert-700` on `alert-50` (severity badges) is about **8:1**.

## Automated audit (Lighthouse 13.6)

Run against `next start` (production build) on every public route, plus
field-style web vitals collected with `PerformanceObserver` (LCP/CLS) and the
mobile-throttled lab run for the lab score.

| Route | Accessibility | Best practices | SEO | LCP | CLS |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/` | 1.0 | 1.0 | 1.0 | 0.32s | 0 |
| `/wildlife` | 1.0 | 1.0 | 1.0 | 0.22s | 0 |
| `/wildlife/[slug]` | 1.0 | 1.0 | 1.0 | 0.42s | 0 |
| `/tours` | 1.0 | 1.0 | 1.0 | 0.36s | 0 |
| `/tours/[slug]` | 1.0 | 1.0 | 1.0 | 0.68s | 0 |
| `/advisories` | 1.0 | 1.0 | 1.0 | 0.20s | 0 |
| `/guidelines` | 1.0 | 1.0 | 1.0 | 0.23s | 0 |
| `/inquire` | 1.0 | 1.0 | 1.0 | 0.23s | 0 |
| `/subscribe` | 1.0 | 1.0 | 1.0 | 0.26s | 0 |
| `/login` | 1.0 | 1.0 | n/a¹ | 0.22s | 0 |

¹ `/login`, `/register`, `/account` and `/admin` are deliberately
`robots: { index: false }` (auth/admin chrome must not be indexed), so their
SEO category score is expected to be below 1 and is not tracked.

Targets: accessibility 1.0, SEO ≥ 0.9 on indexable pages, LCP < 2.0s,
CLS < 0.1 — all met. Mobile-throttled lab LCP/CLS on `/`, `/wildlife/[slug]`
and `/guidelines` were 0.79–1.09s / 0, also inside target.

### Findings fixed in the audit pass

| Finding | Where | Fix |
| :--- | :--- | :--- |
| `color-contrast` 2.8:1 | `components/home/explore-cards.tsx` — `text-sand-500` card numerals | → `text-sand-600` (4.9:1) |
| `color-contrast` 2.01:1 | `components/guidelines/zoning-section.tsx`, `app/guidelines/page.tsx` — `text-sand-400` mono numerals | → `text-sand-600` |
| `color-contrast` ~4.1:1 | `components/subscribe/subscribe-form.tsx` — `text-ink-soft/70` topic descriptions | → `text-ink-soft/85` |
| `label-content-name-mismatch` | `components/site-header.tsx` — brand link `aria-label` said "…— home" which did not contain the visible "Naujan Lake National Park" | dropped the redundant `aria-label`; the visible text is the accessible name |
| `definition-list` / `dlitem` | `components/home/visit-cta.tsx` — `<dt>`/`<dd>` wrapped in extra `div`s inside `<dl>` | icon moved inside `<dt>`, `<dd>` a direct child of the group wrapper |

## Follow-ups

- **Photography.** Hero sections place light type over photographs. The
  gradients in place keep it legible on the seeded images, but new images need
  the same treatment — check the worst case (bright sky) before uploading.
- **Admin tables.** Column headers are real `<th>` cells with `scope`, but the
  inquiry table has no caption. Add one when the CRUD rewrite lands in
  Milestone 2.
- **Session timeout warning.** Auth is still the demo `localStorage` layer;
  revisit announcements when Supabase Auth replaces it (Milestone 4).
