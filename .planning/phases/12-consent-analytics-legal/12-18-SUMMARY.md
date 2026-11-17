---
phase: 12-consent-analytics-legal
plan: 18
subsystem: analytics-retention
tags: [maintenance-job, retention, rollup, ef-core, sql-server, anl-09]
created: "2026-11-17T10:25:00-06:00"
updated: "2026-11-17T10:25:00-06:00"

requires:
  - phase: 12-consent-analytics-legal
    provides: "AnalyticsRetention cut dates (12-04), ConsentRecords, DailyPageCounts, AnalyticsVisits, AnalyticsPageViews, AnalyticsVitalSamples and AnalyticsSalts tables (12-08, 12-10, 12-14)"
provides:
  - "AnalyticsRetentionJob: an IMaintenanceJob (Order 15, Name analytics-retention) with five reported rules"
  - "DailyReferrerCounts and DailyDeviceCounts tables (AddDailyAnalyticsCounts migration) holding anonymous per-day totals"
affects: [12-stats-page, 12-privacy-policy-retention-wording, maintenance-workflow]

plan_head_before: 52b60601acb82dd22565b4a1dea440424ec4a51b
plan_head_after: 418278f92420a4282d90f0a1f777f044f2effa34

actuals:
  tokens: 101000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "One transaction per rolled day: replace the day's rows and move the cursor together, so a retry never double counts"
    - "Retention rules as a list of (label, failed text, work); a database failure is that rule's failed line and the next rule still runs"
    - "Raw purge is bounded by the saved cursor, so a day is removed only after its totals exist"

key-files:
  created:
    - src/Csps.Domain/Analytics/DailyReferrerCount.cs
    - src/Csps.Domain/Analytics/DailyDeviceCount.cs
    - src/Csps.Infrastructure/Persistence/Configurations/DailyReferrerCountConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/DailyDeviceCountConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261117155405_AddDailyAnalyticsCounts.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261117155405_AddDailyAnalyticsCounts.Designer.cs
    - src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs
    - tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/DailyAnalyticsCountsMigrationTests.cs
    - tests/Csps.Domain.UnitTests/Analytics/DailyAnalyticsCountTests.cs
  modified:
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/Maintenance/MaintenanceRegistration.cs
    - tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs

key-decisions:
  - "The cursor is the last rolled day as yyyy-MM-dd in IMaintenanceCursors under the job name analytics-retention; after a full pass it is yesterday, even when yesterday had no visits"
  - "Only days that have visits are rolled; an empty day writes no rows. The stats page must read a missing day as zero"
  - "The job takes its clock from IBusinessCalendar (clock.Today and clock.UtcNow), so it needs no TimeProvider"
  - "The 'Old visit records removed' value counts every row removed from samples, page views and visits together"

requirements-completed: [ANL-09]

coverage:
  - id: D1
    description: "Each closed Asia/Manila day is rolled into DailyReferrerCounts and DailyDeviceCounts (device and browser), oldest first, one day per transaction; today is never touched"
    requirement: ANL-09
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#ClosedDaysAreRolledIntoReferrerAndDeviceTotalsAndTodayIsNeverTouched"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#ADayStaysOpenUntilManilaMidnightPasses"
        status: pass
    human_judgment: false
  - id: D2
    description: "Re-rolling a day replaces its rows, so a crash and retry never double counts; the cursor holds the last rolled day"
    requirement: ANL-09
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#ARetryAfterACrashReplacesTheDaysRowsInsteadOfAddingToThem"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#TheLastRolledDayIsSavedAsYesterday"
        status: pass
    human_judgment: false
  - id: D3
    description: "Raw visits, page views and speed samples older than 13 months are removed in batches of 500, only for days the cursor shows rolled up; month-end and leap edges are tested"
    requirement: ANL-09
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#AVisitThirteenMonthsOldGoesAndOneAtTheCutDateStaysAfterTheirDayIsRolledUp"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#ADayThatWasNotRolledUpIsNeverRemovedEvenWhenItIsOld"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#TwelveHundredOldPageViewsTakeThreeBatchesOf500"
        status: pass
    human_judgment: false
  - id: D4
    description: "Cookie choices older than 13 months, daily totals older than 3 years and address salts older than yesterday are removed at their exact cut moments"
    requirement: ANL-09
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#ACookieChoiceThirteenMonthsOldGoesAndOneAtTheCutMomentStays"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#DailyTotalsOlderThanThreeYearsGoFromAllThreeTablesAndOneAtTheFloorStays"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#AddressSaltsForTodayAndYesterdayStayAndOlderOnesGo"
        status: pass
    human_judgment: false
  - id: D5
    description: "Five plain-English lines, a failed rule becomes its own failed line while the next rule runs, a spent budget reports More, and the monthly maintenance answer lists the new line"
    requirement: ANL-09
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#TheFiveRulesReportTheirOwnLabelsInRunOrder"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs#AFailedCookieChoiceRemovalDoesNotStopTheDailyTotalsAndSaltRules"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs#TheRunAnswerListsTheVisitorDaysRolledUpLineAfterThePurgeLines"
        status: pass
    human_judgment: false
  - id: D6
    description: "AddDailyAnalyticsCounts creates exactly DailyReferrerCounts and DailyDeviceCounts with the planned columns and keys, no JSON column, no trigger, no foreign key, no row version"
    requirement: ANL-09
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/DailyAnalyticsCountsMigrationTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-11-17
status: complete
---

