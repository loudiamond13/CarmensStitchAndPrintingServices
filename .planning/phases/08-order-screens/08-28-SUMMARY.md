---
phase: 08-order-screens
plan: 28
subsystem: orders
tags: [orders, refunds, discounts, web, gap-closure, G-08-5, D-95, WR-02]
created: "2026-10-30T20:02:00-05:00"
updated: "2026-10-30T20:02:00-05:00"
status: complete

requires:
  - phase: 08-order-screens
    provides: "08-25: the discount response carries the server Amount; 08-26: useOrderWindowFigures, useReadOrderNow and freshCapResolver"
provides:
  - "isOverRefundCap in orderRefundSchemas.ts"
  - "isAboveItemsTotal in orderDiscountSchemas.ts"
  - "A refund window whose cap, cap kind and helper follow the current order, and that reads the order once before it refuses an amount"
  - "A discount window whose items total, other discounts and Computed amount follow the current order, and that reads the order once before it refuses a value"
affects: [08-29-e2e, phase-8-verification]

actuals:
  tokens: 9800
  tasks: 2
  commits: 4
plan_head_before: b9a0a4366a80b402e26eecb79be701cb3fa3c702
plan_head_after: 75570115af64dd24af05b9bf2d05c40f976f4b38

tech-stack:
  added: []
  patterns:
    - "A window keeps the version it opened with; only the figures behind its caps follow the page cache (05 D-20, Pitfall 10)"
    - "Each window builds its cap from one `capFor(current)` function, used for the resolver, the over-cap test and the on-screen hint"

key-files:
  created: []
  modified:
    - web/src/modules/admin/orderRefundSchemas.ts
    - web/src/modules/admin/orderRefundSchemas.test.ts
    - web/src/modules/admin/components/OrderRefundModal.tsx
    - web/src/modules/admin/components/OrderRefundModal.test.tsx
    - web/src/modules/admin/orderDiscountSchemas.ts
    - web/src/modules/admin/orderDiscountSchemas.test.ts
    - web/src/modules/admin/components/OrderDiscountModal.tsx
    - web/src/modules/admin/components/OrderDiscountModal.test.tsx

key-decisions:
  - "D-95 applied to the refund and discount windows as ruled: the instant cap check stays; a focus or a failed cap check reads the order again and the check runs on the current figures; the save keeps the opened version"
  - "08-26's hook file was used unchanged, as the plan required"

requirements-completed: [ORD-07]

coverage:
  - id: R1
    description: "Add Refund reads the order once when the held credit refuses the amount, then sends an amount the current credit allows, still with the opened version; 409 and Load Latest still come from the server"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderRefundModal.test.tsx#add mode reads the order again when the held figures refuse the amount (D-95)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/orderRefundSchemas.test.ts#isOverRefundCap"
        status: pass
    human_judgment: false
  - id: R2
    description: "An open refund window reads the order on focus and shows the current cap; the cap kind follows the current status; an edit takes its cap from the current copy of the refund, else the opened figures; the Record Refund prefill stays"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderRefundModal.test.tsx#add mode follows the order while it is open (D-95)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderRefundModal.test.tsx#edit mode opening"
        status: pass
    human_judgment: false
  - id: D1
    description: "Add Discount reads the order once when the held items total refuses the value, then sends a value the current room allows, still with the opened version; a value still above the room is refused in the server's words"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderDiscountModal.test.tsx#add mode reads the order again when the held figures refuse the value (D-95)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/orderDiscountSchemas.test.ts#isAboveItemsTotal"
        status: pass
    human_judgment: false
  - id: D2
    description: "An open discount window moves the Computed amount to the current items total on focus; an edit leaves the edited discount out of the current other discounts by id, else the opened figures stand"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderDiscountModal.test.tsx#add mode follows the order while it is open (D-95)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrderDiscountModal.test.tsx#edit mode follows the order (D-95)"
        status: pass
    human_judgment: false
  - id: E1
    description: "Two staff members at once: one changes the order while the other has the refund or discount window open (real browser, real server)"
    requirement: "ORD-07"
    human_judgment: true
    rationale: "The two-staff end-to-end proof is planned for 08-29; this plan ran no e2e"

duration: 20min
completed: 2026-10-30
---

# Phase 8 Plan 28: The refund and discount windows check against current figures (D-95, WR-02) Summary

**The refund and discount windows keep their instant cap check but read the order again on focus and on a failed cap check, then check against the current figures, while a save still sends the version the window opened with.**

## Performance

- **Duration:** about 20 min
- **Tasks:** 2 (1 tracer, 1 auto), each TDD red then green
- **Files changed:** 8, all web, all in the plan's `files_modified`
- **Commits:** 4 (measured from `plan_head_before`)

## Accomplishments

- `isOverRefundCap(amountText, maxAmount)` is true only for a well-formed in-range amount above the cap, built from the existing `amountError` rule with no new copy.
- `OrderRefundModal` takes `figures = useOrderWindowFigures(opened.order)`. One `capFor(current)` gives the cap and its kind from a given order: a Cancelled order caps by paid minus refunded, any other by the customer credit. An edit adds that order's copy of the refund (found by id); when the current order no longer holds it, the opened order and refund stand and the save answers 404 with the removed banner. The resolver is `freshCapResolver` over `zodResolver(orderRefundSchema(opened.order.today, cap, kind))`. `onValid` still sends `opened.order.version` (one place in the file), so another person's change answers 409 with Load Latest. The Record Refund prefill is unchanged.
- `isAboveItemsTotal(kind, valueText, subtotal, otherDiscounts)` is true only when the value passes every other rule and the discounts would pass the items total. It reuses the existing `valueError`, which gained an optional `checkCap` flag (default true), so no rule or message was copied.
- `OrderDiscountModal` takes the subtotal, the other discounts and the Computed amount from `figures.current` through `capFor(current)`. `otherDiscountsTotal(basis, savedId)` leaves the edited discount out by id; when the current order no longer holds the edited discount, the opened order is the basis. The resolver is `freshCapResolver` over `zodResolver(orderDiscountSchema(...))`, with `overCap` from `isAboveItemsTotal`. `onValid` still sends `opened.order.version`; Load Latest and the Type-clears-Value rule are unchanged.
- Both head comments now say the version is the opened one and the figures are the current ones. No new copy, no packages, no clock read (the boundary guard passes), and `today` stays `opened.order.today` (D-97).

