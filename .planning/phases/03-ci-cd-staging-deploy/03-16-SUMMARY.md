---
phase: 03-ci-cd-staging-deploy
plan: 16
subsystem: ci-github-proof
tags: [github-actions, ruleset, lighthouse, playwright, ops-01, ops-02, ops-03, tdd, tracer]
created: "2026-10-16T13:40:00-05:00"
updated: "2026-10-16T14:45:00-05:00"
status: complete

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-01 to 03-15: the gate, Hygiene, CodeQL and dependency review workflows, the merge gate, the ruleset JSON"
provides:
  - "Repository settings applied and read back: squash-only merges, Dependabot alerts and security updates (already on), SHA-pin requirement true"
  - "ci.yml job `gate result`, the one required check a docs-only PR can satisfy; docs/operations/main-ruleset.json requires it plus the Hygiene and Security checks"
  - "PR 1 ready for review with `gate (full)` and every Hygiene and Security check green on ubuntu-24.04 (CI run 38953580695)"
  - "The full ruleset on main (id 25270041) applied and read back, the interim ruleset deleted"
  - "LCP report-only in the Lighthouse gate until Phase 11 (REPORT_ONLY_METRICS), every other assertion still hard"
  - "Linux fix-ups: Modal middle-press paste, E2E axe settle, integration-test cold start and mail sink waits, Lighthouse Chrome sandbox, Linux font fallbacks, coverage gate include filter"
  - "Measured CI minutes in docs/operations/ci.md"
affects: [03-17, branch-rules, ci]

actuals:
  tokens: 300000
  tasks: 3
  commits: 18
plan_head_before: ce66eedda0118db0faa57abca7dec755e857c9f0
plan_head_after: ea1a2d54198938f2686669826d6d2ca656fc6e00

tech-stack:
  added: []
  patterns:
    - "A fixed-name `gate result` job (needs: classify, gate; if: always()) as the single required check, while `gate (full)` stays unique to full runs"
    - "One named list (REPORT_ONLY_METRICS) for a temporary, owner-approved waiver, with tests that fail if any other assertion is downgraded"
    - "Lighthouse prints the layout-shift culprit lines on a missed threshold and the scores in the GitHub run summary"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - docs/operations/main-ruleset.json
    - docs/operations/branch-rules.md
    - docs/operations/ci.md
    - docs/operations/deploy.md
    - docs/development.md
    - docs/web/release-gates.md
    - .claude/CLAUDE.md
    - .planning/WINDOWS.md
    - .planning/ROADMAP.md
    - .planning/phases/03-ci-cd-staging-deploy/deferred-items.md
    - tests/Csps.ArchitectureTests/CiWorkflowTests.cs
    - tests/Csps.ArchitectureTests/RepoRulesTests.cs
    - web/scripts/ci-classify.test.ts
    - web/scripts/merge-gate.mjs
    - tools/scripts/Merge-PullRequest.ps1
    - tools/scripts/Invoke-CoverageGate.ps1
    - web/src/components/overlays/Modal.tsx
    - web/src/components/overlays/Modal.test.tsx
    - web/e2e/fixtures.ts
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/ResendCodeEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/SignInEndpointTests.cs
    - web/scripts/lighthouse.mjs
    - web/scripts/lighthouse-assert.mjs
    - web/scripts/lighthouse-assert.test.ts
    - web/src/ui/base.css
    - web/scripts/font-metrics.test.ts
    - web/visual/reference/rulings.css

key-decisions:
  - "The required check is a separate always-run job `gate result`, not a renamed gate: `gate (full)` stays unique to full runs, so findProvenTree can never read a docs run as the full proof"
  - "Owner decision 2026-10-16: LCP is report-only in the Lighthouse gate until Phase 11 (WINDOWS.md entry 1); the 2000 ms target is unchanged, a missing LCP value still fails, every other assertion is a hard failure"
  - "The full ruleset replaced the orchestrator's interim ruleset only after the gate and every required check were green; one ruleset remains"
  - "Sixteen-at-a-time plus a warm-up request in the parallel authorization test, and waiting for the mail sink before counting: the Linux runner is slower than LocalDB on a laptop, and no retries or thresholds were touched"

requirements-completed: [OPS-01, OPS-02, OPS-03]

