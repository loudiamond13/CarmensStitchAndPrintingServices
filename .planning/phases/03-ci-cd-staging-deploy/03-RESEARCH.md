---
created: "2026-10-15T20:12:04-05:00"
updated: "2026-10-16T08:35:15-05:00"
phase: 03-ci-cd-staging-deploy
kind: research
---

# Phase 3: CI/CD & Deploy - Research

**Researched:** 2026-10-15
**Domain:** GitHub Actions CI on a free private repo; Web Deploy (msdeploy) to SmarterASP.NET IIS in-process hosting; supply-chain tooling; IIS `web.config` hardening
**Confidence:** MEDIUM overall. The CI pipeline is HIGH, because it is built from existing, tested repo commands. The SmarterASP.NET Web Deploy specifics are LOW until the first dry run.

## Summary

Almost everything the pipeline must run already exists and is tested locally: `dotnet build`/`format`/`test`, `Invoke-CoverageGate.ps1`, `New-ThirdPartyNotices.ps1`, `npm run verify` (whose steps match OPS-02 step 4 and 5), `npm run e2e` and `npm run lighthouse`. The CI work is mostly wiring. Three things are real engineering, though:

1. **The E2E and Lighthouse harnesses are wired to LocalDB.** `playwright.config.ts` hard-codes `ConnectionStrings__Csps: 'Server=(localdb)\\MSSQLLocalDB;Database=CSPS_E2E;...'`, and `e2e.mjs` seeds with `--database CSPS_E2E`, which defaults to LocalDB. An ubuntu runner has no LocalDB. Both need a CI override that points at a loopback SQL Server 2025 container, which `DevSeedTargetGuard` already allows (`127.0.0.1,<port>`).
2. **`dotnet publish` today leaks the developer's `logs/` folder into the package.** A local publish this session copied 107 MB of `src/Csps.Server/logs/*.json` into the output. A RID-specific publish (`-r win-x64`) also rewrites every `packages.lock.json`, so it fails CI's locked restore unless `RuntimeIdentifiers` is declared and the lock files are committed.
3. **The deploy has no staging and, on the first run, nothing to roll back to.** It is a manual `workflow_dispatch` on a Windows runner. It must handle `app_offline.htm` by hand, because msdeploy's `AppOffline` rule writes `App_Offline.htm`, which ANCM is reported not to see. It must also handle smoke-fail rollback, and a first deploy that has no "last good" package.

GitHub Free on a private repo rules out branch protection, environments with secrets or reviewers, CodeQL, secret scanning and dependency review. All of these were verified this session (environments via docs, rulesets via the CONTEXT 403). The design therefore leans on what *is* free:

- repository merge-button settings (squash only, so history stays linear)
- the repo's Actions setting `sha_pinning_required` (present in the API response this session)
- repository secrets
- Releases (no storage limit) to keep the "last good" package
- a tested merge-gate script

**Primary recommendation:** Use one ordered `gate` job on `ubuntu-24.04`, steps in OPS-02 order, with a dynamic name `gate (full)` / `gate (fast)` / `gate (docs)`. Add a `package` step on `main`, a weekly all-engine workflow, and a `deploy.yml` on `windows-2025` that is `workflow_dispatch` only. The deploy is driven by a unit-tested Node orchestrator: branded `app_offline.htm` up, then `msdeploy` sync (skipping `logs` and `app_offline.htm`), then `app_offline.htm` down, then smoke with retry. If the smoke fails, it rolls back to the latest `deploy-*` Release, and on success it records a new Release. Verify the host first with a read-only `-whatif` dry run and a one-time HostProbe deploy before the first CSPS deploy.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Merge gate (ordered checks) | CI (GitHub Actions, ubuntu) | Local tooling (merge-gate script) | Branch rules are unavailable (D-08). CI produces the evidence, and the script enforces it before `gh pr merge`. |
| Supply-chain checks | CI + GitHub (Dependabot) | Local git hook (gitleaks) | Dependabot is server-side and free. gitleaks, audits and license gates run in CI. The pre-commit hook catches secrets earlier. |
| Deploy package build | CI (ubuntu, `push` to main) | Release assets | Linux minutes cost less. Framework-dependent `win-x64` publish works across platforms. |
| Deploy execution | CI (windows-2025, `workflow_dispatch`) | SmarterASP.NET IIS (Web Deploy service, port 8172) | msdeploy is Windows-only. The runner image has the VS WebDeploy component. |
| HTTPS redirect, compression, caching headers | API / Backend (ASP.NET Core middleware, already built) | IIS `web.config` | The app already does the redirect, Brotli/gzip with a JSON exclusion, and Cache-Control. `web.config` must not double up or compress JSON (BREACH). |
| Server header removal | IIS `web.config` (`removeServerHeader`) | App middleware | Both layers exist today. |
| Production secrets | SmarterASP.NET app-pool environment variables | none | HOSTING-RECORD: "Secrets ... go into app-pool environment variables, never into a committed web.config". |
| Deploy credentials | GitHub repository secrets | none | Environment secrets are unavailable on Free private repos (verified, docs). |
| Post-deploy smoke | CI (Windows deploy job, Node script) | Owner manual steps | The D-06 read-only checks are visible over HTTP. Bootstrap and first sign-in stay manual. |
| Holding page (D-17) | Browser / Client (React public route) | none | Copy lives in the client. Existing gates apply (axe, Lighthouse, budgets, OR-4). |

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Deploy target & legacy retirement
- **D-01:** **CSPS deploys to the live site and replaces the legacy app in Phase 3.** This is an owner override of Prime Directive 1, recorded 2026-10-15. The owner accepts that staff lose the legacy order screens until the order phases ship. — **Reversibility:** one-way — after the switch, the legacy app is back only through the D-05 rollback kit, and visitors and staff see CSPS from that day.
- **D-02:** **The production deploy job exists now and is not locked behind a cutover switch.** It targets the live site from Phase 3 onward.
- **D-03:** **Fresh SQL Server 2025 database for CSPS.** After D-04 proves the backup, the owner deletes the legacy database on the host (the Basic plan allows one database) and creates a new SQL Server 2025 database. CSPS's idempotent migration script runs into the empty database. Legacy data then lives only in the `.bak` until the Phase 16 import. **Legacy data is never modified:** it is never migrated in place, and CSPS tables never share a database with it. After the new database exists, verify its compatibility level and re-pin `SqlCompatibility.Level` to 170 if it reports 170 (per HOSTING-RECORD D-33), then re-run MigrationScriptTests. — **Reversibility:** one-way — deleting the host database removes the live copy. Recovery is only from the `.bak`.
- **D-04:** **Backup proof before any delete.** The owner takes a fresh `.bak` from the control panel and keeps two copies off the host. Claude restores it into LocalDB as **`CSPS_Legacy_Restore`** and records a receipt: table names plus row counts per table, with no data values. This is an owner-approved exception to the "restore only in the legacy-discovery phase" rule (root CLAUDE.md). It reads names and counts only; schema study stays in Phase 10. The host database is deleted only after the owner confirms the receipt. The `.bak` stays in `_local/` (never committed or uploaded).
- **D-05:** **Legacy rollback kit.** Before the first deploy, the owner downloads the legacy site's files too. If CSPS will not start on the host, legacy can be put back the same day (files + the `.bak` restored into a new database). Once the owner accepts CSPS live, rollback means redeploying an earlier CSPS package (D-11).
- **D-06:** **Smoke test after every deploy:**
  - the roadmap set: `/health`, an unknown `/api/*` route returning ProblemDetails through IIS, HTTPS redirect, removed server headers, compression, `immutable` hashed assets and `no-cache` `index.html`
  - plus, on the first deploy, every **"Verify on the first deploy (Phase 3)"** row in `.planning/HOSTING-RECORD.md`: runtime patch (otherwise publish self-contained `win-x64`), in-process hosting, content root, logs folder writable, client IP/proxy topology, HTTPS termination, Asia/Manila and en-PH, PFX EphemeralKeySet, app-pool memory, `__Secure-` cookies on the HTTPS host, SMTP 587 and HIBP 443 reachability, `AllowedHosts`, `requestLimits`, Data Protection cert and `App:PublicBaseUrl` for bootstrap
  - Read-only checks are automated. The **bootstrap of the first Manager and the first emailed-code sign-in (AUTH-12, AUTH-13) are a one-time manual step by the owner.** HOSTING-RECORD rows move to Verified with the evidence.

#### Repo, merge gate & security tooling (C-27 / S-9, C-45)
- **D-07:** **The repo stays private.** The owner considered going public and chose private. `.planning/` keeps being committed to this private repo.
- **D-08:** **Process merge gate.** GitHub Free does not enforce branch rules on private repos (rulesets API returns 403 "Upgrade to GitHub Pro or make this repository public", checked 2026-10-15). Instead:
  - CI runs every check on every PR.
  - `/gsd-ship` and every merge step **refuse to merge unless every check on the PR head commit is green** (checked with `gh`), and the PR template's Definition of Done checklist is ticked.
  - Intended rules are written down as config/docs, ready to switch on if the repo is ever upgraded or made public: required checks, linear history, 0 required approvals, `CODEOWNERS` naming `@loudiamond13`, and no admin bypass of failing checks.
- **D-09:** **Review rule: checks required, the owner merges own PRs.** Required approvals = 0 (a solo owner cannot approve their own PR). CODEOWNERS is in place for future collaborators.
- **D-10:** **Free security set (D-00), no SAST scanner beyond the analyzers:**
  - Dependabot alerts and version updates for NuGet, npm and Actions, with a 14-day `cooldown` (D-19)
  - gitleaks in CI plus a local pre-commit hook
  - NuGetAudit as error, `npm audit`, the existing license gates
  - .NET analyzers and ESLint
  - Every action pinned by commit SHA, with least-privilege `permissions:`
  - CodeQL, GitHub secret scanning/push protection and the dependency-review action are **not used**: they are unavailable on a free private repo. Semgrep was offered and declined.

#### Deploy trigger, approval & rollback
- **D-11:** **The owner pressing Run is the approval.** A merge to `main` runs CI, then builds and stores the deploy package as a workflow artifact tied to its commit. A deploy runs only from `workflow_dispatch` (the GitHub "Run workflow" button or `gh workflow run`), choosing a build that passed CI. There is no auto-deploy on merge. The previous good package is kept for rollback.
- **D-12:** **No time window.** Deploys run whenever the owner presses Run. `app_offline.htm` shows a short branded "updating, back in a minute" page during the deploy.
- **D-13:** **Automatic rollback.** If the post-deploy smoke test fails, the workflow redeploys the last good package, re-runs the smoke test, and marks the run failed so the owner is notified.

#### CI minutes budget (private repo: 2,000 free minutes per month)
- **D-14:** **Full ordered gate on ready PRs.** Every push to a ready PR runs the whole OPS-02 pipeline in its order. Draft PRs run only the fast part: locked restore, build, format, unit and architecture tests, web typecheck, lint, Prettier and Vitest. A newer push cancels the older run (`concurrency`). Changes only under `.planning/` or docs skip the heavy jobs.
- **D-15:** **Playwright: Chromium + a phone viewport on PRs, all three engines weekly** (a scheduled run on `main`). Locally, the full three-engine run before shipping continues as in Phase 4.
- **D-16:** **When minutes run out, CI stops; nothing is paid.** The GitHub spending limit stays at $0 (D-00). Until minutes reset on the 1st, a merge requires the local full gate (`dotnet build`, `dotnet test --solution`, `Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e`) with its output pasted in the PR.

