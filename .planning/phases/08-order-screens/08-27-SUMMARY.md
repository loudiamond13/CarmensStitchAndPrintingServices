---
phase: 08-order-screens
plan: 27
subsystem: orders
tags: [orders, status-menu, web, gap-closure, G-08-5, D-96, WR-05]
created: "2026-10-30T19:47:30-05:00"
updated: "2026-10-30T19:47:30-05:00"
status: complete

requires:
  - phase: 08-order-screens
    provides: "08-19: OrderStatusMenu and its keyboard rules; useRefetchOrder in useApplyOrder.ts"
provides:
  - "OrderStatusMenu reads the order again whenever it opens (click, Enter, Space, ArrowDown, ArrowUp), so Mark Completed is enabled or aria-disabled from current figures"
affects: [08-29-e2e, phase-8-verification]

actuals:
  tokens: 4300
  tasks: 2
  commits: 3
plan_head_before: f9c714173f88dfda7db74b1d23909ec7c086302d
plan_head_after: 8458ad524112b579d0265fcf5194cc1f9cc4d056

tech-stack:
  added: []
  patterns:
    - "The read on open is not awaited: the menu shows at once on the held figures and re-renders from the page's answer"
    - "A test helper that answers the first read with one order and later reads with another is a plain function (inTurn) that returns the detail handler, because a use-named helper trips the react-hooks lint rules"

key-files:
  created: []
  modified:
    - web/src/modules/admin/components/OrderStatusMenu.tsx
    - web/src/modules/admin/components/OrderStatusMenu.test.tsx

key-decisions:
  - "D-96 applied as ruled: one `void refetchOrder(order.id)` in `openMenu`, the single place every open path goes through; items, keyboard rules and the focus effect are unchanged"
  - "The server's 422 orders.complete-balance-owed stays the gate; the read only makes the menu's own enable or disable current"

requirements-completed: [ORD-07]

coverage:
  - id: D1
    description: "Opening the status menu by click, Enter, Space, ArrowDown or ArrowUp reads the order once more, and Mark Completed turns enabled (no aria-disabled, no reason line) when the answer brings balance 0.00"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#Mark Completed follows the current figures (D-96, WR-05) > reads the order once more when the menu opens with %s, and enables Mark Completed"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#sends the move to completed once a payment from another session settled the balance"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mark Completed turns aria-disabled with its reason when the answer brings a new balance owed, and the focused item keeps focus; a failed open read leaves the menu working on the held figures with no toast; axe passes after the answer lands"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#disables Mark Completed, with its reason, when the answer brings a new balance, and focus stays on the item"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#keeps the menu working on the held figures when the open read fails, with no toast"
        status: pass
      - kind: automated_ui
        ref: "web/src/modules/admin/components/OrderStatusMenu.test.tsx#has no axe violations on the open menu after the answer lands"
        status: pass
    human_judgment: false
  - id: D3
    description: "Two staff sessions: a payment recorded in one session enables Mark Completed in the other without a reload"
    verification: []
    human_judgment: true
    rationale: "Real cross-session behavior; the two-staff e2e for this rule runs in plan 08-29, not here"

duration: 17min
completed: 2026-10-30
---

# Phase 8 Plan 27: Mark Completed reads current figures Summary

**The Change Status menu reads the order again each time it opens, so a payment from another session enables Mark Completed (and a new balance disables it) without waiting for some other refetch (D-96, WR-05).**

## Performance

- **Duration:** 17 min
- **Started:** 2026-10-30T19:30:00-05:00
- **Completed:** 2026-10-30T19:47:00-05:00
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `openMenu` in `OrderStatusMenu.tsx` now calls the existing `refetchOrder(order.id)` without awaiting it. Every open path (click, Enter, Space, ArrowDown, ArrowUp) goes through `openMenu`, so each sends one read. The menu opens at once on the held figures and re-renders from the page's answer when it lands. The head comment says so (D-96).
- Mark Completed follows the answer in both directions: a balance of 0.00 with no credit enables it and removes the reason line, and a new balance owed makes it aria-disabled with the reason line. The focused item keeps focus while the answer lands.
- A failed open read leaves the menu open and working on the held figures with no toast. The server's 422 refusal is still the gate.

## Task Commits

1. **Task 1: Opening Change Status reads the order, so a payment from another session enables Mark Completed**
   - RED: `9078d462` (test) 6 new tests fail on the planned assertions
   - GREEN: `10de9a0b` (feat)
