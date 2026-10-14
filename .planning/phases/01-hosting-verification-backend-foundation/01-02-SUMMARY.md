---
phase: 01-hosting-verification-backend-foundation
plan: 02
subsystem: database
tags: [efcore10, sqlserver, localdb, migrations, hybridcache, xunit-v3, testcontainers, timezone]

# Dependency graph
requires:
  - phase: 01-01
    provides: "Csps.slnx onion skeleton, central pins (EF Core 10.0.12, HybridCache 10.10.0, Testcontainers.MsSql 4.15.0), Csps.Testing + CspsApiFactory, ArchitectureTests"
provides:
  - "tools/scripts/Initialize-LocalDb.ps1: idempotent create/start of (localdb)\\CSPS (never MSSQLLocalDB)"
  - "Csps.Testing SQL fixture: SqlBackend.From (CSPS_TEST_SQL), SqlServerInstance.GetSharedAsync, CspsDatabase (IClassFixture + CreateAsync, compat 160, MigrateAsync, guarded drop), TestDatabaseName.NewName/IsDisposable"
  - "CspsApiFactory injects ConnectionStrings:Csps (unopened CSPS_Test_ name by default); CspsApiFactory.ForDatabase(connectionString) and a protected (string) constructor for real databases"
  - "Domain: SiteSettings aggregate (SingletonId, max-length constants, CreateDefault), SiteSettingsDefaults (D-04 incl. SeededAtUtc), TimeZoneResolver.Resolve + ZoneSource"
  - "Application: ISiteSettingsReader, ISiteSettingsCache, SiteSettingsSnapshot ([ImmutableObject(true)] sealed record)"
  - "Infrastructure: CspsDbContext, SqlCompatibility.Level = 160, CspsDbContextOptions.Configure, CspsDesignTimeDbContextFactory, SiteSettingsConfiguration, InitialCreate migration, SiteSettingsReader (HybridCache key csps:site-settings:v1, tag site-settings), DependencyInjection.AddInfrastructure / AddCspsPersistence"
  - "DB objects: table SiteSettings, CK_SiteSettings_Singleton, seed row Id 1; CSPS_Dev on (localdb)\\CSPS"
  - "Projects: tests/Csps.Infrastructure.IntegrationTests, tests/Csps.Domain.UnitTests"
affects: [01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-11, 01-12, 01-13, CONT-01]

# Actuals (#2632)
actuals:
  tokens: 33566    # chars/4 over all 39 changed files (134,265 chars); 19,521 tokens excluding the two generated packages.lock.json files
  tasks: 3
  commits: 6
plan_head_before: 4a0906164ce03a1ba235598977f72e6217f28fe4
plan_head_after: 2459554734420d175c4e76170ac955159db42b67

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One CspsDbContextOptions.Configure path for DI, design-time factory, fixture and (later) dev seed"
    - "Test databases: CSPS_Test_<guid> per test class via IClassFixture<CspsDatabase>; tests that mutate shared rows use CspsDatabase.CreateAsync"
    - "Migration assertions read the database with plain SQL, independent of the EF model"
    - "Ports composed in tests through the real AddInfrastructure (in-memory IConfiguration + HostingEnvironment), one DI scope per read"
    - "C# 14 static extension member (extension(SqlBackend)) gives the enum a SqlBackend.From factory"
    - "Domain internals reachable from Csps.Domain.UnitTests (InternalsVisibleTo) for injectable-lookup branch tests"

