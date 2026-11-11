# Accessibility notes

A static WCAG 2.1 AA pass over the public portal and the admin shell. There is
no automated axe/Lighthouse run in this repository yet (see "Follow-ups"), so
everything below was checked by reading the markup and computing the contrast
ratios from the tokens in `app/globals.css`.

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

## Follow-ups

- **Automated audit.** Run Lighthouse and axe (or `@axe-core/cli`) against a
  production build on `/`, `/wildlife`, `/wildlife/[slug]`, `/tours`,
  `/tours/[slug]`, `/advisories`, `/guidelines`, `/inquire`, `/subscribe`,
  `/login`, `/admin` once the open PRs merge. Track the scores in the README.
- **Photography.** Hero sections place light type over photographs. The
  gradients in place keep it legible on the seeded images, but new images need
  the same treatment — check the worst case (bright sky) before uploading.
- **`sand-500` icons.** Several small decorative icons (`#a89478`) measure
  about 2.8:1 against `sand-50`. They always sit next to a text label, so they
  are decorative under WCAG 1.4.11; if one ever becomes the only cue, pair it
  with text or darken it.
- **Admin tables.** Column headers are real `<th>` cells with `scope`, but the
  inquiry table has no caption. Add one when the CRUD rewrite lands in
  Milestone 2.
- **Session timeout warning.** Auth is still the demo `localStorage` layer;
  revisit announcements when Supabase Auth replaces it (Milestone 4).
