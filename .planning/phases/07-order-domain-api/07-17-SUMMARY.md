---
phase: 07-order-domain-api
plan: 17
subsystem: api
tags: [order-lists, product-types, payment-methods, order-expense-categories, manager-routes, races, audit, openapi]
created: "2026-10-28T19:08:00-05:00"
updated: "2026-10-28T20:10:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-01 the three list tables, OrderListEntry domain rules, the read routes and the audit codes; 07-05 to 07-14 the foreign keys, the SoftDelete filters, IOrderLists.GetStatesAsync and OrderReferenceChecks"
  - phase: 06-company-expenses
    provides: "The category pattern: seven handlers, field validator, store translator, unit-of-work chain, test shapes"
provides:
  - "POST, GET id, PUT, retire, reactivate and DELETE on /api/v1/product-types, /api/v1/payment-methods and /api/v1/order-expense-categories, all Manager only (Admin 403); the staff list keeps 200 for both roles"
  - "useCount on every list item (order items, payments or order expenses by list, soft-deleted orders included) and on the entry detail"
  - "One set of generic handlers closed per list by OrderListDescriptor: Create, Get, Update, Retire, Reactivate, Delete"
  - "OrderListStore.TranslateSaveFailure chained after the expense category translator in CspsUnitOfWork: unique-name, in-use and just-deleted failures become typed exceptions"
  - "An order, item, payment or order expense that names an entry deleted a moment earlier is a 400 on its own field, never a 500"
  - "docs/api/order-lists.md management sections; refreshed OpenAPI contract and generated types"
affects: [07-18, 07-19, 07-20, 08]

actuals:
  tokens: 52000
  tasks: 3
  commits: 6
plan_head_before: 228cb299a9ca25b74c6e10c8f815456b266cafd7
plan_head_after: eaf3e3e081f0abdbb46e96d5d5b914043d21afe1

tech-stack:
  added: []
  patterns:
    - "One request record, one validator and one set of handlers for three lists; the handler passes the list (and whether it is an edit) to the validator through ValidationContext.RootContextData, so the messages use the right noun"
    - "Descriptor properties carry per-list codes, messages and audit actions, so the handlers hold no list names"
    - "A just-deleted entry is mapped in OrderChildWrite.SaveFormAsync (item, payment and expense adds and edits) and in CreateOrderHandler; the create re-runs the lookups to mark the exact row"

key-files:
  created:
    - src/Csps.Application/Ports/OrderListNameTakenException.cs
    - src/Csps.Application/Ports/OrderListEntryInUseException.cs
    - src/Csps.Application/Ports/OrderListEntryDeletedException.cs
    - src/Csps.Application/OrderLists/OrderListErrors.cs
    - src/Csps.Application/OrderLists/OrderListAuditDetail.cs
    - src/Csps.Application/OrderLists/OrderListEntryRequest.cs
    - src/Csps.Application/OrderLists/OrderListEntryRequestValidator.cs
    - src/Csps.Application/OrderLists/OrderListEntryDetailResponse.cs
    - src/Csps.Application/OrderLists/CreateOrderListEntryHandler.cs
    - src/Csps.Application/OrderLists/GetOrderListEntryHandler.cs
    - src/Csps.Application/OrderLists/UpdateOrderListEntryHandler.cs
    - src/Csps.Application/OrderLists/RetireOrderListEntryHandler.cs
    - src/Csps.Application/OrderLists/ReactivateOrderListEntryHandler.cs
    - src/Csps.Application/OrderLists/DeleteOrderListEntryHandler.cs
    - tests/Csps.Application.UnitTests/OrderLists/OrderListEntryHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/OrderLists/OrderListStoreTests.cs
    - tests/Csps.Server.IntegrationTests/OrderLists/OrderListFixtures.cs
    - tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs
  modified:
    - src/Csps.Application/Ports/IOrderLists.cs
    - src/Csps.Application/OrderLists/OrderListDescriptor.cs
    - src/Csps.Application/OrderLists/OrderListItem.cs
    - src/Csps.Application/OrderLists/ListOrderListHandler.cs
    - src/Csps.Application/Orders/OrderReferenceChecks.cs
    - src/Csps.Application/Orders/OrderChildWrite.cs
    - src/Csps.Application/Orders/CreateOrderHandler.cs
    - src/Csps.Infrastructure/OrderLists/OrderListStore.cs
    - src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
    - src/Csps.Server/Controllers/ProductTypesController.cs
    - src/Csps.Server/Controllers/PaymentMethodsController.cs
    - src/Csps.Server/Controllers/OrderExpenseCategoriesController.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/OrderLists/ListOrderListHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderItemHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderPaymentHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderExpenseHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/OrderLists/ListOrderListsEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/order-lists.md