## Task Commits

1. Task 1 RED: `02ecb807` test(08-28): add failing tests for the refund window's fresh cap check
2. Task 1 GREEN (tracer): `0d2cff4b` feat(08-28): the refund window reads the order again before it refuses an amount
3. Task 2 RED: `18795d45` test(08-28): add failing tests for the discount window's fresh cap check
4. Task 2 GREEN: `75570115` feat(08-28): the discount window reads the order again before it refuses a value

## TDD Gate Compliance

Each task has a `test(08-28)` commit before its `feat(08-28)` commit. No REFACTOR commit was needed. The RED evidence was judged from the Vitest console output; `gsd_run check tdd-red-evidence` was not run because the runs were not captured in a supported report format (TAP or JUnit).

- **RED (task 1):** 12 failed, 45 passed. Nine modal tests failed on the planned assertions (no read was sent, so the credit-refused amount was refused; the focus read never moved the helper; the edit cap stayed on the opened figures). Three `isOverRefundCap` tests failed because the export did not exist. Semantic assessment: valid; the target tests ran and failed for the planned reason. Two new tests passed on purpose (no read for an amount the held credit allows; an edit whose refund is gone keeps the opened figures and answers 404) because they protect behavior that must not change.
- **GREEN (task 1):** refund modal, refund schema, Refunds tab and boundary tests 82/82.
- **RED (task 2):** 11 failed, 72 passed. Six modal tests failed on the planned assertions (no read, the Computed amount stayed on the old items total, the edit cap stayed on the opened figures). Four `isAboveItemsTotal` tests failed because the export did not exist. Semantic assessment: valid. The "opened figures when the discount is gone" test and the "no read for a value the held figures allow" test passed on purpose.
- **GREEN (task 2):** discount modal, discount schema, Discounts tab and boundary tests 115/115.

## Verification Evidence

- Task 1 plan tests (`OrderRefundModal.test.tsx`, `orderRefundSchemas.test.ts`, `OrderRefundsTab.test.tsx`, `orders-boundaries.node.test.ts`): 4 files, 82 tests passed.
- Task 2 plan tests (`OrderDiscountModal.test.tsx`, `orderDiscountSchemas.test.ts`, `OrderDiscountsTab.test.tsx`, `orders-boundaries.node.test.ts`): 4 files, 115 tests passed.
- Full web suite (`vitest --run`, after the preflight showed ports 5180, 5115, 7028 and 5199 free): 269 files, 7567 tests passed. No warnings or `act` messages in the output.
- `npm --prefix web run typecheck`: clean. `npm --prefix web run lint` (`--max-warnings 0`): clean. `npm --prefix web run format:check`: "All matched files use Prettier code style!".
- Acceptance greps: `export function isOverRefundCap` 1; `freshCapResolver` in the refund modal 2 (import and use); `version: opened.order.version` in the refund modal 1; `export function isAboveItemsTotal` 1; `freshCapResolver` in the discount modal 2; `version: opened.order.version` in the discount modal 1. `git log 02ecb807^..HEAD -- web/src/modules/admin/hooks/useOrderWindowFigures.ts` lists nothing: the hook file was not touched.
- Tests assert the POST body `version` equals `ORDER_VERSION` after a read and after a focus read in both windows, and a 409 still shows Load Latest.
- gitleaks on each staged change: no leaks found. No em or en dash in the changed source (the `no-long-dash` guard passes in the full suite). No e2e was run (08-29 runs them).

## Deviations from Plan

None - plan executed exactly as written. One note: `valueError` in `orderDiscountSchemas.ts` gained an optional `checkCap` parameter so `isAboveItemsTotal` can reuse the one value rule instead of copying it. It is inside the plan's file list and changes no existing behavior.

## Notes for the Owner

- A failed read is tried again on the next check (blur, then Save), as in the payment window; reads that succeed within one second are shared.
- `otherDiscountsTotal` still works out the other discounts' amounts in the browser, as built (08-25 left it alone); it now runs over the current order instead of the opened one.
- If nothing is held for the order (the window rendered without the page's cache), each window's observer reads the order once on mount and shows the opened figures until it answers. The order page always holds it, so this does not occur in the app.

## Known Stubs

None.

## Threat Flags

None. No new route or trust boundary: the extra reads are the existing staff-only `GET /orders/{id}`. T-08-52 is mitigated: a refresh changes only the figures behind the cap, hint and preview; tests assert the body `version` stays the opened one after a read and after a focus read, and a 409 still shows Load Latest; the server's own refund cap and items-total check still decide. T-08-SC: no package added or bumped.

## Self-Check: PASSED

- Files exist: `orderRefundSchemas.ts`, `OrderRefundModal.tsx`, `orderDiscountSchemas.ts`, `OrderDiscountModal.tsx` and the four test files (all modified, all present).
- Commits on this branch: 02ecb807, 0d2cff4b, 18795d45, 75570115.
