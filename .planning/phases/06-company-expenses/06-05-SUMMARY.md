---
phase: 06-company-expenses
plan: 05
subsystem: api
tags: [ef-core, kpi, business-clock, asia-manila, month-boundary, rounding, openapi]
created: "2026-10-25T09:17:00-05:00"
updated: "2026-10-25T09:17:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: ICompanyExpenseReader, CompanyExpenseReader (two-command style), ExpenseCategoryRef, ExpenseFixtures.SeedAsync, the SoftDelete filter, CompanyExpensesController (Staff policy) (plans 06-02, 06-03)
provides:
  - GET /api/v1/company-expenses/kpis for both roles, answering { today, thisMonth, lastMonth, topCategory }
  - Months decided by the business calendar (Asia/Manila), counted by expense date, deleted rows excluded
  - ICompanyExpenseReader.GetKpisAsync in two SQL commands (both months together, then this month by category)
  - Top category with ties to the name first A to Z and a whole-percent share rounded half away from zero
  - TestSessions.StartAsync accepts any test host, so a fixed-clock host can start sessions
affects: [06-09]

actuals:
  tokens: 12000
  tasks: 2
  commits: 4
plan_head_before: c205846f7a39650de575071b736c3c7a97499d2a
plan_head_after: ab8d77ee794039812cffe032d0620478e4c7be47

tech-stack:
  added: []
  patterns:
    - "KPI read in two commands: one GroupBy(_ => 1) with conditional Sum and Count per month, then a grouped-by-category read ordered by total descending and name"
    - "Fixed-clock endpoint tests with distant dates: sessions start on the clock host (the host finds them active at that date) and the token is minted with TestTokens.For and the system clock (the JWT lifetime check uses the system clock)"

key-files:
  created:
    - src/Csps.Application/Expenses/GetCompanyExpenseKpisHandler.cs
    - src/Csps.Application/Expenses/CompanyExpenseKpisResponse.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseKpisEndpointTests.cs
    - tests/Csps.Application.UnitTests/Expenses/CompanyExpenseKpisTests.cs
  modified:
    - src/Csps.Application/Ports/ICompanyExpenseReader.cs
    - src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs
    - src/Csps.Server/Controllers/CompanyExpensesController.cs
    - src/Csps.Server/Composition/ExpensesApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseFixtures.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Testing/TestSessions.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/company-expenses.md
    - .planning/STATE.md

key-decisions:
  - "The share is computed in the handler as Math.Round(topTotal / monthTotal * 100m, 0, MidpointRounding.AwayFromZero); the reader returns raw decimals, so the one rounding rule sits in Application and is unit-tested at 12.5 -> 13"
  - "topCategory is null when the month total is 0 or the reader returns no category; last month is MonthOf(thisFirst - 1 day), so January reaches back to December of the year before"

patterns-established:
  - "A KPI route takes no input and reads the business clock once; the reader gets both month ranges in one record (KpiMonths)"

requirements-completed: [CEXP-03]

coverage:
  - id: D1
    description: "Both roles read this month, last month and the top category, and the month is decided in Manila time: at 07:00 Manila on 1 November this month is November, at 23:59:59 Manila on 31 October it is still October (CEXP-03, D-24, success criterion 3)"
    requirement: CEXP-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseKpisEndpointTests.cs (BothRolesReadThisMonthLastMonthAndTheTopCategoryAfterManilaMidnight, TheLastSecondOfOctoberInManilaIsStillOctober)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Expenses/CompanyExpenseKpisTests.cs (At0700ManilaOnTheFirst..., OnTheFirstOfMarch..., InALeapYear..., InJanuary...)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Upcoming expenses count in this month by their date, next-month ones count nowhere, and soft-deleted expenses never count (D-24, D-01)"
    requirement: CEXP-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseKpisEndpointTests.cs (seeded 2026-11-20 upcoming, 2026-12-02 next month and a deleted 2026-11-05 row)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Ties go to the name first A to Z, an empty month shows 0.00 and null top, and the share rounds half away from zero to a whole percent (CEXP-03)"
    requirement: CEXP-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseKpisEndpointTests.cs (TwoCategoriesWithEqualTotalsGoToTheNameFirstAToZ, AMonthWithNoExpensesShowsZeroAndNoTopCategory)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Expenses/CompanyExpenseKpisTests.cs (TheShareRoundsHalfAwayFromZeroToAWholePercent: 500/700 -> 71, 1/8 -> 13, 2/3 -> 67, 700/700 -> 100)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The KPI route is Staff only: anonymous 401, Admin and Manager 200, and the OpenAPI contract and generated types include it (T-06-19, T-06-20)"
    requirement: CEXP-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (matrix row GET /api/v1/company-expenses/kpis) and CompanyExpenseKpisEndpointTests.AnAnonymousCallerGets401"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests OpenApiSnapshotTests plus npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 05: Month KPIs Summary

