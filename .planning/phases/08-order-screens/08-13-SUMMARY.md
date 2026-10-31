---
phase: 08-order-screens
plan: 13
subsystem: ui
tags: [react, react-hook-form, zod, react-router, useBlocker, useFieldArray, playwright]
created: 2026-10-30T01:35:00-05:00
updated: 2026-10-30T01:35:00-05:00

requires:
  - phase: 08-order-screens
    provides: ordersService.create, useBusinessToday, useApplyOrder, ListEntrySelect, order page recipes and copy (08-03, 08-04, 08-06, 08-09, 08-10)
provides:
  - "New Order form at /admin/orders/new that saves details and items in one call and lands on the new order"
  - "orderFormSchemas.ts: orderDetailsSchema, orderItemSchema, createOrderSchema, toCreateOrderRequest (every server rule, server words)"
  - "OrderItemsEditor: useFieldArray item grid with focus rules, 100 row cap and live previews"
  - "useUnsavedChangesGuard: the Discard changes guard the Edit Order form (08-15) and the item windows reuse"
  - "orderNavigation.ts: backTarget shared by the order page and the form"
affects: [08-14, 08-15, 08-24]

actuals:
  tokens: 31650
  tasks: 3
  commits: 7
plan_head_before: 3c2e1f311ae389a63a7045a488811d6f075f1543
plan_head_after: ecbe673ed3e7f1ca744f3867a44764b1acb5ae63

tech-stack:
  added: []
  patterns:
    - "useBlocker + useBeforeUnload guard with a leaving ref set before navigate"
    - "Item grid reads its own card width through a named container and three exact custom variants (it-md, it-lg, it-lt-lg)"
    - "Server 400 keys such as items[1].quantity mapped onto field array paths"

key-files:
  created:
    - web/src/modules/admin/pages/OrderFormPage.tsx
    - web/src/modules/admin/components/OrderItemsEditor.tsx
    - web/src/modules/admin/components/OrderSummaryAside.tsx
    - web/src/modules/admin/components/orderForm.recipe.ts
    - web/src/modules/admin/hooks/useUnsavedChangesGuard.ts
    - web/src/modules/admin/orderFormSchemas.ts
    - web/src/modules/admin/orderFormCopy.ts
    - web/src/modules/admin/orderFormPreview.ts
    - web/src/modules/admin/orderNavigation.ts
    - web/e2e/order-create.spec.ts
  modified:
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/pages/OrderPage.tsx
    - web/src/ui/app.css

key-decisions:
  - "The item grid follows the Items card width, not the page width (SPEC-DEVIATION): at the spec's page widths the card is too narrow for seven columns"
  - "A new order's schemas are constants, not functions of today: no server rule depends on today"
  - "useUnsavedChangesGuard returns { allowLeave, dialog }; the sign-in page is always allowed so a sign-out never prompts"
  - "No maxLength on the boxes, so the 'Keep ... fewer' lines can show"

patterns-established:
  - "Call guard.allowLeave() before navigating after a save (RESEARCH Pitfall 11)"
  - "A server field key maps to a form path through a small lookup (serverFieldPath), unmatched keys fall to a banner"

requirements-completed: [ORD-15, ORD-07]

