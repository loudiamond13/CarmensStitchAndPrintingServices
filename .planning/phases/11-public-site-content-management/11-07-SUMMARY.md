---
phase: 11-public-site-content-management
plan: 07
subsystem: api
tags: [aspnetcore, ef-core, hybridcache, etag, json-ld, open-graph, rate-limiting, migration]
created: 2026-11-11T22:40:00-06:00
updated: 2026-11-11T22:40:00-06:00

requires:
  - phase: 11-02
    provides: ShellPage, PublicHeadWriter, PublicPageHeads, SeoEndpoints (the shaped shell this plan fills with stored data)
  - phase: 11-04
    provides: PhilippinePhone (E.164 and display forms for the phone rows)
provides:
  - "GET /api/v1/public/site: anonymous shop facts from one cached snapshot with a strong ETag and 304"
  - "SiteSettings business info fields and the SitePhoneNumbers table (migration AddSiteContactDetails), no column dropped or renamed"
  - "SiteSettings.UpdateBusinessInfo and SitePhoneNumber.Create: the domain rules plan 11-09 writes through"
  - "IPublicContentReader, IPublicContentCache and the post-commit PublicContentInvalidationInterceptor"
  - "Shell head from stored data: og:site_name, Home description, LocalBusiness JSON-LD, csps-boot data block, sitemap lastmod"
  - "public-read rate limit (600 a minute per address) on /api/v1/public/*"
  - "Testing-only POST /api/testing/site-content demo seed"
affects: [11-08, 11-09, 11-11, 11-12, 11-13, 11-15, 11-17, 11-19, 11-26, 11-30]

requirements-completed: [PUB-02, PUB-03, PUB-04, CONT-01, CONT-05]

actuals:
  tokens: 58000
  tasks: 3
  commits: 9
plan_head_before: f8cbb402083697258a95aa6117f1c6717a93486c
plan_head_after: 18fab8210b91788f2050d7f54ba4c0701b32f895

tech-stack:
  added: []
  patterns:
    - "One cached snapshot (HybridCache, tag public-content) holds typed data, JSON and a strong ETag from the same read"
    - "A save interceptor copied from the outbox one clears the cache after the commit, never on a rollback or a failed save"
    - "Shaped head cached per page under the same tag; JSON written by the default JSON encoder so typed text cannot close a script block"
    - "Interceptor finds IPublicContentCache when it flushes, so hosts without a cache (tools) still save"

key-files:
  created:
    - src/Csps.Domain/Content/BusinessInfo.cs
    - src/Csps.Domain/Content/SitePhoneNumber.cs
    - src/Csps.Domain/Content/IPublicContentRecord.cs
    - src/Csps.Application/Content/PublicSiteDto.cs
    - src/Csps.Application/Content/PublicSiteSnapshot.cs
    - src/Csps.Application/Content/PublicJsonSnapshot.cs
    - src/Csps.Application/Content/PublicCacheTags.cs
    - src/Csps.Application/Content/GetPublicSiteHandler.cs
    - src/Csps.Application/Ports/IPublicContentReader.cs
    - src/Csps.Application/Ports/IPublicContentCache.cs
    - src/Csps.Infrastructure/Content/PublicContentReader.cs
    - src/Csps.Infrastructure/Content/PublicContentCache.cs
    - src/Csps.Infrastructure/Content/PublicContentInvalidationInterceptor.cs
    - src/Csps.Infrastructure/Content/ContentRegistration.cs
    - src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs
    - src/Csps.Infrastructure/Persistence/Configurations/SitePhoneNumberConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261112030543_AddSiteContactDetails.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261112030543_AddSiteContactDetails.Designer.cs
    - src/Csps.Server/Controllers/PublicSiteController.cs
    - src/Csps.Server/Controllers/TestingSiteContentController.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - src/Csps.Server/Http/EntityTags.cs
  modified:
    - src/Csps.Domain/Content/SiteSettings.cs
    - src/Csps.Domain/Content/SiteSettingsDefaults.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Configurations/SiteSettingsConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Endpoints/ShellPage.cs
    - src/Csps.Server/Endpoints/PublicHeadWriter.cs
    - src/Csps.Server/Endpoints/PublicPageHeads.cs
    - src/Csps.Server/Endpoints/SeoEndpoints.cs
    - src/Csps.Server/Security/RateLimitSettings.cs
    - src/Csps.Server/Security/RateLimitingRegistration.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/public-site.md

