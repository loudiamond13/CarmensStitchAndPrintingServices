---
phase: 08-order-screens
plan: 10
subsystem: ui
tags: [react, tanstack-query, nuqs, msw, vitest, playwright, orders, order-page, order-rules, tdd, a11y]
created: "2026-10-29T23:25:00-05:00"
updated: "2026-10-29T23:25:00-05:00"

requires:
  - phase: 08-order-screens
    provides: "08-01 the order detail API with totals, today and version; 08-02 OrderTotals and the centavo helpers; 08-03 shared order words; 08-06 ordersService, orderFixtures, createOrder and the Orders list with card links that send the list address in navigation state"
provides:
  - "/admin/orders/:id is the real order page (lazy route under the sign-in guard)"
  - "orderKey(id) = ['order', id], useOrderQuery(id) (default cache time, refetch on window focus)"
  - "ORDER_TABS and useOrderTab() (tab in the URL, items default, replace on change)"
  - "orderRules.ts: isLocked, canEditOrder, showRefundsTab, refundCap, canAddPayment, canComplete, canDeleteItem"
  - "useRefreshOrders() and ordersDeletedKey; useApplyOrder() returning (order) => void"
  - "OrderHeader, OrderItemsTab, orderPage.recipe.ts, ORDER_PAGE_COPY"
  - "web/e2e/order-page.spec.ts (@orders-page)"
affects: [08-11, 08-12, 08-14, 08-15, 08-16, 08-17, 08-18, 08-19, 08-20, 08-21, 08-22, 08-23, 08-24, order-page, deleted-orders]

actuals:
  tokens: 16700
  tasks: 3
  commits: 6
plan_head_before: 787ff4a0befa5015e46913c9b0dd168677cdbbf1
plan_head_after: bcdd3df31aa95c540e6aac0a812b43ecfe39bb15

tech-stack:
  added: []
  patterns:
    - "A page that loads one record wraps its loaded body in the LoadingRegion, so the 'Order loaded.' announcement outlives the skeletons"
    - "Back targets read navigation state as unknown, pass it through safeReturnUrl, then check the /admin/orders prefix"
    - "Order rules are pure functions of the server answer (status and money figures) judged by the centavo; refundCap builds money text through centavosToMoneyText"
    - "useApplyOrder sets the server answer into ['order', id] and then invalidates the lists, so no figure is worked out in the browser"
    - "A node test over the generated CSS pins the container-variant cascade of the detail grid (the narrower rule is important)"

key-files:
  created:
    - web/src/modules/admin/hooks/useOrderQuery.ts
    - web/src/modules/admin/hooks/useRefreshOrders.ts
    - web/src/modules/admin/hooks/useApplyOrder.ts
    - web/src/modules/admin/hooks/useApplyOrder.test.tsx
    - web/src/modules/admin/orderRules.ts
    - web/src/modules/admin/orderRules.test.ts
    - web/src/modules/admin/orderPageCopy.ts
    - web/src/modules/admin/components/OrderHeader.tsx
    - web/src/modules/admin/components/OrderItemsTab.tsx
    - web/src/modules/admin/components/orderPage.recipe.ts
    - web/src/modules/admin/components/orderPage.recipe.node.test.ts
    - web/e2e/order-page.spec.ts
  modified:
    - web/src/modules/admin/hooks/useOrderTab.ts
    - web/src/modules/admin/hooks/useOrderTab.test.tsx
    - web/src/modules/admin/pages/OrderPage.tsx
    - web/src/modules/admin/pages/OrderPage.test.tsx
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx

key-decisions:
  - "The order query key is ['order', id] and keeps the default cache time, so useBusinessToday can read the order's today without a request (asked by 08-09)"
  - "The tab strip draws four tabs with counts now; Refunds joins in 08-12 through showRefundsTab, and until then ?tab=refunds reads as Items"
  - "canComplete judges the figures only (balance exactly 0.00 and no credit), so an overpaid order with fullyPaid true cannot complete"
  - "refundCap is a preview of server figures in whole centavos (credit on an open order, paid minus refunded on a cancelled one, plus the saved amount on edit), never below 0.00"
  - "The back link accepts any literal /admin/orders path (including /admin/orders/deleted), otherwise goes to /admin/orders"
  - "ordersDeletedKey lives in useRefreshOrders.ts for 08-20 to reuse"

