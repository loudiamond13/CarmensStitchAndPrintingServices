---
phase: 03-ci-cd-staging-deploy
plan: 04
subsystem: ci-classify
tags: [github-actions, ci, node, vitest, gh-api, d-14, pattern-9]
created: "2026-10-15T22:38:00-05:00"
updated: "2026-10-15T22:38:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: web/scripts/*.mjs pattern (frozen constants, injected spawn and env, main guard) and the vitest scripts include
provides:
  - "web/scripts/ci-classify.mjs: MODES, isDocsPath(), classify(), findProvenTree(), main() with a CLI that writes one mode=<docs|fast|full|package> line to GITHUB_OUTPUT"
  - "Mode rules that fail toward full: empty or failed diff, bad commit ids, unknown events, any gh doubt"
affects: [03-11, ci-workflow, classify-job, deploy-package]

actuals:
  tokens: 8100
  tasks: 2
  commits: 4
plan_head_before: 656e8e9720811292b00dc4d16718927c9f147fa8
plan_head_after: 93930f3be906192da9657b6123b2042247d1c340

tech-stack:
  added: []
  patterns:
    - "Pure decision functions with injected spawn, output writer and logger, tested with fakes (same shape as verify.mjs and e2e.mjs)"
    - "Every gh answer is validated as untrusted JSON, and failure reasons never repeat gh output (CWE-532)"

key-files:
  created:
    - web/scripts/ci-classify.mjs
    - web/scripts/ci-classify.test.ts
  modified: []

key-decisions:
  - "git diff runs with --no-renames so a move lists both paths and moving code into a docs folder cannot read as docs."
  - "findProvenTree returns { proven, reason } instead of a bare boolean, so main can log why a push fell back to full."
  - "findProvenTree is synchronous (spawnSync under the injected seam); every gh call is a plain request-response, so async added nothing."
  - "Code folders are matched case-insensitively and docs folders case-sensitively, so a case trick can only push a run toward full."
  - "Commit ids from BASE_SHA, HEAD_SHA and GITHUB_SHA, and the owner/name repository, are shape-checked before they reach any command argument."

patterns-established:
  - "CI decisions live in tested Node scripts under web/scripts, never inline in workflow YAML."

requirements-completed: [OPS-02]

coverage:
  - id: D1
    description: "A draft PR is fast; a ready PR whose files are all docs (.planning/** or .md outside src, web, tests, tools, .github) is docs; every other ready PR is full"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "web/scripts/ci-classify.test.ts#isDocsPath and classify"
        status: pass
    human_judgment: false
  - id: D2
    description: "An empty changed-file list, a failed or signalled git diff, or a malformed commit id gives full, never docs"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "web/scripts/ci-classify.test.ts#main for a pull request"
        status: pass
      - kind: integration
        ref: "GITHUB_EVENT_NAME=pull_request node web/scripts/ci-classify.mjs on this branch against a real git diff writes mode=full"
        status: pass
    human_judgment: false
  - id: D3
    description: "A push to main is package only when exactly one merged PR claims the commit, the PR head tree id equals the pushed tree id, and the head has a successful gate (full) run; anything else is full"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "web/scripts/ci-classify.test.ts#findProvenTree and main for a push to main"
        status: pass
      - kind: integration
        ref: "GITHUB_EVENT_NAME=push node web/scripts/ci-classify.mjs against the live GitHub API for origin/main writes mode=full (no gate (full) run exists yet)"
        status: pass
    human_judgment: false
  - id: D4
    description: "workflow_dispatch, schedule, workflow_call, unknown events and a missing event name are full; the CLI writes exactly one mode line and exits 2 when GITHUB_OUTPUT is missing or unwritable"
    requirement: OPS-02
    verification:
      - kind: unit
        ref: "web/scripts/ci-classify.test.ts#main for other events and main output file"
        status: pass
    human_judgment: false

duration: 9min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 04: CI mode classifier Summary

**A dependency-free Node classifier that turns each CI run into `fast`, `docs`, `full` or `package` from the real git diff and, for pushes to main, a GitHub-API proof that the exact tree already passed `gate (full)` on its PR, failing toward `full` on any doubt.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-10-16T03:26:56Z
- **Completed:** 2026-10-16T03:35:40Z
- **Tasks:** 2
- **Files modified:** 2 (both new)

## Accomplishments

- `isDocsPath` and `classify` implement D-14: drafts are `fast`, all-docs ready PRs are `docs`, everything else is `full`. An empty list is never `docs` (OPS-02 empty edge).
- The CLI spawns `git diff --name-only --no-renames <BASE_SHA>...<HEAD_SHA>` through an injected spawn and appends exactly one `mode=<value>` line to `$GITHUB_OUTPUT`. A missing or unwritable `GITHUB_OUTPUT` exits 2.
- `findProvenTree` (Pattern 9) makes three `gh api` calls (PRs for the commit, git commit trees, check runs) and proves a tree only on one merged claimant, equal tree ids and a completed, successful `gate (full)` run.
- Tracer check: the real CLI on this branch (644 changed files) wrote `mode=full`; a docs-only range (`.planning/` files) wrote `mode=docs`; a push run against the live GitHub API for `origin/main` walked all three lookups and fell back to `full` because no `gate (full)` run exists yet.

## Task Commits

1. **Task 1: Tracer, classify CLI over the real git diff** - `c98a04d` (test, RED), `9e10c31` (feat, GREEN)
2. **Task 2: Push to main reuses the PR's proven tree** - `152df46` (test, RED), `93930f3` (feat, GREEN)

**Plan metadata:** recorded in the docs(03-04) commit that adds this file.

## Files Created/Modified

