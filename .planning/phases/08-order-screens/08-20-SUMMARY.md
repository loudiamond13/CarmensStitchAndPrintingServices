---
phase: 08-order-screens
plan: 20
subsystem: ui
tags: [orders, deleted-orders, restore, permanent-delete, type-to-confirm, react, tanstack-query, playwright]
created: "2026-10-30T06:00:00-05:00"
updated: "2026-10-30T06:00:00-05:00"

requires:
  - phase: 08-order-screens
    provides: "08-07 GET /orders/deleted/{id} (the counts), the Phase 7 deleted list, restore and permanent delete routes"
  - phase: 08-order-screens
    provides: "08-10 ordersDeletedKey and useRefreshOrders, 08-11 Orders list, 08-14 useOrderAction, 08-15 shared order form pieces"
provides:
  - "Manager-only Deleted Orders page at /admin/orders/deleted: paging only, nine columns, one-click Restore, Delete order permanently"
  - "PurgeOrderDialog: reads the deleted order for its counts, shows the sentence and six tiles, enables the button only for the exact typed number"
  - "deletedOrdersService (list, get, restore, purge), useDeletedOrdersListParams, useDeletedOrdersQuery, useDeletedOrderQuery"
  - "A Deleted Orders link in the Orders header for a Manager; an Admin is redirected by the route loader"
  - "ConfirmDialog countsLoading, countsLoadingLabel and confirmDisabled props"
affects: [08-21, 08-23, 08-24]

actuals:
  tokens: 26900
  tasks: 3
  commits: 6
plan_head_before: 892bf61b9bcd0b1f24471f2273a43d2194599393
plan_head_after: 41ffe122d402c33bf286c174c4a382dc94b4e3ec

tech-stack:
  added: []
  patterns:
    - "A permanent delete reads the thing first, shows its child counts in a skeleton-then-tally cascade box, and keeps the button off until the exact name is typed"
    - "useOrderAction takes the answer type as a second parameter, so a 204 action reuses the same focus-safe one-key-per-action submission"
    - "Deleted-list page copied from Deleted Expenses: paging only here, focus to the next row's Restore after a row leaves"

key-files:
  created:
    - web/src/modules/admin/pages/DeletedOrdersPage.tsx
    - web/src/modules/admin/components/PurgeOrderDialog.tsx
    - web/src/modules/admin/services/deletedOrdersService.ts
    - web/src/modules/admin/hooks/useDeletedOrdersListParams.ts
    - web/src/modules/admin/hooks/useDeletedOrdersQuery.ts
    - web/src/modules/admin/hooks/useDeletedOrderQuery.ts
    - web/src/modules/admin/deletedOrdersCopy.ts
    - web/src/test/deletedOrderFixtures.ts
    - web/e2e/orders-deleted.spec.ts
  modified:
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/pages/OrdersPage.tsx
    - web/src/modules/admin/components/orders.recipe.ts
    - web/src/modules/admin/hooks/useOrderAction.ts
    - web/src/modules/admin/sections.ts
    - web/src/components/overlays/ConfirmDialog.tsx

key-decisions:
  - "Restore uses useOrderAction with a second type parameter for the answer, because it answers 204, not an order"
  - "ConfirmDialog gets optional countsLoading, countsLoadingLabel and confirmDisabled props for the skeleton box (UIC-16) rather than a new dialog"
  - "The DELETE sends the order number as confirm (the button is only enabled when the trimmed text equals it); the server's 400 shows the fixed sentence"
  - "A 404 on the counts read or on the delete is 'already gone': the dialog closes, an info toast says so, and the lists read again"
  - "The e2e deletes the seeded order through the real API with a token taken from the page's refresh cookie, because the Testing seed route has no 'deleted' option"

patterns-established:
  - "Counts for the permanent-delete tiles come from the array lengths of the deleted read; images are 0 until Phase 9"
  - "A screen that owns a row list passes onDone(outcome) to the dialog and decides where focus goes"

requirements-completed: [ORD-06]