**GET /api/v1/company-expenses/kpis returns this month, last month and the top category with a whole-percent share, with the month decided by the Asia/Manila business calendar, counted by expense date, deleted rows excluded, in two SQL commands.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-25T14:02:00Z
- **Completed:** 2026-10-25T14:15:22Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files modified:** 15 (including the generated contract)

## Accomplishments

- Both roles read `{ today, thisMonth { month, total, count }, lastMonth { ... }, topCategory { category, total, sharePercent } | null }`. `month` is the first day of the month. The handler reads the business clock once and takes `MonthOf(today)`, then `MonthOf(thisFirst - 1 day)` for last month, so the figures never use the server's or the device's own clock.
- At 2026-10-31T23:00:00Z (07:00 Manila on 1 November) this month is November: the 1 November expense counts there and the 31 October one in last month. At 2026-10-31T15:59:59Z (23:59:59 Manila) it is still October. An upcoming expense later this month counts in this month, one dated next month counts nowhere, and a soft-deleted one never counts.
- The reader runs two SQL commands: one grouped read over last month's first day to this month's last day with conditional sums and counts per month, then this month by category ordered by total descending and name A to Z. The totals are decimals summed in SQL.
- The share is `Math.Round(top / month * 100m, 0, MidpointRounding.AwayFromZero)`: 500/700 gives 71, 1/8 (12.5) gives 13, 2/3 gives 67, 700/700 gives 100. With no expense this month `topCategory` is `null` and the total is `0.00`.
- The matrix row, OpenAPI snapshot and generated types carry the route; `docs/api/company-expenses.md` documents the shape, the Manila month rule, D-24, ties, rounding and that the list filters do not apply.
- Owner item A-06-02 (other month-KPI edge cases, for example a business zone other than Asia/Manila) is parked in the STATE.md Owner backlog with the exact wording of the plan.

## Task Commits

1. **Task 1: Tracer, Manila month KPIs (CEXP-03, D-24)**
   - RED `fba15c8` (test)
   - GREEN `7b4cf7b` (feat)
2. **Task 2: Ties, empty months and share rounding (CEXP-03)**
   - RED/characterization `37c423f` (test)
   - GREEN `ab8d77e` (feat: docs and the owner backlog item)

**Plan metadata:** the `docs(06-05)` commit that follows this file.

### TDD gate compliance

`test(06-05)` precedes `feat(06-05)` for both tasks. No REFACTOR commits were needed. The formal `gsd_run check tdd-red-evidence` classifier does not read the MTP console report, so the evidence is the quoted run with the semantic assessment.

- **Task 1 RED:** `*CompanyExpenseKpisEndpointTests` ran 4 tests and all 4 failed. The three read tests failed with `HttpStatusCode.OK but was HttpStatusCode.NotFound` (`We couldn't find that.`), the anonymous test with `Unauthorized but was NotFound`: the route did not exist while seeding and sign-in worked. Semantic assessment: the targets ran and failed on the planned missing route.
- **Task 2:** all 8 new handler cases (12 with the theory rows) and both added endpoint cases passed on their first run, because Task 1 already holds the handler and the reader ordering. They are kept as characterization tests, as the plan allows. The only production gap they could expose (ties, empty month, rounding) was already correct, so the `feat(06-05)` commit carries the docs and the backlog item only.

## Verification evidence

