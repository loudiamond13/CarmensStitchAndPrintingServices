---
phase: 03-ci-cd-staging-deploy
plan: 16
subsystem: ci-github-proof
tags: [github-actions, ruleset, lighthouse, playwright, ops-01, ops-02, ops-03, tdd, tracer]
created: "2026-10-16T13:40:00-05:00"
updated: "2026-10-16T13:40:00-05:00"
status: halted

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-01 to 03-15: the gate, Hygiene, CodeQL and dependency review workflows, the merge gate, the ruleset JSON"
provides:
  - "Repository settings applied and read back: squash-only merges, Dependabot alerts and security updates (already on), SHA-pin requirement true"
  - "ci.yml job `gate result`, the one required check a docs-only PR can satisfy; docs/operations/main-ruleset.json requires it plus the Hygiene and Security checks"
  - "PR 1 ready for review; on GitHub the full gate now passes everything up to and including Playwright and the Lighthouse CLS limit"
  - "Linux fix-ups: Modal middle-press paste, E2E axe settle, integration-test cold start and mail sink waits, Lighthouse Chrome sandbox, Linux font fallbacks, Lighthouse culprit lines"
  - "Partial measured CI minutes in docs/operations/ci.md"
affects: [03-17, branch-rules, ci]

actuals:
  tokens: 220000
  tasks: 3
  commits: 14
plan_head_before: ce66eedda0118db0faa57abca7dec755e857c9f0
plan_head_after: 4cdaec932a24f32d3d92f7ae5d48a6c902dd8fd4

tech-stack:
  added: []
  patterns:
    - "A fixed-name `gate result` job (needs: classify, gate; if: always()) as the single required check, while `gate (full)` stays unique to full runs"
    - "Lighthouse prints the layout-shift culprit lines on a missed threshold, so a CI failure names the element"

key-files:
  created: []
  modified:
    - .github/workflows/ci.yml
    - docs/operations/main-ruleset.json
    - docs/operations/branch-rules.md
    - docs/operations/ci.md
    - docs/operations/deploy.md
    - docs/development.md
    - .claude/CLAUDE.md
    - tests/Csps.ArchitectureTests/CiWorkflowTests.cs
    - tests/Csps.ArchitectureTests/RepoRulesTests.cs
    - web/scripts/ci-classify.test.ts
    - web/scripts/merge-gate.mjs
    - tools/scripts/Merge-PullRequest.ps1
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
  - "The ruleset was NOT applied: the owner said to apply it only after `gate (full)` is green, and Lighthouse still misses the waived LCP limit; stopped and reported as instructed"
  - "Sixteen-at-a-time plus a warm-up request in the parallel authorization test, and waiting for the mail sink before counting: the Linux runner is slower than LocalDB on a laptop, and no retries or thresholds were touched"

requirements-completed: []

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
    rationale: "The gate result job has run only on full and fast PR runs on GitHub (it failed correctly for a draft and for a failed gate). The docs-only success path is not yet observed on GitHub, because this PR's diff is not docs-only."
  - id: D3
    description: "gate (full) green on GitHub with every Hygiene and Security check green"
    requirement: "OPS-02"
    verification:
      - kind: e2e
        ref: "CI run 38944055885 on 7657198: stages 1 to 5 pass including Playwright; Lighthouse CLS 0.00045 ok, LCP 2127 ms FAIL; stage 6 not reached"
        status: fail
    human_judgment: true
    rationale: "Only the owner-waived LCP limit stands between this run and green; the owner decides how to proceed (threshold untouched)."
  - id: D4
    description: "Ruleset on main applied and read back"
    requirement: "OPS-01"
    verification: []
    human_judgment: true
    rationale: "Not applied: the owner's condition (green gate first) is not met."
  - id: D5
    description: "Real CI minutes measured and recorded"
    requirement: "OPS-02"
    verification:
      - kind: other
        ref: "docs/operations/ci.md ## Measured (2026-10-16, partial)"
        status: unknown
    human_judgment: true
    rationale: "Partial: stage 6 of the full gate has no measurement until the gate gets past Lighthouse."

duration: 4h 0m
completed: 2026-10-16
---

# Phase 3 Plan 16: Prove the pipeline on GitHub Summary

**Free repository settings applied and read back, a `gate result` check added so the ruleset can be required on docs-only PRs too, and the full gate pushed on GitHub from first failure to one remaining miss: Lighthouse LCP (2127 ms against 2000 ms), the limit the owner waived until Phase 11.**

## Status: halted for an owner decision

`gate (full)` on PR 1 is **not green**, so the ruleset was not applied and plan 03-17 (the merge) must not start.

