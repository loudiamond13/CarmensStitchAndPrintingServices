---
phase: 07-order-domain-api
plan: 10
subsystem: api
tags: [orders, order-discounts, order-math, discount-cap, optimistic-concurrency, audit, migration, openapi]
created: "2026-10-28T13:50:00-05:00"
updated: "2026-10-28T13:50:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-02 DiscountKind and OrderMathDiscount; 07-05 Order aggregate, NewOrder, CreateOrderHandler, OrderReader, OrderFixtures; 07-09 OrderChildWrite, IOrders.LockAsync, item handlers and controller style"
provides:
  - "OrderDiscounts table (migration AddOrderDiscounts): Kind tinyint 1 or 2, Value above 0, Reason up to 100, Position, cascade from Orders, person FKs NO ACTION, three indexes"
  - "POST, PUT and DELETE /api/v1/orders/{orderId}/discounts[/{discountId}] (Staff): add, edit and remove discounts, each answering 200 with the whole order, recomputed totals and a new version"
  - "A discounts array on POST /api/v1/orders, saved in the same transaction; errors on discounts[i].field, the 20 limit and the cap on discounts"
  - "OrderDiscount entity, NewOrderDiscount, Order.AddDiscount/UpdateDiscount/RemoveDiscount, OrderDiscountChanges, NewOrder.Discounts"
  - "One discount cap (Order.DiscountsFit through OrderMath): after every discount add or edit and every item edit or removal the discounts may not pass the subtotal; 400 on value for discount writes, 422 orders.discount-above-subtotal for item writes, 400 on discounts at create"
  - "Error codes orders.discount-not-found, orders.too-many-discounts, orders.discount-above-subtotal"
  - "OrderAuditDetail.DiscountAdded/DiscountChanged/DiscountRemoved and one order-discount.* entry per real change, never the reason text"
  - "OrderDetailResponse.Discounts (OrderDiscountResponse); DiscountKindNames wire keys fixed and percentage"
  - "Discounts section in docs/api/orders.md; refreshed OpenAPI contract and generated types"
