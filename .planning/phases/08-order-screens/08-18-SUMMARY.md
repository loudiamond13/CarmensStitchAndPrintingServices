---
phase: 08-order-screens
plan: 18
subsystem: ui
tags: [react, react-hook-form, zod, tanstack-query, msw, playwright, modal, idempotency, expenses]
created: 2026-10-30T04:50:00-05:00
updated: 2026-10-30T04:50:00-05:00

requires:
  - phase: 08-order-screens
    provides: OrderWindow, useOrderChildSave, orderSavedMessage, useOrderAction, focus-return pattern (08-14); PaidBySelect with its label, name and hint props (08-04, 08-16); ListEntrySelect picker for the order expense categories (08-04); readOnly tabs and OrderTabHead action slot (08-12); canEditOrder (08-10); the 08-16 and 08-17 tabs as the sibling pattern
provides:
  - "Add, edit and delete of order expenses from the Expenses tab, every save answering the whole order, so Order Expenses and Estimated Profit follow the server"
  - "OrderExpenseModal: Date (30 day rule and hint), Category, Description (optional), Amount and a required Paid by that starts on the signed-in person, with RecordMeta on edit"
  - "orderExpenseSchema(today) and blankOrderExpense: the OR-3 mirror of OrderExpenseFieldsValidator in the server's words"
  - "orderExpensesService (add with key and version, update with version, remove with neither)"
affects: [08-19, 08-24]

actuals:
  tokens: 21500
  tasks: 2
  commits: 4
plan_head_before: ff3821cbf59119931f5259ff20d730f5507e3284
plan_head_after: 21e70dfe9b5ddcb0730dc37717aeb29c5ee322fb

tech-stack:
  added: []
  patterns:
    - "Window field names are the server's field names, so a 400 lands under its field with no map"
    - "A saved payer who left, and a saved category that was retired, stay listed and selected on an edit so the form can be saved without changing them"

key-files:
  created:
    - web/src/modules/admin/components/OrderExpenseModal.tsx
    - web/src/modules/admin/components/OrderExpenseModal.test.tsx
    - web/src/modules/admin/components/OrderExpensesTab.test.tsx
    - web/src/modules/admin/services/orderExpensesService.ts
    - web/src/modules/admin/services/orderExpensesService.test.ts
    - web/src/modules/admin/orderExpenseSchemas.ts
    - web/src/modules/admin/orderExpenseSchemas.test.ts
    - web/src/modules/admin/orderExpenseCopy.ts
    - web/e2e/order-expenses.spec.ts
  modified:
    - web/src/modules/admin/components/OrderExpensesTab.tsx
    - web/src/modules/admin/components/OrderTabs.test.tsx

key-decisions:
  - "The window uses PaidBySelect's default label, name and hint (the plan says so); order-specific Paid by words are an owner call"
  - "Description is optional and sent as null when empty, as the server allows"
  - "Form fields carry the server's names (expenseDate, orderExpenseCategoryId, description, amount, paidByUserId)"
  - "No ghost Add button in the empty tab, as in 08-16 and 08-17"

patterns-established:
  - "Expenses tab split into a read-only view and an editable view, as the Items, Payments and Discounts tabs were"

requirements-completed: [ORD-07, ORD-19]

coverage:
  - id: D1
    description: "Staff add an order expense from the Expenses tab: Date (server today, 30 day hint), Category (Choose a category), Description, Amount and a required Paid by that starts on the signed-in person; one Idempotency-Key, paidByUserId and the opened version are sent, the page shows the server's Order Expenses and Estimated Profit, and the toast reads Expense added / Order expenses now ₱X."
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderExpenseModal.test.tsx#posts once with an Idempotency-Key, the chosen payer and the opened version, then closes and tells the parent"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderExpensesTab.test.tsx#adds an expense, shows the server's new rows and Order expenses total, and puts focus back on Add Expense"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-expenses.spec.ts#@orders-expenses a Manager records a cost paid by a coworker and sees both names and the new profit"
        status: pass
    human_judgment: false
  - id: D2
    description: "The browser refuses a missing category, a date 31 days after today (naming the latest day), a description over 200, an amount of 0 or above 1,000,000.00 and a third decimal, in the server's words, and sends nothing"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/orderExpenseSchemas.test.ts (22 tests: date, category, payer, description, amount, blank)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderExpenseModal.test.tsx#add mode checks before any request (OR-3) (5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Edit opens with the saved values and RecordMeta, keeps a saved inactive or former payer and a retired category selected, shows a 400 on paidByUserId under Paid by, keeps typed values on a 409 with Load Latest, and blocks Save on a 404"
    requirement: ORD-23
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderExpenseModal.test.tsx#edit mode opening, edit mode saving, edit mode server refusals (UIC-29), edit mode stale save (409) and a removed expense (404) (13 tests)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-expenses.spec.ts#@orders-expenses a Manager edits and deletes order expenses and the profit follows the server"
        status: pass
    human_judgment: false
  - id: D4
    description: "Delete expense of {₱X} asks with the order number, sends DELETE with no key or version, toasts Expense deleted / Order expenses now ₱X. and moves focus to a neighbour row or the heading; rows carry the D-54a names; completed, cancelled and read-only views show no action"
    requirement: ORD-19
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderExpensesTab.test.tsx#Delete expense of (6 tests), row actions (D-54a) (2 tests), locked and deleted views (3 tests)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-expenses.spec.ts#@orders-expenses a Manager edits and deletes order expenses and the profit follows the server"
        status: pass
    human_judgment: false
  - id: D5
    description: "The look of the Add Expense and Edit Expense windows (field order, the Description row across both columns, the Recorded by block), the row action icons and the phone card in Blush and Espresso"
    verification: []
    human_judgment: true
    rationale: "Colour, spacing and layout feel are the owner's screenshot review; tests prove behavior, boxes and axe, not taste"

