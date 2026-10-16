---
phase: 03-ci-cd-staging-deploy
plan: 12
subsystem: deploy-workflow
tags: [github-actions, deploy, web-deploy, app-offline, runbook, ops-04, d-11, d-12, d-13, d-05, tdd, tracer]
created: "2026-10-16T01:42:00-05:00"
updated: "2026-10-16T01:42:00-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-01 WorkflowText and CiWorkflowTests; 03-06 web/scripts/deploy.mjs (env contract, rollback, hostprobe action); 03-07 web/scripts/smoke.mjs"
provides:
  - ".github/workflows/deploy.yml: workflow Deploy, workflow_dispatch only, job deploy on windows-2025, main-only, one step running node web/scripts/deploy.mjs"
  - "tools/deploy/app_offline.htm: branded, self-contained 'updating, back in a minute' page (5.6 KB) that deploy.mjs uploads"
  - "docs/operations/deploy.md: runbook for deploy, dry run, automatic and manual rollback, online recovery, first deploy, D-05 legacy kit, secret and variable names, migrations, accepted T-03-50 risk"
  - "DeployWorkflowTests: 10 facts"
affects: [03-13, 03-17, 03-20, 03-21, deploy-workflow]

actuals:
  tokens: 15600
  tasks: 2
  commits: 4
plan_head_before: c460701b5ac3f485b41a676e5cfef3ba602f91dc
plan_head_after: b3a34f73e570c8bb4d9bfd9a1ec35af89be2e7bb

tech-stack:
  added: []
  patterns:
    - "The deploy workflow has no logic of its own: every dispatch input and secret is an env entry on the single deploy step, and the tests reject a secrets or inputs expression anywhere else except an if: line"
    - "A workflow that holds deploy credentials is named in the CI credential test as the one exemption, and that test also asserts the exempt file exists"
    - "The offline page is generated from web/public/mark.svg with path data rounded to whole units and implicit linetos, so it fits the 8 KB cap without redrawing the mark"

key-files:
  created:
    - .github/workflows/deploy.yml
    - tools/deploy/app_offline.htm
    - docs/operations/deploy.md
    - tests/Csps.ArchitectureTests/DeployWorkflowTests.cs
  modified:
    - tests/Csps.ArchitectureTests/CiWorkflowTests.cs

key-decisions:
  - "deploy.yml is exempted by name from NoWorkflowCarriesAProductionSecret (it is the one file that must carry WEBDEPLOY_* secrets); DeployWorkflowTests pins how it may use them, and the CI test fails if the exempt file ever disappears"
  - "The inline mark in app_offline.htm keeps every point of mark.svg but rounds coordinates to whole units, drops the redundant L commands and the xmlns/title. At 96 px the rounding error is about 0.1 px, and the page fits at 5663 bytes instead of 8192+"
  - "The offline page carries no http:// or https:// text at all (so the SVG xmlns is left out) and no link, script, image or font, because ANCM answers every path with this one file"
  - "The runbook holds the D-05 legacy rollback kit section that deploy.mjs's failure message points to"

requirements-completed: [OPS-04]