coverage:
  - id: D1
    description: "Staff create an order at /admin/orders/new (details and items in one save) and land on /admin/orders/{id} with the toast 'Order saved'"
    requirement: ORD-15
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#posts the order once with an Idempotency-Key, lands on its page and toasts"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-create.spec.ts#@orders-create a Manager creates an order with one item and lands on its page with the server total"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every server rule is checked in the browser first with the server's own words (OR-3), and server field errors win"
    requirement: ORD-15
    verification:
      - kind: unit
        ref: "web/src/modules/admin/orderFormSchemas.test.ts (51 tests)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#puts a server 400 on items[1].quantity under the Qty of row 2 and focuses it"
        status: pass
    human_judgment: false
  - id: D3
    description: "One Idempotency-Key per submission reused on retry; a double click sends one request (SEC-06)"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#sends one request for a double click"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#retries a network failure with the same Idempotency-Key"
        status: pass
    human_judgment: false
  - id: D4
    description: "Item grid: one blank row, Add and Remove focus rules, 100 row cap, empty line, live line totals and footer, summary aside"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderItemsEditor.test.tsx (15 tests)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#shows the live summary: status, due date, line items, pieces and the total preview"
        status: pass
    human_judgment: false
  - id: D5
    description: "Leaving a dirty form asks 'Discard changes?' (Keep Editing first, once per Discard); clean, saved and sign-out never prompt; reload and close get the browser prompt"
    requirement: ORD-15
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useUnsavedChangesGuard.test.tsx (11 tests)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-create.spec.ts#@orders-create leaving a half filled form asks Discard changes? and Keep Editing keeps the typed values"
        status: pass
    human_judgment: false
  - id: D6
    description: "409 orders.busy banner above the first card with values kept and the same key on retry; save bar caption rules"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderFormPage.test.tsx#shows the busy banner above the first card, keeps the values, and retries with the same key"
        status: pass
    human_judgment: false
  - id: D7
    description: "A focused field is never hidden under the save bar or the top bar; item boxes are 44px on a phone"
    verification:
      - kind: e2e
        ref: "web/e2e/order-create.spec.ts#@orders-create on a phone a focused item field is never hidden under the save bar (D-54d)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/orderForm.recipe.node.test.ts"
        status: pass
    human_judgment: false
  - id: D8
    description: "The look of the form in Blush and Espresso (spacing, save bar over the tab bar, item row layouts at mid widths)"
    verification: []
    human_judgment: true
    rationale: "Colour, spacing and layout feel are the owner's screenshot review; tests prove boxes and behavior, not taste"

duration: 52min
completed: 2026-10-30
status: complete
---

# Phase 08 Plan 13: Create an order, with the unsaved-changes guard Summary

**New Order form at /admin/orders/new: customer, dates, status and a `useFieldArray` item grid saved in one call with a reused Idempotency-Key, every server rule checked first in zod, and a `useBlocker` "Discard changes?" guard that Edit Order will reuse**

## Performance

- **Duration:** 52 min
- **Started:** 2026-10-30T05:34:56Z
- **Completed:** 2026-10-30T06:27:00Z
- **Tasks:** 3
- **Files modified:** 19 (10 created, 3 modified in the main code, 6 test files)

## Accomplishments

- Staff create an order with customer details, dates, a starting status (Pending default, five active statuses), notes and 1 to 100 items. Save sends one POST with one `Idempotency-Key`; a double click sends one request and a retry after a network failure or a 409 reuses the key. On success the order page opens with the toast "Order saved" / "{number} · {team or customer}".
- `orderFormSchemas.ts` mirrors `OrderRules.cs` word for word (customer name, team, contact number, email, address, dates with due on or after order date, status, notes, 1 to 100 items, product type, description, size, quantity 1 to 10,000, unit price ₱0.00 to ₱1,000,000.00 with 2 decimals). Server 400 keys such as `items[1].quantity` land on their row and win; the first flagged field takes focus.
- `OrderItemsEditor`: one blank row at the start (D-49), Add Item focuses the new Product type, Remove focuses the next row, else the previous, else Add Item; at 100 rows Add Item is `aria-disabled` with the note; the empty line reads "No items yet. Add at least one to save the order."; line totals and the footer ("3 pcs across 1 line item") and the summary aside are previews, not live regions.
- `useUnsavedChangesGuard`: held in-app moves open "Discard changes?" with Keep Editing focused first; Discard Changes moves once; a clean form, a saved form and a move to `/admin/login` never prompt; reload and close use the browser's own prompt. The dialog is inert while a save is pending.
- Save bar caption (Unsaved changes, n fields need attention, Saving), the `orders.busy` banner, and scroll padding so a focused field is never under the sticky bar.

## Task Commits

