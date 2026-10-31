---
phase: 07-order-domain-api
plan: 13
subsystem: api
tags: [orders, order-status, status-history, end-state-lock, reopen, cancelled-money, race, audit, openapi]
created: "2026-10-28T16:05:00-05:00"
updated: "2026-10-28T16:05:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-03 OrderStatusRules (the owner's table), 07-05 Order aggregate, OrderStatusChange history, OrderStatusNames, the detail response with statusHistory, 07-09 OrderChildWrite and IOrders.LockAsync, 07-11 the row-version re-read in OrderStore.FindAsync, 07-07 to 07-12 every details, item, discount, payment and expense mutator"
provides:
  - "POST /api/v1/orders/{id}/status (Staff, Idempotency-Key, { status }, no version): 200 the whole order; 400 on status; 404 orders.not-found; 409 edit.stale after two lost races; 422 orders.complete-balance-owed, orders.complete-credit, orders.reopen-first"
  - "Order.ChangeStatus(to, callerId, now): applies OrderStatusRules.Check on the current balance, adds the history row, sets Status and StatusChangedAtUtc, recalculates (a cancelled order keeps its cash and costs, D-36), touches the edit version; a same-status request assigns nothing"
  - "The D-05 end-state lock: a private Order.EnsureEditable at the top of all 13 mutators (UpdateDetails; Add, Update, Remove for item, discount, payment and expense) answers 422 orders.locked 'This order is completed. Reopen it to make changes.' (or 'cancelled') and changes nothing"
  - "OrderRules.LockedCode and OrderRules.Locked(status); ChangeOrderStatusRequest(+Validator), ChangeOrderStatusHandler (ConflictRetry over OrderChildWrite.AttemptAsync); OrderAuditDetail.StatusChanged(from, to)"
  - "order.status-changed (status=from>to) for a move and order.reopened for a reopen, in the same save as the history row; a no-op or a refusal writes nothing"
  - "Statuses section in docs/api/orders.md (seven keys and labels, the transition table, the lock, cancelled money D-07, D-10, D-36); refreshed OpenAPI contract and generated types"
  - "OrderFixtures.StatusBody, ChangeStatusAsync, ChangeStatusAndReadAsync, Ord0148PaidInFullAsync"
