---
phase: 07-order-domain-api
plan: 11
subsystem: api
tags: [orders, order-payments, receiver, customer-credit, overpayment, optimistic-concurrency, audit, migration, openapi]
created: "2026-10-28T14:55:00-05:00"
updated: "2026-10-28T15:20:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-05 Order aggregate, NewOrder, CreateOrderHandler, OrderReader, OrderFixtures; 07-09 OrderChildWrite and IOrders.LockAsync; 07-10 discounts, Order.Recalculate with the discount list, DiscountsFit, the child handler and controller shape"
provides:
  - "OrderPayments table (migration AddOrderPayments): PaymentDate date, Amount decimal(18,2) above 0, PaymentMethodId, Reference up to 100, Notes up to 500, ReceivedByUserId required, Position, cascade from Orders, method and person keys NO ACTION, five indexes (the receiver index carries Amount and PaymentDate for Phase 10)"
  - "POST, PUT and DELETE /api/v1/orders/{orderId}/payments[/{paymentId}] (Staff): add, edit and remove payments, each answering 200 with the whole order, recomputed totals and a new version"
  - "A payments array on POST /api/v1/orders, saved in the same transaction; errors on payments[i].field, the 100 limit and the sum-above-total check on payments"
  - "OrderPayment entity, NewOrderPayment, NewOrder.Payments, Order.AddPayment/UpdatePayment/RemovePayment, OrderPaymentChanges, OrderRules.CheckPayment and the payment messages"
  - "The overpayment rule (D-11): a new payment is at most the balance; an edit may lower freely and raise up to balance plus its old amount; nothing owed has its own message"
  - "Customer credit (D-12): item removal, lower quantity or price, and added or raised discounts after payment are allowed and show customerCredit = paid minus total"
  - "The receiver rule (ORD-22): CanPay on add, on a changed receiver and in the create body; a saved receiver who is no longer eligible may stay; receivedBy (with formerStaff) and receivedByActive in the detail; recordedBy stays the person who typed it in"
  - "Error codes orders.payment-not-found and orders.too-many-payments"
  - "OrderAuditDetail.PaymentAdded/PaymentChanged/PaymentReceiverChanged/PaymentRemoved; a receiver change is its own order-payment.receiver-changed entry (OrderChildAudit.Then)"
  - "OrderStore.FindAsync checks the row version again after its split read, so an order read across another save is 409 edit.stale, never a verdict on mixed data"
  - "Payments section in docs/api/orders.md; refreshed OpenAPI contract and generated types"