- **Run:** https://github.com/loudiamond13/CarmensStitchAndPrintingServices/actions/runs/38944055885 (head `7657198`, ubuntu-24.04)
- **Passed:** restore, build, format, unit, integration, architecture, web typecheck, lint, Prettier, Vitest with coverage, OpenAPI check, web build, budget build, SQL container, Playwright (chromium and pixel, 11 min), and every Hygiene and Security check on the earlier heads.
- **Lighthouse (mobile, production build, real host):** accessibility 1, best-practices 1, seo 1, performance 0.98, agentic-browsing 1; **CLS 0.00045 (ok)**; TBT 14 ms (ok); **LCP 2127 ms, needs < 2000 ms, FAIL**. The local figure was about 2.19 s, so the runner and the laptop agree.
- **Not reached because of the LCP failure:** stage 6 (coverage gate, web licenses, web notices, NuGet licenses and notices). They have never run on Linux in CI yet, so they may hold further Linux-only findings.
- No threshold was changed, no step skipped, no retry added.

**What the owner needs to decide** (the instruction was: stop and report when only LCP fails): how to let the full gate pass while LCP is waived. The honest options are (a) fix LCP now instead of waiting for Phase 11, or (b) approve a change to the Lighthouse step (for example, report LCP without failing on it until Phase 11); either is a threshold or step decision, so Claude did not make it. After that decision: re-run, fix anything stage 6 shows, apply the ruleset (`gh api -X POST repos/loudiamond13/CarmensStitchAndPrintingServices/rulesets --input docs/operations/main-ruleset.json`), read it back into `docs/operations/branch-rules.md`, finish the minutes in `docs/operations/ci.md`, and then plan 03-17.

## Performance

- **Duration:** about 4 h (wall clock, mostly waiting on 10 to 22 minute GitHub runs)
- **Started:** 2026-10-16T15:47:21Z
- **Completed:** 2026-10-16T18:40:00Z
- **Tasks:** Task 1 done; Task 2 partly (settings, ready PR, fix-ups, CODEOWNERS, merge gate done; green gate not reached); Task 3 partial
- **Files modified:** 24

## Accomplishments

