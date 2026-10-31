---
phase: 08-order-screens
plan: 21
subsystem: ui
tags: [orders, refunds, record-refund, react, react-hook-form, zod, tanstack-query, msw, playwright, testing-seed]
created: "2026-10-30T06:55:00-05:00"
updated: "2026-10-30T06:55:00-05:00"

requires:
  - phase: 08-order-screens
    provides: "08-14 OrderWindow, useOrderChildSave, useOrderAction, focus-return pattern; 08-16 payment window and tab as the sibling pattern; 08-19 locked orders and the cancelled banner; 08-02 OrderTotals onRecordRefund; 08-03 PaidBySelect label and name props; 08-10 refundCap and showRefundsTab"
provides:
  - "Add, edit and delete of order refunds from the Refunds tab, on a Cancelled order without reopening it and on an order with a customer credit, every save answering the whole order"
  - "OrderRefundModal: Date, Amount, Reason, Refunded by (you first), with RecordMeta on edit and the cap helper 'You can refund up to {₱X}.'"
  - "Record Refund in the credit block opens the same window with the credit filled in (D-19); hidden on a Completed order"
  - "orderRefundSchema(today, cap, capKind), refundCapKind and blankOrderRefund: the OR-3 mirror of the server's refund rules in the server's words"
  - "orderRefundsService (add with key and version, update with version, remove with neither), canAddRefund and canChangeRefund"
  - "POST /api/testing/orders accepts refunds (Debug Testing builds only), and OrderSeedInput.refunds for e2e specs"
affects: [08-22, 08-23, 08-24]

actuals:
  tokens: 27000
  tasks: 3
  commits: 6
plan_head_before: 8970d1f2f74395b9ab8106c2b29de359144e816f
plan_head_after: f5eaef133400603771dd74b52d84ac2b9fed145a

tech-stack:
  added: []
  patterns:
    - "A page-level window (Record Refund) decides its focus return from whether the refund was saved: saved goes to the Totals heading because the button leaves the page, dismissed goes back to the button by id"
    - "The cap of a refund is a pure function of the server's figures (credit on an open order, paid minus refunded on a Cancelled one, plus the saved amount on an edit), clamped at zero"
    - "Row Edit and Delete follow the order status (not Completed), while Add and the cap sentence follow the cap (above 0.00)"

key-files:
  created:
    - web/src/modules/admin/components/OrderRefundModal.tsx
    - web/src/modules/admin/components/OrderRefundModal.test.tsx
    - web/src/modules/admin/components/OrderRefundsTab.test.tsx
    - web/src/modules/admin/services/orderRefundsService.ts
    - web/src/modules/admin/services/orderRefundsService.test.ts
    - web/src/modules/admin/orderRefundSchemas.ts
    - web/src/modules/admin/orderRefundSchemas.test.ts
    - web/src/modules/admin/orderRefundCopy.ts
    - web/e2e/order-refunds.spec.ts
  modified:
    - web/src/modules/admin/components/OrderRefundsTab.tsx
    - web/src/modules/admin/pages/OrderPage.tsx
    - web/src/modules/admin/pages/OrderPage.test.tsx
    - web/src/modules/admin/orderRules.ts
    - web/src/modules/admin/orderRules.test.ts
    - web/src/modules/admin/orderStatus.ts
    - web/src/components/money/OrderTotals.tsx
    - web/src/components/money/money.test.tsx
    - web/src/modules/admin/components/OrderTabs.test.tsx
    - web/e2e/testing-api.ts
    - src/Csps.Server/Controllers/TestingOrdersController.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingOrdersTests.cs

