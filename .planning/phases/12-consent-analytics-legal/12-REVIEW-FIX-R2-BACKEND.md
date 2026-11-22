---
phase: 12-consent-analytics-legal
created: 2026-11-20T20:05:00-06:00
updated: 2026-11-20T20:05:00-06:00
fixed_at: 2026-11-20T20:05:00-06:00
review_path: .planning/phases/12-consent-analytics-legal/12-REVIEW.md
iteration: 1
findings_in_scope: 19
fixed: 19
skipped: 0
status: all_fixed
---

# Phase 12 and 12.1: Code Review Fix Report, backend slice (R2-BACKEND)

*Created: 2026-11-20T20:05:00-06:00 · Updated: 2026-11-20T20:05:00-06:00*

**Source review:** `.planning/phases/12-consent-analytics-legal/12-REVIEW.md`
**Iteration:** 1
**Scope:** R2B-WR-01 to R2B-WR-03, R2B-IN-01 to R2B-IN-07, carried G1-IN-01 to G1-IN-04, G2-IN-01 to G2-IN-04, and the backend and docs part of G5-IN-02. Nothing under `web/` was edited by hand. The only `web/` file touched is the generated `web/src/types/api.generated.ts`, which the generator rewrote.

**Summary:**
- Findings in scope: 19 (G5-IN-02 counted once)
- Fixed: 19
- Skipped: 0 (one small part of G5-IN-02 is left for the web fixer by design, listed below)

All work ran in an isolated worktree. The commits were fast-forwarded onto `gsd/phase-12-consent-analytics-legal` and the worktree, temp branch and recovery sentinel were removed. The checks below ran in that worktree (not the main checkout), against LocalDB `(localdb)\MSSQLLocalDB` with `CSPS_TEST_SQL=localdb` set for each command only. The preflight showed all ports free and no other project's processes each time.

## Verification

- `dotnet build --no-incremental` for `Csps.slnx`: 0 Warning(s), 0 Error(s).
- `Csps.Domain.UnitTests`: 2018 passed, 0 failed.
- `Csps.Application.UnitTests`: 3161 passed, 0 failed.
- `Csps.ArchitectureTests`: 290 passed, 0 failed.
- `Csps.Infrastructure.IntegrationTests` (Analytics namespace): 45 passed, 0 failed.
- `Csps.Server.IntegrationTests` by namespace: Analytics 82, RateLimiting 86, Http 389, Testing 92, Maintenance 33, all passed, 0 failed. Also `OpenApiSnapshotTests` 11 passed after the snapshot refresh.
- `dotnet ef migrations has-pending-model-changes`: "No changes have been made to the model since the last migration."
- `tools/openapi-gen/check.mjs` against the new snapshot and types: "Generated API types match".
- `gitleaks protect --staged` ran before every commit: no leaks.
- The full Server integration suite and the Infrastructure tests outside the Analytics namespace were not run.

## Fixed Issues

### R2B-WR-01: Configuration comments still describe writers and roll-ups that no longer exist
**Files modified:** the four `Persistence/Configurations` files for `AnalyticsVisit`, `AnalyticsVitalSample`, `ConsentRecord`, `DailyDeviceCount`
**Commit:** 9bcdea69
**Applied fix:** Each summary now says nothing writes (or reads) the table, the retention job only deletes, and the indexes stay because the schema stays (D-80). Comments only.

### R2B-WR-02: `AnalyticsRetention.SaltDays` is not used by the job
**Files modified:** `src/Csps.Domain/Analytics/AnalyticsRetention.cs`, `src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs`, `tests/Csps.Domain.UnitTests/Analytics/AnalyticsRetentionTests.cs`
**Commit:** 74328640
**Applied fix:** Test first (`SaltCut` did not exist, build failed). Added `AnalyticsRetention.SaltCut(today)` and the job now uses it. Behavior is unchanged: salts for today and yesterday stay. The retention job tests still pass (24).
**Status:** fixed: requires human verification (it is a retention rule, though behavior did not change and the existing job test covers it).

