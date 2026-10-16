---
phase: 03-ci-cd-staging-deploy
plan: 13
subsystem: deploy-package
tags: [github-actions, deploy-package, package-check, gitleaks, migrations-script, ops-04, ops-05, d-11, tdd, tracer]
created: "2026-10-16T02:05:00-05:00"
updated: "2026-10-16T02:05:00-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-04 ci-classify modes and the gate (full) job name; 03-06 deploy.mjs findPackage (csps-package-<sha>, site/, csps-migrations.sql); 03-08 win-x64 publish; 03-10 pinned, checksummed gitleaks 8.30.1; 03-11 completed ci.yml"
provides:
  - "web/scripts/package-check.mjs: checkPackage() and main(), a fail-closed content check of the deploy package (CLI: node web/scripts/package-check.mjs <dir>, exit 0 clean, 1 problems, 2 bad usage)"
  - "web/scripts/package-check.test.ts: 27 tests"
  - ".github/workflows/ci.yml stage 7: 7 package web build, publish, migrations script, check, secret scan, upload (push to main, mode full or package)"
  - "CiWorkflowTests: PackageOnlyOnPushToMain, PackageStepsInOrder, PackageGitleaksMatchesHygiene"
affects: [03-14, 03-16, 03-17, 03-20, 03-21, deploy-workflow]

actuals:
  tokens: 5000
  tasks: 2
  commits: 4
plan_head_before: 3204d96d4536d3029441c63e2fde9089db6bea2c
plan_head_after: cc0e1405a8d2b352afea8efc27149fe85b3094ab

tech-stack:
  added: []
  patterns:
    - "A tested pure checker (checkPackage over a relative file list plus an injected reader) wrapped by a thin CLI with injected I/O, the same shape as ci-classify.mjs"
    - "Stage 7 steps repeat one condition line (push event and mode full or package) so a test can pin it per step"
    - "The package scan installs the same gitleaks tarball URL and SHA-256 as Hygiene, and a test compares the two files literally"

key-files:
  created:
    - web/scripts/package-check.mjs
    - web/scripts/package-check.test.ts
  modified:
    - .github/workflows/ci.yml
    - tests/Csps.ArchitectureTests/CiWorkflowTests.cs

key-decisions:
  - "Stage 7 sits after the failure-report upload (stage 6), because the stage digits in step names must never decrease and the failure upload is the last stage 6 step"
  - "The web build is repeated in stage 7 so the package never carries the output of the budget build, which writes to the same wwwroot"
  - "The gitleaks download lives inside the 7 package secret scan step (six steps, as planned), puts the binary on PATH from RUNNER_TEMP, and runs `gitleaks dir artifacts/package` from the workspace so no binary lands in the stored artifact"
  - "package-check refuses app_offline.htm at the package root only (the only place ANCM reads it), and a logs folder or an environment settings, key or env file at any depth"
  - "The migrations script step runs dotnet ef without --no-build: it builds in Debug itself, needs no database (the design-time factory is used) and was proven locally"

requirements-completed: [OPS-04, OPS-05]