key-decisions:
  - "The business-calendar year is added when the snapshot is built (inside the cache, so the ETag covers it and it refreshes within the hour), not by the handler"
  - "sameAs in the JSON-LD holds the Facebook, Instagram and TikTok links only; the Messenger link is a contact link, not a profile"
  - "JSON field is tiktokUrl (as the plan's truth), so the DTO member is TiktokUrl; the domain property stays TikTokUrl"
  - "AboutText is part of the public DTO (the plan's JSON-LD rule needs it)"
  - "AddSiteContactDetails is forward only: its Down throws instead of dropping the new columns (acceptance criterion and D-39)"
  - "Phone row field errors are keyed phones[i].number and phones[i].label; list rules (more than 4, two mains) are keyed phones"
  - "The invalidation interceptor looks the cache up at flush time, so AddCspsPersistence alone (tools, tests) still works"

patterns-established:
  - "PublicContentSeeding (tests/Csps.Testing): fake business info and a save helper that runs through a given context's interceptors"
  - "StubPublicContentReader: a fixed public snapshot for host tests with no database"
  - "EntityTags.Matches: one If-None-Match comparison shared by the shell and the public reads"

coverage:
  - id: D1
    description: "GET /api/v1/public/site answers anonymously from the database with the stored facts, the main phone first, and null for what is not set"
    requirement: "PUB-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicSiteEndpointTests.cs#AnAnonymousVisitorGetsTheStoredFactsWithTheMainNumberFirst"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Content/PublicContentReaderTests.cs#ReadsTheStoredFactsWithTheMainNumberFirst"
        status: pass
    human_judgment: false
  - id: D2
    description: "Strong ETag, no-cache, 304 on a match, 200 on a different tag, never compressed, one read runs no SQL on the second call"
    requirement: "CONT-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicSiteEndpointTests.cs#AMatchingIfNoneMatchGets304WithNoBodyAndADifferentOneGets200"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Content/PublicContentReaderTests.cs#TheSecondReadRunsNoDatabaseCommand"
        status: pass
    human_judgment: false
  - id: D3
    description: "No public body (pages, 404 shell, robots, sitemap, API, JSON-LD, boot data) holds the shop email"
    requirement: "PUB-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs#NoPublicBodyHoldsTheShopEmailOrAnAtSign"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicSiteEndpointTests.cs#NoPublicBodyHoldsTheShopEmailAnAtSignOrABracket"
        status: pass
    human_judgment: false
  - id: D4
    description: "The migration adds the columns and the phone table with a unique number and one main number, drops and renames nothing, adds no trigger, and blanks the old bracket text only where it remains"
    requirement: "CONT-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/SiteContactDetailsMigrationTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "A committed content change clears the public cache after the commit; a rollback, a failed save and a non-public record clear nothing"
    requirement: "PUB-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Content/PublicContentInvalidationTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs"
        status: pass
    human_judgment: false
  - id: D6
    description: "The shell head carries the stored name and tagline, LocalBusiness JSON-LD and the csps-boot block; hostile text stays inert"
    requirement: "PUB-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs#ScriptBreakoutInTheTaglineAndTheNameStaysInertInTheJsonBlocksAndTheAttributes"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs#EveryPublicPageAndTheNotFoundShellCarryTheSameSiteJsonAsTheApi"
        status: pass
    human_judgment: false
  - id: D7
    description: "The public-read limit refuses the 601st read in a minute from one address; the shell, robots.txt and sitemap.xml are never limited"
    requirement: "PUB-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/RateLimiting/PublicReadRateLimitTests.cs"
        status: pass
    human_judgment: false
  - id: D8
    description: "Settings and phone rows are stamped with the signed-in user through the old stamp columns"
    requirement: "CONT-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Content/SiteContentAttributionTests.cs"
        status: pass
    human_judgment: false
  - id: D9
    description: "No bracket placeholder, '#' link or invented value on any public surface, the client included"
    requirement: "PUB-02"
    verification: []
    human_judgment: true
    rationale: "Server-sent surfaces are proven placeholder free by tests, but the public client still holds bracket text in web/src/modules/public/components/siteContact.ts until the client plans read this API; the verifier must judge the whole surface"

