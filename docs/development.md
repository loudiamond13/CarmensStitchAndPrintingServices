# Developer guide: from a fresh clone to a running API

*Created: 2026-10-07T13:02:24-05:00 · Updated: 2026-10-25T08:08:00-05:00*

This page takes a new developer from `git clone` to a running, tested CSPS API on a Windows machine. Follow the steps in order. Every command runs from the repository root in a normal terminal (Windows PowerShell 5.1 or PowerShell 7).

> **This machine is shared.** Another project (TheBETSLLC, in `C:\Work\TheBETSLLC`) is developed here at the same time, often by a separate session. The rules in [Shared-machine rules](#shared-machine-rules) keep the two apart. Read them before you start anything.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| .NET SDK | 10.0.401 | Pinned in `global.json` with `rollForward: latestPatch`, so any later 10.0.4xx patch works. Tests run on Microsoft.Testing.Platform (`dotnet test --project ...`). |
| SQL Server 2025 Express LocalDB | 2025 | Provides `sqllocaldb`. CSPS uses the default instance, `(localdb)\MSSQLLocalDB`, shared with TheBETSLLC. |
| Windows PowerShell | 5.1 | Every script in `tools/scripts` runs on 5.1 (and on PowerShell 7). |
| Git | any recent | |

**No Docker locally.** Tests use LocalDB on a developer machine. Only CI (Linux) uses a SQL Server container. This keeps clear of the Windows dynamic port range.

The license gate (`New-ThirdPartyNotices.ps1`) looks package metadata up on nuget.org, so it needs network access.

## Ports

| Port | Used by | From |
|------|---------|------|
| 5115 | API over http (`--launch-profile http`) | now |
| 7028 | API over https (`--launch-profile https`) | now |
| 5180 | Vite dev server (`strictPort: true`) | Phase 2 |
| 5199 | Playwright E2E host (`reuseExistingServer: false`) | Phase 2 |

**Never use** 5173, 5023 or 5099 (they belong to TheBETSLLC), and avoid **49152-65535** (the Windows dynamic range, where Hyper-V and WSL reserve blocks).

## First-time setup

Run these once, in this order.

1. **Start the default LocalDB instance.** Safe to re-run. It never stops, deletes or recreates `MSSQLLocalDB`, which TheBETSLLC shares.

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-LocalDb.ps1
   ```

2. **Restore the local dotnet tools** (`dotnet-ef`, `reportgenerator`, `nuget-license`, pinned in `.config/dotnet-tools.json`).

   ```powershell
   dotnet tool restore
   ```

3. **Create your development secrets.** This writes the JWT signing key, the sign-in code key and the Data Protection certificate to *your* user-secrets store (`%APPDATA%\Microsoft\UserSecrets\...`), never to git, environment variables or machine settings. Every value goes in through standard input, so none shows on a command line. The API refuses to start without them. Safe to re-run, because existing values are kept.

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Initialize-DevSecrets.ps1
   ```

   Sign-in emails need the mail settings too. Add `-Smtp` and follow [docs/operations/mail-setup.md](operations/mail-setup.md). Local sign-in always sends a real email to the address you sign in with (D-27); automated tests never send mail.

4. **Build the schema from the migrations.** Every table comes from EF Core migrations, so an empty database becomes the full schema with no backup file.

   ```powershell
   dotnet ef database update --project src/Csps.Infrastructure --startup-project src/Csps.Server
   ```

   This targets `CSPS_Dev` on `(localdb)\MSSQLLocalDB`. To target the E2E database instead, add
   `--connection "Server=(localdb)\MSSQLLocalDB;Database=CSPS_E2E;Integrated Security=true"`.

   When this command creates a new database, SQL Server gives it the server's default compatibility level (170 on SQL Server 2025). The seed in step 5 pins it to 160, the level the app's SQL is generated for, so always run step 5 after creating a database.

5. **Seed development data.** The seed is an explicit command. Nothing seeds or migrates when the API starts. It only accepts `CSPS_Dev` (the default) or `CSPS_E2E`, and only on the `(localdb)\MSSQLLocalDB` instance or on a SQL Server container on this machine addressed as `127.0.0.1,<port>` or `localhost,<port>` (the container the CI tests use). It refuses every other database (including every `BetsLLC_*` database on the shared instance) and every other server, including other LocalDB instances, named-pipe (`np:`) and `tcp:` addresses, named instances, hosted servers such as the SmarterASP.NET database, and any connection string with a `Failover Partner`. A refusal exits with code 2 before anything connects. It also applies any pending migrations before seeding, and is safe to re-run. The seed also adds demo company expenses (60 over the last 60 days and 4 coming up, with made-up amounts) when the expenses table is empty and at least one active Admin or Manager with a password exists. It never creates accounts, so create your first Manager (see "Signing in locally") and run the seed again to get them.

   ```powershell
   dotnet run --project tools/Csps.DevSeed -- --reset
   ```

   `--reset` drops `CSPS_Dev` first and rebuilds it from the migrations. Leave it off to keep existing data. Use `--database CSPS_E2E` for the E2E database.

## Secret scan before every commit (D-10)

GitHub's secret scanning runs on this public repository too, and the project also scans for secrets itself with gitleaks (free, MIT license), so a key is caught before it is ever pushed. CI scans every pull request and every push to `main` (the `secret scan` check). The same scan can run on your machine before each commit, so a key never reaches the history.

Turn it on once per clone:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Install-Gitleaks.ps1 -SetHooksPath
```

The script downloads gitleaks 8.30.1 into `artifacts/tools/gitleaks/8.30.1` (git-ignored), refuses it unless its SHA-256 matches the approved value, and sets only this repository's `core.hooksPath` to `.githooks`. It changes nothing at User or Machine level.

- **What a block looks like.** `git commit` stops with a gitleaks report that names the file and line and hides the secret (`REDACTED`). Remove the secret from the staged file, then commit again. If it was a real secret that was ever pushed, treat it as leaked and tell the owner so it can be rotated.
- **If gitleaks is not installed,** the hook prints one warning that points to `Install-Gitleaks.ps1` and lets the commit through. CI still scans.
- **Never bypass with `--no-verify` for a real finding.** For a fake value in a test, add the file by exact path to `.gitleaks.toml` with a description (the `AllowlistsAreNarrow` test rejects broad entries).

## Running the API

1. Run the preflight check first. If a port is **IN USE** by another project, or TheBETSLLC's test processes are listed, **wait**. Never stop another project's processes.

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199
   ```

2. Start the API:

   ```powershell
   dotnet run --project src/Csps.Server --launch-profile http
   ```

3. Check it:
   - <http://localhost:5115/health> is public and returns a minimal body.
   - <http://localhost:5115/scalar> is the API reference (Scalar), with the OpenAPI document at `/openapi/v1.json`. Both exist **in Development only** and are never mapped in production.

The launch profile sets `ASPNETCORE_ENVIRONMENT=Development` for that process only. Never set it, or any other variable, at User or Machine level.

## Signing in locally

Staff sign in with their password and an emailed 6-digit code. The refresh cookie `__Secure-csps_rt` is HttpOnly, Secure, SameSite Strict and scoped to `/api/v1/auth`.

- Local sign-in works in Chrome, Edge and Firefox on `http://localhost:5180`. Safari refuses Secure cookies on plain localhost, so WebKit is covered by the HTTPS E2E host (`https://localhost:5199`) instead (research Pitfall 2, assumption A8). `npm --prefix web run e2e -- --grep @auth-cookies` proves the cookie's attributes in Chromium, Firefox and WebKit.
- A session without "Keep me signed in" uses a session cookie, but closing the browser ends it only when the browser does not restore its session (Chrome's "Continue where you left off" and Safari's reopened windows bring session cookies back). The server's 12-hour cap is the real limit (research Pitfall 3).
- Sign-in codes are emailed. In the Testing environment (the E2E host) they go to an in-memory sink instead, and nothing is ever sent (see [the Testing environment](web/e2e.md#8-the-testing-environment-and-its-helpers)).

To get your own login on `CSPS_Dev` (the database has no staff accounts until you create the first Manager):

1. Make sure `CSPS_Dev` is migrated and seeded (see the dev seed above) and that your mail settings are in user-secrets (`Initialize-DevSecrets.ps1 -Smtp`, see [mail-setup](operations/mail-setup.md)). The invite and the sign-in code are real emails.
2. Start the API and the web dev server (`npm --prefix web run dev`, port 5180). Leave them running: the API's background sender emails the invite within a minute.
3. In another terminal, queue the invite with your own email. `DOTNET_ENVIRONMENT=Development` makes the command read your user-secrets (the Data Protection certificate). The connection string goes in an environment variable for that terminal only, never in an argument:

   ```powershell
   $env:DOTNET_ENVIRONMENT = 'Development'
   $env:CSPS_BOOTSTRAP_CONNECTION = 'Server=(localdb)\MSSQLLocalDB;Database=CSPS_Dev;Integrated Security=true'
   dotnet run --project tools/Csps.BootstrapManager -- --email you@example.com --first-name You --last-name Dev --confirm-database CSPS_Dev --public-base-url http://localhost:5180
   ```

4. Open the link in the invite email in your browser, set a password, then sign in at `/admin/login`. The 6-digit code arrives by email (D-27). There is no way to skip the code.

The command refuses a second run while an active Manager exists. The full runbook, including the production run, is [operations/bootstrap-manager.md](operations/bootstrap-manager.md).

## How the API serves the web app

The API also hosts the React app, so the site and the API share one origin and one strict CSP.

- **Build output.** `npm --prefix web run build` writes the production app into `src/Csps.Server/wwwroot` (`index.html` plus content-hashed files under `assets/`). That folder is build output: it is git-ignored and never committed, not even a `.gitkeep`, because each build empties it first. Hand-written public files belong in `web/public/`.
- **Tests never need a build.** Every .NET test host serves the committed fixture web root `tests/Csps.Testing/Fixtures/webroot` (`CspsApiFactory.FixtureWebRoot`) and turns static web assets off, so a fresh clone passes without `npm run build`. The fixture also holds `.vite/license.md` and `.x/y.txt`, which model build internals that must never be served.
- **The shell.** A GET or HEAD on any page path (no dot in the last segment, for example `/products` or `/admin/orders`) that no other endpoint matches gets `index.html`, anonymously, with `Cache-Control: no-cache`. Any other method on a page path still meets the default-deny policy (401).
- **Missing files.** A file-like path (a dot in the last segment) that no static file answers gets an anonymous ProblemDetails 404, never the shell and never a 401. Unknown `/api/...` paths keep their own ProblemDetails 404. Outside Development, `/openapi/...` and `/scalar/...` are reserved 404s too.
- **Hidden segments.** Static files are served through `HiddenSegmentFileProvider`. Any path with a segment that starts with `.` or contains `~`, split on both `/` and `\`, reads as missing, so `/.vite/license.md`, `/.VITE/LICENSE.MD`, `/%2Evite/license.md`, `/assets%5C..%5C.vite%5Clicense.md` and the Windows 8.3 alias `/VITE~1/license.md` all get exactly the missing-file 404, with no `ETag`, `Last-Modified` or `Accept-Ranges`. Directory listings hide those entries as well. Do not rely on `dotnet publish` dropping dot folders, because `dotnet run`, the E2E host and the Lighthouse host serve the raw build folder.
- **`/.well-known/` exception policy.** Nothing under `/.well-known/` is served today. If a real file is ever needed there (for example `security.txt`), add an explicit exact-path exception in `HiddenSegmentFileProvider` with its own test. Never relax the rule as a whole (accepted risk AR-02-02).
- **Compression.** Responses of type `text/html`, `text/css`, `text/javascript`, `application/javascript` and `image/svg+xml` are Brotli- or gzip-compressed when the browser accepts it, over HTTPS too. JSON and ProblemDetails are never compressed, because compressed secrets next to attacker-chosen text leak through response length (BREACH). The list lives in `SpaCaching.CompressibleTypes`.
- **Caching.** Files under `/assets/` carry `Cache-Control: public, max-age=31536000, immutable`, because Vite puts a content hash in every name there. `index.html`, the shell and every other static file carry `no-cache`, so the browser revalidates them and picks up a new deploy at once.

## Testing

Run the preflight check (above) before a full test run.

| What | Command |
|------|---------|
| One project (quick) | `dotnet test --project tests/Csps.Domain.UnitTests` |
| One test class | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*SolutionLayoutTests"` |
| Everything | `dotnet test --solution Csps.slnx` |

- **Database tests** create their own `CSPS_Test_<guid>` database on `(localdb)\MSSQLLocalDB` and drop it when they finish.
- **`CSPS_TEST_SQL`** picks the SQL backend for integration tests: unset or `localdb` uses LocalDB (the only local option), and `container` uses a SQL Server 2025 container (CI only). Set it only for a single process or terminal, for example `$env:CSPS_TEST_SQL = 'localdb'` in one PowerShell window. Never set it at User or Machine level.
- **Breached-password check.** Tests never reach the internet. In the Testing environment (Debug builds only) an offline stand-in replaces the HIBP service: `Pwned#Pass2026` is reported as found in a breach, `Hibp-Down#2026` simulates the service being down, and every other password is reported clean. The real client is tested with recorded responses. One opt-in smoke test against the live service (`HibpLiveTests`) runs only when `CSPS_LIVE_HIBP=1` is set for that single process, for example `$env:CSPS_LIVE_HIBP = '1'` in one PowerShell window.
- **Leftover test databases** from a crashed run can be listed, and then removed, with:

  ```powershell
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Remove-StaleTestDatabases.ps1 -WhatIf
  powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Remove-StaleTestDatabases.ps1
  ```

  It drops only names matching `^CSPS_Test_[0-9a-f-]{36}$` that are older than two hours, and only on `(localdb)\MSSQLLocalDB`.

### Moving off the retired CSPS instance

CSPS used to have its own LocalDB instance named `CSPS`. It now uses the default instance only.

- Recreate `CSPS_Dev` with `dotnet run --project tools/Csps.DevSeed`. `npm --prefix web run e2e` recreates `CSPS_E2E`.
- You can remove the old instance by hand with `sqllocaldb stop CSPS` and then `sqllocaldb delete CSPS`. This removes only that instance. Its `.mdf` files stay in your user profile. Nothing in this repository runs these commands.

## Quality gates

Run all of these before you push. CI (Phase 3) runs the same commands.

| Gate | Command | Passes when |
|------|---------|-------------|
| Build | `dotnet build Csps.slnx -tl:off` | 0 warnings and 0 errors. Warnings are errors (`TreatWarningsAsErrors`). |
| Formatting | `dotnet format Csps.slnx --verify-no-changes` | Nothing would change. |
| Tests | `dotnet test --solution Csps.slnx` | Every test passes. |
| Coverage | `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | Csps.Domain is at 100% line and 100% branch, and Csps.Application is at 95% line or more. The report is in `artifacts/coverage/`. |
| Licenses and notices | `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/New-ThirdPartyNotices.ps1` | Every package (transitive ones included) uses an allowed license (`docs/allowed-licenses.json`) or an owner-approved exact-version exception (`docs/license-exceptions.json`). It regenerates `THIRD-PARTY-NOTICES.md`, so commit that file when it changes. |

Never reach a gate by lowering a threshold, excluding production code from coverage, or widening the license lists. Report the problem instead. Adding a package follows `docs/dependencies.md`, which covers the 14-day release cool-down and owner approval.

## Schema changes

- Add a migration:

  ```powershell
  dotnet ef migrations add <Name> --project src/Csps.Infrastructure --startup-project src/Csps.Server
  ```

  Migrations live in `src/Csps.Infrastructure/Persistence/Migrations`. No JSON columns. Drops, renames and lossy type changes are one-way doors, so ask the owner first.
- **Production** schema changes go out only as a reviewed idempotent script:

  ```powershell
  dotnet ef migrations script --idempotent --project src/Csps.Infrastructure --startup-project src/Csps.Server --output artifacts/migrations/<Name>.sql
  ```

  The API never runs `Database.Migrate()` at startup.

## Hosting and operations

- `.planning/HOSTING-RECORD.md` is the SmarterASP.NET Basic hosting checklist the owner runs, with the facts found on the host and what they mean for later phases. Check it before relying on a host detail such as the runtime version or the database compatibility level.
- `docs/operations/` holds the runbooks: `data-protection-rotation.md` (rotating the Data Protection certificate), `audit-log.md`, `mail-setup.md` and `bootstrap-manager.md` (the first Manager on an empty database).
- `tools/Csps.HostProbe/README.md` explains the one-time host probe. It never goes on the live site.

## Shared-machine rules

- **Databases:** use only the `CSPS_` databases on `(localdb)\MSSQLLocalDB` (`CSPS_Dev`, `CSPS_E2E`, `CSPS_Test_<guid>`, `CSPS_Legacy_Restore`). TheBETSLLC shares that instance, so never create, reset, restore over or drop any `BetsLLC_*` database.
- **Ports:** see [Ports](#ports). Run the preflight check before a dev server, Playwright or a full test run, and wait if another project is busy.
- **Environment variables:** never set `ASPNETCORE_URLS`, `ASPNETCORE_HTTPS_PORT`, `ASPNETCORE_ENVIRONMENT`, `CSPS_TEST_SQL` or any other variable at User or Machine level, and never change system settings. Set them only inside one terminal or process.
- **`_local/`** holds a production database backup. Never commit, upload or deploy it, and never open it outside the legacy-discovery phase. It is restored only into `(localdb)\MSSQLLocalDB` as `CSPS_Legacy_Restore`, never over `CSPS_Dev`.
- **One session per folder.** Never work in `C:\Work\TheBETSLLC` from a CSPS session.

## How CI/CD works

This section explains, in plain words, what happens on GitHub from the moment a change is pushed to the moment it is live. The detailed runbooks are [operations/ci.md](operations/ci.md), [operations/branch-rules.md](operations/branch-rules.md) and [operations/deploy.md](operations/deploy.md).

### The big picture

1. You (or Claude) work on a branch and open a pull request (PR) to `main`.
2. GitHub runs the checks automatically on every push to that PR. Nobody presses a button.
3. When every check is green and the PR's Definition of Done checklist is ticked, the PR is merged with the one merge command (`tools/scripts/Merge-PullRequest.ps1`).
4. The merge to `main` runs the checks once more and builds a **deploy package** tied to that exact commit.
5. Nothing goes live by itself. The site changes only when the owner opens the Actions tab and presses **Run workflow** on the deploy workflow, picking a package of `main` that passed CI.

CI (continuous integration) is steps 2 to 4: build and test every change. CD (continuous delivery) is step 5: a tested package that is ready to deploy, released by the owner's click.

### What starts each check

Each check is defined in a workflow file in `.github/workflows/`. The file says which GitHub event starts it. GitHub then rents a fresh Linux machine (a "runner"), checks out the code and runs the steps. Each job shows as one line in the PR's checks list.

| Event | Workflows that run |
|---|---|
| A PR to `main` is opened, gets a new commit, is reopened or is marked ready for review | `ci.yml`, `hygiene.yml`, `codeql.yml` |
| The PR title is edited | `hygiene.yml` only (it checks the title) |
| A merge (push) lands on `main` | `ci.yml` (with the deploy package), `hygiene.yml`, `codeql.yml` |
| Every Sunday, 18:00 UTC | `weekly.yml`: the full CI with every browser engine |
| Every Sunday, 19:23 UTC | `codeql.yml`: a fresh security scan for newly found vulnerability patterns |
| The owner presses Run workflow | `deploy.yml` (the only workflow that never starts by itself), `weekly.yml` or `ci.yml` on demand |

### The checks, one by one

**Main gate (`ci.yml`)**

- **`classify`** looks at what changed and picks the run's mode:

  | Mode | When | What runs |
  |---|---|---|
  | `docs` | Only documentation or planning files changed | A quick sanity pass |
  | `fast` | The PR is a draft | The core .NET and web checks, about 10 minutes |
  | `full` | The PR is ready for review | Everything, including the slow browser and coverage stages |
  | `package` | A push to `main` whose PR already passed the full gate on the same files | Reuses that proof and only builds the deploy package |

  When the classifier is unsure, it chooses `full`. It never chooses a cheaper mode by mistake.
- **`gate (<mode>)`** runs the stages in a fixed order and stops at the first failure:
  1. **Restore:** NuGet packages in locked mode (exact versions from the lock files) and `npm ci`, then `npm audit` for known vulnerabilities.
  2. **Build:** the .NET solution with zero warnings, plus a formatting check.
  3. **Tests:** unit tests, integration tests (full mode only, against a throwaway SQL Server 2025 container) and architecture tests.
  4. **Web checks:** type check, lint, Prettier and the Vitest tests with coverage, plus the OpenAPI checks.
  5. **Browser stage (full mode only):** the web build with its size budgets, Playwright end-to-end tests and Lighthouse. Until Phase 11 Lighthouse reports the LCP value without failing on it (`docs/web/release-gates.md`); every other limit still fails.
  6. **Final gates (full mode only):** the coverage thresholds and the license and `THIRD-PARTY-NOTICES` checks.
  7. **Package (full and package mode):** builds the deploy package, checks that it holds no logs, development settings, keys or secret files, scans it with gitleaks and writes the idempotent database script. This runs on a ready pull request too, so a packaging failure shows before the merge. Only a push to `main` stores the package, for 14 days as `csps-package-<commit sha>`.

  If a full run fails in the browser stage, the Playwright report is kept for 7 days to show what went wrong.

**Hygiene (`hygiene.yml`)**

| Check | What it does |
|---|---|
| `secret scan` | gitleaks looks at the new commits for passwords, keys and tokens. |
| `commit messages` | The PR title and every commit message must follow Conventional Commits (`type(scope): summary`). |
| `actionlint` | Checks the workflow files for YAML and shell mistakes. |
| `zizmor` | Checks the workflow files for known attack patterns (for example a workflow that could leak its token). |
| `dependency review` | When a PR adds or upgrades a package, checks it for known vulnerabilities and that its license is on the allowed list. |

**Security scan (`codeql.yml`)**

- `analyze (csharp)` and `analyze (javascript-typescript)` run GitHub's free CodeQL scanner over the C# and the TypeScript code and look for security bugs such as injection and unsafe data handling.
- `Code scanning results / CodeQL` is GitHub's summary of those two scans. Alerts appear under the repository's Security tab.

### How `main` is protected

- **The merge command.** `Merge-PullRequest.ps1` refuses to merge unless every check on the PR's newest commit passed and the Definition of Done checklist is ticked. It squash-merges, so `main` stays a straight line of one commit per PR. Never use GitHub's merge button or `gh pr merge` directly.
- **GitHub's rules on `main`.** Because the repository is public, GitHub can enforce the same rules itself: required checks, linear history, no force-push, no deletion and no bypass. The required checks are `gate result` (a small last job in `ci.yml` that passes only when the mode's own gate succeeded, so a docs-only PR can satisfy it too) plus the Hygiene and Security checks. The ruleset was switched on in plan 03-16 once the full gate had passed on GitHub (`docs/operations/branch-rules.md` has the read-back).
- **Pinned actions.** Every third-party action is pinned to an exact, owner-approved commit (listed in `docs/dependencies.json`), so a moved tag can never swap in different code. Architecture tests (`CiWorkflowTests`) enforce this.
- **Least privilege.** Every workflow starts with no rights (`permissions: {}`), and each job asks only for what it needs, usually just reading the code.

### How a deploy works

1. A merge to `main` passes CI and stores its deploy package.
2. The owner opens Actions, chooses the deploy workflow, presses **Run workflow** and gives the commit sha of that build. A **dry run** option checks the login, the port and the certificate without changing anything.
3. The deploy runs on a Windows runner: it puts up the branded "site is updating" page (`app_offline.htm`), syncs the package to SmarterASP.NET with Web Deploy, takes the page down again and runs the read-only **smoke test** (`web/scripts/smoke.mjs`).
4. If the smoke test fails, the last good package is put back automatically and the run is marked failed.
5. Database changes are never made by the deploy. The owner applies the reviewed idempotent script first, as the runbook says.

The full procedure, rollback by hand and the first deploy are in [operations/deploy.md](operations/deploy.md) and [operations/cutover-runbook.md](operations/cutover-runbook.md).

### Reading a result

- **Green tick:** the check passed. **Red cross:** open it, then **Details**, to see the failing step and its log. **Yellow dot:** still running.
- A failure in `gate` names the stage in its step name (for example `3 integration tests`), so you can run the same command locally from [Quality gates](#quality-gates).
- A red `secret scan` means a secret may be in a commit. Remove it, and if it was a real secret, treat it as leaked and rotate it.
- GitHub emails you about a failed run on your PR. Weekly-run failures show on the Actions tab.

### Cost

The repository is public, so CI on GitHub's standard runners is free. If the repository ever becomes private again, the free plan has 2,000 minutes a month; when they run out, a merge needs the local full gate with its output pasted into the PR (see the "Local full gate" section of the PR template).
