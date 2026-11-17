---
phase: 12-consent-analytics-legal
plan: 21
subsystem: analytics
tags: [analytics, visitor-stats, manager-only, d-27, tdd]
requires: [12-04, 12-14, 12-17]
provides:
  - "GET /api/v1/visitor-stats (GetVisitorStats): totals, resolved range and cut date"
  - "IVisitorStatsReader.ReadTotalsAsync and VisitorStatsReader"
  - "VisitorStatsRequestValidator with the Audit Log date messages and the 3-year floor"
affects: [12-23, 12-25, 12-26, 12-27, 12-28]
tech-stack:
  added: []
  patterns: ["reader port over untracked EF LINQ aggregates", "validator reuses the Audit Log date constants"]
key-files:
  created:
    - src/Csps.Application/Analytics/VisitorStatsRequest.cs
    - src/Csps.Application/Analytics/VisitorStatsRequestValidator.cs
    - src/Csps.Application/Analytics/GetVisitorStatsHandler.cs
    - src/Csps.Application/Analytics/VisitorStatsResponse.cs
    - src/Csps.Application/Ports/IVisitorStatsReader.cs
    - src/Csps.Infrastructure/Analytics/VisitorStatsReader.cs
    - src/Csps.Server/Controllers/VisitorStatsController.cs
    - tests/Csps.Application.UnitTests/Analytics/VisitorStatsRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs
    - tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsEndpointTests.cs
  modified:
    - src/Csps.Infrastructure/Analytics/AnalyticsRegistration.cs
    - src/Csps.Server/Composition/AnalyticsApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
decisions:
  - "The reader port names its range parameters first and last, not from and to, because analyzer CA1716 rejects `to` (a VB keyword) on an interface member"
  - "The handler echoes the effective range name: an unknown name, or the web-only `today`, comes back as last-30-days so the client can see what was read"
  - "The reader returns raw counts; the handler applies the D-27 nulls and countedFrom, so the rule lives in one place"
metrics:
  duration: "about 25 minutes"
  completed: 2026-11-17
status: complete
commits: 6
plan_head_before: 0ac76ebaf72860bc167da5ef77baee3e456a0f9a
plan_head_after: 926434f3eb5ffb2b8b7e29156be481d903e88a8f
actuals:
  tokens: 16700
  tasks: 3
  commits: 6
requirements: [ANL-08]
created: "2026-11-17T12:02:03-06:00"
updated: "2026-11-17T12:02:03-06:00"
---

# Phase 12 Plan 21: A Manager can read unique visitors, visits and page views for any date range Summary

*Created: 2026-11-17T12:02:03-06:00 · Updated: 2026-11-17T12:02:03-06:00*

One-liner: a Manager-only `GET /api/v1/visitor-stats` that resolves the range in the Manila business calendar, validates custom dates with the Audit Log's words and a 3-year floor, and returns exact totals with the 13-month cut, all by EF LINQ with no cache.

## What was built

- **Endpoint.** `VisitorStatsController`, `[Authorize(Policy = Policies.Manager)]`, `[ResponseCache(NoStore = true)]`, endpoint name `GetVisitorStats`, query `range`, `from`, `to`. Matrix row: anonymous 401, Admin 403, Manager 200.
- **Answer.** `{ range, from, to, cutDate, totals: { uniqueVisitors, visits, pageViews, countedFrom } }`. Dates are `YYYY-MM-DD`. Nothing per visitor or per visit is returned.
- **Ranges (D-24).** Presets go through `StatsRangePresets.Resolve` with the business today from `IBusinessCalendar`. A missing or unknown name is last-30-days. `custom` uses `from` and `to`.
- **Validation (OR-3, D-04).** Only for `custom`: `Enter a start date.`, `Enter an end date.`, `Enter a real date.`, `The start date must be on or before the end date.`, and `Choose a date from {MMM d, yyyy} to today.` for a day before `AnalyticsRetention.DailyFloor(today)` or after today. The date and order messages are the Audit Log constants.
- **Cut (D-27, D-33).** Wholly before the cut: `uniqueVisitors` and `visits` are null. Crossing it: they count from the cut and `countedFrom` is the cut date. After it: `countedFrom` is null. The cut day itself counts as raw.
- **Reader.** `VisitorStatsReader` sums `DailyPageCounts.Views` (a missing day adds nothing, so a day with no visits is zero, as the wave 5 note requires), and counts `AnalyticsVisits` rows and `DISTINCT VisitorHash` from `max(first, cut)` to `last`. EF translated the distinct count on SQL Server (RESEARCH A4), so no in-memory fallback was needed.
- **Contract.** OpenAPI snapshot and `web/src/types/api.generated.ts` regenerated with the locked generator (`npm ci` in `tools/openapi-gen`, no package change).

## TDD record

| Task | RED commit | GREEN commit | RED result |
|------|------------|--------------|------------|
| 1 (tracer) | 163de7b0 | a4a7549f | Reader 7 of 7 failed (stub throws `NotImplementedException`); endpoint and matrix filters 8 of 572 failed on status (route absent): 3 endpoint tests, 3 matrix rows, the parallel-callers test and the coverage test |
| 2 | 52835748 | 20d166fe | 13 unit tests and 7 endpoint tests failed on assertions (validator stub had no rules; handler already called it) |
| 3 | d645eded | 926434f3 | 2 unit tests and 2 endpoint tests failed on assertions (no nulls, no `countedFrom` yet) |

