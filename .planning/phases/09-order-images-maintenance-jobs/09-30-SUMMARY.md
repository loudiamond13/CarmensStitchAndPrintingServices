---
phase: 09-order-images-maintenance-jobs
plan: 30
subsystem: testing
tags: [playwright, axe, csp, showcase, owner-review, validation, cloudinary]
created: "2026-11-04T09:00:00-06:00"
updated: "2026-11-05T18:00:00-06:00"

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: the photo screens, viewer, upload queue, maintenance jobs and Testing image routes of plans 09-01 to 09-29
provides:
  - "@order-photos-a11y e2e: one test per Phase 9 screen state, the phone capture path, 320 px, viewer shapes, control names and tap areas"
  - "Order photos section of the Component Showcase (Phase9Demos), on local data: images, mounted on request"
  - "Phase 9 section of the owner review pack (23 cases)"
  - "Release-day list and the owner's dev-account checks in docs/operations/cloudinary-setup.md"
  - "Per-task verification map in 09-VALIDATION.md (nyquist_compliant: true)"
affects: [09-31, 09-32, gsd-verify-work, gsd-ship]

actuals:
  tokens: 41000
  tasks: 2
  commits: 6
plan_head_before: 008e363d451983776cd7be5ae46d017e7f545436
plan_head_after: 50a4d30b84f6a473c7c23c0bdde0575b6d99d2c0

duration: about 6 hours (long e2e runs on a shared machine)
completed: 2026-11-05
status: complete
requirements-completed: []
---

# Phase 9 Plan 30: Prove the whole phase and hand it to the owner Summary

