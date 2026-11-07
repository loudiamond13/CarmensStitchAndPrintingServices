---
phase: 10-admin-dashboard
plan: 06
subsystem: api
tags: [dotnet, csharp, dashboard, chart, linq, openapi, tdd, authorization-matrix]
created: "2026-11-07T00:46:00-06:00"
updated: "2026-11-07T00:46:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: DashboardController, IDashboardReader, DashboardReader, DashboardApplicationRegistration and the summary tests (plan 10-05)
provides:
  - "GET /api/v1/dashboard/chart?months=6|12: every month of the window, oldest first, with income, expenses and profit, all worked out on the server"
  - "IDashboardReader.GetMonthSumsAsync: four grouped LINQ sums (payments, refunds, company expenses, order expenses) by the year and month of each row's own date"
  - "ChartMonths.Build: the pure month builder that fills gaps and works out income and profit"
  - "The months allow-list (6 or 12) with the plain message 'Choose 6 or 12 months.' on the field months"
  - "OrderSeeding can now seed order expenses"
affects: [10-07 dashboard page, 10-11 chart drawing (serial contract files)]

actuals:
  tokens: 17700
  tasks: 2
  commits: 4

plan_head_before: 8886c2add8c79c0c6806ac01522def3be5c853b1
plan_head_after: 242660c07121166c42d3d62aaf020f29e2fcd7cf

tech-stack:
  added: []
  patterns:
    - "A query value that must be an allow-listed number binds as text and is checked by the validator, so a non-number is a 400 on its own field and never a framework error"
    - "Four grouped LINQ sums merged and gap-filled in a pure Application function, instead of one wide SQL"

key-files:
  created:
    - src/Csps.Application/Dashboard/ChartMonths.cs
    - src/Csps.Application/Dashboard/DashboardChartResponse.cs
    - src/Csps.Application/Dashboard/GetDashboardChartHandler.cs
    - src/Csps.Application/Dashboard/GetDashboardChartRequest.cs
    - src/Csps.Application/Dashboard/GetDashboardChartRequestValidator.cs
    - tests/Csps.Application.UnitTests/Dashboard/ChartMonthsTests.cs
    - tests/Csps.Application.UnitTests/Dashboard/GetDashboardChartHandlerTests.cs
    - tests/Csps.Application.UnitTests/Dashboard/GetDashboardChartRequestValidatorTests.cs
    - tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs
  modified:
    - src/Csps.Application/Ports/IDashboardReader.cs
    - src/Csps.Infrastructure/Dashboard/DashboardReader.cs
    - src/Csps.Server/Controllers/DashboardController.cs
    - src/Csps.Server/Composition/DashboardApplicationRegistration.cs
    - tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Testing/OrderSeeding.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/dashboard.md

key-decisions:
  - "The request carries the months as text (GetDashboardChartRequest(string? Months)), not int?, so abc and 6,12 reach the validator and answer 400 on months"
  - "The window is the first day of the month months-1 back through the last day of the current business month, so an expense dated later this month counts and one dated next month counts in no month yet"
  - "A chart query failure uses its own code dashboard.invalid-request with the standard text 'Check the highlighted fields.'"

patterns-established:
  - "Reader method parameters named firstDay and lastDay, because CA1716 rejects from and to on an interface"

requirements-completed: [DASH-03]