coverage:
  - id: D1
    description: "Squash-only merges, Dependabot alerts and security updates, and the SHA-pin requirement applied and read back from the API"
    requirement: "OPS-01, OPS-03"
    verification:
      - kind: other
        ref: "gh api repos/loudiamond13/CarmensStitchAndPrintingServices (allow_merge_commit false, allow_rebase_merge false, allow_squash_merge true, delete_branch_on_merge false); .../actions/permissions (sha_pinning_required true); .../vulnerability-alerts (204); .../automated-security-fixes (enabled)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A docs-only PR can satisfy the required check: gate result job, ruleset JSON with the Hygiene and Security checks, ci-classify never mistakes a docs run for a full proof"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "tests/Csps.ArchitectureTests/CiWorkflowTests.cs#GateResultJobIsTheRequiredCheck, RepoRulesTests.cs#EveryRequiredCheckRunsOnEveryPullRequest, RulesetIsReadyToApply; web/scripts/ci-classify.test.ts (gate (docs) and gate result are not proof)"
        status: pass
    human_judgment: true
    rationale: "The gate result job has run on GitHub for draft (fails as designed), full failure (fails) and full success (passes). The docs-only success path is covered by tests but has not been seen on GitHub, because PR 1's diff is not docs-only."
  - id: D3
    description: "gate (full) green on GitHub with every Hygiene and Security check green"
    requirement: "OPS-02"
    verification:
      - kind: e2e
        ref: "CI run 38953580695 on b6d3921: gate (full) success in 18m17s, gate result success; gh pr checks 1 shows every check pass"
        status: pass
    human_judgment: false
  - id: D4
    description: "Ruleset on main applied and read back; interim ruleset deleted"
    requirement: "OPS-01"
    verification:
      - kind: other
        ref: "gh api repos/loudiamond13/CarmensStitchAndPrintingServices/rules/branches/main lists five rules, all from ruleset 25270041; gh api .../rulesets lists only that ruleset; PR 1 is MERGEABLE and CLEAN"
        status: pass
    human_judgment: false
  - id: D5
    description: "LCP is report-only until Phase 11 and no other Lighthouse assertion is downgraded"
    requirement: "OPS-02"
    verification:
      - kind: unit
        ref: "web/scripts/lighthouse-assert.test.ts#LCP is report-only until Phase 11 (WINDOWS.md entry 1)"
        status: pass
    human_judgment: true
    rationale: "A temporary owner-approved relaxation: the owner confirms it is lifted in Phase 11."
  - id: D6
    description: "Real CI minutes measured and recorded"
    requirement: "OPS-02"
    verification:
      - kind: other
        ref: "docs/operations/ci.md ## Measured (2026-10-16)"
        status: pass
    human_judgment: false

duration: 6h 30m
completed: 2026-10-16
---

# Phase 3 Plan 16: Prove the pipeline on GitHub Summary

**Free repository settings applied, a `gate result` check so the ruleset can be required on docs-only PRs too, the full gate and every Hygiene and Security check green on ubuntu-24.04 after a series of Linux-only fixes, LCP report-only until Phase 11 by owner decision, and the full ruleset on `main` replacing the interim one.**

## Performance

- **Duration:** about 6 h 30 min wall clock, mostly waiting on 10 to 22 minute GitHub runs
- **Started:** 2026-10-16T15:47:21Z
- **Completed:** 2026-10-16T19:50:00Z
- **Tasks:** 3 (Task 1 settings; Task 2 tracer: ready PR, green gate, ruleset; Task 3 minutes)
- **Files modified:** 29

## Accomplishments

