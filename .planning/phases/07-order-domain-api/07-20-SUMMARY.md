---
phase: 07-order-domain-api
plan: 20
subsystem: testing
tags: [orders, dev-seed, import, ui-spec-fixtures, testing-route, e2e-seeding]
created: "2026-10-28T21:10:00-05:00"
updated: "2026-10-28T21:10:00-05:00"
status: complete

requires:
  - phase: 07-order-domain-api
    provides: "07-18 Order.Import, OrderImportRules.Default, ImportOrderHandler, OrderNumberCounter.EnsureAtLeast; 07-08 LegacyHolder and the seeded order lists; 07-05/07-06 Order and the number counter"
provides:
  - "OrdersSeedStep (Order 400, Name Orders): the eight UI-spec section 12.2 orders go into an empty Orders table through Order.Import with OrderImportRules.Default, and the 2026 counter is lifted to 159 so the next new order is ORD-2026-0160"
  - "CompanyExpensesSeedStep.ReadPayersAsync is internal so both steps share one payer rule"
  - "POST /api/testing/orders (TestingOrdersController): imports one order through ImportOrderHandler for Phase 8 end-to-end specs; compiled into Debug builds only (CSPS_TESTING) and mapped in the Testing environment only"
  - "Authorization matrix row and idempotency allow-list entry for the testing route; development.md explains the seed and the route"
affects: [08, 7.1]

actuals:
  tokens: 11100
  tasks: 2
  commits: 4
plan_head_before: dd77e4aab64706583ee717a520c95964f40f268f
plan_head_after: 00269a54c92364668c562c7ae37179dd8b6df7f5

tech-stack:
  added: []
  patterns:
    - "A seed step reuses the production import path (Order.Import) and stamps the added rows itself, because the seed context has no stamp interceptor"
    - "A testing-only route shares the create call's member names and goes through the same handler a later tool will use, so the e2e data cannot drift from the real rules"

key-files:
  created:
    - src/Csps.Infrastructure/Seeding/OrdersSeedStep.cs
    - src/Csps.Server/Controllers/TestingOrdersController.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/OrdersSeedStepTests.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingOrdersTests.cs
  modified:
    - src/Csps.Infrastructure/Seeding/DevSeedSteps.cs
    - src/Csps.Infrastructure/Seeding/CompanyExpensesSeedStep.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
    - docs/development.md

key-decisions:
  - "Receivers and payers alternate over the active staff who can pay (the company expenses rule, now shared), or are the Legacy holder when there are none; the step never creates accounts, list entries or a second copy."
  - "Each seeded order gets one status-history row (no earlier status, nobody, 09:00 Manila on its order date) instead of a made-up path through the statuses, because the UI spec gives the current status only."
  - "The seeded rows are stamped with the seed time and the first payer (System when only the Legacy holder exists), the same way the company expenses step stamps its rows."
  - "The testing route defaults only the customer name (Test Customer) and the order date (the business today); every other member must be sent, and any rule the import path enforces answers 400 on its own field."
  - "Order images are not seeded: images belong to a later phase, so the spec's image counts are not stored."

patterns-established:
  - "Pattern: dev-seed content for orders is fixed text and fixed dates from the UI spec, so two runs on empty databases give the same rows"

requirements-completed: [ORD-20, ORD-21]

