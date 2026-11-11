---
phase: 10-admin-dashboard
plan: 02
subsystem: domain
tags: [dotnet, csharp, business-clock, order-status, tdd, dashboard]
created: "2026-11-06T20:57:00-06:00"
updated: "2026-11-06T20:57:00-06:00"

requires:
  - phase: 08-orders
    provides: OrderStatusRules, OrderStatus values and the web DueFlag open-status set (08 D-37)
  - phase: 01-foundation
    provides: BusinessClock and the Asia/Manila business zone
provides:
  - "DayPart enum (Morning, Afternoon, Evening)"
  - "BusinessClock.WeekOf, BusinessClock.SameDayLastMonth and BusinessClock.DayPart"
  - "OrderStatusRules.OverdueStatuses and OrderStatusRules.CanBeOverdue"
affects: [10-05 dashboard summary endpoint]

actuals:
  tokens: 1300
  tasks: 2
  commits: 4

plan_head_before: b8d2494f23b4de7a6734ecea1ae8c6ef88438d1c
plan_head_after: 4d649c3a26aef7a7d138aec35cf908062e978ae7

tech-stack:
  added: []
  patterns:
    - "Date rules are pure functions on DateOnly or the BusinessClock; no device clock"
    - "RED stubs return wrong values so tests fail on assertions, not on a compile error"

key-files:
  created:
    - src/Csps.Domain/Time/DayPart.cs
  modified:
    - src/Csps.Domain/Time/BusinessClock.cs
    - src/Csps.Domain/Orders/OrderStatusRules.cs
    - tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs

key-decisions:
  - "Delivered stays in ActiveStatuses and IsActive; only OverdueStatuses and CanBeOverdue leave it out (D-55, 07 D-01)"

patterns-established:
  - "OverdueStatuses sits next to ActiveStatuses in the same declaration style"

requirements-completed: [DASH-01, DASH-02, DASH-04]

coverage:
  - id: D1
    description: "WeekOf gives the Monday to Sunday week that holds a day, including across a year end"
    requirement: DASH-02
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs#WeekRunsMondayToSunday"
        status: pass
    human_judgment: false
  - id: D2
    description: "SameDayLastMonth is the same day number last month, clamped to its last day (leap year, month ends, year end)"
    requirement: DASH-02
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs#SameDayLastMonthIsClampedToTheLastDay"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs#SameDayLastMonthInALeapYearClampsToFebruary29"
        status: pass
    human_judgment: false
  - id: D3
    description: "DayPart is Morning before 12:00, Afternoon to before 18:00, Evening from 18:00, read from the business zone and exact to the second"
    requirement: DASH-01
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs#DayPartFollowsTheBusinessClockToTheSecond"
        status: pass
    human_judgment: false
  - id: D4
    description: "CanBeOverdue and OverdueStatuses cover Pending, Mockup, InProduction and Ready only; Delivered is active but never overdue"
    requirement: DASH-04
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs#OnlyTheFourOpenStatusesCanBeOverdue"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs#OverdueStatusesListsTheFourInStoredOrder"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs#DeliveredIsActiveButNeverOverdue"
        status: pass
    human_judgment: false

duration: 13min
completed: 2026-11-06
status: complete
---

# Phase 10 Plan 02: Business week, same-day comparison, greeting part and overdue statuses Summary

*Created: 2026-11-06T20:57:00-06:00 · Updated: 2026-11-06T20:57:00-06:00*

**Pure Domain date rules for the dashboard: Monday to Sunday `WeekOf`, clamped `SameDayLastMonth`, a business-clock `DayPart` for the greeting, and the four-status overdue set that keeps Delivered active but never late. Domain coverage stays at 100%.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-11-07T02:43:00Z
- **Completed:** 2026-11-07T02:56:29Z
- **Tasks:** 2
- **Files modified:** 5 (1 created, 4 modified)

## Accomplishments

- `BusinessClock.WeekOf(day)` returns the Monday and Sunday of the week that holds the day, including the year-end week (Thu Jan 1 2026 gives Dec 29 2025 to Jan 4 2026).
- `BusinessClock.SameDayLastMonth(today)` returns the same day number last month, clamped to its last day (Mar 31 2026 gives Feb 28, Mar 31 2028 gives Feb 29, Jan 31 gives Dec 31 of the year before).
- `BusinessClock.DayPart` reads `LocalNow` in the business zone and is exact to the second at 12:00 and 18:00. No `DateTime.Now`, `Today` or `UtcNow` is used.
- `OrderStatusRules.OverdueStatuses` and `CanBeOverdue` list Pending, Mockup, InProduction and Ready only, matching the web `OPEN_STATUSES` set in `dueFlag.ts`. `ActiveStatuses` and `IsActive` are unchanged, so Delivered stays active.

## TDD Gate Compliance

Two RED to GREEN cycles, one per task. No refactor was needed. Gate order in git: `test` then `feat` for each task.

**Cycle 1 (Task 1, tracer: WeekOf and DayPart)**

- RED `36d75879`: `WeekOf` (returned `(day, day)`) and `DayPart` (always Morning) were stubs with wrong values, so the tests fail on the planned assertion and not on a compile error. Command: `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*BusinessClockTests"`. Result: total 19, failed 8, succeeded 11, exit code 2. Example: `WeekOf(2026-11-02)` "should be (11/2/2026, 11/8/2026) but was (11/2/2026, 11/2/2026)"; `DayPart` at 04:00Z "should be DayPart.Afternoon but was DayPart.Morning".
- Semantic assessment: the target tests ran and failed on expected-vs-actual for the planned behavior. Not a load, fixture or zero-test failure. The Morning cases passed on the stub by design (the stub returns Morning); the 6 other cases failed.
- GREEN `26ce434a`: total 19, failed 0, succeeded 19.

