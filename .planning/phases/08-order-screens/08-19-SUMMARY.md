---
phase: 08-order-screens
plan: 19
subsystem: ui
tags: [react, menu-button, apg, tanstack-query, msw, playwright, idempotency, modal]
created: 2026-10-30T05:30:00-05:00
updated: 2026-10-30T05:30:00-05:00

requires:
  - phase: 08-order-screens
    provides: useOrderAction, useApplyOrder, useRefetchOrder, focus-return pattern (08-14); OrderLockedBanner, useOrderQuery (08-15); orderRules.canComplete, isLocked, order page and query key (08-10); OrderTabHead and read-only tabs (08-12)
provides:
  - "Change Status menu by the status badge: Move to {Status}, Mark Completed (aria-disabled with its visible reason), Cancel Order, with the APG menu-button keys"
  - "Cancel Order confirm that explains the money (D-18), with Keep Order focused first and no refund recorded"
  - "Locked banner with Reopen Order on Completed and Cancelled orders (D-15)"
  - "Reopen Order window with a Reopen as radio group, starting on the status before the end state (D-16)"
  - "reopenDefault(order), orderStatusLabel, otherActiveStatuses, OrderStatusDot"
affects: [08-20, 08-21, 08-23, 08-24]

actuals:
  tokens: 35174
  tasks: 3
  commits: 6
plan_head_before: 8d6171a22f42076e8826641e56565673f852ecd5
plan_head_after: d77c2b86551ed0cf0a22fbfbd609594a5c45ecbb

tech-stack:
  added: []
  patterns:
    - "A single-click status action goes through useOrderAction; the submission id is order id + status, so a retry keeps its key and a different status is a new submission"
    - "The page keeps a focus wish (reopen or status) and carries it out after the render that shows the target button, found by element id"
    - "Refusal words: a 422 shows the server sentence, a 404 the page's not-found sentence, anything else the P2 line"

key-files:
  created:
    - web/src/modules/admin/components/OrderStatusMenu.tsx
    - web/src/modules/admin/components/OrderStatusMenu.test.tsx
    - web/src/modules/admin/components/CancelOrderDialog.tsx
    - web/src/modules/admin/components/ReopenOrderModal.tsx
    - web/src/modules/admin/components/ReopenOrderModal.test.tsx
    - web/src/modules/admin/components/OrderStatusDot.tsx
    - web/src/modules/admin/orderStatus.ts
    - web/e2e/order-status.spec.ts
  modified:
    - web/src/modules/admin/components/OrderHeader.tsx
    - web/src/modules/admin/components/orderPage.recipe.ts
    - web/src/modules/admin/pages/OrderPage.tsx
    - web/src/modules/admin/pages/OrderPage.test.tsx
    - web/src/modules/admin/orderPageCopy.ts

key-decisions:
  - "A move is keyed by order id + status through useOrderAction, so a retry of the same move keeps its Idempotency-Key and no move ever sends a version"
  - "The Cancel dialog belongs to the menu component; the page learns of a finished cancel or complete through onMoved and puts focus on Reopen Order"
  - "After a reopen the page, not the window, focuses Change Status, because the window's trigger has left the page by then; a dismissed window sets the wish back to Reopen Order (WebKit does not focus a button on click)"
  - "Every failed move has the toast title \"Couldn't change the status\"; only a 422 shows server text (SPEC-GAP, owner review)"

patterns-established:
  - "OrderHeader takes onStatusMoved so a page can react to a complete or cancel without owning the menu"
  - "Modal first focus can be a ref-like object whose current is looked up at open (the checked radio)"

requirements-completed: [ORD-07]

