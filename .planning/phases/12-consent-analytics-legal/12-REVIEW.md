---
phase: 12-consent-analytics-legal
created: 2026-11-20T10:00:00-06:00
updated: 2026-11-20T10:00:00-06:00
reviewed: 2026-11-20T10:00:00-06:00
depth: standard
reviewers: 5 parallel gsd-code-reviewer agents, merged
diff_base: 5f17fdc3082f55719bfdf9f54469f1475ac9055f
files_reviewed: 154
files_reviewed_list:
  - .claude/CLAUDE.md
  - CSPS-PRD.md
  - docs/dependencies.json
  - docs/dependencies.md
  - docs/web/budgets.md
  - docs/web/e2e.md
  - src/Csps.Application/Analytics/CollectContext.cs
  - src/Csps.Application/Analytics/CollectPageViewHandler.cs
  - src/Csps.Application/Analytics/ExportVisitorStatsHandler.cs
  - src/Csps.Application/Analytics/GetVisitorStatsHandler.cs
  - src/Csps.Application/Analytics/PageNames.cs
  - src/Csps.Application/Analytics/PageViewRequest.cs
  - src/Csps.Application/Analytics/VisitorStatsCsv.cs
  - src/Csps.Application/Analytics/VisitorStatsResponse.cs
  - src/Csps.Application/Ports/IVisitorStatsReader.cs
  - src/Csps.Domain/Analytics/AnalyticsRetention.cs
  - src/Csps.Domain/Analytics/DeviceKind.cs
  - src/Csps.Domain/Analytics/PageKeys.cs
  - src/Csps.Domain/Analytics/ReferrerName.cs
  - src/Csps.Domain/Analytics/VitalBounds.cs
  - src/Csps.Domain/Content/LegalPages.cs
  - src/Csps.Infrastructure/Analytics/AnalyticsRegistration.cs
  - src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs
  - src/Csps.Infrastructure/Analytics/TestingAnalyticsSeeder.cs
  - src/Csps.Infrastructure/Analytics/VisitorStatsReader.cs
  - src/Csps.Server/Composition/AnalyticsApplicationRegistration.cs
  - src/Csps.Server/Controllers/AnalyticsController.cs
  - src/Csps.Server/Controllers/TestingAnalyticsController.cs
  - src/Csps.Server/Controllers/VisitorStatsController.cs
  - src/Csps.Server/Endpoints/PublicPageHeads.cs
  - src/Csps.Server/Endpoints/PublicPageResolver.cs
  - src/Csps.Server/Endpoints/PublicRouteTable.cs
  - src/Csps.Server/Endpoints/SeoEndpoints.cs
  - src/Csps.Server/Http/RetiredCookiesMiddleware.cs
  - src/Csps.Server/Program.cs
  - src/Csps.Server/Security/AnalyticsCookies.cs
  - src/Csps.Server/Security/RateLimitSettings.cs
  - src/Csps.Server/Security/RateLimitingRegistration.cs
  - src/Csps.Server/Security/RetiredCookies.cs
  - tests/Csps.Application.UnitTests/Analytics/AnalyticsSurfaceTests.cs
  - tests/Csps.Application.UnitTests/Analytics/CollectPageViewHandlerTests.cs
  - tests/Csps.Application.UnitTests/Analytics/ExportVisitorStatsHandlerTests.cs
  - tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs
  - tests/Csps.Application.UnitTests/Analytics/PageNamesTests.cs
  - tests/Csps.Application.UnitTests/Analytics/VisitorStatsCsvTests.cs
  - tests/Csps.Application.UnitTests/Csps.Application.UnitTests.csproj
  - tests/Csps.Domain.UnitTests/Analytics/AnalyticsPathTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/AnalyticsRetentionTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/DeviceKindTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/ReferrerNameTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/VitalBoundsTests.cs
  - tests/Csps.Domain.UnitTests/Content/LegalPagesTests.cs
  - tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj
  - tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/AnalyticsHttp.cs
  - tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/PublicPageResolverTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/RemovedAnalyticsRoutesTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/RetiredCookiesTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsExportTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Http/PublicRouteTableTests.cs
  - tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs
  - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
  - tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs
  - tests/Csps.Server.IntegrationTests/Testing/TestingAnalyticsTests.cs
  - tests/Csps.Testing/CspsApiFactory.cs
  - tests/fixtures/legal-pages.json
  - tests/fixtures/page-names.json
  - tests/fixtures/public-paths.json
  - web/e2e/contact.spec.ts
  - web/e2e/fixture-selftest.spec.ts
  - web/e2e/fixtures.ts
  - web/e2e/link-preview.spec.ts
  - web/e2e/no-cookies.spec.ts
  - web/e2e/public-sweep.spec.ts
  - web/e2e/showcase.spec.ts
  - web/e2e/testing-api.ts
  - web/e2e/visitor-stats.spec.ts
  - web/package.json
  - web/playwright.config.ts
  - web/scripts/budget.test.ts
  - web/scripts/budget.ts
  - web/scripts/owner-review.mjs
  - web/scripts/owner-review.test.ts
  - web/scripts/vite-budget-plugin.test.ts
  - web/src/components/brand/Icon.test.tsx
  - web/src/components/brand/icons.ts
  - web/src/components/data/VisitorTrendChart.test.tsx
  - web/src/components/data/VisitorTrendChart.tsx
  - web/src/components/data/copy.ts
  - web/src/components/data/data.recipe.ts
  - web/src/core/api/http/httpClient.test.ts
  - web/src/core/routes/router.tsx
  - web/src/dev/previews/VisitorStatsParts.tsx
  - web/src/dev/renderScenario.test.tsx
  - web/src/dev/scenarios/groups/legal.ts
  - web/src/dev/scenarios/groups/visitor-stats.ts
  - web/src/layouts/PublicLayout.test.tsx
  - web/src/layouts/PublicLayout.tsx
  - web/src/modules/admin/components/StatsCustomRange.tsx
  - web/src/modules/admin/components/VisitorKpiRow.tsx
  - web/src/modules/admin/components/VisitorTrendCard.tsx
  - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
  - web/src/modules/admin/components/showcase/showcase.recipe.ts
  - web/src/modules/admin/components/showcase/showcaseCopy.ts
  - web/src/modules/admin/components/showcase/showcaseSections.test.ts
  - web/src/modules/admin/components/showcase/showcaseSections.ts
  - web/src/modules/admin/components/visitorStats.recipe.ts
  - web/src/modules/admin/downloadCsv.test.ts
  - web/src/modules/admin/hooks/useVisitorStatsToday.test.tsx
  - web/src/modules/admin/hooks/useVisitorStatsToday.ts
  - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
  - web/src/modules/admin/pages/VisitorStatsPage.test.tsx
  - web/src/modules/admin/pages/VisitorStatsPage.tsx
  - web/src/modules/admin/routes.test.tsx
  - web/src/modules/admin/services/visitorStatsService.test.ts
  - web/src/modules/admin/services/visitorStatsService.ts
  - web/src/modules/admin/visitorStatsCopy.ts
  - web/src/modules/public/components/LegalPage.test.tsx
  - web/src/modules/public/components/LegalSection.test.tsx
  - web/src/modules/public/components/LegalSection.tsx
  - web/src/modules/public/components/MapCard.tsx
  - web/src/modules/public/components/SiteFooter.test.tsx
  - web/src/modules/public/components/SiteFooter.tsx
  - web/src/modules/public/components/contact.recipe.ts
  - web/src/modules/public/components/contact.test.tsx
  - web/src/modules/public/copy.ts
  - web/src/modules/public/hooks/usePageViewBeacon.test.tsx
  - web/src/modules/public/hooks/usePageViewBeacon.ts
  - web/src/modules/public/legalContent.ts
  - web/src/modules/public/legalLoaders.ts
  - web/src/modules/public/legalPages.ts
  - web/src/modules/public/legalPrivacy.ts
  - web/src/modules/public/mapChoice.test.ts
  - web/src/modules/public/mapChoice.ts
  - web/src/modules/public/pages/LegalPages.test.tsx
  - web/src/modules/public/pages/PrivacyPolicyPage.test.tsx
  - web/src/modules/public/services/analyticsService.test.ts
  - web/src/modules/public/services/analyticsService.ts
  - web/src/test/cookie-inventory.node.test.ts
  - web/src/test/legal-content.node.test.ts
  - web/src/test/legal-pages.node.test.ts
  - web/src/test/no-consent.node.test.ts
  - web/src/test/page-names.node.test.ts
  - web/src/test/public-paths.node.test.ts
  - web/src/test/setup.ts
  - web/src/ui/app.css
