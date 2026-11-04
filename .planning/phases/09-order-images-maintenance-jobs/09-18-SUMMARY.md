---
phase: 09-order-images-maintenance-jobs
plan: 18
subsystem: web
tags: [images, orders-list, cover, lazy-image, responsive-images, srcset]

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-04 (LazyImage srcSet, sizes and fit)
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-13 (OrderListEntry.cover and imageCount, orderListCover fixture)
provides:
  - OrderCard cover as { image: { src, srcSet, width, height }, name, number, count } drawn with LazyImage
  - OrdersTable lead thumb from entry.cover.table through LazyImage (44 x 44)
  - web/src/modules/admin/imageSlots.ts with CARD_SIZES, VIEWER_SIZES and pickCandidate
  - e2e check @order-photos-list
affects: [09-16, 09-23]

created: "2026-11-03T20:55:00-06:00"
updated: "2026-11-03T20:55:00-06:00"

actuals:
  tokens: 14000
  tasks: 2
  commits: 4

plan_head_before: 37ba6bf403cc6a52bc583fc3e737c9511edef2b5
plan_head_after: baf5a75ff0a6d2530d838df38086657bf2a1af02
commits: 4

tech-stack:
  added: []
  patterns:
    - "A srcset choice is checked without a browser: pickCandidate parses w and x descriptors (commas allowed inside an address) and picks the smallest candidate that covers slot width x pixel density"

key-files:
  created:
    - web/src/modules/admin/imageSlots.ts
    - web/src/modules/admin/imageSlots.test.ts
    - web/e2e/order-photos-list.spec.ts
  modified:
    - web/src/components/data/OrderCard.tsx
    - web/src/components/data/index.ts
    - web/src/components/data/data.test.tsx
    - web/src/modules/admin/components/OrdersTable.tsx
    - web/src/modules/admin/components/OrdersTable.test.tsx
    - web/src/modules/admin/pages/OrdersPage.tsx
    - web/src/modules/admin/components/showcase/Phase8Demos.tsx

key-decisions:
  - "OrderCardCover keeps its optional name and number (placeholder text used by the dev scenarios) next to the new image and count, so web/src/dev/scenarios/groups/data.ts, which this plan does not own, still compiles"
  - "OrderCard imports CARD_SIZES from @/modules/admin/imageSlots, so the sizes string lives in one place (the plan's file list). No lint or layout rule forbids it"
  - "The UIC-49 test checks the real invariant, because the literal one cannot hold (see Deviations 1)"

requirements-completed: []
requirements-advanced: [ORD-04, IMG-04]

status: complete
duration: about 45min
completed: 2026-11-03
---

# Phase 9 Plan 18: The Orders list shows each order's cover photo Summary

**The Orders grid card and the table's lead thumb now show the order's cover through LazyImage with the server's srcset (card sizes string for the card, x descriptors for the table), keep the old placeholders when there is no photo, and `pickCandidate` lets a unit test prove what the browser would load at 390, 820 and 1440 px.**

## Accomplishments

- `OrderCard`: `cover.image` replaces `cover.src`. The image is a `LazyImage` (decorative, `alt=""`, ratio `16 / 10`, `CARD_SIZES`, lazy, skeleton until loaded) inside the same 16:10 button. The hover zoom class (`orderImageClasses`) now sits on the LazyImage box. The button name and the "{n}" chip are unchanged (chip only above one photo).
- `OrdersTable`: the lead cell draws `entry.cover.table` through `LazyImage` at 44 x 44, ratio `1 / 1`, x descriptors from the server; no cover keeps `MediaPlaceholder label={false}`.
- `OrdersPage`: `toCardCover(entry)` maps `entry.cover.card`, the stored width and height, and `entry.imageCount`. No cover gives `undefined`, so the card shows "No images yet".
- `imageSlots.ts`: `CARD_SIZES`, `VIEWER_SIZES` (the UI-SPEC strings, no Cloudinary address anywhere) and `pickCandidate(srcSet, slotWidth, devicePixelRatio)`.
- The Phase 8 showcase's first card now has a cover in the new shape (the app mark stands in for a photo, so the demo needs no photo store).
- `web/e2e/order-photos-list.spec.ts` (`@order-photos-list`): add one photo through the order page, open the list in grid and table view, and the cover has `naturalWidth > 0`; plus an order without a photo keeps "No images yet".

