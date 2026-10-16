---
phase: 03-ci-cd-staging-deploy
plan: 08
subsystem: infra
tags: [iis, web-config, publish, win-x64, lock-files, runtime-identifiers, urlcompression, breach, nuget-license]
created: "2026-10-15T23:09:00-05:00"
updated: "2026-10-15T23:09:00-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-RESEARCH Pattern 3 and Pitfalls 1 and 2 (dev logs ship in the package; a RID publish breaks the locked restore)"
provides:
  - "web.config that turns IIS compression off (urlCompression static and dynamic false), keeps in-process hosting and carries no rewrite section"
  - "Server csproj that removes logs and appsettings.Development.json from the publish output"
  - "RuntimeIdentifiers win-x64 for the src projects, with the four src lock files carrying the net10.0/win-x64 section so CI's locked restore passes"
  - "PublishOutputTests: a real Release win-x64 publish with a sentinel log proves what ships"
affects: [03-13, 03-20, 03-21, deploy-workflow]

actuals:
  tokens: 6200
  tasks: 2
  commits: 4
plan_head_before: 4840c1a2372a593185ac52754a02c29b97e0739d
plan_head_after: 0bb75bd454281c08d2e448d674befa5039406d35

tech-stack:
  added: []
  patterns:
    - "Tests that run dotnet build or publish on the Server project share one xUnit collection (DotnetBuildCollection) so they never race on obj/"
    - "Package content is proven by a real publish into a temp folder with a git-ignored sentinel file, cleaned in finally"

key-files:
  created:
    - tests/Csps.ArchitectureTests/PublishOutputTests.cs
  modified:
    - src/Csps.Server/web.config
    - tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs
    - src/Csps.Server/Csps.Server.csproj
    - Directory.Build.props
    - tests/Csps.ArchitectureTests/ReleaseHasNoEmailSinkTests.cs
    - src/Csps.Domain/packages.lock.json
    - src/Csps.Application/packages.lock.json
    - src/Csps.Infrastructure/packages.lock.json
    - src/Csps.Server/packages.lock.json

key-decisions:
  - "No httpCompression and no staticContent clientCache in web.config: httpCompression is often locked on shared hosts and ANCM serves every path, so caching stays in the app."
  - "RuntimeIdentifiers goes in the src-only block of Directory.Build.props, so test and tool projects keep their lock files unchanged."
  - "The build and publish proofs share one xUnit collection so two dotnet processes never write the Server project's obj folder at once."

requirements-completed: [OPS-05, OPS-04]

coverage:
  - id: D1
    description: "The shipped web.config turns IIS static and dynamic compression off, keeps in-process hosting, the banner removal and the 1 MiB request limit, and has no rewrite section"
    requirement: OPS-05
    verification:
      - kind: unit
        ref: "tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs#TurnsIisCompressionOff, HasNoRewriteSectionYet, HostsInProcess, RemovesTheServerHeader, LimitsRequestBodiesToOneMebibyte, RemovesXPoweredBy"
        status: pass
      - kind: integration
        ref: "dotnet publish src/Csps.Server -c Release; grep urlCompression and hostingModel=inprocess in the published web.config (1 and 1)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A Release win-x64 framework-dependent publish holds no logs folder and no appsettings.Development.json and still holds appsettings.json, web.config and Csps.Server.dll"
    requirement: OPS-05
    verification:
      - kind: integration
        ref: "tests/Csps.ArchitectureTests/PublishOutputTests.cs#PublishHasNoDevLogsOrDevelopmentSettings"
        status: pass
    human_judgment: false
  - id: D3
    description: "The four src projects declare win-x64, their lock files carry the win-x64 section, a locked restore passes, and the license gate and THIRD-PARTY-NOTICES.md are current"
    requirement: OPS-04
    verification:
      - kind: other
        ref: "dotnet restore Csps.slnx --locked-mode (exit 0)"
        status: pass
      - kind: other
        ref: "tools/scripts/New-ThirdPartyNotices.ps1 (license gate passed, THIRD-PARTY-NOTICES.md unchanged)"
        status: pass
      - kind: integration
        ref: "dotnet test --solution Csps.slnx (2146 passed, 1 skipped, 0 failed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Whether SmarterASP.NET lets the site's web.config set urlCompression (a locked section gives 500.19) and whether URL Rewrite exists on the host"
    requirement: OPS-05
    verification: []
    human_judgment: true
    rationale: "Assumptions A4 and A5 cannot be proven before the host is reached. The host probe (plan 03-20) checks both before the first CSPS deploy; until then they are unverified, not passed."

