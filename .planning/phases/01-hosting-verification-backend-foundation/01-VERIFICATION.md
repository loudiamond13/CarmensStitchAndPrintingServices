---
phase: 01-hosting-verification-backend-foundation
verified: 2026-10-07T23:38:06Z
created: 2026-10-07T17:02:13-05:00
updated: 2026-10-07T18:38:06-05:00
status: passed
score: 19/23 must-haves verified; 4 non-inferable backstops owner-accepted (UAT 5-8); 1 override applied
covered_files:
  - ".config/dotnet-tools.json"
  - ".editorconfig"
  - ".gitignore"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-01-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-01-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-02-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-02-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-03-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-03-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-04-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-04-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-05-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-05-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-06-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-06-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-07-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-07-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-08-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-08-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-09-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-09-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-10-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-10-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-11-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-11-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-12-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-12-SUMMARY.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-13-PLAN.md"
  - ".planning/phases/01-hosting-verification-backend-foundation/01-13-SUMMARY.md"
  - "BannedSymbols.txt"
  - "Csps.slnx"
  - "Directory.Build.props"
  - "Directory.Packages.props"
  - "THIRD-PARTY-NOTICES.md"
  - "docs/allowed-licenses.json"
  - "docs/dependencies.json"
  - "docs/dependencies.md"
  - "docs/development.md"
  - "docs/license-exceptions.json"
  - "docs/operations/audit-log.md"
  - "docs/operations/data-protection-rotation.md"
  - "global.json"
  - "src/Csps.Application/AssemblyMarker.cs"
  - "src/Csps.Application/Content/GetSiteSettingsHandler.cs"
  - "src/Csps.Application/Content/SiteSettingsDto.cs"
  - "src/Csps.Application/Content/SiteSettingsSnapshot.cs"
  - "src/Csps.Application/Csps.Application.csproj"
  - "src/Csps.Application/Ports/IAuditTrail.cs"
  - "src/Csps.Application/Ports/IBusinessCalendar.cs"
  - "src/Csps.Application/Ports/IRequestContext.cs"
  - "src/Csps.Application/Ports/ISiteSettingsCache.cs"
  - "src/Csps.Application/Ports/ISiteSettingsReader.cs"
  - "src/Csps.Application/Security/Policies.cs"
  - "src/Csps.Application/Security/Roles.cs"
  - "src/Csps.Domain/AssemblyMarker.cs"
  - "src/Csps.Domain/Auditing/AuditEntry.cs"
  - "src/Csps.Domain/Auditing/IpPrefix.cs"
  - "src/Csps.Domain/Auditing/UserAgentFamily.cs"
  - "src/Csps.Domain/Common/Error.cs"
  - "src/Csps.Domain/Common/ErrorKind.cs"
  - "src/Csps.Domain/Common/Result.cs"
  - "src/Csps.Domain/Content/SiteSettings.cs"
  - "src/Csps.Domain/Content/SiteSettingsDefaults.cs"
  - "src/Csps.Domain/Csps.Domain.csproj"
  - "src/Csps.Domain/Time/BusinessClock.cs"
  - "src/Csps.Domain/Time/TimeZoneResolver.cs"
  - "src/Csps.Domain/Time/ZoneSource.cs"
  - "src/Csps.Infrastructure/AssemblyMarker.cs"
  - "src/Csps.Infrastructure/Auditing/AuditLogAppendOnlyInterceptor.cs"
  - "src/Csps.Infrastructure/Auditing/AuditTrail.cs"
  - "src/Csps.Infrastructure/Content/SiteSettingsReader.cs"
  - "src/Csps.Infrastructure/Csps.Infrastructure.csproj"
  - "src/Csps.Infrastructure/DataProtection/CertificateLoader.cs"
  - "src/Csps.Infrastructure/DataProtection/DataProtectionRegistration.cs"
  - "src/Csps.Infrastructure/DataProtection/DataProtectionSettings.cs"
  - "src/Csps.Infrastructure/DependencyInjection.cs"
  - "src/Csps.Infrastructure/Health/DatabaseHealthCheck.cs"
  - "src/Csps.Infrastructure/Health/TimeZoneHealthCheck.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/AuditEntryConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/DataProtectionKeyConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/SiteSettingsConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/CspsDbContext.cs"
  - "src/Csps.Infrastructure/Persistence/CspsDbContextOptions.cs"
  - "src/Csps.Infrastructure/Persistence/CspsDesignTimeDbContextFactory.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261007140149_InitialCreate.Designer.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261007140149_InitialCreate.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261007165906_AddAuditLog.Designer.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261007165906_AddAuditLog.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261007171939_AddDataProtectionKeys.Designer.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261007171939_AddDataProtectionKeys.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs"
  - "src/Csps.Infrastructure/Persistence/SqlCompatibility.cs"
  - "src/Csps.Infrastructure/Seeding/DevSeedOptions.cs"
  - "src/Csps.Infrastructure/Seeding/DevSeedSteps.cs"
  - "src/Csps.Infrastructure/Seeding/DevSeedTargetCheck.cs"
  - "src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs"
  - "src/Csps.Infrastructure/Seeding/DevSeeder.cs"
  - "src/Csps.Infrastructure/Seeding/ISeedStep.cs"
  - "src/Csps.Infrastructure/Seeding/SeedStepResult.cs"
  - "src/Csps.Infrastructure/Seeding/SiteSettingsSeedStep.cs"
  - "src/Csps.Infrastructure/Time/BusinessCalendar.cs"
  - "src/Csps.Server/Composition/ApplicationRegistration.cs"
  - "src/Csps.Server/Composition/JwtOptions.cs"
  - "src/Csps.Server/Composition/LoggingRegistration.cs"
  - "src/Csps.Server/Composition/OpenApiRegistration.cs"
  - "src/Csps.Server/Composition/SecurityRegistration.cs"
  - "src/Csps.Server/Csps.Server.csproj"
  - "src/Csps.Server/Endpoints/ApiRouting.cs"
  - "src/Csps.Server/Endpoints/HealthEndpoint.cs"
  - "src/Csps.Server/Endpoints/SiteSettingsEndpoints.cs"
  - "src/Csps.Server/Http/CorrelationId.cs"
  - "src/Csps.Server/Http/CspsProblemDetails.cs"
  - "src/Csps.Server/Http/HttpRequestContext.cs"
  - "src/Csps.Server/Http/MinimalHealthWriter.cs"
  - "src/Csps.Server/Http/PlainEnglish.cs"
  - "src/Csps.Server/Http/ResultHttpExtensions.cs"
  - "src/Csps.Server/Http/SecurityHeadersMiddleware.cs"
  - "src/Csps.Server/Logging/LogFileSettings.cs"
  - "src/Csps.Server/Logging/SensitiveDataDestructuringPolicy.cs"
  - "src/Csps.Server/Logging/SensitiveDataMasking.cs"
  - "src/Csps.Server/Logging/SensitiveDataMaskingEnricher.cs"
  - "src/Csps.Server/Program.cs"
  - "src/Csps.Server/Properties/launchSettings.json"
  - "src/Csps.Server/appsettings.Development.json"
  - "src/Csps.Server/appsettings.json"
  - "src/Csps.Server/web.config"
  - "tests/Csps.Application.UnitTests/Content/GetSiteSettingsHandlerTests.cs"
  - "tests/Csps.Application.UnitTests/Csps.Application.UnitTests.csproj"
  - "tests/Csps.ArchitectureTests/BuildConfigTests.cs"
  - "tests/Csps.ArchitectureTests/Csps.ArchitectureTests.csproj"
  - "tests/Csps.ArchitectureTests/DependencyRegistry.cs"
  - "tests/Csps.ArchitectureTests/DependencyRegistryTests.cs"
  - "tests/Csps.ArchitectureTests/ForwardedHeadersTests.cs"
  - "tests/Csps.ArchitectureTests/HostingRecordTests.cs"
  - "tests/Csps.ArchitectureTests/LayerTests.cs"
  - "tests/Csps.ArchitectureTests/PackagePins.cs"
  - "tests/Csps.ArchitectureTests/RepoRoot.cs"
  - "tests/Csps.ArchitectureTests/SolutionLayoutTests.cs"
  - "tests/Csps.ArchitectureTests/StartupSafetyTests.cs"
  - "tests/Csps.Domain.UnitTests/Auditing/AuditEntryTests.cs"
  - "tests/Csps.Domain.UnitTests/Auditing/IpPrefixTests.cs"
  - "tests/Csps.Domain.UnitTests/Auditing/UserAgentFamilyTests.cs"
  - "tests/Csps.Domain.UnitTests/Common/ErrorTests.cs"
  - "tests/Csps.Domain.UnitTests/Common/ResultTests.cs"
  - "tests/Csps.Domain.UnitTests/Content/SiteSettingsTests.cs"
  - "tests/Csps.Domain.UnitTests/Csps.Domain.UnitTests.csproj"
  - "tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs"
  - "tests/Csps.Domain.UnitTests/Time/TimeZoneResolverTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogAppendOnlyTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditLogSql.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Auditing/AuditTrailTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Auditing/FixedRequestContext.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Content/SiteSettingsReaderTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Csps.Infrastructure.IntegrationTests.csproj"
  - "tests/Csps.Infrastructure.IntegrationTests/Fixture/CspsDatabaseTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Fixture/SqlBackendTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Fixture/SqlFixtureTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Fixture/TestDatabaseNameTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedOptionsTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedTargetGuardTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeederTests.cs"
  - "tests/Csps.Infrastructure.IntegrationTests/Time/BusinessCalendarTests.cs"
  - "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationCoverage.cs"
  - "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationCoverageTests.cs"
  - "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationFailureTests.cs"
  - "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs"
  - "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs"
  - "tests/Csps.Server.IntegrationTests/Content/SiteSettingsEndpointTests.cs"
  - "tests/Csps.Server.IntegrationTests/Csps.Server.IntegrationTests.csproj"
  - "tests/Csps.Server.IntegrationTests/Health/HealthBody.cs"
  - "tests/Csps.Server.IntegrationTests/Health/HealthEndpointFailureTests.cs"
  - "tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs"
  - "tests/Csps.Server.IntegrationTests/Http/ApiRequests.cs"
  - "tests/Csps.Server.IntegrationTests/Http/CspsProblemDetailsTests.cs"
  - "tests/Csps.Server.IntegrationTests/Http/HttpRequestContextTests.cs"
  - "tests/Csps.Server.IntegrationTests/Http/OpenApiExposureTests.cs"
  - "tests/Csps.Server.IntegrationTests/Http/ProblemDetailsTests.cs"
  - "tests/Csps.Server.IntegrationTests/Http/ProblemJson.cs"
  - "tests/Csps.Server.IntegrationTests/Http/ResultHarness.cs"
  - "tests/Csps.Server.IntegrationTests/Http/ResultHttpExtensionsTests.cs"
  - "tests/Csps.Server.IntegrationTests/Http/SecurityHeadersTests.cs"
  - "tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs"
  - "tests/Csps.Server.IntegrationTests/Logging/LogEvents.cs"
  - "tests/Csps.Server.IntegrationTests/Logging/LogFileTests.cs"
  - "tests/Csps.Server.IntegrationTests/Logging/RequestLoggingTests.cs"
  - "tests/Csps.Server.IntegrationTests/Logging/SensitiveDataMaskingTests.cs"
  - "tests/Csps.Server.IntegrationTests/Security/DataProtectionTests.cs"
  - "tests/Csps.Testing/CollectingSink.cs"
  - "tests/Csps.Testing/Csps.Testing.csproj"
  - "tests/Csps.Testing/CspsApiFactory.cs"
  - "tests/Csps.Testing/CspsDatabase.cs"
  - "tests/Csps.Testing/InMemoryXmlRepository.cs"
  - "tests/Csps.Testing/SqlBackend.cs"
  - "tests/Csps.Testing/SqlServerInstance.cs"
  - "tests/Csps.Testing/TestCertificates.cs"
  - "tests/Csps.Testing/TestDatabaseName.cs"
  - "tests/Csps.Testing/TestJwt.cs"
  - "tests/Csps.Testing/TestTokens.cs"
  - "tests/Directory.Build.props"
  - "tools/Csps.DevSeed/Csps.DevSeed.csproj"
  - "tools/Csps.DevSeed/Program.cs"
  - "tools/Csps.HostProbe/Csps.HostProbe.csproj"
  - "tools/Csps.HostProbe/HostFacts.cs"
  - "tools/Csps.HostProbe/ProbeKey.cs"
  - "tools/Csps.HostProbe/Program.cs"
  - "tools/Csps.HostProbe/README.md"
  - "tools/Csps.HostProbe/appsettings.json"
  - "tools/scripts/Initialize-DevSecrets.ps1"
  - "tools/scripts/Initialize-LocalDb.ps1"
  - "tools/scripts/Invoke-CoverageGate.ps1"
  - "tools/scripts/New-ThirdPartyNotices.ps1"
  - "tools/scripts/Remove-StaleTestDatabases.ps1"