#### Public site after the switch
- **D-17:** **Simple holding page.** Until Phase 11's real public pages, visitors see one branded, fast page built with the Phase 2 design system: shop name, a short "new website on the way" line, phone, Facebook link, address and hours. The copy lives in the client (no CMS). It replaces `PublicPlaceholderPage` on the public routes. It must meet the existing gates: axe, Lighthouse ≥ 95 mobile, bundle budgets, OR-4 (no long dash). The admin portal (`/admin/...`) stays as built in Phase 4.

#### Cutover-day steps & roles
- **D-18:** **Owner on the control panel, Claude on the runbook.** Claude writes a numbered cutover runbook (`docs/operations/`) and any scripts. The owner does every control-panel step and pastes the results, and Claude verifies each one before the next:
  1. fresh `.bak` + legacy file download (D-04, D-05)
  2. restore receipt confirmed (D-04)
  3. delete the legacy DB, create the SQL Server 2025 DB (D-03)
  4. app-pool environment variables: connection string, JWT key, Data Protection PFX and password, mail settings (HOSTING-RECORD "App settings and secrets")
  5. Web Deploy credentials into GitHub repository secrets
  6. run the idempotent migration script
  7. the owner presses Run for the first deploy (D-11), and the smoke test runs (D-06)
  8. the owner bootstraps the first Manager and signs in (D-06)
- **D-19:** **Timing: switch as soon as the pipeline and runbook are verified**, any day.

### Claude's Discretion
- Workflow file layout: one workflow vs separate `ci` / `deploy` / `weekly` / `dependabot` files, job split and caching, as long as the OPS-02 order is preserved for the merge-gate result.
- How the merge-gate check is implemented in `/gsd-ship` (a script under `tools/scripts/`, or `gh pr checks --required`-style logic).
- Runner choice for the deploy job: Windows with `msdeploy` (as the roadmap assumed), or another free route the research proves works with the AppOffline rule.
- How the "last good package" is stored (Actions artifact retention vs a release asset), within free limits.
- The exact `web.config` contents for OPS-05, building on `src/Csps.Server/web.config`.
- How the smoke test is written (Playwright project vs a script), reusing the existing E2E harness where possible.

### Deferred Ideas (OUT OF SCOPE)
- **Staff order recording between the switch and the order phases.** Not discussed by the owner's choice. It may need a plan (paper or spreadsheet) and possibly a later import; raise it before the switch date.
- **Old legacy URLs and SEO** (redirects or a friendly 404 for saved links). Not discussed; a candidate for Phase 11 or the hardening phase.
- **Going public later.** It would unlock enforced rules, CodeQL, secret scanning and unlimited minutes. It needs a fresh scrubbed repo (the owner prefers to keep this repo private).
- **Roadmap amendments:** reword the Phase 3 title and OPS-04 (no staging), record the Prime Directive 1 override in PROJECT.md, and update Phases 16/17 (legacy import now goes from the `.bak` into a database that already serves CSPS; no live-site cutover remains). Do this in planning or with `/gsd-phase` edit.
</user_constraints>

**Note on the deferred "Roadmap amendments" item:** CONTEXT says "Do this in planning or with `/gsd-phase` edit". The planner should include one small docs plan for it, because OPS-04's text ("staging site") otherwise contradicts what Phase 3 delivers.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OPS-01 | Repo with protected `main` (PR required, green checks, linear history, CODEOWNERS), PR template with DoD checklist, Conventional Commits, `.gitignore` per PRD §18 | Protection is unavailable (D-08), so use the merge-gate script plus free repo settings (squash only, `delete_branch_on_merge`). Add a `.github/CODEOWNERS`, a PR template with the PRD §22 DoD list, and a Conventional-Commits check step. `docs/operations/branch-rules.md` records the intended rules. See Patterns 5 and 6. |
| OPS-02 | Ordered CI pipeline on every PR; actions pinned by SHA; least-privilege permissions | A single ordered `gate` job (Pattern 1) with resolved SHAs (Standard Stack), `permissions: {}` at the top and per-job grants, `persist-credentials: false`, and CI overrides for the LocalDB-bound harnesses (Pattern 2). |
| OPS-03 | Dependabot (NuGet, npm, Actions) with cooldown, plus the owner-approved substitute set | `dependabot.yml` with `cooldown.default-days: 14` (supported for nuget, npm and github-actions per docs). gitleaks binary (MIT; **not** gitleaks-action, whose license is non-standard), `npm audit`, NuGetAudit (already `low`/`all`), and the license gates. See Pattern 7. |
| OPS-04 | Deploy via Web Deploy with `app_offline.htm`, smoke E2E afterwards, manual approval (amended: no staging; production by `workflow_dispatch`) | `deploy.yml` on windows-2025: manual app_offline, then msdeploy contentPath sync with skips, then smoke with retry, then rollback to a Release asset, then a new Release on success. Dry run (`-whatif`) and HostProbe first. See Patterns 3 and 4. |
| OPS-05 | `web.config`: in-process, HTTPS rewrite, server headers removed, compression, `immutable`/`no-cache`; secrets only on server | The app already does compression and caching. `web.config` adds `<urlCompression doDynamicCompression="false" .../>` (BREACH: no IIS JSON compression) and a URL Rewrite HTTPS rule **only after** the module is proven present. Exclude `logs/**` and `appsettings.Development.json` from publish. A package-content check plus a `gitleaks dir` scan prove no secrets ship. See Pattern 8. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

These come from the root `CLAUDE.md` and `.claude/CLAUDE.md`. The planner must verify compliance.

- **Free only.** No paid licenses, tools or services. The GitHub spending limit stays $0 (D-16). Allowed licenses are MIT, Apache-2.0, BSD and ISC, plus approved exceptions only. gitleaks-action is therefore excluded (its license is "Other"/NOASSERTION, verified via `gh api`).
- **Forbidden packages** (relevant here): axios, SpaProxy, Swashbuckle/NSwag, `coverlet.collector`, `Microsoft.Testing.Extensions.CodeCoverage`, Serilog DB sinks. Nothing in this phase may add them.
- **New dependencies:** purpose, license, maintenance and legitimacy go in RESEARCH.md. **14-day release cool-down.** Owner approval goes to the user (memory: package-approval), so the planner adds a `checkpoint:human-verify` before adopting any new action or tool.
- **Actions pinned by commit SHA.** Dependabot `cooldown` is 14 days. Security tooling is free only: NuGetAudit as error, `npm audit`, license gates, gitleaks. **No paid GitHub Code Security.**
- **CI:** GitHub Actions on ubuntu for build and test, and on Windows for the Web Deploy job. CI uses the SQL 2025 container `mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04`. **No Docker or Testcontainers locally.** Tests pick their backend from `CSPS_TEST_SQL=localdb|container`, set per process only.
- **Shared machine:** ports 5180/5115/7028/5199 locally, never 5173/5023/5099, avoid 49152-65535. Run the preflight before any local dev server, Playwright or full test run. These rules apply to local runs, not CI runners. Never set variables at User or Machine level.
- **LocalDB:** `(localdb)\MSSQLLocalDB`, `CSPS_*` names only. Never touch `BetsLLC_*`. D-04's restore into `CSPS_Legacy_Restore` is an owner-approved exception.
- **`_local/`** holds a production backup. Never commit, upload or deploy it.
- **Hosting:** SmarterASP.NET Basic, with one DB, a 256 MB pool, no scheduler and no staging. Production deploys need manual approval. Never `Database.Migrate()` at startup. Production gets reviewed idempotent scripts.
- **Quality:** TDD. Zero warnings everywhere. Coverage: Domain 100%, Application ≥ 95%, `core/api` 100%, web ≥ 90%. Authorization-matrix tests.
- **Security:** CWE Top 25 drives the review. Strict CSP. No secrets in git.
- **Owner rules:** OR-2 (minimal comments), OR-3 (zod mirrors API validators), OR-4 (no em or en dash in `web/src`, `EmptyValue` icon), OR-5 (per-module services), OR-6 (`web/src` tree). OR-4 applies to the D-17 holding page.
- **Markdown timestamps (user memory):** every created or edited `.md` gets `created:`/`updated:` (frontmatter or the `*Created: ... · Updated: ...*` line). **The PR template is a `.md` file.** Put its timestamps in an HTML comment (`<!-- Created: ... · Updated: ... -->`) so they do not render into every PR body. That is an owner-visible choice, so flag it.
- **Workflow:** `/gsd-plan-phase 3 --tdd`. `/gsd-ui-phase 3` is needed because D-17 adds a public page. Run `/gsd-secure-phase 3` and `/gsd-ui-review 3` before `/gsd-ship 3`.
- **GitHub (memory):** the repo is `loudiamond13/CarmensStitchAndPrintingServices` (public since 2026-10-16; the earlier private repo was `CarmenStitchAndPrintingServices`). PRs always target `main`. Never `gh repo create`.

## Standard Stack

No new NuGet or npm packages are needed. Everything new is a GitHub Action or a pinned CLI binary.

### Core (GitHub Actions, pinned by commit SHA)

Each SHA was resolved with `gh api repos/<r>/commits/<tag>` (the commit SHA, not the annotated-tag SHA). The runtime and license were read from `action.yml` and the repo metadata at that SHA.

| Action | Tag | Commit SHA | Tag date | Runtime | License | Purpose |
|--------|-----|-----------|----------|---------|---------|---------|
| actions/checkout | v7.0.1 | `3d3c42e5aac5ba805825da76410c181273ba90b1` | 2026-07-17 | node24 | MIT | Checkout (`persist-credentials: false`, `fetch-depth: 0` for the docs-only diff) |
| actions/setup-dotnet | v6.0.0 | `a98b56852c35b8e3190ac28c8c2271da59106c68` | 2026-07-16 | node24 | MIT | SDK from `global-json-file: global.json` |
| actions/setup-node | v7.0.0 | `820762786026740c76f36085b0efc47a31fe5020` | 2026-07-14 | node24 | MIT | Node `24.21.0` + npm cache. **Not v7.1.0** (2026-10-08, within the 14-day cool-down). |
| actions/cache | v6.1.0 | `55cc8345863c7cc4c66a329aec7e433d2d1c52a9` | 2026-06-23 | node24 | MIT | NuGet and Playwright browser caches (cache storage is a separate 10 GB per repo, not the 500 MB artifact pool) |
| actions/upload-artifact | v7.0.1 | `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a` | 2026-04-10 | node24 | MIT | Deploy package, failure reports. **Not v7.0.2** (2026-10-07, in cool-down). |
| actions/download-artifact | v8.0.1 | `3e5f45b2cfb9172054b4087a40e8e0b5a5461e7c` | 2026-03-11 | node24 | MIT | Same-run artifact download if needed. **Not v8.0.2** (in cool-down). GHSA-cxww-7g56-2vh6 affects only `>=4.0.0 <4.1.3`. |

[VERIFIED: gh api, commit SHAs and dates above. All repos `archived=false`. `gh api .../security-advisories` returned none for checkout, setup-node, setup-dotnet, cache and upload-artifact.]

The cross-run "which build passed CI" lookup and download in `deploy.yml` use the preinstalled `gh` CLI (`gh run list`, `gh run download`), not another action. The GitHub CLI is 2.102.0 on both ubuntu-24.04 and windows-2025 images [VERIFIED: runner-images readmes fetched via gh api].

### Supporting (CLI tools, pinned binaries verified by SHA-256)