status: issues_found
findings:
  critical: 0
  warning: 14
  info: 20
  total: 34
---

# Phase 12: Code Review (fresh pass, D-79)

*Created: 2026-11-20T10:00:00-06:00 · Updated: 2026-11-20T10:00:00-06:00*

Five parallel reviewers covered every file changed since the first phase 12 review (commit 5f17fdc3) on branch `gsd/phase-12-consent-analytics-legal`, which includes all Phase 12.1 work. Generated files were left out: `web/src/types/api.generated.ts`, `tools/openapi-gen/openapi.v1.json`, `web/package-lock.json`, `web/THIRD-PARTY-NOTICES.txt`. Items settled in `12.1-REVIEW-DISPOSITION.md` were not raised again.

The earlier `12-REVIEW.md` (2026-11-18) is replaced by this file per D-79; it stays in git history. `12-REVIEW-ALL.md` stays as a record.

Spot-checked against source by the orchestrator: G4-WR-04 and G2-WR-02 (both confirmed).

## Summary

| Group | Scope | Files | Critical | Warning | Info |
|---|---|---|---|---|---|
| G1 | Backend source (Domain, Application, Infrastructure, Server) | 33 | 0 | 0 | 4 |
| G2 | Backend tests and fixtures | 37 | 0 | 3 | 4 |
| G3 | Web source | 34 | 0 | 2 | 5 |
| G4 | Web unit and node tests | 28 | 0 | 5 | 4 |
| G5 | E2E, web scripts, web config, docs | 22 | 0 | 3 | 3 |
| Carried | Owner ruling D-80 (from 12-REVIEW-ALL) | | 0 | 1 | 0 |
| **Total** | | **154** | **0** | **14** | **20** |

## Carried finding (owner ruling D-80)

The G1 reviewer did not raise the dead consent and visit domain code because D-56 kept it. The owner ruled on 2026-11-20 (D-80) to remove the dead code and keep the tables, so the finding is carried here from `12-REVIEW-ALL.md` for the fix pass.

##### D80-WR-01: Dead domain code from the removed consent and visit design

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

**Owner ruling:** D-80: remove the dead code, keep the seven tables, their entities, EF configurations and the four migrations. No schema change. Do not remove the entity classes.

**Fix:** Keep each entity class (EF needs it) and its configuration. Delete the factories, `ConsentSource`, `VitalMetric`, `DeviceDimension`, `VitalBounds`, `DeviceKind` and the `ReferrerName` name constants. Keep `ReferrerName.MaxLength`, or move it to the configuration. Retention tests can seed old rows with a test-only helper that uses `SetValues` or raw entity setters.





---

## G1 report: Backend source (Domain, Application, Infrastructure, Server)

## Phase 12: Code Review Report (G1, backend source)

**Reviewed:** 2026-11-20T10:00:00-06:00
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

### Summary

All 33 files were read in full. I traced the page view path end to end: controller (CSRF header, size limit, rate limit) to handler (validate, bot gate, staff gate, cut path, route table) to `PageViewCounts` (atomic update, insert on first view, retry on a unique-key clash), and the stats and CSV path from controller to reader.

Verified sound:

- Gates and privacy: every gate answers success, so a bot or staff caller learns nothing. No IP, User-Agent or referrer is stored or logged. `PathString` cannot throw, because `AnalyticsPath.Cut` guarantees a leading slash first. Only the eight fixed page keys can reach the table.
- Auth and cookies: `VisitorStatsController` is `[Authorize(Policy = Policies.Manager)]` at class level, and the anonymous controllers declare `[AllowAnonymous]` explicitly. The retired-cookie delete options match how each cookie was set (path, Secure, SameSite).
- Time, SQL and CSV: the business day comes from `IBusinessCalendar`, never `DateTime.Now`. There is no inline SQL: only LINQ and `ExecuteUpdate`/`ExecuteDelete`. CSV cells cannot start a formula, and the file name holds only validated dates.
- Retention: the `AnalyticsPageViews` and `AnalyticsVitalSamples` foreign keys cascade from `AnalyticsVisits`, so the raw purge cannot hit a foreign key error whatever the sample's own business day is.

No bug, security hole or rule break was found. The items below are low-risk quality points. Items already settled in `12.1-REVIEW-DISPOSITION.md` (the double per-address window, the endpoint-name key, `SaltDays`, the non letter-led CSV key, the 429 wording, the testing seed offset) are not repeated. Unused domain types such as `DeviceKind`, `VitalBounds` and `ReferrerName` are covered by D-56 (tables and entities stay until the owner-approved drop) and are not raised.

### Info

#### G1-IN-01: Beacon body cap is smaller than the longest path the validator accepts

**File:** `src/Csps.Server/Controllers/AnalyticsController.cs:32` (with `src/Csps.Application/Analytics/PageViewRequestValidator.cs:25`, `src/Csps.Domain/Analytics/AnalyticsPath.cs:10`)
**Issue:** `[RequestSizeLimitMetadata(2048)]` caps the whole JSON body at 2,048 bytes. The validator allows a path of up to 2,048 characters, and the JSON wrapper `{"path":"..."}` adds 10 bytes before any escaping. A path of about 2,039 to 2,048 characters is a valid path by the validator but is refused with a 413 before it is read. No real route is that long, and every unknown path folds into `not-found` anyway, so the effect is a mismatched limit, not a defect users will hit.
**Fix:** Give the body cap headroom for the wrapper and escaping, for example `[RequestSizeLimitMetadata(4096)]`, or lower `AnalyticsPath.MaxLength` and the validator to 1,024 so the two limits agree.

#### G1-IN-02: Five rate-limit rule classes repeat the same `Default` and `Validate` code

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

#### G1-IN-03: Comments narrate history, against OR-2

**File:** `src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs:11-12`, `src/Csps.Server/Security/AnalyticsCookies.cs:4`
**Issue:** The retention job summary says "Nothing is rolled up any more", and the `AnalyticsCookies` summary says "The server sets no consent or visitor id cookie any more". Both describe what the code used to do. The project rule (OR-2, global writing style) is that comments say what the code does and carry no history.
**Fix:** `AnalyticsRetentionJob`: "Each rule only removes rows past its cut date; a database failure in one rule is logged and reported as that rule's failed line, and the other rules still run." `AnalyticsCookies`: "The staff marker cookie and its attributes (D-21). The two retired names are in <see cref="RetiredCookies"/> (D-63)."

#### G1-IN-04: Testing controller keeps its own copy of the page key list

**File:** `src/Csps.Server/Controllers/TestingAnalyticsController.cs:38-40`
**Issue:** `KnownPages` lists the eight page keys by hand. `PageNames.Ordered` (Application) already holds the same eight keys and is what the CSV export uses, and a test guards it against the web copy. A new page key would have to be added in `PageKeys`, `PageNames`, `PublicPageResolver.KeyOf` and here, and nothing fails if this list is forgotten. Testing builds only, so low risk.
**Fix:** Build the set from the shared list: `new(PageNames.Ordered.Select(static page => page.Key), StringComparer.Ordinal)`.

---

_Reviewed: 2026-11-20T10:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---

## G2 report: Backend tests and fixtures

## Phase 12 (G2): Code Review Report, backend tests and fixtures

**Depth:** standard
**Files reviewed:** 37
**Status:** issues_found

### Summary

The suite is in good shape. Handler, reader, CSV, retention and export tests assert exact values and fail for the right reasons. Checked and found sound:

- Clocks: tests use `FakeTimeProvider` or a fixed calendar. The only real-clock reads are the documented token lifetime and a midnight-tolerant `before`/`after` business-day check.
- Isolation: all database tests go through `CspsDatabase` (`CSPS_Test_<guid>`).
- Auth matrix: it has a row for `visitor-stats`, `visitor-stats/export`, `page-views` and `/api/testing/analytics`, and the removed routes are gone from the matrix, allow-lists and rate-limit table.
- Races: first-view insert races are covered in `PageViewCountsTests` (outside this group).
- Rounding: the share-rounding expectations hold under largest-remainder arithmetic.
- Fixtures: the fixtures match production, and `public-paths.json`, `legal-pages.json` and `page-names.json` are each compared against code.

No hard-coded secrets, real infra names or real emails. Gaps are an untested body cap, one test that cannot fail on the thing it names, and thin retention coverage for the budget stop.

### Warnings