coverage:
  - id: D1
    description: "checkPackage refuses logs, app_offline.htm, environment settings files, .pfx/.pem/.key, secrets.json and .env files, and a package missing web.config (in-process), wwwroot/index.html or Csps.Server.dll; the CLI exits 0, 1 or 2 as specified"
    requirement: OPS-05
    verification:
      - kind: unit
        ref: "web/scripts/package-check.test.ts (27 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The check and the publish agree: a real win-x64 publish of Csps.Server passes the check (217 files, 35 MB), and the same folder with a planted appsettings.Development.json is refused"
    requirement: OPS-05
    verification:
      - kind: command
        ref: "npm --prefix web run build && dotnet publish src/Csps.Server -c Release -r win-x64 --self-contained false -o artifacts/package/site -tl:off && node web/scripts/package-check.mjs artifacts/package/site"
        status: pass
    human_judgment: false
  - id: D3
    description: "Stage 7 runs only on a push to main in full or package mode, in the D-11 order, and uploads csps-package-<sha> (site/ and csps-migrations.sql) for 14 days with if-no-files-found error"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/CiWorkflowTests.cs#PackageOnlyOnPushToMain, PackageStepsInOrder, GateRunsTheWholeOpsOrder"
        status: pass
    human_judgment: false
  - id: D4
    description: "The package scan uses the same pinned gitleaks 8.30.1 tarball and SHA-256 as the Hygiene workflow, checked before unpack and before use"
    requirement: OPS-05
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/CiWorkflowTests.cs#PackageGitleaksMatchesHygiene"
        status: pass
    human_judgment: false
  - id: D5
    description: "The stage 7 steps running on GitHub (publish with --no-restore against the locked restore, the migrations script on the runner, the gitleaks scan, the artifact upload)"
    requirement: OPS-04
    verification: []
    human_judgment: true
    rationale: "Stage 7 runs only on a push to main, so it cannot run on this pull request. Each command was run locally the same way, but the first real proof is the first merge to main (checked again in plans 03-16 and 03-20)."

duration: 14min
completed: 2026-10-16
status: complete
---

# Phase 3 Plan 13: Deploy package build on main Summary

**A tested, fail-closed `package-check.mjs` plus six stage 7 CI steps that, on every push to main, build the win-x64 publish and the idempotent migrations script, refuse any package holding logs, app_offline.htm, environment settings, key material or env files, scan it with the Hygiene-pinned gitleaks, and store it as `csps-package-<sha>` for 14 days.**

## Performance

- **Duration:** about 14 min
- **Completed:** 2026-10-16
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 4 (2 new, 2 edited)
- **Package size (measured):** 217 files, 35 MB site folder (about 23 KB for the migrations script)

## Accomplishments

- `package-check.mjs` (`// @ts-check`, Node built-ins only): `checkPackage(entries, readText)` returns one named problem per offending file or missing requirement; `main()` walks the folder, prints each problem to stderr and exits 1, prints `Package check passed: <n> files.` and exits 0, or exits 2 for a missing folder or argument.
- Tracer proof: a real `npm --prefix web run build` plus `dotnet publish src/Csps.Server -c Release -r win-x64 --self-contained false -o artifacts/package/site -tl:off` passed the check (`Package check passed: 217 files.`, exit 0). Copying a dummy `appsettings.Development.json` into that folder made the same command exit 1 with the file named. `artifacts/package` was deleted afterwards.
- Stage 7 in `ci.yml` (all six steps share one `if:` line: push event, mode full or package): `7 package web build`, `7 package publish` (`-r win-x64 --self-contained false -o artifacts/package/site --no-restore`), `7 package migrations script` (`dotnet ef migrations script --idempotent ... --output artifacts/package/csps-migrations.sql`, run locally and produced the script without a database), `7 package check`, `7 package secret scan` (pinned gitleaks 8.30.1 with `sha256sum -c`, then `gitleaks dir artifacts/package --redact`), `7 package upload` (`csps-package-${{ github.sha }}`, path `artifacts/package`, `retention-days: 14`, `if-no-files-found: error`). The gate job keeps `contents: read`.
- A local `gitleaks dir` scan (the same 8.30.1 binary, installed by `Install-Gitleaks.ps1`) over a real published package found no leaks.
- Three new `CiWorkflowTests` facts; `GateRunsTheWholeOpsOrder` and `RequiredGateSteps` now include stage 7.

## Task Commits

1. **Task 1 (tracer): fail-closed package check**
   - RED `acadc0a` (test) - module missing, no tests ran
   - GREEN `910a9b1` (feat)
2. **Task 2: stage 7 package steps**
   - RED `93cb321` (test) - 5 facts failed (3 new, 2 stage-order facts that now expect stage 7)
   - GREEN `cc0e140` (feat)

**Plan metadata:** the docs commit that holds this SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md.

## TDD Gate Compliance

RED then GREEN for both tasks; no refactor was needed.

