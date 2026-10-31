---
phase: 08-order-screens
plan: 15
subsystem: ui
tags: [react, react-hook-form, zod, react-router, tanstack-query, playwright, optimistic-concurrency]
created: 2026-10-30T02:55:00-05:00
updated: 2026-10-30T02:55:00-05:00

requires:
  - phase: 08-order-screens
    provides: orderDetailsSchema, orderFormCopy, order form recipe cards, useUnsavedChangesGuard, OrderFormPage (08-13); useApplyOrder, useOrderQuery, orderRules.isLocked (08-10); ConflictBanner pattern (05)
provides:
  - "Edit Order at /admin/orders/:id/edit: customer details, dates and notes saved with PUT /orders/{id} and the version the form opened with"
  - "OrderLockedBanner: the neutral locked-order banner with an action slot (Back to Order here, Reopen Order in 08-19)"
  - "OrderFormCustomerCard and OrderFormDetailsCard: the two cards New Order and Edit Order share"
  - "updateOrderDetailsSchema and toUpdateOrderDetailsRequest in orderFormSchemas.ts"
affects: [08-19, 08-23, 08-24]

actuals:
  tokens: 13550
  tasks: 3
  commits: 6
plan_head_before: 9aa1810a131456ad4d9528e2db3e0376b106ee2c
plan_head_after: 32daa1394d0b7779b1e8b21e198eba2ec4651dd1

tech-stack:
  added: []
  patterns:
    - "The edit form keeps the order it opened with in state; a refetch never changes the version a save sends"
    - "useOrderQuery(id, { alwaysRefetch: true }) so a form opens on the stored version, not a 30 second old cache"
    - "LoadingRegion wraps the form so 'Order loaded.' is announced when the form takes the skeleton's place"

key-files:
  created:
    - web/src/modules/admin/components/OrderDetailsCards.tsx
    - web/src/modules/admin/components/OrderEditAside.tsx
    - web/src/modules/admin/components/OrderFormSaveBar.tsx
    - web/src/modules/admin/components/OrderLockedBanner.tsx
    - web/src/modules/admin/components/OrderLockedBanner.test.tsx
    - web/e2e/order-edit.spec.ts
  modified:
    - web/src/modules/admin/pages/OrderFormPage.tsx
    - web/src/modules/admin/pages/OrderFormPage.test.tsx
    - web/src/modules/admin/orderFormSchemas.ts
    - web/src/modules/admin/orderFormSchemas.test.ts
    - web/src/modules/admin/orderFormCopy.ts
    - web/src/modules/admin/orderPageCopy.ts
    - web/src/modules/admin/components/orderPage.recipe.ts
    - web/src/modules/admin/hooks/useOrderQuery.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx

key-decisions:
  - "updateOrderDetailsSchema is a constant (no today): no server rule depends on today, and the details schema already requires the due date"
  - "A locked order keeps the Edit Order header above the banner (SPEC-GAP, owner review)"
  - "The edit form always rereads the order on open, so it never opens on a cached version up to 30 seconds old"
  - "A 422 orders.locked on save rereads the order and shows the locked banner; a 404 on save or Load Latest shows the not found screen"

patterns-established:
  - "Shared form cards take a Control narrowed to the detail fields; the wider create control is narrowed once with a commented cast"
  - "Locked banner action slot: the page that shows it decides the action"

requirements-completed: [ORD-15, ORD-07]

