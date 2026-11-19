---
phase: 12-consent-analytics-legal
scope: phase 12 and 12.1, full branch diff against main (base 1717d7e2)
created: 2026-11-19T10:00:19-06:00
updated: 2026-11-19T10:00:19-06:00
reviewed: 2026-11-19T10:00:19-06:00
depth: standard
groups: 6
files_reviewed: 255
status: issues_found
findings:
  critical: 0
  warning: 19
  info: 32
  total: 51
---

# Phase 12 and 12.1: full code review

*Created: 2026-11-19T10:00:19-06:00 · Updated: 2026-11-19T10:00:19-06:00*

Six parallel reviewers covered every code file that phases 12 and 12.1 changed on branch `gsd/phase-12-consent-analytics-legal`. Generated files (EF Designer and snapshot files, `api.generated.ts`, the OpenAPI snapshot) and docs were left out. Items already settled in `12.1-REVIEW-DISPOSITION.md` were not raised again. The phase 12 disposition file has no rows.

The earlier `12-REVIEW.md` and `12.1-REVIEW*.md` files are unchanged. Every finding here still needs a recorded outcome (fixed, deferred with a reason, or accepted by the owner).

## Summary

| Group | Scope | Files | Critical | Warning | Info |
|---|---|---|---|---|---|
| G1 | Domain and Application | 38 | 0 | 2 | 3 |
| G2 | Infrastructure and Server | 42 | 0 | 0 | 5 |
| G3 | Backend tests and fixtures | 53 | 0 | 5 | 8 |
| G4 | Web source | 52 | 0 | 4 | 6 |
| G5 | Web unit tests | 48 | 0 | 4 | 6 |
| G6 | E2E, scripts, config, dev previews | 22 | 0 | 4 | 4 |
| **Total** | | **255** | **0** | **19** | **32** |

Spot-checked against source by the orchestrator: G4-WR-01 and G6-WR-01 (both confirmed).

### Owner decisions raised

- **IN-G2-01 / G1-WR-01 / G3-IN-08:** seven tables from the removed design (consent, visits, page views, vitals, salts, referrer and device counts) have no writer left. Their entities, domain types and tests remain by D-56, D-61 and D-64. Options: keep as is; remove the dead factories and enums but keep the tables; or, since all four migrations are new on this branch and not on main, squash them into one DailyPageCounts-only migration (only safe if no shared database has applied them).
- **G1-IN-02:** the Contact email is now public through the privacy-contact endpoint, but site-settings comments still say "for staff only" (D-73 wording).
- **G4-IN-05:** the DPO line repeats its own label (owner copy).


---

## G1 report

**Reviewed:** 2026-11-19
**Depth:** standard
**Files Reviewed:** 38
**Status:** issues_found

### Summary

The live path is sound. I traced the page view write and the stats and export reads end to end and found no correctness, privacy or security defect in them.

What I checked and found correct:

- **Day bucket.** `CollectPageViewHandler` takes the day from `IBusinessCalendar.GetClockAsync().Today` (TimeProvider plus the stored zone). It never uses `DateTime.Now`.
- **Privacy.** The only values reaching the store are `(BusinessDay, PageKey)`. The User-Agent and the staff flag are read for gating only, and nothing in this group stores or logs them. The path is cut at `?` and `#`, and the page key comes from the resolver, not from the visitor's string.
- **Validator and handler agree.** The custom range is checked only when `Range == "custom"`, and `Resolve` uses the same exact-match test and the same `TryParseDay` (strict `yyyy-MM-dd`). The window floor is `AddYears(-3)`, the same cut the retention job deletes below (`row.BusinessDay < floor`), so no valid custom range can start on a day that was purged. `to` cannot pass today and `from <= to` is enforced.
- **Range math.** `StatsBucket.For` counts both ends (62 days is Day, 63 is Month). The month `Fill` and the reader both key on the first of the month. The first month bar shows the range start, as documented. `LastMonth` works across a year change.
- **CSV.** Every cell is a fixed-format date, a letter-led page name with no comma, quote or line break, or invariant digits. The file name is built from dates only. There is no formula-injection path (CWE-1236). Unbounded range size is not a concern: the 3-year floor limits it to about 9,000 rows at most.
- **Shares.** `Shares.LargestRemainder` is correct: no overflow, stable tie-break, and the sum is 100.

Nothing already recorded in the 12.1 disposition is re-raised (IN-G1-03, IN-G1-04, IN-G1-06 and IN-G1-07 stay as deferred).

The remaining findings are leftover code and comments from the removed 12 design.

### Warnings

#### G1-WR-01: Dead domain code from the removed consent and visit design

**Files:**
- `src/Csps.Domain/Analytics/AnalyticsVisit.cs:70` (`Start`)
- `src/Csps.Domain/Analytics/AnalyticsPageView.cs:33` (`Of`)
- `src/Csps.Domain/Analytics/AnalyticsVitalSample.cs:41` (`Of`)
- `src/Csps.Domain/Analytics/AnalyticsSalt.cs:28` (`Create`)
- `src/Csps.Domain/Analytics/ConsentRecord.cs:52` and `:90` (`Decide`, `IsPolicyVersion`)
- `src/Csps.Domain/Analytics/DailyDeviceCount.cs:44` and `DailyReferrerCount.cs:30` (`Of`)
- `src/Csps.Domain/Analytics/VitalBounds.cs:7`
- `src/Csps.Domain/Analytics/ConsentSource.cs`, `DeviceKind.cs`, `VitalMetric.cs` and `DeviceDimension` in `DailyDeviceCount.cs:4`
- `src/Csps.Domain/Analytics/ReferrerName.cs:7-19` (the five name constants)

**Issue:** D-56, D-61 and D-64 keep the tables only so the monthly job can age out old rows. After 12.1 nothing writes them. I grepped `src/` for every factory above and found no caller outside tests. The only production uses are the EF configurations, `AnalyticsRetentionJob` (which deletes rows by date) and `ReferrerName.MaxLength` (a column length in two configurations).

This is about 300 lines of validation, enums and constants. They guard writes that cannot happen, and they carry tests (`AnalyticsVisitTests`, `ConsentRecordTests`, `VitalBoundsTests`, `DeviceKindTests` and others) that must keep passing.

Two of them are pinned in place by a test written to guard the removal: `tests/Csps.Application.UnitTests/Analytics/AnalyticsSurfaceTests.cs:67` asserts `DeviceKind` must exist, and `:79` asserts `VitalBounds` must exist. That test blocks cleanup of the very code it should police.

**Fix:** Keep each entity class (EF needs it) and its configuration. Delete the factories, `ConsentSource`, `VitalMetric`, `DeviceDimension`, `VitalBounds`, `DeviceKind` and the `ReferrerName` name constants. Keep `ReferrerName.MaxLength`, or move it to the configuration. Retention tests can seed old rows with a test-only helper that uses `SetValues` or raw entity setters.

The drop-approval list (D-56) can carry the removal of the entities themselves. Remove the two `ShouldContain` lines from `AnalyticsSurfaceTests`.

If the owner prefers to keep them as a ready rollback path, record that as a ruling.

#### G1-WR-02: Stale doc comments describe behavior that no longer exists

**Files:**
- `src/Csps.Domain/Analytics/DailyDeviceCount.cs:14-15`
- `src/Csps.Domain/Analytics/DailyReferrerCount.cs:4-5`
- `src/Csps.Domain/Analytics/AnalyticsVisit.cs:3-8`
- `src/Csps.Domain/Analytics/AnalyticsSalt.cs:3-5`
- `src/Csps.Domain/Analytics/ConsentRecord.cs:3-6`
- `src/Csps.Domain/Analytics/StatsBucket.cs:3`

**Issue:** These comments state the old design as fact:
- `DailyDeviceCount` and `DailyReferrerCount` say "The retention job writes it from the raw visits before they age out". `AnalyticsRetentionJob.cs:11` says "Nothing is rolled up any more" (D-64), and the job has no write path.
- `AnalyticsVisit` is described as "one visit of a visitor who allowed stats", holding a visitor hash and an address hash.
- `AnalyticsSalt` says it is "used to hash the address prefix of visits made that day".
- `ConsentRecord` says "each decision adds one".
- `StatsBucket` says "bar in a visits chart", but the chart now shows page views.

