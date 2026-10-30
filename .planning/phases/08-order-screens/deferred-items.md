---
created: 2026-10-29T19:20:00-05:00
updated: 2026-10-29T19:20:00-05:00
---

# Phase 08 deferred items

Out-of-scope findings logged while executing the Phase 8 plans. Nothing here blocks the plan that logged it.

## From plan 08-06

1. **Owner review scripts still treat `/admin/orders` as an unsigned dev preview.** `web/scripts/owner-review.mjs` (line 118) and `web/scripts/design-side-by-side.mjs` (line 74) open `/admin/orders` without signing in. Since 08-06 that path is the real, guarded Orders page, so an unsigned visit lands on the sign-in screen. Plan 08-24 owns the owner review list and the order sweeps; it should sign in first or seed an order. Both scripts have their own tests (`owner-review.test.ts`, `design-side-by-side.test.ts`) that still pass, because they only read the path list.
2. **`AdminNotFoundPage` has no route.** The `orders` placeholder was the only route that used it. The file and its in-shell "Page not found" screen stay in the tree, unused. A later plan or the owner decides: route it as a splat under the admin layout (so `/admin/anything` shows the in-shell screen instead of the public holding page), or delete it.
3. **The D-61 redirect cannot be seen in the e2e bundle.** The e2e build keeps `/admin` as the Dashboard dev preview (dev routes win), so `/admin` to `/admin/orders` is proved in `routes.test.tsx` only.
4. **Flake, passes alone.** `@shell sidebar and top bar stay pinned` failed 3 times in one 207-test run (webkit at 1440x900 and 390x844, iphone at 1024x768): `/dev/components` (the heavy showcase page) showed no `h1` within 5 s while 4 workers ran. Re-run alone: 15 of 15 passed. The specs were not touched by this plan beyond the short-page path.
