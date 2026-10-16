---
phase: 03-ci-cd-staging-deploy
plan: 11
subsystem: ci-pipeline
tags: [github-actions, ci, ops-02, ops-03, d-14, d-15, d-16, playwright, lighthouse, sql-container, tracer]
created: "2026-10-16T01:20:00-05:00"
updated: "2026-10-16T01:20:00-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-01 ci.yml skeleton, WorkflowText and CiWorkflowTests; 03-02 CSPS_E2E_CONNECTION and container-ready harnesses; 03-04 web/scripts/ci-classify.mjs"
provides:
  - ".github/workflows/ci.yml: classify job running the tested script, and a gate job holding all six OPS-02 stages in order"
  - ".github/workflows/weekly.yml: workflow Weekly (Sunday 18:00 UTC) calling ci.yml with all-engines true"
  - "CiWorkflowTests: 12 new facts (30 in the class) including verify.mjs order, loopback container, full-mode-only heavy steps"
  - "docs/operations/ci.md: what runs when, how to read a failure, minutes estimate table, D-16 fallback"
affects: [03-15, 03-16, ci-workflow]

actuals:
  tokens: 7700
  tasks: 3
  commits: 7
plan_head_before: bf03559600b59f9dc0d5b7f0bb7ce94a64550075
plan_head_after: 0e248893c7bb0fbf1bcdd36b4a67f774a0604b3b

tech-stack:
  added: []
  patterns:
    - "The gate is one job whose step names start with the stage digit; tests assert the digits never decrease and the named steps keep their order"
    - "The all-engines input is read only in if: conditions, with two steps of opposite conditions instead of a value inside a script"
    - "A loopback-only SQL container per run: password generated with openssl, masked before first use, passed to docker by variable name"

key-files:
  created:
    - .github/workflows/weekly.yml
    - docs/operations/ci.md
  modified:
    - .github/workflows/ci.yml
    - tests/Csps.ArchitectureTests/CiWorkflowTests.cs
    - web/src/test/build-output.node.test.ts

key-decisions:
  - "Container readiness is read from the server log line 'ready for client connections' instead of the image's sqlcmd, because SQL Server 2025 images may ship without the tools; the check uses no pipe, so pipefail cannot misread an early grep exit."
  - "The SA password is openssl rand -hex 24 plus 'Aa1' (hex only), so it needs no escaping inside a connection string; docker receives it as 'MSSQL_SA_PASSWORD' by name, never on the command line."
  - "The all-engines Playwright step runs 'npm --prefix web run e2e' with no --project flag, so every project in playwright.config.ts runs and a project added later cannot be skipped silently."
  - "build-output.node.test.ts builds the web root itself when index.html is missing (CI is a clean checkout and Vitest runs before the build step), with NODE_ENV=production so the size budgets hold."

patterns-established:
  - "Plan 03-16 measures the real run times and replaces the estimate table in docs/operations/ci.md."

requirements-completed: [OPS-02, OPS-03]

coverage:
  - id: D1
    description: "classify runs web/scripts/ci-classify.mjs with event data through env and contents/pull-requests/checks read only; the gate shows the mode in its check name"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/CiWorkflowTests.cs#ClassifyUsesTheTestedScript"
        status: pass
      - kind: command
        ref: "gh pr checks 5: classify pass, gate (fast) pass on head 0e24889"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stages 1 to 4 in order: locked restore, npm ci, audits (npm audit level low for web and tools/openapi-gen) before any build, build and format, tests, web typecheck/lint/Prettier/Vitest coverage and the OpenAPI types check"
    requirement: OPS-03
    verification:
      - kind: unit
        ref: "CiWorkflowTests#WebStageIsInTheFastPart, AuditsComeBeforeBuild, GateRunsTheWholeOpsOrder, WebScriptsKeepVerifyOrder"
        status: pass
      - kind: command
        ref: "Draft PR run: every step of stages 1 to 4 green on ubuntu-24.04 (gate (fast), 11 min)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Stages 5 and 6 (builds, loopback SQL container with a generated masked password, test secrets, Playwright chromium plus pixel, Lighthouse, coverage gate, license and notices gates) run only in full mode"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "CiWorkflowTests#HeavyStepsRunOnlyInFullMode, E2eUsesChromiumAndPhone, ContainerIsLoopbackAndSecretIsGenerated, FailureReportsAreUploadedForSevenDaysOnly, NoWorkflowCarriesAProductionSecret"
        status: pass
    human_judgment: true
    rationale: "The structure is tested, but the heavy steps have not executed on a runner: a draft PR runs the fast part, and weekly.yml and workflow_dispatch need the file on main. The first full-mode run is plan 03-16."
  - id: D4
    description: "weekly.yml runs on schedule 0 18 * * 0 and workflow_dispatch through workflow_call with all-engines true; ci.yml reads inputs.all-engines only in if: conditions"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "CiWorkflowTests#WeeklyRunsAllEngines, CiAcceptsWorkflowCall"
        status: pass
    human_judgment: true
    rationale: "GitHub runs schedules only from main, so the first weekly run is after the merge."
  - id: D5
    description: "docs/operations/ci.md explains each run kind, how to read a failed run, the minutes estimate and the D-16 fallback"
    requirement: OPS-02
    verification:
      - kind: command
        ref: "dotnet test --project tests/Csps.ArchitectureTests: 176 of 176 pass with the page present"
        status: pass
    human_judgment: true
    rationale: "Plain-English clarity is a reading judgment for the owner."