covered_digest: "v2:sha256:16f34eb2f8a8a0bd176efa9e9c9cc31b67919bfa2f6f9104f87ecd4491f100f2"
behavior_unverified: 0
insufficient_spec: 4
insufficient_spec_resolution: "Owner accepted the existing structural backstops in 01-UAT.md tests 5, 6 and 8 (no new held-out tests); FND-07 two-process append to be observed on the host at the Phase 3 first deploy (UAT test 7)"
overrides_applied: 1
overrides:
  - must_have: "MUST NOT admit any dependency or tool whose license costs money, is proprietary, or is GPL/AGPL/SSPL"
    reason: "Two free Microsoft runtime parts of Microsoft.Data.SqlClient (SNI.runtime 6.0.2, Identity.Client.NativeInterop 0.20.6) ship unmodified under an exact-version exception (docs/license-exceptions.json); QUAL-06 allows owner-approved exceptions"
    accepted_by: "owner"
    accepted_at: "2026-10-07T18:40:00-05:00"
re_verification:
  previous_status: human_needed
  previous_score: 16/23 must-haves verified (4 abstained as insufficient_spec, 3 need a human)
  reason: "Previous report went stale: quick 261007-p98 changed covered files (DevSeedTargetGuard.cs, DevSeedTargetCheck.cs, tools/Csps.DevSeed/Program.cs, DevSeedTargetGuardTests.cs, docs/development.md)"
  gaps_closed:
    - "01-04 test-tier prohibition (dev seed never touches MSSQLLocalDB or a hosted DB): WR-04 bypasses closed by the server allow-list and Failover Partner refusal; re-verified by the verifier's own test run and CLI refusals"
    - "Truth 16 (hosting record): owner accepted the Unverified facts (UAT 3); in-process hosting now Verified"
    - "Truth 22 (local full-stack run): observed in UAT test 1 (200, all three checks Healthy)"
    - "Truth 23 (Scalar CSP): observed in UAT test 2 (zero CSP violations; 'unsafe-inline' for styles must stay)"
    - "Provisional compatibility pin: ROADMAP 01-13 line and Phase 17 success criterion 1 now track the re-pin (UAT 4)"
  gaps_remaining: []
  regressions: []