| Tool | Version | License | How it runs | SHA-256 (from the release checksums file) |
|------|---------|---------|-------------|----------------------------------|
| gitleaks | v8.30.1 (2026-03-21) | MIT | Release binary, downloaded and `sha256sum -c` checked in CI. The same pinned zip for the local hook. | linux_x64.tar.gz `551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb`; windows_x64.zip `d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e` |
| actionlint | v1.7.12 (2026-03-30) | MIT | Release binary, checksum-verified. It uses the image's shellcheck 0.9.0 for `run:` scripts. | linux_amd64.tar.gz `8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8`; windows_amd64.zip `6e7241b51e6817ea6a047693d8e6fed13b31819c9a0dd6c5a726e1592d22f6e9` |
| zizmor (via zizmorcore/zizmor-action) | zizmor 1.30.1 (2026-09-09); action v0.6.4 `cc914d7f3750a2d13d75c7f184a1060aa0e9d482` | MIT (both) | A composite action that pulls `ghcr.io/zizmorcore/zizmor:<version>@<digest>`. **Must set** `version: 1.30.1`, `advanced-security: false` (SARIF upload needs GHAS) and `annotations: true`. **Not 1.31.x** (released 2026-10-15). GHSA-f42p-wjw5-97qh affects only `=1.27.0`. | n/a (image digest resolved by the action) |

[VERIFIED: gh api releases, checksums downloaded this session, `gh api repos/... --jq .license`.]

### Runners

| Runner | Use | Facts |
|--------|-----|-------|
| `ubuntu-24.04` (pin it; do not use `-latest`) | All CI gates, package build, weekly run | Image 20261004.327.1: .NET SDK 10.0.401 preinstalled, PowerShell 7.6.6, Docker 28.0.4, shellcheck 0.9.0, jq 1.7, gh 2.102.0, Node 22 default (override with setup-node). [VERIFIED: Ubuntu2404-Readme.md via gh api] |
| `windows-2025` (pin it) | Deploy only | Image 20261004.281.1: `Microsoft.VisualStudio.Component.WebDeploy` installed, PowerShell 7.6.6, Chocolatey 2.7.4. The readme lists the WebDeploy component, not an msdeploy path, so **the first deploy step must assert** `C:\Program Files\IIS\Microsoft Web Deploy V3\msdeploy.exe` exists. [VERIFIED: Windows2025-Readme.md; the path is ASSUMED from the standard install location] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| gitleaks binary | gitleaks/gitleaks-action | Its license is "Other" (not on the allow-list). It needs a license key for orgs. Rejected. |
| zizmor-action | `pipx run zizmor==1.30.1` | The PyPI package was flagged SUS by the legitimacy seam (latest version too new, downloads unknown). The pinned image route avoids PyPI. Either works. |
| In-repo `CiWorkflowTests` only | actionlint/zizmor | The tests cover project rules (pinning, order, permissions). actionlint covers YAML/expression and shell errors, and zizmor covers known workflow attack patterns. Use all three. The tests run even if the owner declines the tools. |
| Release assets for "last good" | Actions artifacts with long retention | Artifacts share the **500 MB** artifact+Packages pool on Free. Release assets have "no limit on the total size of a release, nor bandwidth usage". [CITED: docs.github.com about-releases; billing page] |
| Windows runner + msdeploy | Linux + `dotnet publish /p:WebPublishMethod=MSDeploy` | MSDeploy publishing needs msdeploy.exe (Windows). No free cross-platform route was found. [ASSUMED] |
| step-security/harden-runner | none | The free tier is believed to be public-repo only. Not recommended under free-only. [ASSUMED] |

**Installation:** none (no `npm install` or `dotnet add package`). Binaries are downloaded inside workflow steps and checksum-verified.

## Package Legitimacy Audit

This phase installs **no npm, NuGet or PyPI packages**. New third-party code comes in as GitHub Actions and release binaries. Each still needs the owner's OK (memory: package-approval), so the planner adds a `checkpoint:human-verify` listing them.

| Package / Action | Registry | Age (of the pinned version) | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| actions/checkout v7.0.1 | GitHub | ~90 days | n/a (first-party GitHub) | github.com/actions/checkout | OK (first-party) | Approved pending owner OK |
| actions/setup-dotnet v6.0.0 | GitHub | ~91 days | n/a | github.com/actions/setup-dotnet | OK (first-party) | Approved pending owner OK |
| actions/setup-node v7.0.0 | GitHub | ~93 days | n/a | github.com/actions/setup-node | OK (first-party) | Approved pending owner OK |
| actions/cache v6.1.0 | GitHub | ~114 days | n/a | github.com/actions/cache | OK (first-party) | Approved pending owner OK |
| actions/upload-artifact v7.0.1 | GitHub | ~188 days | n/a | github.com/actions/upload-artifact | OK (first-party) | Approved pending owner OK |
| actions/download-artifact v8.0.1 | GitHub | ~218 days | n/a | github.com/actions/download-artifact | OK (first-party) | Approved pending owner OK |
| gitleaks v8.30.1 | GitHub release | ~208 days | n/a | github.com/gitleaks/gitleaks (MIT) | OK by inspection (not run through the seam: not an npm/PyPI/crates package) | Approved pending owner OK |
| actionlint v1.7.12 | GitHub release | ~199 days | n/a | github.com/rhysd/actionlint (MIT) | OK by inspection | Approved pending owner OK |
| zizmor 1.30.1 (+ zizmor-action v0.6.4) | ghcr.io image / PyPI | 36 days | unknown (seam) | github.com/zizmorcore/zizmor (MIT) | **SUS** (seam, pypi: `too-new`, `unknown-downloads`. The seam judged the *latest* 1.31.1, published today. The pinned 1.30.1 is 36 days old.) | **Flagged.** The planner must add `checkpoint:human-verify` before adopting it. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** zizmor (the planner inserts `checkpoint:human-verify` before the step that adds the zizmor job)

*The seam (`gsd-tools query package-legitimacy check`) covers npm, PyPI and crates only. Actions and binaries were verified via `gh api` (repo, license, archived flag, advisories, release checksums).*

## Architecture Patterns

### System Architecture Diagram

```
 developer push / PR event
        │
        ▼
 ┌──────────────── ci.yml (ubuntu-24.04, one ordered job "gate (<mode>)") ───────────────┐
 │ mode = docs | fast | full   (docs: only .planning/** and *.md changed;               │
 │                              fast: draft PR; full: ready PR, or push to main)        │
 │  0 secret scan (gitleaks) ─ workflow lint (actionlint, zizmor) ─ commit-msg check     │
 │  1 locked restore: dotnet restore --locked-mode, tool restore, npm ci (web, openapi)  │
 │    + npm audit, NuGetAudit (inside restore)                                           │
 │  2 dotnet build (-warnaserror via props) → dotnet format --verify-no-changes          │
 │  3 unit → integration (CSPS_TEST_SQL=container, Testcontainers) → architecture        │
 │  4 web typecheck → lint → prettier → vitest+coverage → openapi-gen check/test          │
 │  5 web build (+budget) → [SQL container + dev secrets] → Playwright → Lighthouse       │
 │  6 coverage gate (pwsh) → licenses + THIRD-PARTY-NOTICES drift (git diff --exit-code) │
 │  7 (push to main only) package: npm build → dotnet publish win-x64 → content check     │
 │    → gitleaks dir → zip → upload-artifact "csps-package-<sha>"                        │
 └───────────────────────────────────────────────┬───────────────────────────────────────┘
                                                 │ check-run "CI / gate (full)" on head SHA
                                                 ▼
 merge-gate script (local, before `gh pr merge --squash`) ── refuses unless: gate(full|docs)
   success on head SHA, no failing/pending checks, PR not BEHIND main, not draft, DoD ticked
                                                 │
 owner presses "Run workflow" (deploy.yml, input: sha, dry_run)
                                                 ▼
 ┌──────────── deploy.yml (windows-2025, workflow_dispatch, ref must be main) ───────────┐
 │ validate sha → find green CI run for sha (gh run list) → gh run download package       │
 │ → find last-good Release "deploy-*" (may be none) → assert msdeploy.exe               │
 │ → [dry_run? msdeploy -whatif → stop]                                                   │
 │ → upload app_offline.htm → sleep → msdeploy sync (skip logs, app_offline) → delete     │
 │   app_offline.htm → smoke (retry ~90 s)                                                │
 │      ├─ pass → gh release create deploy-<utc>-<sha7> package.zip  → success            │
 │      └─ fail → last-good exists? ── yes → redeploy last-good → smoke → FAIL run       │
 │                                  └─ no (first deploy) → leave app_offline up → FAIL    │
 └────────────────────────────────────────────┬──────────────────────────────────────────┘
                                              ▼
                    SmarterASP.NET IIS: ANCM in-process ── Csps.Server ── SQL Server 2025 DB
weekly.yml (cron, main): full engines (all 7 Playwright projects) + audits
Dependabot (server-side): nuget "/", npm "/web" + "/tools/openapi-gen", github-actions "/", cooldown 14
```

### Recommended Project Structure

```
.github/
  workflows/
    ci.yml               # PR + push(main): ordered gate job; package on main
    weekly.yml           # schedule: all Playwright engines + audits on main
    deploy.yml           # workflow_dispatch only: production Web Deploy + smoke + rollback
  dependabot.yml
  CODEOWNERS
  pull_request_template.md
.githooks/
  pre-commit             # gitleaks git --pre-commit --staged (warn if binary missing; block on findings)
.gitleaks.toml           # allowlist for known test fixtures (sample passwords, HostingRecordTests samples)
tools/
  deploy/
    app_offline.htm      # branded, self-contained (inline CSS, no external assets); NOT in web/public
  scripts/
    Install-Gitleaks.ps1 # downloads the pinned zip, verifies SHA-256, sets core.hooksPath (repo-local)
web/scripts/
  merge-gate.mjs (+ .test.ts)   # pure decision over `gh pr view/checks --json` output
  smoke.mjs (+ .test.ts)        # production HTTP smoke, fetch injected for tests
  deploy.mjs (+ .test.ts)       # msdeploy argument builder + orchestration, spawn injected
docs/operations/
  cutover-runbook.md     # D-18 numbered steps
  deploy.md              # deploy, dry run, rollback, first-deploy special case
  branch-rules.md        # D-08 intended rules (ready to enable if the repo is upgraded)
tests/Csps.ArchitectureTests/
  CiWorkflowTests.cs     # text-level assertions over .github/** (pattern of WebConfigTests/HostingRecordTests)
```

Placing the Node tooling under `web/scripts/` follows the existing pattern: `e2e.mjs`, `lighthouse.mjs` and `license-gate.mjs` live there with vitest tests that `vitest.config.ts` already includes (`'scripts/**/*.test.ts'`). The PowerShell-only alternative has no test runner (Pester would be a new dependency). [VERIFIED: web/vitest.config.ts include list]

### Pattern 1: One ordered gate job with a mode

**What:** A single job runs the OPS-02 steps in order. Each heavy step is guarded by `if: steps.mode.outputs.mode == 'full'`. The job name carries the mode: `name: gate (${{ ... }})`. Since a job's name cannot depend on its own steps, compute the mode in a tiny upstream `classify` job.

**Why one job:** On a minutes budget, every extra job repeats checkout, SDK setup, restore and Node setup (about 1-3 minutes each). A single job makes the order literally the step order, which is easy to assert in `CiWorkflowTests`. Wall-clock time doesn't matter here; minutes do (D-14).

**Modes:**
- `docs`: every changed file matches `^\.planning/`, or is `*.md` outside `web/src` and `src`. Runs the fast part only. The fast part includes `HostingRecordTests` (a doc-lint over `.planning/HOSTING-RECORD.md`) and the Vitest `no-long-dash` test, so doc edits still meet their own tests.
- `fast`: a draft PR (`github.event.pull_request.draft == true`).
- `full`: a ready PR, or a push to `main`.

**Triggers:** `pull_request: { branches: [main], types: [opened, synchronize, reopened, ready_for_review] }`, `push: { branches: [main] }`, `workflow_dispatch`. **No workflow-level `paths-ignore`.** A skipped workflow produces *no* check, and the merge gate would then see nothing. Classify inside the job instead.

