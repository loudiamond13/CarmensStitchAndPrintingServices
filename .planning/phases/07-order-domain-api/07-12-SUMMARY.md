---
phase: 07-order-domain-api
plan: 12
subsystem: api
tags: [orders, order-expenses, payer, profit, create-body, optimistic-concurrency, audit, migration, openapi]
created: "2026-10-28T15:35:00-05:00"
updated: "2026-10-28T15:35:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-05 Order aggregate, NewOrder, CreateOrderHandler, OrderReader, OrderFixtures; 07-09 OrderChildWrite and IOrders.LockAsync; 07-10 discounts; 07-11 payments, the Position column, OrderChildAudit.Then, the row-version re-read in OrderStore.FindAsync, IStaffDirectory CanPay"
provides:
  - "OrderExpenses table (migration AddOrderExpenses): ExpenseDate date, Amount decimal(18,2) above 0, OrderExpenseCategoryId, Description up to 200, PaidByUserId required, Position, cascade from Orders, category and person keys NO ACTION, five indexes (the payer index carries Amount and ExpenseDate for Phase 10)"
  - "POST, PUT and DELETE /api/v1/orders/{orderId}/expenses[/{expenseId}] (Staff): add, edit and remove order expenses, each answering 200 with the whole order, expenses and profit recomputed by OrderMath, balance untouched, and a new version"
  - "An expenses array on POST /api/v1/orders, saved in the same transaction; errors on expenses[i].field, the 100 limit on expenses"
  - "OrderExpense entity, NewOrderExpense, NewOrder.Expenses, Order.AddExpense/UpdateExpense/RemoveExpense, OrderExpenseChanges, OrderRules.CheckExpense and the expense messages"
  - "D-30 rules: amount above 0.00 to 1,000,000.00 with at most 2 decimals; any past date and up to 30 days ahead in Manila (Phase 6 message format); description optional, up to 200; at most 100 per order"
  - "The payer rule (ORD-23, OD-21): CanPay on add, on a changed payer and in the create body; a saved payer who is no longer eligible may stay; the detail shows paidBy (with formerStaff) and paidByActive; recordedBy stays the person who typed it in"
  - "Category rule (D-17): a new or changed category must exist and not be retired; a saved retired category may stay"
  - "Error codes orders.expense-not-found and orders.too-many-expenses"
  - "OrderAuditDetail.ExpenseAdded/ExpenseChanged/ExpensePayerChanged/ExpenseRemoved; a payer change is its own order-expense.payer-changed entry"
  - "ORD-2026-0148 closed end to end: one create with five items, the 5% discount, two payments and three expenses gives 22,450.00 / 1,122.50 / 21,327.50 / 12,000.00 / 9,327.50 / 6,065.00 / 15,262.50 exactly"
  - "Expenses section in docs/api/orders.md; refreshed OpenAPI contract and generated types"