duration: 8min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 08: Package contents and IIS hosting Summary

**The web.config now tells IIS never to compress (the app already compresses safely, never JSON), and the win-x64 publish can no longer carry developer logs or Development settings, with the four src lock files regenerated so CI's locked restore and the package build agree.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-16T04:01:00Z
- **Completed:** 2026-10-16T04:09:00Z
- **Tasks:** 2
- **Files modified:** 10 (1 new)

## Accomplishments

- `web.config` gained `<urlCompression doStaticCompression="false" doDynamicCompression="false" />` after `</httpProtocol>` and a rewritten header comment (the app does the HTTPS redirect, HSTS, compression and caching). It still holds `inprocess` hosting, `removeServerHeader`, the 1 MiB request limit and the X-Powered-By removal, and has no `<rewrite>` section. A real `dotnet publish` confirmed the published file holds `urlCompression` and `hostingModel="inprocess"`.
- `Csps.Server.csproj` removes `logs\**` from Content and None and sets `CopyToPublishDirectory="Never"` on `appsettings.Development.json`. The local `src/Csps.Server/logs` folder is 107 MB; none of it reaches a publish now.
- `Directory.Build.props` declares `RuntimeIdentifiers` win-x64 in the src-only block. `dotnet restore Csps.slnx --force-evaluate` then `--locked-mode` both succeed.
- `PublishOutputTests` runs a real Release `-r win-x64 --self-contained false` publish with a sentinel log file and asserts no `logs` folder, no `appsettings.Development.json`, and `appsettings.json`, `web.config` and `Csps.Server.dll` present. It cleans the sentinel and the temp folder in `finally`.

## Task Commits

1. **Task 1: Tracer, IIS never compresses and has no rewrite yet** - `e5bc904` (test, RED), `a7411ec` (feat, GREEN)
2. **Task 2: win-x64 publish excludes dev logs and Development settings** - `d5337d5` (test, RED), `0bb75bd` (feat, GREEN)

**Plan metadata:** recorded in the docs(03-08) commits that add this file and update STATE and ROADMAP.

## Lock files changed

Every one gained a `"net10.0/win-x64"` section and nothing else (no version moved, no package id added):

- `src/Csps.Domain/packages.lock.json` - empty win-x64 section
- `src/Csps.Application/packages.lock.json` - empty win-x64 section
- `src/Csps.Infrastructure/packages.lock.json` - 36 lines: Microsoft.Data.SqlClient 6.1.7, Microsoft.Data.SqlClient.SNI.runtime 6.0.3, Microsoft.Identity.Client.NativeInterop 0.20.6, System.Security.Cryptography.Pkcs 10.0.13
- `src/Csps.Server/packages.lock.json` - the same 36 lines

No test or tool project lock file changed. All four packages were already pinned; SNI.runtime 6.0.3 and NativeInterop 0.20.6 are the two registered Microsoft license exceptions, and the license gate reported both as allowed. `THIRD-PARTY-NOTICES.md` regenerated byte-identical (88 packages), so it needed no commit.

## TDD Gate Compliance

RED and GREEN commits exist for both tasks, in order; no refactor commit was needed.

- **Cycle 1 RED (`e5bc904`):** `TurnsIisCompressionOff` failed with "should have single item but had 0" (the planned assertion); `HasNoRewriteSectionYet` and the four existing facts passed.
- **Cycle 2 RED (`d5337d5`):** `PublishHasNoDevLogsOrDevelopmentSettings` failed on "The package must not carry a logs folder" with the sentinel in place, which is the intended reason.

