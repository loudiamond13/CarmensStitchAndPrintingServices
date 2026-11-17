---
phase: 12-consent-analytics-legal
plan: 04
subsystem: domain
tags: [analytics, retention, stats, web-vitals, tdd]
requires: []
provides:
  - "AnalyticsRetention constants and cut dates"
  - "StatsRangePresets.Resolve (server twin of the web resolveRangePreset)"
  - "StatsBucket.For (day or month bars)"
  - "VitalRating.Rate, VitalBounds.IsValid, VitalMetric, VitalGrade"
  - "NearestRank.Index"
  - "Shares.LargestRemainder"
affects: [12-18, 12-21, 12-25, 12-26, 12-27]
tech-stack:
  added: []
  patterns: ["named-constant retention class like AuditRetention", "pure functions that take today or now as an argument"]
key-files:
  created:
    - src/Csps.Domain/Analytics/AnalyticsRetention.cs
    - src/Csps.Domain/Analytics/StatsRangePresets.cs
    - src/Csps.Domain/Analytics/StatsBucket.cs
    - src/Csps.Domain/Analytics/VitalMetric.cs
    - src/Csps.Domain/Analytics/VitalRating.cs
    - src/Csps.Domain/Analytics/NearestRank.cs
    - src/Csps.Domain/Analytics/Shares.cs
    - tests/Csps.Domain.UnitTests/Analytics/AnalyticsRetentionTests.cs
    - tests/Csps.Domain.UnitTests/Analytics/StatsRangePresetsTests.cs
    - tests/Csps.Domain.UnitTests/Analytics/StatsBucketTests.cs
    - tests/Csps.Domain.UnitTests/Analytics/VitalRatingTests.cs
    - tests/Csps.Domain.UnitTests/Analytics/NearestRankTests.cs
    - tests/Csps.Domain.UnitTests/Analytics/SharesTests.cs
  modified: []
decisions:
  - "Preset dates follow the web client exactly: last-7-days is today minus 6, last-30-days is today minus 29, both ends included"
  - "Vital thresholds are local constants inside the methods, not class constants, so Domain coverage stays at 100%"
metrics:
  duration: "about 15 minutes"
  completed: 2026-11-16
status: complete
commits: 7
plan_head_before: e72dfe711eb4862e77b6fb20bb78ba7afaaa5f24
plan_head_after: 0f1df507fcc333eafd0f55527fc9213c5437c586
actuals:
  tokens: 5500
  tasks: 3
  commits: 7
requirements: [ANL-08, ANL-09]
created: "2026-11-16T20:30:00-06:00"
updated: "2026-11-16T20:30:00-06:00"
---

# Phase 12 Plan 04: Analytics date, rating and share rules Summary

*Created: 2026-11-16T20:30:00-06:00 · Updated: 2026-11-16T20:30:00-06:00*

One-liner: pure, tested Domain rules for retention cut dates, stats range presets, day or month bars, Google speed ratings, the nearest-rank 75th percentile and whole-percent shares.

## What was built

- `AnalyticsRetention`: RawMonths 13, ConsentMonths 13, DailyYears 3, ConsentLifetimeMonths 12, SessionMinutes 30, SaltDays 2. `RawCut` (AddMonths -13), `DailyFloor` (AddYears -3) and `ConsentPurgeBefore` (AddMonths -13). Month ends clamp: 2027-03-31 gives 2026-02-28, 2028-02-29 gives 2025-02-28.
- `StatsRangePresets`: five named presets plus `Custom`. `Resolve` takes the business today. Null, empty, "bogus" and "custom" give last-30-days.
- `StatsBucket.For`: Day up to 62 days inclusive, Month from 63.
- `VitalMetric`, `VitalGrade`, `VitalRating.Rate`, `VitalBounds.IsValid`: LCP 2500/4000 ms, CLS 0.1/0.25, INP 200/500 ms. On a threshold is the better rating. Bounds: LCP and INP 0 to 60000, CLS 0 to 10. An undefined metric throws `ArgumentOutOfRangeException`.
- `NearestRank.Index`: `ceil(p x n) - 1` in decimal math, null for an empty list.
- `Shares.LargestRemainder`: floor percents, then leftover points to the largest remainders, earlier item first on a tie. All zeros and an empty list are handled.

No clock is read anywhere. No package was added or bumped.

## TDD record

| Task | RED commit | GREEN commit | RED result |
|------|------------|--------------|------------|
| 1 | 11cd6b4a | 5fe9debc | 20 of 20 failed (NotImplementedException stubs) |
| 2 | 723b15c9 | 1517b8f7 (refactor 9dee34c6) | 36 of 37 failed (the one pass is the stored-enum-number test) |
| 3 | 86d5b519 | 0f1df507 | 15 of 15 failed |

The RED commits hold stubs that throw `NotImplementedException` (the build has `CS1591` as an error, so the stubs carry real doc comments). RED fails at run time, not at compile time.

## Verification (real output)

- Task 1 tests: `total: 20, failed: 0, succeeded: 20`
- Task 2 tests: `total: 37, failed: 0, succeeded: 37`
- Task 3 tests: `total: 15, failed: 0, succeeded: 15`
- Whole Domain unit suite: `total: 1972, failed: 0, succeeded: 1972`
- `dotnet build Csps.slnx`: `Build succeeded. 0 Warning(s) 0 Error(s)`
- Coverage (coverlet.MTP, cobertura, Analytics classes): all seven classes line-rate 1 and branch-rate 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Decimal class constants showed as uncovered lines**
- **Found during:** Task 3 coverage check
- **Issue:** `private const decimal` fields in `VitalRating` and `VitalBounds` appeared as 0-hit lines (line-rate 0.625 and 0.818), which would break the 100% Domain gate.
- **Fix:** moved the thresholds to local constants inside `Rate` and `IsValid`. Names kept, values unchanged.
- **Files modified:** `src/Csps.Domain/Analytics/VitalRating.cs`
- **Commit:** 9dee34c6

### Other notes

- The client counts days the same way the plan states (last 7 days is today minus 6, last 30 is today minus 29), so no difference needed noting.
- The client also has a `today` preset. The plan's server list has no `today`, so it was not added; a `today` name resolves to last-30-days on the server. Plan 12-18 or 12-21 should decide whether the stats page offers it.
- The commit trailer says Claude Sonnet 5.5, the model that ran this plan, following the harness attribution rule. The plan text says Opus 5.5.
- `commits: 7` counts the task commits up to `plan_head_after`. The SUMMARY commit follows it.

## Known Stubs

None.

## Threat Flags

None. Pure functions, no new endpoints or data access.

## Self-Check: PASSED

All 13 files exist and all seven commits are ancestors of HEAD (checked below at commit time).
