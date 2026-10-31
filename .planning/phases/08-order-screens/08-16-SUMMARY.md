---
phase: 08-order-screens
plan: 16
subsystem: ui
tags: [react, react-hook-form, zod, tanstack-query, msw, playwright, modal, idempotency]
created: 2026-10-30T03:50:00-05:00
updated: 2026-10-30T03:50:00-05:00

requires:
  - phase: 08-order-screens
    provides: OrderWindow, useOrderChildSave, orderSavedMessage, useOrderAction, focus-return pattern (08-14); PaidBySelect with label, name and hint props (08-03); ListEntrySelect picker (08-04); readOnly tabs and OrderTabHead action slot (08-12); canAddPayment (08-10)
provides:
  - "Add, edit and delete of order payments from the Payments tab, every save answering the whole order"
  - "OrderPaymentModal: Date, Amount, Method (empty start), Reference no., Received by (you first), Notes, with RecordMeta on edit"
  - "orderPaymentSchema(today, maxAmount), paymentCap and wouldLeavePaymentsBelowRefunds: the OR-3 mirror of the server's payment rules"
  - "orderPaymentsService (add with key and version, update with version, remove with neither)"
affects: [08-17, 08-18, 08-19, 08-24]

actuals:
  tokens: 27000
  tasks: 3
  commits: 6
plan_head_before: 49e031ba6c248940dc7cc2cd035ed163c409cef0
plan_head_after: 12acf8c5b73ea65d4188255239781e07587f9830

tech-stack:
  added: []
  patterns:
    - "A window decides its focus return from the saved answer (onSaved), because the page's own copy of the order updates a moment later"
    - "A browser-side refusal in a ConfirmDialog is a thrown sentinel from onConfirm, mapped to the server's sentence by describeFailure, so nothing is sent"
    - "The cap of an amount is a pure function of the server's figures (balance plus the saved amount on an edit), clamped at zero"

key-files:
  created:
    - web/src/modules/admin/components/OrderPaymentModal.tsx
    - web/src/modules/admin/components/OrderPaymentModal.test.tsx
    - web/src/modules/admin/components/OrderPaymentsTab.test.tsx
    - web/src/modules/admin/services/orderPaymentsService.ts
    - web/src/modules/admin/services/orderPaymentsService.test.ts
    - web/src/modules/admin/orderPaymentSchemas.ts
    - web/src/modules/admin/orderPaymentSchemas.test.ts
    - web/src/modules/admin/orderPaymentCopy.ts
    - web/e2e/order-payments.spec.ts
  modified:
    - web/src/modules/admin/components/OrderPaymentsTab.tsx
    - web/src/modules/admin/components/OrderTabs.test.tsx

key-decisions:
  - "Received by is chosen with PaidBySelect (label Received by, name receivedByUserId) and starts on the signed-in person; Method starts empty (D-29)"
  - "Browser cap on Amount = server balance on an add, balance plus the saved amount on an edit, never below zero; the server still decides"
  - "The payments-below-refunds check runs when Delete Payment is pressed and shows the server's sentence in the dialog without a request"
  - "Edit and Delete stay on a fully paid order; only Add Payment is hidden (D-48)"
  - "A save that settles the order sends focus to the tab heading, because Add Payment leaves the page"

patterns-established:
  - "Payment tab split into a read-only view and an editable view, as the Items tab was, so hooks that need providers run only when the controls exist"

requirements-completed: [ORD-07]