duration: about 28min
completed: 2026-10-30
status: complete
---

# Phase 08 Plan 18: Record what an order cost Summary

**Add, edit and delete order expenses from the Expenses tab through the shared OrderWindow: Date with the 30 day rule, Category, optional Description, Amount and a required Paid by that starts on the signed-in person (a payer who left or a retired category stays selected on an edit), browser checks in the server's words, and Order Expenses and Estimated Profit that follow the server's answer after every save**

## Performance

- **Duration:** about 28 min (start 04:19, last code commit 04:37, then deferred items and this file)
- **Completed:** 2026-10-30T04:50:00-05:00
- **Tasks:** 2
- **Files modified:** 11 under `web/` (4 new source files, 1 changed source file, 4 new test files, 1 changed test file, 1 new e2e spec) plus `deferred-items.md`

## Accomplishments

- **Add Expense**: the Expenses tab head has a primary `plus` Add Expense on an active order. The window opens on the server's today with the hint "Up to 30 days ahead is fine for a cost you'll pay soon.", a "Choose a category" picker, a Description (placeholder "e.g. Dri-fit mesh, 45 yds"), Amount and Paid by on "{name} (you)". It sends one Idempotency-Key, `paidByUserId`, the category, the amount as a number, the trimmed description (or null) and the version it opened with, then closes, sets the order from the answer and toasts "Expense added" with "Order expenses now ₱X.". The panel shows the server's Order Expenses and Estimated Profit (e2e: ₱9,360.00 total, ₱3,825.00 spent, ₱5,535.00 profit).
- **Browser checks in the server's words (OR-3)**: "Enter the date." / "Enter a real date." / "Choose a date up to 30 days from today, Nov 7, 2026 at the latest."; "Choose a category."; "Keep the description to 200 characters or fewer."; "Enter an amount greater than ₱0.00." / "Enter an amount of ₱1,000,000.00 or less." / "Use at most 2 decimal places."; "Choose who paid.". Nothing is sent when a check fails; the first broken field takes focus.
- **Edit Expense**: opens with the saved values and RecordMeta. A saved payer who is no longer in the staff lookup stays selected as "{name} (inactive)" or "{name} (former staff)", and a retired category as "{name} (retired)". A 400 on `paidByUserId` shows under Paid by and takes focus. A 409 keeps the typed values behind the banner and Load Latest takes the latest values and version. A 404 shows "This expense was removed." and blocks Save.
- **Delete expense**: ConfirmDialog "Delete expense of ₱3,825.00?" with the shared message; DELETE with no key and no version; toast "Expense deleted" / "Order expenses now ₱X."; focus to the next row's Edit, else the previous, else the tab heading. A 404 shows "This expense was removed." in the dialog.
- **Row actions** are named "Edit expense of {₱X}, {date}" and "Delete expense of {₱X}, {date}" with matching titles. Completed, cancelled and `readOnly` views show no Add, Edit or Delete.

## Task Commits

1. **Task 1: Record a fabric cost paid by a coworker and see the profit change (tracer)** - `6e83bd42` (test, RED) then `a788a83d` (feat, GREEN)
2. **Task 2: Edit and delete order expenses** - `3f33fe3a` (test, RED) then `21e70dfe` (feat, GREEN)

**Plan metadata:** the docs commits that follow this file (docs: complete plan, then state and roadmap).

## Files Created/Modified

- `web/src/modules/admin/components/OrderExpenseModal.tsx` - add and edit window on the shared OrderWindow
- `web/src/modules/admin/components/OrderExpensesTab.tsx` - Add Expense, row Edit and Delete, delete dialog, focus rules; read-only view kept apart
- `web/src/modules/admin/orderExpenseSchemas.ts` - `orderExpenseSchema(today)`, `blankOrderExpense`
- `web/src/modules/admin/orderExpenseCopy.ts` - the window, row action, delete and error words
- `web/src/modules/admin/services/orderExpensesService.ts` - add, update, remove
- `web/e2e/order-expenses.spec.ts` - two `@orders-expenses` tests
- Tests: `OrderExpenseModal.test.tsx` (28), `OrderExpensesTab.test.tsx` (15), `orderExpenseSchemas.test.ts` (22), `orderExpensesService.test.ts` (4); `OrderTabs.test.tsx` changed (see deviations)