key-files:
  created:
    - tools/scripts/Initialize-LocalDb.ps1
    - tests/Csps.Testing/SqlBackend.cs
    - tests/Csps.Testing/SqlServerInstance.cs
    - tests/Csps.Testing/CspsDatabase.cs
    - tests/Csps.Testing/TestDatabaseName.cs
    - src/Csps.Domain/Content/SiteSettings.cs
    - src/Csps.Domain/Content/SiteSettingsDefaults.cs
    - src/Csps.Domain/Time/TimeZoneResolver.cs
    - src/Csps.Domain/Time/ZoneSource.cs
    - src/Csps.Application/Ports/ISiteSettingsReader.cs
    - src/Csps.Application/Ports/ISiteSettingsCache.cs
    - src/Csps.Application/Content/SiteSettingsSnapshot.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/SqlCompatibility.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContextOptions.cs
    - src/Csps.Infrastructure/Persistence/CspsDesignTimeDbContextFactory.cs
    - src/Csps.Infrastructure/Persistence/Configurations/SiteSettingsConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261007140149_InitialCreate.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261007140149_InitialCreate.Designer.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/Content/SiteSettingsReader.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Content/SiteSettingsReaderTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Fixture/TestDatabaseNameTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Fixture/SqlBackendTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Fixture/CspsDatabaseTests.cs
    - tests/Csps.Domain.UnitTests/Content/SiteSettingsTests.cs
    - tests/Csps.Domain.UnitTests/Time/TimeZoneResolverTests.cs
  modified:
    - Csps.slnx
    - src/Csps.Domain/Csps.Domain.csproj
    - src/Csps.Infrastructure/Csps.Infrastructure.csproj
    - src/Csps.Server/Program.cs
    - src/Csps.Server/appsettings.Development.json
    - tests/Csps.Testing/CspsApiFactory.cs

key-decisions:
  - "CspsApiFactory keeps a single public (parameterless) constructor because xUnit1056 forbids two on a class fixture; the plan's (string connectionString) constructor is protected, with a public static CspsApiFactory.ForDatabase(connectionString) for ad-hoc use"
  - "LocalDB connections need no TrustServerCertificate (research A12 confirmed on (localdb)\\CSPS, version 17.0.4025.3)"
  - "TestDatabaseName.IsDisposable checks the exact length as well as ^CSPS_Test_[0-9a-f-]{36}$, because .NET '$' also matches before a trailing newline"
  - "CSPS_Dev is created by dotnet ef at the server default compatibility level 170; EF generates SQL for the pinned 160 and test databases are explicitly set to 160"
  - "SqlBackend.From is a C# 14 static extension member on the enum, keeping the plan's call shape SqlBackend.From(value, isWindows)"

patterns-established:
  - "Fixture DDL goes through one QuotedName() that re-validates the name with TestDatabaseName before any SQL (CWE-89)"
  - "RED evidence for SQL-backed tests: target-only run with --report-xunit-junit, validated by gsd check tdd-red-evidence"

requirements-completed: [FND-01, FND-08, FND-09, FND-11]

