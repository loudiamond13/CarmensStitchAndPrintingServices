---
phase: 11-public-site-content-management
plan: 15
subsystem: api
tags: [aspnetcore, ef-core, product-lines, migration, seed-data, check-constraints, public-cache, etag, openapi, boot-data]
created: 2026-11-12T05:50:00-06:00
updated: 2026-11-12T05:50:00-06:00

requires:
  - phase: 11-07
    provides: the public snapshot reader and cache, the post-commit cache interceptor, the boot data block, the thin ETag controller action
  - phase: 11-13
    provides: the Testing seeder pattern and the shared public-read limiter wiring
provides:
  - "ProductLines and ProductLinePhotos tables, CK_ProductLines_Price, CK_ProductLines_Minimum, UX_ProductLines_Key, UX_ProductLines_ShortName, UX_ProductLinePhotos_LineSlot, CK_ProductLinePhotos_Slot"
  - "ProductTypes.ProductLineId (nullable) with FK_ProductTypes_ProductLines_ProductLineId (Restrict) and IX_ProductTypes_ProductLineId; no existing product type is linked"
  - "The six lines (basketball, volleyball, moto, longsleeves, polo, custom) inserted once by InsertData in AddProductLines, shown, no price, no minimum"
  - "GET /api/v1/public/product-lines (anonymous, ETag, no-cache, 304, public-read limiter) from the cached snapshot csps:public:lines:v1"
  - "/products boot block carries productLines equal to the API body"
  - "Testing seeder restores the six lines, gives basketball 650.00 with minimum 10, and removes E2E- lines"
affects: [11-17, 11-19, 11-21, 11-26, 11-27]

actuals:
  tokens: 29700
  tasks: 3
  commits: 8
plan_head_before: a4a03788fd5d0bea05b702a2f7e3ea347fb2d76c
plan_head_after: 4f49389e915e95db43cc169892a212360a8d8967

tech-stack:
  added: []
  patterns:
    - "Seed rows through one hand-written InsertData in the migration (literal values) and never through model HasData, so a deploy cannot overwrite a Manager's edits"
    - "A seed list in the domain (ProductLineSeed) that a migration test compares with the database, field by field"
    - "The shell boot block takes an optional second key for one page; a failed extra read keeps the page and is not cached"

key-files:
  created:
    - src/Csps.Domain/Content/ProductLine.cs
    - src/Csps.Domain/Content/ProductLinePhoto.cs
    - src/Csps.Domain/Content/ProductLinePhotoSlot.cs
    - src/Csps.Domain/Content/PlaceholderArt.cs
    - src/Csps.Domain/Content/ProductLineSeed.cs
    - src/Csps.Application/Content/PublicProductLinesDto.cs
    - src/Csps.Application/Content/GetPublicProductLinesHandler.cs
    - src/Csps.Infrastructure/Persistence/Configurations/ProductLineConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/ProductLinePhotoConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261112105037_AddProductLines.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261112105037_AddProductLines.Designer.cs
    - tests/Csps.Domain.UnitTests/Content/ProductLineSeedTests.cs
    - tests/Csps.Domain.UnitTests/Content/ProductLineTests.cs
    - tests/Csps.Application.UnitTests/Content/GetPublicProductLinesHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/ProductLinesMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Content/PublicProductLinesEndpointTests.cs
  modified:
    - src/Csps.Domain/OrderLists/ProductType.cs
    - src/Csps.Application/Ports/IPublicContentReader.cs
    - src/Csps.Infrastructure/Content/PublicContentReader.cs
    - src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderListEntryConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/ProductTypeConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Controllers/PublicSiteController.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - src/Csps.Server/Endpoints/ShellPage.cs
    - src/Csps.Server/Endpoints/PublicHeadWriter.cs
    - tests/Csps.Testing/CspsDatabase.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs
    - tests/Csps.Server.IntegrationTests/Http/ShellTestFactory.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/public-site.md

key-decisions:
  - "D-06 mechanism as the plan states it: InsertData with fixed Guids in the AddProductLines migration only; no HasData, nothing at startup, the dev seed guard untouched"
  - "AddProductLines is forward only (Down throws NotSupportedException), the same as the earlier Phase 11 migrations, because undoing it would drop the lines and photos a Manager entered"
  - "The placeholder drawing is stored by its name (varchar(20)) and sent as camelCase (longSleeves); the column holds names, not numbers, so a reordered enum can never change stored data"
  - "The content tables carry no foreign keys to the user table for the stamp columns, like ShopClosures; the new link FKs are the two Restrict keys the plan names"

requirements-completed: [PUB-02, CONT-02]