duration: 39min
completed: 2026-10-16
status: complete
---

# Phase 3 Plan 11: The complete OPS-02 gate and the weekly all-engine run Summary

**ci.yml now holds all six OPS-02 stages in order, classified by the tested ci-classify.mjs, with Playwright and Lighthouse running against a loopback SQL container whose password is generated and masked per run, and weekly.yml reuses it with every Playwright project.**

## Performance

- **Duration:** 39 min
- **Started:** 2026-10-16T05:39:47Z
- **Completed:** 2026-10-16T06:19:00Z
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 auto)
- **Files modified:** 7 (2 new, 5 edited, counting the SUMMARY and planning files separately)

## Accomplishments

- Tracer (Task 1): `classify` checks out with full history, sets up Node 24.21.0 and runs `node web/scripts/ci-classify.mjs` with `GITHUB_EVENT_NAME`, `PR_DRAFT`, `BASE_SHA`, `HEAD_SHA` and `GH_TOKEN` in `env:`. The gate gained `setup-node` with an npm cache over both lock files, `npm ci` for `web` and `tools/openapi-gen`, the two `npm audit --audit-level=low` runs before any build, and the stage 4 web and OpenAPI checks. The draft PR ran it end to end: `classify` and `gate (fast)` are green on head `0e24889`.
- Stages 5 and 6 (Task 2), each with `if: needs.classify.outputs.mode == 'full'`: web build and budget build; a SQL Server container from the `SqlServerInstance` image published on `127.0.0.1:1433` only; `Initialize-DevSecrets.ps1` and `dotnet dev-certs https`; a Playwright browser cache and install; Playwright with `CSPS_E2E_CONNECTION` set for that one command; Lighthouse after a DevSeed run on `CSPS_Dev` with dummy `Smtp__*` values; the coverage gate; the web license and notices checks; the NuGet license and notices drift check; a failure-only upload of the Playwright report and results for 7 days.
- Task 3: `workflow_call` with a boolean `all-engines` input on `ci.yml`, `weekly.yml` (Sunday 18:00 UTC, also manual), and `docs/operations/ci.md`.
- `CiWorkflowTests` grew by 12 facts; the whole architecture project passes (176 of 176). `grep` acceptance counts all hold (`ci-classify.mjs` 1, `audit-level=low` 2, `127.0.0.1:1433:1433` 1, `::add-mask::` at least 1, `Invoke-CoverageGate.ps1` 1, the THIRD-PARTY-NOTICES drift check 1, `--project chromium --project pixel` 1, `0 18 * * 0` 1).

## Task Commits

1. **Task 1: Tracer, classifier and web stage**
   - `c88e850` test (RED): 4 facts failing (missing steps, classify without the script)
   - `326c316` feat (GREEN): classifier job, setup-node, npm ci, audits, stage 4 steps
   - `c3b32e2` fix: Rule 1 deviation below
2. **Task 2: Heavy stage**
   - `3f3d431` test (RED): 7 facts failing
   - `1e49143` feat (GREEN): stages 5 and 6 and the failure upload
3. **Task 3: Weekly run and guide**
   - `14f7ccb` test (RED): WeeklyRunsAllEngines, CiAcceptsWorkflowCall failing
   - `0e24889` feat (GREEN): workflow_call, weekly.yml, ci.md

**Plan metadata:** the docs(03-11) commit that adds this file and updates STATE, ROADMAP and REQUIREMENTS.

## Decisions Made