coverage:
  - id: D1
    description: "On an active order a Change Status menu button sits by the badge, outside the h1, and lists Move to {Status} for each other active status in order, then Mark Completed and Cancel Order"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#lists every other active status in order, then Mark Completed and Cancel Order"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#sits beside the status badge, outside the h1, on an active order"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-status.spec.ts#@orders-status a Manager moves an order from In Production to Delivered and sees the badge and a new history row"
        status: pass
    human_judgment: false
  - id: D2
    description: "A move acts at once: POST /orders/{id}/status with an Idempotency-Key and no version, the trigger shows Saving, the page shows the answer, focus returns to Change Status, and the toast reads Status changed / {number} is now {Status}."
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#moving the order (D-14, D-20, 05 D-21)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#moves the order to Ready from the page: the badge changes and the history gains a row"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-status.spec.ts#@orders-status a Manager moves an order from In Production to Delivered ..."
        status: pass
    human_judgment: false
  - id: D3
    description: "The menu follows the APG menu-button keys: Enter, Space or ArrowDown open on the first item, ArrowUp on the last, arrows wrap, Home and End, Esc closes to the button, Tab closes; the disabled item is focusable"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#the menu keys (UIC-56, APG menu button)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Mark Completed has no confirm; it is aria-disabled and shows Balance must be ₱0.00 to complete. while a balance is owed or credit is held, and acts at once at exactly ₱0.00"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#Mark Completed (D-14, D-47, UIC-38)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-status.spec.ts#@orders-status a Manager completes a fully paid order at once and the order locks"
        status: pass
    human_judgment: false
  - id: D5
    description: "A refused move (complete-balance-owed, complete-credit, reopen-first) shows a danger toast with the server text and reads the order again; other failures show the P2 words, never server text"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#shows a refusal as a danger toast with the server text and reads the order again (UIC-24)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Cancel Order opens Cancel {number}? with the money sentence (Payments of ₱X stay as collected cash... or Nothing was paid on this order.) and You can reopen it later., Keep Order focused first, a danger x Cancel Order that shows Cancelling; no refund is recorded"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#Cancel Order (D-18, D-54c, D-57, ORD-07)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-status.spec.ts#@orders-status a Manager cancels an order, sees the locked banner and Refunds tab, then reopens it to In Production"
        status: pass
    human_judgment: false
  - id: D7
    description: "A Completed or Cancelled order shows the locked banner with Reopen Order and no Change Status; Edit Details and every add, edit and delete stay hidden; the Cancelled banner adds the refunds line and the Refunds tab shows"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#a locked order and its banner (ORD-07, D-15, D-39, UIC-37)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-status.spec.ts#@orders-status a Manager cancels an order ..."
        status: pass
    human_judgment: false
  - id: D8
    description: "Reopen Order opens Reopen {number} with a Reopen as radio group of the five active statuses, preselecting the status before the end state else Pending; success toasts Order reopened, closes, and focuses Change Status; a 422 shows the server text"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ReopenOrderModal.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrderPage.test.tsx#reopening from the banner (ORD-07, D-15, D-16, UIC-37, UIC-47)"
        status: pass
      - kind: e2e
        ref: "web/e2e/order-status.spec.ts#@orders-status a Manager cancels an order ... then reopens it to In Production"
        status: pass
    human_judgment: false
  - id: D9
    description: "Cancelling records, suggests and prefills no refund; payments stay as collected cash until staff record a refund themselves"
    requirement: ORD-07
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#cancels with the status cancelled, an Idempotency-Key and no version, toasts, and records no refund"
        status: pass
    human_judgment: false
  - id: D10
    description: "The look of the Change Status button and popover, the dots, the disabled reason line, the Cancel dialog, the locked banner on a phone and the Reopen window in Blush and Espresso"
    verification: []
    human_judgment: true
    rationale: "Colour, spacing and layout feel are the owner's screenshot review; tests prove behavior, boxes, focus and axe, not taste"

duration: 42min
completed: 2026-10-30
status: complete
---

# Phase 08 Plan 19: Move, complete, cancel and reopen an order Summary

