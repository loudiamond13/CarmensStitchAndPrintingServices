---
phase: 10-admin-dashboard
plan: 05
subsystem: api
tags: [dotnet, csharp, dashboard, linq, openapi, tdd, authorization-matrix]
created: "2026-11-06T23:45:00-06:00"
updated: "2026-11-06T23:45:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: BusinessClock.WeekOf, SameDayLastMonth, DayPart and OrderStatusRules.OverdueStatuses (plan 10-02)
  - phase: 06-company-expenses
    provides: ICompanyExpenseReader.GetKpisAsync for the expenses card (D-07)
  - phase: 08-orders
    provides: the order list row shape, OrderStatusNames and the order reader
provides:
  - "GET /api/v1/dashboard/summary: business today, greeting part, first name, order figures, collected figures, expense figures, six statuses and the six newest orders in one live call"
  - "IDashboardReader and DashboardReader (four LINQ commands); IOrderReader.ListNewestAsync"
  - "OrderListEntries.From: the shared row-to-entry mapping used by the order list and the dashboard"
  - "OrderSeeding (tests/Csps.Testing): writes legacy-style orders and staff straight to a test database"
  - "docs/api/dashboard.md"
affects: [10-07 dashboard page, 10-06 chart endpoint (serial contract files)]

actuals:
  tokens: 21400
  tasks: 3
  commits: 8

plan_head_before: f080de66e114dcd193debf57e055f31cdfc1e81c
plan_head_after: 2435a9192c02649bd1173372ce5e18850aca7483

tech-stack:
  added: []
  patterns:
    - "One grouped LINQ read per table (GroupBy(static _ => 1)) with conditional Count and Sum, under the named SoftDelete filter"
    - "A period record built from one BusinessClock read, so one answer is one snapshot"
    - "Two-step newest read: cut the ids in an inner query, then project the row subqueries for those ids only"

key-files:
  created:
    - src/Csps.Application/Dashboard/DashboardPeriod.cs
    - src/Csps.Application/Dashboard/DashboardSummaryResponse.cs
    - src/Csps.Application/Dashboard/GetDashboardSummaryHandler.cs
    - src/Csps.Application/Ports/IDashboardReader.cs
    - src/Csps.Application/Orders/OrderListEntries.cs
    - src/Csps.Infrastructure/Dashboard/DashboardReader.cs
    - src/Csps.Infrastructure/Dashboard/DashboardRegistration.cs
    - src/Csps.Server/Controllers/DashboardController.cs
    - src/Csps.Server/Composition/DashboardApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Dashboard/GetDashboardSummaryHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs
    - tests/Csps.Server.IntegrationTests/Dashboard/DashboardSummaryEndpointTests.cs
    - tests/Csps.Testing/OrderSeeding.cs
    - docs/api/dashboard.md
  modified:
    - src/Csps.Application/Orders/ListOrdersHandler.cs
    - src/Csps.Application/Ports/IOrderReader.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "A token whose user row is gone gets 401 auth.session-ended, as the other handlers answer a token with no usable account"
  - "ChangePercent is held at the whole-number range ends instead of overflowing"
  - "ListNewestAsync takes no clock instant: nothing in a created-order sort needs one"

patterns-established:
  - "Dashboard reads are plain LINQ aggregates with no cache; the controller carries ResponseCache NoStore"
  - "Test orders with any status, dates and money come from OrderSeeding (Order.Import under the legacy rules), not from the HTTP create path"

requirements-completed: [DASH-01, DASH-02, DASH-04, DASH-05]

