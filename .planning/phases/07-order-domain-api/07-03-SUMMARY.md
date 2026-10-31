---
phase: 07-order-domain-api
plan: 03
subsystem: domain
tags: [order-status, transition-rules, reopen, complete-gate, pesos, tdd]
status: complete
created: "2026-10-28T09:49:00-05:00"
updated: "2026-10-28T09:49:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: Result and Error.BusinessRule from Csps.Domain.Common (no dependency on plans 07-01 or 07-02)
provides:
  - "OrderStatus (byte): Pending 1, Mockup 2, InProduction 3, Ready 4, Delivered 5, Completed 6, Cancelled 7; no value 0"
  - "OrderStatusMove (NoChange, Move, Reopen)"
  - "OrderStatusRules.Check(from, to, balance) returning Result<OrderStatusMove>, plus IsActive, IsLocked, ActiveStatuses and the public code and message constants"
  - "Pesos.Format(decimal) for every domain message that names an amount"
affects: [07-04, 07-05, 07-06, 07-13, 07-14]

actuals:
  tokens: 3800
  tasks: 2
  commits: 4
plan_head_before: 5f11decdd4dac1eec8ff1349ebbd099b65ba4101
plan_head_after: 2f82cbef6f8ae100b71412057276dbcdd3f81123

tech-stack:
  added: []
  patterns:
    - "A pure static rule class returns Result<T> with Error.BusinessRule; codes and message builders are public so the endpoint and docs reuse them"
    - "A 7x7 expected-outcome table written out in the test, expanded into a theory over every pair"

key-files:
  created:
    - src/Csps.Domain/Orders/OrderStatus.cs
    - src/Csps.Domain/Orders/OrderStatusRules.cs
    - src/Csps.Domain/Orders/Pesos.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs
    - tests/Csps.Domain.UnitTests/Orders/PesosTests.cs
  modified: []

key-decisions:
  - "Check order of rules: undefined value throws, then same status is NoChange, then a locked source (Completed or Cancelled) either reopens to an active status or is refused with orders.reopen-first, then the Completed balance gate. A reopen and the end-state swap never look at the balance."
  - "Pesos.Format is the peso sign plus N2 with the invariant culture. Messages pass it positive figures (the credit message negates the balance); it adds no minus handling."
  - "IsActive and IsLocked return false for an undefined number rather than throwing; only Check throws (T-07-07)."

requirements-completed: [ORD-17]

coverage:
  - id: D1
    description: "The seven statuses are stored with fixed numbers (Pending 1 to Cancelled 7)"
    requirement: ORD-17
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs#StoredStatusNumbersAreFixed"
        status: pass
    human_judgment: false
  - id: D2
    description: "An order is completed only with a balance of exactly 0.00; owed money and a customer credit are refused with the owner's two messages"
    requirement: ORD-17
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs#PendingCannotBeCompletedWhileMoneyIsOwed"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs#AnActiveOrderCannotBeCompletedWithACustomerCredit"
        status: pass
    human_judgment: false
  - id: D3
    description: "All 49 (from, to) pairs follow the owner's table: free moves among active statuses, cancel from any, reopen from an end state, the direct end-state swap refused, same status is NoChange"
    requirement: ORD-17
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs#EveryPairFollowsTheOwnersTable"
        status: pass
    human_judgment: false
  - id: D4
    description: "Only Completed and Cancelled are locked; an undefined status number throws"
    requirement: ORD-17
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs#OnlyCompletedAndCancelledAreLocked"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs#AnUndefinedStatusThrows"
        status: pass
    human_judgment: false

duration: 4min
completed: 2026-10-28
---

# Phase 7 Plan 03: Order Statuses and Transition Table Summary

**Seven fixed-number order statuses and the owner's transition rule as one pure, 100%-covered domain function (`OrderStatusRules.Check`), with a Completed gate on a zero balance and a reopen-first rule for the two end states.**

## Accomplishments

- `OrderStatus : byte` with the stored numbers from D-01 (Delivered is 5, Completed 6, Cancelled 7), never renumbered.
- `OrderStatusRules.Check(from, to, balance)` returns `NoChange`, `Move` or `Reopen`, or a 422 business-rule error:
  - `orders.complete-balance-owed`: "This order still has ₱{balance} to pay. Record the payment first."
  - `orders.complete-credit`: "This order has a customer credit of ₱{credit}. Record a refund first."
  - `orders.reopen-first`: "Reopen the order first, then cancel it." / "Reopen the order first, then mark it Completed."
- `IsActive`, `IsLocked` (true only for Completed and Cancelled) and the `ActiveStatuses` list.
- `Pesos.Format`: `₱9,327.50`, `₱1,000,000.00`.
- The test spells out the 7x7 outcome table and runs it as a theory over all 49 pairs, plus balance edge cases (0.01, -0.01), reopen and cancel ignoring the balance, and undefined values 0 and 8 on either side.

## Task Commits

| Task | Commit | Type |
| ---- | ------ | ---- |
| 1 RED | 651741c7 | test(07-03): completing needs a zero balance (RED) |
| 1 GREEN | de82ab8c | feat(07-03): order statuses and the completed rule (D-01, D-03) |
| 2 RED | bc2f3dfc | test(07-03): every status move (RED) |
| 2 GREEN | 2f82cbef | feat(07-03): the status transition table (D-02, D-04, D-38) |

RED evidence: task 1 and task 2 REDs failed to build (`OrderStatus`, `OrderStatusRules`, `OrderStatusMove` and later `IsActive` / `IsLocked` did not exist; CS0103 / CS0117).

## Verification

- `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderStatusRulesTests"`: 85 passed, 0 failed.
- Full `Csps.Domain.UnitTests`: 897 passed, 0 failed. The build treats warnings as errors and passed.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (1305/1305), branch 100% (510/510), PASS; Csps.Application line 98.3%, PASS. "Coverage gate passed."
- Tracer gate (task 1): auto mode off, end-of-phase human verify, automated-only verify, so the verify command was re-run after GREEN and passed before the table work started.
- Acceptance greps: `Delivered = 5,` 1; `orders.complete-balance-owed` 1; both reopen-first messages 1 each; theory attributes in the test file: 35.
- gitleaks (pre-commit hook): no leaks on all four commits.

## Deviations from Plan

None. The plan executed as written.

## Known Stubs

None.

## Threat Flags

None. No new network, auth or storage surface. T-07-06 is mitigated by the Completed gate and the 49-pair table; T-07-07 by the throw on undefined values (the `CK_Orders_Status` check constraint lands in plan 07-05).

## Notes for later plans

- The endpoint in plan 07-13 should pass the current computed balance to `Check` and map `Reopen` to the history and audit entry (D-04, D-06).
- Role check for reopen (both Admin and Manager) is not in this rule by design; it only sees the status pair and the balance.

## Self-Check: PASSED

- FOUND: src/Csps.Domain/Orders/OrderStatus.cs, OrderStatusRules.cs, Pesos.cs; tests OrderStatusRulesTests.cs, PesosTests.cs
- FOUND commits: 651741c7, de82ab8c, bc2f3dfc, 2f82cbef