- **Settings (Task 1), applied and read back on 2026-10-16:** `allow_merge_commit` false, `allow_rebase_merge` false, `allow_squash_merge` true, `delete_branch_on_merge` false; Dependabot alerts on (204) and security updates enabled (both were already on); secret scanning, push protection and private vulnerability reporting read back enabled; Actions `sha_pinning_required` true (accepted and reads back true; whether GitHub refuses a tag-pinned action was not tried, assumption A12). Recorded in `docs/operations/branch-rules.md`.
- **Docs-only PRs and the required check, test first:** the `result` job (`name: gate result`, `needs: [classify, gate]`, `if: ${{ always() }}`) passes only for `full:success`, `docs:success` or `package:success`; it failed correctly for a draft and for a failed gate on GitHub, and passed for the green full run. `gate (full)` is unchanged and unique to full runs, and `ci-classify.test.ts` proves a `gate (docs)` run or a `gate result` run is not a full proof. `main-ruleset.json` requires `gate result`, `secret scan`, `commit messages`, `actionlint`, `zizmor`, `dependency review`, `analyze (csharp)` and `analyze (javascript-typescript)`, and a test checks each name exists, runs on every PR and cannot be skipped.
- **Green gate on GitHub:** run 38953580695 (head `b6d3921`): `gate (full)` 18 min 17 s success, `gate result` success, and `gh pr checks 1` shows every check passing, including CodeQL and dependency review. PR 1 body set from the template (all items unticked) and marked ready; the CODEOWNERS errors call returns `{"errors":[]}`; `merge-gate.mjs 1` refused only for the then-failed gate checks and the 12 unticked Definition of Done items.
- **Ruleset:** after the gate was green, the full ruleset was applied (id 25270041, name `main`) and the orchestrator's interim ruleset (id 25265174) deleted, so one ruleset remains. Read back from `rules/branches/main`: `deletion`, `non_fast_forward`, `required_linear_history`, `pull_request` (0 approvals, no code owner review) and `required_status_checks` (branch up to date, the eight checks), no bypass, enforcement active. PR 1 stays `MERGEABLE` / `CLEAN`. Recorded in `branch-rules.md` with the interim step.
- **LCP report-only (owner decision):** `REPORT_ONLY_METRICS` (LCP only) in `web/scripts/lighthouse-assert.mjs`, used by `assertGateReport` for both CI and `npm run lighthouse`. A miss prints `WAIVED ... (report only until Phase 11, WINDOWS.md entry 1)` and goes to the GitHub run summary with the value and the 2000 ms target; a missing LCP value still fails; tests fail if any other category or metric is downgraded. Recorded in `release-gates.md`, `deferred-items.md`, `WINDOWS.md` and as a Phase 11 carry-over line in the roadmap.
- **Linux-only findings fixed at their cause** (see below). Docs for the public repo (`branch-rules.md`, `ci.md`, `deploy.md`, `.claude/CLAUDE.md`, `development.md`) are updated; `CSPS-PRD.md` left unchanged.

## Task Commits

1. **gate result, RED / GREEN:** `7ea48bd` (test), `f67b7fc` (ci).
2. **Docs for the public repo and settings record:** `508bc39`.
3. **Linux fix-ups:** `72f6940` (Modal RED), `23256d5` (Modal, axe settle), `f55819d`, `0d34c2e` (parallel authorization test), `e4b5285` (Lighthouse sandbox), `eb521aa` (Lighthouse culprit lines), `8e93d1d`, `2c22c1a` (font fallbacks and reference copy), `7657198` (mail sink waits), `b6d3921` (coverage gate include filter).
4. **LCP report-only:** `f832818`.
5. **Measured minutes and ruleset record:** `4cdaec9` (partial), `ea1a2d5` (final); halt note `4a0da3d`.

`f3507be` in the range is the orchestrator's own docs commit, not part of this plan. The plan metadata commit follows this file.

## Files Created/Modified

See the frontmatter list. Most important: `.github/workflows/ci.yml` (result job), `docs/operations/main-ruleset.json` (required checks), `web/scripts/lighthouse-assert.mjs` and `lighthouse.mjs` (waiver, sandbox flag, culprit lines), `web/src/components/overlays/Modal.tsx` (middle press), `web/src/ui/base.css` (Linux metric-compatible fallbacks), `tools/scripts/Invoke-CoverageGate.ps1`.

## Decisions Made

- `gate result` as a separate job rather than renaming the gate; a draft (`fast`) run fails it on purpose, so a stale success on the same commit can never satisfy the rule.
- The ruleset was applied only when the gate was green, and the interim ruleset was removed afterwards.
- The `[ci skip]` ship-note commit conflicts with a required-check ruleset (GitHub waits for checks that never start). Documented in `branch-rules.md`: push the note without `[ci skip]`.
- Any commit pushed to PR 1 after a green run starts a new full gate (the mode comes from the whole PR diff). For plan 03-17, the final head must be the one with the green `gate (full)` so package mode can reuse it.

## Deviations from Plan

### Auto-fixed Issues (more than the plan's five fix rounds; every round moved the run further, none lowered a threshold or added a retry, and the extra rounds were reported to the orchestrator at the halt)

**1. [Rule 1 - Bug] Linux pastes the X11 selection on a middle press**
- **Found during:** Task 2 (first full run, `dialog-fit` middle press: the confirm field got `ORD-2026-0148Sampaguita#2026`)
- **Fix:** the Modal's scrim cancels the default of a middle mousedown and mouseup (tests first). **Files:** `Modal.tsx`, `Modal.test.tsx`. **Commits:** `72f6940`, `23256d5`.