coverage:
  - id: D1
    description: "Staff record a payment from the Payments tab: Date (server today), Amount, Method (empty), Reference no., Received by (you first, any active coworker), Notes; one Idempotency-Key and the opened version are sent and the page shows the server's new totals"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentModal.test.tsx#posts once with an Idempotency-Key, the chosen receiver and the opened version, then closes and tells the parent"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentsTab.test.tsx#adds a payment, shows the server's new rows and total paid, and puts focus back on Add Payment"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-payments.spec.ts#@orders-payments a Manager records a payment received by a coworker and sees both names and the new balance"
        status: pass
    human_judgment: false
  - id: D2
    description: "The browser refuses an amount above the balance, a missing method and a future date with the server's words, accepts a date before the order date, and sends nothing"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/orderPaymentSchemas.test.ts (22 tests: date, amount, method, receiver, reference, notes)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentModal.test.tsx#add mode checks before any request (OR-3) (5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Edit opens with the saved values and RecordMeta; the Balance due helper and the cap are the balance plus the saved amount; Load Latest takes the latest values, version and cap"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentModal.test.tsx#shows the server balance plus the saved amount under Amount, and the cap follows it"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentModal.test.tsx#keeps the typed values behind the banner, and Load Latest takes the latest values, version and cap"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-payments.spec.ts#@orders-payments a Manager edits and deletes payments, and Add Payment goes and returns with the balance"
        status: pass
    human_judgment: false
  - id: D4
    description: "A receiver who was deactivated or deleted and a retired method stay selected as (inactive), (former staff) and (retired); a server 400 on Received by or Method shows under that field"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentModal.test.tsx#keeps a receiver who was deactivated selected as \"{name} (inactive)\""
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentModal.test.tsx#keeps a deleted receiver selected as \"{name} (former staff)\""
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentModal.test.tsx#edit mode server refusals (UIC-29) (2 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Delete Payment asks per payment, sends DELETE with no key or version, shows the server's sentence without a request when payments would fall below refunds, and moves focus to the next row's Edit, else the previous, else the heading"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentsTab.test.tsx#Delete Payment (8 tests)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-payments.spec.ts#@orders-payments a Manager edits and deletes payments, and Add Payment goes and returns with the balance"
        status: pass
    human_judgment: false
  - id: D6
    description: "When nothing is owed Add Payment is hidden and the caption reads Nothing is owed on this order.; completed, cancelled and read-only views show no payment action"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentsTab.test.tsx#Nothing is owed (D-48, UIC-50) (2 tests) and locked and deleted views (D-15, D-24) (3 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Row actions are named by amount and date, keep 36 px drawn size with a 44 px tap area on a phone, show both people in the card, and the Add Payment window fits a phone"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentsTab.test.tsx#names each row action by its amount and date, with a matching title"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-payments.spec.ts#@orders-payments on a phone the payment card shows both people, the row actions answer a 44 px tap area, and the window fits"
        status: pass
    human_judgment: false
  - id: D8
    description: "The look of the Add Payment and Edit Payment windows, the row action icons and the phone card in Blush and Espresso"
    verification: []
    human_judgment: true
    rationale: "Colour, spacing and layout feel are the owner's screenshot review; tests prove behavior, boxes and axe, not taste"

duration: 45min
completed: 2026-10-30
status: complete
---

# Phase 08 Plan 16: Record payments with Received by Summary

**Add, edit and delete order payments from the Payments tab through the shared OrderWindow: a required Received by that starts on the signed-in person and can be any active coworker, an empty Method, a Balance due helper and cap from the server's balance (plus the saved amount on an edit), a below-refunds check before any delete request, and Add Payment hidden when nothing is owed**

## Performance

- **Duration:** about 45 min
- **Started:** 2026-10-30T03:01:44-05:00
- **Completed:** 2026-10-30T03:50:00-05:00
- **Tasks:** 3
- **Files modified:** 11 under `web/` (5 new source files, 2 changed source files, 3 new test files, 1 changed test file) plus `deferred-items.md`

## Accomplishments

