---
phase: 03-ci-cd-staging-deploy
plan: 01
subsystem: ci-gate
tags: [github-actions, ci, sha-pinning, least-privilege, architecture-tests, ops-02, d-14, tracer]
created: "2026-10-16T00:20:00-05:00"
updated: "2026-10-16T00:20:00-05:00"

requires:
  - phase: 04-identity-authentication
    provides: "Phase 4 shipped to main (PR #4, merge d69abb3); this branch was merged with origin/main (7975967) so the Phase 3 PR shows only Phase 3 changes"
provides:
  - ".github/workflows/ci.yml: classify job (draft = fast, otherwise full) and the gate job named gate (<mode>) with the .NET steps in OPS-02 order"
  - "CiWorkflowTests (17 facts) and WorkflowText: pin, permission, timeout, runner, trigger, injection and step-order rules that hold every later workflow file to the same bar"
  - "Owner approval of the Phase 3 CI actions and binaries recorded in docs/dependencies.json and docs/dependencies.md"
  - "Phase 3 draft pull request #5 to main with a green gate (fast)"
affects: [03-02, 03-04, 03-09, 03-10, 03-11, 03-12, ci-workflow, deploy-package]

actuals:
  tokens: 10000
  tasks: 3
  commits: 4
plan_head_before: 7975967f6c1fec8d39ae1cab52569d424fab30d2
plan_head_after: 2ccdb1e53bf5d1d62f83294b07169a92615f7a9b

tech-stack:
  added: []
  patterns:
    - "Workflow files are asserted by a line-based reader (WorkflowText) in architecture tests, with no YAML package"
    - "Every uses: is owner/repo@<40-hex commit> # vX.Y.Z and must be in the test's ApprovedActions table; detector samples prove each rule bites"
    - "Event data reaches scripts only through env:, never inside run:"

key-files:
  created:
    - .github/workflows/ci.yml
    - tests/Csps.ArchitectureTests/CiWorkflowTests.cs
    - tests/Csps.ArchitectureTests/WorkflowText.cs
  modified:
    - docs/dependencies.json
    - docs/dependencies.md
    - tests/Csps.Domain.UnitTests/Time/TimeZoneResolverTests.cs

key-decisions:
  - "The gate job is one job with ordered steps so the step order is the OPS-02 order; the mode comes from a small upstream classify job because a job name cannot read its own steps."
  - "ci.yml keeps the inline draft-or-full classify; web/scripts/ci-classify.mjs (plan 03-04) is wired in by plan 03-11, which must give classify a checkout with fetch-depth 0 and keep the job name gate (full)."
  - "CiJobsNeverGrantWrite and NoWorkflowGrantsBroadPermissions were added beside the planned facts so no later job can quietly gain write or read-all/write-all."
  - "A Linux-only difference in the stored Asia/Manila zone (SupportsDaylightSavingTime is true from tzdata history) is handled by asserting the +08 offset in January and July, not by changing production code."

patterns-established:
  - "New workflows are covered automatically: CiWorkflowTests walks every .yml file in .github/workflows; a .yaml file fails WorkflowFilesExistAndAreAllYml."
  - "Task 2 equivalence evidence for a deleted branch: git merge-base --is-ancestor origin/main HEAD plus the merge commit on origin/main."

requirements-completed: [OPS-02]