**All three tasks are done. Task 3 (the owner's Cloudinary setup and real-photo check) was done by the owner on 2026-11-05: 13 sizes exist, strict mode is on and a browser PNG uploads; the GPS and upright checks on real phone photos were skipped by owner ruling. The owner check found two bugs, both fixed with tests (see "Owner checkpoint").**

## Performance

- **Tasks:** 3 of 3 done. Task 3 was the owner's blocking `checkpoint:human-action`, answered 2026-11-05.
- **Commits:** 6 (see Task Commits). STATE.md and ROADMAP.md were not touched, as ordered.

## Accomplishments

- **Task 1 (tracer): `@order-photos-a11y`.** One test per screen state in all five projects: F1 with three drafts; O1 with 0, 1, 3 and 5 photos; waiting and uploading tiles (the first upload is held with `page.route`); a failed tile with its banner; the open viewer; the description window with a real 409 banner (a coworker's change is made through the API while the window is open); the delete dialog; a Completed order; the deleted view; the Orders grid and table with covers; and the Order photos showcase section. Each runs axe with `target-size` and the CSP record; F1, O1 and the viewer also assert the CSP record is empty (UIC-46).
- **Phone path (IMG-05, D-17, D-18).** On `pixel` and `iphone` (touch, `hover: none`): Take Photo and Choose Photos show and the drop zone does not; Take Photo opens a file chooser; a canvas-made 4000 x 3000 JPEG (red top, blue bottom) chosen through Choose Photos is stored at 2000 x 1500, read back through the Testing image route (`fetch`, then `createImageBitmap`), and the red half is still on top. The desktop projects skip that test and instead assert the drop zone shows and Take Photo does not.
- **UIC-31, 33, 42.** At 320 px the photo list is one column and `scrollWidth` equals `clientWidth` (also on the New Order form with drafts). A 1:4 and a 4:1 photo (stored 500 x 2000 and 2000 x 500) show whole in the viewer: `object-fit: contain`, box inside the window; pictures are attached to the report (not in WebKit, where Playwright's screenshot adds an inline style the strict CSP blocks). At 390, 820 and 1440 px every photo control has a name, a 44 px tap area (the invisible `::before` of `hitAreaClasses` counts) and passes axe.
- **Task 2: showcase.** New section "Order photos" (`Phase9Demos`, 14 cases) on local `data:` images, never a request: the list with three, one and five photos, uploading, waiting and failed tiles, a refused file, drafts (preview, being made, no preview) with the pick-error box and the left-out count, the read-only empty list, a 200-character description and a very long file name, the status line and partial-failure banner, a photo that fails to load, the Orders covers with and without the image chip, the viewer on five shapes (landscape, portrait, 1:4, 4:1, square) and on one photo, the description window with its 409 banner, and the delete dialog. The cases appear when "Show the Order photos cases" is pressed (see Deviations 3). `Phase9Demos.test.tsx` has 23 tests (axe on the static cases and on each live dialog, no request, StrictMode, local `data:` addresses only).
- **Task 2: owner review pack.** `PHASE9_REVIEW_CASES` (23 UI-SPEC Visual Review screens) at 390, 820 and 1440 px in Blush and Espresso (the touch phone at 390 px only, the narrow viewer at 320 px), a capture for each against the Testing host with drawn photos, `PHASE9_LOOK_AT` (six backlog items to look at) and the "Order photos (Phase 9)" report section. `docs/web/owner-review.md` describes it. The report and plan are unit tested (134 tests in `owner-review.test.ts`). The captures themselves were only partly run: see Open items.
- **Task 2: docs.** `docs/operations/cloudinary-setup.md` gains the owner's dev-account checks and the release-day list. `docs/web/e2e.md` lists all seven `@order-photos-*` tags. `09-VALIDATION.md` has its per-task map (77 rows from plans 01 to 30, the 09-31 and 09-32 rows kept) and `nyquist_compliant: true`.
- **Cleanup.** Nothing was left to remove: `images.soon`, the coming-soon recipe classes and the four stale header comments were already gone (earlier plans). `grep -rn "coming soon" web/src/modules/admin` prints only three tests that assert the old text is absent.

## Task Commits

1. **Task 1: phone, axe, CSP and layout journeys** - `1cdaf052` (test)
2. **Task 2: showcase, owner review pack, docs, validation map** - `ed4b83b6` (feat)
3. **Fixes found by the gates** - `fbbac0d2`, `8e50b53e`, `c9c4e4da`, `50a4d30b` (fix)
4. **Task 3: owner checkpoint** - done by the owner 2026-11-05. Fixes it found: `12b85e3a` (setup check reads Cloudinary's "format" name), `d3ef31d2` (browser PNGs with many IDAT chunks). Post-merge: `7f127c2a` (the Orders list Admin spec finds its order by number).

TDD: Task 1 is test-only (no feat commit). Its first full run was the RED: 8 of 85 failed, all faults in the new spec (see Deviations 2); nothing in the app failed. Task 2's showcase and review-pack code were written before their tests (Deviations 1).

## Files Created/Modified

- `web/e2e/order-photos-a11y.spec.ts` (new), `docs/web/e2e.md`
- `web/src/modules/admin/components/showcase/Phase9Demos.tsx` and `.test.tsx` (new); `ShowcaseDemos.tsx`, `showcaseSections.ts` (+ test), `showcaseCopy.ts`, `showcase.recipe.ts`
- `web/e2e/showcase.spec.ts` and `ComponentShowcasePage.test.tsx` (14 sections)
- `web/scripts/owner-review.mjs` and `.test.ts`, `docs/web/owner-review.md`
- `docs/operations/cloudinary-setup.md`, `.planning/phases/09-order-images-maintenance-jobs/09-VALIDATION.md`
- `web/e2e/order-photos-arrange.spec.ts`, `order-photos-delete.spec.ts`, `order-photos-list.spec.ts` (find the order by number)

## Decisions Made

- The showcase gets its own section ("Order photos") instead of more cases in "Orders": the plan names "the Phase 9 section". The section count in `showcase.spec.ts` and the two section-title tests went from 13 to 14.
- Showcase photos are flat-colour one-pixel PNG `data:` addresses (see Deviations 3).
- `nyquist_compliant: true` was set because every non-checkpoint task has an automated command; the two owner checkpoints (09-30-03, 09-31-02) are listed under Manual-Only Verifications.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TDD order for the showcase and review pack.** The plan asked for red first. `Phase9Demos` and the review-pack code were written before their tests, so there is no red commit for them. The tests were then written and run green (23 and 134 tests).

**2. [Rule 1 - Bug] Task 1 first run: 8 of 85 failed, all in the new spec.** (a) the phone test read pixels with `getImageData` and Chromium warned (fixed with `willReadFrequently`); (b) the 1:4 and 4:1 test took a WebKit screenshot, which the strict CSP rejects (skipped in WebKit, as `showcase.spec.ts` does); (c) the 44 px check ignored the invisible tap area (it now counts the `::before` height). Later the Orders grid cover on `iphone` did not load in 20 s: covers load lazily, so the test now scrolls the card into view first. No app component needed a change.

**3. [Rule 1 - Bug] The Order photos showcase cases slowed the WebKit first load of the showcase.** The first full e2e run failed 26 existing specs on `webkit` and `iphone` (`h1` not found in 5 s); they failed again when re-run alone, and passed with the section switched off. Steps taken: inline SVG photos were replaced by one-pixel PNG `data:` images (`fbbac0d2`), then the cases were made to mount only when "Show the Order photos cases" is pressed (`c9c4e4da`, `50a4d30b`). A lazy `import()` of the cases was tried and removed: it breaks the production build rule that only the showcase page's own chunk may hold showcase modules (D-33). The showcase is covered by `Phase9Demos.test.tsx` and the `@order-photos-a11y` showcase test.

**4. [Rule 3 - Blocking] The Make Cover (arrange), Delete (delete) and list photo specs failed in a full run.** They opened `/admin/orders?view=grid` and expected their order on the first page of the soonest-due list; with many specs' orders in the shared database it was not. They now open `?q={number}&view=grid` (or `table`). The new a11y spec's orders are due 400 days out and found by number.

**5. [Rule 3 - Blocking] PowerShell cannot start from the worktree.** `Invoke-CoverageGate.ps1` and `preflight.ps1` could not be run. The coverage gate was done with its own commands (`dotnet test --coverlet ...`) and the numbers read from the Cobertura files; ports 5180, 5115, 7028 and 5199 were checked with `netstat` before each run.

**Total deviations:** 5 (2 bug, 3 blocking). **Impact:** none on app behaviour; test, showcase and docs changes only.

## Gate Results

| Gate | Result |
|------|--------|
| `dotnet test --solution Csps.slnx` (CSPS_TEST_SQL=localdb) | Test run summary: Passed. total 7105, failed 0, succeeded 7103, skipped 2, 9m04s. No warning line. No `.cs` file changed in this plan. |
| Coverage gate (same commands as `Invoke-CoverageGate.ps1`) | Csps.Domain 100.00% lines (2731/2731), 100.00% branches (1174/1174). Csps.Application 97.96% lines (8222/8393), minimum 95. Domain and Application unit tests: 1239 and 2222 passed. |
| `npm --prefix web run typecheck`, `lint`, `format:check` | exit 0, 0 warnings, run after the last commit. |
| web tests with coverage (`test:coverage`, `scripts/license-policy.test.ts` excluded) | 282 files, 7955 tests passed. All files 95.76% statements, 90.8% branches, 97.4% functions, 98.11% lines (exit 0, thresholds met). |
| `npm --prefix web run build` and `build:budget` | exit 0. Budget: public JS 125.31 KB of 150, admin JS 215.00 KB of 250, CSS 16.63 KB of 35. |
| `npm --prefix web run notices:check` | THIRD-PARTY-NOTICES.txt is up to date (28 packages). |
| `npm --prefix tools/openapi-gen run check` | Generated API types match tools/openapi-gen/openapi.v1.json. |
| `dotnet format Csps.slnx --verify-no-changes` | exit 0, no changes. |
| `@order-photos` (all seven tags, all five projects) | 157 passed, 3 skipped (the phone test on the three desktop projects), 0 failed. This includes `@order-photos-list`, which the backlog lists as never run. |
| `@order-photos-a11y` alone, first complete run | 74 passed, 3 skipped, 8 failed (spec faults, Deviations 2). After the fixes a later complete run gave 81 passed, 3 skipped, 1 failed (the lazy cover, fixed). Final form: part of the 157 above. |
| Full e2e suite (`npm run e2e`), run once at commit `ed4b83b6` | 1562 passed, 52 skipped, 85 failed in 1.8 h. Of the 85: the 26 WebKit/iPhone showcase failures (Deviations 3), the arrange/delete/list photo specs (Deviations 4), and load flakes in `dialog-fit`, `auth-must-change`, `orders-two-staff`, `audit-log`, `auth-overflow`, `orders-list`, `orders-view`. Re-run alone, 59 of the 85 passed. |
| WebKit and iPhone showcase group after the fixes (`@showcase`, `@a11y-rulings D-02/D-05`, `@fonts`, `@shell`, `@responsive`, `@dialog-fit`, `@keyboard`, `@motion`, `@expenses-sweep` showcase) | with the cases always shown: 116 passed, 62 failed. With the on-request version: 170 passed, 10 failed, 14 skipped (static import) and 165 passed, 15 failed, 14 skipped (lazy import, since removed). The 4 failures left after a re-run passed when the section was switched off (4 of 4), so the section may still add a little; see Open items. |

## Open items (for the orchestrator and the owner)

1. **A hung owner-review run is still holding resources, and I was not allowed to stop it.** I started `node scripts/owner-review.mjs` (PID 24068, started 08:18) to prove the Phase 9 captures. It stopped answering on the Orders grid case: the old photo wait had no time limit and a photo below the fold never loads. It still holds port 5199 (the Testing host `Csps.Server.exe`, PID 7900, and a headless Chromium), the `web/.locks/e2e.lock` file, and files in this worktree. The permission system refused `taskkill` twice. **Please stop it before any e2e run or before removing the worktree:** `taskkill /PID 24068 /T /F` (from the main session), then check `netstat -ano` shows nothing on 5199. The fix for the hang is committed (`50a4d30b`: each image is scrolled into view and the wait gives up after 8 seconds).
2. **The review captures are only partly proven.** Before the hang, 20 shots were taken (Blush, 390 px: F1, O1 with 0 to 5 photos, uploading, failed, the touch phone, drag-over, Completed, deleted, the three viewer cases and the delete dialog) and 4 failed on a missing base address in a refresh call (fixed in `50a4d30b`, not re-run). The other widths, Espresso, the narrow viewer and the L1 grid and table have never run. Run `npm --prefix web run review` once; if a picture fails it is listed on the report page.
3. **Showcase specs on WebKit and iPhone are borderline.** With the Order photos section the first full run lost 26 specs; with the on-request button the same group still loses 10 to 15 of about 190 under four parallel WebKit workers, and 4 of those failed again when re-run alone (while the same 4 passed with the section switched off). The cause is the 5-second heading wait of those specs on a page of 200 cases. If a clean re-run from the main checkout still fails them, the next step is to move the Order photos cases to their own dev route instead of the showcase page. This was not done here: it changes the plan's file list.
4. **Known worktree-only failures (not code):** `web/scripts/license-policy.test.ts` and `npm run license:check` fail in a fresh worktree (license-checker finds no packages after `npm ci --ignore-scripts`). Both pass in the main checkout per the wave notes.
5. **Shared photo specs now search by number.** The arrange, delete and list specs are edited (Deviations 4); they were fragile in a full run before this plan.

## Owner checkpoint: Task 3 (done by the owner, 2026-11-05)

- **Setup count line:** `13 exist`. The first `--check` after creating the sizes said `13 different`: the real account describes `f_webp` as `"format": "webp"`, and the command expected `fetch_format`. Fixed with a test that holds the real answer (`12b85e3a`); the sizes themselves were right.
- **Strict transformations:** enabled by the owner, after the count line said 13 exist.
- **Real upload:** a PNG picked in the browser was refused as "isn't a photo we can use". Chrome redraws a PNG into about 4 KB IDAT chunks (over a thousand), and the shared chunk reader stopped at 512, so the metadata step gave up. Ruling (owner, 2026-11-05): IDAT chunks no longer count toward the cap; every other chunk still does. Fixed with a test (`d3ef31d2`); the same PNG then uploaded.
- **GPS check: skipped** (owner ruling, 2026-11-05). GPS removal is proven by the automated tests only.
- **Upright check (JPEG and iPhone HEIC): skipped** (owner ruling, 2026-11-05). Turning is proven by the automated tests and the e2e phone path (a canvas-made JPEG) only. Recommended: do one real phone photo on each platform on release day (release-day list item 5).
- No gap plan against 09-15 was opened, since no HEIC or GPS failure was seen; neither was tested on a real photo.

## Release-day list for `/gsd-verify-work`

Also in `docs/operations/cloudinary-setup.md`. 1. Apply `csps-migrations.sql` (adds `OrderImages` and `ImageDeletions`). 2. App pool variables: `Cloudinary__CloudName`, `Cloudinary__ApiKey`, `Cloudinary__ApiSecret`, `Maintenance__Key`. 3. When plan 09-32 is built: `Maintenance__Backup__SqlServerFolder` and `Maintenance__Backup__AppFolder` (paths stay out of git and chat). 4. GitHub secret `MAINTENANCE_KEY` (same value) and the variable `SITE_ORIGIN`. 5. Deploy, then one phone camera photo on Android and one on iPhone. 6. One Run now: green, counts only, and (with 09-32) "Database backups written: 1".

## Known Stubs

None. The showcase photos are intentionally flat-colour demo images.

## Threat Flags

None. No new endpoint, auth path or schema; the e2e and showcase make no Cloudinary call.

## Self-Check: PASSED (files, commits, all three tasks); e2e status in Open items

- Files exist: `web/e2e/order-photos-a11y.spec.ts`, `Phase9Demos.tsx`, `Phase9Demos.test.tsx`, this summary.
- Commits exist: `1cdaf052`, `ed4b83b6`, `fbbac0d2`, `8e50b53e`, `c9c4e4da`, `50a4d30b`.
- Task 1 and 2 acceptance: the a11y spec has one test per screen state and asserts 2000 x 1500; `grep "coming soon"` prints only tests; `09-VALIDATION.md` has `nyquist_compliant: true` and a new `updated`.
- Full e2e after the merge (main checkout, 2026-11-04): 1628 passed, 53 skipped, 23 failed. One was real (`orders-list.spec.ts:137`, fixed in `7f127c2a`, 5 of 5); the other 22 passed when re-run one at a time (58 of 58), so they are load flakes. The hung review run (Open item 1) was stopped on the owner's word. The review pictures (Open item 2) are still not made: the stale Phase 2 before/after section stops the run first (owner choice in STATE.md).
