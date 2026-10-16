# Runbook: branch rules and how to merge

*Created: 2026-10-15T22:41:00-05:00 · Updated: 2026-10-16T13:30:00-05:00*

This repository is public on GitHub, and GitHub enforces branch rules on a public repository for free. Until 2026-10-16 the repository was private, and GitHub Free could not enforce rules there (the rulesets API answered 403 on 2026-10-15), so the rules were kept by process (D-08): CI checked every PR and the merge command refused to merge until the checks were green. Both layers stay: GitHub now refuses a bad merge on its own, and the merge command still runs its gate first, because the gate also checks the Definition of Done list in the PR body, which GitHub cannot see.

## When to read it

- Before merging a pull request.
- When a PR cannot be merged and you want to know why.
- If the repository ever goes private again (see "If the repository goes private again").

## What is enforced today

- **CI runs every check on every PR.** The `gate` job reports `gate (full)` for a ready PR, `gate (docs)` for a PR that changes only documentation and `gate (fast)` for a draft. A small job named `gate result` always runs after it and is the one check the ruleset requires (see "The rules GitHub enforces on main").
- **The merge gate.** `web/scripts/merge-gate.mjs` reads the PR from GitHub and refuses the merge unless all of these are true:
  - the PR is open, targets `main` and is not a draft;
  - the branch is not behind `main` and has no conflicts;
  - `gate (full)` (or `gate (docs)`) passed on the PR's newest commit;
  - no other check failed, is still running or was cancelled;
  - every line under "Definition of Done" in the PR body is ticked.
- **Squash merges only.** The repository's merge buttons allow squash merges and nothing else, which keeps the history on `main` linear. Automatic deletion of merged branches stays off, because the merge command deletes branches itself and the pipeline merge must be able to keep a branch.
- **Owner review.** `.github/CODEOWNERS` names `@loudiamond13` for every path, including `.github/`. Required approvals stay at 0, because a solo owner cannot approve their own PR (D-09).
- **The `/gsd-ship` ship note.** `/gsd-ship` adds one note commit marked `[ci skip]` that changes only `.planning/` files, so that commit has no checks of its own. The owner chose the parent rule (plan 03-03, 2026-10-15): if that newest commit changes only `.planning/` files, the merge gate judges it by the commit before it, which must pass every check. Any other `[ci skip]` head is refused. The rule lives in `web/scripts/merge-gate.mjs`. With the ruleset on, GitHub itself waits for the required checks on the head commit, so a `[ci skip]` head blocks the merge button until another commit is pushed. Push the note without `[ci skip]` (a docs-only commit runs only the cheap `gate (docs)`), or push one more small commit.

## Repository settings applied (plan 03-16)

Applied by Claude with `gh api` on 2026-10-16, with the owner's approval, and read back from the API the same day:

| Setting | Read back |
|---|---|
| Visibility | public |
| Merge commits allowed | false |
| Rebase merges allowed | false |
| Squash merges allowed | true |
| Delete branch on merge | false (on purpose) |
| Dependabot alerts | on (HTTP 204 from `vulnerability-alerts`) |
| Dependabot security updates | enabled |
| Secret scanning and push protection | enabled |
| Private vulnerability reporting | enabled |
| Actions: require full-SHA pins (`sha_pinning_required`) | true |
| Actions: default workflow permissions | read |
| Spending limit | not touched |

The SHA-pin setting was accepted and reads back as `true`. Every `uses:` in the workflows already names a full commit SHA, and `CiWorkflowTests` check that on every PR, so the setting adds GitHub's own check on top. Whether GitHub refuses a workflow that uses a tag is assumption A12; it was not tried, because that would need a deliberately unpinned action.

## The rules GitHub enforces on main

`docs/operations/main-ruleset.json` holds the exact ruleset. The owner approved switching it on once the repository was public and PR 1 was green.

**Status (2026-10-16): not applied yet.** `gate (full)` on PR 1 is not green: the last Linux run passed everything up to and including Playwright, and Lighthouse then missed only the LCP limit (2127 ms against 2000 ms), which the owner waived until Phase 11 but which still fails the step. Nothing was applied while the gate is red. When the gate is green, the apply command below is run and its read-back is recorded here.

