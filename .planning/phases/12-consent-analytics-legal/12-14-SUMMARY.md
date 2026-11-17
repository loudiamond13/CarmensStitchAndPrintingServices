---
phase: 12-consent-analytics-legal
plan: 14
subsystem: api
tags: [analytics, visits, sessions, referrer, privacy, hmac, salt, web-vitals, ef-migration, anonymous-endpoint]
created: "2026-11-17T06:20:00-06:00"
updated: "2026-11-17T06:20:00-06:00"
status: complete

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-10 CollectPageViewHandler, CollectContext, PageViewRequest.ReferrerHost, RateLimitPolicies.AnalyticsCollect; 12-04 AnalyticsRetention.SessionMinutes, VitalMetric, VitalBounds; 12-02 ReferrerName, DeviceClass, OsFamily, AnalyticsBots, AnalyticsPath, UserAgentFamily; 12-03 ConsentCookie.AllowsStats; 12-05 LegalPages.CookiePolicyVersion; 12-08 visitor id cookie"
provides:
  - "Identified half of collection: AnalyticsVisits, AnalyticsPageViews, AnalyticsVitalSamples, AnalyticsSalts (migration AddAnalyticsVisits)"
  - "POST /api/v1/analytics/vitals (RecordVitals): anonymous, CSRF header, analytics-collect limit, idempotency exempt, 2 KB body, 204"
  - "VisitorKey.HashVisitor (SHA-256) and VisitorKey.HashIp (HMAC-SHA256 with the day's salt)"
  - "Ports IAnalyticsVisits and IAnalyticsSalts; CollectContext.SiteHost"
  - "Contracts for 12-15 (consent withdrawal and Clear), 12-17 (Clear deletes by visitor hash), 12-18 (purge of visits at 13 months and salts after 2 days), 12-21 and 12-22 (stats reads)"
affects: [12-15, 12-17, 12-18, 12-21, 12-22]

actuals:
  tokens: 31300
  tasks: 3
  commits: 8
plan_head_before: e9a110c3b00517baabc84f29400c89089d2c581f
plan_head_after: 4a64e2b4515403935aea92679bc8965a82db8532
commits: 8

tech-stack:
  added: []
  patterns:
    - "Identified branch runs after the anonymous count: visitor id, AllowsStats for the current policy version and today, no GPC (one shared IdentifiedCollection gate for page views and vitals)"
    - "Visit counters change through one ExecuteUpdate (PageViews + 1, last-seen never moves back), no row version"
    - "Process-wide salt cache (singleton) behind a scoped store; first caller of a day inserts, a unique-key race reads the winner's salt back"
    - "Every stored value is reduced before it reaches the store: hash of the id, a source name, device class, family labels, an HMAC of the address prefix"