key-decisions:
  - "Refunded by is chosen with PaidBySelect (label Refunded by, name refundedByUserId) and starts on the signed-in person (D-10, D-11)"
  - "Add Refund and the cap sentence show only while the order is not Completed and the cap is above 0.00; Edit and Delete stay on a Cancelled or open order even at cap 0.00 (UIC-48)"
  - "The browser cap is the server figure (credit, or paid minus refunded) plus the saved amount on an edit; the server still decides"
  - "A saved Record Refund sends focus to the Totals heading, a dismissed one back to the Record Refund button (new id order-record-refund)"
  - "The testing seed gets its own small refund record inside the existing #if guard; the Domain and the OpenAPI snapshot are untouched"

patterns-established:
  - "OrderTotals takes an optional recordRefundId so a screen can return focus to the credit block button"

requirements-completed: [ORD-07, ORD-12]

coverage:
  - id: D1
    description: "Staff clear a customer credit in two clicks: Record Refund opens Add Refund with the credit filled in, the server's today and the signed-in person as Refunded by; one Idempotency-Key and the opened version are sent and the panel shows the server's Refunded row and Fully Paid"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#Record Refund from the credit block (4 tests)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderRefundModal.test.tsx#add mode saving (ORD-18 idempotency) (5 tests)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-refunds.spec.ts#@orders-refunds a Manager clears a customer credit with Record Refund and sees who refunded and who recorded it"
        status: pass
    human_judgment: false
  - id: D2
    description: "The browser refuses an amount above the cap, an empty reason and a future date with the server's words, and sends nothing"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/orderRefundSchemas.test.ts (20 tests: date, amount with both cap kinds, reason, refunder)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderRefundModal.test.tsx#add mode checks before any request (OR-3) (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Refunds work on a Cancelled order without reopening it: Add Refund and the cap sentence follow the cap, Edit adds the saved amount to the cap and shows RecordMeta, deactivated and former refunders stay selected, Load Latest takes the latest values, version and cap"
    requirement: ORD-12
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderRefundModal.test.tsx#edit mode opening, saving, server refusals and stale save (10 tests)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderRefundsTab.test.tsx#Add Refund (6 tests)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-refunds.spec.ts#@orders-refunds a Manager works the refunds of a cancelled order without reopening it, up to what was paid"
        status: pass
    human_judgment: false
  - id: D4
    description: "Delete Refund asks per refund, sends DELETE with no key or version, moves focus to the next row's Edit else the heading; rows are named by amount and date; a Completed order and the read-only deleted view show no refund action"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderRefundsTab.test.tsx#row actions (D-54a, 07 D-35) (5 tests) and Delete Refund (3 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "When the cap is 0.00 Add Refund is hidden and the caption omits the cap sentence; Record Refund is hidden on a Completed order"
    requirement: ORD-12
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderRefundsTab.test.tsx#hides Add Refund and leaves the cap out of the caption when everything paid is handed back (UIC-48)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/orderRules.test.ts#canAddRefund (4 tests) and canChangeRefund"
        status: pass
    human_judgment: false
  - id: D6
    description: "The testing seed takes refunds (Debug Testing builds only): a Cancelled order with a payment and a refund answers 201 and reads refunded 500.00; a bad date, a null member or an unknown refunder answers 400 on the right field; the shipped API contract is unchanged"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Testing/TestingOrdersTests.cs (17 tests) with AuthorizationMatrixTests: 361 passed"
        status: pass
    human_judgment: false
  - id: D7
    description: "The look of the Record Refund button, the Add and Edit Refund windows, the Refunds tab head and the phone row cards in Blush and Espresso"
    verification: []
    human_judgment: true
    rationale: "Colour, spacing and layout feel are the owner's screenshot review; tests prove behavior, boxes and axe, not taste"

duration: 44min
completed: 2026-10-30
status: complete
---

# Phase 08 Plan 21: Hand money back with refunds Summary