affects: [07-13, 07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 49600
  tasks: 3
  commits: 6
plan_head_before: b5a0be55deb038d465d01c672f0138cf9e2ff7d7
plan_head_after: 1944c9f80a8f5ffcbcf19ad679e545d6ae5a8eb7

tech-stack:
  added: []
  patterns:
    - "A child list with a person field copies the payment slice one for one: entity with Position, configuration with the matching SoftDelete filter, Add/Update/Remove handlers over OrderChildWrite, person checked only when the edit changes them"
    - "Category and payer checks for the create body run over distinct ids with one lookup each, on the indexed path (expenses[1].paidByUserId)"
    - "Phase 6 company-expense messages are reused for the order expense date, amount, description, category and payer, so both screens say the same words"

key-files:
  created:
    - src/Csps.Domain/Orders/OrderExpense.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderExpenseConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028200438_AddOrderExpenses.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028200438_AddOrderExpenses.Designer.cs
    - src/Csps.Application/Orders/IOrderExpenseFields.cs
    - src/Csps.Application/Orders/OrderExpenseFieldsValidator.cs
    - src/Csps.Application/Orders/AddOrderExpenseRequest.cs
    - src/Csps.Application/Orders/AddOrderExpenseRequestValidator.cs
    - src/Csps.Application/Orders/AddOrderExpenseHandler.cs
    - src/Csps.Application/Orders/UpdateOrderExpenseRequest.cs
    - src/Csps.Application/Orders/UpdateOrderExpenseRequestValidator.cs
    - src/Csps.Application/Orders/UpdateOrderExpenseHandler.cs
    - src/Csps.Application/Orders/RemoveOrderExpenseHandler.cs
    - src/Csps.Server/Controllers/OrderExpensesController.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderExpenseTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderExpenseHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderExpensesMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderExpensesEndpointTests.cs
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
    - tests/Csps.Application.UnitTests/Orders/OrderPaymentHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/UpdateOrderDetailsHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderModelTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderPeopleTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md
    - docs/operations/audit-log.md

key-decisions:
  - "Order expenses reuse the Phase 6 company-expense words for the date, amount, description, category and payer, so staff see the same sentences on both screens and only three new sentences need the owner's eye."
  - "OrderExpenses has a Position column, like OrderItems, OrderDiscounts and OrderPayments, so create-body paths expenses[i].x match the stored order. Expenses show oldest expense date first, then by position."
  - "The changed audit entry shows the payer as it now is and a new payer also writes its own order-expense.payer-changed entry, the same shape as payments (receiver)."
  - "Category and payer are checked against the database only when an edit changes them, so a saved retired category and a saved payer who was deactivated since may stay."
  - "Order.Create asks for the business today when the order has payments or expenses; without it is a programming error, not a silent pass."
  - "Expenses are counted in Order.Figures for every money rule, so the payment balance check and every recalculation see them; OrderMath stays the only place money is worked out."

patterns-established:
  - "Pattern: a second person-bearing child list (expenses with payer) is a copy of the first (payments with receiver); the shared flow in OrderChildWrite did not need to change"

requirements-completed: [ORD-05, ORD-23, ORD-20, ORD-03]

coverage:
  - id: P1
    description: "A staff member records an expense paid by a Manager; expenses 3,825.00, profit 17,502.50, balance unchanged; the expense shows category, paidBy, paidByActive and recordedBy"
    requirement: ORD-23
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderExpensesEndpointTests.cs#AnAdminRecordsAnExpensePaidByAManagerAndTheExpensesAndProfitUpdateWithTheBalanceUntouched"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderExpensesMigrationTests.cs"
        status: pass
    human_judgment: false
  - id: P2
    description: "ORD-20: the full ORD-2026-0148 aggregate in one create gives subtotal 22,450.00, discount 1,122.50, total 21,327.50, paid 12,000.00, balance 9,327.50, expenses 6,065.00 and profit 15,262.50 exactly, with 5 items, 2 payments, 1 discount and 3 expenses"
    requirement: ORD-20
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#TheFullOrd0148BodyGivesAllSevenFiguresExactlyWithItsItemsPaymentsDiscountAndExpenses"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderExpenseTests.cs#CreatingAnOrderWithExpensesGivesTheOrd0148Figures"
        status: pass
    human_judgment: false
  - id: P3
    description: "D-30 field rules at their edges: amount 0.01 to 1,000,000.00 with at most 2 decimals, a date any day in the past and up to 30 days ahead, description up to 200, at most 100 expenses (422 orders.too-many-expenses), each with its message"
    requirement: ORD-05
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderExpenseTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderExpenseHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderExpensesEndpointTests.cs#EveryExpenseFieldRuleAnswersA400OnItsField"
        status: pass
    human_judgment: false
  - id: P4
    description: "D-17: a new or switched category must be active; keeping a saved retired category on an edit is allowed"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderExpensesEndpointTests.cs#ARetiredCategoryIsRefusedOnAddAndOnSwitchButAKeptRetiredCategoryMayBeEdited"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderExpenseHandlerTests.cs#UpdateKeepingASavedRetiredCategoryIsAllowedAndTheListIsNotAsked"
        status: pass
    human_judgment: false
  - id: P5
    description: "ORD-23: a deactivated, Manager-locked, soft-deleted, invited, role-less or never-signed-in payer and the Legacy holder are each refused on add, on a payer change and in the full create (expenses[1].paidByUserId) with the exact message; an active Admin and Manager are accepted; a saved payer deactivated later still shows (paidByActive false) and the expense can be edited without changing them; a deleted payer keeps their name as former staff"
    requirement: ORD-23
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPeopleTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderExpenseHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: P6
    description: "D-31 / ORD-23 / SEC-08: expense add, change, remove each write one entry with the documented keys and never the description; a payer change writes its own order-expense.payer-changed entry; a refusal or a no-op writes none; an expense recorded by an Admin and paid by a Manager reads paidBy the Manager and recordedBy the Admin"
    requirement: ORD-23
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderExpensesEndpointTests.cs#EachAddEditPayerChangeAndRemoveWritesItsOwnEntryForTheOrderWithNoDescriptionText"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderExpensesEndpointTests.cs#ARefusalAndANoOpEditWriteNoEntryAndKeepTheVersion"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderExpensesEndpointTests.cs#AnExpenseRecordedByAnAdminAndPaidByAManagerReadsPaidByTheManagerAndRecordedByTheAdmin"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs"
        status: pass
    human_judgment: false
  - id: P7
    description: "T-07-33: an expense id from another order is never found on edit or remove (404 orders.expense-not-found) and the other order's expense is unchanged; a stale version is 409 edit.stale and stores nothing"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderExpensesEndpointTests.cs#AnExpenseIdFromAnotherOrderIsNeverFoundOnEditOrRemove"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderExpensesEndpointTests.cs#AStaleVersionOnAddOrEditIs409AndNothingIsStored"
        status: pass
    human_judgment: false
  - id: P8
    description: "Editing and removing an expense recompute expenses and profit and leave the balance; the create body lists category, payer and date errors on their indexed paths"
    requirement: ORD-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderExpensesEndpointTests.cs#EditingAndRemovingAnExpenseRecomputeTheExpensesAndTheProfitAndLeaveTheBalance"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#ExpenseErrorsInTheBodyAreListedOnTheirIndexedPaths"
        status: pass
    human_judgment: false
  - id: P9
    description: "The three new expense messages and the expenses section of docs/api/orders.md read clearly to a person"
    requirement: ORD-05
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's call; no test judges prose. The messages the plan did not spell out are listed under Deferred Issues."

duration: 35 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 12: Order expenses with who paid them Summary

**Staff can record, correct and remove what an order cost, each expense naming who paid it, through POST, PUT and DELETE under /api/v1/orders/{orderId}/expenses or in the create body. Expenses and profit are worked out by OrderMath and never touch the balance, only an eligible Admin or Manager can be named as payer, and one create call now reproduces the whole ORD-2026-0148 order: subtotal 22,450.00, discount 1,122.50, total 21,327.50, paid 12,000.00, balance 9,327.50, expenses 6,065.00 and profit 15,262.50.**

## Performance

- **Duration:** about 35 min
- **Started:** about 2026-10-28T19:55Z
- **Completed:** 2026-10-28T20:32Z
- **Tasks:** 3 of 3
- **Files changed:** 50 files in all, 7,327 added lines (about 49,600 tokens of hand-written lines, chars/4, with the OpenAPI JSON, the generated types and the migration left out)

## Accomplishments

- Task 1 (tracer): the `OrderExpenses` table and migration, the `OrderExpense` entity, `Order.AddExpense` with every field rule, expenses counted in the order's figures, the reader (category with retired flag, `paidBy` with `formerStaff`, `paidByActive` projected in LINQ from the CanPay rule), category and payer checks in `OrderReferenceChecks`, the add request, validator, handler and POST route, the matrix row and the refreshed contract.
- Task 2: `Order.UpdateExpense` and `RemoveExpense`, `OrderExpenseChanges`, `NewOrder.Expenses` in `Create`, the PUT and DELETE routes, expenses in the create body with indexed category and payer checks, the `Ord0148FullBody` fixture and its seven exact figures, the payer cases in `OrderPeopleTests`, the expenses section of `docs/api/orders.md`.
- Task 3: the audit tests for all four expense entries, the separate payer entry, the refusal and no-op cases, and the Admin-records / Manager-pays attribution case; the audit-log page now says how a changed entry shows the payer.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | 69c7d0fd `test(07-12): record order expenses (RED)` | f5ce6430 `feat(07-12): record order expenses with who paid them (ORD-23)` |
| 2 | 3209ed15 `test(07-12): expense rules, payers and the full ORD-2026-0148 create (RED)` | bfd84659 `feat(07-12): expense rules, the payer rule and the full fixture create (D-30, ORD-20, ORD-23)` |
| 3 | 7c125a9a `test(07-12): order expense audit entries and the separate payer entry` | 1944c9f8 `docs(07-12): audited order expenses (D-31, ORD-23)` |

- **Task 1 RED:** 3 of 3 endpoint tests failed (the route did not exist: 404 where 200, 401 and `orders.not-found` were expected) and 8 of 8 migration tests failed (`Invalid object name 'OrderExpenses'`). Valid assertion failures. `gsd_run check tdd-red-evidence` was not run (this runner's output is none of TAP, JUnit or Surefire); the failing output was read by hand.
- **Task 2 RED:** the Domain and Application test projects did not build (`UpdateExpense`, `RemoveExpense`, `UpdateOrderExpenseHandler`, `OrderExpenseRequest` and friends missing: a compile-time RED). At runtime 2 of 41 create endpoint cases, 9 of 20 `OrderPeopleTests`, 4 of 9 expense endpoint cases and 6 matrix cases failed. The others passed because the tracer already carried the add and the field rules.
- **Task 3 RED:** the audit code arrived with the handlers in Tasks 1 and 2 (`OrderChildWrite` saves nothing without an audit entry), so the audit tests passed the first time and are regression proof, not new red. To prove they have teeth, the `Then = payer` link in `UpdateOrderExpenseHandler` was removed for one run: `EachAddEditPayerChangeAndRemoveWritesItsOwnEntry...` failed, the other 11 expense cases passed. The code was restored before the commit. The Task 3 "GREEN" commit is therefore a documentation commit (`docs`), not a `feat`.
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with automated-only `<verify>`, so the verify commands were re-run after GREEN (`OrderExpensesEndpointTests` 3 passed, `OrderExpensesMigrationTests` 8, `MigrationScriptTests` 6, `OrderModelTests` 3; also `*Authorization*` 288, `TriggerInventoryTests` 2, `*Idempotency*` 54) before expansion. Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- Preflight before the integration runs: ports 5180, 5115, 7028, 5199 all free, no dev or test processes.
- `Csps.Domain.UnitTests`: 1103 passed. `Csps.Application.UnitTests`: 1596 passed. `Csps.ArchitectureTests`: 241 passed (including the no-inline-SQL tests).
- `Csps.Server.IntegrationTests` (full run): 1540 total, 1540 passed, 0 failed, 0 skipped. The known slow-machine `ExpenseListTimingTests` passed in this run (owner ruling D-76 stands).
- `Csps.Infrastructure.IntegrationTests` (full run): 661 total, 660 passed, 0 failed, 1 skipped (not touched by this plan; the same skip as in 07-09 to 07-11). Included `OrderExpensesMigrationTests` 8, `MigrationScriptTests` 6, `OrderModelTests` 3 and `TriggerInventoryTests` 2.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (2107/2107), branch 100% (838/838); Csps.Application line 98% (5344/5448), branch 94.6% (not gated). "Coverage gate passed."
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The snapshot was refreshed twice (Task 1 and Task 2) with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command only.
- Acceptance criteria: `IX_OrderExpenses_PaidByUserId` in `OrderExpenseConfiguration.cs` 1 (exactly 1); `HasQueryFilter("SoftDelete"` in it 1 (exactly 1); `15262.50` in `CreateOrderEndpointTests.cs` 2 (at least 1); `Ord0148FullBody` in `OrderFixtures.cs` 1 (at least 1); `OrderExpensePayerChanged` in `UpdateOrderExpenseHandler.cs` 1 (exactly 1).
- gitleaks on each staged change: no leaks. Only fake values appear (the fake customer, `example.com` emails, the UI-spec expense descriptions). No em or en dash in any changed file. No SQL string, trigger, package or JSON column was added. The migration creates one table and drops nothing.

## Task Commits

1. **Task 1: tracer, record expenses** - RED `69c7d0fd` (test), GREEN `f5ce6430` (feat)
2. **Task 2: every rule, the payer rule, the full create** - RED `3209ed15` (test), GREEN `bfd84659` (feat)
3. **Task 3: audit** - tests `7c125a9a` (test), docs `1944c9f8` (docs)

## Decisions Made

See key-decisions above. The one the owner should know about is the extra `Position` column (below).

## Deviations from Plan

### Auto-fixed Issues

None. No bug was found in earlier code and nothing needed a fix outside this plan's own work.

### Plan notes (no behaviour change beyond what the plan states, except as noted)

- **`Position` column on `OrderExpenses` (Rule 2, correctness).** The plan's column list had no ordering column. Without one, the create body paths `expenses[i].x` could not match what was stored and the expenses could come back in any order. `Position int NOT NULL` mirrors `OrderItems`, `OrderDiscounts` and `OrderPayments` (07-11 did the same). It is a new column on a new table: no drop, no rename, no lossy change. Expenses show oldest expense date first, then by position.
- **Audit code arrived in Tasks 1 and 2, not Task 3.** `OrderChildWrite` saves nothing when the change returns no audit entry, so `ExpenseAdded` was needed in Task 1 and `ExpenseChanged`, `ExpensePayerChanged` and `ExpenseRemoved` in Task 2. Task 3 added the tests for them (all passed the first time, teeth shown by the one-run removal above).
- **Full field rules in Task 1.** The validator and `OrderRules.CheckExpense` are shared by add, edit and the create body, so writing half of them would have been throwaway code. Task 2's boundary tests mostly passed the first time and are regression proof.
- **`OrderFixtures.Ord0148FullBody` takes arguments** (the business today, the Admin's id and the Manager's id) instead of none, because the payers and the dates come from the test staff and the clock.
- **`Order.Create` needs the business today when the order has expenses as well as payments.** Without it is an `ArgumentException`, as for payments. Existing callers are unchanged.
- **Expense words reuse `ExpenseRules`.** `OrderRules.PaidByRequired`, `PaidByInactive`, `ExpenseCategoryRequired`, `ExpenseCategoryRetired` and `ExpenseDaysAhead` point at the Phase 6 values, and the date, amount and description sentences are the Phase 6 ones. The plan fixed the date, category and payer sentences; the rest matches them.
- **Migration file name.** The plan says `20261028000006_AddOrderExpenses`; EF generated `20261028200438_AddOrderExpenses` (the real timestamp). The Up and Down were read: one table, its check, five foreign keys, five indexes (the payer index includes `Amount` and `ExpenseDate`); Down drops only that table.
- **Files beyond the plan's list:** `OrderConfiguration.cs` (the expenses relation), `OrderModelTests.cs` (the SoftDelete-by-name check now covers `OrderExpense`), `CreateOrderHandlerTests.cs` and the four other handler test files whose `OrderDetailResponse` literal needed the new `Expenses` argument, `OrderFixtures.cs` helpers (`ExpenseBody`, `ExpenseItem`, `AddExpenseAsync`, `PutExpenseAsync`, `DeleteExpenseAsync`, `AddExpenseAndReadAsync`, `AddExpenseCategoryAsync`, `RetireExpenseCategoryAsync`, the seeded category ids) and `docs/operations/audit-log.md` (one sentence on the changed entry).
- **`OrderErrors.ExpenseNotFound` and `TooManyExpenses`** re-expose the `OrderRules` values, as the payment ones do.
- **Tooling:** one multi-line shell command with a here-document did not run (shell parse error, nothing executed); the edit was redone with a small script file. No file was affected.

**Total deviations:** 0 auto-fixed, 1 small addition (Position), 8 plan notes. **Impact:** none on scope; one new column on the new table.

## Issues Encountered

- The shell parse error above. No effect on the code.
- `Csps.Infrastructure.IntegrationTests` reports one skipped test; it is not in code this plan touched.

## Deferred Issues

- **For the owner: wording of the three new expense messages.** The plan fixed the date, category and payer sentences, and the date, amount, description, category and payer sentences are the Phase 6 company expense ones. Three sentences are new, written in the same plain style as the 07-10 and 07-11 messages. Phase 8 mirrors them in zod:
  - "Fill in this expense." (an empty slot in the create list)
  - "An order can have at most 100 expenses."
  - "This expense was not found on this order."
- **For the owner: the changed audit entry shows the payer as it now is**, and a new payer also writes its own `order-expense.payer-changed` entry. This is the same shape as payments (receiver). The audit-log page now says so. Say if you want the old person in the changed entry instead.
- Expenses, like items, discounts and payments, are allowed on a Completed or Cancelled order until plan 07-13 adds the D-05 end-state lock (422 `orders.locked`). That is not an open question.
- The `ExpenseListTimingTests` machine-speed failure in `deferred-items.md` did not fail in this plan's full run; owner ruling D-76 stands.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-07-32 (an ineligible person or the Legacy holder named as payer) is mitigated by `CanPay` on every new or changed payer, by `OrderPeopleTests` over every blocked state, and by the separate payer-changed audit entry. T-07-33 (another order's expense by id) is mitigated by loading expenses only through their order and `AnExpenseIdFromAnotherOrderIsNeverFoundOnEditOrRemove`. T-07-34 (the description in the audit log) is mitigated: the audit detail has no description text, only `fields=description`, proved by `OrderAuditDetailTests` and the endpoint audit test. No package was added.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 07-13. Refunds copy the same flow once more: `OrderChildWrite.SaveFormAsync` for add and edit (with `Then` when one change needs two entries), `ConflictRetry` plus `AttemptAsync` for remove, `Order.Figures(...)` and `Recalculate` (the refunds list is still passed as empty; expenses are now passed), and `OrderReferenceChecks.AddPayerFailureAsync` / `AddReceiverFailureAsync` for a person field. The D-05 end-state lock (`orders.locked`) goes in front of every child write, including the three expense routes. Phase 10 reads money on hand from `IX_OrderPayments_ReceivedByUserId` and `IX_OrderExpenses_PaidByUserId` (both carry the amount and the date).

## Self-Check: PASSED

All 18 spot-checked key files (the new entity, configuration, migration pair, validators, handlers, controller and the four test classes) exist on disk, and all six task commits (69c7d0fd, f5ce6430, 3209ed15, bfd84659, 7c125a9a, 1944c9f8) are ancestors of HEAD. The acceptance criteria above were re-run after the last commit.
