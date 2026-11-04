---
phase: 09-order-images-maintenance-jobs
plan: 25
subsystem: infra
tags: [cloudinary, named-transformations, maintenance-job, usage-alarm, setup-tool]
created: 2026-11-03T23:45:00-06:00
updated: 2026-11-03T23:45:00-06:00
requires:
  - phase: 09-order-images-maintenance-jobs
    provides: "09-02 ImageNamedSizes and CloudinarySettings; 09-11 IMaintenanceJob and the keyed run handler; 09-19 CloudinaryImageStorage, StubCloudinaryHandler and the usage read"
provides:
  - "CloudinarySetupCommand: check and create the 13 named sizes, never change an existing one"
  - "tools/Csps.CloudinarySetup: the owner's one-time command"
  - "CloudinaryUsageJob (Order 40): storage and credits lines, red above 80%"
  - "docs/operations/cloudinary-setup.md: the safe order of the one-time setup"
affects: [09-30 owner checklist, 09-28, monthly maintenance run summary]
status: complete
plan_head_before: a3353bef5650ff3ccaec8787096c37cce5dd52ff
plan_head_after: 86e2881de61aec9c1c74dbb27d399c8e9e6fe4cd
actuals:
  tokens: 13100
  tasks: 3
  commits: 5
tech-stack:
  added: []
  patterns:
    - "A tool is a thin exe over a public command class in Csps.Infrastructure; the class takes settings and an IHttpClientFactory so tests drive it with the stub handler"
    - "Maintenance line: short fixed Label plus a preformatted Text; failed sentences use the label 'Photo storage'"
key-files:
  created:
    - src/Csps.Infrastructure/Images/CloudinarySetupCommand.cs
    - tools/Csps.CloudinarySetup/Csps.CloudinarySetup.csproj
    - tools/Csps.CloudinarySetup/Program.cs
    - tools/Csps.CloudinarySetup/packages.lock.json
    - tests/Csps.Infrastructure.IntegrationTests/Images/CloudinarySetupCommandTests.cs
    - src/Csps.Application/Maintenance/CloudinaryUsageJob.cs
    - tests/Csps.Application.UnitTests/Maintenance/CloudinaryUsageJobTests.cs
  modified:
    - Csps.slnx
    - tests/Csps.ArchitectureTests/SolutionLayoutTests.cs
    - src/Csps.Server/Composition/MaintenanceApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs
    - docs/operations/cloudinary-setup.md
key-decisions:
  - "A freshly created size gets a second call that sets allowed_for_strict true, because the SDK's create call cannot send that field (the Admin API default is true, this makes it certain)"
  - "A size that exists but is not allowed for strict mode is reported as 'different', since strict mode would block it"
  - "The 80% rule looks at both credits percent and storage percent"
  - "Exit codes: 0 done, 1 a size is different, 2 keys not set, 3 Cloudinary refused or did not answer, 64 unknown argument"
requirements-completed: []
---

# Phase 9 Plan 25: Cloudinary named-size setup and the usage alarm Summary

The owner now has one safe command that creates the 13 named photo sizes, and every monthly maintenance run reports Cloudinary storage and credits and turns red above 80% of the free plan.

## What was built

**Task 1, setup command (tracer).** `CloudinarySetupCommand.RunAsync(checkOnly, output, ct)` lists the named transformations (paged), reads each catalog name's definition, and prints one line per size: `exists`, `missing`, `created` or `different`, then a count line such as `10 exist, 3 missing` or `10 exist, 3 created`.

- `--check` sends only GET requests.
- Without `--check` it creates each missing size from `ImageNamedSizes.All` and then sets `allowed_for_strict` true.
- An existing size is never updated or deleted. A different one makes the exit code 1 and the other missing sizes are still created.
- Missing keys: prints `Set Cloudinary:CloudName, Cloudinary:ApiKey and Cloudinary:ApiSecret first.`, exit 2, no call.
- Output has size names and counts only. Refusals print a fixed sentence (`Cloudinary refused the keys.`, `Cloudinary is busy or did not answer. Try again later.`).
- `tools/Csps.CloudinarySetup/Program.cs` reads the Csps.Server user-secrets and the `Cloudinary__` variables, accepts only `--check`, never prompts.

**Task 2, usage job.** `CloudinaryUsageJob` (Order 40, name `cloudinary-usage`) is registered in `MaintenanceApplicationRegistration`. Lines: `Cloudinary storage used: 1.50 GB`, `Cloudinary credits this month: 5.2 of 25 (20.8%)`. Failed lines (label `Photo storage`): the Over 80% sentence, the plan-limit sentence, and `Cloudinary usage could not be read.` Unset storage gives the plain line `Cloudinary usage not checked: photo storage is not set up.` with no call and no failure. This also covers the wave 5 note: a failed usage read throws `ImageStorageException`, which the job catches.

**Task 3, guide.** `docs/operations/cloudinary-setup.md` now lists: user-secrets, `--check`, create, confirm `13 exist`, only then strict transformations (Settings, Security), then host variables. It explains why the order matters, that development and live share the names, and what `different` means.

## Verification (quoted from runs)

- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinarySetupCommandTests"`: total 16, failed 0, succeeded 16.
- `dotnet test --project tests/Csps.ArchitectureTests`: total 276, failed 0 (includes SolutionLayoutTests, 6 of 6).
- `dotnet test --project tests/Csps.Application.UnitTests`: total 2171, failed 0 (CloudinaryUsageJobTests 17 of 17).
- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-namespace "*Server.IntegrationTests.Maintenance*"`: total 24, failed 0 (MaintenanceEndpointTests 12 of 12).
- `dotnet build Csps.slnx`: 0 Warning(s), 0 Error(s). `dotnet format Csps.slnx --verify-no-changes`: no output (clean).
- `dotnet run --no-build --project tools/Csps.CloudinarySetup -- --bogus`: usage line, exit 64. The tool was never run against the account or the dev secrets.
- gitleaks (pre-commit hook and a manual staged scan): no leaks, all four commits.

## TDD Gate Compliance

| Task | RED | GREEN | Status |
|------|-----|-------|--------|
| 1 | 53285a61 test(09-25): 13 of 16 command tests failed on the planned assertions (exit code 0 and empty output from the do-nothing stub); SolutionLayoutTests failed with the tool missing from Csps.slnx | 3bca32b9 feat(09-25) | passed |
| 2 | 36ecd2f0 test(09-25): 11 of 17 job tests and 2 endpoint tests failed on the planned assertions (empty lines, ok true) | b509e264 feat(09-25) | passed |

semanticAssessment: the failing tests executed and failed on the planned behavior, not on a compile or fixture fault. The RED commits include a do-nothing stub of the new class so the tests compile; the plan did not require a separate file-less RED. No refactor commit was needed.

## Deviations from Plan

**1. [Rule 2 - Missing critical functionality] Explicit allowed_for_strict after create**
- **Issue:** `CreateTransformParams` in CloudinaryDotNet 1.29.3 has no allowed_for_strict field. The research says the Admin API default on create is true, but a wrong default would make strict mode block every photo.
- **Fix:** after each create, one `UpdateTransformAsync` with `AllowedForStrict = true`, only for the size this run just created. Existing sizes still receive no update (tests assert it).
- **Commit:** 3bca32b9

**2. [Rule 2] A size not allowed for strict mode counts as `different`**
- A size that exists with `allowed_for_strict` false would block photos once strict mode is on, so `--check` reports it and the command does not touch it.

**3. [Rule 2] 80% rule covers storage percent as well as credits percent**
- The plan text says credits. The usage read gives both, and storage is what fills first (research). Either above 80 turns the run red. Exactly 80 is not red, 80.01 is.

**4. [Rule 3] Existing order test changed**
- `JobsRunByOrderWhateverTheirRegistrationOrder` used a fake job at order 30 and expected it last. The usage job (order 40) now runs after it, so the fake is order 45. Commit b509e264.

**5. [Rule 1] Newtonsoft overload**
- `JToken.ToString(Formatting)` threw MissingMethodException at run time with the resolved Newtonsoft version. The code uses `ToString()` instead.

**6. Argument handling added**
- `CloudinarySetupCommand.TryReadArguments` and `Usage` (unit tested) so that an unknown argument exits 64 without reading any secret.

## Lock file check (package rule)

No package was added or bumped. `tools/Csps.CloudinarySetup/packages.lock.json` is identical in content to `tools/Csps.BootstrapManager/packages.lock.json` (same 80 entries, same versions, checked with a script). Compared to `src/Csps.Infrastructure/packages.lock.json`, the tool lock lists 30 entries that Infrastructure lists differently or not at all, all `Microsoft.Extensions.*` and `Microsoft.AspNetCore.*` packages that Infrastructure takes from the shared framework, and Newtonsoft.Json is 13.0.3 here against 13.0.4 there. Every other tool has the same lock shape, so I treated this as the existing pattern and did not stop. Please confirm if you read the rule more strictly.

## Risks for the owner run (plan 09-30)

The live Admin API was never called, by rule. The tests prove the SDK's requests: list is `GET /transformations?named=true`, detail is `GET /transformations?transformation={name}`, create is `POST` with `name` and `transformation`, allow is `PUT` with `transformation` and `allowed_for_strict`. These assumptions are unverified against the live account:

- The detail answer holds a `info` array of objects with long key names (`crop`, `gravity`, `width`, `height`, `quality`, `fetch_format`). The comparison also accepts a plain string. If the live shape differs, the safe outcome is `different` (exit 1, nothing changed), not a change.
- The list may or may not prefix names with `t_`. Both are handled.
- A refusal prints only an HTTP number and a fixed sentence.

Run `--check` first, as the guide says.

## Known Stubs

None.

## Threat Flags

None. Threats T-09-65 to T-09-67 and T-09-SC are mitigated as planned: no update path for existing sizes, names and counts only in output, the 80% and plan-limit lines, no new package.

## Not done on purpose

- `REQUIREMENTS.md` is not changed. IMG-04, JOB-01 and JOB-02 span other plans, so ticking them here would be early. The orchestrator marks them when the phase closes.
- `STATE.md` and `ROADMAP.md` are left to the orchestrator.
- `tools/scripts/New-ThirdPartyNotices.ps1` was not run (no PowerShell in the worktree); no package changed, so nothing should differ.

## Flakes and environment

No flaky test seen. Port 5199 showed TIME_WAIT sockets from another session in `netstat`; nothing was listening on 5180, 5115, 7028 or 5199, and none of my tests use a port (in-memory test server).

## Self-Check: PASSED

- Files found: CloudinarySetupCommand.cs, Csps.CloudinarySetup.csproj, Program.cs, packages.lock.json, CloudinarySetupCommandTests.cs, CloudinaryUsageJob.cs, CloudinaryUsageJobTests.cs, cloudinary-setup.md.
- Commits found in history: 53285a61, 3bca32b9, 36ecd2f0, b509e264, 86e2881d.
