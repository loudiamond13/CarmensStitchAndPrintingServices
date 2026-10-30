---
created: 2026-10-29T19:20:00-05:00
updated: 2026-10-29T22:08:00-05:00
---

# Phase 08 deferred items

Out-of-scope findings logged while executing the Phase 8 plans. Nothing here blocks the plan that logged it.

## From plan 08-06

1. **Owner review scripts still treat `/admin/orders` as an unsigned dev preview.** `web/scripts/owner-review.mjs` (line 118) and `web/scripts/design-side-by-side.mjs` (line 74) open `/admin/orders` without signing in. Since 08-06 that path is the real, guarded Orders page, so an unsigned visit lands on the sign-in screen. Plan 08-24 owns the owner review list and the order sweeps; it should sign in first or seed an order. Both scripts have their own tests (`owner-review.test.ts`, `design-side-by-side.test.ts`) that still pass, because they only read the path list.
2. **Built (feat 6ee395b1, D-89): `AdminNotFoundPage` is now a splat route.** The `orders` placeholder was the only route that used it. The file and its in-shell "Page not found" screen stay in the tree, unused. **Owner ruling D-89 (2026-10-29):** route it as a splat under the admin layout, so `/admin/anything` shows the in-shell screen instead of the public holding page. Keep the file. Built as a follow-up task after wave 2: an unknown `/admin/...` address now shows the in-shell screen behind the sign-in guard.
3. **The D-61 redirect cannot be seen in the e2e bundle.** The e2e build keeps `/admin` as the Dashboard dev preview (dev routes win), so `/admin` to `/admin/orders` is proved in `routes.test.tsx` only.
4. **Flake, passes alone.** `@shell sidebar and top bar stay pinned` failed 3 times in one 207-test run (webkit at 1440x900 and 390x844, iphone at 1024x768): `/dev/components` (the heavy showcase page) showed no `h1` within 5 s while 4 workers ran. Re-run alone: 15 of 15 passed. The specs were not touched by this plan beyond the short-page path.

## From plan 08-08

1. **Flake, passes alone: the Phase 6 Settings delete test can lose its focus target when other projects run it at the same time.** In the first full `@settings` run, `@settings a Manager opens Settings ... deletes a never-used one` failed once on chromium at its last focus check (the focus sat on the card heading, not on a row's Edit button). The row after the deleted one is usually another project's `E2E cat <token>` row, and that row can be deleted at the same moment; the page then falls back to the card heading, which is the designed fallback. Re-run alone on one worker, 4 of 4 passed; a second full `@settings` run passed 25 of 25. The Phase 6 logic is unchanged by 08-08. A fix would be a test that picks a stable neighbour (for example a name that sorts just before Others); not done here.
2. **The phone Settings tabs are only proved at 320 px on the Product Types tab.** The `@settings` phone test checks no sideways scroll and the Add button in view on Product Types and on Company Expense Categories. The two tabs between them share the same card, so they were not given their own phone checks.
3. **The Settings first-column headings and the "order expense categories" plural are SPEC-GAP wording.** The UI-SPEC names the column words only for the count column ("Items", "Payments", "Expenses"). The first column reads "Product type", "Payment method" and "Category", and the order expense list says "Loading order expense categories…" so it differs from the company tab's "Loading categories…". The owner reviews these in `orderListsCopy.ts`.

## From the D-89 follow-up

1. **Owner review: the admin not-found screen still uses placeholder words.** It reads "Nothing here yet / This screen is not available yet. Use the menu to go to another page." That fits a screen still to be built better than an unknown address. Rewording is the owner's call.
2. **The unknown admin address is proved only in `routes.test.tsx`.** No e2e spec signs in and opens `/admin/no-such-page`. 08-24 (the signed-in sweep) is the natural place to add it.
