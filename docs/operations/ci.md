# Guide: what CI runs, and when

*Created: 2026-10-16T01:12:00-05:00 · Updated: 2026-10-31T03:53:54-05:00*

GitHub Actions checks every pull request and every push to `main`. One workflow, `.github/workflows/ci.yml`, holds the whole pipeline (OPS-02). A small second workflow, `.github/workflows/weekly.yml`, runs the same pipeline once a week with every browser engine (D-15). This page says which checks run in which situation, how to read a failed run, how many of the free minutes it should use, and what to do when the minutes run out. The last section, "Workflows at a glance", describes every workflow file and Dependabot one by one, including when each runs, what rights it has and what every job and step checks.

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
| 7 | Deploy package: web build, publish, idempotent database script, package check, gitleaks scan (full and package mode, so also on a ready pull request). Only a push to `main` then uploads the package as `csps-package-<commit sha>` |

In stage 5, Lighthouse reports LCP on every run but a miss does not fail the step until Phase 11 (owner decision 2026-10-16, `.planning/WINDOWS.md` entry 1); every other Lighthouse limit still fails it. See `docs/web/release-gates.md`.

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

- **CodeQL** (`codeql.yml`) scans the C# and the TypeScript on every pull request, every push to `main` and every Sunday at 19:23 UTC (Monday 03:23 in Manila). The C# side builds `Csps.slnx` with the pinned SDK. Alerts appear under the repository's Security tab, and a newer push to a pull request cancels its older scan.
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

This repository is public, and GitHub does not charge minutes for standard GitHub-hosted runners on a public repository. So there is no monthly cap to stay under while it stays public, and the local full gate (D-16, next section) is not needed. The table below is the old estimate for a private repository: a free private repository gets 2,000 minutes a month, and Linux minutes count once. It stays so the numbers are at hand if the repository ever goes private again. The measured figures are in the next section.

| Workload (estimate) | Minutes each | Per month | Total |
|---|---|---|---|
| Ready pull request, full gate | 35 | 25 | 875 |
| Draft or fast pushes | 10 | 20 | 200 |
| Merges to main (fast part, package mode) | 12 | 15 | 180 |
| Weekly run, all engines | 50 | 4 | 200 |
| Dependency update pull requests | 35 | 3 | 105 |
| Deploys (Windows runner, counted about double) | 20 | 8 | 160 |
| **Total** | | | **about 1,720** |

## Measured (2026-10-16)

These are wall-clock times from the runs on GitHub's `ubuntu-24.04` runners (`gh run view <id> --json jobs`). GitHub bills each job rounded up to the minute, but only on a private repository. The full gate figure is from the first green run on pull request 1 (run 38953580695).

| Job | Measured | Billed (rounded up) |
|---|---|---|
| `classify` | 5 to 10 seconds | 1 minute |
| `gate (fast)`, a draft | 5 min 8 s | 6 minutes |
| `gate (full)` | 18 min 17 s (integration tests 2:11, Vitest with coverage 1:59, Playwright 9:25, Lighthouse 0:23, coverage gate 0:10, NuGet notices 0:17) | 19 minutes |
| `gate result` | 2 to 4 seconds | 1 minute |
| Hygiene, five jobs (`secret scan`, `commit messages`, `actionlint`, `zizmor`, `dependency review`) | 5 to 16 seconds each | 5 minutes together |
| CodeQL, two jobs | `analyze (csharp)` 3 min 25 s to 4 min 19 s, `analyze (javascript-typescript)` 56 s to 1 min 30 s | 7 minutes together |

Not measured yet, because they need a merge to `main` and a deploy: the package upload, the package-mode run (the fast part plus the package steps), the all-engine weekly run and the deploy job. The package steps themselves now also run in the full pull request run, so they add a few minutes to the `gate (full)` time above once the next pull request measures them. The projection below keeps the old estimates for those.

**If the repository were private:** one ready pull request run is about 1 + 19 + 1 + 5 + 7 = 33 minutes, and a draft run about 1 + 6 + 1 + 5 + 7 = 20. With the run counts used above:

| Workload | Minutes each | Per month | Total |
|---|---|---|---|
| Ready pull request runs | 33 | 25 | 825 |
| Draft pushes | 20 | 20 | 400 |
| Merges to `main` (package mode, estimate) | 26 | 15 | 390 |
| Weekly all-engine run (estimate 50) plus CodeQL (7) | 57 | 4 | 228 |
| Dependency update pull requests | 33 | 3 | 99 |
| Deploys (Windows runner, counted double, estimate) | 20 | 8 | 160 |
| **Total** | | | **about 2,100** |