coverage:
  - id: D1
    description: "Every PR to main and every push to main gets one CI check named gate (<mode>) on ubuntu-24.04; the .NET steps run locked restore, build, format check, unit tests, integration tests (container, full mode only), architecture tests in that order"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/CiWorkflowTests.cs#GateStepsFollowOpsOrder, GateCheckNameCarriesTheMode, IntegrationTestsRunOnlyInFullModeAgainstTheContainer"
        status: pass
      - kind: integration
        ref: "GitHub Actions run 38854500503 on PR #5: classify and gate (fast) succeeded, steps 1 to 3 green, integration tests skipped in fast mode"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every uses: is an owner-approved full commit SHA with a version comment; top-level permissions are empty; every job has a timeout; every checkout sets persist-credentials: false; runner labels are pinned; no pull_request_target; no event data inside run:"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "CiWorkflowTests#EveryUsesIsAnApprovedShaPin, PinDetectorCatchesLooseAndUnapprovedReferences, TopLevelPermissionsAreEmpty, NoWorkflowGrantsBroadPermissions, CiJobsNeverGrantWrite, EveryJobHasATimeout, CheckoutNeverPersistsCredentials, RunnersArePinned, NoWorkflowUsesPullRequestTarget, RunDetectorsCatchTheirSamples, NoExpressionSinkInRun"
        status: pass
    human_judgment: false
  - id: D3
    description: "ci.yml triggers (pull_request on main with four types, push to main, workflow_dispatch, no path filter) and concurrency (cancel older PR runs, never cancel main)"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "CiWorkflowTests#CiTriggersAndConcurrency"
        status: pass
    human_judgment: false
  - id: D4
    description: "The owner approved each CI action and binary at its exact version and SHA before it was added, recorded in docs/dependencies.json approvals and docs/dependencies.md"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests DependencyRegistryTests (whole project 157 of 157 passed after the registry edit)"
        status: pass
    human_judgment: true
    rationale: "The approval itself is the owner's reply in chat (approve-all, 2026-10-15T22:05-05:00); a verifier can only check that it is recorded, not that it was given."
  - id: D5
    description: "The Phase 3 draft pull request to main exists and the head commit's gate (fast) check passes on GitHub"
    requirement: OPS-02
    verification:
      - kind: integration
        ref: "gh pr checks gsd/phase-03-ci-cd-staging-deploy prints pass for gate (fast); gh pr view prints isDraft true, base main, PR #5"
        status: pass
    human_judgment: false

duration: 60min
completed: 2026-10-16
status: complete
---

# Phase 3 Plan 01: CI gate tracer Summary

**An ordered, SHA-pinned, least-privilege `gate (<mode>)` GitHub Actions check (locked restore, build, format, unit, integration, architecture tests) guarded by 17 architecture-test facts, proven by a green `gate (fast)` on the Phase 3 draft PR #5.**

## Performance

- **Duration:** about 60 min (including two CI rounds of about 4 min each)
- **Started:** 2026-10-16T04:30:00Z (approximate; the plan clock was not captured at the first read)
- **Completed:** 2026-10-16T05:25:00Z
- **Tasks:** 3 (Tasks 1 and 2 were owner decisions resolved by the orchestrator before this run)
- **Files modified:** 15 (3 new, 12 edited including 9 formatting-only files)

## Accomplishments

- `ci.yml` has a `classify` job (draft PR gives `fast`, anything else `full`, the draft flag passed through `env:`) and a `gate` job whose check name is `gate (<mode>)`. Top-level `permissions: {}`, `contents: read` only on the gate, `timeout-minutes` 5 and 60, `persist-credentials: false`, concurrency that cancels superseded PR runs and never a run for main.
- `CiWorkflowTests` and `WorkflowText` read every file in `.github/workflows` and hold it to the pin, permission, timeout, runner, trigger, injection and step-order rules, each rule with a detector sample. Later workflow files (plans 03-09 onward) are covered the moment they exist.
- The owner's `approve-all` decision (2026-10-15T22:05-05:00) is recorded in `docs/dependencies.json` (new `approvals` entry) and in a new plain-words section "CI actions and tools (Phase 3)" in `docs/dependencies.md`. Declined items: none.
- Tracer result: PR #5 (draft, base `main`), run 38854500503: `classify` and `gate (fast)` green on ubuntu-24.04 in 3m38s. Locked restore, build, format check, unit tests and architecture tests all passed on Linux; integration tests were skipped by design in fast mode.

## Task Commits

