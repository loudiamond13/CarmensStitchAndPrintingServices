---
phase: 08-order-screens
plan: 17
subsystem: ui
tags: [react, react-hook-form, zod, tanstack-query, msw, playwright, modal, idempotency, discounts]
created: 2026-10-30T04:20:00-05:00
updated: 2026-10-30T04:20:00-05:00

requires:
  - phase: 08-order-screens
    provides: OrderWindow, useOrderChildSave, orderSavedMessage, useOrderAction, focus-return pattern (08-14); SegmentedControl and MoneyInput; readOnly tabs and OrderTabHead action slot (08-12); canEditOrder (08-10); the 08-16 payment tab as the sibling pattern
provides:
  - "Add, edit and delete of order discounts from the Discounts tab, every save answering the whole order"
  - "OrderDiscountModal: Reason, Type (Fixed ₱ default or Percent %), Value and a labelled Computed amount preview, with RecordMeta on edit"
  - "orderDiscountSchema(subtotal, otherDiscounts), discountPreview and otherDiscountsTotal: the OR-3 mirror of the server's discount rules including the items-total cap"
  - "orderDiscountsService (add with key and version, update with version, remove with neither)"
affects: [08-18, 08-19, 08-24]

actuals:
  tokens: 23400
  tasks: 2
  commits: 4
plan_head_before: a19aa2e4eb2575d1e137b245c13c0fe5bef7be70
plan_head_after: 7cf4d84fad8c1913dae847da6e40773dd63f95fa

tech-stack:
  added: []
  patterns:
    - "The cap of a value is a pure function of the server's figures: the items total minus what the other discounts come to, with the edited discount left out"
    - "A table footer label spans the data columns only, so an added actions column does not push the total out of its column"

key-files:
  created:
    - web/src/modules/admin/components/OrderDiscountModal.tsx
    - web/src/modules/admin/components/OrderDiscountModal.test.tsx
    - web/src/modules/admin/components/OrderDiscountsTab.test.tsx
    - web/src/modules/admin/services/orderDiscountsService.ts
    - web/src/modules/admin/services/orderDiscountsService.test.ts
    - web/src/modules/admin/orderDiscountSchemas.ts
    - web/src/modules/admin/orderDiscountSchemas.test.ts
    - web/src/modules/admin/orderDiscountCopy.ts
    - web/e2e/order-discounts.spec.ts
  modified:
    - web/src/modules/admin/components/OrderDiscountsTab.tsx
    - web/src/modules/admin/components/OrderTabs.test.tsx

key-decisions:
  - "The cap is the server items total minus the other discounts' amounts (each rounded to the centavo), so an edit leaves out its own saved amount"
  - "Switching Type clears Value, in edit mode as well as add"
  - "A percent Value accepts digits and one point only, up to 3 digits before the point; the schema judges the rest"
  - "Edit and Delete stay on any editable order; a discount that turns a paid order into a credit is allowed and toasts the credit"

patterns-established:
  - "Discount tab split into a read-only view and an editable view, as the Items and Payments tabs were"

requirements-completed: [ORD-07]

coverage:
  - id: D1
    description: "Staff add a discount from the Discounts tab: Reason, Type (Fixed default, Percent clears Value and shows the % field), Value, and a Computed amount preview from the server items total; one Idempotency-Key and the opened version are sent and the page shows the server's new totals"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderDiscountModal.test.tsx#shows \"Computed amount: ₱1,122.50\" for 5 percent of the server subtotal of ₱22,450.00"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderDiscountModal.test.tsx#posts a 5 percent discount once with an Idempotency-Key and the opened version, then closes and tells the parent"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-discounts.spec.ts#@orders-discounts a Manager gives a 5% discount and sees the server Discount and Total rows"
        status: pass
    human_judgment: false
  - id: D2
    description: "The browser refuses an empty or long reason, a missing or out-of-range value, a third decimal and any total above the items total with the server's words, and sends nothing"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/orderDiscountSchemas.test.ts (31 tests: value percent and fixed, kind, reason, preview, other discounts)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderDiscountModal.test.tsx#add mode checks before any request (OR-3) (10 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Edit opens with the saved values and RecordMeta; the cap leaves out the discount's own saved amount; 409 keeps the typed values and Load Latest takes the latest; a 422 discount-above-subtotal shows the server text"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderDiscountModal.test.tsx#edit mode cap leaves out the discount own saved amount (2 tests)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderDiscountModal.test.tsx#keeps the typed values behind the banner, and Load Latest takes the latest values, version and cap"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-discounts.spec.ts#@orders-discounts a Manager edits and deletes discounts with the cap holding, and the server totals follow each time"
        status: pass
    human_judgment: false
  - id: D4
    description: "Delete Discount asks with the reason, sends DELETE with no key or version, toasts Discount deleted and moves focus to a neighbour row or the heading; rows carry the D-54a names; completed, cancelled and read-only views show no action"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderDiscountsTab.test.tsx#Delete Discount (6 tests), row actions (2 tests), locked and deleted views (3 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A discount that turns a paid order into a credit is allowed and the toast reads Customer credit now ₱X."
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderDiscountsTab.test.tsx#toasts \"Customer credit now ₱X.\" when the answer has a positive customer credit"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-discounts.spec.ts#@orders-discounts a discount on a paid order is allowed and the toast names the customer credit"
        status: pass
    human_judgment: false
  - id: D6
    description: "The look of the Add Discount and Edit Discount windows (the Type control beside the Value, spacing of its label), the row action icons and the phone card in Blush and Espresso"
    verification: []
    human_judgment: true
    rationale: "Colour, spacing and layout feel are the owner's screenshot review; tests prove behavior, boxes and axe, not taste"

