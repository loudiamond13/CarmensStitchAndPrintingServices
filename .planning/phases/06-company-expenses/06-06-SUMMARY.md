---
phase: 06-company-expenses
plan: 06
subsystem: testing
tags: [ef-core, performance, query-count, compiled-queries, p95, d-28, perf-04]
created: "2026-10-25T09:43:00-05:00"
updated: "2026-10-25T09:43:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: CompanyExpenseReader (list, KPIs, detail), IX_CompanyExpenses_List, ExpenseFixtures, the KPI route (plans 06-02, 06-03, 06-05)
provides:
  - CommandCounter (a DbCommandInterceptor) and CspsDatabase.CreateContext(params IInterceptor[]) for N+1 guards, ready for Phase 7
  - Exact command-count tests for the reader (list 2, KPIs 2, detail 1) and an endpoint test that page size 10 and 100 run the same count
  - The detail read and both KPI commands compiled with EF.CompileAsyncQuery
  - ExpenseListTimingTests: p95 under 300 ms on about 36,500 fake expenses, run alone
  - docs/operations/list-performance.md: how the check runs and how to read the live p95
affects: [06-08, 06-09, 07]

actuals:
  tokens: 13700
  tasks: 2
  commits: 4
plan_head_before: c5f44227c702f044f43dea51b7a7af40d46f5271
plan_head_after: 81d5c54438dd6db9aa1d79b0c9667216f3c66599

tech-stack:
  added: []
  patterns:
    - "EF.CompileAsyncQuery with a CancellationToken lambda parameter (the overload that returns Func<TContext, TParam, CancellationToken, Task<T>>), projecting into private row classes with init properties"
    - "Command-count guard: CommandCounter added to a test context (CreateContext(counter)) or to the host (ConfigureDbContext AddInterceptors), asserted exactly at reader level and by equality at endpoint level after a warm-up"
    - "Repeatable fake data from a small xorshift sequence, because System.Random is banned in this repo"

key-files:
  created:
    - tests/Csps.Testing/CommandCounter.cs
    - tests/Csps.Infrastructure.IntegrationTests/Expenses/CompanyExpenseReaderQueryCountTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseListQueryCountTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseListTimingTests.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseTimingData.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseTimingCollection.cs
    - docs/operations/list-performance.md
  modified:
    - tests/Csps.Testing/CspsDatabase.cs
    - src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs

key-decisions:
  - "The list stays plain LINQ (its optional filters change the shape); the detail read and both KPI commands are compiled because their shape is fixed and the KPI row loads with every page"
  - "The endpoint-level counter proves A2: ConfigureDbContext appends to the host's interceptors, so a create through the counting host still stamps CreatedById"
  - "The timing data uses its own xorshift sequence instead of System.Random, which BannedSymbols forbids"

patterns-established:
  - "Phase 7 can reuse CommandCounter and CreateContext(params IInterceptor[]) for the order list N+1 guard"

requirements-completed: [PERF-04]

