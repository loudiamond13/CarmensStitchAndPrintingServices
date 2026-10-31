---
phase: 07-order-domain-api
plan: 05
subsystem: api
tags: [orders, order-aggregate, order-number, totals-snapshot, soft-delete-filter, idempotency, audit, ef-core, migration, openapi]
created: "2026-10-28T10:55:00-05:00"
updated: "2026-10-28T10:55:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-01 order lists, ProductType, AuditActions.OrderCreated and the audit detail format; 07-02 OrderMath with refunds and credit; 07-03 OrderStatus and OrderStatusRules.IsActive"
provides:
  - "POST /api/v1/orders (Staff, Idempotency-Key) creating an order with items in one transaction, 201 with Location, and GET /api/v1/orders/{id} for both roles"
  - "The Order aggregate (Create, AssignNumber, private Recalculate and Touch), OrderItem, OrderStatusChange, OrderNumberCounter, OrderRules (all limits and messages), OrderNumber (Format, TryParse)"
  - "Migration 20261028152204_AddOrders: Orders, OrderItems, OrderStatusChanges, OrderNumberCounters, the lock row order-numbers (66 standing rows), checks CK_Orders_Status/Total/Balance/CustomerCredit"
  - "Per-year numbering ORD-{YYYY}-{NNNN} under DatabaseLocks.OrderNumbers with EF tracking only"
  - "Shared IOrderDetailsFields/IOrderItemFields validators, OrderReferenceChecks, IOrderLists.GetStatesAsync, nested camelCase ValidationResults"
  - "OrderFixtures (ValidBody, Ord0148ItemsBody, PostAsync, CreateAsync, ReadDetailAsync) for every later order test"
  - "docs/api/orders.md and the refreshed OpenAPI contract"