patterns-established:
  - "OrderBody holds the loaded page and its tab hook; OrderPage holds the states"
  - "The detail grid is main plus a 360px sticky side (320px up to 1279px, one column and side first up to 1023px)"

requirements-completed: [ORD-07, ORD-11, ORD-19]

coverage:
  - id: D1
    description: "Staff open /admin/orders/{id} and see the order number as the h1 with its status, the subline of team (or customer and Walk-in customer), order date and the due flag counted from the response's today, and who recorded and last changed it"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#the header (ORD-07, D-46, D-36)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/routes.test.tsx#the production /admin/orders/:id is the guarded real order page inside the shell (ORD-07)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-page.spec.ts#@orders-page a Manager opens an order from the list and sees its header, totals with profit, images card and items"
        status: pass
    human_judgment: false
  - id: D2
    description: "The totals panel shows the server's Subtotal, Discount, Total, Paid, Balance, Order Expenses and Estimated Profit for both an Admin and a Manager; nothing is worked out in the browser"
    requirement: ORD-19
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#the totals panel (ORD-07, ORD-19, D-06, D-08)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-page.spec.ts#@orders-page a Manager opens an order from the list and sees its header, totals with profit, images card and items"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Images card reads 'Image uploads are coming soon.' (D-27); the Items tab lists each item with its product badge, description, size, qty, unit price and line total, and ends with 'Items subtotal · {pcs} pcs'"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#the Images card (D-27)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#the Items tab (ORD-07)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-page.spec.ts#@orders-page a Manager opens an order from the list and sees its header, totals with profit, images card and items"
        status: pass
    human_judgment: false
  - id: D4
    description: "The tab card shows counts; the active tab is in ?tab= (items default), a change replaces the entry, and a bad value falls back to items with one replace"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrderTab.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#the tab card (ORD-07, WEB-10)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Edit Details links to the edit page on an active order and is hidden on a Completed or Cancelled order (D-15, D-39, D-46)"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#hides Edit Details on a %s order (D-15, D-39)"
        status: pass
    human_judgment: false
  - id: D6
    description: "orderRules decide lock, Refunds tab, refund cap, add payment, complete (a credit order cannot complete) and delete item from server figures only, by the centavo"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/orderRules.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "useApplyOrder writes a write's answer into ['order', id] and invalidates ['orders'], ['orders-deleted'] and the three list-entry keys, leaving other orders alone"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useApplyOrder.test.tsx"
        status: pass
    human_judgment: false
  - id: D8
    description: "First load shows skeletons in a region named 'Loading order…'; a failed load shows 'Couldn't load this order.' with Try Again; a 404 shows 'This order was not found or was deleted.' with Back to Orders; the title reads '{number} · CSPS Admin'"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#loading, failure and not found (UIC-14, UIC-18, UIC-19)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#the document title (ORD-07)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Back returns to the list as the user left it (filters, page, view) from navigation state, and a foreign, protocol-relative, backslash, other-admin or non-text address goes to /admin/orders (T-08-18)"
    requirement: ORD-11
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#the back link (D-51, T-08-18)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-page.spec.ts#@orders-page a Manager opens an order from the list and sees its header, totals with profit, images card and items"
        status: pass
    human_judgment: false
  - id: D10
    description: "The order page reads well at 390, 820 and 1440 px in Blush and Espresso (the detail grid, the side first on tablets, the Items table as row cards on phones, the skeleton)"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/orderPage.recipe.node.test.ts"
        status: pass
    human_judgment: true
    rationale: "The CSS cascade, axe in all five browser projects and the 320 px sideways-scroll check are proved; how the page looks at the three widths and in both themes is the owner's screenshot review (UI-SPEC Visual Review)"

duration: 23min
completed: 2026-10-29
status: complete
---

# Phase 08 Plan 10: Open an order Summary

**Staff open `/admin/orders/:id` and see the header (number, status, team, customer, order date, due flag, who recorded it), the totals panel with the server's figures and the internal Order Expenses and Estimated Profit for both roles, the Images "coming soon" card and the Items tab; the page handles loading, failure and a missing order, Back returns to the user's list without trusting foreign addresses, and `orderRules` and `useApplyOrder` give every later screen one tested place to ask what an order allows and to take a write's answer.**