- **Task 1 (settings), applied and read back on 2026-10-16:** `allow_merge_commit` false, `allow_rebase_merge` false, `allow_squash_merge` true, `delete_branch_on_merge` false; Dependabot alerts on (204) and security updates enabled (both were already on, only read back); secret scanning, push protection and private vulnerability reporting read back enabled; Actions `sha_pinning_required` true (the PUT to `actions/permissions` was accepted and reads back true; whether GitHub refuses a tag-pinned action was not tried, assumption A12). Recorded in `docs/operations/branch-rules.md`.
- **Docs-only PRs and the required check, test first:** RED tests, then the `result` job (`name: gate result`, `needs: [classify, gate]`, `if: ${{ always() }}`) that passes only for `full:success`, `docs:success` or `package:success`. `gate (full)` is unchanged and unique to full runs; `ci-classify.test.ts` now also proves that a `gate (docs)` run or a `gate result` run is not a full proof. `main-ruleset.json` now requires `gate result`, `secret scan`, `commit messages`, `actionlint`, `zizmor`, `dependency review`, `analyze (csharp)` and `analyze (javascript-typescript)`, and a test checks each of those names exists, runs on every PR and cannot be skipped. On GitHub the draft run showed `gate result` failing for `fast` and every other check passing, as designed.
- **PR 1** body set from the template (all items unticked, real summary text) and marked ready for review. CODEOWNERS errors call returns `{"errors":[]}`. `node web/scripts/merge-gate.mjs 1` refuses, and its reasons are the failed gate checks plus the 12 unticked Definition of Done items only.
- **Linux-only findings fixed at their cause** (see the deviations list).
- **Docs for the public repo:** `branch-rules.md` (settings table, ruleset explanation, private-repo fallback kept), `ci.md` (standard runners free while public, `gate result`, proven-tree wording, partial measurements), `deploy.md` (environment secrets and required reviewers now available, nothing created), the merge-rule sentence in `.claude/CLAUDE.md`, two stale comments in `merge-gate.mjs` and `Merge-PullRequest.ps1`, and the matching lines in `docs/development.md` (the orchestrator's section).

## Task Commits

1. **Settings applied:** no commit (GitHub state); recorded in `508bc39`.
2. **gate result, RED:** `7ea48bd` (test). **GREEN:** `f67b7fc` (ci).
3. **Docs for the public repo and settings record:** `508bc39` (docs).
4. **Linux fix-ups:** `72f6940` (test, RED for the Modal), `23256d5` (Modal middle press, E2E axe settle), `f55819d`, `0d34c2e` (parallel authorization test), `e4b5285` (Lighthouse Chrome sandbox), `eb521aa` (Lighthouse culprit lines), `8e93d1d` (Linux font fallbacks), `2c22c1a` (visual reference fallbacks), `7657198` (mail sink waits).
5. **Measured minutes (partial) and status:** `4cdaec9` (docs).

`f3507be` in the range is the orchestrator's own docs commit, not part of this plan.

## Files Created/Modified

See the frontmatter list. Most important: `.github/workflows/ci.yml` (result job), `docs/operations/main-ruleset.json` (required checks), `web/src/components/overlays/Modal.tsx` (middle press), `web/scripts/lighthouse.mjs` (sandbox flag and culprit lines), `web/src/ui/base.css` (Linux metric-compatible fallbacks).

## Decisions Made

- `gate result` as a separate job rather than renaming the gate (reason above); a fast (draft) run fails it on purpose, so a stale success on the same commit can never satisfy the rule.
- Not applying the ruleset while red, and stopping at LCP, exactly as instructed.
- The `[ci skip]` ship-note commit conflicts with a required-check ruleset (GitHub waits for checks that never start). Documented in `branch-rules.md`: push the note without `[ci skip]`.

## Deviations from Plan

### Auto-fixed Issues (round count: 7 pushes of fixes, more than the plan's five; every round moved the run further, and none lowered a threshold or added a retry)

**1. [Rule 1 - Bug] Linux pastes the X11 selection on a middle press**
- **Found during:** Task 2 (first full run, `dialog-fit` middle press test: the confirm field got `ORD-2026-0148Sampaguita#2026`)
- **Fix:** the Modal's scrim cancels the default of a middle mousedown and mouseup (tests first). Verified on Windows locally; the Linux result was confirmed by the later run (Playwright passed).
- **Files:** `web/src/components/overlays/Modal.tsx`, `Modal.test.tsx`. **Commits:** `72f6940`, `23256d5`.

**2. [Rule 1 - Bug] E2E axe saw a toast still fading in as low contrast**
- **Fix:** `expectNoAxeViolations` waits for finite animations to end before running axe. **Files:** `web/e2e/fixtures.ts`. **Commit:** `23256d5`.

**3. [Rule 1 - Bug] `/health` answered 503 inside the parallel authorization test**
- **Fix:** sixteen requests at a time (`f55819d`), then a warm-up request on the fresh host (`0d34c2e`); the first change alone did not cure it, which showed the cause was the cold start against the 3 second health budget. **Files:** `AuthorizationMatrixTests.cs`.

**4. [Rule 1 - Bug] Lighthouse could not open Chrome on the runner ("Unable to connect to Chrome")**
- **Fix:** `--no-sandbox` for Lighthouse's Chrome, only on Linux with `CI=true`, planned and unit-tested in `planSteps`. **Files:** `lighthouse.mjs`, `lighthouse-assert.test.ts`. **Commit:** `e4b5285`.

**5. [Rule 1 - Bug] CLS 0.0598 on Linux (limit 0.05)**
- **Cause:** the metric-matched fallback faces name `local("Arial")`, which Linux does not have. **Fix:** also name Liberation Sans and Arimo (Arial's exact metrics); CLS is now 0.00045. **Files:** `base.css`, `font-metrics.test.ts`, `visual/reference/rulings.css`. **Commits:** `8e93d1d`, `2c22c1a`.
- **Own mistake, fixed:** I ran only part of the web tests before pushing `8e93d1d`, so the full run caught `visual/reference/rulings.test.ts` (the reference copy must match `base.css`). Fixed in `2c22c1a`; I then ran the full `test:coverage`, typecheck, lint and format check locally before each push.

**6. [Rule 2 - Missing diagnostics] A failed Lighthouse run did not say which element shifted**
- **Fix:** `layoutShiftCulprits` prints one line per shifted element on a missed threshold (tested). **Commit:** `eb521aa`.

**7. [Rule 1 - Bug] Three auth tests counted the mail sink before it filled**
- **Fix:** they wait for the expected count with the existing `WaitForEmailsAsync` helper. **Files:** `ResendCodeEndpointTests.cs`, `SignInEndpointTests.cs`. **Commit:** `7657198`.

**Total deviations:** 7 auto-fixed. **Impact:** all necessary to get past Linux-only behavior; scope stayed on test, tooling and presentation files except the Modal middle-press and font-fallback changes, which are small product fixes.

## Issues Encountered

- **Lighthouse LCP 2127 ms (blocking, owner decision needed).** See the status section.
- The orchestrator pushed a docs commit during the run (`f3507be`), which cancelled one in-flight run; I watched the new head.
- `dotnet test` sometimes reports a handshake failure when it builds and tests in one go; building first and testing with `--no-build` is reliable.

## Authentication Gates

None.

## Known Stubs

None added.

## Threat Flags

None. The `--no-sandbox` flag is limited to the ephemeral CI runner (Linux with `CI=true`) and a localhost page.

## Follow-ups

- `CSPS-PRD.md` still describes the repository as private and branch rules as process-only; left unchanged as instructed.
- Check the GitHub-side effects once main exists: the `sha_pinning_required` setting against the weekly workflow's local reusable workflow call.
- A docs-only PR's success path for `gate result` is covered by tests but not yet seen on GitHub.

## Next Phase Readiness

Blocked on the Lighthouse LCP decision. Plan 03-17 depends on a green `gate (full)` and on the ruleset; do not start it until then.

## Self-Check: PASSED

Files and commits named above exist (`ci.yml` result job, `main-ruleset.json`, the 14 commits `7ea48bd` to `4cdaec9`); architecture tests 215 of 215 and the full web suite (4391 tests) pass locally; the settings read back as recorded.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-16 (halted)*
