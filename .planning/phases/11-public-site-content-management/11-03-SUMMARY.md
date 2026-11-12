---
phase: 11-public-site-content-management
plan: 03
subsystem: domain
tags: [open-status, business-clock, asia-manila, tdd, closures]
created: "2026-11-11T19:52:00-06:00"
updated: "2026-11-11T19:52:00-06:00"

requires:
  - phase: earlier foundation work
    provides: BusinessClock (Zone, LocalNow, Today) in Csps.Domain.Time
provides:
  - "OpenStatus.Compute(BusinessClock, week, closures): the pure open or closed rule in Manila time"
  - "DayHours, ClosureSpan, NextOpening and NextOpeningWhen records in Csps.Domain.Content"
affects: [11-11 public contact endpoint, 11-13 closures admin]

actuals:
  tokens: 9500
  tasks: 2
  commits: 4
plan_head_before: 24e4cef7ec03832dbb2b7fd29c27fa1abbe989bf
plan_head_after: e59c3f03fb26b33f8c860d730573973ad8936b86

tech-stack:
  added: []
  patterns:
    - "Pure Domain rule over BusinessClock: no machine clock, no zone lookup"
    - "Words-ready facts (Today, Tomorrow, Weekday plus date and time) so the client only formats"

key-files:
  created:
    - src/Csps.Domain/Content/OpenStatus.cs
    - src/Csps.Domain/Content/DayHours.cs
    - src/Csps.Domain/Content/ClosureSpan.cs
    - src/Csps.Domain/Content/NextOpening.cs
    - tests/Csps.Domain.UnitTests/Content/OpenStatusTests.cs
  modified: []

key-decisions:
  - "OpenStatus never reads a clock. The BusinessClock passed in is the only source of zone and today."
  - "A weekday missing from the week list counts as closed (an empty week is a week with no open day)."
  - "When two closures cover today, the first in the list supplies the note."

requirements-completed: [PUB-05, CONT-04]

duration: 20min
completed: 2026-11-11
status: complete

coverage:
  - id: D1
    description: "Open now and closes-at at 10:00 AM Manila, exact boundaries 8:59 closed, 9:00 open, 5:59 PM open, 6:00 PM closed"
    requirement: "PUB-05"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/OpenStatusTests.cs#TenAmOnAMondayIsOpenUntilSixPm, NineAmIsOpen, FiveFiftyNinePmIsOpen, EightFiftyNineIsClosedAndOpensToday, SixPmIsClosedAndOpensTomorrow"
        status: pass
    human_judgment: false
  - id: D2
    description: "Next opening labelled Today, Tomorrow or Weekday with date, weekday and time; skips closed weekdays and closure days; null after 14 days"
    requirement: "PUB-05"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/OpenStatusTests.cs#SaturdayEveningWithSundayClosedOpensOnMondayAsAWeekday, ClosureStartingTomorrowSkipsEveryClosedDay, ClosureCoveringTheNextFourteenDaysGivesNoNextOpening, ClosureThroughTheFourteenthDayLeavesNothingInRange, ClosureEndingBeforeTheFourteenthDayFindsTheFourteenth"
        status: pass
    human_judgment: false
  - id: D3
    description: "A closure today closes the whole day, sets ClosedToday and carries its note (or null)"
    requirement: "CONT-04"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/OpenStatusTests.cs#ClosureTodayClosesTheWholeDayWithItsNote, ClosureTodayWithNoNoteHasANullNote, ClosureTodayBeforeOpeningDoesNotOfferTodayAsTheNextOpening"
        status: pass
    human_judgment: false
  - id: D4
    description: "Zone comes only from the BusinessClock; month end, year end, empty week and no-open-day edges"
    requirement: "PUB-05"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/OpenStatusTests.cs#TheSameInstantInAnotherClockZoneGivesThatZonesAnswer, ManilaDateNotTheUtcDateDecidesToday, YearEndEveningWithNewYearsDayClosedOpensOnJanuarySecond, MonthEndEveningOpensOnTheFirstOfNextMonth, NoOpenDayInTheWeekGivesClosedWithNothingNext, EmptyWeekCountsEveryDayAsClosed"
        status: pass
    human_judgment: false
  - id: D5
    description: "Domain coverage gate for the new files"
    verification:
      - kind: other
        ref: "powershell tools/scripts/Invoke-CoverageGate.ps1"
        status: pass
    human_judgment: false
