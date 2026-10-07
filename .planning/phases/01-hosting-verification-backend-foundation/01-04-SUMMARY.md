---
phase: 01-hosting-verification-backend-foundation
plan: 04
subsystem: database
tags: [efcore10, sqlserver, localdb, dev-seed, migrations, idempotent-script, respawn, archunitnet, xunit-v3, powershell]

# Dependency graph
requires:
  - phase: 01-02
    provides: "CspsDbContext + CspsDbContextOptions.Configure, SqlCompatibility.Level, InitialCreate migration, SiteSettings aggregate + SiteSettingsDefaults, CspsDatabase fixture + TestDatabaseName guard, (localdb)\\CSPS"
  - phase: 01-03
    provides: "AddInfrastructure with AddLogging; clean full-solution baseline (126 tests)"
provides:
  - "tools/Csps.DevSeed: explicit, guarded dev-seed CLI (--reset, --database CSPS_Dev|CSPS_E2E, --connection); exit 0/1/2/64"
  - "Infrastructure Seeding/: ISeedStep, SeedStepResult, DevSeeder (ordered, duplicate-Order rejection), DevSeedSteps.All, SiteSettingsSeedStep (Order 100), DevSeedTargetGuard.Check -> DevSeedTargetCheck(Allowed, DatabaseName, Reason), DevSeedOptions.Parse"
  - "Domain: SiteSettings.ResetToSeedDefaults(DateTimeOffset)"
  - "Test infrastructure: CspsDatabase.CreateEmptyAsync(int compatibilityLevel), CspsDatabase.ResetAsync() (Respawn, ignores __EFMigrationsHistory + SiteSettings)"
  - "MigrationScriptTests (FND-12) and StartupSafetyTests (no startup migrate/seed; Server never depends on EF/Persistence/Seeding)"
  - "tools/scripts/Remove-StaleTestDatabases.ps1: (localdb)\\CSPS only, exact CSPS_Test_<guid> regex, age filter, -WhatIf"
  - "CSPS_Dev rebuilt by the dev seed at compatibility level 160"
affects: [01-09, 01-13, auth, orders, expenses, price-list, e2e]

# Actuals (#2632)
actuals:
  tokens: 22999    # chars/4 over the 22 changed files (91,999 chars); 18,468 excluding the generated tools/Csps.DevSeed/packages.lock.json
  tasks: 3
  commits: 5
plan_head_before: 9684c6f9c237f4602a9eb1c3f532b41e83596ad2
plan_head_after: cd52d79ac3a02f6621610495769b482c99b50d06

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dev-seed steps: ISeedStep with a unique Order, idempotent, returns whether it changed anything; the runner saves after each step; later phases append to DevSeedSteps.All"
    - "Target guard on the final connection string before any connection opens; refusal reasons never echo the connection string"
    - "Migrate/drop/create-database calls live only in tools/ and tests/; StartupSafetyTests scans src/ text and ArchUnitNET-checks the Server"
    - "ArchUnitNET dependency rules on types from assemblies not loaded into the architecture use NotDependOnAnyTypesThat(), not NotDependOnAny(Types().That()...)"
    - "Verification tests that pass on arrival are proven by temporary production mutations, with RED evidence captured under the mutation"
    - "Tests that need data isolation within a class call CspsDatabase.ResetAsync(); tables created before the first reset are included"