coverage:
  - id: S1
    description: "ORD-20: the dev seed adds the eight UI-spec orders (ORD-2026-0139 to ORD-2026-0159) with their statuses, dates, items, discounts, payments and expenses; ORD-2026-0148 reads the seven exact figures (22,450.00 / 1,122.50 / 21,327.50 / 12,000.00 / 9,327.50 / 6,065.00 / 15,262.50) and ORD-2026-0151 reads fullyPaid true with balance 0.00"
    requirement: ORD-20
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/OrdersSeedStepTests.cs#AddsTheEightUiSpecOrdersWithTheirNumbersAndStatuses"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/OrdersSeedStepTests.cs#Ord0148ReadsEveryFigureExactly"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/OrdersSeedStepTests.cs#Ord0151IsFullyPaidWithNoBalance"
        status: pass
    human_judgment: false
  - id: S2
    description: "ORD-20: payers and receivers are existing active staff who can pay, or the Legacy holder when there are none; no account is created; a second run changes nothing; the counter ends at 159 so the next order is ORD-2026-0160; every added row is stamped; the fixture text is fictional (example.com)"
    requirement: ORD-20
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/OrdersSeedStepTests.cs (ReceiversAndPayersAreTheActivePayersAndBothAreUsed, WithNoPayerAccountsTheLegacyHolderReceivesAndPaysAndNoAccountIsCreated, ASecondRunAddsNothing, TheCounterEndsAtOrAbove159SoTheNextOrderIsOrd0160, EveryStoredRecordIsStampedWithTheSeedTime, TheFixtureTextIsFictionalAndSafeForAPublicRepo)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs#TheOrdersStepRunsAfterTheCompanyExpensesStepWithItsOwnOrder"
        status: pass
    human_judgment: false
  - id: S3
    description: "ORD-21, D-37: POST /api/testing/orders imports an order with the given number, any of the seven statuses and exact server-worked totals; 400 on a bad or empty body, status or receiver; 422 orders.number-taken; the matrix and the idempotency allow-list cover it; the route is compiled out of Release and not mapped outside Testing"
    requirement: ORD-21
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Testing/TestingOrdersTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs (rows for POST /api/testing/orders, three callers)"
        status: pass
      - kind: command
        ref: "dotnet build src/Csps.Server -c Release -warnaserror: 0 warnings, 0 errors; ReleaseHasNoEmailSinkTests passes in the architecture run"
        status: pass
    human_judgment: false
  - id: S4
    description: "development.md tells the owner and Phase 8 what the orders seed adds, that it needs staff first or falls back to the Legacy holder, and how to call the testing route"
    requirement: ORD-20
    verification:
      - kind: command
        ref: "grep -c 'leaves the counters alone' docs/development.md prints 1"
        status: pass
    human_judgment: true
    rationale: "Whether the wording reads clearly to the owner is a judgment no test asserts"
---

# Phase 7 Plan 20: Order Seed and Testing Route Summary

**The dev seed now fills a local or e2e database with the UI spec's eight orders through the legacy import path, and Phase 8 end-to-end specs can seed exact orders through a Debug-only `POST /api/testing/orders`.**

## Performance

- **Duration:** about 35 min of work (first commit 20:47, last task commit 20:56; the full verification run took the rest)
- **Tasks:** 2 of 2 (the tracer, then the testing route)
- **Files:** 10 changed (4 created, 6 modified)
- **Commits:** 4 task commits

## Accomplishments

- A new `OrdersSeedStep` (run order 400, after the company expenses) adds ORD-2026-0139, 0142, 0148, 0151, 0153, 0155, 0157 and 0159 to an empty Orders table. Each goes through `Order.Import` with `OrderImportRules.Default`, so every figure is worked out from the children. ORD-2026-0148 reads 22,450.00 / 1,122.50 / 21,327.50 / 12,000.00 / 9,327.50 / 6,065.00 / 15,262.50. ORD-2026-0151 reads Fully Paid with a balance of 0.00, and ORD-2026-0142 is Completed with a balance of 0.00.
- The 2026 counter is lifted to 159, so the next new order is ORD-2026-0160. A second run adds nothing.
- Receivers and payers are the active staff who can pay (the same rule as the company expenses seed), or the Legacy holder when there are none. The step never creates an account or a list entry.
- All text is made up. The spec's gmail address is `juan.dc@example.com`, and the other contact numbers are invented.
- `POST /api/testing/orders` takes the create call's member names plus `number`. It answers 201 with the id, 400 with the failing fields (including indexed paths such as `payments[0].receivedByUserId`), or 422 `orders.number-taken`. Any of the seven statuses works, including a Completed order with a balance. It exists only in Debug builds in the Testing environment.
- The route has its authorization matrix row (400 for Anonymous, Admin and Manager with no body), its anonymous key and its idempotency allow-list reason.
- `docs/development.md` explains the orders seed and the route.

