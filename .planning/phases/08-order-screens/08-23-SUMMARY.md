---
phase: 08-order-screens
plan: 23
subsystem: ui
tags: [orders, deleted-orders, read-only, restore, permanent-delete, react, tanstack-query, msw, playwright]
created: "2026-10-30T07:45:00-05:00"
updated: "2026-10-30T07:45:00-05:00"
status: complete

requires:
  - phase: 08-order-screens
    provides: "08-07 GET /orders/deleted/{id}; 08-12 the readOnly props of the order tabs, totals and customer card; 08-20 PurgeOrderDialog, deletedOrdersService and useDeletedOrderQuery; 08-14 useOrderAction; 08-21 and 08-22 notes on the refund and header rules"
provides:
  - "Route orders/deleted/:id (Manager loader, lazy DeletedOrderPage): a Manager reads a deleted order read-only"
  - "DeletedOrderPage: header without menu or actions, banner, Images card, five read-only tabs with ?tab=, totals panel with Order Expenses and Estimated Profit, customer card and status history"
  - "OrderNoticeBanner({ icon, title, message, children }): the locked-banner look with any icon and an action area"
  - "Restore Order (one Idempotency-Key, then the live order and the toast) and Delete Order Permanently (the 08-20 counts dialog, then back to Deleted Orders)"
affects: [08-24]

actuals:
  tokens: 13100
  tasks: 2
  commits: 3
plan_head_before: afc2f79e7810d77c5cf5ea703e71cf153ce412bd
plan_head_after: 40cbd3869d927a89e703ff09b8b7befdb9a2b4b6

tech-stack:
  added: []
  patterns:
    - "A read-only view of a record reuses the live page's parts through their readOnly props and builds its own header, so no write control can appear"
    - "A 404 on a write for a record that left the list is read as 'it moved': the page reads it again and shows the not-found variant instead of a toast"

key-files:
  created:
    - web/src/modules/admin/pages/DeletedOrderPage.tsx
    - web/src/modules/admin/pages/DeletedOrderPage.test.tsx
    - web/src/modules/admin/components/OrderNoticeBanner.test.tsx
    - web/e2e/order-deleted-view.spec.ts
  modified:
    - web/src/modules/admin/components/OrderNoticeBanner.tsx
    - web/src/modules/admin/components/orderPage.recipe.ts
    - web/src/modules/admin/deletedOrdersCopy.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx

key-decisions:
  - "The deleted view builds its own header (back link, number, status badge, subline, who recorded) because OrderHeader offers Change Status, Edit Details and Delete Order"
  - "Restore removes the cached live order before it navigates, so the live page reads the order fresh"
  - "A 404 on the deleted read always wins over data read earlier, and a 404 on Restore shows the not-in-Deleted-Orders page with no toast"
  - "With no recorded deleter the banner reads 'This order was deleted on {date}.' (SPEC-GAP, owner review)"

patterns-established:
  - "OrderNoticeBanner takes a ReactNode title so a name can be the ActorName view (former staff suffix included)"

requirements-completed: [ORD-06, ORD-07]

coverage:
  - id: D1
    description: "A Manager opens /admin/orders/deleted/{id} and sees the order from the deleted read: number, status, subline, totals panel with Order Expenses and Estimated Profit, customer card, status history and every tab with its rows"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrderPage.test.tsx#the page, read-only (ORD-06, D-24)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-deleted-view.spec.ts#@orders-deleted-view a Manager opens a deleted order from Deleted Orders, sees it read-only and restores it"
        status: pass
    human_judgment: false
  - id: D2
    description: "The view has no Change Status, Edit Details, Delete Order, Add button, row action, Record Refund or customer Edit link on any tab, even for an order with credit and refunds"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrderPage.test.tsx#is read-only: no Change Status, Edit Details, Delete Order, Add button, row action, Record Refund or Edit link"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-deleted-view.spec.ts#@orders-deleted-view a Manager opens a deleted order from Deleted Orders, sees it read-only and restores it"
        status: pass
    human_judgment: false
  - id: D3
    description: "The banner says when (Manila time) and by whom the order was deleted, with Restore Order and Delete Order Permanently as the only buttons"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrderPage.test.tsx#the banner (D-57)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderNoticeBanner.test.tsx"
        status: pass
    human_judgment: false
  - id: D4
    description: "Restore sends one Idempotency-Key (a double click sends one POST), shows Restoring, goes to /admin/orders/{id} with the toast Order restored; a failure keeps the page and shows a danger toast"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrderPage.test.tsx#Restore Order (D-23, D-57)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-deleted-view.spec.ts#@orders-deleted-view a Manager opens a deleted order from Deleted Orders, sees it read-only and restores it"
        status: pass
    human_judgment: false
  - id: D5
    description: "Delete Order Permanently opens the counts dialog, enables only for the exact number, sends confirm=, goes back to Deleted Orders with the toast Order permanently deleted"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrderPage.test.tsx#Delete Order Permanently (07 D-28, D-57)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-deleted-view.spec.ts#@orders-deleted-view a Manager deletes a deleted order for good from its page after typing the number"
        status: pass
    human_judgment: false
  - id: D6
    description: "An Admin is redirected to /admin/orders by the route loader; a visitor without a session goes to sign-in with the return path"
    requirement: ORD-06
    verification:
      - kind: integration
        ref: "web/src/modules/admin/routes.test.tsx#One deleted order for Managers (ORD-06, D-24; plan 08-23)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-deleted-view.spec.ts#@orders-deleted-view an Admin opening a deleted order is sent back to Orders"
        status: pass
    human_judgment: false
  - id: D7
    description: "States: skeletons in a region named Loading order…, 'This order isn't in Deleted Orders.' with Back to Deleted Orders for a 404 (also after a Restore that meets an already restored order), 'Couldn't load this order.' with Try Again for a 500, the access banner for a 403, the tab in the URL and the title '{number} (deleted) · CSPS Admin'"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrderPage.test.tsx#loading, failure and not found (UIC-14, UIC-18, UIC-19)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrderPage.test.tsx#the document title"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedOrderPage.test.tsx#the back link and the tab"
        status: pass
    human_judgment: false
  - id: D8
    description: "How the deleted view, its banner with two buttons (stacked on phones) and the not-found page look in Blush and Espresso at 390, 820 and 1440 px, and the SPEC-GAP wording"
    verification: []
    human_judgment: true
    rationale: "Visual fit and owner wording review; the tests prove behavior, not the look (UI-SPEC owner screenshot review list)"

