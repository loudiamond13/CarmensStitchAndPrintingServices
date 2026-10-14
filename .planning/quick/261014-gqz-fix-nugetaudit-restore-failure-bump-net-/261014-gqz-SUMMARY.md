---
created: 2026-10-14T12:30:00-05:00
updated: 2026-10-14T12:30:00-05:00
phase: quick-261014-gqz
plan: 01
subsystem: dependencies
tags: [nuget, security, nugetaudit, dotnet-10.0.13, license-gate]
requires: []
provides:
  - "Restore, build and the full .NET suite green again with NuGetAudit still an error"
  - "Patched System.Security.Cryptography.Pkcs and .Xml 10.0.13 pinned centrally"
affects: [Directory.Packages.props, .config/dotnet-tools.json, docs/dependencies.json, docs/license-exceptions.json, THIRD-PARTY-NOTICES.md]
tech-stack:
  added: []
  patterns: ["Central transitive pin (CentralPackageTransitivePinningEnabled) to lift a vulnerable transitive package"]
key-files:
  created: []
  modified:
    - Directory.Packages.props
    - .config/dotnet-tools.json
    - docs/dependencies.json
    - docs/dependencies.md
    - docs/license-exceptions.json
    - THIRD-PARTY-NOTICES.md
    - .claude/CLAUDE.md
    - "7 packages.lock.json files (Infrastructure, Server, ArchitectureTests, Infrastructure.IntegrationTests, Server.IntegrationTests, Testing, DevSeed)"
decisions:
  - "Owner 2026-10-14: all 10.0.12 pins and dotnet-ef to 10.0.13, Pkcs and Xml pinned at 10.0.13, with security-fix cool-down exceptions"
  - "Owner 2026-10-14: approved the transitive moves SqlClient 6.1.7, SNI.runtime 6.0.3 (license exception moved to 6.0.3) and Microsoft.OpenApi 2.12.2"
metrics:
  duration: "about 25 minutes"
  completed: 2026-10-14
status: complete
actuals:
  tokens: 40000
  tasks: 2
  commits: 2
plan_head_before: 8d136018e1e04ee68ed539baf6bf1bfc4933b7bf
plan_head_after: 190fc19f329f9239b9a0106d34f182ab5865384b
---

# Phase quick-261014-gqz Plan 01: NuGetAudit restore fix (10.0.13 security update) Summary

Seven .NET pins and dotnet-ef moved to 10.0.13, with central Pkcs and Xml 10.0.13 pins, so restore passes with NuGetAudit still an error and no vulnerable package remains in any project.

## Commits

- `0d12439` fix(quick-261014-gqz): bump .NET packages to 10.0.13 and pin patched crypto packages (props, tool manifest, registry, 7 lock files)
- `190fc19` docs(quick-261014-gqz): regenerate notices and record the 10.0.13 security update (license exception, notices, dependencies.md, .claude/CLAUDE.md)

## Red evidence (restore before the change)

```
Csps.Infrastructure.csproj : error NU1902/NU1903: System.Security.Cryptography.Pkcs 9.0.11 (GHSA-2fmv-rv2c-59x7 moderate, GHSA-846f-f764-76mx high)
Csps.DevSeed.csproj : error NU1902/NU1903: System.Security.Cryptography.Pkcs 10.0.12 (same two advisories)
Csps.DevSeed.csproj : error NU1903: System.Security.Cryptography.Xml 10.0.12 (GHSA-7hqp-7c5m-4vq6, GHSA-c399-9853-6jmj, GHSA-r955-8q5j-3h83)
```

## Pin-necessity finding

- Microsoft.Data.SqlClient 6.1.7 (and 6.1.6 before it) still asks for System.Security.Cryptography.Pkcs 9.0.11. The central Pkcs pin is what lifts it to 10.0.13, so that pin is required.
- Microsoft.AspNetCore.DataProtection 10.0.13 now asks for System.Security.Cryptography.Xml 10.0.13 by itself, and Xml asks for Pkcs 10.0.13. The Xml pin is defense in depth. Both pins stay, as the owner approved.

