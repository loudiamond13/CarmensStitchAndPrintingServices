---
created: 2026-11-13T10:00:00-06:00
updated: 2026-11-14T21:46:02-06:00
---

# Phase 11: UI Review (re-audit)

**Audited:** 2026-11-14 (replaces the 2026-11-13 review)
**Baseline:** 11-UI-SPEC.md (approved)
**Screenshots:** not captured (code-only audit)
**Interaction captures:** off (workflow.ui_interaction_capture is false). All interaction findings are code-derived.

Scope: this pass read the full public copy files (`copy.ts`, `hoursCopy.ts`) against the spec's Copywriting Contract tables, and read or grepped every file in `web/src/modules/public` (components, pages, recipes) and the Phase 11 admin components. It ran whole-tree scans for dashes, hex colours, `style=`, arbitrary values, `outline-none`, reduced motion, `target=_blank`, status regions and image alts. Visual checks (focal point, 60/30/10, contrast, 320 px overflow, Espresso theme) still need screenshots and are not scored as passed.

## Pillar Scores

| Pillar | Score | Key finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Public copy matches the spec table string for string; one hard-coded label (`Breadcrumb`) sits outside the copy module. |
| 2. Visuals | 3/4 | Icon-only controls named, art is decorative, reduced motion honoured. Focal point not verifiable without a render. |
| 3. Color | 3/4 | Hex only in the two allowed SVG art files; a gate enforces it. 60/30/10 not verifiable without a render. |
| 4. Typography | 3/4 | Public sizes now named tokens behind a gate. Admin still hand-types about 13 distinct px sizes (owner ruling: name them later). |
| 5. Spacing | 3/4 | 44 px targets and the safe-area inset are in place. Footer and a few boxes use hand-typed pixel values the gate does not cover. |
| 6. Experience Design | 3/4 | Loading, error with retry, empty and confirm states are all present. Visual state checks are deferred to screenshots. |

**Overall: 18/24** (previous review: 17/24; Typography moved from 2 to 3 after R-01, all others unchanged)

## Top 3 Priority Fixes

1. **Hand-typed pixel spacing in public TSX is outside the gate (WARNING)** - `modules/public/components/SiteFooter.tsx:144` uses `pg-phone:pb-[96px]`, a number that silently depends on the sticky Contact bar height, and `SiteFooter.tsx:150` uses `max-w-[320px]`. If the bar changes height the footer text hides behind it on phones. Fix: name the bar height as a theme token (for example `--space-bar`) and use it in both the bar and the footer; extend `public-look.node.test.ts` to flag `[Npx]` padding and margin in `modules/public`. Fixed in quick 261114-t04 (see Outcomes).
2. **Admin font sizes are still hand-typed (WARNING, owner ruling carried)** - `siteContent.recipe.ts` and the other admin recipes hold `text-[11px]` to `text-[34px]` (45 uses of `[14px]` alone). The owner chose to name these in a later quick task. Keep it queued; until then the public gate does not protect the admin side.
3. **Hard-coded aria-label outside the copy module (WARNING, minor)** - `modules/public/components/PageHead.tsx:40` has `aria-label="Breadcrumb"`. The spec says public strings live in `copy.ts`. Fix: add `crumbs.label: 'Breadcrumb'` to `PUBLIC_COPY` and read it there. Fixed in quick 261114-t04 (see Outcomes).

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- Compared `modules/public/copy.ts` with the spec's Public copy and Meta description tables: hero, categories, why, steps, recent, testimonials, final CTA, products head, article, help, empty, gallery head, filters, masonry, empty, lightbox, contact, ContactNowCard, phones, map, bar, footer, 404, loading and error strings all match. Examples: `copy.ts:59` hero lead, `copy.ts:180-181` products empty, `copy.ts:199` gallery empty, `copy.ts:289-293` error pairs and "Try Again".
- `hoursCopy.ts:9-21` status lines match the HoursCard row. Day names and "Closed on" are present.
- OR-4 scan (U+2013, U+2014) of `modules/public`, `modules/admin/components`, `modules/admin/pages` and the admin copy files: zero hits outside tests.
- Admin copy (`siteContentCopy.ts`, 664 lines) was spot-compared against the S0 to S6 and O1 tables. No difference found, but it was not diffed string for string (see R-11).
- Gap: `PageHead.tsx:40` hard-codes "Breadcrumb" (new finding N-01).
- Dev-only `PublicLayoutCheckPage.tsx:19` has literal English. It is routed only from `modules/admin/routes.tsx:32` for dev builds (D-20), so it is informational.