key-files:
  created:
    - src/Csps.Domain/Analytics/AnalyticsVisit.cs
    - src/Csps.Domain/Analytics/AnalyticsPageView.cs
    - src/Csps.Domain/Analytics/AnalyticsVitalSample.cs
    - src/Csps.Domain/Analytics/AnalyticsSalt.cs
    - src/Csps.Application/Analytics/VisitorKey.cs
    - src/Csps.Application/Analytics/IdentifiedCollection.cs
    - src/Csps.Application/Analytics/VitalsRequest.cs
    - src/Csps.Application/Analytics/VitalsRequestValidator.cs
    - src/Csps.Application/Analytics/CollectVitalsHandler.cs
    - src/Csps.Application/Ports/IAnalyticsVisits.cs
    - src/Csps.Application/Ports/IAnalyticsSalts.cs
    - src/Csps.Infrastructure/Analytics/AnalyticsVisits.cs
    - src/Csps.Infrastructure/Analytics/AnalyticsSalts.cs
    - src/Csps.Infrastructure/Analytics/AnalyticsSaltCache.cs
    - src/Csps.Infrastructure/Persistence/Configurations/AnalyticsVisitConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/AnalyticsPageViewConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/AnalyticsVitalSampleConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/AnalyticsSaltConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261117105658_AddAnalyticsVisits.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261117105658_AddAnalyticsVisits.Designer.cs
    - tests/Csps.Domain.UnitTests/Analytics/AnalyticsVisitTests.cs
    - tests/Csps.Application.UnitTests/Analytics/VisitorKeyTests.cs
    - tests/Csps.Application.UnitTests/Analytics/CollectVitalsHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Analytics/AnalyticsVisitsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/AnalyticsVisitsMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Analytics/VitalsCollectTests.cs
  modified:
    - src/Csps.Application/Analytics/CollectPageViewHandler.cs
    - src/Csps.Application/Analytics/CollectContext.cs
    - src/Csps.Infrastructure/Analytics/AnalyticsRegistration.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Controllers/AnalyticsController.cs
    - src/Csps.Server/Composition/AnalyticsApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Analytics/CollectPageViewHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "The visitor id cookie must be 43 base64url characters (AnalyticsCookies.IsVisitorId) or the controller treats it as absent, so a junk or oversized value is never hashed or stored"
  - "The site's own host reaches the handler as CollectContext.SiteHost (from App:PublicBaseUrl, read in the controller), so Application never reads Infrastructure options"
  - "A speed report is not a page view: it adds samples only and does not touch the visit's last-seen time"
  - "A vitals report with no current visit stores nothing (it never starts a visit)"
  - "The salt cache is a process singleton that drops days older than the 2-day salt lifetime when a newer day is added; the store itself is scoped"

requirements-completed: [ANL-05]

metrics:
  duration: "about 2h"
  completed: 2026-11-17
---

# Phase 12 Plan 14: With consent, visits, sessions, referrers, devices and page speed are recorded without storing anyone's IP Summary

**A visitor who has the HttpOnly visitor id, a current "stats on" choice and no GPC now gets a visit (30 minute sessions), page views and Core Web Vitals samples recorded, and every stored value is reduced first: SHA-256 of the id, a source name, a device class, browser and OS labels, and an HMAC of the /24 or /48 address prefix under a random per-day salt.**

## What was built

- **Domain.** `AnalyticsVisit.Start` (one page view, last seen = start, validates 32-byte hashes and column lengths), `AnalyticsPageView.Of`, `AnalyticsVitalSample.Of` (checks `VitalBounds`, rounds to 3 decimals), `AnalyticsSalt.Create` (exactly 32 bytes).
- **Application.** `CollectPageViewHandler` keeps the anonymous count first, then the identified branch: `IdentifiedCollection.IsAllowed` (visitor id present, `ConsentCookie.TryParse` plus `AllowsStats(LegalPages.CookiePolicyVersion, today)`, no GPC), `VisitorKey.HashVisitor`, `FindCurrentAsync` with a cut of now minus `AnalyticsRetention.SessionMinutes`, then touch or start, then add the page view. A new visit stores `ReferrerName.From(referrerHost, siteHost, userAgent)`, `DeviceClass.From`, `UserAgentFamily.Classify`, `OsFamily.From` and the address hash (null with no remote address, and then no salt is read). `CollectVitalsHandler` runs the same bot, staff and identified gates, finds the current visit, keeps each metric that passes `VitalBounds.IsValid` and inserts one sample each with the business day and the page key of the cut path.
- **Infrastructure.** `AnalyticsVisits` (atomic `ExecuteUpdate` touch with a last-seen that never moves back), `AnalyticsSalts` (`RandomNumberGenerator.GetBytes(32)`, unique-key race read back), `AnalyticsSaltCache`, four configurations, migration `AddAnalyticsVisits`.
- **Server.** `POST /api/v1/analytics/vitals` (`RecordVitals`) on `AnalyticsController` with the same attribute set as page views. Matrix row (400, 400, 400), anonymous allow-list entry, idempotency allow-list entry, `RateLimitTests.LimitedEndpoints` row (120), OpenAPI snapshot and `web/src/types/api.generated.ts` regenerated.

### Migration (generated by `dotnet ef migrations add AddAnalyticsVisits`, read in full)

