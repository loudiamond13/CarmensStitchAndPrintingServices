---
phase: 12-consent-analytics-legal
created: 2026-11-18T13:55:32-05:00
updated: 2026-11-18T13:55:32-05:00
reviewed: 2026-11-18T13:55:32-05:00
depth: standard
reviewers: 5 parallel gsd-code-reviewer agents, merged
files_reviewed: 319
files_reviewed_list:
  - docs/dependencies.json
  - docs/dependencies.md
  - docs/web/budgets.md
  - docs/web/e2e.md
  - src/Csps.Application/Analytics/ClearVisitorDataHandler.cs
  - src/Csps.Application/Analytics/CollectContext.cs
  - src/Csps.Application/Analytics/CollectPageViewHandler.cs
  - src/Csps.Application/Analytics/CollectVitalsHandler.cs
  - src/Csps.Application/Analytics/ConsentCallContext.cs
  - src/Csps.Application/Analytics/ConsentDecisionResponse.cs
  - src/Csps.Application/Analytics/ConsentErrors.cs
  - src/Csps.Application/Analytics/ConsentOutcome.cs
  - src/Csps.Application/Analytics/ConsentSources.cs
  - src/Csps.Application/Analytics/ExportVisitorStatsHandler.cs
  - src/Csps.Application/Analytics/GetVisitorStatsHandler.cs
  - src/Csps.Application/Analytics/IdentifiedCollection.cs
  - src/Csps.Application/Analytics/PageViewErrors.cs
  - src/Csps.Application/Analytics/PageViewRequest.cs
  - src/Csps.Application/Analytics/PageViewRequestValidator.cs
  - src/Csps.Application/Analytics/RecordConsentHandler.cs
  - src/Csps.Application/Analytics/RecordConsentRequest.cs
  - src/Csps.Application/Analytics/RecordConsentRequestValidator.cs
  - src/Csps.Application/Analytics/VisitorIdAction.cs
  - src/Csps.Application/Analytics/VisitorKey.cs
  - src/Csps.Application/Analytics/VisitorStatsCsv.cs
  - src/Csps.Application/Analytics/VisitorStatsRequest.cs
  - src/Csps.Application/Analytics/VisitorStatsRequestValidator.cs
  - src/Csps.Application/Analytics/VisitorStatsResponse.cs
  - src/Csps.Application/Analytics/VitalsRequest.cs
  - src/Csps.Application/Analytics/VitalsRequestValidator.cs
  - src/Csps.Application/Content/GetPrivacyContactHandler.cs
  - src/Csps.Application/Content/PrivacyContactDto.cs
  - src/Csps.Application/Ports/IAnalyticsSalts.cs
  - src/Csps.Application/Ports/IAnalyticsVisits.cs
  - src/Csps.Application/Ports/IConsentRecords.cs
  - src/Csps.Application/Ports/IPageViewCounts.cs
  - src/Csps.Application/Ports/IPublicPageResolver.cs
  - src/Csps.Application/Ports/IVisitorStatsReader.cs
  - src/Csps.Domain/Analytics/AnalyticsBots.cs
  - src/Csps.Domain/Analytics/AnalyticsPageView.cs
  - src/Csps.Domain/Analytics/AnalyticsPath.cs
  - src/Csps.Domain/Analytics/AnalyticsRetention.cs
  - src/Csps.Domain/Analytics/AnalyticsSalt.cs
  - src/Csps.Domain/Analytics/AnalyticsVisit.cs
  - src/Csps.Domain/Analytics/AnalyticsVitalSample.cs
  - src/Csps.Domain/Analytics/ConsentCookie.cs
  - src/Csps.Domain/Analytics/ConsentRecord.cs
  - src/Csps.Domain/Analytics/ConsentSource.cs
  - src/Csps.Domain/Analytics/DailyDeviceCount.cs
  - src/Csps.Domain/Analytics/DailyPageCount.cs
  - src/Csps.Domain/Analytics/DailyReferrerCount.cs
  - src/Csps.Domain/Analytics/DeviceClass.cs
  - src/Csps.Domain/Analytics/NearestRank.cs
  - src/Csps.Domain/Analytics/OsFamily.cs
  - src/Csps.Domain/Analytics/PageKeys.cs
  - src/Csps.Domain/Analytics/ReferrerName.cs
  - src/Csps.Domain/Analytics/Shares.cs
  - src/Csps.Domain/Analytics/StatsBucket.cs
  - src/Csps.Domain/Analytics/StatsRangePresets.cs
  - src/Csps.Domain/Analytics/VitalMetric.cs
  - src/Csps.Domain/Analytics/VitalRating.cs
  - src/Csps.Domain/Content/LegalPages.cs
  - src/Csps.Infrastructure/Analytics/AnalyticsRegistration.cs
  - src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs
  - src/Csps.Infrastructure/Analytics/AnalyticsSaltCache.cs
  - src/Csps.Infrastructure/Analytics/AnalyticsSalts.cs
  - src/Csps.Infrastructure/Analytics/AnalyticsVisits.cs
  - src/Csps.Infrastructure/Analytics/ConsentRecords.cs
  - src/Csps.Infrastructure/Analytics/PageViewCounts.cs
  - src/Csps.Infrastructure/Analytics/TestingAnalyticsSeeder.cs
  - src/Csps.Infrastructure/Analytics/VisitorStatsReader.cs
  - src/Csps.Infrastructure/DependencyInjection.cs
  - src/Csps.Infrastructure/Maintenance/MaintenanceRegistration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/AnalyticsPageViewConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/AnalyticsSaltConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/AnalyticsVisitConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/AnalyticsVitalSampleConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/ConsentRecordConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/DailyDeviceCountConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/DailyPageCountConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/DailyReferrerCountConfiguration.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261117053718_AddConsentRecords.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261117073144_AddDailyPageCounts.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261117105658_AddAnalyticsVisits.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261117155405_AddDailyAnalyticsCounts.cs
  - src/Csps.Infrastructure/Persistence/SqlErrors.cs
  - src/Csps.Server/Composition/AnalyticsApplicationRegistration.cs
  - src/Csps.Server/Composition/ApplicationRegistration.cs
  - src/Csps.Server/Composition/ContentApplicationRegistration.cs
  - src/Csps.Server/Composition/OpenApiRegistration.cs
  - src/Csps.Server/Composition/SpaRegistration.cs
  - src/Csps.Server/Controllers/AnalyticsController.cs
  - src/Csps.Server/Controllers/ConsentController.cs
  - src/Csps.Server/Controllers/PublicSiteController.cs
  - src/Csps.Server/Controllers/TestingAnalyticsController.cs
  - src/Csps.Server/Controllers/VisitorStatsController.cs
  - src/Csps.Server/Endpoints/LegalPageCatalog.cs
  - src/Csps.Server/Endpoints/PublicPageHeads.cs
  - src/Csps.Server/Endpoints/PublicPageResolver.cs
  - src/Csps.Server/Endpoints/PublicRouteTable.cs
  - src/Csps.Server/Endpoints/SeoEndpoints.cs
  - src/Csps.Server/Endpoints/ShellPage.cs
  - src/Csps.Server/Security/AnalyticsCookies.cs
  - src/Csps.Server/Security/AuthCookies.cs
  - src/Csps.Server/Security/RateLimitSettings.cs
  - src/Csps.Server/Security/RateLimitingRegistration.cs
  - tests/Csps.Application.UnitTests/Analytics/ClearVisitorDataHandlerTests.cs
  - tests/Csps.Application.UnitTests/Analytics/CollectPageViewHandlerTests.cs
  - tests/Csps.Application.UnitTests/Analytics/CollectVitalsHandlerTests.cs
  - tests/Csps.Application.UnitTests/Analytics/ExportVisitorStatsHandlerTests.cs
  - tests/Csps.Application.UnitTests/Analytics/GetVisitorStatsHandlerTests.cs
  - tests/Csps.Application.UnitTests/Analytics/RecordConsentHandlerTests.cs
  - tests/Csps.Application.UnitTests/Analytics/RecordConsentRequestValidatorTests.cs
  - tests/Csps.Application.UnitTests/Analytics/VisitorKeyTests.cs
  - tests/Csps.Application.UnitTests/Analytics/VisitorStatsCsvTests.cs
  - tests/Csps.Application.UnitTests/Analytics/VisitorStatsRequestValidatorTests.cs
  - tests/Csps.Application.UnitTests/Content/GetPrivacyContactHandlerTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/AnalyticsBotsTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/AnalyticsPathTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/AnalyticsRetentionTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/AnalyticsVisitTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/ConsentCookieTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/ConsentRecordTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/DailyAnalyticsCountTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/DailyPageCountTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/DeviceClassTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/NearestRankTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/OsFamilyTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/ReferrerNameTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/SharesTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/StatsBucketTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/StatsRangePresetsTests.cs
  - tests/Csps.Domain.UnitTests/Analytics/VitalRatingTests.cs
  - tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj
  - tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsRetentionJobTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsVisitsTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Analytics/PageViewCountsTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Analytics/VisitorStatsReaderTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Persistence/AnalyticsVisitsMigrationTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Persistence/ConsentRecordsMigrationTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Persistence/DailyAnalyticsCountsMigrationTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Persistence/DailyPageCountsMigrationTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/AnalyticsClearTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/ConsentEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/PublicPageResolverTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/VisitorStatsExportTests.cs
  - tests/Csps.Server.IntegrationTests/Analytics/VitalsCollectTests.cs
  - tests/Csps.Server.IntegrationTests/Auth/StaffMarkerCookieTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Content/PrivacyContactEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
  - tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs
  - tests/Csps.Server.IntegrationTests/Testing/TestingAnalyticsTests.cs
  - tests/Csps.Testing/CspsApiFactory.cs
  - tests/fixtures/consent-cookie-cases.json
  - tests/fixtures/legal-pages.json
  - web/e2e/auth-overflow.spec.ts
  - web/e2e/consent-focus.spec.ts
  - web/e2e/consent.spec.ts
  - web/e2e/fixture-selftest.spec.ts
  - web/e2e/fixtures.ts
  - web/e2e/gpc.spec.ts
  - web/e2e/public-sweep.spec.ts
  - web/e2e/shell.spec.ts
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
  - web/scripts/vite-budget-plugin.ts
  - web/src/components/brand/Icon.test.tsx
  - web/src/components/brand/icons.ts
  - web/src/components/data/VisitorTrendChart.test.tsx
  - web/src/components/data/VisitorTrendChart.tsx
  - web/src/components/data/copy.ts
  - web/src/components/data/data.recipe.ts
  - web/src/components/data/index.ts
  - web/src/components/index.test.ts
  - web/src/components/money/KpiCard.tsx
  - web/src/components/money/money.test.tsx
  - web/src/components/navigation/MobileNavDrawer.test.tsx
  - web/src/components/navigation/Sidebar.test.tsx
  - web/src/components/navigation/Sidebar.tsx
  - web/src/components/navigation/index.ts
  - web/src/components/states/EmptyValue.test.tsx
  - web/src/components/states/EmptyValue.tsx
  - web/src/core/api/http/httpClient.test.ts
  - web/src/core/api/http/httpClient.ts
  - web/src/core/routes/router.test.tsx
  - web/src/core/routes/router.tsx
  - web/src/dev/previews/OpenedCookieSettings.tsx
  - web/src/dev/previews/PublicLegalNotice.tsx
  - web/src/dev/previews/StaticConsentBar.tsx
  - web/src/dev/previews/VisitorStatsParts.tsx
  - web/src/dev/previews/demoConsent.ts
  - web/src/dev/renderScenario.test.tsx
  - web/src/dev/scenarios/groups/consent.ts
  - web/src/dev/scenarios/groups/visitor-stats.ts
  - web/src/layouts/AdminLayout.test.tsx
  - web/src/layouts/PublicLayout.test.tsx
  - web/src/layouts/PublicLayout.tsx
  - web/src/modules/admin/components/DeviceBrowserCard.tsx
  - web/src/modules/admin/components/PageSpeedCard.test.tsx
  - web/src/modules/admin/components/PageSpeedCard.tsx
  - web/src/modules/admin/components/StatBarList.test.tsx
  - web/src/modules/admin/components/StatBarList.tsx
  - web/src/modules/admin/components/StatsCustomRange.tsx
  - web/src/modules/admin/components/VisitorKpiRow.tsx
  - web/src/modules/admin/components/VisitorStatsToolbar.tsx
  - web/src/modules/admin/components/VisitorTrendCard.tsx
  - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
  - web/src/modules/admin/components/showcase/showcase.recipe.ts
  - web/src/modules/admin/components/showcase/showcaseCopy.ts
  - web/src/modules/admin/components/showcase/showcaseSections.test.ts
  - web/src/modules/admin/components/showcase/showcaseSections.ts
  - web/src/modules/admin/components/visitorStats.recipe.ts
  - web/src/modules/admin/devRoutes.tsx
  - web/src/modules/admin/downloadCsv.test.ts
  - web/src/modules/admin/downloadCsv.ts
  - web/src/modules/admin/hooks/useVisitorStatsParams.test.tsx
  - web/src/modules/admin/hooks/useVisitorStatsParams.ts
  - web/src/modules/admin/hooks/useVisitorStatsQuery.ts
  - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
  - web/src/modules/admin/pages/VisitorStatsPage.test.tsx
  - web/src/modules/admin/pages/VisitorStatsPage.tsx
  - web/src/modules/admin/routes.test.tsx
  - web/src/modules/admin/routes.tsx
  - web/src/modules/admin/sections.test.ts
  - web/src/modules/admin/sections.ts
  - web/src/modules/admin/services/visitorStatsService.test.ts
  - web/src/modules/admin/services/visitorStatsService.ts
  - web/src/modules/admin/visitorStatsCopy.ts
  - web/src/modules/admin/visitorStatsRange.test.ts
  - web/src/modules/admin/visitorStatsRange.ts
  - web/src/modules/public/components/ClearDataDialog.test.tsx
  - web/src/modules/public/components/ClearDataDialog.tsx
  - web/src/modules/public/components/ConsentBar.tsx
  - web/src/modules/public/components/ConsentSlot.tsx
  - web/src/modules/public/components/CookieSettingsDialog.test.tsx
  - web/src/modules/public/components/CookieSettingsDialog.tsx
  - web/src/modules/public/components/LegalFacts.test.tsx
  - web/src/modules/public/components/LegalFacts.tsx
  - web/src/modules/public/components/LegalNotice.tsx
  - web/src/modules/public/components/LegalPage.test.tsx
  - web/src/modules/public/components/LegalPage.tsx
  - web/src/modules/public/components/LegalSection.tsx
  - web/src/modules/public/components/LegalToc.tsx
  - web/src/modules/public/components/MapCard.tsx
  - web/src/modules/public/components/PageHead.tsx
  - web/src/modules/public/components/SiteFooter.test.tsx
  - web/src/modules/public/components/SiteFooter.tsx
  - web/src/modules/public/components/consent.recipe.ts
  - web/src/modules/public/components/contact.recipe.ts
  - web/src/modules/public/components/contact.test.tsx
  - web/src/modules/public/components/legal.recipe.ts
  - web/src/modules/public/consentCookie.test.ts
  - web/src/modules/public/consentCookie.ts
  - web/src/modules/public/consentCopy.ts
  - web/src/modules/public/consentFocus.test.ts
  - web/src/modules/public/consentFocus.ts
  - web/src/modules/public/consentJar.ts
  - web/src/modules/public/consentPolicy.ts
  - web/src/modules/public/consentRules.ts
  - web/src/modules/public/consentSave.ts
  - web/src/modules/public/copy.ts
  - web/src/modules/public/hooks/useConsent.test.tsx
  - web/src/modules/public/hooks/useConsent.ts
  - web/src/modules/public/hooks/usePageViewBeacon.test.tsx
  - web/src/modules/public/hooks/usePageViewBeacon.ts
  - web/src/modules/public/hooks/usePrivacyContact.test.tsx
  - web/src/modules/public/hooks/usePrivacyContact.ts
  - web/src/modules/public/hooks/useSpeedReport.test.tsx
  - web/src/modules/public/hooks/useSpeedReport.ts
  - web/src/modules/public/legalAccessibility.ts
  - web/src/modules/public/legalContent.ts
  - web/src/modules/public/legalCookies.ts
  - web/src/modules/public/legalCopy.ts
  - web/src/modules/public/legalLoaders.ts
  - web/src/modules/public/legalPages.ts
  - web/src/modules/public/legalPrivacy.ts
  - web/src/modules/public/legalTerms.ts
  - web/src/modules/public/pages/AccessibilityPage.test.tsx
  - web/src/modules/public/pages/AccessibilityPage.tsx
  - web/src/modules/public/pages/CookiePolicyPage.test.tsx
  - web/src/modules/public/pages/CookiePolicyPage.tsx
  - web/src/modules/public/pages/PrivacyPolicyPage.test.tsx
  - web/src/modules/public/pages/PrivacyPolicyPage.tsx
  - web/src/modules/public/pages/TermsPage.test.tsx
  - web/src/modules/public/pages/TermsPage.tsx
  - web/src/modules/public/services/analyticsService.test.ts
  - web/src/modules/public/services/analyticsService.ts
  - web/src/modules/public/services/consentService.test.ts
  - web/src/modules/public/services/consentService.ts
  - web/src/modules/public/services/privacyContactService.test.ts
  - web/src/modules/public/services/privacyContactService.ts
  - web/src/modules/public/speedReport.ts
  - web/src/test/build-config.node.test.ts
  - web/src/test/consent-look.node.test.ts
  - web/src/test/consentFixtures.ts
  - web/src/test/cookie-inventory.node.test.ts
  - web/src/test/legal-content.node.test.ts
  - web/src/test/msw.ts
  - web/src/test/publicFixtures.ts
  - web/src/test/setup.ts
  - web/src/types/api.generated.ts
  - web/src/ui/app.css
  - web/vite.config.ts