- `web/scripts/ci-classify.mjs` - MODES, isDocsPath, classify, findProvenTree, main and the main guard (Node built-ins only)
- `web/scripts/ci-classify.test.ts` - 110 vitest cases over fakes (diff, gh, output file, logger)

## Decisions Made

- `--no-renames` on the diff: with rename detection on, `git diff --name-only` prints only the new path, so `src/a.cs` renamed to `docs/a.md` would classify as docs. Listing both paths keeps the code path visible.
- `findProvenTree` returns `{ proven, reason }` so the CLI log line states why a push fell back to `full`. The reason never contains gh output or stderr.
- Synchronous implementation (spawnSync through the injected seam); the plan allowed either.
- Docs folder match is exact-case (`.planning/`), code folder match is case-insensitive, so case differences can only move a run toward `full`.
- Commit ids and `owner/name` are shape-checked before use as git or gh arguments, so a value starting with `-` or containing `..` never reaches a command.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `--no-renames` on the changed-file diff**
- **Found during:** Task 1 (threat T-03-14 review of the diff command)
- **Issue:** Default rename detection hides the source path of a move, which lets code moved into a docs folder classify as docs (CWE-693).
- **Fix:** Added `--no-renames` and a test that pins it.
- **Files modified:** web/scripts/ci-classify.mjs, web/scripts/ci-classify.test.ts
- **Verification:** `main for a pull request` tests; the key_link pattern `--name-only` still matches.
- **Committed in:** c98a04d (test) and 9e10c31 (feat)

**2. [Rule 2 - Missing Critical] Shape checks on commit ids and the repository name**
- **Found during:** Task 1 and Task 2
- **Issue:** BASE_SHA, HEAD_SHA, GITHUB_SHA and GITHUB_REPOSITORY flow into git and gh arguments; an option-like or path-like value could change the command (CWE-88).
- **Fix:** `/^[0-9a-f]{7,64}$/i` for ids and `owner/name` (no `.` or `..` part) for the repository; failures give `full` without running anything.
- **Files modified:** web/scripts/ci-classify.mjs, web/scripts/ci-classify.test.ts
- **Verification:** `runs the full gate without calling git` and `is not proven ... without calling gh` tests.
- **Committed in:** 9e10c31 and 93930f3

**3. [Rule 3 - Blocking] RED skeleton needed for a valid RED**
- **Found during:** Task 1 and Task 2 RED
- **Issue:** A test importing a missing module is a load failure, not RED evidence.
- **Fix:** The RED commits include a skeleton `ci-classify.mjs` whose functions return wrong answers, so target tests fail on their assertions. `gsd_run check tdd-red-evidence` returned `RED_EVIDENCE_OK` for one target in each cycle.
- **Files modified:** web/scripts/ci-classify.mjs
- **Committed in:** c98a04d and 152df46

---

**Total deviations:** 3 auto-fixed (2 missing critical, 1 blocking)
**Impact on plan:** No scope creep; all three tighten the fail-toward-full contract the plan asks for.

## TDD Gate Compliance

- **RED (cycle 1, `c98a04d`):** target `classify > runs the docs mode for a ready pull request whose files are all documentation`; the skeleton returned `full` where `docs` was expected (34 of 67 cases failed on assertions). Classifier verdict `RED_EVIDENCE_OK`. Semantic assessment: the target executed and failed on the planned assertion for the intended reason (behavior absent).
- **GREEN (cycle 1, `9e10c31`):** all 67 cases pass.
- **RED (cycle 2, `152df46`):** target `findProvenTree > is proven when the merged PR head has the same tree and a successful gate (full) run`; the skeleton returned `proven: false`. Classifier verdict `RED_EVIDENCE_OK`. Semantic assessment: intended assertion failure; four cases failed (the "not proven" cases pass against the skeleton by construction, which is expected for a fail-closed default).
- **GREEN (cycle 2, `93930f3`):** all 110 cases pass.
- **REFACTOR:** none needed.
- The first RED skeleton accidentally contains NUL bytes in two string literals (a shell escape slip); `9e10c31` replaces the file and the final file has none.

## Issues Encountered

- The TAP adapter of the RED evidence classifier rejected a full-suite report ("Malformed TAP") because multi-line assertion messages break its parser. Re-running with `-t <target>` produced a clean report and a valid verdict.
- A heredoc append of the second test block failed to parse once; the block was written with the Write tool to the scratchpad and appended from there.

## Known Stubs

None.

## Threat Flags

None. The script adds no endpoint or file access beyond reading `git diff` and three read-only `gh api` GET calls; mitigations T-03-14 and T-03-15 from the plan are implemented and tested, and T-03-SC holds (no packages installed).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 03-11 can wire the script into ci.yml's classify job: pass `GITHUB_EVENT_NAME`, `PR_DRAFT`, `BASE_SHA`, `HEAD_SHA`, `GITHUB_SHA`, `GITHUB_REPOSITORY` and `GH_TOKEN` through `env:`, check out with `fetch-depth: 0` (the three-dot diff needs the merge base; a shallow clone makes git fail, which safely gives `full`), and read `mode` from `$GITHUB_OUTPUT`.
- The `package` mode only ever appears once a PR has run a job literally named `gate (full)`; 03-11 must keep that job name.

## Self-Check: PASSED

- Files: `web/scripts/ci-classify.mjs` and `web/scripts/ci-classify.test.ts` exist.
- Commits `c98a04d`, `9e10c31`, `152df46`, `93930f3` are ancestors of HEAD (4 commits measured since `plan_head_before`).
- Acceptance: `export function classify` 1, `export function isDocsPath` 1, `export function findProvenTree` 1, `gate (full)` 3 occurrences, all imports start with `node:`, `npm --prefix web run lint` exit 0, `npx tsc -p tsconfig.node.json` exit 0, 110/110 tests pass, real CLI wrote `mode=full`.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-15*