| Rule | Value |
|---|---|
| Branch | the default branch (`main`) |
| Required status checks | `gate result`, `secret scan`, `commit messages`, `actionlint`, `zizmor`, `dependency review`, `analyze (csharp)`, `analyze (javascript-typescript)`, with the branch up to date before merging |
| Linear history | required |
| Pull request before merging | required, with 0 approvals and no code owner review |
| Branch deletion and force pushes | blocked |
| Bypass | nobody, not even the owner |

Code owner review is left off on purpose. With 0 approvals and a single owner, requiring a code owner review would block every PR, because nobody else can approve it.

### Why the required check is `gate result` and not `gate (full)`

GitHub matches a required check by one fixed name. The gate job's name carries its mode, so a docs-only PR reports `gate (docs)` and could never satisfy a required `gate (full)`. The `gate result` job (in `ci.yml`) always runs after the gate and passes only when the mode's own gate succeeded for a mode that may merge (`full`, `docs`, or `package` on a push to `main`). It fails for a draft (`fast`), for a failed, skipped or cancelled gate, and when the classifier itself failed, so nothing slips through. `gate (full)` stays a name that only a full run has, because the deploy package rule needs it: a push to `main` skips the heavy suite only when the PR head has a green run named exactly `gate (full)` on the identical tree (`findProvenTree` in `web/scripts/ci-classify.mjs`). A docs run or `gate result` is never read as that proof, and `ci-classify.test.ts` covers both cases. A docs PR's merge to `main` therefore runs the full gate there, which is the safe direction.

### Checking the rules

```powershell
gh api repos/loudiamond13/CarmensStitchAndPrintingServices/rulesets
gh api repos/loudiamond13/CarmensStitchAndPrintingServices/rules/branches/main
```

The first lists the rulesets, the second lists what applies to `main`. To switch it on: `gh api -X POST repos/loudiamond13/CarmensStitchAndPrintingServices/rulesets --input docs/operations/main-ruleset.json`. To change it, edit `docs/operations/main-ruleset.json` (the architecture tests check it) and update it with `gh api -X PUT repos/loudiamond13/CarmensStitchAndPrintingServices/rulesets/<id> --input docs/operations/main-ruleset.json`.

## How to merge

Merge only through the wrapper, and only when the owner says to:

```powershell
tools/scripts/Merge-PullRequest.ps1 -Pr <number>
```

It runs the merge gate, and only if the gate allows it, squash-merges the PR and deletes the branch. Add `-KeepBranch` to keep the branch. Never use `gh pr merge` directly, and never use the merge button in the GitHub page, because both skip the gate's Definition of Done check. GitHub's ruleset still applies to them, but it does not read that list.

If the gate refuses, it prints each reason in plain English. Fix the reason (wait for the checks, update the branch, tick the list) and run the command again.

## If the repository goes private again

On a private repository GitHub Free cannot enforce the ruleset, and standard-runner CI minutes are limited to 2,000 a month. If that happens, the process rules above carry on alone, and the next section applies.

## When CI minutes run out

While the repository is public, standard GitHub-hosted runners are free and there is no monthly cap, so this section does not apply. It is kept for a private repository (D-00, D-16). On a private repository the free plan has a fixed number of CI minutes each month, and the spending limit stays at $0. When the minutes are gone, CI stops and nothing is paid. Until the minutes reset on the 1st of the month, a merge needs the local full gate instead:

1. Run these five commands on your machine, from the repository root:
   - `dotnet build Csps.slnx`
   - `dotnet test --solution Csps.slnx`
   - `tools/scripts/Invoke-CoverageGate.ps1`
   - `npm --prefix web run verify`
   - `npm --prefix web run e2e`
2. Paste each command's output into the PR body under "Local full gate", with its exit code written as `exit 0`.
3. Merge with the local gate switch: `tools/scripts/Merge-PullRequest.ps1 -Pr <number> -LocalGate`.

The gate prints a loud warning in this mode, because CI did not check the PR. It still refuses a PR with a failed check, and the Definition of Done list still has to be ticked.