deferred:
  - truth: "Integration tests run against Testcontainers SQL Server 2025 in CI (CSPS_TEST_SQL=container); the container path exists but has never run (no CI yet, and Docker is never used locally per D-07)"
    addressed_in: "Phase 3"
    evidence: "Phase 3 success criterion 1: the PR merge gate runs '3. unit, integration and architecture tests' and '6. coverage gates and generated THIRD-PARTY-NOTICES'"
  - truth: "Hosting record probe facts (runtime patch, content root, logs writable, client-IP/proxy topology, HTTPS termination, Manila/en-PH, PFX EphemeralKeySet, app-pool memory) and the FND-07 two-process log append are observed at the first real deploy"
    addressed_in: "Phase 3"
    evidence: "Owner acceptance in 01-UAT.md tests 3 and 7; Phase 3 success criterion 4 covers the first served deployment"
  - truth: "Hosting record facts DKIM and 'SPF / DKIM / DMARC pass in Gmail' are Unverified"
    addressed_in: "Phase 4 / Phase 17"
    evidence: "Phase 4 owner prerequisites: 'DNS access to publish SPF/DKIM/DMARC, if Phase 1 didn't finish it'; Phase 17 success criterion 1: 'SPF/DKIM/DMARC passing on the sender domain'"
  - truth: "SqlCompatibility.Level stays at the provisional 160; the host's own level is Unverified"
    addressed_in: "Phase 17"
    evidence: "ROADMAP Phase 17 success criterion 1: 'a SQL Server 2025 database created ... Its compatibility level is verified, SqlCompatibility.Level is re-pinned from the provisional 160 to that level (170 expected), and MigrationScriptTests is re-run at the new pin'"
  - truth: "QUAL-03 web thresholds (lib/http 100%, web >= 90%) cannot exist before web/ exists"
    addressed_in: "Phase 2 / Phase 3"
    evidence: "Phase 2 success criterion 4: '`httpClient.ts` has 100% coverage'; Phase 3 success criterion 1 step 4: 'Vitest with coverage' and step 6 'coverage gates'"
  - truth: "FND-04 seed steps for users (both roles), orders with children, company expenses and price list (D-30)"
    addressed_in: "Phases 4-11 (each entity's phase)"
    evidence: "ROADMAP Conventions, 'Pieces that grow': 'the dev seed (FND-04)' is set up once, then extended by every later phase for its own entities"
