---
created: 2026-11-13T10:00:00-06:00
updated: 2026-11-13T10:00:00-06:00
---

# Phase 11: UI Review

**Audited:** 2026-11-13
**Baseline:** 11-UI-SPEC.md (approved)
**Screenshots:** not captured (owner rule: no dev servers on the shared machine; code-only audit)
**Interaction captures:** off (workflow.ui_interaction_capture is false). All interaction findings are code-derived.

Scope note: this was a targeted code audit by grep and spot reads of `web/src/modules/public`, the Phase 11 admin components, and the recipes. It was not a line-by-line read of all 38 plans' output. Scores are held down where evidence is thin.

## Pillar Scores

| Pillar | Score | Key finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | No em/en dash found in Phase 11 files; copy lives in copy modules. Not every string was compared to the spec table. |
| 2. Visuals | 3/4 | Icon-only controls carry aria-labels; art is decorative. Hero and lightbox hierarchy not visually verified. |
| 3. Color | 3/4 | Tokens used. Hex only in SVG art, but MapCard hard-codes a stroke hex. |
| 4. Typography | 2/4 | Many arbitrary px sizes and a 650 weight in public recipes, beyond the declared 3 sizes and 2 weights. |
| 5. Spacing | 3/4 | 44px targets enforced; several arbitrary pixel values. |
| 6. Experience Design | 3/4 | Loading, error, empty and confirm patterns exist across tabs; a few cards lack them. |

**Overall: 17/24**

## Top 3 Priority Fixes

1. **Typography drift from the declared set (WARNING)** - The spec allows new code 16/14/13 at weights 400/600, with other sizes only from inherited recipes. The public recipes write raw pixel sizes (`text-[12px]`, `[20px]`, `[22px]`, `[24px]`, `[30px]`, `[32px]`, `[36px]`, `[48px]`, `[64px]`, `[160px]`, `[260px]`) and `font-[650]`. Many are the approved App. C values, but they are hand-typed, not tokens. Fix: map each to a named type token or document it in one table, and add a test that fails on unlisted sizes.
2. **MapCard hard-coded colour (WARNING)** - `modules/public/components/MapCard.tsx:116` uses `stroke="#fff6f0"`, a literal copy of `--surface-3`. Spec 13 allows hex only in jersey illustration data. Fix: use `currentColor` or a token class so a theme change cannot desync.
3. **Inline `style` with `--ratio` on the gallery tile (WARNING, CSP)** - `modules/public/components/GalleryMasonry.tsx:88` sets `style={{ '--ratio': ratio }}`. The spec permits `--ratio` via LazyImage, and React sets it through the CSSOM, so it does not trip `style-src`. But the spec also says "no style attribute". Fix: confirm with a CSP e2e check that the tile art box passes with no `style-src-attr` violation, or route it through LazyImage/MediaPlaceholder like the photo case.

## Detailed Findings

### Pillar 1: Copywriting (3/4)
- OR-4 scan of `web/src/modules/public`, the Phase 11 admin components, pages and copy files for U+2013/U+2014: zero hits.
- Copy sits in `modules/public/copy.ts`, `modules/admin/siteContentCopy.ts` and `publicWebsiteCopy.ts`, not in JSX, as the spec requires.
- Lightbox close uses `aria-label={COPY.close}` (`GalleryLightbox.tsx:185`), good.
- Gap: I did not diff each CTA and empty-state string against the spec's Copywriting table, so I cannot award 4.

### Pillar 2: Visuals (3/4)
- Icon-only buttons in the lightbox and gallery tiles have labels (`GalleryLightbox.tsx:185`, `GalleryMasonry.tsx:80` `aria-label`).
- Art components (`JerseyArt`, `HeroArt`) are decorative by contract.
- Lightbox prev/next buttons are hidden below the medium breakpoint (`galleryLightbox.recipe.ts:14`, `vp-lt-md:hidden`). Phone users depend on tap zones and swipe (C-35). Keyboard-only users on a narrow window lose visible prev/next. WARNING: confirm keyboard arrows and a visible alternative exist.
- Not verified without screenshots: focal point on Home and the hero.

### Pillar 3: Color (3/4)
- Public recipes use token classes (`text-accent-ink`, `bg-surface-2`, `border-line-strong`), matching the spec's accent rules (for example `.s-link` uses `text-accent-ink`, `contact.recipe.ts:139`).
- Literal hex only in `HeroArt.tsx` (lines 20 to 64) and `JerseyArt.tsx` (26 to 34), both SVG fills allowed by spec 13.
- `MapCard.tsx:116` hex stroke is the exception (see fix 2).
- 60/30/10 distribution not checkable without renders.

### Pillar 4: Typography (2/4)
- Declared set is 3 sizes, 2 weights. Public recipes hold at least 14 distinct arbitrary pixel sizes (`contact.recipe.ts`, `home.recipe.ts`, `gallery.recipe.ts`, `galleryLightbox.recipe.ts`, `hours.recipe.ts`) and weight `font-[650]` (`contact.recipe.ts:139`).
- Most are listed as "inherited approved scale", so this is a maintainability and drift risk, not a spec breach. Score reflects that the contract's "no new size or weight" is enforced only by convention.

### Pillar 5: Spacing (3/4)
- Touch targets are well handled: pills `min-h-11` (`gallery.recipe.ts:9`), phone and Directions links `min-h-11` (`contact.recipe.ts:96, 139`), lightbox thumbs 56px dropping to 44px (`galleryLightbox.recipe.ts:49`), nav 56px.
- Arbitrary values: `gap-[6px]` (`gallery.recipe.ts:9`, `contact.recipe.ts:139`), `h-[132px]`, `h-[84px]`, `min-h-[232px]` (`home.recipe.ts:50, 64`). Spec lists 6px as an approved exception, others are recipe sizes.
- Sticky contact bar uses `pg-phone:grid` and `bottom-0` (`contact.recipe.ts:144`); safe-area inset padding not seen. WARNING: check notched phones.

### Pillar 6: Experience Design (3/4)
- Admin tabs: ProductLinesTab, TestimonialsTab, GalleryTab, ClosuresCard and BusinessInfoTab all reference error handling, a loading state and `ConfirmDialog` for deletes (grep counts above 0).
- `ProductLinesTab` and `TestimonialsTab` contain no `EmptyState` reference. WARNING: a Manager with zero lines or testimonials may see a blank list. Verify they render an empty state some other way.
- `SharePictureCard` and `PublicWebsiteCard` show no loading, error or confirm references; they may rely on the parent. Verify.
- Public pages have dedicated state files (`GalleryStates.tsx`, `ProductStates.tsx`, `ProductsEmpty.tsx`) with a retry button (`ProductStates.tsx:86`).
- No third-party registry audit: shadcn is not used.

## Further Notes (not in top 3)
- Existing `style=` uses at `modules/admin/components/AuthFrame.tsx:34` and `OrdersByStatusCard.tsx:91` pre-date this phase and use custom properties only.
- No visual check of 320 px overflow, contrast, or dark (Espresso) admin theme was possible.

## Files Audited
- `.planning/phases/11-public-site-content-management/11-UI-SPEC.md`
- `web/src/modules/public/components/` (GalleryMasonry, GalleryLightbox, GalleryBody, GalleryFilterBar, MapCard, HeroArt, JerseyArt, ProductStates, recipes)
- `web/src/modules/admin/components/` (ProductLinesTab, TestimonialsTab, HoursTab, ClosuresCard, GalleryTab, BusinessInfoTab, SharePictureCard, PublicWebsiteCard, PhotoSlot, recipes)
