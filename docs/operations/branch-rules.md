# Runbook: branch rules and how to merge

*Created: 2026-10-15T22:41:00-05:00 · Updated: 2026-10-15T23:27:56-05:00*

This repository is private on GitHub Free, and that plan cannot enforce branch rules on a private repository. The rulesets API answered 403 ("Upgrade to GitHub Pro or make this repository public") on 2026-10-15. So the rules are enforced by process (D-08): CI checks every PR, and the merge command refuses to merge until the checks are green. The rules GitHub would enforce are written down here, ready to switch on if the repository is ever upgraded or made public.

## When to read it

- Before merging a pull request.
- When the free CI minutes run out (see "When CI minutes run out").
- If the repository is upgraded or made public and you want GitHub to enforce the rules.

## What is enforced today

- **CI runs every check on every PR.** The job that reports the result is named `gate (full)`. A PR that changes only documentation reports `gate (docs)` instead, and a draft PR reports `gate (fast)`.
- **The merge gate.** `web/scripts/merge-gate.mjs` reads the PR from GitHub and refuses the merge unless all of these are true:
  - the PR is open, targets `main` and is not a draft;
  - the branch is not behind `main` and has no conflicts;
  - `gate (full)` (or `gate (docs)`) passed on the PR's newest commit;
  - no other check failed, is still running or was cancelled;
  - every line under "Definition of Done" in the PR body is ticked.
- **Squash merges only.** The repository's merge buttons allow squash merges and nothing else, which keeps the history on `main` linear (set in plan 03-16, with the owner's approval).
- **Owner review.** `.github/CODEOWNERS` names `@loudiamond13` for every path, including `.github/`. Required approvals stay at 0, because a solo owner cannot approve their own PR (D-09).
- **The `/gsd-ship` ship note.** `/gsd-ship` adds one note commit marked `[ci skip]` that changes only `.planning/` files, so that commit has no checks of its own. The owner chose the parent rule (plan 03-03, 2026-10-15): if that newest commit changes only `.planning/` files, the gate judges it by the commit before it, which must pass every check. Any other `[ci skip]` head is refused. The rule lives in `web/scripts/merge-gate.mjs`.

## Rules written down for later

These are not enforced by GitHub today. `docs/operations/main-ruleset.json` holds them as the exact ruleset:

| Rule | Value |
|---|---|
| Branch | the default branch (`main`) |
| Required status check | `gate (full)`, with the branch up to date before merging |
| Linear history | required |
| Pull request before merging | required, with 0 approvals |
| Branch deletion and force pushes | blocked |
| Bypass | nobody, not even the owner |

Code owner review is left off in the ruleset on purpose. With 0 approvals and a single owner, requiring a code owner review would block every PR, because nobody else can approve it.

To switch the rules on after an upgrade or after making the repository public:

```powershell
gh api -X POST repos/loudiamond13/CarmenStitchAndPrintingServices/rulesets --input docs/operations/main-ruleset.json
```

Known limit: a PR that changes only documentation reports `gate (docs)`, not `gate (full)`. GitHub matches a required check by one fixed name, so with `gate (full)` required, a docs-only PR could never merge. Revisit the required check (for example, make the report name the same for every mode) before switching the ruleset on.

## How to merge

Merge only through the wrapper, and only when the owner says to:

```powershell
tools/scripts/Merge-PullRequest.ps1 -Pr <number>
```

It runs the merge gate, and only if the gate allows it, squash-merges the PR and deletes the branch. Add `-KeepBranch` to keep the branch. Never use `gh pr merge` directly, and never use the merge button in the GitHub page, because both skip the gate.

If the gate refuses, it prints each reason in plain English. Fix the reason (wait for the checks, update the branch, tick the list) and run the command again.

## When CI minutes run out

The free plan has a fixed number of CI minutes each month, and the spending limit stays at $0 (D-00, D-16). When the minutes are gone, CI stops and nothing is paid. Until the minutes reset on the 1st of the month, a merge needs the local full gate instead:

1. Run these five commands on your machine, from the repository root:
   - `dotnet build Csps.slnx`
   - `dotnet test --solution Csps.slnx`
   - `tools/scripts/Invoke-CoverageGate.ps1`
   - `npm --prefix web run verify`
   - `npm --prefix web run e2e`
2. Paste each command's output into the PR body under "Local full gate", with its exit code written as `exit 0`.
3. Merge with the local gate switch: `tools/scripts/Merge-PullRequest.ps1 -Pr <number> -LocalGate`.

The gate prints a loud warning in this mode, because CI did not check the PR. It still refuses a PR with a failed check, and the Definition of Done list still has to be ticked.