coverage:
  - id: D1
    description: "A signed-in Admin or Manager gets the business today, the greeting part and their own first name; anonymous gets 401"
    requirement: DASH-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardSummaryEndpointTests.cs#AManagerGetsTheBusinessTodayTheMorningGreetingAndTheirOwnFirstName"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardSummaryEndpointTests.cs#TheGreetingPartFollowsTheManilaClock"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardSummaryEndpointTests.cs#AnAdminGetsTheirOwnFirstNameAndTheManagerGetsTheirs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#MatrixRowReturnsExpectedStatus (GET /api/v1/dashboard/summary)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Active, due this week, overdue and receivables follow the owner rules at week boundaries, with Delivered active but never overdue"
    requirement: DASH-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs#DueThisWeekCountsActiveOrdersDueMondayToSundayThatAreNotOverdue"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs#OverdueCountsOpenOrdersDueBeforeTodayAndNeverDeliveredOrEndedOnes"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs#ReceivablesSumTheOwedBalanceOfActiveOrdersAndLeaveOutOverpaidEndedAndDeletedOnes"
        status: pass
    human_judgment: false
  - id: D3
    description: "Collected this month and the same-day comparison, with the whole-number change, a null percent for a zero comparison, and the March 31 clamp"
    requirement: DASH-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs#CollectedIsPaymentsMinusRefundsInTheBusinessMonthWithCancelledOrdersInAndDeletedOnesOut"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs#CollectedComparisonRunsFebruaryFirstToFebruaryTwentyEighthOnMarchThirtyFirst"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Dashboard/GetDashboardSummaryHandlerTests.cs#TheChangeIsAWholePercentOfTheAbsoluteComparisonRoundedAwayFromZero"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Dashboard/GetDashboardSummaryHandlerTests.cs#AZeroComparisonGivesNoPercent"
        status: pass
    human_judgment: false
  - id: D4
    description: "The expenses card carries the month total, count and top category name from the expense KPI read"
    requirement: DASH-02
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Dashboard/GetDashboardSummaryHandlerTests.cs#TheExpenseFiguresPassThroughWithTheTopCategoryName"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardSummaryEndpointTests.cs#TheAnswerCarriesTheWeekOverdueReceivablesCollectedAndExpenseFigures"
        status: pass
    human_judgment: false
  - id: D5
    description: "Six statuses in fixed order with Completed counted for this business month by UTC range, and no Cancelled entry"
    requirement: DASH-04
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs#StatusesCountCurrentOrdersPerStatusAndCompletedOnlyInTheBusinessMonthByUtcRange"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Dashboard/GetDashboardSummaryHandlerTests.cs#TheStatusesAreTheSixShownOnesInFixedOrderWithTheirKeysAndNothingMore"
        status: pass
    human_judgment: false
  - id: D6
    description: "The six newest created orders of any status, newest first, ties by id descending, no deleted order, in one SQL command"
    requirement: DASH-05
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs#TheNewestOrdersAreTheSixLatestCreatedOfAnyStatusNewestFirstAndLeaveOutDeletedOnes"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs#TheSixNewestOrdersRunExactlyOneCommandWhateverTheStatusMix"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardSummaryEndpointTests.cs#TheStatusesListSixEntriesInFixedOrderAndTheRecentOrdersHoldTheSixNewestCreated"
        status: pass
    human_judgment: false
  - id: D7
    description: "Both roles get the same figures, statuses and recent orders at the same instant, and the answer is never cached"
    requirement: DASH-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardSummaryEndpointTests.cs#AnAdminAndAManagerGetTheSameFiguresStatusesAndRecentOrdersAtTheSameInstant"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Dashboard/DashboardSummaryEndpointTests.cs#TheAnswerIsNeverCached"
        status: pass
    human_judgment: false
  - id: D8
    description: "The OpenAPI snapshot and generated web types carry the summary and stay in step with the live document"
    requirement: DASH-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false

duration: 47min
completed: 2026-11-06
status: complete
---

# Phase 10 Plan 05: Staff get the dashboard summary from one API call Summary

*Created: 2026-11-06T23:45:00-06:00 · Updated: 2026-11-06T23:45:00-06:00*

**One live, uncached `GET /api/v1/dashboard/summary` returns the business today, the greeting part, the caller's first name, the four KPI cards, six ordered status counts and the six newest orders, all computed on the server in four LINQ commands plus the expense and newest-order reads.**

## Performance

- **Duration:** about 47 min
- **Started:** about 2026-11-07T04:58:00Z
- **Completed:** 2026-11-07T05:45:00Z
- **Tasks:** 3
- **Files modified:** 23 (14 created, 9 modified); 8 task commits, plus this SUMMARY commit

## Accomplishments