---

# Phase 1: Hosting Verification & Backend Foundation Verification Report

**Phase Goal:** A developer can clone the repo and run a zero-warning onion API against an empty, EF-migrated `CSPS_` database. The API carries the platform contract (ProblemDetails, health, logging, security headers, default-deny authorization) and the shared primitives every slice needs (business calendar, SiteSettings core, append-only audit log, SQL test fixture). A verified record of the SmarterASP.NET hosting facts sits alongside it.
**Verified:** 2026-10-07T23:38:06Z
**Status:** passed
**Re-verification:** Yes. The previous report (`human_needed`, 16/23) went stale when quick task 261007-p98 changed covered files to fix code-review WR-04. All 11 human items from that report are resolved in `01-UAT.md` (status complete, 11/11 pass).

> **MVP-mode discrepancy (unchanged).** ROADMAP marks Phase 1 `**Mode:** mvp`, but the goal is not a user story, so no User Flow Coverage table was produced. The standard goal-backward verification below was done in full.

## What changed since the last run

`git diff 25cd9e8 HEAD` outside `.planning/` touches only these files:
- `src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs`, `DevSeedTargetCheck.cs`
- `tools/Csps.DevSeed/Program.cs` (comment only)
- `tests/Csps.Infrastructure.IntegrationTests/Seeding/DevSeedTargetGuardTests.cs`
- `docs/development.md` (step 5 server rule)
- `.gitignore` (adds `.gsd/` and `.planning/milestone.lock`)
- the owner/orchestrator docs: `CLAUDE.md` (now tracked), `.claude/CLAUDE.md`, `CSPS-PRD.md`, `CSPS-UI-SPEC.md`

No file in Domain, Application or Server changed, and no csproj, package pin or migration changed. The changed source files got a full re-check. Everything else got a regression check: a full rebuild, one full test run, a format check and a LocalDB state check.

## Independent evidence gathered by the verifier (this run)

The preflight was clean: ports 5180/5115/7028/5199 free, no dev/test processes, and TheBETSLLC's `BetsLLC_*` databases untouched on `MSSQLLocalDB`. Every run used `(localdb)\CSPS`, with `CSPS_TEST_SQL=localdb` set for that one process only.

