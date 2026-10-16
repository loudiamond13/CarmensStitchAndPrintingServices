---
phase: 03-ci-cd-staging-deploy
plan: 15
subsystem: hygiene-checks
tags: [github-actions, conventional-commits, actionlint, zizmor, ops-01, ops-02, tdd, tracer]
created: "2026-10-16T02:40:00-05:00"
updated: "2026-10-16T02:40:00-05:00"
status: complete

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-01 owner approval of actionlint 1.7.12 and zizmor-action v0.6.4 (zizmor 1.30.1); 03-10 Hygiene workflow and HygieneWorkflowTests; 03-11 and 03-13 ci.yml, weekly.yml, deploy.yml"
provides:
  - "web/scripts/commit-lint.mjs: CONVENTIONAL_TYPES, checkSubject() and main(); CLI reads PR_TITLE, BASE_SHA, HEAD_SHA from env, exit 0 clean, 1 an offending subject, 2 the range could not be read"
  - "web/scripts/commit-lint.test.ts: 32 tests"
  - "hygiene.yml jobs `commit messages` (pull_request only), `actionlint` (checksum-verified 1.7.12) and `zizmor` (action pinned at cc914d7, zizmor 1.30.1, annotations only)"
  - "HygieneWorkflowTests: CommitMessagesJob, ActionlintIsPinned, ZizmorIsPinned"
affects: [03-16, 03-17, 03-20, 03-21, branch-rules]

actuals:
  tokens: 14000
  tasks: 2
  commits: 5
plan_head_before: 750aa83fc213262c78886fe59216b55e5411d51b
plan_head_after: 03118b95d67e32d682ebb7d0a75662488ebec8d6

tech-stack:
  added: []
  patterns:
    - "A tested pure checker (checkSubject) wrapped by a thin CLI with injected spawn and log, the same shape as ci-classify.mjs"
    - "Hygiene jobs each carry their own checkout, permissions and timeout, and a test pins the checksum or commit for each tool"

key-files:
  created:
    - web/scripts/commit-lint.mjs
    - web/scripts/commit-lint.test.ts
  modified:
    - .github/workflows/hygiene.yml
    - .github/workflows/weekly.yml
    - tests/Csps.ArchitectureTests/HygieneWorkflowTests.cs
    - tests/Csps.ArchitectureTests/CiWorkflowTests.cs

key-decisions:
  - "weekly.yml keeps `uses: ./.github/workflows/ci.yml` with an inline `# zizmor: ignore[self-repository]` and the reason: zizmor 1.30.1 wants GitHub's new `$/` self-repository form, but the pinned actionlint 1.7.12 rejects `$/` as an invalid reusable workflow reference, so adopting it would fail the actionlint job"
  - "CiWorkflowTests accept the local-workflow form with that exact ignore comment and nothing else (a different ignore rule is refused)"
  - "actionlint runs with no path argument from the repository root, so it also covers any workflow file the in-repo tests do not read"
  - "zizmor uses the action's default online audits with the default github.token (contents: read), and the default inputs (all workflows and dependabot.yml)"

requirements-completed: [OPS-01, OPS-02]

coverage:
  - id: D1
    description: "checkSubject accepts the Conventional Commits forms (type, optional lower case scope, optional !, a git Revert subject, the ship-note form) and refuses everything else with a reason; main checks the PR title and every non-merge subject in BASE_SHA..HEAD_SHA, exits 1 on an offender, 2 on a missing or non-commit id or a failing git log"
    requirement: OPS-01
    verification:
      - kind: unit
        ref: "web/scripts/commit-lint.test.ts (32 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The real history of this branch passes: 93 non-merge subjects between the merge base with origin/main and HEAD, plus the title `feat(03): CI/CD pipeline and production deploy`; a bad title exits 1"
    requirement: OPS-01
    verification:
      - kind: command
        ref: "BASE_SHA=$(git merge-base origin/main HEAD) HEAD_SHA=$(git rev-parse HEAD) PR_TITLE=... node web/scripts/commit-lint.mjs (exit 0)"
        status: pass
    human_judgment: false
  - id: D3
    description: "hygiene.yml has the `commit messages` job on pull_request only, with fetch-depth 0, persist-credentials false, Node 24.21.0, and the title and range in env only (CWE-77)"
    requirement: OPS-01
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/HygieneWorkflowTests.cs#CommitMessagesJob"
        status: pass
    human_judgment: false
  - id: D4
    description: "The actionlint job installs the 1.7.12 linux tarball only after sha256sum -c matches 8aca8db9..., then lints every workflow; the zizmor job uses zizmorcore/zizmor-action at cc914d7f... with version 1.30.1, advanced-security false and annotations true"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/HygieneWorkflowTests.cs#ActionlintIsPinned, #ZizmorIsPinned"
        status: pass
      - kind: command
        ref: "PR #5 head 03118b9: actionlint, zizmor and commit messages checks pass"
        status: pass
    human_judgment: false
  - id: D5
    description: "All four workflows pass actionlint 1.7.12 locally (Windows binary, SHA-256 checked against 6e7241b5...) with no finding"
    requirement: OPS-02
    verification:
      - kind: command
        ref: "artifacts/tools/actionlint/1.7.12/actionlint.exe .github/workflows/ci.yml hygiene.yml weekly.yml deploy.yml (exit 0, no output)"
        status: pass
    human_judgment: false
---

# Phase 3 Plan 15: Conventional Commits and workflow lint Summary