See `key-decisions`. Estimated minutes in `docs/operations/ci.md` are the research estimates and are marked as such.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest build-output suite failed on a clean checkout**
- **Found during:** Task 1 (first push of the draft PR run, `4 web vitest + coverage`)
- **Issue:** `web/src/test/build-output.node.test.ts` reads `src/Csps.Server/wwwroot`, which only `npm run build` writes. The pipeline order (and `verify.mjs`) runs Vitest before the build, so 16 tests failed in CI where nothing had been built. It had only ever passed locally because an earlier build was lying around.
- **Fix:** a `beforeAll` builds the web root once when `index.html` is missing, with `NODE_ENV=production` (Vitest sets `test`, which builds the development React bundle and trips the size budgets). The pipeline order and `verify.mjs` stay unchanged. RED was reproduced locally by moving `wwwroot` aside (16 failed), GREEN by the same run (16 passed).
- **Files modified:** `web/src/test/build-output.node.test.ts`
- **Commit:** `c3b32e2`

**2. [Rule 3 - Blocker] Container readiness without sqlcmd**
- **Found during:** Task 2
- **Issue:** the plan polls with the image's `/opt/mssql-tools18/bin/sqlcmd`. SQL Server 2025 images may not ship it, and the password would sit on a `docker exec` command line.
- **Fix:** poll the container log for "ready for client connections" for up to 120 seconds, then print the log tail and fail. No tool or password argument is needed.
- **Files modified:** `.github/workflows/ci.yml`
- **Commit:** `1e49143`

**3. [Plan wording] Password alphabet and the all-engines Playwright command**
- The password is `openssl rand -hex 24` plus `Aa1` instead of base64, so it contains no `=`, `+`, `/` or `;` that would need escaping in a connection string. The all-engines step runs `npm --prefix web run e2e` with no `--project`, which means every configured project. The plan's step names are kept; four helper steps were added (`5 playwright cache`, `5 playwright browsers all engines`, `5 playwright all engines`, `6 upload failure reports`) because the all-engines input may be read only in `if:` conditions.

**Total deviations:** 2 auto-fixed (1 bug, 1 blocker) plus one wording note. **Impact:** none on scope; the first fix repairs a latent defect in the web pipeline that would also have failed `npm run verify` on a clean machine.

## Issues Encountered

- The heavy steps (stages 5 and 6, integration tests) have not run on a runner. A draft PR classifies as `fast`, `workflow_dispatch` and `schedule` need the workflow on `main`, and the PR was not taken out of draft (instruction). Risks to watch in the first full run (plan 03-16): `Initialize-DevSecrets.ps1` and `Invoke-CoverageGate.ps1` on PowerShell 7 and ubuntu for the first time; `dotnet dev-certs https` on a fresh Linux runner; Lighthouse score on a 2-vCPU runner (thresholds unchanged, no retries added); `git diff --exit-code -- THIRD-PARTY-NOTICES.md` if line endings differ on Linux; whether `Smtp__Port` and the other dummy values satisfy the Development host's validation.
- `New-ThirdPartyNotices.ps1` restores again inside stage 6; with `CI=true` it uses locked mode like stage 1.
- The Vitest step takes about 5.5 minutes on the runner, so the fast gate is about 11 minutes.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. The surfaces added are the plan's threat model: T-03-41 (generated, masked password; loopback-only publish; tested), T-03-42 (only the Playwright report and results, only on failure, 7 days; tested), T-03-43 (no `secrets.*` other than the built-in token and no deploy credential in any workflow; tested by `NoWorkflowCarriesAProductionSecret`) and T-03-SC (every `uses:` is an owner-approved SHA pin; the existing pin tests pass).

## Next Phase Readiness

Ready for plan 03-12. Plan 03-16 runs the first full-mode pipeline and replaces the estimate table in `docs/operations/ci.md` with measured times.

## Self-Check: PASSED

- Files exist: `.github/workflows/ci.yml`, `.github/workflows/weekly.yml`, `docs/operations/ci.md`, `tests/Csps.ArchitectureTests/CiWorkflowTests.cs`, `web/src/test/build-output.node.test.ts`.
- Commits exist on the branch: `c88e850`, `326c316`, `c3b32e2`, `3f3d431`, `1e49143`, `14f7ccb`, `0e24889`; `git rev-list --count bf03559..0e24889` is 7.
- `dotnet test --project tests/Csps.ArchitectureTests`: 176 of 176 pass. `gh pr checks 5` on head `0e24889`: `classify`, `gate (fast)` and `secret scan` pass.
