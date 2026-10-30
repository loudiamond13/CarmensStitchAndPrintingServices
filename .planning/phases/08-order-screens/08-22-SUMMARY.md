---
phase: 08-order-screens
plan: 22
subsystem: ui
tags: [orders, soft-delete, confirm-dialog, react, tanstack-query, msw, playwright]
created: "2026-10-30T07:25:00-05:00"
updated: "2026-10-30T07:25:00-05:00"
status: complete

requires:
  - phase: 08-order-screens
    provides: "08-19 OrderHeader with the status menu and locked rules; 08-14 useOrderAction; 08-10 useRefreshOrders and backTarget (D-51); 08-20 the shared Deleted Orders list a deleted order lands in; 08-02 ConfirmDialog props"
provides:
  - "Delete Order button in the order header (ghost-danger with a --line-strong border), shown on active orders only (D-22, D-39)"
  - "DeleteOrderDialog: 'Delete {number}?' with the child counts in words, Cancel focused first, no typing and no counts box; DELETE sends no key and no version"
  - "softDeleteSentence(counts): zero counts left out, refunds included when above zero, en-PH thousands, 'and' before the last, 'is' for one single thing"
  - "A finished delete returns to the list address the person came from (else /admin/orders) with the toast 'Order {number} deleted'; a 404 says 'Already deleted' and returns the same way"
affects: [08-23, 08-24]

actuals:
  tokens: 8200
  tasks: 2
  commits: 2
plan_head_before: cab3153188187808c352b1bb84b14dcd4ce7d468
plan_head_after: 876eb908700a6869ca0ef09834fd2c940d8aeefb

tech-stack:
  added: []
  patterns:
    - "A confirm that leaves the page (delete) navigates to backTarget(location.state) itself, so the page file needs no change"
    - "A header button that opens a dialog keeps a focus wish in a ref and carries it out in an effect after the dialog has closed (WebKit does not focus a button on click)"

key-files:
  created:
    - web/src/modules/admin/components/DeleteOrderDialog.test.tsx
    - web/src/modules/admin/components/OrderHeader.test.tsx
    - web/e2e/order-delete.spec.ts
  modified:
    - web/src/modules/admin/components/DeleteOrderDialog.tsx
    - web/src/modules/admin/components/OrderHeader.tsx
    - web/src/modules/admin/components/orderPage.recipe.ts
    - web/src/modules/admin/orderPageCopy.ts

key-decisions:
  - "The dialog reads the way back itself with useLocation and backTarget, so OrderPage.tsx (owned by another plan in the wave) is untouched"
  - "The sentence takes 'is' only when the order has a single kind of child and its count is 1; two kinds each at 1 read 'are'"
  - "A 404 on the delete leaves the dialog, goes back to the list and shows an info toast; any other failure keeps the dialog open with the shared error line"

requirements-completed: [ORD-06]

coverage:
  - id: D1
    description: "Active orders show a Delete Order button in the header; Completed and Cancelled orders do not until reopened"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderHeader.test.tsx#hides Delete Order on a Completed order until it is reopened"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderHeader.test.tsx#hides Delete Order on a Cancelled order until it is reopened"
        status: pass
    human_judgment: false
  - id: D2
    description: "The confirm names the order and the hidden counts in words with Cancel focused first; DELETE sends no key and no version; success goes back to the list the person came from and toasts"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/DeleteOrderDialog.test.tsx#sends DELETE with no key and no version, goes to the list the person came from, toasts and reads the lists again"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-delete.spec.ts#@orders-delete a Manager reads what a delete hides, keeps the order with Cancel, then deletes it and lands back on the list"
        status: pass
    human_judgment: false
  - id: D3
    description: "The sentence is exact for zero, one, many, refund and 1,234 counts; an order someone else already deleted says Already deleted and returns to the list"
    requirement: ORD-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/DeleteOrderDialog.test.tsx#writes 1,234 items with the en-PH thousands separator"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/DeleteOrderDialog.test.tsx#says Already deleted, closes and returns to the list when someone else deleted it first (404)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-delete.spec.ts#@orders-delete an order someone else already deleted says Already deleted and returns to the list"
        status: pass
    human_judgment: false
  - id: D4
    description: "How the ghost-danger Delete Order button and the dialog look in Blush and Espresso at 390, 820 and 1440 px"
    requirement: ORD-06
    verification: []
    human_judgment: true
    rationale: "No screenshot review was done; the owner's visual review of the O1 header and the Delete dialog covers it (UI-SPEC review list)."