- The tracer slice (Task 1) went through the whole stack first: controller, handler, read port, reader, both registrations, matrix row, OpenAPI snapshot and web types. It was re-run end to end before expansion. The tracer `<verify>` is automated only, so no checkpoint was needed.
- The four KPI figures follow C-40: `dueThisWeek` excludes overdue orders but keeps a Delivered order due Monday; `overdue` never includes Delivered; `receivables` counts only positive balances of active orders; `collected` is payments minus refunds on orders of every status except deleted ones, with a same-day comparison clamped at month ends and a whole-number change against the absolute comparison.
- Six statuses in a fixed order (`pending`, `mockup`, `production`, `ready`, `delivered`, `completed`), with Completed judged by the business month's UTC range. Cancelled has no entry.
- `IOrderReader.ListNewestAsync` reads the six latest created orders of any status in one SQL command, ties by id descending.
- `OrderListEntries.From` is the single row-to-entry mapping, shared by the order list and the dashboard.
- `OrderSeeding` lets reader and endpoint tests write orders with any status, due date, payments and refunds straight to a test database.

## Task Commits

1. **Task 1: tracer, today, greeting, first name, active count** - `c648c127` (test), `9eb10465` (feat)
2. **Task 2: the four KPI figures** - `d0cb09e2` (test), `3d3ae2ec` (feat)
3. **Task 3: statuses and six newest orders** - `4811b3e4` (refactor, shared mapping), `1d3caa0c` (test), `f4a313e5` (feat)
4. **Closing tests** - `2435a919` (test: reader command count, expense name edge)

**Plan metadata:** the SUMMARY commit that follows this file.

## TDD Gate Compliance

Three RED to GREEN cycles, one per task. Gate order in git: `test` then `feat` for each. One `refactor` commit (`4811b3e4`) came before the Task 3 RED and changed no behavior. `gsd_run check tdd-red-evidence` was not run: the xunit v3 / Microsoft.Testing.Platform console output is not a report format that classifier reads, so each RED was inspected by hand (same as plan 10-02).

**Cycle 1, Task 1 (tracer)**

- RED `c648c127`: no source change was needed, because the route did not exist. Command: `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DashboardSummaryEndpointTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*AuthorizationCoverageTests"`. Result: total 392, failed 13, succeeded 379, exit code 2. Every failure was an assertion: 404 where 200 or 401 was expected, and `GET /api/v1/dashboard/summary: matrix row matches no endpoint.`
- Semantic assessment: the target tests ran and failed on the planned behavior; no load, fixture or zero-test fault.
- GREEN `9eb10465`: same command, total 392, failed 0, succeeded 392. After the snapshot refresh, `OpenApiSnapshotTests` total 10, failed 0, and `npm --prefix tools/openapi-gen run check` exit 0.

**Cycle 2, Task 2 (KPI figures)**

- RED `d0cb09e2`: wrong-valued stubs (period fields all today, reader returning 0 for the new figures, handler returning zero collected and expense blocks) so the tests compile and fail on assertions. Handler tests: total 19, failed 12, succeeded 7. Reader tests: total 8, failed 6, succeeded 2. Endpoint tests: total 10, failed 1, succeeded 9. Examples: `figures.DueThisWeek should be 4 but was 0`; `Collected.ThisMonth should be 500.00m but was 0m`; `harness.Asked.ComparisonFirst should be 2/1/2026 but was 3/31/2026`.
- Semantic assessment: real expected-versus-actual failures. The seven passing handler tests and two passing reader tests cover behavior from Task 1 (session answers, greeting words, first name, empty shop) or an input the stub also produces (zero comparison with zero this month, no expenses). That is a characterization pass, not an unexpected green on the new behavior.
- GREEN `3d3ae2ec`: handler 19 of 19, reader 8 of 8, endpoint plus snapshot 20 of 20.

**Cycle 3, Task 3 (statuses, newest orders)**

- RED `1d3caa0c`: stubs return empty lists and zero counts. Handler tests: total 22, failed 2. Reader plus query-count tests: total 54, failed 5. Endpoint tests: total 12, failed 1. Example: `ListNewestAsync(6, any CancellationToken): Actually received no matching calls`; `counter.Count should be 1 but was 0`; `listed should be [(pending, 2), ...] but was []`.
- Semantic assessment: real failures. `AnAdminAndAManagerGetTheSameFigures...` and `WithNoOrdersTheRecentListIsEmpty` passed on the stubs by design (equal empty answers); they gain meaning at GREEN.
- GREEN `f4a313e5`: handler plus `ListOrdersHandlerTests` 39 of 39, reader plus query-count 54 of 54, server group (endpoint, matrix, coverage, snapshot) 406 of 406.

## Files Created/Modified