**Concurrency:** `group: ci-${{ github.event.pull_request.number || github.sha }}`, `cancel-in-progress: ${{ github.event_name == 'pull_request' }}`. Pushes to main are never cancelled, because each one produces a package.

**Every job:** set `timeout-minutes` (gate 60, classify 5) so a hang cannot burn the month's minutes.

### Pattern 2: CI overrides for the LocalDB-bound harnesses (needs code changes, TDD)

`playwright.config.ts` lines 92-97 hard-code the database [VERIFIED: web/playwright.config.ts:92-97]:

```
      ASPNETCORE_ENVIRONMENT: 'Testing',
      Csps__Testing__LoadUserSecrets: 'true',
      App__PublicBaseUrl: origin,
      Email__Dispatcher__SweepInterval: '00:00:01',
      ConnectionStrings__Csps: 'Server=(localdb)\\MSSQLLocalDB;Database=CSPS_E2E;Integrated Security=true',
```

Playwright merges `webServer.env` over `process.env`, so a CI job-level variable cannot override that literal [ASSUMED: Playwright merge order]. The seed step in `e2e.mjs` passes `['run', '--project', 'tools/Csps.DevSeed', '--', '--database', 'CSPS_E2E']`. `DevSeedOptions` accepts `--connection` but refuses `--database` together with `--connection` [VERIFIED: src/Csps.Infrastructure/Seeding/DevSeedOptions.cs:15-20: `"Usage: dotnet run --project tools/Csps.DevSeed -- [--reset] [--database CSPS_Dev|CSPS_E2E] [--connection <connection string>]"`].

**Recommended change:** one per-process variable, `CSPS_E2E_CONNECTION`, read by both:
- `playwright.config.ts`: `ConnectionStrings__Csps: process.env.CSPS_E2E_CONNECTION ?? '<the LocalDB literal>'`
- `e2e.mjs` `planSteps`: when it is set, pass `--connection <value>` instead of `--database CSPS_E2E`. Unit-test this in `e2e.test.ts`.

The guard already accepts the container. Its comment says the allowed hosts are "(`127.0.0.1,<port>` or `localhost,<port>`)" and the code holds `private static readonly string[] ContainerHosts = ["127.0.0.1", "localhost"];` [VERIFIED: src/Csps.Infrastructure/Seeding/DevSeedTargetGuard.cs]. The database name must still be `CSPS_E2E` or `CSPS_Dev`.

**CI job setup before E2E and Lighthouse:**
1. Start SQL: `docker run -d --name csps-sql -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD=$PW -p 127.0.0.1:1433:1433 mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04`. Generate `$PW` at runtime (`openssl rand` plus a complexity suffix), mask it (`::add-mask::`), never commit it, then poll until it is ready. Use the same image as `SqlServerInstance.ContainerImage = "mcr.microsoft.com/mssql/server:2025-CU9-ubuntu-24.04"` [VERIFIED: tests/Csps.Testing/SqlServerInstance.cs:22]. MCR also lists `2025-CU9-GDR1-ubuntu-24.04` (a security GDR); whether to move is an open question.
2. Set `CSPS_E2E_CONNECTION=Server=127.0.0.1,1433;Database=CSPS_E2E;User Id=sa;Password=$PW;TrustServerCertificate=true` for the E2E step only. Set `ConnectionStrings__Csps=...Database=CSPS_Dev...` for the Lighthouse step, then run `dotnet run --project tools/Csps.DevSeed -- --connection "<CSPS_Dev on container>"` first, because `/health` checks the database.
3. Run `pwsh -NoProfile -File tools/scripts/Initialize-DevSecrets.ps1`. It creates `Jwt:SigningKey`, `Auth:CodeMacKey` and the Data Protection PFX in the runner's user-secrets (cross-platform .NET APIs; the script says it is compatible with PowerShell 7). The E2E host (`Csps__Testing__LoadUserSecrets`) and the Lighthouse host (Development) read them.
4. Run `dotnet dev-certs https`. The hosts listen on `https://localhost:5199`, and a fresh Linux runner may have no dev certificate [ASSUMED].
5. **Lighthouse runs the host as Development, which validates `Smtp:*` at start** (`EmailRegistration`: "Missing mailbox settings stop the host at start"). Give the Lighthouse step dummy, non-secret `Smtp__Host/Port/Security/UserName/Password` env values. No mail is queued during a Lighthouse run.
6. Run `npx playwright install --with-deps chromium` (PRs). The weekly run adds firefox and webkit.
7. Set `CSPS_TEST_SQL=container` for the two integration test projects only. Testcontainers starts its own container per test process.

### Pattern 3: Deploy package (push to main)

- First `npm --prefix web run build` (it writes `src/Csps.Server/wwwroot`, which is git-ignored), then `dotnet publish src/Csps.Server -c Release -r win-x64 --self-contained false -o artifacts/publish`.
- **Declare `<RuntimeIdentifiers>win-x64</RuntimeIdentifiers>`** in the four shipping projects (or the `src` block of `Directory.Build.props`) and commit the regenerated lock files. Observed this session: a `-r win-x64` publish added a `"net10.0/win-x64"` section to all four `src/*/packages.lock.json` (36 new lines in Infrastructure and Server). With `RestoreLockedMode` true in CI (`<RestoreLockedMode Condition="'$(CI)' == 'true'">true</RestoreLockedMode>`, `Directory.Build.props:18`), the publish would fail. The local changes were reverted. After the lock files change, re-run `New-ThirdPartyNotices.ps1` (the graph may gain runtime-specific packages).
- **Exclude dev output from publish** in `Csps.Server.csproj`: `logs/**` (observed: 14 dev log files, 107 MB, copied into the publish folder) and `appsettings.Development.json` (`CopyToPublishDirectory="Never"`).
- Size: portable publish was 202 MB including a 66 MB `runtimes/` folder for 8 RIDs. `win-x64` was 35 MB without logs [VERIFIED: local publish into the scratchpad this session].
- **Package content check (CI step, fail closed):**
  - no `logs/` directory
  - no `app_offline.htm` at the root
  - no `appsettings.*.json` other than `appsettings.json`
  - no `*.pfx`, `secrets.json` or `.env*`
  - `web.config` present with `hostingModel="inprocess"`
  - `wwwroot/index.html` present
  - then `gitleaks dir artifacts/publish`
- Upload as `csps-package-<sha>` with `retention-days: 14` [ASSUMED: retention long enough to choose a recent build; tune against the 500 MB pool].

### Pattern 4: Production deploy with manual app_offline, smoke and rollback

**Why manual app_offline:** msdeploy's `-enableRule:AppOffline` writes `App_Offline.htm`, and a 2021 report says ANCM only recognised lowercase `app_offline.htm` (still true on .NET Core 3.1 at the time) [CITED: blog.miniasp.com/post/2021/06/29/...; LOW, verify]. It also cannot carry the D-12 branded page. Microsoft's guidance is that when `app_offline.htm` is at the app root, "the ASP.NET Core Module gracefully shuts down the app and serves the `app_offline.htm` file during the deployment" [CITED: learn.microsoft.com/aspnet/core/host-and-deploy/iis "Locked deployment files"].

**Sequence (Node orchestrator `web/scripts/deploy.mjs`, spawn injected for tests):**
1. Validate the `sha` input against `^[0-9a-f]{40}$` (pass it via `env:`, never `${{ }}` inside `run:`). Require `github.ref == 'refs/heads/main'`.
2. `gh run list --workflow ci.yml --branch main --commit <sha> --json databaseId,conclusion,status` and require `conclusion == success`. Then `gh run download <id> -n csps-package-<sha>`.
3. Last good: `gh release list` filtered on the `deploy-` prefix, newest first, then `gh release download`. There may be none on the first deploy.
4. `dry_run` input → `msdeploy -verb:sync ... -whatif`. This is read-only and proves credentials, port 8172 reach and the certificate. Stop there.
5. Put the site offline: `msdeploy -verb:sync -source:contentPath=<repo>\tools\deploy\app_offline.htm -dest:contentPath=<site>/app_offline.htm,<auth>`. Wait about 5 s for ANCM to shut the app down.
6. Sync: `-verb:sync -source:contentPath=<package dir> -dest:contentPath=<site>,<auth> -skip:objectName=dirPath,absolutePath=\\logs$ -skip:objectName=filePath,absolutePath=\\app_offline\.htm$ -retryAttempts:10 -retryInterval:3000`. **No DoNotDeleteRule**, so stale files are removed.
7. Back online: `-verb:delete -dest:contentPath=<site>/app_offline.htm,<auth>`.
8. Smoke with retry and backoff, up to about 90 s, because the cold start happens after the delete.
9. Pass: `gh release create deploy-<yyyyMMdd-HHmm>-<sha7> package.zip --target <sha> --latest=false` (the job needs `contents: write`).
10. Fail with a last good package: repeat steps 5-8 with it, then exit 1. Fail without one (first deploy): repeat step 5 (leave the branded offline page up), exit 1, and point the job summary at the D-05 legacy rollback kit.

`<auth>` is `computerName="https://<server>:8172/msdeploy.axd?site=<site>",userName=<u>,password=<p>,authType=Basic,includeAcls=False`. That form appears in another shared host's documented command [CITED: help.monsterasp.net "how to deploy website content from command line"]. The exact SmarterASP.NET server name and format come from the control panel's Web Deploy screen (D-18 step 5) [ASSUMED].

Skip, retry, whatif and allowUntrusted syntax: [CITED: learn.microsoft.com Web Deploy Operation Settings (dd569089)].

**Workflow guards:**
- `on: workflow_dispatch` only (inputs `sha`, `dry_run`, and optionally `package: csps|hostprobe`).
- `concurrency: { group: deploy-production, cancel-in-progress: false }`: never cancel a running deploy.
- `permissions: { contents: write, actions: read }` on the deploy job only.
- `timeout-minutes: 30`.
- Secrets: `WEBDEPLOY_SERVER`, `WEBDEPLOY_SITE`, `WEBDEPLOY_USERNAME`, `WEBDEPLOY_PASSWORD`. These are repository secrets, because environment secrets are "only available in public repositories" on Free [CITED: docs.github.com deployments-and-environments].

**msdeploy argument quoting:** build the full command line in a pure, unit-tested function and spawn with `windowsVerbatimArguments: true`. msdeploy parses its own `-dest:provider=...,key=value` syntax, and PowerShell and Node default quoting are a known source of breakage. Ask the owner to choose a Web Deploy password **without** `,`, `"`, `'` or `;`, because those break provider-setting parsing [ASSUMED].

### Pattern 5: Merge gate (D-08), `web/scripts/merge-gate.mjs`

The input is `gh pr view <n> --json number,isDraft,headRefOid,mergeStateStatus,body,baseRefName,statusCheckRollup` plus `gh pr checks <n> --json name,state,bucket,workflow`. `bucket` is one of `pass|fail|pending|skipping|cancel` [VERIFIED: `gh pr checks --help` this session].

