---
phase: 09-order-images-maintenance-jobs
plan: 23
subsystem: web
tags: [order-photos, photo-viewer, read-only, deleted-order, focus-return, e2e]
requires:
  - phase: 09-order-images-maintenance-jobs
    provides: "09-04 PhotoViewer, 09-16 OrderPhotosCard and the upload queue, 09-18 VIEWER_SIZES"
provides:
  - "OrderPhotosCard opens a saved photo in the PhotoViewer (viewer srcSet, VIEWER_SIZES, Open Full Size in a new tab) and puts focus back on the thumb of the photo shown last, or on the card heading when no photos are left"
  - "OrderPhotosCard readOnly prop (forced on the deleted order view), joined with the status lock for Completed and Cancelled orders"
  - "DeletedOrderPage Images card through OrderPhotosCard readOnly (the coming-soon card is gone)"
  - "web/e2e/order-photos-view.spec.ts with three @order-photos-view journeys"
affects: [09-27, 09-29, 09-30]
key-files:
  created:
    - web/e2e/order-photos-view.spec.ts
  modified:
    - web/src/modules/admin/components/OrderPhotosCard.tsx
    - web/src/modules/admin/components/OrderPhotosCard.test.tsx
    - web/src/modules/admin/pages/DeletedOrderPage.tsx
    - web/src/modules/admin/pages/DeletedOrderPage.test.tsx
    - web/src/modules/admin/hooks/useImageRulesQuery.ts
    - web/src/modules/admin/components/orderPage.recipe.ts
    - web/src/modules/admin/orderPageCopy.ts
    - web/playwright.config.ts
key-decisions:
  - "Focus after the viewer closes is set by the card in an effect that runs after the viewer's own focus return: it finds the thumb by its exact name (MEDIA_COPY.tile.open) among the card's buttons, scrolls it into view (nearest) and focuses it; with no such thumb it focuses the card heading"
  - "A read-only card does not read the photo rules (useImageRulesQuery takes an enabled flag): it never picks a file, and the deleted view makes no extra request"
  - "The e2e host lifts the per-address photo upload limit (RateLimits__Images__PermitLimit) the same way it lifts the sign-in limits"
requirements-completed: []
requirements-advanced: [ORD-04, IMG-04]
status: complete
commits: 4
plan_head_before: a3353bef5650ff3ccaec8787096c37cce5dd52ff
plan_head_after: 88c8d381627b4806a405d0d51894729a0f014ef9
actuals:
  tokens: 10400
  tasks: 2
  commits: 4
coverage:
  - id: D1
    description: "Tapping a saved photo's thumb on the order page opens the viewer at that photo with the viewer srcSet and sizes; arrows wrap, Esc and Close viewer return focus to the thumb of the photo shown last; Open Full Size is a link to the full-size address in a new tab (noopener)"
    requirement: "IMG-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#the photo viewer (D-16, D-04, D-27, UIC-25, UIC-44)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @order-photos-view (photo 2, ArrowRight to photo 4, Esc, focus on photo 4; 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "If the photos reload while the viewer is open it keeps the same photo, else the nearest; with none left it closes and focus goes to the card heading; a waiting file has no open button"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#the photo viewer (D-16, D-04, D-27, UIC-25, UIC-44)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Completed or Cancelled order's Images card is read-only (no add area, no limit note, no second row, no drag, no Make Cover) while thumbs still open the viewer; a reopen brings the controls back; read-only with no photos says 'No photos on this order.'"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPhotosCard.test.tsx#read-only photos (D-11, D-20, UIC-2, UIC-25)"
        status: pass
      - kind: e2e
        ref: "@order-photos-view a cancelled order shows its photos read-only, and a reopen brings the controls back (5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Manager's deleted-order view shows the soft-deleted order's photos read-only with the viewer; the coming-soon card is gone"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrderPage.test.tsx#the Images card (D-20, 08 D-24, UIC-2)"
        status: pass
      - kind: e2e
        ref: "@order-photos-view a deleted order shows its photos read-only to a Manager, and they open in the viewer (5 projects)"
        status: pass
    human_judgment: false
duration: 48min
completed: 2026-11-04
created: 2026-11-04T00:05:00-06:00
updated: 2026-11-04T00:05:00-06:00
---