That is a little over the 2,000 free minutes of a private repository. The levers, without changing any gate: keep pull requests in draft while iterating (a ready push costs 33, a draft push 20), push fewer times once ready, and run the all-engine weekly job less often. While the repository is public none of this is billed and there is no cap.

## When the minutes run out (D-16)

This applies only if the repository is private again. While it is public, standard runners are free and uncapped, so it does not apply.

The GitHub spending limit stays at $0, so nothing is ever charged. When the free minutes are used up, CI stops until they reset on the 1st of the month. Until then a pull request is merged on the local full gate:

1. On your machine run `dotnet build`, `dotnet test --solution`, `pwsh tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify` and `npm --prefix web run e2e`. Each must exit with code 0.
2. Paste the results into the pull request body under a "Local full gate" heading, one line per command, each marked `exit 0`.
3. Merge with `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Merge-PullRequest.ps1 -Pr <number> -LocalGate`. It still refuses any failed check and prints a warning, because CI did not check the pull request.

## Workflows at a glance

A workflow is one file under `.github/workflows`. A job is one box on a run page, and its name is the check name you see on a pull request. A step is one line inside a job's log. The step names below are written exactly as the log shows them, so you can search the log for them.

| Workflow file | Name on the Actions tab | When it runs | Jobs (check names) | Required on `main` |
|---|---|---|---|---|
| `ci.yml` | CI | Pull requests to `main`, every push to `main`, the Run workflow button, and when `weekly.yml` calls it | `classify`, then `gate (fast)`, `gate (docs)`, `gate (full)` or `gate (package)` (which one depends on the mode, see [The pipeline, in order](#the-pipeline-in-order)), then `gate result` | `gate result` only |
| `weekly.yml` | Weekly | Sundays 18:00 UTC, and the Run workflow button | `weekly all engines` | No |
| `codeql.yml` | CodeQL | Pull requests to `main`, every push to `main`, Sundays 19:23 UTC | `analyze (csharp)`, `analyze (javascript-typescript)` | Both |
| `hygiene.yml` | Hygiene | Pull requests to `main`, every push to `main` | `secret scan`, `commit messages`, `actionlint`, `zizmor`, `dependency review` | All five |
| `deploy.yml` | Deploy | Only when the owner presses Run workflow on `main` | `deploy` | No |
| `dependabot.yml` | None: this is not a workflow. It is the settings file of GitHub's update bot | Once a month | None. The bot opens pull requests, and those face the same checks as any other | No |

The required checks are listed in [the rules](branch-rules.md#the-rules-github-enforces-on-main).

Rules every workflow follows:

- The token starts with no rights (`permissions: {}`), and each job asks only for what it needs.
- Every outside action is pinned to a full commit id, with its version in a comment.
- Every job that runs steps has a time limit.
- Event text (a pull request title, a commit id) reaches scripts only through environment variables, never pasted into a script.
- There is no path filter, so a check always reports.
- Runners are `ubuntu-24.04`, except Deploy, which uses `windows-2025`.
- No workflow merges anything. Merges go only through `tools/scripts/Merge-PullRequest.ps1`, on the owner's instruction ([How to merge](branch-rules.md#how-to-merge)).

`CiWorkflowTests`, which run inside `3 architecture tests`, check these rules on every pull request.

### CI (`ci.yml`)

- **Runs when:** a pull request to `main` is opened, gets a new push, is reopened or is marked ready for review; on every push to `main`; when someone presses **Run workflow** on the Actions tab (full mode, Chromium and the phone viewport only, no package upload); and when `weekly.yml` calls it with the `all-engines` input switched on. The modes are explained in [The pipeline, in order](#the-pipeline-in-order), [Drafts](#drafts), [Docs-only pull requests](#docs-only-pull-requests) and [Pushes to main](#pushes-to-main).
- **Permissions:** none at the top. `classify` may read the repository, pull requests and checks. `gate` may read the repository only. `gate result` has no rights at all.
- **Concurrency:** one run per pull request (or per commit on `main`). A newer push to a pull request cancels its older run. A run for `main` is never cancelled.
- **Runner and time limit:** `ubuntu-24.04`. `classify` 5 minutes, `gate` 60 minutes, `gate result` 2 minutes. If the gate passes 60 minutes, GitHub stops it and `gate result` then fails.
- **Required on `main`:** `gate result` only.

#### `classify`

Picks the mode and passes it to the other jobs.

| Step | What it does and checks | If it fails |
|---|---|---|
| `checkout` | Fetches the whole history, because the script compares the pull request with `main` and looks up the pull request's tree | A GitHub outage. Re-run the job |
| `setup node` | Installs Node 24.21.0 | A GitHub outage. Re-run the job |
| `mode` | Runs `web/scripts/ci-classify.mjs`: a draft gives `fast`, a docs-only pull request gives `docs`, a push gives `package` only for a proven tree, and anything unsure gives `full` | The script prints the reason. When `classify` fails, `gate result` fails too. Re-run once if GitHub did not answer |

#### `gate (fast)`, `gate (docs)`, `gate (full)` and `gate (package)`

One job whose name carries the mode. It sets `DOTNET_NOLOGO` and `DOTNET_CLI_TELEMETRY_OPTOUT` to keep the log short. Steps run in order and the job stops at the first failure. The stage numbers are the ones in [The pipeline, in order](#the-pipeline-in-order). "All modes" means `fast`, `docs`, `full` and `package`.

| Step | Runs in | What it checks | If it fails |
|---|---|---|---|
| `checkout` | All modes | Fetches the whole history | A GitHub outage. Re-run the job |
| `setup dotnet` | All modes | Installs the .NET SDK named in `global.json` | A download problem can be re-run once. A wrong version means `global.json` needs fixing |
| `setup node` | All modes | Installs Node 24.21.0 and caches npm downloads, keyed on both lock files | A GitHub outage. Re-run the job |
| `cache nuget packages` | All modes | Keeps downloaded .NET packages between runs, keyed on `packages.lock.json` | A cache miss only makes the run slower |
| `1 restore (locked)` | All modes | Restores the .NET packages in locked mode, then the local tools. A lock file that disagrees with the project files fails, and so does a package with a known security problem (NuGet audit, level low and up) | Run `dotnet restore Csps.slnx --force-evaluate` and commit the changed `packages.lock.json`. For a package with a known problem, pick another version with the owner's OK |
| `1 npm ci` | All modes | Installs `web` and `tools/openapi-gen` exactly as their lock files say. A lock file that disagrees with `package.json` fails | Update the lock file with npm and commit it |
| `1 audits` | All modes | `npm audit` at every severity for both folders; only advisories the owner accepted in `docs/audit-exceptions.json`, within their review date, pass (07.1 D-46) | Run `npm --prefix web run audit:check` to see the advisory, then choose a fixed version with the owner's OK, or ask the owner to accept it with a review date |
| `2 build` | All modes | `dotnet build`. Any compiler or analyzer warning fails it, because warnings are errors | Run `dotnet build Csps.slnx` and fix what it prints |
| `2 format check` | All modes | Fails when `dotnet format` would change any file | Run `dotnet format Csps.slnx` and commit the result |
| `3 unit tests` | All modes | Domain, Application and HostProbe unit tests | Run `dotnet test --project tests/Csps.Domain.UnitTests` (or the other two projects) |
| `3 integration tests` | Full only | Infrastructure and Server integration tests, plus the legacy fit check tests (`tests/Csps.LegacyFitCheck.Tests`, made-up rows in throwaway databases only). With `CSPS_TEST_SQL=container` the tests start their own throwaway SQL Server 2025 container on the runner (through Testcontainers), from a fixed image version | Run the same projects on your machine (they use LocalDB there). A container download or start-up problem, which is not a test failure, may be re-run once |
| `3 architecture tests` | All modes | The layer rules, plus the tests that read repository files: `CiWorkflowTests`, `HygieneWorkflowTests`, `SecurityWorkflowTests`, `DeployWorkflowTests`, `DependencyRegistryTests`, `HostingRecordTests` and `RepoRulesTests` | Run `dotnet test --project tests/Csps.ArchitectureTests`. The message names the file and the rule |
| `4 web typecheck` | All modes | TypeScript type check | `npm --prefix web run typecheck` |
| `4 web lint` | All modes | ESLint with zero warnings allowed | `npm --prefix web run lint` |
| `4 web prettier` | All modes | Fails when Prettier would change any file | `npm --prefix web run format`, then commit |
| `4 web vitest + coverage` | All modes | Web unit tests, and web coverage of at least 90 percent (100 percent in `src/core/api`) | `npm --prefix web run test:coverage` |
| `4 openapi types check` | All modes | The committed API types match the OpenAPI snapshot, and the checker's own tests pass | `npm --prefix tools/openapi-gen run check`. Regenerate the types with `npm --prefix tools/openapi-gen run generate` and commit them |
| `5 web build` | Full only | The production build. It also fails when the bundle passes its size limits (`docs/web/budgets.md`) | `npm --prefix web run build` |
| `5 web budget build` | Full only | The same check for the build that includes the admin routes | `npm --prefix web run build:budget` |
| `5 sql container` | Full only | Starts a throwaway SQL Server and waits for it, up to 60 checks 2 seconds apart. See [What the CI database is](#what-the-ci-database-is) | A download or start-up problem (not a test failure) may be re-run once |
| `5 test secrets` | Full only | Makes the development secrets (random keys and a certificate, thrown away with the runner) and the local HTTPS certificate that the browser tests and Lighthouse need | Read the log. The script is `tools/scripts/Initialize-DevSecrets.ps1` |
| `5 playwright cache` | Full only | Keeps the downloaded browsers between runs, keyed on the web lock file | A cache miss only makes the run slower |
| `5 playwright browsers` | Full only, all-engines off | Installs Chromium | A download problem can be re-run once |
| `5 playwright browsers all engines` | Full only, all-engines on | Installs every browser engine | A download problem can be re-run once |
| `5 playwright` | Full only, all-engines off | Browser tests in two projects: `chromium` and the phone-sized `pixel`, against the container database | See [How to read a failed run](#how-to-read-a-failed-run) |
| `5 playwright all engines` | Full only, all-engines on | The same tests in all seven projects | See [How to read a failed run](#how-to-read-a-failed-run) |
| `5 lighthouse` | Full only | Seeds the container database, then scores the production site. The mail settings are dummy values, so no mail is sent. The limits and the LCP note are in [The pipeline, in order](#the-pipeline-in-order) | `npm --prefix web run lighthouse` |
| `6 coverage gate` | Full only | .NET coverage: `Csps.Domain` 100 percent line and branch, `Csps.Application` at least 95 percent line | `pwsh tools/scripts/Invoke-CoverageGate.ps1`. Add tests, never exclusions |
| `6 web licenses` | Full only | Every web package has an allowed license, using `docs/dependencies.json` and the license files in `docs` | `npm --prefix web run license:check`. Never widen an allow-list: ask the owner |
| `6 web notices` | Full only | The web third-party notices file is up to date | `npm --prefix web run notices`, then commit `web/THIRD-PARTY-NOTICES.txt` |
| `6 nuget licenses + notices` | Full only | Every NuGet package has an allowed license, and `THIRD-PARTY-NOTICES.md` matches a fresh copy | `pwsh tools/scripts/New-ThirdPartyNotices.ps1`, then commit the changed file |
| `6 upload failure reports` | Full only, and only after a failure | Saves the Playwright report and traces as `playwright-failure-reports`, kept 7 days | It has nothing to fix: it is the evidence for the failure above it |
| `7 package web build` | Full and package | Builds the site again, so the package never carries the budget build's output | `npm --prefix web run build` |
| `7 package publish` | Full and package | Publishes the server as a self-contained `win-x64` package, because the host's .NET runtime is older than CSPS needs | Read the build error above the failure |
| `7 package migrations script` | Full and package | Writes the reviewed, idempotent database script. It is the only way the host database changes, never at startup | Read the error above the failure |
| `7 package check` | Full and package | Refuses logs, `app_offline.htm`, environment settings files, key or certificate files, `secrets.json` and `.env` files. Requires `web.config` with in-process hosting, `wwwroot/index.html` and `Csps.Server.dll` | `node web/scripts/package-check.mjs <package folder>` names each problem |
| `7 package secret scan` | Full and package | Runs the same checksum-verified gitleaks 8.30.1 over the finished package | Treat it as in `secret scan` |
| `7 package upload` | Full and package, and only on a push | Stores the package as `csps-package-<commit sha>` for 14 days. Deploy downloads it by that name | A GitHub outage. Re-run the job |

#### `gate result`

Runs last, always. It passes only when the gate of a mode that may merge succeeded. The full rule and the reason for it are in [The pipeline, in order](#the-pipeline-in-order).

| Step | What it does and checks | If it fails |
|---|---|---|
| `report` | Reads the mode and the gate's result. `full`, `docs` or `package` with a successful gate passes. Everything else fails and the log says which mode and result it saw | Fix the gate above it. A draft (`fast`) always fails this check by design: mark the pull request ready |

### Weekly (`weekly.yml`)

- **Runs when:** Sundays at 18:00 UTC (Monday 02:00 in Manila), and when someone presses **Run workflow**. GitHub starts scheduled runs only from `main`.
- **Permissions:** none at the top. The one job is allowed to read the repository, pull requests and checks, because the `classify` job of `ci.yml` needs exactly that.
- **Concurrency and time limit:** none of its own. The job limits of `ci.yml` apply.
- **Required on `main`:** no. A red weekly run blocks no pull request. It is a warning to fix on a normal branch.

#### `weekly all engines`

It runs the whole of `ci.yml` with `all-engines` switched on, so Playwright runs all seven projects (they are listed in [Weekly run](#weekly-run)). The jobs appear on the run page under this name. The classifier gives `full` mode for a scheduled or hand-started run, and no package is uploaded, because that needs a push. The job has no steps of its own.

### CodeQL (`codeql.yml`)

- **Runs when:** a pull request to `main` is opened, gets a new push or is reopened; on every push to `main`; and Sundays at 19:23 UTC (Monday 03:23 in Manila). The why and the Security tab are in [Security scans](#security-scans-public-repository).
- **Permissions:** none at the top. Each job may read the repository and write security events (`security-events: write`), which is how results reach the Security tab.
- **Concurrency:** a newer push to a pull request cancels its older scan. Scans of `main` and the weekly scan are never cancelled.
- **Runner and time limit:** `ubuntu-24.04`, 30 minutes per job.
- **Required on `main`:** both jobs.

The two jobs come from a matrix with `fail-fast: false`, so one language failing does not stop the other. `analyze (csharp)` builds the code by hand with the pinned SDK, with no incremental build and no shared compiler, so CodeQL watches the whole compile. `analyze (javascript-typescript)` reads the TypeScript without a build. A job fails when the C# build fails or the analysis itself errors. Findings are listed under the repository's Security tab.

| Step | Runs in | What it does and checks | If it fails |
|---|---|---|---|
| `checkout` | Both | Fetches the repository | A GitHub outage. Re-run the job |
| `setup dotnet` | `analyze (csharp)` only | Installs the SDK named in `global.json` | A download problem can be re-run once |
| `initialize codeql` | Both | Starts CodeQL for the language | A GitHub outage. Re-run the job |
| `build csharp` | `analyze (csharp)` only | Locked restore, then a full build of `Csps.slnx` | Same fix as `1 restore (locked)` and `2 build` in the gate |
| `analyze` | Both | Runs the scan and sends the results | Read the log. Alerts are in the Security tab |

### Hygiene (`hygiene.yml`)

- **Runs when:** a pull request to `main` is opened, gets a new push, is reopened, is marked ready for review or is edited, and on every push to `main`. "Edited" means that changing the pull request's title, description or base branch runs it again without a push. That matters because fixing a bad title is an edit.
- **Permissions:** the token starts empty, and every job may only read the repository.
- **Concurrency:** a newer push to a pull request cancels its older run. A run for `main` is never cancelled.
- **Runner and time limit:** `ubuntu-24.04`. `secret scan` 10 minutes, `commit messages` 5, `actionlint` 10, `zizmor` 10, `dependency review` 10.
- **Required on `main`:** all five jobs.

On a push to `main`, the two jobs that only make sense for a pull request (`commit messages` and `dependency review`) show as skipped. That is normal. The reasons for these checks are in [Security scans](#security-scans-public-repository), and the measured times are in [Measured (2026-10-16)](#measured-2026-10-16).

#### `secret scan`

Runs on pull requests and on pushes. gitleaks looks for passwords, keys and tokens in every commit of the pull request (from where it branched off `main` to its newest commit), or in every commit of the push. It uses the project rules in `.gitleaks.toml` and hides the secret's value in the log.

| Step | What it does and checks | If it fails |
|---|---|---|
| `checkout` | Fetches the whole history, because the scan walks every commit between the base and the head | A GitHub outage. Re-run the job |
| `install gitleaks 8.30.1 (checksum verified)` | Downloads gitleaks 8.30.1 and compares it with a fixed checksum before use, so a swapped file is refused | A download problem can be re-run once. A checksum mismatch is never fixed by editing the checksum: tell the owner |
| `scan commits` | Scans the commits. On a pull request that is base to head. On a push it is the commits since the previous push. When the previous point is unknown (a new branch, or a rewritten history), only the pushed commit is scanned | Treat a real secret as leaked: tell the owner and replace the secret where it was issued. Deleting it in a later commit does not clear the check, because every commit is scanned, so the developer rewrites the pull request's commits. A false alarm on a test file is fixed only by a single-file entry in `.gitleaks.toml`, with the owner's OK |

#### `commit messages`

Runs on pull requests only. Every commit subject in the pull request, and the pull request title, must read `type(scope): summary`. The scope is optional and uses lowercase letters, digits, dots, slashes and hyphens. A `!` before the colon marks a breaking change. A git `Revert "..."` subject is also accepted, and merge commits are skipped. The eleven types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore` and `revert`. The title matters most, because it becomes the squash commit on `main`.

| Step | What it does and checks | If it fails |
|---|---|---|
| `checkout` | Fetches the whole history so every commit in the pull request can be read | A GitHub outage. Re-run the job |
| `setup node` | Installs Node 24.21.0. The script uses only Node's built-in parts, so no `npm ci` is needed | A GitHub outage. Re-run the job |
| `check subjects` | Runs `web/scripts/commit-lint.mjs` on the title and each commit subject and prints every subject that is wrong, with the reason | A bad title: edit it on GitHub, and the "edited" trigger runs the check again. A bad commit subject: the developer rewords that commit and pushes |

#### `actionlint`

Runs on pull requests and on pushes. actionlint checks every workflow file for YAML mistakes, wrong expressions and shell script mistakes (it asks the runner's shellcheck to read the `run` scripts).

| Step | What it does and checks | If it fails |
|---|---|---|
| `checkout` | Fetches the repository | A GitHub outage. Re-run the job |
| `install actionlint 1.7.12 (checksum verified)` | Downloads actionlint 1.7.12 and compares it with a fixed checksum before use | Same as for gitleaks: a download problem can be re-run once, a checksum mismatch goes to the owner |
| `lint workflows` | Runs `actionlint` over every file in `.github/workflows` | The log gives the file, the line and the rule. The developer fixes that line in the workflow |

#### `zizmor`

Runs on pull requests and on pushes. zizmor looks for known workflow security mistakes, for example untrusted text placed straight into a script, a token with more rights than the job needs, or an action that is not pinned. Findings show as notes (annotations) on the run page, not in the Security tab (that upload is switched off on purpose).

| Step | What it does and checks | If it fails |
|---|---|---|
| `checkout` | Fetches the repository | A GitHub outage. Re-run the job |
| `zizmor 1.30.1` | Runs zizmor 1.30.1 through its pinned action | Read the annotation, fix the workflow line it names. An ignore comment needs a written reason; `weekly.yml` has the one existing example |

#### `dependency review`

Runs on pull requests only. It fails when a pull request adds or changes a package that has a known security problem of any severity (low and up), or that has a license outside the allow-list: MIT, Apache-2.0, BSD-2-Clause, BSD-3-Clause, ISC, 0BSD, MPL-2.0 and OFL-1.1. A GitHub Action shows an unknown license, because GitHub cannot read it, and is let through (the pin tests in `CiWorkflowTests` cover actions). The summary is on the run page and is not posted as a comment. The job has no `checkout` step because it reads the pull request's changes from GitHub.

| Step | What it does and checks | If it fails |
|---|---|---|
| `review dependency changes` | Compares the packages before and after the pull request | Choose another version (any new version needs the owner's approval) or drop the change. Never widen the allow-list to make it pass |

### Deploy (`deploy.yml`)

Deploy is the production deploy. The owner pressing **Run workflow** is the approval, and a merge never deploys. The runbook is [deploy.md](deploy.md): this section only describes the file.

- **Runs when:** only on **Run workflow** (`workflow_dispatch`), or `gh workflow run deploy.yml --ref main`. There is no other trigger.
- **Permissions:** none at the top. The job may write repository contents (to create the deploy release) and read Actions (to find the package that CI built).
- **Concurrency:** `deploy-production`. Two deploys never run at once, and a running deploy is never cancelled half way.
- **Runner and time limit:** `windows-2025` (Web Deploy ships with it), 30 minutes.
- **Runs from:** `main` only. A dispatch from any other branch skips the job and does nothing.
- **Required on `main`:** no. It never runs on a pull request.

Inputs:

| Input | Type and default | What it does |
|---|---|---|
| `action` | Choice, `deploy` | `deploy` puts a CI-passed build live. `online` removes a stuck offline page. `hostprobe` is the one-time host check |
| `sha` | Text, empty | The full 40-character commit id of a `main` build that passed CI. Needed for `deploy` |
| `dry_run` | Yes or no, no | A read-only check of the login, the port and the certificate. Nothing is changed |
| `probe_rewrite` | Yes or no, no | `hostprobe` only: also tests whether the host has URL Rewrite |

#### `deploy`

| Step | What it does and checks | If it fails |
|---|---|---|
| `checkout` | Fetches the repository | A GitHub outage. Re-run the job |
| `setup node` | Installs Node 24.21.0. The deploy script uses only Node's built-in parts, so nothing else is installed | A GitHub outage. Re-run the job |
| `setup dotnet` | Only for `hostprobe`: installs the SDK, because that action publishes a small .NET project | A download problem can be re-run once |
| `deploy` | Runs `web/scripts/deploy.mjs`. The inputs and these secrets reach it only through environment variables: `WEBDEPLOY_SERVER`, `WEBDEPLOY_SITE`, `WEBDEPLOY_USERNAME`, `WEBDEPLOY_PASSWORD`, `WEBDEPLOY_CERT_SHA256` and `HOSTPROBE_KEY`, plus the variable `SITE_ORIGIN`. The script checks the commit id | The log says what stopped it. Follow [How to deploy](deploy.md#how-to-deploy) and, if the site is left offline, [Recover with the online action](deploy.md#recover-with-the-online-action) |

More in the runbook: [Secrets and variables](deploy.md#secrets-and-variables), [Dry run first](deploy.md#dry-run-first), [What the automatic rollback does](deploy.md#what-the-automatic-rollback-does) and [Who can deploy](deploy.md#who-can-deploy).

### Dependabot (`dependabot.yml`)

`.github/dependabot.yml` is not a workflow. It tells GitHub's update bot what to keep current, and the bot opens pull requests.

- **Three ecosystems:** NuGet (the versions in `Directory.Packages.props`), npm (`web` and `tools/openapi-gen`, in one entry so a single grouped pull request arrives instead of two racing ones) and GitHub Actions (the pinned actions in the workflows).
- **Schedule and grouping:** each ecosystem is checked monthly, and all its updates arrive together in one pull request.
- **Cool-down:** a version is proposed only 14 days after its release, the project's release cool-down. Security updates arrive at once, because the cool-down covers version updates only and security updates are enabled in the repository settings ([Repository settings applied](branch-rules.md#repository-settings-applied-plan-03-16)).
- **Titles:** they start with `build` (NuGet and npm) or `ci` (GitHub Actions) plus a scope, so they pass `commit messages`.

**Why a Dependabot pull request fails CI by design.** A new version is a new thing to trust, so the owner approves it first:

- A NuGet or npm bump fails `3 architecture tests` (`DependencyRegistryTests`) until `docs/dependencies.json` records the new version with the owner's approval.
- An npm bump can also fail `6 web licenses` and `6 web notices`, which read the same file and the notices file.
- A NuGet bump can fail `1 restore (locked)` when Dependabot leaves `packages.lock.json` stale. The fix is `dotnet restore --force-evaluate` on its branch.
- A GitHub Actions bump fails `3 architecture tests` (`CiWorkflowTests`) until the new commit id and version are added to its `ApprovedActions` list, with the owner's OK.
- `dependency review` also runs on these pull requests.

**What to do.** The owner checks each new version (age, publisher, license, known problems) and says OK. The developer records it as in [Adding a dependency](../dependencies.md#adding-a-dependency), pushes to the Dependabot branch and waits for green. The pull request is then merged with the merge script, on the owner's instruction. If the owner says no, close the pull request.
