# Phase 9 UI Review

*Created: 2026-11-06T07:55:00-06:00 · Updated: 2026-11-06T10:02:00-06:00*

**Audited:** 2026-11-06
**Baseline:** `09-UI-SPEC.md` (approved), plus project rules (OR-3, OR-4, WCAG 2.2 AA, 44 px targets, strict CSP, en-PH)
**Screenshots:** not captured. The owner rule for this shared machine forbids starting a dev server or Playwright, so this is a code-only audit.
**Interaction captures:** off (`workflow.ui_interaction_capture` is false). Every interaction finding below is read from code and tests, not from a browser.

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Spec copy is almost verbatim, with no dashes. Two small gaps: the pixel-limit sentence differs from the spec, and the 1-photo banner grammar is off. |
| 2. Visuals | 3/4 | Hierarchy and icon labels are solid. The viewer image is not centred in a wide window (known G-09-10, pending plan 09-33). |
| 3. Color | 4/4 | Only tokens are used. Accent appears only on the cover tag, ring, drag-over zone and nav hover, as declared. |
| 4. Typography | 4/4 | Only the declared 16/14/13 sizes and the inherited 12/11 recipe sizes. Weights 400/600 (700 on the cover tag, inherited). |
| 5. Spacing | 3/4 | Scale is respected. Two items could not be proved without a browser: the small-button tap area overlap and the 320 px row fit. |
| 6. Experience Design | 3/4 | State coverage is broad (waiting, uploading, failed, locked, 409, 404, leave guard). Nothing was run in a browser, and Playwright e2e was never run after the review fixes. |

**Overall: 20/24**

---

## Outcomes on the Phase 9 branch

The audit read an older copy of the Phase 9 code (the Phase 10 checkout, at the D-53 fix). The scores above are for that copy. Each finding was then checked against the Phase 9 branch:

| Finding | Outcome |
|---|---|
| Fix 1: viewer off-centre (G-09-10) | **Fixed by plan 09-33.** `viewerImageClasses` now has `justify-self-center` and a width set from the height cap. Proved on the real order page in CI run 42233493464 (2026-11-06). |
| Fix 2: pixel-limit wording | **Fixed in the spec.** Owner kept megapixels (D-56, 2026-11-06). |
| Fix 3: prove visuals in a browser | **Done in CI.** Run 42233493464 on 936e2139 passed 660 Playwright tests, 21 skipped by design. The run covers chromium and the phone viewport, including the 44 px and axe checks in `order-photos-a11y.spec.ts`. Screenshots in both themes were not taken. |
| Banner plural "1 of 1 photo" | **Accepted by the owner.** The banner follows the total, as built (D-57, 2026-11-06). |
| Gap wordings (`rulesUnavailable`, `refused`, the waiting line end) | **Waiting for the owner's wording.** |
| Tap-area assertion | **Already covered.** `order-photos-a11y.spec.ts:585` fails on any card control under 44 px. |

---

## Known and pending (not counted as new)

- **G-09-10, PhotoViewer not centred in a wide window.** Still unfixed in code at `web/src/components/media/photoViewer.recipe.ts:44-46`. `viewerImageClasses` has `col-start-2 ... min-w-0` but no `justify-self-center`, so a height-capped box hugs the left of its column. Plan 09-33 is not executed. One addition for that plan: the phone variant (`vp-lt-sm:col-span-full`, same file and line) has the same height cap, so test a short, narrow window too.

---

## Top 3 Priority Fixes

