---
phase: 08-order-screens
plan: 26
subsystem: orders
tags: [orders, payments, web, gap-closure, G-08-5, D-95, WR-02]
created: "2026-10-30T19:30:09-05:00"
updated: "2026-10-30T19:30:09-05:00"
status: complete

requires:
  - phase: 08-order-screens
    provides: "08-16: the payment window and the Payments tab actions; 08-14: useOrderChildSave and the 409 / Load Latest path"
provides:
  - "useOrderWindowFigures, useReadOrderNow and freshCapResolver in hooks/useOrderWindowFigures.ts (08-28 reuses them unchanged for the refund and discount windows)"
  - "isOverPaymentCap in orderPaymentSchemas.ts"
  - "A payment window whose cap and Balance due hint follow the current order, and that reads the order once before it refuses an amount"
  - "A payment delete check that reads the order once more before it shows the below-refunds sentence"
affects: [08-28-refund-discount-windows, 08-29-e2e, phase-8-verification]

actuals:
  tokens: 7100
  tasks: 3
  commits: 6
plan_head_before: 6a4748b06cc58a6407925682eec958d1b28a7200
plan_head_after: ebcf7c49e08f7d28c3625ac87d1d906e81f17fca

tech-stack:
  added: []
  patterns:
    - "A window keeps the version it opened with; only the figures behind its caps follow the page cache (05 D-20, Pitfall 10)"
    - "A cap failure reads the order once through queryClient.query with a one second staleTime, so a blur and the Save after it share one request"
    - "The window's own useQuery observer sets refetchOnWindowFocus 'always'; the page keeps the shared default"

key-files:
  created:
    - web/src/modules/admin/hooks/useOrderWindowFigures.ts
    - web/src/modules/admin/hooks/useOrderWindowFigures.test.tsx
  modified:
    - web/src/modules/admin/orderPaymentSchemas.ts
    - web/src/modules/admin/orderPaymentSchemas.test.ts
    - web/src/modules/admin/components/OrderPaymentModal.tsx
    - web/src/modules/admin/components/OrderPaymentModal.test.tsx
    - web/src/modules/admin/components/OrderPaymentsTab.tsx
    - web/src/modules/admin/components/OrderPaymentsTab.test.tsx

key-decisions:
  - "D-95 applied as ruled: the instant cap check stays; a focus or a failed cap check reads the order again and the check runs on the current figures; the save keeps the opened version"
  - "WR-02's fourth gate (delete would leave payments below refunds) gets the same refresh-then-check-again rule, as the plan stated"
  - "queryClient.query replaces the deprecated fetchQuery named in the plan (same stale-by-time behaviour, no lint error)"

requirements-completed: [ORD-07]

coverage:
  - id: P1
    description: "Add Payment reads the order once when the held figures refuse the amount, then sends an amount the current figures allow, still with the opened version; 409 and Load Latest still come from the server"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentModal.test.tsx#add mode reads the order again when the held figures refuse the amount (D-95)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/orderPaymentSchemas.test.ts#isOverPaymentCap"
        status: pass
    human_judgment: false
  - id: P2
    description: "An open payment window reads the order on focus and shows the current Balance due; an edit takes its cap from the current copy of the payment, else the opened figures"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentModal.test.tsx#add mode follows the order while it is open (D-95)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrderWindowFigures.test.tsx"
        status: pass
    human_judgment: false
  - id: P3
    description: "Deleting a payment refused by the held figures reads the order once more and goes ahead when the current figures allow it; a failed read or the same figures keep the sentence; a gone payment sends the DELETE"
    requirement: "ORD-07"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrderPaymentsTab.test.tsx#reads the order once more before it refuses (D-95)"
        status: pass
    human_judgment: false
  - id: P4
    description: "Two staff members at once: one removes a payment while the other has the window open (real browser, real server)"
    requirement: "ORD-07"
    human_judgment: true
    rationale: "The two-staff end-to-end proof is planned for 08-29; this plan ran no e2e"

duration: 25min
completed: 2026-10-30
---

# Phase 8 Plan 26: The payment window checks its cap against current figures (D-95, WR-02) Summary