## Task Commits

1. **Task 1 (tracer): the dev seed adds the eight UI-spec orders**
   - RED `174df429` test(07-20): seed the UI-spec orders (RED)
   - GREEN `4d5bb777` feat(07-20): seed the UI-spec orders (ORD-20)
2. **Task 2: testing-only order route**
   - RED `58ac0217` test(07-20): testing-only order seeding (RED)
   - GREEN `00269a54` feat(07-20): testing-only order seeding for Phase 8 e2e (ORD-21)

**Tracer gate:** after Task 1 the tracer verify (OrdersSeedStepTests, DevSeed and CompanyExpensesSeedStep classes: 88 of 88) passed, and the real `tools/Csps.DevSeed` command was run against `CSPS_E2E` (no reset): the first run printed `[400] Orders: changed`, the second `[400] Orders: unchanged`. Expansion continued.

**TDD RED evidence.** The xunit v3 Microsoft Testing Platform report is not a format `gsd check tdd-red-evidence` reads, so the semantic assessment is by hand.

- Task 1: the step was a placeholder that adds nothing, so the build compiled. Ten tests failed on the planned assertions (no orders stored, `Changed` false, no counter row, step not in `DevSeedSteps.All`); the six older `DevSeederTests` kept passing. A first run showed two tests passing on an empty list, so I added an `orders.Count.ShouldBe(8)` check to them before committing RED.
- Task 2: the route did not exist. Thirteen tests failed: the nine behaviour tests of `TestingOrdersTests` (404 instead of 201, 400 or 422), the three matrix rows (404 instead of 400) and the coverage checks that found the new matrix and allow-list entries without a route. `DevelopmentDoesNotMapTheRoute` passed in RED because the route was already absent; it is a negative guard that becomes meaningful once the route exists in the Testing environment, and the 201 tests prove that.

## Verification Evidence

- `dotnet build Csps.slnx -warnaserror`: 0 warnings, 0 errors. `dotnet build src/Csps.Server -c Release -warnaserror`: 0 warnings, 0 errors.
- `dotnet test --solution Csps.slnx`: 5839 tests, 0 failed, 1 skipped (the live HIBP smoke test, as before). Per project: Domain, Application, HostProbe, Architecture (241), Infrastructure integration and Server integration all passed. The known `ExpenseListTimingTests` flake did not fail this run.
- Filtered runs: `*OrdersSeedStepTests` plus `*DevSeed*` plus `*CompanyExpensesSeedStepTests` 88 of 88; `*TestingOrdersTests` plus `*AuthorizationMatrix*` plus `*Idempotency*` 404 of 404.
- Coverage gate: Csps.Domain line 100% (2497/2497) and branch 100% (1062/1062); Csps.Application line 98.4% (6712/6815), branch 95.6%; passed.
- `npm --prefix web run test -- --run`: 202 files, 6033 tests, all passed (no web file changed).
- `npm --prefix tools/openapi-gen run check`: generated types match the snapshot.
- `dotnet format Csps.slnx --verify-no-changes --include <changed .cs files>`: clean (exit 0).
- Acceptance greps: `OrdersSeedStep` in `DevSeedSteps.cs` 1; `gmail` in `OrdersSeedStep.cs` 0; `OrderImportRules.Default` in `OrdersSeedStep.cs` 2 (at least 1); `#if CSPS_TESTING` in `TestingOrdersController.cs` 1; `/api/testing/orders` in `AuthorizationMatrix.cs` 3 (at least 1) and in `IdempotencyAllowList.cs` 1.
- gitleaks ran on all four commits through the pre-commit hook: no leaks. No real name, email, server, database or local path is in the new files (the seed names come from the UI spec, which is fictional).
- Safety: the seed tool was run against `CSPS_E2E` only; `CSPS_Legacy_Restore`, `_local/` and every `BetsLLC_*` database were not touched. Preflight was clean before each heavy run (ports free, no other dev or test processes).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The step class has a property named `Order`**
- **Found during:** Task 1 (GREEN)
- **Issue:** inside `OrdersSeedStep`, `Order.Import` would read the `int Order` property of `ISeedStep`, not the domain type.
- **Fix:** a using alias, `DomainOrder = Csps.Domain.Orders.Order`.
- **Files modified:** `src/Csps.Infrastructure/Seeding/OrdersSeedStep.cs`
- **Commit:** 4d5bb777

