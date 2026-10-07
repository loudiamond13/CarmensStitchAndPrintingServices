---
phase: 01-hosting-verification-backend-foundation
verified: 2026-10-07T22:02:13Z
created: 2026-10-07T17:02:13-05:00
updated: 2026-10-07T17:02:13-05:00
status: human_needed
score: 16/23 must-haves verified (4 abstained as insufficient_spec, 3 need a human)
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
covered_digest: "v2:sha256:30a7b14ff7753c25b81f51b44099ec6e87107c8668359d4c3e42f6bc55890454"
behavior_unverified: 0
insufficient_spec: 4
overrides_applied: 0
deferred:
  - truth: "Integration tests run against Testcontainers SQL Server 2025 in CI (CSPS_TEST_SQL=container); the container path exists but has never run (no CI yet, and Docker is never used locally per D-07)"
    addressed_in: "Phase 3"
    evidence: "Phase 3 success criterion 1: the PR merge gate runs '3. unit, integration and architecture tests' and '6. coverage gates and generated THIRD-PARTY-NOTICES'"
  - truth: "Hosting record fact 'In-process hosting' is Unverified (probe could not run on the Basic plan)"
    addressed_in: "Phase 3"
    evidence: "Phase 3 success criterion 4: 'Staging serves in-process with: HTTPS redirect, server headers removed ...' (staging itself is amended by D-11)"
  - truth: "Hosting record facts DKIM and 'SPF / DKIM / DMARC pass in Gmail' are Unverified"
    addressed_in: "Phase 4 / Phase 17"
    evidence: "Phase 4 owner prerequisites: 'DNS access to publish SPF/DKIM/DMARC, if Phase 1 didn't finish it'; Phase 17 success criterion 1: 'SPF/DKIM/DMARC passing on the sender domain'"
  - truth: "QUAL-03 web thresholds (lib/http 100%, web >= 90%) cannot exist before web/ exists"
    addressed_in: "Phase 2 / Phase 3"
    evidence: "Phase 2 success criterion 4: '`httpClient.ts` has 100% coverage'; Phase 3 success criterion 1 step 4: 'Vitest with coverage' and step 6 'coverage gates'"
  - truth: "FND-04 seed steps for users (both roles), orders with children, company expenses and price list (D-30)"
    addressed_in: "Phases 4-11 (each entity's phase)"
    evidence: "ROADMAP Conventions, 'Pieces that grow': 'the dev seed (FND-04)' is set up once, then extended by every later phase for its own entities"
human_verification:
  - test: "After preflight, run Initialize-DevSecrets.ps1 if needed, then `dotnet run --project src/Csps.Server --launch-profile http` and GET http://localhost:5115/health"
    expected: "200 with {\"status\":\"Healthy\",\"checks\":[{\"name\":\"self\",...},{\"name\":\"database\",\"status\":\"Healthy\"},{\"name\":\"time-zone\",\"status\":\"Healthy\"}]}; stop the server afterwards"
    why_human: "Plan 01-10 truth 8 (the documented local full-stack run) needs a running server; the verifier does not start servers. The same composition root is proven through WebApplicationFactory against a migrated CSPS_Test database, CSPS_Dev has all 3 migrations applied, and the three dev secrets exist in user-secrets."
  - test: "With the https profile running (Development), open https://localhost:7028/scalar in Chrome and check the DevTools console"
    expected: "The API reference renders and the console shows zero CSP violations; if styles render without 'unsafe-inline', tighten the carve-out (assumption A7)"
    why_human: "Plan 01-06 Task 3 <human-check>; browser CSP enforcement cannot be observed from tests. NOT done yet."
  - test: "Owner reviews the hosting record's 12 Unverified facts (.planning/HOSTING-RECORD.md) and accepts that the phase ships with them Unverified"
    expected: "Owner confirms: runtime patch, in-process hosting, content root, logs writable, client-IP/proxy topology, HTTPS termination, Asia/Manila + en-PH, PFX EphemeralKeySet, app-pool memory are verified at the first real deploy (Phase 3); `model` compatibility level stays Unverified; DKIM and the Gmail SPF/DKIM/DMARC pass are supplied before Phase 4"
    why_human: "The phase goal promises 'a verified record of the SmarterASP.NET hosting facts'. 19 of 31 rows are Verified; 12 are honestly Unverified because the Basic plan allows no probe site. Nothing was guessed, but 'verified' is only partly true, and that is an owner call."
  - test: "Owner/maintainer acknowledges the provisional compatibility pin (SqlCompatibility.Level = 160, D-33) and adds the re-pin to 170 to the ROADMAP (Phase 15-17 cutover text)"
    expected: "A roadmap success criterion or plan item tracks 'create the SQL Server 2025 database, verify its level, re-pin SqlCompatibility.Level, re-run MigrationScriptTests'; ROADMAP line 164 ('compatibility level re-pinned and re-proven') is corrected to 'kept at 160, provisional'"
    why_human: "The idempotent script is proven at 150, 160 and 170, so the behavior holds for every plausible host level, but the host's own level is Unverified and the re-pin is tracked only in CONTEXT D-33, not in the ROADMAP (so it cannot be formally deferred)."
  - test: "Write a held-out test for FND-01 concurrency (insufficient_spec): interrupt `dotnet ef database update` / MigrateAsync mid-run (for example a fault-injecting interceptor on the second migration) and re-run"
    expected: "After the interruption the database holds exactly the migrations before the failed one; re-running completes the rest"
    why_human: "Non-inferable (backstop) truth. EachMigrationAppliesOnTopOfItsPredecessor proves resumption from a committed boundary, but no test interrupts a migration. Presence + wiring never qualifies. Unverified - held-out test recommended."
  - test: "Write a held-out test for FND-12 concurrency (insufficient_spec): apply the idempotent script with a batch that fails inside the second migration, then re-apply"
    expected: "History holds only the first migration and no partial objects of the second remain; the re-run completes"
    why_human: "Non-inferable (backstop) truth. IdempotentScriptWrapsEachMigrationInItsOwnTransaction only counts BEGIN TRANSACTION/COMMIT lines (structural). Unverified - held-out test recommended."
  - test: "Write a held-out test (or observe on the host at the Phase 3 first deploy) for FND-07 multi-process logging (insufficient_spec): two processes write to the same daily log file with shared: true"
    expected: "Both processes append without IOException and every event is a valid compact-JSON line"
    why_human: "Non-inferable (backstop) truth. LogFileTests only asserts settings.Shared == true (configuration). Unverified - held-out test recommended."
  - test: "Write a held-out test for SEC-04 concurrency (insufficient_spec): start two hosts at the same moment against one empty DataProtectionKeys table"
    expected: "Each may create a key; payloads protected by either host are readable by both"
    why_human: "Non-inferable (backstop) truth. KeyRingSurvivesRestart and SecondStartReusesKey are sequential, not simultaneous. Unverified - held-out test recommended."
  - test: "Owner confirms (or records an override for) the 01-01 license prohibition against the two owner-approved Microsoft-licensed runtime packages"
    expected: "Either an override entry is added (Microsoft.Data.SqlClient.SNI.runtime 6.0.2 and Microsoft.Identity.Client.NativeInterop 0.20.6: free, proprietary, shipped unmodified, exact-version exception in docs/license-exceptions.json), or a substitute is planned; CLAUDE.md's license line mentions the exception"
    why_human: "Flagged prohibition: plan 01-01 says 'MUST NOT admit any dependency ... whose license ... is proprietary; production dependencies are limited to MIT, Apache-2.0, BSD and ISC'. QUAL-06 allows 'an owner-approved exception', and 01-11 records Option A as owner-approved on 2026-10-07, but that approval exists only in executor-written docs, not as a CONTEXT decision."
  - test: "Review the two partially enforced test-tier prohibitions: 01-05 (no full client IP in audit rows) vs code-review WR-02, and 01-04 (dev seed never touches MSSQLLocalDB or a hosted DB) vs WR-04"
    expected: "Decide fix-now or defer: map 6to4 (2002::/16) and NAT64 (64:ff9b::/96) to IPv4 before truncation; replace the MSSQLLocalDB substring check with a data-source allow-list"
    why_human: "Unverified-prohibition: both are enforced by passing tests, but confirmed bypasses exist (2002:cbb1:0c2d::1 is stored as 2002:cbb1:c2d::, which encodes the full IPv4 203.177.12.45; a named-pipe alias or a remote server with Database=CSPS_E2E passes the guard). No Phase 1 code path writes audit rows yet."
  - test: "Review the non-authoritative LLM verdicts on the 7 judgment-tier prohibitions (table 'Prohibitions' below)"
    expected: "Owner/maintainer agrees with each verdict or records a gap"
    why_human: "Judgment-tier prohibitions are never silently passed. The verifier recorded a verdict for each, but it is not authoritative: unverified-prohibition - human review recommended."