---

# Phase 11 Plan 03: Open status in Manila time Summary

**A pure `OpenStatus.Compute` rule turns weekly hours, closures and the BusinessClock into "open now, closes at" or "closed now, opens next at" (Today, Tomorrow or Weekday, 14-day look-ahead), proven at every boundary with 100% Domain line and branch coverage.**

*Created: 2026-11-11T19:52:00-06:00 · Updated: 2026-11-11T19:52:00-06:00*

## Performance

- **Duration:** about 20 min
- **Completed:** 2026-11-12T01:51Z
- **Tasks:** 2 (a tracer and a feature task, both TDD)
- **Files:** 5 created, 0 modified

## Accomplishments

- `OpenStatus.Compute(BusinessClock, IReadOnlyList<DayHours>, IReadOnlyList<ClosureSpan>)` with `LookAheadDays = 14`. Open when no closure covers today and `OpensAt <= local time < ClosesAt`.
- `NextOpening(Date, Day, OpensAt, When)` with `NextOpeningWhen` Today, Tomorrow, Weekday. Null when nothing opens in the window.
- `DayHours` (with `IsOpenDay`) and `ClosureSpan` (with `Covers`, both end days included).
- 23 tests in `OpenStatusTests`, all passing.

## TDD Gate Compliance

- **RED 1** `da388765` `test(11-03)`: the types plus `Compute` stubbed as always closed. Both tests failed on the planned assertion (`status.IsOpen should be True but was False`; `inManila.IsOpen should be True but was False`). Semantic assessment: target tests ran, built clean, failed for the intended reason, not a load, syntax or fixture fault. The stub was needed so the tests compile and fail on behavior instead of on a missing type.
- **GREEN 1** `10f9c293` `feat(11-03)`: open case from the business clock. 2 of 2 passed.
- **RED 2** `2b0625e8` `test(11-03)`: 21 more tests added, 11 failed (10 on `status.NextOpening`, 1 on `status.TodayClosureNote`), 12 passed. Semantic assessment: all 11 failures are assertions on the planned behavior; the 12 that passed were cases the tracer already handled.
- **GREEN 2** `e59c3f03` `feat(11-03)`: next-opening search and closure note. 23 of 23 passed.
- **REFACTOR:** none needed, no commit.
- `gsd_run check tdd-red-evidence` was not run: it reads TAP, JUnit, swift-testing and `unittest` reports, and xunit v3 on Microsoft.Testing.Platform prints none of those. The RED evidence above is the real console output, read by hand.

## Task Commits

1. **Task 1 (tracer): open at 10:00 AM Manila** - `da388765` (test), `10f9c293` (feat)
2. **Task 2: closed times, closures, calendar edges** - `2b0625e8` (test), `e59c3f03` (feat)

**Tracer gate:** auto mode off, `human_verify_mode` end-of-phase and the verify is automated only, so the verify was re-run (2 of 2 passed) and expansion continued. No checkpoint.

## Verification Evidence

