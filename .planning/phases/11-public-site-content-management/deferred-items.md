---
created: 2026-11-12T20:05:00-06:00
updated: 2026-11-13T00:08:00-06:00
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
