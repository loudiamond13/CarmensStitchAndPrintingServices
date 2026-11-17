---
phase: 12-consent-analytics-legal
plan: 08
subsystem: api
tags: [consent, gpc, cookies, rate-limit, openapi, ef-migration, anonymous-endpoint]
created: "2026-11-17T00:40:00-06:00"
updated: "2026-11-17T00:40:00-06:00"
status: complete

requires:
  - phase: 12-consent-analytics-legal
    provides: "12-03 ConsentCookie codec (Format, TryParse, LifetimeMonths); 12-05 LegalPages.CookiePolicyVersion; 12-06 anonymous public read patterns; 12-31 D-43 date rule"
provides:
  - "POST /api/v1/analytics/consent (RecordConsent): one proof row per decision, server-set __Host-csps_consent, GPC and stale-version rules"
  - "ConsentRecords table (AddConsentRecords) and ConsentRecord.Decide"
  - "AnalyticsCookies (consent and visitor id cookie names, attributes, SetConsent, SetVisitor, ExpireVisitor, IsVisitorId)"
  - "RateLimitPolicies.Consent ('analytics-consent') with ConsentRateLimit (RateLimits:Consent, 30 a minute)"
  - "GET and HEAD /.well-known/gpc.json (D-39)"
  - "RecordConsentRequest and ConsentDecisionResponse in OpenAPI and web/src/types/api.generated.ts"
affects: [12-09, 12-10, 12-13, 12-17, 12-18, 12-20]

actuals:
  tokens: 23100
  tasks: 3
  commits: 6
plan_head_before: 2b79fd3099e15caa5ad44a6254f9445aed204e2f
plan_head_after: 0e934e40d75ab18d36aed7493c4ee4c83b7c6565
commits: 6

tech-stack:
  added: []
  patterns:
    - "Handler returns a ConsentOutcome (response, cookie value, expiry, visitor-id action); the controller only writes cookies"
    - "Controller adds the currentVersion extension to the 409 itself, because Error carries no extension bag"
    - "Visitor id cookie is expired only when the request carried one (nothing to change, nothing sent)"

key-files:
  created:
    - src/Csps.Domain/Analytics/ConsentRecord.cs
    - src/Csps.Domain/Analytics/ConsentSource.cs
    - src/Csps.Application/Analytics/RecordConsentRequest.cs
    - src/Csps.Application/Analytics/RecordConsentRequestValidator.cs
    - src/Csps.Application/Analytics/RecordConsentHandler.cs
    - src/Csps.Application/Analytics/ConsentDecisionResponse.cs
    - src/Csps.Application/Analytics/ConsentErrors.cs
    - src/Csps.Application/Analytics/ConsentCallContext.cs
    - src/Csps.Application/Analytics/ConsentOutcome.cs
    - src/Csps.Application/Analytics/ConsentSources.cs
    - src/Csps.Application/Analytics/VisitorIdAction.cs
    - src/Csps.Application/Ports/IConsentRecords.cs
    - src/Csps.Infrastructure/Analytics/ConsentRecords.cs
    - src/Csps.Infrastructure/Analytics/AnalyticsRegistration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/ConsentRecordConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261117053718_AddConsentRecords.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261117053718_AddConsentRecords.Designer.cs
    - src/Csps.Server/Controllers/ConsentController.cs
    - src/Csps.Server/Security/AnalyticsCookies.cs
    - src/Csps.Server/Composition/AnalyticsApplicationRegistration.cs
    - tests/Csps.Domain.UnitTests/Analytics/ConsentRecordTests.cs
    - tests/Csps.Application.UnitTests/Analytics/RecordConsentHandlerTests.cs
    - tests/Csps.Application.UnitTests/Analytics/RecordConsentRequestValidatorTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/ConsentRecordsMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Analytics/ConsentEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs
  modified:
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Security/RateLimitSettings.cs
    - src/Csps.Server/Security/RateLimitingRegistration.cs
    - src/Csps.Server/Endpoints/SeoEndpoints.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RealLimitsFactory.cs
    - tests/Csps.Server.IntegrationTests/Http/SeoEndpointTests.cs
    - tests/Csps.Testing/CspsApiFactory.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/playwright.config.ts