coverage:
  - id: D1
    description: "Staff edit an order's customer details, dates and notes at /admin/orders/{id}/edit and land on the order page with the toast 'Order details saved'; the PUT carries the version the form opened with"
    requirement: ORD-15
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#PUTs the details with the version the form opened with, lands on the order and toasts"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-edit.spec.ts#@orders-edit a Manager edits the team name and sees it in the order header"
        status: pass
    human_judgment: false
  - id: D2
    description: "The edit form shows cards 1 and 2 without Status, Images or Items, an aside with the order number, StatusBadge and RecordMeta, and the document title 'Edit {number}'"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#the edit form (D-28, D-46, SEC-08)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every server rule is checked first in the browser with the server's words; the update schema requires the due date (OR-3)"
    requirement: ORD-15
    verification:
      - kind: unit
        ref: "web/src/modules/admin/orderFormSchemas.test.ts#updateOrderDetailsSchema and toUpdateOrderDetailsRequest"
        status: pass
    human_judgment: false
  - id: D4
    description: "A 409 edit.stale shows the ConflictBanner with typed values kept; Load Latest replaces values and version, focuses Customer name and announces 'Latest version loaded. Make your changes again.'; a focus refetch never changes the version sent"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#stale saves, loading and missing orders (ORD-08, UIC-14, UIC-20)"
        status: pass
    human_judgment: false
  - id: D5
    description: "First load shows a skeleton in a LoadingRegion 'Loading order…' then 'Order loaded.' and focuses Customer name; a missing or deleted order says so with Back to Orders"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#shows a skeleton in a Loading order region, then Order loaded. and focuses Customer name"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-edit.spec.ts#@orders-edit (Customer name focused after load)"
        status: pass
    human_judgment: false
  - id: D6
    description: "An imported order with no due date opens with Due date empty and required, with the hint 'This order came in without a due date. Enter one to save.'"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#opens an imported order with Due date empty and the hint, and asks for a date without sending anything"
        status: pass
    human_judgment: false
  - id: D7
    description: "A Completed or Cancelled order shows OrderLockedBanner with Back to Order instead of the form (also after a 422 orders.locked); Cancelled adds the refunds line; the banner has no axe violations"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderLockedBanner.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#shows the locked banner and Back to Order instead of the form for a completed order"
        status: pass
    human_judgment: false
  - id: D8
    description: "Leaving a dirty edit form asks 'Discard changes?' as the create form does"
    requirement: ORD-15
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useUnsavedChangesGuard.test.tsx (the same guard the edit form uses)"
        status: pass
    human_judgment: true
    rationale: "The guard is the 08-13 hook, tested and e2e-checked on the New Order form. The edit form uses it unchanged but has no edit-form-specific test of the dialog; the owner or verifier should confirm on the edit screen"
  - id: D9
    description: "The look of the edit form, the 409 banner above the first card and the locked banner on phones in Blush and Espresso"
    verification: []
    human_judgment: true
    rationale: "Colour, spacing and layout feel are the owner's screenshot review; tests prove behavior and boxes, not taste"

duration: 41min
completed: 2026-10-30
status: complete
---

# Phase 08 Plan 15: Edit an order's details Summary

**Edit Order at /admin/orders/:id/edit: customer, dates and notes saved with the version the form opened with, a 409 conflict banner with Load Latest, a "Discard changes?" guard, the no-due-date import rule and a locked-order banner**

## Performance

- **Duration:** 41 min
- **Started:** 2026-10-30T07:12:00Z
- **Completed:** 2026-10-30T07:53:00Z
- **Tasks:** 3
- **Files modified:** 16 (6 created, 10 modified)

## Accomplishments

- Staff open `/admin/orders/{id}/edit`, change customer details, dates or notes, and save with `PUT /orders/{id}` carrying the version the form opened with (no Idempotency-Key, no status, no attribution). They land on the order page with the toast "Order details saved" / "{number}". The aside shows the order number, the StatusBadge and RecordMeta (Recorded by, Last changed by).
- A stale save (409 `edit.stale`) shows the ConflictBanner above the first card and keeps every typed value. Load Latest replaces the values and the version, focuses Customer name and says "Latest version loaded. Make your changes again." A focus refetch with a newer version does not change the version sent (tested).
- First load shows a skeleton in a LoadingRegion ("Loading order…" then "Order loaded.") and focuses Customer name. A missing or deleted order, on load, on save or on Load Latest, says "This order was not found or was deleted." with Back to Orders. The form always rereads the order on open, so it never opens on a cached version up to 30 seconds old.
- An imported order with no due date opens with Due date empty and required and the hint "This order came in without a due date. Enter one to save."; saving empty shows "Enter the due date." and sends nothing; the hint gives way to the days-away line once a date is typed.
- `OrderLockedBanner` (lock icon, "This order is {completed | cancelled}.", "Reopen it to make changes.", Cancelled adds the refunds line, action slot, full-width action on phones). Completed and Cancelled orders show it with a secondary "Back to Order" instead of the form, also when a save returns 422 `orders.locked`.
- The Customer details and Order details cards and the save bar were pulled out of the New Order form into shared components, so both forms use the same markup; the 30 New Order tests and the `@orders-create` e2e still pass.

