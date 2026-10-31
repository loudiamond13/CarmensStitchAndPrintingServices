---
phase: 08-order-screens
plan: 02
subsystem: ui
tags: [react, order-totals, order-card, order-status, money, tdd, a11y]
created: "2026-10-29T17:20:00-05:00"
updated: "2026-10-29T17:20:00-05:00"

requires:
  - phase: 08-order-screens
    provides: "08-01 list rows with pieces and the OrderListEntry money fields (api.generated.ts)"
provides:
  - "OrderTotals shows server figures: Subtotal, Discount, Total, Paid, Refunded and four balance states"
  - "OrderCard takes an order list row, no Delete, pieces, due slot, View Order and Edit Details"
  - "Delivered is the seventh status (accent tone); refunds join the delete sentence and tally"
  - "MoneyValue, OrderFigures, isPositiveMoney, isNegativeMoney, negateMoney in csps.ts"
affects: [08-06, 08-10, order-list, order-page, deleted-orders]

actuals:
  tokens: 25500
  tasks: 3
  commits: 6
plan_head_before: 31b09e536bb8346a9a13866a4b6aafcaf54d3779
plan_head_after: 3bbc4405ac68ac9615ca51ad2979b79513b12b51

tech-stack:
  added: []
  patterns:
    - "Server money is judged by whole centavos (isPositiveMoney, isNegativeMoney) and negated as exact text (negateMoney), never by a float compare"
    - "Balance state chosen by one function, first match wins: credit, Fully Paid, Not collected, else Balance due"
    - "Scenarios changed by owner rulings run implementation-only (parity false) instead of against the frozen design"

key-files:
  created: []
  modified:
    - web/src/utils/csps.ts
    - web/src/utils/csps.test.ts
    - web/src/components/money/OrderTotals.tsx
    - web/src/components/money/money.recipe.ts
    - web/src/components/money/money.test.tsx
    - web/src/components/data/OrderCard.tsx
    - web/src/components/data/copy.ts
    - web/src/components/data/data.recipe.ts
    - web/src/components/data/data.test.tsx
    - web/src/components/data/index.ts
    - web/src/components/status/tones.ts
    - web/src/components/status/status.test.tsx
    - web/src/components/overlays/ConfirmDialog.test.tsx
    - web/src/dev/previews/DefinedTotalsNote.tsx
    - web/src/dev/scenarios/groups/data.ts
    - web/src/dev/scenarios/groups/money.ts
    - web/src/dev/scenarios/groups/status.ts

key-decisions:
  - "The credit block is info-soft on the panel and neutral (surface-2) on the card with a Credit badge; Not collected is neutral on both"
  - "The preview path (order prop) turns an overpayment into a credit so the create form aside never shows a negative balance"
  - "OrderCard keeps an optional cover prop ({src, name, number, count}) for Phase 9; without it the cover reads No images yet"
  - "OrderCard and OrderTotals parity scenarios are implementation-only because the frozen design cannot show the owner's new rows, states and actions"

patterns-established:
  - "OrderCardOrder extends OrderFigures, so an API OrderListEntry (status narrowed) passes straight in"
  - "Delivered scenario has parity false because the frozen design never drew that status"

requirements-completed: [ORD-01, ORD-12, ORD-19]

