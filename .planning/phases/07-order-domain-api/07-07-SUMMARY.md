---
phase: 07-order-domain-api
plan: 07
subsystem: api
tags: [orders, order-details, optimistic-concurrency, row-version, audit, race-test, openapi]
created: "2026-10-28T11:45:00-05:00"
updated: "2026-10-28T11:45:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-05 Order aggregate (Touch, EditVersion, RowVersion), OrderDetailsFieldsValidator, IOrders.FindAsync, IOrderReader.GetDetailAsync, OrderFixtures; 07-06 ConcurrentRequests.SendAllTogetherAsync"
provides:
  - "PUT /api/v1/orders/{id} (Staff): edits customer details, dates and notes with the row version, 200 with the full detail, 409 edit.stale on a stale version or lost race, 404 orders.not-found"
  - "Order.UpdateDetails, OrderDetailsChanges and DueDateChange: re-checks every rule, assigns only on a real change, reports what moved"
  - "UpdateOrderDetailsRequest, UpdateOrderDetailsRequestValidator, UpdateOrderDetailsHandler"
  - "OrderAuditDetail.DetailsChanged and one order.changed entry per real change, without customer text"
  - "OrderConcurrencyTests: the order 409 race tests (10 rounds); later plans add child cases"
  - "OrderFixtures.PutDetailsAsync and DetailsBodyFrom; PUT section in docs/api/orders.md; refreshed OpenAPI contract"
affects: [07-08, 07-09, 07-10, 07-11, 07-12, 07-13, 07-14, 07-15, 07-16, 07-17, 07-18, 07-19, 07-20]

actuals:
  tokens: 21600
  tasks: 3
  commits: 6
plan_head_before: 731a6ef9db73e351a9e058333f9e0629cd828315
plan_head_after: 9a3bf4f68a14ac66b695d52ee0e8841263ff5b27

tech-stack:
  added: []
  patterns:
    - "A form save compares the sent version with the loaded RowVersion inside the transaction (stale answers 409 edit.stale), and the EF row version token on the root UPDATE turns a lost race into ConcurrencyConflictException, also 409; no retry"
    - "The audit entry is recorded before SaveChanges in the same save, so the loser of a race rolls back its entry with its change"
    - "Order-level version: any edit that calls Touch moves the root row version, so two edits of different fields still give one winner"

key-files:
  created:
    - src/Csps.Domain/Orders/OrderChanges.cs
    - src/Csps.Application/Orders/UpdateOrderDetailsRequest.cs
    - src/Csps.Application/Orders/UpdateOrderDetailsRequestValidator.cs
    - src/Csps.Application/Orders/UpdateOrderDetailsHandler.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderDetailsTests.cs
    - tests/Csps.Application.UnitTests/Orders/UpdateOrderDetailsHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/UpdateOrderDetailsEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Server/Controllers/OrdersController.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md
    - docs/operations/audit-log.md

key-decisions:
  - "Order.UpdateDetails(OrderDetails, DateTimeOffset now) has no today parameter: no details rule reads the business today, and an unused parameter would be dead code. This follows the 07-05 decision on Order.Create."
  - "The due date change is its own record, DueDateChange(DateOnly? From, DateOnly To), not ValueChange<DateOnly>: ValueChange needs a non-nullable struct and an imported order can have no due date. The order date change still uses ValueChange<DateOnly>."
  - "For an imported order with no due date the audit pair is written dueDate=>2026-11-18 (empty old value); documented in docs/api/orders.md and docs/operations/audit-log.md."
  - "A save with a stale version, a refused form or a missing order commits an empty transaction and returns the failure; only a thrown ConcurrencyConflictException rolls back. Nothing is saved or audited in either case."
  - "UpdateOrderDetailsHandler takes IAuditTrail between the calendar and the unit of work, matching the expense handler's order."

requirements-completed: [ORD-05, ORD-08]