key-decisions:
  - "A new name for the order expense Others is 422 order-expense-categories.protected, as this plan's tests and truths say. The Phase 6 category answered 400 on name ('The Others name can't change.'). The domain Rename still gives that 400 as a backstop; the handler checks first. Sending Others its own name is accepted and changes nothing."
  - "The 'in use' message says 'used by an order' for all three lists, as the plan's example does ('This product type is used by an order, so it can't be deleted. Retire it instead.'), because an item, a payment and an order expense all belong to an order."
  - "POST and PUT share one request record, OrderListEntryRequest(Name, Tone, Version). Version is ignored on an add and required on an edit."
  - "useCount is on the staff list items too (Admin included), not only on the Manager detail, because the plan asks the list items to carry it. This adds one field to the three existing GET list answers."

requirements-completed: [ORD-13]

coverage:
  - id: M1
    description: "D-19, D-20: a Manager adds an entry to each of the three lists (201, Location, detail with useCount 0, recorder, version), it shows in A to Z place, and staff can use a new product type on an order at once; an Admin gets 403 on every Manager route and the list stays unchanged"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs#AManagerAddsAProductTypeAndStaffCanUseItOnANewOrderAtOnce"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs#AManagerAddsAnEntryAndItAppearsInTheListInAToZPlaceWithAUseCountOfZero"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs#AnAdminIsRefusedOnEveryManagerRouteAndKeepsTheList"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (21 matrix rows for the three lists)"
        status: pass
    human_judgment: false
  - id: M2
    description: "D-19: names are 1 to 40 characters after trim and unique per list ignoring case; tones are one of six; a stale version is 409 edit.stale; a form with no change keeps the version and writes no audit"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs (name taken, tone, missing body, 40 and 41 characters, stale version, no change cases)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/OrderLists/OrderListEntryHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: M3
    description: "D-19, 06 D-30: an entry used by any row, soft-deleted orders included, cannot be deleted (422 <list>.in-use); a never-used entry can (204); useCount counts with the SoftDelete filter lifted"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs#ANeverUsedEntryCanBeDeletedAndAUsedOneCannotAndTheCountShowsIt"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs#AnEntryUsedOnlyByASoftDeletedOrderStillCountsAndCannotBeDeleted"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/OrderLists/OrderListStoreTests.cs#ARowOnASoftDeletedOrderStillCountsAndStillBlocksTheDelete"
        status: pass
    human_judgment: false
  - id: M4
    description: "D-19, 06 D-11: a retired entry is refused for a new item, payment or order expense, stays listed as retired, keeps its saved rows (which can still be edited without changing it), and can be reactivated"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs#RetiringKeepsTheEntryListedAsRetiredRefusesNewUseKeepsOldRowsAndReactivatingAllowsUseAgain"
        status: pass
    human_judgment: false
  - id: M5
    description: "D-17: the order expense Others can be recolored but never renamed, retired or deleted (422 order-expense-categories.protected)"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs#OthersCanBeRecoloredButNeverRenamedRetiredOrDeleted"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs#SendingOthersItsOwnNameWithANewToneIs200"
        status: pass
    human_judgment: false
  - id: M6
    description: "Pitfall 7, T-07-50, T-07-51: two adds of one name together give one 201 and one 400 (10 rounds, all three lists); a delete racing a new use gives one clear winner and never a 500 (10 rounds, 6 repeats); every list's unique-name and foreign-key failures become typed exceptions; an entry deleted before an order save is a 400 on the row's own field"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs#TwoAddsOfOneNameInDifferentCaseSentTogetherGiveOneCreatedAndOneNameError"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs#ADeleteSentTogetherWithAnOrderThatUsesTheEntryEndsInOneClearWinnerNeverA500"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/OrderLists/OrderListStoreTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs#AnEntryDeletedBeforeTheSaveIsA400OnTheRowsOwnFieldWithTheDeletedMessage"
        status: pass
    human_judgment: false
  - id: M7
    description: "D-31, T-07-52: every add, rename, recolor, retire, reactivate and delete writes exactly one entry of the right action and target type by the Manager; a repeated retire or reactivate writes nothing"
    requirement: ORD-13
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/OrderLists/OrderListsManagementTests.cs#EveryChangeWritesExactlyOneAuditEntryOfTheRightActionAndTargetTypeByTheManager"
        status: pass
    human_judgment: false
  - id: M8
    description: "The plain-English wording added here and the Others 422-versus-400 choice read right to the owner"
    requirement: ORD-13
    verification: []
    human_judgment: true
    rationale: "Wording and the Others rename answer are the owner's call; no test judges them."