key-files:
  created:
    - tools/Csps.DevSeed/Csps.DevSeed.csproj
    - tools/Csps.DevSeed/Program.cs
    - tools/Csps.DevSeed/packages.lock.json
    - src/Csps.Infrastructure/Seeding/ISeedStep.cs
    - src/Csps.Infrastructure/Seeding/SeedStepResult.cs
    - src/Csps.Infrastructure/Seeding/DevSeeder.cs
    - src/Csps.Infrastructure/Seeding/DevSeedSteps.cs
    - src/Csps.Infrastructure/Seeding/SiteSettingsSeedStep.cs
    - src/Csps.Infrastructure/Seeding/DevSeedTargetCheck.cs
    - src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs
    - src/Csps.Infrastructure/Seeding/DevSeedOptions.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedTargetGuardTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedOptionsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Fixture/SqlFixtureTests.cs
    - tests/Csps.ArchitectureTests/StartupSafetyTests.cs
    - tools/scripts/Remove-StaleTestDatabases.ps1
  modified:
    - src/Csps.Domain/Content/SiteSettings.cs
    - tests/Csps.Domain.UnitTests/Content/SiteSettingsTests.cs
    - tests/Csps.Testing/CspsDatabase.cs
    - Csps.slnx

key-decisions:
  - "The dev-seed CLI creates the database itself and pins it to SqlCompatibility.Level (160) before migrating, so CSPS_Dev matches EF's SQL and the test databases (it was 170 after plan 02)"
  - "DevSeedOptions.Parse reports usage errors as ArgumentException (CLI exit 64); --database and --connection together, repeated flags and flags missing a value are usage errors"
  - "DevSeedTargetGuard also refuses master and any non-CSPS_Dev/CSPS_E2E catalog on any server; SqlConnectionStringBuilder trims unquoted values, so 'Database= CSPS_Dev' names CSPS_Dev and is allowed"
  - "SiteSettings.ResetToSeedDefaults compares ordinally (byte-exact) and clears UpdatedByUserId when it stamps UpdatedAtUtc"
  - "StartupSafetyTests' Server rule uses NotDependOnAnyTypesThat(): the NotDependOnAny(Types().That()...) form only sees types loaded into the architecture and missed a Server dependency on CspsDbContext"
  - "Idempotent-script transaction shape is asserted (one BEGIN TRANSACTION/COMMIT pair per migration) as the automated backstop for the FND-12 concurrency edge"

patterns-established:
  - "Seed steps: add a class implementing ISeedStep with a new unique Order and append it to DevSeedSteps.All; test it against a CspsDatabase fixture, not through the CLI"
  - "Mutation record: break production code temporarily, capture JUnit, validate with gsd check tdd-red-evidence, revert with git checkout -- <file>"

requirements-completed: [FND-01, FND-04, FND-11, FND-12]