---

# Phase 8 Plan 22: Delete an order safely Summary

**Soft delete from the order page: a header Delete Order button on active orders, a confirm that says what is hidden in words ("Its 2 items, 1 payment and 1 discount are hidden from every list and total. A Manager can restore it."), then back to the list the person came from.**

## Performance

- **Duration:** about 30 min (06:57 to 07:25)
- **Tasks:** 2 (tracer, then the sentence and the 404 case)
- **Files:** 3 created, 4 modified

## Accomplishments

- `DeleteOrderDialog` on `ConfirmDialog`: confirm `trash-2` "Delete Order" (pending "Deleting"), "Cancel" focused first, no textbox, no counts box. It counts items, payments, discounts, expenses and refunds from the arrays the page already holds.
- `softDeleteSentence`: zero counts dropped, plural nouns from `CASCADE_LABELS`, `formatCount` for thousands ("1,234 items"), "and" before the last, "is" only for one kind with a count of 1, and "It is hidden from every list and total." when every count is zero.
- The delete goes through `useOrderAction` and `ordersService.remove`: no Idempotency-Key, no version. Success navigates to `backTarget(location.state)`, toasts "Order {number} deleted" / "A Manager can restore it from Deleted Orders." and reads the order lists, the deleted list and the three order list-entry lists again.
- A 404 closes the dialog, goes back to the list and toasts (info) "Already deleted" / "Someone else deleted this order. The list is up to date."
- `OrderHeader` shows the ghost-danger "Delete Order" button beside Edit Details only when `canEditOrder(order)` (D-39). After the dialog closes, focus returns to the button by an explicit wish (WebKit and iPhone do not focus a button on click).

## Task Commits

