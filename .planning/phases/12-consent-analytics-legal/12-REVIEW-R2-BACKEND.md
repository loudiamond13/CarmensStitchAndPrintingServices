---
phase: 12-consent-analytics-legal
group: R2-BACKEND
created: 2026-11-20T21:45:00-06:00
updated: 2026-11-20T21:45:00-06:00
reviewed: 2026-11-20T21:45:00-06:00
depth: standard
diff_base: 14bf277d (12.1 files) / 77f6af7d (phase 12 last review)
files_reviewed: 27
files_reviewed_list:
  - src/Csps.Domain/Analytics/AnalyticsPageView.cs
  - src/Csps.Domain/Analytics/AnalyticsRetention.cs
  - src/Csps.Domain/Analytics/AnalyticsSalt.cs
  - src/Csps.Domain/Analytics/AnalyticsVisit.cs
  - src/Csps.Domain/Analytics/AnalyticsVitalSample.cs
  - src/Csps.Domain/Analytics/ConsentRecord.cs
  - src/Csps.Domain/Analytics/DailyDeviceCount.cs
  - src/Csps.Domain/Analytics/DailyReferrerCount.cs
  - src/Csps.Domain/Analytics/ReferrerName.cs
  - src/Csps.Infrastructure/Persistence/Configurations/AnalyticsVisitConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/AnalyticsVitalSampleConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/ConsentRecordConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/DailyDeviceCountConfiguration.cs
  - src/Csps.Server/Controllers/VisitorStatsController.cs
  - src/Csps.Server/Endpoints/PublicPageResolver.cs
  - src/Csps.Server/Security/RateLimitingRegistration.cs
  - tests/Csps.Application.UnitTests/Analytics/AnalyticsSurfaceTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/KeptAnalyticsEntityTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/ReferrerNameTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsExportTests.cs
  - tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs
  - tests/Csps.Testing/LegacyAnalyticsRows.cs
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 12 and 12.1: Backend second-pass code review (R2-BACKEND)

*Created: 2026-11-20T21:45:00-06:00 · Updated: 2026-11-20T21:45:00-06:00*

**Reviewed:** 2026-11-20
**Depth:** standard
**Files reviewed:** 27 (CLAUDE.md files, 12-CONTEXT.md and 12-REVIEW-FIX.md read as context only)
**Status:** issues_found

## Summary

I read every listed file in full and the diffs since `14bf277d`. I also read `AnalyticsRetentionJob`, `AnalyticsController`, `SeoEndpoints`, `PublicRouteTable` use, the shared `CommandCounter` and the other callers of the changed code, to check the tests against the code they claim to guard.

No critical problems. The D-79 and D-80 fixes in scope are correct and did not break anything I could find:

- **D80-WR-01 (dead domain code).** The four EF configurations lost `HasConversion<byte>()` only on properties that are now plain `byte`, so the column type is unchanged. I found no leftover caller of a removed factory or enum in `src`. No migration file changed. The remaining `Device`, `Source`, `Metric` and `Dimension` values are bytes that only tests and EF touch.
- **Rate limit order (WR-G1-01 from 12.1, re-checked).** The per-address window sits first in the global chain and the site-wide ceiling second. The new test `APageViewRefusedPerAddressDoesNotUseUpTheSiteWideCeiling` would fail under the old order: five ceiling permits would be gone after the noisy address, so the second address would get 429. It also fails if the per-address element is dropped from the chain. Good test.
- **G2-WR-01 (2048-byte cap).** The over-cap and exact-cap tests are sound. The exact-cap body is a valid JSON body whose path folds into `not-found`, so it proves the size check, not the path check.
- **G2-WR-02 (ceiling leaves other routes alone).** The four answers are now asserted before the unrelated read, so the test cannot pass when the ceiling never engages.
- **G2-WR-03 (retention batching and budget).** The new tests match the job. Each marker (`DELETE|DailyPageCounts`, `DELETE|ConsentRecords`, `DELETE|AnalyticsSalts`) only appears in the intended step's command, and the clock is moved after the first matching command, so `More` and the "next rule not run" lines are asserted for the right reason. The batch counts (3 deletes for 1200 rows) follow from `DrainAsync` (500, 500, 200).
- **Doc counts.** "Eight keys" in `PublicPageResolver` matches `PageKeys` (home, products, gallery, contact, privacy, terms, accessibility, not-found). The `VisitorStatsController` summary matches `GetVisitorStatsHandler` (62-day bucket rule, top 5, 3-year retention).

The findings below are about wrong comments, a retention constant the job ignores, and guard tests that were dropped when the factories were removed.

## Warnings

### R2B-WR-01: Configuration comments still describe writers and roll-ups that no longer exist