# Phase 12 Plan 18: Analytics retention job Summary

**A monthly maintenance job that rolls every closed Manila day into anonymous referrer and device totals, then removes raw visits and cookie choices at 13 months, daily totals at 3 years and old address salts, with one plain line per rule.**

## Performance

- **Duration:** about 40 min
- **Completed:** 2026-11-17
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files modified:** 14 (10 created, 4 changed)

## Accomplishments

- `AnalyticsRetentionJob` (Order 15, name `analytics-retention`) is registered after `PurgeExpiredRecordsJob`, so the Phase 9 keyed monthly run calls it. `.github/workflows/maintenance.yml` is untouched (D-36).
- Rule 1 "Visitor days rolled up": each closed day after the cursor, oldest first, in one transaction: delete the day's daily rows, insert grouped counts (referrer, device, browser), save the cursor. At least one day per pass; a spent budget then ends the pass with More. After a full pass the cursor is yesterday.
- Rule 2 "Old visit records removed": samples, page views, visits before `AnalyticsRetention.RawCut(today)` and not after the cursor, 500 per batch, children first. No cursor means nothing is removed.
- Rule 3 "Old cookie choices removed": `ConsentRecords` before `ConsentPurgeBefore(now)`.
- Rule 4 "Old daily visitor totals removed": the three daily tables before `DailyFloor(today)`.
- Rule 5 "Old address salts removed": salts older than yesterday.
- Migration `AddDailyAnalyticsCounts`: `DailyReferrerCounts` (date, varchar(253), int; PK day + referrer) and `DailyDeviceCounts` (date, tinyint, varchar(20), int; PK day + dimension + name). No JSON, no trigger, no change to other tables.

## Task Commits

1. **Task 1 (tracer): rollup** - `75fe29db` (test, RED), `adb30540` (feat, GREEN)
2. **Task 2: 13-month purges** - `2f5119a8` (test, RED), `91a51899` (feat, GREEN)
3. **Task 3: daily floor, salts, failure isolation** - `526f6b7f` (test, RED), `418278f9` (feat, GREEN)

**Plan metadata:** the docs commit that adds this file.

## TDD Gate Compliance

Each task has a `test(12-18)` commit followed by a `feat(12-18)` commit. No refactor commits were needed.

- **Task 1 RED (`75fe29db`):** model, configurations, migration and a compile-only job stub went in with the tests (the model without its migration fails every database test, the same shape as plan 12-14). Infrastructure run: total 26, failed 10, all in `AnalyticsRetentionJobTests`. Server `MaintenanceEndpointTests`: total 13, failed 1. Semantic assessment: every failing test reached the planned assertion path and failed because the report had no `Visitor days rolled up` line (`Sequence contains no matching element` from `Single`). The migration, trigger and script tests passed on arrival, as expected. No build, discovery or fixture fault. The `gsd_run check tdd-red-evidence` classifier was not run: this repo uses xunit.v3 MTP output, which is not one of the classifier's supported report formats, so no evidence record could be submitted. This is a gap against the strict reference, recorded here.
- **Task 2 RED (`2f5119a8`):** total 22, failed 11 (all 11 new tests). Reason: no `Old visit records removed` or `Old cookie choices removed` line, so nothing was purged.
- **Task 3 RED (`526f6b7f`):** total 30, failed 8 (all 8 new tests). Reason: report had only three lines.
- **GREEN results:** after Task 1 Infrastructure total 26, failed 0; Server total 13, failed 0. After Task 2 total 22, failed 0. After Task 3 total 48 (job plus `PurgeExpiredRecordsJobTests`), failed 0.

## Evidence (final runs, quoted)

- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AnalyticsRetentionJobTests" --filter-class "*DailyAnalyticsCountsMigrationTests" --filter-class "*TriggerInventoryTests" --filter-class "*MigrationScriptTests" --filter-class "*MigrationTests" --filter-class "*MaintenanceCursorsTests" --filter-class "*MaintenanceCursorsMigrationTests"`: total 246, failed 0, succeeded 246.
- `... --filter-class "*AnalyticsRetentionJobTests" --filter-class "*PurgeExpiredRecordsJobTests"`: total 48, failed 0.
- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MaintenanceEndpointTests"`: total 13, failed 0.
- `dotnet test --project tests/Csps.ArchitectureTests` (whole project, includes `NoInlineSqlTests` and `MaintenanceWorkflowTests`): total 290, failed 0.
- `dotnet test --project tests/Csps.Domain.UnitTests` (whole project): total 2276, failed 0.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- Builds ran with analyzers as errors; the only analyzer hit was CA1822 in my own test file during RED, fixed before the first RED run. Zero warnings in the final builds.
- Acceptance greps: `AddScoped<IMaintenanceJob, AnalyticsRetentionJob>` 1, `public int Order => 15;` 1, `"DailyReferrerCounts"` 1, `AnalyticsRetention.RawCut` 1, `AnalyticsRetention.ConsentPurgeBefore` 1, `AnalyticsRetention.DailyFloor` 1, `Old address salts removed` 1.
- No flaky test seen. One test of mine failed once for a wrong expectation (the device table holds a device and a browser row per day); fixed in the test and re-run alone: pass.
- The Server project and the whole Infrastructure project were not run in full (siblings share the LocalDB instance); only the filters above ran.