---

# Phase 1: Hosting Verification & Backend Foundation Verification Report

**Phase Goal:** A developer can clone the repo and run a zero-warning onion API against an empty, EF-migrated `CSPS_` database. The API carries the platform contract (ProblemDetails, health, logging, security headers, default-deny authorization) and the shared primitives every slice needs (business calendar, SiteSettings core, append-only audit log, SQL test fixture). A verified record of the SmarterASP.NET hosting facts sits alongside it.
**Verified:** 2026-10-07T22:02:13Z
**Status:** human_needed
**Re-verification:** No (initial verification)

> **MVP-mode discrepancy.** ROADMAP marks Phase 1 `**Mode:** mvp`, but the goal is not a user story (`user-story.validate` returned `valid: false`: no "As a", "I want to" or "so that" slots). Per the MVP rules no User Flow Coverage table was produced (it would be invented). Run `/gsd mvp-phase 1` if story framing is wanted. The standard goal-backward verification below was done in full.

## Independent evidence gathered by the verifier

All runs were on this machine after a clean preflight (ports 5180/5115/7028/5199 free, no dev/test processes). Only `(localdb)\CSPS` was used. No Docker, no remote host, no `MSSQLLocalDB`, no `BetsLLC_*`.

| Check | Command | Result |
|-------|---------|--------|
| Build | `dotnet build Csps.slnx -tl:off` | exit 0, **0 Warning(s), 0 Error(s)** |
| Full suite (run once) | `dotnet test --solution Csps.slnx --no-build` | **501/501 passed**, 0 skipped, 0 failed |
| Format | `dotnet format Csps.slnx --verify-no-changes --no-restore` | exit 0 |
| Coverage gate | `Invoke-CoverageGate.ps1` | PASS: Domain 100% line (297/297) + 100% branch (136/136); Application 100% line (38/38) |
| Coverage gate fails | `Invoke-CoverageGate.ps1 -ApplicationLineThreshold 101` | exit 1 (gate can fail) |
| Dev DB migrated | `dotnet ef migrations list --no-build` | InitialCreate, AddAuditLog, AddDataProtectionKeys; none pending |
| LocalDB state (read-only) | `sqlcmd` on `(localdb)\CSPS` | CSPS_Dev and CSPS_E2E at level 160, 5 tables each, trigger `TR_AuditLog_AppendOnly` enabled, 1 SiteSettings row; **no leftover `CSPS_Test_` databases** after the suite |
| Idempotent script at **150** (new) | script from `dotnet ef migrations script --idempotent`, applied twice with `sqlcmd -b` to a throwaway `CSPS_Test_<guid>` at level 150, then dropped | apply 1 exit 0, apply 2 exit 0, 3 history rows, 1 SiteSettings row, trigger enabled; DB dropped, 0 leftovers |
| Decision coverage | `check.decision-coverage-verify` | 34/34 CONTEXT decisions honored |
| Commits | `verify.commits` on 18 hashes cited in SUMMARYs | all valid |
| Dev secrets present | `dotnet user-secrets list` (key names only) | Jwt:SigningKey, DataProtection:CertificatePassword, DataProtection:CertificateBase64 |