## Task Commits

1. **Task 1 RED:** `d2ab60bb`
2. **Task 1 GREEN:** `e4efa591`
3. **Task 2 RED:** `ba6c96d9`
4. **Task 2 GREEN:** `baf5a75f`

## TDD Gate Compliance

- **Task 1 RED `d2ab60bb`.** Command: `vitest --run --reporter=tap-flat src/components/data/data.test.tsx src/modules/admin/components/OrdersTable.test.tsx`, exit 1. Target tests failed on the planned assertions: `expected undefined to be '/api/testing/images/photo01?size=csps_card_640'` (card) and `expected undefined to be '/api/testing/images/photo02?size=csps_sq_44'` (table), plus the two skeleton tests (no `img` yet). The chip tests (3 images, 1 image) passed at once because that behaviour already existed (characterization). semanticAssessment: the targets ran and failed on the intended missing behaviour; no load, import or fixture fault. `imageSlots.ts` with the two sizes strings was committed with the RED tests so the test files could import it; it holds data only. I did not run `gsd_run check tdd-red-evidence` (no `gsd_run` in this shell); the TAP output was inspected by hand.
- **Task 1 GREEN `e4efa591`.** Same two files plus the showcase, OrdersPage and the rest of `src/modules/admin/components` and `src/components/data`: all pass (`Test Files 7 passed, Tests 235 passed` for the card, table, showcase and OrdersPage files).
- **Task 2 RED `ba6c96d9`.** `imageSlots.test.ts`: 25 failed with `pickCandidate is not a function`, 7 passed (3 sizes-string checks, 2 widest-candidate checks, and 2 `toThrow` checks that pass only because calling a missing function throws). semanticAssessment: the 25 failing tests are the planned behaviour tests; the 2 throw tests are false greens until GREEN and were re-read against the real function afterward.
- **Task 2 GREEN `baf5a75f`.** `imageSlots.test.ts` `Tests 32 passed (32)`.

## Checks I saw

- `npm --prefix web run typecheck`: no output, exit 0 (after GREEN of Task 2).
- `eslint ... --max-warnings 0` on `src/components/data`, `src/modules/admin/components`, `OrdersPage.tsx`, `imageSlots.ts`, `imageSlots.test.ts` and `e2e/order-photos-list.spec.ts`: no output. `prettier --check`: all files use Prettier code style.
- `vitest --run` on `imageSlots.test.ts`, `src/components/data`, `src/modules/admin/components`, `OrdersPage.test.tsx`, `no-long-dash.node.test.ts`, `source-layout.node.test.ts`, `components/index.test.ts`: all of my files green. Unrelated modal tests failed under load in the two big runs: `OrderItemModal`, `OrderRefundModal` (first run, 3 failures), then `AddUserPanel`, `EditUserPanel`, `ExpenseModal` (second run, 5 failures). Each file re-run alone passed (`OrderItemModal` + `OrderRefundModal` `67 passed`; `AddUserPanel` + `EditUserPanel` passed; `ExpenseModal` 52 passed on the second alone run, after one failure of "reads Saving while the request runs" in a three-file run). I touched none of those files. This is load flake (timeouts of `findByText` / modal tests on a busy machine), recorded here, not hidden.
- Acceptance: `grep -c LazyImage web/src/components/data/OrderCard.tsx` = 3 (>= 1). `grep -c res.cloudinary.com web/src/modules/admin/imageSlots.ts` = 0. Test names contain "390", "820" and "1440".
- `playwright test --list --grep @order-photos-list`: 10 tests in 1 file (2 tests x 5 projects).
- `gitleaks protect --staged --no-banner` before each commit: "no leaks found".