**The payment window and the payment delete check keep their instant check but read the order again on focus and on a failed check, then check against the current figures, while a save still sends the version the window opened with.**

## Performance

- **Duration:** about 25 min
- **Tasks:** 3 (1 tracer, 2 auto), each TDD red then green
- **Files changed:** 8 (2 created, 6 modified), all web
- **Commits:** 6 (measured from `plan_head_before`)

## Accomplishments

- `hooks/useOrderWindowFigures.ts` holds the shared pieces 08-28 will reuse: `useReadOrderNow` (one read through `queryClient.query` with a one second `staleTime`, shared in flight, null on failure), `useOrderWindowFigures` (a `useQuery` observer on the page's own `orderKey`, with `current`, `latest()` and `refresh()`) and `freshCapResolver` (check on the latest figures, and on a cap failure read once and check again).
- `isOverPaymentCap(amountText, maxAmount)` is true only for an amount that passes every other rule and is above the cap, so a fresh read is only spent where it can help.
- `OrderPaymentModal` takes its cap and the "Balance due" hint from the current figures. An amount the old figures refused is sent after one read; an amount still above the current cap is refused in the server's words naming the current figure. The body `version` is still `opened.order.version` (one place in the file), so another person's change answers 409 with Load Latest.
- The window's observer sets `refetchOnWindowFocus: 'always'`, so a focus reads the order even while the page's 30 second staleTime says the data is fresh. "Balance due" updates without moving focus.
- In edit mode the cap is the current order's balance plus that order's copy of the payment (found by id). When the current order no longer holds the payment, the opened order and payment stand and a save answers 404 with the removed banner, as before.
- `OrderPaymentsTab.confirmDelete` is now async. When the held figures say the delete would leave payments below refunds, it reads the order, finds the payment in it, and throws the existing `PaymentBelowRefundsError` only if the read failed or the fresh figures still refuse. A payment missing from the fresh order sends the DELETE and lets the server's 404 explain.
- No new copy, no packages, no clock read (the boundary guard passes). The window's `today` stays `opened.order.today` (D-97).

## Task Commits

1. Task 1 RED: `e6e61dd8` test(08-26): add failing tests for the payment window's fresh cap check
2. Task 1 GREEN (tracer): `e62b9623` feat(08-26): the payment window reads the order again before it refuses an amount
3. Task 2 RED: `3dcafe17` test(08-26): add failing tests for the payment window following the order
4. Task 2 GREEN: `710ac533` feat(08-26): the payment window's figures follow the order on focus and on edit
5. Task 3 RED: `169c04e0` test(08-26): add failing tests for the payment delete reading the order once more
6. Task 3 GREEN: `ebcf7c49` feat(08-26): deleting a payment reads the order once more before refusing

## TDD Gate Compliance

Each task has a `test(08-26)` commit before its `feat(08-26)` commit. No REFACTOR commit was needed. The RED evidence was judged from the Vitest console output; `gsd_run check tdd-red-evidence` was not run because the runs were not captured in a supported report format (TAP or JUnit).

- **RED (task 1):** 9 tests failed, 52 passed. Six modal tests failed on the planned assertions (no read was sent, so the 10,000.00 payment was refused; the message and Load Latest never came). Three `isOverPaymentCap` tests failed with `TypeError: isOverPaymentCap is not a function` because the export did not exist yet. Semantic assessment: valid; the target tests ran and failed for the planned reason, and the one passing new test ("no read for an amount the held figures allow") protects behaviour that must not change.
- **GREEN (task 1):** modal, schema and boundary tests 71/71.
- **RED (task 2):** 5 tests failed: the hook focus test (data stayed the old order, `expected {…} to deeply equal {…}`), two modal focus tests and two edit tests (`Unable to find an element with the text: Balance due: ₱11,327.50` / `₱11,000.00`). The hook's other tests and the `freshCapResolver` unit tests passed on purpose, since that code came from Task 1. Semantic assessment: valid.
- **GREEN (task 2):** hook, modal and boundary tests 60/60.
- **RED (task 3):** 4 of the 5 new delete tests failed (no read was sent, so the DELETE never went out, the 404 line never showed, `expected [] to deeply equal [ Array(1) ]`). The fifth ("no read when the held figures allow the delete") passed on purpose. Semantic assessment: valid.
- **GREEN (task 3):** `OrderPaymentsTab.test.tsx` 24/24.

## Verification Evidence

- Plan tests: `OrderPaymentModal.test.tsx`, `orderPaymentSchemas.test.ts`, `useOrderWindowFigures.test.tsx`, `OrderPaymentsTab.test.tsx` and `orders-boundaries.node.test.ts`: 5 files, 109 tests passed, no warnings or `act` messages in the output.
- Full web suite (`vitest --run`, after the preflight showed all ports free): 269 files, 7531 tests passed.
- `npm --prefix web run typecheck`: clean. `npm --prefix web run lint` (`--max-warnings 0`): clean. `npm --prefix web run format:check`: "All matched files use Prettier code style!".
- Acceptance greps: `export function freshCapResolver`, `useReadOrderNow`, `useOrderWindowFigures` and `isOverPaymentCap` each 1; `version: opened.order.version` 1; `refetchOnWindowFocus: 'always'` 1; `useReadOrderNow` in the Payments tab 2 (import and use); `focusManager` in the hook test 4; a modal test asserts the POST body `version` equals `ORDER_VERSION` after a read (and after a focus read).
- gitleaks on each staged change: no leaks found. No em or en dash in the changed source. No e2e was run (08-29 runs them).

## Deviations from Plan

**1. [Rule 3 - Blocker] `fetchQuery` is deprecated in the pinned TanStack Query**
- **Found during:** Task 1 GREEN (lint)
- **Issue:** the plan named `fetchQuery`; `@typescript-eslint/no-deprecated` fails lint on it ("Use queryClient.query(options) instead").
- **Fix:** `useReadOrderNow` calls `queryClient.query({ queryKey, queryFn, staleTime: 1000, retry: false })`. Its source is the same stale-by-time check and fetch, so the one second sharing and in-flight sharing behave as planned. No package change.
- **Files modified:** `web/src/modules/admin/hooks/useOrderWindowFigures.ts`
- **Commit:** `e62b9623`

**2. [Test correction] A failed read is not shared**
- **Found during:** Task 1 GREEN
- **Issue:** my RED test "keeps the held figures in the words when the read fails" asserted exactly one read. The blur and the Save each try once, because only a successful read counts as current for a second.
- **Fix:** the test asserts at least one read and no write. This is also the better behaviour: a failed read is tried again on the next check. The edit is in the Task 1 GREEN commit.
- **Commit:** `e62b9623`

**Total deviations:** 2 (1 Rule 3, 1 test correction). **Impact:** none on behaviour the plan asked for.

## Notes for the Owner

- WR-02 listed the "would leave payments below refunds" delete check alongside the caps, so D-95's refresh-then-check-again rule is applied to it too (Task 3), as the plan said.
- If nothing is held for the order (the window is rendered without the page's cache), the window's observer reads the order once on mount and shows the opened order until it answers. The order page always holds it, so this does not occur in the app.
- A failed read is retried on the next check (blur, then Save), so two failed checks in a row can send two reads; successful reads inside a second are shared.

## Notes for Later (08-28)

The refund and discount windows can take `useOrderWindowFigures(opened)` for their caps and wrap their zod resolver with `freshCapResolver`, with an `overCap` that matches their own cap rule. The interface is unchanged from the plan.

## Known Stubs

None.

## Threat Flags

None. No new route or trust boundary: the extra reads are the existing staff-only `GET /orders/{id}`. T-08-49 is mitigated: tests assert the POST `version` equals the opened `ORDER_VERSION` after a read and after a focus read, and a 409 still shows Load Latest. T-08-50 is mitigated: in-flight reads are shared, a successful read under a second old counts as current, and the extra reads happen only on focus and on a failed cap check. T-08-SC: no package added or bumped.

## Self-Check: PASSED

- Files exist: `useOrderWindowFigures.ts`, `useOrderWindowFigures.test.tsx`, `orderPaymentSchemas.ts`, `OrderPaymentModal.tsx`, `OrderPaymentsTab.tsx` (all present).
- Commits on this branch: e6e61dd8, e62b9623, 3dcafe17, 710ac533, 169c04e0, ebcf7c49.