coverage:
  - id: D1
    description: "A Manager opens Deleted Orders from a link on Orders; an Admin sees no link and is redirected from /admin/orders/deleted to /admin/orders by the route loader"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#the Deleted Orders link (ORD-06, D-23)"
        status: pass
      - kind: integration
        ref: "web/src/modules/admin/routes.test.tsx#Deleted Orders for Managers (ORD-06, D-23; plan 08-20)"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-deleted.spec.ts#@orders-deleted an Admin opening Deleted Orders is sent back to Orders and sees no link to it"
        status: pass
    human_judgment: false
  - id: D2
    description: "The page lists deleted orders newest deleted first with paging only: nine columns, the delete time in Manila time, team over customer, status, Total, Paid, Balance and Deleted by"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrdersPage.test.tsx#the page"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useDeletedOrdersListParams.test.tsx#holds only page and size"
        status: pass
    human_judgment: false
  - id: D3
    description: "Restore takes one click with no confirm, sends one Idempotency-Key (one request for a double click, the same key on a retry), removes the row, refreshes the lists, moves focus to the next row's Restore and toasts"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrdersPage.test.tsx#Restore (D-23)"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-deleted.spec.ts#@orders-deleted a Manager finds a deleted order in Deleted Orders and restores it with one click"
        status: pass
    human_judgment: false
  - id: D4
    description: "Delete permanently reads the deleted order for its counts (skeleton while loading, confirm off), shows the cascade sentence with refunds, six tiles and the warning, and stays disabled until the exact trimmed order number is typed; it sends confirm= and toasts"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PurgeOrderDialog.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/components/overlays/ConfirmDialog.test.tsx#ConfirmDialog while the counts load (plan 08-20, UIC-16)"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-deleted.spec.ts#@orders-deleted a Manager deletes an order for good only after the counts show and the exact number is typed"
        status: pass
    human_judgment: false
  - id: D5
    description: "Edge cases: a 400 on confirm shows the fixed sentence in the dialog; a 404 (order already gone) closes with the already-gone note and refreshes; focus goes to the next row's Restore, else the previous, else the h1; rows keep the server's order"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PurgeOrderDialog.test.tsx#deleting for good"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrdersPage.test.tsx#Delete permanently from the deleted list (07 D-28, D-57; plan 08-20)"
        status: pass
    human_judgment: false
  - id: D6
    description: "States: loading skeleton, 'Couldn't load deleted orders.' with Try Again, 'No deleted orders' with no action, the empty value for nothing paid, the access banner on 403, zero axe violations"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrdersPage.test.tsx#the list states (UIC-3, UIC-7, UIC-16, UIC-18; plan 08-20)"
        status: pass
      - kind: automated_ui
        ref: "web/src/modules/admin/pages/DeletedOrdersPage.test.tsx#accessibility"
        status: pass
    human_judgment: false
  - id: D7
    description: "How Deleted Orders, its row actions and the permanent-delete dialog look in Blush and Espresso at 390, 820 and 1440 px, and the wording marked SPEC-GAP"
    verification: []
    human_judgment: true
    rationale: "Visual fit and owner wording review; the tests prove behavior, not the look (UI-SPEC owner screenshot review list)"

duration: 34min
completed: 2026-10-30
status: complete
---

# Phase 08 Plan 20: Deleted Orders, restore and delete for good Summary

*Created: 2026-10-30T06:00:00-05:00 · Updated: 2026-10-30T06:00:00-05:00*

**A Manager finds deleted orders on a paging-only list, restores one with a click (one Idempotency-Key, focus to the next row), and deletes one for good only after the dialog has read its child counts and the exact order number is typed; an Admin is redirected by the route loader.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-10-30T05:25:53-05:00
- **Completed:** 2026-10-30T05:59:31-05:00
- **Tasks:** 3 (6 commits)
- **Files modified:** 23 in the web app (9 created, 14 modified incl. tests), plus `deferred-items.md`

## Accomplishments

- `DeletedOrdersPage` (`/admin/orders/deleted`): back link, h1 with the "Manager only" badge, subline, "Showing {n} deleted orders · most recently deleted first", nine columns, row actions View, Restore and Delete order permanently, paging only (no search, D-52). First load shows the shared skeleton, a failure shows "Couldn't load deleted orders." with Try Again, nothing deleted shows "No deleted orders" with no action, and a 403 shows the access banner.
- Restore acts at once: one POST with an Idempotency-Key (a double click sends one request, a retry reuses the key), the row leaves, the order lists and the deleted list read again, focus goes to the next row's Restore (else the previous, else the h1), and the toast reads "Order restored" / "{number} counts in lists and totals again."
- `PurgeOrderDialog` reads `GET /orders/deleted/{id}` for the counts, shows the title, the message, the sentence with refunds, the six tiles (zeros dimmed, images 0) and "This can't be undone.", and keeps "Delete Order Permanently" off until the trimmed text equals the order number. It sends `DELETE /orders/{id}/permanent?confirm=` with no key. A 400 shows "Type the order number exactly to delete it for good."; a 404 closes with an "Already gone" note and refreshes.
- Route `orders/deleted` (static, wins over `orders/:id`) with a Manager loader that sends an Admin to `/admin/orders`; the Orders header shows a secondary "Deleted Orders" link to a Manager only; the shell keeps Orders current on the page.