duration: about 2h
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 07: Shop facts from the database on every public page Summary

**Visitors and link-preview crawlers now get the shop's real name, tagline, address and phone numbers from the database: one cached, ETag-guarded `GET /api/v1/public/site`, a cache cleared after every committed change, and the same snapshot in each page's head, `LocalBusiness` JSON-LD and boot data block.**

## Performance

- **Duration:** about 2 h
- **Started:** 2026-11-11T20:35:00-06:00 (approx.)
- **Completed:** 2026-11-11T22:40:00-06:00
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files modified:** 56 in the diff (22 source files created, 16 source and contract files modified, the rest tests)

## Accomplishments

- `GET /api/v1/public/site` (anonymous) returns `businessName`, `tagline`, `aboutText`, `turnaroundLine`, `address {street, townOrCity, province, postalCode}`, `phones [{display, e164, label, isMain}]` (main first), the five links and the business-zone `year`. A value that is not set is `null`. There is no email member.
- Strong ETag (SHA-256 of the exact bytes), `Cache-Control: no-cache`, 304 on a matching `If-None-Match`, no `Content-Encoding`. A second read of the snapshot runs zero SQL commands.
- Migration `20261112030543_AddSiteContactDetails`: 12 new `SiteSettings` columns, the `SitePhoneNumbers` table (unique number, filtered unique `IsMain`), the approved tagline on the seeded row, and the old bracket text for the shop email and Facebook link blanked only where it still stands. `ContactPhone`, `AddressLine`, `CreatedByUserId` and `UpdatedByUserId` stay as they were.
- `SiteSettings` is now an `IAttributedRecord` and `IPublicContentRecord`: the stamp interceptor sets `UpdatedById` and `UpdatedAtUtc` through the old column names.
- `SiteSettings.UpdateBusinessInfo` and `SitePhoneNumber.Create`: trim, clear empty optional values, check each column length, build phone rows (E.164, main first, at most 4, no duplicates). Domain coverage stays at 100% line and branch.
- `PublicContentInvalidationInterceptor` clears the cache after the commit (after the save when it owns the transaction, after the commit when the caller opened one). Rollback, failed save and non-public records clear nothing.
- The shell head: `og:site_name` is the stored name, Home's description is the stored tagline, every public page has `LocalBusiness` JSON-LD (name, description, url, E.164 telephone, `PostalAddress` with `PH`, `sameAs`), every public page and the 404 shell carry the `csps-boot` block with the same JSON as the API, and `/admin` and `/dev` pages carry neither. A tagline of `</script><script>alert(1)</script>` stays inert.
- `sitemap.xml` has `lastmod` from the newest content change. `/api/v1/public/*` has a `public-read` limit of 600 a minute per address; the shell, robots.txt and sitemap.xml have none.
- Testing-only `POST /api/testing/site-content` sets fake demo content (`12 Sample St., Poblacion`, `0917 123 4567`, `https://m.me/cspsdemo`) and the same rows on a repeat.

## Raw evidence

Migration `Up` (the generated `AddColumn` and `CreateTable` calls, then the two edited data steps and the indexes):