findings:
  critical: 0
  warning: 14
  info: 23
  total: 37
status: issues_found
---

# Phase 12: Code Review Report (merged)

Five reviewers each took one area of the phase. Their reports are merged below, one section per group. Finding ids keep their group tag (for example WR-G1-01) so each one traces to its reviewer.

Left out of scope as generated files: migration `*.Designer.cs` files, the model snapshot, `web/package-lock.json`, `tools/openapi-gen/openapi.v1.json` and `web/THIRD-PARTY-NOTICES.txt`.

## Findings index

Every finding needs a recorded outcome (fixed, deferred with a reason, or accepted by the owner). Two group 2 items repeat group 1 findings and are counted once.

| Id | Finding | Outcome |
|---|---|---|
| WR-G1-01 | Two parallel first page views of one visitor create two visits | Open |
| WR-G1-02 | The hashed address prefix is stored for 13 months and nothing reads it | Open |
| WR-G1-03 | The visitor id and consent cookie gates can be forged, so referrer names and unique visitors can be poisoned | Open |
| IN-G1-01 | The consent id error message promises more than the rule allows | Open |
| IN-G1-02 | Vitals are dropped when the page was open more than 30 minutes | Open |
| IN-G1-03 | The privacy contact email is returned without trimming | Open |
| IN-G1-04 | Anonymous count is added before the visit work, so a failure later makes a retry double count | Open |
| WR-G2-01 | The salt cache keeps a salt one day longer than the purge job does | Open |
| WR-G2-02 | A page view or speed sample posted while the visitor clears their data answers 500 | Open |
| WR-G2-03 | One visitor id can write unlimited page view and speed sample rows, and anyone can get a visitor id | Open |
| WR-G2-04 | Row-creating anonymous endpoints are limited per address only, and an IPv6 /64 is trivially rotated | Open |
| IN-G2-01 | `AnalyticsVisits.IpHash` is written but never read | Duplicate: same issue as WR-G1-02 |
| IN-G2-02 | Two parallel first beacons start two visits for one visitor | Duplicate: same issue as WR-G1-01 |
| IN-G2-03 | The roll-up skips a day at or before the cursor, so a late row is purged without being rolled up | Open |
| IN-G2-04 | The testing seed reads the database clock before it checks the body | Open |
| IN-G2-05 | A stale doc comment and a fixed sleep in a test | Open |
| IN-G2-06 | All per-address limits assume `RemoteIpAddress` is the real client | Open |
| WR-G3-01 | Two consent sends can overlap, and a late response can overwrite the newer choice with the older one | Open |
| WR-G3-02 | Map frame stays loaded after the visitor rejects the map | Open |
| IN-G3-01 | Failed chunk loads leave the consent UI stuck, with unhandled promise rejections | Open |
| IN-G3-02 | Speed report checks a cached consent snapshot when the page hides, so withdrawal in another tab is not seen | Open |
| IN-G3-03 | A device clock that is wrong by days makes the bar come back after every choice | Open |
| IN-G3-04 | "Nothing is sent" tests rely on fixed 60 ms sleeps and can pass without proving anything | Open |
| WR-G4-01 | A failed "business today" call leaves a custom-range page loading forever with no error | Open |
| WR-G4-02 | After 5 minutes the cached business today is dropped and custom dates silently stop applying | Open |
| WR-G4-03 | A rounded display value can contradict its rating word at the thresholds | Open |
| IN-G4-01 | The service accepts any finite share and count, so a bad server number draws a wrong bar | Open |
| IN-G4-02 | A previous range with no visits keeps showing "No visits in these dates" while the next range loads | Open |
| IN-G4-03 | Export failure always says "Check your internet connection" | Open |
| WR-G5-01 | "Manager views add nothing" e2e test can fail on other specs' traffic | Open |
| WR-G5-02 | Showcase demo reconfigures the live consent store and never restores it | Open |
| IN-G5-01 | Budget doc contradicts the code and itself | Open |
| IN-G5-02 | `@visitor-stats` tag is missing from the e2e tag table | Open |
| IN-G5-03 | Realistic personal-looking address in an e2e fill (pre-existing) | Open |
| IN-G5-04 | Legal link guard accepts protocol-relative links | Open |
| IN-G5-05 | Cookie inventory guard only sees prefixed names in two C# files | Open |
| IN-G5-06 | Text mode can resolve a `string` request to `undefined` | Open |
| IN-G5-07 | Chart tooltip sticks after a mouse click on the plot | Open |
| IN-G5-08 | Thin public JS headroom on the legal and Contact routes | Open |

