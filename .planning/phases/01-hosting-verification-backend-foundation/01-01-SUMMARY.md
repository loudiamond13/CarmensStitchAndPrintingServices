---
phase: 01-hosting-verification-backend-foundation
plan: 01
subsystem: infra
tags: [dotnet10, onion, minimal-api, health-checks, xunit-v3, mtp, archunitnet, central-package-management, banned-api-analyzers]

# Dependency graph
requires: []
provides:
  - "Csps.slnx strict onion solution: src/Csps.Domain, Csps.Application, Csps.Infrastructure, Csps.Server; tests/Csps.Testing, Csps.Server.IntegrationTests, Csps.ArchitectureTests"
  - "Directory.Build.props (TreatWarningsAsErrors, MSBuildTreatWarningsAsErrors, latest-recommended, NuGetAudit all, lock files) and Directory.Packages.props with every Phase 1 pin"
  - "BannedSymbols.txt (RS0030) banning DateTime.Now/UtcNow/Today, DateTimeOffset.Now/UtcNow, System.Random"
  - "Anonymous GET /health with MinimalHealthWriter (status + checks[{name,status}], Cache-Control no-store)"
  - "CspsApiFactory (WebApplicationFactory<Program>, Testing env, https://localhost, ConfigureSettings hook for UseSetting)"
  - "Csps.ArchitectureTests: LayerTests, SolutionLayoutTests, BuildConfigTests, DependencyRegistryTests"
  - "docs/dependencies.json registry (26 entries) + docs/dependencies.md owner explainer"
  - "Local tool manifest: dotnet-ef 10.0.12, reportgenerator 5.5.11, nuget-license 4.0.18"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10, 01-11, 01-12, 01-13, every later phase]

# Actuals (#2632)
actuals:
  tokens: 60181    # chars/4 over all changed files (240,725 chars; 78,683 chars / ~19,671 tokens excluding generated packages.lock.json)
  tasks: 3
  commits: 3
plan_head_before: 46faceb80a384b2ddccf78a1befdeaa138a2267c
plan_head_after: 9703566960fbad0d58146a07dee053c9567cef5b

# Tech tracking
tech-stack:
  added:
    - "Microsoft.CodeAnalysis.BannedApiAnalyzers 5.6.0 (GlobalPackageReference)"
    - "EF Core SqlServer/Design 10.0.12, DataProtection.EntityFrameworkCore 10.0.12, Caching.Hybrid 10.10.0 (Infrastructure)"
    - "OpenApi 10.0.12, Scalar.AspNetCore 2.17.8, Serilog.AspNetCore 10.0.0, Serilog.Sinks.File 7.0.0, JwtBearer 10.0.12 (Server)"
    - "xunit.v3 4.0.1, xunit.v3.extensibility.core 4.0.1, xunit.runner.visualstudio 4.0.0, Microsoft.NET.Test.Sdk 18.10.1, Shouldly 4.3.0"
    - "Mvc.Testing 10.0.12, Testcontainers.MsSql 4.15.0, Respawn 7.0.0, TimeProvider.Testing 10.10.0, NSubstitute 6.2.0, coverlet.MTP 10.0.1"
    - "TngTech.ArchUnitNET 0.13.4 + TngTech.ArchUnitNET.xUnitV3 0.13.4"
  patterns:
    - "All package versions live only in Directory.Packages.props; csproj PackageReference has no Version"
    - "Every pin/tool needs a sorted, complete docs/dependencies.json entry (enforced by DependencyRegistryTests)"
    - "Test projects = name ends with Tests (tests/Directory.Build.props makes them MTP Exe with xunit.v3 + Shouldly)"
    - "Csps.Testing is a class library holding fixtures; it references xunit.v3.extensibility.core, not xunit.v3"
    - "Public src types need XML summaries (GenerateDocumentationFile under src/ makes CS1591 an error)"
    - "Test method names are PascalCase (no underscores)"

key-files:
  created:
    - global.json
    - Directory.Build.props
    - Directory.Packages.props
    - BannedSymbols.txt
    - .editorconfig
    - .config/dotnet-tools.json
    - Csps.slnx
    - src/Csps.Server/Program.cs
    - src/Csps.Server/Endpoints/HealthEndpoint.cs
    - src/Csps.Server/Http/MinimalHealthWriter.cs
    - src/Csps.Server/Properties/launchSettings.json
    - tests/Directory.Build.props
    - tests/Csps.Testing/CspsApiFactory.cs
    - tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs
    - tests/Csps.ArchitectureTests/LayerTests.cs
    - tests/Csps.ArchitectureTests/SolutionLayoutTests.cs
    - tests/Csps.ArchitectureTests/BuildConfigTests.cs
    - tests/Csps.ArchitectureTests/DependencyRegistry.cs
    - tests/Csps.ArchitectureTests/DependencyRegistryTests.cs
    - tests/Csps.ArchitectureTests/PackagePins.cs
    - tests/Csps.ArchitectureTests/RepoRoot.cs
    - docs/dependencies.json
    - docs/dependencies.md
  modified:
    - .gitignore