coverage:
  - id: D1
    description: "GET dashboard/chart?months=6 gives six months oldest first with income, expenses and profit; Jun to Sep are zero; both roles get the same body; anonymous gets 401"
    requirement: DASH-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs#SixMonthsComeBackOldestFirstWithIncomeExpensesAndProfit"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs#BothRolesGetTheSameBody"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs#AnAnonymousCallerGets401"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus (GET /api/v1/dashboard/chart)"
        status: pass
    human_judgment: false
  - id: D2
    description: "months=12 gives twelve months and no parameter gives six"
    requirement: DASH-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs#TwelveMonthsGiveTwelveItemsFromLastDecemberToThisNovember"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs#NoMonthsParameterMeansSix"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Dashboard/ChartMonthsTests.cs#TwelveMonthsFromDecember2025RunToNovember2026OldestFirst"
        status: pass
    human_judgment: false
  - id: D3
    description: "Months other than 6 or 12 (7, 0, -6, 1000, text) answer 400 on months with 'Choose 6 or 12 months.' and run no figure query"
    requirement: DASH-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs#AnyWindowOtherThanSixOrTwelveIsA400OnMonths"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Dashboard/GetDashboardChartHandlerTests.cs#AnyOtherMonthsIsA400OnMonthsAndTheReaderIsNeverAsked"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Dashboard/GetDashboardChartRequestValidatorTests.cs#AnythingElseIsRefusedWithThePlainMessageOnMonths"
        status: pass
    human_judgment: false
  - id: D4
    description: "Income is payments minus refunds and can be below zero; expenses are company plus order expenses; profit is income minus expenses; empty months are zero"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Dashboard/ChartMonthsTests.cs#IncomeIsPaymentsMinusRefundsExpensesAreCompanyPlusOrderAndProfitIsTheDifference"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Dashboard/ChartMonthsTests.cs#ARefundLargerThanPaymentsGivesNegativeIncomeAndProfit"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Dashboard/ChartMonthsTests.cs#AnEmptyInputGivesZeroIncomeExpensesAndProfitInEveryMonth"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cancelled order money counts; money on deleted orders and deleted company expenses does not; an expense later this month counts and next month's counts nowhere"
    requirement: DASH-03
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs#MonthSumsGroupEachSourceByItsOwnDateAndKeepCancelledOrders"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs#MonthSumsLeaveOutDeletedOrdersAndDeletedCompanyExpenses"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs#MonthSumsIncludeBothWindowEdgesAndLeaveOutTheDaysAroundThem"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs#CancelledOrderMoneyCountsDeletedMoneyDoesNotAndAnExpenseLaterThisMonthCounts"
        status: pass
    human_judgment: false
  - id: D6
    description: "The current month's income equals collected.thisMonth from the summary at the same pinned instant (D-04)"
    requirement: DASH-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs#TheCurrentMonthsIncomeEqualsCollectedThisMonthFromTheSummaryAtTheSamePinnedInstant"
        status: pass
    human_judgment: false
  - id: D7
    description: "The window crosses a year end: at 2026-02-10 with months=6 the months are 2025-09 to 2026-02"
    requirement: DASH-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardChartEndpointTests.cs#AtFebruaryTenthSixMonthsRunSeptember2025ToFebruary2026"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs#MonthSumsKeepDecemberAndJanuaryApartAcrossAYearEnd"
        status: pass
    human_judgment: true
    rationale: "The plan flags this edge as an unclassified planner assumption (EDGE DASH-03); it is built and tested as stated, but the owner has not confirmed the rule that an expense dated next month shows in no month yet"
  - id: D8
    description: "The OpenAPI snapshot and generated web types carry the chart and stay in step with the live document"
    requirement: DASH-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-11-07
status: complete
---

# Phase 10 Plan 06: Staff get 6 or 12 months of income, expenses and profit from the server Summary

*Created: 2026-11-07T00:46:00-06:00 · Updated: 2026-11-07T00:46:00-06:00*

**`GET /api/v1/dashboard/chart?months=6|12` returns every month of the window oldest first with income (payments minus refunds), expenses (company plus order) and profit, all gap-filled and computed on the server, with any other `months` refused as a 400 before a figure is read.**

## Performance

- **Duration:** about 35 min
- **Started:** about 2026-11-07T06:10:00Z
- **Completed:** 2026-11-07T06:46:00Z
- **Tasks:** 2
- **Files modified:** 19 (9 created, 10 modified); 4 task commits, plus this SUMMARY commit

## Accomplishments