1. **Task 1 (tracer): Create an order with one item and land on its page**
   - RED `97909ba1` (test): schema, page and route tests, e2e, stubs
   - GREEN `cc95313c` (feat): schemas, form page, route, shared back target
2. **Task 2: The item grid, its limits and the summary aside**
   - RED `dda0fe6b` (test)
   - GREEN `a89df780` (feat)
3. **Task 3: "Discard changes?" before leaving, busy orders, and the save bar**
   - RED `dd226f3f` (test)
   - GREEN `839acc4f` (feat)
4. **Formatting:** `ecbe673e` (style: Prettier on the new files)

**Plan metadata:** added by the docs commit that follows this file.

## Tracer gate

Task 1 was `type="tracer"` with an automated-only `<verify>` in `end-of-phase` mode, so the gate re-ran it: the three unit files and `@orders-create` e2e passed (Tracer verified end-to-end, expanding). The e2e was run again in all five projects after Task 3: 15 of 15 passed.

## TDD evidence

- RED 1 (`97909ba1`): schema file 44 failed of 51 (the 7 that passed were "accepts" cases against a permissive stub); page file 12 of 12 failed, each at the first planned assertion (the New Order heading never appeared from the stub page). Semantic assessment: the target tests ran and failed on the planned behavior, not on import or setup faults.
- RED 2 (`dda0fe6b`): editor file 15 of 15 failed (empty stub); 3 new page tests failed (no aside, no rows).
- RED 3 (`dd226f3f`): guard file 6 of 11 failed (the 5 passing are the "nothing is lost" cases the inert stub satisfies); page file 6 of 30 failed (dialog, beforeunload, Unsaved changes).
- The plan is `type: execute`, so `gsd check tdd-red-evidence` records were not produced; the RED runs above are the evidence.

## Verification (quoted)

- `npm --prefix web run lint`: exits 0, no output (`eslint . --max-warnings 0`).
- `npm --prefix web run typecheck`: exits 0.
- `npx prettier --check src/modules/admin src/ui e2e`: "All matched files use Prettier code style!"
- Plan tests: `OrderFormPage.test.tsx` + `orderFormSchemas.test.ts` + `routes.test.tsx` + `OrderItemsEditor.test.tsx` + `useUnsavedChangesGuard.test.tsx` + `orderForm.recipe.node.test.ts` + `OrderPage.test.tsx`: 229 passed.
- Full suite before the last edits: "Test Files 1 failed | 232 passed (233), Tests 1 failed | 6856 passed (6857)"; the one failure was the 100-row editor test (see Issues), which then passed 3 of 3 alone.
- `npm --prefix web run e2e -- --grep @orders-create`: "15 passed (50.3s)" (chromium, firefox, webkit, pixel, iphone; 3 tests each).
- Acceptance greps: `path: 'orders/new'` 1 line; `jitless` 1; `new Date()` none in the form page; `useFieldArray` 2; test names with "100" 2; guard imports from `react-router` with `createMemoryRouter` in its test. `grep -c useBeforeUnload` reads 2, not 1 (import line and call line); see deferred item 5.

## Files Created/Modified

- `web/src/modules/admin/pages/OrderFormPage.tsx`: F1 form, route default export; waits for the business date, then the form
- `web/src/modules/admin/components/OrderItemsEditor.tsx`: the item card (head, rows, empty line, limit note, footer)
- `web/src/modules/admin/components/OrderSummaryAside.tsx`: the Summary card
- `web/src/modules/admin/components/orderForm.recipe.ts` (+ `.node.test.ts`): layout, item grid, save bar and scroll padding classes
- `web/src/modules/admin/hooks/useUnsavedChangesGuard.ts`: the guard
- `web/src/modules/admin/orderFormSchemas.ts`, `orderFormCopy.ts`, `orderFormPreview.ts`, `orderNavigation.ts`
- `web/src/modules/admin/routes.tsx`: `orders/new` before `orders/:id`
- `web/src/modules/admin/pages/OrderPage.tsx`: now imports `backTarget` and `ORDERS_PATH` from `orderNavigation.ts` (no behavior change)
- `web/src/ui/app.css`: three exact container variants for the Items card
- `web/e2e/order-create.spec.ts`: three `@orders-create` tests