### Pillar 2: Visuals (3/4)
- Icon-only and short-text controls carry names: social squares use the spoken name `aria-label={social.name}` (`SiteFooter.tsx:158`); the visible text "FB" is contained in the name, so label-in-name holds. Gallery tiles and the lightbox close are named (`GalleryMasonry.tsx`, `GalleryLightbox.tsx`).
- Decorative images use `alt=""` correctly inside already-named links and buttons (`RecentWorkStrip.tsx:84` inside a link with a caption; `GalleryMasonry.tsx:117` inside a named button). Product photos have real alts (`ProductMedia.tsx:44`, copy at `copy.ts:168-170`).
- Reduced motion is honoured on every hover transform (`contact.recipe.ts:56`, `gallery.recipe.ts:53`, `recent.recipe.ts:15,28`, `ProductsPage.tsx:40`, `ui/base.css:185`). No `outline-none` in the public module, so focus rings are not removed.
- External Directions link has `rel="noopener noreferrer"` and the hidden "(opens in a new tab)" text (`MapCard.tsx:85`).
- Live regions exist for filter and lightbox changes and loading (`GalleryFilterBar.tsx:131`, `GalleryLightbox.tsx:301`, `ProductStates.tsx:48`) and an alert for errors (`ProductStates.tsx:80`).
- Not verifiable: focal point of Home and the hero, drawn-photo look after plan 11-39.

### Pillar 3: Color (3/4)
- Hex scan of `modules/public` excluding tests: only `HeroArt.tsx` and `JerseyArt.tsx` (allowed SVG fills) plus a comment at `public.recipe.ts:64`. The MapCard hex strokes from the previous review are gone (R-02).
- `public-look.node.test.ts` fails on any hex colour in public TSX and pins the four Blush values, so regression is guarded.
- Arbitrary colour mixes use theme variables only (`gallery.recipe.ts:53`, `color-mix(in srgb, var(--bg) 92%, transparent)`), so theme changes carry through.
- Not verifiable: 60/30/10 split, accent-on-paper contrast, Espresso theme.

### Pillar 4: Typography (3/4)
- Public: the 23 `--text-N` tokens plus `font-button` replaced hand-typed sizes and `font-[650]` (R-01). `public-look.node.test.ts` gates it. Current public code reads `text-14`, `text-15` and similar (for example `SiteFooter.tsx:150,163`).
- Admin: `siteContent.recipe.ts:43,46,74,80,92` and others still use `text-[11px]`, `[12px]`, `[13px]`, `[14px]`, `[15px]`, `[17px]`, `[18px]`, `[20px]`, `[22px]`, `[24px]`, `[28px]`, `[30px]`, `[34px]` (13 distinct sizes). Owner ruling: name them in a later quick task. Carried over, not re-raised as a defect.
- Score is 3, not 4, because the contract's "no new size" is enforced only on the public side.

### Pillar 5: Spacing (3/4)
- Targets: `size-11` social squares (`SiteFooter.tsx:158`), `min-h-11` rows and links across the recipes (7 recipe hits for `min-h-11`/`h-11`/`size-11`), 44 px lightbox thumbs.
- Safe area: bar padding and Contact scroll padding add `env(safe-area-inset-bottom)` (R-06). The inset stays 0 because `index.html:8` has no `viewport-fit=cover`; that is the owner's ruling D-P11-BL-61.
- Arbitrary pixel values in public: `gap-[6px]` x9, `h-[52px]` x4, `w-[1100px]` x3, `gap-[2px]` x3, plus `SiteFooter.tsx:144` `pb-[96px]` and `SiteFooter.tsx:150` `max-w-[320px]`. Spec Spacing lists 6 px as an exception and most others are recipe box sizes. The footer `96px` is the risky one: it mirrors the sticky bar height with no link between the two (N-02).
- Horizontal scroll: the only `overflow-x-auto` rails are the intended carousels and pill nav (`home.recipe.ts:130`, `products.recipe.ts:99`, `recent.recipe.ts:9`); the testimonial rail is a focusable named region on phones (`TestimonialRow.tsx:57-60`).

### Pillar 6: Experience Design (3/4)
- Public pages have loading, error with "Try Again", and empty states (`ProductStates.tsx`, `GalleryStates.tsx`, `CategoryStates.tsx`, `ProductsEmpty.tsx`). A 404 page exists (`NotFoundPage.tsx`).
- Admin tabs use `pending`, row actions disabled while `acting` (`TestimonialsTab.tsx:211-263`, `GalleryTab.tsx:215-269`, `ClosuresCard.tsx:192`), shared empty states through ResponsiveTable (R-05) and ConfirmDialog for deletes.
- Lightbox: phone tap zones in the tab order with arrow keys and swipe (R-04, owner ruling).
- Photo upload now redraws every decodable photo before upload (commits 0a44e64e, ab3ef670, 852ea4dd), so metadata is stripped on the device. This is a privacy gain, not a visual change.
- Not verifiable without a browser: focus return after dialogs, real swipe feel, toast timing.
- No shadcn registry (`components.json` absent): registry audit skipped.

## Changes since the previous review