- The tracer (Task 1) went through the whole stack first: controller action, handler, validator, read port, reader, registration, matrix row, OpenAPI snapshot and web types. Its automated `<verify>` was re-run after the contract refresh (400 of 400 tests, `npm ... run check` exit 0). The tracer has only automated evidence, so no checkpoint was needed. Tracer verified end to end, then expanded.
- The reader runs exactly four grouped LINQ sums (a test pins the command count), each grouped by the year and month of its own date column, each under the existing SoftDelete filters. Cancelled orders stay in; deleted orders and deleted company expenses stay out.
- `ChartMonths.Build` is a pure function: it fills empty months with zeros, sets income = payments minus refunds, expenses = company plus order, profit = income minus expenses, and walks the months oldest first across a year end.
- The validator allows only `6` or `12`, or nothing (six). `7`, `0`, `-6`, `1000`, `abc`, `6.0`, `+6`, `6,12` and a number too large for an int all answer 400 on `months` with "Choose 6 or 12 months.", and the unit test proves the reader is never asked.
- The current month's income equals `collected.thisMonth` from the summary at the same pinned instant (D-04), with a Cancelled order in and a deleted order out.
- `docs/api/dashboard.md` documents the chart route, the window, the figures and an example.

## Task Commits

1. **Task 1: six months, tracer** - `5020751c` (test), `a98ac189` (feat)
2. **Task 2: twelve months, allow-list, year ends, cancelled and deleted money, Collected equality** - `08b5fdb3` (test), `242660c0` (feat)

**Plan metadata:** the SUMMARY commit that follows this file.

## TDD Gate Compliance

Two RED to GREEN cycles, one per task. Gate order in git: `test` then `feat` for each. No `refactor` commit was needed. `gsd_run check tdd-red-evidence` was not run: the xunit v3 / Microsoft.Testing.Platform console output is not a report format that classifier reads, so each RED was inspected by hand (same as plans 10-02 and 10-05).

**Cycle 1, Task 1 (tracer)**

- RED `5020751c`: no production code existed for the route. Command: `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DashboardChartEndpointTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*AuthorizationCoverageTests" --filter-class "*OpenApiSnapshotTests"`. Result: total 400, failed 8, succeeded 392, exit code 2. Every failure was an assertion: 404 where 200 or 401 was expected, `statuses[i] should be 401 but was 404`, and `GET /api/v1/dashboard/chart: matrix row matches no endpoint.`
- Semantic assessment: the target tests ran and failed on the planned behavior; no load, fixture or zero-test fault.
- GREEN `a98ac189`: same command, total 400, failed 0, succeeded 400. `npm --prefix tools/openapi-gen run check` exit 0.

**Cycle 2, Task 2 (allow-list)**