duration: 39 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 17: Manager-managed order lists Summary

**Managers can now add, rename, recolor, retire, reactivate and delete entries of the product type, payment method and order expense category lists through 18 routes backed by one set of generic handlers, with use counts that include soft-deleted orders, a protected Others, one audit entry per change, and add/delete races that end in plain answers instead of 500s.**

## Performance

- **Duration:** about 39 min (23:27Z to 00:06Z)
- **Tasks:** 3 of 3
- **Files changed:** 41 files, about 52,000 tokens of hand-written lines (chars/4, OpenAPI JSON and generated types left out)

## Accomplishments

- Task 1 (tracer): `IOrderLists` grew `FindAsync`, `GetDetailAsync`, `CountUsesAsync`, `NameTakenAsync`, `Add` and `Remove`; `OrderListDescriptor` now carries per-list codes, messages, audit actions and how to build an entry; `OrderListEntryRequest` with one validator, `OrderListEntryDetailResponse`, `CreateOrderListEntryHandler` and `GetOrderListEntryHandler`; `POST` and `GET {id}` on product types; matrix rows; refreshed contract. A Manager added a product type and an Admin created an order with it straight away.
- Task 2: `UpdateOrderListEntryHandler` (rename and recolor in one save, two audit entries when both change, Others protected), `RetireOrderListEntryHandler`, `ReactivateOrderListEntryHandler`, `DeleteOrderListEntryHandler` (conflict retry, in-use check); the three controllers with all eight routes each; `useCount` on list items in the same single query; 16 more matrix rows (21 in total for the lists); management sections in `docs/api/order-lists.md`.
- Task 3: `OrderListNameTakenException`, `OrderListEntryInUseException`, `OrderListEntryDeletedException(kind)`; `OrderListStore.TranslateSaveFailure` for the three unique indexes and the three foreign keys, chained in `CspsUnitOfWork`; `OrderChildWrite.SaveFormAsync` and `CreateOrderHandler` turn a just-deleted entry into a 400 on the row's own field; store, race and audit tests.

## Migration

None. The tables, unique indexes and foreign keys came from 07-01 and the child plans. No package, trigger, SQL string or JSON column was added.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | 7134d0bd `test(07-17): a Manager adds a product type (RED)` | b6f41649 `feat(07-17): Managers add product types (D-19)` |
| 2 | 5ed2d620 `test(07-17): manage all three order lists (RED)` | 69b7442a `feat(07-17): manage product types, payment methods and order expense categories (D-16 to D-19)` |
| 3 | ee69cd5a `test(07-17): list races and audit (RED)` | eaf3e3e0 `feat(07-17): list races end in plain answers, audited (Pitfall 7, D-31)` |