Real name `20261117105658_AddAnalyticsVisits` (the plan's `20261116000003` was a placeholder). It touches only the four new tables.

```csharp
// Up (columns and keys)
CreateTable AnalyticsSalts   (BusinessDay date PK, Salt binary(32))
CreateTable AnalyticsVisits  (Id uniqueidentifier PK, VisitorHash binary(32), BusinessDay date, StartedAtUtc datetimeoffset,
                              LastSeenAtUtc datetimeoffset, Referrer varchar(253), Device tinyint, Browser varchar(20),
                              Os varchar(20), IpHash binary(32) null, PageViews int)
CreateTable AnalyticsPageViews (Id bigint identity PK, VisitId FK cascade, BusinessDay date, OccurredAtUtc datetimeoffset, PageKey varchar(32))
CreateTable AnalyticsVitalSamples (Id bigint identity PK, VisitId FK cascade, BusinessDay date, Metric tinyint, Value decimal(9,3), PageKey varchar(32))
CreateIndex IX_AnalyticsPageViews_BusinessDay, IX_AnalyticsPageViews_VisitId,
            IX_AnalyticsVisits_BusinessDay INCLUDE (VisitorHash, Referrer, Device, Browser),
            IX_AnalyticsVisits_VisitorHash_LastSeenAtUtc, IX_AnalyticsVitalSamples_BusinessDay_Metric_Value, IX_AnalyticsVitalSamples_VisitId

// Down
DropTable AnalyticsPageViews; AnalyticsSalts; AnalyticsVitalSamples; AnalyticsVisits
```

No JSON column, no row version, no trigger (OR-7), no change to any other table. `TriggerInventoryTests` and `MigrationScriptTests` pass.

## TDD record

The dotnet MTP console output is not a format `tdd-red-evidence` reads, so each RED was assessed by hand: the target tests ran and failed on the planned behavior, not on a build or fixture fault. A mapped entity with no migration makes every database test fail with `PendingModelChangesWarning`, so (as in 12-08 and 12-10) the generated migration, configurations and entities went in with the Task 1 RED commit and the schema tests pass on arrival. Domain `AnalyticsVisitTests` also pass on arrival for the same reason (the entities had to exist for the migration); they were written against the plan's rules and cover every branch (Domain coverage must stay at 100 percent).

- **Task 1 RED** (`25ca3abe`). Application `CollectPageViewHandlerTests`: "total: 44, failed: 3" (no visit started or touched, no page view). Server `PageViewCollectTests`: "total: 30, failed: 1" (`AVisitorWhoAcceptedStatsOpensTwoPages...`: no visit row). The gate tests (no vid, rejected choice, GPC, malformed vid) pass on arrival because the stub stores nothing.
- **Task 1 GREEN** (`b5ea10d9`). Application "total: 44, failed: 0"; Server "total: 30, failed: 0"; Infrastructure (`AnalyticsVisitsMigrationTests`, `TriggerInventoryTests`, `MigrationScriptTests`) "total: 21, failed: 0". Tracer gate: `human_verify_mode` default `end-of-phase` and the tracer's `<verify>` is automated only, so the three verify groups were re-run after GREEN, passed, and the plan continued.
- **Task 2 RED** (`92d0d69e`). Application `VisitorKeyTests` plus handler: "total: 71, failed: 14". Infrastructure `AnalyticsVisitsTests`: "total: 15, failed: 4" (salt store made no row). Server `PageViewCollectTests`: "total: 40, failed: 6" (source name, address hash, salt rows, stored-value scan). The 29/31 minute session test passes on arrival: the 30 minute window lives in the visit store from Task 1.
- **Task 2 GREEN** (`ecad696a`). Application "total: 71, failed: 0"; Infrastructure "total: 15, failed: 0"; Server "total: 40, failed: 0".
- **Task 3 RED** (`bafa2c22`). Application `CollectVitalsHandlerTests`: "total: 30, failed: 13". Server (`VitalsCollectTests`, matrix, coverage, idempotency, snapshot, `RateLimitTests`): "total: 674, failed: 24" (404 for the missing endpoint, the three matrix rows, `ParallelCallersEachGetTheirOwnStatus`, coverage).
- **Task 3 GREEN** (`047dd705`). Application "total: 30, failed: 0". Server (same classes plus `PageViewCollectTests`): "total: 714, failed: 0, succeeded: 714". `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- **Style** (`12c90c19`). `dotnet format Csps.slnx --verify-no-changes` flagged a field name (`IDE1006`, `_entries`) and three spacing slips from my own edits; fixed. Re-run: exit 0, no output.
- **Coordinator note, pending cookie** (`4a64e2b4`). The page-view beacon can arrive carrying only the client-written pending consent cookie (the choice is still in flight). RED: Application handler theories "total: 93, failed: 2" (the new pending row for both handlers). GREEN: "total: 93, failed: 0"; Server `PageViewCollectTests` plus `VitalsCollectTests` "total: 59, failed: 0" (new cases: pending cookie with a vid, unreadable cookie with a vid; both store only the anonymous count).
- **REFACTOR.** None needed.
- **Wider runs on the final tree** (`CSPS_TEST_SQL=localdb`): `Csps.Domain.UnitTests` "total: 2260, failed: 0"; `Csps.Application.UnitTests` "total: 3209, failed: 0"; `Csps.ArchitectureTests` "total: 290, failed: 0"; `Csps.Infrastructure.IntegrationTests` "total: 1257, failed: 0, succeeded: 1256, skipped: 1" (the skip is the live HIBP test, not from this plan); `Csps.Server.IntegrationTests` full run was started and cut short by me: it hit "Connection Timeout Expired" and fixture start-up failures on LocalDB (79 failures, 77 of them connection timeouts) while sibling agents used the same instance, so it proves nothing either way. Instead the Analytics, RateLimiting, Authorization, Idempotency and Http namespaces ran: "total: 1239, failed: 0, succeeded: 1239". The rest of the Server suite was not run (see Deferred Issues).

## Plan truths and where they are proven

- **ANL-05 gates** (vid, AllowsStats current version and today, no GPC; otherwise only the anonymous count): `CollectPageViewHandlerTests.WithoutAllThreeIdentifiedGatesOnlyTheAnonymousCountChanges` (null and empty vid, no cookie, junk cookie, stats off, not chosen, old policy version, 12 months old, dated tomorrow, GPC); `PageViewCollectTests.WithoutTheVidAnAcceptedChoiceAndNoGpcOnlyTheAnonymousCountChanges` (also a malformed vid).
- **Visit reuse and row shape:** `AVisitorWhoAcceptedStatsOpensTwoPagesAndOneVisitWithTwoPageViewsIsRecorded` (one visit, PageViews 2, two page-view rows, keys home and gallery); `APageViewTwentyNineMinutes...ReusesTheVisit...ThirtyOneMinutes...StartsANewOne` (FakeTimeProvider); `AnalyticsVisitsTests` (cut is strict, newest visit wins, 20 parallel touches give 21, last-seen never moves back, cascade delete).
- **Visitor id stored only as SHA-256:** `VisitorKeyTests`, handler test on the stored hash, server test `NoStoredColumnHoldsTheRawAddress...`.
- **IP never stored in clear:** `TheAddressHashIsTheHmacOfTheTruncatedPrefixWithTheDaysSalt` (192.0.2.10 gives the HMAC of "192.0.2.0"), the IPv6 /48 case, `TwoAddressesInTheSameBlockOnTheSameDay...` (192.0.2.10 and 192.0.2.200 equal, next day different), `WithoutARemoteAddressTheHashIsNullAndNoSaltIsRead`, server test with `RemoteIpStartupFilter` (same hash same day, different next day, salts table has 2 rows for 2 days), `TenParallelFirstViewsFromTenVisitorsMakeOneSaltRowForTheDay`, `AnalyticsVisitsTests` ten parallel salt requests (separate caches force the database race, and a shared cache) leave one row.
- **Referrer name (D-28, D-37), [EDGE ANL-05 empty]:** beacon host 'm.facebook.com' gives Facebook; no referrer with an FBAN header gives Facebook; no referrer with desktop Chrome gives Direct; the site's own host gives Direct; 'www.google.com' gives Google; a full URL or anything not a host name gives Direct and is never stored (handler and server tests).
- **Vitals (ANL-05):** `{ lcp 2100, cls 0.04, inp 180 }` gives three samples against the current visit with the page key 'contact' from `/contact?x=1#y` (this also proves the [UI paths] backstop statement); `lcp 70000` drops only itself; each metric out of range on its own; values exactly on the limit are kept; no current visit, rejected choice, GPC, bot, staff marker, no vid and a signed-in staff browser store nothing; every well-formed case answers 204; a bad body is 400 naming `path`; no CSRF header is 403; a 3 KB body is refused.
- **D-41 (rows stay when stats go off):** `TheSamplesStayWhenTheVisitorLaterTurnsStatsOff`. Nothing in this plan deletes a row.
- **Schema:** `AnalyticsVisitsMigrationTests` (exact columns, types and nullability per table, primary keys, all five indexes with the include list, cascade foreign keys, no JSON, no row version, no trigger on any of the four tables, test reset empties them).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The generated migration and the entity configurations went into the Task 1 RED commit**
- **Issue:** A mapped entity with no migration makes every database test fail with `PendingModelChangesWarning` (a fixture fault, not a valid RED).
- **Fix:** Entities, configurations and the generated migration were committed with the RED tests; the behavior tests are the RED. Same pattern as 12-08 and 12-10.
- **Commit:** 25ca3abe

**2. [Rule 2 - Missing critical] A malformed visitor id is treated as absent**
- **Issue:** The plan only says the request must carry `__Secure-csps_vid`. Any string up to the cookie size limit would have been hashed and could have created visits.
- **Fix:** The controller passes the value only when `AnalyticsCookies.IsVisitorId` holds (43 base64url characters, as `ISecureRandom.NewToken` makes them).
- **Files modified:** `src/Csps.Server/Controllers/AnalyticsController.cs`
- **Commit:** b5ea10d9

**3. [Rule 2 - Missing critical] Tests outside the plan's file list**
- `src/Csps.Application/Analytics/IdentifiedCollection.cs` (one shared gate for page views and vitals), `src/Csps.Infrastructure/Analytics/AnalyticsSaltCache.cs` (process cache split from the scoped store), `tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs` (the new endpoint needs a row in `LimitedEndpoints`). `CollectContext` gained an optional trailing `SiteHost`. No Playwright or owner-review lift was needed: the new endpoint uses the existing `analytics-collect` policy, whose limit those hosts already lift.

**4. [Rule 2 - Missing critical] A pending consent cookie counts as no consent (coordinator note from 12-15)**
- **Issue:** `ConsentCookie.AllowsStats` ignores the pending marker, so a pending cookie with stats on, sent with a visitor id from an earlier choice, would have opened the identified gates.
- **Fix:** `IdentifiedCollection.IsAllowed` also requires `!cookie.Pending`. An unreadable cookie already failed `TryParse`. Nothing is recorded, nothing crashes, the anonymous count is unchanged. The beacon (`web/src`) was not touched.
- **Files modified:** `src/Csps.Application/Analytics/IdentifiedCollection.cs` and the handler and endpoint tests.
- **Commit:** 4a64e2b4

### Smaller notes

- The plan's "AnalyticsSalts caches the day's salt in process" is a singleton `AnalyticsSaltCache` used by the scoped store, so each test factory gets its own cache and the tests can see the database rows.
- `AnalyticsVisitsTests` in Infrastructure also holds the salt tests (the plan names only that one file for Task 2's store tests).
- The commit trailer is `Co-Authored-By: Claude Sonnet 5.5`, as in plans 12-08, 12-10 and 12-31 (the plan text says Opus 5.5; this run is Sonnet 5.5 and the session attribution rule applies).
- The plan commit ledger file in the shared git dir was not used; `plan_head_before` is the dispatch base commit and `commits: 8` is `git rev-list --count e9a110c3..HEAD` before this SUMMARY commit.
- `actuals.tokens` is chars/4 over the hand-written diff (OpenAPI snapshot, generated types, migration Designer, snapshot and migration excluded), 125,179 characters.
- A vitals report whose path is unknown counts under the page key `not-found`, the same as page views (the resolver is the page key allow-list).

## Deferred Issues

- **Full Server suite not run to the end.** LocalDB connection timeouts under load from other agents ended the attempt; the namespaces that this plan touches (1239 tests) pass. Worth one clean full run when the machine is quiet. Not run: Playwright E2E and the web unit suite (only the generated types file changed in `web`; `npm --prefix tools/openapi-gen run check` passes).

## Known Stubs

None. The compile-only stubs from the RED commits are gone in HEAD (`AnalyticsVisits`, `AnalyticsSalts`, `VisitorKey.HashIp`, `CollectVitalsHandler`, the handler wiring).

## Threat Flags

None beyond the plan's register. T-12-37 (prefix cut, HMAC with a random per-day salt, 32 random bytes from `RandomNumberGenerator`; salt deletion after 2 days is plan 12-18), T-12-38 (only SHA-256 of the cookie value stored), T-12-39 (three server gates, tested one by one), T-12-40 (`VitalBounds`, consented visits only, the per-address limit), T-12-41 (2 KB body, limit, three samples at most per report; 13-month purge is plan 12-18) and T-12-SC (no package added or bumped; `npm ci` in `tools/openapi-gen` used the existing lockfile) are in place and tested. The only new network surface is the plan's own endpoint.

## Notes for plans 12-15, 12-17, 12-18, 12-21 and 12-22

- **12-17 (Clear)** deletes by `VisitorHash`: `VisitorKey.HashVisitor(token)` gives the value; deleting an `AnalyticsVisits` row cascades to its page views and samples.
- **12-18 (purge)**: visits older than `AnalyticsRetention.RawCut(today)` go by `AnalyticsVisits.BusinessDay`; salts older than `SaltDays` go by `AnalyticsSalts.BusinessDay`. The salt cache already forgets those days; a purge that runs while the process is up cannot bring a deleted salt back.
- **12-21/12-22 (reads)**: `IX_AnalyticsVisits_BusinessDay` includes `VisitorHash`, `Referrer`, `Device`, `Browser`, so the day roll-ups (unique visitors, sources, devices, browsers) need no table scan. `Os` and `IpHash` are not in the include list. Page counts of identified visitors are in `AnalyticsPageViews` (`BusinessDay`, `PageKey`); speed percentiles in `AnalyticsVitalSamples` (`BusinessDay`, `Metric`, `Value`).
- **Client plans**: the beacon JSON is `{ path, lcp?, cls?, inp? }` for vitals and `{ path, referrerHost? }` for page views; `referrerHost` only matters on the first view of a visit.

## Self-Check: PASSED

- Created files and the migration exist on disk (spot check: `VisitorKey.cs`, `AnalyticsSalts.cs`, `20261117105658_AddAnalyticsVisits.cs`, `AnalyticsController.cs`).
- All 8 plan commits are on the branch: 25ca3abe, b5ea10d9, 92d0d69e, ecad696a, bafa2c22, 047dd705, 12c90c19, 4a64e2b4. The SUMMARY commit follows them.
- Acceptance greps all at least 1: `"AnalyticsVisits"` in the visit configuration, `OnDelete(DeleteBehavior.Cascade)` in the page view configuration, `AllowsStats` (named in the handler docs; the call is in `IdentifiedCollection`), `IpPrefix.From` and `ReferrerName.From` in the handler, `RandomNumberGenerator` in `AnalyticsSalts.cs`, `POST /api/v1/analytics/vitals` in the idempotency allow-list, `VitalBounds.IsValid` in the vitals handler, `RecordVitals` in `api.generated.ts`.
- STATE.md and ROADMAP.md were not changed.
