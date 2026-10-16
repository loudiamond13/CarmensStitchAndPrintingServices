---
created: 2026-10-16T17:25:00-05:00
updated: 2026-10-16T17:25:00-05:00
phase: quick-261016-ns5
plan: 01
subsystem: ops / merge gate
tags: [merge-gate, squash-message, skip-markers, powershell, cwe-88]
requirements: [OPS-01]
key-files:
  modified:
    - web/scripts/merge-gate.mjs
    - web/scripts/merge-gate.test.ts
    - tools/scripts/Merge-PullRequest.ps1
    - docs/operations/branch-rules.md
status: complete
commits: 3
plan_head_before: 25040f4
plan_head_after: 3333dc6
actuals:
  tokens: 30000
  tasks: 2
  commits: 3
---

# Quick 261016-ns5: The merge command sets the squash message from the PR title

The merge gate now composes the squash commit message (`<PR title> (#<n>)` plus a one-line body) and refuses a title that holds a skip marker, a double quote, a control character or no text. `Merge-PullRequest.ps1` passes the message to `gh pr merge` with `--subject` and `--body`.

## Commits

| Commit | Message |
|---|---|
| 6fa738f | test(quick-261016-ns5): ... (RED), 39 new tests failing, 158 existing passing |
| e08f025 | fix(quick-261016-ns5): ... (GREEN) |
| 3333dc6 | docs(quick-261016-ns5): describe the composed squash message and the skip marker refusal |

## What changed

- `merge-gate.mjs`: new exports `squashMessage(pr)` and `skipMarkersIn(text)`; `decide` adds the title and marker refusals last, in normal and local gate mode; `main` prints `Squash commit subject:`, `head=`, `subject-base64=` and `body-base64=` only when allowed. `SKIP_TOKENS`, `hasSkipToken`, `isPlanningOnlySkipHead`, `parentReasons` and `collect` are unchanged, so the ship note rule still works.
- `Merge-PullRequest.ps1`: `Get-GateValue` reads exactly one line per name (head, subject, body), decodes base64 as UTF-8, hides the base64 lines from the console echo, and passes subject and body as separate array elements to `gh pr merge`.
- `branch-rules.md`: new bullet under "What is enforced today" and two paragraphs under "How to merge"; `Updated:` timestamp refreshed.

## Verification

- `npm --prefix web test -- --run scripts/merge-gate.test.ts`: 197 passed.
- `npm --prefix web run typecheck`, `npm --prefix web run lint`, `npm --prefix web run format:check`: exit 0.
- PowerShell parser check on `Merge-PullRequest.ps1`: no errors. Helper checked in Windows PowerShell 5.1: exact-one-line lookup works, peso sign round-trips (U+20B1), a missing line throws.
- `dotnet test --project tests/Csps.ArchitectureTests`: 217 passed.
- No commit message in `25040f4..HEAD` holds a skip marker.

## Deviations from Plan

None. The marker detector allows optional whitespace between the two words (for example `[skipci]`), as the plan describes, which can over-refuse but never under-refuse.

## Threat Flags

None. The merge script and `gh pr merge` were never run.

## Self-Check: PASSED

Commits 6fa738f, e08f025 and 3333dc6 are on the branch; all four files exist.