| Check | Command | Result |
|-------|---------|--------|
| Zero-warning build (forced full rebuild) | `dotnet build Csps.slnx -tl:off --no-incremental` | **0 Warning(s), 0 Error(s)** |
| Full suite (run once) | `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx --no-build` | **526/526 passed**, 0 failed, 0 skipped (501 last time; the extra 25 are the new guard cases) |
| Format | `dotnet format Csps.slnx --verify-no-changes --no-restore` | exit 0 |
| Guard refuses a hosted server | `dotnet run --project tools/Csps.DevSeed -- --reset --connection "Server=sql1234.site4now.invalid;Database=CSPS_E2E;..."` | exit 2, fixed reason; no host or password echoed |
| Guard refuses a Failover Partner | `... --connection "Server=(localdb)\CSPS;Failover Partner=sql1234.site4now.invalid;Database=CSPS_Dev;..."` | exit 2, Failover Partner reason |
| Guard refuses the shared instance | `... --connection "Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;..."` | exit 2, server reason |
| LocalDB state (read-only) | `sqlcmd` on `(localdb)\CSPS` | `CSPS_Dev` and `CSPS_E2E` at level 160; **no leftover `CSPS_Test_` databases** after the suite |
| Coverage gate | not re-run | Domain and Application are byte-identical to the last run, which passed at 100%/100%/100% and failed as expected at threshold 101. Re-running would mean a second full test run |

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: from a fresh clone with no `.bak`, `dotnet ef database update` builds the full schema on an empty `CSPS_` LocalDB database, and the dev seed makes it usable | ✓ VERIFIED | `MigrationTests` pass, CSPS_Dev and CSPS_E2E are migrated at level 160, and `DevSeederTests` pass. `DevSeedTargetGuardTests` (49 cases) pass, including `AllowsTheServerTheTestFixtureUses`, which proves the tightened guard still accepts the real `(localdb)\CSPS` connection string. The 01-11 SUMMARY records the fresh-clone run |
| 2 | SC1: the idempotent migration script applies twice without error at the host's compatibility level | ✓ VERIFIED (provisional pin, deferred re-pin) | `MigrationScriptTests` pass at 160 and 170, and the previous run also applied it at 150. The re-pin is now tracked in ROADMAP Phase 17 SC1 (UAT 4) |
| 3 | SC2: `Csps.slnx` builds with zero warnings, and the VS scaffold is gone | ✓ VERIFIED | Forced rebuild gave 0/0. `SolutionLayoutTests` pass |
| 4 | SC2: a forbidden layer or package reference, a floating version, or an unrecorded or unvetted package fails the build or the architecture tests | ✓ VERIFIED | `LayerTests`, `BuildConfigTests` and `DependencyRegistryTests` pass. No package or csproj changed |
| 5 | SC2: missing a coverage threshold fails the test run | ✓ VERIFIED | Proven in the previous run (pass at defaults, exit 1 at 101). The inputs (Domain and Application) are unchanged |
| 6 | SC3: `/health` reports liveness, DB reachability and time-zone resolution without exposing internals | ✓ VERIFIED | `HealthEndpointTests` and `HealthEndpointFailureTests` pass. UAT 1 observed a live 200 with all three checks Healthy |
| 7 | SC3: an unknown `/api/*` route returns a ProblemDetails 404 with `traceId`, never `index.html` | ✓ VERIFIED | `ProblemDetailsTests` pass |
| 8 | SC3: every response carries the strict CSP/HSTS header set | ✓ VERIFIED | `SecurityHeadersTests` and `AuthorizationFailureTests` pass |
| 9 | SC3: an endpoint without a policy or a matrix row fails the discovery-driven authorization test | ✓ VERIFIED | `AuthorizationMatrixTests.DiscoveredEndpointsAreFullyCovered` and `AuthorizationCoverageTests` pass |
| 10 | SC4: under a fake clock at Manila boundaries, "today", the month and the year resolve in the business zone | ✓ VERIFIED | `BusinessClockTests` and `BusinessCalendarTests` pass |
| 11 | SC4: SiteSettings are read through a cached port | ✓ VERIFIED | `SiteSettingsReaderTests` and `SiteSettingsEndpointTests` pass (WR-01 is an open warning) |
| 12 | SC4: audit rows can be appended, but DB-level UPDATE and DELETE fail | ✓ VERIFIED | `AuditLogAppendOnlyTests` and `AuditTrailTests` pass |
| 13 | SC4: logs carry a correlation id and mask secrets | ✓ VERIFIED | `RequestLoggingTests` and `SensitiveDataMaskingTests` pass (WR-05 is an open warning) |
| 14 | SC4: Data Protection keys survive an app restart | ✓ VERIFIED | `DataProtectionTests` pass (`KeyRingSurvivesRestart`, `StoredKeyXmlIsEncrypted`, `SecondStartReusesKey`, `RotationKeepsOldKeysReadable`) |
| 15 | SC5: integration tests run in parallel against isolated `CSPS_Test_<guid>` databases with Respawn resets (Testcontainers in CI) | ✓ VERIFIED (LocalDB); container path deferred to Phase 3 | `SqlFixtureTests.ConcurrentDatabasesAreDistinctAndMigrated` passes, and no `CSPS_Test_` databases were left after 526 tests |
| 16 | SC5: the hosting record lists runtime patch, @@VERSION, compat level, collation, in-process hosting, proxy/client-IP topology, SPF/DKIM/DMARC result, scheduler, DB quota and staging option | ✓ VERIFIED (owner-accepted scope) | `HostingRecordTests` pass, and every required fact has a row. In-process hosting is now Verified from the live web.config. The owner accepted the remaining Unverified rows in UAT 3: probe facts at the Phase 3 deploy, DKIM/Gmail before Phase 4 or 17, and the `model` level at Phase 17. Nothing is guessed |
| 17 | (01-02 backstop) An interrupted migration leaves the DB at the last committed migration, and a re-run completes the rest | ⚠️ insufficient_spec, owner-accepted (UAT 5) | Only structural or sequential evidence exists (`EachMigrationAppliesOnTopOfItsPredecessor`). The owner accepted it without a held-out fault-injection test |
| 18 | (01-04 backstop) Each migration in the idempotent script runs in its own transaction | ⚠️ insufficient_spec, owner-accepted (UAT 6) | `IdempotentScriptWrapsEachMigrationInItsOwnTransaction` (structural count) |
| 19 | (01-07 backstop) Two worker processes append to the same daily log file (`shared: true`) | ⚠️ insufficient_spec, owner-accepted (UAT 7) | Only the config value is asserted. It will be observed on the host at the Phase 3 first deploy |
| 20 | (01-08 backstop) Parallel requests with different tokens each get their own row's status | ✓ VERIFIED | `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` passes |
| 21 | (01-10 backstop) Two instances starting together against an empty key ring stay mutually readable | ⚠️ insufficient_spec, owner-accepted (UAT 8) | Only sequential-start tests exist. The owner accepted them |
| 22 | (01-10) The documented local full-stack run serves `/health` with all three checks Healthy | ✓ VERIFIED | UAT 1: Claude's run returned 200 with self, database and time-zone all Healthy. The owner accepted it. The owner's own terminal hit LocalDB error 50, which was environment-specific and recorded in UAT |
| 23 | (01-06) In Development only, `/scalar` uses a nonce carve-out CSP with zero browser CSP violations | ✓ VERIFIED | UAT 2: renders with zero CSP violations. `'unsafe-inline'` for styles is required (Scalar injects non-nonce style tags). `OpenApiExposureTests` prove Production maps neither path |