## Decisions Made

- The window and its tests follow the item, payment and discount windows (08-14, 08-16, 08-17), so the windows read alike.
- The form fields use the server's field names, so a 400 lands under its field with no map.
- Paid by uses `PaidBySelect`'s default label, name and hint (the plan says to); order-specific words are the owner's call (deferred item 2).
- Description is optional, as the server allows (the Company Expenses form requires it).
- No ghost Add button in the empty tab, as in 08-16 and 08-17 (deferred item 1).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing Expenses table tests rendered the editable tab without providers**
- **Found during:** Task 2 (the full vitest run after the GREEN code; six `OrderTabs.test.tsx` Expenses tests failed)
- **Issue:** the tab now needs the query client and toasts when its actions show, and those tests render an active order with no providers.
- **Fix:** they pass `readOnly` (the table content they check is unchanged), as 08-14, 08-16 and 08-17 did. The editable tab is covered by `OrderExpensesTab.test.tsx`.
- **Files modified:** `web/src/modules/admin/components/OrderTabs.test.tsx` (outside the plan's file list)
- **Verification:** whole web suite 251 files, 7205 tests passed.
- **Committed in:** `21e70dfe`

**2. [Rule 1 - Bug] Unused import in the edit tests (found by typecheck and lint)**
- **Found during:** Task 2 (`npm run typecheck`, `npm run lint`)
- **Fix:** removed the unused `LABOR_ID` import from `OrderExpenseModal.test.tsx`.
- **Committed in:** `21e70dfe`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** none. The second e2e test (edit and delete) is within the plan's `files_modified` (`order-expenses.spec.ts`) though the task text names only the add test.

## TDD Gate Compliance

Both tasks have a `test(08-18)` commit before their `feat(08-18)` commit (`6e83bd42` then `a788a83d`; `3f33fe3a` then `21e70dfe`). No refactor commit.

- **RED, round 1:** the service, schema and add-window tests failed on module-not-found (the files did not exist), the same as 08-16 and 08-17. That is a load failure, not an assertion failure, so by the strict reading of `tdd.md` it is not valid RED evidence; it is recorded here as it happened. The tab Add tests, written once the window existed, failed on the planned assertion (no "Add Expense" button) before the tab was changed; the three locked and read-only tab tests were green at once because the tab showed no action before. `gsd_run check tdd-red-evidence` was not run (no TAP record was produced).
- **RED, round 2:** 17 tests failed on the planned assertions (no Edit window, a payer and category not preselected, no row actions, no Delete dialog).
- **GREEN:** round 1, 41 then 47 tests passed first run; round 2, 43 passed first run. The tracer gate (auto mode) re-ran `@orders-expenses` after Task 1: 5 of 5 passed before expansion.
- No flake seen.

## Verification

- `npm run test -- --run` (whole web suite): 251 files, 7205 tests passed.
- `npm run typecheck`: clean. `npm run lint` (`eslint . --max-warnings 0`): clean. `prettier --check` on the changed files: clean.
- `npm --prefix web run e2e -- --grep @orders-expenses`: 10 passed (2 tests in chromium, firefox, webkit, pixel and iphone).
- Acceptance: `grep -c "Up to 30 days ahead" web/src/modules/admin/orderExpenseCopy.ts` is 1; `OrderExpenseModal.test.tsx` asserts `paidByUserId` in the POST and PUT bodies; `OrderExpensesTab.test.tsx` has the group "Delete expense of".
- gitleaks on every staged change: no leaks. No real names, emails or ids in the new files (fixture ids and fake names only).

## Known Stubs

None. Every control is wired to the service and the server's answer.

## Threat Flags

None. No new endpoint or trust boundary beyond the plan's register: T-08-34 (the payer is chosen from the active staff lookup and the server validates active staff; Recorded by comes from the token) and T-08-SC (no package added or bumped).

## Issues Encountered

Deferred items are listed under "From plan 08-18" in `deferred-items.md`: no ghost Add button in the empty tab, the Paid by hint is the Company Expenses one, no phone-card e2e of its own, and the look is not seen in a browser (owner screenshot review).

## Next Phase Readiness

Ready for 08-19 (the status controls). The Expenses tab is complete.

## Self-Check: PASSED

- Created files exist: the nine files under `web/` listed above (checked with `[ -f ]`).
- Commits `6e83bd42`, `a788a83d`, `3f33fe3a` and `21e70dfe` are on `gsd/phase-08-order-screens`.