duration: 22min
completed: 2026-10-30
---

# Phase 08 Plan 23: Look inside a deleted order before restoring it Summary

*Created: 2026-10-30T07:45:00-05:00 · Updated: 2026-10-30T07:45:00-05:00*

**A Manager opens a deleted order at `/admin/orders/deleted/{id}` and reads everything the live page shows (rows, totals with Order Expenses and Estimated Profit, customer, history, all tabs) with no way to change it; a banner says who deleted it and when, and offers only Restore Order and Delete Order Permanently.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-30T07:23:47-05:00
- **Completed:** 2026-10-30T07:45:00-05:00
- **Tasks:** 2 (3 commits)
- **Files:** 9 in the web app (4 created, 5 modified incl. tests), plus `deferred-items.md`

## Accomplishments

- `DeletedOrderPage` builds the order page's layout from `GET /orders/deleted/{id}` with its own header (back link "Deleted Orders", number, status badge, subline, who recorded) and every part drawn `readOnly`: the five tabs, the customer card, the status history and the totals panel (no Record Refund). The tab lives in `?tab=` and the title reads "{number} (deleted) · CSPS Admin".
- `OrderNoticeBanner` (new) shares the locked-banner look with any icon and an action area. The deleted view uses the `archive` icon: "This order was deleted on Oct 12, 2026, 3:42 PM by Carmen Reyes." over "It counts nowhere until it's restored.", then primary "Restore Order" (pending "Restoring") and ghost-danger "Delete Order Permanently".
- Restore sends one POST with an Idempotency-Key, clears the cached live order, goes to `/admin/orders/{id}` and toasts "Order restored". Permanent delete reuses `PurgeOrderDialog` from 08-20 (counts, typed number) and returns to `/admin/orders/deleted` with "Order permanently deleted". Focus returns to the button when the dialog is cancelled.
- States: first load shows skeletons in a region "Loading order…"; a 404 (also after a Restore that finds the order already restored) shows "This order isn't in Deleted Orders." / "It may have been restored or deleted for good." with "Back to Deleted Orders"; a 500 shows "Couldn't load this order." with Try Again; a 403 shows the access banner.
- Route `orders/deleted/:id` with the Manager loader (an Admin goes to `/admin/orders`).

## Task Commits

1. **Task 1: A Manager opens a deleted order read-only and restores it** - RED `9ce11a8d` (test), GREEN `560385d4` (feat)
2. **Task 2: Loading, not found and the restored-meanwhile case** - `40cbd386` (test; the behavior came with Task 1, see Deviations)

**Plan metadata:** committed after this file (docs: complete plan).

## Files Created/Modified

- `web/src/modules/admin/pages/DeletedOrderPage.tsx` - X2 page: header, banner, tabs, side parts, restore, purge dialog, states
- `web/src/modules/admin/components/OrderNoticeBanner.tsx` - banner with icon, bold line, muted line and actions
- `web/src/modules/admin/components/orderPage.recipe.ts` - `orderNoticeActionsClasses`
- `web/src/modules/admin/deletedOrdersCopy.ts` - `detail` words (banner, states, titles)
- `web/src/modules/admin/routes.tsx` - lazy `orders/deleted/:id` with `requireManagerOrOrders`
- Tests: `DeletedOrderPage.test.tsx` (19), `OrderNoticeBanner.test.tsx` (5), `routes.test.tsx` (3 added), `web/e2e/order-deleted-view.spec.ts` (3 tests x 5 projects)

## Decisions Made

