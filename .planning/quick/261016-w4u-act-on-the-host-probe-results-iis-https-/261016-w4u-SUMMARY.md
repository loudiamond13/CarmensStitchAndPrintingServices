---
created: 2026-10-16T23:50:00-05:00
updated: 2026-10-16T23:50:00-05:00
phase: quick-261016-w4u
plan: 01
subsystem: deploy-packaging, data-protection, hosting-record
tags: [iis, url-rewrite, self-contained, win-x64, data-protection, machinekeyset, hosting-record]
status: complete
requires:
  - host probe runs 39000637708 and 39000906168 (2026-10-16)
provides:
  - IIS HttpToHttps rule in src/Csps.Server/web.config
  - self-contained win-x64 CI package bundling ASP.NET Core 10.0.13
  - MachineKeySet certificate load with key cleanup on dispose and host shutdown
  - probe facts, rulings and run ids in HOSTING-RECORD and 03-CUTOVER-LOG
affects:
  - first CSPS deploy (plan 03-20 and later)
tech-stack:
  added: []
  patterns:
    - hosted-service owner disposed with the host to release machine key files
key-files:
  created:
    - src/Csps.Infrastructure/DataProtection/DataProtectionCertificates.cs
    - tests/Csps.Infrastructure.IntegrationTests/DataProtection/CertificateLoaderTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/DataProtection/DataProtectionCertificatesTests.cs
  modified:
    - src/Csps.Server/web.config
    - .github/workflows/ci.yml
    - Directory.Build.props
    - src/Csps.Infrastructure/DataProtection/CertificateLoader.cs
    - src/Csps.Infrastructure/DataProtection/DataProtectionRegistration.cs
    - tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs
    - tests/Csps.ArchitectureTests/CiWorkflowTests.cs
    - tests/Csps.ArchitectureTests/PublishOutputTests.cs
    - .planning/HOSTING-RECORD.md
    - .planning/phases/03-ci-cd-staging-deploy/03-CUTOVER-LOG.md
    - tools/Csps.HostProbe/README.md
decisions:
  - "D1 (owner 2026-10-16): IIS URL Rewrite HttpToHttps rule in the site web.config; app redirect and HSTS stay"
  - "D2 (owner 2026-10-16): CI publishes self-contained win-x64; package bundles ASP.NET Core 10.0.13"
  - "D3 (owner 2026-10-16): Data Protection PFX loads with MachineKeySet only; keys removed on dispose and host shutdown"
  - "D4 (owner 2026-10-16): probe facts recorded Verified 2026-10-16 with run ids"
metrics:
  duration: about 30 min
  completed: 2026-10-16
actuals:
  tokens: 11000
  tasks: 3
  commits: 5
plan_head_before: a6833cb97ff5ba63eda47c68db77b64fddf5318b
plan_head_after: 1578dc759a53fa4bbfea9532dbbaa4715325b19b
---

# Quick 261016-w4u: act on the host probe results Summary

The CI package is now self-contained win-x64. It bundles ASP.NET Core 10.0.13 instead of using the host's 10.0.7, and its web.config sends http to https in IIS with the HttpToHttps rule the probe proved on the host. The Data Protection certificate opens in the machine key store, the one load the host allows, and its key file is deleted when the host shuts down. The hosting record and cutover log now hold the probe facts and the run ids.

## Commits

| Task | Commit | Message |
|------|--------|---------|
| 1 RED | 30b1cbd | test(quick-261016-w4u): pin the IIS http-to-https rule and the self-contained win-x64 package (RED) |
| 1 GREEN | 6a8b470 | feat(quick-261016-w4u): self-contained win-x64 package and the IIS http-to-https rule |
| 2 RED | ea0349a | test(quick-261016-w4u): pin the machine key store certificate load and its shutdown cleanup (RED) |
| 2 GREEN | f2715bc | fix(quick-261016-w4u): load the Data Protection certificate into the machine key store and remove its key on shutdown |
| 3 | 1578dc7 | docs(quick-261016-w4u): host probe facts, HTTPS ruling and run ids |

## Package size (measured on this PC, same publish as CI)

| Package | Folder | Files | Zip (Compress-Archive) |
|---------|--------|-------|------------------------|
| Framework-dependent win-x64 (before) | 33.7 MB (`du` 35 MB) | 226 | 13.7 MB |
| Self-contained win-x64 (now) | 138.9 MB (`du` 141 MB) | 556 | 59.8 MB |

The ci.yml "7 package upload" comment now reads "about 60 MB each zipped (self-contained)". It used to say "about 35 MB", which was the unzipped framework-dependent folder.

## Bundled runtime

`Csps.Server.runtimeconfig.json` in the package has `includedFrameworks` with Microsoft.NETCore.App 10.0.13 and Microsoft.AspNetCore.App 10.0.13, and no `framework` or `frameworks` property. The published web.config has `processPath=".\Csps.Server.exe"` and `hostingModel="inprocess"`, and it keeps the HttpToHttps rule and the urlCompression-off setting.