**Needs an owner ruling:** WR-G1-02 (drop the unused `IpHash` column: a schema change) and IN-G3-03 (any tolerance for future-dated consent cookies changes D-43).

## Group 1: Backend Domain and Application

*Created: 2026-11-18T12:00:00-05:00 · Updated: 2026-11-18T12:00:00-05:00*

**Reviewed:** 2026-11-18
**Depth:** standard
**Files Reviewed:** 86
**Status:** issues_found

### Summary

I read every source file in the Domain and Application analytics, consent and legal slices, and skimmed the unit tests (test names, harness setup, and the risky cases). I also read `src/Csps.Infrastructure/Analytics/AnalyticsVisits.cs`, `AnalyticsVisitConfiguration.cs` and the controller's cookie reading to confirm two claims below.

The code is in good shape. I found no critical issue. Time handling goes through `IBusinessCalendar` everywhere (no `DateTime.Now`). The range, cut and bucket arithmetic is correct at the edges I traced (month buckets, the 13-month cut, the 62-day switch, largest-remainder shares). The GPC rule is enforced on the server in both the consent handler and the identified gate. There is no inline SQL, no JSON column, no trigger and no mediator.

The weak spots are privacy and integrity of the stats, not crashes.

### Warnings

#### WR-G1-01: Two parallel first page views of one visitor create two visits

**File:** `src/Csps.Application/Analytics/CollectPageViewHandler.cs:83-92`
**Issue:** The handler does a read (`FindCurrentAsync`) and then a write (`StartAsync`) with no lock and no unique key. I checked the store: `AnalyticsVisits.StartAsync` is a plain insert (`src/Csps.Infrastructure/Analytics/AnalyticsVisits.cs:27-34`), and `AnalyticsVisitConfiguration.cs:34-35` has only non-unique indexes.
Failure scenario: a visitor accepts stats and the browser sends two page-view beacons close together, for example two tabs opened from a Facebook link, or the first route plus a quick client-side navigation. Both calls see no current visit. Both start one. That visitor now has two "visits" inside one sitting.
Results: the Visits total is inflated, the Referrer, Device and Browser lists are inflated (they count visits), and the visit's page-view counter is split across two rows. "One sitting, ended by 30 minutes of silence" (D-07) no longer holds.
`TouchAsync` was made atomic for exactly this concurrency (its port comment says "Many callers may touch one visit at once"), but the start path was not.
**Fix:** Make the start step safe. Options, in order of preference:
1. Serialize the find and insert per visitor: in `StartAsync`, run both in one `Serializable` transaction (no raw SQL, no trigger), and return the existing visit id when one appeared in the meantime.
2. Cheaper: after `StartAsync`, run `FindCurrentAsync` again and, if an older visit for the same hash exists inside the window, delete the new row and touch the older one.
Add a handler or integration test that calls the handler twice in parallel and expects one visit.

#### WR-G1-02: The hashed address prefix is stored for 13 months and nothing reads it