affects: [07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 20900
  tasks: 3
  commits: 6
plan_head_before: 054681f45dc5891418d2f18a08d18b91e323a683
plan_head_after: b54856aeeb9921c8caa7ebada2fc7c05f67618e0

tech-stack:
  added: []
  patterns:
    - "A single-click POST over OrderChildWrite.AttemptAsync with version null and ConflictRetry, the same flow as the remove handlers: the rule is judged on the latest state inside the save"
    - "The aggregate guards itself: one private EnsureEditable at the top of every mutator, so no caller can skip the end-state lock"

key-files:
  created:
    - src/Csps.Application/Orders/ChangeOrderStatusRequest.cs
    - src/Csps.Application/Orders/ChangeOrderStatusRequestValidator.cs
    - src/Csps.Application/Orders/ChangeOrderStatusHandler.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderStatusTests.cs
    - tests/Csps.Application.UnitTests/Orders/ChangeOrderStatusHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderStatusEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderLockTests.cs
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Domain/Orders/OrderRules.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Server/Controllers/OrdersController.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md

key-decisions:
  - "The lock lives in the aggregate (EnsureEditable in each mutator), not in OrderChildWrite. Each mutator then refuses by itself, and the lock runs before the order's own rules (payment balance, last item, discount cap, missing child id). A form with a field error, or a bad category or payer on an add, is still 400 first because those checks run in the handler before the order is loaded."
  - "The status move is single-click: no version, ConflictRetry over OrderChildWrite.AttemptAsync, judged on the balance read inside the save. A lost race is read again once; a second lost race is edit.stale."
  - "A status key is read ignoring case and surrounding spaces (the existing OrderStatusNames.TryParse); anything else is 400 on status, 'Choose a status.'"
  - "The audit entry is written by the handler in Task 1 (OrderChildWrite saves nothing without an audit entry), so the Task 3 audit tests are regression proof, with the teeth shown by the one-run breaks below."

patterns-established:
  - "Pattern: every future order mutator (refunds in 07-14) starts with EnsureEditable, except the refund writes on a Cancelled order, which the plan leaves as the one exception"

requirements-completed: [ORD-17]

coverage:
  - id: S1
    description: "A staff member moves a pending order to mockup; the answer and a later read show status mockup, statusChangedAt set, and a history of {null to pending} then {pending to mockup, changedBy the mover}"
    requirement: ORD-16
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderStatusEndpointTests.cs#AnAdminMovesAPendingOrderToMockupAndTheMoveShowsInTheHistoryAndOnARead"
        status: pass
    human_judgment: false
  - id: S2
    description: "Any key that is not one of the seven, an empty body, anonymous and an unknown order answer 400 on status ('Choose a status.'), 401 and 404 orders.not-found; nothing changes on a 400"
    requirement: ORD-17
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderStatusEndpointTests.cs#AStatusThatIsNotOneOfTheSevenKeysIs400OnStatusAndNothingChanges"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs (POST /api/v1/orders/{id:guid}/status: 401, 400, 400)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/ChangeOrderStatusHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: S3
    description: "Completed needs exactly 0.00: owed money gives orders.complete-balance-owed naming 9,327.50, a credit gives orders.complete-credit, a zero balance completes; Completed to Cancelled and back give orders.reopen-first; a Manager and an Admin can each reopen to an active status"
    requirement: ORD-17
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderStatusEndpointTests.cs#CompletingWhileMoneyIsOwedIs422NamingTheBalanceAndChangesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderStatusEndpointTests.cs#GoingStraightBetweenCompletedAndCancelledIs422ReopenFirstBothWays"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderStatusEndpointTests.cs#APaidInFullOrderCanBeCompletedAndEitherRoleCanReopenIt"
        status: pass
    human_judgment: false
  - id: S4
    description: "D-05: on a Completed and on a Cancelled order every details PUT and every item, discount, payment and expense POST, PUT and DELETE answers 422 orders.locked with the status in the message and the stored order is byte for byte unchanged; after a reopen the writes succeed"
    requirement: ORD-17
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderLockTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusTests.cs#EveryChangeToAnOrderInAnEndStateIsRefusedWithTheLockedErrorAndChangesNothing"
        status: pass
    human_judgment: false
  - id: S5
    description: "D-07 / D-10 / D-36: cancelling ORD-2026-0148 keeps paid 12,000.00, refunded 0.00 and expenses 6,065.00 and reads profit 5,935.00; reopening restores 15,262.50 and the balance 9,327.50"
    requirement: ORD-18
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusTests.cs#CancellingOrd0148KeepsTheCashAndTheCostsAndReopeningRestoresTheProfit"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderStatusEndpointTests.cs#CancellingOrd0148KeepsTheCashAndCostsAndReopeningRestoresTheProfit"
        status: pass
    human_judgment: false
  - id: S6
    description: "D-06 / ORD-16: every real move and reopen adds one history row; a same-status request answers 200, writes nothing and keeps the version"
    requirement: ORD-16
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusTests.cs#EveryMoveAmongTheActiveStatusesAddsOneHistoryRowInOrder"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderStatusEndpointTests.cs#ASameStatusRequestAnswers200ChangesNothingAndKeepsTheVersion"
        status: pass
    human_judgment: false
  - id: S7
    description: "D-31: a move writes one order.status-changed (status=from>to), a reopen one order.reopened and no status-changed, a no-op or a refusal nothing, and the same Idempotency-Key and body twice give one history row and one entry"
    requirement: ORD-17
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderStatusEndpointTests.cs#AMoveWritesOneStatusChangedEntryAReopenWritesOneReopenedEntryAndANoOpWritesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderStatusEndpointTests.cs#TheSameIdempotencyKeyAndBodyTwiceGivesOneHistoryRowAndOneEntry"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs"
        status: pass
    human_judgment: false
  - id: S8
    description: "Single-click semantics (T-07-35): over 10 rounds a Complete racing a 100.00 discount on a fully paid order never leaves a Completed order with a non-zero balance; each round ends Completed with balance 0.00, or pending with a 100.00 credit and the Complete refused 422 orders.complete-credit"
    requirement: ORD-17
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs#ACompleteRacingAFixedDiscountNeverLeavesACompletedOrderWithAnUnsettledBalance"
        status: pass
    human_judgment: false
  - id: S9
    description: "The Statuses section of docs/api/orders.md and the lock sentence read clearly to a person"
    requirement: ORD-17
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's call; no test judges prose."

duration: 45 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 13: Order status, reopen and the end-state lock Summary

**Staff can move an order through the owner's seven statuses with `POST /api/v1/orders/{id}/status`: every move and reopen is recorded in the history and audited, Completed needs a balance of exactly 0.00, and a Completed or Cancelled order refuses every details, item, discount, payment and expense write (422 `orders.locked`) until it is reopened. A cancelled ORD-2026-0148 keeps its 12,000.00 cash and 6,065.00 costs and reads profit 5,935.00; reopening restores 15,262.50.**

## Performance

- **Duration:** about 45 min
- **Started:** about 2026-10-28T20:30Z
- **Completed:** 2026-10-28T21:05Z
- **Tasks:** 3 of 3
- **Files changed:** 21 files, 1,777 added lines (about 20,900 tokens of hand-written lines, chars/4, with the OpenAPI JSON and the generated types left out)

## Accomplishments

- Task 1 (tracer): `Order.ChangeStatus`, the status request, validator, handler (ConflictRetry over `OrderChildWrite.AttemptAsync`, no version), the POST route, the matrix row, the refreshed contract. A pending order moved to mockup shows both history rows on the answer and on a read.
- Task 2: `OrderRules.LockedCode` and `Locked(status)`, a private `EnsureEditable` at the top of all 13 mutators, the Statuses section in `docs/api/orders.md`, and tests for the Completed gate, reopen by both roles, reopen-first both ways, the cancelled-money figures, and every write route on a Completed and a Cancelled order.
- Task 3: the audit detail tests, the audit and idempotent replay endpoint tests, and the 10-round Complete-versus-discount race.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | 0b56c490 `test(07-13): move an order between statuses (RED)` | 70b7bf42 `feat(07-13): change an order's status with history (ORD-16, ORD-17)` |
| 2 | 231fccf0 `test(07-13): completed rule, reopen and the end-state lock (RED)` | c0a89cb9 `feat(07-13): completed rule, reopen and the end-state lock (D-03, D-04, D-05, D-38)` |
| 3 | b54856ae `test(07-13): audited status changes, safe against credit races (D-31)` | none (no production code changed; see below) |

- **Task 1 RED:** 4 of 4 endpoint tests failed (the route did not exist: 404 where 200, 401 and `orders.not-found` were expected). Valid assertion failures. `gsd_run check tdd-red-evidence` was not run (this runner's output is none of TAP, JUnit or Surefire); the output was read by hand.
- **Task 2 RED:** the Domain test project did not build (`OrderRules.Locked` and `LockedCode` missing: a compile-time RED). At runtime 4 of 5 `OrderLockTests` cases failed (the writes succeeded where 422 was expected). The Application handler cases (19) and the other 9 status endpoint cases passed at once, because `OrderStatusRules` (07-03) and the Task 1 handler already carried the table; they are regression and coverage proof, as the plan lists them.
- **Task 3:** the audit code arrived with the handler in Task 1 (`OrderChildWrite` saves nothing without an audit entry), so the audit tests and the race passed the first time. Teeth were shown with two one-run breaks, restored before the commit: passing `0m` instead of `Balance` to `OrderStatusRules.Check` failed the race test (1 of 8 concurrency cases) and 3 of 13 status endpoint cases; swapping the reopen action to `order.status-changed` failed the audit case. The Task 3 commit is therefore a `test` commit with no `feat` pair.
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with automated-only `<verify>`, so the verify commands were re-run after GREEN (`OrderStatusEndpointTests` 4 passed, `*Idempotency*` 54, `*Authorization*` 297) before expansion. Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- Preflight before the integration runs: ports 5180, 5115, 7028, 5199 all free, no dev or test processes.
- `Csps.Domain.UnitTests`: 1118 passed. `Csps.Application.UnitTests`: 1615 passed. `Csps.ArchitectureTests`: 241 passed.
- `Csps.Server.IntegrationTests` (full run): 1562 total, 1562 passed, 0 failed, 0 skipped. The known slow-machine `ExpenseListTimingTests` passed in this run (owner ruling D-76 stands).
- `Csps.Infrastructure.IntegrationTests` (full run): 661 total, 660 passed, 0 failed, 1 skipped (not touched by this plan; the same skip as in 07-09 to 07-12).
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (2160/2160), branch 100% (872/872); Csps.Application line 98.1% (5394/5498), branch 94.6% (not gated). "Coverage gate passed."
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The snapshot was refreshed once with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command only.
- Acceptance criteria: `ChangeOrderStatus` in `OrdersController.cs` 1 (at least 1); `/status` in `AuthorizationMatrix.cs` 2 (at least 1; the comment and the row); `EnsureEditable` in `Order.cs` 15 (at least 15: 13 mutators, the definition and the class summary); `Reopen it to make changes.` in `OrderRules.cs` 1 (at least 1); `D-36` in `docs/api/orders.md` 2 (at least 1); `OrderReopened` and `OrderStatusChanged` in `ChangeOrderStatusHandler.cs` 1 each (exactly 1).
- gitleaks on each staged change: no leaks. Only fake values appear. No em or en dash in any changed file. No SQL string, trigger, package, migration or JSON column was added.

## Task Commits

1. **Task 1: tracer, move Pending to Mockup** - RED `0b56c490` (test), GREEN `70b7bf42` (feat)
2. **Task 2: Completed rule, reopen, the lock** - RED `231fccf0` (test), GREEN `c0a89cb9` (feat)
3. **Task 3: audit and the race** - tests `b54856ae` (test)

The measured commit count is 6 because the orchestrator's `94da71ed docs(07): record owner ruling D-42 ...` landed between my RED and GREEN of Task 1; it is not part of this plan's work.

## Decisions Made

See key-decisions above. The one the owner should know about is where the lock sits: in the order itself, so it also runs before the order's own business rules.

## Deviations from Plan

### Auto-fixed Issues

None. No bug was found in earlier code.

### Plan notes (no behaviour change beyond what the plan states)

- **Audit code arrived in Task 1, not Task 3.** `OrderChildWrite` saves nothing when the change returns no audit entry, so the handler recorded `order.status-changed` and `order.reopened` from the start; `OrderAuditDetail.StatusChanged` was added with it. Task 3 added the tests (see the teeth above).
- **Task 2 RED was partly green.** The handler and the endpoint table cases passed at once because 07-03 and Task 1 already carried the rules. Only the lock cases were new red.
- **Files beyond the plan's list:** `OrderFixtures.cs` also gained `Ord0148PaidInFullAsync` (used by the status endpoint tests and the race), and `docs/api/orders.md` got a routes-table row, a sentence about `orders.locked` under the table, and a corrected "In plain words" point 5 (it still said expenses join the create body later).
- **`EnsureEditable` count.** The acceptance criterion asks for at least 15 lines; the 13 mutators plus the definition make 14, so the class summary also names it (15).
- **Lock before the order's own rules.** An add, edit or remove on a locked order answers 422 `orders.locked` even for an id the order does not have, or for a payment above the balance. This is the plan's "every write" wording. A form that fails its field rules is still 400 first, because the validator runs before the order is loaded.
- **A lone Theory became a Fact** in `ChangeOrderStatusHandlerTests`; no behaviour change.

**Total deviations:** 0 auto-fixed, 0 additions beyond the files above, 6 plan notes. **Impact:** none on scope.

## Issues Encountered

- A first attempt to apply a multi-line edit through a shell here-document failed on a quoting error before anything ran; the edit was redone with the Edit tool. No file was affected.
- `ProblemDetails.detail` carries the plain-English message, so the endpoint tests read `detail` for the exact sentences.

## Deferred Issues

- **For the owner: wording.** No new user-facing sentence was written beyond the plan: "Choose a status." (existing), "This order is completed. Reopen it to make changes." and the "cancelled" twin are the plan's, and the Completed and reopen-first sentences are 07-03's.
- **Refunds (07-14) and the lock.** `EnsureEditable` refuses every mutator that exists today. Plan 07-14 must let refund writes through on a Cancelled order, as the plan and ORD-18 say; that is the one exception and needs no owner decision.
- **Phase 8 follow-up (unchanged from 07-02):** golden vectors v3 when the web preview learns refunds.
- The `ExpenseListTimingTests` machine-speed failure in `deferred-items.md` did not fail in this plan's full run; owner ruling D-76 stands.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-07-35 (completing an order that still owes or holds money) is mitigated by `OrderStatusRules` on the latest state inside `ConflictRetry` and the 10-round race test, which failed when the balance check was disabled. T-07-36 (changing a closed order without a recorded reopen) is mitigated by `EnsureEditable` in every mutator and `OrderLockTests` over every write route. T-07-37 (moves with no trail) is mitigated by the history row and audit entry in the same save and the idempotent replay test. No package was added.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 07-14 (refunds). Open point for it: a refund write must go through on a Cancelled order, so it should not call `EnsureEditable` for that case; every other mutator keeps the lock. A refund also changes the balance, so the Completed gate (`balance == 0.00`) and the cancelled profit rule `(paid - refunded) - expenses` (D-36) both read the refunds list that `Order.Figures` still passes as empty today.

## Self-Check: PASSED

All 10 spot-checked key files (the three new application files, the four new test classes, `Order.cs`, `OrderRules.cs`, `docs/api/orders.md`) exist on disk, and all five task commits (0b56c490, 70b7bf42, 231fccf0, c0a89cb9, b54856ae) are ancestors of HEAD. The acceptance criteria above were re-run after the last commit.