- RED `08b5fdb3`: Unit group (`*ChartMonthsTests`, `*GetDashboardChartHandlerTests`, `*GetDashboardChartRequestValidatorTests`): total 36, failed 15, succeeded 21. Endpoint group (`*DashboardChartEndpointTests`): total 13, failed 5, succeeded 8. The 20 failures are all the allow-list: `AnyWindowOtherThanSixOrTwelveIsA400OnMonths` (7, 0, -6, 1000, abc: got 200, expected 400), the handler's `AnyOtherMonthsIsA400OnMonthsAndTheReaderIsNeverAsked` and the validator's `AnythingElseIsRefusedWithThePlainMessageOnMonths`.
- Semantic assessment: real expected-versus-actual failures for the allow-list. The passing tests in this RED (`ChartMonthsTests`, twelve months, default six, year end, Collected equality, cancelled and deleted money, all 6 new reader tests: 19 of 19) exercise code the tracer already built (the pure builder and the reader), so they are characterization tests, not an unexpected green on new behavior. They are kept because the plan's Task 2 behavior lists them and they pin the rules.
- GREEN `242660c0`: unit group 36 of 36; reader `*DashboardReaderTests` 19 of 19; server group (`*DashboardChartEndpointTests`, `*DashboardSummaryEndpointTests`, `*OpenApiSnapshotTests`, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests`) 422 of 422.

## Files Created/Modified

See the `key-files` block above. The endpoint is `src/Csps.Server/Controllers/DashboardController.cs` (action `GetChart`, endpoint name `GetDashboardChart`); the reader sums are in `src/Csps.Infrastructure/Dashboard/DashboardReader.cs`; the contract page is `docs/api/dashboard.md`.

## Decisions Made

- The request holds the months as text. Automatic 400 model-state responses are off in this project, so an `int?` parameter given `abc` would silently become null and read as six. As text, the validator sees it and answers 400 on `months`.
- `TryReadMonths` accepts digits only (no sign, no decimal point), so `+6`, `6.0` and `6,12` are refused. `06` reads as 6, and surrounding spaces are trimmed.
- The window runs to the last day of the current business month, so an expense dated later this month (up to 30 days ahead) counts now, and one dated next month counts in no month yet. This is the plan's flagged edge assumption, built as stated.
- The error uses a new code `dashboard.invalid-request` with the standard text "Check the highlighted fields." above the field message.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Design] The request carries `string? Months`, not `int? Months`**
- **Found during:** Task 1 (designing the request)
- **Issue:** The plan's artifact list says `GetDashboardChartRequest(int? Months)`, but its action text and Task 2 behavior also say a non-number must be a 400 on `months`, not a framework error. With model-state responses suppressed, an `int?` binding turns `abc` into null, which would read as the default six.
- **Fix:** `GetDashboardChartRequest(string? Months = null)` with `AllowedMonths = [6, 12]`, `DefaultMonths = 6` and `TryReadMonths`. The controller binds `[FromQuery] string? months`. The OpenAPI type of the query parameter is therefore a string.
- **Files modified:** `src/Csps.Application/Dashboard/GetDashboardChartRequest.cs`, `src/Csps.Server/Controllers/DashboardController.cs`
- **Committed in:** `a98ac189`

**2. [Rule 3 - Blocking] Reader parameters are `firstDay` and `lastDay`, not `from` and `to`**
- **Found during:** Task 1 (first build)
- **Issue:** The plan names the port `GetMonthSumsAsync(DateOnly from, DateOnly to, ...)`. Analyzer CA1716 is an error here and rejects `to` as a parameter name on an interface member.
- **Fix:** Renamed the two parameters; the signature shape is otherwise the plan's.
- **Files modified:** `src/Csps.Application/Ports/IDashboardReader.cs`, `src/Csps.Infrastructure/Dashboard/DashboardReader.cs`
- **Committed in:** `a98ac189`

**3. [Plan staging] The validator is wired empty in Task 1 and gets its rule in Task 2**
- **Issue:** The plan has the Task 1 handler "validate the request (Task 2 adds the refusal cases)". A Task 2 RED could not fail on the allow-list if Task 1 already enforced it.
- **Fix:** Task 1 creates the validator class, registers it and calls it from the handler, with no rule; the handler reads a non-number as six. Task 2's RED proves the refusals and its GREEN adds the single rule.
- **Committed in:** `a98ac189`, `242660c0`

**4. [Rule 3 - Blocking] Order expenses needed a seeding helper**
- **Found during:** Task 1 (RED test data)
- **Issue:** The chart tests need orders that carry order expenses on chosen dates; `OrderSeeding` could seed payments and refunds only.
- **Fix:** `SeedOrder.Expenses` (a list of `SeedMoney`) written through `Order.Import`, in the first order expense category and paid by the seeding staff member.
- **Files modified:** `tests/Csps.Testing/OrderSeeding.cs`
- **Committed in:** `5020751c`

**5. [Extra tests] Handler and validator unit tests, not in the plan's file list**
- **Issue:** The plan lists `ChartMonthsTests` as the only unit test file. The handler and validator are new Application code and the project holds Application at 95% or more.
- **Fix:** Added `GetDashboardChartHandlerTests` and `GetDashboardChartRequestValidatorTests`. Coverage of every new Application class is 100% line rate; the Application total is 0.9803 line and 0.9568 branch.
- **Committed in:** `08b5fdb3`

---

**Total deviations:** 5 (1 design, 2 blocking, 1 plan staging, 1 extra tests).
**Impact on plan:** None changes behavior the plan defined. No scope creep, no package, no schema change.

## Issues Encountered

- `tools/openapi-gen` has no `node_modules` in a new worktree. A symlink to the main checkout's `tools/openapi-gen/node_modules` was made (git-ignored, never committed, no install run) so `generate` and `check` could run.
- The harness refuses compound shell commands that mix `cd`, `cmd` or redirection with git in a worktree, so commands were run plain from the worktree root. No effect on the work.
- No flake was seen in any run of this plan. `ExpenseListTimingTests` (known timing failure, D-76, D-103) was not run, as instructed. The whole Server and Infrastructure suites were not run; the orchestrator runs them after merge.

## Open Questions for the Owner

None that block the plan. One item to confirm when convenient: the plan flags, as an unclassified planner assumption, that an expense dated next month (up to 30 days ahead, ExpenseRules.DaysAhead) shows in no month of the chart until its month arrives. It is built and tested that way, and it is the reason deliverable D7 is marked as needing a human look.

## Known Stubs

None. No placeholder, empty data source or TODO was left in the files of this plan.

## Threat Flags

None beyond the plan's threat model. The one new endpoint is the planned `GET /api/v1/dashboard/chart`.

- T-10-09 mitigated: the allow-list runs in the handler before any read; tests for 7, 0, -6, 1000 and text at validator, handler and endpoint level, and the handler test proves the reader is never called.
- T-10-SC: no package was added or bumped.

## User Setup Required

None - no external service configuration required.

## Verification Results

- `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Application unit tests, whole project with coverlet (`--coverlet --coverlet-include "[Csps.Application]*"`): 2308 passed, 0 failed. Cobertura line-rate 0.9803, branch-rate 0.9568. `ChartMonths`, `GetDashboardChartHandler`, `GetDashboardChartRequest` and `GetDashboardChartRequestValidator` line-rate 1.
- Architecture tests (`dotnet test --project tests/Csps.ArchitectureTests`): 290 passed, 0 failed.
- Chart unit group (`*ChartMonthsTests`, `*GetDashboardChartHandlerTests`, `*GetDashboardChartRequestValidatorTests`): 36 passed.
- Reader (`*DashboardReaderTests`, includes the four-command pins for both reads): 19 passed.
- Server group (`*DashboardChartEndpointTests`, `*DashboardSummaryEndpointTests`, `*OpenApiSnapshotTests`, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests`): 422 passed.
- The Collected equality test: `TheCurrentMonthsIncomeEqualsCollectedThisMonthFromTheSummaryAtTheSamePinnedInstant` passed (Cancelled order in, deleted order out, `collected.thisMonth` 730.00 equals the November income).
- Acceptance criteria: Task 1 greps 1, 1, 1 (`GetDashboardChart` in the snapshot, the matrix row, `Build` in `ChartMonths.cs`). Task 2 greps: "Choose 6 or 12 months." in the validator 1, a "Collected" test name 1, `/api/v1/dashboard/chart` in `docs/api/dashboard.md` 2. Artifact greps: `Profit` in `ChartMonths.cs` 1 (after a comment fix), `MonthOf` in the handler 2, `months=12` in the endpoint tests 1, `chart.HandleAsync` in the controller 1, `ChartMonths.Build` in the handler 1.
- No em or en dash in any file this plan wrote. `docs/api/dashboard.md` keeps its created value and has a new updated value.
- gitleaks (`gitleaks protect --staged --no-banner`, also run by the pre-commit hook) ran before each of the 4 task commits: no leaks found.

## Next Phase Readiness

Plan 10-07 (dashboard page) and the later chart drawing plan can call `GET /api/v1/dashboard/chart` and use the generated `DashboardChartResponse` types in `web/src/types/api.generated.ts`. The `months` query type is a string in the generated client (see deviation 1). Plan 10-08 is next in the serial contract-file order. No blockers.

## Self-Check: PASSED

- FOUND: all 9 files listed in `key-files.created` exist on disk.
- FOUND: commits `5020751c`, `a98ac189`, `08b5fdb3`, `242660c0` on this branch; measured `git rev-list --count 8886c2ad..HEAD` = 4 before this SUMMARY commit.
- STATE.md and ROADMAP.md were not modified.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-07*