**Cycle 2 (Task 2, SameDayLastMonth and overdue statuses)**

- RED `55e84a11`: stubs returned wrong values (`SameDayLastMonth` returned `today`, `OverdueStatuses` was empty, `CanBeOverdue` was true only for Cancelled). Command: `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*BusinessClockTests" --filter-class "*OrderStatusRulesTests"`. Result: total 119, failed 12, succeeded 107, exit code 2. All 12 failures were "should be ... but was ..." assertions on the planned behavior. `DeliveredIsActiveButNeverOverdue` passed on the stub because the stub also returned false for Delivered.
- Semantic assessment: same as cycle 1, real assertion failures for the intended reason.
- GREEN `4d649c3a`: total 119, failed 0, succeeded 119.

The RED evidence was inspected by hand. `gsd_run check tdd-red-evidence` was not run because the xunit v3 / Microsoft.Testing.Platform console output is not one of the report formats that classifier reads.

## Task Commits

1. **Task 1: A Manila Wednesday gives its Monday to Sunday week and the right greeting part** - `36d75879` (test), `26ce434a` (feat)
2. **Task 2: The same-day comparison clamps at month ends and the overdue statuses exclude Delivered** - `55e84a11` (test), `4d649c3a` (feat)

**Plan metadata:** the SUMMARY commit that follows this file.

The tracer gate: Task 1's `<verify>` is automated only, so it was re-run after GREEN and passed (19 of 19) before Task 2 started.

## Files Created/Modified

- `src/Csps.Domain/Time/DayPart.cs` - the `DayPart` enum: Morning, Afternoon, Evening.
- `src/Csps.Domain/Time/BusinessClock.cs` - `WeekOf`, `SameDayLastMonth` (both static) and the `DayPart` property.
- `src/Csps.Domain/Orders/OrderStatusRules.cs` - `OverdueStatuses` and `CanBeOverdue`.
- `tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs` - week, same-day, leap-year and greeting-boundary cases.
- `tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs` - overdue status cases and the Delivered rule.

## Verification Results

- `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*BusinessClockTests" --filter-class "*OrderStatusRulesTests"`: Passed, total 119, failed 0, succeeded 119, skipped 0.
- Full Domain project with coverlet (`--coverlet --coverlet-include=[Csps.Domain]*`): Passed, total 1264, failed 0. Cobertura: line-rate 1, branch-rate 1 (2752 of 2752 lines, 1164 of 1164 branches), 0 lines with zero hits. Domain coverage stays at 100%.
- `dotnet format Csps.slnx --verify-no-changes`: exit code 0, no changes needed.
- Build: no warnings or errors (the analyzer gate is on; one CA1822 error on the first RED stub was fixed before the RED run).
- Acceptance criteria, Task 1: `WeekOf` signature grep = 1, `public DayPart DayPart` grep = 1, `DateTime.(Now|Today|UtcNow)` outside comments in BusinessClock.cs = 0.
- Acceptance criteria, Task 2: `SameDayLastMonth` signature grep = 1, `CanBeOverdue` in OrderStatusRules.cs = 1, test `SameDayLastMonthInALeapYearClampsToFebruary29` holds the literal 2028, 3, 31.
- gitleaks (`gitleaks protect --staged --no-banner`) ran before each of the 4 commits: no leaks found.

## Decisions Made

None beyond the plan. Delivered is left in `ActiveStatuses` and `IsActive` on purpose (07 D-01); only the overdue set excludes it (D-55).

## Deviations from Plan

None - plan executed exactly as written.

Two small notes, neither a deviation from the plan's goals:

- The year-end `WeekOf` case (Thu Jan 1 2026) is in the Task 1 theory, not Task 2 where the plan listed it, because it is a `WeekOf` case and sits naturally beside the others. It is covered either way.
- The RED commits include small stub members in `src/` (wrong-valued) so the tests compile and fail on assertions. GREEN replaces them. This is the usual compiled-language RED.

**Total deviations:** 0.

## Issues Encountered

- First RED run failed to build with analyzer error CA1822 on the `DayPart` stub (it touched no instance data). The stub was changed to read `LocalNow.Hour`, which is an instance member, and the build passed. This was before the RED commit, so no commit carried the broken stub.

## Known Stubs

None. All RED stubs were replaced in GREEN.

## Threat Flags

None. Pure functions, no new endpoint, auth path, file access or schema change. T-10-02 is mitigated: no device clock is read in `BusinessClock.cs` (grep gate = 0). T-10-SC: no package was added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Plan 10-05 (the dashboard summary endpoint) can call `BusinessClock.WeekOf`, `SameDayLastMonth`, `DayPart` and `OrderStatusRules.OverdueStatuses` directly. No blockers.

## Self-Check: PASSED

- FOUND: src/Csps.Domain/Time/DayPart.cs
- FOUND commits 36d75879, 26ce434a, 55e84a11, 4d649c3a on this branch; measured `git rev-list --count b8d2494f..HEAD` = 4.
- STATE.md and ROADMAP.md were not modified.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-06*