- The deleted view builds its own header, because `OrderHeader` offers Change Status, Edit Details and Delete Order (08-19, 08-22).
- Restore removes the cached `['order', id]` before navigating so the live page reads the order fresh, not what was cached before the delete.
- A 404 on the deleted read wins over data read earlier; a 404 on Restore refreshes and shows the not-found page without a second toast.
- With no recorded deleter the banner drops the "by" part (SPEC-GAP, owner review in `deferred-items.md`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `orderPage.recipe.ts` needed one class**
- **Found during:** Task 1 (two banner actions side by side)
- **Fix:** added `orderNoticeActionsClasses` (flex, wrap, 8 px gap, full width on phones); the recipe node test and class gate still pass.
- **Files modified:** `web/src/modules/admin/components/orderPage.recipe.ts` (outside the plan's file list)
- **Committed in:** `560385d4`

**2. [Rule 1 - Bug] Two of my own RED expectations were wrong**
- **Found during:** Task 1 GREEN
- **Issue:** the "no Edit or Delete row action" pattern also matched "Delete Order Permanently"; the double-click test had no delay on the reply, so the response came before the second click and a second POST (correct behavior of the one-key-per-action scheme) made two toasts. The 08-20 test uses an 80 ms delay for the same reason.
- **Fix:** the pattern excludes "Delete Order Permanently"; the reply waits 80 ms.
- **Committed in:** `560385d4`

**3. [Rule 1 - Bug] e2e guard flagged the expected 404**
- **Found during:** Task 1 e2e (first run failed 5 of 15)
- **Issue:** the last step opens the restored order's deleted address, which answers 404 on purpose; the shared guard counts that as a finding.
- **Fix:** `guard.expectStatus('/api/v1/orders/deleted/{id}', 404)` in that test.
- **Committed in:** `560385d4`

### Process deviations

- **Task 2 has a test commit and no feat commit.** The not-found state belongs to the Restore edge case (a 404 on Restore), so the page was written whole in Task 1. The Task 2 tests passed at once. I checked they bite: with the 404 line and the title function changed for one run, 3 tests failed; then I restored the copy.
- **Files outside the plan's list:** `orderPage.recipe.ts` (above) and `deferred-items.md`.

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs in my own tests), 1 process note. **Impact on plan:** none on scope; the class is additive.

## Issues Encountered

- None beyond the e2e guard above. No flake seen in the unit suite or in the final e2e run.

## TDD Gate Compliance

- Task 1: `test(08-23)` `9ce11a8d` before `feat(08-23)` `560385d4`. RED evidence by hand: 20 tests failed on the planned assertions (stubs returned nothing: no heading, no banner, no route); 1 passed at once (the banner's "no action area" check, which guards a negative). GREEN: 18 page and banner tests passed, then the 3 route tests.
- Task 2: tests only (`40cbd386`); mutation check as above. No REFACTOR commit.

## Verification run (quoted)

- Task tests: `Test Files 2 passed (2)`, `Tests 18 passed (18)` for the first run of page and banner tests; after Task 2 the page file has 19 tests, all passing.
- Full web unit suite: `Test Files  265 passed (265)`, `Tests  7453 passed (7453)`.
- `npm --prefix web run typecheck`: exit 0. `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output.
- `npm --prefix web run e2e -- --grep @orders-deleted-view`: `15 passed (53.2s)` (3 tests in 5 projects), exit 0.
- Class gate and layout checks: `orderPage.recipe.node.test.ts`, `source-layout.node.test.ts` and `no-long-dash.node.test.ts` pass in the same run as the page tests.
- Acceptance: `path: 'orders/deleted/:id'` appears once in `routes.tsx` with `loader: requireManagerOrOrders`; `DeletedOrderPage.test.tsx` has the "is read-only" test asserting no "Change Status" and no "Record Refund", and the "isn't in Deleted Orders" tests.
- gitleaks on every staged change: no leaks. Fake data only (example.ph style names, invented numbers). No real names, paths or connection strings added. No package added or bumped. No server code, schema, trigger or SQL touched, so no .NET build or test was needed.
- Not run: coverage thresholds (the plan does not ask for them).

## Known Stubs

None. The RED stubs were replaced in the GREEN commit.

## Authentication Gates

None.

## Threat Flags

None. The surface is the one in the plan's threat model: T-08-43 (route loader plus the Manager-only API, e2e Admin redirect), T-08-44 (every part `readOnly`, only restore and the typed-number purge exist; tests walk all five tabs for any write control), T-08-SC (no package).

## Next Phase Readiness

- ORD-06 and ORD-07 are declared again by 08-24; they stay unchecked until 08-24 has its summary.
- The ordinary order number links on Deleted Orders and the eye button now open a real page instead of Page not found.

## Self-Check: PASSED

- Created files exist (`DeletedOrderPage.tsx`, `DeletedOrderPage.test.tsx`, `OrderNoticeBanner.test.tsx`, `order-deleted-view.spec.ts`, this summary).
- Commits `9ce11a8d`, `560385d4`, `40cbd386` are ancestors of HEAD.

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*