### R2B-WR-03: The D-80 and D-56 guards were deleted with the factories
**Files modified:** `tests/Csps.Domain.UnitTests/Analytics/KeptAnalyticsEntityTests.cs`, `tests/Csps.Domain.UnitTests/Analytics/ReferrerNameTests.cs`
**Commit:** 55d64e72
**Applied fix:** Added `NothingCanMakeARowInCode` (no public constructor, no static factory returning the entity, for all seven entities) and `HoldsOnlyTheColumnLength` for `ReferrerName`.

### R2B-IN-01: Raw removal test asserts a roll-up cursor that no longer exists
**Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs`
**Commit:** 761a96cf
**Applied fix:** Renamed to `OldRawRowsAreRemovedByDateAlone`, removed the cursor reads, and deleted the now unused `ReadCursorAsync` and `FailCommandsOn`.

### R2B-IN-02: Fixed 500 ms wait before reading the log sink
**Files modified:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs`
**Commit:** 7584206d
**Applied fix:** The test now polls (20 ms steps, 10 s limit) until the host has logged one "responded" line for each of the two requests, then checks the markers. This also covers the sleep part of G2-IN-03. G2-IN-03 said to remove the delay outright; I polled instead, because the test server can return before the completion line is written.

### R2B-IN-03: ShellHead test name and comment
**Files modified:** `tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs`
**Commit:** c512202c
**Applied fix:** Renamed to `...RobotsMetaMatchesTheKnownApprovalState` and added a comment that approving the Privacy Policy (D-73) means editing both this file and `SeoEndpointTests`. I kept the draft-only theory: it uses a stub, so it is not an exact duplicate.

