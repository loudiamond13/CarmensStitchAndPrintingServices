---
created: 2026-11-12T20:05:00-06:00
updated: 2026-11-15T07:05:00-06:00
---

# Phase 11: deferred items found during execution

Out-of-scope problems found while executing a plan. They were not fixed in that plan.

## Found in plan 11-28

### D-28-1: `PublicCacheInvalidationTests.ChangingAProductLineTitle...` depends on the order of the tests in its class

- **Where:** `tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs`, `ChangingAProductLineTitleShowsOnTheNextLinesReadWithANewETagAndTheOldETagGetsNo304` (line 167).
- **What happens:** it expects the first public line to be Basketball ("Basketball Kits" after its own change). It does not put the six lines back first. Two other tests in the same class (`ShowingAPhotoAddOnAShownOrderTakingItOffAndALineHide...` and `ShowingACoverChangeTakingOffShowingAgainAndALineHide...`) end by hiding the Basketball line and do not put it back. When one of them runs before it, the first public line is Volleyball and the test fails with `"Volleyball Jerseys"` where `"Basketball Kits"` was expected.
- **Evidence:** in the full Server run of plan 11-28 it failed (2743 total, 2741 passed), and it failed again when its class ran alone (25 of 26 passed). It passed when run by itself (1 of 1). Nothing in plan 11-28 touches this class or the product line code it reads.
- **Suggested fix (one line):** start the test with `await database.ResetAsync(); await ProductLineSeeding.RestoreSixAsync(database);` like its neighbours.

### D-28-2: `ForgotPasswordTests.TwoRequestsForTheSamePersonAtTheSameMomentLeaveOneUsableLinkEveryRound` is load sensitive

- **Where:** `tests/Csps.Server.IntegrationTests/Auth/ForgotPasswordTests.cs`.
- **What happens:** it failed once in the full Server run of plan 11-28 (22 seconds, while the whole suite ran). It passed when its class ran again (the class run above passed all of its tests). Nothing in plan 11-28 touches the auth code.

## Found in plan 11-31

### D-31-1: `@gallery at 1440px a focused tile is never under the header or the filter bar` fails in Firefox on the phase branch

- **Where:** `web/e2e/gallery.spec.ts` (plan 11-29), Firefox project only, 1440px.
- **What happens:** `Open Sample Riders MC, Moto starts below the header and the bar` fails with `Received: 22.5, Expected: >= 132` on every run (3 of 3 repeats in plan 11-31's tree, and 1 of 1 on a clean checkout of the base commit `862a9206` that has none of plan 11-31's changes). The other four projects and the 390px run pass.
- **Likely cause:** plan 11-29 ran against the four-order demo seed; plan 11-28 (merged beside it) made the seed six public items, and Firefox's partial focus scroll now leaves a tile under the bars. Not checked further.
- **Suggested fix:** check the tile order and the sticky bar offset in Firefox with the six-item seed, or scroll the tile with `scrollIntoView` in the spec before it measures.

## Found in plan 11-34

### D-34-1: `@site-content-business at 320px ...` fails on the tab strip in four projects, and times out in WebKit

- **Where:** `web/e2e/site-content-business.spec.ts` (plan 11-12), the 320px test.
- **What happens:** in Chromium, Firefox, Pixel and iPhone the line `expect(await page.getByRole('tablist').evaluate(holdsItsContent)).toBe(true)` fails (the strip is wider than its box now that Site Content has five tabs). The line before it (no sideways scroll for the page) passes, so the new link preview picture card does not widen the page at 320px. In WebKit the test ran for 8 minutes and timed out in `openSiteContent`: after `setViewportSize` it looked for the sidebar link, not the drawer menu (the check for the menu button runs before the layout settles).
- **Evidence:** plan 11-34 changed nothing in the tab strip (`SiteContentPage.tsx` is untouched). The other three tests of the spec pass in all five projects. The 320px page-level axe check in that test is never reached, so plan 11-34's own layout test (`@site-content-share the preview ...`) checks the page at 320px for sideways scroll and axe.
- **Suggested fix:** let the tab strip scroll inside its own box (or wrap) and test that, or drop the `holdsItsContent` line; wait for the menu or the sidebar link (`menu.or(sidebarLink)`) before choosing in `openSiteContent`, as `site-content-products.spec.ts` already does.

## Found in plan 11-39

### D-39-1: `npm run verify` stops at `format:check` on nine files this plan did not touch

- **Where:** `web/e2e/gallery.spec.ts`, `link-preview.spec.ts`, `public-sweep.spec.ts`, `site-content-sweep.spec.ts`, `web/src/modules/admin/auditCopy.ts`, `auditCopy.test.ts`, `components/PhotoSlot.tsx`, `components/showcase/Phase11Demos.tsx` and `Phase11Demos.test.tsx`.
- **What happens:** Prettier wants lines over 120 characters wrapped (for example `auditCopy.ts` lines 557, 599 and 664). The two files plan 11-39 changed pass. The same nine files are unchanged from the base commit `3435461b`, so the failure was there before this plan.
- **Suggested fix:** run `npm --prefix web run format` on those nine files in a small formatting plan, then re-run `verify`.
- **Fixed (2026-11-15):** Prettier was run on the nine files and `format:check` now passes for all of `web/`. It would have failed CI step "4 web prettier".
- **Flakes seen in that `verify` run:** 2 of 10710 tests failed under load and passed when their two files were re-run alone (112 of 112): `OrderFormPage.test.tsx` "has no axe violations with the card in each state" (5000 ms timeout) and `GalleryPage.test.tsx` "asks for the lightbox chunk only when a tile is first pressed" ("Close viewer" not found in time).

### D-39-2: e2e could not run in the plan 11-39 agent worktree

- **What happens:** `npm --prefix web run e2e` stops at the seed step. LocalDB `(localdb)\MSSQLLocalDB` shows Stopped and will not start from the agent shell ("SQL Server process failed to start"), because the owner's instance is already running outside the agent shell for the dev site. No e2e result exists for plan 11-39.
- **Needed:** run `@site-content-share` (all five projects) and `@order-photos-upload|@site-content-gallery|@site-content-photos` (chromium) from the main checkout, where LocalDB is reachable.