```csharp
migrationBuilder.AddColumn<string>(name: "Tagline", table: "SiteSettings", type: "nvarchar(160)", maxLength: 160, nullable: false, defaultValue: "");
// ... AboutText 600, TurnaroundLine 120, Street 120, TownOrCity 60, Province 60, PostalCode 4, DirectionsUrl 300,
//     MapEmbedUrl 1000, MessengerUrl 120, InstagramUrl 300, TikTokUrl 300 (all nullable) ...
migrationBuilder.CreateTable(name: "SitePhoneNumbers", columns: table => new
{
    Id = ..uniqueidentifier, Number = nvarchar(16), Label = nvarchar(20) null, IsMain = bit, Position = int,
    CreatedById = uniqueidentifier null, CreatedAtUtc = datetimeoffset, UpdatedById = uniqueidentifier null, UpdatedAtUtc = datetimeoffset null
}, constraints: table => { table.PrimaryKey("PK_SitePhoneNumbers", x => x.Id); });

migrationBuilder.UpdateData(table: "SiteSettings", keyColumn: "Id", keyValue: 1, column: "Tagline",
    value: "Custom tailoring and full-sublimation printing for teams, leagues and riding groups.");

migrationBuilder.Sql("""
    UPDATE [SiteSettings]
    SET [ContactEmail] = CASE WHEN [ContactEmail] = N'[hello@yourdomain.ph]' THEN N'' ELSE [ContactEmail] END,
        [FacebookUrl] = CASE WHEN [FacebookUrl] = N'[Facebook page URL]' THEN N'' ELSE [FacebookUrl] END
    WHERE [Id] = 1;
    """);

migrationBuilder.CreateIndex("UX_SitePhoneNumbers_Main", "SitePhoneNumbers", "IsMain", unique: true, filter: "[IsMain] = 1");
migrationBuilder.CreateIndex("UX_SitePhoneNumbers_Number", "SitePhoneNumbers", "Number", unique: true);
```

Migration `Down` (written by hand, see Deviations item 1):

```csharp
throw new NotSupportedException(
    "AddSiteContactDetails is forward-only. Undoing it would delete the shop facts and phone numbers that were entered.");
```

Raw head of `GET /` (from a database-backed test host with fake demo values and the fixture shell):

```
<title>CSPS · Custom Team Jerseys and Tailoring</title>
<meta name="description" content="Sample tagline">
<link rel="canonical" href="https://localhost/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sample Shop">
<meta property="og:locale" content="en_PH">
<meta property="og:title" content="CSPS · Custom Team Jerseys and Tailoring">
<meta property="og:description" content="Sample tagline">
<meta property="og:url" content="https://localhost/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Sample Shop","description":"About the sample shop.","url":"https://localhost","telephone":"+639171234567","address":{"@type":"PostalAddress","streetAddress":"12 Sample St., Poblacion","addressLocality":"Sample City","addressRegion":"Sample Province","postalCode":"1000","addressCountry":"PH"},"sameAs":["https://facebook.example.test/cspsdemo","https://instagram.example.test/cspsdemo","https://tiktok.example.test/cspsdemo"]}</script>
<script type="application/json" id="csps-boot">{"site":{"businessName":"Sample Shop","tagline":"Sample tagline", ... "phones":[{"display":"0917 123 4567","e164":"+639171234567","label":"Globe","isMain":true}, ...],"year":2026}}</script>
```

The JSON encoder writes `+` as `+`; it is valid JSON and parses to `+639171234567`.

The 304 exchange:

```
GET /api/v1/public/site -> 200
ETag: "6BDB12F3403014856199CF271EB3FBC8FD70550B7289CD9976DA600F524CC86F"
Cache-Control: no-cache
Content-Type: application/json; charset=utf-8

GET /api/v1/public/site  If-None-Match: "6BDB12F3...CC86F" -> 304
ETag: "6BDB12F3403014856199CF271EB3FBC8FD70550B7289CD9976DA600F524CC86F"
Cache-Control: no-cache
body length: 0
```

## Task Commits

1. **Task 1 (tracer): the stored facts through a cached, ETag-guarded read**
   - RED `14b7b45a` (domain and handler tests, behavior stubbed), GREEN `77bd1b0a` (business info rules, phone rows, handler)
   - RED `10a3130a` (migration, reader, endpoint, rate-limit tests), GREEN `2c790597` (mapping, migration, reader, controller, limit, contract)
2. **Task 2: post-commit cache clearing and the demo seed** - RED `3307ebc4`, GREEN `ca894737`
3. **Task 3: shell head, JSON-LD, boot data, sitemap dates** - RED `461fa929`, GREEN `2403971c`
4. **Guard tests added at the end** - `18fab821` (shop email backstop over every public body, attribution stamps, rate-limit list row)

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier is not required. The failing runs were read for the right reason. RED commits precede their GREEN commits for all three tasks.