- `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OpenStatusTests"`: `Test run summary: Passed! total: 23 failed: 0 succeeded: 23 skipped: 0`.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- `tools/scripts/Invoke-CoverageGate.ps1`: exit 0. The line for the Domain assembly reads `Csps.Domain line 100% (2911/2911) (rule >= 100%)  branch 100% (1268/1268) (rule >= 100%)  PASS`. Whole-suite unit totals during that run: Domain 1346 passed, Application 2561 passed. Cobertura per-class rows: `Csps.Domain.Content.OpenStatus`, `DayHours` and `ClosureSpan` each at line-rate 1 and branch-rate 1. `NextOpening` has no coverable lines (a record and an enum, all compiler-generated).
- Acceptance: `grep -c "public static OpenStatus Compute"` gives 1; `DateTime.Now` outside comments gives 0; test names contain EightFiftyNine, SixPm, ClosureToday, FourteenDays, YearEnd and NoOpenDay.
- The banned-symbol analyzer (`BannedSymbols.txt` bans `DateTime.Now`, `DateTimeOffset.Now`, `UtcNow` and `Today`) builds clean with the new code.
- gitleaks `protect --staged` ran before each of the four commits: no leaks.

## Deviations from Plan

**1. [Rule 3 - Blocking] `FakeTimeProvider` not used in the tests**
- **Found during:** Task 1
- **Issue:** The plan says the existing Domain tests build clocks from `FakeTimeProvider` and the artifact list expects the test file to contain it. They do not. `BusinessClockTests` builds `new BusinessClock(zone, source, instant)` directly, and `Csps.Domain.UnitTests` has no reference to `Microsoft.Extensions.TimeProvider.Testing`. Adding it would be a package change, which the plan forbids.
- **Fix:** The tests build the clock the same way `BusinessClockTests` does, from a fixed UTC instant. `OpenStatus` only reads `BusinessClock`, so a fake provider adds nothing here.
- **Impact:** The artifact check `contains: "FakeTimeProvider"` is not met. Behavior is covered either way.

**2. [Judgment] Non-Manila machine zone test**
- **Issue:** `TimeZoneInfo.Local` cannot be changed inside a test process on Windows without affecting other tests, so "same instant on a machine whose zone is not Manila" cannot be forced directly.
- **Fix:** `TheSameInstantInAnotherClockZoneGivesThatZonesAnswer` gives the same UTC instant to a Manila clock and a UTC-08 clock and shows the answer follows the clock's zone. `ManilaDateNotTheUtcDateDecidesToday` shows the Manila date wins over the UTC date. The suite passes on this Windows machine and is expected to pass the same on the ubuntu CI leg (UTC). The code never touches `TimeZoneInfo.Local`, and the banned-symbol analyzer blocks the usual routes to it.

**Total deviations:** 2 (1 blocking, 1 judgment). **Impact on plan:** none on behavior or coverage.

## Decisions Made

- A weekday missing from the `week` list counts as closed.
- If two closures cover today, the first in the list gives the note.
- `IsOpenDay` is a convenience for callers (the Contact endpoint and the admin forms). `Compute` reads the nullable times directly, so the property is exercised by its own test only.

## Issues Encountered

- `dotnet format` takes more than 3 minutes on the whole solution and was moved to the background by the harness. It finished with exit 0.
- Line endings: git warns that LF becomes CRLF on the new files. `dotnet format --verify-no-changes` is clean, so the editorconfig is satisfied.

## Known Stubs

None. No placeholder data, no TODO or FIXME.

## Threat Flags

None. No endpoint, auth path, file access or schema change. T-11-07 is mitigated by the zone and today coming only from `BusinessClock`. T-11-SC: no package added or bumped.

## User Setup Required

None.

## Next Phase Readiness

- Plan 11-11 can serve `OpenStatus` from the contact endpoint, and plan 11-13 can feed `ClosureSpan` rows into it.
- Flagged for the verifier, as the plan asked: PUB-05 was unclassified by the edge probe. Its edges are covered by the tests listed in D1 to D4.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-11*

## Self-Check: PASSED

- FOUND: src/Csps.Domain/Content/OpenStatus.cs, DayHours.cs, ClosureSpan.cs, NextOpening.cs
- FOUND: tests/Csps.Domain.UnitTests/Content/OpenStatusTests.cs
- FOUND commits: da388765, 10f9c293, 2b0625e8, e59c3f03 (all ancestors of HEAD)
- `git rev-list --count 24e4cef7..HEAD` before this SUMMARY commit: 4