1. **Task 1: Owner approves CI actions and binaries** - decision resolved by the owner before this run; recorded in `172a2f3` (docs part of the feat commit)
2. **Task 2: Phase 4 relation** - decision `ship-phase-4-first`; Phase 4 shipped (PR #4, merge `d69abb3` on origin/main) and was merged into this branch as `7975967` before this run
3. **Task 3: Tracer, green `gate (fast)` on the draft PR**
   - `f24b846` (test, RED): 13 of 17 CiWorkflowTests facts failed because ci.yml did not exist
   - `1ccb342` (style): `dotnet format` fix of nine Phase 4 files so the format step starts clean (deviation 1)
   - `172a2f3` (feat, GREEN): ci.yml and the approval record; 17 of 17 pass
   - `2ccdb1e` (fix): Linux-only TimeZoneResolverTests assertion (deviation 2)

**Plan metadata:** recorded in the docs(03-01) commits that add this file and update STATE and ROADMAP.

## Files Created/Modified

- `.github/workflows/ci.yml` - classify and gate jobs, triggers, concurrency, empty default permissions
- `tests/Csps.ArchitectureTests/CiWorkflowTests.cs` - 17 facts, `ApprovedActions` allow-list (the six owner-approved actions)
- `tests/Csps.ArchitectureTests/WorkflowText.cs` - `Files`, `UnreadFiles`, `Lines`, `Jobs`, `RunBlocks`, `UsesValues`, `Steps`, `StepName`, `StepNames`, `Section`
- `docs/dependencies.json`, `docs/dependencies.md` - owner approval record and plain-words section
- `tests/Csps.Domain.UnitTests/Time/TimeZoneResolverTests.cs` - zone assertion that holds on Linux and Windows
- Nine formatting-only files (import order, one spacing): `EmailSenderOptions.cs`, `CspsDbContext.cs`, `InviteController.cs`, `PasswordController.cs`, `ListSessionsHandlerTests.cs`, `AuditTrailTests.cs`, `SiteSettingsReaderTests.cs`, `MailKitTransportTests.cs`, `BootstrapManagerTests.cs`

## Decisions Made

- One ordered gate job instead of several jobs: the step order is the OPS-02 order and the test can assert it, and each extra job would repeat checkout and SDK setup against a 2,000-minute budget.
- Inline classify for now. `web/scripts/ci-classify.mjs` exists from plan 03-04 but is not wired here (the plan says 03-11 replaces the inline step). 03-11 must check out with `fetch-depth: 0` in the classify job (the three-dot diff needs the merge base) and keep the gate job name exactly `gate (full)` so `package` mode can fire. The gate checkout here already uses `fetch-depth: 0`.
- Two extra facts beyond the plan (`NoWorkflowGrantsBroadPermissions`, `CiJobsNeverGrantWrite`) and one extra file-extension fact (`WorkflowFilesExistAndAreAllYml`, so a `.yaml` file cannot dodge the tests).
- The SQL Server image is not referenced in ci.yml (Testcontainers pulls it); `ContainerImageMatchesTheFixture` will hold any future reference equal to `SqlServerInstance.ContainerImage` (`2025-CU9-ubuntu-24.04`, unchanged per the approval).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Phase 4 code failed `dotnet format --verify-no-changes`**
- **Found during:** Task 3, local run of the planned step "2 format check" before pushing
- **Issue:** Nine files merged from Phase 4 had unsorted `using` lines (eight) and one missing space in a collection expression, so the format step would fail on the first CI run.
- **Fix:** Ran `dotnet format Csps.slnx --no-restore` and committed only those nine files as a formatting-only change (10 lines).
- **Files modified:** the nine files listed above
- **Verification:** `dotnet format Csps.slnx --verify-no-changes --no-restore` exit 0; `dotnet build Csps.slnx` 0 warnings; green on GitHub.
- **Committed in:** `1ccb342`

**2. [Rule 1 - Bug] `TimeZoneResolverTests.ResolvesStoredZone` assumed Windows time-zone data**
- **Found during:** Task 3, first CI run (run 38854013736), step "3 unit tests"
- **Issue:** `zone.SupportsDaylightSavingTime.ShouldBeFalse()` fails on Linux, where the stored `Asia/Manila` zone carries historic DST rules from tzdata. Manila has no current DST; the assertion tested the platform, not the rule.
- **Fix:** Assert the +08 offset on 2026-01-01 and 2026-07-01 instead. Production code unchanged.
- **Files modified:** `tests/Csps.Domain.UnitTests/Time/TimeZoneResolverTests.cs`
- **Verification:** 8 of 8 in the class pass locally; the second CI run is green. The fixed-offset test of the custom zone (`FallsBackToFixedOffsetWhenNothingResolves`) keeps its `SupportsDaylightSavingTime` check, which is valid for a custom zone.
- **Committed in:** `2ccdb1e`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking), one CI round used of the three allowed.
**Impact on plan:** Both were Windows-versus-Linux or drift issues that the tracer exists to surface (research Pitfall 3). No scope creep.