- **Task 1a RED** (`14b7b45a`): domain content namespace 44 of 149 failed, application handler 3 of 3 failed. `UpdateBusinessInfo`, `SitePhoneNumber.Create` and `GetPublicSiteHandler` threw `NotImplementedException` (compile-only stubs, same approach as plan 11-04), and `CreateDefaultStartsWithTheApprovedTagline...` failed on the old placeholder defaults. The tests of the data-only members already passed, as they assert constants.
- **Task 1b RED** (`10a3130a`): every database test failed at the fixture with `The seed entity for entity type 'SiteSettings' cannot be added because no value was provided for the required property 'Tagline'`: the domain already needs a tagline and the mapping and migration did not exist. That is a model-versus-schema failure, not an assertion failure, so it is a weaker RED than the others.
- **Task 2 RED** (`3307ebc4`): infrastructure `PublicContentInvalidationTests` 4 of 8 failed (cache not cleared after commit, after a phone add or remove); the 4 negative guards (rollback, failed save, non-public record, no cache registered) passed because nothing cleared the cache yet. Server: 10 of 443 failed (3 invalidation tests, 2 testing-controller tests, the 3 matrix callers and the discovery check for the new route, the parallel matrix test).
- **Task 3 RED** (`461fa929`): 12 of 27 failed (JSON-LD, boot data, hostile text, sitemap `lastmod`, empty row). The admin, failure and cache-clear tests passed before the shell cache existed; the cache-clear test only becomes meaningful with the shell cache.
- No REFACTOR commit was needed.

## Verification evidence (real output)

- Task 1 verify: `PublicSiteEndpointTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests`, `OpenApiSnapshotTests`: total 458, failed 0. `npm --prefix tools/openapi-gen run check`: `Generated API types match tools/openapi-gen/openapi.v1.json.`
- Task 2 verify: `PublicCacheInvalidationTests`, `PublicReadRateLimitTests`, `AuthorizationMatrixTests`, `IdempotencyAllowListTests`: total 433, failed 0. Infrastructure `PublicContentReaderTests`, `SiteContactDetailsMigrationTests`, `TriggerInventoryTests`, `MigrationScriptTests`: total 28, failed 0.
- Task 3 verify: `ShellHeadTests`, `ShellPageTests`, `SeoEndpointTests`: total 69, failed 0. Architecture `NoInlineSqlTests`, `LayerTests`: total 33, failed 0. `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- Tracer gate: Task 1 has an automated-only `<verify>` under the default `human_verify_mode`, so it was re-run after the Task 1 commit (455 passed) before expansion.
- Full suites on the final tree: Infrastructure integration `total: 1100, failed: 0, succeeded: 1099, skipped: 1` (the skip is pre-existing). Server integration full run `total: 2389, failed: 4` before the last guard tests; see Issues Encountered for the four. Architecture `total: 290, failed: 0`. LegacyFitCheck tests `total: 276, failed: 0`.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): `Csps.Domain line 100% (3129/3129) branch 100% (1372/1372) PASS`, `Csps.Application line 98.1% (9107/9276) PASS`.
- `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- Acceptance greps: `SitePhoneNumbers` in exactly one migration `.cs`; `DropColumn|RenameColumn|CREATE TRIGGER` in non-comment migration lines: 0; `public-read` in `RateLimitingRegistration.cs`: 1; `GetPublicSite` in `openapi.v1.json`: 1; "email" in `PublicSiteDto.cs` and `PublicHeadWriter.cs` (non-comment): 0; `csps-boot`, `LocalBusiness` in `PublicHeadWriter.cs`: 1 and 6; `IDbTransactionInterceptor` and `TransactionCommitted` in the interceptor: present; `#if CSPS_TESTING` in the seeder: present; `/api/testing/site-content` in the matrix: present; `ScriptBreakout` test present.
- gitleaks `protect --staged` ran before every commit: no leaks. A manual look at the diff found no local path, personal email, host or customer data; the only email-like text is the old bracket placeholder `[hello@yourdomain.ph]` the migration blanks, and fake `.test` values.

## Decisions Made