coverage:
  - id: D1
    description: "Totals panel shows the PRD names and figures (Subtotal, Discount, Total, Paid, expenses, profit) for ORD-2026-0148 from server decimal text, with the Refunded +₱ row only when refunded"
    requirement: ORD-01
    verification:
      - kind: unit
        ref: "web/src/components/money/money.test.tsx#OrderTotals (D-01 to D-07, D-45)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Four balance states, first match wins: Customer credit (never negative, Record Refund only when the caller allows), Fully Paid, Not collected on a Cancelled order, Balance due; centavo adjacency 0.00 / 0.01"
    requirement: ORD-12
    verification:
      - kind: unit
        ref: "web/src/components/money/money.test.tsx#shows a customer credit in the info block"
        status: pass
      - kind: unit
        ref: "web/src/components/money/money.test.tsx#draws the balance edge cases by the centavo (ORD-01 adjacency)"
        status: pass
      - kind: unit
        ref: "web/src/utils/csps.test.ts#server money helpers (ORD-01 precision)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Profit note follows the status (Staff only; Cancelled explains money kept) and a negative profit shows red with U+2212"
    verification:
      - kind: unit
        ref: "web/src/components/money/money.test.tsx#reads the Cancelled profit note"
        status: pass
    human_judgment: false
  - id: D4
    description: "Order card follows the list contract: Total and balance block only, pcs, due slot, No images yet, no Delete, Edit Details hidden when Completed or Cancelled, names by order number"
    requirement: ORD-19
    verification:
      - kind: unit
        ref: "web/src/components/data/data.test.tsx#OrderCard (list contract, D-04, D-22, D-27, D-40, D-46, D-57)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Delivered is the seventh status in the accent tone with word and dot; ACTIVE_STATUSES has five; delete sentence and tally count refunds"
    verification:
      - kind: unit
        ref: "web/src/components/status/status.test.tsx#StatusBadge"
        status: pass
      - kind: unit
        ref: "web/src/utils/csps.test.ts#Delivered and refunds (plan 08-02)"
        status: pass
      - kind: unit
        ref: "web/src/components/overlays/ConfirmDialog.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "The new totals panel and card look right in light and dark at 390, 820 and 1440 px (look of the info and neutral grounds, credit block layout, Delivered accent)"
    verification: []
    human_judgment: true
    rationale: "No test judges the visual look; the owner reviews screenshots of the credit, Not collected and Delivered states (08-UI-SPEC owner review list)"

duration: 27min
completed: 2026-10-29
status: complete
---

# Phase 8 Plan 02: Order money panel, card and Delivered status Summary

**OrderTotals shows server decimals with the owner's money names and four balance states (credit, Fully Paid, Not collected, due), OrderCard takes a list row with no Delete, and Delivered joins the statuses.**

## Performance

- **Duration:** 27 min
- **Started:** 2026-10-29T16:50:00-05:00
- **Completed:** 2026-10-29T17:17:00-05:00
- **Tasks:** 3
- **Files modified:** 17

## Accomplishments

- `OrderTotals` panel rows are Subtotal, Discount (negative), Total, Paid (negative) and Refunded (`+₱`, only when above zero), then the balance block, then Order Expenses, Estimated Profit and the status note. Figures go straight to `formatPeso` as the number or text the API sent. `₱99,999,999.99` and `'1000000.00'` render exactly.
- The balance block picks one of four states by centavo checks: Customer credit (info ground, the D-02 line, optional Record Refund), Fully Paid, Not collected (Cancelled with a balance, neutral ground) or Balance due. A credit is never shown as a negative figure or in the danger color.
- The card variant shows one Total row and the same four states, with the credit as an info `Credit ₱X` badge. It has no Discount, Order Expenses or Estimated Profit text (T-04 test asserts this).
- `OrderCard` takes `OrderCardOrder` (list row field names plus figures), shows `{n} pcs`, a `due` slot, `No images yet` (or an optional Phase 9 `cover`), `View Order` and `Edit Details` (named "View order {number}" and "Edit details of order {number}"). It has no Delete. Edit Details is hidden on Completed and Cancelled orders.
- Delivered is the seventh status (between Ready and Completed, active, accent tone with a dot). `cascadeSentence` and the delete dialog tally count refunds after expenses.

## Task Commits

TDD, each task a RED commit then a GREEN commit:

1. **Task 1 (tracer): totals panel** - RED `839eb1b2` (test), GREEN `d04f1418` (feat)
2. **Task 2: Delivered and refund counts** - RED `809f299c` (test), GREEN `671b134d` (feat)
3. **Task 3: order card** - RED `3c4a4dd8` (test), GREEN `3bbc4405` (feat)