affects: [07-06, 07-07, 07-08, 07-09, 07-10, 07-11, 07-12, 07-13, 07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 57000
  tasks: 3
  commits: 6
plan_head_before: edbf15eca5c4c7c038c7ab5dafc6e5bc4c88349b
plan_head_after: 7077fbd343a669494a22ccff95d15d26772df837

tech-stack:
  added: []
  patterns:
    - "Children bind through scalar EF constructors (internal) and get their Order navigation set by the aggregate, so Csps.Domain stays at 100% line and branch with no parameterless EF constructor"
    - "Order.Create checks everything before any lock; AssignNumber runs inside the transaction after the lock, so a refused order takes no number"
    - "Matching SoftDelete query filter on the root and both children through child.Order.DeletedAtUtc (Pitfall 5), proved by a model test with a capture that is itself proved by a deliberately mismatched model"

key-files:
  created:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Domain/Orders/OrderItem.cs
    - src/Csps.Domain/Orders/OrderStatusChange.cs
    - src/Csps.Domain/Orders/OrderRules.cs
    - src/Csps.Domain/Orders/OrderNumber.cs
    - src/Csps.Domain/Orders/OrderNumberCounter.cs
    - src/Csps.Domain/Orders/OrderTotals.cs
    - src/Csps.Domain/Orders/OrderInputs.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderItemConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderStatusChangeConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderNumberCounterConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028152204_AddOrders.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028152204_AddOrders.Designer.cs
    - src/Csps.Infrastructure/Orders/OrderStore.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - src/Csps.Infrastructure/Orders/OrderNumberAllocator.cs
    - src/Csps.Application/Ports/IOrders.cs
    - src/Csps.Application/Ports/IOrderReader.cs
    - src/Csps.Application/Ports/IOrderNumbers.cs
    - src/Csps.Application/Ports/OrderNumberBusyException.cs
    - src/Csps.Application/Orders/CreateOrderRequest.cs
    - src/Csps.Application/Orders/CreateOrderRequestValidator.cs
    - src/Csps.Application/Orders/IOrderDetailsFields.cs
    - src/Csps.Application/Orders/OrderDetailsFieldsValidator.cs
    - src/Csps.Application/Orders/IOrderItemFields.cs
    - src/Csps.Application/Orders/OrderItemFieldsValidator.cs
    - src/Csps.Application/Orders/CreateOrderHandler.cs
    - src/Csps.Application/Orders/GetOrderHandler.cs
    - src/Csps.Application/Orders/OrderDetailResponse.cs
    - src/Csps.Application/Orders/OrderStatusNames.cs
    - src/Csps.Application/Orders/OrderErrors.cs
    - src/Csps.Application/Orders/OrderReferenceChecks.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Server/Controllers/OrdersController.cs
    - docs/api/orders.md
    - tests/Csps.Domain.UnitTests/Orders/OrderTests.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderNumberTests.cs
    - tests/Csps.Application.UnitTests/Common/ValidationResultsTests.cs
    - tests/Csps.Application.UnitTests/Orders/CreateOrderRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrdersMigrationTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderModelTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs
    - tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderAttributionTests.cs
  modified:
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs
    - src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/Orders/OrdersRegistration.cs
    - src/Csps.Infrastructure/OrderLists/OrderListStore.cs
    - src/Csps.Application/Ports/IOrderLists.cs
    - src/Csps.Application/Common/ValidationResults.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Idempotency/IdempotencyGateTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "The migration is named AddOrders; the real file name is 20261028152204_AddOrders (the tool made the timestamp). Up creates four tables, inserts the lock row order-numbers, and adds the checks and indexes; Down drops only what Up made. No trigger, no JSON column, no drop of existing data."
  - "Order.Create(NewOrder, callerId, now) has no today parameter: nothing at create reads it, and an unused parameter would be dead code. Plan 07-10 and 07-11 add it back when payments and discounts need the business today."
  - "IOrderReader.GetDetailAsync returns OrderDetailResponse directly (one shape, no separate view record). Status keys come from OrderStatusNames, so the reader and the handlers agree."
  - "OrderNumber.TryParse leaves both outputs at zero on any failure (found by a RED test: an overflowing sequence used to leave the year set)."
  - "CreateOrderRequest.Items is IReadOnlyList<OrderItemRequest> (non-null elements) so FluentValidation's child validator type-checks under nullable rules; a JSON null element still arrives as null and is refused on items[n] with 'Fill in this item.'"
  - "A lock wait that times out surfaces as OrderNumberBusyException (an InvalidOperationException carrying OrderErrors.BusyMessage) and answers 409 orders.busy; DatabaseLocks.TakeAsync already maps timeout and deadlock to that message."
  - "Tests that assert 'first order of the year is 0001' call database.ResetAsync() first, because the class fixture shares one database; Respawn empties OrderNumberCounters."

requirements-completed: [ORD-03, ORD-13, ORD-14, ORD-16, ORD-20]

coverage:
  - id: D1
    description: "A staff member creates an order with items and reads it back with its number, items, exact totals and first history row; a Manager reads the same body"
    requirement: ORD-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#AnAdminCreatesAnOrderAndGets201WithTheNumberItemsTotalsAndFirstHistoryRow"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#AManagerReadsTheSameOrderById"
        status: pass
    human_judgment: false
  - id: D2
    description: "The number is ORD-{business year}-{NNNN}, gapless per year, taken under the order-numbers lock; the year is the business year of the save, not the order date"
    requirement: ORD-14
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#ASecondCreateGetsTheNextNumber"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs#ASuccessTakesTheNumberOfTheBusinessYearAddsTheOrderOnceAndSavesOnceInOneTransaction"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderNumberTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "The ORD-2026-0148 items give subtotal 22450.00 and the other figures, computed by OrderMath through Order.Recalculate and stored on the Orders row"
    requirement: ORD-20
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#TheFiveItemsOfOrderZeroOneFourEightGiveAnExactSubtotalAndTheOtherFigures"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderTests.cs#TheSnapshotEqualsWhatOrderMathGivesForTheItems"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every item and detail rule holds at its boundary on both server layers with the owner's messages, nested camelCase paths and one 400 listing every field; product types are checked in the database"
    requirement: ORD-13
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/CreateOrderRequestValidatorTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#AProductTypeMarkedRetiredInTheDatabaseIsRefusedOnTheItemPath"
        status: pass
    human_judgment: true
    rationale: "The plain-English field messages (for example the email and contact number wording) were written in this plan from the owner's rules; no test judges the wording."
  - id: D5
    description: "The first status history row is written with the order (from null, to the created status, by the caller) and returned as statusHistory"
    requirement: ORD-16
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderTests.cs#TheFirstHistoryRowGoesFromNothingToTheCreatedStatusByTheCallerAtTheSaveTime"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderAttributionTests.cs#ForgedAttributionNumberTotalsAndDeletionMembersInTheBodyAreIgnored"
        status: pass
    human_judgment: false
  - id: D6
    description: "The create is audited (order.created, no customer text), idempotent (one order, one number, one audit row on a replay), attributed from the token, and the EF model builds with no warning"
    requirement: ORD-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#TheSameKeyAndBodyTwiceGiveTwoIdentical201sOneOrderOneNumberAndOneAuditRow"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#EveryCreateLeavesOneAuditEntryWithTheNumberStatusDatesItemCountAndTotalButNoCustomerText"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderModelTests.cs"
        status: pass
    human_judgment: false
  - id: D7
    description: "The four order tables, their checks (status, total, balance, credit, item quantity and price, counter), keys, cascade and indexes, and the 66th standing lock row"
    requirement: ORD-14
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/OrdersMigrationTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs"
        status: pass
    human_judgment: false

duration: 39 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 05: Create an order and read it back Summary

**Staff can POST an order with items and GET it back: a per-year number taken under a database lock, money figures computed by OrderMath and stored, the first status history row, every field rule enforced on both server layers with a single 400, and the create audited, idempotent and attributed from the token.**

## Performance

- **Duration:** about 39 min
- **Started:** 2026-10-28T15:14Z
- **Completed:** 2026-10-28T15:53Z
- **Tasks:** 3 of 3
- **Files changed:** 56 hand-written (about 57,000 tokens of diff, chars/4, with the migration files, the OpenAPI JSON and the generated types left out), 61 in all

## Accomplishments

- Task 1 (tracer): the `Order` aggregate with items, history and a stored totals snapshot; four tables in migration `20261028152204_AddOrders`; the `order-numbers` lock row; `OrderNumberAllocator`; `POST /orders` and `GET /orders/{id}`; matrix rows; refreshed contract. Proven end to end before anything else was built on it.
- Task 2: `OrderDetailsFieldsValidator`, `OrderItemFieldsValidator` and `CreateOrderRequestValidator` (reused by the edit and item routes in 07-07 and 07-08); `OrderReferenceChecks` merges unknown or retired product types into the same 400; `ValidationResults` now camelCases every dotted segment (`items[1].unitPrice`); `IOrderLists.GetStatesAsync`.
- Task 3: `OrderAuditDetail.Created` and one `order.created` entry in the create save; replay, attribution and audit proofs; `OrderModelTests` shows the filtered order tables log no EF warning; `docs/api/orders.md`.

## Migration

`src/Csps.Infrastructure/Persistence/Migrations/20261028152204_AddOrders.cs`. Up: `CreateTable` for `OrderNumberCounters` (Year key, `CK_OrderNumberCounters_LastValue`), `Orders` (unique `IX_Orders_Number`, `CK_Orders_Status`, `CK_Orders_Total`, `CK_Orders_Balance`, `CK_Orders_CustomerCredit`, three NO ACTION user keys, `DeletedAtUtc` and `DeletedById`), `OrderItems` (`CK_OrderItems_Quantity_NonNegative`, `CK_OrderItems_UnitPrice_NonNegative`, cascade from Orders, NO ACTION to ProductTypes) and `OrderStatusChanges` (cascade from Orders); one `InsertData` for the lock row `order-numbers`; ten indexes. Down: drops the four tables and deletes that lock row. No trigger, no JSON column, no drop of existing data.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | 27041f1c `test(07-05): create and read an order end to end (RED)` | bbdad172 `feat(07-05): create an order and read it back (ORD-03, ORD-14)` |
| 2 | dd61a167 `test(07-05): order details and item rules (RED)` | 54fa6c6c `feat(07-05): order details and item rules on both layers (D-21, D-22, D-30)` |
| 3 | 7151fa6b `test(07-05): audited, idempotent, token-attributed order create (RED)` | 7077fbd3 `feat(07-05): audited, idempotent order create with token attribution (D-31, SEC-06, SEC-08)` |

- **Task 1 RED:** 7 of 7 endpoint tests failed on `HttpStatusCode.NotFound` against the expected 201, 200, 401 and 400 (the route did not exist); the migration tests failed with "Invalid object name 'Orders'" and the lock test with 65 not 66. Valid assertion failures. `gsd_run check tdd-red-evidence` was not run (this runner's output is none of TAP, JUnit or Surefire); the failing output was read by hand.
- **Task 2 RED:** the Application tests did not build (`CreateOrderRequestValidator`, `OrderDetailsFieldsValidator`, `GetStatesAsync` missing): a compile-time RED. At runtime 3 of 28 endpoint tests failed (unknown product type, retired product type, many-field 400) and one `OrderNumberTests` case failed (`ORD-2026-99999999999` left the year set). **Honest note:** the Domain boundary tests passed at this RED, because the aggregate in Task 1 already had to enforce every rule to be production quality; they are regression proof, not new red.
- **Task 3 RED:** `OrderAuditDetailTests` and the new handler harness did not build (`OrderAuditDetail`, the audit constructor argument missing), and 2 of 34 endpoint tests failed (no audit entry). **Honest note:** the attribution, replay and model-warning tests passed at RED, because the request record, the idempotency gate and the matching filters were part of the Task 1 design; they are guards, and `OrderModelTests` proves its own capture by also asserting that a deliberately mismatched model does log the warning.
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with an automated-only verify, so all five verify commands were re-run after GREEN (7, 60 tests) and passed before expansion. Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- `Csps.Domain.UnitTests`: 986 passed. `Csps.Application.UnitTests`: 1356 passed. `Csps.ArchitectureTests`: 241 passed.
- `Csps.Infrastructure.IntegrationTests`: 627 passed, 1 skipped (pre-existing), 0 failed (includes `OrdersMigrationTests`, `DatabaseLocks*`, `MigrationScriptTests`, `TriggerInventoryTests`, `OrderModelTests`).
- `Csps.Server.IntegrationTests`: 1375 total, 1374 passed, 1 failed: `ExpenseListTimingTests` (known, see Issues). Included: `CreateOrderEndpointTests` 31, `OrderAttributionTests` 3, `*Authorization*`, `*Idempotency*`, `*OpenApiSnapshotTests` 10.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (1591/1591), branch 100% (612/612); Csps.Application line 98.3% (4113/4180), branch 94.5% (not gated). "Coverage gate passed."
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." `npm --prefix web run typecheck`: clean.
- Acceptance criteria re-run: `HasQueryFilter("SoftDelete"` 1+1+1 across the three configurations; `order-numbers` in `DatabaseLocks.cs` 1; `OrderMath.Compute` in `Order.cs` 2; `.Sum(` in `Application/Orders` and `Infrastructure/Orders` none; `/api/v1/orders` in the matrix 2 rows plus comments; `PrecisionScale` 1; "The due date can't be before the order date." 1; `GetStatesAsync` in `IOrderLists.cs` 1; `OrderCreated` in `CreateOrderHandler.cs` 1; `D-23` in `docs/api/orders.md` 2; `created:` key present.
- gitleaks on each staged change: no leaks. No real names, emails (`juan.dc@example.com` only), local paths or connection strings in the staged diffs. No en or em dash in the changed `src` files or `docs/api/orders.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `OrderNumber.TryParse` left the year set when the sequence overflowed**
- **Found during:** Task 2 RED (`ORD-2026-99999999999`)
- **Issue:** the `out` values were assigned inside the `&&` chain, so a later failure left the year at 2026.
- **Fix:** parse into locals, assign both outputs only on success.
- **Files modified:** `src/Csps.Domain/Orders/OrderNumber.cs`
- **Commit:** 54fa6c6c

**2. [Rule 1 - Bug] `ValidationResults` lower-cased only the first character of a nested path**
- **Found during:** Task 2 (the plan lists this as a required change; the unit test showed `Items[1].UnitPrice` became `items[1].UnitPrice`)
- **Fix:** every dotted segment now starts lower case.
- **Files modified:** `src/Csps.Application/Common/ValidationResults.cs`
- **Commit:** 54fa6c6c

**3. [Rule 3 - Blocking] `IdempotencyGateTests` counted 65 standing lock rows**
- **Found during:** Task 1 (the 66th row is new)
- **Fix:** the expected count is 66.
- **Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Idempotency/IdempotencyGateTests.cs`
- **Commit:** 27041f1c

### Plan notes (no behaviour change)

- `Order.Create` has no `today` parameter (see key-decisions).
- `IOrderReader` returns `OrderDetailResponse` directly, so there is no separate view record.
- `CreateOrderRequest.Items` has non-null element type (see key-decisions).
- The domain children use scalar EF constructors instead of parameterless ones, so the Domain coverage gate stays at 100% with no exclusion.
- The Task 1 handler mapped the request itself and returned the first failure; Task 2 replaced that with the validator. This is the plan's own order ("Task 2 adds validation").

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking test count), 5 plan notes. **Impact:** none on scope.

## Issues Encountered

- `ExpenseListTimingTests` ("five years, last page, size 100") failed in the full Server run and again alone: p95 351.9 ms against the 300 ms limit (default window p95 130.8 ms, search 154.2 ms, KPIs 12.6 ms). It reads the company expense list, which this plan does not touch. It is the same pre-existing slow-machine failure recorded in `deferred-items.md` (plan 07-01), Phase 6 plan 06-10 and owner ruling D-76. Not hidden, not changed.
- A bash heredoc with an apostrophe failed to parse once; files were written with the Write tool instead. No effect on the result.

## Deferred Issues

- The `ExpenseListTimingTests` machine-speed failure above (pre-existing, owner ruling D-76 stands).
- A real lock timeout (two creates racing past 10 seconds) is proved only at the unit level here (`OrderNumberBusyException` gives 409 `orders.busy`); the parallel race proof is plan 07-06.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. The two new routes are under `Policies.Staff` with matrix rows (anonymous 401). T-07-09 (mass assignment) is mitigated by the request record plus `OrderAttributionTests`; T-07-10 by the lock row and tracked counter (race proof in 07-06); T-07-11 by both validator layers, DB checks and boundary tests; T-07-12 by `OrderAuditDetail` and its test; T-07-13 by `MaxItems`; T-07-14 by the idempotency replay test.

## Authentication Gates

None.

## Next Phase Readiness

Ready for plan 07-06 (the number race proof). Later slices can use `OrderFixtures`, `Order` (private `Recalculate` and `Touch` are the pattern every mutating method ends with), `OrderStore.FindAsync` (items included, split query), `OrderReader.GetDetailAsync`, the shared field validators, and `docs/api/orders.md`. Plans 07-10 to 07-12 add discounts, payments and expenses to `NewOrder` and `Order.Create` (re-add the business `today` there).

## Self-Check: PASSED

Created files exist (19 key files checked with `[ -f ]`) and all six task commits (27041f1c, bbdad172, dd61a167, 54fa6c6c, 7151fa6b, 7077fbd3) are ancestors of HEAD. The acceptance criteria above were re-run after the last commit.