## Performance

- **Duration:** 23 min
- **Started:** 2026-10-29T23:00:16-05:00
- **Completed:** 2026-10-29T23:23:31-05:00
- **Tasks:** 3
- **Files modified:** 18 (12 created, 6 changed)

## Accomplishments

- Tracer: a signed-in Manager finds a seeded order on the list, opens it from its card, and sees the number, the subline, the totals (₱9,360.00, ₱9,000.00, ₱5,000.00 due, Order Expenses, Estimated Profit), the Images card and the Items table with "Items subtotal · 12 pcs"; the tab goes in the URL and Back returns to `/admin/orders?q=...`. `@orders-page` passes in all five browser projects, with axe and the shared console and CSP guard. The tracer's `<verify>` is automated only, so both commands were re-run and passed (`Tracer verified end-to-end, expanding`).
- `orderRules.ts`: `isLocked`, `canEditOrder`, `showRefundsTab`, `refundCap`, `canAddPayment`, `canComplete`, `canDeleteItem`, all from server status and figures, judged by the centavo. A credit order with `fullyPaid` true cannot complete.
- `useApplyOrder` and `useRefreshOrders`: the write's answer goes into `['order', id]`, then the order lists, the deleted list and the three list-entry queries are read again.
- States: skeletons in a "Loading order…" region (the "Order loaded." announcement outlives them), "Couldn't load this order." with Try Again, "This order was not found or was deleted." with Back to Orders, and the title "{number} · CSPS Admin".
- Back link: the list address from navigation state only when it is a literal `/admin/orders` path; seven hostile or foreign values are tested to fall back.

## Task Commits

1. **Task 1: Open ORD-2026-0148 and see its header, totals and items (tracer)** - RED `528d4f2f` (test), GREEN `b1fad0df` (feat)
2. **Task 2: The order rules and the write-answer hook** - RED `591baa9e` (test), GREEN `d24432c7` (feat)
3. **Task 3: Loading, errors, not found and the list-preserving back link** - RED `00ba5ba9` (test), GREEN `bcdd3df3` (feat)

**Plan metadata:** the docs commit that holds this file and the state updates.

## TDD Gate Compliance

Each task has a `test(08-10)` commit before its `feat(08-10)` commit. Evidence came from the Vitest output; `gsd_run check tdd-red-evidence` was not run because this plan is `type: execute` and Vitest here does not write the TAP report that classifier reads (the same as plans 08-04, 08-06 and 08-09).

- **RED 1** (29 failed, 39 passed over 3 files): `Unable to find role="heading" and name "ORD-2026-0148"` (the stub rendered nothing) for the header, panel, Images and Items tests; `expected 'items' to be 'payments'` and the missing URL writes for `useOrderTab` (the stub read `items` always); the two `/admin/orders/:id` route tests failed because the splat answered. The sign-in redirect case passed already because the layout guard exists; it stays as a pin. Semantic assessment: valid RED, each failure is the planned behaviour missing, not an import or setup fault.
- **RED 2** (23 failed over 2 files): the stub rules returned fixed answers, so `isLocked`, `canEditOrder`, `showRefundsTab`, `refundCap` and `canComplete` failed on their assertions, and `useApplyOrder` failed on `getQueryData` being undefined and the lists not invalidated. Some "false" cases passed against the stub (for example a locked order cannot add a payment); they are real cases for the finished rules. Valid RED.
- **RED 3** (6 failed, 28 passed): no "Loading order…", no "Couldn't load this order.", no "This order was not found or was deleted.", the back link stayed `/admin/orders` for a card address, the title was empty. The seven hostile back-link cases passed against the constant and pin the guard. Valid RED.
- **GREEN** commits `b1fad0df`, `d24432c7` and `bcdd3df3` each turned their RED tests green. Test edits after RED were test-only corrections (see Deviations: lint on a helper that called a hook, two structural-sharing assertions, a lost backslash).
- No REFACTOR commit.

## Files Created/Modified