#### G2-WR-01: The 2048-byte body cap on `POST /api/v1/analytics/page-views` has no test

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs` (no test; production control at `src/Csps.Server/Controllers/AnalyticsController.cs:32`)
**Issue:** The beacon is anonymous, and its only body guard is `[RequestSizeLimitMetadata(2048)]`, enforced by `RequestBodyLimitMiddleware.LimitFor` after routing. This tightens the global 1 MiB cap for the route. No test sends a body over 2048 bytes to this route. `RequestBodyLimitTests` only exercises the 1 MiB default, and `UploadNoDiskTests` only reads the upload attribute. If the attribute were dropped or the middleware moved before routing (`GetEndpoint()` would be null), the route would silently accept 1 MiB bodies and every test here would still pass. The handler-level "path too long" test cannot reach this, because the body is refused before the handler. The unit test only proves the validator.
**Fix:** Add to `PageViewCollectTests`:
```csharp
[Fact]
public async Task ABodyOverTheCapIs413AndCountsNothing()
{
    await database.ResetAsync();
    await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
    using var client = NewClient(factory);
    var body = "{\"path\":\"/" + new string('a', 2048) + "\"}"; // well over 2048 bytes
    using var response = await PostAsync(client, body);
    response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
    (await ReadRowsAsync()).ShouldBeEmpty();
}
```
Also add a body of exactly 2048 bytes that gets 204 or 400 and never 413, to pin the boundary. A chunked variant (no Content-Length) is worth adding too.

#### G2-WR-02: `TheCeilingLeavesOtherRoutesAlone` cannot fail if the ceiling never engages

**File:** `tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs:179-188`
**Issue:** The four page-view responses are discarded (`using var page = await ...`) and never asserted. The test then asserts only that `/api/v1/public/site` answers 200. It passes the same way if the ceiling is misconfigured, keyed on the wrong endpoint name (the IN-G1-03 risk), or not applied at all. It proves "other routes are unaffected" only when the ceiling was actually tripped.
**Fix:** Assert the trip before the unrelated read:
```csharp
var statuses = new List<HttpStatusCode>();
foreach (var address in new[] { "203.0.113.81", "203.0.113.82", "203.0.113.83", "203.0.113.84" })
{
    using var page = await PostPageViewAsync(client, address);
    statuses.Add(page.StatusCode);
}
statuses.ShouldBe([HttpStatusCode.NoContent, HttpStatusCode.NoContent, HttpStatusCode.NoContent, HttpStatusCode.TooManyRequests]);
```

#### G2-WR-03: Retention budget stop and batching are only tested for raw page views

**File:** `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs:136-160, 194-210, 261-277`
**Issue:** `AnalyticsRetentionJob.DrainAsync` returns `More` when a full batch is deleted and the budget is spent. Only the raw-visits rule is tested that way (`ASpentBudgetAfterTheFirstPageViewBatchStopsWithMore...`). The daily-totals rule drains three tables (`DailyPageCounts`, `DailyReferrerCounts`, `DailyDeviceCounts`), and the salt and consent rules each have a `More` path too. A backlog of more than 500 rows is tested only for `DailyPageCounts` and consent, never for `DailyReferrerCounts` or `DailyDeviceCounts`. After phase 12.1 those two tables are no longer written, so the job's main remaining work on them is draining the legacy backlog. A mistake in one step (wrong `OrderBy` or `Take`, a step that never loops) would pass the current suite.
**Fix:** Add two cases using the existing `SpendBudgetAfterFirst`/`CommandCounter` hooks:
- Seed more than 500 old `DailyReferrerCounts` and more than 500 old `DailyDeviceCounts`. Assert that the DELETE count per table is 2 or 3 and the line total is exact.
- Seed more than 500 old daily page rows, spend the budget after the first `DELETE|DailyPageCounts`, and assert `report.More` is true and the salt line is absent. Do the same for consent.

### Info

#### G2-IN-01: Stale "nine page keys" in a doc comment

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PublicPageResolverTests.cs:8`
**Issue:** The summary says "one of the nine page keys". `PageKeys` and `PageNames` hold eight (the fixture and `AnalyticsPathTests.PageKeysAreTheEightLowercaseNames` agree).
**Fix:** Say "eight".