affects: [07-11, 07-12, 07-13, 07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 44000
  tasks: 3
  commits: 6
plan_head_before: a2104eb5f11411d4e187f73eafd98694a3703ada
plan_head_after: 31517ac1eae9e787097b464638873013ef4e67a8

tech-stack:
  added: []
  patterns:
    - "Discount writes copy the item flow: OrderChildWrite.SaveFormAsync for add and edit (409 edit.stale on a stale version, never retried), ConflictRetry plus AttemptAsync for remove, IOrders.LockAsync before the child row is written"
    - "One private cap check, Order.DiscountsFit(items, discounts), runs OrderMath on the figures a change WOULD give and refuses before anything is assigned; the caller picks the error (400 on value, 400 on discounts, 422)"
    - "Shared field rules in OrderRules (CheckDiscount with an optional list index) used by the domain, the validator constants and the tests, so every layer says the same words"
    - "A list-valued create field is validated with RuleForEach over a small private validator that includes the shared fields validator, which gives paths like discounts[1].value"

key-files:
  created:
    - src/Csps.Domain/Orders/OrderDiscount.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderDiscountConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028181319_AddOrderDiscounts.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028181319_AddOrderDiscounts.Designer.cs
    - src/Csps.Application/Orders/DiscountKindNames.cs
    - src/Csps.Application/Orders/IOrderDiscountFields.cs
    - src/Csps.Application/Orders/OrderDiscountFieldsValidator.cs
    - src/Csps.Application/Orders/AddOrderDiscountRequest.cs
    - src/Csps.Application/Orders/AddOrderDiscountRequestValidator.cs
    - src/Csps.Application/Orders/AddOrderDiscountHandler.cs
    - src/Csps.Application/Orders/UpdateOrderDiscountRequest.cs
    - src/Csps.Application/Orders/UpdateOrderDiscountRequestValidator.cs
    - src/Csps.Application/Orders/UpdateOrderDiscountHandler.cs
    - src/Csps.Application/Orders/RemoveOrderDiscountHandler.cs
    - src/Csps.Server/Controllers/OrderDiscountsController.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderDiscountTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderDiscountHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderDiscountsMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs
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
    - src/Csps.Server/Controllers/OrderItemsController.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/CreateOrderRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderItemHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/UpdateOrderDetailsHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderModelTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderItemsEndpointTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md

key-decisions:
  - "The cap is one check through OrderMath on the figures a change would give: discounts (worked out and rounded as OrderMath rounds them) may not be more than the subtotal; equal is allowed and gives a total of 0.00. It runs before anything is assigned, so a refusal changes nothing."
  - "The cap error depends on the door: a discount form gets 400 on value, the create body gets 400 on discounts, and an item edit or removal gets 422 orders.discount-above-subtotal (the person did not touch a discount field)."
  - "OrderDiscounts has a Position column (like OrderItems) so the discounts keep the order they were given in, in the response and in the create body paths discounts[i].x. The plan's column list did not name it."
  - "The cap is held in the domain only. The database checks cover one row (kind, value above zero). A database check that DiscountTotal is not above Subtotal on Orders was NOT added: it would change an existing table and could fail legacy rows whose discounts pass the subtotal. See Deferred Issues for the owner."
  - "A percentage and a fixed discount share one value field; the range depends on the kind (fixed 0.01 to 1,000,000.00, percentage above 0 up to 100, both at most 2 decimals). An unknown or missing kind has its own message and the value is not judged against a guess."
  - "Wire kind keys are lower case fixed and percentage, read ignoring case and spaces like the status keys."

patterns-established:
  - "Pattern: a cap that depends on two lists (items and discounts) is one private check fed with the lists as they WOULD be, never with state that was already assigned"
  - "Pattern: a child with its own order in a list gets a Position column and an index-aware path (discounts[i].x) in the shared domain check"

requirements-completed: [ORD-05, ORD-03, ORD-20]

coverage:
  - id: D1
    description: "A staff member of either role adds a discount to a saved order with the order's version; the ORD-2026-0148 items with a 5% 'Barangay league discount' answer subtotal 22,450.00, discount 1,122.50, total 21,327.50, balance 21,327.50, with the discount's id, kind, value, reason and who recorded it"
    requirement: ORD-20
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#AStaffMemberAddsTheFivePercentLeagueDiscountAndTheTotalDropsTo21327"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderDiscountTests.cs#AddingAPercentageDiscountRecomputesTheTotalsThroughOrderMath"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderDiscountsMigrationTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every discount rule at its boundary: fixed 0.01 to 1,000,000.00, percentage 0.01 to 100, at most 2 decimals, reason 1 to 100 characters, at most 20 discounts (422 orders.too-many-discounts), an unknown kind, and a discount id from another order is 404 orders.discount-not-found"
    requirement: ORD-05
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderDiscountTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderDiscountHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#ADiscountIdFromAnotherOrderIsNeverFoundOnEditOrRemove"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#ATwentyFirstDiscountIsA422AndTheTwentiethIsAccepted"
        status: pass
    human_judgment: false
  - id: D3
    description: "Edit and remove recompute the totals (5% to 10% gives a discount of 2,245.00; removal gives 0.00), a no-op edit keeps the version and records nothing, and a stale version on add or edit is 409 edit.stale with nothing stored"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#EditingTheValueFromFiveToTenPercentRecomputesTheDiscountTo2245"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#RemovingTheDiscountBringsTheDiscountBackToZero"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#AStaleVersionOnAddOrEditIs409AndNothingIsStored"
        status: pass
    human_judgment: false
  - id: D4
    description: "The discounts never pass the items total: a discount add or edit that would is 400 on value, an item quantity cut or removal that would leave them above the new subtotal is 422 orders.discount-above-subtotal, and nothing is saved in either case"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderItemsEndpointTests.cs#ACutThatLeavesTheDiscountAboveTheNewSubtotalIsA422AndTheOrderIsUnchanged"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#ADiscountAboveTheItemsTotalIsA400OnValueAndTheOrderIsUnchanged"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderDiscountTests.cs#AQuantityCutThatLeavesTheDiscountsAboveTheNewSubtotalIsRefusedAndNothingChanges"
        status: pass
    human_judgment: false
  - id: D5
    description: "Discounts in the create body are saved with the order: the ORD-2026-0148 items plus the 5% discount give 21,327.50; a discount error is a 400 on discounts[i].field with every other field error; discounts past the subtotal are a 400 on discounts, create no order and use no number"
    requirement: ORD-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#TheOrd0148ItemsWithTheFivePercentLeagueDiscountInTheBodyGive21327"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#DiscountsInTheBodyThatPassTheItemsTotalAreA400OnDiscountsAndNoNumberIsUsed"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/CreateOrderEndpointTests.cs#ADiscountErrorInTheBodyIsListedOnItsPathWithTheOtherFieldErrors"
        status: pass
    human_judgment: false
  - id: D6
    description: "Each discount add, edit and remove writes exactly one order-discount.* entry for the order with the documented keys and never the reason text; a no-op or a refusal writes none"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#EachAddEditAndRemoveWritesExactlyOneEntryForTheOrderWithNoReasonText"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#ANoOpEditAndEveryRefusalWriteNoEntry"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs"
        status: pass
    human_judgment: false
  - id: D7
    description: "Two discount adds with the same version give exactly one 200 and one 409 in each of 5 rounds, with exactly one new discount stored"
    requirement: ORD-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderDiscountsEndpointTests.cs#TwoDiscountAddsWithTheSameVersionGiveExactlyOneWinnerEveryTime"
        status: pass
    human_judgment: false
  - id: D8
    description: "The plain-English discount error wording (the plan gave only the cap sentence; the others were written here) and the discounts section of docs/api/orders.md read clearly to a person"
    requirement: ORD-05
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's call; no test judges prose."

duration: 45 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 10: Order discounts Summary

**An order can now hold up to 20 fixed or percentage discounts, added, edited and removed through POST, PUT and DELETE under /api/v1/orders/{orderId}/discounts or sent in the create body. Totals come from OrderMath (the ORD-2026-0148 items with the 5% league discount give 21,327.50), and one cap check keeps the discounts from ever passing the items total, whether the change is to a discount or to an item.**

## Performance

- **Duration:** about 45 min
- **Started:** about 2026-10-28T17:58Z
- **Completed:** 2026-10-28T18:43Z
- **Tasks:** 3 of 3
- **Files changed:** 48 files in all, 3,306 added lines (about 44,000 tokens of hand-written lines, chars/4, with the OpenAPI JSON, the generated types and the migration left out)

## Accomplishments

- Task 1 (tracer): the `OrderDiscounts` table and migration, the `OrderDiscount` entity, `Order.AddDiscount`, the reader and store changes, the add request, validator, handler and POST route, the matrix row and the refreshed contract. A staff member adds the 5% league discount to the ORD-2026-0148 order and the answer shows 1,122.50 off and a total of 21,327.50.
- Task 2: `Order.UpdateDiscount` and `RemoveDiscount`, the 20-discount limit, `OrderDiscountChanges`, the PUT and DELETE routes, and the one discount cap (`DiscountsFit`) that runs after every discount and item change.
- Task 3: `NewOrder.Discounts`, the `discounts` array on the create body with `discounts[i].field` errors, the discounts section of `docs/api/orders.md`, and the audit and create-body tests.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | bd19add9 `test(07-10): add a discount to an order (RED)` | 63f4d30d `feat(07-10): add a discount to an order (D-15)` |
| 2 | a10db632 `test(07-10): discount rules and the discount cap (RED)` | 07013e4a `feat(07-10): discount rules and the cap on item changes (ORD-05)` |
| 3 | bf1eddf6 `test(07-10): discounts in the create body, audited (RED)` | 31517ac1 `feat(07-10): discounts in the create body and audited (D-24, D-31)` |

- **Task 1 RED:** 3 of 3 endpoint tests failed (route missing: 404 where 200 and 401 were expected) and 10 of 10 migration tests failed (`Invalid object name 'OrderDiscounts'`). Valid assertion failures. `gsd_run check tdd-red-evidence` was not run (this runner's output is none of TAP, JUnit or Surefire); the failing output was read by hand.
- **Task 2 RED:** the Domain and Application test projects did not build (`UpdateDiscount`, `RemoveDiscount`, `UpdateOrderDiscountHandler`, `RemoveOrderDiscountHandler` and friends missing: a compile-time RED). At runtime 8 of 12 discount endpoint cases and 2 of 17 item endpoint cases failed. The other 4 discount cases passed because the tracer already carried the add, the stale add, the empty body and a same-version race.
- **Task 3 RED:** the Application tests did not build (`OrderDiscountRequest` missing); 5 of 31 Domain cases and 4 of 35 create endpoint cases failed at runtime. The two audit endpoint cases and the audit detail cases passed the first time because the audit entries were needed earlier (see Deviations), so they are regression proof, not new red.
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with automated-only `<verify>`, so the verify commands were re-run after GREEN (`OrderDiscountsEndpointTests` 3 passed, `OrderDiscountsMigrationTests` 10, `MigrationScriptTests` 6, `OrderModelTests` 3; also `*Authorization*` 270, `*Idempotency*` 54, `Csps.ArchitectureTests` 241, `TriggerInventoryTests` 2, `*OpenApiSnapshotTests` 10) before expansion. Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- Preflight before the integration runs: ports 5180, 5115, 7028, 5199 all free, no dev or test processes.
- `Csps.Domain.UnitTests`: 1043 passed. `Csps.Application.UnitTests`: 1480 passed. `Csps.ArchitectureTests`: 241 passed.
- `Csps.Server.IntegrationTests` (full run): 1467 total, 1467 passed, 0 failed, 0 skipped. The known slow-machine `ExpenseListTimingTests` passed in this run (owner ruling D-76 stands).
- `Csps.Infrastructure.IntegrationTests` (full run): 645 total, 644 passed, 0 failed, 1 skipped (not touched by this plan; same skip as in 07-09). Included `OrderDiscountsMigrationTests` 10, `MigrationScriptTests` 6, `OrderModelTests` 3 and `TriggerInventoryTests` 2.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (1817/1817), branch 100% (710/710); Csps.Application line 98.3% (4639/4716), branch 94.8% (not gated). "Coverage gate passed."
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The snapshot was refreshed three times (once per GREEN) with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command only.
- Acceptance criteria re-run after the last commit: `HasQueryFilter("SoftDelete"` in `OrderDiscountConfiguration.cs` 1 (exactly 1); `*_AddOrderDiscounts.cs` 1 file (exactly 1); `Lower or remove a discount first.` in `OrderRules.cs` 1 (exactly 1); `orders.discount-above-subtotal` in `OrderRules.cs` 1 and `OrderErrors.cs` 0, total 1 (at least 1); `Discounts` in `CreateOrderRequest.cs` 2 (at least 1); `OrderDiscountAdded` in `AddOrderDiscountHandler.cs` 1 (exactly 1).
- gitleaks on each staged change: no leaks. Only fake values (fake customer and numbers). No en or em dash in any changed `src` file or doc. No SQL string, trigger, package or JSON column was added.

## Task Commits

1. **Task 1: tracer, add a discount** - RED `bd19add9` (test), GREEN `63f4d30d` (feat)
2. **Task 2: edit, remove, every rule, the cap** - RED `a10db632` (test), GREEN `07013e4a` (feat)
3. **Task 3: discounts in the create body, audited** - RED `bf1eddf6` (test), GREEN `31517ac1` (feat)

## Decisions Made

See key-decisions above. The two the owner should know about are the extra `Position` column and the choice not to add a database-level cap (below).

## Deviations from Plan

### Auto-fixed Issues

None needed fixing. Everything below is a plan note, no behaviour change beyond what the plan states except the first.

### Plan notes

- **`Position` column on `OrderDiscounts` (Rule 2, correctness).** The plan's column list had no ordering column. Without one the discounts could come back in any order, and the create body paths `discounts[i].x` would not match what was stored. `Position int NOT NULL` mirrors `OrderItems`. It is a new column on a new table: no drop, no rename, no lossy change.
- **Audit entries came in Tasks 1 and 2, not Task 3.** `OrderChildWrite` saves nothing when the change returns no audit entry, so the add handler needed `OrderAuditDetail.DiscountAdded` in Task 1, and the edit and remove handlers needed `DiscountChanged` and `DiscountRemoved` in Task 2. Task 3 only added the tests for them plus the create body; its audit tests passed the first time (see TDD Gate Compliance).
- **Full discount field rules in Task 1.** The plan said Task 2 completes the rules. The validator and `OrderRules.CheckDiscount` are shared by add, edit and the create body and `AddDiscount` must re-check them, so writing half of them would have been throwaway code. Task 2's boundary tests passed the first time and are regression proof.
- **Migration file name.** The plan says `20261028000004_AddOrderDiscounts`; EF generated `20261028181319_AddOrderDiscounts` (the real timestamp, later than the existing `AddLegacyHolder`). The Up and Down were read: one table, its checks, three foreign keys, three indexes; Down drops only that table.
- **Files beyond the plan's list:** `DiscountKindNames.cs` (wire keys), `OrderItemsController.cs` (the item PUT and DELETE can now answer 422 `orders.discount-above-subtotal`; docs and `ProducesResponseType` updated, so the contract shows it), `OrderModelTests.cs` (the SoftDelete-by-name check now covers `OrderDiscount`), and the three existing handler test files whose `OrderDetailResponse` literal needed the new `Discounts` argument.
- **`OrderErrors` has no `DiscountAboveSubtotal`.** The value lives in `OrderRules` (the item handlers return it from the domain). A duplicate that nothing uses would be dead code. The acceptance criterion is met by `OrderRules.cs`.
- **`CreateOrderRequest.Discounts` is an optional last parameter (default null).** Existing callers and bodies without `discounts` keep working.
- **A same-version race test for discount adds** (5 rounds, one 200 and one 409 each) was added to `OrderDiscountsEndpointTests`. The plan did not ask for it; `OrderConcurrencyTests` is untouched.
- **Tooling:** three multi-line shell commands with here-documents did not run at all (shell parse error, nothing executed); the edits were redone with the Edit and Write tools. No file was affected.

**Total deviations:** 0 auto-fixed bugs, 1 small addition (Position), 8 plan notes. **Impact:** none on scope; one new column on the new table.

## Issues Encountered

- The tooling parse errors above. No effect on the code.
- `Csps.Infrastructure.IntegrationTests` reports one skipped test; it is not in code this plan touched.

## Deferred Issues

- **For the owner: a database-level backstop for the cap.** The plan's threat T-07-26 lists "DB checks" as part of the mitigation, but the only database checks are per row (`CK_OrderDiscounts_Kind`, `CK_OrderDiscounts_Value_Positive`). The "discounts not above the subtotal" rule is held in the domain only (and proved by tests at the boundary). A check such as `DiscountTotal <= Subtotal` on `Orders` would change an existing table, and it could fail rows imported from the old system whose discounts pass the subtotal. I did not add it. Options: (1) leave it in the domain only (recommended; the migration phase can first measure whether any legacy order breaks the rule), (2) add the check after the legacy data is measured, (3) add it now and let the import fix any failing rows. Needs your word before it goes into a migration.
- **Wording of the new error messages.** The plan gave only the cap sentence. The other discount messages (for example "Enter a reason for the discount." and "Enter a percentage above 0 and up to 100.") were written here from the owner's plain-English rule. Please read them in `OrderRules.cs` and the discounts section of `docs/api/orders.md`; Phase 8 mirrors them in zod.
- Item and discount changes are allowed on a Completed or Cancelled order, as with items in 07-09. The D-05 end-state lock arrives with plan 07-13.
- The `ExpenseListTimingTests` machine-speed failure in `deferred-items.md` did not fail in this plan's full run; owner ruling D-76 stands.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-07-26 (a discount above the items total making the total negative) is mitigated in the domain by the cap on every discount add and edit, every item edit and removal, and the create body, with boundary tests at exactly equal and one centavo over (see the database backstop note above). T-07-27 (reason text in the audit log) is mitigated: the audit detail has no reason, only `fields=reason`, proved by `OrderAuditDetailTests` and `EachAddEditAndRemoveWritesExactlyOneEntryForTheOrderWithNoReasonText`. A discount id from another order is never found (`ADiscountIdFromAnotherOrderIsNeverFoundOnEditOrRemove`). No package was added.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 07-11 (payments). Payments copy the same flow: `OrderChildWrite.SaveFormAsync` for add and edit, `ConflictRetry` plus `AttemptAsync` for remove, `IOrders.LockAsync` before the child row, and `Order.Recalculate` which already takes the discount list. `OrderFixtures.DiscountBody`, `AddDiscountAsync`, `PutDiscountAsync`, `DeleteDiscountAsync` and `AddDiscountAndReadAsync` show the helpers to copy, and `DiscountsFit` is the model for any check that needs the figures a change would give before it is assigned. The balance now follows the total after discount.

## Self-Check: PASSED

All 16 spot-checked key files (the new entity, configuration, migration pair, handlers, validators, controller, tests and the docs page) exist on disk, and all six task commits (bd19add9, 63f4d30d, a10db632, 07013e4a, bf1eddf6, 31517ac1) are ancestors of HEAD. The acceptance criteria above were re-run after the last commit.