**Change Status menu on the order page (allowed moves, Mark Completed only at ₱0.00, APG keys), a money-explaining Cancel confirm, a locked banner with Reopen Order, and a Reopen window that starts on the status the order came from, all through idempotent no-version status calls**

## Performance

- **Duration:** about 42 min
- **Started:** 2026-10-30T04:40:00-05:00 (approximate)
- **Completed:** 2026-10-30T05:25:00-05:00
- **Tasks:** 3
- **Files:** 13 under `web/` (8 new, 5 changed) plus `deferred-items.md`

## Accomplishments

- **Change Status menu** (`OrderStatusMenu`): a secondary sm menu button beside the status badge, outside the h1, drawn only for an editable order. It lists "Move to {Status}" for every other active status in order (with the status dot), a divider, "Mark Completed" and a danger "Cancel Order". Items are at least 44 px tall. The keys follow the user menu: Enter, Space or a click open on the first item, ArrowDown first, ArrowUp last, arrows wrap, Home and End, Esc closes to the button, Tab closes, a press outside closes. The disabled item is `aria-disabled`, stays in the arrow order and shows "Balance must be ₱0.00 to complete." as visible text.
- **A move acts at once.** It goes through `useOrderAction` with `ordersService.changeStatus(id, status, key)`: one Idempotency-Key, no `version`. The trigger shows "Saving" (aria-busy, focus kept), the page takes the answer as it is (badge, history row, totals), focus returns to Change Status, and the toast reads "Status changed" / "{number} is now {Status}.". The sent key is the wire key (`production` for In Production).
- **Mark Completed** has no confirm (D-47). It is disabled for a balance owed or customer credit (`canComplete`), acts at once at exactly ₱0.00, toasts "Order completed" / "{number} is locked. Reopen it to make changes.", and the page puts focus on Reopen Order.
- **Cancel Order** (`CancelOrderDialog`): "Cancel {number}?" with "Payments of ₱X stay as collected cash. Record a refund on the Refunds tab if you give money back." (or "Nothing was paid on this order.") and "You can reopen it later.". "Keep Order" is focused first, the danger button has the `x` icon and reads "Cancelling" while it runs. No refund is recorded or prefilled; a test checks no write goes to a refund route. The toast reads "Order cancelled" / "{number} is locked. Payments stay as collected cash.".
- **Locked banner** (`OrderLockedBanner` from 08-15) under the header on Completed and Cancelled orders, with a secondary sm `lock-open` "Reopen Order" in its slot. The Change Status menu and Edit Details are gone; the add, edit and delete controls were already hidden by the tabs (`canEditOrder`). The Cancelled banner adds the refunds line and the Refunds tab shows.
- **Reopen Order** (`ReopenOrderModal`): "Reopen {number}", "Choose the status to go back to.", legend "Reopen as", five statuses with dots, preselecting `reopenDefault(order)` (the `from` of the newest history row that ended in the current end state when that is active, else Pending). The checked radio takes the focus. "Reopen Order" (pending "Reopening") sends the chosen status with a key and no version; success closes, toasts "Order reopened" / "{number} is now {Status}." and the page focuses Change Status. A 422 shows the server sentence under the choices and the window stays open.
- **Refusals (UIC-24):** a 422 or 404 reads the order again, so the next open of the menu reflects the latest order; the toast carries the server's sentence for a 422 only.

## Task Commits

1. **Task 1 (tracer): Move an order from In Production to Ready** - RED `ec26333b` (test), GREEN `1762bc6f` (feat)
2. **Task 2: Complete and cancel, and the locked banner** - RED `27e3c75a` (test), GREEN `7d48308d` (feat)
3. **Task 3: Reopen to the right status** - RED `8ef00b2a` (test), GREEN `d77c2b86` (feat)

**Plan metadata:** the docs commit that follows this file.

## Tracer gate

