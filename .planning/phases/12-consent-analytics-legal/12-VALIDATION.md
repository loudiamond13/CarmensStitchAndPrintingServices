---
phase: "12"
slug: "consent-analytics-legal"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-11-15T21:53:00-06:00"
updated: "2026-11-16T21:15:00-06:00"
---

# Phase 12: Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The requirement-to-test map is in `12-RESEARCH.md` § Validation Architecture; this file is the execution contract built from it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 (MTP v2), Shouldly, NSubstitute, `FakeTimeProvider`, ArchUnitNET. Web: Vitest 5, RTL, MSW 3, in-house axe matcher. E2E: Playwright 1.63 + @axe-core/playwright |
| **Config file** | `tests/Directory.Build.props`, `web/vite.config.*`, `web/playwright.config.ts` |
| **Quick run command** | `dotnet test --project <touched test project> --filter-class "*<Class>*"` (with `CSPS_TEST_SQL=localdb` set for that process only) or `npm --prefix web run test -- --run <touched path>` |
| **Full suite command** | after preflight: `dotnet test Csps.slnx` and `npm --prefix web run verify` |
| **Estimated runtime** | quick ~30 seconds; full suite several minutes |

---

## Sampling Rate

- **After every task commit:** the quick command for the touched test file.
- **After every plan wave:** `dotnet test Csps.slnx` and `npm --prefix web run verify` (after preflight).
- **Before `/gsd-verify-work`:** full suite plus `npm --prefix web run e2e` and `npm --prefix web run lighthouse` green.
- **Max feedback latency:** 60 seconds for the quick command. E2E, Lighthouse and production builds are gate commands, not per-edit feedback.

---

## Per-Task Verification Map