1. **RED (both tasks' tests):** `2ac2bbfa` test(08-22): add failing tests for the Delete Order confirm and header button
2. **GREEN (both tasks):** `876eb908` feat(08-22): delete an order from its page with the hidden counts in words

## Files Created/Modified

- `web/src/modules/admin/components/DeleteOrderDialog.tsx` (+ `.test.tsx`): the dialog and `softDeleteSentence`
- `web/src/modules/admin/components/OrderHeader.tsx` (+ new `OrderHeader.test.tsx`): the button, the dialog and the focus wish
- `web/src/modules/admin/components/orderPage.recipe.ts`: `orderDeleteButtonClasses` (`border-line-strong!`)
- `web/src/modules/admin/orderPageCopy.ts`: the `remove` copy block
- `web/e2e/order-delete.spec.ts`: three `@orders-delete` tests

## Decisions Made

- The dialog finds its way back with `useLocation` and `backTarget`, the same function the order page uses for its back link, so `OrderPage.tsx` is untouched as the plan asks.
- "Is" or "are" follows the spec's examples: "Its 1 item is hidden", but "Its 1 item and 1 payment are hidden".
- Images are left out of the sentence (they are 0 until Phase 9).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The ghost-danger variant has a transparent border, the spec wants a `--line-strong` one**
- **Found during:** Task 1 (button look, UI-SPEC O1 Header)
- **Issue:** `Button` allows `className` for layout only, and the variant sets `border-transparent`; a plain `border-line-strong` would depend on CSS order.
- **Fix:** `orderDeleteButtonClasses = tw('border-line-strong!')` in `orderPage.recipe.ts` (important modifier), checked by the class gate in `orderPage.recipe.node.test.ts`.
- **Files modified:** `web/src/modules/admin/components/orderPage.recipe.ts` (outside the plan's file list)
- **Committed in:** `876eb908`

**2. [Rule 1 - Bug] First e2e run: focus did not return to Delete Order on WebKit and iPhone**
- **Found during:** Task 1 e2e (2 of 15 runs failed on `toBeFocused`)
- **Issue:** the dialog's own focus return finds no previously focused button in Safari engines.
- **Fix:** a focus wish in a ref, carried out in an effect once the dialog has closed (the 08-14 pattern).
- **Files modified:** `web/src/modules/admin/components/OrderHeader.tsx`
- **Verification:** `@orders-delete` 15 of 15 in the five projects.
- **Committed in:** `876eb908`

**3. [Plan variance] One GREEN commit for both tasks**
- Both tasks live in the same two files and the sentence and the 404 path are small, so all tests were written first (one RED commit) and one GREEN commit made them pass. Task 2's acceptance checks (tests named with "1,234" and "Already deleted") pass.

**4. [Plan variance] The e2e does not assert that the subline count drops by exactly one**
- The shared `CSPS_E2E` database is written to by other tests in parallel, so an exact drop is racy. The test asserts that the list read after the delete does not hold the order and that the subline shows that read's own counts (D-41). An exact "drops by one" check would be flaky; recorded in `deferred-items.md`.

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug), 2 plan variances
**Impact on plan:** none on scope. No package added or bumped. `orderPage.recipe.ts` joined the file list.

## Issues Encountered

- A sed line-number edit on the e2e spec ran after prettier had moved lines, which broke the file for a moment; I fixed it by hand before any run. No test ran against the broken file.
- `@orders-delete` also matched the `@orders-deleted` tests by prefix, so the e2e run counted 30 tests: 15 mine and 15 from plan 08-20, all passed.

## Verification

- `npm --prefix web run test -- --run src/modules/admin/components/DeleteOrderDialog.test.tsx src/modules/admin/components/OrderHeader.test.tsx`: 2 files, 19 tests passed (RED run before the code: 17 failed, 2 passed).
- Whole web suite, `npm --prefix web run test -- --run`: 263 files, 7426 tests passed (includes `no-long-dash.node.test.ts`, `orderPage.recipe.node.test.ts` and `OrderPage.test.tsx`).
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output. `npm --prefix web run typecheck`: exit 0. `npx prettier --check src/modules/admin e2e/order-delete.spec.ts`: clean.
- `npm --prefix web run e2e -- --grep @orders-delete`: 30 passed (1.4m) in chromium, firefox, webkit, iphone and the fifth project, after a preflight that showed all ports free.
- gitleaks on both staged changes: no leaks.
- No server code touched, so no .NET build or test run was needed.

## User Setup Required

None.

## Next Phase Readiness

Ready for 08-23 (the read-only deleted order view). A deleted order's detail view must not reuse `OrderHeader` as it stands (it would offer Delete Order); it builds its own header.

## Known Stubs

None.

## Threat Flags

None. T-08-42 is mitigated as planned: the confirm names what is hidden and that a Manager can restore it, and nothing is removed for good here.

## TDD Gate Compliance

Task-level TDD (the plan is `type: execute`): RED `2ac2bbfa` precedes GREEN `876eb908`. No REFACTOR commit. RED evidence: 17 of 19 tests failed on the planned assertions (no dialog found, no Delete Order button, sentences empty) against a stub that rendered nothing; the 2 that passed were the negative "hidden on Completed and Cancelled" checks, which hold before the button exists. Semantic assessment: each failure was on the named target test for the planned reason, not a setup fault.

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*

## Self-Check: PASSED

All 7 listed files exist on disk and both task commits are ancestors of HEAD.