- **Year in the snapshot.** The plan says the handler adds the year. The year is part of the cached JSON, so the ETag must cover it, or a visitor's 304 would keep an old year on 1 January. The reader builds it from the stored zone and `TimeProvider`; the one-hour expiry refreshes it without a write. The handler stays thin.
- **`sameAs`** is Facebook, Instagram and TikTok only (the "social links"). Messenger is a contact link.
- **`tiktokUrl`** in JSON (the plan's truth list) means the DTO member is `TiktokUrl`; the domain property is `TikTokUrl` as in the plan's artifacts.
- **`aboutText`** is in the public DTO, because the JSON-LD rule (about text, else tagline) needs it. It is not shown on pages yet (UI-SPEC).
- **Shell head cache** stores only the shaped head string, so a rebuilt `index.html` in Development never meets a stale template. There is a small window in which an invalidation that lands between a request's snapshot read and its cache write can leave one stale head for up to the hour. It is accepted; the snapshot itself is cleared correctly.
- **Domain rules left to 11-09.** `UpdateBusinessInfo` only keeps values inside their columns. Required address parts, the one-to-four phone minimum, link allow-lists and the 100-character name limit are the request validator's job.
- **No `E2E-` cleanup** in the Testing seeder yet: this plan's tables have no named rows. The seeder replaces the phone list wholesale.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Forward-only `Down`**
- **Found during:** Task 1 (migration)
- **Issue:** The acceptance criterion counts `DropColumn` lines in the whole migration file and requires 0, but EF's generated `Down` drops every new column and the new table. A silent no-op `Down` would leave a half-undone database.
- **Fix:** `Down` throws `NotSupportedException` with a plain message. A drop is a one-way door (D-39, Prime Directive 11); undoing this needs the owner's approval and its own reviewed migration.
- **Files modified:** `src/Csps.Infrastructure/Persistence/Migrations/20261112030543_AddSiteContactDetails.cs`
- **Committed in:** `2c790597`

**2. [Rule 3 - Blocking] Year built in the reader, not the handler** (see Decisions Made). **Committed in:** `2c790597`

**3. [Rule 3 - Blocking] The shell switched to the public snapshot in Task 1, not Task 3**
- **Found during:** Task 1
- **Issue:** `ShellTestFactory` stubs the public reader from now on, and leaving the shell on `ISiteSettingsReader` would send every existing shell test to the real database.
- **Fix:** `ShellRenderer` reads the public snapshot for `og:site_name` and Home's description in Task 1; Task 3 adds JSON-LD, boot data and the head cache. `PublicPageHeads.HomeTagline` is gone (the stored tagline replaces it).
- **Committed in:** `2c790597`

**4. [Rule 3 - Blocking] Files outside the plan's list**
- Shared test helpers and tests: `tests/Csps.Testing/CspsApiFactory.cs` (public-read limit at 100000 for suites), `tests/Csps.Testing/PublicContentSeeding.cs`, `tests/Csps.Infrastructure.IntegrationTests/Content/PublicContentServices.cs`, `PublicContentInvalidationTests.cs`, `SiteContentAttributionTests.cs`, `tests/Csps.Server.IntegrationTests/Testing/TestingSiteContentTests.cs`, `RateLimiting/RateLimitTests.cs` (new limited endpoint row), `RateLimiting/RealLimitsFactory.cs`.
- Old tests that pinned the old behavior were updated: `MigrationTests` and `SiteSettingsReaderTests` (the shop email and Facebook link are now empty), `SiteSettingsTests` (stamp members renamed to `CreatedById`/`UpdatedById`, new defaults), `ShellPageTests` and `ShellTestFactory` (stub public reader), `SeoEndpointTests` (sitemap tests use a stub host and now check `lastmod`).
- New source file `src/Csps.Server/Http/EntityTags.cs` (shared `If-None-Match` comparison, used by the shell and the public read).
- The migration and rate-limit tests are in Task 1's RED commit (the plan lists them under Task 2) because their code lands in Task 1's GREEN.

**5. [Rule 1 - Bug] The Testing seeder was not safe for concurrent calls**
- **Found during:** Task 2 (`ParallelCallersEachGetTheirOwnStatus` got a 500 for the three callers of the new route)
- **Fix:** a static one-at-a-time gate in `TestingSiteContentSeeder`.
- **Committed in:** `ca894737`

**6. [Rule 3 - Blocking] The 304 and rate-limit lists are explicit**
- `RateLimitTests.EveryRateLimitedEndpointIsInTheList` failed for the new endpoint; a `GET /api/v1/public/site, 600` row was added. **Committed in:** `18fab821`

**7. [Process] Plan commit ledger**
- The harness refused compound git commands for the ledger, so `plan_head_before` is the asserted spawn base and `commits: 9` is `git rev-list --count f8cbb402..HEAD` measured before this SUMMARY commit.

**Total deviations:** 5 auto-fixed (1 Rule 1, 4 Rule 3), 1 process note, 1 placement note. **Impact:** no scope creep; item 1 follows the plan's own acceptance criterion and D-39.

## Issues Encountered

- **Flakes recorded (full Server run on a shared, busy machine).** `HealthEndpointFailureTests.HeadRequestCarriesNoStore`, `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` and `TemporaryPasswordTests.AnInvitedPersonWhoGetsATemporaryPasswordCanSignInWithItAndTheOldInvitationDies` failed in the 11-minute full run and passed when their classes were re-run alone (101 tests across those classes, only the then-new guard tests failed and were fixed). None touch this plan's code; not changed. The fourth failure was `RateLimitTests.EveryRateLimitedEndpointIsInTheList`, which this plan caused and fixed (deviation 6).
- Two early guard tests of mine asserted "no `[` in the body" and "no `@` in the body". JSON arrays hold `[`, and JSON-LD holds `"@context"` and `"@type"`, so both were rewritten to check string values and to allow only those two keywords.
- The migration's data step is raw SQL inside the generated migration, the allowed exception. No other SQL was added to application code (`NoInlineSqlTests` passes).
- Not run here: the web unit tests and Playwright (no web source changed except the regenerated types file), Lighthouse.

## Known Stubs

None in the server. Notes for the verifier:

- `web/src/modules/public/components/siteContact.ts` still holds the bracket placeholders and `#` links. The public client plans (11-08 onward) replace it with this API. Until then the PUB-02 "no placeholder" rule holds for every server-sent surface, not for that client file (coverage item D9 is a human judgment).
- `SiteSettings.UpdatedAtUtc` moves only when a single-value field changes. A save that only removes a phone leaves it (and the sitemap `lastmod`) alone, because the settings row holds no phone data. Plan 11-09 should touch the settings row when the phone list changes.
- Bulk writes (`ExecuteUpdate`, `ExecuteDelete`) skip the interceptor and must call `IPublicContentCache.InvalidateAsync` themselves.

## Threat Flags

None new. Planned mitigations are in place: T-11-11 (default JSON encoder in script blocks, `HtmlEncoder` for attributes, typed models, `ScriptBreakout` test), T-11-12 (no email member anywhere, backstop test over every public body), T-11-13 (cached snapshot with a zero-command second read, `public-read` limit, shell and crawler paths unlimited), T-11-14 (post-commit interceptor, rollback and failed-save tests), T-11-15 (no drop or rename, conditional blanking, reviewed idempotent script test, schema tests), T-11-SC (no package added or bumped).

## User Setup Required

None. After deploy, the owner types the real address, phone numbers and links through the Business Info form (plan 11-09). Until then the public site shows only the approved tagline and the business name.

## Next Phase Readiness

- Plan 11-09 (Manager write) can call `SiteSettings.UpdateBusinessInfo`, replace the phone rows with `changes.Phones`, and rely on the interceptor to clear the cache. Plans 11-11 and 11-13 extend `PublicSiteDto` and `PublicContentReader` for hours and closures; plan 11-08 can read the `csps-boot` block.
- The shared requirement IDs (PUB-02, PUB-03, PUB-04, CONT-01, CONT-05) are only partly done by this plan (the read side and the head data). The orchestrator should mark them complete only after the last plan that declares each one.
- STATE.md and ROADMAP.md were not touched (orchestrator owns them).

## Self-Check: PASSED

All created files exist on disk and the nine plan commits (`14b7b45a`, `77bd1b0a`, `10a3130a`, `2c790597`, `3307ebc4`, `ca894737`, `461fa929`, `2403971c`, `18fab821`) are ancestors of HEAD.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-11*