See the `key-files` block above. The endpoint is `src/Csps.Server/Controllers/DashboardController.cs`; the reader is `src/Csps.Infrastructure/Dashboard/DashboardReader.cs`; the contract page is `docs/api/dashboard.md`.

## Decisions Made

- A token whose user row is gone gets `401 auth.session-ended`, the same answer other handlers give for a token with no usable account. The plan did not say; this is the existing convention, not a new behavior.
- `changePercent` is held at the ends of the whole-number range. With a comparison of 0.01 and a month of hundreds of trillions, an unchecked cast would wrap silently. This cannot happen with real shop money.
- The week is Monday to Sunday and the month is the business month, both read from one `BusinessClock`, so one answer is one snapshot.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Design] `ListNewestAsync` has no `now` parameter**
- **Found during:** Task 3 (RED stubs)
- **Issue:** The plan listed `ListNewestAsync(int count, DateTimeOffset now, CancellationToken)`. A sort by creation time and a no-status filter use no clock, so the parameter would be dead.
- **Fix:** The signature is `ListNewestAsync(int count, CancellationToken)`. Nothing downstream calls the port; plan 10-07 reads the endpoint.
- **Files modified:** `src/Csps.Application/Ports/IOrderReader.cs`, `src/Csps.Infrastructure/Orders/OrderReader.cs`
- **Committed in:** `1d3caa0c`, `f4a313e5`

**2. [Rule 1 - Plan inconsistency] A payment dated Oct 31 does not belong to the comparison on Nov 4**
- **Found during:** Task 2 (writing the collected test)
- **Issue:** The Task 2 behavior text says a payment dated Oct 31 belongs to the comparison. D-05 and the truths say the comparison is the 1st of last month through the same day number last month, which on Nov 4 is Oct 1 to Oct 4. Oct 31 is in neither figure.
- **Fix:** Followed D-05. The test puts an Oct 31 payment (and an Oct 5 one) in neither figure and an Oct 2 payment in the comparison.
- **Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs`
- **Committed in:** `d0cb09e2`

**3. [Rule 3 - Blocking] A shared row mapping and a shared seeding helper**
- **Found during:** Task 3 and Task 2
- **Issue:** The cover mapping lived as a private method of `ListOrdersHandler`, so the dashboard would have copied it. Reader and endpoint tests in two projects both needed orders with arbitrary status, due date, payments and refunds, which the HTTP create path cannot make.
- **Fix:** `OrderListEntries.From` (Application, behavior-neutral refactor with its own commit; `ListOrdersHandlerTests` pass) and `OrderSeeding` (tests/Csps.Testing, uses `Order.Import` under the legacy rules).
- **Files modified:** `src/Csps.Application/Orders/OrderListEntries.cs`, `src/Csps.Application/Orders/ListOrdersHandler.cs`, `tests/Csps.Testing/OrderSeeding.cs`
- **Committed in:** `4811b3e4`, `c648c127`

**4. [Rule 2 - Missing critical] Percent range clamp**
- **Found during:** Task 2
- **Issue:** The whole-number percent could overflow `int` for a tiny comparison.
- **Fix:** Clamp to the `int` range; a unit test pins it.
- **Files modified:** `src/Csps.Application/Dashboard/GetDashboardSummaryHandler.cs`
- **Committed in:** `3d3ae2ec`

**5. [Plan staging] The no-store header test is in Task 1, not Task 3**
- **Issue:** The controller carries `NoStore` from Task 1, so a Task 3 header test could never fail first.
- **Fix:** `TheAnswerIsNeverCached` is in the Task 1 RED. Task 3 adds the two-role equality test.
- **Committed in:** `c648c127`

**6. [Plan staging] `DashboardPeriod` grew across tasks**
- **Issue:** Writing the full period in Task 1 would have been untested code.
- **Fix:** Task 1 has `Today` only; Task 2 adds the week, month, comparison and UTC fields in its RED stub and fills them in GREEN.

---

**Total deviations:** 6 (1 design, 1 plan inconsistency, 1 blocking, 1 missing critical, 2 staging notes).
**Impact on plan:** None changes behavior the plan defined. No scope creep. Nothing needs an owner ruling; deviation 2 is a wording slip in the plan's test note, and the binding truths and D-05 were followed.

## Issues Encountered

- The harness refuses compound shell commands that mix `cd`, redirection and test filters in a worktree, so every command was run plain from the worktree root. No effect on the work.
- One flake in the full Server run: `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` answered 500 once, then passed twice alone. Details in Verification Results. It belongs to the order photo upload, not to this plan, and needs its own look by whoever owns Phase 9 images.

## Known Stubs

None. Every RED stub (period fields, reader zeros, handler empty lists, `ListNewestAsync` empty list) was replaced in GREEN.

## Threat Flags

None beyond the plan's threat model. The one new endpoint is the planned `GET /api/v1/dashboard/summary`.

- T-10-06 mitigated: `Policies.Staff` on the controller, matrix row 401/200/200, `AuthorizationCoverageTests` discovers the action.
- T-10-07 mitigated: `ResponseCache(NoStore = true)`, no cache of any figure, `TheAnswerIsNeverCached` asserts the header.
- T-10-08 mitigated: the first name is read for `IRequestContext.UserId`, which comes from the token; the action takes no input.
- T-10-SC: no package was added or bumped.

## User Setup Required

None - no external service configuration required.

## Verification Results

- `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Application unit tests, full project with coverlet (`--coverlet --coverlet-include "[Csps.Application]*"`): 2271 passed, 0 failed (before the last added test). Cobertura: line-rate 0.9802, branch-rate 0.9563. `GetDashboardSummaryHandler` and `DashboardPeriod` line-rate 1. Application stays at or above 95%.
- Architecture tests (`LayerTests`, `NoInlineSqlTests` and the rest): 290 passed, 0 failed.
- `GetDashboardSummaryHandlerTests` plus `ListOrdersHandlerTests`: 39 passed. `GetDashboardSummaryHandlerTests` alone at the end: 23 passed.
- Infrastructure: `DashboardReaderTests` 13 passed (includes the four-command pin); `*OrderReader*`, `*DashboardReaderTests`, `*CompanyExpenseReader*` together 72 passed.
- Server: `DashboardSummaryEndpointTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests`, `OpenApiSnapshotTests` 406 passed; `ListOrdersEndpointTests`, `OrderListQueryCountTests`, `DashboardSummaryEndpointTests` 71 passed.
- Acceptance criteria: Task 1 greps 1, 1, 1, 1 (all at least 1). Task 2 greps: `OverdueStatuses` in the reader 3, `Math.Abs` in the handler 1, `GetKpisAsync` in the handler 1; test names contain DueThisWeek, Overdue, Receivables, Collected and MarchThirtyFirst. Task 3 greps: `ListNewestAsync` in `OrderReader.cs` 1, `OrderByDescending(order => order.CreatedAtUtc)` 2, non-comment `cancelled` in the handler 0, `head -4 docs/api/dashboard.md` shows `created:` and `updated:`.
- gitleaks (`gitleaks protect --staged --no-banner`, also run by the pre-commit hook) ran before each of the 8 task commits: no leaks found.