Task 1 was `type="tracer"` with an automated-only `<verify>` in auto mode, so the gate re-ran it before expansion: the two unit files (83 tests) and `@orders-status` e2e (5 passed) passed, and the log read "Tracer verified end-to-end, expanding". After Task 3 the e2e ran again with all three tests: 15 passed in 5 projects.

## TDD evidence

- RED 1 (`ec26333b`): 29 of the new tests failed at the first planned assertion (`Unable to find role="button" and name "Change Status"`) against a placeholder `OrderStatusMenu` that renders nothing. Semantic assessment: the target tests ran and failed on the planned behavior, not on import or setup faults. GREEN: 83 of 83 first run.
- RED 2 (`27e3c75a`): 15 failed on the planned assertions (no dialog, no banner, no toast, no Keep Order). Four tests were green at RED (Mark Completed disabled for credit, no banner on an active order, no Edit Details on a locked order, the completed banner has no refunds line) because the page already hid the actions; they stay as regression tests. GREEN: 103 of 103 first run.
- RED 3 (`8ef00b2a`): 19 failed (no dialog; `reopenDefault` placeholder returned Pending where Ready or In Production was planned). The axe test passed on the empty page at RED. GREEN: 125 of 126, then the double-press test was rewritten to hold the first reply open: in a test harness that never closes the window, a second press after a finished reopen is a new reopen by design.
- The plan is `type: execute`, so no `gsd check tdd-red-evidence` records were made; the RED runs above are the evidence.

## Verification (quoted)

- Plan-level unit files: `OrderStatusMenu.test.tsx`, `ReopenOrderModal.test.tsx`, `OrderPage.test.tsx` all pass.
- Full web suite: "Test Files  253 passed (253) / Tests  7277 passed (7277)".
- `npm run lint` (`eslint . --max-warnings 0`): exit 0, no output. `npm run typecheck`: clean. `npx prettier --check src e2e`: "All matched files use Prettier code style!"
- `npm run e2e -- --grep @orders-status`: "15 passed (1.0m)" (3 tests x chromium, firefox, webkit, pixel, iphone). The first Task 3 run failed 5 of 15 only on my own assertion that the Totals panel does not contain the word "Refunded" (the profit note spells it); fixed to look for the exact "Refunded" row label.
- Acceptance greps: `grep -c "aria-haspopup" OrderStatusMenu.tsx` is 1 (the Button prop; the popover is labelled by the button); the menu test asserts the request body has no `version`; `grep -c "Keep Order" orderPageCopy.ts` is 1; `OrderPage.test.tsx` has tests named with "locked" that check Edit Details is absent; `ReopenOrderModal.test.tsx` has a test named with "preselect".
- Preflight before the e2e runs and the full suite: all of 5180, 5115, 7028 and 5199 free, no other project's processes listed.
- gitleaks ran on every commit through the pre-commit hook: "no leaks found". No local paths, server names or real customer data in any file (fixtures use fake names).

## Files Created/Modified

- `OrderStatusMenu.tsx` (+ test): the menu button, popover, move and complete actions, and the failure toast rules
- `CancelOrderDialog.tsx`: the Cancel confirm on `ConfirmDialog`
- `ReopenOrderModal.tsx` (+ test): the Reopen window and `reopenDefault`
- `OrderStatusDot.tsx`, `orderStatus.ts`: the dot, the status label, the other active statuses and the two element ids
- `OrderHeader.tsx`: draws the menu on an editable order, passes `onStatusMoved`
- `OrderPage.tsx` (+ test): banner with Reopen Order, the Reopen window, the focus wish
- `orderPageCopy.ts`, `orderPage.recipe.ts`: the words and the menu classes
- `web/e2e/order-status.spec.ts`: three `@orders-status` tests

## Decisions Made

