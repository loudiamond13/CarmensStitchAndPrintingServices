---
phase: 12-consent-analytics-legal
plan: 10
subsystem: api
tags: [analytics, page-views, privacy, rate-limit, ef-migration, staff-marker, anonymous-endpoint]
created: "2026-11-17T02:20:00-06:00"
updated: "2026-11-17T02:20:00-06:00"
status: complete

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-02 AnalyticsPath.Cut, PageKeys, AnalyticsBots.IsBot; 12-05 PublicRouteTable with the legal pages; 12-08 AnalyticsCookies, RateLimitPolicies pattern, AnalyticsApplicationRegistration, AddCspsAnalytics"
provides:
  - "POST /api/v1/analytics/page-views (RecordPageView): anonymous, CSRF header, analytics-collect limit, 2 KB body, idempotency exempt, 204"
  - "DailyPageCounts table (AddDailyPageCounts) and DailyPageCount.First"
  - "CollectPageViewHandler gates: validate, bot or missing User-Agent, staff, cut path, page key, business day"
  - "Contracts for 12-14, 12-15 and 12-21: PageViewRequest, CollectContext, IPublicPageResolver, IPageViewCounts, AnalyticsCookies.StaffCookieName, SetStaff, ClearStaff, RateLimitPolicies.AnalyticsCollect"
  - "__Secure-csps_staff marker set and cleared together with the refresh cookie"
affects: [12-14, 12-15, 12-18, 12-21, 12-25]

actuals:
  tokens: 18200
  tasks: 3
  commits: 6
plan_head_before: f7b99813f91e7c276154ef3b323fb163c82816f1
plan_head_after: 5bb474e4deca194ef90d870b30050cf435590769
commits: 6

tech-stack:
  added: []
  patterns:
    - "Update-then-insert counter: ExecuteUpdate (Views + 1), insert on 0 rows, retry once on SQL 2627 or 2601"
    - "Every gate that drops a view answers success with no content, so a bot or staff member learns nothing"
    - "Application port IPublicPageResolver implemented in Server over the route table"
    - "The staff marker is written and deleted inside AuthCookies.SetRefresh and ClearRefresh, so no call site can forget it"

key-files:
  created:
    - src/Csps.Domain/Analytics/DailyPageCount.cs
    - src/Csps.Application/Analytics/PageViewRequest.cs
    - src/Csps.Application/Analytics/PageViewRequestValidator.cs
    - src/Csps.Application/Analytics/PageViewErrors.cs
    - src/Csps.Application/Analytics/CollectContext.cs
    - src/Csps.Application/Analytics/CollectPageViewHandler.cs
    - src/Csps.Application/Ports/IPageViewCounts.cs
    - src/Csps.Application/Ports/IPublicPageResolver.cs
    - src/Csps.Infrastructure/Analytics/PageViewCounts.cs
    - src/Csps.Infrastructure/Persistence/Configurations/DailyPageCountConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261117073144_AddDailyPageCounts.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261117073144_AddDailyPageCounts.Designer.cs
    - src/Csps.Server/Controllers/AnalyticsController.cs
    - src/Csps.Server/Endpoints/PublicPageResolver.cs
    - tests/Csps.Domain.UnitTests/Analytics/DailyPageCountTests.cs
    - tests/Csps.Application.UnitTests/Analytics/CollectPageViewHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Analytics/PageViewCountsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/DailyPageCountsMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Analytics/PageViewCollectTests.cs
    - tests/Csps.Server.IntegrationTests/Analytics/PublicPageResolverTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/StaffMarkerCookieTests.cs
  modified:
    - src/Csps.Infrastructure/Analytics/AnalyticsRegistration.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/SqlErrors.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Composition/AnalyticsApplicationRegistration.cs
    - src/Csps.Server/Security/AnalyticsCookies.cs
    - src/Csps.Server/Security/AuthCookies.cs
    - src/Csps.Server/Security/RateLimitSettings.cs
    - src/Csps.Server/Security/RateLimitingRegistration.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/playwright.config.ts
    - web/scripts/owner-review.mjs
    - web/scripts/owner-review.test.ts

key-decisions:
  - "The body check runs before the bot and staff gates, so a bad body is a 400 for everyone and a signed-in caller is not told apart (matrix row: 400, 400, 400)"
  - "Any value of the staff marker cookie counts, and so does any Authorization header: the only cost of a forged marker is that its own sender is not counted"
  - "The page key allow-list is the route table: a known page, else not-found, so the table grows by at most nine rows a day"
  - "The 409 retry detaches only the failed row instead of clearing the whole change tracker"

requirements-completed: [ANL-06, ANL-05]