- `dotnet build Csps.slnx`: `0 Warning(s)`, `0 Error(s)`.
- Task 1 verify: `*CompanyExpenseKpisEndpointTests` 4/4, `*Authorization*` 207/207.
- Task 2 verify: `*CompanyExpenseKpisTests` 12/12, `*CompanyExpenseKpisEndpointTests` 6/6.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): "Csps.Domain line 100% (956/956) branch 100% (398/398) PASS; Csps.Application line 99.2% (3078/3100) PASS. Coverage gate passed."
- Full suites after the last code commit: Application unit 1064/1064 (inside the gate), Architecture 239/239, Server integration 1156/1156, Infrastructure integration 542 passed and 1 skipped (the skip existed before this plan).
- Contract: `*OpenApiSnapshotTests` 10/10 after the refresh; `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."; both files keep LF endings.
- Acceptance greps: `MonthOf` in the handler 2, `MidpointRounding.AwayFromZero` in the handler 1, `/api/v1/company-expenses/kpis` in the matrix 1, `CompanyExpenseKpisResponse` in `api.generated.ts` 2, `kpis` in the API doc 1, the 12.5 case asserts 13.
- Tracer gate: the Task 1 `<verify>` (two automated commands) ran end to end and passed, so the slice was verified and expansion went ahead.

## Decisions Made

- The reader returns raw decimals and the handler applies the single rounding rule, so the 12.5 to 13 rule is unit-tested without a database.
- Fixed-clock sessions: the host finds a session active by its own (fake) clock, while the JWT lifetime check uses the system clock. The KPI tests therefore start sessions on the fixed-clock host and mint each token with `TestTokens.For(role, TimeProvider.System, ...)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] TestSessions only accepted CspsApiFactory**
- **Found during:** Task 1 (GREEN, first endpoint run)
- **Issue:** The plan's clock (six days after the real day) made every token answer 401. Sessions made on the real-clock host were expired by the fake clock, and tokens made by the fake clock failed the system-clock lifetime check. The list tests got away with it because their fixed time was within hours of the real day.
- **Fix:** `TestSessions.StartAsync` now takes `WebApplicationFactory<Program>` (a `CspsApiFactory` still fits), so a derived fixed-clock host can start sessions. The KPI test Rig then replaces each token with one minted for the real now. A one-type widening of a shared test helper; no production code.
- **Files modified:** `tests/Csps.Testing/TestSessions.cs`, `tests/Csps.Server.IntegrationTests/CompanyExpenses/CompanyExpenseKpisEndpointTests.cs`
- **Verification:** 4/4 then 6/6 endpoint tests pass; the whole Server integration suite (1156) passes.
- **Committed in:** `7b4cf7b`

---

**Total deviations:** 1 auto-fixed (1 blocking, test helper only)
**Impact on plan:** No scope change. `tests/Csps.Testing/TestSessions.cs` is outside the plan's `files_modified` list.

## Issues Encountered

- CA1859 (analyzer, warnings as errors) flagged a private `Task` helper in the test Rig; its return type became `Task<Guid>`.
- Task 2's tests all passed at once, so the RED step is characterization only (see TDD gate compliance).

## Known Stubs

None. The KPI cards on the page arrive in 06-09.

## Threat Flags

None. The one new route is the one in the plan's threat model: T-06-19 (money figures from a wrong clock) is covered by the business-calendar-only handler and the fixed-clock tests on both sides of the Manila midnight; T-06-20 (anonymous read) by `Policies.Staff` and the matrix row (anonymous 401); T-06-SC by installing nothing.

## User Setup Required

None - no external service configuration required.

## Owner items

- **A-06-02 (parked in the STATE.md Owner backlog):** confirm that no other month-KPI edge case needs its own rule (recommended), or name one. Not auto-approved.

## Next Phase Readiness

- Plan 06-09 (the KPI row) can read `GET /company-expenses/kpis` with `today`, `thisMonth`, `lastMonth` and `topCategory` (possibly `null`); the generated type is `CompanyExpenseKpisResponse`.
- No blockers.

## Self-Check: PASSED

All created files exist on disk; the four task commits (`fba15c8`, `7b4cf7b`, `37c423f`, `ab8d77e`) are ancestors of HEAD; the test runs above passed.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