**File:** `src/Csps.Infrastructure/Persistence/Configurations/DailyDeviceCountConfiguration.cs:8-9` (also `AnalyticsVisitConfiguration.cs:7-11`, `AnalyticsVitalSampleConfiguration.cs:7-10`, `ConsentRecordConfiguration.cs:7-9`)
**Issue:** The D-80 pass rewrote the entity comments to say "nothing writes this table any more", but the four configuration comments were left alone. `DailyDeviceCountConfiguration` says "The retention job replaces a day's rows when it rolls the day up, so there is no row version". That is false: `AnalyticsRetentionJob` rolls nothing up and only deletes by date (confirmed in the job and by `ARunAddsNoDeviceOrSourceTotals`). `AnalyticsVisitConfiguration` says "counters change through ExecuteUpdate" and "the second [index] serves the day roll-ups". `AnalyticsVitalSampleConfiguration` says "the index serves the percentile reads by day and metric". Nothing reads any of these tables for stats. In a privacy-sensitive area, a comment that says visitor data is being rolled up and read can send the next person to rebuild code the owner removed (D-56, D-80).
**Fix:** Say what is true, in one line each. For example, for `DailyDeviceCountConfiguration`:
```csharp
/// <summary>
/// Maps the DailyDeviceCounts table (ANL-09): one row per business day, dimension (device or browser) and label. Nothing writes it any
/// more (D-80); the retention job only deletes old rows. No row version, no JSON column, no trigger (OR-7), no column that could identify a visitor.
/// </summary>
```
Do the same for the visit, vital sample and consent record configurations, and say the indexes are kept because the schema stays (D-80), not because a reader uses them.

### R2B-WR-02: `AnalyticsRetention.SaltDays` is not used by the job, yet its new comment says it is

**File:** `src/Csps.Domain/Analytics/AnalyticsRetention.cs:15-16` and `src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs:159`
**Issue:** This pass changed the `SaltDays` comment to "The cleanup job keeps today's and yesterday's salt, which is this value." The job does not read `SaltDays`. It hard-codes `today.AddDays(-1)` and deletes salts older than that. `SaltDays` is only read by `AnalyticsRetentionTests` (`SaltDays.ShouldBe(2)`). Changing the constant would change nothing, and the retention promise "salts live two days" (D-07, which stops an old address hash from being recomputed) is then held by a magic number in the job, not by the domain constant. The comment now claims a link that is not there.
**Fix:** Make the job use the constant, so the comment is true and one edit moves both:
```csharp
// AnalyticsRetention
public static DateOnly SaltCut(DateOnly today) => today.AddDays(-(SaltDays - 1));

// AnalyticsRetentionJob.PurgeSaltsAsync
var before = AnalyticsRetention.SaltCut(today);
... .Where(salt => salt.BusinessDay < before)
```
Add a domain test for `SaltCut` (the job test `AddressSaltsForTodayAndYesterdayStayAndOlderOnesGo` already covers behavior). If the owner prefers to leave the job alone, drop the sentence from the comment.

### R2B-WR-03: The D-80 and D-56 "nothing writes these tables" guards were deleted with the factories

**File:** `tests/Csps.Domain.UnitTests/Analytics/ReferrerNameTests.cs:5-12`, `tests/Csps.Domain.UnitTests/Analytics/KeptAnalyticsEntityTests.cs:13-42`
**Issue:** Before this pass, `ReferrerNameTests.HasNoFromHelperBecauseNothingGroupsAReferrerAnyMore` failed if anyone brought back a referrer grouping helper (D-56). It was deleted with the constants and nothing replaced it. The new `KeptAnalyticsEntityTests` only checks defaults and that every property reads back what was set. Nothing fails if someone adds a public constructor or a static factory (`Start`, `Of`, `Create`) back to one of the seven entities, which is exactly the dead code D-80 removed. `AnalyticsSurfaceTests` guards the Application handlers and the removed enum names, but not the entity factories. The rule "tests must fail if the code is wrong" is not met for the D-80 ruling itself.
**Fix:** Add two checks to `KeptAnalyticsEntityTests`, and put the `From` guard back:
```csharp
[Theory]
[MemberData(nameof(Entities))]
public void NothingCanMakeARowInCode(Type entity)
{
    entity.GetConstructors(BindingFlags.Public | BindingFlags.Instance).ShouldBeEmpty();
    entity.GetMethods(BindingFlags.Public | BindingFlags.Static).Where(m => m.ReturnType == entity).ShouldBeEmpty();
}

// ReferrerNameTests
[Fact]
public void HoldsOnlyTheColumnLength() =>
    typeof(ReferrerName).GetMembers(BindingFlags.Public | BindingFlags.Static | BindingFlags.DeclaredOnly)
        .Select(m => m.Name).ShouldBe(["MaxLength"]);
```

## Info

### IN-01 (R2B-IN-01): `OldRawRowsAreRemovedByDateWithNoRollUpCursor` asserts against behavior that no longer exists