coverage:
  - id: D1
    description: "deploy.yml runs only on workflow_dispatch and only from main, on windows-2025 with a 30 minute timeout, with an empty top-level token and job permissions of exactly contents write and actions read, and a concurrency group that never cancels"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/DeployWorkflowTests.cs#DeployIsManualOnly, DeployRunsOnlyFromMain, DeployHasLeastPrivilege, DeployNeverCancels"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every dispatch input and secret reaches deploy.mjs through env only; the deploy step passes exactly the variables deploy.mjs reads; the job installs no npm package; the orchestrator scripts import Node built-ins only"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/DeployWorkflowTests.cs#DeployInputsAndSecretsUseEnv, DeployRunsTheOrchestratorOnly, DeployScriptsUseBuiltInsOnly"
        status: pass
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/CiWorkflowTests.cs (30 facts over every workflow file, deploy.yml included)"
        status: pass
    human_judgment: false
  - id: D3
    description: "app_offline.htm is self-contained and under 8 KB, and no package can carry one"
    requirement: OPS-04
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/DeployWorkflowTests.cs#OfflinePageIsSelfContained, OfflinePageNeverShips"
        status: pass
    human_judgment: false
  - id: D4
    description: "The offline page reads well and looks like the brand at 320 px, and the runbook is clear to the owner"
    requirement: OPS-04
    verification: []
    human_judgment: true
    rationale: "Visual quality and plain-words clarity are judgments. The tests check structure, size and content, not how the page looks in a browser or how the runbook reads."
  - id: D5
    description: "The workflow itself running on GitHub (the Run workflow form, the main-only guard, the real msdeploy call)"
    requirement: OPS-04
    verification: []
    human_judgment: true
    rationale: "deploy.yml can run only from main after the pipeline is merged, and this plan must never dispatch it. The first real run is the dry run in plan 03-20."

duration: 14min
completed: 2026-10-16
status: complete
---

# Phase 3 Plan 12: Manual production deploy workflow Summary

**A manual-only, main-only, least-privilege `deploy.yml` on windows-2025 that hands every input and secret to the tested `deploy.mjs` through env, a branded self-contained 5.6 KB `app_offline.htm`, and a plain-words runbook for deploy, dry run, rollback, recovery, first deploy, secrets and migrations.**

## Performance

- **Duration:** about 14 min
- **Completed:** 2026-10-16
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 5 (4 new, 1 edited)

## Accomplishments

- `deploy.yml`: `on:` holds `workflow_dispatch` and nothing else; the job has `if: github.ref == 'refs/heads/main'`; top-level `permissions: {}`; job permissions `contents: write` and `actions: read`; concurrency group `deploy-production` with `cancel-in-progress: false`; four inputs (`action` choice deploy, online, hostprobe; `sha`; `dry_run`; `probe_rewrite`); steps checkout (no persisted credentials), setup-node 24.21.0 without a cache, setup-dotnet only for `hostprobe`, and the one deploy step with all 13 values in `env:`.
- `DeployWorkflowTests` (10 facts) pins all of it, including a detector that rejects a `secrets.` or `inputs.` expression in `run:` or anywhere but an env entry or an `if:`.
- `app_offline.htm`: lowercase name, `lang="en-PH"`, inline CSS in the Blush colours, the inline mark, system fonts, a 30 second meta refresh, readable at 320 px, no external reference, no long dash.
- `deploy.md` covers every situation in the plan, plus the D-05 legacy kit section that `deploy.mjs` already points to, and records the accepted T-03-50 risk.

## Task Commits

1. **Task 1 (tracer): manual, main-only, least-privilege deploy workflow**
   - RED `7a6a681` (test)
   - GREEN `4e2a45b` (feat)
2. **Task 2: branded offline page and the deploy runbook**
   - RED `2997173` (test)
   - GREEN `b3a34f7` (feat)

**Plan metadata:** the docs commit that holds this SUMMARY, STATE.md, ROADMAP.md and REQUIREMENTS.md.

## TDD Gate Compliance

RED then GREEN for both tasks (no refactor was needed).

- Task 1 RED: 6 of 7 facts failed because `deploy.yml` did not exist (missing job, empty trigger, permissions and concurrency sections). Semantic assessment: each failure was on the planned assertion for the intended reason, not a build or discovery error. `DeployScriptsUseBuiltInsOnly` passed in RED: it is a guard over scripts that plan 03-06 already wrote with built-ins only, so there was no behavior to add.
- Task 2 RED: `OfflinePageIsSelfContained` (file missing) and `DeployRunbookCoversTheCases` (file empty) failed. `OfflinePageNeverShips` passed in RED for the same guard reason: nothing named app_offline.htm exists under web/ or src/ today, and the test keeps it that way.
- The RED evidence was inspected by hand from the xunit.v3 Microsoft Testing Platform console output, which `gsd_run check tdd-red-evidence` does not read.