The level-150 run matters: the host's live legacy DB is at 150 (HOSTING-RECORD B3), the Basic plan has one DB, and a SQL Server 2022 backup restored onto 2025 keeps its old level until raised (D-33).

## Goal Achievement

### Observable Truths

ROADMAP success criteria 1-5 are the contract (split into sub-truths 1-16). Rows 17-23 are PLAN must-haves that need their own disposition (backstops and human checks). Every other PLAN truth was checked and folds into the row named in its evidence.

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC1: from a fresh clone with no `.bak`, `dotnet ef database update` builds the full schema on an empty `CSPS_` LocalDB DB, and the dev seed makes it usable | ✓ VERIFIED | `MigrationTests` (empty `CSPS_Test_` gets full schema + singleton, migrate twice is a no-op); `dotnet ef migrations list` shows 3/3 applied on CSPS_Dev; CSPS_E2E holds all 5 tables and the seeded row; `DevSeederTests` + `DevSeedTargetGuardTests` pass; no `.bak` tracked (`*.bak` git-ignored); source tree equals HEAD (`git status` shows only planning files). The literal fresh-clone run was not repeated (a full restore would hit nuget.org); 01-11 SUMMARY records it. |
| 2 | SC1: the idempotent migration script applies twice without error at the host's compatibility level | ✓ VERIFIED (provisional pin) | `MigrationScriptTests.IdempotentScriptAppliesTwice` at 160 and 170 (pass), plus the verifier's own run at 150 (pass). Pin stays `SqlCompatibility.Level = 160` (D-33). The host `model` level is Unverified, so see human item 4. |
| 3 | SC2: `Csps.slnx` (4 src projects, test projects, tools/) builds with zero warnings; the VS scaffold is gone | ✓ VERIFIED | Build 0/0; slnx lists 4 src + 5 test projects + Csps.Testing + 2 tools; `CarmensStitch*`, `carmens*` and `*.esproj` are absent; `SolutionLayoutTests` pass; `TreatWarningsAsErrors` + `MSBuildTreatWarningsAsErrors` set |
| 4 | SC2: a forbidden layer or package reference, a floating version, or a package without a recorded license or legitimacy check fails the build or the architecture tests | ✓ VERIFIED | `LayerTests` (ArchUnitNET + reflection + csproj rules), `BuildConfigTests.EveryCentralPinIsAnExactVersion` / `NoForbiddenPackageIsReferenced` / `NoProjectPinsAVersionOutsideCentralManagement`, `DependencyRegistryTests` (registry entry per pin, license allow-list, 14-day cool-down). All pass; the 01-01 SUMMARY records 3 mutation runs that failed as expected (not re-run, because that would need source edits) |
| 5 | SC2: missing a coverage threshold fails the test run | ✓ VERIFIED | The verifier ran the gate: PASS at defaults, exit 1 at `-ApplicationLineThreshold 101` |
| 6 | SC3: `/health` reports liveness, DB reachability and time-zone resolution without exposing internals | ✓ VERIFIED | `HealthEndpoint` + `MinimalHealthWriter` (status + name/status only, no-store); `database` (CanConnectAsync) and `time-zone` (IBusinessCalendar → SiteSettings) checks with a 3 s timeout; `HealthEndpointTests`, `HealthEndpointFailureTests` (503 minimal body, no `Data Source`/`CSPS_Test_`) pass |
| 7 | SC3: an unknown `/api/*` route returns a ProblemDetails 404 with `traceId`, never `index.html` | ✓ VERIFIED | `ApiRouting.MapApiFallback` (`/api/{**path}`, every method) → `CspsProblemDetails.Build`; status-code pages write problem+json whatever the Accept header; `ProblemDetailsTests` pass |
| 8 | SC3: every response carries the strict CSP/HSTS header set | ✓ VERIFIED | `SecurityHeadersMiddleware` registered first and sets headers in `OnStarting` (CSP verbatim PRD §11.3, nosniff, Referrer-Policy, Permissions-Policy, COOP; HSTS on HTTPS only; Server/X-Powered-By removed); `web.config` removeServerHeader; `SecurityHeadersTests` cover 404/500/GET+HEAD /health; `AuthorizationFailureTests` cover 401/403/503 |
| 9 | SC3: an endpoint without a policy or a matrix row fails the discovery-driven authorization test | ✓ VERIFIED | `AuthorizationMatrixTests.DiscoveredEndpointsAreFullyCovered` reads the real `EndpointDataSource` (guarded against an empty list); `AuthorizationCoverageTests` prove each violation kind with synthetic endpoints; fallback policy `RequireAuthenticatedUser` in `SecurityRegistration` |
| 10 | SC4: under a fake clock at Manila boundaries, "today" and the month and year boundaries resolve in the business zone | ✓ VERIFIED | `BusinessClock` (pure, exclusive-end UTC ranges, DST gap/ambiguity handled); `BusinessClockTests` (15:59:59Z/16:00:00Z, month, year edges) and `BusinessCalendarTests` (FakeTimeProvider + SiteSettings zone) pass; RS0030 bans the clock statics (a grep finds no use in src/tools) |
| 11 | SC4: SiteSettings (name, zone, currency/locale, contact placeholders) are read through a cached port | ✓ VERIFIED | `SiteSettingsReader` (HybridCache, tag `site-settings`, `RemoveByTagAsync` invalidation) behind `ISiteSettingsReader`/`ISiteSettingsCache`; `SiteSettingsReaderTests` pass. WR-01 (scoped DbContext captured in the cache factory) is an open warning |
| 12 | SC4: audit rows can be appended, but DB-level UPDATE and DELETE fail | ✓ VERIFIED | Migration `AddAuditLog`: AFTER UPDATE, DELETE trigger (51000/51001, 8-month purge flag per D-32) + `AuditLogTruncateGuard` FK; trigger enabled in CSPS_Dev; `AuditLogAppendOnlyTests` (raw SQL update/delete/truncate refused, purge boundary) and `AuditTrailTests` pass; EF interceptor as defense in depth |
| 13 | SC4: logs carry a correlation id and mask secrets | ✓ VERIFIED | Serilog request logging through the host logger; `RequestLoggingTests` (TraceId equals ProblemDetails traceId, 10 parallel requests); `SensitiveDataMaskingTests` (exact + suffix rules, nested structures, CR/LF escaped). WR-05 (Identity names such as PasswordHash and SecurityStamp are not masked yet) is an open warning |
| 14 | SC4: Data Protection keys survive an app restart | ✓ VERIFIED | `PersistKeysToDbContext` + `ProtectKeysWithCertificate`; `DataProtectionTests.KeyRingSurvivesRestart` (two hosts in sequence, exactly one key row), `StoredKeyXmlIsEncrypted`, `SecondStartReusesKey`, `RotationKeepsOldKeysReadable` pass |
| 15 | SC5: integration tests run in parallel against isolated `CSPS_Test_<guid>` DBs with Respawn resets (Testcontainers in CI) | ✓ VERIFIED (LocalDB); container path deferred | `CspsDatabase` (per-class DB, name guard + exact length, compat pin, real migrations, Respawn ignoring history/SiteSettings/AuditLog); `SqlFixtureTests.ConcurrentDatabasesAreDistinctAndMigrated` passes; 0 leftover DBs after the full run. The container backend has never run (Phase 3 CI, see Deferred) |
| 16 | SC5: the hosting verification record lists runtime patch, @@VERSION, compat level, collation, in-process hosting, proxy/client-IP topology, SPF/DKIM/DMARC result, scheduler, DB quota, staging option | ? UNCERTAIN (human) | `.planning/HOSTING-RECORD.md` lists every required fact (`HostingRecordTests` 4/4 pass). 19 of 31 rows are Verified (plan, quota 1000 MB, scheduler No, staging No, @@VERSION SQL Server 2022 16.0.x Web, collation, SPF, DMARC ...). 12 are **Unverified**: .NET runtime patch, in-process hosting, client-IP/proxy topology, HTTPS termination, content root, logs writable, Manila/en-PH, PFX EphemeralKeySet, app-pool memory, `model` compatibility level, DKIM, Gmail SPF/DKIM/DMARC pass. Nothing was guessed, but the record is only partly "verified" (human item 3) |
| 17 | (01-02, backstop) An interrupted `dotnet ef database update` leaves the DB at the last committed migration, and re-running completes the rest (FND-01 concurrency) | ⚠️ insufficient_spec (abstained) | Partial evidence only: `EachMigrationAppliesOnTopOfItsPredecessor` resumes from each committed boundary. No test interrupts a migration. Held-out test recommended |
| 18 | (01-04, backstop) Each migration in the idempotent script runs in its own transaction (FND-12 concurrency) | ⚠️ insufficient_spec (abstained) | `IdempotentScriptWrapsEachMigrationInItsOwnTransaction` counts BEGIN TRANSACTION/COMMIT lines (3 each; the verifier also counted 3 in the generated script). That is structural, not an interrupted apply |
| 19 | (01-07, backstop) During an IIS overlapped recycle, two worker processes append to the same daily log file (`shared: true`) | ⚠️ insufficient_spec (abstained) | `LogFileTests.LogFileSettingsHasD21Values` asserts `Shared == true` (config only). No multi-process write test |
| 20 | (01-08, backstop) Authorization is stateless per request; parallel requests with different tokens each get their own row's status (SEC-02 concurrency) | ✓ VERIFIED | `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` fires 4× the full matrix × {anonymous, Admin, Manager} concurrently on one client and asserts every status. It passed in the verifier's run |
| 21 | (01-10, backstop) Two instances starting together against an empty key ring each may create a key, and both keys stay readable by both (SEC-04 concurrency) | ⚠️ insufficient_spec (abstained) | Only sequential-start tests exist (`KeyRingSurvivesRestart`, `SecondStartReusesKey`). Held-out test recommended |
| 22 | (01-10) The documented local full-stack run (`dotnet run --launch-profile http`) serves `/health` with all three checks Healthy | ? UNCERTAIN (human) | Same `Program` proven through WebApplicationFactory against a migrated DB; CSPS_Dev is migrated; dev secrets exist. The verifier does not start servers (human item 1) |
| 23 | (01-06) In Development only, `/scalar` uses a nonce carve-out CSP, and the browser shows zero CSP violations (assumption A7) | ? UNCERTAIN (human) | `ScalarDevelopmentCsp` + `OpenApiExposureTests` (Production maps neither path; no unsafe-inline outside dev /scalar) pass. The browser check has **not** been done (human item 2) |