## Task Commits

1. **Task 1 (tracer): Change a customer's phone number and see it on the order**
   - RED `72edf44a` (test)
   - GREEN `e6b90511` (feat)
2. **Task 2: Conflicts, loading and missing orders on the edit form**
   - RED `1fd78912` (test)
   - GREEN `1a63ef6e` (feat)
3. **Task 3: Imported orders without a due date, and locked orders**
   - RED `25f5ff18` (test)
   - GREEN `32daa139` (feat)

**Plan metadata:** added by the docs commit that follows this file.

## Tracer gate

Task 1 was `type="tracer"` with an automated-only `<verify>`, so the gate re-ran it: the three unit files (132 tests) and `@orders-edit` e2e (5 passed) passed, and the log read "Tracer verified end-to-end, expanding". After Task 3 the e2e ran again together with `@orders-create` (the shared cards were refactored): 20 of 20 passed across chromium, firefox, webkit, pixel and iphone.

## TDD evidence

- RED 1 (`72edf44a`): 8 of 132 failed. Seven page and route tests failed at the first planned assertion (`Unable to find role="heading" and name "Edit Order"`: the create form rendered); the request builder test failed on the body (`version: null` from the stub). Semantic assessment: the target tests ran and failed on the planned behavior, not on import or setup faults.
- RED 2 (`1fd78912`): 5 of 42 failed (no `alert` for the 409, no Load Latest button, no "Order loaded." because the region unmounted, no not found screen for a 404 on load or on save). The "focus refetch keeps the version" test passed at RED because Task 1 already keeps the opened order.
- RED 3 (`25f5ff18`): 7 of 53 failed (banner stub rendered nothing: 4 banner tests; completed, cancelled and 422 locked page tests). The no-due-date tests (3) and the banner "no inline style" test passed at RED: the hint and the required date are props of the shared details card built in Task 1, and the stub rendered nothing.
- The plan is `type: execute`, so no `gsd check tdd-red-evidence` records were made; the RED runs above are the evidence. The already-green tests stay as regression tests (also in `deferred-items.md`, "From plan 08-15", item 11).

## Verification (quoted)

- `npm --prefix web run lint`: exits 0, no output (`eslint . --max-warnings 0`).
- `npm --prefix web run typecheck`: exits 0, no output.
- `npx prettier --check src/modules/admin e2e`: "All matched files use Prettier code style!"
- Full web suite: "Test Files  239 passed (239) / Tests  6971 passed (6971)".
- Plan tests: `OrderFormPage.test.tsx` (48 tests incl. 6 edit, 6 stale and 6 locked or undated) + `OrderLockedBanner.test.tsx` (5) + `orderFormSchemas.test.ts` + `routes.test.tsx`: all passed.
- Node guard tests (`source-layout`, `no-long-dash`, `stylesheet-contract`, recipe tests): 223 passed.
- `npm --prefix web run e2e -- --grep "@orders-edit|@orders-create"`: "20 passed (1.3m)". The standalone `@orders-edit` run before Task 3: "5 passed (40.7s)". Preflight showed all ports free and no stray processes before each run.
- Acceptance greps: `path: 'orders/:id/edit'` finds one line (routes.tsx:168); `grep -c "This order came in without a due date" orderFormCopy.ts` is 1; `grep -n "style=" OrderLockedBanner.tsx` finds nothing; the page test asserts `version` is `ORDER_VERSION` in the PUT body; tests named "Load Latest" and "not found" exist.
- gitleaks ran on every commit through the pre-commit hook and on the staged change: "no leaks found". No local paths, server names or real customer data in any file (fixtures use fake names).

## Files Created/Modified

- `web/src/modules/admin/pages/OrderFormPage.tsx`: F1 and F2 behind one route component; `EditOrderPage` (fresh read, skeleton, 404), `EditOrderForm` (form, conflict, Load Latest, locked, guard), `NewOrderPage`
- `web/src/modules/admin/components/OrderDetailsCards.tsx`: shared Customer details and Order details cards
- `web/src/modules/admin/components/OrderEditAside.tsx`: number, status and RecordMeta
- `web/src/modules/admin/components/OrderFormSaveBar.tsx`: the save bar and its caption rule
- `web/src/modules/admin/components/OrderLockedBanner.tsx` (+ test) and the three banner classes in `orderPage.recipe.ts`
- `web/src/modules/admin/orderFormSchemas.ts`: `updateOrderDetailsSchema`, `toUpdateOrderDetailsRequest`
- `web/src/modules/admin/orderFormCopy.ts`, `orderPageCopy.ts`: edit and locked words
- `web/src/modules/admin/hooks/useOrderQuery.ts`: `alwaysRefetch` option
- `web/src/modules/admin/routes.tsx` (+ test): the `orders/:id/edit` route
- `web/e2e/order-edit.spec.ts`: `@orders-edit`