## Issues Encountered

- The first `git push` of the fix timed out reaching github.com; retried with 2, 4 and 8 second backoff and the third retry succeeded.
- Task 2's literal check `git merge-base --is-ancestor gsd/phase-04-identity-authentication origin/main` cannot run because the local Phase 4 branch was deleted after the merge. Equivalent evidence used: `git merge-base --is-ancestor origin/main HEAD` is true after `git fetch origin`, and `d69abb3 Merge pull request #4 from loudiamond13/gsd/phase-04-identity-authentication` is origin/main's tip. The orchestrator had already merged origin/main into this branch (`7975967`), so no conflict resolution was needed in this run.

## TDD Gate Compliance

- **RED (`f24b846`):** 13 of 17 CiWorkflowTests facts failed on their assertions (ci.yml missing, no files, no gate job); the other four are locks that hold vacuously until a workflow exists. Semantic assessment: the targets executed and failed for the intended reason (behavior absent). The `gsd_run check tdd-red-evidence` classifier was not run (the project reports MTP console output, not a supported format); evidence is the console run.
- **GREEN (`172a2f3`):** 17 of 17 pass; whole architecture project 157 of 157.
- **REFACTOR:** none needed.

## Known Stubs

None.

## Threat Flags

None. Mitigations for T-03-01 (SHA pins and allow-list), T-03-02 (empty default permissions, `contents: read` only), T-03-03 (persist-credentials false), T-03-04 (draft flag through env, sink detectors), T-03-05 (pull_request_target banned), T-03-06 (timeouts, cancel superseded PR runs), T-03-07 (Phase 4 shipped first) and T-03-SC (owner approval before any pin) are implemented and tested. No npm, NuGet or PyPI package was added.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- PR #5 is a draft and stays one; do not mark it ready or merge it from this plan. Head `gate (fast)` is green at run https://github.com/loudiamond13/CarmenStitchAndPrintingServices/actions/runs/38854500503 (the SUMMARY and metadata commits pushed afterwards start further runs).
- Later plans can append steps to the `gate` job (stage digits 4 to 7 after the existing 3s) and new `.yml` files; `CiWorkflowTests` already checks them. `ApprovedActions` already lists setup-node, upload-artifact and zizmor-action for those plans.
- The format step is clean on Linux and Windows now; any new C# must pass `dotnet format --verify-no-changes`.

## Self-Check: PASSED

- Files exist: `.github/workflows/ci.yml`, `tests/Csps.ArchitectureTests/CiWorkflowTests.cs`, `tests/Csps.ArchitectureTests/WorkflowText.cs`, `docs/dependencies.json`, `docs/dependencies.md`.
- Commits `f24b846`, `1ccb342`, `172a2f3`, `2ccdb1e` are ancestors of HEAD (4 measured since `plan_head_before`).
- Acceptance: `permissions: {}` count 2, `persist-credentials: false` 1, `--locked-mode` 1, `CSPS_TEST_SQL: container` 1, `timeout-minutes:` 2; `"by": "owner"` count 5 to 6; heading "CI actions and tools (Phase 3)" present; `gh pr view` prints `true` and `main`; `gh pr checks` prints `pass` for `gate (fast)`.
- Verification: `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiWorkflowTests"` 17 of 17; whole architecture project 157 of 157; Domain 590 of 590 and Application 368 of 368 unit tests pass; `dotnet build Csps.slnx` 0 warnings; `dotnet format --verify-no-changes` exit 0.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-16*