**Score:** 16/23 truths verified (0 present-but-behavior-unverified; 4 abstained as insufficient_spec; 3 uncertain, routed to a human)

All other PLAN truths across the 13 plans were checked through the tests named above, and all pass in the verifier's 501/501 run. That covers the guard near-misses, the singleton CHECK, UTF-16 round-trip, the 401/403 token cases, startup refusal on bad JWT or certificate settings, the 5xx reference text, the HTTPS redirect outside Development/Testing, the probe key gate and the IP/UA minimization. None of them failed.

### Deferred Items

Items not yet met, each covered explicitly by a later phase in the ROADMAP.

| # | Item | Addressed In | Evidence |
|---|------|-------------|----------|
| 1 | Testcontainers SQL Server 2025 backend never exercised | Phase 3 | SC1: PR gate runs "unit, integration and architecture tests" |
| 2 | Host fact "In-process hosting" Unverified | Phase 3 | SC4: "Staging serves in-process ..." (staging amended by D-11) |
| 3 | DKIM and Gmail SPF/DKIM/DMARC pass Unverified | Phase 4 / Phase 17 | Phase 4 prerequisite "DNS access to publish SPF/DKIM/DMARC, if Phase 1 didn't finish it"; Phase 17 SC1 "SPF/DKIM/DMARC passing on the sender domain" |
| 4 | QUAL-03 web thresholds (lib/http 100%, web ≥ 90%) | Phase 2 / Phase 3 | Phase 2 SC4 "httpClient.ts has 100% coverage"; Phase 3 SC1 "Vitest with coverage", "coverage gates" |
| 5 | FND-04 users/orders/expenses/price-list seed steps (D-30) | Each entity's phase | ROADMAP Conventions: "the dev seed (FND-04)" is a piece that grows |