## dotnet-ef

Bumped to 10.0.13. `dotnet tool run dotnet-ef --version` reports 10.0.13, and nuget.org shows it published 2026-10-13T17:09Z. `rollForward: false` kept.

## Deviations from Plan

### Owner-approved scope addition

**1. [Rule 4 - owner decision] Three transitive moves outside the 10.0.13 set**
- **Found during:** Task 1, step 5 (lock-file check). The executor stopped and reported; the owner approved all three in chat on 2026-10-14.
- **Moves:** Microsoft.Data.SqlClient 6.1.6 to 6.1.7 (published 2026-09-10), Microsoft.Data.SqlClient.SNI.runtime 6.0.2 to 6.0.3 (2026-08-14, same license terms), Microsoft.OpenApi 2.12.0 to 2.12.2 (2026-08-20, MIT). None has an advisory, all are past 14 days, so no cool-down exception was needed.
- **Why they moved:** EF Core SqlServer 10.0.13 asks for SqlClient 6.1.7, which asks for SNI.runtime 6.0.3. Microsoft.AspNetCore.OpenApi 10.0.13 asks for Microsoft.OpenApi 2.12.2.
- **Follow-on edits:** `docs/license-exceptions.json` SNI.runtime entry moved to 6.0.3 (version, licenseUrl, pulledInBy, approved 2026-10-14); the "Free only" line in `.claude/CLAUDE.md` now names SNI.runtime 6.0.3 (root `CLAUDE.md` does not mention the version); the approval and a plain-words bullet are in `docs/dependencies.json` and `docs/dependencies.md`. These packages are transitive, so they have no registry records (the registry test covers only direct pins).
- **Files:** docs/license-exceptions.json, docs/dependencies.json, docs/dependencies.md, .claude/CLAUDE.md, lock files.
- **Commits:** 0d12439, 190fc19

No other deviations.

## Verification

- `dotnet restore Csps.slnx` and `--locked-mode`: exit 0, no NU19xx.
- `dotnet build Csps.slnx -tl:off`: 0 Warning(s), 0 Error(s).
- Lock-file checks: Pkcs and Xml resolve to 10.0.13 everywhere; no new package ids; no csproj or migration change; no `10.0.12` left in `Directory.Packages.props` (8 entries at 10.0.13) or as a version in `docs/dependencies.json` (10 mentions of 261014-gqz).
- License gate (`New-ThirdPartyNotices.ps1`): passed, 2 owner-approved exceptions (SNI.runtime 6.0.3, NativeInterop 0.20.6). `allowed-licenses.json` and `license-guesses.json` unchanged.
- THIRD-PARTY-NOTICES.md: 71 packages before and after (no count change). Pkcs moved 9.0.11 to 10.0.13; Xml did not appear (the shared framework prunes it). The remaining `System.Security.Cryptography.ProtectedData 9.0.11` row is not flagged by the audit.
- `dotnet list Csps.slnx package --vulnerable --include-transitive`: all 12 projects report "has no vulnerable packages given the current sources".
- Preflight: ports 5180, 5115, 7028 and 5199 free, no other-project dev/test processes. Full run `CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx` (variable set for that process only): total 924, succeeded 924, failed 0, skipped 0 (ArchitectureTests 106 of those).

## Note for the owner

This machine and CI still run the 10.0.12 runtime/SDK. The patched libraries ship app-local and win by file version over the shared-framework copies, so no machine-level change was made. Confirm the host runtime patch level on SmarterASP.NET at the next deploy.

## Known Stubs

None.

## Threat Flags

None. No new endpoints, auth paths or schema.

## Self-Check: PASSED

- Commits 0d12439 and 190fc19 exist on gsd/quick-261014-owner-conventions.
- All modified files present; `git status` shows only the pre-existing untracked `.claude/launch.json`, `.planning/ui-reviews/` and this quick-task folder.