## Decisions Made

- Item grid follows the Items card's own width, with three exact custom variants (`it-md`, `it-lg`, `it-lt-lg`), because the lint rule forbids built-in container variants (Pitfall 22) and the page-width breakpoints do not fit the real shell.
- `orderDetailsSchema` and `createOrderSchema` are constants (no `today` argument).
- `allowLeave()` is called before `navigate` after a save; `useApplyOrder` primes the order page cache so the landing page shows the server's answer at once.
- No `maxLength` on boxes, so OR-3 lines can show.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Item grid columns overlapped at real desktop widths**
- **Found during:** Task 3 e2e run (axe `target-size`, "partially obscured")
- **Issue:** The spec's page-width breakpoints gave a 7-column row inside a card only 580 to 780px wide; the description column collapsed and the size box covered it.
- **Fix:** The Items card became a container; rows switch by card width (under 560px 4 columns, from 560px 6 columns, from 900px 7 columns with the header). Added `it-md`, `it-lg`, `it-lt-lg` to `app.css`; recipe tests pin the ranges meeting at 900px with no gap.
- **Files modified:** `orderForm.recipe.ts`, `orderForm.recipe.node.test.ts`, `OrderItemsEditor.tsx`, `app.css`
- **Verification:** `@orders-create` axe check passes in all five projects; recipe node test passes.
- **Committed in:** `839acc4f`

**2. [Rule 3 - Blocking] Shared back-link helper**
- **Found during:** Task 1
- **Issue:** `backTarget` lived inside `OrderPage.tsx` and was not exported; the form needs the same D-51 rule.
- **Fix:** Moved it to `orderNavigation.ts` and imported it in both pages.
- **Files modified:** `orderNavigation.ts`, `OrderPage.tsx`
- **Verification:** `OrderPage.test.tsx` passes unchanged.
- **Committed in:** `cc95313c`

**3. [Rule 1 - Bug] Test-only fixes**
- The first page test used a wrong product type id (fixture constant); the 100-row editor test used `findByRole` where many rows match and needed a longer wait; the e2e had to wait for the list before opening the next page (WebKit reports a cut-off request as a page error). Fixed in the tests only.

### Spec deviations recorded for the owner (SPEC-DEVIATION / SPEC-GAP in `deferred-items.md`, "From plan 08-13")

Item grid breakpoints, the tablet row layout (remove button no longer covers the description), the 44px remove button at every width, the empty caption on a clean form, banner versus toast failure routing.

---

**Total deviations:** 3 auto-fixed (2 bug, 1 blocking). **Impact on plan:** None on scope. The grid change is a layout rule only; it is recorded for owner review.

## Issues Encountered

- One flake in a full run (editor 100-row test, wait too short under load); passed 3 of 3 alone; wait lengthened. Recorded in `deferred-items.md`.
- `grep -c useBeforeUnload` in the plan's acceptance list expects 1; it counts lines and the import plus the call make 2. The intent (react-router, used once) holds.

## Known Stubs

None. The Images card is the planned D-27 "coming soon" card (not a stub of this plan's goal).

## Threat Flags

None. The create route, its Idempotency-Key rule and attribution handling already existed; this plan adds only the client. T-08-23 (key reuse and double click tested), T-08-24 (every rule mirrored, no attribution field sent: `toCreateOrderRequest` test) and T-08-25 (the guard never blocks sign-out) are mitigated. T-08-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-14 can import `orderItemSchema` from `orderFormSchemas.ts`.
- 08-15 (Edit Order) can reuse `orderDetailsSchema`, `orderFormCopy.ts`, the recipe cards, `OrderFormPage` (add the edit branch) and `useUnsavedChangesGuard`.
- Manual check left for the end of the phase (08-VALIDATION manual row): the browser's own `beforeunload` prompt on a dirty form.

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*

## Self-Check: PASSED
