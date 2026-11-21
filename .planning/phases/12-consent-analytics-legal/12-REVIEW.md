---
phase: 12-consent-analytics-legal
created: 2026-11-20T22:00:00-06:00
updated: 2026-11-20T22:00:00-06:00
reviewed: 2026-11-20T22:00:00-06:00
depth: standard
reviewers: 2 parallel gsd-code-reviewer agents (R2-BACKEND, R2-WEB), merged, plus 20 carried Info findings (D-81)
diff_base: 14bf277d
files_reviewed: 39
files_reviewed_list:
  - docs/web/e2e.md
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
  - web/e2e/no-cookies.spec.ts
  - web/e2e/visitor-stats.spec.ts
  - web/src/components/data/VisitorTrendChart.test.tsx
  - web/src/components/data/VisitorTrendChart.tsx
  - web/src/layouts/PublicLayout.test.tsx
  - web/src/modules/admin/hooks/useVisitorStatsToday.test.tsx
  - web/src/modules/admin/hooks/useVisitorStatsToday.ts
  - web/src/modules/admin/pages/VisitorStatsPage.test.tsx
  - web/src/modules/public/hooks/usePageViewBeacon.test.tsx
  - web/src/test/cookie-inventory.node.test.ts
  - web/src/test/legal-content.node.test.ts
status: issues_found
findings:
  critical: 0
  warning: 6
  info: 31
  total: 37
---

# Phase 12 and 12.1: Code Review, second pass (D-81)

*Created: 2026-11-20T22:00:00-06:00 · Updated: 2026-11-20T22:00:00-06:00*

## Summary

Owner ruling D-81: this pass reviews only the files changed since the last phase 12 and 12.1 reviews (mostly the D-79 fix commits) and carries forward the 20 Info findings the D-79 fix pass left open. The fixer works on every finding, Info included.

Two parallel reviewers read 39 files. Generated files (`openapi.v1.json`, `api.generated.ts`) were left out. Both reviewers found the D-79 fixes sound, with three gaps (R2W-WR-01, R2W-WR-02, R2W-WR-03).

| Source | Warning | Info |
|---|---|---|
| R2-BACKEND (new) | 3 | 7 |
| R2-WEB (new) | 3 | 4 |
| Carried from the D-79 review | 0 | 20 |
| **Total** | **6** | **31** |

Owner items the fixer must not change: G3-IN-04 (Privacy Policy wording, D-73). R2W-IN-04 asks for a five-engine run of `@no-cookies`: the fixer does the `baseURL` part only and records the run as a ship check.

The group reports are kept beside this file: `12-REVIEW-R2-BACKEND.md`, `12-REVIEW-R2-WEB.md`. The D-79 review this file replaces is in git at `77f6af7d`.

## R2-BACKEND: backend source and tests

# Phase 12 and 12.1: Backend second-pass code review (R2-BACKEND)

*Created: 2026-11-20T21:45:00-06:00 · Updated: 2026-11-20T21:45:00-06:00*

**Reviewed:** 2026-11-20
**Depth:** standard
**Files reviewed:** 27 (CLAUDE.md files, 12-CONTEXT.md and 12-REVIEW-FIX.md read as context only)
**Status:** issues_found

### Summary

I read every listed file in full and the diffs since `14bf277d`. I also read `AnalyticsRetentionJob`, `AnalyticsController`, `SeoEndpoints`, `PublicRouteTable` use, the shared `CommandCounter` and the other callers of the changed code, to check the tests against the code they claim to guard.

No critical problems. The D-79 and D-80 fixes in scope are correct and did not break anything I could find:

- **D80-WR-01 (dead domain code).** The four EF configurations lost `HasConversion<byte>()` only on properties that are now plain `byte`, so the column type is unchanged. I found no leftover caller of a removed factory or enum in `src`. No migration file changed. The remaining `Device`, `Source`, `Metric` and `Dimension` values are bytes that only tests and EF touch.
- **Rate limit order (WR-G1-01 from 12.1, re-checked).** The per-address window sits first in the global chain and the site-wide ceiling second. The new test `APageViewRefusedPerAddressDoesNotUseUpTheSiteWideCeiling` would fail under the old order: five ceiling permits would be gone after the noisy address, so the second address would get 429. It also fails if the per-address element is dropped from the chain. Good test.
- **G2-WR-01 (2048-byte cap).** The over-cap and exact-cap tests are sound. The exact-cap body is a valid JSON body whose path folds into `not-found`, so it proves the size check, not the path check.
- **G2-WR-02 (ceiling leaves other routes alone).** The four answers are now asserted before the unrelated read, so the test cannot pass when the ceiling never engages.
- **G2-WR-03 (retention batching and budget).** The new tests match the job. Each marker (`DELETE|DailyPageCounts`, `DELETE|ConsentRecords`, `DELETE|AnalyticsSalts`) only appears in the intended step's command, and the clock is moved after the first matching command, so `More` and the "next rule not run" lines are asserted for the right reason. The batch counts (3 deletes for 1200 rows) follow from `DrainAsync` (500, 500, 200).
- **Doc counts.** "Eight keys" in `PublicPageResolver` matches `PageKeys` (home, products, gallery, contact, privacy, terms, accessibility, not-found). The `VisitorStatsController` summary matches `GetVisitorStatsHandler` (62-day bucket rule, top 5, 3-year retention).

The findings below are about wrong comments, a retention constant the job ignores, and guard tests that were dropped when the factories were removed.

### Warnings

#### R2B-WR-01: Configuration comments still describe writers and roll-ups that no longer exist

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

#### R2B-WR-02: `AnalyticsRetention.SaltDays` is not used by the job, yet its new comment says it is

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

#### R2B-WR-03: The D-80 and D-56 "nothing writes these tables" guards were deleted with the factories

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

### Info

#### IN-01 (R2B-IN-01): `OldRawRowsAreRemovedByDateWithNoRollUpCursor` asserts against behavior that no longer exists

**File:** `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs:50-75`
**Issue:** The test reads a "roll-up cursor" the job never writes and fails every command on `DailyReferrerCounts` with the comment "so nothing can have been rolled up". The job has no roll-up step, so the failing interceptor only makes the later daily rule report a failed line (which this test does not look at), and the two `ReadCursorAsync()` assertions can never fail. The real "no roll-up" guard is `ARunAddsNoDeviceOrSourceTotals`. The test still proves the raw count (6) and the child-first removal, so it is not wrong, only misleading.
**Fix:** Remove the `FailCommandsOn`, `ReadCursorAsync` and the cursor comment, and rename to `OldRawRowsAreRemovedByDateAlone`. Delete `ReadCursorAsync` and `FailCommandsOn` if nothing else uses them.