A reader doing a privacy review will conclude the site still hashes addresses and records consent. The privacy policy now says neither happens. For a project whose public claim is "tracks no one", these comments misstate the data practice.

**Fix:** Add one line to each retained entity: "Retained only so the monthly cleanup can age out old rows. Nothing writes it since 12.1 (D-56, D-61, D-64)." Rewrite the two `Daily*` comments to match. Change "visits chart" to "page views chart".

### Info

#### G1-IN-01: Total, trend and top pages are three separate reads

**File:** `src/Csps.Application/Analytics/GetVisitorStatsHandler.cs:44-47`

**Issue:** `ReadPageViewsAsync`, `ReadTrendAsync` and `ReadPagesAsync` run as three queries with no shared snapshot. A view counted between them can leave the Page views total a few more than the trend sum or the list sum, and the shares are computed from the list's own sum. The error is a handful of views while the Manager looks at a live "today" bar.

**Fix:** Optional. Derive the total and the top pages from one read (`ReadDailyPagesAsync` already has the data and is bounded at about 9,000 rows), or accept the drift. A one-line note on `IVisitorStatsReader` is enough.

#### G1-IN-02: The contact email is public now, but three comments still say "staff only"

**Files:**
- `src/Csps.Domain/Content/BusinessInfo.cs:24`
- `src/Csps.Application/Content/SiteSettingsDto.cs:32`
- `src/Csps.Application/Content/UpdateSiteSettingsRequest.cs:28`

These sit outside this group's file list. I checked them because they bear on `GetPrivacyContactHandler`.

**Issue:** `GetPrivacyContactHandler` returns the stored Contact email to anonymous visitors through `GET privacy-contact` (D-13, D-29). The settings comments still call it "the shop email, for staff use only". An admin reading the form text, or the settings UI copy generated from it, will not know the address is published on the legal pages. This is a privacy-posture mismatch, not a code bug. The handler itself is correct: the stored value is already trimmed and shape-checked, and the blank case returns null.

**Fix:** Change the three comments to say the address is shown on the Privacy Policy, Terms and Accessibility pages. Check that the settings form helper text says the same (wording is the owner's, D-73).

#### G1-IN-03: Bot filter matches the substring "bot" anywhere in the header

**File:** `src/Csps.Domain/Auditing/UserAgentFamily.cs:68`, used by `src/Csps.Domain/Analytics/AnalyticsBots.cs:20`

**Issue:** `Has(ua, "bot")` is a case-insensitive substring test. A real phone whose model name contains "bot" is dropped from the count (for example the Android "Cubot" brand puts `CUBOT_...` in the header). The effect is a small undercount for a few phones. I did not verify any header against the code, so treat this as low-confidence. It also applies to the audit log's "Bot" label, so changing it affects both.

**Fix:** Optional. Match on a word boundary by hand ("bot/", "bot;", "bot " or end of the token) without a regular expression, or add an analytics-only allow list. Weigh against the audit log's labels staying unchanged.

---

_Reviewed: 2026-11-19_
_Reviewer: Claude (gsd-code-reviewer), group G1_
_Depth: standard_

---

## G2 report

**Reviewed:** 2026-11-19
**Depth:** standard
**Files Reviewed:** 42 (config listed 42 paths; PublicHeadWriter.cs, CollectPageViewHandler.cs, TestingHostRegistration.cs and a few helpers were read as context only)
**Status:** issues_found (5 info, no warnings, no blockers)

### Summary

I tried to break each focus area and could not produce a blocker or warning. What I checked, and what held:

- **Daily counter upsert (`PageViewCounts`).** Safe. The common path is one atomic `UPDATE Views = Views + 1`, so no lost updates. The first view of a day inserts the row. Two requests that race to insert: the loser hits the primary key (error 2627, or 2601), which `SqlErrors.Has` finds anywhere in the inner chain, the tracked row is detached, and the update is repeated against the winner's row. There is no retry strategy in `CspsDbContextOptions`, so the exception is not wrapped or replayed. No deadlock cycle is possible (an insert blocks on the other insert's key lock and then fails). The row is never deleted by the retention job on the current day, so the ignored result of the second update is safe. Overflow of `int` Views is unreachable (rate limits cap it near 864k per page per day).
- **Retention job.** Correct. Every rule only deletes rows past its cut date, children before parents, in 500-row batches (small and safe for a 256 MB host). A full batch triggers a budget check and a spent budget ends the pass with `More`. A failed rule is logged and reported as its own failed line, and the others still run. The 3-year daily floor matches the stats validator and the Privacy Policy ("about 3 years").
- **Testing endpoint.** Not reachable in Production. Three layers: `#if CSPS_TESTING` only compiles in Debug (both the Server and Infrastructure csproj); `AddTestingFeatures` throws if a Debug build starts as Production; the feature provider removes `[TestingOnly]` controllers unless the environment is exactly `Testing`; and the seeder refuses any database except `CSPS_E2E` or `CSPS_Test_<guid>`.
- **Auth on every action.** `AnalyticsController` (class `[AllowAnonymous]`), `PublicSiteController` (class `[AllowAnonymous]`), `TestingAnalyticsController` (`[AllowAnonymous]`, Debug and Testing only), `VisitorStatsController` (`[Authorize(Policy = Policies.Manager)]` on the class, both actions). No action is missing its policy.
- **Rate limit of the collect route.** Per-address 120 a minute chained before the site-wide 600 a minute ceiling, so a refused call does not use a ceiling permit. The route also carries a CSRF header requirement, a 2 KB body cap, a bot and staff drop, and a closed set of eight page keys, so the table cannot grow from attacker input.
- **Cookie deletes.** The delete options match the original set options (checked against commit 83c4c7d0): consent `__Host-` with Path `/`, Secure, no Domain; visitor `__Secure-` with Path `/api/v1/analytics`, Secure, no Domain. The middleware runs before routing and the rate limiter, so even a 429 or 413 beacon answer carries the delete. The visitor cookie is only sent to its own path, and the beacon posts there on every public page, so the delete does fire.
- **Head and shell injection.** Every attribute value goes through `HtmlEncoder`, every script block holds default-encoder JSON, canonical and `og:url` come from `App:PublicBaseUrl` and the route table, never from the request. The Home description is the stored tagline and is encoded.
- **Open redirects.** None in these files.
- **SEO.** Sitemap leaves out unapproved legal pages (the same `ILegalPageCatalog` sets `noindex` in the shell, so the two agree), escapes the origin, and never reads the Host header. `robots.txt` and `gpc.json` are correct.
- **Migrations.** `Up` and `Down` are symmetric (drop order respects the foreign keys), indexes in the migrations match the Fluent configurations, no JSON columns, no triggers, no lossy change.

Prior findings re-checked and found correctly closed: WR-G1-01 (chain order is right; see IN-G2-03 for one remaining note), IN-G1-03 and IN-G1-07 (still deferred, unchanged, not re-raised).

### Info

#### IN-G2-01: Seven unused tables, their entities, DbSets and retention rules remain after 12.1 (owner decision; flag only)

**File:** `src/Csps.Infrastructure/Persistence/CspsDbContext.cs:106-128`, `src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs:52-58`, migrations `20261117053718_AddConsentRecords.cs`, `20261117105658_AddAnalyticsVisits.cs`, `20261117155405_AddDailyAnalyticsCounts.cs`
**Issue:** Nothing in `src` writes to `ConsentRecords`, `AnalyticsVisits`, `AnalyticsPageViews`, `AnalyticsVitalSamples`, `AnalyticsSalts`, `DailyReferrerCounts` or `DailyDeviceCounts` any more (grep of `src` finds only the entity, configuration, DbSet and the retention job). Their domain types (`DeviceKind`, `ReferrerName`, `VitalMetric`, `VitalBounds`, `ConsentSource`) are used only by those entities. The monthly job still runs seven delete rules against empty tables. This is exactly the D-56, D-61 and D-64 position (tables stay until a separate drop yes), so I do not judge it wrong. One fact for the owner: the diff base shows all four of these migrations are new on this branch (not yet merged to main). If none of them has reached any shared or production database, the owner could rewrite them into one migration that creates only `DailyPageCounts`. That would avoid ever needing the one-way-door drop approval. If any shared database has them, leave them as they are.
**Fix:** Ask the owner whether to (a) keep as is, (b) squash the four unmerged migrations into a `DailyPageCounts`-only migration before merge, or (c) schedule the drop. Do not change anything without that answer.