**Plan metadata:** the docs commit that holds this file, STATE.md and ROADMAP.md.

## TDD Gate Compliance

All three tasks have a `test(08-02)` commit before the `feat(08-02)` commit. No refactor commit was needed.

- **RED evidence** (vitest `--reporter=tap`, one target test per task, classifier `check tdd-red-evidence` returned `RED_EVIDENCE_OK` / `target_test_failed`):
  - Task 1: target "shows a customer credit in the info block with the D-02 line and never as a negative balance" failed with `expected 'Balance due₱0.00' to contain 'Customer credit'`. The csps helper tests failed because `isPositiveMoney`, `isNegativeMoney` and `negateMoney` did not exist (a call on an undefined export), which is the planned missing behavior.
  - Task 2: target "counts refunds after expenses and before images in the delete sentence" failed with the sentence lacking "2 refunds".
  - Task 3: target "puts the due slot after the clock icon instead of the plain due date" failed with `expected 'Due Oct 14, 2026' to be 'Due in 3 days'`. The test fixtures (card rows) were committed with the RED commit and the old component rendered them, so the failures were assertions, not crashes.
  - Semantic assessment (each task): the named target ran, was not skipped, and failed on the planned assertion for the intended reason.
  - Some Task 3 RED targets with a multi-line DOM dump in their message (the "no Delete" and footer tests) were rejected by the classifier as unparsable TAP (`invalid_record`, a reporter formatting limit, not a fixture fault). A target with a single-line message was submitted instead and passed.
- **Intermediate state:** between the Task 1 GREEN commit and the Task 3 GREEN commit, `data.test.tsx` (old card tests) failed on the old labels. Task 3 rewrote it. Typecheck, lint and the Task 1 and 2 verify commands passed at their commits.

## Files Created/Modified

- `web/src/utils/csps.ts` - `MoneyValue`, `OrderFigures`, centavo helpers, `delivered`, `refunds`
- `web/src/components/money/OrderTotals.tsx` - rewritten for server figures and four states
- `web/src/components/money/money.recipe.ts` - credit and neutral grounds, overline colors, wrap and line classes
- `web/src/components/data/OrderCard.tsx` - list-contract card
- `web/src/components/data/copy.ts` - `ORDER_CARD_COPY` (No images yet, View Order, Edit Details)
- `web/src/components/data/data.recipe.ts` - removed the overdue and delete-pushed-right classes the card no longer uses
- `web/src/components/status/tones.ts` - `STATUS_TONE.delivered = 'accent'`
- `web/src/dev/scenarios/groups/{data,money,status}.ts` - list-row card fixtures, parity flags
- tests: `csps.test.ts`, `money.test.tsx`, `data.test.tsx`, `status.test.tsx`, `ConfirmDialog.test.tsx`

## Decisions Made

- The credit block uses the info-soft ground on the order page and the neutral `--surface-2` ground on the card (UI-SPEC), through one `BALANCE_STATE` map in `OrderTotals`.
- The preview path (`order` prop, used by the create form aside and the showcase) turns an overpayment into a credit, so a negative balance is never drawn.
- `OrderCardOrder` extends `OrderFigures`, so the list screen (08-06) can pass an API row once `status` is narrowed with `isOrderStatus`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Scenario fixtures and parity flags**
- **Found during:** Task 3 (and Task 1)
- **Issue:** The dev scenarios feed the old `Order`-shaped props to `OrderCard`, and the parity suite compares OrderCard, OrderTotals and status badges against the frozen design, which has no Delivered, no new rows and no credit states. The scenarios are not in the plan's file list but data and money tests render them.
- **Fix:** Card scenarios now use order list rows (`CARD_0148`, `CARD_0151`, `CARD_0153`, plain data checked against `orderTotals` in the test). The OrderCard cases, the three OrderTotals cases and the Delivered badge case are `parity: false` (implementation-only). The Money, KpiCard, DataTable and chart cases keep parity.
- **Files modified:** `web/src/dev/scenarios/groups/data.ts`, `money.ts`, `status.ts`, and their tests
- **Verification:** full web suite passes; no parity (Playwright) run was done
- **Committed in:** `3c4a4dd8`, `671b134d`