## Decisions Made

- The update schema is a constant, not a function of `today` (no server rule depends on it; 08-13 made the same call).
- The edit form rereads the order on every open and keeps the order it opened with, so a save sends the stored version or is refused with a 409.
- Locked orders show the banner and Back to Order under the usual header; the form is not rendered (T-08-30). A 422 on save rereads and shows the banner.
- The banner's action is a slot, so 08-19 can put Reopen Order in the same component.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Shared cards and save bar extracted from the New Order form**
- **Found during:** Task 1
- **Issue:** The customer and details cards and the save bar were inline JSX in `CreateOrderForm`. The edit form needs the same cards (08-13 handoff: "reuse the recipe cards"). Copying about 250 lines would let the two forms drift.
- **Fix:** Moved them to `OrderDetailsCards.tsx` and `OrderFormSaveBar.tsx`; the create form passes the Status select in a slot. `Control` is invariant in its field values, so the create form narrows its control once with a commented cast.
- **Files modified:** `OrderFormPage.tsx`, new component files
- **Verification:** all 30 original `OrderFormPage` tests and the 3 `@orders-create` e2e tests (5 projects) still pass.
- **Committed in:** `e6b90511`

**2. [Rule 2 - Missing critical functionality] Fresh read on open, and 422 and 404 on save**
- **Found during:** Task 1 and Task 2
- **Issue:** The order page keeps the order cached for 30 seconds. Without a fresh read a form could open on a stale version and be refused. The plan did not say what to do when a save finds the order locked or deleted.
- **Fix:** `useOrderQuery` gained `alwaysRefetch`; the form waits for that read. A 422 `orders.locked` rereads and shows the banner; a 404 shows the not found screen.
- **Files modified:** `useOrderQuery.ts`, `OrderFormPage.tsx`
- **Verification:** unit tests for each case; recorded in `deferred-items.md` items 5 and 6.
- **Committed in:** `e6b90511`, `1a63ef6e`, `32daa139`

**3. [Rule 1 - Bug] Test-only fixes**
- Hooks were called inside a render helper (lint `rules-of-hooks`), and an assertion looked for the actor name as one text node. Fixed in the tests only.

### Spec deviations recorded for the owner (SPEC-GAP in `deferred-items.md`, "From plan 08-15")

The constant update schema (item 1), the Edit Order header above the locked banner (2), the aside "Order" row and hint (3), the toast message being the number (4), the always-fresh read (5), 422 and 404 on save (6 and 7), the skeleton title (8).

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical) plus test-only fixes. **Impact on plan:** None on scope; the shared components are a refactor with the existing tests as proof.

## Issues Encountered

None that blocked. One e2e run needed the preflight first (all ports were free). No flakes seen in this plan's tests; the full suite passed in one run.

## Known Stubs

None.

## Threat Flags

None. T-08-29 (stale details save) is mitigated: the version comes from the opened snapshot, the 409 banner keeps typed values, and the focus-refetch test proves a newer cached version is not sent. T-08-30 (locked order edit) is mitigated: the form is not rendered for a locked order, and a server 422 shows the banner. T-08-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-19 can import `OrderLockedBanner` and pass Reopen Order as its child.
- 08-23 and 08-24 can reuse `OrderFormCustomerCard`, `OrderFormDetailsCard` and `OrderFormSaveBar`.
- Manual check left for the end of the phase: the browser's own `beforeunload` prompt on a dirty edit form (08-VALIDATION manual row), and the owner's screenshot review listed in `deferred-items.md` item 12.

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*

## Self-Check: PASSED

All created files exist on disk, all six task commits are ancestors of HEAD, and the `<acceptance_criteria>` and plan-level `<verification>` commands were re-run (results quoted above).