## Decisions Made

- The cover keeps the optional `name` and `number` fields (see key-decisions) so the dev scenario `CARD_0148` and the placeholder tests stay valid.
- The table thumb passes no `sizes` (x descriptors need none) and `width={44} height={44}`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test contract] UIC-49 cannot hold literally at 2x density**
- **Found during:** Task 2
- **Issue:** The plan and UI-SPEC say the pick is "no wider than 2x the displayed box at 390, 820 and 1440 px". With the spec's own candidates (card 320 to 960w, viewer 640 to 1600w) that is false at a 2x screen: the card box at 390 px is 358 px, a 2x screen needs 716 px, and the smallest candidate that covers it is 800w (2.23x the box). The same happens at 820 px (800w for a 376 px box) and 1440 px (800w for a 330 px box, because 640w is just under the 660 needed).
- **Fix:** The test asserts what is true and still protects IMG-04: (a) the pick is the smallest candidate that covers box x density (else the largest); (b) at 1x it is no wider than 2x the box; (c) at 2x it is no wider than 2x the pixels the screen can show; (d) no candidate in the set is wider than 2x the widest box the slot ever shows (card 735 px, viewer 956 px). The box widths come from evaluating the real `CARD_SIZES` and `VIEWER_SIZES` strings, not from hand-typed numbers.
- **Files modified:** web/src/modules/admin/imageSlots.test.ts
- **Commit:** ba6c96d9

**2. [Rule 3 - Blocking] A one-line type export in a file the plan does not list**
- **Found during:** Task 1
- **Issue:** The showcase needs the `OrderCardCover` type, and the new `OrderCardCoverImage` type belongs next to it.
- **Fix:** `OrderCardCoverImage` added to the type export in `web/src/components/data/index.ts`.
- **Commit:** e4efa591

**3. [Rule 3 - Blocking] The worktree had no node_modules**
- **Fix:** a symlink `web/node_modules` to the main checkout's `web/node_modules` (git-ignored, nothing installed, no package added or bumped).

## Verify not run

- **`npm --prefix web run e2e -- --grep @order-photos-list` was NOT run.** The e2e script drops and rebuilds the shared `CSPS_E2E` database and needs `preflight.ps1`, which this worktree shell cannot start; the lock it takes is per worktree, so it would not stop sibling plans (09-19 to 09-22) from colliding on the same database and port 5199. The spec is typechecked, linted, formatted and listed by Playwright (10 tests), but it has not executed. The tracer gate's end-to-end re-run is therefore open: the orchestrator must run `npm --prefix web run e2e -- --grep @order-photos-list` after merge, after the preflight. Treat Task 1's slice as unit-verified only until then.
- No `gsd_run windows append` entry was written (no `gsd_run` in this shell). The orchestrator may record this as `unrun-verify`.

## Owner decisions pending

1. **Finer candidate widths for 2x screens?** The card pick at 2x can be 1.1 to 1.2x the pixels needed, and the largest overshoot is 800w for a 330 px box on a 2x desktop (needs 660, the 640w candidate falls just short). Recommendation: leave the candidates as they are (the cost is a few KB per cover and it avoids more Cloudinary transformations, which count against the free plan). Option B: add 720w (touches plan 09-07's server candidate list and docs).

## Known Stubs

None. The showcase cover uses `/mark.svg` on purpose (a demo-only stand-in for a photo).

## Threat Flags

None. Only server-built addresses reach `img src`; no new endpoint, auth path or schema.

## Self-Check: PASSED

- FOUND: web/src/modules/admin/imageSlots.ts, imageSlots.test.ts, web/e2e/order-photos-list.spec.ts
- FOUND commits: d2ab60bb, e4efa591, ba6c96d9, baf5a75f (all ancestors of HEAD)