metrics:
  duration: 75min
  completed: 2026-11-17
---

# Phase 12 Plan 10: Every public page view is counted by day without cookies, and staff and bots are left out Summary

**`POST /api/v1/analytics/page-views` adds one to an anonymous (Asia/Manila business day, page key) counter for every visitor who is not a bot or signed-in staff, stores nothing else, sets no cookie, and answers 204; the staff marker cookie is set and cleared with the refresh cookie so staff browsing the public site are never counted.**

## What was built

- **Domain.** `DailyPageCount` (`BusinessDay`, `PageKey`, `Views`), made only by `First(day, key)` with a count of one. It refuses a blank key or one longer than 32.
- **Application.** `CollectPageViewHandler` in this order: validate the body (path required, starts with `/`, at most 2,048 characters), drop a bot or a missing User-Agent (`AnalyticsBots.IsBot`), drop staff (`CollectContext.IsStaff`), cut the path at the first `?` or `#` (`AnalyticsPath.Cut`), map it with `IPublicPageResolver` (null stores nothing), then `IPageViewCounts.IncrementAsync` with the business day from `IBusinessCalendar`. Every drop answers success. Contracts: `PageViewRequest { Path, ReferrerHost }`, `CollectContext(UserAgent, IsStaff, Gpc, VisitorToken, ConsentCookie)`.
- **Infrastructure.** `PageViewCounts`: `ExecuteUpdate(Views + 1)`, insert `DailyPageCount.First` when 0 rows changed, and on SQL 2627 or 2601 (new `SqlErrors.UniqueKeyViolation` and `SqlErrors.DuplicateKey`) detach the failed row and run the update once more. No inline SQL. Migration `AddDailyPageCounts`.
- **Server.** `AnalyticsController` (`[Route("api/v1/analytics")]`, action `RecordPageView`), `PublicPageResolver` over `PublicRouteTable` (known page gives its key, any other public path gives `not-found`, admin and dev paths give null), `AnalyticsCookies.StaffCookieName/SetStaff/ClearStaff`, `AuthCookies.SetRefresh/ClearRefresh` also set and clear the marker, `RateLimitPolicies.AnalyticsCollect` with `AnalyticsCollectRateLimit` (`RateLimits:AnalyticsCollect`, 120 a minute, `Validate()` names settings only).
- **Contract.** OpenAPI snapshot and `web/src/types/api.generated.ts` regenerated (`npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json.").

### Staff marker cookie (as sent)

| Cookie | Path | Flags | Value | Expires |
|---|---|---|---|---|
| `__Secure-csps_staff` | `/api/v1/analytics` | HttpOnly, Secure, SameSite=Strict | `1` | same as the refresh cookie (none for a browser-session sign-in) |
| `__Secure-csps_rt` (unchanged) | `/api/v1/auth` | HttpOnly, Secure, SameSite=Strict | token | as before |

### Migration (generated by `dotnet ef migrations add AddDailyPageCounts`, read in full)

Real name `20261117073144_AddDailyPageCounts` (the plan's `20261116000002` was a placeholder). It touches only the new table.

```csharp
// Up
migrationBuilder.CreateTable(
    name: "DailyPageCounts",
    columns: table => new
    {
        BusinessDay = table.Column<DateOnly>(type: "date", nullable: false),
        PageKey = table.Column<string>(type: "varchar(32)", unicode: false, maxLength: 32, nullable: false),
        Views = table.Column<int>(type: "int", nullable: false)
    },
    constraints: table => { table.PrimaryKey("PK_DailyPageCounts", x => new { x.BusinessDay, x.PageKey }); });

// Down
migrationBuilder.DropTable(name: "DailyPageCounts");
```

No JSON column, no row version, no trigger (OR-7), no foreign key. `TriggerInventoryTests` and `MigrationScriptTests` pass.

### Matrix, lists and limits

- Matrix row `POST /api/v1/analytics/page-views`: Anonymous 400, Admin 400, Manager 400 (no body gives the missing-path 400 before any staff check). Anonymous allow-list key added.
- Idempotency allow-list entry with the same reason as the attribute ("An analytics beacon: a repeat only adds one page view, and beacons are exempt by SEC-06.").
- `RateLimitTests.LimitedEndpoints` row `{ "POST", "/api/v1/analytics/page-views", 120 }`. `CspsApiFactory` lifts the limit to 100000, `RealLimitsFactory` restores 120.
- `web/playwright.config.ts` and `web/scripts/owner-review.mjs` both lift `RateLimits__AnalyticsCollect__PermitLimit`; `web/scripts/owner-review.test.ts` pins it.

## TDD record

The dotnet MTP console output is not a format `tdd-red-evidence` reads, so each RED was assessed by hand: the target tests ran and failed on the planned behavior, not on a build or fixture fault (compile-only stubs made the code build).

- **Task 1 RED** (`7da1de99`). Domain `DailyPageCountTests`: "total: 7, failed: 5" (`row.Views should be 1 but was 0`; the over-long key did not throw). Application `CollectPageViewHandlerTests`: "total: 9, failed: 7" (stub counted nothing and the empty validator had no rules). Infrastructure: "total: 7, failed: 3" (`PageViewCountsTests`, no row written); the four `DailyPageCountsMigrationTests` **pass on arrival** because they check the schema the generated migration creates (same as 12-08; the model without a migration fails every database test with `PendingModelChangesWarning`, which is an invalid RED). Server: "total: 607, failed: 23" (404 for the missing endpoint, the three matrix rows, `DiscoveredEndpointsAreFullyCovered`, `ParallelCallersEachGetTheirOwnStatus`, `IdempotencyCoverageTests`, the resolver stub returning null).
- **Task 1 GREEN** (`078314a4`). Domain 7, Application 9, Infrastructure (`DailyPageCountsMigrationTests`, `PageViewCountsTests`, `TriggerInventoryTests`, `MigrationScriptTests`) "total: 15, failed: 0". Server (`PageViewCollectTests`, `PublicPageResolverTests`, matrix, coverage, idempotency coverage, `OpenApiSnapshotTests`, `RateLimitTests`): "total: 670, failed: 0". Tracer gate: auto-mode not assumed; `human_verify_mode` default `end-of-phase` and the tracer's `<verify>` is automated only, so the three verify groups were re-run after GREEN and passed, then the plan continued. The limiter (policy and `AnalyticsCollectRateLimit`) went into Task 1 because `[EnableRateLimiting]` needs the named policy to exist.
- **Task 2 RED** (`54769011`). Application "total: 26, failed: 12" (path not cut, bots counted, null User-Agent counted, defensive cut branch). Infrastructure "total: 6, failed: 2" (`DbUpdateException` on the duplicate key in the ten parallel first views and the 30-view three-page case). Server `PageViewCollectTests` "total: 18, failed: 4" (crafted path counted as not-found; Googlebot, HeadlessChrome and a missing User-Agent counted). The 400, admin, dev, not-found and log tests pass on arrival: they guard behavior Task 1 already gave.
- **Task 2 GREEN** (`39cd2c0c`). Application 26, Infrastructure 6, Server 18, all passed.
- **Task 3 RED** (`0726d1ba`). Server "total: 43, failed: 10" (no marker in the verify, refresh, sign-out and set-new-password answers; marker cookie and bearer token still counted). The four `AnalyticsRateLimitTests` additions pass on arrival (the limit came in Task 1), as in 12-08. One more Application test (`ASignedInStaffMemberStoresNothingAndStillSucceeds`) was written first and seen to fail ("total: 28, failed: 1") before the handler change, and went in with the GREEN commit.
- **Task 3 GREEN** (`5bb474e4`). Application "total: 28, failed: 0". Server (`StaffMarkerCookieTests`, `PageViewCollectTests`, `AnalyticsRateLimitTests`, `VerifyCodeEndpointTests`, `RefreshRotationTests`, `RefreshEndpointTests`, `SignOutEndpointTests`, `MustChangePasswordTests`, `InviteTests`, `PasswordResetTests`): "total: 126, failed: 0, succeeded: 126". `web` `owner-review.test.ts`: "Tests 119 passed (119)". Prettier and ESLint (`--max-warnings 0`) clean on the three web files.
- **Wider runs on the final tree** (`CSPS_TEST_SQL=localdb`): `Csps.Domain.UnitTests` "total: 2234, failed: 0"; `Csps.Application.UnitTests` "total: 3136, failed: 0"; `Csps.ArchitectureTests` "total: 290, failed: 0"; `Csps.Infrastructure.IntegrationTests` "total: 1229, failed: 0, succeeded: 1228, skipped: 1" (the one skip is not from this plan); `Csps.Server.IntegrationTests` "total: 2977, failed: 1" (see Deferred Issues). `dotnet build Csps.slnx -warnaserror`: "0 Warning(s) 0 Error(s)". `dotnet format Csps.slnx --verify-no-changes`: exit 0. `npm --prefix tools/openapi-gen run check`: passes.

### REFACTOR

None needed. No `refactor(12-10)` commit.

## Plan truths and where they are proven

- ANL-06 counts one view for the business day, 204, no cookie: `PageViewCollectTests.AGalleryViewFromADesktopBrowser...`, `TheSecondViewOfTheSamePageAddsOneToTheSameRow`, handler tests (business day 2026-11-17 against UTC 2026-11-16).
- ANL-06 prohibition (no identifier without consent): `DailyPageCountTests.TheRowHoldsNothingAboutTheVisitor` and the 3-column migration test (the table has no column for an id, address or browser); `TheReferrerHostAndTheOtherContextValuesAreNeverPassedToTheCounter` (the only call the handler makes to the store is the day and the page key); no cookie on the response; `NoLogLineHoldsThePathTheReferrerTheUserAgentOrACookieValue`.
- ANL-05 path cut and nine keys: `ThePathIsCutAtTheFirstQuestionMarkOrHash...`, `ACraftedPathWithAQueryAndAFragment...`, `AnUnknownPublicPathCountsAsNotFound...`, `AnAdminOrDevPathStoresNothing...`, `PublicPageResolverTests` (every `PublicPage` maps to a distinct key).
- [EDGE ANL-05 empty]: `ABodyWithNoUsablePathIs400NamingThePathAndStoresNothing` (`{}`, `""`, `gallery`, null, bad JSON, empty body); a missing User-Agent counts as a bot (204, nothing stored).
- Bots: `ABotAndAMissingUserAgentStoreNothingAndStillAnswer204`, handler Theory (Googlebot, HeadlessChrome, Lighthouse, blank, null).
- D-21 staff: `AStaffMemberSignedInInTheSameBrowserIsNotCountedNotEvenAnonymously` (real sign-in, the cookie jar sends the marker), `TheStaffMarkerCookieAloneStopsTheCountWhateverItsValue`, `ABearerTokenAloneStopsTheCount`, `AfterSignOutTheSameBrowserIsCountedAgain`.
- D-21 cookie lifecycle and Pitfall 7: `StaffMarkerCookieTests` (verify, browser-session, refresh, sign-out, unknown-cookie refresh, set-new-password, failed sign-in sets none, refresh path still `/api/v1/auth`).
- [EDGE ANL-05 idempotency]: two identical beacons count two views; the idempotency allow-list reason names SEC-06.
- [EDGE ANL-05 concurrency]: `TenParallelFirstViewsOfOnePageOnOneDayLeaveOneRowWithTenViews`, `ParallelViewsOnTopOfAnExistingRow...`, `ParallelFirstViewsOfSeveralPages...` against LocalDB.
- Schema: `DailyPageCountsMigrationTests` (three columns, composite primary key, no JSON, no rowversion, no trigger, no foreign key, reset empties it).
- Pitfall 8: `AnalyticsRateLimitTests` (121st request is 429 with Retry-After, another address unaffected, configurable, default 120, start-up refusal names `RateLimits:AnalyticsCollect:PermitLimit` and never the value); Playwright and owner review hosts lift it.
- CWE-117: no request value in any log line (`NoLogLine...`); the controller and handler log nothing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The generated migration and the entity configuration went into the RED commit**
- **Found during:** Task 1 RED
- **Issue:** A mapped entity with no migration makes every database test in every project fail with `PendingModelChangesWarning`, which is a fixture fault, not a valid RED.
- **Fix:** generated `AddDailyPageCounts` before the RED commit. The schema tests pass on arrival; the behavior tests are the RED.
- **Commit:** 7da1de99

**2. [Rule 3 - Blocking] The collect rate limit moved from Task 3 to Task 1**
- **Issue:** `[EnableRateLimiting("analytics-collect")]` throws at run time if the policy is missing, and `RateLimitTests.EveryRateLimitedEndpointIsInTheList` needs a row for the endpoint, so the policy, its settings class, its binding and the factory settings are needed with the controller.
- **Fix:** Task 1 holds the class, registration, factory settings and `RateLimitTests` row. Task 3 added the `AnalyticsRateLimitTests` cases and the Playwright and owner review lifts. The new limit tests pass on arrival.
- **Commits:** 078314a4, 0726d1ba, 5bb474e4

**3. [Rule 2 - Missing critical] The owner review host lifts the beacon limit too**
- **Issue:** The orchestrator's note (an earlier wave failed on the owner review host). `web/scripts/owner-review.mjs` and its pinned list in `owner-review.test.ts` now carry `RateLimits__AnalyticsCollect__PermitLimit`, not only `web/playwright.config.ts`.
- **Commit:** 5bb474e4

**4. [Rule 2 - Missing critical] Tests outside the plan's file list**
- `tests/Csps.Domain.UnitTests/Analytics/DailyPageCountTests.cs` (Domain coverage must stay at 100 percent), `tests/Csps.Server.IntegrationTests/Analytics/PublicPageResolverTests.cs` (the resolver is the page key allow-list), `tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs`, `RealLimitsFactory.cs` and `tests/Csps.Testing/CspsApiFactory.cs` (limit lists), `PageViewErrors.cs` (the error text).

### Smaller notes

- The plan's "clears the tracker" on the unique key retry became "detach the failed row" (`context.Entry(first).State = Detached`), so nothing else the request tracks is dropped.
- The matrix request has no body, so the recorded statuses are 400 for all three callers, as written above.
- The commit trailer is `Co-Authored-By: Claude Sonnet 5.5`, as in plans 12-08 and 12-31 (the plan text says Opus 5.5; this run is Sonnet 5.5 and the session attribution rule applies).
- The plan commit ledger file in the shared git dir was not used; `plan_head_before` is the dispatch base commit and `commits: 6` is `git rev-list --count f7b99813..HEAD` before this SUMMARY commit.
- `actuals.tokens` is chars/4 over the hand-written diff (generated OpenAPI, types, migration Designer and snapshot excluded), 72,811 characters.
- The page-view handler needs `IBusinessCalendar` from Application (`ValueTask GetClockAsync`); no new port was needed.

## Deferred Issues

- **`OrderListTimingTests.TheListAnswersUnder300MsAtP95OnFiveYearsOfOrders` failed once in the full Server run** (took 2m 58s, other agents were running tests on the same machine). Re-run alone: "total: 1, failed: 0, succeeded: 1". It reads orders only, so it has no link to this plan. Recorded as a load-sensitive timing flake, not fixed.
- **Not run:** Playwright E2E and the web unit suite beyond `owner-review.test.ts` (no web source other than the three config and script files and the generated types changed). The page-view client (`usePageViewBeacon`) is a later plan.

## Known Stubs

None. The compile-only stubs from the RED commits are gone in HEAD (`PageViewCounts`, `PublicPageResolver`, `SetStaff` and `ClearStaff`, the handler, the validator all hold real code).

## Threat Flags

None beyond the plan's register. T-12-28 (limit 120 a minute per address, 2 KB body, bot filter, CSRF header, nine-key allow-list), T-12-29 (unknown paths fold into `not-found`, nine rows a day at most), T-12-30 (HttpOnly staff marker scoped to `/api/v1/analytics`, set and cleared with the refresh cookie, bearer also drops), T-12-31 (the anonymous path stores only day, page key and count; prohibition tests), T-12-32 (no request value logged, `FakeLogger`-style sink test) and T-12-SC (no package added or bumped) are in place and tested. The only new network surface is the plan's own endpoint.

## Notes for plans 12-14, 12-15 and 12-21

- **12-14** extends the same action. `CollectContext` already carries `Gpc`, `VisitorToken` and `ConsentCookie` (read by the controller, unused by the anonymous path). `PageViewRequest.ReferrerHost` is already bound. Keep the order: validate, bot, staff, then the identified record; the anonymous count stays first.
- **12-21** reads `DailyPageCounts` (`BusinessDay` date, `PageKey` varchar(32), `Views` int): page views and top pages for any range come from this table alone.
- **12-18** purge: the table has no retention rule in D-03 to D-07 (anonymous totals stay); nothing here deletes.

## Self-Check: PASSED

- Created files found on disk (spot check): `src/Csps.Server/Controllers/AnalyticsController.cs`, `src/Csps.Infrastructure/Analytics/PageViewCounts.cs`, `src/Csps.Infrastructure/Persistence/Migrations/20261117073144_AddDailyPageCounts.cs`, `tests/Csps.Server.IntegrationTests/Auth/StaffMarkerCookieTests.cs`, `src/Csps.Server/Endpoints/PublicPageResolver.cs`.
- All 6 plan commits are on the branch: 7da1de99, 078314a4, 54769011, 39cd2c0c, 0726d1ba, 5bb474e4. The SUMMARY commit follows them.
- Acceptance greps all at least 1: `UniqueKeyViolation = 2627` in `SqlErrors.cs`, `"DailyPageCounts"` in the configuration, `POST /api/v1/analytics/page-views` in the idempotency allow-list (1), `Parallel|WhenAll` in `PageViewCountsTests` (6), `AnalyticsBots.IsBot` in the handler, `__Secure-csps_staff` in `AnalyticsCookies.cs`, `AnalyticsCookies.SetStaff` and `AnalyticsCookies.ClearStaff` in `AuthCookies.cs`, `RateLimits__AnalyticsCollect__PermitLimit` in `playwright.config.ts`.
- STATE.md and ROADMAP.md were not changed.