The runtime patch, proxy topology and `model` compatibility level are **not** formally deferred. No later ROADMAP criterion names them; only HOSTING-RECORD and CONTEXT do. They stay in human items 3 and 4.

### Required Artifacts

`verify.artifacts` reported "Missing export" for C# members, and "File not found" for the glob paths `*_AddAuditLog.cs` and `*_AddDataProtectionKeys.cs`. These are tool false positives: the tool's export detector does not parse C#, and it does not expand globs. The verifier checked each one by hand.

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `Csps.slnx` | 4 src + tests + tools | ✓ VERIFIED | 12 projects, exact set per 01-11 |
| `Directory.Build.props` / `Directory.Packages.props` / `global.json` / `BannedSymbols.txt` | strict build, exact pins, SDK 10.0.401 + MTP, RS0030 list | ✓ VERIFIED | Read in full; 6 banned symbols |
| `src/Csps.Server/Program.cs` | composition root | ✓ VERIFIED | Headers outermost, exception handler, status pages, auth, health, fallback, site-settings, dev-only docs; no migrate/seed |
| `src/Csps.Server/Http/MinimalHealthWriter.cs` | `WriteAsync` | ✓ VERIFIED | public static `WriteAsync(HttpContext, HealthReport)` |
| `src/Csps.Infrastructure/Persistence/SqlCompatibility.cs` | single pin | ✓ VERIFIED | `Level = 160` (provisional) |
| `src/Csps.Infrastructure/Persistence/Migrations/20261007165906_AddAuditLog.cs` | table, guard, trigger | ✓ VERIFIED | Trigger inside EXEC after CreateTable |
| `src/Csps.Infrastructure/Persistence/Migrations/20261007171939_AddDataProtectionKeys.cs` | key table | ✓ VERIFIED | Present, applied in CSPS_Dev/E2E |
| `src/Csps.Domain/Time/BusinessClock.cs`, `TimeZoneResolver.cs` | time math, fallback chain | ✓ VERIFIED | Today, Year, MonthOf, UtcRange, MonthUtcRange, YearUtcRange, Resolve all public |
| `src/Csps.Domain/Auditing/{AuditEntry,IpPrefix,UserAgentFamily}.cs` | minimization | ✓ VERIFIED | Create/From/Classify public (see WR-02) |
| `src/Csps.Server/Http/{CspsProblemDetails,SecurityHeadersMiddleware}.cs`, `Endpoints/ApiRouting.cs`, `web.config` | contract | ✓ VERIFIED | Read in full |
| `src/Csps.Server/Composition/SecurityRegistration.cs`, `Endpoints/SiteSettingsEndpoints.cs` | default-deny, Staff group | ✓ VERIFIED | Fallback policy + Staff/Manager |
| `src/Csps.Infrastructure/DataProtection/*` | DB key ring + certificate | ✓ VERIFIED | `SetApplicationName("Csps")`, refusing encryptor |
| `tools/Csps.DevSeed/Program.cs`, `Seeding/*` | guarded seed | ✓ VERIFIED | Guard runs before any connection (see WR-04) |
| `tools/Csps.HostProbe/*` | key-protected probe | ✓ VERIFIED | Not deployed (Basic plan) |
| `tests/Csps.Testing/*` | fixture, factory, tokens, certs | ✓ VERIFIED | LocalDB default; container only on `CSPS_TEST_SQL=container` |
| `tools/scripts/Invoke-CoverageGate.ps1`, `New-ThirdPartyNotices.ps1` | gates | ✓ VERIFIED | Coverage gate run by the verifier; the license gate was not re-run (nuget-license may contact nuget.org); the orchestrator's run gave exit 0, 71 packages |
| `THIRD-PARTY-NOTICES.md`, `docs/*` | notices, registry, guides, runbooks | ✓ VERIFIED | Tracked in git |
| `.planning/HOSTING-RECORD.md` | Facts table | ✓ VERIFIED (exists) / see truth 16 | 31 fact rows |

### Key Link Verification

`verify.key-links`: 34/34 links verified across all 13 plans. Spot-checked by reading code: Program → AddInfrastructure / AddCspsSecurity / SecurityHeadersMiddleware / CspsProblemDetails / UseSerilogRequestLogging; SiteSettingsEndpoints → GetSiteSettingsHandler → ISiteSettingsReader; BusinessCalendar → SiteSettingsReader (TimeZoneId); TimeZoneHealthCheck → GetClockAsync; CspsDbContextOptions → AddInterceptors(AuditLogAppendOnlyInterceptor); AuditTrail → AuditEntry.Create + IRequestContext; DevSeed → DevSeedTargetGuard.Check before CspsDbContext; MigrationScriptTests → SqlCompatibility.Level. All WIRED.

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `GET /api/v1/site-settings` | `SiteSettingsDto` | HybridCache → `db.SiteSettings.AsNoTracking()` (migration-seeded row) | Yes (endpoint test returns the seeded values) | ✓ FLOWING |
| `/health` `time-zone` check | `ZoneSource` | `BusinessCalendar` → `ISiteSettingsReader` → DB | Yes | ✓ FLOWING |
| `/health` `database` check | connectivity | `CanConnectAsync` | Yes (503 when unreachable, tested) | ✓ FLOWING |
| Audit row | `AuditEntry` | `IRequestContext` (connection IP, UA, W3C trace id) + TimeProvider | Yes (`AuditTrailTests`); no Phase 1 caller yet | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Zero-warning build | `dotnet build Csps.slnx -tl:off` | 0 Warning(s) 0 Error(s) | ✓ PASS |
| Whole suite | `dotnet test --solution Csps.slnx --no-build` (once) | 501/501 | ✓ PASS |
| Coverage gate passes and can fail | `Invoke-CoverageGate.ps1` (default, then `-ApplicationLineThreshold 101`) | exit 0 / exit 1 | ✓ PASS |
| Migrations applied, none pending | `dotnet ef migrations list --no-build` | 3 applied | ✓ PASS |
| Idempotent script at 150 | apply twice to a throwaway `CSPS_Test_<guid>` at level 150 | exit 0 / exit 0, dropped | ✓ PASS |
| Format clean | `dotnet format --verify-no-changes` | exit 0 | ✓ PASS |
| Local `dotnet run` + `/health`; Scalar in a browser | - | not run (no servers started) | ? SKIP → human |