**Score:** 19/23 truths verified. 0 are present-but-behavior-unverified. 4 non-inferable backstops are insufficient_spec, and the owner accepted each one in `01-UAT.md` with a recorded resolution, so none is left for a human. 1 override was applied (a license prohibition).

### Deferred Items

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Testcontainers SQL Server 2025 backend never exercised | Phase 3 | SC1 PR gate runs unit, integration and architecture tests |
| 2 | Host probe facts and the FND-07 two-process append | Phase 3 | UAT 3 and 7; first served deploy |
| 3 | DKIM and the Gmail SPF/DKIM/DMARC pass | Phase 4 / Phase 17 | Phase 4 prerequisite; Phase 17 SC1 |
| 4 | Re-pin `SqlCompatibility.Level` from the provisional 160 | Phase 17 | Phase 17 SC1 (added in UAT 4) |
| 5 | QUAL-03 web thresholds | Phase 2 / Phase 3 | Phase 2 SC4; Phase 3 SC1 |
| 6 | FND-04 users/orders/expenses/price-list seed steps (D-30) | Each entity's phase | ROADMAP "Pieces that grow" |

### Required Artifacts

Every artifact from the previous report was regression-checked: the build covers all of them, and 526/526 tests pass. The changed artifacts got a full re-check:

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs` | Pure guard: server allow-list, then database allow-list | ✓ VERIFIED | Order of checks: empty, parse, AttachDBFilename, Failover Partner, server allow-list (`(localdb)\CSPS` OrdinalIgnoreCase, or exactly `127.0.0.1\|localhost,<1-65535>` parsed with `NumberStyles.None`), missing catalog, then `CSPS_Dev`/`CSPS_E2E`. The server and Failover Partner reasons are fixed text. No environment reads, no connection |
| `src/Csps.Infrastructure/Seeding/DevSeedTargetCheck.cs` | Verdict record | ✓ VERIFIED | Doc comment only |
| `tools/Csps.DevSeed/Program.cs` | Guard before any connection | ✓ VERIFIED (WIRED) | `DevSeedTargetGuard.Check(options.ConnectionString)` runs before `CspsDbContext` is built, and `Refused` returns 2. The CLI spot-checks confirm it |
| `tests/.../Seeding/DevSeedTargetGuardTests.cs` | WR-04 cases | ✓ VERIFIED | 19 server-refusal cases (hosted, `tcp:`, `np:`, named instance, `.`, `(local)`, port-less loopback, bad ports, 127.0.0.2, look-alike host), 2 Failover Partner cases, and the allowed loopback and fixture forms. Each refusal asserts that no secret or host is echoed |
| `docs/development.md` | Step 5 states the server rule | ✓ VERIFIED | Names the allowed servers, the refusals and exit code 2 |
| All other Phase 1 artifacts | unchanged | ✓ VERIFIED (regression) | No diff since the last verification |

### Key Link Verification

The links are unchanged from the previous run (34/34 WIRED). The one link touched this round, DevSeed `Program` → `DevSeedTargetGuard.Check` before `CspsDbContext`, was re-read and exercised by the CLI: exit 2 with no connection attempted. **WIRED.**

### Data-Flow Trace (Level 4)

Unchanged from the previous run: site-settings endpoint, `/health` time-zone and database checks, and the audit row are all ✓ FLOWING, and no source on those paths changed.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Zero-warning build | `dotnet build --no-incremental` | 0/0 | ✓ PASS |
| Whole suite | `dotnet test --solution Csps.slnx --no-build` (once) | 526/526 | ✓ PASS |
| Format clean | `dotnet format --verify-no-changes` | exit 0 | ✓ PASS |
| Dev seed refuses hosted / Failover Partner / MSSQLLocalDB targets | `dotnet run --project tools/Csps.DevSeed -- --reset --connection ...` ×3 (unreachable targets) | exit 2 ×3, fixed reasons | ✓ PASS |
| No leftover test databases | `sqlcmd` read-only query | only CSPS_Dev and CSPS_E2E | ✓ PASS |

### Probe Execution

There is no `scripts/*/tests/probe-*.sh` and no plan declares a probe. `tools/Csps.HostProbe` is an owner-run host probe that was never deployed (Basic plan). **SKIPPED (no declared probes).**

### Requirements Coverage

All 19 phase IDs are claimed by plans. REQUIREMENTS.md maps exactly these 19 to Phase 1, all marked Complete, so none is orphaned.

| Requirement | Source Plan(s) | Status | Evidence |
|-------------|----------------|--------|----------|
| FND-01 | 01-02, 01-04, 01-11 | ✓ SATISFIED | Truth 1 (backstop 17 owner-accepted) |
| FND-02 | 01-01, 01-11 | ✓ SATISFIED | Truth 3 |
| FND-03 | 01-01 | ✓ SATISFIED | Truth 4 |
| FND-04 | 01-04 (+ quick 261007-p98) | ✓ SATISFIED (Phase 1 scope) | Truth 1; the guard is tightened (WR-04 fixed); entity seed steps deferred (item 6) |
| FND-05 | 01-06, 01-08 | ✓ SATISFIED | Truth 7 |
| FND-06 | 01-03 | ✓ SATISFIED | Truth 6 |
| FND-07 | 01-07 | ✓ SATISFIED | Truth 13 (backstop 19 owner-accepted, observed at the Phase 3 deploy) |
| FND-08 | 01-02, 01-03 | ✓ SATISFIED | Truth 10 |
| FND-09 | 01-02 | ✓ SATISFIED | Truth 11 |
| FND-10 | 01-05, 01-09 | ✓ SATISFIED | Truth 12 (WR-02 deferred by the owner, must close before any audit writer) |
| FND-11 | 01-02, 01-04 | ✓ SATISFIED (local); CI half deferred | Truth 15 |
| FND-12 | 01-04, 01-13 | ✓ SATISFIED (provisional pin) | Truth 2 (backstop 18 owner-accepted) |
| FND-13 | 01-12, 01-13 | ✓ SATISFIED (owner-accepted scope) | Truth 16, UAT 3 |
| QUAL-01 | 01-01 | ✓ SATISFIED | Build 0/0, format clean |
| QUAL-03 | 01-11 | ✓ SATISFIED (.NET); web part deferred | Truth 5 |
| QUAL-06 | 01-01, 01-11 | ✓ SATISFIED (override) | Owner-approved Microsoft exception; override carried forward |
| SEC-01 | 01-06, 01-08 | ✓ SATISFIED | Truth 8 |
| SEC-02 | 01-08 | ✓ SATISFIED | Truths 9, 20 |
| SEC-04 | 01-10 | ✓ SATISFIED | Truth 14 (backstop 21 owner-accepted) |

### Prohibitions (must-NOT)

| Plan | Prohibition (short) | Tier | Disposition |
|------|---------------------|------|-------------|
| 01-01 | No paid/proprietary/GPL dependency | test | **PASSED (override)**: owner accepted the two exact-version Microsoft runtime exceptions (UAT 9). The override is carried forward verbatim |
| 01-02 | Test code never drops a non-`CSPS_Test_` DB or touches MSSQLLocalDB/BetsLLC_* | test | ✓ enforced (`TestDatabaseNameTests`; fixed `(localdb)\CSPS`) |
| 01-02 | No Docker/Testcontainers locally | test | ✓ enforced (`SqlBackendTests`) |
| 01-02 | Contact placeholders stay bracketed | test | ✓ enforced (`MigrationTests`) |
| 01-04 | Seed never touches anything but CSPS_Dev/CSPS_E2E (never MSSQLLocalDB or a hosted DB) | test | ✓ **enforced (newly closed)**: WR-04 fixed. The server allow-list and Failover Partner refusal are covered by 49 passing guard tests and 3 CLI refusals in this run. The previous bypasses (named-pipe alias, remote server named CSPS_E2E) are now refused |
| 01-04 | No real data in seed | judgment | Owner agreed with the verdict (UAT 11) |
| 01-04 | No migrate/seed at startup | test | ✓ enforced (`StartupSafetyTests`) |
| 01-05 | No full IP or full UA in audit rows | test | Owner-deferred (UAT 10). WR-02 (6to4/NAT64) is `deferred` in 01-REVIEW-DISPOSITION and must close before any code path writes audit rows. No Phase 1 code path writes audit rows. All other cases are enforced by passing tests |
| 01-06 | No exception text/jargon in ProblemDetails outside Development | judgment | Owner agreed (UAT 11) |
| 01-07 | No full IP or raw UA in logs | test | ✓ enforced |
| 01-09 | No PII/secrets in AuditLog | judgment | Owner agreed (UAT 11) |
| 01-11 | No coverage via exclusions or lowered thresholds | judgment | Owner agreed (UAT 11) |
| 01-12 | No writes to the live site/DB | judgment | Owner agreed and confirmed no live changes (UAT 11) |
| 01-12 | No guessed host facts | judgment | Owner agreed (UAT 11) |
| 01-13 | No fact marked Verified without owner output | judgment | Owner agreed (UAT 11) |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs` | — | none: no debt markers, no stubs; reasons are fixed text | — | Changed file is clean |
| `tests/.../Health/HealthEndpointTests.cs`, `HealthEndpointFailureTests.cs` | 25, 95 | vacuous content-type assertion (WR-09, open) | ⚠️ Warning | Body-shape assertions still run |
| `src/Csps.Infrastructure/Content/SiteSettingsReader.cs` | 14, 31 | scoped DbContext in HybridCache factory (WR-01, open) | ⚠️ Warning | Cold-cache cancellation race |
| `src/Csps.Domain/Auditing/IpPrefix.cs` | 37-40 | 6to4/NAT64 not mapped (WR-02, **owner-deferred**) | ⚠️ Warning | Must close before the first audit writer (Phase 4). It is tracked only in 01-REVIEW-DISPOSITION and not in a ROADMAP criterion, so the Phase 4 plan should pick it up |
| `src/Csps.Infrastructure/Auditing/AuditTrail.cs` | 31-32 | SaveChanges on the shared scoped context (WR-03, open) | ⚠️ Warning | Phase 4 caller risk |
| `src/Csps.Server/Logging/SensitiveDataMasking.cs` | 15-31 | Identity secret names not masked (WR-05, open) | ⚠️ Warning | Phase 4 risk |
| `src/Csps.Server/Http/CorrelationId.cs` | 20-22 | non-W3C fallback (WR-06, open) | ⚠️ Warning | Audit write could throw on that path |
| `src/Csps.Server/Http/SecurityHeadersMiddleware.cs` | 24 | HSTS `includeSubDomains` (WR-07, open) | ⚠️ Warning | Matters at the first deploy |
| `src/Csps.Server/Logging/LogFileSettings.cs` | 46-54 | 30-file cap vs 30-day retention (WR-08, open) | ⚠️ Warning | Log flood eviction |
| `CLAUDE.md` (root) | Audit/logs bullet | still says "2-year audit retention" (IN-09, open) | ℹ️ Info | The file is now tracked (previous Info resolved), but the retention text still differs from D-32 |
| `tools/Csps.HostProbe/Properties/launchSettings.json` | 9 | **untracked** VS-generated file using ports 53693/53694 (Windows dynamic range, which CLAUDE.md says to avoid) | ℹ️ Info | Not in git and not shipped. Delete it, or set non-dynamic ports, before it is ever committed |
| `src/Csps.Server/Endpoints/SiteSettingsEndpoints.cs` | — | Minimal API endpoint after the 2026-10-07 switch to controllers | ℹ️ Info | Explicitly allowed to stay until a later phase touches it (owner rule change). Not a gap |

There are no unreferenced `TBD`/`FIXME`/`XXX` markers in the files this round changed (a grep matched only binaries under `bin/`). The open warnings are the code-review findings, none of which blocks the phase goal: 16 open, WR-02 deferred, WR-04 fixed.

### Human Verification Required

None. Every item from the previous report was resolved in `01-UAT.md` (11/11 pass, owner notes recorded), and this round found no new item that needs a human.

### Gaps Summary

There are no gaps. The phase goal is achieved in the codebase:
- the onion solution builds with zero warnings (forced rebuild)
- all 526 tests pass against isolated LocalDB `CSPS_Test_` databases, with nothing left behind
- the platform contract (ProblemDetails, health, logging, security headers, default-deny matrix) and the shared primitives (business calendar, SiteSettings, append-only audit log, SQL fixture) are present, wired and tested
- the hosting record is honest and owner-accepted

The WR-04 fix closes the last partially enforced test-tier prohibition that was in scope. The dev seed now refuses every server except `(localdb)\CSPS` or a loopback container, and refuses any Failover Partner. The verifier confirmed this through tests and through the CLI itself.

These remain, all non-blocking:
- the owner-deferred WR-02 (it must be fixed before Phase 4 writes audit rows)
- 7 other open code-review warnings
- the 6 deferred items above, each tracked in a later phase

---

_Verified: 2026-10-07T23:38:06Z_
_Verifier: Claude (gsd-verifier)_