- **Task 1 RED:** both cases failed on the missing route (404 where 201 and 403 were expected). Valid.
- **Task 2 RED:** 38 of 43 endpoint cases failed on 404 for the missing routes. The 5 that passed were the two Task 1 cases and three product-type cases that only used routes Task 1 had already added. The new Application handler tests failed to compile (the handler types did not exist yet), a compile-time RED for new types.
- **Task 3 RED:** 10 of 98 selected Application cases failed (the unhandled `OrderListEntryDeletedException` escaped as an exception), 3 add-race cases failed (the loser was a 500, so no 400), and the Infrastructure store tests failed to compile (`TranslateSaveFailure` did not exist). The delete-versus-use race and the audit cases passed before the work, because the existing behaviour already gave a clean answer in those runs; they stay as regression guards. `gsd_run check tdd-red-evidence` was not run (this runner's output is not TAP, JUnit or Surefire); the output was read by hand.
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with an automated-only `<verify>`, so both verify commands were re-run after GREEN (`OrderListsManagementTests` 2 passed, `*Authorization*` 327 passed, `*ListOrderListsEndpointTests` 8 passed). Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- Preflight before every integration run: ports 5180, 5115, 7028, 5199 free, no dev or test processes.
- Full runs after the last commit: `Csps.Domain.UnitTests` 1142 passed; `Csps.Application.UnitTests` 1824 passed; `Csps.ArchitectureTests` 241 passed (includes the no-inline-SQL and trigger scans); `Csps.Infrastructure.IntegrationTests` 739 total, 738 passed, 1 skipped (the same skip as before); `Csps.Server.IntegrationTests` 1775 passed, 0 failed (the known `ExpenseListTimingTests` passed this time).
- Plan verify commands: `*OrderListsManagementTests` 50 passed; `Application.UnitTests *OrderList*` 53 passed; `*ListOrderListsEndpointTests` 8 passed; `Infrastructure *OrderListStoreTests` 21 passed; `*CspsUnitOfWorkTests` 3 passed; `*Authorization*` 375 passed; `*Idempotency*` 54 passed; `*OpenApiSnapshotTests` 10 passed.
- Race evidence: the add race ran 10 rounds on each of three lists in one run; the delete-versus-use race ran 10 rounds in the full pass and then 6 more standalone repeats (60 races), all green. No flake seen.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (2310/2310), branch 100% (940/940); Csps.Application line 98% (6389/6514), branch 94.9% (not gated). "Coverage gate passed."
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The snapshot was refreshed with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command only (that run fails by design once), then the snapshot test passed without it, then `npm --prefix tools/openapi-gen run generate`. Refreshed after Task 1 and Task 2; Task 3 changed no route or schema.
- Acceptance criteria re-run: `CreateProductType` in the controller 1 (at least 1); `class CreateOrderListEntryHandler` 1 (exactly 1); `IgnoreQueryFilters` in `OrderListStore.cs` 6 (at least 1); list route lines in the matrix 21 (at least 21); `useCount` in `docs/api/order-lists.md` 3 (at least 1); `OrderListStore.TranslateSaveFailure` in `CspsUnitOfWork.cs` 1 (exactly 1); `ExpenseCategoryStore.TranslateSaveFailure` 1 (exactly 1).
- gitleaks on each staged change: no leaks. Only fake values (made-up names, `example.com` addresses). No em or en dash in the changed source or the new doc text.

## Task Commits

1. **Task 1: tracer, a Manager adds a product type** - RED `7134d0bd`, GREEN `b6f41649`
2. **Task 2: edit, retire, reactivate, delete on all three lists** - RED `5ed2d620`, GREEN `69b7442a`
3. **Task 3: races and audit** - RED `ee69cd5a`, GREEN `eaf3e3e0`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Application coverage needed unit tests for the generic handlers**
- **Found during:** Task 2, before the coverage run.
- **Issue:** The coverage gate counts unit tests only, and the six new handlers, the validator and the descriptor had only integration tests.
- **Fix:** `OrderListEntryHandlerTests` (all six handlers over all three lists, the validator and the descriptor), plus delete-race cases in `CreateOrderHandlerTests`, `OrderItemHandlerTests`, `OrderPaymentHandlerTests` and `OrderExpenseHandlerTests`. Application line coverage is 98%.
- **Files modified:** the five test files above.
- **Commit:** 5ed2d620, ee69cd5a

**2. [Rule 1 - Bug] The existing list tests assumed the old list shape**
- **Found during:** Task 2 RED.
- **Issue:** `ListOrderListsEndpointTests` asserted the exact five keys of a list item, and `ListOrderListHandlerTests` built items without a use count; `useCount` is now part of the item.
- **Fix:** Added `useCount` to the key set and the constructors.
- **Files modified:** `tests/Csps.Server.IntegrationTests/OrderLists/ListOrderListsEndpointTests.cs`, `tests/Csps.Application.UnitTests/OrderLists/ListOrderListHandlerTests.cs`
- **Commit:** 5ed2d620

### Plan notes (no change to scope; owner may want to rule on the first two)

- **Others rename answer.** The plan says a new name for Others is 422 `order-expense-categories.protected`. The Phase 6 category answered 400 on `name` ("The Others name can't change."). I followed the plan: the handler returns the 422 first, and the domain `Rename` keeps its 400 as a backstop. Say if you would rather have the Phase 6 answer; it is a one-line change in `UpdateOrderListEntryHandler`.
- **`useCount` on the staff list.** The three existing read routes (open to Admin too) now carry `useCount` on each item. This is what the plan asks for, and it is a small widening of what an Admin can read.
- **Race message.** The plan says the refused use gets "This product type was deleted." If the delete finished before the order's own check, the check finds no such entry and gives the older message "Choose a product type." The race test accepts either. The "was deleted" message is exercised by the Application tests and the store tests, which force the narrow window.
- **Domain files.** The plan's task 2 file list names the four domain files, but no domain change was needed.
- **One request type.** POST and PUT share `OrderListEntryRequest`; the validator reads the list and the edit flag from the validation context.
- **`OrderListEntryDeletedException` carries the list** (`Kind`), which the plan did not spell out; it is how the handler picks the right field and noun.
- **No new deadlock handling.** The create order handler does not catch a deadlock victim (it would surface as a 500). Sixty delete-versus-create races did not produce one, so I left it alone; say if you want it mapped to the "orders are being saved" 409.
- **Files beyond the plan's list:** `tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs`, `OrderItemHandlerTests.cs`, `OrderPaymentHandlerTests.cs`, `OrderExpenseHandlerTests.cs`, `src/Csps.Application/Orders/OrderChildWrite.cs` and `src/Csps.Application/Orders/CreateOrderHandler.cs`.
- **New user-facing wording for the owner to review:**
  - "That name is already used. Choose another one." (from the plan; replaces the Phase 6 "Another category already has this name." for these lists)
  - "This product type was deleted." / "This payment method was deleted." / "This category was deleted." (an entry that no longer exists, and an order that names one deleted a moment earlier)
  - "This product type is used by an order, so it can't be deleted. Retire it instead." and the same with "payment method" and "category"
  - "Enter a product type name." / "Enter a payment method name." / "Enter a category name." (same pattern as the domain's existing messages)
  - Reused unchanged: "Keep the name to 40 characters or fewer.", "Choose a badge color.", "Reload the form and try again.", "This was changed by someone else. Reload and try again.", "The Others category can't be renamed, retired or deleted."

**Total deviations:** 2 auto-fixed (Rule 2, Rule 1), 8 plan notes. **Impact:** two behaviours for the owner to confirm (Others rename answer, `useCount` on the staff list); no change to scope.

## Issues Encountered

- A one-off command in this shell started a `python3` heredoc that found no Python; it read only its own input and left nothing running. A few empty `cat > /dev/null` heredocs were run by mistake for the same reason (input from the heredoc, never the terminal). No effect on the result.
- The working tree stores files with CRLF; some text I inserted with `sed` has LF only, so a few files have mixed line endings in the working copy. Git normalises on commit (it printed the usual LF to CRLF notice).
- The OpenAPI snapshot run with the write flag fails by design; the run without it passes.

## Deferred Issues

**Owner ruling D-46 (2026-10-28):** Others rename answers like Phase 6 (400 on `name`), the list messages are approved, and an order-create deadlock maps to the 409. The two code changes are queued in `deferred-items.md`.

- **Open from 07-16, still waiting on the owner:** the `newest` sort ruling (D-45 recorded), `IX_Orders_CreatedAtUtc` and the redundant `IX_OrderItems_ProductTypeId`. Nothing here touches them; no index or column was dropped.
- **Open from D-39:** refunds on a soft-deleted order and money on hand (parked in the STATE.md owner backlog).
- **Phase 8:** the Settings sections that use these routes. The unused-entry delete, the use count and the retired badge are ready for them.
- The `ExpenseListTimingTests` machine-speed note in `deferred-items.md` stands (owner ruling D-76); it passed in the final full run.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-07-49 (Admin changing the lists) is mitigated by `Policies.Manager` on every write and on GET id, with matrix rows and an Admin 403 test on every route. T-07-50 (deleting an entry that money rows use) is mitigated by the use count with the SoftDelete filter lifted, the foreign keys as backstop translated to in-use, and the race tests. T-07-51 (races as 500s) is mitigated by `OrderListStore.TranslateSaveFailure` chained in `CspsUnitOfWork` and the add and delete race tests. T-07-52 (unaudited changes) is mitigated by one audit entry per change in the same save and the audit test. No package was added.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 07-18. The three lists are now fully managed by the API, the Phase 8 Settings sections can be built on them, and an order can no longer save a row against an entry that was just deleted.

## Self-Check: PASSED

All files listed under key-files.created exist on disk, and all six task commits (7134d0bd, b6f41649, 5ed2d620, 69b7442a, ee69cd5a, eaf3e3e0) are ancestors of HEAD. The acceptance criteria above were re-run after the last commit.