- **Add Payment**: the Payments tab head has a primary `plus` Add Payment while money is owed. The window has Date (the server's today), Amount, Method ("Choose a method", nothing chosen), Reference no., Received by (the signed-in person as "{name} (you)") and Notes. It sends one Idempotency-Key and the version it opened with, closes, sets the order from the answer and toasts "Payment added" with "Balance now ₱X.".
- **Browser checks in the server's words (OR-3)**: "Enter the payment date." / "Enter a real date." / "The payment date can't be in the future."; "Enter the amount." / "Enter an amount from ₱0.01 to ₱1,000,000.00." / "Use at most 2 decimal places." / "This is more than the balance. Enter ₱9,327.50 or less." / "Nothing is owed on this order."; "Choose a payment method."; the 100 and 500 character limits; "Choose who received the money.". A payment may be dated before the order date.
- **Edit Payment**: opens with the saved values and RecordMeta. The helper and cap are the server balance plus the payment's saved amount. A deactivated receiver stays selected as "{name} (inactive)", a deleted one as "{name} (former staff)", a retired method as "{name} (retired)". A server 400 on Received by or Method shows under that field and takes focus. Load Latest replaces values, version and cap.
- **Delete Payment**: ConfirmDialog "Delete payment of ₱2,000.00?" with the shared message; DELETE with no key and no version; toast "Payment deleted" with the balance; focus to the next row's Edit, else the previous, else the tab heading. When the payments left would be below the refunds, the dialog shows "The refunds would be more than the payments. Lower or remove a refund first." and sends nothing.
- **Nothing owed (D-48)**: Add Payment is hidden and the caption reads "Nothing is owed on this order."; a save that settles the order moves focus to the tab heading. Completed, cancelled and `readOnly` views show no Add, Edit or Delete.
- **Row actions** are named "Edit payment of {₱X}, {date}" and "Delete payment of {₱X}, {date}" with matching titles; on a phone both people and the actions show in the card (36 px drawn, 44 px tap area).

## Task Commits

1. **Task 1: Record a downpayment received by a coworker (tracer)** - `e4779521` (test, RED) then `039287b3` (feat, GREEN)
2. **Task 2: Edit payments, people who left, and server refusals** - `c1666953` (test, RED) then `5881d6b2` (feat, GREEN)
3. **Task 3: Delete payments, nothing owed, and row names** - `c7e64e37` (test, RED) then `12acf8c5` (feat, GREEN)

**Plan metadata:** the docs commits that follow this file (docs: complete plan, then state and roadmap).

## Files Created/Modified

- `web/src/modules/admin/components/OrderPaymentModal.tsx` - add and edit window on the shared OrderWindow
- `web/src/modules/admin/components/OrderPaymentsTab.tsx` - Add Payment, row Edit and Delete, delete dialog, nothing-owed rule, focus rules; read-only view kept apart
- `web/src/modules/admin/orderPaymentSchemas.ts` - `orderPaymentSchema(today, maxAmount)`, `blankOrderPayment`, `paymentCap`, `wouldLeavePaymentsBelowRefunds`
- `web/src/modules/admin/orderPaymentCopy.ts` - the window, row action, delete and error words
- `web/src/modules/admin/services/orderPaymentsService.ts` - add, update, remove
- `web/e2e/order-payments.spec.ts` - three `@orders-payments` tests
- Tests: `OrderPaymentModal.test.tsx` (29), `OrderPaymentsTab.test.tsx` (19), `orderPaymentSchemas.test.ts` (22), `orderPaymentsService.test.ts` (4); `OrderTabs.test.tsx` changed (see deviations)

## Decisions Made

- The window and its tests follow the item window's shape (08-14), so the payment, discount, expense and refund windows read alike.
- The cap and the below-refunds check are pure functions of the server's figures, kept next to the schema; the server still decides (T-08-31).
- The below-refunds check runs when the red button is pressed, not when the dialog opens (UI-SPEC "checked in the browser first and shows the same server sentence without a request").
- Focus after a save that settles the order is decided from the saved answer, because the page's query data updates a moment after the window closes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing Payments table tests rendered the editable tab without providers**
- **Found during:** Task 3 (full suite run: 10 failures in `OrderTabs.test.tsx`)
- **Issue:** the tab now needs the query client and toasts when its actions show, and those tests render an active order with no providers.
- **Fix:** the tests pass `readOnly` (the table content they check is unchanged), as 08-14 did for the Items tab. The editable tab is covered by `OrderPaymentsTab.test.tsx`.
- **Files modified:** `web/src/modules/admin/components/OrderTabs.test.tsx` (outside the plan's file list)
- **Verification:** whole web suite 243 files, 7045 tests passed.
- **Committed in:** `12acf8c5`

**2. [Rule 1 - Bug] Focus was lost when a save settled the order**
- **Found during:** Task 3 (unit test "takes Add Payment away when a save settles the order")
- **Issue:** the window closed and focus went to Add Payment, which then left the page, so focus fell to the body.
- **Fix:** the Add window's `onSaved` records whether the answer leaves nothing owed, and the focus return then goes to the tab heading.
- **Files modified:** `web/src/modules/admin/components/OrderPaymentsTab.tsx`
- **Verification:** unit test and the `@orders-payments` e2e (heading focused) in all five projects.
- **Committed in:** `12acf8c5`

**3. [Rule 1 - Bug] Two of my edit-mode tests were wrong**
- **Found during:** Task 2 GREEN run
- **Issue:** the amount box pads to two decimals on blur (it reads "2500.00" after Save is pressed), and the Load Latest test used figures that made the old and new caps equal, so it could not tell them apart.
- **Fix:** the test expects "2500.00" and uses a latest balance of 8,000.00 (cap 11,000.00).
- **Files modified:** `web/src/modules/admin/components/OrderPaymentModal.test.tsx`
- **Committed in:** `5881d6b2`

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking)
**Impact on plan:** none on scope. No package added. The plan's `files_modified` list gained only `OrderTabs.test.tsx`. The plan names the server field `methodId`; the API's name is `paymentMethodId`, which the window maps (deferred item 3).

## Issues Encountered

- The first `@orders-payments` run passed in all five projects. The second run (three tests) also passed first time; no flake seen.
- Two shell commands that used a heredoc with quotes failed to parse before running anything; the long test and e2e chunks were written with the Write tool and joined with `cat` of files. No stdin was read and no shell is left running.
- Owner review items are in `deferred-items.md` under "From plan 08-16" (no ghost Add button in the empty tab, the Received by hint words, the below-refunds check on the red button, Edit staying on a fully paid order, focus after a settling save, no `max` on Date, same-named rows, the look in a browser).

## Verification

- `npx vitest run` (whole web suite): 243 files, 7045 tests passed.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0, no output.
- `npm run typecheck`: clean. `npx prettier --check src e2e`: clean.
- `npm run e2e -- --grep "@orders-page|@orders-items|@orders-payments"`: 40 passed in 5 projects (the new payments tests, 15 of them, plus the existing page and items tests as a regression check).
- gitleaks pre-commit hook: "no leaks found" on all six task commits.
- Acceptance greps: `GCash` count in `orderPaymentSchemas.ts` and `OrderPaymentModal.tsx` is 0 and 0; `This is more than the balance` in `orderPaymentCopy.ts` is 1; the modal test has tests named with "(inactive)" and "former staff"; the tab test has tests named with "Nothing is owed".

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-17 and 08-18 (discounts, expenses, refunds) can copy the window and tab pattern: `OrderWindow`, `useOrderChildSave`, `useOrderAction`, the focus-return refs, the `onSaved`-based focus decision and the below-refunds style browser preview. Their strings join their own copy files.
- `OrderBody` still passes no `readOnly` to the Payments tab; the deleted view (08-20/08-21) passes it when it builds its own body.
- Task 1 is a tracer: it was re-run end to end (`@orders-payments` in five projects) before the expansion tasks and stayed green.

## Known Stubs

None. Nothing in the new files renders hardcoded empty or placeholder data.

## Threat Flags

None. No new endpoint, auth path or schema; payment writes use the existing routes. Threat register: T-08-31 (the browser cap from the server balance, version and key on every add; the server's locked check stays) and T-08-32 (the receiver comes from the active staff lookup, Recorded by is shown from the server and never sent) hold; T-08-SC (no package added or bumped).

## TDD Gate Compliance

Task-level TDD (the plan is `type: execute`): RED commits `e4779521`, `c1666953`, `c7e64e37` precede GREEN commits `039287b3`, `5881d6b2`, `12acf8c5`. No REFACTOR commit (none needed). RED evidence: Task 1 was three module-not-found load failures plus one assertion failure (no Add Payment button); Task 2 was assertion failures on the planned behavior (the window opened in add mode: no "Edit Payment" dialog, no saved values, no cap); Task 3 was assertion failures (the row action buttons were not found). Semantic assessment: each RED run failed on the named target tests for the planned reason, not on setup faults.

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*

## Self-Check: PASSED

All 11 listed source and test files exist on disk and all six task commits are ancestors of HEAD.