**2. [Rule 1 - Bug] ConfirmDialog tally expectations**
- **Found during:** Task 3 (full-suite run)
- **Issue:** Adding `refunds` to `CASCADE_LABELS` adds a "0refunds" tile to the delete dialog tally, so two existing ConfirmDialog tests listed the old five tiles.
- **Fix:** The expected tiles now include refunds. The component needed no change.
- **Files modified:** `web/src/components/overlays/ConfirmDialog.test.tsx`
- **Committed in:** `3bbc4405`

**3. [Rule 2 - Missing critical] Overpaid preview**
- **Found during:** Task 1
- **Issue:** The plan maps the preview with refunded and credit at zero, which would draw a negative "Balance due" for an overpaid preview and break the "never negative" ruling (D-02).
- **Fix:** The preview moves a negative balance into `customerCredit` (negation only, no rounding change). A test covers it.
- **Committed in:** `d04f1418`

**4. [Plan wording] WalkInOrderCard preview**
- `web/src/dev/previews/WalkInOrderCard.tsx` takes only `children`, so no prop change was needed and it is unchanged. `DefinedTotalsNote.tsx` only had its comment reworded.

---

**Total deviations:** 3 auto-fixed (1 blocking, 1 bug, 1 missing critical) plus 1 note.
**Impact on plan:** No scope creep. The parity flags are a verification-posture change the owner should know about (see Next Phase Readiness).

## Issues Encountered

None beyond the deviations above. Full web suite: 202 files, 6096 tests pass after the ConfirmDialog fix.

## Verification Results

- `npm --prefix web run test -- --run` money, csps, status, golden, data, ConfirmDialog, no-long-dash: pass
- Full `npx vitest run` in `web/`: the first run had 2 failures (the ConfirmDialog tally tests, fixed); the final run after the fix: 202 files and 6096 tests, all pass
- `npm --prefix web run typecheck`: clean (app, node, reference configs)
- `npm --prefix web run lint` (`--max-warnings 0`): clean
- `prettier --check src`: clean
- gitleaks on every staged change: no leaks
- Acceptance greps: `Total Discount|Total Paid` 0, `Internal only` 0, `Staff only` 3, `style=` none, `onDelete` 0, `delivered: 'Delivered'` 1, `delivered: 'accent'` 1, `'refunds', 'refund'` 1, `No images yet` in copy.ts 1

## Known Stubs

None. No placeholder data flows to a screen; "No images yet" is the ruled D-27 placeholder until Phase 9.

## Threat Flags

None. No new endpoint, auth path or file access. T-08-04 (no Discount, Expenses or Profit text on the card) is asserted in `data.test.tsx`; T-08-SC: no package added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-06 (list) can render `OrderCard` with an API row, a `DueFlag` in the `due` slot, and `onView` and `onEdit`. 08-10 (order page) can render `OrderTotals variant="panel" totals={detail figures} status={status} onRecordRefund={...}`.
- Open for the owner/verifier: the parity (Playwright) comparison for OrderCard, OrderTotals and the Delivered badge is switched off because the frozen design cannot show the new design. The owner reviews screenshots of the credit, Not collected, Fully Paid and Delivered states (08-UI-SPEC "owner reviews screenshots"). Not run here: the parity and E2E suites.
- ORD-12 flagged assumption kept: Fully Paid comes only from the server's `fullyPaid`; a credit wins over it in the display.

---
*Phase: 08-order-screens*
*Completed: 2026-10-29*

## Self-Check: PASSED

All 17 key files exist on disk, and the six commits `839eb1b2`, `d04f1418`, `809f299c`, `671b134d`, `3c4a4dd8`, `3bbc4405` are ancestors of HEAD (checked with `git merge-base --is-ancestor`).