## Task Commits

1. **Task 1: A Manager restores a deleted order** - RED `9a3646ee` (test), GREEN `2a390757` (feat)
2. **Task 2: Delete permanently with the counts and the typed number** - RED `cf6b0681` (test), GREEN `13e75ee0` (feat)
3. **Task 3: Empty, loading and failure states and the full Manager journey** - RED `9ce92923` (test), GREEN `41ffe122` (feat)

**Plan metadata:** committed after this file (docs: complete plan).

## Files Created/Modified

- `web/src/modules/admin/pages/DeletedOrdersPage.tsx` - X1 page: list, Restore, opens the permanent-delete dialog
- `web/src/modules/admin/components/PurgeOrderDialog.tsx` - counts read, cascade box, exact-number confirm, 400 and 404 handling
- `web/src/modules/admin/services/deletedOrdersService.ts` - `list`, `get`, `restore`, `purge` over the one HTTP client
- `web/src/modules/admin/hooks/useDeletedOrdersListParams.ts`, `useDeletedOrdersQuery.ts`, `useDeletedOrderQuery.ts` - URL state (page, size), the list query under `ordersDeletedKey`, the fresh counts read under `['order-deleted', id]`
- `web/src/modules/admin/deletedOrdersCopy.ts` - every word of the page and dialog
- `web/src/modules/admin/routes.tsx`, `pages/OrdersPage.tsx`, `components/orders.recipe.ts`, `sections.ts` - route and loader, Manager link, header actions row, Orders current in the shell
- `web/src/modules/admin/hooks/useOrderAction.ts`, `web/src/components/overlays/ConfirmDialog.tsx` - answer type parameter; skeleton and disabled-confirm props
- `web/src/test/deletedOrderFixtures.ts`, `web/e2e/orders-deleted.spec.ts` - fixtures and handlers; the `@orders-deleted` journeys

## Decisions Made

- Restore reuses `useOrderAction` (second type parameter for the 204 answer) rather than a copy of `useExpenseAction`, so the focus-safe generation scheme from 08-14 is shared.
- The skeleton box and disabled confirm are optional `ConfirmDialog` props, not a second dialog; every other dialog is unchanged.
- The DELETE sends the order number as `confirm`; the button is only live when the trimmed text equals it, and the server re-checks it.
- Words the UI-SPEC does not give are marked SPEC-GAP for the owner in `deferred-items.md` (counts-failed line, loading label, already-gone toast, failed-restore title).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ConfirmDialog needed three optional props**
- **Found during:** Task 2 (the plan needs a SkeletonText box and a disabled confirm while the counts load, UIC-16)
- **Issue:** `ConfirmDialog` had no way to show a loading cascade box or hold the confirm off for a reason it cannot see.
- **Fix:** added `countsLoading`, `countsLoadingLabel` and `confirmDisabled` (optional, defaults off) and three tests.
- **Files modified:** `web/src/components/overlays/ConfirmDialog.tsx`, `ConfirmDialog.test.tsx`
- **Committed in:** `cf6b0681` (tests), `13e75ee0`

**2. [Rule 3 - Blocking] useOrderAction typed its answer as the whole order**
- **Found during:** Task 1 (restore answers 204)
- **Fix:** second type parameter `TResult = OrderDetailResponse`; no existing caller changes.
- **Files modified:** `web/src/modules/admin/hooks/useOrderAction.ts`
- **Committed in:** `2a390757`

**3. [Rule 1 - Bug] Orders was not marked current on /admin/orders/deleted**
- **Found during:** Task 1 (my route test)
- **Fix:** `/admin/orders/deleted` added under `/admin/orders` in `sections.ts` (as Deleted Expenses sits under Company Expenses), with a test.
- **Files modified:** `web/src/modules/admin/sections.ts`, `sections.test.ts`
- **Committed in:** `2a390757`

