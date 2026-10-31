---
phase: 07-order-domain-api
plan: 09
subsystem: api
tags: [orders, order-items, optimistic-concurrency, row-version, audit, race-test, deadlock, openapi]
created: "2026-10-28T13:10:00-05:00"
updated: "2026-10-28T13:10:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-05 Order aggregate (Recalculate, Touch), OrderItem, NewOrderItem, OrderItemFieldsValidator, OrderReferenceChecks, IOrders, IOrderReader, OrderFixtures; 07-06 ConcurrentRequests; 07-07 version contract and OrderConcurrencyTests"
provides:
  - "POST /api/v1/orders/{orderId}/items, PUT and DELETE /api/v1/orders/{orderId}/items/{itemId} (Staff): add, edit and remove items, each answering 200 with the whole order, totals recomputed by OrderMath and a new version"
  - "Order.AddItem, UpdateItem, RemoveItem and OrderItemChanges: every item rule re-checked, at least 1 and at most 100 items, items found only through their order"
  - "OrderChildWrite: the shared find, version check, change, lock, audit, save and re-read flow that payments, discounts, expenses and refunds copy"
  - "IOrders.LockAsync (OrderStore): takes the order's row before any child row is written, so a child write never deadlocks with the read that follows it"
  - "AddOrderItem, UpdateOrderItem, RemoveOrderItem handlers; error codes orders.item-not-found, orders.last-item, orders.too-many-items"
  - "OrderAuditDetail.ItemAdded, ItemChanged, ItemRemoved and one order-item.* entry per real change"
  - "Items section in docs/api/orders.md; refreshed OpenAPI contract and generated types"