**2. [Rule 1 - Bug] E2E axe saw a toast still fading in as low contrast**
- **Fix:** `expectNoAxeViolations` waits for finite animations to end before axe runs. **Files:** `web/e2e/fixtures.ts`. **Commit:** `23256d5`.

**3. [Rule 1 - Bug] `/health` answered 503 inside the parallel authorization test**
- **Fix:** sixteen requests at a time (`f55819d`), then a warm-up request on the fresh host (`0d34c2e`); the first change alone did not cure it, which showed the cause was the cold start against the 3 second health budget. **Files:** `AuthorizationMatrixTests.cs`.

**4. [Rule 1 - Bug] Lighthouse could not open Chrome on the runner ("Unable to connect to Chrome")**
- **Fix:** `--no-sandbox` for Lighthouse's Chrome, only on Linux with `CI=true`, planned and unit-tested in `planSteps`. **Commit:** `e4b5285`.

**5. [Rule 1 - Bug] CLS 0.0598 on Linux (limit 0.05)**
- **Cause:** the metric-matched fallback faces name `local("Arial")`, which Linux does not have. **Fix:** also name Liberation Sans and Arimo (Arial's exact metrics); CLS is now 0.00045. **Files:** `base.css`, `font-metrics.test.ts`, `visual/reference/rulings.css`. **Commits:** `8e93d1d`, `2c22c1a`.
- **Own mistake, fixed:** I pushed `8e93d1d` after running only part of the web tests, so the full run caught `visual/reference/rulings.test.ts`. I now run the full `test:coverage`, typecheck, lint and format check before each push.

**6. [Rule 2 - Missing diagnostics] A failed Lighthouse run did not say which element shifted**
- **Fix:** `layoutShiftCulprits` prints one line per shifted element on a missed threshold (tested). **Commit:** `eb521aa`.

**7. [Rule 1 - Bug] Three auth tests counted the mail sink before it filled**
- **Fix:** they wait for the expected count with the existing `WaitForEmailsAsync` helper. **Commit:** `7657198`.

**8. [Rule 1 - Bug] The coverage gate (stage 6) never ran on Linux before: PowerShell expanded `[Csps.Domain]*`**
- **Found during:** Task 2, the first run that got past Lighthouse. **Fix:** pass `--coverlet-include=[Assembly]*` as one argument; the gate still passes on Windows (Domain 100%, Application 99.4%). **Commit:** `b6d3921`.

**Total deviations:** 8 auto-fixed. **Impact:** all necessary to get past Linux-only behavior; scope stayed on test, tooling and presentation files except the Modal middle-press and font-fallback changes, which are small product fixes.

## Issues Encountered

- Lighthouse LCP was 2127 to 2131 ms against 2000 ms. I stopped and reported as instructed, and the owner then chose report-only until Phase 11.
- The orchestrator pushed a docs commit during one run (`f3507be`), which cancelled that run; I watched the new head.
- `dotnet test` sometimes reports a handshake failure when it builds and tests in one go; building first and testing with `--no-build` is reliable.

## Authentication Gates

None.

## Known Stubs

None added.

## Threat Flags

None. The `--no-sandbox` flag is limited to the ephemeral CI runner (Linux with `CI=true`) and a localhost page.

## Follow-ups

- `CSPS-PRD.md` still describes the repository as private and branch rules as process-only; left unchanged as instructed.
- Phase 11: revisit fonts and empty `REPORT_ONLY_METRICS` (roadmap carry-over line, WINDOWS.md entry 1).
- Check the `sha_pinning_required` setting against the weekly workflow's local reusable workflow call once `main` has it.
- A docs-only PR's success path for `gate result` has not been seen on GitHub yet.
- The not-yet-measured minutes (package-mode run, all-engine weekly run, deploy) are estimates in `ci.md`.

## Next Phase Readiness

Ready for 03-17 (the mid-phase pipeline merge, on the owner's instruction). Merge only through `tools/scripts/Merge-PullRequest.ps1`; the ticked Definition of Done list is still the owner's step. After the final push of this plan, wait for its full gate to go green so the head that is merged has the proof.

## Self-Check: PASSED

Files and commits named above exist; architecture tests 215 of 215 and the full web suite (4405 tests) pass locally; the settings, the ruleset and the green checks read back as recorded.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-16*