#### IN-G2-02: Comments still describe the removed roll-up and visit features

**File:** `src/Csps.Infrastructure/Persistence/Configurations/DailyDeviceCountConfiguration.cs:8-9`, `src/Csps.Infrastructure/Persistence/Configurations/DailyReferrerCountConfiguration.cs:8-9`, `src/Csps.Infrastructure/Persistence/CspsDbContext.cs:112-128`, `src/Csps.Domain/Analytics/AnalyticsRetention.cs:3,15,18`
**Issue:** The two daily-total configurations say "The retention job replaces a day's rows when it rolls the day up". There is no roll-up any more (D-64; the job's own summary now says "Nothing is rolled up any more"). The DbSet summaries still say "kept after the raw visits age out" and "visits of visitors who allowed stats", and `AnalyticsRetention` still says "Daily roll-ups" and keeps an unused `SaltDays`. A maintainer reading them would expect behavior that no longer exists. Project rule OR-2 asks for comments that say what the code does now.
**Fix:** Reword to "unused since Phase 12.1 (D-56); the cleanup job only ages out old rows". Example for the two configurations: replace the roll-up sentence with "Nothing writes to this table since Phase 12.1 (D-64); the cleanup job still removes old rows."

#### IN-G2-03: The collect route counts the per-address window twice with two independent limiters

**File:** `src/Csps.Server/Security/RateLimitingRegistration.cs:83-85,95,136-140` and `src/Csps.Server/Controllers/AnalyticsController.cs:29`
**Issue:** After the WR-G1-01 fix the same per-address rule exists once in the global chain and once as the `[EnableRateLimiting(AnalyticsCollect)]` policy. Both see the same calls with the same numbers, so the policy limiter can never refuse a call the chain let through, apart from sub-second segment drift between the two windows. The attribute now only supplies the policy name to `WriteRejectionAsync` (Retry-After fallback and message). It works, but it is two sources of truth for one number: a future change that edits only one of them (for example a per-address override in the policy) would be silently ignored or silently stricter. A call refused by the ceiling also still spends its address permit (a chained lease does not give the first permit back), so a busy day at the ceiling shortens honest visitors' own address allowance. The fixer already asked for a human look at this.
**Fix:** Keep as is if the owner accepts it. If it is simplified, drop the policy registration for this route and have `WriteRejectionAsync` map the endpoint name `RecordPageView` to the collect window, so there is one per-address limiter. Add a test that asserts the policy and chain rule come from the same `RateLimitRule` instance.

#### IN-G2-04: Body cap of 2048 bytes is the same number as the path limit of 2048 characters

**File:** `src/Csps.Server/Controllers/AnalyticsController.cs:32`, `src/Csps.Application/Analytics/PageViewRequestValidator.cs:20`, `src/Csps.Domain/Analytics/AnalyticsPath.cs:11`
**Issue:** The request body is `{"path":"..."}`, so a path of 2038 to 2048 characters (which the validator accepts, and which `AnalyticsPath.Cut` keeps) makes the body larger than 2048 bytes and the request gets 413 from the body-limit middleware instead of the documented 204 or 400. Escaped or multi-byte characters shrink the usable length further. No real page path is near this, so nothing breaks, but the validator's "too long" rule and the documented responses do not match the real edge.
**Fix:** Raise the body cap to leave room for the wrapper, for example `[RequestSizeLimitMetadata(4096)]`, or lower the path limit to about 2000 and update `PathTooLong` and the tests together.

#### IN-G2-05: Four rule classes repeat the same `Validate` body

**File:** `src/Csps.Server/Security/RateLimitSettings.cs:50-65,81-96,112-127,143-158,174-189`
**Issue:** `AnalyticsCollectRateLimit`, `AnalyticsCeilingRateLimit`, `PublicReadRateLimit`, `ImageUploadRateLimit` and `MaintenanceRateLimit` each carry a character-for-character copy of the same two checks (permit at least 1, window at least 6 seconds). `RateLimitSettings.Check` already holds the same logic a sixth time. This phase added two more copies. A change to the minimum window must now be made in six places, and a missed one would let one limiter start with a window the sliding limiter rejects.
**Fix:** Add one helper, for example `RateLimitRule.Problems(string section)`, and have each class call `RateLimitRule.Problems(SectionName)` from `Validate`.

---

_Reviewed: 2026-11-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## G3 report

*Created: 2026-11-19T00:00:00-06:00 · Updated: 2026-11-19T00:00:00-06:00*

**Depth:** standard. Read-only. No tests were run.

### Summary

The suite is mostly sound. I traced the handler, reader, retention, rate limit, sitemap, cookie and Testing-seed tests against the production code they target. Most can fail for the right reason. The Manila midnight boundary is handled well in the unit tests (fixed `Now` values at 20:30Z and 16:30Z). The fixtures (`page-names.json`, `legal-pages.json`, `public-paths.json`) match the code that mirrors them. The authorization matrix covers the page-view beacon, both visitor-stats routes, the privacy-contact route, the GPC statement and the Testing seed for anonymous, Admin and Manager. No secrets, real names or machine paths were found in the scoped files. Test databases are per class `CSPS_Test_<guid>` and rate-limit partitions live inside each host, so there is no cross-test sharing.

No blockers. Five warnings: one missing negative test for a new security cap, one concurrency test that does not prove a race, one test name that claims more than it checks, one real-clock flake, and one test whose failure hook is now aimed at nothing useful.

Tests that still exercise removed behavior (visits, consent records, vitals, referrer and device totals) do so because the tables and domain types stay by owner ruling (D-56, D-61, D-64). They are not vacuous. See G3-IN-08.

Prior IDs checked and not re-raised: IN-G3-01, IN-G3-02, IN-G3-03 (deferred). WR-G3-02 fix (literal sitemap list) is correct: `SeoEndpointTests.cs` uses one literal `DefaultSitemapLocs` and a test that approves `/cookies` in the catalog and still expects it absent.

### Warnings

#### G3-WR-01: The 2048-byte body cap on the page-view route has no test

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs` (whole file); control at `src/Csps.Server/Controllers/AnalyticsController.cs:32`
**Issue:** `[RequestSizeLimitMetadata(2048)]` is the abuse cap on an anonymous, unauthenticated write route. `RequestBodyLimitMiddleware.LimitFor` reads it. No test posts a body over 2048 bytes to `/api/v1/analytics/page-views` and expects 413, and none posts exactly 2048. `RequestBodyLimitTests` only proves the 1 MiB default and the 5 MB upload value. If the attribute were deleted or its value changed to 1 MiB, every test in this group would still pass. The same cap also makes the 2048-character path unreachable over HTTP (a JSON body holding a 2048-character path is larger than 2048 bytes), so `APathAtTheLimitIsAccepted` in the handler tests describes a case the route can never deliver.
**Fix:** Add to `PageViewCollectTests`:
```csharp
[Fact]
public async Task ABodyOver2048BytesIs413AndCountsNothing()
{
    await database.ResetAsync();
    await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
    using var client = NewClient(factory);

    using var response = await PostAsync(client, PathBody("/" + new string('a', 2048)));

    response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
    (await ReadRowsAsync()).ShouldBeEmpty();
}
```
Add a paired test at 2048 bytes exactly (accepted). Decide with the owner whether the path limit and the body cap should agree.

#### G3-WR-02: The "parallel first views" tests do not prove a race happened, and the unique-key fallback has no deterministic test

**File:** `tests/Csps.Infrastructure.IntegrationTests/Analytics/PageViewCountsTests.cs:53-85`; code under test `src/Csps.Infrastructure/Analytics/PageViewCounts.cs:20-33`
**Issue:** `TenParallelFirstViewsOfOnePageOnOneDayLeaveOneRowWithTenViews` and `ParallelFirstViewsOfSeveralPagesKeepOneRowEach` queue `Task.Run` calls with no start gate. On a warm thread pool the tasks can run nearly one after another, so the catch branch (`DbUpdateException` on the unique key, detach, second `AddOneAsync`) may never run. The assertion (`Views == 10`) holds whether or not a collision happened, so the tests pass either way and do not show that the fallback path works. A regression that dropped the retry (losing the loser's view) would still pass on a run with no collision.
**Fix:** Add a deterministic test. Use a `DbCommandInterceptor` (the retention tests already have this pattern) that, on the first `UPDATE ... DailyPageCounts` that returns 0 rows, inserts the row from a second context before the first context's INSERT runs, then assert the loser's view is added (`Views == 2`). Also start the parallel tests behind a `ManualResetEventSlim` or `Barrier` so all tasks begin together.

#### G3-WR-03: `TheTestResetEmptiesAllFourTables` checks one table

**File:** `tests/Csps.Infrastructure.IntegrationTests/Persistence/AnalyticsVisitsMigrationTests.cs:128-138`
**Issue:** The name and the class summary say the reset empties all four analytics tables. The test inserts one row into `AnalyticsSalts` only and counts only `AnalyticsSalts`. `AnalyticsVisits`, `AnalyticsPageViews` and `AnalyticsVitalSamples` are never written or counted. Those three are the ones with the cascading foreign keys, which is where Respawn delete ordering can go wrong. The test cannot fail for them.
**Fix:** Insert one visit, one page view and one speed sample (raw SQL like the salt insert, or the domain factories through a context), reset, and count all four tables. Or rename the test to `TheTestResetEmptiesTheSaltTable`.

#### G3-WR-04: Real clock and the Manila midnight in the page-view HTTP tests

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs:46-61` (`TheSecondViewOfTheSamePageAddsOneToTheSameRow`) and `:94-112` (`AnUnknownPublicPathCountsAsNotFoundAndManyUnknownPathsShareOneRow`)
**Issue:** These tests post two or three views through a host on the system clock, then expect `ShouldHaveSingleItem()` with `Views` 2 or 3. If the posts straddle 16:00:00 UTC (midnight in Manila), the views land on two business days, two rows exist, and the test fails. The first test in the file knows about this and uses `row.BusinessDay.ShouldBeOneOf(before, after)`; the other multi-request tests do not. The window is a few milliseconds a day, but it is a real flake that cannot be reproduced on demand.
**Fix:** Run these hosts on a fixed clock with `AuthClient.WithClock(baseFactory, new FakeTimeProvider(noon))` (as the stats tests do), or assert on `rows.Sum(row => row.Views)` and the page key instead of a single row.

#### G3-WR-05: The retention failure hook still targets the removed roll-up table, so the test cannot catch a roll-up regression

**File:** `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs:47-73` (hook at line 64)
**Issue:** `OldRawRowsAreRemovedByDateWithNoRollUpCursor` runs the job with `FailCommandsOn("DailyReferrerCounts")` and says "Writes to the source totals fail, so nothing can have been rolled up". Since 12.1 the raw-visit rule never touches that table. The only command that names it is the daily rule's own `DELETE` on `DailyReferrerCounts`, so the hook silently makes the daily rule fail (a failed line the test never reads). If a roll-up were put back and its write failed, `RunRuleAsync` would turn that into a failed line, the raw rule would still run, and the cursor would still be null, so the test would pass. The roll-up absence is really proven by `ARunAddsNoDeviceOrSourceTotals`; this test adds nothing for it and hides a failed line.
**Fix:** Drop the interceptor and the comment from this test (keep the 6-row and cursor assertions), or assert `Line(report, DailyLabel).Failed.ShouldBeFalse()` and rely on `ARunAddsNoDeviceOrSourceTotals` for the roll-up check.

### Info

#### G3-IN-01: Dead `now` parameter and a duplicate test in the collect handler tests

**File:** `tests/Csps.Application.UnitTests/Analytics/CollectPageViewHandlerTests.cs:235` and `:36-44`
**Issue:** `Harness(IValidator<PageViewRequest>? validator = null, DateTimeOffset? now = null)` is never called with `now`. `AGalleryViewIsCountedForTheBusinessDayUnderTheGalleryKey` repeats the assertion of `CountsAValidPathForTodayWithNoVisitStore` apart from the constructor check. `APathAtTheLimitIsAccepted` only asserts success, and a path of that length resolves to not-found, so it does not show the view was counted.
**Fix:** Remove the unused parameter, merge the duplicate, and assert `IncrementAsync(BusinessDay, PageKeys.NotFound, ...)` in the limit test.

#### G3-IN-02: "Never reads the store" checks one of three reader methods

**File:** `tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs:72`
**Issue:** `ABadCustomRangeFailsWithTheFieldMessageAndNeverReadsTheStore` asserts `DidNotReceiveWithAnyArgs().ReadPageViewsAsync`. The handler also calls `ReadTrendAsync` and `ReadPagesAsync`. A change that validated after the first read would pass.
**Fix:** Use `harness.Reader.ReceivedCalls().ShouldBeEmpty()`.

#### G3-IN-03: `AnalyticsHttp.NewPost` sends no User-Agent, so the retired-cookie page-view tests never reach the counting path

**File:** `tests/Csps.Server.IntegrationTests/Analytics/AnalyticsHttp.cs:20-32`, used by `RetiredCookiesTests.cs:22,78,93,113`
**Issue:** `HttpClient` adds no default User-Agent. The handler treats a missing User-Agent as a bot and returns success before counting. `NoOldCookieMeansNoDelete` and `OtherCookiesAreNeverExpired` therefore prove only the cookie middleware, not that a counted view sets no cookie. (`PageViewCollectTests.AGalleryViewFromADesktopBrowser...` does cover the counted case.) `AnalyticsHttp` and `PageViewCollectTests` also each define their own `NewClient` and `NewPost`.
**Fix:** Add a User-Agent parameter to `AnalyticsHttp.NewPost` (default a desktop Chrome string) and have `PageViewCollectTests` use the shared helpers.

#### G3-IN-04: Stale summary: "nine page keys"

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PublicPageResolverTests.cs:8`
**Issue:** The summary says nine page keys. There are eight keys (seven public pages plus `not-found`), and the last test asserts seven distinct keys from seven paths.
**Fix:** Change the wording to "the seven public pages plus not-found".

#### G3-IN-05: A maintenance assertion can pass on a missing label and does not match its name

**File:** `tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs:179`
**Issue:** `labels.IndexOf("Old daily page counts removed").ShouldBeGreaterThan(labels.IndexOf("Old sent emails removed"))` passes if the outbox label were absent (index -1). The test name says "after the purge lines" but only one purge line is compared. The label does exist today (`PurgeExpiredRecordsJob.cs:31`), so this is a robustness note only.
**Fix:** Assert `labels.ShouldContain("Old sent emails removed")` first, or compare against the whole expected order.

#### G3-IN-06: Testing seed bounds not covered

**File:** `tests/Csps.Server.IntegrationTests/Testing/TestingAnalyticsTests.cs:118-130`; limits at `src/Csps.Server/Controllers/TestingAnalyticsController.cs:25-27`
**Issue:** The refusal theory covers a future day, the day past the 3-year floor, a bad key, zero views and a duplicate. It does not cover 61 days, views of 100001, or offset 0 (today, which must be accepted). Testing builds only, so the risk is low.
**Fix:** Add rows for `MaxDays + 1`, `views = 100001`, and a positive case for `offsetDays = 0`.

#### G3-IN-07: The log test uses a fixed 500 ms sleep

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs:181`
**Issue:** `NoLogLineHoldsThePath...` waits 500 ms, then reads the in-memory sink. The sink is synchronous, so the wait is either unnecessary or it is hiding a late write. The test does guard against emptiness (`lines.ShouldNotBeEmpty()`), so it is not vacuous.
**Fix:** Drop the delay, or wait on the request log event for the dropped call instead of a time.

#### G3-IN-08: Tests keep production-dead domain code alive

**File:** `tests/Csps.Domain.UnitTests/Analytics/AnalyticsVisitTests.cs`, `ConsentRecordTests.cs`, `DailyAnalyticsCountTests.cs`, `VitalBoundsTests.cs`, `DeviceKindTests.cs`, `ReferrerNameTests.cs`; `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs` (consent, salt, visit seeds)
**Issue:** `ConsentRecord.Decide`, `AnalyticsVisit.Start`, `AnalyticsVitalSample.Of`, `VitalBounds.IsValid`, `DailyReferrerCount.Of` and `DailyDeviceCount.Of` have no production caller after 12.1. Only the retention job deletes their rows. The tests are not vacuous and the keep is an owner ruling (D-56, D-61, D-64), but they hold the Domain 100% coverage gate on dead code. Record on the future table-drop plan that these tests, the types and `AnalyticsSurfaceTests` expectations go together.
**Fix:** No change now. Add a line to the D-56 drop list: "also delete these domain types and their tests".

---

_Reviewed: 2026-11-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## G4 report

**Depth:** standard. Read-only. No tests or builds were run.

### Summary

The beacon, the URL parsing, the date range checks, the CSV download and the legal text are in good shape. I found no blocker.

Checked and found sound:
- **Beacon.** It dedupes on the same path in a row, so StrictMode does not double count. It skips `/admin` and `/dev`. A hash-only change keeps the same pathname, so it is not counted. A POST is never retried (no idempotency key). A failed import or send is swallowed. The staff marker cookie path `/api/v1/analytics` matches the beacon URL.
- **Range and CSV.** The `range` param is an allow-list. `from` and `to` are real calendar dates kept as strings, never run through UTC. The floor matches the server (`AddYears(-3)`, Feb 29 to Feb 28). The CSV object URL is revoked after 10 seconds, and the file name is checked against the server's own pattern.
- **Privacy Policy.** It matches what the code and server do after 12.1: no banner, three staff cookies with the lifetimes the server sets, `csps-maps` plus the admin theme and orders view in localStorage, a 3 year page count. No leftover consent or Cookie Policy text remains in `web/src`.
- **Map.** The iframe source is limited to the Google embed path, and the server CSP `frame-src` matches.

No prior disposition item (WR-G2-01, IN-G2-01, IN-G2-02, IN-G2-03 and the rest in the 12.1 disposition) is re-raised. I only cite IN-G2-01 below where a related leftover sits next to it.

### Warnings

#### G4-WR-01: A failed "business today" refresh replaces a working custom-range page with a full error

**File:** `web/src/modules/admin/pages/VisitorStatsPage.tsx:184` (cause: `web/src/modules/admin/hooks/useBusinessToday.ts:73`, `web/src/modules/admin/hooks/useVisitorStatsToday.ts:7-14`)
**Issue:** `useVisitorStatsToday` remembers the last good date (`today: state.today ?? last`). Its comment says the inputs and the query must not lose their limits. But the route decides failure from `todayFailed` alone: `const noToday = custom && todayFailed`.

`isError` in `useBusinessTodayState` is `held === null && probed === null && probe.isError`.

Failure scenario:
1. A Manager has a custom range open and the stats on screen. The held `today` is known.
2. After 5 minutes the held answer goes stale (`HELD_TODAY_MAX_AGE_MS`), so `held` becomes null and the probe refetches.
3. The refetch fails (a network blip, or a 5xx). `probe.isError` is true and `probed` is null, so `isError` is true.
4. `noToday` is true, so `failed` is true and the page swaps the stats for `ErrorState`. The remembered `today` and the cached stats are thrown away.

**Fix:**
```tsx
const noToday = custom && todayFailed && today === null;
```
Keep the retry for that case. With a remembered date, optionally show the existing stale banner instead.

#### G4-WR-02: One failed `privacy-contact` call hides the business identity and the DPO line

**File:** `web/src/modules/public/components/LegalFacts.tsx:91-108`
**Issue:** `FactsData` reads both `useSiteQuery()` and `usePrivacyContact()` and shows the single error banner if either fails. The Privacy Policy "Who we are" block (`show: ['business','dpo']`) and the Terms "Contact us" block need only the site facts. They never use the email. If `/public/privacy-contact` fails or is slow, the controller's name and address and the DPO line are replaced by "Couldn't load our contact details." The file header says "the rest of the page still shows", and it does not hold for these parts.

**Fix:** Read the contact resource only in the `contact` part. For example, make `Contact` its own component that calls `usePrivacyContact()` and shows its own skeleton or error. Let `Business` and `dpo` depend on the site read only.

#### G4-WR-03: The "How to ask about your data" block can render with no way to contact the shop

**File:** `web/src/modules/public/components/LegalFacts.tsx:53-58` (text at `web/src/modules/public/legalPrivacy.ts:300-303`)
**Issue:** The generated DTO says `email` is `null` when none is stored. `Contact` returns `null` when there is no email, no Messenger link and no main phone. The policy then reads "To use any of these rights ... contact us:", followed by nothing. The DPA rights channel is blank and nothing tells the reader or the owner. The same blank shows on the Terms and Accessibility contact sections.

**Fix:** When `Contact` has nothing to show, render a fallback line (for example "Ask us at the shop, or through the Contact page", with a link to `/contact`). Better still, have the owner decide the wording and keep the page a draft until a contact is set.

#### G4-WR-04: The trend chart gives a screen reader no data and no hint that the arrow keys work

**File:** `web/src/components/data/VisitorTrendChart.tsx:171-176, 241-243`
**Issue:** The plot is `role="group"` with `tabIndex={0}` and only the range name as its label. The bar values, the tick labels and the bucket text are not exposed in a readable form. A value is spoken only after the user focuses the plot and presses an arrow key (the polite live region). Nothing says arrow keys, Home and End exist. Someone who browses by virtual cursor gets "Page views, Oct 17 to Nov 15, 2026, group" and no figures.

This follows the IncomeExpenseChart pattern (A11Y-CHART), but it fails WCAG 1.1.1 and 1.3.1 for the daily and monthly values. The KPI total and the top pages list do not replace them.

**Fix:** Add `aria-describedby` to a visually hidden line such as "Use the left and right arrow keys to hear each day. Home and End jump to the first and last." Also provide a text alternative for the series, either an `sr-only` table of date and page views or a visually hidden list. Cap it if the 62 rows are too long. The same fix helps IncomeExpenseChart.

### Info

#### G4-IN-01: `keepalive` in the HTTP client is dead since 12.1

**File:** `web/src/core/api/http/httpClient.ts:39-40, 263, 292-293, 452-453`
**Issue:** The `keepalive` option was added for the 12 beacon. After 12.1 the only caller is the beacon, and `analyticsService.test.ts:9-20` asserts it does not pass `keepalive`. No production code sets it. It is unused API with its own test in `httpClient.test.ts`.
**Fix:** Remove the option, the `Outgoing.keepalive` field and the tests. Or keep it on purpose and record why. The beacon fires at route render, not on unload, so it does not need it.

#### G4-IN-02: `emptyLabel` and `EmptyValue label` have no production caller

**File:** `web/src/components/money/KpiCard.tsx:49-50, 63, 92`; `web/src/components/states/EmptyValue.tsx:6-9`
**Issue:** The "Not available" label was for Visitor Stats KPI cards that 12.1 removed (bounce rate and the like). The only user left is `money.test.tsx`. The `SPEC-DEVIATION: EMPTY-LABEL` note describes a use that no longer exists.
**Fix:** Revert the `label` prop on `EmptyValue` and the `emptyLabel` prop on `KpiCard`, and their tests. Or keep them and drop the "Not available (D-27)" wording.

#### G4-IN-03: Leftover 2-column list grid and referrer-era comments around the one Top pages card

**File:** `web/src/modules/admin/components/visitorStats.recipe.ts:28-31, 42-43`; `web/src/modules/admin/pages/VisitorStatsPage.tsx:153-160`; `web/src/modules/admin/components/StatBarList.tsx:1-2`
**Issue:**
- `visitorStatsListRowClasses` is a 2-column grid ("two list cards side by side") that now holds one card. At 1024 px and above, the Most viewed pages card takes half the width and leaves an empty half. This sits beside the owner item IN-G2-01, which covers only the KPI grid.
- `statBarNameClasses` still says "a long host wraps anywhere". `StatBarList` says "UI-SPEC V1 items 5 to 7". Both describe the removed referrer and device lists.

**Fix:** Park the grid with IN-G2-01 as one owner layout question. Fix the comments in the next change here.

#### G4-IN-04: Map prefix check is looser than the server and the iframe has no `sandbox`

**File:** `web/src/modules/public/components/MapCard.tsx:43, 63, 108-115`
**Issue:** The server only stores links starting `https://www.google.com/maps/embed?` (`SiteLinks.cs:45`). The client allows any `https://www.google.com/maps/embed...`, with no `?`. The CSP `frame-src` still blocks a bad path, so the result is a blank frame, not a hole. This is defense in depth. The iframe also has no `sandbox`.
**Fix:** Use the same `?`-terminated prefix. Optionally add `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"` after checking that the embed still works.

#### G4-IN-05: The DPO line repeats its own label

**File:** `web/src/modules/public/legalCopy.ts:125`
**Issue:** It renders "Data Protection Officer: The owner, Data Protection Officer", which says the title twice. The wording is the owner's (D-73), so I only flag it for the next owner review.
**Fix:** For example "Data Protection Officer: The owner".

#### G4-IN-06: CSV export adds a response interceptor to the shared singleton client

**File:** `web/src/modules/admin/services/visitorStatsService.ts:102-117`
**Issue:** `exportCsv` registers a response interceptor on the shared `apiClient` and removes it in `finally`. Any other request that finishes during the export also passes through it. It is harmless today, because only a header matching the strict `visitor-stats-...csv` pattern is kept and the button is disabled while pending. It still adds shared mutable state for something that is a per-request concern.
**Fix:** Let the client return the headers, for example a `responseType: 'text'` result with the headers, or an `onResponse` request option. Then read `Content-Disposition` without touching the shared interceptor list.

---

_Reviewed: 2026-11-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## G5 report

**Reviewed:** 2026-11-19
**Depth:** standard
**Files reviewed:** 50 (read-only; no tests were run)

### Summary

The suite is in good shape on the areas this group was asked to check.

Checked and found sound:
- **MSW leaks.** `setup.ts` registers `server.resetHandlers()` and `resetPublicData()` in an after-each. The hook order puts the RTL cleanup first, then the reset, then the console guard. The probe handlers in `test/msw.ts` are added with `server.use`, so they are reset too.
- **Fake timers.** Every use is restored. `useVisitorStatsToday` and `VisitorStatsPage` fake only `Date` and call `vi.useRealTimers()` in an after-each. `downloadCsv.test.ts` uses try/finally.
- **Stubbed globals.** `ResizeObserver` and `fetch` are undone by `vi.unstubAllGlobals()`. `navigator.globalPrivacyControl` is removed in a finally. `Storage.prototype` spies are covered by `restoreMocks: true` in `vitest.config.ts`.
- **Timezone.** No test depends on the runner's zone. Date helpers use `Date.UTC` and `Z` suffixes. The "9:41 AM" stale line goes through `utils/format.ts`, which pins `Asia/Manila`.
- **Shared fixtures.** `page-names.json`, `legal-pages.json` and `public-paths.json` are each read by a web test and a server test. I confirmed `PageNamesTests`, `LegalPagesTests` and `PublicRouteTableTests` read them. I found no drift.
- **Source-scanning tests.** The `no-consent`, `public-paths`, `page-names` and `cookie-inventory` scans each have a non-empty guard or a positive control.
- **Long dashes.** None in any reviewed file.

No blockers. There are four warnings, all tests that pass without proving what their title claims, or a scan that can silently shrink. I did not re-raise anything from the 12.1 disposition. `keepalive` and `emptyLabel` are unused now, but 12.1-RESEARCH (line 600) records the decision to keep them, so they are not findings.

### Warnings

#### G5-WR-01: "requests nothing until the hook is used" cannot fail

**File:** `web/src/modules/public/hooks/usePrivacyContact.test.tsx:16`
**Issue:** The test imports `./usePrivacyContact` statically at line 7. Its body then runs `await import('./usePrivacyContact')`, which returns the module that is already loaded. No code runs, so `requests` stays 0 whatever the hook or module does at load time. The claim "the email is read only when a legal page uses the hook" has no real test. The neighbouring `ignores the boot block and asks the API` (line 51) has a related gap. It never counts requests, and the default `privacyContactHandler()` from `setup.ts` answers the same email. So it still passes if the hook never called the network.
**Fix:** Make the first test prove laziness. Either count requests across an `await settle()` after importing the module, or render a component that does not call the hook and assert 0. In the boot-block test, count the requests in the handler and assert `toBe(1)` after `waitFor`.
```ts
let requests = 0;
server.use(http.get(ROUTE, () => { requests += 1; return Response.json({ email: 'shop-private@example.test' }); }));
const { result } = renderHook(() => usePrivacyContact());
await waitFor(() => { expect(result.current.status).toBe('success'); });
expect(requests).toBe(1);
```

#### G5-WR-02: "stays when the shop facts cannot be read" passes before the read has failed

**File:** `web/src/modules/public/components/SiteFooter.test.tsx:325`
**Issue:** `site` is `undefined` until the fetch resolves, and the copyright is only drawn when `site !== undefined` (`SiteFooter.tsx:159`, `:213`). The test renders, then runs `waitFor(() => expect(queryByText(/©/)).not.toBeInTheDocument())`. That condition is already true on the first render, so `waitFor` returns at once, before the 404 arrives. The final three-item assertion also runs immediately. A footer that dropped the Legal row after a failed read would still pass. The test proves the first render, not the post-failure state.
**Fix:** Wait for the failed request to settle before asserting. Count the call in a handler, or wait for the resource state.
```ts
let reads = 0;
server.use(http.get('*/api/v1/public/site', () => { reads += 1; return HttpResponse.json({ title: 'x', status: 404 }, { status: 404 }); }));
// render ...
await waitFor(() => { expect(reads).toBeGreaterThan(0); });
await new Promise((resolve) => setTimeout(resolve, 0)); // let the rejection land
expect(queryByText(/©/)).not.toBeInTheDocument();
expect(within(legalNav()).getAllByRole('listitem')).toHaveLength(3);
```

#### G5-WR-03: the legal text scan can silently drop Privacy and Terms

**File:** `web/src/test/legal-content.node.test.ts:15` (guard at `:156`)
**Issue:** `textFiles` is `readdirSync(...)` filtered by `/^legal.*\.ts$/`. Every shape check (`it.each(textFiles)`) runs only over what the scan finds. The only presence check asserts `legalAccessibility.ts`. If `legalPrivacy.ts` or `legalTerms.ts` were renamed (for example to `privacyText.ts`) or moved, `it.each` would quietly run over fewer files and stay green. The test header says a new plan adds a text with no edit to this test. The reverse, a text disappearing, is not guarded. The Privacy Policy is the file this phase most needs checked for links, dashes and ids. A related point: the `cookie-settings` check at line 178 compares `block.kind` to a string that is not in the `LegalBlock` union. It can never be true, so it adds no protection beyond the type checker.
**Fix:** Assert all three expected modules.
```ts
it('finds the three text modules by file name', () => {
  expect(textFiles).toEqual(expect.arrayContaining(['legalAccessibility.ts', 'legalPrivacy.ts', 'legalTerms.ts']));
});
```
Drop the `cookie-settings` test, or turn it into a check that the `LegalBlock` kinds are exactly `p`, `ul`, `dl`, `h3` and `facts`.

#### G5-WR-04: the export toast axe test swallows a missing toast

**File:** `web/src/modules/admin/pages/VisitorStatsPage.test.tsx:1024`
**Issue:** The test is named "has no axe violations with the export toast shown". It waits with `await screen.findByText('Visitor stats exported', {}, { timeout: 3000 }).catch(() => null)` and ignores the result. If the export fails or the toast never appears, the promise resolves to `null` and axe runs on a page with no toast. The test passes without checking its named state. The same `.catch(() => null)` pattern at line 959 is safe, because `title?.textContent` is then asserted. Line 1024 has no such assert.
**Fix:** Drop the `.catch` and let `findByText` fail, or assert the result.
```ts
expect(await screen.findByText('Visitor stats exported', {}, { timeout: 3000 })).toBeInTheDocument();
await expectNoAxeViolations(container);
```

### Info

#### IN-01 (G5-IN-01): StatBarList tests still cover the removed referrer lists

**File:** `web/src/modules/admin/components/StatBarList.test.tsx:14`, `:69`, `:76`, `:83`, `:96`
**Issue:** After 12.1 the component only feeds the Most viewed pages card. The page sends at most 5 rows, and these are page keys, not hosts. The tests still use `Facebook`, `host-N.example`, a 200-character host, "shows up to 10 rows" and "shows a referrer host as plain text". `EMPTY` reads "No visitors allowed visitor stats in these dates.", which looks like a bad find-and-replace of a removed string. The behavior is real, but the tests describe a feature that is gone. The dev scenarios (`dev/scenarios/groups/visitor-stats.ts:87-89`) carry the same leftovers; that is already recorded as IN-G3-04.
**Fix:** Use page keys and the current empty copy. Keep one long-name wrap test and one 5-row test. Retitle "referrer host" to "name".

#### IN-02 (G5-IN-02): version text is pinned to 1.0, which breaks on the owner's approval

**File:** `web/src/modules/public/components/LegalPage.test.tsx:195`; `web/src/modules/public/pages/LegalPages.test.tsx:85`
**Issue:** `LegalPages.test.tsx` states that the owner's later yes (D-73) changes the fixture and the facts only, not these tests. But line 85 asserts `/^Version 1\.0 · /`, and `LegalPage.test.tsx:195` asserts `'Version 1.0 · Last updated Nov 18, 2026'` from the real `LEGAL_PAGES.privacy.version`. If approval bumps the Privacy version to 1.1, both fail with no code defect.
**Fix:** Build the expected text from `LEGAL_PAGES.privacy.version`, or from the fixture via the existing `versionLine('privacy')` helper in `LegalPages.test.tsx`. In `LegalPage.test.tsx`, set `version: '1.0'` explicitly in the `APPROVED` meta.

#### IN-03 (G5-IN-03): beacon tests use fixed sleeps and stop at the first request

**File:** `web/src/modules/public/hooks/usePageViewBeacon.test.tsx:25` (the 60 ms `settle`); `web/src/layouts/PublicLayout.test.tsx:425`, `:460`, `:474`; `useVisitorStatsParams.test.tsx:15` (30 ms)
**Issue:** The negative checks ("does not send when hidden", the `/admin` and `/dev` skips, no retry after 500) wait a fixed 60 ms, then assert the count. A late send would pass on a slow runner. The "sends one view" tests use `waitFor(() => length 1)`, which returns at the first request, so a second send that lands later is not seen. The one-view claim holds in the hook tests only because the StrictMode case settles. The layout tests never check for a duplicate. The "hidden" and "no referrer" tests also guard behavior that no longer exists.
**Fix:** After each `waitFor(... 1)` add a short settle and re-assert the count. For the negatives, count against a known-positive control in the same test, such as navigating to a counted path afterwards and asserting that exactly one request exists.

#### IN-04 (G5-IN-04): the cookie inventory reads two named C# files only

**File:** `web/src/test/cookie-inventory.node.test.ts:12`
**Issue:** `CODE_FILES` is `['AuthCookies.cs', 'AnalyticsCookies.cs']`. The header says a cookie added to the code fails here until the policy changes. That holds only for a new constant inside those two files. A cookie set from a new file (for example `SiteCookies.cs`) or from a literal in an endpoint is not seen. Today only those two files call `Cookies.Append`, so there is no current gap.
**Fix:** Scan every `*.cs` under `src/Csps.Server` for the `__Host-`/`__Secure-csps_` literal pattern, except `RetiredCookies.cs`, and keep the "at least one name per file" guard for the two known files.

#### IN-05 (G5-IN-05): `URL.createObjectURL` is defined and never removed

**File:** `web/src/modules/admin/downloadCsv.test.ts:17`; `web/src/modules/admin/pages/VisitorStatsPage.test.tsx:888`
**Issue:** Both files call `Object.defineProperty(URL, 'createObjectURL' / 'revokeObjectURL', ...)` in a setup that runs before each test and never delete them. jsdom has no original, so `vi.restoreAllMocks()` does not undo them. They stay for the rest of the file. Each file runs in its own isolated environment, so no cross-file leak today, and the tests that follow still pass. It would matter if a later test in the file expected jsdom's missing function, or if isolation were turned off.
**Fix:** In the after-each, `Reflect.deleteProperty(URL, 'createObjectURL')` and the same for `revokeObjectURL`. Or use `vi.stubGlobal` and rely on `vi.unstubAllGlobals()`.

#### IN-06 (G5-IN-06): Privacy tests pin map wording that WR-G2-01 says is inaccurate

**File:** `web/src/modules/public/pages/PrivacyPolicyPage.test.tsx:120`, `:140`, `:192`
**Issue:** The tests assert `/after you tap Show Map/` and `/only when you tap Show Map/i`. The 12.1 disposition (WR-G2-01, owner) says this wording is wrong, because since D-65 a returning browser loads the map by itself. This is not a new finding. It notes that the tests lock in the inaccurate claim. When the owner approves the corrected text (D-73), these three assertions fail together and must change in the same commit.
**Fix:** No action until the owner rules. When the wording changes, update these three tests in the same commit. Consider asserting only the stable parts (the tap saves the setting; the key is never sent) so a wording-only edit does not break them.

---

_Reviewed: 2026-11-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## G6 report

**Reviewed:** 2026-11-19
**Depth:** standard
**Files Reviewed:** 22

### Summary

The Phase 12 disposition file lists no rows, so nothing there was re-raised. Nothing from the 12.1 disposition is re-raised. IN-G3-03 (121st view straddling the window) and IN-G3-04 (RANKED_ROWS referrer names) are untouched.

No critical issues. Four warnings, all in the e2e specs: two flakiness races in `visitor-stats.spec.ts`, and two weaknesses in `no-cookies.spec.ts`.

Checked and found sound:
- Port and env handling. `playwright.config.ts` uses 5199, `reuseExistingServer: false`, env on the host process only, and CSPS_E2E. `vite.config.ts` uses 5180 with `strictPort`. The two new rate limit keys (`RateLimits__AnalyticsCollect__PermitLimit`, `RateLimits__AnalyticsCeiling__PermitLimit`) match the server section names and pass the `>= 1` validation.
- Budget script. Sizes are gzip level 9 of the final bundle in `post` order. A route that cannot be measured gives `bytes: null` plus an error, so a missing chunk cannot pass silently. CSS must be exactly one file. The new legal rows and the admin route table rows are consistent with `router.tsx` and `legalLoaders.ts`.
- Dev-only code. `src/dev/` is in the showcase-only prefix list and is enforced in the production build. Every `src/dev` import in the changed previews goes the safe way (dev imports app code, never the reverse).
- `owner-review.mjs` (only the 4-line env change is in this diff). The whole file was grepped: `spawnSync` is called with an argument array and no shell, there is no stdin read, and every write goes through `assertWritable` into `artifacts/owner-review/`.

### Warnings

#### G6-WR-01: Seeding `recentDay()` wipes live counts inside the 30-day window while two other tests compare before and after counts

**File:** `web/e2e/visitor-stats.spec.ts:47-49` (seed at `:392`), affected tests at `:163-173` and `:198-204`
**Issue:** `seedAnalytics` replaces ALL page rows on the seeded days (`TestingAnalyticsSeeder.SeedAsync` runs `ExecuteDeleteAsync` for every row whose `BusinessDay` is in the seeded dates, then inserts only the seeded page). `recentDay()` uses day `-(5 + slot)`, which is inside "Last 30 days". Every earlier E2E run on the same `CSPS_E2E` database left real views on those days (Home, Products, Gallery, Contact, Terms and so on).
- The a11y test at `:387` (last test in the file) deletes those rows and writes one `contact: 3` row.
- Five projects run the spec in parallel workers, and nothing orders the seed against the other tests. If the seed lands between `before` and the final read in test 1 (`:163` to `:173`), the Page views total DROPS by the wiped views, and `>= before + 3` fails.
- The same seed lands inside test 2's before and after read of "Terms of Use" (`:200` and `:203`). Test 2 holds the site content lock, but the seed does not, so the equality `toBe(before)` fails.
- The failure depends on timing and on how much history the database holds, so it looks like a flake and is not reproducible in a fresh database.
**Fix:** Make the seed and the delta readers exclude each other. Either take `withSiteContentLock` around the `seedAnalytics(request, [recentDay()])` call and around the before-to-after span of test 1, or keep the delta tests off the seeded days by reading a custom range of only today (`from = to = manilaDate(0)`), where the seeds never write. Alternatively give the a11y test a day beyond the 30-day window that the default chart still shows by using a "this-year" or custom range.

#### G6-WR-02: The "Manager view adds nothing" test passes vacuously when Terms of Use is outside the top 5

**File:** `web/e2e/visitor-stats.spec.ts:198-204` (helper at `:75-84`)
**Issue:** `listCount` returns 0 when the row is absent. The list is "Up to 5 pages by page views" (`VisitorStatsResponse.cs:21`). The spec's own comment at `:172` says a page outside the top 5 reads 0. On a database where Terms of Use ranks 6th or lower (eight pages exist, and the sweeps open `/terms` far less than Home), `before` is 0. If the server wrongly counted the Manager's view, Terms would go from, say, 100 to 101 and stay out of the top 5, so `after` is still 0 and the assertion `0 === 0` passes. The negative proof only works when the row is visible, and nothing guarantees that.
**Fix:** Make Terms of Use visible before the check, for example seed a large Terms count on one day first (`seedAnalytics`, `pageKey: 'terms'`, `views: 100000` on a day inside the window, under the same lock as WR-01), then assert `before > 0` as a precondition. Or assert on the Page views KPI over a today-only range while holding the lock.

#### G6-WR-03: `@no-cookies` checks only the cookie jar and only the word "google.com", so it cannot catch a rejected cookie or any other tracker

**File:** `web/e2e/no-cookies.spec.ts:23-26`, `:36-51`
**Issue:** The spec claims "no cookie and no tracker", but it asserts three things only.
- `context.cookies()` is empty. A `Set-Cookie` header that the browser refuses (bad `__Host-` prefix attributes, wrong domain) or that expires at once (`Max-Age=0`) never reaches the jar, so a server that sends cookies on every response would still pass. The D-63 retirement code does send expiring cookies, so this is a real regression path.
- No request to `google.com`. A beacon to `googletagmanager.com`, `google-analytics.com`, `connect.facebook.net` or any other host passes. The shop's visitors come from Facebook, so a Facebook pixel is the likeliest regression.
- A chunk named `speedReport`. This is already labelled "extra guard" in the file.
It also opens only Home and Gallery, not Products, Contact or the three legal pages.
**Fix:** Record responses as well as requests and assert that no response carries a `set-cookie` header (`await response.allHeaders()`), and replace `isGoogle` with a same-origin rule:
```ts
const foreign = requests.filter((r) => /^https?:/.test(r.url()) && new URL(r.url()).origin !== ORIGIN);
expect(foreign.map((r) => r.url())).toEqual([]);
```
Visit all seven public paths in `expectNothingStored`. Wait for the page-views response before reading the jar so a late beacon response is covered.

#### G6-WR-04: `@no-cookies` opens Home and Gallery without seeding the demo content or taking the site content lock

**File:** `web/e2e/no-cookies.spec.ts:30-45`, `:99-123`
**Issue:** The other specs that load Home or Gallery all call `ensureDemoSiteContent` or `withSiteContentLock` (`public.spec.ts:14`, `home.spec.ts`, `gallery.spec.ts`, `visitor-stats.spec.ts:148`). `public.spec.ts:11-12` records why: "the host keeps demo photo files in memory, so shown orders a run left in the database answer 404 for their photos until a reset stores new files." The e2e guard fails a test on any undeclared failed response. `no-cookies.spec.ts` does neither, in three tests (`expectNothingStored` twice and the old-cookie test at `:118`).
- When the spec is the first thing to touch the host (for example `npx playwright test -g @no-cookies`, a likely way to run it) and the database holds shown orders from an earlier run, Home or Gallery returns 404 photo responses and the guard fails the test with an error unrelated to cookies.
- When it runs beside a spec that resets the content, the same can happen mid-run.
**Fix:** Add the same `beforeEach` as `public.spec.ts` (`ensureDemoSiteContent(request)` plus the long timeout for the first test of a worker), and run the page opens inside `withSiteContentLock` as the sweeps do.

### Info

#### G6-IN-01: `oldRange()` computes its dates before the seed and the server computes its dates at seed time

**File:** `web/e2e/visitor-stats.spec.ts:34-44`, `:321`, `:343`
**Issue:** `from`, `to` and the CSV `rows` come from `manilaDate()` when `oldRange()` runs. The server turns `offsetDays` into dates when the POST arrives. If Manila midnight passes between the two (about 10:00 AM in the owner's time zone, a normal working hour), every seeded day lands one day later than the range: the range then holds five of six days and `kpiCount(...) === 25` fails. The window is a few hundred milliseconds a night, so this is rare.
**Fix:** Seed first, then read the server's today, or retry the test once when `manilaDate(0)` changed between the two calls. Not worth more than a guard.

#### G6-IN-02: The host env list is copied by hand in two places

**File:** `web/playwright.config.ts:96-116`, `web/scripts/owner-review.mjs:190-208`
**Issue:** Both files hold the same 13 `RateLimits__*` and host variables. This phase had to add the two analytics keys to both. They match today, and `owner-review.test.ts` pins only the `.mjs` copy, so a future key added to one file only goes unnoticed until a screenshot run or a spec hits a 429.
**Fix:** Export one `HOST_ENV`-style object (the `.mjs` already exports it) and spread it into the `webServer.env` in `playwright.config.ts`, or add a test that compares the two key sets.

#### G6-IN-03: The `@no-cookies` header comment still says the map loads only after a tap

**File:** `web/e2e/no-cookies.spec.ts:4`
**Issue:** Since D-65 a browser that saved a Show Map tap loads the map by itself (the new tests at `contact.spec.ts:111` and `:130` prove it). The comment contradicts those tests. It is the same wording the owner still has to rule on in the Privacy Policy (WR-G2-01), so it is a code comment only and needs no owner decision.
**Fix:** Change to "(the map loads only after a first tap, and only on Contact)".

#### G6-IN-04: Timeouts were raised for the showcase h1 instead of finding why WebKit needs about 7 s

**File:** `web/e2e/shell.spec.ts:60-61`, `:285-286`; `web/e2e/auth-overflow.spec.ts:348-349`; `web/e2e/showcase.spec.ts:38-39`
**Issue:** Four places now allow 20 s for the showcase h1, with the comment that D-42 moved the load event earlier. The showcase also ships at `/admin/components` for Managers (D-33), so a 7 s h1 in WebKit is a user-visible delay, and the longer waits hide any further slowdown. The `$initial` code-splitting group added in `vite.config.ts:119-122` is the change that moved the load event.
**Fix:** Record the cause in the 12 deferred items (for example the showcase chunk graph under the `$initial` group) and keep one shared constant for the 20 s wait so it can be tightened later.

---

_Reviewed: 2026-11-19_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