**Every PR title and commit is checked for the Conventional Commits form by a tested Node script, and every workflow is linted by checksum-pinned actionlint 1.7.12 and commit-pinned zizmor 1.30.1.**

## Performance

- **Duration:** about 30 min (start 2026-10-16 02:10 -05:00)
- **Tasks:** 2 (a tracer, then an auto task)
- **Files:** 2 created, 4 modified
- **Commits:** 5 task commits (two RED, two GREEN, one fix)

## Accomplishments

- OPS-01: `web/scripts/commit-lint.mjs` (Node built-ins only, `// @ts-check`) refuses a subject that is not `type(scope)!: summary` with one of eleven types, a lower case scope and a space plus a summary after the colon. A git `Revert "..."` subject and the `/gsd-ship` note form pass. Each refusal prints the subject and a plain reason. The PR title and the commit range arrive through env (T-03-24), and `BASE_SHA` and `HEAD_SHA` must look like commit ids, so a value such as `--output=x` never reaches git.
- Tracer proof: on the real branch the title and all 93 non-merge subjects passed, and a bad title exited 1. The same check then ran on PR #5 as the `commit messages` job and passed in 7 to 8 seconds.
- OPS-02: the `actionlint` job downloads the linux tarball, runs `sha256sum -c` before `tar`, and lints the repository's workflows; the `zizmor` job runs the owner-approved action commit with `version: 1.30.1`, `advanced-security: false` and `annotations: true`.
- Both owners' approvals in 03-01 were present, so both tools were adopted; HygieneWorkflowTests pins each.

## Task Commits

1. **Task 1 RED:** `553d217` test(03-15): Conventional Commits check for PR titles and commits (RED)
2. **Task 1 GREEN:** `47ee3a5` feat(03-15): Conventional Commits check on every PR (OPS-01)
3. **Task 2 RED:** `2897950` test(03-15): workflow lint jobs as approved (RED)
4. **Task 2 GREEN:** `ba92abf` feat(03-15): actionlint and zizmor workflow lint (OPS-02)
5. **Fix after the first CI run:** `03118b9` fix(03-15): keep the weekly self-call as ./ and tell zizmor why

## actionlint findings fixed

None. actionlint 1.7.12 (Windows binary, SHA-256 `6e7241b5...` checked with Get-FileHash and sha256sum) reported nothing for ci.yml, hygiene.yml, weekly.yml and deploy.yml. This machine has no shellcheck, so the local run did not lint the `run:` scripts; the CI job uses the runner's shellcheck and passed on PR #5.

## zizmor finding handled (first CI run)

zizmor 1.30.1 reported one low finding on the first push: `weekly.yml:15: use GitHub's dedicated self-repository syntax: use '$/...' instead of './...'` (audit `self-repository`, new in 1.30.0). Trying the `$/` form locally made actionlint 1.7.12 fail with `reusable workflow call ... is not following the format "owner/repo/path/to/workflow.yml@ref" nor "./path/to/workflow.yml"`. Two owner-approved, pinned tools disagreed, so weekly.yml keeps the `./` form that actionlint and the runner both accept, with `# zizmor: ignore[self-repository]` and the reason on the same line. When actionlint is bumped to a version that knows `$/`, switch the line and drop the ignore (the CiWorkflowTests regex then needs `$/` allowed too).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] zizmor failed the PR on the weekly.yml self-call**
- **Found during:** Task 2 (first CI run of the new `zizmor` job)
- **Issue:** the `self-repository` audit flagged `uses: ./.github/workflows/ci.yml`; the suggested `$/` form is rejected by actionlint 1.7.12
- **Fix:** inline `# zizmor: ignore[self-repository]` with the reason; CiWorkflowTests' local-workflow pattern accepts that exact comment and the weekly test accepts both spellings of the line; a test asserts any other ignore rule is refused
- **Files modified:** `.github/workflows/weekly.yml`, `tests/Csps.ArchitectureTests/CiWorkflowTests.cs` (not in the plan's file list)
- **Verification:** CiWorkflowTests 33 of 33, HygieneWorkflowTests 9 of 9, local actionlint clean, PR #5 zizmor check passed
- **Commit:** `03118b9`

**Total deviations:** 1 auto-fixed (1 blocking). **Impact:** none on scope; one comment and one regex.

### Other notes

- The plan said 288 non-merge subjects in the range; the real run found 93 (the plan's count was from a different checkout or ref). All pass.
- ci.yml and deploy.yml needed no change.

## Known Stubs

None.

## Threat Flags

None. The plan's register is covered: T-03-23 (actionlint and zizmor on every PR), T-03-24 (title through env, asserted by CommitMessagesJob and the existing NoExpressionSinkInRun), T-03-SC (checksum and commit pins asserted by tests). Both new lint jobs and the commit check use `contents: read` and `persist-credentials: false`.

## Pull request checks

Pushed to PR #5 (still a draft). At head `03118b9`: `actionlint`, `zizmor`, `commit messages`, `secret scan`, `classify` and `gate (fast)` all pass. The first push (`ba92abf`) failed only `zizmor`, fixed by `03118b9`. The PR title passed the new check and was not edited.

## Self-Check: PASSED

- FOUND: web/scripts/commit-lint.mjs, web/scripts/commit-lint.test.ts
- FOUND commits: 553d217, 47ee3a5, 2897950, ba92abf, 03118b9
- Acceptance criteria: `grep -c commit-lint.mjs hygiene.yml` 1, `PR_TITLE:` 1, the actionlint checksum 1, the zizmor commit 1, `advanced-security: false` 1; commit-lint.mjs imports are all `node:`.