- Task 1 RED: the whole test file failed to load because `package-check.mjs` did not exist ("no tests"). Semantic assessment: that is the intended failure for a new module, not a build or typo error in the tests.
- Task 2 RED: `PackageOnlyOnPushToMain`, `PackageStepsInOrder`, `PackageGitleaksMatchesHygiene`, `GateRunsTheWholeOpsOrder` and `GateStepsFollowOpsOrder` failed because the stage 7 steps did not exist; each failed on its planned assertion.
- RED evidence was read by hand from the console output of vitest and the xunit.v3 Microsoft Testing Platform run, which `gsd_run check tdd-red-evidence` does not read.

## Files Created/Modified

- `web/scripts/package-check.mjs` - the content check and CLI
- `web/scripts/package-check.test.ts` - 27 tests (clean list, each refusal, CLI exit codes on real temp folders)
- `.github/workflows/ci.yml` - stage 7 steps appended after the failure-report upload
- `tests/Csps.ArchitectureTests/CiWorkflowTests.cs` - three new facts, stage 7 in the required order, two existing facts scoped

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Two existing CiWorkflowTests facts broke when stage 7 was added**
- **Found during:** Task 2 (GREEN)
- **Issue:** `WebScriptsKeepVerifyOrder` requires each `verify.mjs` web script (including `build`) to be called once in the gate, and stage 7 deliberately runs `npm --prefix web run build` again. `FailureReportsAreUploadedForSevenDaysOnly` selected the gate's single `upload-artifact` step with `.Single(...)`, which now finds two.
- **Fix:** The first fact skips stage 7 steps (with a comment saying why); the second selects the step by its name, `6 upload failure reports`.
- **Files modified:** `tests/Csps.ArchitectureTests/CiWorkflowTests.cs`
- **Verification:** `CiWorkflowTests` 33 of 33 and the whole architecture project 189 of 189 pass.
- **Committed in:** `cc0e140`

**2. [Rule 1 - Bug] The first placement of stage 7 broke the stage order**
- **Found during:** Task 2 (GREEN)
- **Issue:** The steps were first inserted before `6 upload failure reports`, so a `6` followed a `7`, and the failure upload (which must stay last in stage 6) would have run before the package steps.
- **Fix:** Moved stage 7 to the end of the job.
- **Committed in:** `cc0e140`

**3. [Rule 1 - Bug] The scan step called the binary by path, not by name**
- **Found during:** Task 2 (GREEN)
- **Issue:** `PackageGitleaksMatchesHygiene` and `PackageStepsInOrder` look for `gitleaks dir`; the first draft ran `"$RUNNER_TEMP/gitleaks" dir`.
- **Fix:** The step puts `$RUNNER_TEMP` on PATH, returns to the workspace and runs `gitleaks dir artifacts/package --redact --no-banner --verbose`.
- **Committed in:** `cc0e140`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 small bugs)
**Impact on plan:** None on scope. Test selectors were narrowed; no assertion was weakened.

## Issues Encountered

None.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. T-03-44 (secrets or dev files in the package) and T-03-45 (app_offline.htm in a package) are mitigated by the unit-tested check and the gitleaks scan; T-03-SC by the shared, checksummed gitleaks pin. T-03-46 (artifact pool) is accepted: the package is about 35 MB and is kept 14 days; plan 03-16 measures it.

## User Setup Required

None.

## Next Phase Readiness

- The stage 7 steps cannot run on a pull request, so their first real run is the first merge to main. Open risk: `dotnet publish --no-restore` relies on the win-x64 section in the lock files from plan 03-08. If the runner reports a missing `net10.0/win-x64` asset, change the publish to a locked-mode restore for that one command.
- The artifact layout (`site/`, `csps-migrations.sql`, name `csps-package-<sha>`) is what `deploy.mjs findPackage` downloads.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-16*

## Self-Check: PASSED

`web/scripts/package-check.mjs`, `web/scripts/package-check.test.ts` and this SUMMARY exist; commits acadc0a, 910a9b1, 93cb321 and cc0e140 are on the branch; package-check tests pass 27 of 27, the architecture project passes 189 of 189, and the tracer run (clean publish accepted, planted file refused) was done as described.
