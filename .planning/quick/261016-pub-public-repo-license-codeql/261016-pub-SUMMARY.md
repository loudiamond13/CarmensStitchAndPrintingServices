---
created: 2026-10-16T08:55:00-05:00
updated: 2026-10-16T08:57:00-05:00
phase: quick-261016-pub
plan: 01
subsystem: ci-security
tags: [public-repo, mit-license, codeql, dependency-review, github-actions]
status: complete
requirements: [OPS-02, OPS-03]
commits: 4
plan_head_before: f702641a63ba4e166051930cd0ddd3937da54435
plan_head_after: a53a79ae617ac0a841fcd4ce91bf1e407f47af8d
---

# Quick 261016-pub: public repository, MIT license, CodeQL and dependency review

The repository is public (https://github.com/loudiamond13/CarmensStitchAndPrintingServices), so it now carries an MIT license and two free GitHub security checks, both pinned by commit and covered by tests that were written first.

## Earlier steps the owner ran (2026-10-16, context only)

- The history was scrubbed with git-filter-repo into the new public repository. The old private repository stays as the `old-private` remote with its push URL disabled.
- Secret scanning and push protection were turned on.
- Dependabot alerts and security updates, and private vulnerability reporting, were turned on. Dependabot showed 0 alerts.

## What was done

| # | Commit | Change |
|---|--------|--------|
| 1 | 416d2d8 | `LICENSE` (MIT, `Copyright (c) 2026 loudiamond13`); `README.md` names the license; the PR template Security line now says CodeQL scans run on the public repo; `docs/development.md` and the `hygiene.yml` header no longer say the repository is private. `RepoRulesTests` pin the license text, the README line and the new template wording (RED run first: 2 failures, then green). |
| 2 | 7107773 | `docs/dependencies.json` approvals entry dated 2026-10-16 (both actions with version, commit and license, plus the repository license); plain-words section in `docs/dependencies.md`. |
| 3a | 4ee7525 | RED: `CiWorkflowTests` allow-list takes `github/codeql-action/init` and `/analyze` and `actions/dependency-review-action` at exactly the approved commits, and the pin regex accepts an action subpath. New `SecurityWorkflowTests` (10 facts; 9 failed against the missing workflows). |
| 3b | a53a79a | GREEN: `.github/workflows/codeql.yml`, a `dependency-review` job in `hygiene.yml`, and a short section in `docs/operations/ci.md`. Full architecture suite 212/212, `dotnet format --verify-no-changes` clean, actionlint 1.7.12 clean locally. |

### codeql.yml

- Triggers: `pull_request` to `main`, `push` to `main`, and `cron: "23 19 * * 0"` (Sunday 19:00 UTC; `weekly.yml` runs at 18:00). No path filter.
- Top-level `permissions: {}`; the job grants only `contents: read` and `security-events: write` (`actions: read` was not needed on a public repository).
- `ubuntu-24.04`, `timeout-minutes: 30`, checkout with `persist-credentials: false`, matrix `csharp` (`build-mode: manual`) and `javascript-typescript` (`build-mode: none`), `fail-fast: false`.
- C# uses the repository's own `actions/setup-dotnet` with `global-json-file: global.json`, then `dotnet restore Csps.slnx --locked-mode` and `dotnet build Csps.slnx --no-restore --no-incremental -tl:off -p:UseSharedCompilation=false`.
- Concurrency cancels superseded PR runs only. Only `init` and `analyze` are used (commit 2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2, `# v4.38.2`).

### Dependency review

- A job in `hygiene.yml` (`dependency review`), `if: github.event_name == 'pull_request'`, `contents: read` only, no checkout needed, `timeout-minutes: 10`.
- `actions/dependency-review-action` at a1d282b36b6f3519aa1f3fc636f609c47dddb294 (`# v5.0.0`) with `fail-on-severity: low`, `allow-licenses: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, MPL-2.0, OFL-1.1` and `comment-summary-in-pr: never` (so no `pull-requests: write`). A test compares the list with `docs/dependencies.json` policy, its exceptions and 0BSD.
- The action only prints unknown licenses (GitHub Actions) and does not fail on them; it fails on forbidden or unparseable ones.

## Proof on PR #1 (draft)

Pushed to `gsd/phase-03-ci-cd-staging-deploy` at the first attempt. Results on head a53a79a:

| Check | Result |
|-------|--------|
| analyze (csharp) | pass, 3m12s |
| analyze (javascript-typescript) | pass, 1m19s |
| CodeQL (results check) | pass |
| dependency review | pass (no vulnerable packages, no license problems, no denied packages) |
| zizmor, actionlint, secret scan, commit messages, classify | pass |
| gate (fast) | pass, 6m15s |

### CodeQL alerts

None. The code-scanning analyses for `refs/pull/1/merge` report 0 results for both languages (csharp: 52 rules, javascript-typescript: 87 rules), and the repository has 0 open code-scanning alerts. Nothing was dismissed and no repository setting was changed.

## Deviations from Plan

None - the plan was executed as written. Two notes:

- The CodeQL CLI the action downloaded reports version 2.27.2 in the analysis record, one patch above the 2.27.1 named in the approval. The action pin and its bundled default are unchanged.
- The pin regex in `CiWorkflowTests` needed to accept an action subpath (`github/codeql-action/init`); the allow-list stays an exact-match dictionary, so nothing else became looser.

## Follow-ups for the owner (not changed here)

- Dependency review on this PR looked only at the four actions in `hygiene.yml`. GitHub's dependency graph does not read NuGet central package versions well, so NuGet coverage is limited; the existing locked restore, NuGetAudit, `npm audit` and the license gates stay the real checks for packages.
- `docs/operations/branch-rules.md`, `docs/operations/deploy.md`, `docs/operations/ci.md` (minutes budget), `.claude/CLAUDE.md` (merge rule) and `CSPS-PRD.md` still describe the repository as private on GitHub Free (no rulesets, no environment secrets, 2,000 minutes). Public repositories can use rulesets, so these are owner decisions and were left alone.

## Self-Check: PASSED

LICENSE, `.github/workflows/codeql.yml`, `tests/Csps.ArchitectureTests/SecurityWorkflowTests.cs` and this file exist; commits 416d2d8, 7107773, 4ee7525 and a53a79a are ancestors of HEAD and on `origin`.