- A move is keyed by order id plus status through `useOrderAction` (its target id), so a retry of the same move keeps its key and a different status is a new submission.
- The Cancel dialog lives in the menu component, so the menu tests cover the whole cancel flow; the page learns of the result through `onMoved`.
- Focus after a complete, cancel or reopen is carried out by the page after the render that shows the target button, found by element id.
- Only a 422 shows server text in a toast; every other failure shows the P2 words.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `exactOptionalPropertyTypes` and a lint rule on class strings**
- **Found during:** Task 1 (typecheck) and Task 3 (eslint)
- **Issue:** `aria-controls={undefined}` is not allowed on `Button`; a template literal in `className` breaks the D-33 class rule.
- **Fix:** spread `{...(open ? { 'aria-controls': id } : {})}`; join the classes with `clsx`.
- **Files modified:** `OrderStatusMenu.tsx`, `ReopenOrderModal.tsx`
- **Committed in:** `1762bc6f`, `d77c2b86`

**2. [Rule 1 - Bug] A test assumed a window that never closes**
- **Found during:** Task 3 (GREEN run)
- **Issue:** the double-press test in the modal harness pressed a second time after the first reopen had finished, which is a new reopen by design in a harness that ignores `onClose`.
- **Fix:** hold the first reply open so both presses land while it is pending (one request).
- **Files modified:** `ReopenOrderModal.test.tsx`
- **Committed in:** `d77c2b86`

**3. [Rule 1 - Bug] An e2e check matched the profit note**
- **Found during:** Task 3 (e2e)
- **Fix:** look for the exact "Refunded" row label instead of the substring.
- **Files modified:** `web/e2e/order-status.spec.ts`
- **Committed in:** `d77c2b86`

### Additions outside the plan's file list

`OrderStatusDot.tsx`, `orderStatus.ts` (the shared status words and element ids) and the menu classes in `orderPage.recipe.ts` were needed by both the menu and the Reopen window. `OrderHeader.tsx` gained an `onStatusMoved` prop. `CancelOrderDialog.tsx` has no test file of its own; its flow is tested through the menu and the page.

### Spec deviations recorded for the owner (SPEC-GAP in `deferred-items.md`, "From plan 08-19")

Where the popover opens (1), the one toast title for every failure (2), the Refunds tab has no refund control yet (3), what "Payments of ₱X" counts (4), where each refusal shows (5), the focus mechanism (6), the Cancel dialog going with the menu (7), the Reopen first focus (8), the retry key (9), the extra files (10), a note for plan 08-21 (11), the TDD record (12) and the screenshot review list (13).

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bug). **Impact on plan:** none on scope. No package added.

## Issues Encountered

- One e2e run failed on my own assertion (deviation 3). One test needed a rewrite (deviation 2). No flake seen in any project; WebKit and iPhone passed the focus flows, including Keep Order returning to Change Status.

## Known Stubs

None. Nothing in the new files renders hardcoded empty or placeholder data. The Refunds tab still has no Record Refund button, which is the refunds plan's work and is not a stub of this plan.

## Threat Flags

None. No new endpoint, auth path or schema. T-08-35 (status moves): the menu offers only allowed moves from `orderRules`, a refusal shows the server text, one key per move through `useOrderAction`. T-08-36 (history): every move is recorded by the server and the history card gains the row on the next answer. T-08-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-20 and 08-21 (delete, restore, the deleted view): see item 11 in `deferred-items.md`; the deleted view builds its own header and body and must not draw this menu or the banner.
- The Refunds tab's actions (Record Refund) come from the refunds plan; this plan only keeps the tab visible on a Cancelled order.
- Owner review items are in `deferred-items.md` under "From plan 08-19".

## TDD Gate Compliance

Task-level TDD (the plan is `type: execute`): RED commits `ec26333b`, `27e3c75a`, `8ef00b2a` precede GREEN commits `1762bc6f`, `7d48308d`, `d77c2b86`. No REFACTOR commit (none needed).

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*

## Self-Check: PASSED

All 13 listed files exist on disk and all six task commits are ancestors of HEAD. The `<acceptance_criteria>` and the plan-level `<verification>` commands were re-run (results quoted above).