**License note:** the bundled .NET runtime is Microsoft's MIT-licensed runtime. It is free to use and to ship inside our package. No new package was added. The runtime packs are the ones the pinned SDK already selects, and they restore in locked mode.

## Tests added or changed

- `WebConfigTests.RedirectsHttpToHttpsBeforeTheApp` replaces `HasNoRewriteSectionYet`. It checks for exactly one HttpToHttps rule beside the aspNetCore handler, with every attribute copied from deploy.mjs HTTPS_REWRITE.
- `CiWorkflowTests.PackageStepsInOrder`: the publish step uses `--self-contained true` and has no framework-dependent flag.
- `PublishOutputTests`: the test now publishes self-contained, as CI does. New checks: hostfxr.dll is present, the published web.config starts `.\Csps.Server.exe` in-process, the rule and urlCompression off survive publish, `includedFrameworks` is present with no `framework(s)`, and ASP.NET Core is at least 10.0.13 (`MinimumAspNetCore`).
- `CertificateLoaderTests` (new, 4 tests):
  - round trip on every OS
  - on Windows, the key is a machine key and not ephemeral while the certificate is open
  - on Windows, the machine key is gone after dispose
  - a wrong password gives CannotOpenMessage
- `DataProtectionCertificatesTests` (new, 4 tests):
  - one singleton holds 2 certificates and is also among the hosted services
  - starting and stopping keep the certificates usable
  - disposing the provider disposes every certificate, and a second Dispose is safe
  - on Windows, disposing the provider removes the machine keys

All 8 new tests ran and passed on Windows. None were skipped.

## Verification

- Task 1:
  - WebConfigTests: 6/6
  - CiWorkflowTests + PublishOutputTests + BuildConfigTests: 51/51
  - CI-path publish with `-p:RestoreLockedMode=true`: package-check passed (556 files)
  - smoke.test.ts + package-check.test.ts: 128/128
  - no `--self-contained false` left in ci.yml
- Task 2:
  - DataProtection integration tests: 8/8
  - Server DataProtectionTests on LocalDB: 11/11
  - `dotnet build Csps.slnx --no-incremental`: 0 warnings, 0 errors
  - `MachineKeySet` appears 2 times in CertificateLoader.cs, and no code line uses `EphemeralKeySet`
- Task 3:
  - HostingRecordTests + CutoverRunbookTests: 15/15
  - RepoRulesTests: 14/14
  - "URL Rewrite module" appears 2 times in HOSTING-RECORD, and 39000906168 is in the cutover log
  - drive-path gate: 0 hits in both files
  - both runs show `success` in `gh run view`
- Final checks:
  - full .NET suite (`CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx`, after preflight): 2264 total, 2263 passed, 0 failed, 1 skipped (HibpLiveTests, the opt-in live test, already skipped before this task)
  - 0 warnings in the log
  - `dotnet format --verify-no-changes` passes
  - `git status --porcelain -- '*packages.lock.json'` is empty

## Deviations from Plan

None. The plan was executed as written.

Observation, not changed: the SDK publish transform already rewrote processPath to `.\Csps.Server.exe`, so the plan's fallback (setting it in the source web.config) was not needed. The transform keeps the source `arguments=".\Csps.Server.dll"`. With an exe processPath, IIS passes that value to the app as a plain command-line argument. The configuration reader ignores a value without a `--`/`/` key, so it does no harm. The framework-dependent package had the same exe-plus-argument shape before this task. The plan said to leave arguments as they are. A later cleanup could remove the attribute from the source web.config and update WebConfigTests.HostsInProcess.

## Notes for the owner

- `.claude/CLAUDE.md` (the stack line "framework-dependent publish") and `.planning/research/STACK.md` still describe framework-dependent as the default. They were not changed here.
- The first CSPS deploy waits until this branch's changes are on main. That is a gated merge through `Merge-PullRequest.ps1`, done only on the owner's instruction. Nothing was pushed, dispatched or merged.
- If a crash or killed w3wp skips the graceful shutdown, one key file can stay in the host's machine key store (T-w4u-02, accepted). HOSTING-RECORD records this.

## Known Stubs

None.

## Threat Flags

None. The new surface (the IIS redirect, the machine key store use, the bundled runtime) is covered by T-w4u-01 to T-w4u-05 in the plan's threat model.

## Self-Check: PASSED

- FOUND: src/Csps.Infrastructure/DataProtection/DataProtectionCertificates.cs
- FOUND: tests/Csps.Infrastructure.IntegrationTests/DataProtection/CertificateLoaderTests.cs
- FOUND: tests/Csps.Infrastructure.IntegrationTests/DataProtection/DataProtectionCertificatesTests.cs
- FOUND commits: 30b1cbd, 6a8b470, ea0349a, f2715bc, 1578dc7
