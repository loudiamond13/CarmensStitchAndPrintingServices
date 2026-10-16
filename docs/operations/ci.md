# Guide: what CI runs, and when

*Created: 2026-10-16T01:12:00-05:00 · Updated: 2026-10-16T10:56:00-05:00*

GitHub Actions checks every pull request and every push to `main`. One workflow, `.github/workflows/ci.yml`, holds the whole pipeline (OPS-02). A small second workflow, `.github/workflows/weekly.yml`, runs the same pipeline once a week with every browser engine (D-15). This page says which checks run in which situation, how to read a failed run, how many of the free minutes it should use, and what to do when the minutes run out.

## The pipeline, in order

The `gate` job runs these stages one after another and stops at the first failure.

| Stage | What runs |
|---|---|
| 1 | Locked restore of the .NET packages (NuGet audit runs inside it), local tools, `npm ci` for `web` and `tools/openapi-gen`, then `npm audit` at the lowest level for both |
| 2 | .NET build, then the format check |
| 3 | Unit tests, integration tests (full mode only), architecture tests |
| 4 | Web typecheck, lint, Prettier, Vitest with coverage, then the OpenAPI types check |
| 5 | Production build, budget build, a throwaway SQL Server container, Playwright, Lighthouse (full mode only) |
| 6 | Coverage gates, web license check, web notices check, NuGet license and notices drift check (full mode only) |

Stages 5 and 6 and the integration tests need a database and a lot of time, so they run only in `full` mode. Stages 1 to 4 (without the integration tests) are the "fast part".

A small `classify` job runs first. It runs `web/scripts/ci-classify.mjs`, which decides the mode. The check name of the gate shows the mode, for example `gate (fast)`.

A last job, `gate result`, always runs after the gate. It is the one check the ruleset on `main` requires (see `docs/operations/branch-rules.md`). It passes only when the gate of a mode that may merge succeeded: `full`, `docs`, or `package` on a push to `main`. It fails for a draft (`fast`), a failed, skipped or cancelled gate, and a failed classifier. It exists because a required check has one fixed name, while the gate's name changes with the mode, so a docs-only pull request (`gate (docs)`) could never satisfy a required `gate (full)`. The name `gate (full)` stays unique to full runs, because the deploy package rule trusts it as proof (see "Pushes to main").

## Drafts

A draft pull request runs the fast part and the check is called `gate (fast)`. Keep a pull request in draft while you are still pushing changes. This is the cheapest way to use the free minutes.

## Ready pull requests

A pull request that is ready for review runs the whole pipeline and the check is called `gate (full)`. Playwright runs two projects: `chromium` (a desktop browser) and `pixel` (a phone-sized screen). The merge rule needs a green `gate (full)` on the newest commit, and GitHub's ruleset needs a green `gate result`.

## Docs-only pull requests

If every changed file is under `.planning/` or is a Markdown file outside `src`, `web`, `tests`, `tools` and `.github`, the mode is `docs` and the check is called `gate (docs)`. It runs the fast part only, so the doc tests (for example the hosting record lint and the no-long-dash test) still run, and `gate result` passes on it. When the script cannot be sure, it chooses `full`.

## Pushes to main

When a pull request is merged, the push to `main` is classified again. If that exact tree already passed a check named exactly `gate (full)` on the pull request's head commit, the mode is `package` and only the fast part runs. A `gate (docs)` run or `gate result` is never accepted as that proof. In any other case the mode is `full`. So a pull request whose newest commit is docs-only (for example a final notes commit) gets the full gate when it lands on `main`.

## Weekly run

`weekly.yml` runs on Sundays at 18:00 UTC (Monday 02:00 in Manila) and can also be started by hand from the Actions tab. It calls `ci.yml` with `all-engines` turned on, so Playwright runs all seven projects: `chromium`, `firefox`, `webkit`, `pixel`, `iphone`, `chromium-classic-scrollbars` and `chromium-overlay-scrollbars`. GitHub starts scheduled runs only from the `main` branch, so the first weekly run happens after this pipeline is merged.

## Security scans (public repository)

Two free GitHub checks run besides the gate (owner approval 2026-10-16, recorded in `docs/dependencies.md`). The ruleset on `main` requires both, together with the Hygiene checks (`secret scan`, `commit messages`, `actionlint`, `zizmor`):

- **CodeQL** (`codeql.yml`) scans the C# and the TypeScript on every pull request, every push to `main` and every Sunday at 19:00 UTC. The C# side builds `Csps.slnx` with the pinned SDK. Alerts appear under the repository's Security tab, and a newer push to a pull request cancels its older scan.
- **Dependency review** (the `dependency review` job in `hygiene.yml`) runs on pull requests only. It fails when a pull request adds or changes a package with a known security problem, or with a license outside the allow-list. A GitHub Action shows an unknown license, because GitHub cannot read it, and that does not fail the check.

## What the CI database is

Stage 5 starts a SQL Server container on the runner, reachable only from that runner (`127.0.0.1`). Its administrator password is made up fresh in every run, hidden from the logs, and thrown away with the runner. CI never connects to the hosted database and holds no production secret.

## How to read a failed run

1. Open the pull request and click **Details** next to the failed check.
2. The failed step has a red cross. The step name starts with its stage number, for example `4 web lint`.
3. Open that step and read the last lines. The error is usually just above them.
4. For a failed Playwright run, the Actions page also lists an artifact named `playwright-failure-reports` (kept for 7 days). It holds the HTML report and the traces.
5. Fix the problem on your machine, push, and the check runs again. Do not re-run a failing step hoping it passes. Playwright retries are off on purpose, so a flaky test shows up and gets fixed.

## Minutes budget

This repository is public, and GitHub does not charge minutes for standard GitHub-hosted runners on a public repository. So there is no monthly cap to stay under while it stays public, and the local full gate (D-16, next section) is not needed. The table below is the old estimate for a private repository: a free private repository gets 2,000 minutes a month, and Linux minutes count once. It stays so the numbers are at hand if the repository ever goes private again. Plan 03-16 replaces it with measured times from the Actions tab.

| Workload (estimate) | Minutes each | Per month | Total |
|---|---|---|---|
| Ready pull request, full gate | 35 | 25 | 875 |
| Draft or fast pushes | 10 | 20 | 200 |
| Merges to main (fast part, package mode) | 12 | 15 | 180 |
| Weekly run, all engines | 50 | 4 | 200 |
| Dependency update pull requests | 35 | 3 | 105 |
| Deploys (Windows runner, counted about double) | 20 | 8 | 160 |
| **Total** | | | **about 1,720** |

## When the minutes run out (D-16)

This applies only if the repository is private again. While it is public, standard runners are free and uncapped, so it does not apply.

The GitHub spending limit stays at $0, so nothing is ever charged. When the free minutes are used up, CI stops until they reset on the 1st of the month. Until then a pull request is merged on the local full gate:

1. On your machine run `dotnet build`, `dotnet test --solution`, `pwsh tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify` and `npm --prefix web run e2e`. Each must exit with code 0.
2. Paste the results into the pull request body under a "Local full gate" heading, one line per command, each marked `exit 0`.
3. Merge with `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Merge-PullRequest.ps1 -Pr <number> -LocalGate`. It still refuses any failed check and prints a warning, because CI did not check the pull request.