duration: about 35min
completed: 2026-10-30
status: complete
---

# Phase 08 Plan 17: Give and change discounts Summary

**Add, edit and delete order discounts from the Discounts tab through the shared OrderWindow: Reason, a Fixed ₱ / Percent % Type that clears Value when switched, a "Computed amount" preview from the server items total (half away from zero), browser checks in the server's words including the all-discounts-under-the-items-total cap (an edit leaves out its own saved amount), and the server's new totals after every save**

## Performance

- **Duration:** about 35 min (start time was not recorded; the first commit was at 03:49)
- **Completed:** 2026-10-30T04:15:00-05:00
- **Tasks:** 2
- **Files modified:** 11 under `web/` (5 new source files, 1 changed source file, 4 new test files, 1 changed test file, 1 new e2e spec) plus `deferred-items.md`

## Accomplishments

- **Add Discount**: the Discounts tab head has a primary `plus` Add Discount on an active order. The window has Reason (placeholder "e.g. Barangay league discount"), Type (Fixed ₱ by default, Percent %) and Value. Choosing Percent clears Value and shows the `%` field with the decimal keypad. "Computed amount: ₱1,122.50" shows for 5% of ₱22,450.00. It sends one Idempotency-Key, the kind, the value as a number, the trimmed reason and the version it opened with, then closes, sets the order from the answer and toasts "Discount added" with "Balance now ₱X.".
- **Browser checks in the server's words (OR-3)**: "Enter a reason for the discount." / "Keep the reason to 100 characters or fewer."; "Enter a discount value." / "Enter a discount from ₱0.01 to ₱1,000,000.00." / "Enter a percentage above 0 and up to 100." / "Use at most 2 decimal places."; and "The discounts would be more than the items total. Lower or remove a discount first." when this discount plus the others pass the items total. Nothing is sent when a check fails; the first broken field takes focus.
- **Edit Discount**: opens with the saved values and RecordMeta. The cap leaves out the discount's own saved amount. A 409 keeps the typed values behind the banner, and Load Latest replaces values, version and cap. A 422 shows the server's text in the banner; a 400 on `value` shows under Value; a 404 shows "This discount was removed." and blocks Save.
- **Delete Discount**: ConfirmDialog `Delete discount "{reason}"?` with the shared message; DELETE with no key and no version; toast "Discount deleted" with the balance; focus to the next row's Edit, else the previous, else the tab heading.
- **Credit case (07 D-12, D-05)**: a discount that makes a paid order owe the customer money is allowed, and the toast reads "Customer credit now ₱X." (from the shared `orderSavedMessage`).
- **Row actions** are named "Edit discount, {reason}" and "Delete discount, {reason}" with matching titles. Completed, cancelled and `readOnly` views show no Add, Edit or Delete.

## Task Commits

1. **Task 1: Give a 5% league discount and see the new total (tracer)** - `88982a2b` (test, RED) then `de3dd63b` (feat, GREEN)
2. **Task 2: Edit and delete discounts, and the credit case** - `59c5ac72` (test, RED) then `7cf4d84f` (feat, GREEN)

**Plan metadata:** the docs commits that follow this file (docs: complete plan, then state and roadmap).

## Files Created/Modified

- `web/src/modules/admin/components/OrderDiscountModal.tsx` - add and edit window on the shared OrderWindow
- `web/src/modules/admin/components/OrderDiscountsTab.tsx` - Add Discount, row Edit and Delete, delete dialog, focus rules; read-only view kept apart
- `web/src/modules/admin/orderDiscountSchemas.ts` - `orderDiscountSchema(subtotal, otherDiscounts)`, `blankOrderDiscount`, `discountPreview`, `otherDiscountsTotal`
- `web/src/modules/admin/orderDiscountCopy.ts` - the window, row action, delete and error words
- `web/src/modules/admin/services/orderDiscountsService.ts` - add, update, remove
- `web/e2e/order-discounts.spec.ts` - three `@orders-discounts` tests
- Tests: `OrderDiscountModal.test.tsx` (39), `OrderDiscountsTab.test.tsx` (17), `orderDiscountSchemas.test.ts` (31), `orderDiscountsService.test.ts` (4); `OrderTabs.test.tsx` changed (see deviations)