coverage:
  - id: D1
    description: "Empty CSPS_Test database gets the SiteSettings table and the D-04 singleton row from InitialCreate alone; second migrate is a no-op; a second row is rejected by CK_SiteSettings_Singleton"
    requirement: FND-01
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationTests.cs#FreshDatabaseHasSiteSettingsSingleton, MigratingTwiceIsANoOp, SecondSingletonRowIsRejected"
        status: pass
    human_judgment: false
  - id: D2
    description: "dotnet ef database update builds CSPS_Dev on (localdb)\\CSPS with no .bak; migrations list shows InitialCreate and nothing pending; no pending model changes"
    requirement: FND-01
    verification:
      - kind: other
        ref: "dotnet ef database update + dotnet ef migrations list > artifacts/ef-migrations.txt (InitialCreate, no Pending); dotnet ef migrations has-pending-model-changes"
        status: pass
    human_judgment: false
  - id: D3
    description: "Interrupted dotnet ef database update leaves the DB at the last committed migration and a re-run completes it (FND-01 concurrency edge, backstop)"
    requirement: FND-01
    verification: []
    human_judgment: true
    rationale: "Backstop truth relying on EF Core's per-migration transaction on SQL Server; only one migration exists, so no automated interruption test was written in this plan"
  - id: D4
    description: "Cached SiteSettings port: seeded snapshot, cached until InvalidateAsync, invalidate-then-read returns committed value, Unicode (apostrophe, ampersand, U+20B1) round-trip, missing row throws a clear InvalidOperationException"
    requirement: FND-09
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Content/SiteSettingsReaderTests.cs (5 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Server composes AddInfrastructure without any startup migration and still serves /health"
    requirement: FND-09
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs (3 tests)"
        status: pass
      - kind: unit
        ref: "tests/Csps.ArchitectureTests (59 tests, incl. LayerTests: Application has no EF/ASP.NET Core reference)"
        status: pass
    human_judgment: false
  - id: D6
    description: "SQL fixture core: CSPS_TEST_SQL backend selection, drop guard ^CSPS_Test_[0-9a-f-]{36}$, compat-160 pin, drop on dispose, no leftover test databases"
    requirement: FND-11
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Fixture/TestDatabaseNameTests.cs, SqlBackendTests.cs, CspsDatabaseTests.cs (30 tests)"
        status: pass
      - kind: other
        ref: "sqlcmd -S (localdb)\\CSPS: only CSPS_Dev remains after the full run"
        status: pass
    human_judgment: false
  - id: D7
    description: "TimeZoneResolver D-02 chain (Stored, FallbackIana, FallbackWindows, FixedOffset), never throws; Domain at 100% line and branch coverage"
    requirement: FND-08
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Time/TimeZoneResolverTests.cs (8 tests)"
        status: pass
      - kind: other
        ref: "coverlet.MTP cobertura over [Csps.Domain]*: lines 62/62, branches 8/8 (temporary reference, reverted)"
        status: pass
    human_judgment: false

# Metrics
duration: 25min
completed: 2026-10-07
status: complete
---

# Phase 1 Plan 02: Data Path (SiteSettings, Migrations, SQL Fixture, Zone Resolver) Summary

**An empty `CSPS_` database gets the SiteSettings singleton (D-04 values, `CK_SiteSettings_Singleton`) from the `InitialCreate` EF migration alone, read through a HybridCache-backed Application port with tag invalidation. Integration tests run on isolated `CSPS_Test_<guid>` databases on `(localdb)\CSPS`, and the TimeZoneResolver implements the D-02 fallback chain with 100% Domain coverage.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-07T13:51:30Z
- **Completed:** 2026-10-07T14:16:47Z
- **Tasks:** 3 (Task 1 tracer, then Tasks 2 and 3)
- **Files modified:** 39 (35 created or modified source/test/script files, plus 2 new packages.lock.json files and the slnx/csproj edits)

## Accomplishments

- The `(localdb)\CSPS` instance exists and runs. The script `tools/scripts/Initialize-LocalDb.ps1` creates or starts it and is safe to rerun. `MSSQLLocalDB` is never touched.
- `InitialCreate` creates `SiteSettings` with nvarchar lengths, a `rowversion` column, the singleton CHECK constraint and the seeded row. `CSPS_Dev` was built with `dotnet ef database update`, with no `.bak`, no pending migration and no pending model changes.
- `ISiteSettingsReader` and `ISiteSettingsCache` sit over HybridCache: key `csps:site-settings:v1`, tag `site-settings`, 1 h expiry, 64 KB payload cap, in-process only. The Server calls `AddInfrastructure`, and nothing migrates or seeds at startup.
- The test fixture creates one `CSPS_Test_<guid>` database per class, pins compat 160, applies the real migrations and drops the database only after the name guard passes. The full run left no test databases behind.
- `TimeZoneResolver.Resolve` never throws. It uses the stored id first, then `Asia/Manila`, then `Singapore Standard Time`, then a fixed `CSPS+08` zone.

## Task Commits

1. **Task 1: Tracer, empty CSPS_Test database migrated by InitialCreate holds the SiteSettings singleton**
   - RED: `08d4d89` (test)
   - GREEN: `0704df5` (feat)
2. **Task 2: Cached SiteSettings read port with tag invalidation, wired into the Server**
   - RED: `21e61be` (test)
   - GREEN: `761d41b` (feat)
3. **Task 3: TimeZoneResolver fallback chain with 100% Domain coverage**
   - RED: `12eeef4` (test)
   - GREEN: `2459554` (feat)

**Plan metadata:** recorded in the docs commit for this SUMMARY.

## TDD Evidence

Each RED run was a target-only run with `--report-xunit-junit`, validated by `gsd check tdd-red-evidence`. All returned `RED_EVIDENCE_OK` (reason `target_test_failed`).

- **Task 1 RED:** `MigrationTests` ran 3/3 failed (exit 2). The fixture created and migrated the database, but with an empty `OnModelCreating` and no migration, the target `FreshDatabaseHasSiteSettingsSingleton` failed on `TableExistsAsync(connection, "SiteSettings") should be True but was False`. Fixture and load were fine, so the failure was an assertion.
- **Task 1 GREEN:** `SiteSettingsConfiguration` was added, then the migration was generated. MigrationTests passed 3/3 and the Fixture tests 30/30.
- **Task 1 tracer gate:** auto mode was on and the task had no `gate` attribute (row 2). The whole tracer `<verify>` was re-run: LocalDB `State: Running`, MigrationTests 3/3, Fixture tests 30/30, `dotnet ef database update` plus `migrations list` (InitialCreate, nothing Pending), build 0 warnings, format exit 0. It passed, so Tasks 2 and 3 went ahead.
- **Task 2 RED:** the baseline was an uncached reader. 4/5 passed, and the target `ServesCachedValueUntilInvalidated` failed with `BusinessName should be "Carmen's Stitch & Printing Services" but was "Changed Behind The Cache"`.
- **Task 2 GREEN:** after the HybridCache reader and `AddHybridCache` went in, 5/5 passed. HealthEndpointTests 3/3 and ArchitectureTests 59/59 also passed.
- **Task 3 RED:** the stub covered only the stored and IANA steps. `FallsBackToWindowsIdWhenIanaMissing` and `FallsBackToFixedOffsetWhenNothingResolves` both failed with `source should be FallbackWindows/FixedOffset but was FallbackIana`. Each was validated on its own.
- **Task 3 GREEN:** 8/8 passed, Domain 11/11. Coverage over `[Csps.Domain]*` was lines 62/62 and branches 8/8. This used a temporary `coverlet.MTP` reference, reverted afterwards (Pattern 16 adds the permanent gate later).
- **REFACTOR:** none needed.

## Plan Verification

- `dotnet build Csps.slnx -tl:off`: 0 warnings, 0 errors, on two consecutive runs.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0 with the generated migration present. That confirms the second half of A14: the root-relative migrations section is honoured.
- `dotnet test --solution Csps.slnx`: **111/111 passed**. That is Domain 11, Infrastructure integration 38, Server integration 3 and Architecture 59.
- Preflight ran before the full run and was clean: ports 5180/5115/7028/5199 free, no TheBETSLLC processes. Afterwards `(localdb)\CSPS` holds only `CSPS_Dev`.

## Files Created/Modified

- `tools/scripts/Initialize-LocalDb.ps1`: idempotent creation and start of `(localdb)\CSPS`. Compatible with Windows PowerShell 5.1.
- `tests/Csps.Testing/SqlBackend.cs`: the `SqlBackend` enum, plus `SqlBackendSelection` with the C# 14 static extension `SqlBackend.From(value, isWindows)` and the `CSPS_TEST_SQL` constant.
- `tests/Csps.Testing/SqlServerInstance.cs`: lazy process-wide server. LocalDB master string, or a Testcontainers `2025-CU9-ubuntu-24.04` container, used only when `CSPS_TEST_SQL=container`.
- `tests/Csps.Testing/CspsDatabase.cs`: class fixture with ad-hoc `CreateAsync`. It runs CREATE, compat `SqlCompatibility.Level`, then `MigrateAsync`. Dispose clears pools, runs the guard, sets SINGLE_USER and drops the database.
- `tests/Csps.Testing/TestDatabaseName.cs`: `NewName()` and `IsDisposable()`, which applies the exact CLAUDE.md regex plus a length check.
- `tests/Csps.Testing/CspsApiFactory.cs`: injects `ConnectionStrings:Csps`, adds `ForDatabase(...)` and the protected `(string)` constructor.
- `src/Csps.Domain/Content/SiteSettings.cs`, `SiteSettingsDefaults.cs`: the aggregate, length constants, `CreateDefault`, and the D-04 literals with `SeededAtUtc`.
- `src/Csps.Domain/Time/TimeZoneResolver.cs`, `ZoneSource.cs`: the D-02 chain, with an injectable lookup overload (internal).
- `src/Csps.Application/Ports/ISiteSettingsReader.cs`, `ISiteSettingsCache.cs`, `Content/SiteSettingsSnapshot.cs`: the ports and the immutable snapshot.
- `src/Csps.Infrastructure/Persistence/*`: the context, the compat constant, the single options path, the design-time factory (CSPS_Dev, no environment variable), the Fluent configuration and the `InitialCreate` migration with its snapshot.
- `src/Csps.Infrastructure/Content/SiteSettingsReader.cs`: the HybridCache reader and invalidator.
- `src/Csps.Infrastructure/DependencyInjection.cs`: `AddInfrastructure` (throws a clear error naming `ConnectionStrings:Csps` when it is absent) and `AddCspsPersistence`.
- `src/Csps.Server/Program.cs`: calls `AddInfrastructure`. `appsettings.Development.json` holds the integrated-security LocalDB string to `CSPS_Dev`, with no secret.
- New test projects: `tests/Csps.Infrastructure.IntegrationTests` (38 tests) and `tests/Csps.Domain.UnitTests` (11 tests), both added to `Csps.slnx`.

## Decisions Made

- **CspsApiFactory constructors:** xUnit1056 (from the analyzer that runs under `dotnet format`) rejects a class fixture with two public constructors. The parameterless constructor stays public. The plan's `CspsApiFactory(string connectionString)` is `protected`, so derived class-database fixtures can use it, and `public static CspsApiFactory ForDatabase(string)` covers ad-hoc use.
- **A12 resolved:** `(localdb)\CSPS` (LocalDB 17.0.4025.3) connects with `Integrated Security=true` and no `TrustServerCertificate`.
- **Name guard hardening:** in .NET, `$` also matches before a trailing `\n`, so `IsDisposable` checks the exact length too. A `"CSPS_Test_<guid>\n"` case proves it.
- **CSPS_Dev compat level:** `dotnet ef database update` creates `CSPS_Dev` at the server default, 170. EF's SQL generation is pinned to 160 through `UseCompatibilityLevel`, and test databases are set to 160 explicitly. Plan 04 (dev seed) or 13 (re-pin) may want to `ALTER` CSPS_Dev to the pinned level.
- **Migration assertions use plain SQL:** this keeps them independent of the EF model and made a clean assertion RED possible before any mapping existed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CspsApiFactory(string) made protected, plus a public ForDatabase factory**
- **Found during:** Task 2 (GREEN, `dotnet format --verify-no-changes`)
- **Issue:** the analyzers reported `xUnit1056: Fixture 'Csps.Testing.CspsApiFactory' must have a single public non-static constructor` on `HealthEndpointTests`, which uses `IClassFixture<CspsApiFactory>`.
- **Fix:** the second constructor became `protected`, and `public static CspsApiFactory ForDatabase(string connectionString)` was added.
- **Files modified:** tests/Csps.Testing/CspsApiFactory.cs
- **Verification:** format exits 0, HealthEndpointTests pass 3/3.
- **Committed in:** `761d41b`

**2. [Rule 2 - Missing critical] Drop guard also checks exact length**
- **Found during:** Task 1
- **Issue:** with the plan's regex alone, a name ending in `\n` would be accepted, because .NET `$` matches before a final newline. That weakens the T-01-05 drop guard.
- **Fix:** `IsDisposable` now also requires `name.Length == Prefix.Length + 36`. The regex literal is unchanged, so the acceptance grep still matches.
- **Files modified:** tests/Csps.Testing/TestDatabaseName.cs, tests/Csps.Infrastructure.IntegrationTests/Fixture/TestDatabaseNameTests.cs
- **Verification:** `RejectsEverythingElse("CSPS_Test_<guid>\n")` passes.
- **Committed in:** `08d4d89`

**3. [Rule 2 - Missing critical] Added CspsDatabaseTests (fixture truths proven directly)**
- **Found during:** Task 1 (after GREEN)
- **Issue:** the must-have "pins its compatibility level ... and drops it on dispose" was only implied by other tests.
- **Fix:** one test creates an ad-hoc database and asserts the name guard, `compatibility_level == SqlCompatibility.Level`, and that the database is gone after `DisposeAsync`.
- **Files modified:** tests/Csps.Infrastructure.IntegrationTests/Fixture/CspsDatabaseTests.cs (not in the plan's file list)
- **Committed in:** `0704df5`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 missing-critical).
**Impact on plan:** all three are small and keep the plan's intent. The only API shape change is `CspsApiFactory(string)` becoming protected, with `ForDatabase` as the public entry point.

## Issues Encountered

- **TheBETSLLC test runs:** they were active twice during execution. Before the first test run I waited, polling in the background until the preflight was clean. Once, during Task 2, I chained targeted test runs right after a preflight that listed TheBETSLLC Playwright processes, without gating on its result. Those runs used only `(localdb)\CSPS` over named pipes and no ports, so TheBETSLLC's resources were not touched. Every later test run, including the full one, was gated on a clean preflight.
- **`dotnet format` and line endings:** `dotnet format` flagged the whitespace around a `#pragma` in `SiteSettings.cs`. CA1819 turned out not to be active at `latest-recommended`, so the pragma was removed.
- **TDD baseline:** with the `DbSet<SiteSettings>` present, no `OnModelCreating` mapping and no migration, EF's `MigrateAsync` did not throw `PendingModelChangesWarning`, so the planned RED (assertion failure, not fixture crash) worked as written.

## User Setup Required

None. `(localdb)\CSPS` was created by the script. The owner can recreate it at any time with `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-LocalDb.ps1`.

## Next Phase Readiness

- Plan 03 (business calendar) can build `IBusinessCalendar` on `ISiteSettingsReader` plus `TimeZoneResolver.Resolve`. `ZoneSource` is ready for the health time-zone check: Healthy when Stored, Degraded for any fallback.
- Plan 04 (dev seed) can use `CspsDbContextOptions.Configure` and `SiteSettings.CreateDefault(timeProvider.GetUtcNow())`.
- Later plans that add Respawn need `SiteSettings` in `TablesToIgnore` (research Pattern 11). Tests that change the row must use an ad-hoc `CspsDatabase.CreateAsync`, as `SiteSettingsReaderTests` does.
- The FND-01 concurrency edge (interrupted update) remains a backstop truth with no automated test. It is listed as D3 with human judgment.

## Self-Check: PASSED

- All 29 created and 6 modified key files exist on disk, plus the two new `packages.lock.json` files.
- Commits `08d4d89`, `0704df5`, `21e61be`, `761d41b`, `12eeef4` and `2459554` are present on `gsd/phase-1-hosting-verification-backend-foundation`. Each task has a `test(01-02)` RED commit before its `feat(01-02)` GREEN commit.
- All acceptance criteria for Tasks 1–3 were re-run and pass. Plan verification: build 0 warnings ×2, `dotnet test --solution` 111/111, format exit 0, and no leftover `CSPS_Test_` databases.

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*