#### IN-02 (R2B-IN-02): Fixed 500 ms wait before reading the log sink

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs:186` (`NoLogLineHoldsThePathTheReferrerTheUserAgentOrACookieValue`)
**Issue:** `Task.Delay(500)` is a guess. If a request log line is written after that wait (slow CI), the marker check would pass over a log that is not there yet. The `lines.ShouldNotBeEmpty()` check catches only the empty case. This is the same fixed-wait pattern the web group fixed in G4-WR-05.
**Fix:** Wait for a condition: poll `factory.Sink.Events` until it holds an event for each of the two requests (with a timeout), then check the markers.

#### IN-03 (R2B-IN-03): ShellHead and Sitemap tests pin Domain facts in two files; one test name is now stale

**File:** `tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs:924-939`, `tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs:15-17`
**Issue:** The privacy-draft, terms-approved and accessibility-approved facts are now literals in both files (`draft` flag and `DefaultSitemapLocs`). This is deliberate and the comment says so, so approving the Privacy Policy (D-73) fails two places on purpose. The test name `ALegalPageSendsItsTitleAndLeadAndItsRobotsMetaFollowsItsApprovedFact` still says "follows", but it no longer reads the fact. The title and lead assertions also repeat the draft-only test just above it.
**Fix:** Rename to `...AndItsRobotsMetaMatchesTheKnownApprovalState`, and say in the comment that the owner's Privacy Policy approval means editing both. Optionally drop the duplicate `...WhileDraft` theory.

#### IN-04 (R2B-IN-04): Two reader tests became near copies of existing ones

**File:** `tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs:138-148, 183-193`
**Issue:** Renaming `Cut` to `EarlierDay` left `TopPagesKeepPageViewsFromAnEarlierDate` and `DailyPageViewsFromAnEarlierDateAndFromThreeYearsBackAreReadLikeAnyOther`. With no raw-visit cut left in the reader, a 2025-10-15 date has no special meaning, and these tests repeat `PageViewsFromThreeYearsBackAreReadLikeAnyOther`. They are harmless but add maintenance.
**Fix:** Fold the second seed into the existing three-year tests, or keep one and delete the other.

#### IN-05 (R2B-IN-05): `KeptAnalyticsEntityTests` special-cases one property by name

**File:** `tests/Csps.Domain.UnitTests/Analytics/KeptAnalyticsEntityTests.cs:32`
**Issue:** `!property.Name.Equals("IpHash", ...)` hides a nullable `byte[]` by name. A new nullable byte array on another entity would fail the "empty" check for a reason unrelated to its value, and the string is not checked by the compiler. The tests also only exercise get and set, which exists for the 100% domain coverage gate. EF round-trips are covered by the retention tests.
**Fix:** Use `nameof(AnalyticsVisit.IpHash)`, or test nullability with `NullabilityInfoContext`. Add a one-line comment that the theory exists for the coverage gate and for the private constructors.

#### IN-06 (R2B-IN-06): The per-address limit is counted twice, and the XML summary is one very long line

**File:** `src/Csps.Server/Security/RateLimitingRegistration.cs:28-31, 134-140`
**Issue:** The page view route now has the per-address window in the global chain and again in the `analytics-collect` policy. The global one always refuses first, so the policy limiter never makes the deciding refusal. It stays useful as the fallback if the endpoint name changes (the global chain then goes quiet) and because `WriteRejectionAsync` reads the policy for its window fallback. Also, when the ceiling refuses, the per-address permit that was already taken stays used (sliding windows give nothing back), so during a site-wide flood each honest address burns its own 120 a minute. Both are acceptable, but neither is written down. The summary on `AddCspsRateLimiting` is a single line of about 900 characters.
**Fix:** Add one comment line at `CreatePageViewAddressLimiter`: "The policy on the route repeats this window as a fallback; a ceiling refusal still uses one address permit." Break the summary into short lines.

#### IN-07 (R2B-IN-07): `AnalyticsVisit.HashLength` is read only by tests

**File:** `src/Csps.Domain/Analytics/AnalyticsVisit.cs:11`
**Issue:** After D-80 removed the factory that checked hash lengths, `HashLength` has no production reader. `AnalyticsVisitConfiguration` writes the literal `binary(32)` for both hash columns. The constant can drift from the column width without any test noticing.
**Fix:** Either use it in the configuration (`HasColumnType($"binary({AnalyticsVisit.HashLength})")`, which keeps the schema the same) or leave it and note it exists for the test seed helper. If used, run `dotnet ef migrations has-pending-model-changes` to confirm no model change.

---

_Reviewed: 2026-11-20T21:45:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## R2-WEB: web source, tests and E2E

# Phase 12 and 12.1: Code Review R2-WEB

*Created: 2026-11-20T21:30:00-06:00 · Updated: 2026-11-20T21:30:00-06:00*

### Summary

The D-79 fixes are sound. The Visitor Stats today hook, the cookie inventory scan, the legal block check, the CSV based E2E counts and the no-cookies header and storage checks all do what the fix report says. No OR-3, OR-4, OR-5 or OR-6 problem was found, and there is no em or en dash in the reviewed web files.

D-79 fix check: G3-WR-01, G4-WR-01 to G4-WR-04, G5-WR-01 to G5-WR-03 are correct. G4-WR-05 is only partly done (R2W-WR-03). G3-WR-02 has the right logic but left a test gap and a layout risk (R2W-WR-01, R2W-WR-02).

### Warnings

#### R2W-WR-01: The 28px month label rule is no longer covered by any test

**File:** `web/src/components/data/VisitorTrendChart.test.tsx:240-274`
**Issue:** The "keeps every month label when a group is 28px or wider" and "thins the month labels ... when a group is under 28px" tests use `TWELVE` (Dec 2025 to Nov 2026). Since G3-WR-02, a range that crosses a year uses the 44px room (`labelStep(..., wideLabels)`), not `MIN_LABEL_GROUP` (28). So both tests now exercise the 44px rule, and their names are wrong. No remaining test exercises the 28px rule for a single-year month chart: the only single-year month test runs at the fallback width, where nothing is thinned. Setting `MIN_LABEL_GROUP` to 0 would pass the whole suite, and so would setting it to 40.
**Fix:** Add a single-year month case. For example, `months(2026, 1, 12, ...)` with `from="2026-01-01"` and `to="2026-12-31"`. Resize to 320 (22.3px a group) and expect every other label counting back from Dec. Resize to 400 (29px) and expect all 12 labels. Rename the two existing tests to say they cover a range that crosses a year (44px).

#### R2W-WR-02: Two labels that both carry a year can touch or overlap

**File:** `web/src/components/data/VisitorTrendChart.tsx:57-59, 87-106`
**Issue:** A year label ("Dec 2025") is about 46px wide at 11px with tabular digits, but `labelStep` gives it only 44px of room, the room sized for a day label like "Nov 15" (about 33px). The first drawn label always carries the year, and so does the first drawn label of a new year. When Dec is followed by Jan, or when Dec is followed by Feb because Jan is thinned out, two year labels sit `step * gw` apart. That distance is between 44 and about 50px for a 12-month range in a card roughly 580 to 650px wide, which is a normal desktop width. They then touch or overlap. The current tests only check the label text, never the spacing. The fix report already asks for a visual check on this.
**Fix:** Give year-bearing months their own room: `const MIN_YEAR_LABEL_GROUP = 56;`, and use it in `labelStep` when `wideLabels` is true and the bucket is a month. Add a test with 12 month buckets at a width where `gw` is about 46 (W about 604). Expect that no two non-null labels that both contain a year are adjacent.

#### R2W-WR-03: Three beacon tests still use a fixed 60 ms wait for a negative result

**File:** `web/src/modules/public/hooks/usePageViewBeacon.test.tsx:29-30, 137-149, 151-164, 223-232`
**Issue:** G4-WR-05 replaced the fixed `settle()` wait in the "skips /admin", "repeat click", "hidden page" and PublicLayout tests. Three tests still assert "nothing more was sent" after `await settle()` (60 ms): the StrictMode "counts one view" test, "drops a failed send quietly: one call, no retry", and "swallows a rejected send without a retry". A retry with a back-off over 60 ms, or a late second StrictMode send, would pass all three. This is the same defect class the owner accepted in G4-WR-05.
**Fix:** Use a control, as the other tests do. Render a `/contact` view with the failing probe, navigate to a second counted path, and wait for that request. Assert that the only requests are `/contact` once, then the control path. For the machine test, call `machine.view('/products')` again as the control and assert that `send` was called exactly 3 times. That count is deterministic with no timer, because a swallowed rejection is not retried.

### Info

#### R2W-IN-01: The cookie inventory does not see a cookie written as a raw header

**File:** `web/src/test/cookie-inventory.node.test.ts:23, 103-105`
**Issue:** "Every place the server sets a cookie" is checked only through `cookies.Append(`. A cookie set with `Headers.Append("Set-Cookie", ...)`, `Headers.SetCookie` or a response cookie feature would pass unseen. The check is also limited to `Csps.Server`.
**Fix:** Also scan the server C# for `Set-Cookie` and `Headers.SetCookie`, and fail on any hit outside the inventory files.

#### R2W-IN-02: The exact count tests can flake once a day when the 30 day window moves

**File:** `web/e2e/visitor-stats.spec.ts:129-143, 187-199, 225-229`
**Issue:** `pageViewsByName` reads the default "Last 30 days" range twice, before and after the visit. If Manila midnight falls between the two reads, the first day drops out of the window and a page's total can fall by that day's views. The "rose by exactly one" and "unchanged" checks then fail without any product defect. The window is small (a few seconds, once a day), but runs are serialized by the lock, so a long lock wait raises the odds a little.
**Fix:** Read the business date (`manilaDate(0)`) before and after. If they differ, repeat the whole before and after block. Or use a custom range of today only for these counts.

#### R2W-IN-03: The link check accepts a protocol-relative target

**File:** `web/src/test/legal-content.node.test.ts:33, 83`
**Issue:** `SAFE_HREF` starts with `\/`, so `//other.example` counts as safe. `internalLinkProblems` then lists it as a non-public path unless it is marked `external: true`. An `external` link written as `//host` skips both checks.
**Fix:** Use `/^(?:\/(?!\/)|mailto:|tel:|https:\/\/)/`, and add a guard test for `//host`.

#### R2W-IN-04: The `no-cookies` additions ran in one engine only, and the origin is hard coded

**File:** `web/e2e/no-cookies.spec.ts:116, 127-151`
**Issue:** G5-WR-03 (`allHeaders()` on every response, storage spread) was run in the chromium project only. Firefox, WebKit and the two phone projects have not run it. Separately, `ORIGIN = 'https://localhost:5199'` repeats the config `baseURL`, where the other specs use `baseURL ?? ...`.
**Fix:** Run `@no-cookies` in all five projects before ship. Take the origin from `baseURL` (the `baseURL` test fixture).

---

_Reviewed: 2026-11-20T21:30:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Carried Info findings from the D-79 review (D-81)

These are copied unchanged from the D-79 `12-REVIEW.md`. Line numbers may have moved since; check the code before fixing. If a finding is already fixed, record it as such.

### G1-IN-01: Beacon body cap is smaller than the longest path the validator accepts

**File:** `src/Csps.Server/Controllers/AnalyticsController.cs:32` (with `src/Csps.Application/Analytics/PageViewRequestValidator.cs:25`, `src/Csps.Domain/Analytics/AnalyticsPath.cs:10`)
**Issue:** `[RequestSizeLimitMetadata(2048)]` caps the whole JSON body at 2,048 bytes. The validator allows a path of up to 2,048 characters, and the JSON wrapper `{"path":"..."}` adds 10 bytes before any escaping. A path of about 2,039 to 2,048 characters is a valid path by the validator but is refused with a 413 before it is read. No real route is that long, and every unknown path folds into `not-found` anyway, so the effect is a mismatched limit, not a defect users will hit.
**Fix:** Give the body cap headroom for the wrapper and escaping, for example `[RequestSizeLimitMetadata(4096)]`, or lower `AnalyticsPath.MaxLength` and the validator to 1,024 so the two limits agree.

### G1-IN-02: Five rate-limit rule classes repeat the same `Default` and `Validate` code

**File:** `src/Csps.Server/Security/RateLimitSettings.cs:38-190`
**Issue:** `AnalyticsCollectRateLimit`, `AnalyticsCeilingRateLimit`, `PublicReadRateLimit`, `ImageUploadRateLimit` and `MaintenanceRateLimit` each carry a byte-for-byte identical `Validate` method (limit at least 1, window at least 6 seconds) and differ only in `SectionName` and the default numbers. `RateLimitSettings.Check` is a sixth copy of the same two rules. A future change to the rules (for example a maximum window) has to be made in six places, and the two new classes added by this phase copy the pattern again.
**Fix:** Move the check into `RateLimitRule`, for example `public IEnumerable<string> Problems(string section)`, and let each static class keep only its `SectionName` and `Default()`:
```csharp
public IEnumerable<string> Problems(string section)
{
    if (PermitLimit < 1) yield return $"{section}:PermitLimit must be at least 1.";
    if (Window < MinWindow) yield return $"{section}:Window must be at least 6 seconds.";
}
```

### G1-IN-03: Comments narrate history, against OR-2

**File:** `src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs:11-12`, `src/Csps.Server/Security/AnalyticsCookies.cs:4`
**Issue:** The retention job summary says "Nothing is rolled up any more", and the `AnalyticsCookies` summary says "The server sets no consent or visitor id cookie any more". Both describe what the code used to do. The project rule (OR-2, global writing style) is that comments say what the code does and carry no history.
**Fix:** `AnalyticsRetentionJob`: "Each rule only removes rows past its cut date; a database failure in one rule is logged and reported as that rule's failed line, and the other rules still run." `AnalyticsCookies`: "The staff marker cookie and its attributes (D-21). The two retired names are in <see cref="RetiredCookies"/> (D-63)."

### G1-IN-04: Testing controller keeps its own copy of the page key list

**File:** `src/Csps.Server/Controllers/TestingAnalyticsController.cs:38-40`
**Issue:** `KnownPages` lists the eight page keys by hand. `PageNames.Ordered` (Application) already holds the same eight keys and is what the CSV export uses, and a test guards it against the web copy. A new page key would have to be added in `PageKeys`, `PageNames`, `PublicPageResolver.KeyOf` and here, and nothing fails if this list is forgotten. Testing builds only, so low risk.
**Fix:** Build the set from the shared list: `new(PageNames.Ordered.Select(static page => page.Key), StringComparer.Ordinal)`.

### G2-IN-01: Stale "nine page keys" in a doc comment

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PublicPageResolverTests.cs:8`
**Issue:** The summary says "one of the nine page keys". `PageKeys` and `PageNames` hold eight (the fixture and `AnalyticsPathTests.PageKeysAreTheEightLowercaseNames` agree).
**Fix:** Say "eight".

### G2-IN-02: Duplicated HTTP helpers

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs:306-326` and `tests/Csps.Server.IntegrationTests/Analytics/AnalyticsHttp.cs:14-34`
**Issue:** `PageViewCollectTests.NewClient` is the same as `AnalyticsHttp.NewClient`. `PageViewCollectTests.NewPost` is a near copy with a User-Agent option. `AnalyticsRateLimitTests` uses the first copy and `RetiredCookiesTests` uses the second, so a header change has to be made in two places.
**Fix:** Add the `userAgent` parameter to `AnalyticsHttp.NewPost` and delete the copies in `PageViewCollectTests`.

### G2-IN-03: Real sleep and a sync query inside async tests

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs:181` and `tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs:67`
**Issue:** The log-privacy test waits `Task.Delay(500)` on the real clock before reading the in-memory sink, but the sink is synchronous and request completion events are written before the response ends, so the sleep adds time and hides nothing. `context.DailyPageCounts.Sum(...)` is a blocking EF call inside an async test.
**Fix:** Remove the delay. Use `await context.DailyPageCounts.SumAsync(row => row.Views, TestContext.Current.CancellationToken)`.

### G2-IN-04: Test name overstates what it checks; limits hard-coded in the factory

**File:** `tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs:23-43` and `tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs:56-57`
**Issue:** `OnlyThePageViewAndCeilingRulesRemainForAnalytics` asserts only that the one `[EnableRateLimiting]` policy is `AnalyticsCollect`. The ceiling is not an attribute and is not checked there. `RealLimitsFactory` repeats 120 and 600 as literals instead of reading `AnalyticsCollectRateLimit.Default()` and `AnalyticsCeilingRateLimit.Default()`. A default change then makes the "real limits" host differ from production without a test saying so, apart from the two pinning tests.
**Fix:** Rename the test (drop "AndCeiling"). In `RealLimitsFactory`, set the values from the `Default().PermitLimit` constants.

### G3-IN-01: Export CSV can save a different range than the one the toolbar shows

**File:** `web/src/modules/admin/pages/VisitorStatsPage.tsx:176,196`
**Issue:** `applied` starts as `wanted ?? DEFAULT_QUERY`. Opening a shared custom-range link first resolves `wanted` to null (today unknown), so `exportQuery` is the default last 30 days while the select already reads "Custom range". If the business-today lookup then fails (the `noToday` error state, no figures shown) the toolbar stays on screen and Export CSV is still enabled and saves the last 30 days. The toast names the dates, so it is not silent, but the file does not match what the select says.
**Fix:** Disable Export CSV (or pass `exportQuery` as null and have the toolbar disable the button) while `custom && wanted === null && applied` was never set from the URL, or while `noToday`.

### G3-IN-02: Footer Legal links ignore a trailing slash for `aria-current`

**File:** `web/src/modules/public/components/SiteFooter.tsx:135`
**Issue:** `pathname === link.to` fails for `/privacy/`, which the router still matches. `PublicLayout.currentSiteLink` already strips trailing slashes for the header, so the two navs disagree on the same URL and the current legal page is not marked for screen readers.
**Fix:** `const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;` and compare `path === link.to` (share one helper with `currentSiteLink`).

### G3-IN-03: Range text is built twice

**File:** `web/src/modules/admin/pages/VisitorStatsPage.tsx:49-55` and `web/src/components/data/VisitorTrendChart.tsx:91-96`
**Issue:** `rangeText` and `rangeName` both format "Oct 17 to Nov 15, 2026" with the same same-year trim regex; the second adds a `?? from` fallback the first does not. The wording lives in two copy functions (`COPY.dates` and `VISITOR_TREND_COPY.groupName`), so a future change to the format can drift.
**Fix:** Export one `formatRangeText(from, to)` from `@/utils/format` and use it in both places.

### G3-IN-04: Privacy Policy describes quote-request collection for a form that is not live

**File:** `web/src/modules/public/legalPrivacy.ts:35,64-67,130-133`
**Issue:** The policy says "When you send a quote request: the details you type into the form, and any files you attach", gives a basis for it and a 6-month retention, while `copy.ts:225` says the inquiry form returns in Phase 13 and the Contact page today only offers Messenger and phone. The page is still a draft (`approved: false`), and the wording is the owner's (D-73), so this is for the owner's review, not a code defect.
**Fix:** Owner to decide: keep it as forward-looking text, or mark the quote-request lines to be added when the form ships.

**Owner item (D-73):** Privacy Policy wording is the owner's. Fixer: do not change it; record it as skipped, waiting on the owner.

### G3-IN-05: MapCard header comment still opens with the pre-D-65 rule

**File:** `web/src/modules/public/components/MapCard.tsx:1-5`
**Issue:** Lines 2-3 say the Google frame loads only after the tap and "no Google request is made before the tap", then line 6 says a saved tap loads it on later visits. The first paragraph is now false for returning visitors and could mislead the next reader.
**Fix:** Reword lines 2-3, for example: "Until the visitor taps Show Map once (saved in this browser, D-65) the drawing stays; only then does the Google frame load."

### G4-IN-01: Hard-coded "Version 1.0" in a test whose header says the facts come from the fixture

**File:** `web/src/modules/public/pages/LegalPages.test.tsx:85` (header at lines 1-4)

**Issue:** `expect(version).toHaveTextContent(/^Version 1\.0 · /)` pins the version, while the file header says the owner's later yes (D-73) changes the fixture only, not these tests. When the owner approves and the fixture moves to `1.1` or `2.0`, this one line fails for no reason. The line above already checks the full version line against the fixture.

**Fix:** Delete the line, or build it from the fixture: `new RegExp(`^Version ${shared('privacy').version.replace('.', '\\.')} · `)`.

### G4-IN-02: Stubbed `URL.createObjectURL` and `revokeObjectURL` are never removed

**File:** `web/src/modules/admin/pages/VisitorStatsPage.test.tsx:888-900`; `web/src/modules/admin/downloadCsv.test.ts:17-29`

**Issue:** Both files install the two functions with `Object.defineProperty(URL, ..., { configurable: true })`. `restoreMocks` and `vi.restoreAllMocks()` undo only `vi.spyOn`, so the stubs (jsdom has none) remain for the rest of the file, with the closure of the last test. Harmless today because files are isolated and each user redefines them, but a later test in the file that expects the real absence would be fooled.

**Fix:** Delete them in `afterEach`: `Reflect.deleteProperty(URL, 'createObjectURL'); Reflect.deleteProperty(URL, 'revokeObjectURL');`. A shared helper in `src/test/` would remove the duplicate too.

### G4-IN-03: Only the Accessibility module is asserted to exist in the legal text scan

**File:** `web/src/test/legal-content.node.test.ts:15-18, 156-158`

**Issue:** `textFiles` is built from `readdirSync` plus a name pattern. The guard `finds the Accessibility text module` is the only check that discovery works. If `legalTerms.ts` were renamed so it no longer matches `/^legal.*\.ts$/`, the shape, dash and link checks would skip the Terms text with no failure (the Privacy text is also imported directly by `cookie-inventory.node.test.ts`, Terms is not).

**Fix:** `expect(textFiles).toEqual(expect.arrayContaining(['legalAccessibility.ts', 'legalPrivacy.ts', 'legalTerms.ts']))`.

### G4-IN-04: `.catch(() => null)` on `findBy` calls hides the real failure message

**File:** `web/src/modules/admin/pages/VisitorStatsPage.test.tsx:959, 981, 1005`

**Issue:** The "exported", "Exporting" and "failure toast" tests wrap `findBy*` in `.catch(() => null)` and then assert on `title?.textContent` or `busy?.getAttribute(...)`. They still fail when the element is missing (undefined is not the expected value), so they are not vacuous, but the failure reads "expected undefined to be ..." instead of the DOM dump and timeout message that `findBy*` gives.

**Fix:** Drop the `.catch` and assert on the returned element: `expect(await screen.findByText('Visitor stats exported', {}, { timeout: 3000 })).toBeInTheDocument();`.

### G5-IN-01: `docs/web/e2e.md` describes the old first `@visitor-stats` check

**File:** `docs/web/e2e.md:130`
**Issue:** The row says the Manager sees "each of those page counts in `Most viewed pages` rise by at least one". Since fix `85bef3af` the test reads the Page views KPI total (`kpiCount(manager, 'Page views')`), and the header of the spec itself says the top 5 list is the wrong place to look. The doc is not accurate against the code.
**Fix:** Change the sentence to "the Manager sees the Page views total rise by at least the three views sent".

### G5-IN-02: Stale consent wording in project docs

**File:** `.claude/CLAUDE.md:9`, `CSPS-PRD.md:495`, `CSPS-PRD.md:525`
**Issue:** The `.claude/CLAUDE.md` project summary still lists "cookie consent" as a public site feature (its `Updated` stamp was moved to 2026-11-19 in this phase, so the line was touched but not fixed). PRD line 495 ("except auth flows and consent") and line 525 ("rate limiting on auth, consent, analytics ingestion") name a consent endpoint that no longer exists after 12.1. Related: `web/src/modules/public/hooks/usePrivacyContact.ts:1` and the generated API comments say "the four legal pages" (now three). They are outside this group's file list, so only noted here.
**Fix:** `.claude/CLAUDE.md:9`: "home, products, gallery, contact/quote, legal pages (no cookie banner)". PRD 495: drop "and consent". PRD 525: "on auth, analytics ingestion, and public endpoints". Fix "four" to "three" in the `usePrivacyContact.ts` comment and in the C# XML doc that generates `api.generated.ts`.

### G5-IN-03: Small consistency items in the specs

**File:** `web/e2e/contact.spec.ts:43`, `web/e2e/link-preview.spec.ts:30`
**Issue:**
- `CLEAR_SAVED_MAP` hard-codes `'csps-maps'`, which is also `MAPS_KEY` in `web/src/modules/public/mapChoice.ts:6`. If the key is renamed, the "clearing the saved map" test still passes: the removal does nothing, and the check then fails only if the button does not come back.
- `link-preview.spec.ts` is the only e2e file using `import.meta.dirname`; the others use `new URL(..., import.meta.url)`.

**Fix:** Keep the literal but add an assert before the clear that the key exists (`expect(await page.evaluate("window.localStorage.getItem('csps-maps')")).not.toBeNull()`), so a rename fails loudly. Use `fileURLToPath(new URL('../../tests/fixtures/legal-pages.json', import.meta.url))` for consistency.