coverage:
  - id: D1
    description: "A staff member of either role changes an order's details with the version they opened; the answer and the next read show the change, a new version, lastChangedBy the editor and recordedBy the creator"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/UpdateOrderDetailsEndpointTests.cs#AnAdminChangesTheDueDateOfAnOrderAManagerRecordedAndTheNextReadShowsIt"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/UpdateOrderDetailsEndpointTests.cs#AManagerEditsAnOrderAnAdminRecordedAndTheOtherWayRound"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every details rule applies on edit, the due date is required even for an imported order with none, a malformed version is a 400 on version, and a forged attribution, number, status or totals member is ignored"
    requirement: ORD-05
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderDetailsTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/UpdateOrderDetailsHandlerTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/UpdateOrderDetailsEndpointTests.cs#EveryDetailsRuleAppliesOnEditAndTheDueDateIsRequired"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/UpdateOrderDetailsEndpointTests.cs#ForgedAttributionNumberStatusAndTotalsInTheBodyAreIgnored"
        status: pass
    human_judgment: false
  - id: D3
    description: "A stale or edited-elsewhere version answers 409 edit.stale with the exact message and saves nothing; two same-version saves sent together give exactly one 200 and one 409 in each of 10 rounds, and the stored details are the winner's"
    requirement: ORD-08
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs#TwoStaffSavingTheSameOrderWithTheSameVersionGiveExactlyOneWinnerEveryTime"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderConcurrencyTests.cs#TwoEditsOfDifferentFieldsWithTheSameVersionStillGiveOneWinner"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/UpdateOrderDetailsEndpointTests.cs#ASaveWithAnOlderVersionIsRefusedWithTheStaleMessageAndStoresNothing"
        status: pass
    human_judgment: false
  - id: D4
    description: "A save that changes nothing answers 200, writes no audit entry and keeps the version; a real change writes one order.changed entry with date pairs and field names, never customer text"
    requirement: ORD-05
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/UpdateOrderDetailsEndpointTests.cs#ARealChangeWritesExactlyOneChangedEntryForTheOrderWithNoCustomerText"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/UpdateOrderDetailsEndpointTests.cs#ASaveThatChangesNothingWritesNoChangedEntry"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "The plain-English field messages and the PUT section of docs/api/orders.md read clearly to a person"
    requirement: ORD-05
    verification: []
    human_judgment: true
    rationale: "The wording of docs/api/orders.md was written in this plan from the owner's rules; no test judges prose."

duration: 25 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 07: Edit an order's details Summary

**Any staff member can correct an order's customer details, dates and notes through PUT /api/v1/orders/{id}. The save carries the row version: a stale version or a lost race answers 409 edit.stale and stores nothing, a change that changes nothing keeps the version and writes nothing, and a real change writes one order.changed audit entry with date pairs and field names but no customer text.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-10-28T16:19Z
- **Completed:** 2026-10-28T16:44Z
- **Tasks:** 3 of 3
- **Files changed:** 17 hand-written (about 21,600 tokens of diff, chars/4, with the OpenAPI JSON and the generated types left out), 19 in all

## Accomplishments

- Task 1 (tracer): `Order.UpdateDetails`, the request, validator and handler, the PUT route, the matrix row and the refreshed contract. An Admin edits the due date of a Manager's order and reads it back with a new version and `lastChangedBy` the Admin; a stale version is a 409; an unknown id is a 404; anonymous is a 401.
- Task 2: domain, handler and endpoint proof that every details rule holds on edit, the due date is required even for an imported order that had none, the version text is checked, no-op saves change nothing, forged members are ignored, a soft-deleted order is a 404 and there is no own-order rule or `canEdit` flag (D-25). PUT section added to `docs/api/orders.md`.
- Task 3: `OrderAuditDetail.DetailsChanged` and one `order.changed` entry per real change, recorded in the same save so the loser of a race rolls its entry back; `OrderConcurrencyTests` with 10 rounds of two same-version PUTs, a different-fields race and a late-save case.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | b8a6b58a `test(07-07): edit an order's details (RED)` | 53453916 `feat(07-07): edit an order's details with the version check (ORD-05, ORD-08)` |
| 2 | 12e5722d `test(07-07): details edit rules and any-staff edits` | 705ccaad `feat(07-07): details edit rules for any staff member (D-22, D-25)` |
| 3 | bf0354a1 `test(07-07): details audit and same-version race (RED)` | 9a3bf4f6 `feat(07-07): audited details edits, one winner per race (D-31, ORD-08)` |