### Probe Execution

Step 7c: no `scripts/*/tests/probe-*.sh` exists and no plan declares one. `tools/Csps.HostProbe` is an owner-run host probe, not a verification probe. It was never deployed: the Basic plan allows no extra site (HOSTING-RECORD §C). **SKIPPED (no declared probes).**

### Requirements Coverage

All 19 phase IDs are claimed by at least one plan. REQUIREMENTS.md maps exactly these 19 to Phase 1, so none are orphaned.

| Requirement | Source Plan(s) | Description (short) | Status | Evidence |
|-------------|----------------|---------------------|--------|----------|
| FND-01 | 01-02, 01-04, 01-11 | Full schema on an empty DB from migrations alone | ✓ SATISFIED | Truth 1 (concurrency backstop abstained, truth 17) |
| FND-02 | 01-01, 01-11 | Csps.slnx layout, scaffold removed, ports kept | ✓ SATISFIED | Truth 3; launchSettings 5115/7028 |
| FND-03 | 01-01 | Architecture tests fail on forbidden layer/package | ✓ SATISFIED | Truth 4 |
| FND-04 | 01-04 | Dev seed (Phase 1 scope per D-30) | ✓ SATISFIED (Phase 1 scope) | Guarded command + step framework + SiteSettings step. REQUIREMENTS.md text (users, orders, expenses, price list) is wider; the rest grows per the ROADMAP convention (Deferred 5) |
| FND-05 | 01-06, 01-08 | RFC 9457 everywhere, traceId, field errors, API 404 | ✓ SATISFIED | Truth 7; `ResultHttpExtensionsTests`, `CspsProblemDetailsTests` |
| FND-06 | 01-03 | /health liveness, DB, zone, no internals | ✓ SATISFIED | Truth 6 |
| FND-07 | 01-07 | Serilog, correlation id, masking | ✓ SATISFIED | Truth 13 (WR-05, WR-08 open; backstop truth 19 abstained) |
| FND-08 | 01-02, 01-03 | IBusinessCalendar over TimeProvider, Manila fallback | ✓ SATISFIED | Truth 10 |
| FND-09 | 01-02 | SiteSettings entity, seed, cached port | ✓ SATISFIED | Truth 11 |
| FND-10 | 01-05, 01-09 | Append-only AuditLog + IAuditTrail | ✓ SATISFIED | Truth 12 (WR-02, WR-03, WR-06 open) |
| FND-11 | 01-02, 01-04 | LocalDB locally, Testcontainers in CI, Respawn, parallel | ✓ SATISFIED (local); CI half deferred | Truth 15 |
| FND-12 | 01-04, 01-13 | Migrations verified; idempotent script ×2 at the host level | ✓ SATISFIED (provisional pin) | Truth 2; proven at 150/160/170 (backstop truth 18 abstained) |
| FND-13 | 01-12, 01-13 | Hosting verification record | ? NEEDS HUMAN | Truth 16. REQUIREMENTS.md marks it `[x] Complete`, but 12 facts are Unverified |
| QUAL-01 | 01-01 | Strict .NET build, CPM, audit, format | ✓ SATISFIED | Build 0/0, format exit 0, `BuildConfigTests` |
| QUAL-03 | 01-11 | Coverage gates | ✓ SATISFIED (.NET); web part deferred | Truth 5 |
| QUAL-06 | 01-01, 01-11 | Registry, license gate, notices, cool-down | ✓ SATISFIED (flagged) | `DependencyRegistryTests`; notices tracked; two owner-approved Microsoft exceptions (human item 9) |
| SEC-01 | 01-06, 01-08 | Security headers on every response | ✓ SATISFIED | Truth 8 (WR-07 HSTS includeSubDomains open) |
| SEC-02 | 01-08 | Default deny + discovery-driven matrix | ✓ SATISFIED | Truths 9, 20 |
| SEC-04 | 01-10 | DP keys persisted, encrypted at rest | ✓ SATISFIED | Truth 14 (backstop truth 21 abstained) |

### Decision Coverage

All trackable CONTEXT.md decisions are honored by shipped artifacts: **34/34** (D-00..D-33). Non-blocking gate.

### Prohibitions (must-NOT)