## Files Created/Modified

- `src/Csps.Server/web.config` - urlCompression off, new header comment
- `tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs` - TurnsIisCompressionOff, HasNoRewriteSectionYet
- `src/Csps.Server/Csps.Server.csproj` - OPS-05 item group for logs and Development settings
- `Directory.Build.props` - RuntimeIdentifiers win-x64 (src-only block)
- `tests/Csps.ArchitectureTests/PublishOutputTests.cs` - real win-x64 publish proof, plus the `DotnetBuildCollection` name
- `tests/Csps.ArchitectureTests/ReleaseHasNoEmailSinkTests.cs` - joins the shared collection
- `src/Csps.{Domain,Application,Infrastructure,Server}/packages.lock.json` - win-x64 section

## Decisions Made

- No `httpCompression` and no `staticContent` clientCache in web.config (httpCompression is often locked on shared hosts; ANCM serves every path, so caching stays in the app).
- `RuntimeIdentifiers` sits in the src-only block, so test and tool projects keep their lock files.
- The two dotnet-process tests share one xUnit collection.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Serialize the two tests that run dotnet on the Server project**
- **Found during:** Task 2 (RED)
- **Issue:** `ReleaseHasNoEmailSinkTests` (`dotnet build`) and the new `PublishOutputTests` (`dotnet publish -r win-x64`) both write `src/Csps.Server/obj` and can run in parallel in one assembly, which could corrupt `project.assets.json` mid-restore.
- **Fix:** Both classes carry `[Collection(DotnetBuildCollection.Name)]`; the collection name is a constant beside `PublishOutputTests`.
- **Files modified:** tests/Csps.ArchitectureTests/PublishOutputTests.cs, tests/Csps.ArchitectureTests/ReleaseHasNoEmailSinkTests.cs
- **Verification:** Architecture tests pass alone (32 s) and in the full solution run.
- **Committed in:** `d5337d5`

---

**Total deviations:** 1 auto-fixed (1 blocking). **Impact on plan:** one attribute on an existing test class; no scope change.

## Issues Encountered

- My first csproj edit dropped the trailing space of `<ProjectReference ` and produced MSB4025 on the next restore; fixed before any commit (the `0bb75bd` csproj is correct and the restore, locked restore and full suite ran on it).
- The RED publish rewrote the four lock files in the working tree before GREEN; they were left out of the RED commit and committed with GREEN.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. The change removes sources of disclosure (T-03-34, T-03-35, T-03-36 mitigated; T-03-37 mitigated by the reviewed lock-file diff, the locked restore and the license gate); it adds no endpoint, auth path or file access.

## Next Phase Readiness

- Plan 03-13 can add its fail-closed package-content check and gitleaks scan on top of a package that already excludes logs and Development settings.
- Plan 03-20 (host probe) must check assumptions A4 (URL Rewrite module) and A5 (site web.config may set `urlCompression`; a locked section gives 500.19). Until then both are unverified. If A5 fails, the `urlCompression` element is the one to remove, and `WebConfigTests.TurnsIisCompressionOff` with it.
- Not proven here: how the real host reacts to this web.config.

## Self-Check: PASSED

- `PublishOutputTests.cs` exists; commits `e5bc904`, `a7411ec`, `d5337d5` and `0bb75bd` are on the branch.
- Acceptance: `doDynamicCompression="false"` count 1; `<rewrite` count 0; `CopyToPublishDirectory="Never"` count 1; `<RuntimeIdentifiers>win-x64</RuntimeIdentifiers>` count 1; `win-x64` in the Server lock file count 1 or more.
- `dotnet restore Csps.slnx --locked-mode` exit 0; `dotnet test --solution Csps.slnx`: 2147 total, 2146 passed, 1 skipped (opt-in live HIBP test), 0 failed.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-15*