1. **Viewer image off-centre in wide windows (WARNING, known G-09-10)** - every photo opened on a desktop looks lopsided between Previous and Next - add `justify-self-center` (and keep `max-w-full`) to `viewerImageClasses` at `photoViewer.recipe.ts:44`, with the failing test first as plan 09-33 says.
2. **Pixel-limit message does not match the spec (WARNING)** - the spec (Validation table) says "{file name} is too big. Photos can be at most {max} pixels wide or tall." but the browser says "...at most N megapixels." (`orderPhotosCopy.ts` `reasons.pixels`) and the server says "Photos can be at most 25 megapixels." (`src/Csps.Application/Images/ImageErrors.cs:21`). Both sides agree with each other, so there is no OR-3 drift, but the spec and the code differ and the owner has not ruled. **Outcome: fixed in the spec.** The owner kept the megapixels wording (D-56, 2026-11-06), and the UI-SPEC Validation table now matches the code.
3. **Prove the visual claims in a browser before release (WARNING)** - 320 px fit of the tile rows, the 44 px tap areas on the `sm` buttons, and contrast of `text-ink-muted` on `--surface-2` were not checked. `09-REVIEW-FIX.md` says the Playwright e2e was not run after the fixes. Run the owner-review and axe e2e once the machine is free (preflight first), and attach screenshots at 320, 390, 820 and 1440 px in both themes.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

- Verified in `web/src/modules/admin/orderPhotosCopy.ts` and `web/src/components/media/copy.ts`: card title, both hints, limit notes, status lines, banner, leave guard, description window, delete dialog, "Take Photo", "Choose Photos", "Make Cover", "Try Again", "Open Full Size" and its hidden "(opens in a new tab)" all match the spec text.
- OR-4: a byte-level search for U+2013 and U+2014 in `components/media`, `orderPhotos*`, `OrderPhoto*`, `PhotoDescriptionModal`, `utils/images.ts`, `imageSlots.ts`, `OrderCard.tsx` and `LazyImage.tsx` found none.
- WARNING `orderPhotosCopy.ts` (`reasons.pixels`): wording differs from the spec, see Fix 2.
- WARNING `orderPhotosCopy.ts` (`failedLine`): the plural follows the total, so a single photo gives "1 of 1 photo didn't upload." The spec example is "1 of 3 photos didn't upload." and UAT test 6 expected "1 of 1 photos". Neither is wrong, but the owner never chose. Low priority; record a ruling or leave as is.
- Minor: `rulesUnavailable` and `refused` are marked "gap" in the file and still wait for owner wording (recorded in the code header, not yet in a ruling).

### Pillar 2: Visuals (3/4)

- Focal point is clear: the cover has the accent ring and tag, and the card head carries one status line.
- Icon-only controls all have `aria-label` plus matching `title` (`PhotoTile.tsx:211-256, 280-332`). The grip is `aria-hidden`.
- Viewer: dialog, label, focus on Close, wrap, Esc and arrow keys are in `PhotoViewer.tsx:100-170`. Previous and Next are only rendered when there are 2 or more photos, as the spec says.
- WARNING G-09-10, see "Known and pending".
- Not verified: the viewer white band in the UAT screenshot may be the photo itself, as the gap note says.

### Pillar 3: Color (4/4)

- `media.recipe.ts`, `photoViewer.recipe.ts` and `orderPhotos.recipe.ts` use token classes only (`bg-surface`, `bg-surface-2`, `border-line`, `text-ink-muted`, `text-danger`, `bg-danger-soft`, `bg-accent`). The one literal-like value is `color-mix(in_srgb,var(--bg)_94%,transparent)` on the viewer scrim, which is built from a token and matches the spec's 94% scrim.
- Accent is used only where declared: cover tag (`media.recipe.ts` `thumbCoverClasses`), cover ring, drag-over zone, viewer nav hover. No other accent use found in the Phase 9 files.
- The viewer sets `data-theme="dark"` so the brand-fixed lightbox colours hold in both themes, as the spec allows.
- Not verified by tool: contrast ratios. This does not lower the score here, but Fix 3 asks for an axe run.

### Pillar 4: Typography (4/4)