- Full Server integration suite (`dotnet test --project tests/Csps.Server.IntegrationTests`, run once in the background on the final code): total 2053, failed 1, succeeded 2052, skipped 0. The one failure was `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` (`statuses[1]` was 500, expected 409 or 422). Re-run alone as the class (`*OrderImagesEndpointTests`): 20 of 20 passed. Re-run alone as the method: 1 of 1 passed. It is a two-uploads-at-once race in the order photo upload, which this plan does not touch (no image, order store or upload file changed), so it is recorded as an observed flake under load, not caused by plan 10-05. `ExpenseListTimingTests`, the known timing failure (D-76, D-103), did not fail in this run.

## Next Phase Readiness

Plan 10-07 can call `GET /api/v1/dashboard/summary` and use the generated `DashboardSummaryResponse` types in `web/src/types/api.generated.ts`. Plan 10-06 is next in the serial contract-file order (`openapi.v1.json`, `api.generated.ts`, `AuthorizationMatrix.cs`). No blockers.

## Self-Check: PASSED

- FOUND: all 14 created files listed in `key-files.created` exist on disk.
- FOUND: commits `c648c127`, `9eb10465`, `d0cb09e2`, `3d3ae2ec`, `4811b3e4`, `1d3caa0c`, `f4a313e5`, `2435a919` on this branch; measured `git rev-list --count f080de66..HEAD` = 8 before this SUMMARY commit.
- STATE.md and ROADMAP.md were not modified.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-06*