### R2B-IN-04: Two reader tests became near copies
**Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs`
**Commit:** efcf487e
**Applied fix:** The two "earlier date" tests now read from three years back (`TopPagesFromThreeYearsBackAreReadLikeAnyOther`, `DailyPageViewsFromThreeYearsBackAreReadLikeAnyOther`). The `EarlierDay` constant is gone. No coverage was lost, because those two reads had no three-year test before.

### R2B-IN-05: `KeptAnalyticsEntityTests` special-cases one property by name
**Files modified:** `tests/Csps.Domain.UnitTests/Analytics/KeptAnalyticsEntityTests.cs`
**Commit:** 7c66a66a
**Applied fix:** `nameof(AnalyticsVisit.IpHash)` replaces the string, and a comment says the property tests exist for the private constructors and the coverage gate.

### R2B-IN-06: Per-address limit counted twice; long summary
**Files modified:** `src/Csps.Server/Security/RateLimitingRegistration.cs`
**Commit:** 08821893
**Applied fix:** One comment line at `CreatePageViewAddressLimiter` and the single-line summary split into short lines.

### R2B-IN-07: `AnalyticsVisit.HashLength` is read only by tests
**Files modified:** `src/Csps.Infrastructure/Persistence/Configurations/AnalyticsVisitConfiguration.cs`
**Commit:** 2611ea59
**Applied fix:** Both hash columns now use `binary({AnalyticsVisit.HashLength})`. The column type is the same (`binary(32)`); `has-pending-model-changes` reports no change and no migration was added.

### G1-IN-01: Beacon body cap smaller than the longest valid path
**Files modified:** `src/Csps.Server/Controllers/AnalyticsController.cs`, `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs`
**Commit:** fdb2deb5
**Applied fix:** Test first: a body with a 2,048-character path failed with 413. The cap is now 4096 bytes (the review's first option). The exact-cap test now pads a valid gallery body with spaces to exactly 4096 bytes, since a path of that size is correctly refused by the validator. Bodies from 2,049 to 4,096 bytes are now read instead of refused with 413. This is a small limit change that came straight from the finding.
**Status:** fixed: requires human verification (a limit value).

### G1-IN-02: Five rate-limit rule classes repeat `Validate`
**Files modified:** `src/Csps.Server/Security/RateLimitSettings.cs`, `src/Csps.Server/Security/RateLimitingRegistration.cs`, `tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceKeySafetyTests.cs`, `tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs`
**Commit:** dd3589fa
**Applied fix:** One `RateLimitRule.Problems(rule, section)` holds the two rules (also used by the auth settings check). The five copies of `Validate` are gone, and the host and the tests call `Problems`. The error messages are word for word the same, and the 86 rate-limit tests pass.

### G1-IN-03: Comments narrate history
**Files modified:** `src/Csps.Server/Security/AnalyticsCookies.cs`, `src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs`
**Commit:** ae24d9e8
**Applied fix:** Both summaries now say what the code does, using the wording the review suggested.

### G1-IN-04: Testing controller keeps its own page key list
**Files modified:** `src/Csps.Server/Controllers/TestingAnalyticsController.cs`
**Commit:** 6ebc0229
**Applied fix:** `KnownPages` is built from `PageNames.Ordered`.

### G2-IN-01: Stale "nine page keys"
**Files modified:** `tests/Csps.Server.IntegrationTests/Analytics/PublicPageResolverTests.cs`
**Commit:** 15ca5d7c
**Applied fix:** "eight".

### G2-IN-02: Duplicated HTTP helpers
**Files modified:** `tests/Csps.Server.IntegrationTests/Analytics/AnalyticsHttp.cs`, `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs`
**Commit:** 13e14b5c
**Applied fix:** `AnalyticsHttp.NewPost` takes a `userAgent`. `PageViewCollectTests.NewClient` is deleted. Its `NewPost` is now a one-line wrapper that fills in the route and the desktop User-Agent, because `AnalyticsRateLimitTests` and about 20 calls still use that default.

### G2-IN-03: Real sleep and a sync query inside async tests
**Files modified:** `tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs` (the sum), `PageViewCollectTests.cs` (the sleep, in the R2B-IN-02 commit)
**Commit:** 5303073a (the sum), 7584206d (the sleep)
**Applied fix:** `SumAsync` with the cancellation token; the sleep is replaced by the wait in R2B-IN-02.

### G2-IN-04: Test name overstates what it checks; limits hard-coded in the factory
**Files modified:** `tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs`, `tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs`
**Commit:** 46c11fba
**Applied fix:** Renamed to `OnlyThePageViewRuleRemainsForAnalytics`. `RealLimitsFactory` reads the analytics limits from `AnalyticsCollectRateLimit.Default()` and `AnalyticsCeilingRateLimit.Default()`. The old test name still appears in the executed plan `12.1-12-PLAN.md` (a `contains:` line). I left that historical plan alone.

### G5-IN-02 (backend and docs part): Stale consent and "four legal pages" wording
**Files modified:** `src/Csps.Application/Content/PrivacyContactDto.cs`, `src/Csps.Server/Controllers/PublicSiteController.cs`, `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts`, `.claude/CLAUDE.md`, `CSPS-PRD.md`
**Commits:** 25b6c6ba (XML docs plus regenerated contract files), c58b8338 (docs)
**Applied fix:** The two XML docs say "three legal pages". The snapshot was refreshed with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for that one command (in-process test host, no server needed), then the types were regenerated with the pinned `openapi-typescript` 7.13.0 CLI. Both diffs are two lines each. `.claude/CLAUDE.md` line 9 now reads "legal pages (no cookie banner)". PRD line 495 drops "and consent". PRD line 525 now reads "on auth, analytics ingestion, and public endpoints" (the review's suggested "public endpoints" wording was already how the line ended). Both docs got a new `Updated` stamp. `.planning/PROJECT.md` already says "no cookie banner", so nothing to change there.

## Left for the web fixer

### G5-IN-02 (one part): `usePrivacyContact.ts` comment
**File:** `web/src/modules/public/hooks/usePrivacyContact.ts:1`
**Reason:** Left to the web fixer, as instructed. It still says "the four legal pages" and should say "three".
**Original issue:** Stale "four" in a web comment.

## Notes for the owner and the next fixer

- G5-IN-01 (`docs/web/e2e.md` line 130) was not in my slice, but I looked: the `@visitor-stats` row already says the Manager sees each page count rise by exactly one, read from the CSV export. It looks already fixed.
- The PRD line 495 now reads "no unauthenticated mutating endpoints except auth flows". The page view beacon is an unauthenticated write that the line does not name. I followed the finding and did not add it. Say so if you want it named.
- No findings are waiting on the owner in this slice.

---

_Fixed: 2026-11-20T20:05:00-06:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