**File:** `src/Csps.Application/Analytics/CollectPageViewHandler.cs:100-112`, `src/Csps.Domain/Analytics/AnalyticsVisit.cs:52-53`
**Issue:** `NewVisitAsync` computes `HMAC(daySalt, ipPrefix)` and stores it in `AnalyticsVisits.IpHash`. A repo-wide search shows no reader of `IpHash` outside the entity, its mapping and the migrations. No stats query, roll-up or cleanup uses it. The salt is deleted after `SaltDays = 2`, so after two days the value can never be compared with a new hash either. It is a write-only personal-data-adjacent column kept for the 13-month raw retention, next to a stable `VisitorHash`.
Failure scenario: the owner or a regulator asks what the address hash is for. There is no answer in code. The Privacy Policy and the data-minimisation rule (store nothing without a purpose) are both put at risk. During the two days the salt lives, a leaked database plus the salt table lets someone brute-force the /24 or /48 prefix (about 16 million IPv4 candidates is trivial).
**Fix:** Ask the owner whether D-07 needs it. If no feature uses it, drop it: remove `IpHash`, `HashIp`, `IAnalyticsSalts`, `IRequestContext` use here and the salt table (a schema removal, so it needs the owner's approval first). If it is kept for a later feature, record the purpose in the decision log and state it in the Privacy Policy.

#### WR-G1-03: The visitor id and consent cookie gates can be forged, so referrer names and unique visitors can be poisoned

**File:** `src/Csps.Domain/Analytics/ReferrerName.cs:40-58`, `src/Csps.Application/Analytics/IdentifiedCollection.cs:17-22`, `src/Csps.Application/Analytics/CollectPageViewHandler.cs:104-112`
**Issue:** Two things combine.
1. The identified gate trusts two client-held cookies. The consent cookie is a plain string `1_<32 hex>_1.0_1_0_<today>` that the codec accepts if it parses. The visitor id passes if its format is right (`AnalyticsCookies.IsVisitorId` in the controller, `AnalyticsController.cs:94`). Neither is signed or checked against a stored record.
2. `ReferrerName.Normalize` accepts any 1 to 253 characters of letters, digits, `.` and `-`. That includes `a`, `..`, `-.-`, an IPv4 literal and a trailing-dot name such as `facebook.com.`. Any such string that is not a known group is stored as the source name.
Failure scenario: a script sets the two cookies by hand with a fresh random visitor id each time and posts page views with `referrerHost: "cheap-seo-offers.example"`. Each call starts a visit with that source. The Manager's Referrers list now shows the spam domain with a growing count, and Unique visitors goes up for every fake id. The rate limit slows this but does not stop it. Because every distinct name lands in `DailyReferrerCount`, a script that rotates names also grows that table without bound inside the retention window.
**Fix:** Two cheap changes. (a) Store only the fixed group names (Facebook, Messenger, Instagram, Google, Direct) plus one `Other site` bucket, or keep hosts only if they pass a real hostname check (labels 1 to 63 characters, no leading or trailing hyphen, at least one dot, no trailing dot). (b) Sign the visitor id: have `ISecureRandom.NewToken` return `id.mac` where the mac is an HMAC under a server key, and verify it in `IsVisitorId`. That makes the "issued only after a logged yes" rule real.

### Info

#### IN-G1-01: The consent id error message promises more than the rule allows

**File:** `src/Csps.Application/Analytics/RecordConsentRequestValidator.cs:22-23, 43-44`
**Issue:** The message says "32 lowercase letters and digits", but `IsConsentId` accepts only `0-9a-f`. A client that sends a `g`-`z` id gets a message saying it was valid in form. The class summary repeats the same wording.
**Fix:** Say "32 lowercase hex characters (0-9, a-f)" in both places and in the web zod message if it copies this text (OR-3).

#### IN-G1-02: Vitals are dropped when the page was open more than 30 minutes

**File:** `src/Csps.Application/Analytics/CollectVitalsHandler.cs:54-57`
**Issue:** The visit is found only if its last-seen time is within the 30-minute window, and a report never moves last-seen. INP and CLS are normally sent when the page is hidden or left. A visitor who reads a page or leaves the tab open for more than 30 minutes without another page view sends no sample that is kept. This biases the speed figures towards short sittings.
**Fix:** Accept it and note it in the stats page help text, or look for the newest visit of the visitor without the window for vitals only.

#### IN-G1-03: The privacy contact email is returned without trimming

**File:** `src/Csps.Application/Content/GetPrivacyContactHandler.cs:19`
**Issue:** The check uses `IsNullOrWhiteSpace`, but the value is returned as stored. A stored value with a leading or trailing space renders as a broken `mailto:` link on the four legal pages. Site settings validation probably prevents this today; the handler does not rely on it.
**Fix:** `var email = snapshot.ContactEmail?.Trim(); email = string.IsNullOrEmpty(email) ? null : email;`

#### IN-G1-04: Anonymous count is added before the visit work, so a failure later makes a retry double count

**File:** `src/Csps.Application/Analytics/CollectPageViewHandler.cs:67-68`
**Issue:** `IncrementAsync` commits first, then `RecordVisitAsync` can still throw (database error). The caller sees a 500 and may resend the same view, which is then counted twice in the daily page count.
**Fix:** Low priority. Either record the visit first, or document that the page count is at-least-once. No code change is needed if the owner accepts this.

---

_Reviewed: 2026-11-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Group 2: Backend Infrastructure and Server

**Reviewed:** 2026-11-18T17:00:00Z
**Depth:** standard
**Files Reviewed:** 73 in scope. All 46 source files and the matrix, allow-list, rate-limit, retention, visits, counts, clear and resolver tests were read in full. These test files were only skimmed or grepped (diffs, delays, raw SQL, stale clocks): VisitorStatsReaderTests, ConsentEndpointTests, VisitorStatsEndpointTests, VisitorStatsExportTests, VitalsCollectTests, StaffMarkerCookieTests, PrivacyContactEndpointTests, SeoEndpointTests, TestingAnalyticsTests, the four migration tests and parts of PageViewCollectTests and AnalyticsClearTests. No test-quality finding is claimed for them.
**Status:** issues_found

### Summary

The group is in good shape. These checks came out clean, each against the real source:

- **Authorization:** every action declares a policy or `[AllowAnonymous]`. The visitor stats controller is `Policies.Manager`. The matrix and allow-list rows match the actions.
- **CSRF and CORS:** all four anonymous POSTs carry `[RequireCsrfHeader]`. The repo has no CORS setup at all (grep for `AddCors`, `UseCors` and `AllowAnyOrigin` found nothing), so a preflight is never allowed.
- **Visitor selection:** the clear call chooses the visitor only from the HttpOnly cookie (CWE-639).
- **Raw IP:** it is never stored. It is truncated, then HMAC'd with the day salt, and only the hash is written.
- **Inline SQL:** none in `src/`. EF `ExecuteUpdate` and `ExecuteDelete` are used throughout.
- **Schema:** no JSON columns and no triggers. The migrations are additive, and the `Down` methods drop children before parents.
- **Upsert races:** the daily counter and the salt insert both lean on the primary key, and both are tested in parallel.
- **Business day:** the Manila business day is used consistently by the writers, the reader and the retention job.
- **Draft pages:** the legal-draft `noindex` and sitemap logic is correct. `tests/fixtures/legal-pages.json` matches the 2026-11-18 approval commit.

The findings below are real but moderate. There is no blocker.

### Warnings

#### WR-G2-01: The salt cache keeps a salt one day longer than the purge job does

**File:** `src/Csps.Infrastructure/Analytics/AnalyticsSaltCache.cs:27`, with `src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs:246-250`; the test `tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsVisitsTests.cs:243-255` locks the off-by-one in.
**Issue:**
- The class comment says "the process never holds a salt the purge job has deleted". That is not true.
- The purge deletes salts with `BusinessDay < yesterday`, so on day T it keeps T and T-1 (two days).
- The cache drops only `key < day - SaltDays`, which is `T-2`. The salt of T-2 stays in process memory for the whole of day T, after the database row is gone.
- The test "a day exactly at the lifetime is kept" asserts the wrong boundary.
- Failure scenario: the owner's privacy promise (D-07, "an old address hash can never be recomputed") is that the salt is destroyed after two days. A heap dump or a debugger on the host still holds three days' salts. Nothing recomputes an old hash today, but the invariant is broken and a test enforces the wrong behaviour.

**Fix:**
```csharp
// keep today and yesterday only, matching the purge (BusinessDay < yesterday is deleted)
var oldest = day.AddDays(-(AnalyticsRetention.SaltDays - 1));
foreach (var key in _entries.Keys.Where(key => key < oldest)) { _entries.TryRemove(key, out _); }
```
Change the test to expect that day `Day` is dropped once `Day + SaltDays` is added, and that `Day + SaltDays - 1` is kept.

#### WR-G2-02: A page view or speed sample posted while the visitor clears their data answers 500

**File:** `src/Csps.Infrastructure/Analytics/AnalyticsVisits.cs:45-51` (`AddPageViewAsync`) and `:63-74` (`AddSamplesAsync`), with `src/Csps.Infrastructure/Persistence/SqlErrors.cs:11-23`
**Issue:**
- The page view handler does `FindCurrentAsync`, then `TouchAsync`, then `AddPageViewAsync`. The vitals handler does `FindCurrentAsync`, then `AddSamplesAsync`. These are separate round trips with no transaction.
- `DeleteForVisitorAsync`, from "Clear my cookies and data", can run between them. The child insert then breaks the foreign key `FK_AnalyticsPageViews_AnalyticsVisits_VisitId` (SQL error 547).
- Nothing catches it. `SqlErrors` has no constant for 547, so the anonymous beacon returns a 500 ProblemDetails.
- Failure scenario: a visitor clicks "Clear my cookies and data" while the SPA is firing a navigation beacon (the clear sends the cookie and the beacon can still be in flight). The beacon races the delete, and the visitor or the error log sees a 500 on an endpoint that is documented to answer 204.
- The daily counter has already been incremented by then, so a client retry would count the view twice.

**Fix:** add `public const int ForeignKeyViolation = 547;` to `SqlErrors`. Wrap the `SaveChangesAsync` calls in `AddPageViewAsync` and `AddSamplesAsync`:
```csharp
catch (DbUpdateException error) when (SqlErrors.Has(error, SqlErrors.ForeignKeyViolation))
{
    foreach (var entry in context.ChangeTracker.Entries().ToList()) { entry.State = EntityState.Detached; }
    // the visit was cleared a moment ago: drop the row, as every other gate does
}
```
Add a test that deletes the visit between `FindCurrentAsync` and `AddPageViewAsync`.

#### WR-G2-03: One visitor id can write unlimited page view and speed sample rows, and anyone can get a visitor id

**File:** `src/Csps.Infrastructure/Analytics/AnalyticsVisits.cs:36-51, 63-74`; `src/Csps.Server/Controllers/AnalyticsController.cs:36-74`
**Issue:**
- The consent endpoint hands a visitor id to any caller who posts "stats on", with no proof of a human.
- After that, each `page-views` call adds an `AnalyticsPageViews` row and moves `PageViews` up. Each `vitals` call adds up to three `AnalyticsVitalSamples` rows.
- There is no cap per visit, per page or per metric, and the 30-minute visit never ends while the caller keeps calling.
- Failure scenario: one script posts consent, then sends 120 vitals a minute from one address (the limit is per address only). Each call writes three rows with attacker-chosen values inside the allowed bounds. That is 360 rows a minute, about 500k rows a day, all kept 13 months.
- The same script can drag the 75th-percentile speed on the Manager stats page to any value it likes. It also fills the one database the Basic plan allows.
- The anonymous daily counter is documented as inflatable by design. The speed figures and visit counts are presented as real visitor data, so the missing cap matters more there.

**Fix:**
- Cap samples per visit, for example one row per (visit, pageKey, metric), by a unique index plus an upsert-style insert that ignores error 2627.
- Cap page views per visit, for example 200, and stop inserting once reached.
- Or drop a vitals post when the visit already holds a sample for that page and metric.
- Keep the answer 204 either way.

#### WR-G2-04: Row-creating anonymous endpoints are limited per address only, and an IPv6 /64 is trivially rotated

**File:** `src/Csps.Server/Security/RateLimitingRegistration.cs:109-146`, applied by `ConsentController.cs:38`, `AnalyticsController.cs:37, 59, 84`
**Issue:**
- The consent endpoint inserts one `ConsentRecords` row per call (30 a minute per address). The clear endpoint inserts one per call (5 a minute).
- The bucket key is the full IPv4 address or the first 64 bits of an IPv6 address. A client with a normal /48 or /32 IPv6 allocation owns 65,536 or more /64 buckets and gets a fresh 30-a-minute allowance in each.
- Failure scenario: an attacker rotates source /64 prefixes. Consent and clear rows grow without limit at the attacker's speed, and the rows are kept 13 months (the purge only deletes by age). The host plan has one small database. When it fills, orders and payments fail too (core value).
- There is no site-wide ceiling on these four anonymous write routes.

**Fix:** add one global limiter, chained with the per-address one, for the anonymous analytics writes. For example, a `PartitionedRateLimiter.CreateChained` with a fixed partition key and a generous cap such as 600 a minute across the site. As a second step, partition IPv6 on /48 for these four policies.

### Info

#### IN-G2-01: `AnalyticsVisits.IpHash` is written but never read

**File:** `src/Csps.Infrastructure/Persistence/Configurations/AnalyticsVisitConfiguration.cs:28`, `src/Csps.Application/Analytics/CollectPageViewHandler.cs:100-103`
**Issue:**
- Nothing reads the column: no reader, no roll-up, no clear.
- Two days after a visit, the salt is deleted and the hash can no longer be linked to anything.
- It is therefore a 32-byte value kept 13 months for no purpose, and the privacy policy has to describe it.
- This needs an owner decision (a column drop is a one-way door), so it is not a warning.

**Fix:** ask the owner whether to stop writing it and drop the column in a later migration. If it stays, state its purpose in the entity comment.

#### IN-G2-02: Two parallel first beacons start two visits for one visitor

**File:** `src/Csps.Infrastructure/Analytics/AnalyticsVisits.cs:15-34`
**Issue:**
- `FindCurrentAsync` followed by `StartAsync` is a read then an insert with no unique constraint. Two tabs, or the SPA's first page view plus a prefetch, can both find nothing and both insert.
- The "visits" total and the per-day visit count rise by one extra. Unique visitors are unaffected, because the hash is the same.
- The test `TheNewestVisitIsFoundWhenTheVisitorHasTwoInsideTheWindow` shows the authors know two live visits can exist.

**Fix:** accept it and write it down, or take an application lock around find-or-start per visitor hash. The counts are described as approximate, so a note in the visitor stats help may be enough.

#### IN-G2-03: The roll-up skips a day at or before the cursor, so a late row is purged without being rolled up

**File:** `src/Csps.Infrastructure/Analytics/AnalyticsRetentionJob.cs:106` (the filter `visit.BusinessDay > rolledThrough`) and `:172-178`
**Issue:**
- The cursor is an upper bound. A visit stored with `BusinessDay <= cursor` is never rolled up. After 13 months the purge removes it, and its referrer and device counts are lost from the long-range totals.
- Today nothing writes such a row. It becomes possible if the business zone is changed in SiteSettings to a zone behind Manila (the project notes call the zone "Manager-editable later"), because "today" then moves back a day past the cursor.
- The job does not look at the zone at all.

**Fix:** when the zone setting becomes editable, either reset the cursor to the earliest day affected, or roll up any day with visits and no daily rows, regardless of the cursor. Add a test that stores a visit on the cursor day after the cursor moved.

#### IN-G2-04: The testing seed reads the database clock before it checks the body

**File:** `src/Csps.Server/Controllers/TestingAnalyticsController.cs:91-96`
**Issue:**
- `calendar.GetClockAsync` (a SiteSettings read) runs before the body is parsed, so a missing or malformed body still costs a database read.
- This route is compiled out of Release. The only effect is that the "no body gives 400" matrix row depends on the settings read working.

**Fix:** return the 400 when `request?.Days` is empty before the clock read, and parse the offsets after it.

#### IN-G2-05: A stale doc comment and a fixed sleep in a test

**File:** `src/Csps.Infrastructure/Analytics/AnalyticsRegistration.cs:9`; `tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs:186`
**Issue:**
- The summary on `AddCspsAnalytics` says "Later plans add the visit and roll-up stores here". They are already registered (lines 18-21).
- `NoLogLineHoldsThePathTheReferrerTheUserAgentOrACookieValue` waits 500 ms for logs, then asserts. The sink is in memory and written inline, so the sleep either does nothing or hides a timing assumption. If a log line were ever written on a background thread, the assertion could pass before the line exists.

**Fix:** remove the stale sentence. In the test, drop the delay, or poll until the expected "request finished" event is in the sink, then assert.

#### IN-G2-06: All per-address limits assume `RemoteIpAddress` is the real client

**File:** `src/Csps.Server/Security/RateLimitingRegistration.cs:26-28, 136-146`, `src/Csps.Server/Http/HttpRequestContext.cs:31`
**Issue:**
- The comment says the address is read from `Connection.RemoteIpAddress` only, "until the hosting record proves the proxy topology".
- If the shared host ever puts a front proxy in front of the in-process app, every visitor shares one bucket. The page view limit (120 a minute) would then be a site-wide ceiling, and the `IpHash` would hash the proxy's address.
- Page views are on every public page for every visitor, so this is where the assumption hurts first.

**Fix:** confirm in the hosting record (or with one live probe after the first deploy) that the host reports client addresses. If it does not, set the collect limit by session cookie instead, or raise it.

---

_Reviewed: 2026-11-18T17:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Group 3: Web public module

**Reviewed:** 2026-11-18
**Depth:** standard
**Files Reviewed:** 62
**Status:** issues_found

### Summary

Scope: the public cookie consent store, bar and settings window, Global Privacy Control, the page-view beacon, the web-vitals reporter, the clear-my-data dialog, the legal pages and their tests.

The core consent rules hold up. I traced each of these and found no defect:

- Web-vitals loads only after `statsAllowed` is true. That flag is false until the rules chunk loads, false under GPC, and false after Reject All.
- Withdrawal is applied at once, because the provisional cookie is written before the server call.
- A new policy version, a 12-month-old choice and a map-only save all make the bar ask again.
- The page-view beacon sends only the path. The server (`CollectPageViewHandler`, `IdentifiedCollection.IsAllowed`) is what gates the referrer and the visitor id, so the client sending a view before a choice does not breach ANL-06.
- Legal content renders as React text only. There is no `dangerouslySetInnerHTML`, no inline style, and no eval in the scope.
- External links carry `rel="noopener noreferrer"`.
- No em or en dash exists in `web/src/modules/public`.
- All API calls sit in `modules/public/services` over `core/api`.

I found no blockers. Two warnings are real behaviour defects with narrow triggers. Four info items cover robustness, a clock edge case and test reliability.

### Warnings

#### WR-G3-01: Two consent sends can overlap, and a late response can overwrite the newer choice with the older one

**File:** `web/src/modules/public/consentSave.ts:71-93` and `:95-125` (called from `web/src/modules/public/hooks/useConsent.ts:209-221`)
**Issue:** `commitChoice` writes the provisional cookie, then starts `send()`. Nothing waits for an earlier send to finish. `memory.inFlight` is a single boolean that only guards `resendChoice`, and the first send to finish resets it while another is still running. The server sets the confirmed `__Host-csps_consent` cookie from each response.

Failure scenario, on a slow mobile link:
1. The visitor taps Accept All in the bar. POST #1 is sent with stats=true.
2. Within a second or two they open Cookie Settings from the footer and tap Reject All. POST #2 is sent with stats=false.
3. The two responses arrive out of order. Response #1 arrives last and its Set-Cookie replaces the confirmed cookie.

The browser now holds stats=true although the visitor's last action was to refuse. The store still shows "off" until the next page view. After that the store re-reads the cookie, so stats are on again. A withdrawal has been undone.

**Fix:** Serialize the sends per store, or abort the older one.
```ts
// in SendMemory
chain: Promise<void>;

// in commitChoice, replace `await send(host, ...)`
const memory = host.memory();
memory.chain = memory.chain.then(() => send(host, body));
await memory.chain;
```
`send` already catches every error, so the chain never rejects. Alternatively keep an `AbortController` in `SendMemory` and pass `signal` to `service.record`, which already accepts one. Add a test that fires Accept All, then Reject All, and resolves the two responses in reverse order.

#### WR-G3-02: Map frame stays loaded after the visitor rejects the map

**File:** `web/src/modules/public/components/MapCard.tsx:82` (with `:56`, `:97-100`, `:167-185`)
**Issue:** `showFrame = embed !== null && (tapped || mapAllowed)`. `tapped` is cleared only inside the "Always show maps?" handler (`:178-180`). The file header says a choice made in the bar or the window "loads or unloads the frame on this page". That does not hold for a visitor who tapped Show Map first.

Failure scenario:
1. The visitor taps Show Map. `tapped=true` and the Google frame loads.
2. They open Cookie Settings and press Reject All, or untick Google map and Save Choices.
3. `mapAllowed` becomes false, but `tapped` is still true, so the Google frame stays on screen and keeps running for the rest of the page view.

The visitor has explicitly withdrawn map consent and the third-party content is still live. The one-time tap was permission for that tap, not a veto over a later refusal.

**Fix:** Clear `tapped` when a saved choice turns the map off.
```ts
const wasAllowed = useRef(mapAllowed);
useEffect(() => {
  if (wasAllowed.current && !mapAllowed) setTapped(false);
  wasAllowed.current = mapAllowed;
}, [mapAllowed]);
```
Prefer a `useEffectEvent`-free form like this, or derive it in the store. Add a test: tap Show Map, then Reject All, and expect no iframe.

### Info

#### IN-G3-01: Failed chunk loads leave the consent UI stuck, with unhandled promise rejections

**File:** `web/src/modules/public/hooks/useConsent.ts:148-155`; `web/src/modules/public/components/ConsentBar.tsx:21,49,59`; `web/src/modules/public/components/CookieSettingsDialog.tsx:36`; `web/src/modules/public/components/MapCard.tsx:178`
**Issue:** There are three related gaps.
- `void import('../consentRules').then(...)` has no catch. If the chunk fails to load (flaky mobile data), `rulesLoading` stays true and the store never retries. A returning visitor who consented then has `statsAllowed` and `mapAllowed` false for the whole page view, and a stale choice never re-prompts. It fails closed on tracking but silently breaks the map choice.
- `void import('../consentSave')` at module top level in `ConsentBar.tsx:21` and `CookieSettingsDialog.tsx:36` has no catch.
- The Reject All and Accept All handlers call `void rejectAll('bar')` and then `focusMain()`. If `loadSave()` rejects, the rejection is unhandled. The bar stays up, no cookie is written, and focus has already moved to main. `MapCard.tsx:178` does the same with `allowMaps().then(...)`.

Each of these also logs to the browser console, which breaks the zero-console-warnings rule.

**Fix:** Add `.catch(() => { rulesLoading = false; })` on the rules import. Add `.catch(() => undefined)` on the two prefetch imports. In the click handlers, only call `focusMain()` after the choice resolves, or catch the rejection and leave the bar in place.

#### IN-G3-02: Speed report checks a cached consent snapshot when the page hides, so withdrawal in another tab is not seen

**File:** `web/src/modules/public/hooks/useSpeedReport.ts:43` (store behaviour at `web/src/modules/public/hooks/useConsent.ts:143-156`)
**Issue:** The store recomputes only when this store changes the cookie. `onHide` reads `consentStore.getSnapshot().statsAllowed`, not the live cookie.

Failure scenario: the visitor has two tabs open. In tab B they press Reject All or Clear My Data. Tab A still has `statsAllowed=true` and still sends vitals when it is hidden.

The server re-checks the consent cookie that the request carries (`CollectVitalsHandler` uses `IdentifiedCollection.IsAllowed`), so nothing is stored. This is a defense-in-depth gap on the client, not a data leak.

**Fix:** Add a `revalidate()` action on the store that re-reads the cookie and recomputes. Call it at the start of `onHide`. Also call it on the document `visibilitychange` to visible.

#### IN-G3-03: A device clock that is wrong by days makes the bar come back after every choice

**File:** `web/src/modules/public/consentCookie.ts:94`; `web/src/modules/public/consentRules.ts:32-34`
**Issue:** `isCurrentChoice` treats a cookie dated after "today" as no choice (D-43). "Today" is the device clock converted to Asia/Manila (`manilaBusinessDay(new Date())`). The server stamps the confirmed cookie with the server's business day. D-43 covers a device in a different time zone, but not a device clock that is wrong.

Failure scenario: a phone with its date set two days behind. The visitor taps Accept. The provisional cookie is dated with the device day and is fine. The server then replaces it with a cookie dated two days ahead of the device. The next `refresh()` marks it future-dated, `needsChoice` becomes true, and the bar returns. The same happens on every visit. Stats and map also read as off. This is exactly the nagging the "no nagging" tests aim to prevent. A clock set far ahead shortens the 12-month life the same way.

**Fix:** Allow a small tolerance for future-dated cookies, for example up to 2 days, in `isCurrentChoice`. Or take the server's day from the consent response and store it. Raise this with the owner first, because D-43 is an owner ruling.

#### IN-G3-04: "Nothing is sent" tests rely on fixed 60 ms sleeps and can pass without proving anything

**File:** `web/src/modules/public/hooks/useSpeedReport.test.tsx:57` and its uses at `:111,:115,:128,:132,:146,:150`; `web/src/modules/public/hooks/usePageViewBeacon.test.tsx:28`
**Issue:** The negative tests (no reader import and no request before a choice, after Reject All, or under GPC) wait a fixed 60 ms (`settle`) and then assert zero requests. `CookieSettingsDialog.test.tsx:17` already notes that the first transform of a lazy chunk can take longer than a test waits. If the dynamic imports of `analyticsService` or the reader take longer than 60 ms on a cold CI runner, a regression that sends after Reject All would still pass.

**Fix:** Make the wait deterministic. For example, in each negative test first complete a positive control (same page, stats allowed) so the chunks are already loaded, or await the pending `import()` promises before asserting. Alternatively assert on the mocked reader and on a spy for `analyticsService.vitals` directly.

## Group 4: Web admin module

**Reviewed:** 2026-11-18
**Depth:** standard
**Files Reviewed:** 33 (as listed in g4.txt; the list has 32 paths plus the trailing blank line)
**Status:** issues_found

### Summary

I reviewed the Visitor Stats page, its KPI, list and page speed cards, the range and URL code, the service and the CSV export. I checked the client rules against the server (`VisitorStatsRequestValidator`, `StatsRangePresets`, `GetVisitorStatsHandler`, `VisitorStatsCsv`).

What holds up:
- The zod schema matches the server rules and messages. The floor, Feb 29 handling, window and order checks agree.
- Presets are sent by name only. TanStack Query keys include range, from and to. Cancelled requests use the query signal.
- The CSV file name is built only from digits read out of the file, so it cannot carry a path or script.
- The CSV text has no user-controlled cells.
- No em or en dash was found in any reviewed file (checked with a character scan).
- Division by zero does not occur in this code. Every share is the server's.
- Charts and bars have text figures. Bar tracks are `aria-hidden` and the figure text carries the number.

No blockers. Three warnings are about how the page behaves when the business today is missing or goes stale, and about a rounded figure that contradicts its rating word.

### Warnings

#### WR-G4-01: A failed "business today" call leaves a custom-range page loading forever with no error

**File:** `web/src/modules/admin/pages/VisitorStatsPage.tsx:187-196` and `:210-212`, `web/src/modules/admin/components/StatsCustomRange.tsx:36,45`
**Issue:** For `?range=custom&from=..&to=..` the page asks `useBusinessToday(true)` and holds the stats query back while `today === null` (`enabled` is false). `useBusinessToday` hides the failure: `useBusinessTodayState` returns `isError`, but the page only reads the date. So if the probe call (an Orders list call, `useBusinessToday.ts:66`) fails, `today` stays null, the stats query never runs, and `query.isPending` stays true.
- **Failure scenario:** A Manager opens a shared link with a custom range while the Orders list call fails (offline blip, 5xx). `loading` is true forever (line 210). The page shows skeletons with "Loading the visitor stats" and never reaches `ErrorState`, because `failed` needs `query.isError`.
- **Second effect:** In `StatsCustomRange`, `today === null` makes `errors` empty and `change()` return before `onApply`. Typed dates do nothing and show no message.
**Fix:** Use `useBusinessTodayState` in the route. When `isError` is true, show `ErrorState` with its `refetch` as Try Again, and do not report `loading`. Example:
```tsx
const { today, isError, error: todayError, refetch: refetchToday } = useBusinessTodayState(values.range === CUSTOM_RANGE);
const todayFailed = values.range === CUSTOM_RANGE && isError;
// failed = todayFailed || (query.isError && query.data === undefined)
// error = todayFailed ? todayError : query.error
// onRetry = todayFailed ? refetchToday : () => void query.refetch()
// loading = !todayFailed && (query.isPending || query.isPlaceholderData)
```
Add a page test where the Orders probe returns 500 on a custom-range URL.

#### WR-G4-02: After 5 minutes the cached business today is dropped and custom dates silently stop applying

**File:** `web/src/modules/admin/hooks/useBusinessToday.ts:68-70` (used by `web/src/modules/admin/components/StatsCustomRange.tsx:26,36,45` and `web/src/modules/admin/pages/VisitorStatsPage.tsx:187-188`)
**Issue:** The probe uses `staleTime: maxAgeMs` (5 minutes) and `probed` is set to null once `probe.isStale` is true (line 70). TanStack Query marks the data stale on a timer but does not refetch on its own. A refetch only happens on window focus, reconnect or remount. Findings below are from reading the code and TanStack's observer behavior; I did not run it.
- **Failure scenario:** A Manager picks Custom range and stays on the tab, with no other held order, dashboard or staff-money answer in the cache. About 5 minutes after the probe ran, `today` becomes null. The From and To inputs lose their `min` and `max`. All validation messages disappear (`NO_ERRORS`, line 36). `change()` returns at line 45 without calling `onApply`, so a newly typed valid range is not applied. The page keeps showing the old figures. `statsQueryFor` returns null for the URL range and the stats query is disabled. Nothing tells the Manager why.
- A window focus event repairs it by triggering the refetch, so it is intermittent and hard to reproduce.
**Fix:** In the Visitor Stats flow, trust the last known date instead of nulling it. For example, keep the last non-null `today` in a ref or `useState` inside `StatsCustomRange` and the route, and use it until a fresh one arrives. Or give the probe `refetchInterval: maxAgeMs` while `enabled`. Add a test with fake timers that advances 6 minutes and then types a valid range.

#### WR-G4-03: A rounded display value can contradict its rating word at the thresholds

**File:** `web/src/modules/admin/components/PageSpeedCard.tsx:27-28,50,59,68`
**Issue:** The server rates the exact decimal `P75` (`VitalRating.Rate`, `<= good` is Good, `<= poor` is Needs work). It sends `P75` as a decimal (`VitalDto(decimal P75, ...)`), and real LCP and INP values are fractional. The card rounds before showing: LCP to one decimal in seconds, CLS to two decimals, INP to whole milliseconds.
- **Failure scenario:** LCP p75 is 2530 ms. The server says Needs work (over 2500). The card shows "2.5 s" with the badge "Needs work", and the page copy says 2.5 s is the Good limit. The same happens for CLS 0.104 (shows "0.10", rating Needs work, limit 0.1) and INP 200.4 (shows "200 ms", Needs work, limit 200). A visible number and its rating word then look wrong to the reader and to a screen reader.
**Fix:** Format so the shown value cannot round across a boundary the rating used. Simplest: show one more decimal for LCP near the edge, or show LCP in whole milliseconds under 10 s. Alternatively, round with the same direction the rating uses (`ceil` for the value shown), so a value over the limit never displays as the limit:
```ts
const value = ONE_DECIMAL.format(Math.ceil(p75 / 100) / 10); // 2530 ms -> "2.6 s"
```
Add a test with `p75: 2530, rating: 'needs-work'`.

### Info

#### IN-G4-01: The service accepts any finite share and count, so a bad server number draws a wrong bar

**File:** `web/src/modules/admin/services/visitorStatsService.ts:85-87,106-108`, rendered at `web/src/modules/admin/components/StatBarList.tsx:39,43`
**Issue:** The contract check only requires a finite number. `share` may be negative, above 100 or fractional, and `count` may be negative or fractional. The bar width is `${share}%`. A server bug that sent 250 would draw a full bar and show "250%"; a negative value would draw an empty bar and show a negative count. The comment says the browser "only checks that each one is a number it can show", but these are not figures the lists can show correctly.
**Fix:** Reject, in `rankedItem`, a count that is not a non-negative integer and a share outside 0 to 100, with `VisitorStatsContractError`. The tracks use `overflow-hidden`, so the overflow case is clipped, but the text figure still lies.

#### IN-G4-02: A previous range with no visits keeps showing "No visits in these dates" while the next range loads

**File:** `web/src/modules/admin/pages/VisitorStatsPage.tsx:156-160`
**Issue:** `keepPreviousData` keeps the old figures during a range change. If the old range had `pageViews === 0`, the EmptyState is drawn, and it is not dimmed like the KPI values and trend are (`visitorStatsBodyClasses` only dims `[data-kpi-value]` and `[data-trend-body]`). The subline also still shows the old dates. Scenario: a Manager chooses This year after a quiet Last 7 days; for the load time the page says there are no visits for the new range choice. The region is `aria-busy`, so assistive technology is told it is loading, but sighted users see a wrong empty message for a moment.
**Fix:** While `loading` is true, either show the skeleton cards instead of the EmptyState, or dim the EmptyState the same way. For example, render the empty branch only when `!loading`.

#### IN-G4-03: Export failure always says "Check your internet connection"

**File:** `web/src/modules/admin/components/VisitorStatsToolbar.tsx:65-67`
**Issue:** The `catch` shows one message for every failure, including a 403 (role change), a 400 (range no longer valid after midnight), and a `VisitorStatsContractError` or a `downloadCsv` error. Scenario: the export is refused by the server for a stale range, and the Manager is told to check the connection and retries with the same result.
**Fix:** Keep the generic toast for network errors only. Use the shared error text helper (as the page's `ErrorState` does) for HTTP errors, or add a second plain line such as "Try a different date range." for 400 answers.

---

_Reviewed: 2026-11-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Group 5: Web shared code, tooling, e2e and docs

**Reviewed:** 2026-11-18
**Depth:** standard
**Files Reviewed:** 65

### Summary

Group 5 is in good shape. No blocker was found. I checked the points you listed one by one.

- **http client** (`httpClient.ts`): the `keepalive` flag is passed to fetch only when asked (`httpClient.ts:293`). Abort, timeout and network errors map by which signal fired (`:236-247`). Credentials stay `same-origin`. The CSV text mode keeps the redirect and content-type checks (`:377`). No secret can reach a URL (`:206-213`).
- **Budget script** (`budget.ts`, `vite-budget-plugin.ts`): gzip level 9, 1 KB = 1000 B, and `>` against the limit (150_000 / 250_000 / 35_000, `budget.ts:80`). Every public page, the larger admin entry and the single CSS file are all enforced and fail the build through `this.error`. I read the last real numbers in `artifacts/budget/budget.production.json`: Privacy 149,580 B, admin 222,287 B, CSS 20,495 B. All pass. Removing the old `PUBLIC_ALLOWED_ADMIN_MODULES` exception made the rule stricter, not weaker.
- **Playwright config**: ports are only 5199, `reuseExistingServer: false`, no 5173/5023/5099 anywhere.
- **package.json**: the only phase change is `web-vitals` 6.2.3, an exact pin. It is Apache-2.0, 41 days old, and recorded in `dependencies.json`/`.md` and the notices file. No forbidden package.
- **OR-4**: no em or en dash in any reviewed `web/src` file.
- **VisitorTrendChart**: axis maths (`axisTop`), run splitting for the null unique-visitor gap, bar path, label step and keyboard handling hold up on the edge cases I traced (empty buckets, max of 1, single point runs).
- **Leaks**: no real emails, server names, local paths or account ids in docs, fixtures or `api.generated.ts`. The one near miss is IN-G5-03 (pre-existing).

Two warnings: one flaky e2e assertion that will fail on timing alone, and one state leak from the production-shipped showcase.

### Warnings

#### WR-G5-01: "Manager views add nothing" e2e test can fail on other specs' traffic

**File:** `web/e2e/visitor-stats.spec.ts:212-217`
**Issue:** The test reads the "Terms of Use" row, opens `/terms` as a signed-in Manager, reads the row again and asserts `toBe(before)`. Its comment says `/terms` is "the one page no other visitor stats journey opens". That is wrong. These specs also open `/terms` with no staff cookie, and the beacon counts every public view whatever the consent (`usePageViewBeacon.ts:40-47` fires unless the landing view is held for a choice):
- `web/e2e/public-sweep.spec.ts:95` (the Terms of Use sweep, in all five projects);
- `web/e2e/consent.spec.ts:205` (after Clear, in all five projects).

Playwright runs different spec files in parallel workers against the one `CSPS_E2E` database. Failure scenario: worker A reads Terms = 7. Worker B finishes its sweep and a view lands. Worker A's Manager view is correctly ignored, but the second read says 8, so `toBe(before)` fails. The test fails on timing, not on a real bug. A real regression (a counted Manager view) will also be dismissed as "just that flake".
**Fix:** Make the page unique to this test, or stop the other traffic. Options, best first:
1. Take a shared "public views" lock (like `withSiteContentLock`) in this test and in `public-sweep.spec.ts` and `consent.spec.ts` around any `/terms` open.
2. Assert at the request level instead: record that the Manager's beacon got 204 and assert the Testing analytics read for a seeded, otherwise unused path is unchanged.

Also fix the comment on line 212 so it does not claim uniqueness.

#### WR-G5-02: Showcase demo reconfigures the live consent store and never restores it

**File:** `web/src/dev/previews/demoConsent.ts:53-76` (callers `OpenedCookieSettings.tsx:33`, `StaticConsentBar.tsx:16`); store side `web/src/modules/public/hooks/useConsent.ts:197-208`
**Issue:** `seedDemoConsent` calls `resetConsentStore`, which replaces the app-wide singleton's cookie jar, service and GPC flag with an in-memory jar and a stand-in service. The store's own comment says `reconfigure` is "Tests only" (`useConsent.ts:87`), but the showcase ships in the production build (`budgets.md`, D-33, "The component showcase in production") and a Manager can open it. Nothing resets the store on unmount. Failure scenario: a Manager opens `/admin/components`, presses a cookie demo, logs out, and uses the sign-in page's "back" link (`SignInForm.tsx:115`, a client-side `UiLink to="/"`). The public layout now runs on the demo store until a full reload:
- the real consent cookie is ignored and the real `Sec-GPC`/`navigator.globalPrivacyControl` signal is replaced by `gpc: false`;
- the cookie bar can show again for a person who already chose;
- a choice made there writes only the in-memory jar and the stand-in service, so the real server never records it.

Impact is limited to staff and one tab, but it is a real wrong-state path and it is the privacy/consent subsystem.
**Fix:** Restore the real store when the demo unmounts. For example, export a `restoreConsentStore()` from `useConsent.ts` that calls `reconfigure` with the original `readCookie` and the real GPC read, and call it from the cleanup of the effects in `OpenedCookieSettings` and `StaticConsentBar`:
```tsx
useEffect(() => {
  seedDemoConsent(state);
  consentStore.openSettings();
  return restoreConsentStore;
}, [state]);
```
Also update the "Tests only" comment so the next reader knows the showcase uses it.

### Info

#### IN-G5-01: Budget doc contradicts the code and itself

**File:** `docs/web/budgets.md:14`, `docs/web/budgets.md:30-34`
**Issue:** Line 14 says admin initial JS is measured only in "builds with the dev-only routes". The code measures admin in every build (`budget.ts:439-449`) and line 36 of the same doc says so. The table at lines 30-34 still lists a "Public (`/`)" row for `HoldingPage.tsx` and tells the reader that `PublicLayout` "returns to this row with Phase 11"; since plan 11-08 the public rows are the nine in `PUBLIC_ROUTES` (`budget.ts:122`).
**Fix:** Change the line-14 cell to "every build" and delete or replace the `HoldingPage` row with a pointer to the "Public routes" section. Also add the final end-of-phase figures; the last table in the doc is from plan 12-16, while the current Privacy row is 149,580 B (420 B of room).

#### IN-G5-02: `@visitor-stats` tag is missing from the e2e tag table

**File:** `docs/web/e2e.md:129-131`
**Issue:** The table gained `@consent`, `@gpc` and the new `@public-sweep` text, but `web/e2e/visitor-stats.spec.ts` (tag `@visitor-stats`, 8 tests) has no row (grep count 0). A person choosing `--grep` tags cannot discover it.
**Fix:** Add a row: what it covers (accept and three pages seen by a Manager, the Manager's own views not counted, Admin refused, range in the URL, From after To, the 13-month Note and "Not available", Export CSV with BOM, axe, one chart tab stop) and "plan 12-30".

#### IN-G5-03: Realistic personal-looking address in an e2e fill (pre-existing)

**File:** `web/e2e/auth-overflow.spec.ts:168`
**Issue:** `a `fill(...)` with a real-looking `gmail.com` address`. `gmail.com` is a real domain, so this could be a real person. This line was not changed in Phase 12 (the phase only touched the timeout at line 348), but the file is in scope and the repo is public. Nothing is sent: the sweep serves its answers with `page.route`.
**Fix:** Use a reserved domain, for example `paolo.garcia@csps.test` (the suite's own fake domain) or `@example.test`.

#### IN-G5-04: Legal link guard accepts protocol-relative links

**File:** `web/src/test/legal-content.node.test.ts:28`
**Issue:** `SAFE_HREF = /^(?:\/|mailto:|tel:|https:\/\/)/`. The `\/` branch also matches `//evil.example/x`, which the browser treats as an off-site link on the current scheme. The text files are authored in the repo, so the risk is low, but the test exists to stop unsafe targets.
**Fix:** `/^(?:\/(?!\/)|mailto:|tel:|https:\/\/)/`, and add a test line for `//host`.

#### IN-G5-05: Cookie inventory guard only sees prefixed names in two C# files

**File:** `web/src/test/cookie-inventory.node.test.ts:12-15`
**Issue:** `CODE_NAME` matches only quoted `__Host-`/`__Secure-` `csps_*` literals in `AuthCookies.cs` and `AnalyticsCookies.cs`. A cookie set with a different prefix, built from two constants, or defined in another file never reaches the policy check, which is the point of LEGAL-02.
**Fix:** Scan every `*.cs` under `src/Csps.Server` for `Append(`/`Cookies.Append` calls and fail on any name not found by the regex, or widen the regex to any `csps_` name. Keep the existing "listed but not set" check.

#### IN-G5-06: Text mode can resolve a `string` request to `undefined`

**File:** `web/src/core/api/http/httpClient.ts:372-374`, `:593-594`
**Issue:** An empty 202/204/205 answer returns `data: undefined` before the CSV branch, and `request<T>` casts it to `T` (`get<string>(..., { responseType: 'text' })`). The export route always sends a header row, so this does not happen today. A future 204 would reach a caller typed `string` and fail later with a confusing error. The XHR path (`onUploadProgress`) also ignores `keepalive` without saying so.
**Fix:** In text mode, treat an empty body as a `parse` error (move the `noContentStatuses` early return behind `!asCsv`), or type the result `string | undefined`. Note in the `keepalive` JSDoc that it is fetch only.

#### IN-G5-07: Chart tooltip sticks after a mouse click on the plot

**File:** `web/src/components/data/VisitorTrendChart.tsx:210-219, 233-236`
**Issue:** The svg has `tabIndex={0}`, so a mouse click focuses it and `onFocus` sets the tip source to `'keys'`. After that, `onMouseEnter` keeps `'keys'` and `onMouseLeave` only clears a `'pointer'` source. The tooltip then stays on screen, and the live region keeps announcing, after the pointer has left, until focus moves away. The e2e only proves the keyboard path.
**Fix:** In `onFocus`, set `'keys'` only when focus came from the keyboard (`event.currentTarget.matches(':focus-visible')`), or let `onMouseLeave` clear the tooltip when the plot is not `:focus-visible`. Add a test: click the plot, move the pointer out, expect no tooltip.

#### IN-G5-08: Thin public JS headroom on the legal and Contact routes

**File:** `web/scripts/budget.ts:80`, `artifacts/budget/budget.production.json` (local, git-ignored)
**Issue:** Not a defect. The enforced limits are correct, but the latest local production build has Privacy at 149,580 B and Contact at 149,399 B against 150,000 B, so about 0.4 to 0.6 KB of room. Any small addition in a later phase will fail the build, which is the intended behaviour; it is worth planning for. `budgets.md` still shows 0.93 KB as the tightest row.
**Fix:** Record the current figures in `budgets.md` and decide before Phase 13 whether to take reserve option R1 or R2 (both need an owner yes).

---

_Reviewed: 2026-11-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