- `web/src/modules/admin/pages/OrderPage.tsx` - O1 page: states in `OrderPage`, the loaded page in `OrderBody`, the Images card, the skeleton.
- `web/src/modules/admin/components/OrderHeader.tsx`, `OrderItemsTab.tsx` - the header and the Items tab (heading, caption, ResponsiveTable with the subtotal footer).
- `web/src/modules/admin/components/orderPage.recipe.ts`, `orderPage.recipe.node.test.ts` - the page looks and a CSS cascade test.
- `web/src/modules/admin/orderPageCopy.ts` - every string of the page.
- `web/src/modules/admin/orderRules.ts` - the seven rules.
- `web/src/modules/admin/hooks/useOrderQuery.ts`, `useOrderTab.ts`, `useRefreshOrders.ts`, `useApplyOrder.ts` - the query, the tab, the refresh and the write-answer hook.
- `web/src/modules/admin/routes.tsx` - lazy `orders/:id`, placed before the splat.
- `web/e2e/order-page.spec.ts` - `@orders-page`.
- Tests: `OrderPage.test.tsx`, `orderRules.test.ts`, `useApplyOrder.test.tsx`, `useOrderTab.test.tsx`, `routes.test.tsx`.

## Decisions Made

- The order query key is `['order', id]` with the default cache time, as 08-09 asked, so `useBusinessToday` finds the order's `today` in the cache.
- The tab strip draws Items, Payments, Discounts and Expenses with counts now; Refunds joins in 08-12 through `showRefundsTab`. A tab the page does not draw reads as Items.
- `canComplete` judges the figures only, `refundCap` is a centavo preview that never goes below 0.00.
- Order Expenses and Estimated Profit are rendered by `OrderTotals variant="panel"` from `order.totals`; only the staff page uses that variant with the detail answer (ORD-19).
- `ordersDeletedKey` is defined in `useRefreshOrders.ts` for plan 08-20.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A test helper called a hook-named function**
- **Found during:** Task 1 (lint)
- **Issue:** `renderOrder` called `useOrderHandlers`, which `react-hooks/rules-of-hooks` rejects outside a component or an `it` callback.
- **Fix:** `beforeEach` installs the default fake API; a test that needs another order calls `useOrderHandlers({ detail })` itself.
- **Files modified:** `web/src/modules/admin/pages/OrderPage.test.tsx`
- **Committed in:** `b1fad0df`

**2. [Rule 1 - Bug] The loaded announcement vanished with the skeleton**
- **Found during:** Task 3 (the loading test failed on "Order loaded.")
- **Issue:** A first draft returned the loaded page instead of the LoadingRegion, so the polite status node that says "Order loaded." was removed with it.
- **Fix:** The page always renders the LoadingRegion; the skeleton or `OrderBody` is its child.
- **Files modified:** `web/src/modules/admin/pages/OrderPage.tsx`
- **Committed in:** `bcdd3df3`

**3. [Rule 2 - Missing critical] CSS cascade test for the detail grid**
- **Found during:** Task 1
- **Issue:** Tailwind emits the page-container variants up to 1023px before the one up to 1279px, so the 320px-side rule would beat the one-column rule on a tablet; jsdom evaluates no container query.
- **Fix:** An important modifier on the one-column rule, plus `orderPage.recipe.node.test.ts` over the generated CSS (as 08-06 did for the grid).
- **Files modified:** `web/src/modules/admin/components/orderPage.recipe.ts`, `orderPage.recipe.node.test.ts`
- **Committed in:** `b1fad0df`

**4. [Rule 1 - Bug] Test corrections after a wrong expectation**
- **Found during:** Tasks 2 and 3
- **Issue:** (a) TanStack Query keeps structural sharing, so a replaced order is deep-equal to the new answer but not the same object; the test had used `toBe`. (b) A heredoc lost a doubled backslash in the CSS-selector helper and in the backslash back-link case (a known issue on this shell, found in 08-06).
- **Fix:** `toEqual`; both backslashes restored through the file tool.
- **Files modified:** `web/src/modules/admin/hooks/useApplyOrder.test.tsx`, `orderPage.recipe.node.test.ts`, `OrderPage.test.tsx`
- **Committed in:** `d24432c7`, `b1fad0df`, `bcdd3df3`

**5. [Rule 3 - Blocking] The e2e extended beyond Task 1's files in Task 3**
- **Found during:** Task 3
- **Issue:** The title and Back checks belong to Task 3's behaviour but the plan lists the e2e file only under Task 1.
- **Fix:** The same spec gained the title check and the Back-to-list check in the Task 3 commit.
- **Files modified:** `web/e2e/order-page.spec.ts`
- **Committed in:** `bcdd3df3`