**File:** `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs:50-75`
**Issue:** The test reads a "roll-up cursor" the job never writes and fails every command on `DailyReferrerCounts` with the comment "so nothing can have been rolled up". The job has no roll-up step, so the failing interceptor only makes the later daily rule report a failed line (which this test does not look at), and the two `ReadCursorAsync()` assertions can never fail. The real "no roll-up" guard is `ARunAddsNoDeviceOrSourceTotals`. The test still proves the raw count (6) and the child-first removal, so it is not wrong, only misleading.
**Fix:** Remove the `FailCommandsOn`, `ReadCursorAsync` and the cursor comment, and rename to `OldRawRowsAreRemovedByDateAlone`. Delete `ReadCursorAsync` and `FailCommandsOn` if nothing else uses them.

### IN-02 (R2B-IN-02): Fixed 500 ms wait before reading the log sink

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs:186` (`NoLogLineHoldsThePathTheReferrerTheUserAgentOrACookieValue`)
**Issue:** `Task.Delay(500)` is a guess. If a request log line is written after that wait (slow CI), the marker check would pass over a log that is not there yet. The `lines.ShouldNotBeEmpty()` check catches only the empty case. This is the same fixed-wait pattern the web group fixed in G4-WR-05.
**Fix:** Wait for a condition: poll `factory.Sink.Events` until it holds an event for each of the two requests (with a timeout), then check the markers.

### IN-03 (R2B-IN-03): ShellHead and Sitemap tests pin Domain facts in two files; one test name is now stale

**File:** `tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs:924-939`, `tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs:15-17`
**Issue:** The privacy-draft, terms-approved and accessibility-approved facts are now literals in both files (`draft` flag and `DefaultSitemapLocs`). This is deliberate and the comment says so, so approving the Privacy Policy (D-73) fails two places on purpose. The test name `ALegalPageSendsItsTitleAndLeadAndItsRobotsMetaFollowsItsApprovedFact` still says "follows", but it no longer reads the fact. The title and lead assertions also repeat the draft-only test just above it.
**Fix:** Rename to `...AndItsRobotsMetaMatchesTheKnownApprovalState`, and say in the comment that the owner's Privacy Policy approval means editing both. Optionally drop the duplicate `...WhileDraft` theory.

### IN-04 (R2B-IN-04): Two reader tests became near copies of existing ones

**File:** `tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs:138-148, 183-193`
**Issue:** Renaming `Cut` to `EarlierDay` left `TopPagesKeepPageViewsFromAnEarlierDate` and `DailyPageViewsFromAnEarlierDateAndFromThreeYearsBackAreReadLikeAnyOther`. With no raw-visit cut left in the reader, a 2025-10-15 date has no special meaning, and these tests repeat `PageViewsFromThreeYearsBackAreReadLikeAnyOther`. They are harmless but add maintenance.
**Fix:** Fold the second seed into the existing three-year tests, or keep one and delete the other.

### IN-05 (R2B-IN-05): `KeptAnalyticsEntityTests` special-cases one property by name

**File:** `tests/Csps.Domain.UnitTests/Analytics/KeptAnalyticsEntityTests.cs:32`
**Issue:** `!property.Name.Equals("IpHash", ...)` hides a nullable `byte[]` by name. A new nullable byte array on another entity would fail the "empty" check for a reason unrelated to its value, and the string is not checked by the compiler. The tests also only exercise get and set, which exists for the 100% domain coverage gate. EF round-trips are covered by the retention tests.
**Fix:** Use `nameof(AnalyticsVisit.IpHash)`, or test nullability with `NullabilityInfoContext`. Add a one-line comment that the theory exists for the coverage gate and for the private constructors.

### IN-06 (R2B-IN-06): The per-address limit is counted twice, and the XML summary is one very long line

**File:** `src/Csps.Server/Security/RateLimitingRegistration.cs:28-31, 134-140`
**Issue:** The page view route now has the per-address window in the global chain and again in the `analytics-collect` policy. The global one always refuses first, so the policy limiter never makes the deciding refusal. It stays useful as the fallback if the endpoint name changes (the global chain then goes quiet) and because `WriteRejectionAsync` reads the policy for its window fallback. Also, when the ceiling refuses, the per-address permit that was already taken stays used (sliding windows give nothing back), so during a site-wide flood each honest address burns its own 120 a minute. Both are acceptable, but neither is written down. The summary on `AddCspsRateLimiting` is a single line of about 900 characters.
**Fix:** Add one comment line at `CreatePageViewAddressLimiter`: "The policy on the route repeats this window as a fallback; a ceiling refusal still uses one address permit." Break the summary into short lines.

### IN-07 (R2B-IN-07): `AnalyticsVisit.HashLength` is read only by tests

**File:** `src/Csps.Domain/Analytics/AnalyticsVisit.cs:11`
**Issue:** After D-80 removed the factory that checked hash lengths, `HashLength` has no production reader. `AnalyticsVisitConfiguration` writes the literal `binary(32)` for both hash columns. The constant can drift from the column width without any test noticing.
**Fix:** Either use it in the configuration (`HasColumnType($"binary({AnalyticsVisit.HashLength})")`, which keeps the schema the same) or leave it and note it exists for the test seed helper. If used, run `dotnet ef migrations has-pending-model-changes` to confirm no model change.

---

_Reviewed: 2026-11-20T21:45:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
