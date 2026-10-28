---
phase: 07-order-domain-api
plan: 14
subsystem: api
tags: [orders, refunds, customer-credit, cancelled-order, profit, lock-exception, race, audit, migration, openapi]
created: "2026-10-28T16:58:00-05:00"
updated: "2026-10-28T16:58:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-02 OrderMath refunds overload, 07-09 OrderChildWrite and IOrders.LockAsync, 07-11 the payment slice (entity, configuration, person check, receiver-changed entry), 07-12 the expense slice, 07-13 EnsureEditable, ChangeStatus and the OrderLockTests and OrderFixtures status helpers"
provides:
  - "POST /api/v1/orders/{id}/refunds (Staff, Idempotency-Key, { refundDate, amount, reason, refundedByUserId, version }), PUT .../refunds/{refundId} (with version) and DELETE .../refunds/{refundId} (no version, ConflictRetry): all answer 200 with the whole order, refunded, balance (total - paid + refunded), customerCredit and profit worked out again"
  - "OrderRefunds table (migration AddOrderRefunds): RefundDate date, Amount decimal(18,2) with CK_OrderRefunds_Amount_Positive, Reason nvarchar(200), RefundedByUserId required FK NO ACTION, Position, attribution columns, FK to Orders CASCADE, IX_OrderRefunds_OrderId, IX_OrderRefunds_RefundedByUserId including Amount and RefundDate, creator and updater FK indexes, SoftDelete filter through the order"
  - "Order.AddRefund, UpdateRefund and RemoveRefund with their own editable check: a Cancelled order accepts all three, a Completed order answers 422 orders.locked, every other mutator keeps EnsureEditable"
  - "Refund rules in the domain: allowed only on a Cancelled order or one with a customer credit (422 orders.refund-not-allowed), credit cap on an active order (D-34), paid minus earlier refunds cap on a cancelled one (D-09), an edit adds back its own old amount, at most 50 refunds (422 orders.too-many-refunds), 404 orders.refund-not-found"
  - "Order.Figures passes the refunds to OrderMath, so a cancelled ORD-2026-0148 refunded 12,000.00 reads profit -6,065.00 (D-36) and a refunded credit lets the order complete (D-13)"
  - "OrderRefundResponse (refundedBy, refundedByActive, recordedBy, lastChangedBy) and the refunds array on OrderDetailResponse; OrderReferenceChecks.AddRefunderFailureAsync (StaffState.CanPay, Legacy holder refused)"
  - "order-refund.added, .changed, .removed (refund id, date, amount, refunder; fields=reason, never the text) and order-refund.refunder-changed (refunder=old>new), all in the change's own save"
  - "Refunds section in docs/api/orders.md with the D-08 note for Phase 10; refreshed OpenAPI contract and generated types; OrderFixtures.RefundBody, AddRefundAsync, PutRefundAsync, DeleteRefundAsync, AddRefundAndReadAsync"