#### G2-IN-02: Duplicated HTTP helpers

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs:306-326` and `tests/Csps.Server.IntegrationTests/Analytics/AnalyticsHttp.cs:14-34`
**Issue:** `PageViewCollectTests.NewClient` is the same as `AnalyticsHttp.NewClient`. `PageViewCollectTests.NewPost` is a near copy with a User-Agent option. `AnalyticsRateLimitTests` uses the first copy and `RetiredCookiesTests` uses the second, so a header change has to be made in two places.
**Fix:** Add the `userAgent` parameter to `AnalyticsHttp.NewPost` and delete the copies in `PageViewCollectTests`.

#### G2-IN-03: Real sleep and a sync query inside async tests

**File:** `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs:181` and `tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs:67`
**Issue:** The log-privacy test waits `Task.Delay(500)` on the real clock before reading the in-memory sink, but the sink is synchronous and request completion events are written before the response ends, so the sleep adds time and hides nothing. `context.DailyPageCounts.Sum(...)` is a blocking EF call inside an async test.
**Fix:** Remove the delay. Use `await context.DailyPageCounts.SumAsync(row => row.Views, TestContext.Current.CancellationToken)`.

#### G2-IN-04: Test name overstates what it checks; limits hard-coded in the factory

**File:** `tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs:23-43` and `tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs:56-57`
**Issue:** `OnlyThePageViewAndCeilingRulesRemainForAnalytics` asserts only that the one `[EnableRateLimiting]` policy is `AnalyticsCollect`. The ceiling is not an attribute and is not checked there. `RealLimitsFactory` repeats 120 and 600 as literals instead of reading `AnalyticsCollectRateLimit.Default()` and `AnalyticsCeilingRateLimit.Default()`. A default change then makes the "real limits" host differ from production without a test saying so, apart from the two pinning tests.
**Fix:** Rename the test (drop "AndCeiling"). In `RealLimitsFactory`, set the values from the `Default().PermitLimit` constants.

---

_Reviewed: 2026-11-20T09:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer), group G2_
_Depth: standard_

---

## G3 report: Web source

## Phase 12: Code Review Report, group G3 (web source)

**Reviewed:** 2026-11-20
**Depth:** standard
**Files Reviewed:** 34
**Status:** issues_found

### Summary

The web side of Phase 12 plus the Phase 12.1 simplification is in good shape. The beacon sends only the path, drops failures, loads its service lazily and skips admin and dev paths. The Visitor Stats service refuses a bad count, bucket, CSV header, CSV row or file name instead of drawing a wrong figure, and the CSV format matches the server (`Date,Page,Page views`, CRLF, `visitor-stats-{from}-to-{to}.csv`). No leftover consent, cookie banner or `circle-x` code remains in `web/src` (grep clean), no unused recipe exports, no long dashes, and styles that carry a runtime value go through CSS variables on the React style object (CSP safe). The map setting reads and writes are fully guarded. No critical issues found. Two warnings and five info items below. Items already settled in the 12.1 review disposition (map wording, "These two settings", `showContactBar` alias, 3-column KPI grid, referrer names in the dev list) are not repeated.

### Warnings

#### G3-WR-01: A failed "business today" lookup replaces valid Visitor Stats figures with an error page

**File:** `web/src/modules/admin/pages/VisitorStatsPage.tsx:184` (cause at `web/src/modules/admin/hooks/useVisitorStatsToday.ts:13`)
**Issue:** `useVisitorStatsToday` keeps the last known date (`today: state.today ?? last`) so the range inputs and the stats query keep working after the held answer goes stale. But it spreads `...state`, so `isError` still comes straight from `useBusinessTodayState`, where it is true whenever no fresh answer is held and the probe's last refetch failed. `VisitorStatsRoute` computes `noToday = custom && todayFailed` from that flag alone, and `failed={noToday || ...}` then swaps the whole page body for `ErrorState`, even though `today` is non-null (the kept date), the stats query has data, and the custom range is perfectly usable. Sequence: custom range open, more than 5 minutes pass (held answer stale, probe enabled), a window-focus refetch of the probe fails on a network blip: the page body is replaced by "Couldn't load the visitor stats" and the working figures vanish. The hook's own test ("keeps the date after the answer goes stale") only asserts `isError` is false for a successful stale case, so this path is untested.
**Fix:** Report the failure only when there is truly no date.
```ts
// useVisitorStatsToday.ts
const today = state.today ?? last;
return { ...state, today, isError: state.isError && today === null };
```
Add a test: after the answer goes stale, make the probe reject and expect `today` still set and `isError` false.

#### G3-WR-02: Month bars carry no year, so a multi-year trend repeats the same labels

**File:** `web/src/components/data/VisitorTrendChart.tsx:79-82` (drawn at line 220-224)
**Issue:** For `bucket === 'month'` the axis label is `formatMonthShort(start)`, which is only "Jan", "Feb" and so on. The server picks month buckets for any range over 62 days, and a custom range may span 3 years (36 bars). Such a chart reads "Jan ... Dec, Jan ... Dec, Jan ... Nov" with nothing marking which year a bar belongs to. The tooltip and keyboard announcement do include the year, but a sighted visitor scanning the axis (and anyone on a touch screen without hover) cannot tell the years apart. Skipped labels (`labelStep`) make it harder still.
**Fix:** Add the year to the label of the first bar and of each January when the range crosses a year boundary, for example:
```ts
function shortLabel(start: string, bucket: TrendBucketSize, showYear: boolean): string {
  if (bucket === 'month') {
    const month = formatMonthShort(start) ?? start;
    return showYear && start.slice(5, 7) === '01' ? `${month} ${start.slice(0, 4)}` : month;
  }
  ...
}
```
Pass `showYear = from.slice(0, 4) !== to.slice(0, 4)`, and widen `MIN_LABEL_GROUP` for those labels so they do not overlap.

### Info

#### G3-IN-01: Export CSV can save a different range than the one the toolbar shows

**File:** `web/src/modules/admin/pages/VisitorStatsPage.tsx:176,196`
**Issue:** `applied` starts as `wanted ?? DEFAULT_QUERY`. Opening a shared custom-range link first resolves `wanted` to null (today unknown), so `exportQuery` is the default last 30 days while the select already reads "Custom range". If the business-today lookup then fails (the `noToday` error state, no figures shown) the toolbar stays on screen and Export CSV is still enabled and saves the last 30 days. The toast names the dates, so it is not silent, but the file does not match what the select says.
**Fix:** Disable Export CSV (or pass `exportQuery` as null and have the toolbar disable the button) while `custom && wanted === null && applied` was never set from the URL, or while `noToday`.

#### G3-IN-02: Footer Legal links ignore a trailing slash for `aria-current`

**File:** `web/src/modules/public/components/SiteFooter.tsx:135`
**Issue:** `pathname === link.to` fails for `/privacy/`, which the router still matches. `PublicLayout.currentSiteLink` already strips trailing slashes for the header, so the two navs disagree on the same URL and the current legal page is not marked for screen readers.
**Fix:** `const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;` and compare `path === link.to` (share one helper with `currentSiteLink`).

#### G3-IN-03: Range text is built twice

**File:** `web/src/modules/admin/pages/VisitorStatsPage.tsx:49-55` and `web/src/components/data/VisitorTrendChart.tsx:91-96`
**Issue:** `rangeText` and `rangeName` both format "Oct 17 to Nov 15, 2026" with the same same-year trim regex; the second adds a `?? from` fallback the first does not. The wording lives in two copy functions (`COPY.dates` and `VISITOR_TREND_COPY.groupName`), so a future change to the format can drift.
**Fix:** Export one `formatRangeText(from, to)` from `@/utils/format` and use it in both places.

#### G3-IN-04: Privacy Policy describes quote-request collection for a form that is not live

**File:** `web/src/modules/public/legalPrivacy.ts:35,64-67,130-133`
**Issue:** The policy says "When you send a quote request: the details you type into the form, and any files you attach", gives a basis for it and a 6-month retention, while `copy.ts:225` says the inquiry form returns in Phase 13 and the Contact page today only offers Messenger and phone. The page is still a draft (`approved: false`), and the wording is the owner's (D-73), so this is for the owner's review, not a code defect.
**Fix:** Owner to decide: keep it as forward-looking text, or mark the quote-request lines to be added when the form ships.

#### G3-IN-05: MapCard header comment still opens with the pre-D-65 rule

**File:** `web/src/modules/public/components/MapCard.tsx:1-5`
**Issue:** Lines 2-3 say the Google frame loads only after the tap and "no Google request is made before the tap", then line 6 says a saved tap loads it on later visits. The first paragraph is now false for returning visitors and could mislead the next reader.
**Fix:** Reword lines 2-3, for example: "Until the visitor taps Show Map once (saved in this browser, D-65) the drawing stays; only then does the Google frame load."

---

_Reviewed: 2026-11-20_
_Reviewer: Claude (gsd-code-reviewer), group G3_
_Depth: standard_

---

## G4 report: Web unit and node tests

## Group G4: Web unit and node tests, code review

*Created: 2026-11-20T10:00:00-06:00 · Updated: 2026-11-20T10:00:00-06:00*

**Depth:** standard. **Files reviewed:** 28 (all read in full or by the phase diff where the change was small; source under test read where a claim needed checking).

### Summary

The suite is in good shape overall. No blocker was found. No test leaks an MSW handler: `setup.ts` resets handlers in `afterEach` and the per-file `server.use` calls are all reset. No em dash, en dash or U+2212 appears in any of the 28 files (OR-4 clean). Time zone handling is sound: the stale-line test (`9:41 AM` from `01:41Z`) works because `formatBusinessTime` pins `Asia/Manila`, and the chart and stats tests build dates with `Date.UTC`.

The real problems are tests that cannot fail, or scans that can skip input:

- One synchronous "no request was sent" assertion that passes before any request could arrive.
- One guard test whose block kind no longer exists in the type.
- One axe test that swallows a missing toast.
- The cookie inventory reads a fixed pair of C# files, so a cookie added in a new file is never seen.
- Negative beacon tests rely on a fixed 60 ms sleep.

Nothing from `12.1-REVIEW-DISPOSITION.md` is re-raised.

### Warnings

#### G4-WR-01: "asks for nothing while it is not enabled" asserts before a request could arrive

**File:** `web/src/modules/admin/hooks/useVisitorStatsToday.test.tsx:60-67`

**Issue:** The test renders the hook with `enabled = false` and checks `backend.lists` has length 0 on the very next line. `backend.lists` is filled inside the MSW handler (`web/src/test/orderFixtures.ts:673`), which runs only after the request travels through the interceptor, so it is asynchronous. If the hook wrongly fetched, the push would happen after the assertion. The test passes whether or not the `enabled` guard works (vacuous). The sibling tests await state with `waitFor`; this one does not.

**Fix:** Give a wrongly sent request time to land, and also check the query state directly:

```tsx
it('asks for nothing while it is not enabled', async () => {
  const backend = useOrderHandlers({ list: buildOrderList([], { today: '2026-10-30' }) });

  const { result } = renderToday(false);
  await new Promise<void>((resolve) => setTimeout(resolve, 50));

  expect(result.current.today).toBeNull();
  expect(client?.isFetching()).toBe(0);
  expect(backend.lists).toHaveLength(0);
});
```

#### G4-WR-02: Cookie inventory scans a fixed pair of files and only prefixed names, so a new cookie is skipped silently

**File:** `web/src/test/cookie-inventory.node.test.ts:12, 17, 78-83`

**Issue:** The header says "a cookie added to or taken out of the code fails here until the policy text changes too". That holds only for edits inside `AuthCookies.cs` and `AnalyticsCookies.cs`. `CODE_FILES` is a hard-coded list, so a cookie constant put in any other file under `Security/` (or anywhere in `src/`) is never read and the test stays green while the policy omits it. The `CODE_NAME` pattern also needs a `__Host-` or `__Secure-` prefix, so a constant such as `"csps_x"` (no prefix) is skipped even in the two files. The "keeps the retired names out of the files the inventory reads" test is likewise true by construction: the file list never includes `RetiredCookies.cs`. The reading guard `names.length > 0` only proves each listed file has one match.

**Fix:** Discover the files instead of listing them, and match the bare name too:

```ts
import { readdirSync } from 'node:fs';
const CODE_FILES = readdirSync(SECURITY_DIR).filter((f) => f.endsWith('.cs') && f !== RETIRED_FILE);
const CODE_NAME = /"((?:__Host-|__Secure-)?csps_[a-z0-9]+)"/g;
```

Better still, also scan `src/Csps.Server/**/*.cs` for `Cookies.Append(` and assert each call site uses a constant from a scanned file, so a literal name cannot slip through. Keep the `RetiredCookies.cs` read separate, as it is now. Note that `ImageNamedSizes.cs` contains `"csps_full_2000"` style strings, so a repo-wide name scan must keep the cookie prefix or the `Cookies.Append` anchor.

#### G4-WR-03: "has no block that opens Cookie Settings" can never fail

**File:** `web/src/test/legal-content.node.test.ts:174-179`

**Issue:** The test collects `block.kind` for every block and asserts none equals `'cookie-settings'`. That kind was removed from `LegalBlock` (`legalContent.ts:9-21` now has only `p`, `ul`, `dl`, `h3`, `facts`), and `grep` finds the string `cookie-settings` nowhere in `modules/public`. The array is typed `string[]` so the compiler does not object. The assertion is permanently true and gives false assurance that the D-54 removal is guarded.

**Fix:** Replace it with a check that fails on any unknown kind, which also covers a future retired kind coming back:

```ts
const KNOWN_KINDS = new Set(['p', 'ul', 'dl', 'h3', 'facts']);
it.each(textFiles)('%s uses only the known block kinds', async (file) => {
  const kinds = (await textsOf(file)).flatMap((text) =>
    text.sections.flatMap((section) => section.blocks.map((block) => block.kind as string)),
  );
  expect(kinds.filter((kind) => !KNOWN_KINDS.has(kind))).toEqual([]);
});
```

#### G4-WR-04: Axe test "with the export toast shown" passes when no toast is shown

**File:** `web/src/modules/admin/pages/VisitorStatsPage.test.tsx:1016-1027` (swallow at line 1024)

**Issue:** `await screen.findByText('Visitor stats exported', {}, { timeout: 3000 }).catch(() => null);` discards the failure and nothing asserts afterwards that the toast exists. If the export never completes or the toast never renders, axe runs on the bare page and the test is green, while its title says the toast was checked. Because the file's other export tests are the only ones asserting the toast, a regression in toast timing would pass this test silently.

**Fix:** Do not catch, so the wait itself is the assertion:

```tsx
await user.click(screen.getByRole('button', { name: 'Export CSV' }));
expect(await screen.findByText('Visitor stats exported', {}, { timeout: 3000 })).toBeInTheDocument();

await expectNoAxeViolations(container);
```

#### G4-WR-05: Negative beacon tests wait a fixed 60 ms, which can end before the unwanted send happens

**File:** `web/src/modules/public/hooks/usePageViewBeacon.test.tsx:25, 101-118, 150-161`; `web/src/layouts/PublicLayout.test.tsx:485-499`

**Issue:** "Does not send for /admin, /dev, when hidden, after a repeat click" all end with `await settle()` (60 ms) and then assert zero or unchanged requests. An unwanted send goes through a dynamic `import('../services/analyticsService')`, the HTTP client and the MSW interceptor. On a cold module (a test run alone with `-t`, or a busy CI box with the React Compiler transform) that can take longer than 60 ms, so a real regression would pass. This is the "passes before the awaited state happens" pattern. The positive tests in the same files use `waitFor`, which is correct.

**Fix:** Add a positive control that must arrive after the path under test, and assert only that nothing came before it. For example, in the `skips %s` test, navigate to a counted path next and wait for it:

```tsx
// after rendering at the out-of-scope path
await userEvent.click(screen.getByRole('link', { name: 'Products' }));
await waitFor(() => {
  expect(probe.requests).toHaveLength(1);
});
expect(probe.requests[0]?.body).toEqual({ path: '/products' });
```

Requests are sent in order, so if the earlier path had been sent it would be request 0. The same shape fits the PublicLayout `/dev` and `/admin` test.

### Info

#### G4-IN-01: Hard-coded "Version 1.0" in a test whose header says the facts come from the fixture

**File:** `web/src/modules/public/pages/LegalPages.test.tsx:85` (header at lines 1-4)

**Issue:** `expect(version).toHaveTextContent(/^Version 1\.0 · /)` pins the version, while the file header says the owner's later yes (D-73) changes the fixture only, not these tests. When the owner approves and the fixture moves to `1.1` or `2.0`, this one line fails for no reason. The line above already checks the full version line against the fixture.

**Fix:** Delete the line, or build it from the fixture: `new RegExp(`^Version ${shared('privacy').version.replace('.', '\\.')} · `)`.

#### G4-IN-02: Stubbed `URL.createObjectURL` and `revokeObjectURL` are never removed

**File:** `web/src/modules/admin/pages/VisitorStatsPage.test.tsx:888-900`; `web/src/modules/admin/downloadCsv.test.ts:17-29`

**Issue:** Both files install the two functions with `Object.defineProperty(URL, ..., { configurable: true })`. `restoreMocks` and `vi.restoreAllMocks()` undo only `vi.spyOn`, so the stubs (jsdom has none) remain for the rest of the file, with the closure of the last test. Harmless today because files are isolated and each user redefines them, but a later test in the file that expects the real absence would be fooled.

**Fix:** Delete them in `afterEach`: `Reflect.deleteProperty(URL, 'createObjectURL'); Reflect.deleteProperty(URL, 'revokeObjectURL');`. A shared helper in `src/test/` would remove the duplicate too.

#### G4-IN-03: Only the Accessibility module is asserted to exist in the legal text scan

**File:** `web/src/test/legal-content.node.test.ts:15-18, 156-158`

**Issue:** `textFiles` is built from `readdirSync` plus a name pattern. The guard `finds the Accessibility text module` is the only check that discovery works. If `legalTerms.ts` were renamed so it no longer matches `/^legal.*\.ts$/`, the shape, dash and link checks would skip the Terms text with no failure (the Privacy text is also imported directly by `cookie-inventory.node.test.ts`, Terms is not).

**Fix:** `expect(textFiles).toEqual(expect.arrayContaining(['legalAccessibility.ts', 'legalPrivacy.ts', 'legalTerms.ts']))`.

#### G4-IN-04: `.catch(() => null)` on `findBy` calls hides the real failure message

**File:** `web/src/modules/admin/pages/VisitorStatsPage.test.tsx:959, 981, 1005`

**Issue:** The "exported", "Exporting" and "failure toast" tests wrap `findBy*` in `.catch(() => null)` and then assert on `title?.textContent` or `busy?.getAttribute(...)`. They still fail when the element is missing (undefined is not the expected value), so they are not vacuous, but the failure reads "expected undefined to be ..." instead of the DOM dump and timeout message that `findBy*` gives.

**Fix:** Drop the `.catch` and assert on the returned element: `expect(await screen.findByText('Visitor stats exported', {}, { timeout: 3000 })).toBeInTheDocument();`.

---

_Reviewed: 2026-11-20T10:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer), group G4_
_Depth: standard_

---

## G5 report: E2E, web scripts, web config, docs

## Group G5 code review: Playwright E2E, web scripts and config, docs

*Created: 2026-11-20T09:00:00-06:00 · Updated: 2026-11-20T09:00:00-06:00*

**Depth:** standard. **Files:** 22. **Status:** issues_found.

### Summary

The structural changes are sound.
- Playwright still uses port 5199, `reuseExistingServer: false` and HTTPS. No forbidden port appears in the files reviewed.
- Budget limits are unchanged (public 150 KB, admin 250 KB, CSS 35 KB, 1 KB = 1000 B, `<=` passes). The cookies route was removed consistently from `budget.ts`, `budget.test.ts` and `vite-budget-plugin.test.ts` (nine to eight rows, four to three legal rows).
- `package.json` only lost `web-vitals`. Every remaining pin is exact. No forbidden package is present and `web-vitals` is gone from the lock file.
- The rate-limit env keys in `playwright.config.ts` and `owner-review.mjs` match the server keys (`RateLimits__AnalyticsCollect`, `RateLimits__AnalyticsCeiling`).
- I found no sensitive data (real server or database names, connection strings, ids, local paths) in the tracked files of this group.

The real problems are in two E2E specs that cannot fail on the regression they are named after (WR-01, WR-02, WR-03), plus stale docs.

### Warnings

#### G5-WR-01: "A signed-in Manager's page view adds nothing" can pass when the view is wrongly counted

**File:** `web/e2e/visitor-stats.spec.ts:198-204`
**Issue:** The test reads the Terms of Use count from the `Most viewed pages` list, which `VisitorStatsResponse.TopPages` caps at 5 pages (`src/Csps.Application/Analytics/VisitorStatsResponse.cs:21`). `listCount` returns 0 when the row is absent.
- Terms is one of about eight tallied pages. Home, Products, Gallery and Contact are hit by almost every other spec, so Terms will often sit outside the top 5.
- Then `before` is 0 and `after` is 0, whether or not the Manager's view was counted. The comment "the row moves only if this Manager's view is counted" is only true while Terms is in the top 5.
- The phase 12.1 review fixed the same top-5 problem for the first test (WR-G3-01) but not for this one.

**Fix:** Read the exact per-page figure from the CSV export, which lists every page, instead of the top 5 list. Under `withSiteContentLock`, export today's range before and after the Manager opens `/terms`, and compare the `Terms of Use` row. Or compare the `Page views` KPI total, as the first test does, and accept that this is only exact if no other spec counts views while the lock is held. For example:
```ts
const termsToday = async () => /* parse the downloaded CSV for manilaDate(0) + ',Terms of Use,' */ 0;
const before = await termsToday();
await openCounted(page, '/terms');
expect(await termsToday()).toBe(before);
```

#### G5-WR-02: The "Manager sees each count rise" test is satisfied by other projects' traffic

**File:** `web/e2e/visitor-stats.spec.ts:162-173`
**Issue:** The test sends 3 views and asserts `after >= before + 3` on the shared Page views total. The file header says five projects and every other public spec add views to the same CSPS_E2E database at the same time. If the server stopped counting one of the three views (for example `/gallery`), concurrent views from the other workers could still lift the total past `before + 3`, so the test would pass. It cannot catch an undercount, which is the regression it names. It also does not check which pages were counted: `Products` and `Gallery` are never read.
**Fix:** Make the three pages ones that no other spec visits outside the site content lock, and check each page's own row in the CSV export, not the total. `/terms`, `/accessibility` and `/privacy` are only opened by the sweep specs under `withSiteContentLock`, so wrap this test in the lock and use those three pages. Then assert each row rises by exactly 1.

#### G5-WR-03: The `@no-cookies` checks are narrower than the claim

**File:** `web/e2e/no-cookies.spec.ts:36-51`
**Issue:** The plain and GPC tests prove "no cookie, no tracker" with `context.cookies() == []` after `networkidle`. Three gaps:
- The test never waits for or asserts the page view POST to `/api/v1/analytics/page-views`, the one endpoint most likely to set a cookie. If the beacon did not fire (for example it was held back by a client rule), the empty jar says nothing about it. The old-cookie test below does wait for that response.
- It does not look at the `Set-Cookie` header of any response. A cookie the browser rejected (a `__Host-` cookie with a bad attribute) would leave an empty jar although the server tried to set it.
- It never checks `localStorage` or `sessionStorage` (the "tracker" half of the test name). The saved map setting is a legitimate localStorage key, but a visitor id written there would pass.

**Fix:** In `expectNothingStored`, wait for the beacon and check headers and storage:
```ts
const counted = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/v1/analytics/page-views');
await openQuietly(page, '/');
const answer = await counted;
expect(await answer.headerValue('set-cookie')).toBeNull();
// at the end, for both pages:
expect(await page.evaluate('({ ...localStorage, ...sessionStorage })')).toEqual({});
```
Also record `set-cookie` on every response with `response.allHeaders()` and assert none.

### Info

#### G5-IN-01: `docs/web/e2e.md` describes the old first `@visitor-stats` check

**File:** `docs/web/e2e.md:130`
**Issue:** The row says the Manager sees "each of those page counts in `Most viewed pages` rise by at least one". Since fix `85bef3af` the test reads the Page views KPI total (`kpiCount(manager, 'Page views')`), and the header of the spec itself says the top 5 list is the wrong place to look. The doc is not accurate against the code.
**Fix:** Change the sentence to "the Manager sees the Page views total rise by at least the three views sent".

#### G5-IN-02: Stale consent wording in project docs

**File:** `.claude/CLAUDE.md:9`, `CSPS-PRD.md:495`, `CSPS-PRD.md:525`
**Issue:** The `.claude/CLAUDE.md` project summary still lists "cookie consent" as a public site feature (its `Updated` stamp was moved to 2026-11-19 in this phase, so the line was touched but not fixed). PRD line 495 ("except auth flows and consent") and line 525 ("rate limiting on auth, consent, analytics ingestion") name a consent endpoint that no longer exists after 12.1. Related: `web/src/modules/public/hooks/usePrivacyContact.ts:1` and the generated API comments say "the four legal pages" (now three). They are outside this group's file list, so only noted here.
**Fix:** `.claude/CLAUDE.md:9`: "home, products, gallery, contact/quote, legal pages (no cookie banner)". PRD 495: drop "and consent". PRD 525: "on auth, analytics ingestion, and public endpoints". Fix "four" to "three" in the `usePrivacyContact.ts` comment and in the C# XML doc that generates `api.generated.ts`.

#### G5-IN-03: Small consistency items in the specs

**File:** `web/e2e/contact.spec.ts:43`, `web/e2e/link-preview.spec.ts:30`
**Issue:**
- `CLEAR_SAVED_MAP` hard-codes `'csps-maps'`, which is also `MAPS_KEY` in `web/src/modules/public/mapChoice.ts:6`. If the key is renamed, the "clearing the saved map" test still passes: the removal does nothing, and the check then fails only if the button does not come back.
- `link-preview.spec.ts` is the only e2e file using `import.meta.dirname`; the others use `new URL(..., import.meta.url)`.

**Fix:** Keep the literal but add an assert before the clear that the key exists (`expect(await page.evaluate("window.localStorage.getItem('csps-maps')")).not.toBeNull()`), so a rename fails loudly. Use `fileURLToPath(new URL('../../tests/fixtures/legal-pages.json', import.meta.url))` for consistency.

---

_Reviewed: 2026-11-20T09:00:00-06:00_
_Reviewer: Claude (gsd-code-reviewer), group G5_
_Depth: standard_