**4. [Rule 1 - Bug] Two of my own RED expectations were wrong**
- **Found during:** Task 1 and Task 2 GREEN
- **Issue:** the service test expected a request body of `undefined` (the client reports `null`); my loading test used a 120 ms delay that typing outran.
- **Fix:** `body ?? null` is `null`; the loading test holds the reply open until released.
- **Committed in:** `2a390757`, `13e75ee0`

**5. Files outside the plan's list:** `ConfirmDialog.tsx` and its test, `useOrderAction.ts`, `sections.ts` and its test, `components/orders.recipe.ts` (a header actions row class) and `hooks/useDeletedOrdersQuery.ts`. Each is needed by the deviations above or by the Orders header link.

---

**Total deviations:** 4 auto-fixed (2 blocking, 2 bugs in my own tests or wiring). **Impact on plan:** none on scope; every change is optional or additive.

## Issues Encountered

- One combined vitest run of 50 files failed `routes.test.tsx > /dev/public ...` (a slow lazy route); it passed alone twice and in the full run afterwards. Recorded as a flake in `deferred-items.md`.
- The Testing seed route cannot seed a deleted order, so the e2e soft-deletes through the real API with a token from the page's refresh cookie. Web only; no backend change.

## TDD Gate Compliance

All three tasks have a `test(08-20)` commit before the `feat(08-20)` commit. RED evidence was inspected by hand because the project runs Vitest with a reporter the classifier is not given here; every target test ran and failed on the planned assertion or on a stub that throws "Not built yet":
- Task 1 RED: 22 failed (no heading, table, link, redirect; service stub). The Admin "no link" test passed at once (it guards a negative). `useDeletedOrdersListParams` is a declarative factory call, so its test passed at once and both went into the GREEN commit.
- Task 2 RED: 19 failed (17 dialog and page, 2 ConfirmDialog).
- Task 3 RED: only the Paid empty-value test failed. The loading, error, empty, access and long-name tests passed at once because the shared `ResponsiveTable` already does them; they stay as regression tests. I did not run a mutation check on them.
- No REFACTOR commit.

## Verification run (quoted)

- Full web unit suite: `Test Files 257 passed (257)`, `Tests 7336 passed (7336)`.
- `npm --prefix web run typecheck`: exit 0. `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output.
- `npm --prefix web run e2e -- --grep @orders-deleted`: `15 passed (1.2m)` (3 tests in 5 projects: chromium, firefox, webkit, pixel, iphone), exit 0. Task 1 alone: `5 passed (36.0s)`.
- Acceptance: `path: 'orders/deleted'` appears once in `routes.tsx` with `loader: requireManagerOrOrders`; ` q:` appears 0 times in `useDeletedOrdersListParams.ts`; `Delete Order Permanently` is in `deletedOrdersCopy.ts`; `PurgeOrderDialog.test.tsx` has the test "keeps the button disabled for one character off ... the exact number"; `DeletedOrdersPage.test.tsx` has "No deleted orders" and "Couldn't load deleted orders." tests.
- gitleaks on every staged change: no leaks. Fake data only (example.ph addresses, invented names); no real names, paths or connection strings added. No package added or bumped.
- Not run: coverage thresholds (the plan does not ask for them).

## Known Stubs

None. The RED stubs (service, page, dialog) were replaced in the GREEN commits.

## Authentication Gates

None.

## Threat Flags

None. The surface is the one in the plan's threat model: T-08-37 (route loader plus API 403, e2e Admin redirect), T-08-38 (counts read first, exact number, server re-check shown as the 400 line), T-08-39 (one Idempotency-Key per restore, double click sends one request), T-08-SC (no package).

## Next Phase Readiness

- 08-23 builds the read-only deleted order at `/admin/orders/deleted/:id`. The order number link and the eye button here already point to it; until it lands that address shows Page not found. `PurgeOrderDialog({ orderId, number, team, customer, open, onClose, onDone })` is ready for its "Delete Order Permanently" button (`onDone` is where it navigates back to the list).
- ORD-06 stays unchecked in REQUIREMENTS.md: plans 08-22, 08-23 and 08-24 also declare it and have no summary yet.

## Self-Check: PASSED

- Created files exist (`DeletedOrdersPage.tsx`, `PurgeOrderDialog.tsx`, `deletedOrdersService.ts`, the three hooks, `deletedOrdersCopy.ts`, `deletedOrderFixtures.ts`, `orders-deleted.spec.ts`, this summary).
- Commits `9a3646ee`, `2a390757`, `cf6b0681`, `13e75ee0`, `9ce92923`, `41ffe122` are ancestors of HEAD.

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*