| Previous finding | Previous outcome | Current status | Evidence |
|---|---|---|---|
| R-01 Typography drift, public | Fixed (b14b020c) | Still fixed | `web/src/test/public-look.node.test.ts`; `SiteFooter.tsx:150` uses `text-14`; no `text-[Npx]` left in public |
| R-02 MapCard hex strokes | Fixed | Still fixed | Hex scan of `modules/public` finds only HeroArt, JerseyArt and the comment at `public.recipe.ts:64` |
| R-03 Gallery tile inline `--ratio` | Fixed (6a706946) | Still fixed for the drawn tile. Photo tiles still get `--ratio` from LazyImage | `GalleryMasonry.tsx:5` comment; `components/states/LazyImage.tsx:68`. Spec lines 48 and 51 allow LazyImage |
| R-04 Lightbox prev/next on phones | Closed, owner ruling D-P11-BL-60 | Owner ruling carried over | `galleryLightbox.recipe.ts`, `GalleryLightbox.test.tsx` |
| R-05 Empty states on two admin tabs | Closed, not a defect | Confirmed | `ProductLinesTab.tsx:466-469`, `TestimonialsTab.tsx:467-470` |
| R-06 Safe area under sticky bar | Fixed, owner ruling D-P11-BL-61 | Fixed; owner ruling carried over | `index.html:8` has no `viewport-fit=cover` by choice |
| R-07 SharePictureCard, PublicWebsiteCard states | Closed, verified | Still verified | PhotoSlot owns status, error and confirm |
| R-08 Arbitrary spacing | Closed as allowed | Mostly holds; footer values now raised as N-02 | `SiteFooter.tsx:144,150` |
| R-09 Visual checks needing screenshots | Deferred | Still deferred (code-only again) | UI-SPEC Visual Review, P11-BL-54 |
| R-10 Older `style=` in AuthFrame, OrdersByStatusCard | Closed as allowed | Same two uses, custom properties only | `AuthFrame.tsx:34`, `OrdersByStatusCard.tsx:91` |
| R-11 Copy not diffed to the spec | Deferred | Public copy now diffed in full and matches; admin copy spot-checked only | `copy.ts`, `hoursCopy.ts` vs spec lines 592-624 |

## Owner rulings carried over (not re-raised)

- D-P11-BL-60 (2026-11-13): keep the lightbox tap zones on phones; no extra visible arrows.
- D-P11-BL-61 (2026-11-13): keep today's viewport setting, so the safe-area inset is 0 on notched phones until the owner changes it.
- Admin font sizes (owner, 2026-11-13): name them in a later quick task. Still open as a queued task (see Top Fix 2).

## New findings

| ID | Severity | Finding | Evidence | Suggested fix |
|---|---|---|---|---|
| N-01 | WARNING (minor) | "Breadcrumb" label hard-coded in JSX, outside `copy.ts` | `modules/public/components/PageHead.tsx:40` | Move to `PUBLIC_COPY.crumbs` |
| N-02 | WARNING | Footer bottom padding `96px` is a hand-typed copy of the sticky bar height; `max-w-[320px]` is also hand-typed. The look gate does not cover spacing | `modules/public/components/SiteFooter.tsx:144,150` | Name the bar height as a token, use it in both places, extend the gate to spacing |

## Outcomes (quick 261114-t04)

| ID | Outcome | Commits | Evidence |
|---|---|---|---|
| N-01 | Fixed | 83594c4c | `PUBLIC_COPY.crumbs.label` is `'Breadcrumb'`, `PageHead` reads it, so the spoken name is unchanged. `public-look.node.test.ts` fails on any string-literal `aria-label` in public TSX. |
| N-02 | Fixed | a5a6cb5e, 1c0bdba6 | Theme tokens `--spacing-contact-bar` (77px) and `--spacing-tagline` (320px). Footer phone padding is 96px, or the bar plus the safe area when taller. The Contact scroll padding reads the token. The look gates fail on bare px padding or margin in the public module, on a px max width in the footer, and on a hand-typed bar height, and they pin the token to the bar's parts. No visible change while the inset is 0 (D-P11-BL-61). |
| N-02 follow-up | Fixed | 62ff24d4 | The bar's Messenger button had colours only. It now has the same 48px button shape as "Call us", so a Messenger-only bar is as tall as the token. Approved look change, D-P11-BL-67. A gate keeps the two bar buttons' shapes in step. |

Informational only: `PublicLayoutCheckPage.tsx:19` English literals (dev-only route, D-20).

## Files Audited
- `.planning/phases/11-public-site-content-management/11-UI-SPEC.md` (Copywriting Contract, lines 578 to 712)
- `web/src/modules/public/copy.ts`, `hoursCopy.ts`
- `web/src/modules/public/components/` (all recipes; SiteFooter, PageHead, MapCard, GalleryMasonry, GalleryLightbox, RecentWorkStrip, ProductMedia, TestimonialRow, state files)
- `web/src/modules/public/pages/` (PublicLayoutCheckPage and page list)
- `web/src/modules/admin/components/` (ProductLinesTab, TestimonialsTab, GalleryTab, ClosuresCard, siteContent.recipe and the rest of the Phase 11 set by scan)
- `web/src/test/public-look.node.test.ts`, `web/index.html`, `web/src/components/states/LazyImage.tsx`