- **Task 1 RED:** 4 of 4 endpoint tests failed (the route did not exist: 404 where 200 and 409 were expected, and a missing `code` member). Valid assertion failures. `gsd_run check tdd-red-evidence` was not run (this runner's output is none of TAP, JUnit or Surefire); the failing output was read by hand.
- **Task 2 RED, honest note:** the new tests passed the first time they ran (11 domain, 12 handler and 11 endpoint cases), so there was no red. The tracer in Task 1 already had to carry the full `UpdateDetails` rules, the version compare and the no-op path to be production quality, so these tests are regression proof, not new red. The commit is named without "(RED)" for that reason. The GREEN commit holds the PUT docs and the coverage run; no production code needed changing.
- **Task 3 RED:** `OrderAuditDetailTests` and the handler tests did not build (`DetailsChanged` and the audit constructor argument were missing): a compile-time RED. At runtime 2 of 17 server cases failed: the race test (`order.changed` count 0 where 1 was expected in round 1) and the one-entry audit test (`Sequence contains no elements`).
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with an automated-only verify, so both verify commands were re-run after GREEN (`UpdateOrderDetailsEndpointTests` 4 passed, `*Authorization*` 258 passed) before expansion. Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- `Csps.Domain.UnitTests`: 997 passed. `Csps.Application.UnitTests`: 1377 passed. `Csps.ArchitectureTests`: 241 passed.
- `Csps.Server.IntegrationTests` (full run, after the preflight showed all ports free): 1401 total, 1400 passed, 1 failed: `ExpenseListTimingTests` (known, see Issues). Included: `UpdateOrderDetailsEndpointTests` 14, `OrderConcurrencyTests` 3, `*Authorization*` 258, `*OpenApiSnapshotTests` 10.
- `OrderConcurrencyTests` re-run alone four times in a row: 3 of 3 each time, no flake.
- `Csps.Infrastructure.IntegrationTests` `AuditLogAppendOnlyTests` (reads `docs/operations/audit-log.md`): 8 passed. No schema change in this plan.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (1630/1630), branch 100% (628/628); Csps.Application line 98.4% (4203/4270), branch 94.6% (not gated). "Coverage gate passed."
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." `npm --prefix web run typecheck`: clean.
- Acceptance criteria re-run: `UpdateOrderDetails` in `OrdersController.cs` 4 (at least 1); `EditErrors.Stale` in the handler 2 (at least 1); `canEdit` in `OrderDetailResponse.cs` 0; `PUT /api/v1/orders` in `docs/api/orders.md` 1 (at least 1); `OrderChanged` in the handler 1; `SendTogetherAsync` in `OrderConcurrencyTests.cs` 2 (at least 1).
- gitleaks on each staged change: no leaks. Only the fake customer from the fixtures (`Juan Dela Cruz`, `juan.dc@example.com`) and fake numbers appear. No en or em dash in the changed `src` files or docs.

## Deviations from Plan

### Plan notes (no behaviour change)

- `Order.UpdateDetails` has no `today` parameter (see key-decisions).
- The due date change is `DueDateChange`, not `ValueChange<DateOnly>`, because `ValueChange<T>` is constrained to non-nullable structs (see key-decisions).
- `docs/operations/audit-log.md` was also edited (one table cell and `updated`) to say the old due date is empty for an imported order that had none. It was not in the plan's file list.
- Task 2 had no red phase (see TDD Gate Compliance).
- Test-only fixes while writing: `DateTimeOffset.UtcNow` is banned (RS0030), so the soft-delete test uses `TimeProvider.System`; one handler assertion expected a rollback where a returned failure commits an empty transaction (the assertion was wrong, not the handler).

**Total deviations:** 0 auto-fixed, 5 plan notes. **Impact:** none on scope.

## Issues Encountered

- `ExpenseListTimingTests` ("five years, last page, size 100") failed in the full Server run (2 m 16 s for that case, over the 300 ms p95 limit). It reads the company expense list, which this plan does not touch. It is the same pre-existing slow-machine failure recorded in `deferred-items.md` (plan 07-01), Phase 6 plan 06-10 and owner ruling D-76. Not hidden, not changed.
- A bash heredoc with an apostrophe in the body failed to parse once; the text was written with the Write tool instead. No effect on the result.

## Deferred Issues

- The `ExpenseListTimingTests` machine-speed failure above (pre-existing, owner ruling D-76 stands).
- Whether an edit should be refused on a Completed or Cancelled order is not ruled anywhere in Phase 7 context, so details edits are allowed in every status. If the owner wants a rule, it belongs with the status plans.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-07-17 (lost update) is mitigated by the version compare, the EF row version token on the root UPDATE and the 10-round race test; T-07-18 (customer text in the audit log) by `DetailsChanged` naming fields only and the tests that assert no text; T-07-19 (forged attribution) by the request record, which has no attribution members, and `ForgedAttributionNumberStatusAndTotalsInTheBodyAreIgnored`. No package was added and no migration was made.

## Authentication Gates

None.

## Next Phase Readiness

Ready for plan 07-08 (item changes). Child form saves can copy the version contract fixed here: parse the version in the validator, compare it with the loaded `Order.RowVersion` inside the transaction, call a domain method that ends with `Touch`, record the audit entry before `SaveChangesAsync`, and map `ConcurrencyConflictException` to `EditErrors.Stale`. `OrderConcurrencyTests` is the file to add the child race cases to, and `OrderFixtures.DetailsBodyFrom` shows how to build an unchanged copy of a form.

## Self-Check: PASSED

All 11 key files created or edited were checked with `[ -f ]` and exist, and all six task commits (b8a6b58a, 53453916, 12e5722d, 705ccaad, bf0354a1, 9a3bf4f6) are ancestors of HEAD. The acceptance criteria above were re-run after the last commit.