key-decisions:
  - "Under GPC stats is stored false (never null) and the Gpc flag true; ConsentRecord.Decide also refuses stats true with gpc true, so no caller can store the contradiction"
  - "One decision outcome decides the visitor id: stats true then Keep when the request holds a well-formed id, else Issue; anything else Expire"
  - "The 409 for an old policy version carries code consent.policy-changed and currentVersion; the server never stores a decision under an old version (D-22)"
  - "GET and HEAD for gpc.json (like robots.txt), so the matrix and allow-list have a HEAD row too"

requirements-completed: [ANL-01, ANL-02, ANL-07]

metrics:
  duration: 85min
  completed: 2026-11-17
---

# Phase 12 Plan 08: A visitor's cookie choice is recorded as proof and saved in their browser Summary

**One anonymous endpoint, `POST /api/v1/analytics/consent`, logs every cookie decision as a ConsentRecords row with the server's time, answers with the state it stored, sets the readable `__Host-csps_consent` cookie from the server, forces stats off under Sec-GPC, refuses a stale policy version with a 409, and issues or expires the HttpOnly `__Secure-csps_vid` visitor id; `/.well-known/gpc.json` states that the site honors GPC.**

## What was built

- **Domain.** `ConsentRecord.Decide(consentId, policyVersion, stats, map, gpc, source, decidedAtUtc)` makes one row (id from `Guid.CreateVersion7`, no public setters, no row version). It refuses an empty chain id, a version that is not digits.digits within 16 characters, a source that is not named, and stats true under GPC. `ConsentSource` is `Bar 1, Settings 2, MapLink 3, Clear 4` (Clear is server-only: the validator accepts only `bar`, `settings`, `map-link`).
- **Application.** `RecordConsentHandler` validates (FluentValidation, plain-English constants), checks the version against `LegalPages.CookiePolicyVersion`, takes the time and the Asia/Manila business day from one `IBusinessCalendar.GetClockAsync` read (D-43: the day on the cookie is the business day, never the device or `DateTime.Now`), adds the row, saves once, and returns a `ConsentOutcome`. A body chain id that is 32 lowercase hex is kept; otherwise a new `Guid` starts the chain.
- **Infrastructure.** `ConsentRecordConfiguration`, `DbSet<ConsentRecord>`, the `ConsentRecords` store behind `IConsentRecords`, `AddCspsAnalytics()`, and migration `20261117053718_AddConsentRecords`.
- **Server.** `ConsentController` (`[AllowAnonymous]`, `[RequireCsrfHeader]`, `[EnableRateLimiting("analytics-consent")]`, `[IdempotencyExempt]` with the written reason, `[RequestSizeLimitMetadata(2048)]`, `[EndpointName("RecordConsent")]`). `AnalyticsCookies` holds the two cookie names and attributes. `ConsentRateLimit` (`RateLimits:Consent`, 30 a minute, `Validate()` names settings only). `GET`/`HEAD /.well-known/gpc.json` in `MapSeoEndpoints`, anonymous, excluded from OpenAPI, body `{"gpc":true,"lastUpdate":"2026-11-15"}`.
- **Contract.** OpenAPI snapshot and `api.generated.ts` regenerated (`npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."). The playwright host lifts the consent limit (`RateLimits__Consent__PermitLimit`).

### Cookie table (as sent)

| Cookie | Path | Flags | Expires |
|---|---|---|---|
| `__Host-csps_consent` | `/` | Secure, SameSite=Lax, not HttpOnly | decision time + 12 months |
| `__Secure-csps_vid` | `/api/v1/analytics` | HttpOnly, Secure, SameSite=Strict | decision time + 12 months; expired with the same path and flags |

### Migration (generated by `dotnet ef migrations add AddConsentRecords`, read in full)

Real name `20261117053718_AddConsentRecords` (the plan's `20261116000001` was a placeholder). It touches only the new table.

```csharp
// Up
migrationBuilder.CreateTable(
    name: "ConsentRecords",
    columns: table => new
    {
        Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
        ConsentId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
        PolicyVersion = table.Column<string>(type: "varchar(16)", unicode: false, maxLength: 16, nullable: false),
        Stats = table.Column<bool>(type: "bit", nullable: true),
        Map = table.Column<bool>(type: "bit", nullable: false),
        Gpc = table.Column<bool>(type: "bit", nullable: false),
        Source = table.Column<byte>(type: "tinyint", nullable: false),
        DecidedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
    },
    constraints: table => { table.PrimaryKey("PK_ConsentRecords", x => x.Id); });

migrationBuilder.CreateIndex(
    name: "IX_ConsentRecords_DecidedAtUtc", table: "ConsentRecords", column: "DecidedAtUtc");

// Down
migrationBuilder.DropTable(name: "ConsentRecords");
```

No JSON column, no trigger (OR-7), no foreign key, no address or User-Agent column. `TriggerInventoryTests` and `MigrationScriptTests` (the idempotent script) pass.

## TDD record

The dotnet MTP console output is not a format the `tdd-red-evidence` classifier reads, so each RED was assessed by hand: the target tests ran and failed on the planned behavior, not on a build or fixture fault (stubs made the code compile).

- **Task 1 RED** (`be082e68`). Domain `ConsentRecordTests`: "total: 19, failed: 15" (for example `record.ConsentId should be 0a1b2c3d-... but was 00000000-...`). Application `RecordConsentHandlerTests`: "total: 10, failed: 10" (the stub added nothing, `Sequence contains no elements`). Server: "total: 581, failed: 11"; for example `response.StatusCode should be HttpStatusCode.OK but was HttpStatusCode.NotFound`, plus the three matrix rows, `DiscoveredEndpointsAreFullyCovered`, `ParallelCallersEachGetTheirOwnStatus` and `IdempotencyCoverageTests`. A first attempt without the migration failed every database test in the fixture with `PendingModelChangesWarning`, which is an invalid RED (fixture fault), so the generated migration went into the RED commit; `ConsentRecordsMigrationTests` then "total: 5, failed: 0" **passes on arrival**, because it checks the schema the generated migration creates (it guards against drift, like the 12-06 email backstop).
- **Task 1 GREEN** (`9c953ce4`). Domain 19 passed, Application 10 passed. Infrastructure (`ConsentRecordsMigrationTests`, `TriggerInventoryTests`, `MigrationScriptTests`): "total: 13, failed: 0". Server (`ConsentEndpointTests`, matrix, coverage, idempotency, OpenAPI snapshot): 41 passed.
- **Task 2 RED** (`af31f053`). Application "total: 51, failed: 31" (validator with no rules); Server `ConsentEndpointTests` "total: 21, failed: 5" (409, three bad-field 400s, Sec-GPC).
- **Task 2 GREEN** (`fce3517a`). Application "total: 57, failed: 0"; Server `ConsentEndpointTests` + `OpenApiSnapshotTests`: 34 passed and exactly the 7 Task 3 tests failing (they were already in the tree).
- **Task 3 RED** (`4641cc16`). Application "total: 66, failed: 7"; Server consent tests "failed: 7"; `SeoEndpointTests` + `AnalyticsRateLimitTests` "total: 24, failed: 3" (gpc.json); matrix "total: 557, failed: 8" (six gpc rows, coverage, parallel). `AnalyticsRateLimitTests` (6) **pass on arrival**: the limiter was built in Task 1 (see Deviation 2), so these are proofs of that behavior.
- **Task 3 GREEN** (`0e934e40`). Application "total: 66, failed: 0". Server (`ConsentEndpointTests`, `SeoEndpointTests`, `AnalyticsRateLimitTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests`, `IdempotencyCoverageTests`, `OpenApiSnapshotTests`, `RateLimitTests`): "total: 692, failed: 0, succeeded: 692". `dotnet format Csps.slnx --verify-no-changes`: exit 0. `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- Wider runs on the final tree: `Csps.ArchitectureTests` "total: 290, failed: 0"; `Csps.Domain.UnitTests` "total: 2227, failed: 0"; `Csps.Application.UnitTests` "total: 3108, failed: 0". Full `Csps.Server.IntegrationTests`: "total: 2917, failed: 0, succeeded: 2917, skipped: 0" (this run included `ParallelCallersEachGetTheirOwnStatus`, which passed). Full `Csps.Infrastructure.IntegrationTests`: "total: 1219, failed: 0, succeeded: 1218, skipped: 1" (the one skip is not from this plan). Not run: the web unit suite and e2e (no web source changed except `playwright.config.ts` and the generated types; `npm --prefix tools/openapi-gen run check` passes).

Tracer gate (Task 1): auto-mode not assumed; `human_verify_mode` default `end-of-phase` and the tracer's `<verify>` is automated only, so the three verify commands were re-run after the GREEN commit and passed, then the plan continued.

## Plan truths and where they are proven

- ANL-07 row per call with the full state, server time, 12-month cookie, no pending marker: `ConsentEndpointTests.AcceptAll...`, `...TheAnswerIsTheStateTheServerStored`, `RecordConsentHandlerTests` (cookie value, expiry, business day 2026-11-17 against UTC 2026-11-16).
- Chain id: `AFirstDecisionWithNoChainId...` (endpoint and handler).
- D-22: `AnOldPolicyVersionIs409...` (code, `currentVersion`, no row, no cookie).
- ANL-02, D-20, D-41: `UnderGpcStatsIsStoredOff...`, `OnlyTheValueOneCountsAsGpc`, `GpcAloneCreatesNoRecord...`.
- D-18: `AMapOnlySaveStoresNullStatsAndTheCookieShowsADash`.
- ANL-05: issue, keep, malformed id replaced, expire on stats off, null stats and GPC (`ConsentEndpointTests`, `RecordConsentHandlerTests`).
- Validation and repeat: `ABadBodyIs400NamingTheField...`, `TwoIdenticalPostsAddTwoRecordsWithTheSameChain`.
- D-39: `SeoEndpointTests` (body, content type, HEAD, no-cache) and the matrix rows.
- SEC-02, SEC-06: matrix row `POST /api/v1/analytics/consent` (400, 400, 400), gpc.json rows (200 x3, GET and HEAD), anonymous allow-list keys, idempotency allow-list entry with the same reason as the attribute, `RateLimitTests` row `{ "POST", "/api/v1/analytics/consent", 30 }`.
- PRD 5.4 minimization: `ARecordHoldsNoAddressAndNoBrowserName` (entity has exactly the eight properties) and the migration test (eight columns).
- Not testable in this plan: "past analytics rows are kept" (D-41). There are no analytics tables yet (plan 12-10 adds them); nothing in this plan deletes anything.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The generated migration went into the RED commit**
- **Found during:** Task 1 RED
- **Issue:** With the entity configuration present and no migration, `CspsDatabase.InitializeAsync` throws `PendingModelChangesWarning`, so every database test in every project fails for a fixture reason. That is not a valid RED.
- **Fix:** generated `AddConsentRecords` before the RED commit. The schema tests pass on arrival; the endpoint, matrix, handler and domain tests are the RED.
- **Commit:** be082e68

**2. [Rule 3 - Blocking] The rate-limit configuration moved from Task 3 to Task 1**
- **Found during:** Task 1
- **Issue:** The shared test factory lifts every per-address limit and `RateLimitTests.EveryRateLimitedEndpointIsInTheList` fails on a limited endpoint with no row, so the policy, `ConsentRateLimit` (section, default, `Validate`) and its binding were needed with the controller.
- **Fix:** Task 1 holds the class and registration plus `CspsApiFactory`/`RealLimitsFactory` settings; Task 3 added `AnalyticsRateLimitTests` (30 then 429, other address unaffected, configurable, start-up refusal naming the setting, rejected decision not stored) and the Playwright env. Those tests pass on arrival.
- **Commits:** 9c953ce4, 4641cc16, 0e934e40

**3. [Rule 2 - Missing critical] HEAD for gpc.json**
- **Issue:** `Map` (like robots.txt) answers GET and HEAD, so the matrix coverage test needs a HEAD row and allow-list key as well as the plan's GET row.
- **Fix:** added both rows and both keys.

**4. [Rule 2 - Missing critical] Domain refuses stats on under GPC**
- **Fix:** `ConsentRecord.Decide` throws when `gpc` and `stats == true`, so the stored contradiction is impossible whatever calls it. Tested.

### Smaller notes

- Task 1 handler had a minimal blank-field check (policyVersion, source) so the empty-body matrix row answers 400 and does not throw; Task 2 replaced it with the validator.
- `ConsentCallContext`, `ConsentOutcome`, `VisitorIdAction`, `ConsentSources` and a public `ConsentRecord.IsPolicyVersion` were added as the plan left the handler input and output shape to the executor.
- The visitor-id expiry `Set-Cookie` is sent only when the request carried a `__Secure-csps_vid` cookie, any value. Stats off with no cookie sends nothing.
- The commit trailer is `Co-Authored-By: Claude Sonnet 5.5`, as in plan 12-31 (the plan text says Opus 5.5; this run is Sonnet 5.5 and the session attribution rule applies).

## Deferred Issues

- **`AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` intermittent 500 on `Manager GET /api/v1/orders`.** Seen 2 times in the first ~8 class runs on this branch (mostly while other test runs shared the machine), then 0 times in about 12 later runs, including 4 with a temporary logger that would have written the server error to a file. Alone the method passed 6 of 6. At the plan base commit, in a temporary worktree, the class passed 6 of 6. The consent endpoint writes only to its own table and returns 400 for the empty body in this test, so a link is not shown, but it could not be ruled out either. The cause was not found. Not fixed (outside this plan). If it shows up in the wave gate, re-run the method alone first, then treat it as an existing load-sensitive flake of the cold 16-way burst.

## Known Stubs

None.

## Threat Flags

None. T-12-18 to T-12-24 mitigations are in place: anti-CSRF header (403 without it, tested), Sec-GPC forced server-side (tested), 30 a minute limit plus 2 KB body limit, append-only rows with no update or delete path in this plan, the chain id is a label only (accepted), no IP or User-Agent stored, no request values in logs (the handler and controller log nothing). No package added or bumped (T-12-SC). The migration purge of old rows is plan 12-18.

## Notes for plans 12-09, 12-10, 12-13, 12-17 and 12-20

- **Contract as built.** Request `{ consentId?, policyVersion, stats (true, false or null), map, source }`; answer `{ consentId, policyVersion, stats, map, gpc, decidedOn }`; endpoint name `RecordConsent`; 409 code `consent.policy-changed` with `currentVersion`. The web client must send `X-CSPS-CSRF: 1` and must show the answer's `stats` and `gpc`, not what it sent.
- **12-09.** The server sets the cookie from the answer, so the client must not write the confirmed cookie itself. `decidedOn` is the Asia/Manila business day.
- **12-10.** `AnalyticsCookies.VisitorCookieName` and `IsVisitorId` (43 base64url characters) are ready; the token is stored hashed by the collect plan.
- **12-17.** `ConsentSource.Clear = 4` is ready for the server-only decision; `ConsentRecord.Decide(..., stats: false, map: false, ...)` is valid. The validator refuses `clear` from a browser.
- **12-18.** `IX_ConsentRecords_DecidedAtUtc` serves `AnalyticsRetention.ConsentPurgeBefore`.

## Self-Check: PASSED

- Created files found on disk (spot check): `src/Csps.Server/Controllers/ConsentController.cs`, `src/Csps.Server/Security/AnalyticsCookies.cs`, `src/Csps.Application/Analytics/RecordConsentHandler.cs`, `src/Csps.Infrastructure/Persistence/Migrations/20261117053718_AddConsentRecords.cs`, `tests/Csps.Server.IntegrationTests/RateLimiting/AnalyticsRateLimitTests.cs`.
- All 6 plan commits are on the branch (`git log 2b79fd30..HEAD`): be082e68, 9c953ce4, af31f053, fce3517a, 4641cc16, 0e934e40. The SUMMARY commit follows them.
- Acceptance greps all at least 1: `api/v1/analytics/consent` in the controller, `"ConsentRecords"` in the configuration, `POST /api/v1/analytics/consent` in the idempotency allow-list, `RecordConsent` in `api.generated.ts`, `consent.policy-changed`, `Sec-GPC`, `__Secure-csps_vid`, `"analytics-consent"`, `RateLimits__Consent__PermitLimit`, `/.well-known/gpc.json`.