- Sizes found in the Phase 9 recipes: 14 px (most), 16 px (viewer caption), 12 px (drop hint), 11 px (cover tag). The 12 and 11 are the inherited App. B recipes the spec lists. No new size or weight was added.
- Weights: `font-semibold` (600) for Label, `font-bold` (700) only on the cover tag, as the spec inherits. No weight outside the contract.
- `wrap-anywhere` and `line-clamp-2` are applied to file names, descriptions and pick errors, so long names do not overflow.

### Pillar 5: Spacing (3/4)

- Tile padding 8, tile gap 8, list gap 16, uploader gap 16 and drop zone `py-8` match the spec table. The 88 px thumb is `size-22` (88 px).
- Photo list uses `grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]` as specified, so one column on phones.
- Icon buttons are 44 x 44 in the tile row 2; the viewer Close is `size-11`, the nav is `size-14` (`size-11` on phones).
- WARNING (unverified): "Make Cover", "Try Again" and "Remove" are `size="sm"` and depend on the invisible tap area. `actionsRowIdleClasses` is `min-h-9` (36 px). I could not confirm in a browser that these meet 44 px or that neighbours do not overlap. Add one e2e or unit assertion on the computed tap area.
- Arbitrary values are limited to the inherited `bottom-1.5`, `left-1.5`, `px-1.5`, `py-0.5` on the cover tag and `top-1.5 left-1` on the grip, which the spec lists as declared exceptions.

### Pillar 6: Experience Design (3/4)

- Covered: waiting, uploading, failed (retryable or not), preview-pending, preview-unavailable, read-only, limit at 5, pick errors, partial-failure banner (`role="alert"`, `OrderPhotosCard.tsx:616`), status line (`role="status"`, `:597`), heading focus target (`tabIndex={-1}`, `:592`), leave guard through `useUnsavedChangesGuard` (in-app and `beforeunload`), 409 reload with toast, 404 and 422 handling, delete confirm with Cancel first.
- Strict CSP: no `style=` attribute, no `dangerouslySetInnerHTML`, no `createObjectURL`. The only `blob:` hits are comments and `Blob` variables (`images.ts:118`, `OrderPhotoPicker.tsx:38`, `OrderPhotosCard.tsx:571`). Previews are `data:` URLs.
- Reduced motion: spinner and viewer fade carry `motion-reduce:animate-none`.
- WARNING: `09-REVIEW-FIX.md` says Playwright e2e was not run after the fixes, so the focus-return, 409 and leave-guard behaviours are proven by unit tests only. UAT item 19 (real phone photo, GPS removed, upright) was skipped by owner ruling and sits on the release-day list. Plan 09-31 and 09-32 (database backup) are not built; they have no screen.
- No registry audit needed (shadcn is not initialised).

---

## Recommendation Count

- Priority fixes: 3 (1 known and pending)
- Minor recommendations: 3 (banner plural, gap wording rulings, tap-area assertion)

---

## Files Audited

- `web/src/components/media/PhotoViewer.tsx`, `PhotoTile.tsx`, `ImageUploader.tsx`, `media.recipe.ts`, `photoViewer.recipe.ts`, `copy.ts`
- `web/src/modules/admin/components/OrderPhotosCard.tsx`, `OrderPhotoPicker.tsx`, `PhotoDescriptionModal.tsx` (searched), `orderPhotos.recipe.ts`
- `web/src/modules/admin/orderPhotosCopy.ts`
- Search only: `web/src/utils/images.ts`, `imageSlots.ts`, `components/data/OrderCard.tsx`, `components/states/LazyImage.tsx`
- Docs: `09-UI-SPEC.md`, `09-UAT.md`, `09-REVIEW-FIX.md`, `CLAUDE.md`, `.claude/CLAUDE.md`
- Not read in full (time-boxed): `usePhotoUploadQueue.ts`, `OrdersTable.tsx`, `DeletedOrderPage.tsx`, the Phase 9 showcase demos, and the individual SUMMARY and PLAN files. No claim here covers them.
