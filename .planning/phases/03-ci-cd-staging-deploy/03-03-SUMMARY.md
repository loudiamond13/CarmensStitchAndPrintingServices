---
phase: 03-ci-cd-staging-deploy
plan: 03
subsystem: infra
tags: [merge-gate, github-cli, gh, powershell, ci-skip, match-head-commit, definition-of-done, local-gate]
created: "2026-10-15T23:30:00-05:00"
updated: "2026-10-15T23:30:00-05:00"

requires:
  - phase: 03-ci-cd-staging-deploy
    provides: "03-RESEARCH Pattern 5 (merge gate) and Pitfall 4 (the /gsd-ship [ci skip] ship note leaves the head with no checks); the PR template headings from plan 03-05"
provides:
  - "web/scripts/merge-gate.mjs: pure decide() over gh data, collect() through the GitHub CLI, and the CLI (exit 0 with head=<sha>, 1 refused, 2 usage)"
  - "tools/scripts/Merge-PullRequest.ps1: the one supported merge command, which squash-merges only the head commit the gate approved"
  - "The owner's parent-rule ruling for the [ci skip] ship note, written and tested"
  - "--local-gate mode (D-16) for months when the free CI minutes run out"
affects: [03-05 branch rules runbook and CLAUDE.md conventions, 03-16 repo settings, every later /gsd-ship and merge in this project]

requirements-completed: [OPS-01]

actuals:
  tokens: 17075
  tasks: 3
  commits: 4
plan_head_before: d72db30fa56851420ce11d881ae04a02c8a4fb5a
plan_head_after: fa10b148856d21aca716c8bbf64e4d21b6e72db1

tech-stack:
  added: []
  patterns:
    - "Pure decide() over injected gh data plus a collect() that takes an injected runner (the verify.mjs and ci-classify.mjs shape)"
    - "Fail closed on every unreadable or incomplete gh answer, with messages that never repeat gh output"
    - "Merge only the exact head SHA the gate approved (gh pr merge --match-head-commit)"

key-files:
  created:
    - web/scripts/merge-gate.mjs
    - web/scripts/merge-gate.test.ts
    - tools/scripts/Merge-PullRequest.ps1
  modified: []

key-decisions:
  - "Owner ruling for Task 1, recorded 2026-10-15T22:05-05:00: parent-rule. A head commit with a skip token that changes nothing outside .planning/ and has exactly one parent is judged by that parent, which must pass every rule. Any other skip-token head is refused."
  - "A mergeable value other than MERGEABLE refuses, so UNKNOWN (GitHub still working it out) asks the owner to run the command again instead of passing."
  - "A skip-token head with an empty or possibly cut-off file list (300 or more) never qualifies, because it proves nothing about what the commit changed."
  - "Both paths of a renamed file are checked, so moving code into .planning/ cannot hide where it came from."
  - "Skip tokens are matched case-sensitively, the safe direction: a token the gate misses only refuses."
  - "Each local gate command needs a line in the Local full gate section where every exit code written is 0; exit 01, exit 10 or a second non-zero code fail it."

patterns-established:
  - "Any later merge-gate rule is one more reason pushed in a fixed order inside decide(), with a test that names the rule."