**Add, edit and delete order refunds from the Refunds tab through the shared OrderWindow (Refunded by starts on the signed-in person, cap from the server's credit or paid-minus-refunded figures, plus the saved amount on an edit), a Record Refund button in the credit block that opens the window with the credit filled in, Add Refund hidden when the cap is 0.00, and refunds on the Debug-only testing order seed**

## Performance

- **Duration:** about 44 min
- **Started:** 2026-10-30T06:09:13-05:00
- **Completed:** 2026-10-30T06:53:00-05:00
- **Tasks:** 3
- **Files modified:** 21 (9 new, 12 changed) in `web/`, `src/` and `tests/`, plus `deferred-items.md`

## Accomplishments

- **Record Refund (tracer)**: the CUSTOMER CREDIT block's button opens "Add Refund" with Amount filled in with the credit, Date the server's today, and "Refunded by" on "{name} (you)". The helper reads "You can refund up to ₱X.". Saving sends one Idempotency-Key and the opened version, the panel shows the server's Refunded row and Fully Paid, and the toast follows D-05 ("Refund added", "Order is now fully paid."). Hidden on a Completed order.
- **Browser checks in the server's words (OR-3)**: "Enter the refund date." / "Enter a real date." / "The refund date can't be in the future."; the amount messages including "This is more than the customer credit. Enter ₱X or less." and "This is more than was paid and not yet refunded. Enter ₱X or less." (and "Everything that was paid has already been refunded." at a Cancelled cap of 0.00); "Add a short reason for the refund." / the 200 character limit; "Choose who handed the money back.".
- **Cancelled orders**: the Refunds tab shows Add Refund and the cap sentence while paid minus refunded is above 0.00; Edit adds the refund's saved amount to the cap and shows RecordMeta; a deactivated refunder stays selected as "(inactive)" and a deleted one as "(former staff)"; Load Latest takes the latest values, version and cap; a 404 shows "This refund was removed." and blocks Save.
- **Row actions** are named "Edit refund of {₱X}, {date}" and "Delete refund of {₱X}, {date}". Delete asks "Delete refund of ₱500.00?", sends DELETE with no key or version, and moves focus to the next row's Edit, else the previous, else the tab heading. A Completed order and the read-only deleted view show no Add, Edit or Delete.
- **Testing seed (D-62)**: `POST /api/testing/orders` takes `refunds` (date, amount, reason, refunded by), with a null-member check and a per-index date check; `OrderSeedInput.refunds` for specs. The controller stays inside `#if CSPS_TESTING`.

## Task Commits

1. **Task 1: Clear a customer credit with "Record Refund" (tracer)** - `bcc66ca7` (test, RED) then `85eebcdb` (feat, GREEN)
2. **Task 2: Refunds on cancelled orders, edits, deletes and the cap** - `f7689ec3` (test, RED) then `9a3186d6` (feat, GREEN)
3. **Task 3: The testing seed takes refunds (D-62)** - `3d8e8122` (test, RED) then `f5eaef13` (feat, GREEN)

**Plan metadata:** the docs commits that follow this file (docs: complete plan, then state and roadmap).

## Files Created/Modified

- `web/src/modules/admin/components/OrderRefundModal.tsx` - add and edit window on the shared OrderWindow
- `web/src/modules/admin/components/OrderRefundsTab.tsx` - Add Refund, row Edit and Delete, delete dialog, cap-based visibility, focus rules; the read-only view kept apart
- `web/src/modules/admin/orderRefundSchemas.ts` - `orderRefundSchema(today, cap, capKind)`, `refundCapKind`, `blankOrderRefund`
- `web/src/modules/admin/orderRefundCopy.ts` - the window, row action, delete and error words
- `web/src/modules/admin/services/orderRefundsService.ts` - add, update, remove
- `web/src/modules/admin/orderRules.ts` - `canAddRefund`, `canChangeRefund`
- `web/src/modules/admin/pages/OrderPage.tsx` - Record Refund window state, prefill and focus return
- `web/src/components/money/OrderTotals.tsx` - optional `recordRefundId`
- `src/Csps.Server/Controllers/TestingOrdersController.cs` - `Refunds`, `TestingOrderRefundRequest`, `ToRefund`
- `web/e2e/order-refunds.spec.ts` - two `@orders-refunds` tests; `web/e2e/testing-api.ts` - `OrderSeedRefund`
- Tests: `OrderRefundModal.test.tsx` (23), `OrderRefundsTab.test.tsx` (14), `orderRefundSchemas.test.ts` (20), `orderRefundsService.test.ts` (4), four new `OrderPage.test.tsx` tests, `orderRules.test.ts` (+5), `money.test.tsx` (+1), `TestingOrdersTests.cs` (+4 cases)

## Decisions Made

- The window and its tests follow the payment window's shape (08-16), so the payment, discount, expense and refund windows read alike.
- Add Refund follows the cap and Edit/Delete follow the status: a Cancelled order that has handed everything back keeps its row actions.
- The cap and its messages are pure functions of the server's figures, kept next to the schema; the server still decides (T-08-40).
- The page-level window returns focus by element id and by whether the refund was saved, because the Record Refund button leaves the page when the credit is cleared.
- The testing seed record stays in the controller file and the Domain gets no new constant (T-08-41).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Existing Refunds table tests rendered the editable tab without providers**
- **Found during:** Task 2 (full admin run: 4 failures in `OrderTabs.test.tsx`)
- **Issue:** the tab now needs the query client and toasts when its actions show, and those tests render a Cancelled order with no providers. One more test read the caption as an exact string, which now holds the cap sentence.
- **Fix:** the tests pass `readOnly` (the table content they check is unchanged), as 08-14 and 08-16 did. The editable tab is covered by `OrderRefundsTab.test.tsx`.
- **Files modified:** `web/src/modules/admin/components/OrderTabs.test.tsx` (outside the plan's file list)
- **Verification:** whole web suite 261 files, 7407 tests passed.
- **Committed in:** `85eebcdb`, `9a3186d6`

**2. [Rule 3 - Blocking] OrderPage test helper had no ToastProvider**
- **Found during:** Task 1 GREEN (the "Refund added" toast was not on screen)
- **Issue:** the page tests render without a toast host, so a toast could not be read.
- **Fix:** `renderOrder` wraps the page in `ToastProvider`; all 73 page tests still pass.
- **Files modified:** `web/src/modules/admin/pages/OrderPage.test.tsx`
- **Committed in:** `85eebcdb`

**3. [Rule 3 - Blocking] The page needed an id and a rule that the plan's file list did not name**
- **Found during:** Task 1 (focus return to Record Refund) and Task 2 (cap-based visibility)
- **Issue:** `OrderTotals` had no way to name its Record Refund button, and the tab and the page both need one answer for "may a refund be added".
- **Fix:** optional `recordRefundId` prop on `OrderTotals` (with a test), `RECORD_REFUND_ID` in `orderStatus.ts`, and `canAddRefund` and `canChangeRefund` in `orderRules.ts` (with tests).
- **Files modified:** `web/src/components/money/OrderTotals.tsx`, `money.test.tsx`, `web/src/modules/admin/orderStatus.ts`, `orderRules.ts`, `orderRules.test.ts`
- **Committed in:** `85eebcdb`

**4. [Rule 1 - Bug] `exactOptionalPropertyTypes` rejected the new `id` prop**
- **Found during:** Task 1 (typecheck)
- **Issue:** passing `id={undefined}` to `Button` is not allowed.
- **Fix:** the id is spread only when given.
- **Files modified:** `web/src/components/money/OrderTotals.tsx`
- **Committed in:** `85eebcdb`

---

**Total deviations:** 4 auto-fixed (3 blocking, 1 bug)
**Impact on plan:** none on scope. No package added or bumped. The plan's file list gained `OrderTabs.test.tsx`, `OrderTotals.tsx`, `money.test.tsx`, `orderRules.ts`, `orderRules.test.ts` and `orderStatus.ts`. The plan's modal artifact line says `refund?`; the window takes `refundId`, like the payment window (deferred item 7).

## Issues Encountered

- One of my shell commands began with a bare `cat >` and so read stdin. It hung; I found its two processes (`cat` and its parent shell, both started by me) with `ps`, killed exactly those, and removed the stray empty file. Nothing else was affected and no shell is left running.
- Two heredoc commands with apostrophes failed to parse before running anything; the long test and e2e chunks were written with the Write tool and joined with `cat` of a file.
- A combined e2e run of 50 tests (4 workers) had two 5 second expect timeouts under load; both passed in all five projects when re-run alone (deferred item 12).
- The first `@orders-refunds` run (5 projects) and the second (10 tests) passed first time.
- Owner review items are in `deferred-items.md` under "From plan 08-21".

## Verification

- `npx vitest run` (whole web suite): 261 files, 7407 tests passed.
- `npm run lint` (`eslint . --max-warnings 0`): exit 0, no output. `npm run typecheck`: exit 0. `npx prettier --check src e2e`: clean.
- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*TestingOrdersTests" --filter-class "*AuthorizationMatrixTests"` (CSPS_TEST_SQL=localdb): total 361, succeeded 361, failed 0.
- `dotnet build Csps.slnx`: Build succeeded, 0 warnings, 0 errors. `dotnet build src/Csps.Server -c Release`: Build succeeded, 0 warnings, 0 errors. `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- `git diff --stat -- tools/openapi-gen/openapi.v1.json web/src/types/api.generated.ts`: no change.
- `npm run e2e -- --grep @orders-refunds`: 10 passed (2 tests in 5 projects), also after the final code.
- `npm run e2e -- --grep "@orders-page|@orders-payments|@orders-status|@orders-refunds"`: 48 passed, 2 failed on 5 second timeouts under load; both passed when re-run alone (10 of 10).
- gitleaks pre-commit hook: "no leaks found" on all six task commits.
- Acceptance greps: `onRecordRefund` in `OrderPage.tsx` is 1; `This is more than the customer credit` in `orderRefundCopy.ts` is 1; `ToRefund` in the controller is 2 and the file still ends with `#endif`; `OrderRefundsTab.test.tsx` has the test "shows the row actions on a cancelled order, named by amount and date, with a matching title".

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-22 and 08-23 (the deleted view) pass `readOnly` to `OrderRefundsTab` and build their own body, so no Record Refund shows there.
- Task 1 is a tracer: it was re-run end to end (`@orders-refunds` in five projects, after the Task 3 code too) before the plan closed and stayed green.

## Known Stubs

None. Nothing in the new files renders hardcoded empty or placeholder data.

## Threat Flags

None. No new endpoint, auth path or schema in shipped code; refund writes use the existing routes, and the testing route is unchanged in reach (Debug Testing builds only; its authorization matrix row stays 400 and the 361-test run passed). Threat register: T-08-40 (the browser cap from the server's figures, version and key on every add; the server's locked cap check stays) and T-08-41 (the controller is still inside `#if CSPS_TESTING`, and a Release build succeeds) hold; T-08-SC (no package added or bumped).

## TDD Gate Compliance

Task-level TDD (the plan is `type: execute`): RED commits `bcc66ca7`, `f7689ec3`, `3d8e8122` precede GREEN commits `85eebcdb`, `9a3186d6`, `f5eaef13`. No REFACTOR commit (none needed). RED evidence: Task 1 was three module-not-found load failures plus three assertion failures (no Record Refund button); Task 2 was 14 assertion failures (no Edit Refund dialog, no row actions); Task 3 was 4 of 17 failures (a refund was ignored: 201 where 400 was expected, and no refund in the read). Semantic assessment: each RED run failed on the named target tests for the planned reason, not on setup faults.

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*

## Self-Check: PASSED

All 21 listed source and test files exist on disk and all six task commits are ancestors of HEAD.