Filled by the planner from each task's first `<automated>` verify (every task has one; later commands in the same task are listed in its plan). "❌ task creates" means the TDD task writes that test first (RED), so no separate Wave 0 scaffold is needed. "mixed" means the E2E spec is new and runs against existing fixtures.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 12-01-T1 | 12-01 | 1 | ANL-01 (D-133 carry-over) | T-12-01 | The owner's answer on the live Gallery photo is recorded, or the check is parked in the owner backlog. | manual (owner) | `test -f .planning/phases/12-consent-analytics-legal/12-01-SUMMARY.md && grep -c "D-133" .planning/phases/12-consent-analytics-legal/12-01-SUMMARY.md` | n/a | ⬜ pending |
| 12-02-T1 | 12-02 | 1 | ANL-05, ANL-06 | T-12-02, T-12-03 | A query string or fragment can never reach storage through the path. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AnalyticsPathTests"` | ❌ task creates | ⬜ pending |
| 12-02-T2 | 12-02 | 1 | ANL-05, ANL-06 | T-12-02, T-12-03 | The most important source, Facebook, is counted under one name whether or not the app sends a referrer. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*ReferrerNameTests"` | ❌ task creates | ⬜ pending |
| 12-02-T3 | 12-02 | 1 | ANL-05, ANL-06 | T-12-02, T-12-03 | Device, OS and bot rules are pure, tested and capped. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*DeviceClassTests" --filter-class "*OsFamilyTests" --filter-class "*AnalyticsBotsTests"` | ❌ task creates | ⬜ pending |
| 12-03-T1 | 12-03 | 1 | ANL-01, ANL-07 | T-12-05, T-12-06 | One saved choice round-trips through both codecs from one fixture. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*ConsentCookieTests"` | ❌ task creates | ⬜ pending |
| 12-03-T2 | 12-03 | 1 | ANL-01, ANL-07 | T-12-05, T-12-06 | Any cookie value, honest or crafted, is either read exactly or treated as no choice. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*ConsentCookieTests"` | ❌ task creates | ⬜ pending |
| 12-03-T3 | 12-03 | 1 | ANL-01, ANL-07 | T-12-05, T-12-06 | The re-ask rule (ANL-07, D-22) and the GPC rule (D-20) are one tested function, and the server reads the same cookie the same way. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*ConsentCookieTests"` | ❌ task creates | ⬜ pending |
| 12-04-T1 | 12-04 | 1 | ANL-08, ANL-09 | T-12-08, T-12-09 | Every business date the stats page and the cleanup use comes from one tested place. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AnalyticsRetentionTests" --filter-class "*StatsRangePresetsTests"` | ❌ task creates | ⬜ pending |
| 12-04-T2 | 12-04 | 1 | ANL-08, ANL-09 | T-12-08, T-12-09 | Speed ratings match Google's published thresholds exactly. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*VitalRatingTests" --filter-class "*NearestRankTests"` | ❌ task creates | ⬜ pending |
| 12-04-T3 | 12-04 | 1 | ANL-08, ANL-09 | T-12-08, T-12-09 | Bucket choice and shares are exact and stable. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*StatsBucketTests" --filter-class "*SharesTests"` | ❌ task creates | ⬜ pending |
| 12-05-T1 | 12-05 | 1 | LEGAL-05, LEGAL-01 to 04 | T-12-10, T-12-11 | /privacy is served with its title and noindex, and renders the DRAFT head from the shared facts. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*LegalPagesTests"` | ❌ task creates | ⬜ pending |
| 12-05-T2 | 12-05 | 1 | LEGAL-05, LEGAL-01 to 04 | T-12-10, T-12-11 | All four legal routes are served and measured, each under the public budget. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ShellHeadTests" --filter-class "*PublicRouteTableTests"` | ✅ | ⬜ pending |
| 12-05-T3 | 12-05 | 1 | LEGAL-05, LEGAL-01 to 04 | T-12-10, T-12-11 | DRAFT text can be read by visitors but is not offered to search engines; approval changes both per page. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SeoEndpointTests" --filter-class "*ShellHeadTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*AuthorizationCoverageTests" --filter-class "*SpaHostTests"` | ✅ | ⬜ pending |
| 12-06-T1 | 12-06 | 1 | LEGAL-01, LEGAL-04 | T-12-13, T-12-14 | The email has its own small read, covered by the matrix and the contract snapshot. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*GetPrivacyContactHandlerTests"` | ❌ task creates | ⬜ pending |
| 12-06-T2 | 12-06 | 1 | LEGAL-01, LEGAL-04 | T-12-13, T-12-14 | The legal pages have a lazy way to show the email, and every other page is proven free of it. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*PrivacyContactEndpointTests" --filter-class "*PublicSiteEndpointTests" --filter-class "*PublicPrivacyTests"` | ❌ task creates | ⬜ pending |
| 12-07-T1 | 12-07 | 2 | LEGAL-04, LEGAL-05 | T-12-16, T-12-17 | /accessibility shows its full draft text and the shop's real contact lines from settings. | component | `npm --prefix web run test -- --run src/modules/public/pages/AccessibilityPage.test.tsx` | ❌ task creates | ⬜ pending |
| 12-07-T2 | 12-07 | 2 | LEGAL-04, LEGAL-05 | T-12-16, T-12-17 | Long legal pages are easy to move through, and a malformed text module fails CI. | component + node | `npm --prefix web run test -- --run src/modules/public/components/LegalPage.test.tsx src/test/legal-content.node.test.ts src/test/no-long-dash.node.test.ts` | ❌ task creates | ⬜ pending |
| 12-07-T3 | 12-07 | 2 | LEGAL-04, LEGAL-05 | T-12-16, T-12-17 | The contact block behaves well in every state, and the policy text is always readable. | component | `npm --prefix web run test -- --run src/modules/public/components/LegalFacts.test.tsx src/modules/public/pages/AccessibilityPage.test.tsx` | ❌ task creates | ⬜ pending |
| 12-08-T1 | 12-08 | 2 | ANL-01, ANL-02, ANL-07 | T-12-18, T-12-21 | One Accept All press is logged with the server's time and saved as a server-set cookie. | unit + integration | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*ConsentRecordTests"` | ❌ task creates | ⬜ pending |
| 12-08-T2 | 12-08 | 2 | ANL-01, ANL-02, ANL-07 | T-12-19, T-12-21 | The server, not the browser, decides what a GPC or stale-version decision means. | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*RecordConsentHandlerTests" --filter-class "*RecordConsentRequestValidatorTests"` | ❌ task creates | ⬜ pending |
| 12-08-T3 | 12-08 | 2 | ANL-01, ANL-02, ANL-07 | T-12-18, T-12-20 | The visitor id exists only after a logged yes, and disappears on a no or under GPC. | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*RecordConsentHandlerTests"` | ❌ task creates | ⬜ pending |
| 12-09-T1 | 12-09 | 3 | ANL-01, ANL-07 | T-12-25, T-12-26 | A visitor can make the choice from the bar, and it is logged on the server. | component | `npm --prefix web run test -- --run src/modules/public/hooks/useConsent.test.tsx src/modules/public/services/consentService.test.ts src/modules/public/components/ConsentBar.test.tsx src/layouts/PublicLayout.test.tsx` | ❌ task creates | ⬜ pending |
| 12-09-T2 | 12-09 | 3 | ANL-01, ANL-07 | T-12-25, T-12-27 | The choice is fair, sticky and re-asked only by the rules. | component + node | `npm --prefix web run test -- --run src/modules/public/hooks/useConsent.test.tsx src/modules/public/components/ConsentBar.test.tsx src/test/no-long-dash.node.test.ts` | ❌ task creates | ⬜ pending |
| 12-09-T3 | 12-09 | 3 | ANL-01, ANL-07 | T-12-25 | The bar is safe for keyboard users and phones, and the existing E2E suite is unaffected. | component + build + e2e | `npm --prefix web run test -- --run src/layouts/PublicLayout.test.tsx` | ✅ | ⬜ pending |
| 12-10-T1 | 12-10 | 3 | ANL-06, ANL-05 | T-12-28, T-12-31 | An anonymous page view is counted per business day and page, with nothing personal stored. | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CollectPageViewHandlerTests"` | ❌ task creates | ⬜ pending |
| 12-10-T2 | 12-10 | 3 | ANL-06, ANL-05 | T-12-28, T-12-29 | Counts cannot be inflated with crafted paths or bots, and parallel beacons never lose a view. | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CollectPageViewHandlerTests"` | ❌ task creates | ⬜ pending |
| 12-10-T3 | 12-10 | 3 | ANL-06, ANL-05 | T-12-30 | Signed-in staff add nothing to the stats, and the beacon limit is generous but real. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*StaffMarkerCookieTests" --filter-class "*PageViewCollectTests" --filter-class "*AnalyticsRateLimitTests" --filter-class "*VerifyCodeEndpointTests" --filter-class "*RefreshRotationTests" --filter-class "*SignOutEndpointTests"` | ❌ task creates | ⬜ pending |
| 12-11-T1 | 12-11 | 3 | LEGAL-01 | T-12-33 | The controller and the retention rules are on the page, matching the owner's rulings. | component | `npm --prefix web run test -- --run src/modules/public/pages/PrivacyPolicyPage.test.tsx` | ❌ task creates | ⬜ pending |
| 12-11-T2 | 12-11 | 3 | LEGAL-01 | T-12-33 | The full DRAFT Privacy Policy is readable and ready for the owner's review. | component + node | `npm --prefix web run test -- --run src/modules/public/pages/PrivacyPolicyPage.test.tsx src/test/legal-content.node.test.ts src/test/no-long-dash.node.test.ts` | ❌ task creates | ⬜ pending |
| 12-12-T1 | 12-12 | 3 | LEGAL-03 | T-12-34 | The core rule for quotes is on the page without any promise the owner did not give. | component | `npm --prefix web run test -- --run src/modules/public/pages/TermsPage.test.tsx` | ❌ task creates | ⬜ pending |
| 12-12-T2 | 12-12 | 3 | LEGAL-03 | T-12-34 | The full DRAFT Terms of Use is readable and ready for the owner's review. | component + node | `npm --prefix web run test -- --run src/modules/public/pages/TermsPage.test.tsx src/test/legal-content.node.test.ts src/test/no-long-dash.node.test.ts` | ❌ task creates | ⬜ pending |
| 12-13-T1 | 12-13 | 4 | ANL-03, ANL-01, LEGAL-05 | T-12-36 | A visitor can change their choice from the footer of any public page. | component | `npm --prefix web run test -- --run src/modules/public/components/CookieSettingsDialog.test.tsx src/modules/public/components/SiteFooter.test.tsx src/modules/public/hooks/useConsent.test.tsx` | ❌ task creates | ⬜ pending |
| 12-13-T2 | 12-13 | 4 | ANL-03, ANL-01, LEGAL-05 | T-12-36 | Every public page links the four legal pages and Cookie Settings in the same order. | component | `npm --prefix web run test -- --run src/modules/public/components/SiteFooter.test.tsx` | ✅ | ⬜ pending |
| 12-13-T3 | 12-13 | 4 | ANL-03, ANL-01, LEGAL-05 | T-12-35 | The window tells the truth about the saved choice and GPC, and the bar's third button opens it fairly. | component + node + build | `npm --prefix web run test -- --run src/modules/public/components/CookieSettingsDialog.test.tsx src/modules/public/hooks/useConsent.test.tsx src/test/no-long-dash.node.test.ts` | ❌ task creates | ⬜ pending |
| 12-14-T1 | 12-14 | 4 | ANL-05 | T-12-38, T-12-39 | A consented visit and its page views are recorded, linked only by a hashed visitor id. | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CollectPageViewHandlerTests"` | ❌ task creates | ⬜ pending |
| 12-14-T2 | 12-14 | 4 | ANL-05 | T-12-37 | Visits are sessionized at 30 minutes and every stored value is reduced and salted. | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CollectPageViewHandlerTests" --filter-class "*VisitorKeyTests"` | ❌ task creates | ⬜ pending |
| 12-14-T3 | 12-14 | 4 | ANL-05 | T-12-40, T-12-41 | Speed samples are stored only for consented visits, within sane bounds. | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CollectVitalsHandlerTests"` | ❌ task creates | ⬜ pending |
| 12-15-T1 | 12-15 | 4 | ANL-05, ANL-06 | T-12-42, T-12-43 | Page views reach the server with the pathname only. | unit | `npm --prefix web run test -- --run src/core/api/http/httpClient.test.ts src/modules/public/services/analyticsService.test.ts src/modules/public/hooks/usePageViewBeacon.test.tsx` | ❌ task creates | ⬜ pending |
| 12-15-T2 | 12-15 | 4 | ANL-05, ANL-06 | T-12-44 | The landing view is counted once, whatever the visitor does with the bar. | unit | `npm --prefix web run test -- --run src/modules/public/hooks/usePageViewBeacon.test.tsx` | ❌ task creates | ⬜ pending |
| 12-15-T3 | 12-15 | 4 | ANL-05, ANL-06 | T-12-44 | Counting costs the visitor nothing they can see. | component + build | `npm --prefix web run test -- --run src/layouts/PublicLayout.test.tsx src/test/no-long-dash.node.test.ts` | ✅ | ⬜ pending |
| 12-16-T1 | 12-16 | 5 | ANL-05 | T-12-45 | Speed numbers from consented visits are measured with Google's library and sent once. | unit | `npm --prefix web run test -- --run src/modules/public/hooks/useSpeedReport.test.tsx src/modules/public/services/analyticsService.test.ts` | ❌ task creates | ⬜ pending |
| 12-16-T2 | 12-16 | 5 | ANL-05 | T-12-45 | Measurement depends on consent and nothing else. | unit | `npm --prefix web run test -- --run src/modules/public/hooks/useSpeedReport.test.tsx src/test/no-long-dash.node.test.ts` | ❌ task creates | ⬜ pending |
| 12-16-T3 | 12-16 | 5 | ANL-05 | T-12-SC, T-12-46 | web-vitals is approved, pinned, recorded and lazy. | arch + gates + build | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DependencyRegistryTests"` | ✅ | ⬜ pending |
| 12-17-T1 | 12-17 | 5 | ANL-04 | T-12-47, T-12-50 | The server deletes exactly this browser's visit records and its visitor id. | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ClearVisitorDataHandlerTests"` | ❌ task creates | ⬜ pending |
| 12-17-T2 | 12-17 | 5 | ANL-04 | T-12-48, T-12-50 | Clearing is confirmed, server first, and leaves the visitor with stats and map off. | component | `npm --prefix web run test -- --run src/modules/public/services/consentService.test.ts src/modules/public/hooks/useConsent.test.tsx src/modules/public/components/ClearDataDialog.test.tsx src/modules/public/components/CookieSettingsDialog.test.tsx` | ❌ task creates | ⬜ pending |
| 12-17-T3 | 12-17 | 5 | ANL-04 | T-12-49 | Clear is safe to retry and honest when it fails. | component + integration | `npm --prefix web run test -- --run src/modules/public/components/ClearDataDialog.test.tsx src/test/no-long-dash.node.test.ts` | ❌ task creates | ⬜ pending |
| 12-18-T1 | 12-18 | 5 | ANL-09 | T-12-51, T-12-52 | Each closed day's referrers and devices are kept as anonymous totals before any raw row ages out. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AnalyticsRetentionJobTests" --filter-class "*DailyAnalyticsCountsMigrationTests" --filter-class "*TriggerInventoryTests" --filter-class "*MigrationScriptTests"` | ❌ task creates | ⬜ pending |
| 12-18-T2 | 12-18 | 5 | ANL-09 | T-12-51, T-12-52 | Raw visit records and consent records are kept for about 13 months and no longer. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AnalyticsRetentionJobTests"` | ❌ task creates | ⬜ pending |
| 12-18-T3 | 12-18 | 5 | ANL-09 | T-12-52, T-12-53 | Every analytics retention rule runs monthly, reports its own line and is tested at its edges. | integration + arch | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*AnalyticsRetentionJobTests" --filter-class "*PurgeExpiredRecordsJobTests"` | ❌ task creates | ⬜ pending |
| 12-19-T1 | 12-19 | 5 | LEGAL-02 | T-12-54 | The cookie list visitors read is exactly the list the code sets. | node + component | `npm --prefix web run test -- --run src/test/cookie-inventory.node.test.ts src/modules/public/pages/CookiePolicyPage.test.tsx` | ❌ task creates | ⬜ pending |
| 12-19-T2 | 12-19 | 5 | LEGAL-02 | T-12-54 | The full DRAFT Cookie Policy is readable, accurate and one press from Cookie Settings. | component + node | `npm --prefix web run test -- --run src/modules/public/pages/CookiePolicyPage.test.tsx src/test/legal-content.node.test.ts src/test/no-long-dash.node.test.ts` | ❌ task creates | ⬜ pending |
| 12-20-T1 | 12-20 | 6 | ANL-01, ANL-07 | T-12-55 | The map follows a saved yes at once. | component | `npm --prefix web run test -- --run src/modules/public/components/contact.test.tsx` | ✅ | ⬜ pending |
| 12-20-T2 | 12-20 | 6 | ANL-01, ANL-07 | T-12-55 | A visitor can turn on maps from the map itself, and the decision is logged. | component + node | `npm --prefix web run test -- --run src/modules/public/components/contact.test.tsx src/modules/public/hooks/useConsent.test.tsx src/test/no-long-dash.node.test.ts` | ✅ (extend) | ⬜ pending |
| 12-21-T1 | 12-21 | 6 | ANL-08 | T-12-56 | A Manager can read the three totals; an Admin and a visitor cannot. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*VisitorStatsReaderTests"` | ❌ task creates | ⬜ pending |
| 12-21-T2 | 12-21 | 6 | ANL-08 | T-12-57 | The server's range rules are explicit, tested and in the business calendar. | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*VisitorStatsRequestValidatorTests" --filter-class "*GetVisitorStatsHandlerTests"` | ❌ task creates | ⬜ pending |
| 12-21-T3 | 12-21 | 6 | ANL-08 | T-12-58 | Old ranges are honest about what the server no longer keeps. | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*GetVisitorStatsHandlerTests"` | ❌ task creates | ⬜ pending |
| 12-22-T1 | 12-22 | 6 | LEGAL-05, LEGAL-01 to 04 | T-12-59, T-12-60 | The owner's per-page answer is recorded, or the review is parked. | manual (owner) | `test -f .planning/phases/12-consent-analytics-legal/12-22-SUMMARY.md && grep -c "owner" .planning/phases/12-consent-analytics-legal/12-22-SUMMARY.md` | n/a | ⬜ pending |
| 12-22-T2 | 12-22 | 6 | LEGAL-05, LEGAL-01 to 04 | T-12-59 | Approved pages are final; the rest stay DRAFT. | unit + integration + node | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*LegalPagesTests" --filter-class "*ConsentCookieTests"` | ✅ (from 12-03, 12-05) | ⬜ pending |
| 12-23-T1 | 12-23 | 7 | ANL-08 | T-12-62 | A Manager reads the three totals for the last 30 days, as the server computed them. | component | `npm --prefix web run test -- --run src/modules/admin/services/visitorStatsService.test.ts src/modules/admin/pages/VisitorStatsPage.test.tsx src/modules/admin/routes.test.tsx src/components/states/EmptyValue.test.tsx` | ❌ task creates | ⬜ pending |
| 12-23-T2 | 12-23 | 7 | ANL-08 | T-12-62 | Managers find Visitor Stats in the menu; Admins never reach it. | component | `npm --prefix web run test -- --run src/components/navigation/Sidebar.test.tsx src/components/navigation/MobileNavDrawer.test.tsx src/components/brand/Icon.test.tsx src/components/index.test.ts src/modules/admin/sections.test.ts src/modules/admin/routes.test.tsx` | ✅ (extend) | ⬜ pending |
| 12-23-T3 | 12-23 | 7 | ANL-08 | T-12-61 | The date range is in the URL, follows the business calendar and rejects bad dates before any request. | unit + component | `npm --prefix web run test -- --run src/modules/admin/visitorStatsRange.test.ts src/modules/admin/hooks/useVisitorStatsParams.test.tsx src/modules/admin/pages/VisitorStatsPage.test.tsx src/test/no-long-dash.node.test.ts` | ❌ task creates | ⬜ pending |
| 12-24-T1 | 12-24 | 7 | ANL-01, ANL-02, ANL-03, ANL-04, ANL-07, LEGAL-05 | T-12-63 | The consent journeys pass in every browser project. | e2e | `npm --prefix web run e2e -- --grep @consent` | ❌ task creates | ⬜ pending |
| 12-24-T2 | 12-24 | 7 | ANL-01, ANL-02, ANL-03, ANL-04, ANL-07, LEGAL-05 | T-12-63 | GPC and keyboard users are proven safe with the bar in place. | e2e | `npm --prefix web run e2e -- --grep "@gpc\|@consent"` | ❌ task creates | ⬜ pending |
| 12-24-T3 | 12-24 | 7 | ANL-01, ANL-02, ANL-03, ANL-04, ANL-07, LEGAL-05 | T-12-63 | The legal pages are accessible at every width and the bar costs no performance score. | e2e + perf | `npm --prefix web run e2e -- --grep @public-sweep` | ✅ (extend) | ⬜ pending |
| 12-25-T1 | 12-25 | 8 | ANL-08 | T-12-64 | The trend for a month is drawn from server buckets. | integration + component | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*VisitorStatsReaderTests"` | ✅ (from 12-21) | ⬜ pending |
| 12-25-T2 | 12-25 | 8 | ANL-08 | T-12-64, T-12-65 | Long ranges read per month, with honest unique-visitor counts. | unit + integration + component | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*GetVisitorStatsHandlerTests"` | ✅ (from 12-21) | ⬜ pending |
| 12-25-T3 | 12-25 | 8 | ANL-08 | T-12-64 | The trend chart is fully usable without a mouse. | component | `npm --prefix web run test -- --run src/components/data/VisitorTrendChart.test.tsx src/test/no-long-dash.node.test.ts` | ❌ task creates | ⬜ pending |
| 12-26-T1 | 12-26 | 9 | ANL-08 | T-12-66 | Top pages are listed with server counts and shares. | integration + component | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*VisitorStatsReaderTests"` | ✅ (from 12-21) | ⬜ pending |
| 12-26-T2 | 12-26 | 9 | ANL-08 | T-12-66, T-12-67 | Every list is correct for old, new and crossing ranges. | unit + integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*GetVisitorStatsHandlerTests"` | ✅ (from 12-21) | ⬜ pending |
| 12-26-T3 | 12-26 | 9 | ANL-08 | T-12-66 | The page shows all four lists clearly in every state. | component | `npm --prefix web run test -- --run src/modules/admin/components/StatBarList.test.tsx src/modules/admin/pages/VisitorStatsPage.test.tsx src/test/no-long-dash.node.test.ts` | ❌ task creates | ⬜ pending |
| 12-27-T1 | 12-27 | 10 | ANL-08 | T-12-68 | Page speed shows in plain words with Google's ratings. | integration + component | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*VisitorStatsReaderTests"` | ✅ (from 12-21) | ⬜ pending |
| 12-27-T2 | 12-27 | 10 | ANL-08 | T-12-68 | Missing data is named, never shown as a number. | unit + component | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*GetVisitorStatsHandlerTests"` | ✅ (from 12-21) | ⬜ pending |
| 12-27-T3 | 12-27 | 10 | ANL-08 | T-12-68 | The Visitor Stats page is complete in every state the UI-SPEC lists. | component | `npm --prefix web run test -- --run src/modules/admin/pages/VisitorStatsPage.test.tsx src/test/no-long-dash.node.test.ts` | ✅ (from 12-23) | ⬜ pending |
| 12-28-T1 | 12-28 | 11 | ANL-08 | T-12-71, T-12-72 | The export works end to end for a Manager. | unit + integration + component | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*VisitorStatsCsvTests"` | ❌ task creates | ⬜ pending |
| 12-28-T2 | 12-28 | 11 | ANL-08 | T-12-69, T-12-70 | The CSV is honest, safe and opens cleanly. | unit + integration + component | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*VisitorStatsCsvTests" --filter-class "*ExportVisitorStatsHandlerTests"` | ❌ task creates | ⬜ pending |
| 12-28-T3 | 12-28 | 11 | ANL-08 | T-12-72 | Exporting is clear and safe from the Manager's side. | component | `npm --prefix web run test -- --run src/modules/admin/pages/VisitorStatsPage.test.tsx src/test/no-long-dash.node.test.ts` | ✅ (from 12-23) | ⬜ pending |
| 12-29-T1 | 12-29 | 11 | ANL-08, ANL-01, LEGAL-05 | T-12-73 | Every Visitor Stats state is visible in the showcase. | component | `npm --prefix web run test -- --run src/dev/renderScenario.test.tsx` | ✅ (extend) | ⬜ pending |
| 12-29-T2 | 12-29 | 11 | ANL-08, ANL-01, LEGAL-05 | T-12-73 | The owner can review every consent and legal state in one place. | component + e2e | `npm --prefix web run test -- --run src/dev/renderScenario.test.tsx src/test/no-long-dash.node.test.ts` | ✅ (extend) | ⬜ pending |
| 12-30-T1 | 12-30 | 12 | ANL-08, ANL-05, ANL-06, ANL-09 | T-12-75 | Recorded visits reach the Manager's page in real browsers. | e2e | `npm --prefix web run e2e -- --grep @visitor-stats` | ❌ task creates | ⬜ pending |
| 12-30-T2 | 12-30 | 12 | ANL-08, ANL-05, ANL-06, ANL-09 | T-12-74 | E2E can prove the old-range behaviour with exact seeded numbers. | integration + build | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*TestingAnalyticsTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*AuthorizationCoverageTests" --filter-class "*IdempotencyCoverageTests" --filter-class "*TestingConfigurationTests"` | ❌ task creates | ⬜ pending |
| 12-30-T3 | 12-30 | 12 | ANL-08, ANL-05, ANL-06, ANL-09 | T-12-74, T-12-75 | The Visitor Stats page and export are proven end to end. | e2e | `npm --prefix web run e2e -- --grep @visitor-stats` | ✅ (from T1) | ⬜ pending |
| 12-31-T1 | 12-31 | 2 | LEGAL-05 (PERF-01, D-42) | T-12-78, T-12-79, T-12-80 | Admin and dev routes work as before, a failed table load shows the admin error screen, and the public first download carries neither route table. | component + build + e2e | `npm --prefix web run test -- --run src/core/routes/router.test.tsx src/modules/admin/routes.test.tsx src/layouts/AdminLayout.test.tsx src/modules/admin/pages/ComponentShowcasePage.test.tsx src/core/routes/ErrorBoundary.test.tsx src/modules/public/pages/NotFoundPage.test.tsx src/modules/public/pages/LegalPages.test.tsx src/test/public-paths.node.test.ts` | ❌ task creates (router.test.tsx) | ⬜ pending |
| 12-31-T2 | 12-31 | 2 | LEGAL-05 (PERF-01, D-42) | T-12-79, T-12-81 | A static import of the admin table into a public page fails the build; every public row has at least 1.0 KB of room in both builds, on record. | unit + build | `npm --prefix web run test -- --run scripts/budget.test.ts scripts/vite-budget-plugin.test.ts` | ✅ (extend) | ⬜ pending |
| 12-31-T3 | 12-31 | 2 | ANL-07 (D-43) | T-12-76, T-12-77 | A consent cookie dated after today is no choice on both sides, from the shared fixture. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*ConsentCookieTests"` | ✅ (extend) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Phase 12 has no separate Wave 0 plan: each item below is delivered by the first plan that needs it, inside its RED step.