| Plan | Prohibition (short) | Tier | Disposition |
|------|---------------------|------|-------------|
| 01-01 | No paid/proprietary/GPL dependency; production limited to MIT/Apache/BSD/ISC | test | ⚠️ **flagged.** The enforcement is wired (registry + license gate), but two proprietary (free) Microsoft runtime packages ship under an exact-version exception recorded as owner-approved. That conflicts with the literal text (human item 9; override suggested below) |
| 01-02 | Test code never drops a non-`CSPS_Test_` DB, never touches MSSQLLocalDB/BetsLLC_* | test | ✓ enforced: `TestDatabaseNameTests`, `QuotedName` re-check, LocalDB connection string fixed to `(localdb)\CSPS` |
| 01-02 | No Docker/Testcontainers locally | test | ✓ enforced: `SqlBackendTests` (unset → LocalDb) |
| 01-02 | Contact placeholders stay bracketed | test | ✓ enforced: `MigrationTests` asserts the bracketed values |
| 01-04 | Seed never touches anything but CSPS_Dev/CSPS_E2E (never MSSQLLocalDB or a hosted DB) | test | ⚠️ **flagged, partially enforced**: `DevSeedTargetGuardTests` pass, but WR-04 bypasses exist (named-pipe alias, remote server named CSPS_E2E) (human item 10) |
| 01-04 | No real data in seed | judgment | LLM verdict (non-authoritative): complies. Only the owner-approved business name and bracketed placeholders (`SiteSettingsDefaults`). Flagged for human review |
| 01-04 | No migrate/seed at startup | test | ✓ enforced: `StartupSafetyTests` (ArchUnit + reflection) |
| 01-05 | No full IP or full UA in audit rows | test | ⚠️ **flagged, partially enforced**: tests pass, but WR-02 (confirmed in `IpPrefix.cs`) keeps the full IPv4 inside a 6to4 /48 (human item 10) |
| 01-06 | No exception text/jargon/blame in ProblemDetails outside Development | judgment | LLM verdict: complies (`PlainEnglish` titles; 5xx fixed text + reference; tested). Flagged for human review |
| 01-07 | No full IP or raw UA in application logs | test | ✓ enforced: `LogsNeverContainClientIpOrUserAgent`, `QueryStringIsNotLogged` |
| 01-09 | No PII/secrets in AuditLog | judgment | LLM verdict: complies by design (ids only, Detail ≤ 400 chars, no caller in Phase 1). Future callers are not constrained beyond doc comments. Flagged |
| 01-11 | No coverage via exclusions or lowered thresholds | judgment | LLM verdict: complies (no `ExcludeFromCodeCoverage` or `--coverlet-exclude` in src/tools; defaults 100/100/95). Flagged |
| 01-12 | No writes to the live site/DB | judgment | LLM verdict: complies as far as the repo shows (SELECT-only checklist; probe never deployed). What the owner did in the control panel cannot be observed. Flagged |
| 01-12 | No guessed host facts | judgment | LLM verdict: complies (12 rows Unverified with reasons; A4 records only what the owner listed). Flagged |
| 01-13 | No fact marked Verified without owner output | judgment | LLM verdict: complies (each Verified row cites A/B/D1 output and a date). Flagged |

**Suggested override (if the owner accepts the Microsoft exception).** Add to this file's frontmatter:

```yaml
overrides:
  - must_have: "MUST NOT admit any dependency or tool whose license costs money, is proprietary, or is GPL/AGPL/SSPL"
    reason: "Two free Microsoft runtime parts of Microsoft.Data.SqlClient (SNI.runtime 6.0.2, Identity.Client.NativeInterop 0.20.6) ship unmodified under an exact-version exception (docs/license-exceptions.json); QUAL-06 allows owner-approved exceptions"
    accepted_by: "{owner}"
    accepted_at: "{ISO timestamp}"
```

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs` | 25 | `ContentType?.MediaType.ShouldBe(...)` passes vacuously (WR-09, deferred-items.md) | ⚠️ Warning | The content-type assertion cannot fail on a missing header; body-shape assertions still run |
| `tests/Csps.Server.IntegrationTests/Health/HealthEndpointFailureTests.cs` | 95 | same | ⚠️ Warning | `HtmlAcceptStillGetsJson`'s key assertion is weak |
| `src/Csps.Infrastructure/Content/SiteSettingsReader.cs` | 14, 31 | scoped DbContext captured by the HybridCache factory (WR-01) | ⚠️ Warning | A cold-cache race on cancellation can give a 500 or an Unhealthy check |
| `src/Csps.Domain/Auditing/IpPrefix.cs` | 37-40 | 6to4/NAT64 not mapped before /48 (WR-02) | ⚠️ Warning | Data-minimization bypass for 6to4 clients |
| `src/Csps.Infrastructure/Auditing/AuditTrail.cs` | 31-32 | `SaveChangesAsync` on the shared scoped context (WR-03) | ⚠️ Warning | Phase 4 callers could commit unrelated changes |
| `src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs` | 50 | substring blocklist, no server allow-list (WR-04) | ⚠️ Warning | Guard bypass |
| `src/Csps.Server/Logging/SensitiveDataMasking.cs` | 15-31 | Identity secret names not masked (WR-05) | ⚠️ Warning | Phase 4 risk (PasswordHash, SecurityStamp) |
| `src/Csps.Server/Http/CorrelationId.cs` | 20-22 | non-W3C fallback breaks the IRequestContext contract (WR-06) | ⚠️ Warning | An audit write on that path throws |
| `src/Csps.Server/Http/SecurityHeadersMiddleware.cs` | 24 | HSTS `includeSubDomains` on the legacy domain (WR-07) | ⚠️ Warning | Could break live subdomains once deployed |
| `src/Csps.Server/Logging/LogFileSettings.cs` | 46-54 | 30-file cap can evict 30-day retention (WR-08) | ⚠️ Warning | Log evasion under a flood |
| `tests/Csps.ArchitectureTests/HostingRecordTests.cs` | 37 | `"TBD"`/`"TODO"` appear as string literals in a detector list | ℹ️ Info | Not a debt marker (it is data, not a comment); no unreferenced TBD/FIXME/XXX found in phase files |
| `.planning/ROADMAP.md` | 164 | 01-13 described as "compatibility level re-pinned and re-proven" | ℹ️ Info | Inaccurate: the level stays 160, provisional (D-33) |
| `CLAUDE.md` (root) | - | Untracked in git; still says "2-year audit retention" (IN-09; D-32 is 8 months) | ℹ️ Info | A fresh clone lacks the shared-machine rules file |

Code review (01-REVIEW.md): 0 critical, 9 warnings, 9 info, **all still `open`** in 01-REVIEW-DISPOSITION.md. None blocks the phase goal. The warnings above are the confirmed ones the verifier checked against code (WR-02, WR-05, WR-09 re-read directly). They should be triaged (fixed or deferred with a reason) before `/gsd-ship 1`.

### Test Quality Audit

| Test File | Linked Req | Active | Skipped | Circular | Assertion Level | Verdict |
|-----------|-----------|--------|---------|----------|-----------------|---------|
| Persistence/MigrationTests, MigrationScriptTests | FND-01, FND-12 | 8 | 0 | No | Value (raw SQL reads) | OK |
| Health/HealthEndpointTests, HealthEndpointFailureTests | FND-06 | 8 | 0 | No | Value; content-type assertion vacuous (WR-09) | ⚠️ Insufficient (1 assertion) |
| Http/SecurityHeadersTests, ProblemDetailsTests, CspsProblemDetailsTests | SEC-01, FND-05 | 17 | 0 | No | Value + behavioral (real pipeline 500) | OK |
| Authorization/* | SEC-02 | 25 | 0 | No | Behavioral (real JWTs, discovered endpoints) | OK |
| Auditing/* (Domain + Infrastructure) | FND-10 | 53 | 0 | No | Value + DB behavioral (raw SQL refused) | OK |
| Logging/* | FND-07 | 14 | 0 | No | Value + behavioral (parallel ids) | OK |
| Security/DataProtectionTests | SEC-04 | 7 | 0 | No | Behavioral (two hosts) | OK |
| Time/*, Content/* | FND-08, FND-09 | 27 | 0 | No | Value (fixed vectors, fake clock) | OK |
| ArchitectureTests/* | FND-02/03, QUAL-01/06, FND-13 | 50 | 0 | No | Value (file/assembly rules) | OK |

**Disabled tests on requirements:** 0. **Circular patterns detected:** 0. **Insufficient assertions:** 1 (WR-09). That is a WARNING, because other assertions in the same tests cover the requirement.

### Human Verification Required

#### 1. Local full-stack run
**Test:** After preflight, run `dotnet run --project src/Csps.Server --launch-profile http` and request `GET http://localhost:5115/health`.
**Expected:** 200 with self, database and time-zone all `Healthy`. Stop the server afterwards.
**Why human:** Needs a running server. The verifier does not start servers.