**Allow only if all of these hold:**
- `baseRefName == main`
- not a draft
- `mergeStateStatus` is not `BEHIND` (so the squash commit's tree equals what CI tested; this also lets the main-branch run skip re-running the heavy suite, see Pattern 9)
- a check named `gate (full)` or `gate (docs)` with `bucket == pass` exists for `headRefOid`
- no check has `fail`, `pending` or `cancel`
- every DoD checkbox in the body is ticked (`- [x]`). N/A items must be written as ticked, with "N/A" and a reason.

`--required` returns nothing useful without branch protection. Don't rely on it.

**Wrapper:** `tools/scripts/Merge-PullRequest.ps1 -Pr <n>` runs the gate, then `gh pr merge <n> --squash --delete-branch`. CLAUDE.md conventions should say "never `gh pr merge` directly". An optional Claude Code PreToolUse hook blocking a raw `gh pr merge` is a settings change only the owner can approve.

**The `/gsd-ship` `[ci skip]` conflict (must resolve):** gsd-ship's `track_shipping` step commits and pushes a ship-note with `[ci skip]` in the message onto the PR branch [VERIFIED: ~/.claude/gsd-core/workflows/ship.md, the `track_shipping` step]. After that, the PR head SHA has **zero** checks, so a correct gate refuses. Recommended explicit rule, unit-tested and owner-confirmed: if the head commit carries a skip token **and** changes only `.planning/**`, the gate evaluates its first parent instead, and that parent must meet every rule above. Otherwise, push one empty CI-triggering commit after the ship-note.

**D-16 (minutes exhausted):** `--local-gate` mode requires a PR body section "Local full gate" listing the five D-16 commands, each marked exit 0. It prints a loud warning.

### Pattern 6: Free repo settings and intended rules

- **Can be set now** (owner runs these, or Claude runs them with explicit owner approval, since they are repo configuration):
  - `gh api -X PATCH repos/loudiamond13/CarmensStitchAndPrintingServices -F allow_merge_commit=false -F allow_rebase_merge=false -F allow_squash_merge=true -F delete_branch_on_merge=true`. Disabling merge commits gives linear history without branch rules. Current values read this session: `"allow_merge_commit":true,"allow_rebase_merge":true,"allow_squash_merge":true,"delete_branch_on_merge":false` [VERIFIED: gh api].
  - Actions permissions currently read `{"enabled":true,"allowed_actions":"all","sha_pinning_required":false}` and `{"default_workflow_permissions":"read","can_approve_pull_request_reviews":false}` [VERIFIED: gh api]. Set `sha_pinning_required=true` so GitHub itself refuses unpinned actions, and consider `allowed_actions=selected` (GitHub-owned plus `zizmorcore/zizmor-action`). Whether Free private repos enforce these is [ASSUMED]. Verify by pushing a test workflow with a tag ref and seeing it refused.
- **Written down only** (`docs/operations/branch-rules.md` plus a ruleset JSON ready for `gh api`): required check `gate (full)`, linear history, 0 approvals, CODEOWNERS `@loudiamond13`, no bypass.

### Pattern 7: Dependabot

```yaml
# .github/dependabot.yml (sketch; verify keys at execution)
version: 2
updates:
  - package-ecosystem: "nuget"
    directory: "/"
    schedule: { interval: "monthly" }
    cooldown: { default-days: 14 }
    groups: { nuget: { patterns: ["*"] } }
    commit-message: { prefix: "build", include: "scope" }
  - package-ecosystem: "npm"
    directories: ["/web", "/tools/openapi-gen"]
    schedule: { interval: "monthly" }
    cooldown: { default-days: 14 }
    groups: { npm: { patterns: ["*"] } }
    commit-message: { prefix: "build", include: "scope" }
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "monthly" }
    cooldown: { default-days: 14 }
    groups: { actions: { patterns: ["*"] } }
    commit-message: { prefix: "ci", include: "scope" }
```

- Cooldown supports `default-days` for nuget, npm and github-actions (semver-*-days for nuget and npm only). "The `cooldown` option is only available for *version* updates, not *security* updates" [CITED: docs.github.com dependabot-options-reference]. `directories` supports multiple manifests [CITED: same]. The YAML key strings `nuget`, `npm` and `github-actions` are [ASSUMED] (standard).
- Use a monthly schedule and grouping to save minutes. Each Dependabot PR runs the full gate. Security updates still arrive immediately.
- **Expected and by design:** a Dependabot NuGet or npm bump **fails CI** until `docs/dependencies.json` is updated. `DependencyRegistryTests.PinnedVersionThatDiffersFromTheRegistryFails` enforces it, and the registry's `Kinds` are `["nuget", "tool", NpmKind, DataKind]` [VERIFIED: tests/Csps.ArchitectureTests/DependencyRegistry.cs:25]. That matches the owner's per-version approval rule. Workflow: Dependabot PR, then owner approval, then Claude updates the registry on that branch.
- **Unknown:** whether Dependabot regenerates `packages.lock.json` with central package management [ASSUMED: unverified]. If not, locked restore fails on its PRs. Fallback: Claude runs `dotnet restore --force-evaluate` on the branch and pushes.

### Pattern 8: `web.config` for OPS-05

The current file is already correct for in-process hosting, the Server header, X-Powered-By and `requestLimits` [VERIFIED: src/Csps.Server/web.config:9-19, which is preserved byte for byte by `dotnet publish`, observed this session]. Add:

```xml
<!-- the app compresses its own html/css/js/svg and never JSON (BREACH); IIS must not compress again -->
<urlCompression doStaticCompression="false" doDynamicCompression="false" />
```

`urlCompression` "enables or disables dynamic content compression at the site, application, or folder level", and `doDynamicCompression` defaults to `true` on IIS 7.5+ [CITED: learn.microsoft.com/iis/configuration/system.webserver/urlcompression]. **Do not** add `<httpCompression>` (usually server-level only on shared hosts, which gives 500.19) [ASSUMED].

**Caching is app-side and already done:** `ImmutableCacheControl = "public, max-age=31536000, immutable"`, `RevalidateCacheControl = "no-cache"`, `CompressibleTypes = ["text/html", "text/css", "text/javascript", "application/javascript", "image/svg+xml"]` [VERIFIED: src/Csps.Server/Composition/SpaRegistration.cs:45-52]. ANCM handles `path="*"`, so IIS `<staticContent><clientCache>` never applies. Don't add it.

**HTTPS rewrite:** the app already redirects (`AddHttpsRedirection(options => options.HttpsPort = 443)`, outside Development/Testing) and sends HSTS over HTTPS. A web.config `<rewrite>` rule needs the IIS URL Rewrite module. **If the module is absent, every request returns 500.19.** Nothing confirms SmarterASP.NET has it [ASSUMED]. Prove it during the HostProbe step: deploy the probe with a web.config that includes the HTTP-to-HTTPS rule and check it answers, before adding the rule to CSPS. If it is absent, record that OPS-05's "HTTPS rewrite" is met by the in-app redirect plus HSTS, and get owner sign-off.

`WebConfigTests` (tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs) asserts `arguments` is `@".\Csps.Server.dll"`. A self-contained fallback (if the host runtime is too old) changes `processPath` to `.\Csps.Server.exe`, so update the test together with it.

### Pattern 9: Main-branch run without double cost

D-11 needs "a merge to `main` runs CI, then builds ... the deploy package". If the merge gate refuses `BEHIND` PRs, the squash commit's tree equals the PR head tree that already passed `gate (full)`.

The main run can check `git rev-parse HEAD^{tree}` against the tree of the merged PR's head. Look it up with `gh api repos/{o}/{r}/commits/{sha}/pulls`, then find that head's green run. If the trees match, run the fast part plus the package only; if not, run full. This roughly halves the heavy minutes per merge [ASSUMED estimate]. It is the planner's call, because it adds logic that needs its own tests. The simpler alternative is a full run on main.

### Anti-Patterns to Avoid
- **Workflow-level `paths-ignore` on the gate.** No check means the gate sees nothing, and a buggy gate passes.
- **`pull_request_target`**, or interpolating `${{ github.event.* }}` or `inputs.*` inside `run:` (template injection, CWE-77). Pass them through `env:`.
- **`actions/checkout` without `persist-credentials: false`** (the token is left in `.git/config` for later steps, the zizmor "artipacked" finding).
- **Putting `app_offline.htm` in `web/public/`.** It would ship inside every package and take the site offline on deploy. Keep it in `tools/deploy/` and assert its absence in the package check.
- **Auto-retrying Playwright on CI** (`retries` is 0 on purpose). Fix flakes, don't mask them.
- **`-allowUntrusted` by default.** First try without it in the dry run. See Pitfall 6.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Secret detection | regex scanner | gitleaks 8.30.1 binary (`git`, `dir` modes, `.gitleaks.toml`) | Hundreds of tuned rules, entropy checks, redaction |
| Workflow YAML and shell errors | custom YAML parser | actionlint 1.7.12 (+ shellcheck on the image) | Expression type-checking, runner-label and shell checks |
| Workflow security patterns | ad-hoc review | zizmor 1.30.1 | Template injection, artipacked, excessive permissions, unpinned uses |
| Dependency update PRs | scripts | Dependabot | Free, server-side, updates SHA pins with version comments |
| Coverage thresholds | new gate | `tools/scripts/Invoke-CoverageGate.ps1` (unchanged; "Phase 3 calls this script unchanged") | Already fail-closed on empty reports |
| License gate and notices | new gate | `New-ThirdPartyNotices.ps1`, `npm run license:check`, `notices:check` | Already owner-approved policy |
| Deploy transport | FTP scripts, robocopy | msdeploy contentPath sync | Deletes stale files, retry, skip rules, `-whatif` |
| Artifact transfer across runs | custom storage | `gh run download` and `gh release` | Preinstalled, uses the job token |

**Key insight:** the repo already has a gate for nearly every OPS-02 step. Each new hand-written piece (merge gate, smoke, deploy orchestrator) should be a pure decision or argument builder with injected I/O, tested with vitest exactly like `e2e.mjs` / `e2e.test.ts`.

## Runtime State Inventory

Phase 3 retires the legacy site and database (a migration with an external effect), so runtime state matters:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | The legacy DB `db_…_csptailoringdb` (16 MB, compat 150) on the host. The new SQL Server 2025 DB starts empty. `dbo.DataProtectionKeys` is created by migrations and filled on first start. | D-04 backup and receipt, then the D-03 delete and create, then the idempotent script. **Not a code edit.** These are runbook steps done by the owner. |
| Live service config | Site settings in the SmarterASP.NET control panel: app-pool env vars, the .NET version, the SSL certificate (record: Let's Encrypt, expiry observed 2026-10-13, renewal was in doubt), the Web Deploy user. None of it is in git. | Runbook steps 4 and 5. Re-check the SSL certificate status before the cutover (HTTPS smoke depends on it). |
| OS-registered state | None in the repo. On the host, the IIS app pool belongs to the site; changing env vars recycles it. | None (verified: nothing registered by CSPS). |
| Secrets / env vars | Host app-pool vars to create: `ConnectionStrings__Csps`, `Jwt__SigningKey`, `Auth__CodeMacKey`, `DataProtection__CertificateBase64`, `DataProtection__CertificatePassword`, `Smtp__Host/Port/Security/UserName/Password`, `App__PublicBaseUrl`, `AllowedHosts`. GitHub repo secrets: `WEBDEPLOY_SERVER/SITE/USERNAME/PASSWORD`. | Create them (D-18). Code reads them under these names already. The section names were verified by grep (`"Auth"`, `"App"`, `"DataProtection"`, `"Jwt"`, `"Email"`, `"Smtp"`). Confirm the exact keys from the options classes when writing the runbook. |
| Build artifacts | `src/Csps.Server/logs/` (dev logs, 107 MB) gets copied into publish output today. `src/Csps.Server/wwwroot/` is build output. | Code edit: publish exclusion plus the package-content check. |

**Canonical question answered:** after every file is updated, the host still holds:
- the legacy files (downloaded first for D-05; msdeploy sync then deletes them)
- the legacy DB (deleted at D-18 step 3, after the receipt)
- the old web.config (replaced by the sync)
- the SSL binding (unchanged)

## Common Pitfalls

### Pitfall 1: Dev logs and Development settings ship in the package
**What goes wrong:** `dotnet publish` copies `src/Csps.Server/logs/*.json` (observed: 107 MB, 14 files) and `appsettings.Development.json` into the output.
**Why it happens:** JSON files under a Web SDK project are Content by default, and `logs/` is only git-ignored, not excluded from publish.
**How to avoid:** Use `<Content Remove="logs\**" />` (and `None`), and set `CopyToPublishDirectory=Never` on `appsettings.Development.json`. Back it up with the CI package-content check and `gitleaks dir`.
**Warning signs:** a package zip much bigger than about 15 MB, or a `logs` entry in the artifact.

### Pitfall 2: A RID-specific publish breaks the locked restore
**What goes wrong:** `-r win-x64` adds a `net10.0/win-x64` lock section, and CI's `RestoreLockedMode` fails (observed locally as lock-file diffs).
**How to avoid:** Declare `<RuntimeIdentifiers>win-x64</RuntimeIdentifiers>` in the shipping projects, commit the lock files, and re-run the license and notices gates.

### Pitfall 3: Windows-only assumptions surface on the first ubuntu run
**What goes wrong:**
- PowerShell scripts pass `'tests\Csps.Domain.UnitTests'` to native `dotnet` (`Invoke-CoverageGate.ps1`), and `Join-Path ... 'artifacts\coverage'` [VERIFIED: read]. PowerShell 7 on Linux may normalise provider paths but **not** arguments passed to native commands [ASSUMED].
- Case-sensitive file system: imports whose case is wrong.
- WebKit on Linux differs from WebKit on Windows (the `@auth-cookies` SameSite note).
- `processIsAlive` uses `ps`.
- Time zones and ICU (fine on Linux).

**How to avoid:** Plan a Wave 0 "first CI run on the phase branch" task with a fix-up buffer, and switch path literals to `Join-Path 'tests' 'Csps.Domain.UnitTests'` where they are passed to `dotnet`. Run the workflow on the Phase 3 PR itself: `pull_request` workflows run from the PR's merge ref, so the new `ci.yml` gates its own PR.

### Pitfall 4: The ship-note `[ci skip]` commit leaves the head with no checks
See Pattern 5. Without the planning-only parent rule, every `/gsd-ship` PR blocks at merge, or a weak gate passes with zero checks.

### Pitfall 5: The first deploy has no rollback target
**What goes wrong:** D-13 automatic rollback needs a "last good" package. The first CSPS deploy has none, and the legacy app is not a CSPS package.
**How to avoid:**
- Before the first CSPS deploy, run the HostProbe step and the `-whatif` dry run. They prove the runtime patch (otherwise switch to self-contained first), in-process hosting, URL Rewrite, Web Deploy auth and the certificate.
- On a smoke failure with no release, re-upload `app_offline.htm` (branded page) and fail.
- The runbook's fallback is the D-05 kit.

### Pitfall 6: The Web Deploy certificate is not trusted
**What goes wrong:** SmarterASP.NET's own KB says "If you get ERROR_CERTIFICATE_VALIDATION_FAILED ... add `<AllowUntrustedCertificate>true</AllowUntrustedCertificate>`" [CITED: smarterasp.net/support/kb/a2135, 2021].
**Why it matters:** `-allowUntrusted` sends Basic-auth credentials over a TLS channel that is not verified (CWE-295).
**How to avoid:**
- Try the dry run without it first.
- If it is needed, add a compensating pre-check: open TLS to `<server>:8172` with .NET `SslStream` (PowerShell on the runner) and compare the leaf certificate's SHA-256 thumbprint with a pinned value in a repo secret `WEBDEPLOY_CERT_SHA256`. Abort on a mismatch, and only then pass `-allowUntrusted`.
- Record it as an accepted risk with owner sign-off.

### Pitfall 7: `app_offline.htm` constraints
**What goes wrong:**
- While it is present, ANCM answers **every** path with it, so it cannot load `/assets/*` CSS, fonts or images.
- It is served outside the app's middleware (no CSP header), but it must still be self-contained: inline CSS, inline SVG, system font stack.
- The name must be lowercase.
- A failed deploy that never deletes it leaves the site "updating" forever.

**How to avoid:**
- Keep the file small and self-contained.
- Have the orchestrator delete it in a `finally` on the success path. The rollback path re-syncs and deletes.
- Add a manual escape hatch to `deploy.md`: `msdeploy -verb:delete` via `workflow_dispatch` input `action: online`.

### Pitfall 8: Smoke runs against a cold start
After the delete, the first request starts the app (Data Protection key load, EF model build). Give `/health` a retry loop of about 90 s with backoff before declaring failure. The `/health` checks are `"database"` and `"time-zone"` plus `"self"`, with a 3-second per-check timeout [VERIFIED: src/Csps.Infrastructure/DependencyInjection.cs:29-39 (`DatabaseHealthCheckName = "database"`, `TimeZoneHealthCheckName = "time-zone"`, `HealthCheckTimeout = TimeSpan.FromSeconds(3)`); Program.cs `.AddCheck("self", ...)`]. A healthy time-zone check partly proves Asia/Manila resolves on the host.

### Pitfall 9: The minutes budget
Free private repos get 2,000 minutes a month, and usage beyond the quota "is blocked once you use up your quota" without a payment method [CITED: docs.github.com billing github-actions]. Windows minutes cost more than Linux; the docs give per-minute rates of $0.010 vs $0.006. Whether included minutes are counted at a 2x rate for Windows is not stated [ASSUMED: about 2x].

| Workload (estimate) | Minutes each | Per month | Total |
|---------------------|-------------|-----------|-------|
| Ready-PR full gate | ~35 | 25 | 875 |
| Draft/fast pushes | ~10 | 20 | 200 |
| Main merges (fast + package, Pattern 9) | ~12 | 15 | 180 |
| Weekly all engines | ~50 | 4 | 200 |
| Dependabot grouped PRs | ~35 | 3 | 105 |
| Deploys (windows, about 2x) | ~20 | 8 | 160 |
| **Total** | | | **~1,720** |

[ASSUMED: every duration is a guess. Measure in week 1 using the run-time data in the Actions tab.]

Mitigations: open PRs as drafts while iterating, use `cancel-in-progress`, set `timeout-minutes`, keep Dependabot monthly with groups, and keep Playwright to chromium plus a phone viewport. A standard private-repo Linux runner has 2 vCPUs, so Playwright runs 1 worker by default [ASSUMED].

### Pitfall 10: The Lighthouse score varies on CI
Lighthouse's simulated throttling is mostly independent of hardware, but TBT and the CPU benchmark vary on shared 2-vCPU runners. The in-house assert fails on any category below 0.95, LCP ≥ 2000 ms, CLS ≥ 0.05 or TBT ≥ 200 ms. Watch the first runs. If it flakes, have the script take the median of 3 runs. That changes `lighthouse.mjs`, so it needs tests and owner awareness. Don't lower the thresholds.

### Pitfall 11: gitleaks finds false positives in existing history
Test fixtures and samples include `HostingRecordTests` detector samples (`"Server=x;Password = hunter2"`, `"PWD=hunter2"`, `"AccountKey=abc123"`, `"-----BEGIN PRIVATE KEY-----"`), the E2E test passwords and the dev-secret scripts. Run a full-history scan once (Wave 0) and commit a narrow `.gitleaks.toml` allowlist by path or rule. Never use a blanket baseline.

### Pitfall 12: Host settings that may be truncated or rejected
- The base64 PFX for the RSA-3072 Data Protection certificate is several KB. The control panel's env-var field may limit length [ASSUMED]. The app refuses to start on a bad PFX, which is fail-closed, and the smoke catches it.
- SqlClient 6 defaults to `Encrypt=Mandatory`, so the host connection string may need `TrustServerCertificate=True` or the host's server name. The `/health` database check surfaces this.
- `AllowedHosts` is `"*"` in the committed `appsettings.json`. Production must set the real host names (www and apex as needed).

## Code Examples

### ci.yml step order (skeleton; SHAs from the Standard Stack table)

```yaml
# Source: this research (pattern), SHAs verified via gh api
name: CI
on:
  pull_request: { branches: [main], types: [opened, synchronize, reopened, ready_for_review] }
  push: { branches: [main] }
  workflow_dispatch:
permissions: {}
concurrency:
  group: ci-${{ github.event.pull_request.number || github.sha }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}
jobs:
  classify:            # outputs mode = docs | fast | full
    runs-on: ubuntu-24.04
    timeout-minutes: 5
    permissions: { contents: read }
    # ...git diff --name-only base...head; draft flag via env, never inline ${{ }} in run:
  gate:
    needs: classify
    name: gate (${{ needs.classify.outputs.mode }})
    runs-on: ubuntu-24.04
    timeout-minutes: 60
    permissions: { contents: read }
    env: { DOTNET_NOLOGO: "true", DOTNET_CLI_TELEMETRY_OPTOUT: "true" }
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with: { persist-credentials: false, fetch-depth: 0 }
      - uses: actions/setup-dotnet@a98b56852c35b8e3190ac28c8c2271da59106c68 # v6.0.0
        with: { global-json-file: global.json }
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { node-version: "24.21.0", cache: npm, cache-dependency-path: "web/package-lock.json\ntools/openapi-gen/package-lock.json" }
      # 0 gitleaks (sha256 verified) | actionlint | commit-message check
      # 1 dotnet restore Csps.slnx --locked-mode ; dotnet tool restore ; npm ci --prefix web ; npm ci --prefix tools/openapi-gen ; npm audit --prefix web --audit-level=low
      # 2 dotnet build Csps.slnx --no-restore -tl:off ; dotnet format Csps.slnx --verify-no-changes --no-restore
      # 3 dotnet test --project tests/Csps.Domain.UnitTests --no-build ; ...Application.UnitTests
      #   [full] CSPS_TEST_SQL=container: Infrastructure.IntegrationTests, Server.IntegrationTests
      #   dotnet test --project tests/Csps.ArchitectureTests --no-build
      # 4 npm --prefix web run typecheck | lint | format:check | test:coverage ; npm --prefix tools/openapi-gen run check ; test
      # 5 [full] npm --prefix web run build ; build:budget ; SQL container ; Initialize-DevSecrets.ps1 ; dev-certs
      #   npm --prefix web run e2e -- --project chromium --project pixel ; npm --prefix web run lighthouse
      # 6 [full] pwsh tools/scripts/Invoke-CoverageGate.ps1 ; pwsh tools/scripts/New-ThirdPartyNotices.ps1 ;
      #   git diff --exit-code THIRD-PARTY-NOTICES.md ; npm --prefix web run license:check ; notices:check
      # 7 [push main] package + content check + gitleaks dir + upload-artifact (retention-days: 14)
  zizmor:              # optional separate job (Docker image); permissions: { contents: read }
```

The web steps in 4 and 5 must cover `verify.mjs`'s `STEPS` [VERIFIED: web/scripts/verify.mjs:11-20]: `'typecheck', 'lint', 'format:check', 'test:coverage', 'build', 'build:budget', 'license:check', 'notices:check'`. `CiWorkflowTests` should assert that every entry appears in the workflow in that relative order. NuGetAudit already fails restore at any severity: `<NuGetAudit>true</NuGetAudit>`, `<NuGetAuditMode>all</NuGetAuditMode>`, `<NuGetAuditLevel>low</NuGetAuditLevel>` with warnings as errors [VERIFIED: Directory.Build.props:14-16]. `npm audit --audit-level=low` returned "found 0 vulnerabilities" for both `web` and `tools/openapi-gen` today [VERIFIED: ran this session].

### Merge-gate decision core (sketch)

```js
// web/scripts/merge-gate.mjs (pure; gh output is injected)
export function decide({ pr, checks, headCommit }) {
  const reasons = [];
  if (pr.baseRefName !== 'main') reasons.push('The PR does not target main.');
  if (pr.isDraft) reasons.push('The PR is a draft.');
  if (pr.mergeStateStatus === 'BEHIND') reasons.push('The branch is behind main. Update it first.');
  const gate = checks.find((c) => /^gate \((full|docs)\)$/.test(c.name));
  if (gate?.bucket !== 'pass') reasons.push('No green "gate (full)" or "gate (docs)" check on the head commit.');
  for (const c of checks) if (['fail', 'pending', 'cancel'].includes(c.bucket)) reasons.push(`Check "${c.name}" is ${c.bucket}.`);
  if (/- \[ \]/.test(pr.body ?? '')) reasons.push('A Definition of Done item is not ticked.');
  return { allowed: reasons.length === 0, reasons };
}
```

### Smoke checks (production, read-only; `web/scripts/smoke.mjs`)

| Check | Request | Expect |
|-------|---------|--------|
| Health | `GET https://<host>/health` | 200, `application/json`, `Cache-Control: no-store`, `status` Healthy, checks `self`, `database`, `time-zone` all Healthy |
| Unknown API | `GET /api/v1/__smoke-missing` | 404, `application/problem+json`, has `traceId`, not an IIS HTML page |
| Default deny through IIS | `GET /api/v1/site-settings` (anonymous) | 401 ProblemDetails |
| Missing file | `GET /missing-smoke.js` | 404 ProblemDetails |
| HTTPS redirect | `GET http://<host>/` (no redirect follow) | 301/307/308 to `https://` |
| HSTS and CSP | `GET https://<host>/` | `Strict-Transport-Security` present; CSP has no `unsafe-eval`; `script-src 'self'` |
| Server headers | any | no `Server`, no `X-Powered-By` |
| Shell caching | `GET /` | `Cache-Control: no-cache` |
| Hashed asset | first `/assets/*.js` in index.html, `Accept-Encoding: br, gzip` | `public, max-age=31536000, immutable`, `Content-Encoding: br` or `gzip` |
| No JSON compression (BREACH) | `GET /health` with `Accept-Encoding: br, gzip` | no `Content-Encoding` |
| Host filtering | request with `Host: smoke.invalid` (SNI = real host) | not 200 (IIS or app refuses) |
| requestLimits | `POST /api/v1/__smoke` with a 1.5 MB body | 404.13 or 413, never 2xx |

The first-deploy-only HOSTING-RECORD rows that cannot be seen over HTTP come from the HostProbe step or from manual owner steps: runtime patch, content root, logs writable, client IP/XFF, PFX EphemeralKeySet, memory, SMTP 587, HIBP 443, `__Secure-` cookies, and the bootstrap.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `gitleaks detect`/`protect` | `gitleaks git` / `dir` / `stdin` | v8.19.0 ("deprecated `detect` and `protect`") | Use `gitleaks git --pre-commit --staged` (flag names: verify with `--help` at execution) [CITED: gitleaks README v8.30.1] |
| Tag-pinned actions | SHA-pinned + repo `sha_pinning_required` setting | 2025 (setting present in API) | Server-side enforcement on top of reviews |
| Environments with reviewers for prod approval | Free private: `workflow_dispatch` by owner as approval (D-11) | n/a (plan limits) | No environment secrets; repository secrets only |
| `@lhci/cli` | In-house `lighthouse.mjs` + `lighthouse-assert.mjs` (Phase 2) | Phase 2 | CI calls `npm run lighthouse` |

**Deprecated/outdated in project research:** `.planning/research/STACK.md` row "Deploy" says credentials go in GitHub **environment** secrets (`staging`, `production` with required reviewers). That is not possible on a Free private repo (CITED above), and there is no staging (D-11 of Phase 1, D-01 here). Use repository secrets plus `workflow_dispatch`.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | msdeploy.exe is at `C:\Program Files\IIS\Microsoft Web Deploy V3\msdeploy.exe` on windows-2025 (the readme lists only the VS WebDeploy component) | Standard Stack / Pattern 4 | The deploy step fails. Fallback: install the Microsoft Web Deploy MSI with a hash check. |
| A2 | The SmarterASP.NET Web Deploy endpoint is `https://<server>:8172/msdeploy.axd?site=<site>` with Basic auth, reachable from GitHub runners | Pattern 4 | The deploy cannot connect. The dry run detects this first. |
| A3 | ANCM ignores msdeploy's `App_Offline.htm` (case), so manual lowercase upload is needed | Pattern 4 | Low. The manual route works either way. |
| A4 | IIS URL Rewrite module availability on the host is unknown | Pattern 8 | 500.19 site-wide if the rule ships without the module. Prove it via the probe. |
| A5 | `<urlCompression>` is overridable in site web.config on SmarterASP (default IIS: yes) | Pattern 8 | 500.19 if locked. The probe web.config can test it too. |
| A6 | Playwright `webServer.env` overrides `process.env` | Pattern 2 | The CI override might work without code changes. A harmless extra change otherwise. |
| A7 | A fresh ubuntu runner needs `dotnet dev-certs https` for `https://localhost:5199` | Pattern 2 | One extra cheap step. |
| A8 | PowerShell 7 on Linux does not rewrite backslashes in native-command arguments | Pitfall 3 | The coverage gate may already work. A path fix is harmless. |
| A9 | Dependabot may not regenerate NuGet `packages.lock.json` | Pattern 7 | Dependabot PRs fail locked restore. Manual lock refresh on the branch. |
| A10 | Windows minutes count about 2x against the 2,000 included minutes | Pitfall 9 | The budget table shifts. Measure. |
| A11 | All CI duration estimates | Pitfall 9 | The budget may be exceeded. D-16 local fallback. |
| A12 | `sha_pinning_required` / `allowed_actions=selected` are enforced on Free private repos | Pattern 6 | Then they are only documentation. In-repo tests still enforce pinning. |
| A13 | The host env-var UI accepts a several-KB base64 PFX | Pitfall 12 | The app refuses to start (fail-closed). Alternative: a PFX file outside wwwroot, skipped by msdeploy. Needs an owner decision. |
| A14 | Package artifact retention of 14 days fits the 500 MB pool | Pattern 3 | Storage blocks uploads. Shorten retention. |
| A15 | msdeploy provider settings break on `,` `"` `'` `;` in passwords | Pattern 4 | Auth failures. Ask the owner for a plain alphanumeric password. |
| A16 | Remote SQL access to the host DB from the owner's machine (needed for the idempotent script via SSMS/sqlcmd and for `Csps.BootstrapManager`) | Runtime State / D-18 | Steps 6 and 8 need another route (the control-panel query tool may not handle `GO` batches). |
| A17 | harden-runner's free tier excludes private repos | Alternatives | None (not adopted). |
| A18 | Dependabot YAML ecosystem keys `nuget`, `npm`, `github-actions` | Pattern 7 | Config error on push (visible at once in the Insights tab). |

## Open Questions

1. **Shop contact facts for the D-17 holding page.**
   - What we know: SiteSettings seed and UI-SPEC use placeholders (`"[0917 000 0000]"`, `"[Facebook page URL]"`, `"[Shop address], [City], Philippines"`). The hours "Mon–Sat · 9:00 AM – 6:00 PM" contain en dashes, so OR-4 requires rewriting them as `Mon-Sat`, `9:00 AM - 6:00 PM`.
   - Unclear: the real phone, Facebook URL, address and hours.
   - Recommendation: an owner checkpoint before the holding-page plan executes. Never ship placeholders to the live site.
2. **How the owner applies the idempotent script and runs the bootstrap against the host DB.**
   - Recommendation: confirm remote SQL access (server name, port 1433 open) in the control panel. Use SSMS (free Microsoft tool on the owner's machine, never shipped) or the query tool. Record it in the runbook.
3. **HostProbe on the site root before the first CSPS deploy.** Its README says "Never put the probe on the live site". D-01 retires the legacy site, so this rule needs an explicit owner amendment. It is the best way to verify the runtime patch, URL Rewrite and the probe facts before a deploy that has no rollback.
4. **`[ci skip]` ship-note rule** (Pattern 5): needs owner confirmation as a documented exception to "every check on the head commit".
5. **SQL image `2025-CU9` vs `2025-CU9-GDR1`** (a security GDR on MCR). Changing CLAUDE.md's pinned image is an owner call.
6. **ZAP baseline** (PRD §18 CD). It is not in OPS-03 or CONTEXT. Treat it as deferred to the hardening phase unless the owner says otherwise.
7. **Least-privilege SQL login** (PRD §19.2). The hosting login is db_owner. Ask whether the Basic plan allows a second, restricted login. Otherwise record an accepted risk.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| gh CLI (local, authenticated as loudiamond13) | merge gate, repo settings | ✓ | 2.102.0 | none needed |
| Node / npm (local) | web scripts, tests | ✓ | 24.21.0 / 11.19.0 | none |
| .NET SDK (local) | build, publish | ✓ | 10.0.402 | none |
| msdeploy.exe (local) | optional local dry run by owner | ✓ | `C:\Program Files\IIS\Microsoft Web Deploy V3\msdeploy.exe` exists | CI only |
| pwsh (local) | none locally (Windows PowerShell 5.1 runs the scripts) | ✗ | — | Windows PowerShell 5.1 |
| actionlint / zizmor / gitleaks (local) | local hook, optional local lint | ✗ | — | `Install-Gitleaks.ps1` (pinned, hash-checked) after owner OK. actionlint and zizmor run in CI only. |
| Docker (local) | **must not be used** (CLAUDE.md) | present (29.8.1) | — | Not applicable: CI only |
| ubuntu-24.04 runner | CI | ✓ (GitHub-hosted) | image 20261004.327.1 | — |
| windows-2025 runner | deploy | ✓ (GitHub-hosted) | image 20261004.281.1 | — |
| SmarterASP.NET Web Deploy credentials | deploy | ✗ (owner, D-18 step 5) | — | none: blocks the first deploy |
| Host app-pool settings, new SQL 2025 DB | first deploy | ✗ (owner, D-18 steps 3-4) | — | none |

**Missing dependencies with no fallback:** the owner prerequisites in D-18 (credentials, DB, app-pool settings, shop contact facts). These block only the cutover plans, not the CI plans.
**Missing dependencies with fallback:** local gitleaks (the hook warns until it is installed).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | xunit.v3 4.0.1 on MTP (.NET), with Shouldly; Vitest 5.0.1 (web/scripts); Node `--test` (tools/openapi-gen) |
| Config file | `global.json` (`"runner": "Microsoft.Testing.Platform"`), `web/vitest.config.ts` (includes `scripts/**/*.test.ts`) |
| Quick run command | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiWorkflowTests"` · `npm --prefix web test -- --run scripts/merge-gate.test.ts` |
| Full suite command | `dotnet test --solution Csps.slnx` and `npm --prefix web run verify` (plus the preflight before full local runs) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OPS-01 | CODEOWNERS names `@loudiamond13`; the PR template carries every PRD §22 DoD item; `branch-rules.md` exists; `.gitignore` has the PRD §18 entries | unit (repo-file lint) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiRepoHygieneTests"` | ❌ Wave 0 |
| OPS-01 | Merge gate refuses draft, BEHIND, missing or red gate, pending, unticked DoD; allows the planning-only `[ci skip]` head via its parent | unit | `npm --prefix web test -- --run scripts/merge-gate.test.ts` | ❌ Wave 0 |
| OPS-01 | Conventional-Commits check accepts `docs(03): ...` and `build(deps): ...`, rejects `Update stuff` | unit | same vitest file or `scripts/commit-lint.test.ts` | ❌ Wave 0 |
| OPS-02 | `ci.yml` step order matches OPS-02; `verify.mjs` STEPS appear in order; every `uses:` is a 40-hex SHA with a `# vX.Y.Z` comment; top-level `permissions: {}`; every job has `timeout-minutes`; checkout has `persist-credentials: false`; no `pull_request_target`; no `${{ github.event` or `${{ inputs.` inside `run:` | unit (text lint) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiWorkflowTests"` | ❌ Wave 0 |
| OPS-02 | Workflows are syntactically valid and free of known attack patterns | static | CI steps `actionlint` and zizmor (after owner OK) | ❌ Wave 0 |
| OPS-02 | E2E harness uses `CSPS_E2E_CONNECTION` for both seed and host | unit | `npm --prefix web test -- --run scripts/e2e.test.ts` | ✅ (extend) |
| OPS-02 | The pipeline actually runs green on ubuntu | integration (real CI) | Phase 3 PR: `gh pr checks <n>` shows `gate (full)` pass | manual-verify once |
| OPS-03 | `dependabot.yml` has nuget `/`, npm `/web` + `/tools/openapi-gen`, github-actions `/`, each with `cooldown.default-days: 14` | unit | `CiWorkflowTests` (Dependabot facts) | ❌ Wave 0 |
| OPS-03 | gitleaks download is checksum-verified; the pre-commit hook exists and calls `gitleaks git` | unit + manual | `CiWorkflowTests`; owner runs `git commit` with a planted fake key once and sees the block | ❌ Wave 0 |
| OPS-03 | NuGetAudit as error | unit | existing `BuildConfigTests` | ✅ |
| OPS-04 | msdeploy args: skip rules, retry, no DoNotDeleteRule, whatif in dry run, password never in logs | unit | `npm --prefix web test -- --run scripts/deploy.test.ts` | ❌ Wave 0 |
| OPS-04 | Orchestration: offline, then sync, then online, then smoke; on fail, rollback to the last release, then exit 1; first deploy without a release leaves offline and exits 1; never deletes `logs` | unit | same | ❌ Wave 0 |
| OPS-04 | `deploy.yml`: `workflow_dispatch` only, `concurrency` without cancel, `ref == main` guard, sha regex validation via env, job `permissions` exactly `contents: write`, `actions: read` | unit | `CiWorkflowTests` | ❌ Wave 0 |
| OPS-04 | Smoke checks (table above) against fake responses: pass and each failure mode | unit | `npm --prefix web test -- --run scripts/smoke.test.ts` | ❌ Wave 0 |
| OPS-04 | Real deploy plus smoke on production | manual-verify (owner presses Run) | the deploy run log plus HOSTING-RECORD rows moved to Verified with dates | manual |
| OPS-05 | `web.config` keeps in-process, `removeServerHeader`, `requestLimits` 1048576, removes X-Powered-By; adds `urlCompression` off; rewrite rule only if adopted | unit | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*WebConfigTests"` | ✅ (extend) |
| OPS-05 | Publish output has no `logs/`, no `appsettings.Development.json`, no `app_offline.htm`; `web.config` present | integration (CI step) and a unit test of the check script | `npm --prefix web test -- --run scripts/package-check.test.ts` (if Node) | ❌ Wave 0 |
| OPS-05 | No secrets in the package | static | `gitleaks dir artifacts/publish` in CI | ❌ Wave 0 |
| D-17 | Holding page renders shop facts, axe clean, OR-4 clean, Lighthouse ≥ 95, budgets | unit + E2E + Lighthouse | `npm --prefix web run verify`; `npm --prefix web run e2e -- --grep @smoke`; `npm --prefix web run lighthouse` | ✅ (update smoke.spec h1 text) |

### Sampling Rate
- **Per task commit:** the quick command for the touched area (CiWorkflowTests or the specific vitest file).
- **Per wave merge:** `dotnet test --solution Csps.slnx` and `npm --prefix web run verify` (preflight first). Once the workflow exists: the PR's `gate` check.
- **Phase gate:** the full local gate (D-16 list) plus a green `gate (full)` on the Phase 3 PR, then `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `tests/Csps.ArchitectureTests/CiWorkflowTests.cs`: text-level workflow and Dependabot assertions (follow the `WebConfigTests` / `HostingRecordTests` repo-root pattern)
- [ ] `tests/Csps.ArchitectureTests/CiRepoHygieneTests.cs`: CODEOWNERS, PR template DoD, branch-rules doc
- [ ] `web/scripts/merge-gate.test.ts`, `smoke.test.ts`, `deploy.test.ts` (+ `package-check.test.ts` if the check is in Node)
- [ ] Extend `web/scripts/e2e.test.ts` (`CSPS_E2E_CONNECTION`) and `WebConfigTests` (`urlCompression`)
- [ ] One full-history gitleaks scan to seed `.gitleaks.toml`
- [ ] First ubuntu CI run on the Phase 3 branch, with time budgeted for Linux-only fixes (Pitfall 3)
- Framework install: none (no new test packages)

## Security Domain

`security_enforcement: true`, ASVS level 1, block on high (from `.planning/config.json`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture (build and deploy pipeline) | yes | Least-privilege `permissions:`, SHA pinning, deploy only from `main` via `workflow_dispatch` |
| V2 Authentication | no (app auth unchanged) | — |
| V3 Session Management | partial (first-deploy `__Secure-` cookie check) | existing AuthCookies; manual verification |
| V4 Access Control | yes (CI token scopes, who can deploy) | `default_workflow_permissions: read` (verified), per-job grants, `github.ref` guard; the default-deny 401 smoke |
| V5 Input Validation | yes (workflow inputs) | regex-validate `sha`; pass inputs through `env:` only |
| V6 Cryptography | yes (TLS to Web Deploy, Data Protection PFX handling) | No `-allowUntrusted` without a pinned-thumbprint pre-check. PFX lives only in host env vars. Never hand-roll crypto. |
| V7 Error Handling and Logging | yes | Secrets masked (`::add-mask::`), no `-verbose` echo of credentials, smoke checks ProblemDetails with no stack traces |
| V10 Malicious Code (supply chain) | yes | SHA-pinned actions, checksum-verified binaries, Dependabot, NuGetAudit, npm audit, license gates, zizmor |
| V14 Configuration | yes | `web.config` header removal, `urlCompression` off, secrets only on the server, package-content check, `gitleaks dir` |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Workflow template injection (CWE-77/78) via PR title, branch name or dispatch input | Tampering / Elevation | Never `${{ github.event.* }}` / `${{ inputs.* }}` in `run:`; use `env:`; zizmor; CiWorkflowTests |
| Compromised or mutable action tag (CWE-829) | Tampering | Full SHA pins, `sha_pinning_required`, Dependabot with a 14-day cooldown |
| Download without an integrity check (CWE-494) | Tampering | `sha256sum -c` against values recorded in this research |
| Token left in `.git/config` (artipacked) | Information disclosure | `persist-credentials: false` |
| Over-privileged `GITHUB_TOKEN` (CWE-250/732) | Elevation | `permissions: {}` at the top; `contents: write` only on the deploy job |
| Secrets in the deploy package or logs (CWE-312/532) | Information disclosure | Publish exclusions, package-content check, `gitleaks dir`, the Serilog masking that already exists |
| Dev logs shipped to production (CWE-200, observed) | Information disclosure | `Content Remove="logs\**"` plus the check |
| Unvalidated Web Deploy TLS (CWE-295) | Spoofing | Avoid `-allowUntrusted`; if forced, pin the certificate thumbprint pre-flight |
| Hard-coded credentials (CWE-798) | Information disclosure | Repo secrets only; a generated, masked SA password for the CI container |
| BREACH via IIS compressing JSON | Information disclosure | `urlCompression doDynamicCompression="false"`; smoke asserts no `Content-Encoding` on JSON |
| Repo secrets readable by any workflow on any pushed branch | Elevation | Solo writer (owner and Claude via the owner's token); CODEOWNERS on `.github/`; accepted risk recorded |
| Site left offline by a failed deploy (availability) | Denial of service | Orchestrator rollback paths, an `action: online` escape hatch, `concurrency` without cancel |

## Sources

### Primary (HIGH confidence)
- `gh api` (this session):
  - commit SHAs, tag dates, `action.yml` runtimes and licenses for actions/checkout, setup-dotnet, setup-node, cache, upload-artifact, download-artifact, zizmor-action
  - repo security advisories
  - gitleaks, actionlint and zizmor releases and checksum files
  - repo settings and Actions permissions for `loudiamond13/CarmensStitchAndPrintingServices`
- runner-images readmes (Ubuntu2404, Windows2025, Windows2022) via `gh api repos/actions/runner-images/contents/...`
- MCR tag list `https://mcr.microsoft.com/v2/mssql/server/tags/list`
- Codebase reads: `src/Csps.Server/web.config`, `Program.cs`, `Composition/SpaRegistration.cs`, `Endpoints/*`, `Infrastructure/DependencyInjection.cs`, `Seeding/DevSeedTargetGuard.cs`, `DevSeedOptions.cs`, `tests/Csps.Testing/SqlServerInstance.cs`, `web/playwright.config.ts`, `web/scripts/{verify,e2e,lighthouse,shared-machine}.mjs`, `tools/scripts/*.ps1`, `Directory.Build.props`, `Directory.Packages.props`, `global.json`, `.planning/HOSTING-RECORD.md`, `docs/development.md`, `docs/operations/*`, `~/.claude/gsd-core/workflows/ship.md`
- Local experiments: Release publish (portable and `win-x64`) into the scratchpad (logs leak, lock-file change, web.config preserved); `npm audit` on web and openapi-gen

### Secondary (MEDIUM confidence)
- [docs.github.com: GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions): 2,000 minutes, 500 MB artifacts, 10 GB cache, blocking at quota
- [docs.github.com: About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases): no total-size limit
- [docs.github.com: Deployments and environments](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments): environment secrets and reviewers public-only on Free
- [docs.github.com: Dependabot options reference](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference): cooldown, groups, directories
- [learn.microsoft.com: Host ASP.NET Core on IIS (Locked deployment files)](https://learn.microsoft.com/en-us/aspnet/core/host-and-deploy/iis/)
- [learn.microsoft.com: urlCompression](https://learn.microsoft.com/en-us/iis/configuration/system.webserver/urlcompression)
- [learn.microsoft.com: Web Deploy Operation Settings](https://learn.microsoft.com/en-us/previous-versions/windows/it-pro/windows-server-2008-R2-and-2008/dd569089(v=ws.10))
- gitleaks README at v8.30.1 (via gh api)

### Tertiary (LOW confidence)
- [SmarterASP.NET KB a2135](https://www.smarterasp.net/support/kb/a2135/how-to-publish-asp_net-core-web-application-via-visual-studio-2019.aspx) (2021): certificate validation note
- [blog.miniasp.com (2021)](https://blog.miniasp.com/post/2021/06/29/MSDeploy-to-Azure-Function-App-with-Private-Link-VNet): AppOffline rule casing issue and the manual three-step workaround
- [help.monsterasp.net](https://help.monsterasp.net/books/deploy/page/how-to-deploy-website-content-from-command-line): a shared-host msdeploy command form
- General IIS HTTPS-rewrite guidance from other hosts (Winhost, Everleap, Accuweb), not SmarterASP-specific

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH. Every SHA, date, license and checksum was resolved this session.
- CI architecture: HIGH for the commands (they exist and are tested), MEDIUM for Linux compatibility (no ubuntu run yet).
- Deploy and IIS specifics: LOW to MEDIUM. Microsoft docs are solid; SmarterASP.NET specifics are unverified until the `-whatif` dry run and the probe.
- Pitfalls: HIGH for the observed ones (logs leak, lock files, `[ci skip]`, LocalDB binding), MEDIUM for the rest.

**Research date:** 2026-10-15
**Valid until:** 2026-11-14 for the CI stack (re-check action versions; Dependabot takes over). Re-verify the host facts on the day of the cutover.