- [ ] `tests/fixtures/legal-pages.json` (plan 12-05) and `tests/fixtures/consent-cookie-cases.json` (plan 12-03), shared by C# and TS tests
- [ ] `web/e2e/fixtures.ts`: a default "decided" consent cookie so Phase 11 specs keep passing; opt-out `consent: 'none'` for `@consent`, `@gpc`, `@visitor-stats` (plan 12-09); the web unit-test setup does the same through `resetConsentStore` (plan 12-09) and answers page views with 204 by default (plan 12-15)
- [ ] Testing-only analytics seeding, `POST /api/testing/analytics` (the `TestingSiteContentController` pattern, Testing environment only) for E2E ranges older than 13 months (plan 12-30)
- [ ] E2E server config: raised `RateLimits:Consent` (plan 12-08), `RateLimits:AnalyticsCollect` (plan 12-10) and `RateLimits:AnalyticsClear` (plan 12-17) in `web/playwright.config.ts`
- [ ] Authorization matrix rows, anonymous allow-list entries and idempotency allow-list entries for every new action, each added by the plan that adds the action (plans 12-06, 12-08, 12-10, 12-14, 12-17, 12-21, 12-28, 12-30)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| First public Gallery photo loads on the live site | D-133 carry-over (plan 12-01) | Needs the owner's live admin login | In live admin add one Gallery photo marked shown; open `/gallery` on a phone; confirm it loads from `res.cloudinary.com` with no CSP error |
| Owner approves each legal page's text | LEGAL-05, D-09, D-14 (plan 12-22) | Owner judgment | Read each page on the local dev site; answer per page; approved pages flip to version 1.0 in the fixture, Domain `LegalPages` and web `legalPages.ts` through a reviewed change |
| Safari and Facebook in-app browser cookie behaviour | ANL-01, ANL-07 | Not reproducible in CI | On a real iPhone and in the Facebook app, accept, revisit after a day, confirm the choice holds and the bar does not return |
| Owner UI review of the new screens | C-17, UI-SPEC Visual Review | Owner judgment | `/gsd-ui-review 12` with the showcase scenarios from plan 12-29 and the screenshots the UI-SPEC lists; includes the D-36 wording on the Visitor stats hint ("Records are kept for about 13 months.") |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (no MISSING sentinel is used; TDD tasks write their tests first)
- [x] No watch-mode flags (every Vitest command uses `--run`)
- [ ] Feedback latency < 60s (quick commands yes; E2E, Lighthouse and builds are gate commands)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending (validate-phase sets `status: validated`)