2. **Task 2: Lock in the other direction, focus and a failed read** - `8458ad52` (test)

**Plan metadata:** the docs commits that follow this SUMMARY (complete plan, then state and roadmap).

## TDD Gate Compliance

- **RED:** Six tests in the `Mark Completed follows the current figures (D-96, WR-05)` block: five `reads the order once more when the menu opens with {a click, Enter, Space, ArrowDown, ArrowUp}` and `sends the move to completed once a payment from another session settled the balance`. Run on `9078d462` they failed for the planned reason: `AssertionError: expected [ Array(1) ] to have a length of 2 but got 1` (five times; no read happens on open) and `Unable to find role="menuitem" and name "Mark Completed"` (the item stays disabled). The other 38 tests in the file passed. Semantic assessment: the target tests ran and failed on the planned assertion, not on a setup, import or fixture fault. Evidence is from the Vitest console output; `gsd_run check tdd-red-evidence` was not run because the project reporter output is not the supported TAP form and no record file was built.
- **GREEN:** `10de9a0b`. All 44 tests in the file passed after the one-line change plus the update below.
- **REFACTOR:** none needed.

## Files Created/Modified

- `web/src/modules/admin/components/OrderStatusMenu.tsx` - the read on open in `openMenu`, plus one head-comment sentence.
- `web/src/modules/admin/components/OrderStatusMenu.test.tsx` - the D-96 tests (five openers, move to completed after a settling payment, the reverse direction with focus held, a failed read, axe after the answer), the `inTurn` helper, and two figure fixtures (`owedBalance` 360.00, `settledBalance` 0.00).

## Decisions Made

- Followed D-96 as ruled; no other approach was considered. The read is not awaited so the menu never waits on the network.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test follows the new rule] Refusal test counted the old single read**
- **Found during:** Task 1 (GREEN run)
- **Issue:** `shows a refusal as a danger toast with the server text and reads the order again (UIC-24)` waited for exactly one read after opening the menu. Opening now reads once more, so the count is 2, and the later "reads again" check needs more than 2.
- **Fix:** The test expects 2 reads after opening and more than 2 after the refusal. The behavior it checks (a 422 reads the order again) is unchanged.
- **Files modified:** `web/src/modules/admin/components/OrderStatusMenu.test.tsx`
- **Verification:** the file passes (47 tests), twice in a row
- **Committed in:** `10de9a0b`

**2. [Rule 3 - Blocking] Lint rejected the first test helper**
- **Found during:** Task 1 (RED)
- **Issue:** A helper named `useAnswersInTurn` that called `useOrderHandlers` and reassigned a counter failed `react-hooks/rules-of-hooks` and `react-hooks/immutability`.
- **Fix:** A plain `inTurn(first, later)` returns the detail handler, and each test calls `useOrderHandlers` itself as the other tests do.
- **Files modified:** `web/src/modules/admin/components/OrderStatusMenu.test.tsx`
- **Committed in:** `9078d462`

---

**Total deviations:** 2 auto-fixed (1 Rule 1, 1 Rule 3)
**Impact on plan:** None on scope. Task 2's tests passed on their first run, as the plan expected, so Task 1 needed no further fix.

## Verification Results

- `npm --prefix web run test -- --run OrderStatusMenu.test.tsx OrderPage.test.tsx`: 2 files, 120 tests passed (run twice, no flake).
- Also run: `Phase8Demos.test.tsx` and `DeletedOrderPage.test.tsx` (36 passed), `no-long-dash` and `source-layout` node tests (8 passed).
- `npm --prefix web run typecheck`: clean. `npm --prefix web run lint` (`--max-warnings 0`): clean. `npm --prefix web run format:check`: clean.
- `grep -c "refetchOrder(order.id)" web/src/modules/admin/components/OrderStatusMenu.tsx` is 2 (the one in `showFailure` and the new one).
- gitleaks on each staged change: no leaks found.

## Issues Encountered

None.

## Known Stubs

None.

## Threat Flags

None. T-08-51 is mitigated as planned: the order is read on every open, and the server's 422 `orders.complete-balance-owed` still refuses a completion while money is owed. No package was added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 08-29 runs the two-staff e2e for this rule (D3 above). IN-08 and WR-03 are left as built (D-97).

## Self-Check: PASSED

- Files exist: `OrderStatusMenu.tsx`, `OrderStatusMenu.test.tsx`.
- Commits `9078d462`, `10de9a0b`, `8458ad52` are on `gsd/phase-08-order-screens`.

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*