#### 2. Scalar CSP browser check (assumption A7). NOT done yet
**Test:** With the `https` profile, open https://localhost:7028/scalar in Chrome and look at the DevTools console.
**Expected:** The reference renders, with zero CSP violations. Tighten the carve-out if `'unsafe-inline'` turns out to be unnecessary.
**Why human:** Browser CSP enforcement. This is the planned end-of-phase `<human-check>` from plan 01-06.

#### 3. Hosting record: 12 facts Unverified
**Test:** The owner reads the Facts table in `.planning/HOSTING-RECORD.md`.
**Expected:** The owner accepts that:
- the 9 probe facts are verified at the first real deploy (Phase 3)
- `model` compat stays Unverified
- DKIM and the Gmail pass are supplied before Phase 4
**Why human:** The goal says "verified record". It is honest, but only partly verified.

#### 4. Provisional compatibility pin
**Test:** Acknowledge `SqlCompatibility.Level = 160` (D-33), then add the re-pin to 170 to the ROADMAP cutover phases and fix ROADMAP line 164.
**Expected:** The re-pin is tracked by a roadmap criterion.
**Why human:** The re-pin is tracked only in CONTEXT D-33. The behavior is proven at 150, 160 and 170.

#### 5-8. Non-inferable backstop truths: unverified, held-out test recommended (reason: insufficient_spec)
- **FND-01 concurrency:** interrupt a migration, then re-run.
- **FND-12 concurrency:** make a script batch fail inside the second migration, then re-apply.
- **FND-07 multi-process:** two processes write the same `shared: true` log file.
- **SEC-04 concurrency:** two hosts start at the same moment against an empty key ring.

The completion line for these reads: "complete with 4 unverified non-inferable checks".

#### 9. License prohibition vs the Microsoft exception
**Test:** Confirm the owner's Option A approval (2026-10-07). Then either add the override shown above or plan a substitute, and mention the exception in CLAUDE.md's license line.
**Why human:** Flagged prohibition. The approval appears only in executor-written docs.

#### 10. Partially enforced prohibitions (WR-02 6to4 IP, WR-04 dev-seed server allow-list)
**Test:** Decide whether to fix these now or defer them with a recorded reason.
**Why human:** These are confirmed bypasses of must-NOT rules.

#### 11. Judgment-tier prohibitions (7)
**Test:** Review the non-authoritative verdicts in the Prohibitions table.
**Why human:** A judgment-tier prohibition is never silently passed.

### Gaps Summary

No must-have is FAILED, no artifact is MISSING or a STUB, no key link is NOT_WIRED, and there are no unreferenced debt markers. The verifier independently confirmed the core technical claims:
- 0-warning build, 501/501 tests, format clean
- coverage gate passes and can fail
- migrations applied on the dev and E2E databases with no leftovers
- the idempotent script applies twice even at level 150

So the onion API, the platform contract and the shared primitives are delivered and wired.

The phase is not `passed` for three reasons:
1. **Hosting record:** "a verified record of the SmarterASP.NET hosting facts" is only partly true. 12 of 31 facts are honestly Unverified because the Basic plan allows no probe site. The compatibility level stays at the provisional 160 (D-33), and the re-pin is tracked outside the ROADMAP.
2. **Backstops:** four non-inferable concurrency truths (FND-01, FND-12, FND-07 multi-process, SEC-04) have no explicit evidence, so the verifier abstained (insufficient_spec). SEC-02's backstop does have a passing parallel test.
3. **Flagged prohibitions and manual checks:**
   - the license prohibition conflicts with the owner-approved Microsoft exception
   - two test-tier prohibitions have confirmed bypasses (WR-02, WR-04)
   - seven judgment-tier prohibitions carry only LLM verdicts
   - the Scalar browser check and the local `dotnet run` have not been done

All 18 code-review findings remain `open` and should be dispositioned before shipping.

---

_Verified: 2026-10-07T22:02:13Z_
_Verifier: Claude (gsd-verifier)_