coverage:
  - id: D1
    description: "Guarded dev-seed command: --reset drops, re-creates at compat 160, migrates and seeds CSPS_Dev (exit 0); a plain re-run is idempotent; a BetsLLC_Dev target exits 2 with 'Refused:' on stderr; an unknown flag exits 64"
    requirement: FND-04
    verification:
      - kind: other
        ref: "dotnet run --project tools/Csps.DevSeed -- --reset (exit 0, '[100] SiteSettings' line); dotnet run --project tools/Csps.DevSeed (exit 0); --connection 'Server=(localdb)\\CSPS;Database=BetsLLC_Dev;...' (exit 2, 'Refused: ...'); --bogus (exit 64)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Dev-seed target guard: allows only CSPS_Dev/CSPS_E2E (case-insensitive); refuses near-misses, CSPS_Test_<guid>, CSPS_Legacy_Restore, BetsLLC_Dev, master, MSSQLLocalDB, AttachDBFilename, empty/missing catalog, empty and unparseable strings; never echoes the connection string"
    requirement: FND-04
    verification:
      - kind: unit
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedTargetGuardTests.cs (23 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Seed runner and SiteSettings step: restores every default and reports changed; second run unchanged with identical RowVersion; recreates a missing row; ascending Order; duplicate Order throws before any step runs; business name byte-exact; CLI option parsing"
    requirement: FND-04
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs (6 tests), DevSeedOptionsTests.cs (12 cases)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Content/SiteSettingsTests.cs (ResetToSeedDefaults: 10 cases); coverlet.MTP over Csps.Domain line-rate 1, branch-rate 1 (temporary reference, reverted)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Migration verification: each migration applies on top of its predecessor from empty; idempotent script applies twice at compat 160 and 170 with no new history row and the seeded row untouched; one transaction per migration; no pending model changes; no JSON mapping, primitive collection or json type"
    requirement: FND-12
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs (6 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Startup safety: no src/ file calls migrate/ensure-created/ensure-deleted/IMigrator/IRelationalDatabaseCreator or uses the seeding types outside Infrastructure/Seeding; Csps.Server never depends on Persistence, Seeding or EF Core"
    requirement: FND-01
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/StartupSafetyTests.cs (2 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Fixture hardening: concurrent CreateAsync gives distinct, migrated, disposable databases that are both dropped; Respawn reset empties user tables and keeps __EFMigrationsHistory and the SiteSettings row; cleanup script lists only aged CSPS_Test_<guid> names on (localdb)\\CSPS under -WhatIf"
    requirement: FND-11
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Fixture/SqlFixtureTests.cs (2 tests)"
        status: pass
      - kind: other
        ref: "powershell -File tools/scripts/Remove-StaleTestDatabases.ps1 -WhatIf (exit 0); with a 69 s old probe and -OlderThanMinutes 1 it listed only that probe"
        status: pass
    human_judgment: false
  - id: D7
    description: "FND-12 concurrency edge: an interrupted production apply of the idempotent script leaves the database at the last committed migration and a re-run completes it"
    requirement: FND-12
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs#IdempotentScriptWrapsEachMigrationInItsOwnTransaction"
        status: pass
    human_judgment: true
    rationale: "Backstop truth: the test proves the script shape (one transaction per migration), not an actual interrupted apply; only one migration exists today"

# Metrics
duration: 29min
completed: 2026-10-07
status: complete
---

# Phase 1 Plan 04: Guarded Dev Seed, Migration Verification and Fixture Hardening Summary

**One explicit command, `dotnet run --project tools/Csps.DevSeed -- --reset`, rebuilds `CSPS_Dev` at the pinned compatibility level 160, migrates it and runs the ordered seed steps (Phase 1: SiteSettings). A pure guard refuses every database except `CSPS_Dev`/`CSPS_E2E` before any connection opens. The idempotent production script is proven to apply twice at compat 160 and 170. An architecture test fails the build if anything in `src/` migrates or seeds. Test databases now reset with Respawn, stay isolated under concurrency, and leftovers can be cleaned with a regex-guarded, age-filtered script.**

## Performance

- **Duration:** 29 min
- **Started:** 2026-10-07T14:37:38Z
- **Completed:** 2026-10-07T15:06:37Z
- **Tasks:** 3 (Task 1 tracer, then Tasks 2 and 3)
- **Files modified:** 22 (18 created, 4 modified; one is the generated `packages.lock.json`)

## Accomplishments

- **Dev seed (FND-04, D-08, D-30).** `tools/Csps.DevSeed` parses its options (exit 64 on a usage error), then runs `DevSeedTargetGuard.Check` on the final connection string; a refusal exits 2 with `Refused: <reason>` on stderr. Next it drops the database (only with `--reset`), creates it when missing, pins it to `SqlCompatibility.Level`, migrates, runs `DevSeeder(DevSeedSteps.All, TimeProvider.System)` and prints one line per step. `CSPS_Dev` is now at 160 (it was 170).
- **Seed framework.** `ISeedStep` (Order, Name, `RunAsync` returning "changed"). `DevSeeder` rejects duplicate Order values before any step runs, runs steps ascending and saves after each one. `SiteSettingsSeedStep` (Order 100) recreates a missing row with `CreateDefault` or calls the new `SiteSettings.ResetToSeedDefaults`, which compares ordinally and writes nothing when the row already matches, so the RowVersion stays the same.
- **Migration verification (FND-12, D-13).** Each migration applies on top of its predecessor. The idempotent script, split on `GO`, applies twice at 160 and at 170; the second run adds no history row and leaves the seeded row's RowVersion unchanged. The script has one transaction per migration. `HasPendingModelChanges()` is false. No entity, complex type or property maps to JSON, and the script contains no `json` type.
- **Startup safety (FND-01, Prime Directive 11).** No `src/` file calls the migrate/ensure-created/ensure-deleted APIs, `IMigrator` or `IRelationalDatabaseCreator`, or uses the seeding types outside `Infrastructure/Seeding`. `Csps.Server` depends on no `Persistence`, `Seeding` or EF Core type (ArchUnitNET), and its compiled assembly references no EF assembly (reflection backstop).
- **Fixture hardening (FND-11, D-05, D-07).** `CspsDatabase.ResetAsync()` builds a Respawner lazily and ignores `__EFMigrationsHistory` and `SiteSettings`. `CspsDatabase.CreateEmptyAsync(level)` gives a guarded, unmigrated database. `Remove-StaleTestDatabases.ps1` talks only to `(localdb)\CSPS`, re-checks `^CSPS_Test_[0-9a-f-]{36}$` plus the length in PowerShell before any DDL, skips anything younger than `-OlderThanMinutes` (default 120) and supports `-WhatIf`.

## Task Commits

1. **Task 1 (tracer): guarded dev-seed CLI migrates and seeds CSPS_Dev, refuses every other database**
   - RED: `9432000` (test)
   - GREEN: `7689b1d` (feat)
2. **Task 2: migration verification and startup-safety rules.** Verification tests over existing code, proven by mutation.
   - `4d07086` (test). No production fix was needed.
3. **Task 3: fixture hardening (Respawn reset, concurrent isolation, stale-database cleanup)**
   - RED: `ea001ce` (test)
   - GREEN: `cd52d79` (feat)

**Plan metadata:** recorded in the docs commit for this SUMMARY.

## TDD Evidence

Each RED run was a target-only (or class-only) run with `--report-xunit-junit`, validated by `gsd check tdd-red-evidence`. Every record returned `RED_EVIDENCE_OK` (reason `target_test_failed`).

- **Task 1 RED:** the seeding types were committed as behaviorless stubs, so every failure is an assertion.
  - `DevSeederTests.SeedsSiteSettingsOnMigratedDatabase` failed (exit 2) with `should have single item but had 0 items and was []`.
  - `DevSeedTargetGuardTests` ran 23 of 24 cases failed, for example `check.Reason (null) should not be null or white space` and `should contain "AttachDBFilename"`.
  - `SiteSettingsTests` ran 9 of 13 failed with `settings.ResetToSeedDefaults(ResetAt) should be True but was False`.
  - All DevSeed tests together: 39 of 41 failed.
- **Task 1 GREEN:** DevSeed tests 41/41, Domain 30/30, Architecture 59/59, build 0 warnings, format exit 0.
- **Task 1 tracer gate:** auto mode was on and the task had no `gate` attribute (row 2). The whole tracer `<verify>` was re-run on the final code and passed:
  - DevSeed tests 41/41.
  - `--reset` exit 0, with the `[100] SiteSettings` line.
  - The BetsLLC_Dev refusal exited 2 with `Refused:` on stderr.
  - Tasks 2 and 3 then went ahead.
- **Task 2 (pass on arrival, mutation record):** all 8 tests passed against existing code. Temporary production mutations, each reverted with `git checkout --` or by deleting the probe file, showed that every test discriminates.
  - A. `BusinessName` max length +1: `ModelHasNoPendingChanges` failed with `HasPendingModelChanges() should be False`. `EachMigrationAppliesOnTopOfItsPredecessor` also failed, because EF refused to migrate with `PendingModelChangesWarning`.
  - B. `migrationBuilder.Sql("CREATE TRIGGER ...")` appended to `InitialCreate.Up` (Pitfall 3): `IdempotentScriptAppliesTwice(160)` and `(170)` both failed with `Incorrect syntax near the keyword 'TRIGGER'`. `MigrateAsync` alone is unaffected.
  - C. A nullable `List<string>? Tags` property on SiteSettings: `ModelHasNoJsonMappings` failed with `["SiteSettings.Tags is a primitive collection (stored as JSON)"]`. A non-nullable first attempt failed on HasData validation instead, so it was redone as nullable to reach the assertion.
  - D. A `src/Csps.Infrastructure/MutationStartupMigrator.cs` calling `db.Database.Migrate()`: `SourceNeverMigratesOrSeeds` failed with `Csps.Infrastructure\MutationStartupMigrator.cs: Migrate(`.
  - E. A `src/Csps.Server/MutationProbe.cs` with `typeof(CspsDbContext)`: `ServerDoesNotUseEfOrPersistence` failed with `Csps.Server.MutationProbe does depend on "Csps.Infrastructure.Persistence.CspsDbContext"`, but only after Deviation 2. The first rule form passed under this mutation.
  - Evidence records for A+B (class `MigrationScriptTests`), C (`ModelHasNoJsonMappings`) and D+E (class `StartupSafetyTests`) returned `RED_EVIDENCE_OK`.
- **Task 3 RED:** with `ResetAsync` as a no-op stub, `ResetClearsUserTablesKeepsHistoryAndSettings` failed on the RespawnProbe count, so `RED_EVIDENCE_OK`. `ConcurrentDatabasesAreDistinctAndMigrated` passed on arrival, because plan 02's fixture already isolates, so a mutation proves it discriminates. With `DisposeAsync` skipping the drop, it failed with `CSPS_Test_928272b2-... must be dropped on dispose.` (`RED_EVIDENCE_OK`). The two databases that mutation leaked were then dropped through the guarded regex.
- **Task 3 GREEN:** SqlFixtureTests 2/2, the whole Infrastructure integration suite 88/88, and the cleanup script with `-WhatIf` exited 0.
- **REFACTOR:** none needed.

## TDD Gate Compliance

- Task 1 has `test(01-04)` `9432000` before `feat(01-04)` `7689b1d`.
- Task 3 has `test(01-04)` `ea001ce` before `feat(01-04)` `cd52d79`.
- Task 2 is a verification-only task with a `test(01-04)` commit (`4d07086`) and no `feat`. The plan says a `feat` commit is needed only if a production fix is found, and none was. Its discrimination is shown by the mutation record above.

## Plan Verification

- Preflight was clean before every test run and before the full run: ports 5180/5115/7028/5199 free, and no dev/test processes from TheBETSLLC.
- `dotnet build Csps.slnx -tl:off`: 0 warnings, 0 errors.
- `dotnet test --solution Csps.slnx`: **187/187 passed**. That is Domain 30, Architecture 61, Infrastructure integration 88 and Server integration 8.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- Domain coverage with a temporary `coverlet.MTP` reference (reverted): `Csps.Domain` line-rate 1, branch-rate 1, including `SiteSettings`.
- Afterwards `(localdb)\CSPS` holds only `CSPS_Dev`, at compatibility level 160.

## Files Created/Modified

- `tools/Csps.DevSeed/Csps.DevSeed.csproj`, `Program.cs`: the guarded CLI. Exit codes are 0 done, 1 failed, 2 refused, 64 usage. It creates the database, pins its compat level, migrates and seeds.
- `src/Csps.Infrastructure/Seeding/ISeedStep.cs`, `SeedStepResult.cs`, `DevSeeder.cs`, `DevSeedSteps.cs`, `SiteSettingsSeedStep.cs`: the seed framework and the Phase 1 step.
- `src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs`, `DevSeedTargetCheck.cs`: the pure CSPS_Dev/CSPS_E2E guard and its verdict record.
- `src/Csps.Infrastructure/Seeding/DevSeedOptions.cs`: CLI parsing, with a `DefaultConnectionString` for `CSPS_Dev` on `(localdb)\CSPS`.
- `src/Csps.Domain/Content/SiteSettings.cs`: adds `ResetToSeedDefaults(DateTimeOffset)`.
- `tests/Csps.Testing/CspsDatabase.cs`: adds `CreateEmptyAsync(int)` (range 100 to 170) and `ResetAsync()` (Respawn).
- `tests/.../Seeding/*Tests.cs`, `Persistence/MigrationScriptTests.cs`, `Fixture/SqlFixtureTests.cs`, `tests/Csps.ArchitectureTests/StartupSafetyTests.cs`, `tests/Csps.Domain.UnitTests/Content/SiteSettingsTests.cs`: the new tests.
- `tools/scripts/Remove-StaleTestDatabases.ps1`: the safe stale-database cleanup.
- `Csps.slnx`: adds the `/tools/` folder with `tools/Csps.DevSeed/Csps.DevSeed.csproj`.

## Decisions Made

- **CSPS_Dev compat level:** the CLI creates the database itself (`IRelationalDatabaseCreator`), then runs `ALTER DATABASE CURRENT SET COMPATIBILITY_LEVEL = 160` before `MigrateAsync`. This closes the 01-02 note (CSPS_Dev was at 170). `ALTER DATABASE` takes no parameters, so one `EF1003` pragma covers the splice of the compile-time int constant.
- **Usage errors** are `ArgumentException`, so no new exception type is needed. Flags are case-sensitive. `--database` with `--connection`, repeated flags, and flags with a missing or blank value are all rejected.
- **Guard details:** refusal reasons name the database but never repeat the connection string (a test checks that a password and host are absent). `master` and any other catalog are refused on any server, so a CI container's `CSPS_E2E` works while a hosted database cannot be targeted unless it is literally named `CSPS_Dev`/`CSPS_E2E`. Unquoted values are trimmed by `SqlConnectionStringBuilder`, so `Database= CSPS_Dev` really names `CSPS_Dev` and is allowed; that case was dropped from the near-miss list.
- **ResetToSeedDefaults** clears `UpdatedByUserId` when it stamps, because the seed is not a user.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Dev seed pins the database to the project's compatibility level**
- **Found during:** Task 1 (01-02 note: CSPS_Dev at 170 while EF and the test databases use 160)
- **Issue:** `MigrateAsync` creates a database at the server default (170), so `--reset` would rebuild the dev database at a different level from EF's SQL, the tests and the D-13 pin.
- **Fix:** the CLI creates the database when it is missing, sets `COMPATIBILITY_LEVEL = SqlCompatibility.Level`, then migrates. It does this on every run, which is idempotent.
- **Files modified:** tools/Csps.DevSeed/Program.cs
- **Verification:** `--reset` printed `Migrated CSPS_Dev (compatibility level 160)`, and `sys.databases` shows `CSPS_Dev 160`.
- **Committed in:** `7689b1d`

**2. [Rule 1 - Bug] The Server dependency rule did not discriminate**
- **Found during:** Task 2 (mutation E)
- **Issue:** `NotDependOnAny(Types().That().ResideInNamespaceMatching(...))` evaluates only types loaded into the architecture (just Csps.Server). A Server type using `CspsDbContext` passed.
- **Fix:** `NotDependOnAnyTypesThat().ResideInNamespaceMatching("^(Csps\.Infrastructure\.(Persistence|Seeding)|Microsoft\.EntityFrameworkCore)(\..+)?$")`, plus a reflection check that `Csps.Server` references no `Microsoft.EntityFrameworkCore*` assembly.
- **Files modified:** tests/Csps.ArchitectureTests/StartupSafetyTests.cs
- **Verification:** the `typeof` and the method-parameter mutations both fail the rule. On clean code it passes.
- **Committed in:** `4d07086`

**3. [Rule 2 - Missing critical] Extra tests and two small result types beyond the plan's file list**
- **Found during:** Tasks 1 and 2
- **Additions:**
  - `SeedStepResult.cs` and `DevSeedTargetCheck.cs`: the result records the plan describes, each in its own file.
  - Tests: `BusinessNameRoundTripsByteExact` (the FND-04 precision edge, explicit), `ReasonNeverEchoesTheConnectionString` (CWE-532), `ResetToSeedDefaultsComparesOrdinally`, the repeated-flag and both-targets usage errors, the CI-container-style `CSPS_E2E` allow case and the `master` refusal.
  - `IdempotentScriptWrapsEachMigrationInItsOwnTransaction`: an automated backstop for the FND-12 concurrency truth. MigrationScriptTests therefore has 6 cases, against the plan's 5.
- **Committed in:** `9432000`, `7689b1d`, `4d07086`

---

**Total deviations:** 3 auto-fixed (1 bug, 2 missing-critical).
**Impact on plan:** all three keep the plan's intent. The only behavior beyond the plan is the compat-level pin in the dev-seed tool, which makes the dev database match D-13.

## Issues Encountered

- **Hung helper processes (my own):** during the work, two of my shell helpers hung:
  - A `python -` heredoc, used to strip a pragma, waited on stdin.
  - A `sqlcmd` call inside a `while read` loop consumed the loop's stdin and retried one name.

  Each time I identified the process by its command line and start time as mine and stopped only that process. No other project's processes were touched. Later `sqlcmd` calls run with `< /dev/null`.
- **Mutation leak:** the Task 3 no-drop mutation left two `CSPS_Test_<guid>` databases. Both were dropped after the exact regex and length check passed. The probe database used to exercise the cleanup script's `-WhatIf` listing was removed the same way. Per the plan, the cleanup script itself was run only with `-WhatIf`.
- **FND-11 flagged assumption:** LocalDB handled default xUnit class-level parallelism. That covered 88 Infrastructure tests including concurrent `CreateAsync`, and 187 tests across the solution, with no CREATE DATABASE contention. No thread cap was needed.

## User Setup Required

None. Developers run `dotnet run --project tools/Csps.DevSeed -- --reset` to rebuild `CSPS_Dev`. The command needs `(localdb)\CSPS`, which `tools/scripts/Initialize-LocalDb.ps1` creates.

## Next Phase Readiness

- Later phases add their seed steps as `ISeedStep` classes with new unique Orders, appended to `DevSeedSteps.All`: users in Phase 4, company expenses in 6, orders in 7 and the price list in 11. Tests for them belong on a `CspsDatabase` fixture, as in `DevSeederTests`. FND-04 is "established; extended per phase" (D-30).
- Plan 09 (AuditLog) must add `AuditLog` and `AuditLogTruncateGuard` to `CspsDatabase.ResetAsync`'s `TablesToIgnore` (Pitfall 1). Its trigger DDL must be wrapped in `EXEC(N'...')`; `IdempotentScriptAppliesTwice` fails otherwise, as mutation B showed.
- Plan 13 (FND-13 re-pin): if the host's verified level differs, change `SqlCompatibility.Level`, add that level to `IdempotentScriptAppliesTwice`'s InlineData, and re-run the dev seed so it re-pins `CSPS_Dev`.

## Self-Check: PASSED

- All 18 created and 4 modified key files exist on disk.
- Commits `9432000`, `7689b1d`, `4d07086`, `ea001ce` and `cd52d79` exist on `gsd/phase-1-hosting-verification-backend-foundation`. That is 5 commits since `plan_head_before`.
- Acceptance criteria for Tasks 1–3 were re-run and pass: the MSSQLLocalDB/CSPS_E2E greps in the guard, the slnx entry, `Refused:` on stderr, the `MigrationsSqlGenerationOptions.Idempotent` grep, and the script's `(localdb)\CSPS`/`OlderThanMinutes`/`SupportsShouldProcess` greps.
- Plan verification: build 0 warnings, 187/187 tests, format exit 0, no leftover test databases.

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*