affects: [07-12, 07-13, 07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 58000
  tasks: 3
  commits: 6
plan_head_before: 2ac7f027b1090827014df6a7ace2a070e341b73d
plan_head_after: ee11385ec9af26a82e889a1733332d061315731f

tech-stack:
  added: []
  patterns:
    - "A child write that needs two audit entries chains them: OrderChildAudit.Then. AttemptAsync records the first, then each Then, all before the one save"
    - "Reference checks run only for what an edit changes (a method id or a receiver id that differs from the saved one); a saved retired method or deactivated receiver stays valid"
    - "The money rule is checked on the figures as they stand, from OrderMath through a private Figures(payments) helper, before anything is assigned; the stored Balance is never trusted for the check"
    - "A split-query load is confirmed with a second read of the row version; a mismatch clears the tracker and throws ConcurrencyConflictException, which every caller already turns into 409 or a retry"
    - "Create-body lists are checked in the validator with RuleForEach over a private validator that includes the shared fields validator, with the business today passed in RootContextData"

key-files:
  created:
    - src/Csps.Domain/Orders/OrderPayment.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderPaymentConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028191015_AddOrderPayments.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028191015_AddOrderPayments.Designer.cs
    - src/Csps.Application/Orders/IOrderPaymentFields.cs
    - src/Csps.Application/Orders/OrderPaymentFieldsValidator.cs
    - src/Csps.Application/Orders/AddOrderPaymentRequest.cs
    - src/Csps.Application/Orders/AddOrderPaymentRequestValidator.cs
    - src/Csps.Application/Orders/AddOrderPaymentHandler.cs
    - src/Csps.Application/Orders/UpdateOrderPaymentRequest.cs
    - src/Csps.Application/Orders/UpdateOrderPaymentRequestValidator.cs
    - src/Csps.Application/Orders/UpdateOrderPaymentHandler.cs
    - src/Csps.Application/Orders/RemoveOrderPaymentHandler.cs
    - src/Csps.Server/Controllers/OrderPaymentsController.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderPaymentTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderPaymentHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderPaymentsMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderPaymentsEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderPeopleTests.cs
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Domain/Orders/OrderChanges.cs
    - src/Csps.Domain/Orders/OrderInputs.cs
    - src/Csps.Domain/Orders/OrderRules.cs
    - src/Csps.Infrastructure/Orders/OrderStore.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Application/Orders/CreateOrderRequest.cs
    - src/Csps.Application/Orders/CreateOrderRequestValidator.cs
    - src/Csps.Application/Orders/CreateOrderHandler.cs
    - src/Csps.Application/Orders/OrderChildWrite.cs
    - src/Csps.Application/Orders/OrderDetailResponse.cs
    - src/Csps.Application/Orders/OrderErrors.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Application/Orders/OrderReferenceChecks.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/CreateOrderRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderDiscountHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderItemHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/UpdateOrderDetailsHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderModelTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md

key-decisions:
  - "The balance check works from OrderMath on the payments as they stand (Figures), not from the stored Balance, and runs before anything is assigned, so a refusal changes nothing. A new payment must be at most that balance; an edit that raises an amount must be at most balance plus its old amount; an edit that lowers or keeps an amount is always allowed."
  - "'Nothing is owed on this order.' is the message whenever the most that may be entered is 0.00 or less, including an order in credit."
  - "A saved retired payment method and a saved ineligible receiver may stay on an edit (checked only when changed), the same pattern as Phase 6 company expenses and product types."
  - "The receiver is a real person choice, separate from the token: the detail shows receivedBy and recordedBy apart, and a receiver change is its own audit entry besides the change entry (OrderChildAudit.Then)."
  - "Order.Create takes an optional business-today argument. Payments need it for the future-date rule; payments without it is a programming error (ArgumentException), not a silent pass."
  - "OrderPayments has a Position column, like OrderDiscounts, so create-body paths payments[i].x match the stored order. Payments show oldest payment date first, then by position."
  - "The sum of payments in the create body is judged after the totals are worked out: a negative balance can only come from the payments, because the discount cap already keeps the total at zero or more."
  - "FindAsync confirms the row version after its split read (see Deviations, the torn read). One extra single-row read per order load."

patterns-established:
  - "Pattern: a money rule that depends on a list is judged on figures built from that list, before the change is assigned"
  - "Pattern: a child edit with a person field checks that person only when the edit changes them"

requirements-completed: [ORD-05, ORD-08, ORD-22, ORD-03]

coverage:
  - id: P1
    description: "A staff member records the ORD-2026-0148 payments (10,000.00 GCash by an Admin, 2,000.00 Cash received by a Manager) on the order with its 5% discount: paid 12,000.00, balance 9,327.50, profit 21,327.50; each payment shows its method, receivedBy, receivedByActive and recordedBy"
    requirement: ORD-22
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPaymentsEndpointTests.cs#TheOrd0148PaymentsLeaveABalanceOf9327AndEachPaymentNamesWhoReceivedIt"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderPaymentsMigrationTests.cs"
        status: pass
    human_judgment: false
  - id: P2
    description: "D-11: a payment above the balance is a 400 on amount with the most that may be entered; nothing owed has its own message; an edit lowers freely and raises up to balance plus its old amount, to the centavo"
    requirement: ORD-05
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderPaymentTests.cs#AnAmountEqualToTheBalanceIsAcceptedAndOneCentavoMoreIsRefusedWithTheBalanceMessage"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderPaymentTests.cs#AnEditMayRaiseTheAmountUpToTheBalancePlusItsOldAmountAndNoFurther"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPaymentsEndpointTests.cs#APaymentOf20000OnABalanceOf9327IsA400OnAmountWithTheMostThatCanBeEntered"
        status: pass
    human_judgment: false
  - id: P3
    description: "D-12: after full payment, removing an item, lowering a quantity or adding a fixed 500.00 discount all succeed and show customerCredit equal to paid minus the new total (9,750.00 paid, then 500.00 off: balance -500.00, credit 500.00)"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPaymentsEndpointTests.cs#AfterFullPaymentAFixedDiscountOf500IsAcceptedAndLeavesACustomerCreditOf500"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPaymentsEndpointTests.cs#AfterFullPaymentRemovingAnItemAndLoweringAQuantityLeaveACustomerCredit"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderPaymentTests.cs"
        status: pass
    human_judgment: false
  - id: P4
    description: "D-30 field rules at their edges: amount 0.01 to 1,000,000.00 with at most 2 decimals, a date never after the business today, reference up to 100 and notes up to 500, at most 100 payments (422 orders.too-many-payments)"
    requirement: ORD-05
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderPaymentTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderPaymentHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPaymentsEndpointTests.cs#EveryPaymentFieldRuleAnswersA400OnItsField"
        status: pass
    human_judgment: false
  - id: P5
    description: "D-16: a new or switched payment method must be active; keeping a saved retired method on an edit is allowed"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPaymentsEndpointTests.cs#ARetiredMethodIsRefusedOnAddAndOnSwitchButAKeptRetiredMethodMayBeEdited"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderPaymentHandlerTests.cs#UpdateKeepingASavedRetiredPaymentMethodIsAllowedAndTheListIsNotAsked"
        status: pass
    human_judgment: false
  - id: P6
    description: "ORD-22: a deactivated, Manager-locked, soft-deleted, invited, role-less or never-signed-in receiver and the Legacy holder are each refused on add, on a receiver change and in the full create (payments[1].receivedByUserId) with the exact message; an active Admin and Manager are accepted; a saved receiver deactivated later still shows (receivedByActive false) and the payment can be edited without changing them"
    requirement: ORD-22
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPeopleTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#APaymentWithAnIneligibleReceiverInTheBodyIsListedOnItsIndexedPath"
        status: pass
    human_judgment: false
  - id: P7
    description: "ORD-08 / SEC-07: ten rounds of two 5,000.00 payments sent together with the same version on a 9,327.50 balance give exactly one 200 and one 409 edit.stale each round, paid 17,000.00, balance 4,327.50, one new payment and one added entry"
    requirement: ORD-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs#TwoPaymentsOf5000OnABalanceOf9327WithTheSameVersionGiveExactlyOneWinnerEveryTime"
        status: pass
    human_judgment: false
  - id: P8
    description: "ORD-03 / D-24: the create body accepts payments; the ORD-2026-0148 body with its discount and both payments gives paid 12,000.00 and balance 9,327.50; payments above the total are a 400 on payments with no order and no number used; method and receiver failures are listed on indexed paths"
    requirement: ORD-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#TheOrd0148BodyWithItsDiscountAndBothPaymentsGivesPaid12000AndBalance9327"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#PaymentsInTheBodyThatPassTheTotalAreA400OnPaymentsAndNoOrderIsCreated"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: P9
    description: "D-31 / ORD-22 / SEC-08: payment add, change, remove each write one entry with the documented keys and never the reference or notes; a receiver change writes its own order-payment.receiver-changed entry; a refusal or a no-op writes none; a payment recorded by an Admin and received by a Manager reads receivedBy the Manager and recordedBy the Admin"
    requirement: ORD-22
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPaymentsEndpointTests.cs#EachAddEditReceiverChangeAndRemoveWritesItsOwnEntryForTheOrderWithNoReferenceOrNotesText"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPaymentsEndpointTests.cs#ARefusalAndANoOpEditWriteNoEntryAndKeepTheVersion"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPaymentsEndpointTests.cs#APaymentRecordedByAnAdminAndReceivedByAManagerReadsReceivedByTheManagerAndRecordedByTheAdmin"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs"
        status: pass
    human_judgment: false
  - id: P10
    description: "T-07-30: a payment id from another order is never found on edit or remove (404 orders.payment-not-found) and the other order's payment is unchanged"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPaymentsEndpointTests.cs#APaymentIdFromAnotherOrderIsNeverFoundOnEditOrRemove"
        status: pass
    human_judgment: false
  - id: P11
    description: "The new plain-English payment messages and the payments section of docs/api/orders.md read clearly to a person"
    requirement: ORD-05
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's call; no test judges prose. The messages the plan did not spell out are listed under Deferred Issues."

duration: 55 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 11: Order payments Summary

**Staff can record, correct and remove payments on an order, each naming who received the money, through POST, PUT and DELETE under /api/v1/orders/{orderId}/payments or in the create body. A payment can never take the paid total above the order total, other changes after payment show a customer credit instead of failing, only an eligible Admin or Manager can be named as receiver, and two payments sent together with one version give exactly one winner. The ORD-2026-0148 order with its 5% discount and two payments reads paid 12,000.00 and balance 9,327.50.**

## Performance

- **Duration:** about 55 min
- **Started:** about 2026-10-28T18:55Z
- **Completed:** 2026-10-28T19:50Z
- **Tasks:** 3 of 3
- **Files changed:** 50 files in all, 8,009 added lines (about 58,000 tokens of hand-written lines, chars/4, with the OpenAPI JSON, the generated types and the migration left out)

## Accomplishments

- Task 1 (tracer): the `OrderPayments` table and migration, the `OrderPayment` entity, `Order.AddPayment` with the field rules and the balance rule, the reader (method with retired flag, `receivedBy` with `formerStaff`, `receivedByActive` projected in LINQ from the CanPay rule), method and receiver checks in `OrderReferenceChecks`, the add request, validator, handler and POST route, the matrix row and the refreshed contract.
- Task 2: `Order.UpdatePayment` and `RemovePayment`, the edit ceiling (balance plus old amount), `OrderPaymentChanges`, `NewOrder.Payments` with the sum check, the PUT and DELETE routes, payments in the create body with indexed reference checks, the payments section of `docs/api/orders.md`.
- Task 3: the payment audit entries with a receiver change as its own entry, the 10-round two-payments race, and the fix for a torn read in `OrderStore.FindAsync` that the race test exposed.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | 8527fd43 `test(07-11): record payments on an order (RED)` | 81989c61 `feat(07-11): record payments with who received them (ORD-22)` |
| 2 | 87db1746 `test(07-11): payment rules, receivers and customer credit (RED)` | 9dba7cba `feat(07-11): no overpayment, customer credit and the receiver rule (D-11, D-12, ORD-22)` |
| 3 | 32ed7e9a `test(07-11): payment audit and the two-payments race (RED)` | ee11385e `feat(07-11): audited payments, one winner per balance (D-31, ORD-08)` |

- **Task 1 RED:** 3 of 3 endpoint tests failed (the route did not exist: 404 where 200, 401 and `orders.not-found` were expected) and 8 of 8 migration tests failed (`Invalid object name 'OrderPayments'`). Valid assertion failures. `gsd_run check tdd-red-evidence` was not run (this runner's output is none of TAP, JUnit or Surefire); the failing output was read by hand.
- **Task 2 RED:** the Domain and Application test projects did not build (`UpdatePayment`, `RemovePayment`, `UpdateOrderPaymentHandler`, `Order.Create` with a business-today argument and friends missing: a compile-time RED). At runtime 4 of 13 payment endpoint cases, 9 of 10 `OrderPeopleTests`, 4 of 39 create endpoint cases and 6 matrix cases failed. The other cases passed because the tracer already carried the add, the balance rule and the field rules.
- **Task 2 GREEN note:** two of my own Domain tests were wrong (they used the ORD-2026-0148 items without the 5% discount but expected the discounted figures). They were fixed in the GREEN commit; the production code was not changed for them.
- **Task 3 RED:** the 10-round race test failed without the fix, in 2 of 4 runs (round 3 and round 10), each time `BadRequest, OK` instead of `Conflict, OK`. The audit tests and the audit detail tests passed the first time because the audit code arrived with the handlers in Tasks 1 and 2 (see Deviations), so they are regression proof, not new red.
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with automated-only `<verify>`, so the verify commands were re-run after GREEN (`OrderPaymentsEndpointTests` 3 passed, `OrderPaymentsMigrationTests` 8, `MigrationScriptTests` 6, `OrderModelTests` 3; also `TriggerInventoryTests` 2, `*Authorization*` 279, `*Idempotency*` 54, the earlier discount, item, create and concurrency classes) before expansion. Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- Preflight before the integration runs: ports 5180, 5115, 7028, 5199 all free, no dev or test processes.
- `Csps.Domain.UnitTests`: 1075 passed. `Csps.Application.UnitTests`: 1539 passed. `Csps.ArchitectureTests`: 241 passed (including `NoInlineSqlTests` 24).
- `Csps.Server.IntegrationTests` (full run): 1507 total, 1507 passed, 0 failed, 0 skipped. The known slow-machine `ExpenseListTimingTests` passed in this run (owner ruling D-76 stands).
- `Csps.Infrastructure.IntegrationTests` (full run): 653 total, 652 passed, 0 failed, 1 skipped (not touched by this plan; the same skip as in 07-09 and 07-10). Included `OrderPaymentsMigrationTests` 8, `MigrationScriptTests` 6, `OrderModelTests` 3, `TriggerInventoryTests` 2 and `OrderStoreLockTests` 2.
- `OrderConcurrencyTests` with the fix: 3 runs in a row and then 5 more, all 7 of 7 passed. Without the fix the payment race failed in 2 of 4 runs.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (1974/1974), branch 100% (782/782); Csps.Application line 98.2% (4998/5089), branch 94.7% (not gated). "Coverage gate passed."
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The snapshot was refreshed twice (Task 1 and Task 2) with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command only.
- Acceptance criteria: `IX_OrderPayments_ReceivedByUserId` in `OrderPaymentConfiguration.cs` 1 (exactly 1); `HasQueryFilter("SoftDelete"` in it 1 (exactly 1); `Choose who received the money.` in `OrderRules.cs` 1 (exactly 1); `money on hand` in `docs/api/orders.md` 1 (at least 1); `OrderPaymentReceiverChanged` in `UpdateOrderPaymentHandler.cs` 1 (exactly 1); `5000` in `OrderConcurrencyTests.cs` 3 (at least 1).
- gitleaks on each staged change: no leaks. Only fake values appear (the fake customer, the UI-spec payment reference, `example.com` emails). No en or em dash in any changed `src` file or doc. No SQL string, trigger, package or JSON column was added. The migration creates one table and drops nothing.

## Task Commits

1. **Task 1: tracer, record payments** - RED `8527fd43` (test), GREEN `81989c61` (feat)
2. **Task 2: balance rule, customer credit, receivers, create body** - RED `87db1746` (test), GREEN `9dba7cba` (feat)
3. **Task 3: audit and the race** - RED `32ed7e9a` (test), GREEN `ee11385e` (feat)

## Decisions Made

See key-decisions above. The two the owner should know about are the extra `Position` column and the extra read in `OrderStore.FindAsync` (both below).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] An order read across another save could be judged on mixed data (a 400 where a 409 belongs)**
- **Found during:** Task 3 (the 10-round two-payments race)
- **Issue:** `OrderStore.FindAsync` loads the order row and then its items, discounts and payments as separate queries. When the other payment committed between the row read and the payments read, the order came back with the old row version but the new payment list. The version matched, the balance check then ran on the mixed data (17,000.00 paid, balance 4,327.50) and the second request got `400 amount` ("Enter 4,327.50 or less") instead of `409 edit.stale`. No money was ever overpaid (the lock would still have refused the write), but the answer was wrong and the race test, rightly, failed intermittently (round 3 of one run, round 10 of another). Items and discounts had the same weakness in principle; their rules did not depend on the lists in a way that showed.
- **Fix:** after the split read, `FindAsync` reads the row version once more. If it moved, the tracked state is cleared and `ConcurrencyConflictException` is thrown, which every caller already turns into `409 edit.stale` (form saves) or a second read (single-click removes). No locking hint, no raw SQL, no isolation change. Cost: one single-row read per order load.
- **Files modified:** `src/Csps.Infrastructure/Orders/OrderStore.cs`
- **Verification:** 8 runs of `OrderConcurrencyTests` in a row passed, the full Server and Infrastructure suites pass, `OrderStoreLockTests` pass.
- **Commit:** ee11385e

### Plan notes (no behaviour change beyond what the plan states, except as noted)

- **`Position` column on `OrderPayments` (Rule 2, correctness).** The plan's column list had no ordering column. Without one, the create body paths `payments[i].x` could not match what was stored and the payments could come back in any order. `Position int NOT NULL` mirrors `OrderItems` and `OrderDiscounts`. It is a new column on a new table: no drop, no rename, no lossy change. Payments show oldest payment date first, then by position.
- **Audit code arrived in Tasks 1 and 2, not Task 3.** `OrderChildWrite` saves nothing when the change returns no audit entry, so `PaymentAdded` was needed in Task 1 and `PaymentChanged`, `PaymentReceiverChanged` and `PaymentRemoved` in Task 2. Task 3 added the tests for them (all passed the first time) plus the race and the fix above.
- **Two audit entries from one change.** `OrderChildAudit` gained a `Then` link so a receiver change records its own `order-payment.receiver-changed` entry after the change entry, in the same save. This is a small change to the shared flow in `OrderChildWrite.cs`, which was not in the plan's file list.
- **`Order.Create` has a fourth, optional argument (the business today).** Payments need it for the future-date rule. Payments without it throw `ArgumentException`. Existing callers are unchanged.
- **`CreateOrderHandler` now takes `IStaffDirectory`** (for the receiver checks), and its validator is run with the business today in the validation context.
- **Full payment field rules in Task 1.** The plan said Task 2 completes them; the validator and `OrderRules.CheckPayment` are shared by add, edit and the create body, so writing half of them would have been throwaway code. Task 2's boundary tests mostly passed the first time and are regression proof.
- **Migration file name.** The plan says `20261028000005_AddOrderPayments`; EF generated `20261028191015_AddOrderPayments` (the real timestamp). The Up and Down were read: one table, its check, five foreign keys, five indexes (the receiver index includes `Amount` and `PaymentDate`); Down drops only that table.
- **Files beyond the plan's list:** `OrderChildWrite.cs`, `OrderConfiguration.cs` (the payments relation), `OrderModelTests.cs` (the SoftDelete-by-name check now covers `OrderPayment`), `CreateOrderHandlerTests.cs` and the three other handler test files whose `OrderDetailResponse` literal needed the new `Payments` argument, and `OrderFixtures.cs` helpers (`PaymentItem`, `AddPaymentMethodAsync`, `RetirePaymentMethodAsync`).
- **`OrderErrors.PaymentNotFound` and `TooManyPayments`** re-expose the `OrderRules` values, as the discount ones do.
- **Tooling:** several multi-line shell commands with here-documents did not run at all (shell parse error, nothing executed); the edits were redone with the Edit and Write tools or with small script files. No file was affected. One test file used `DateTimeOffset.UtcNow`, which the project bans; it now uses `TimeProvider.System`.

**Total deviations:** 1 auto-fixed (Rule 1 bug), 1 small addition (Position), 9 plan notes. **Impact:** none on scope; one new column on the new table and one extra read per order load.

## Issues Encountered

- The torn read above, found by the race test.
- The tooling parse errors above. No effect on the code.
- `Csps.Infrastructure.IntegrationTests` reports one skipped test; it is not in code this plan touched.

## Deferred Issues

**Owner ruling D-41 (2026-10-28):** the payment messages are approved as written, and a payment may be dated before the order date (only "not in the future" applies).

- **For the owner: wording of the new payment messages.** The plan gave only the balance, nothing-owed, future-date, method and receiver sentences. These were written here in the same plain style as the 07-10 messages. Please read them in `OrderRules.cs` and the payments section of `docs/api/orders.md`; Phase 8 mirrors them in zod:
  - "Enter the payment date." (missing date)
  - "Enter the amount." (missing amount)
  - "Enter an amount from ₱0.01 to ₱1,000,000.00." (out of range)
  - "Keep the reference to 100 characters or fewer."
  - "Keep notes to 500 characters or fewer."
  - "The payments would be more than the order total. Lower a payment first." (create body)
  - "An order can have at most 100 payments."
  - "This payment was not found on this order."
  - "Fill in this payment." (an empty slot in the create list)
- **For the owner: no rule ties the payment date to the order date.** A payment may be dated before the order was taken (only "not in the future" is ruled, D-30). Say if you want a rule.
- Payments, like items and discounts, are allowed on a Completed or Cancelled order until plan 07-13 adds the D-05 end-state lock (422 `orders.locked`). That is not an open question.
- The `ExpenseListTimingTests` machine-speed failure in `deferred-items.md` did not fail in this plan's full run; owner ruling D-76 stands.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-07-28 (two payments together overpaying) is mitigated by the balance check on recomputed figures, the root version guard and `LockAsync`, the new row-version confirmation after the split read, and the 10-round race test. T-07-29 (an ineligible receiver or the Legacy holder) is mitigated by `CanPay` on every new or changed receiver and by `OrderPeopleTests` over every blocked state. T-07-30 (another order's payment by id) is mitigated by loading payments only through their order and `APaymentIdFromAnotherOrderIsNeverFoundOnEditOrRemove`. T-07-31 (reference or notes in the audit log) is mitigated: the audit detail has no reference or notes text, only `fields=reference,notes`, proved by `OrderAuditDetailTests` and the endpoint audit test. No package was added.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 07-12. Refunds and order expenses copy the same flow: `OrderChildWrite.SaveFormAsync` for add and edit (with `Then` when one change needs two entries), `ConflictRetry` plus `AttemptAsync` for remove, `IOrders.LockAsync` before the child row, `Order.Figures(...)` and `Recalculate` (add the new list to both; the refunds list is still passed as empty today), and `OrderReferenceChecks.AddReceiverFailureAsync` for any person field. `OrderFixtures.PaymentBody`, `PaymentItem`, `AddPaymentAsync`, `PutPaymentAsync`, `DeletePaymentAsync`, `AddPaymentAndReadAsync` and `AddPaymentMethodAsync` show the helpers to copy. Phase 10 reads money on hand from `IX_OrderPayments_ReceivedByUserId` (it carries `Amount` and `PaymentDate`).

## Self-Check: PASSED

All 31 spot-checked key files (the new entity, configuration, migration pair, handlers, validators, controller, tests and the docs page) exist on disk, and all six task commits (8527fd43, 81989c61, 87db1746, 9dba7cba, 32ed7e9a, ee11385e) are ancestors of HEAD. The acceptance criteria above were re-run after the last commit.