coverage:
  - id: D1
    description: "An anonymous read of /api/v1/public/product-lines returns the six seeded lines in order with no prices, no photos, a strong ETag and 304"
    requirement: PUB-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicProductLinesEndpointTests.cs"
        status: pass
    human_judgment: false
  - id: D2
    description: "The migrated rows equal the seed list; price and minimum checks, unique key and short name, unique photo slot and Restrict deletes hold in the database; the idempotent script inserts the six rows once"
    requirement: CONT-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/ProductLinesMigrationTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "The lines read is cached (zero commands on the second read), leaves out hidden lines, is empty when all are hidden, and keeps a stable order; a committed title change shows with a new ETag"
    requirement: PUB-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Content/PublicContentReaderTests.cs; tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "The /products shell carries productLines equal to the API body; other pages carry none; a failed lines read keeps the site data and is not cached"
    requirement: PUB-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "The seeded wording reads right to the shop owner (UI spec text with the long-dash rewrites)"
    requirement: CONT-02
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's call; tests only prove the text equals the approved list and has no long dash"

duration: 70min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 15: Product lines data and public read Summary

**Six database product lines (basketball, volleyball, moto, long sleeves, polo, custom) inserted once by the AddProductLines migration, with `GET /api/v1/public/product-lines` and the `/products` boot block reading them through a cached, invalidated snapshot.**

## Performance

- **Duration:** about 70 min
- **Started:** 2026-11-12T04:40:00-06:00
- **Completed:** 2026-11-12T05:50:00-06:00
- **Tasks:** 3 of 3
- **Files changed:** 40 (see the key-files lists). The token figure (chars/4 of the hand-written diff) leaves out the generated migration designer, model snapshot, OpenAPI snapshot and API types.

## Accomplishments

- The `ProductLines` and `ProductLinePhotos` tables, the nullable `ProductTypes.ProductLineId` link with a Restrict key, and the six starting lines (D-01, D-02, D-06, D-09, D-40). Every line starts shown, with no price and no minimum.
- `GET /api/v1/public/product-lines`: anonymous, public-read limiter, strong ETag, `no-cache`, 304 on a match. It answers `{ "lines": [...] }` with only the shown lines in Position then Id order, and `{ "lines": [] }` when none is shown. Photos are `null` and `hasGalleryItems` is `false` until plans 11-19 and 11-26.
- The `/products` shell carries `productLines` next to `site`, equal to the API body. Other pages do not.
- The database enforces the rules: price above 0 and at most 999999.99, minimum 1 to 9999, unique key, unique short name (case does not matter), one photo per line and slot, and a line with a photo or a linked product type cannot be deleted. No trigger (OR-7).
- The Testing seeder puts the six lines back, gives basketball 650.00 with a minimum of 10, and removes lines whose short name starts with "E2E-".

## Task Commits

| Task | Phase | Commit | Message |
|---|---|---|---|
| 1 (tracer) | RED | `32a5e1fe` | test(11-15): add failing tests for the public product lines read |
| 1 (tracer) | GREEN | `057d1896` | feat(11-15): visitors read six seeded product lines from the database |
| 2 | RED | `f0c300c5` | test(11-15): add tests for the product line schema, the seed, the cache and the Testing seeder |
| 2 | GREEN | `4f0b4b55` | feat(11-15): the Testing seeder restores the six product lines and clears the E2E ones |
| 3 | RED | `069dbdbe` | test(11-15): add failing tests for the product lines in the Products shell boot block |
| 3 | GREEN | `59d8075c` | feat(11-15): the Products shell ships the product lines in its boot block |
| fix | tests | `f25be42c` | test(11-15): list the product lines read in the rate-limit table |
| refactor | domain | `4f49389e` | refactor(11-15): hold the price limits as static readonly so Domain coverage is complete |

## TDD Gate Compliance

- **RED evidence, Task 1:** `PublicProductLinesEndpointTests` (2 tests), the matrix row tests and `DiscoverEndpointsAreFullyCovered` failed on the planned assertion: `response.StatusCode should be OK but was NotFound`, and "matrix row matches no endpoint". They compiled and ran (not a build error). Semantic assessment: the route did not exist, which is the planned reason.
- **RED evidence, Task 2:** the two new `TestingSiteContentTests` failed on the planned assertions (the six lines were not restored: `["basketball","volleyball","longsleeves","custom","moto","e2e-kit"]` instead of the seeded order; an E2E line stayed: count 7, expected 6). The schema, seed, reader and cache tests passed on first run because they check behaviour the Task 1 tracer already built; this is recorded, not hidden. The one tie-break test failed once for a wrong test expectation (SQL Server sorts ids by its own rule, not by .NET `Guid` order); the test now uses `SqlGuid` ordering.
- **RED evidence, Task 3:** 4 tests failed on the planned assertion (`productLines` key missing: `["site", *]` against `["site","productLines"]`; `KeyNotFoundException` for `productLines`).
- GREEN commits follow each RED commit. One REFACTOR commit (`4f49389e`) made `MinPrice` and `MaxPrice` `static readonly decimal` (the compiler inlines a `const decimal`, so the coverage tool saw two lines that never ran); tests still pass. `src/Csps.Domain/Content/ProductLine.cs` lost its unused time parameter in the Task 2 RED commit so that every commit builds.
- The gate classifier command (`gsd_run check tdd-red-evidence`) is not installed in this worktree's shell, so the RED output was inspected by hand and quoted above.