# Phase 9 Plan 23: View photos full screen; closed and deleted orders show photos read-only Summary

**Saved photos open in the viewer from the order page and the deleted order view with focus returning to the right thumb, and the Images card is read-only on Completed, Cancelled and deleted orders.**

## Performance

- **Duration:** about 48 min
- **Tasks:** 2 of 2 (Task 1 was the tracer; its end-to-end check passed before Task 2 started)
- **Commits:** 4 (two RED, two GREEN)
- **Files changed:** 9 (1 created, 8 modified)

## Accomplishments

- **Viewer from the card (D-16, D-04, D-27).** A saved thumb opens `PhotoViewer` at that photo. The photo list comes from the order's images in display order; the alt text is the stored description or the position default. The viewer gets `VIEWER_SIZES` and each photo's viewer `srcSet`, and "Open Full Size" links to the photo's `fullSize` address (new tab, `rel="noopener noreferrer"` from the viewer). Waiting, uploading and failed files have no open button (the tile only makes one for saved photos).
- **Focus return.** On close the card focuses the thumb of the photo shown last (found by its exact accessible name), scrolled into view. If the last photo was deleted elsewhere the viewer already moved to the nearest one; if none are left, focus goes to the card heading.
- **Read-only card (D-11, D-20).** `locked = readOnly || isLocked(order)`. The status lock for Completed and Cancelled orders already came from plan 09-16; this plan adds the forced `readOnly` prop and tests that the controls disappear and return after a reopen. A read-only card does not read the photo rules.
- **Deleted order view (08 D-24).** `DeletedOrderPage` renders `<OrderPhotosCard order={order} readOnly />` where the coming-soon card was. The now-unused `ORDER_PAGE_COPY.images` block and the two image-card recipes were removed.
- **E2E `@order-photos-view`, 15 passed in 5 projects:** (1) upload 5 photos, open photo 2, ArrowRight twice, Esc, focus is on photo 4's thumb, Open Full Size has `target=_blank`; (2) a cancelled order shows its photos with no write controls and axe clean, the viewer opens, and a reopen brings the controls back; (3) a deleted order shows its photos read-only to a Manager and the viewer opens.

## Task Commits

| Task | Commit | Type |
| ---- | ------ | ---- |
| 1 RED | 06015270 | test(09-23): failing tests for the photo viewer on the order page |
| 1 GREEN | b416d1b2 | feat(09-23): open a saved photo in the viewer and return focus to its thumb |
| 2 RED | eee7805f | test(09-23): failing tests for read-only photos on closed and deleted orders |
| 2 GREEN | 88c8d381 | feat(09-23): show closed and deleted orders' photos read-only |

Tracer gate: after Task 1, `⚡ Tracer verified end-to-end — expanding` (5 of 5 projects passed the viewer journey).

## Verification (what I saw)

- `npm --prefix web run test -- --run src/modules/admin/components/OrderPhotosCard.test.tsx src/modules/admin/pages/DeletedOrderPage.test.tsx src/modules/admin/hooks`: 24 files, 381 tests passed.
- `npm --prefix web run e2e -- --grep @order-photos-view`: `15 passed (1.7m)` (chromium, firefox, webkit, pixel, iphone).
- Full web run: 281 of 282 files passed, 7939 of 7940 tests passed. The one failure is `scripts/license-policy.test.ts` (see Issues).
- `npm --prefix web run typecheck`: clean. ESLint (`--max-warnings 0`) on `src/modules/admin`, `playwright.config.ts` and the new spec: clean. Prettier check: clean.
- Acceptance: `grep -c PhotoViewer OrderPhotosCard.tsx` = 4; a test named "...puts focus on the thumb of the photo shown last" checks photo 4's thumb; `grep -c OrderPhotosCard DeletedOrderPage.tsx` = 2; `grep -c images.soon DeletedOrderPage.tsx` = 0.
- gitleaks ran on every commit (hook): no leaks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The e2e host refused uploads after 30 per 10 minutes per address**
- **Found during:** Task 2 (first run of the new journeys)
- **Issue:** the new journeys upload 9 photos per project (45 in all) from one address. The server's photo upload limit (IMG-02, T-09-27) answered 429, the shared guard flagged it, and uploads stalled while holding the photo host lock for 120 s each, so most tests timed out.
- **Fix:** `RateLimits__Images__PermitLimit: noThrottle` in the e2e host env, next to the sign-in limits. Production keeps 30 per 10 minutes. This also lifts a latent problem: the earlier photo journeys together already come close to the limit in a full e2e run.
- **Files modified:** `web/playwright.config.ts`
- **Commit:** 88c8d381