coverage:
  - id: D1
    description: "The merge gate allows a merge only when the PR is open, targets main, is not a draft, is 0 commits behind, is mergeable, has a passing gate (full) or gate (docs) check and no failed, pending or cancelled check, and every Definition of Done item is ticked; each refusal has its own plain-English reason"
    requirement: OPS-01
    verification:
      - kind: unit
        ref: "web/scripts/merge-gate.test.ts#decide: the pull request is refused"
        status: pass
      - kind: unit
        ref: "web/scripts/merge-gate.test.ts#decide: the Definition of Done section"
        status: pass
    human_judgment: false
  - id: D2
    description: "The gate fails closed: zero checks, only gate (fast), a missing or empty Definition of Done, and gh output that cannot be read or parsed are all refused"
    requirement: OPS-01
    verification:
      - kind: unit
        ref: "web/scripts/merge-gate.test.ts#collect"
        status: pass
      - kind: unit
        ref: "web/scripts/merge-gate.test.ts#main"
        status: pass
    human_judgment: false
  - id: D3
    description: "The /gsd-ship [ci skip] ship note follows the owner's parent-rule, and every other skip-token head is refused"
    requirement: OPS-01
    verification:
      - kind: unit
        ref: "web/scripts/merge-gate.test.ts#decide: the ship note rule (parent-rule, T-03-12)"
        status: pass
      - kind: unit
        ref: "web/scripts/merge-gate.test.ts#isPlanningOnlySkipHead"
        status: pass
    human_judgment: false
  - id: D4
    description: "--local-gate (D-16) replaces the green-check rule with a Local full gate section that lists the five commands each marked exit 0, still refuses a failed check, and always prints the warning"
    requirement: OPS-01
    verification:
      - kind: unit
        ref: "web/scripts/merge-gate.test.ts#decide: local full gate mode (D-16)"
        status: pass
      - kind: unit
        ref: "web/scripts/merge-gate.test.ts#main with --local-gate"
        status: pass
    human_judgment: false
  - id: D5
    description: "Merge-PullRequest.ps1 runs the gate, reads head=<sha>, and runs gh pr merge --squash --match-head-commit <sha> (plus --delete-branch unless -KeepBranch)"
    requirement: OPS-01
    verification:
      - kind: other
        ref: "powershell tools/scripts/Merge-PullRequest.ps1 -Pr 3 refuses the merged PR #3 and merges nothing; a fake node and gh on PATH showed the exact merge command line"
        status: pass
    human_judgment: true
    rationale: "The PowerShell wrapper has no automated test (no Pester in the repo). It was checked by parsing under Windows PowerShell 5.1, a real refusal on PR #3, and a fake gh recording the merge arguments. The first real merge by the owner is the end-to-end proof."

duration: 22 min
completed: 2026-10-15
status: complete
---

# Phase 3 Plan 03: Process Merge Gate Summary