key-decisions:
  - "Owner approved the full Phase 1 package list (plan 01-01 Task 1, package legitimacy gate) on 2026-10-07 before the first restore, incl. xunit.v3.extensibility.core 4.0.1, Scalar.AspNetCore 2.17.8 and coverlet.MTP 10.0.1; recorded under approvals in docs/dependencies.json"
  - "Registry scope vocabulary is runtime|build|test|tool|font; D-18 exceptions are scoped MPL-2.0 -> test and OFL-1.1 -> font"
  - ".editorconfig has no end_of_line rule (core.autocrlf=true on this machine, LF on CI); dotnet format stays green on both"
  - "Csps.Server is not barred from referencing EF Core assemblies by a reflection rule, because a later ProblemDetails 409 mapping may need DbUpdateConcurrencyException; only the PRD layer rules are enforced"

patterns-established:
  - "Pin + registry pairing: changing a pin without the registry (or vice versa) fails DependencyRegistryTests, so two such branches cannot both merge green"
  - "RED evidence for .NET: xUnit v3 --report-xunit-junit output validated with gsd check tdd-red-evidence (target = fully qualified test name)"

requirements-completed: [FND-02, FND-03, QUAL-01, QUAL-06]

coverage:
  - id: D1
    description: "Strict, zero-warning onion solution Csps.slnx replaces the VS scaffold; ports 5115/7028 kept without SpaProxy"
    requirement: FND-02
    verification:
      - kind: other
        ref: "dotnet build Csps.slnx -tl:off (two consecutive runs: 0 Warning(s), 0 Error(s))"
        status: pass
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/SolutionLayoutTests.cs#SolutionListsTheFourProductionProjects, EveryProjectOnDiskIsListedInTheSolution, VisualStudioScaffoldIsGone, LaunchSettingsUseTheProjectPortsWithoutSpaProxy"
        status: pass
    human_judgment: false
  - id: D2
    description: "Anonymous GET /health returns 200 minimal liveness JSON with Cache-Control: no-store and no internals"
    requirement: FND-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs#ReturnsHealthyLivenessJson, IsNotCacheable, ExposesNoInternals"
        status: pass
    human_judgment: false
  - id: D3
    description: "Onion layer rules (ArchUnitNET + reflection + csproj package rules)"
    requirement: FND-03
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/LayerTests.cs (8 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Strict build configuration, banned APIs, exact pins and forbidden-package scan"
    requirement: QUAL-01
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/BuildConfigTests.cs (15 tests; mutations 2 and 3 shown failing)"
        status: pass
      - kind: other
        ref: "dotnet format Csps.slnx --verify-no-changes (exit 0)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Dependency registry with 14-day cool-down, license allow-list, sorting/duplicate, empty/missing and pin-mismatch rules"
    requirement: QUAL-06
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/DependencyRegistryTests.cs (31 tests incl. ExactlyFourteenDaysCountsAsAged, ThirteenDaysIsNotAged, MissingOrEmptyRegistryFails, UnsortedEntriesFail, DuplicateIdsFail; mutation 1 shown failing)"
        status: pass
    human_judgment: false
  - id: D6
    description: "docs/dependencies.md explains licenses, free status and the cool-down to the owner in plain words"
    requirement: QUAL-06
    verification: []
    human_judgment: true
    rationale: "Plain-language readability for the owner (PC-7) is a human judgment; greps only prove the key words are present"

# Metrics
duration: 14min
completed: 2026-10-07
status: complete
---

# Phase 1 Plan 01: Walking-Skeleton Build Summary

**Strict zero-warning .NET 10 onion solution (Csps.slnx) serving an anonymous minimal `/health` through WebApplicationFactory, guarded by ArchUnitNET layer rules, build-config checks and a cool-down-enforcing dependency registry**

## Performance

- **Duration:** 14 min (continuation run, after the owner approval checkpoint)
- **Started:** 2026-10-07T13:33:19Z
- **Completed:** 2026-10-07T13:47:00Z
- **Tasks:** 3 (Task 1 checkpoint approved, Tasks 2 and 3 executed)
- **Files modified:** 43 (incl. 7 packages.lock.json)

## Accomplishments

- The VS template scaffold is gone. `Csps.slnx` holds the four onion projects plus `Csps.Testing`, `Csps.Server.IntegrationTests` and `Csps.ArchitectureTests`. It builds with 0 warnings on two consecutive runs.
- `GET /health` is anonymous and returns `{"status":"Healthy","checks":[{"name":"self","status":"Healthy"}]}` with `Cache-Control: no-store` (D-23). The full ASP.NET Core pipeline is covered by three integration tests.
- Every Phase 1 package and tool is pinned centrally to an aged version, and `RS0030` bans the wall-clock and `System.Random` APIs. The ban was checked: a probe using `DateTime.Now` failed the build.
- `Csps.ArchitectureTests` (59 tests) covers the layer, layout, build-config and dependency-registry rules. Each rule class was shown to fail on a deliberate violation.

## Task Commits

1. **Task 1: Owner approves the package list (package legitimacy gate).** No commit; this was a checkpoint. The owner replied "approved" on 2026-10-07 for the full list as presented. The approval is recorded in `docs/dependencies.json` under `approvals`.
2. **Task 2: Tracer, strict onion solution answers GET /health**
   - RED: `22ee672` (test)
   - GREEN: `58109e0` (feat)
3. **Task 3: Architecture, build-config and dependency-registry tests:** `9703566` (test)

**Plan metadata:** recorded in the final docs commit.

## TDD Evidence

- **RED:** `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*HealthEndpointTests"` exited 2, and all 3 tests failed on `response.StatusCode should be OK but was NotFound`. Program.cs mapped no endpoints, the solution compiled cleanly, and the failure was an assertion, not a load failure. The target-only run (`--filter-method "*ReturnsHealthyLivenessJson" --report-xunit-junit`) was checked with `gsd check tdd-red-evidence` and returned `RED_EVIDENCE_OK` (reason `target_test_failed`).
- **GREEN:** after `MinimalHealthWriter`, `HealthEndpoint.MapCspsHealth` and the `self` check were added, 3/3 passed with exit 0.
- **REFACTOR:** none needed.
- **Tracer gate:** auto mode was on and the task had no `gate` attribute (row 2). The tracer `<verify>` was re-run end to end: build 0 warnings ×2, health tests 3/3, `dotnet format --verify-no-changes` exit 0. The tracer passed, so Task 3 went ahead.

## A14 (MTP filter passthrough)

- `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*HealthEndpointTests"` reached xUnit and ran exactly 3 tests.
- `--filter-class "*NoSuchClassXyz"` ran 0 tests and **exited 8** ("zero tests ran"), so a filter that matches nothing fails the run.
- Note: xUnit v3's report switches are `--report-xunit-junit` / `--report-xunit-trx`, not `--report-junit`. The short form exits 5 (invalid arguments).

## Mutation Runs (Task 3, each reverted right after)

| # | Mutation | Command | Result |
|---|----------|---------|--------|
| 1 | Removed the `Respawn` entry from docs/dependencies.json | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DependencyRegistryTests"` | Exit 2. `RepositoryRegistryCoversEveryPinWithACompleteEntry` failed with `["Respawn 7.0.0 (PackageVersion) has no registry entry."]`. 30/31 passed. |
| 2 | Added `<PackageVersion Include="Microsoft.AspNetCore.SpaProxy" Version="10.0.12" />` | `... --filter-class "*BuildConfigTests"` | Exit 2. `NoForbiddenPackageIsReferenced` failed with `["Microsoft.AspNetCore.SpaProxy"]`. |
| 3 | Deleted `<TreatWarningsAsErrors>` from Directory.Build.props | `... --filter-class "*BuildConfigTests"` | Exit 2. `DirectoryBuildPropsSetsStrictProperty(property: "TreatWarningsAsErrors", expected: "true")` failed. |

After each revert, `git diff` was empty for the mutated file and the class passed again.

## Files Created/Modified

- `global.json`: SDK 10.0.401, latestPatch, and the Microsoft.Testing.Platform runner.
- `Directory.Build.props`: strict settings for every project (QUAL-01), plus `MSBuildTreatWarningsAsErrors`.
- `Directory.Packages.props`: central pins for the whole phase, plus the BannedApiAnalyzers GlobalPackageReference.
- `BannedSymbols.txt`: the six RS0030 entries.
- `.editorconfig`: code style plus the root-relative `[src/Csps.Infrastructure/Persistence/Migrations/**.cs] generated_code = true` section.
- `.config/dotnet-tools.json`: dotnet-ef, reportgenerator and nuget-license, all local only.
- `.gitignore`: adds `logs/`, `artifacts/`, `*.pfx`, `*.pem` and `*.key`. Every existing entry is kept.
- `src/Csps.{Domain,Application,Infrastructure}`: projects plus documented `AssemblyMarker`. Infrastructure carries the EF, DataProtection and Hybrid packages and the ASP.NET Core FrameworkReference.
- `src/Csps.Server`: `Program.cs`, `Endpoints/HealthEndpoint.cs`, `Http/MinimalHealthWriter.cs`, launchSettings (5115/7028) and appsettings with no secrets.
- `tests/Directory.Build.props`: MTP and xUnit v3 wiring for `*Tests` projects.
- `tests/Csps.Testing/CspsApiFactory.cs`: the in-memory API host for tests.
- `tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs`: 3 tests.
- `tests/Csps.ArchitectureTests/*`: the rule tests plus helpers `RepoRoot`, `PackagePins` and `DependencyRegistry`, which is a pure validator.
- `docs/dependencies.json`, `docs/dependencies.md`: the registry and the owner explainer.
- Seven `packages.lock.json` files.

## Decisions Made

- The owner approval (Task 1) is recorded in the registry's top-level `approvals` array, which the validator ignores. That keeps the record in the repo without changing the entry schema.
- Registry entry `scope` takes `runtime|build|test|tool|font`. MPL-2.0 is allowed only for `test` and OFL-1.1 only for `font`, the D-18 scopes. Any other license outside the allow-list fails.
- OpenApi and Scalar are scoped `runtime`: their assemblies ship, even though they are only mapped in Development.
- `.editorconfig` has no `end_of_line` rule, so `dotnet format` stays line-ending-neutral on Windows (autocrlf) and on Linux CI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added two helper files to Csps.ArchitectureTests**
- **Found during:** Task 3
- **Issue:** BuildConfigTests and DependencyRegistryTests both need to parse the pins. The registry rules also needed a pure validator, so the edge cases (14 vs 13 days, empty, unsorted, duplicates, mismatch) could be tested on in-memory JSON without touching real files.
- **Fix:** Added `tests/Csps.ArchitectureTests/PackagePins.cs` (props and tool-manifest parser) and `DependencyRegistry.cs` (validator). Neither file was in the plan's file list.
- **Verification:** 31 DependencyRegistryTests pass, and mutation 1 fails as expected.
- **Committed in:** `9703566`

**2. [Rule 3 - Blocking] Shell heredocs halved doubled backslashes**
- **Found during:** Task 3 (first build of Csps.ArchitectureTests)
- **Issue:** The Windows bash round-trip turned the `'\\'` literals in SolutionLayoutTests.cs into `'\'` (CS1010/CS1012).
- **Fix:** Restored the literals with the Edit tool and wrote the remaining files with the Write tool. I checked every heredoc-written file for damaged backslashes. Directory.Build.props uses single backslashes (`'\src\'`) and was unaffected.
- **Committed in:** `9703566` (fixed before the commit)

---

**Total deviations:** 2 auto-fixed (2 blocking).
**Impact on plan:** No scope creep. Both changes were needed to finish Task 3 as specified.

## Issues Encountered

- `--report-junit` is not an xUnit v3 MTP switch (exit 5). The right switch is `--report-xunit-junit`. Its report lands in the repo-root `TestResults/`, which is gitignored.
- `gsd check tdd-red-evidence` matches JUnit targets by the fully qualified test name, not the bare method name. Using the bare name returned INVALID_RED `no_target_test_failure`. With the full name it returned `RED_EVIDENCE_OK`.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Wave 2+ plans can add code without touching `Directory.Packages.props` or the existing projects' package references. Every Phase 1 pin and PackageReference is already in place, so the lock files of the existing projects stay stable.
- Plan 11 is expected to tighten SolutionLayoutTests to the exact final project set.
- The preflight ran clean: ports 5180/5115/7028/5199 free, no TheBETSLLC test processes. No LocalDB or SQL was used in this plan.

## Self-Check: PASSED

- All 23 key files created and the 7 lock files exist on disk.
- Commits `22ee672`, `58109e0` and `9703566` are present on `gsd/phase-1-hosting-verification-backend-foundation`.
- All acceptance criteria for Tasks 2 and 3 were re-run and PASS. Plan verification: build 0 warnings / 0 errors, ArchitectureTests 59/59, IntegrationTests 3/3, `dotnet format --verify-no-changes` exit 0.

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*