### Plan-shape choices (no behaviour outside the plan)

- **`CompanyExpensesSeedStep.ReadPayersAsync` is now `internal`** (was `private`) so the orders step reuses the same payer rule instead of copying it. Same query, no behaviour change. The plan's interface list named it as the payer rule.
- **The step stamps the added rows itself** (created by the first payer, or System when only the Legacy holder exists, at the seed time), because the seed context has no stamp interceptor. The company expenses step does the same for its rows.
- **One status-history row per order** (09:00 Manila on the order date). The UI spec gives only the current status.
- **Invented values for what the spec leaves open:** contact numbers for seven orders, payment dates and methods for ORD-0151/0153/0157/0159/0142, expense dates and categories for ORD-0151/0157/0142, and item descriptions and size ranges for those orders. The numbers, statuses, dates, quantities, prices, discounts and every amount are the spec's. Spec dashes were written as commas or hyphens in the descriptions and sizes.
- **Images are not seeded.** The spec lists image counts, but images are a later phase. The 0148 cascade sentence about images is not part of this seed.
- **The testing route keeps its checks in the controller** only for what the handler cannot see (the status text, the three kinds of date text). Everything else is the import handler's own answer.

**Total deviations:** 1 auto-fixed (blocking, a name clash) plus the shape choices above. **Impact:** none on the plan's goal; no schema change, no package, no migration, no inline SQL.

## Owner Questions and New Wording for Review

None need a ruling before the phase closes. For review: the invented demo values listed above (contact numbers, the payment and expense details for the seven orders the spec only summarises). They are fictional and easy to change in `OrdersSeedStep.cs`. The testing route defaults the customer name to "Test Customer" (testing only, never shown to staff).

## Known Stubs

None. The RED placeholder step was replaced in the GREEN commit (`grep` for TODO, FIXME and placeholder text in the new files finds nothing).

## Threat Flags

None. The testing route is the surface the plan's threat model already covers (T-07-59: `#if CSPS_TESTING`, Testing environment only, matrix and allow-list rows). T-07-58 (seeding the wrong database) is held by the unchanged `DevSeedTargetGuard`, and the step adds only to an empty Orders table. T-07-60 (real-looking data in a public repo) is held by the example.com address and invented numbers, with gitleaks clean.

## Issues Encountered

None. `ExpenseListTimingTests` (known, D-76) passed in the full run, so there was nothing to record.

## Notes for the orchestrator

- D-77 reset: `web/scripts/e2e.mjs` already runs the dev-seed tool with `--reset` against `CSPS_E2E` before every e2e run, so the new step needs no change there; each e2e run gets the eight orders fresh. I ran the seed without `--reset` against `CSPS_E2E` twice (changed, then unchanged), so that database now holds the eight orders until the next e2e run resets it.
- Phase 8 can add a `createOrder` helper to `web/e2e/testing-api.ts`; the route and its body are described in `docs/development.md` ("Seeding an order for an end-to-end spec").
- D-48 (audit Done to filter and the subline) is the orchestrator's follow-up after this plan, as `deferred-items.md` says. Nothing in this plan touched it.

## Next Phase Readiness

This is the last plan of Phase 7. Ready for the phase checks (`/gsd-verify-work`, secure-phase and the D-48 follow-up) and then Phase 7.1 or Phase 8. Phase 8 builds the orders screens on the seeded orders and the testing route.

## Self-Check: PASSED

All four created files and the six modified files exist on disk, all four task commits are ancestors of HEAD, the `commits` count (4) was measured with `git rev-list --count` from the plan ledger (`plan_head_before` dd77e4aa), and every task's acceptance criteria were re-run and passed.