**A tested merge gate that reads a PR through the GitHub CLI and refuses unless every D-08 rule holds on the exact head commit, with the owner's parent-rule for the `[ci skip]` ship note, a D-16 local-gate mode, and a wrapper that squash-merges only the SHA the gate approved**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-15T23:05:00-05:00
- **Completed:** 2026-10-15T23:27:00-05:00
- **Tasks:** 3 (Task 1 resolved by the owner's ruling before this run; Tasks 2 and 3 executed with TDD)
- **Files modified:** 3 (all new)

## Accomplishments

- `decide()` is pure and fail-closed: it gives one plain-English reason per broken rule in a fixed order (state, base, draft, behind, conflicts, green gate, other checks, Definition of Done). It reports how many commits behind main the branch is ("The branch is 3 commits behind main. Update it first.").
- `collect()` reads the PR, its checks, the compare API's `behind_by`, and the head commit with `gh`. It accepts the JSON that `gh pr checks` prints when it exits 1 or 8, treats "no checks reported" as an empty list, and refuses on any answer that is not valid JSON, is incomplete, or is a gh failure. It never repeats gh output in a message (CWE-532).
- The ship-note rule is the owner's parent-rule (see Decisions). The parent's check runs are read only when the rule needs them.
- `--local-gate` (D-16) swaps the green-check rule for a Local full gate section naming the five commands each with `exit 0`. A failed check still refuses, and the loud warning goes to stderr every time the flag is used.
- `Merge-PullRequest.ps1` runs the gate, reads `head=<sha>`, then runs `gh pr merge <n> --squash --match-head-commit <sha>` (plus `--delete-branch` unless `-KeepBranch`). A push between the check and the merge is refused by GitHub (T-03-11).
- Real read-only run against the merged PR #3: `node web/scripts/merge-gate.mjs 3` exits 1 and says "The pull request is not open (it is merged)."; the wrapper stops at the same point and merges nothing.

## Task Commits

1. **Task 1: Owner rule on the /gsd-ship `[ci skip]` ship note** - no commit. The orchestrator put the checkpoint to the owner in chat, and the owner chose "parent-rule" at 2026-10-15T22:05-05:00.
2. **Task 2: Tracer, the merge gate and the one merge command**
   - `1850411` (test, RED: merge gate decisions)
   - `fdb889c` (feat: process merge gate and the one merge command, D-08)
3. **Task 3: D-16 local-gate mode**
   - `7674786` (test, RED: local full gate mode)
   - `fa10b14` (feat: local full gate mode for exhausted CI minutes, D-16)

**Plan metadata:** the summary and state commits that follow this file in `git log`.

## Files Created/Modified

- `web/scripts/merge-gate.mjs` - `decide`, `collect`, `main`, `isPlanningOnlySkipHead`, `GateInputError`, and the constants `SKIP_TOKENS`, `GATE_CHECKS`, `DOD_HEADING`, `LOCAL_GATE_HEADING`, `LOCAL_GATE_COMMANDS`, `LOCAL_GATE_WARNING`. Node built-ins only.
- `web/scripts/merge-gate.test.ts` - 159 tests over decide, the ship-note rule (named "parent-rule" in the test names), collect with a fake gh, main, and the local gate.
- `tools/scripts/Merge-PullRequest.ps1` - the one supported merge command (`-Pr`, `-KeepBranch`, `-LocalGate`), compatible with Windows PowerShell 5.1, sets no environment variable.

## Decisions Made

- **Task 1 ruling (owner, 2026-10-15T22:05-05:00): parent-rule.** The gate judges a head commit that carries a skip token, changes nothing outside `.planning/` and has exactly one parent by that parent. The parent must have a passing `gate (full)` or `gate (docs)` check and no check failed, cancelled or still running. A skip-token head that touches any other path, is a merge commit, or has an empty file list is refused with "Push a commit without a skip token so CI runs." A chain of two ship notes is refused, because the parent has no gate check of its own. A skip-token head's own failing check still refuses.
- `mergeable` must be exactly `MERGEABLE`. The plan said "not CONFLICTING"; refusing `UNKNOWN` as well is the fail-closed reading, and the message tells the owner to run the command again. (Right after a push GitHub often answers UNKNOWN once.)
- A skip-token head only qualifies with a non-empty file list under 300 entries. GitHub cuts a commit's file list at 300, so a longer list proves nothing about the paths changed.
- Rename entries contribute both `filename` and `previous_filename` to the file list.
- Skip tokens are case-sensitive. A "[CI SKIP]" the gate does not recognize only leads to a refusal.
- A local-gate command line counts only when every `exit <n>` on it is `exit 0`.

## Deviations from Plan

None - plan executed exactly as written. (The two readings above, `UNKNOWN` mergeability and the 300-file limit, are stricter fail-closed choices inside rules the plan left open, not changes to its scope.)

## Issues Encountered

- A tsc error in the test helper (`as const` made the route tuple too narrow once more routes were spread in) and a literal en and em dash in a test regex were fixed before the first GREEN commit. The Definition of Done heading appeared twice in `merge-gate.mjs` (once in a comment); the comment was reworded so the acceptance count is exactly 1.
- The branch-rules runbook (`docs/operations/branch-rules.md`) still says the `[ci skip]` ruling is "recorded in plan 03-03 and written into `web/scripts/merge-gate.mjs`". It is not in this plan's `files_modified`, so it was left alone. A one-sentence follow-up can state the parent rule there in plain words.

## User Setup Required

None - no external service configuration required. The gate needs the GitHub CLI signed in (`gh auth status`) and Node on the PATH.

## Next Phase Readiness

- Plan 03-05's runbook, PR template and CLAUDE.md conventions already name `Merge-PullRequest.ps1`, `## Definition of Done` and `## Local full gate`. The gate reads exactly those headings, and the template's unfilled "exit code and output" lines correctly fail the local gate until they hold `exit 0`.
- The first real use will be the first merge of this phase's PR, only on the owner's instruction. Claude must not merge on its own or with a raw `gh pr merge` (prohibition in the plan frontmatter, convention text in plan 03-05).

## Known Stubs

None.

## Threat Flags

None. The only new surface is read-only `gh` calls and one `gh pr merge` that runs after the gate allows it.

## Self-Check: PASSED

- Files found: `web/scripts/merge-gate.mjs`, `web/scripts/merge-gate.test.ts`, `tools/scripts/Merge-PullRequest.ps1`.
- Commits found on the branch: `1850411`, `fdb889c`, `7674786`, `fa10b14`.
- `npm --prefix web test -- --run scripts/` passed (20 files, 840 tests); `npm --prefix web run lint`, `typecheck` and `format:check` passed with zero warnings; `node web/scripts/merge-gate.mjs 3` exited 1 naming the state.
- Acceptance counts: `match-head-commit` 2 and `merge-gate.mjs` 2 in the wrapper; `## Definition of Done` 1, `LOCAL_GATE_COMMANDS` 2 and `D-16` 5 in `merge-gate.mjs`; imports are all `node:` modules.

---
*Phase: 03-ci-cd-staging-deploy*
*Completed: 2026-10-15*