## Decisions Made

- The window and its tests follow the item and payment windows (08-14, 08-16), so the windows read alike.
- The cap is a pure function of the server's figures kept next to the schema; the server still decides (T-08-33). Each other discount is rounded to the centavo before summing, as in the pinned order of operations in `csps.ts`.
- A percent Value takes digits and one point only; the schema judges the range and decimals, so the server's words show for every rule.
- No ghost Add button in the empty tab, as in 08-16 (deferred item 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing Discounts table tests rendered the editable tab without providers**
- **Found during:** Task 1 (the tab now needs the query client and toasts when its actions show)
- **Issue:** six tests in `OrderTabs.test.tsx` render an active order with no providers.
- **Fix:** they pass `readOnly` (the table content they check is unchanged), as 08-14 and 08-16 did. The editable tab is covered by `OrderDiscountsTab.test.tsx`.
- **Files modified:** `web/src/modules/admin/components/OrderTabs.test.tsx` (outside the plan's file list)
- **Verification:** whole web suite 247 files, 7136 tests passed.
- **Committed in:** `de3dd63b`

**2. [Rule 1 - Bug] The footer total moved out of the Amount column once the actions column was added**
- **Found during:** Task 2 GREEN run (the Add test "shows the server's new rows and total discount" went red)
- **Issue:** the footer label spanned `columns.length - 1`, which counted the actions column.
- **Fix:** the span counts the data columns only (the Payments tab does the same with its fixed column list).
- **Files modified:** `web/src/modules/admin/components/OrderDiscountsTab.tsx`
- **Verification:** unit test green; `@orders-discounts` and `@orders-page` e2e green in five projects.
- **Committed in:** `7cf4d84f`

**3. [Rule 1 - Bug] A lint error in the schema (a string compared with both kinds)**
- **Found during:** Task 1 (`npm run lint`: `no-unnecessary-condition`)
- **Fix:** a small `kindOf(text)` helper replaces the double comparison.
- **Files modified:** `web/src/modules/admin/orderDiscountSchemas.ts`
- **Committed in:** `de3dd63b`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** none on scope. No package added. The plan's `files_modified` list gained only `OrderTabs.test.tsx`.

## Issues Encountered

- Two shell commands that used a heredoc with quotes failed to parse before running anything; the long test chunks were written with the Write tool and joined with `cat` of files, and the modal edit was applied by a small node script file. No stdin was read and no shell is left running.
- No flake seen: the `@orders-discounts` e2e passed in all five projects on its first run (1 test) and on the second run (3 tests, 15 passes).
- Owner review items are in `deferred-items.md` under "From plan 08-17" (no ghost Add button in the empty tab, the percent typing rule, the preview at zero, the cap rounding, Type clearing Value in edit mode, `kind` errors in the banner, no browser count of 20 discounts, the footer span, the look in a browser).

## Verification

- `npm --prefix web run test -- --run` (whole web suite): 247 files, 7136 tests passed.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output.
- `npm --prefix web run typecheck`: clean. `npm --prefix web run format:check`: clean.
- `npm --prefix web run e2e -- --grep @orders-discounts`: 15 passed in 5 projects (3 tests). `npm --prefix web run e2e -- e2e/order-page.spec.ts`: 10 passed (regression check).
- Bundle budgets in the e2e build: public JS 124.94 KB of 150, admin JS 214.78 KB of 250, CSS 16.19 KB of 35.
- gitleaks (pre-commit and by hand on the staged change): "no leaks found" on all four task commits.
- Acceptance greps: `The discounts would be more than the items total` in `orderDiscountCopy.ts` is 1; `OrderDiscountModal.test.tsx` has a test named with "1,122.50"; `OrderDiscountsTab.test.tsx` has a test named with "Customer credit now".

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-18 (expenses and refunds) can copy the same window and tab pattern. Its strings join their own copy files.
- `OrderBody` still passes no `readOnly` to the Discounts tab; the deleted view (08-20/08-21) passes it when it builds its own body.
- Task 1 is a tracer: its unit tests and the `@orders-discounts` e2e (five projects) were green end to end before the expansion task started and stayed green.

## Known Stubs

None. Nothing in the new files renders hardcoded empty or placeholder data.

## Self-Check: PASSED