affects: [07-10, 07-11, 07-12, 07-13, 07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 35000
  tasks: 3
  commits: 6
plan_head_before: d0efbaf5df3504bfdb994874991853eb16e79ce7
plan_head_after: 657e77a60f2311e9395aa48a80c07dde7bc11200

tech-stack:
  added: []
  patterns:
    - "Child writes go through OrderChildWrite.AttemptAsync: one transaction, find through the order, version compare when a form sends one, domain change, then (only when something changed) IOrders.LockAsync, audit entry, save"
    - "A change callback returns Result<OrderChildAudit?>: the audit entry to record, or null for a no-op that saves nothing, keeps the version and records nothing"
    - "A form save (add, edit) maps ConcurrencyConflictException to edit.stale and never retries; a single click (remove) runs inside ConflictRetry.RunAsync, so a lost race is read again and decided again once"
    - "LockAsync is an ExecuteUpdate on the order row matching the loaded RowVersion: the loser of a race fails there with nothing written, and the winner's tracked RowVersion is refreshed so its own save still matches"

key-files:
  created:
    - src/Csps.Application/Orders/AddOrderItemRequest.cs
    - src/Csps.Application/Orders/AddOrderItemRequestValidator.cs
    - src/Csps.Application/Orders/AddOrderItemHandler.cs
    - src/Csps.Application/Orders/UpdateOrderItemRequest.cs
    - src/Csps.Application/Orders/UpdateOrderItemRequestValidator.cs
    - src/Csps.Application/Orders/UpdateOrderItemHandler.cs
    - src/Csps.Application/Orders/RemoveOrderItemHandler.cs
    - src/Csps.Application/Orders/OrderChildWrite.cs
    - src/Csps.Server/Controllers/OrderItemsController.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderItemTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderItemHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderItemsEndpointTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderStoreLockTests.cs
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Domain/Orders/OrderItem.cs
    - src/Csps.Domain/Orders/OrderChanges.cs
    - src/Csps.Domain/Orders/OrderRules.cs
    - src/Csps.Application/Orders/OrderErrors.cs
    - src/Csps.Application/Orders/OrderReferenceChecks.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Application/Ports/IOrders.cs
    - src/Csps.Infrastructure/Orders/OrderStore.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md

key-decisions:
  - "IOrders.LockAsync first: every child write that changed something locks the order's row with an ExecuteUpdate (matching the loaded RowVersion) before it writes a child row. Without it, EF sorts OrderItems before Orders, so a second same-version add inserted its item and then waited on the order row while the winner's read-back waited on that item: SQL Server killed one of them and the request answered 500. Now the loser fails at the lock with 409 edit.stale and has written nothing."
  - "Order.Position only orders lines: a removal leaves a gap and a new item takes the highest position plus one (no renumbering, so a removal never touches the other items' rows or stamps)."
  - "Item errors on a saved order are on the plain field names (quantity, productTypeId), not items[n].x, because the add and edit forms are single-item bodies. The domain check still reports items[index].x if it is ever reached with a bad item."
  - "A no-op item edit answers 200, keeps the version, records nothing and does not take the lock (the lock moves the row version)."
  - "The three domain errors live in OrderRules (domain) and OrderErrors re-exposes them, so the domain can return them and the handlers and tests share one value."

requirements-completed: [ORD-05, ORD-08, ORD-13]

coverage:
  - id: D1
    description: "A staff member of either role adds an item to a saved order with the order's version; the answer and the next read show two items, the recomputed subtotal and balance, the item's line total and a new version"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderItemsEndpointTests.cs#AnAdminAddsAnItemToAManagersOrderAndTheTotalsGrow"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderItemTests.cs#AddingAnItemAppendsItAfterTheLastOneAndRecomputesTheTotals"
        status: pass
    human_judgment: false
  - id: D2
    description: "Edit and remove: quantity changes recompute the totals, a no-op edit keeps the version, removing an item leaves the others, removing the last is 422 orders.last-item, a 101st item is 422 orders.too-many-items, an item of another order is 404 orders.item-not-found, a broken field is a 400 on that field"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderItemsEndpointTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderItemTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "A retired product type is refused on a new item and on a switch, and an edit that keeps a saved retired type is allowed (D-18, D-19)"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderItemsEndpointTests.cs#ARetiredProductTypeIsRefusedOnAddAndOnSwitchButAKeptRetiredTypeMayBeEdited"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderItemHandlerTests.cs#UpdateAnEditThatKeepsASavedRetiredProductTypeIsAllowedAndTheListIsNotAsked"
        status: pass
    human_judgment: false
  - id: D4
    description: "Two item adds with the same version give exactly one 200 and one 409 edit.stale in each of 10 rounds and exactly one new item is stored; a stale PUT or POST is 409; two removals of different items both succeed on a 3-item order and give one 200 and one 422 on a 2-item order"
    requirement: ORD-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs#TwoItemAddsWithTheSameVersionGiveExactlyOneWinnerEveryTime"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs#TwoRemovalsOfDifferentItemsOnAThreeItemOrderBothSucceedAndLeaveOne"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs#TwoRemovalsOfDifferentItemsOnATwoItemOrderGiveOneSuccessAndOneLastItemRefusal"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderStoreLockTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "Each add, edit and remove writes exactly one order-item.* entry for the order with the documented keys and no description or size text; a no-op or a refusal writes none; an item change stamps the order with the caller as last changed and the item with its creator and last changer"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderItemsEndpointTests.cs#EachAddEditAndRemoveWritesExactlyOneEntryForTheOrderWithNoItemText"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderItemsEndpointTests.cs#AnItemChangeStampsTheItemAndTheOrderWithTheCaller"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs"
        status: pass
    human_judgment: false
  - id: D6
    description: "The items section of docs/api/orders.md and the plain-English error messages read clearly to a person"
    requirement: ORD-05
    verification: []
    human_judgment: true
    rationale: "The wording was written in this plan from the owner's rules; no test judges prose."

duration: 53 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 09: Order items Summary

**Staff can add, correct and remove the items of a saved order through POST, PUT and DELETE under /api/v1/orders/{orderId}/items. Every answer is the whole order with totals recomputed by OrderMath and a new version. An order keeps 1 to 100 items, items are found only through their order, two same-version changes give one winner, and each real change writes one audit entry with no item text. The shared OrderChildWrite flow now locks the order's row before it writes a child row, which fixed a deadlock that two idempotent adds exposed.**

## Performance

- **Duration:** about 53 min
- **Started:** 2026-10-28T17:12Z
- **Completed:** 2026-10-28T18:05Z
- **Tasks:** 3 of 3
- **Files changed:** 28 hand-written (about 35,000 tokens of changed lines, chars/4, with the OpenAPI JSON and the generated types left out), 30 in all

## Accomplishments

- Task 1 (tracer): `Order.AddItem`, `OrderChildWrite`, the add request, validator and handler, the POST route, the matrix row and the refreshed contract. An Admin adds a second item to a Manager's order and the answer and the next read show 10,850.00 and a new version.
- Task 2: `Order.UpdateItem` and `RemoveItem`, `OrderItemChanges`, the edit and remove handlers, the PUT and DELETE routes, the retired product type rule (a switch to a retired type is a 400, a kept retired type is allowed), the last-item, 100-item and foreign-item rules, and the items section of `docs/api/orders.md`.
- Task 3: `OrderAuditDetail.ItemAdded/ItemChanged/ItemRemoved`, one entry per real change recorded inside the write, the child-only race tests (10 rounds of two same-version adds, two removals on a 3-item and a 2-item order), and `IOrders.LockAsync` to remove a deadlock (see Deviations).

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | 68fe912e `test(07-09): add an item to a saved order (RED)` | 95d8ade3 `feat(07-09): add an item to a saved order (ORD-05)` |
| 2 | 6c7cf1c2 `test(07-09): edit and remove items (RED)` | fbca1175 `feat(07-09): edit and remove items (D-19, D-30)` |
| 3 | 4ea0499a `test(07-09): item audit and child-only races (RED)` | 657e77a6 `feat(07-09): audited item changes, one winner per race (D-31, ORD-08)` |

- **Task 1 RED:** 3 of 3 endpoint tests failed (the route did not exist: 404 where 200, 401 and `orders.not-found` were expected). Valid assertion failures. `gsd_run check tdd-red-evidence` was not run (this runner's output is none of TAP, JUnit or Surefire); the failing output was read by hand.
- **Task 2 RED:** the domain and handler tests did not build (`UpdateItem`, `RemoveItem`, `UpdateOrderItemHandler` and friends missing: a compile-time RED). At runtime 8 of 12 endpoint cases failed (the PUT and DELETE routes did not exist). The other 4 passed because the tracer already carried the add, the 100-item cap and the stale add.
- **Task 3 RED:** the Application tests did not build (`ItemAdded`/`ItemChanged`/`ItemRemoved` and the audit constructor argument missing). At runtime 2 of 21 server cases failed: the add race and the one-entry audit test. The two removal races, the no-audit refusals and the stamp test passed the first time, so they are regression proof, not new red (the tracer and Task 2 already had `Touch`, `ConflictRetry` and the stamping interceptor).
- **GREEN of Task 3, honest note:** the add race test first failed with a 500, not an audit gap. See the deviation below.
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with an automated-only verify, so the verify commands were re-run after GREEN (`OrderItemsEndpointTests` 3 passed; `*Authorization*` 261, `*Idempotency*` 54, `Csps.ArchitectureTests` 241, `*OpenApiSnapshotTests` 10 all passed) before expansion. Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- `Csps.Domain.UnitTests`: 1012 passed. `Csps.Application.UnitTests`: 1421 passed. `Csps.ArchitectureTests`: 241 passed.
- `Csps.Server.IntegrationTests` (full run, after the preflight showed all ports free): 1438 total, 1438 passed, 0 failed. The known slow-machine `ExpenseListTimingTests` passed in this run.
- `Csps.Infrastructure.IntegrationTests` (full): 635 total, 634 passed, 0 failed, 1 skipped (not touched by this plan). Included `OrderStoreLockTests` 2 and `AuditLogAppendOnlyTests` (reads `docs/operations/audit-log.md`).
- `OrderConcurrencyTests` re-run alone four times in a row after the lock fix: 6 of 6 each time, no flake. Before the lock fix the add race failed in round 1 with a 500 (deadlock victim), reproduced twice.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (1686/1686), branch 100% (654/654); Csps.Application line 98.5% (4429/4496), branch 94.7% (not gated). "Coverage gate passed."
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Acceptance criteria re-run: `AddOrderItem` in `OrderItemsController.cs` 4 (at least 1); `/items` in `AuthorizationMatrix.cs` 3 lines (at least 1); `orders.last-item` in `OrderErrors.cs` and `OrderRules.cs` 0 + 1 (at least 1); `ConflictRetry.RunAsync` in `RemoveOrderItemHandler.cs` 1 (exactly 1); `OrderItemAdded|Changed|Removed` in the three handlers 1 + 1 + 1 (at least 3).
- gitleaks on each staged change: no leaks. Only fake values appear (the fixtures' fake customer and numbers, `example.com` emails in the store test). No en or em dash in the changed `src` files or docs.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two same-version item adds deadlocked under the idempotency transaction and answered 500**
- **Found during:** Task 3 (the 10-round add race)
- **Issue:** A POST with an `Idempotency-Key` runs inside one outer transaction. EF saves `OrderItems` before `Orders` (no ordering edge for a modified principal), so the second add inserted its item, then waited on the order row the first add holds. The first add's read-back of the order's items then waited on the second add's uncommitted item row. SQL Server killed one request with a deadlock, and the error surfaced from the read (outside the save's deadlock translation), so the caller got a 500 instead of 409. Every later idempotent child POST (payments, discounts, expenses, refunds) would have hit the same thing.
- **Fix:** `IOrders.LockAsync(order)` (implemented in `OrderStore` as an `ExecuteUpdate` on the order row that matches the loaded `RowVersion`). `OrderChildWrite.AttemptAsync` calls it, only when the change did something, before it records the audit entry and saves. The loser fails at the lock with `ConcurrencyConflictException` (tracked state dropped, nothing written), which becomes 409 `edit.stale` for a form save and a re-read for a remove. The winner's tracked `RowVersion` is refreshed so its own save still matches. No new table, migration, SQL string or package.
- **Files modified:** `src/Csps.Application/Ports/IOrders.cs`, `src/Csps.Infrastructure/Orders/OrderStore.cs`, `src/Csps.Application/Orders/OrderChildWrite.cs`; tests `OrderStoreLockTests.cs` (new) and lock cases in `OrderItemHandlerTests.cs`.
- **Verification:** 10 rounds of the add race pass four runs in a row; the full Server suite passes.
- **Commit:** 657e77a6

### Plan notes (no behaviour change)

- `IOrders.cs`, `OrderStore.cs`, `OrderStoreLockTests.cs`, `OrderReferenceChecks.cs` and `OrdersApplicationRegistration.cs` were touched or added beyond the plan's file list (the lock fix and the single-product-type check).
- The change callback of `OrderChildWrite` returns a plain `bool` in Tasks 1 and 2 and `Result<OrderChildAudit?>` from Task 3, because the plan puts the audit in Task 3 and an unused audit argument earlier would be dead code.
- The domain errors are defined in `OrderRules` and re-exposed by `OrderErrors`, so the domain can return them.
- A `Position` gap after a removal is allowed (see key-decisions); `OrderItem.Position` documentation says so.
- Tasks 2 and 3 each had tests that passed on first run (see TDD Gate Compliance); no production code was needed for them.
- Test-only fixes while writing: xUnit1051 asked for `TestContext.Current.CancellationToken` in three handler-test calls; one heredoc with backticks ran as shell commands once, so `docs/api/orders.md` was restored with `git checkout -- docs/api/orders.md` (it had no other changes) and edited again with the Edit tool.

**Total deviations:** 1 auto-fixed (Rule 1 bug), 6 plan notes. **Impact:** none on scope; one new method on an existing port.

## Issues Encountered

- The deadlock above. It was reproduced by logging the exceptions the test host's sink had collected (temporary test code, removed before the commit).
- `Csps.Infrastructure.IntegrationTests` reports one skipped test; it is not in code this plan touched.

## Deferred Issues

- Whether items may be added, edited or removed on a Completed or Cancelled order is not ruled anywhere in Phase 7 context (same open point as details edits in 07-07), so item changes are allowed in every status. If the owner wants a rule, it belongs with the status plans.
- The `ExpenseListTimingTests` machine-speed failure recorded in `deferred-items.md` did not fail in this plan's full run; the owner ruling D-76 stands.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-07-20 (another order's item by id) is mitigated by loading items only through their order and `AnItemOfAnotherOrderIsNeverFoundOnEditOrRemove`; T-07-21 (child-only lost update or double add) by `Touch`, the version compare, `LockAsync` and the 10-round race test; T-07-22 (no items or above the cap) by the domain refusals and their tests. No package was added and no migration was made.

## Authentication Gates

None.

## Next Phase Readiness

Ready for plan 07-10. Child routes copy `OrderChildWrite`: build the domain change, return `Result<OrderChildAudit?>` (null for a no-op), let the flow lock, record and save, then re-read with `OrderChildWrite.ReadAsync`. A form save uses `SaveFormAsync`; a single click wraps `AttemptAsync` in `ConflictRetry.RunAsync`. `OrderConcurrencyTests` is the file to add child race cases to, and `OrderFixtures.ItemBody`, `AddItemAsync`, `PutItemAsync`, `DeleteItemAsync` and `AddItemAndReadAsync` show the helpers to copy.

## Self-Check: PASSED

All 30 key files (13 created, 17 modified, counting the two generated contract files) were checked with `[ -f ]` and exist, and all six task commits (68fe912e, 95d8ade3, 6c7cf1c2, fbca1175, 4ea0499a, 657e77a6) are ancestors of HEAD. The acceptance criteria above were re-run after the last commit.