coverage:
  - id: D1
    description: "The expense reader runs a fixed number of SQL commands whatever the page size: list 2 at page size 10 and 100, filtered and empty; KPIs 2; detail 1 (PERF-04)"
    requirement: PERF-04
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Expenses/CompanyExpenseReaderQueryCountTests.cs (7 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Through the endpoint, page size 10 and 100 run the same number of SQL commands (no N+1), the KPI route is repeatable, and a create through the counting host still stamps the caller (PERF-04, assumption A2)"
    requirement: PERF-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseListQueryCountTests.cs (3 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The detail read and both KPI commands are compiled queries and keep their answers"
    requirement: PERF-04
    verification:
      - kind: integration
        ref: "CompanyExpenseReaderQueryCountTests (figures) plus CompanyExpenseKpisEndpointTests 6/6 and CreateCompanyExpenseEndpointTests 20/20"
        status: pass
    human_judgment: false
  - id: D4
    description: "p95 of the list (default window, category filter, staff-name search, five-year last page at size 100) and the KPIs is under 300 ms on about 36,500 rows, locally (D-28)"
    requirement: PERF-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseListTimingTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "The same p95 holds on the CI runner with the SQL container (assumption A6). It cannot be confirmed from this machine."
    requirement: PERF-04
    verification: []
    human_judgment: true
    rationale: "Only a CI run shows the container and the shared runner's timing. The first CI run of this branch decides; any CI-only margin is the owner's call (parked in the Owner backlog)."

duration: 26min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 06: Expense List Speed Guards Summary

**An exact SQL command count for the expense list, KPIs and detail (reader level and endpoint level, with a reusable CommandCounter), compiled detail and KPI queries, and a p95-under-300-ms timing test on about 36,500 fake expenses that runs alone.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-10-25T14:17:00Z
- **Completed:** 2026-10-25T14:43:00Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 9 code and docs files (plus this summary and the planning files)

## Accomplishments

- `CommandCounter` (thread-safe, counts reader, scalar and non-query commands, sync and async) and `CspsDatabase.CreateContext(params IInterceptor[])` are in `Csps.Testing`. The parameterless overload keeps its behaviour.
- Reader guards: 150 seeded rows, `ListAsync` runs exactly 2 commands at page size 10 and 100, with a search and a category filter, and on an empty result. `GetKpisAsync` runs 2 and `GetDetailAsync` runs 1 (also 1 for an unknown id). The KPI and detail figures are compared with figures computed by LINQ from the seeded rows.
- Endpoint guards: after a warm-up, `GET ?pageSize=10` and `GET ?pageSize=100` run the same number of commands, the counter is proven attached (`Count > 0`), and a POST create through the counting host still stores `CreatedById` as the caller. That settles assumption A2: `ConfigureDbContext` appends to the host's interceptors.
- `GetDetailAsync` and both KPI commands use `EF.CompileAsyncQuery`. The compiled delegates take a `CancellationToken` lambda parameter (the overload with a token), so cancellation still reaches the database. The list is plain LINQ because its optional filters change the shape.
- `ExpenseListTimingTests` builds 36,520 expenses in its own `CSPS_Test_<guid>` database (20 a day for 1,826 days, ten categories, six staff, 2% soft-deleted, EF `AddRange` in batches of 1,000) and times 200 requests per case after 20 warm-ups. The class sits in a collection with parallelization off.
- `docs/operations/list-performance.md` explains the checks, how to run the timing test alone, what to do on a failure, and a read-only PowerShell snippet that reads the live p95 from the `csps-*.json` request log lines (`RequestPath`, `Elapsed`).

## Measured on this machine (LocalDB, run alone)

```
default window: p50 65.8 ms, p95 106.6 ms
category filter: p50 2.8 ms, p95 3.7 ms
staff-name search: p50 75.3 ms, p95 79.6 ms
five years, last page, size 100: p50 188.4 ms, p95 197.8 ms
month KPIs: p50 7.2 ms, p95 8.5 ms
```

All five are under 300 ms. The five-year last page is the closest to the limit (about 100 ms of margin). The default window (p50 65.8 ms) is much slower than the same window with a category filter (2.8 ms), which looks like the planner scanning the table for the unfiltered window instead of using `IX_CompanyExpenses_List`. It passes with room, so no reader change or migration was made; see "Issues Encountered".

## Task Commits

1. **Task 1: Tracer, fixed command count and compiled detail and KPI queries (PERF-04)**
   - RED `47f5553` (test): the build fails because `CommandCounter` and `CreateContext(params IInterceptor[])` do not exist.
   - GREEN `aab1b8a` (feat)
2. **Task 2: p95 under 300 ms on five years of data (D-28)**
   - RED `b85e133` (test): the build fails because `ExpenseTimingData` does not exist.
   - GREEN `81d5c54` (feat)

**Plan metadata:** the `docs(06-06)` commit that follows this file.

### TDD gate compliance

`test(06-06)` precedes `feat(06-06)` for both tasks. No REFACTOR commits were needed. The RED evidence for both tasks is a compile failure on the planned missing helper, as the plan prescribes; the formal `gsd_run check tdd-red-evidence` classifier does not read the dotnet build output.

- **Task 1 RED:** `dotnet build tests/Csps.Infrastructure.IntegrationTests` printed 7 errors, all `CS0246: The type or namespace name 'CommandCounter' could not be found`. Semantic assessment: the failure is the planned missing helper, not a syntax or fixture fault.
- **Task 1 GREEN as characterization:** once the helpers existed, the guards passed at once (7/7 and 3/3) because the reader already ran 2, 2 and 1 commands (06-03 measured the list). They are committed as characterization tests. The compile of the detail and KPI queries was a refactor of production code held in place by those tests plus the KPI (6/6) and create (20/20) endpoint suites, so no separate failing test could exist for it.
- **Task 2 RED:** `dotnet build tests/Csps.Server.IntegrationTests` printed 6 errors, all `CS0103: The name 'ExpenseTimingData' does not exist in the current context`.
- **Task 2 GREEN as characterization:** the timing test passed on its first run, with every p95 under 300 ms, so it is a characterization test. The limit and the counts were not touched.

## Verification evidence

- `dotnet build Csps.slnx`: `0 Warning(s)`, `0 Error(s)`.
- `*CompanyExpenseReaderQueryCountTests`: `total: 7 failed: 0 succeeded: 7`.
- `*CompanyExpenseListQueryCountTests`: `total: 3 failed: 0 succeeded: 3`.
- `*CreateCompanyExpenseEndpointTests`: `total: 20 failed: 0`. `*CompanyExpenseKpisEndpointTests`: `total: 6 failed: 0`. `*ListCompanyExpensesEndpointTests`: `total: 32 failed: 0`.
- `*ExpenseListTimingTests` alone (twice): passed in 1m 35s and 1m 31s; the second run printed the figures above. No flake.
- Full `dotnet test --solution Csps.slnx` after the last code commit (the timing class ran alone at the end): `total: 3684, failed: 0, succeeded: 3683, skipped: 1` (the one skip existed before this plan).
- Acceptance greps: `DbCommandInterceptor` in `CommandCounter.cs` 1; `params IInterceptor[]` in `CspsDatabase.cs` 1; `CompileAsyncQuery` in the reader 3; `ShouldBe(2)` in the reader test 5; `DisableParallelization = true` in the collection file 1; `300` in the timing test 3; the doc has created and updated front matter and a "Read the real speed after release" section.
- Preflight was run before the timing runs and the full run: all four ports free, no other project's test processes.
- Secret scan: `gitleaks protect --staged` printed `no leaks found` for all four commits.

## Decisions Made

- The compiled queries project into private row classes with `init` properties; the public shape of the reader (`ICompanyExpenseReader`) did not change.
- The collection type is named `ExpenseTimingRunsAlone` (not `ExpenseTimingCollection`) because analyzer CA1711 forbids a type name ending in `Collection`. The file keeps the planned name `ExpenseTimingCollection.cs`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] System.Random is banned, so the seeded builder uses its own sequence**
- **Found during:** Task 2 (GREEN build)
- **Issue:** The plan asks for "a seeded Random", but `BannedSymbols` bans `System.Random` (RS0030, CWE-330/338).
- **Fix:** A small xorshift32 `Sequence` class inside `ExpenseTimingData.cs`. Same repeatability, no banned symbol, and the comment says it is test data and never a secret.
- **Files modified:** `tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseTimingData.cs`
- **Verification:** build has 0 warnings; the builder wrote exactly `20 x 1826` rows (asserted by the test).
- **Committed in:** `81d5c54`

**2. [Rule 3 - Blocking] Analyzer CA1711 and the banned `DateTimeOffset.UtcNow`**
- **Found during:** Task 1 and Task 2 (build)
- **Issue:** A type named `...Collection` fails CA1711, and `DateTimeOffset.UtcNow` is banned.
- **Fix:** The collection type is `ExpenseTimingRunsAlone`; the seed time comes from `TimeProvider.System.GetUtcNow()`.
- **Files modified:** `ExpenseTimingCollection.cs`, `ExpenseListTimingTests.cs`, `CompanyExpenseListQueryCountTests.cs`
- **Committed in:** `b85e133`, `aab1b8a`

**3. [Rule 3 - Blocking] `EF.CompileAsyncQuery` needs a CancellationToken lambda parameter**
- **Found during:** Task 1 (GREEN build)
- **Issue:** The overload without the token returns `Func<TContext, TParam, Task<T>>`; the one with a token returns the shape the reader needs.
- **Fix:** Each compiled lambda takes a trailing `CancellationToken _` parameter.
- **Files modified:** `src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs`
- **Committed in:** `aab1b8a`

---

**Total deviations:** 3 auto-fixed (3 blocking, all compile-time)
**Impact on plan:** No scope change and no production behaviour change beyond the compiled queries. `CspsDatabase.cs` and the reader were in `files_modified`; all other changed files were planned.

## Issues Encountered

- `dotnet format Csps.slnx --verify-no-changes` reports one pre-existing error, `src/Csps.Infrastructure/Identity/UserDirectory.cs(1,1): IMPORTS: Fix imports ordering`. That file is not touched by this plan (out of scope, so not fixed). It is logged in `deferred-items.md`.
- The unfiltered default window is much slower (p50 65.8 ms) than the same window with a category filter (2.8 ms). It is inside the limit, so it is a follow-up observation, not a failure: if the CI run shows a thin margin, read the plan of the unfiltered window command (the index `IX_CompanyExpenses_List` is filtered on `DeletedAtUtc IS NULL` and does not hold `Amount`). Any index change is a migration and needs the owner.

## Known Stubs

None.

## Threat Flags

None. No new route or trust boundary. T-06-21 (slow list or N+1) is covered by the exact-count tests, the compiled detail and KPI queries and the p95 test. T-06-22 (fake data reaching a shared or live database) is covered by the per-class `CspsDatabase` (only `CSPS_Test_<guid>` names) and by the runbook, which forbids live writes. T-06-SC: nothing was installed.

## User Setup Required

None - no external service configuration required.

## Owner items

- **A-06-03 (parked in the STATE.md Owner backlog):** after the first CI run of this branch, check the timing test's p95 on the runner. If it is thin or flaky, decide whether a CI-only margin is allowed. Not auto-approved, and the limit was not changed.

## Next Phase Readiness

- Plans 06-08 and 06-09 are unaffected (they use the list, KPI and detail routes, whose answers did not change).
- Phase 7 can reuse `CommandCounter` and `CspsDatabase.CreateContext(params IInterceptor[])` for the order list N+1 guard, and `ExpenseTimingData` as the model for its own timing data.
- No blockers.

## Self-Check: PASSED

All created files exist on disk; the four task commits (`47f5553`, `aab1b8a`, `b85e133`, `81d5c54`) are ancestors of HEAD; the test runs above passed.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