RED semantic assessment: every RED failure above is the planned behavior missing, not a build, load or fixture fault. Some tests in Tasks 2 and 3 passed at RED on purpose because Task 1 already gave that behavior (preset resolution at Manila midnight, empty month zeros, the cut-day count, the no-hash answer). They stay as pinned regression tests. The Task 1 reader RED is a stub that throws, the same shape plan 12-04 used.

## Verification (real output)

- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*VisitorStatsReaderTests"`: `total: 7, failed: 0, succeeded: 7`
- `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*VisitorStatsRequestValidatorTests" --filter-class "*GetVisitorStatsHandlerTests"`: `total: 40, failed: 0, succeeded: 40`
- Server filters `*VisitorStatsEndpointTests`, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests`, `*OpenApiSnapshotTests`, `*RateLimitTests`: `total: 675, failed: 0, succeeded: 675`
- `*VisitorStatsEndpointTests` alone: `total: 16, failed: 0, succeeded: 16`
- Whole Application unit suite: `total: 3259, failed: 0, succeeded: 3259`
- Architecture tests: `total: 290, failed: 0, succeeded: 290`
- `dotnet build Csps.slnx`: `0 Warning(s)`, `0 Error(s)`
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output
- `npm --prefix tools/openapi-gen run check`: `Generated API types match tools/openapi-gen/openapi.v1.json.`
- Acceptance greps: matrix row count 1, `GetVisitorStats` in the web types 2, `Enter a start date.` 1, `AnalyticsRetention.DailyFloor` 1, `CountedFrom` 2, `AnalyticsRetention.RawCut` 1.
- The full Server and Infrastructure suites were not run (a sibling executor was using LocalDB; targeted filters only). No flake seen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reader parameters renamed from `from` and `to`**
- **Found during:** Task 1 build
- **Issue:** CA1716 is an error and rejects `to` as a parameter name on an interface member. The plan's interface text uses `from` and `to`.
- **Fix:** `IVisitorStatsReader.ReadTotalsAsync(DateOnly first, DateOnly last, DateOnly cut, CancellationToken)`. Same meaning, same order, so plans 12-25 to 12-27 can follow the plan text positionally.
- **Files modified:** `src/Csps.Application/Ports/IVisitorStatsReader.cs`, `src/Csps.Infrastructure/Analytics/VisitorStatsReader.cs`
- **Commit:** a4a7549f

**2. [Process] Task 2 RED commit also wired the handler**
- The handler takes `IValidator<VisitorStatsRequest>` and the validator is registered in the RED commit (52835748), with the validator a no-rule stub. This was needed so the tests compile and the app still resolves the handler. The rules themselves are in the GREEN commit.

### Other notes

- The commit trailer says Claude Sonnet 5.5, the model that ran this plan, following the harness attribution rule. The plan text and the dispatch note say Opus 5.5.
- The plan's "gitleaks protect --staged" is the old command name; `gitleaks git --pre-commit --staged --redact --config .gitleaks.toml --no-banner` was used before each commit. No leaks.
- Git prints CRLF warnings on the new files (the working copy has LF). `dotnet format` is clean.
- `commits: 6` counts the task commits up to `plan_head_after`. The SUMMARY commit follows it.

## Open owner questions (not decided here)

1. **The web `today` preset (open item from plan 12-04).** The web client has a `today` preset the server list does not have. The server reads `today` as last-30-days and says so in the `range` field of the answer. Options: (a) keep it as the plan says and drop `today` from the stats page, which fits D-24 and is the recommendation; (b) add `today` to `StatsRangePresets` and the server list (a one-day range, a Domain change plus tests in 12-04's files); (c) keep the web `today` and send it as `custom` with the same day for `from` and `to`, with no server change. This plan does not touch presets, so it kept option (a) as written.
2. **Unique visitors across days.** `uniqueVisitors` is a distinct count of the visitor hash over the whole span, so a person who visits on three days counts once. The daily referrer and device counts from plan 12-18 count visit rows instead. The two kinds of number are different on purpose (ANL-08), but a trend chart that sums daily "unique" figures would over-count. No decision needed now; plan 12-25 should show visits, not summed uniques, in the daily bars. Recommendation: label it that way on the page.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-12-56 (Manager policy, matrix rows for anonymous and Admin), T-12-57 (3-year floor and today ceiling validated, indexed aggregates) and T-12-58 (a test lists every property name in the answer against an allow-list, a forbidden-word list, a 32-hex scan and a time-of-day scan) are covered. T-12-SC: no package added or bumped; `npm ci` in `tools/openapi-gen` used the lock file only.

## Notes for the next plans

- The answer is extended by plans 12-25 to 12-27. The name allow-list in `TheAnswerHoldsOnlyTotalsNeverAHashAnIdOrATime` must be extended one reviewed name at a time.
- The endpoint is not rate limited (Manager read, like the Audit Log), so no change to `RateLimitTests.LimitedEndpoints` or `web/scripts/owner-review.mjs` was needed.
- Admin JS budget untouched: only `web/src/types/api.generated.ts` changed on the web side.
- `tools/openapi-gen/node_modules` was installed with `npm ci` in this worktree; it is git-ignored and goes away with the worktree.

## Self-Check: PASSED

All 11 created files and 5 modified files exist, all six task commits are ancestors of HEAD, and the acceptance greps passed (checked at commit time).