## Migration (AddProductLines, `20261112105037`)

Up, in order: `AddColumn ProductTypes.ProductLineId` (uniqueidentifier, null); `CreateTable ProductLines` with `CK_ProductLines_Minimum` (`[MinimumQuantity] BETWEEN 1 AND 9999`) and `CK_ProductLines_Price` (`[StartsAtPrice] > 0 AND [StartsAtPrice] <= 999999.99`); `InsertData ProductLines` with six literal rows; `CreateTable ProductLinePhotos` with `CK_ProductLinePhotos_Slot` and `FK_ProductLinePhotos_ProductLines_LineId` (Restrict); `CreateIndex IX_ProductTypes_ProductLineId`, `UX_ProductLinePhotos_LineSlot`, `IX_ProductLines_Position`, `UX_ProductLines_Key`, `UX_ProductLines_ShortName`; `AddForeignKey FK_ProductTypes_ProductLines_ProductLineId` (Restrict). The first row of the insert, as written in the file:

```csharp
{ new Guid("3a48a1d6-c812-4481-a6be-d7d7412484a0"), "basketball", "Basketball Jerseys", "Basketball", "23",
  "Full sublimation tops and shorts, any colorway, names and numbers included.", "Game-ready tops and shorts, ...",
  "Dri-fit mesh, aircool or spandex blend", "V-neck, round or layered", "Standard, slim, women's fit and kids",
  "Any font: front, back and shorts", "Team crest, sponsors and barangay seal in full color",
  1, true, "Basketball", new DateTimeOffset(new DateTime(2026, 11, 11, 0, 0, 0, 0, DateTimeKind.Unspecified), new TimeSpan(0, 0, 0, 0, 0)) },
```

The other five rows follow the same shape (ids `1416d96d...`, `6ff58459...`, `87f4ec3b...`, `8557a14d...`, `ca2ee9a1...`; positions 2 to 6).

Down (forward only, the same as AddShopClosures):

```csharp
throw new NotSupportedException(
    "AddProductLines is forward-only. Undoing it would delete the product lines and photos that were entered.");
```