---

**Total deviations:** 5 auto-fixed (3 bug, 1 missing critical, 1 blocking)
**Impact on plan:** All needed to keep the suites green or the layout and announcements correct. No scope creep and no package added.

## Issues Encountered

- One shell heredoc with an apostrophe inside a Python string broke the command; the files were then written with the file tools. Nothing was half-written.
- Nothing flaked: the `@orders-page`, `@orders-list` and `@orders-filters` journeys passed 20 of 20 together in the last run.

## Verification

- `npm --prefix web run test -- --run src/modules/admin/pages/OrderPage.test.tsx src/modules/admin/hooks/useOrderTab.test.tsx src/modules/admin/routes.test.tsx`: passed (OrderPage 34, useOrderTab 9, routes 39 tests).
- `npx vitest --run src/modules/admin/orderRules.test.ts src/modules/admin/hooks/useApplyOrder.test.tsx`: 33 passed.
- Full web suite at the end: `Test Files  223 passed (223)`, `Tests  6593 passed (6593)`.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output. `npm --prefix web run typecheck`: exit 0. `npm --prefix web run format:check`: all files use Prettier style.
- `npm --prefix web run e2e -- --grep @orders-page`: 5 passed (chromium, firefox, webkit, pixel, iphone) at Task 1; with `@orders-list` and `@orders-filters`: 20 passed after Task 3.
- Acceptance greps: `path: 'orders/:id'` found once in `routes.tsx`; `gcTime: 0` absent from `useOrderQuery.ts`; `setQueryData` count in `useApplyOrder.ts` is 1; `safeReturnUrl` is in `OrderPage.tsx`; `OrderPage.test.tsx` has the Admin and Manager panel test and the "evil" and "outside" back-link cases; `orderRules.test.ts` has the "credit" case for `canComplete`.
- gitleaks (the pre-commit hook and a manual run) on every staged change: no leaks found. Fixture names are made up; no real emails, ids or local paths.
- Preflight run before the unit run and before each e2e run: all four ports free, no other project's processes.

## Known Stubs

- `web/src/modules/admin/pages/OrderPage.tsx`: the Payments, Discounts and Expenses tab panels draw nothing yet (the tabs, counts and the URL tab work). Plan 08-12 fills them with the tables. Recorded in `.planning/WINDOWS.md` and `deferred-items.md`.

## Threat Flags

None. T-08-18 (planted back target) is mitigated by `safeReturnUrl` plus the `/admin/orders` prefix check and proved with seven hostile values; T-08-19 (internal figures) by rendering Order Expenses and Estimated Profit only on this staff page, with the list answer carrying no such fields; T-08-20 (cache after writes) by `useApplyOrder` setting the server answer and invalidating the lists; T-08-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 08-12 adds the Payments, Discounts, Expenses and Refunds tab tables, the customer card, the status history and the phone balance card to `OrderPage.tsx` and `OrderBody`; `showRefundsTab` and the tab counts are ready.
- The window plans (08-14 to 08-21) can call `useApplyOrder()` with a write's answer and read `orderRules`.
- Plan 08-20 should key the deleted list under `ordersDeletedKey` from `useRefreshOrders.ts`.
- The page look at 390, 820 and 1440 px in both themes is for the owner's screenshot review; see `deferred-items.md` "From plan 08-10" for the wording to review.

---
*Phase: 08-order-screens*
*Completed: 2026-10-29*

## Self-Check: PASSED

- FOUND: web/src/modules/admin/pages/OrderPage.tsx, web/src/modules/admin/orderRules.ts, web/src/modules/admin/hooks/useApplyOrder.ts, web/src/modules/admin/hooks/useOrderQuery.ts, web/src/modules/admin/hooks/useOrderTab.ts, web/src/modules/admin/hooks/useRefreshOrders.ts, web/src/modules/admin/components/OrderHeader.tsx, web/src/modules/admin/components/OrderItemsTab.tsx, web/src/modules/admin/components/orderPage.recipe.ts, web/src/modules/admin/orderPageCopy.ts, web/e2e/order-page.spec.ts
- FOUND commits: 528d4f2f, b1fad0df, 591baa9e, d24432c7, 00ba5ba9, bcdd3df3
