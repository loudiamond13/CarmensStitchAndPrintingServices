---
created: 2026-10-29T19:20:00-05:00
updated: 2026-10-29T23:25:00-05:00
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

## From plan 08-09

1. **Owner review: new SPEC-GAP wording on the Orders list.** (a) The No matches line names the filters in use, for example "No orders with status Active + recent, dates Oct 1, 2026 to Oct 31, 2026 and product Basketball Jersey." The status is always named, even when it is the default. (b) The Product chip reads "Product: Loading…" while the product types load. (c) The No matches line uses the shared curly quotes around the search ("zzz"), where the plan text showed straight quotes. The words are in `ordersCopy.ts` (`noMatches`, `productLoading`).
2. **The toolbar look is not seen in a browser at 390, 820 and 1440 px in Blush and Espresso.** The controls, the custom range row (a full-width row under the toolbar) and the balance box wrapper (`ordersBalanceFilterClasses`, 40px tall, bottom-aligned) are proved by tests and the e2e (the e2e does not check the toolbar for sideways scroll on a 320 px phone). The owner's screenshot review should check the balance box's 44px tap area and the row break.
3. **`useBusinessToday` also reads order pages.** It looks in the query cache under `['orders']` (list pages) and `['order']` (order pages, which carry `today`). Plan 08-10 should key the order page query as `['order', id]` so the date defaults in the forms can use it without a request.
4. **A stray `from` or `to` with no custom range is dropped.** The UI-SPEC only says what happens to a broken custom pair. A `from` or `to` beside no range, or beside a preset, has no meaning, so the list drops it with one replace (a preset stays). Say if the owner wants it kept as an API pass-through instead.
5. **`status` and `sort` are always sent to the API**, even at their defaults, so every request says what it asks for. Earlier tests expected only `page` and `pageSize`; those expectations were updated.
6. **A product type id the list does not hold still sends one request before the replace.** It mirrors the Expenses category fallback. The server answers an unknown id with no rows, then the replace removes it.
7. **Flake found and fixed in the new e2e:** on the iphone project the URL is written a moment after the screen changes (the browser limits how fast the address may change), so a URL read straight after a chip appeared saw the old URL once. The spec now polls the URL for those reads.

## From plan 08-10

1. **Stub until 08-12: the Payments, Discounts and Expenses tab panels are empty.** The tabs show their counts and can be chosen (`?tab=payments` works), but the panel under them draws nothing yet. Plan 08-12 fills them. Recorded in `.planning/WINDOWS.md`.
2. **The Refunds tab and the customer card, status history and phone balance card are not drawn yet** (plan 08-12). Until then `?tab=refunds` reads as Items without a `replace`; 08-12 adds the replace (UIC-46) and `showRefundsTab` is ready for it.
3. **Header Delete Order (D-57) and the Change Status menu are not drawn yet** (plans 08-19 and 08-22). The header shows Edit Details only, and only while `canEditOrder` allows it.
4. **`ordersDeletedKey` (`['orders-deleted']`) lives in `useRefreshOrders.ts`.** Plan 08-20 should key the deleted list under it so every order write refreshes that list.
5. **SPEC-GAP, owner review: the back link accepts any literal `/admin/orders` path**, such as `/admin/orders/deleted?page=2`, not only the list. Anything else (a foreign host, `//host`, another admin page, a backslash, `..`, a value that is not text) goes to `/admin/orders`. The `.s-back` look is the shared `loginBackClasses` (its name is from the sign-in screens).
6. **SPEC-GAP, owner review: the 404 view is an alert banner with the words "This order was not found or was deleted." and a secondary Back to Orders button below it.** The UI-SPEC says ErrorState plus a ButtonLink; `ErrorState` has no action slot, so the button sits under the banner.
7. **The look is not seen in a browser at 390, 820 and 1440 px in Blush and Espresso.** The detail grid cascade (one column up to 1023px, a 320px side up to 1279px, the side first and static on tablets and phones) is proved by `orderPage.recipe.node.test.ts`; the Items table is the shared ResponsiveTable (stacked row cards on phones). The owner's screenshot review should check the card spacing, the panel padding and the tab strip inset.
8. **The `@orders-page` e2e seeds no order expense**, because no order expense category id is known to the e2e helpers. It shows Order Expenses and Estimated Profit rows (₱0.00 expenses); the unit tests cover ₱6,065.00 and ₱15,262.50 for an Admin and a Manager.
9. **`canComplete` looks at the figures only, not the status** (07 D-04). The Change Status menu is not rendered on a locked order (D-15), so a Completed order never asks it.