## Files Created/Modified

- `.github/workflows/deploy.yml` - the manual deploy workflow
- `tools/deploy/app_offline.htm` - branded offline page
- `docs/operations/deploy.md` - deploy runbook
- `tests/Csps.ArchitectureTests/DeployWorkflowTests.cs` - 10 facts for the above
- `tests/Csps.ArchitectureTests/CiWorkflowTests.cs` - credential rule now exempts deploy.yml by name

## Decisions Made

See `key-decisions` above. In short: deploy.yml is the one named exemption from the no-deploy-credential rule; the inline mark is rounded, not redrawn; the offline page has no `http` text at all; the runbook carries the D-05 kit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] CiWorkflowTests rejected the deploy credentials in deploy.yml**
- **Found during:** Task 1 (GREEN)
- **Issue:** `NoWorkflowCarriesAProductionSecret` scans every workflow for `${{ secrets.` and `WEBDEPLOY_*PASSWORD`. Any deploy.yml that passes the Web Deploy secrets to the orchestrator would fail it.
- **Fix:** The test skips `.github/workflows/deploy.yml` by name and now asserts that file exists, so the exemption cannot outlive the workflow. `DeployWorkflowTests` pins how deploy.yml may use secrets.
- **Files modified:** `tests/Csps.ArchitectureTests/CiWorkflowTests.cs`
- **Verification:** `CiWorkflowTests` 30 of 30 and the whole architecture project 186 of 186 pass.
- **Committed in:** `4e2a45b`

**2. [Rule 1 - Bug] The plan could not hold the full-precision mark under the 8 KB cap**
- **Found during:** Task 2 (GREEN)
- **Issue:** `web/public/mark.svg` alone is 6925 bytes, which leaves about 1.2 KB for the HTML and CSS under the 8192 byte cap.
- **Fix:** The inline mark keeps all points but rounds the path data to whole units, drops the `L` commands (implicit lineto) and the `xmlns` and `<title>`. Geometry, colours, stroke widths and dash arrays are unchanged. The page is 5663 bytes.
- **Files modified:** `tools/deploy/app_offline.htm`
- **Verification:** `OfflinePageIsSelfContained`.
- **Committed in:** `b3a34f7`

**3. [Rule 1 - Analyzer] CA1861 on an inline array argument in the new test**
- **Found during:** Task 2 (RED build)
- **Fix:** Moved the `web`, `src` roots to a static readonly field.
- **Committed in:** `2997173`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 small bugs)
**Impact on plan:** None on scope. The first is needed for correctness of the credential rule; the other two are mechanical.

## Issues Encountered

None.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. The surfaces added (a dispatch-only workflow that holds deploy secrets, an offline page) are the ones in the plan's threat model. T-03-50 (secrets readable by any workflow on a pushed branch) is accepted and written into `docs/operations/deploy.md`.

## User Setup Required

None for this plan. Before the first real deploy the owner must set the repository secrets `WEBDEPLOY_SERVER`, `WEBDEPLOY_SITE`, `WEBDEPLOY_USERNAME`, `WEBDEPLOY_PASSWORD` (optional `WEBDEPLOY_CERT_SHA256`, `HOSTPROBE_KEY`) and the repository variable `SITE_ORIGIN`. The names and rules are in `docs/operations/deploy.md`; this plan neither created nor changed any.

## Next Phase Readiness

- `deploy.yml` can only run from `main`, so its first real run waits for the pipeline merge and the dry run planned in 03-20. It was never dispatched here.
- Plans that build the deploy package (artifact `csps-package-<sha>`, `csps-migrations.sql`) must produce the names the runbook and `deploy.mjs` rely on.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-16*