affects: [07-15, 07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 45300
  tasks: 3
  commits: 5
plan_head_before: 3992d19207eda41eac85498e99f4a19c715c0bf7
plan_head_after: 7eee9f65f4ba871d0e9fea7558874dc6ed0bf8e8

tech-stack:
  added: []
  patterns:
    - "A second, narrower editable check on the aggregate (EnsureRefundEditable: only Completed is locked) beside EnsureEditable, so the one exception to the end-state lock lives in one private method"
    - "One private RefundCapMessage judges both caps on the recomputed figures, with the refund's own old amount added back on an edit"
    - "The refunder follows the receiver and payer pattern: checked on add and on a change, a saved refunder who can no longer be chosen may stay"

key-files:
  created:
    - src/Csps.Domain/Orders/OrderRefund.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderRefundConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028211102_AddOrderRefunds.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028211102_AddOrderRefunds.Designer.cs
    - src/Csps.Application/Orders/IOrderRefundFields.cs
    - src/Csps.Application/Orders/OrderRefundFieldsValidator.cs
    - src/Csps.Application/Orders/AddOrderRefundRequest.cs
    - src/Csps.Application/Orders/AddOrderRefundRequestValidator.cs
    - src/Csps.Application/Orders/UpdateOrderRefundRequest.cs
    - src/Csps.Application/Orders/UpdateOrderRefundRequestValidator.cs
    - src/Csps.Application/Orders/AddOrderRefundHandler.cs
    - src/Csps.Application/Orders/UpdateOrderRefundHandler.cs
    - src/Csps.Application/Orders/RemoveOrderRefundHandler.cs
    - src/Csps.Server/Controllers/OrderRefundsController.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderRefundTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderRefundHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderRefundsMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderRefundsEndpointTests.cs
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Domain/Orders/OrderInputs.cs
    - src/Csps.Domain/Orders/OrderChanges.cs
    - src/Csps.Domain/Orders/OrderRules.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/Orders/OrderStore.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - src/Csps.Application/Orders/OrderDetailResponse.cs
    - src/Csps.Application/Orders/OrderErrors.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Application/Orders/OrderReferenceChecks.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderPeopleTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderLockTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderModelTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md

key-decisions:
  - "The refund exception to the lock is a second private check, EnsureRefundEditable, used by the three refund methods only. It refuses a Completed order and lets Cancelled and active orders through. Every other mutator still starts with EnsureEditable (T-07-41)."
  - "The not-allowed rule (a refund only on a Cancelled order or one with a credit) is judged on add only. An edit or removal of a refund that already exists is judged by the lock and the cap: lowering is always free, raising is capped at the cap plus the refund's own old amount. This keeps a mistaken refund on an active order correctable after it cleared the credit."
  - "Order of checks on an add: Completed lock (422), field rules (400), at most 50 (422), allowed (422), amount cap (400). So an empty reason is a 400 even on an order that cannot be refunded."
  - "Caps are judged on figures worked out fresh by OrderMath (Figures), never on the stored snapshot, and the amount cap is a 400 on amount while eligibility is a 422, as the plan words them."
  - "The refund list is wired into Order.Figures once, so AddPayment and UpdatePayment now read the balance with refunds in it (balance = total - paid + refunded)."

patterns-established:
  - "Pattern: a child slice that is an exception to the end-state lock gets its own named check on the aggregate, not a flag on EnsureEditable"
  - "Pattern: audit details that must be in the handler for the save to happen ship with the handler; the audit task then adds the proof tests and the race, with one-run breaks to show the tests can fail"

requirements-completed: [ORD-18, ORD-05, ORD-08]

coverage:
  - id: S1
    description: "D-07, D-36: a staff member refunds the 12,000.00 downpayment on a cancelled ORD-2026-0148; the answer shows refunded 12,000.00, paid 12,000.00, profit -6,065.00 and one refund naming the Manager as refunder, the Admin as recorder and the refunder as active"
    requirement: ORD-18
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderRefundsEndpointTests.cs#AnAdminRefundsTheDownpaymentOnACancelledOrderAndTheOrderShowsALossOfItsExpenses"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderRefundTests.cs#ACancelledOrderRefundedInFullShowsALossOfItsExpenses"
        status: pass
    human_judgment: false
  - id: S2
    description: "D-07 table: OrderRefunds has the designed columns, the positive-amount check, the order key as the only CASCADE, NO ACTION on every person key, the index set and the refunder index including Amount and RefundDate; the migration scripts and the model has no EF warning"
    requirement: ORD-18
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderRefundsMigrationTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderModelTests.cs#EveryOrderEntityCarriesTheSoftDeleteFilterByName"
        status: pass
    human_judgment: false
  - id: S3
    description: "D-09, D-34: a refund on an active order with no credit is 422 orders.refund-not-allowed; with a credit of 500.00, 500.00 is accepted and 500.01 is a 400 on amount with the credit message; on a cancelled order paid 12,000.00, 12,000.01 is refused with the kept message and a second refund is capped at what is left"
    requirement: ORD-18
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderRefundTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderRefundsEndpointTests.cs#ARefundOnAnActiveOrderWithNoCreditIs422NotAllowedAndNothingChanges"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderRefundsEndpointTests.cs#AnAmountAboveWhatWasPaidOnACancelledOrderIs400OnAmountWithTheKeptMessage"
        status: pass
    human_judgment: false
  - id: S4
    description: "D-13: a fully paid order with a fixed 500.00 discount shows credit 500.00 and cannot be completed; a 500.00 refund brings the balance and the credit to 0.00 and the order is then marked Completed"
    requirement: ORD-18
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderRefundsEndpointTests.cs#AFixedDiscountOnAFullyPaidOrderLeavesACreditThatARefundClearsSoTheOrderCanBeCompleted"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderRefundTests.cs#ARefundedCreditLetsTheOrderBeMarkedCompleted"
        status: pass
    human_judgment: false
  - id: S5
    description: "D-05, D-35: on a Cancelled order refund POST, PUT and DELETE succeed while an item add is still 422 orders.locked; on a Completed order all three refund routes are 422 orders.locked and the stored order is unchanged"
    requirement: ORD-18
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderLockTests.cs#OnACancelledOrderRefundsCanBeAddedEditedAndRemovedWhileAnItemAddIsStillLocked"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderLockTests.cs#OnACompletedOrderEveryRefundRouteIs422LockedAndTheStoredOrderIsUnchanged"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderRefundTests.cs#EveryRefundWriteOnACompletedOrderIsRefusedWithTheLockedErrorAndChangesNothing"
        status: pass
    human_judgment: false
  - id: S6
    description: "D-30, ORD-05: amount above 0.00 to 1,000,000.00 with at most 2 decimals, a date never in the future, a reason of 1 to 200 characters, a refunder, the 51st refund refused, and an empty body lists every field and the version"
    requirement: ORD-05
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderRefundTests.cs#EveryBrokenRefundFieldIsRefusedUnderItsOwnNameAndNothingChanges"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderRefundHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderRefundsEndpointTests.cs#AnEmptyBodyListsEveryRefundFieldAndTheVersion"
        status: pass
    human_judgment: false
  - id: S7
    description: "D-07: the Legacy holder and every deactivated, locked, deleted, invited, no-role and temporary-password account are refused as refunder on add and on a change; a saved refunder who was deactivated stays and shows refundedByActive false; a deleted one keeps their name as former staff"
    requirement: ORD-18
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPeopleTests.cs (refunder cases)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderRefundHandlerTests.cs#UpdateKeepingASavedRefunderWhoCanNoLongerBeChosenIsAllowedAndTheDirectoryIsNotAsked"
        status: pass
    human_judgment: false
  - id: S8
    description: "ORD-08, T-07-39: over 10 rounds two 7,000.00 refunds with the same version on a cancelled order paid 12,000.00 give one 200 and one 409 edit.stale, one refund is stored, the refunded total is 7,000.00 and only the winner has an audit entry"
    requirement: ORD-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs#TwoRefundsOf7000OnACancelledOrderPaid12000WithTheSameVersionGiveExactlyOneWinnerEveryTime"
        status: pass
    human_judgment: false
  - id: S9
    description: "D-31: add, edit, refunder change and remove write order-refund.added, .changed, .refunder-changed and .removed with the documented keys and never the reason text; a refusal or a no-op edit writes nothing"
    requirement: ORD-18
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderRefundsEndpointTests.cs#EachAddEditRefunderChangeAndRemoveWritesItsOwnEntryForTheOrderWithNoReasonText"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderRefundsEndpointTests.cs#ARefusalAndANoOpEditWriteNoEntryAndKeepTheVersion"
        status: pass
    human_judgment: false
  - id: S10
    description: "The Refunds section of docs/api/orders.md, the D-08 note for Phase 10 and the new refund sentences read clearly to a person"
    requirement: ORD-18
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's call; no test judges prose. The new sentences are listed under Deferred Issues."

duration: 50 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 14: Refunds on cancelled orders and customer credits Summary

**Staff can record, correct and remove refunds on a cancelled order or one with a customer credit (`/api/v1/orders/{id}/refunds`): caps are the credit on an active order and paid minus earlier refunds on a cancelled one, a cancelled order takes refund writes without a reopen while every other write stays locked, a refunded credit lets the order complete, and a cancelled ORD-2026-0148 refunded 12,000.00 reads profit -6,065.00. Every change is audited with its own refunder-changed entry, and ten rounds of two racing 7,000.00 refunds give one winner each time.**

## Performance

- **Duration:** about 50 min
- **Started:** about 2026-10-28T21:05Z
- **Completed:** 2026-10-28T21:55Z
- **Tasks:** 3 of 3
- **Files changed:** 48 files, 6,862 added lines (about 45,300 tokens of hand-written lines, chars/4, with the OpenAPI JSON, the generated types, the migration designer and the model snapshot left out)

## Accomplishments

- Task 1 (tracer): `OrderRefund` entity, `NewOrderRefund`, `Order.AddRefund` (Completed locked, Cancelled allowed), refunds wired into `OrderMath` through `Figures`, `OrderRefundConfiguration` with the SoftDelete filter and indexes, migration `AddOrderRefunds`, store and reader (refundedBy, refundedByActive), `OrderReferenceChecks.AddRefunderFailureAsync`, request, validator, handler, `OrderRefundsController` POST, matrix row, refreshed contract. A cancelled ORD-2026-0148 refunded in full reads profit -6,065.00.
- Task 2: eligibility, both caps and the own-old-amount add-back, `UpdateRefund` and `RemoveRefund`, `OrderRefundChanges`, the 50 limit, the three error codes and their messages, the update and remove handlers and routes, the refunds section in `docs/api/orders.md` with the D-08 note, and tests for clearing a credit, the cancelled exception, the Completed lock and every blocked refunder state.
- Task 3: audit detail tests, the endpoint audit and no-op cases, handler audit cases, and the 10-round two-refund race.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | 1a9568e2 `test(07-14): refund a cancelled order (RED)` | ee978dca `feat(07-14): record refunds on cancelled orders (D-07, D-36)` |
| 2 | 0a5498c4 `test(07-14): refund caps, the cancelled exception and clearing credit (RED)` | b3f33d31 `feat(07-14): refund caps, the cancelled exception and credit clearing (D-09, D-13, D-34, D-35)` |
| 3 | 7eee9f65 `test(07-14): audited refunds, never above the cap (D-31, ORD-08)` | none (no production code changed; see below) |

- **Task 1 RED:** 3 of 3 endpoint tests failed (the route did not exist) and 8 of 8 migration cases failed (the table did not exist). Valid assertion failures. `gsd_run check tdd-red-evidence` was not run (this runner's output is none of TAP, JUnit or Surefire); the output was read by hand.
- **Task 2 RED:** the Domain and Application unit test projects did not build (`UpdateRefund`, `RemoveRefund`, `UpdateOrderRefundRequest` and the two handlers missing: a compile-time RED). At runtime 4 of 11 refund endpoint cases, 2 of 7 lock cases and 9 of 30 people cases failed. The credit-clears-and-completes case passed at once, because the Task 1 add had no cap yet and a refund on a credited order simply worked.
- **Task 3:** the audit entries arrived with their handlers (`OrderChildWrite` saves nothing without an audit entry), so the audit tests and the race passed the first time. Teeth were shown with two one-run breaks, restored before the commit: dropping the chained refunder-changed entry (`Then = null`) failed 1 handler test and 1 endpoint test; turning `OrderStore.LockAsync` into a no-op failed the new refund race (round 1: a 200 and a 500 instead of a 200 and a 409) and 3 older concurrency cases. The Task 3 commit is a `test` commit with no `feat` pair, as in 07-13.
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with automated-only `<verify>`, so the verify commands were re-run after GREEN (`OrderRefundsEndpointTests` 3 passed, `OrderRefundsMigrationTests` 8, `MigrationScriptTests` 6, `OrderModelTests` 3) before expansion. Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- Preflight before the integration runs: ports 5180, 5115, 7028, 5199 all free, no dev or test processes.
- `Csps.Domain.UnitTests`: 1135 passed. `Csps.Application.UnitTests`: 1664 passed. `Csps.ArchitectureTests`: 241 passed.
- `Csps.Server.IntegrationTests` (full run): 1597 total, 1597 passed, 0 failed, 0 skipped. The known slow-machine `ExpenseListTimingTests` passed in this run (owner ruling D-76 stands).
- `Csps.Infrastructure.IntegrationTests` (full run): 669 total, 0 failed, 668 passed, 1 skipped (the same skip as in 07-09 to 07-13). Includes `MigrationScriptTests` 6, `OrderModelTests` 3 (no EF warning), `TriggerInventoryTests` 2, `OrderRefundsMigrationTests` 8.
- Filtered classes: `*OrderRefundsEndpointTests` 13, `*OrderLockTests` 7, `*OrderPeopleTests` 30, `*OrderConcurrencyTests` 9, `*Authorization*` 306, `*Idempotency*` 54, `*OpenApiSnapshotTests` 10, all passed. The refund race passed three more times alone.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (2294/2294), branch 100% (936/936); Csps.Application line 97.9% (5630/5749), branch 94.5% (not gated). "Coverage gate passed." One Domain gap (the field-rule refusal inside `UpdateRefund`) failed the first run and got its own test.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The snapshot was refreshed with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command only, twice (after Task 1 and after Task 2). `npm --prefix web run typecheck` is clean.
- Acceptance criteria: `IX_OrderRefunds_RefundedByUserId` in the configuration 1 (exactly 1); `HasQueryFilter("SoftDelete"` in the configuration 1 (exactly 1); `orders.refund-not-allowed` in `OrderRules.cs` and `OrderErrors.cs` 1 and 0, total 1 (at least 1); `D-08` in `docs/api/orders.md` 8 (at least 1); `OrderRefundRefunderChanged` in `UpdateOrderRefundHandler.cs` 1 (exactly 1).
- gitleaks on each staged change: no leaks. Only fake values appear. No em or en dash in any changed source file. No SQL string, trigger, package or JSON column was added. The migration only creates the new table and its indexes; its `Down` drops only that table.

## Task Commits

1. **Task 1: tracer, refund a cancelled order** - RED `1a9568e2` (test), GREEN `ee978dca` (feat)
2. **Task 2: eligibility, caps, the cancelled exception, clearing a credit** - RED `0a5498c4` (test), GREEN `b3f33d31` (feat)
3. **Task 3: audit and the race** - tests `7eee9f65` (test)

## Decisions Made

See key-decisions above. The ones the owner should know about: the not-allowed rule is judged on add only (an existing refund can still be lowered or removed on an active order), and removing a refund on an active order is allowed, which brings the customer credit back.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A documentation sentence lost a space in an earlier edit of mine**
- **Found during:** Task 2, when adding the refund audit details
- **Issue:** My Task 1 edit to `OrderAuditDetail.cs` turned "...order-expense.added</c>: the expense id" into "...</c>:the expense id" (the Edit tool trimmed the trailing space of my anchor).
- **Fix:** Restored the space in the Task 2 commit.
- **Files modified:** `src/Csps.Application/Orders/OrderAuditDetail.cs`
- **Commit:** b3f33d31

### Plan notes (no behaviour change beyond what the plan states)

- **Migration file name.** The plan lists `20261028000007_AddOrderRefunds`; `dotnet ef` named it `20261028211102_AddOrderRefunds`, the same way it named the 07-10 to 07-12 migrations. No schema difference.
- **Audit code arrived with the handlers.** `OrderRefundAdded` came in Task 1 and the change, refunder-changed and removed details in Task 2, because the handlers cannot save without an audit entry. Task 3 added the proof tests and the race.
- **`OrderDetailResponse` gained a `Refunds` member** between `Payments` and `Expenses`, so seven unit test files that build the response by hand got one more `[]`. The generated contract and types changed with it.
- **Files beyond the plan's list:** `OrderModelTests.cs` (the SoftDelete type list now includes `OrderRefund`), `OrderReferenceChecks.cs` (the refunder check), the seven unit test files above, and `docs/api/orders.md` also got a routes-table block, the lock note under it, the response shape and the audit and storage paragraphs.
- **Not-allowed on add only.** The plan says a refund is "allowed only on a Cancelled order or one showing a customer credit". I judged that on add. An edit or removal of an existing refund is not refused for lack of a credit; it follows the lock and the cap. The alternative (refuse every refund write on an active order with no credit) would stop staff correcting a refund that had just cleared the credit.
- **Extra rule.** On a cancelled order with nothing left to refund, the cap message reads "Everything that was paid has already been refunded." instead of "Enter ₱0.00 or less."

**Total deviations:** 1 auto-fixed (a lost space in a doc comment), 5 plan notes. **Impact:** none on scope.

## Issues Encountered

- **Three of my own shell commands hung on standard input.** A stray `cat > file` (twice, once with a here-document wired to the wrong command) and one `python -` started with an empty here-document sat waiting for input. I killed only those shell processes (and their `cat` and `python` children), confirmed with `ps` that nothing of mine was left running, and deleted a 0-byte file the first one created outside the repo (`C:/Work/scratchpad_patch_order.py`). No repo file was affected. After that I used the Write and Edit tools and script files in the scratchpad, with no here-documents.
- Two multi-line here-document edits failed on a shell quoting error before anything ran; the edits were redone with the Write and Edit tools. No file was affected.
- `ProblemDetails.detail` carries the plain-English message, so the endpoint tests read `detail` for the exact sentences.
- The working tree stores files with CRLF; a script I wrote with LF first missed its anchor. I switched it to text mode.

## Deferred Issues

- **For the owner: new wording to approve.** The plan spelled out these sentences and they are used as written: "A refund can be recorded only on a cancelled order or one with a customer credit.", "This is more than the customer credit. Enter ₱{credit} or less.", "This is more than was paid and not yet refunded. Enter ₱{kept} or less.", "The refund date can't be in the future.", "Add a short reason for the refund.", "Choose who handed the money back." These I wrote in the same plain style as the 07-10 to 07-12 messages and need a look:
  - "Enter the refund date." (missing date)
  - "Keep the reason to 200 characters or fewer." (reason too long)
  - "Everything that was paid has already been refunded." (cancelled order, nothing left to refund)
  - "An order can have at most 50 refunds." (`orders.too-many-refunds`)
  - "This refund was not found on this order." (`orders.refund-not-found`)
  - "This person can't be chosen because their account isn't active. Choose someone else." (refunder; the same words as the receiver and payer)
- **For the owner: two small behaviour calls.** (1) A refund can be lowered or removed on an active order even when its credit is already cleared; removing one brings the credit back. (2) The "not allowed" rule applies when adding a refund only. Say if you want either one stricter.
- **Open from D-39, parked in the STATE.md owner backlog:** whether refunds on a soft-deleted order count toward money on hand. The refund index and the SoftDelete filter keep the data ready for either answer; Phase 10 decides.
- **Phase 8 follow-up (unchanged from 07-02):** golden vectors v3 when the web preview learns refunds.
- The `ExpenseListTimingTests` machine-speed failure in `deferred-items.md` did not fail in this plan's full run; owner ruling D-76 stands.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-07-38 (refunding more than was paid or than the credit) is mitigated by `RefundCapMessage` on freshly computed figures and the boundary cases (500.00 and 500.01, 12,000.00 and 12,000.01, the second refund capped at what is left, an edit capped at the cap plus its own amount). T-07-39 (two refunds passing the cap together) is mitigated by the order lock and row version, and the 10-round race test failed when the lock was turned off. T-07-40 (an ineligible person or the Legacy holder as refunder) is mitigated by the `CanPay` check on add and on a change and by the seven blocked states in `OrderPeopleTests`. T-07-41 (using the refund exception to change a closed order) is mitigated by `EnsureRefundEditable` being used by the three refund methods only, a Cancelled order still refusing an item add, and a Completed order refusing all three refund writes. No package was added.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 07-15. Refund totals now flow into `OrderMath`, the stored figures, the detail response and the audit log, and `OrderRefunds` has the refunder index Phase 10 reads for money on hand (D-08). The permanent-delete audit entry's `refunders=<ids>` list in `docs/operations/audit-log.md` can now be built from `OrderRefunds.RefundedByUserId` by whichever plan writes the delete route.

## Self-Check: PASSED

All 18 files listed under key-files.created exist on disk, and all five task commits (1a9568e2, ee978dca, 0a5498c4, b3f33d31, 7eee9f65) are ancestors of HEAD. The acceptance criteria above were re-run after the last commit.