`dotnet ef migrations add` also scaffolded six `UpdateData ProductTypes ... ProductLineId = null` calls (EF does this for a new column on a seeded table). They change no value, but they touch existing rows, so they were removed by hand. The model snapshot is unchanged by that, and the pending-model-changes test passes. No JSON column, no trigger, no drop, no rename, no type change.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ProductLines must survive the shared test reset**
- **Found during:** Task 1
- **Issue:** `CspsDatabase.ResetAsync` (Respawn) deletes every table that is not on its ignore list, so the migration-seeded lines would vanish from any shared fixture database after a reset.
- **Fix:** Added `ProductLines` to the ignored tables in `tests/Csps.Testing/CspsDatabase.cs` (like `SiteSettings` and `OpeningHours`). Photos are still reset.
- **Files modified:** `tests/Csps.Testing/CspsDatabase.cs` (not in the plan's file list)
- **Commit:** `057d1896`

**2. [Rule 1 - Bug] The rate-limit table test lists every limited endpoint**
- **Found during:** full Server integration run
- **Issue:** `RateLimitTests.EveryRateLimitedEndpointIsInTheList` failed because the new endpoint was not in `LimitedEndpoints`.
- **Fix:** Added `GET /api/v1/public/product-lines` with limit 600.
- **Files modified:** `tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs` (not in the plan's file list)
- **Commit:** `f25be42c`

**3. [Rule 3 - Blocking] The `ProductTypeConfiguration` base class needed a virtual `Configure`**
- **Found during:** Task 1
- **Issue:** The one-line subclass had no place to add the link key and index.
- **Fix:** `OrderListEntryConfiguration<T>.Configure` is now `virtual` and `ProductTypeConfiguration` overrides it and calls the base. `OrderListEntryConfiguration.cs` is not in the plan's file list.
- **Commit:** `057d1896`

**4. [Rule 3 - Blocking] Existing test helpers had to know the new reader method**
- **Found during:** Task 1 and Task 3
- **Issue:** `StubPublicContentReader` (in `ShellTestFactory.cs`) must implement `GetProductLinesAsync`; the existing "same site JSON" test pinned `["site"]` as the only boot key for `/products`.
- **Fix:** The stub returns an empty list (settable, with a settable failure); the old test now expects `["site", "productLines"]` for `/products` only.
- **Commits:** `057d1896`, `069dbdbe`

### Shape differences from the plan text (no behaviour change)

- `ProductLine.ResetToSeed(entry, startsAtPrice, minimumQuantity)` has no `DateTimeOffset now` parameter. It assigns every value, and the stamp interceptor sets `UpdatedAtUtc` only when EF sees a real change. An unused parameter, or an "unchanged" branch the domain tests could not reach, would break the Domain 100% line and branch rule.
- `ProductLinePhoto.Create(...)` exists now (the plan names only the entity) so the schema tests and the Testing seeder can build a photo row with the domain. Plan 11-19 owns the real validation and file work.
- The acceptance check `grep -c "HasData"` on `ProductLineConfiguration.cs` counts `HasDatabaseName` (three lines). The intended check, `HasData(`, finds 0.
- The `DTO` for the drawing is a string (`longSleeves`), not an enum, so the OpenAPI type stays a plain string.

**Total deviations:** 4 auto-fixed (2 Rule 3 test-support, 1 Rule 3 base class, 1 Rule 1). **Impact:** none on the product behaviour; four small edits outside the listed files.

## Known Stubs

| File | What | Why it is intentional | Resolved by |
|---|---|---|---|
| `src/Csps.Infrastructure/Content/PublicContentReader.cs` (LoadLinesAsync) | `photos` slots are `null` and `hasGalleryItems` is `false` | The plan says so: photos arrive with 11-19 and the gallery flag with 11-26 | 11-19, 11-26 |

`.planning/WINDOWS.md` was not touched: parallel executors share it, and the orchestrator merges the ledger after the wave.

## Authentication Gates

None.

## Threat Flags

None. The only new network surface is the anonymous `GET /api/v1/public/product-lines`, which the plan's threat model (T-11-37) already covers: cached snapshot, query-count test, public-read limiter (limit table updated).

## Verification

Quoted from real runs in this worktree on LocalDB (`CSPS_TEST_SQL=localdb`):

- `PublicProductLinesEndpointTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests`, `OpenApiSnapshotTests`: 478 total, 478 passed (after the snapshot refresh).
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Infrastructure: `ProductLinesMigrationTests`, `PublicContentReaderTests`, `TriggerInventoryTests`, `MigrationScriptTests`: 32 of 32. Full Infrastructure project: 1137 total, 1136 passed, 1 skipped (a Release-only skip that was already there), 0 failed.
- Domain unit tests: 1639 of 1639. Application unit tests: 2732 of 2732. Architecture tests: 290 of 290.
- `ShellHeadTests`, `ShellPageTests`: 72 of 72. `TestingSiteContentTests`, `PublicCacheInvalidationTests`: 12 of 12.
- `dotnet format Csps.slnx --verify-no-changes`: clean (no output, exit 0).
- Task 1 criteria: `InsertData` count in the migration is 1 (one call with six rows); `HasData(` in `ProductLineConfiguration.cs`: 0; `GetPublicProductLines` in the OpenAPI snapshot: 1; no em or en dash in `ProductLineSeed.cs` or the migration.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): "Csps.Domain line 100% (3514/3514) branch 100% (1521/1521) PASS", "Csps.Application line 97.9% (9769/9975) PASS", "Coverage gate passed." The first run showed Domain at 99.9% (the two decimal constant lines), which the refactor commit fixed.
- Full Server integration project, first run: 2494 total, 2491 passed, 3 failed.
  - `RateLimitTests.EveryRateLimitedEndpointIsInTheList`: caused by this plan (the new limited endpoint was not in the table). Fixed in `f25be42c`; the class passes (63 of 64 in the re-run, the one failure being the next item).
  - `OpeningHoursEndpointTests.StampFieldsSentByTheClientAreIgnoredAndTheServerStampsTheManagerAndTheClock`: **not caused by this plan.** Run by itself it passes; run with its class it fails because an earlier test in the same shared database leaves Tuesday open, so the setup step stamps Tuesday and the assertion "a day that did not change is not stamped" fails. It touches only opening hours (plan 11-11). Recorded as a flake for the orchestrator; not fixed here (out of scope).
  - `CreateUserEndpointTests.ARepeatedKeyAndBodyGivesTheFirstAnswerBack...` (took 31 s): passes on a re-run alone and in the three-class re-run. A timing flake, unrelated.

Tracer gate: the Task 1 `<verify>` commands were re-run end to end after the GREEN commit and passed, so the expansion tasks went ahead.

## Self-Check: PASSED

All 16 created source and test files exist on disk, and all 8 task commits are on this branch (`git log` base..HEAD lists them). The commit count and the base and head ids in the frontmatter were measured with `git rev-list --count`, not written from memory.