## Generated migration (Up and Down)

Up creates the two tables:

```
CreateTable DailyDeviceCounts  (BusinessDay date, Dimension tinyint, Name varchar(20), Visits int; PK BusinessDay, Dimension, Name)
CreateTable DailyReferrerCounts (BusinessDay date, Referrer varchar(253), Visits int; PK BusinessDay, Referrer)
```

Down drops `DailyDeviceCounts` and `DailyReferrerCounts`. Nothing else changes. Only the model snapshot was regenerated, from this worktree.

## Deviations from Plan

**1. [Rule 3 - Blocking] Migration file name**
- **Issue:** the plan names `20261116000004_AddDailyAnalyticsCounts`. Migrations already in the tree are dated 2026-11-17, so that name would sort before them and the snapshot history would be out of order.
- **Fix:** let `dotnet ef migrations add AddDailyAnalyticsCounts` choose the timestamp: `20261117155405_AddDailyAnalyticsCounts`. The plan's `files_modified` path therefore differs.
- **Commit:** `75fe29db`.

**2. [Rule 2 - Missing critical] Domain unit tests for the two new entities**
- **Issue:** the project requires Domain coverage of 100%; the plan listed no Domain test file.
- **Fix:** added `tests/Csps.Domain.UnitTests/Analytics/DailyAnalyticsCountTests.cs` (16 tests, all pass).
- **Commit:** `75fe29db`.

**3. [Design] Job constructor has no `TimeProvider`**
- The clock comes from `IBusinessCalendar` (`Today`, `UtcNow`), so a separate `TimeProvider` would be unused. Tests pass a fake calendar built on `FakeTimeProvider`.

**4. [Environment] Restore**
- The fresh worktree had no `obj` assets, so `dotnet restore Csps.slnx` and `dotnet tool restore` ran once. No package was added or bumped.

**5. [Housekeeping] Plan commit ledger**
- The per-plan head ledger file could not be written from this worktree (the write target sits outside the worktree path). `plan_head_before` is the worktree base asserted at start, `52b60601acb82dd22565b4a1dea440424ec4a51b`. The measured count `git rev-list --count 52b60601..HEAD` was 6 at SUMMARY time (the docs commit makes 7).

**Total deviations:** 5 (1 blocking, 1 missing-critical, 3 notes). **Impact:** none on behavior or scope.

## Issues Encountered

None that remain open.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or trust boundary. T-12-51 to T-12-53 are mitigated: named cut-date functions, per-rule lines, raw purge bounded by the cursor with month-end and leap-day edge tests, salts older than yesterday removed.

## Open items for the owner (decisions are yours)

1. **A late visit for an already rolled day.** A visit row written after its business day was rolled up (for example a request that crosses Manila midnight) would not be in that day's totals, and would be purged at 13 months without ever being counted. The window is a few milliseconds. Options: (a) accept it (recommended: tiny, no extra cost); (b) have each run also re-roll the last two days; (c) re-roll every day before purging. Not changed, because it is a behavior and cost choice.
2. **Missing days.** A day with no visits has no daily rows (no zero rows). The stats page plan must read a missing day as zero. Options: (a) keep as is and document for the stats plan (recommended); (b) write explicit zero rows.
3. **What "Visits" counts.** The totals count visit rows (a visitor with two visits counts twice), matching the plan wording "visits". No unique-visitor totals are kept.
4. **Cross-midnight page views.** Deleting a visit also removes its page views through the database cascade, including a view dated the next day, up to a day earlier than that view's own cut. Harmless and not changed.
5. **ANL-09 coverage flag.** The edge probe left ANL-09 unclassified. Coverage here comes from the tests listed in the `coverage` block; the Privacy Policy wording about retention (other plans) is not re-checked here.
6. **TDD RED classifier.** The format-based RED classifier does not read xunit.v3 MTP output, so RED evidence is quoted from the runs, not machine-validated.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The stats page can read old days from `DailyReferrerCounts` and `DailyDeviceCounts` (Dimension 1 = Device: Phone, Tablet, Computer, Other; 2 = Browser) with no gap, treating a missing day as zero.
- The Privacy Policy retention text can now be checked against code: raw visits and cookie choices 13 months, daily totals 3 years, salts 2 days.

## Self-Check: PASSED

- Files exist: all ten created files and four changed files (checked from the commits).
- Commits exist: `75fe29db`, `adb30540`, `2f5119a8`, `91a51899`, `526f6b7f`, `418278f9`.

---
*Phase: 12-consent-analytics-legal*
*Completed: 2026-11-17*