**2. [Rule 2 - Missing critical] A read-only card must not read the photo rules**
- **Found during:** Task 2
- **Issue:** the deleted order view (and a locked order opened cold) would call `GET /orders/image-rules` for a card that never picks a file.
- **Fix:** `useImageRulesQuery(enabled = true)`; the card passes `!locked`. Rules already cached still answer. The default for the two picker callers is unchanged.
- **Files modified:** `web/src/modules/admin/hooks/useImageRulesQuery.ts` (not in the plan's file list)
- **Commit:** 88c8d381

**3. [Rule 1 - Bug, test only] Test fixture renumbered photo ids**
- **Found during:** Task 1 GREEN
- **Issue:** my RED helper `namedPhotos` gave photos ids by list position, so "photo 4 deleted" looked like a different photo, and two live-update tests could not pass.
- **Fix:** a name from the five-photo set keeps its id; a shorter list is the same photos with some deleted.
- **Files modified:** `web/src/modules/admin/components/OrderPhotosCard.test.tsx`
- **Commit:** b416d1b2

**4. [Cleanup caused by this change] Dead code removed**
- `ORDER_PAGE_COPY.images` (`orderPageCopy.ts`) and `orderImagesBodyClasses`, `orderImageTileClasses` (`orderPage.recipe.ts`) were only used by the removed coming-soon card. Neither file is in the plan's list; no other reader existed (grep). 09-21's summary had left the `soon` key for this plan.

### Other notes

- The plan listed no deleted-view e2e. I added one (the third journey) because D-20 is otherwise only covered by unit tests.
- Task 2's status-lock tests (Completed and Cancelled) already passed at RED, since plan 09-16 had wired `isLocked`. The RED failures were the forced `readOnly` card and the deleted view.
- The e2e journeys wait on the last saved thumb (up to 120 s) instead of the "photos added" toast, which disappears on its own; the host lock serialises uploads across projects.

**Total deviations:** 4 (1 Rule 3, 1 Rule 2, 1 Rule 1 in a test, 1 cleanup). **Impact:** none on scope; two files outside the plan's list were touched for the reasons above.

## Issues Encountered

- `scripts/license-policy.test.ts > exits 1 on a stricter policy given through --exceptions (no npm exceptions at all)` fails here, also alone (`No packages found in this path...`). It is a license-checker run over `node_modules` in this fresh worktree (installed with `npm ci --ignore-scripts`) and touches nothing this plan changed. Not fixed; the orchestrator's post-merge run in the main checkout will tell if it is only a worktree effect.
- First two e2e runs failed for the reasons in deviation 1 and a strict-mode text match (the counter text also appears in the viewer's spoken status line); the test now matches the counter exactly.
- No flakes in the unit tests I ran.

## Authentication Gates

None.

## Known Stubs

None. The saved-photo controls (move, make cover, describe, delete) are still disabled no-ops on the live card, as before; plans 09-27 and 09-29 wire them.

## Threat Flags

None. T-09-52: write controls are absent on locked and deleted orders (asserted in unit and e2e tests); the server lock and the deleted-order 404 refuse writes anyway. T-09-53: "Open Full Size" keeps `rel="noopener noreferrer"` (asserted). T-09-SC: no package added or bumped.

## Next Phase Readiness

Plans 09-27 and 09-29 can wire move, cover, describe and delete into the same card. The viewer state (`viewerIndex`, `returnTo`) and the `locked` value sit at the top of `OrderPhotosCard`.

## Self-Check: PASSED

- Created file present: `web/e2e/order-photos-view.spec.ts`.
- Commits 06015270, b416d1b2, eee7805f and 88c8d381 are ancestors of HEAD.
