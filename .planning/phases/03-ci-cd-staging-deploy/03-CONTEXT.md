---
created: "2026-10-15T19:45:00-05:00"
updated: "2026-10-15T19:45:00-05:00"
phase: 03-ci-cd-staging-deploy
kind: context
---

# Phase 3: CI/CD & Deploy - Context

**Gathered:** 2026-10-15
**Status:** Ready for planning (owner prerequisites are the D-18 control-panel steps)
**Branch:** `gsd/phase-03-ci-cd-staging-deploy`, cut from the Phase 4 tip (owner, 2026-10-15). Only Phase 3 commits go on it.

<domain>
## Phase Boundary

Every PR to `main` runs the full ordered pipeline (OPS-02), with supply-chain checks (OPS-03) and repo hygiene (OPS-01). CSPS gets a manual-approval Web Deploy path to SmarterASP.NET with `app_offline.htm`, a post-deploy smoke test and automatic rollback (OPS-04), and a hardened `web.config` (OPS-05).

**This discussion changes the roadmap entry in three ways:**

1. **No staging.** D-11 (Phase 1) stands: the Basic plan has no staging site. The deploy target is **the live production site**.
2. **CSPS replaces the live legacy site in Phase 3.** The owner overrides **Prime Directive 1** ("no touching the live legacy site or database before cutover") and surrenders the legacy site now, knowing that staff have no order screens until the order phases ship (D-01). The legacy **site and database are retired in Phase 3**, not Phase 17. Legacy data is preserved in a verified `.bak` and imported later (Phase 16).
3. **A small public holding page** is added (D-17), because the public site is only a placeholder until Phase 11.

Requirements: OPS-01..05. The roadmap text, OPS-04's staging wording, PROJECT.md Prime Directive 1 and the Phase 16/17 cutover text must be amended to match (see Deferred Ideas, "Roadmap amendments").
</domain>

<decisions>
## Implementation Decisions

### Deploy target & legacy retirement
- **D-01:** **CSPS deploys to the live site and replaces the legacy app in Phase 3.** This is an owner override of Prime Directive 1, recorded 2026-10-15. The owner accepts that staff lose the legacy order screens until the order phases ship. — **Reversibility:** one-way — after the switch, the legacy app is back only through the D-05 rollback kit, and visitors and staff see CSPS from that day.
- **D-02:** **The production deploy job exists now and is not locked behind a cutover switch.** It targets the live site from Phase 3 onward.
- **D-03:** **Fresh SQL Server 2025 database for CSPS.** After D-04 proves the backup, the owner deletes the legacy database on the host (the Basic plan allows one database) and creates a new SQL Server 2025 database. CSPS's idempotent migration script runs into the empty database. Legacy data then lives only in the `.bak` until the Phase 16 import. **Legacy data is never modified:** it is never migrated in place, and CSPS tables never share a database with it. After the new database exists, verify its compatibility level and re-pin `SqlCompatibility.Level` to 170 if it reports 170 (per HOSTING-RECORD D-33), then re-run MigrationScriptTests. — **Reversibility:** one-way — deleting the host database removes the live copy. Recovery is only from the `.bak`.
- **D-04:** **Backup proof before any delete.** The owner takes a fresh `.bak` from the control panel and keeps two copies off the host. Claude restores it into LocalDB as **`CSPS_Legacy_Restore`** and records a receipt: table names plus row counts per table, with no data values. This is an owner-approved exception to the "restore only in the legacy-discovery phase" rule (root CLAUDE.md). It reads names and counts only; schema study stays in Phase 10. The host database is deleted only after the owner confirms the receipt. The `.bak` stays in `_local/` (never committed or uploaded).
- **D-05:** **Legacy rollback kit.** Before the first deploy, the owner downloads the legacy site's files too. If CSPS will not start on the host, legacy can be put back the same day (files + the `.bak` restored into a new database). Once the owner accepts CSPS live, rollback means redeploying an earlier CSPS package (D-11).
- **D-06:** **Smoke test after every deploy:**
  - the roadmap set: `/health`, an unknown `/api/*` route returning ProblemDetails through IIS, HTTPS redirect, removed server headers, compression, `immutable` hashed assets and `no-cache` `index.html`
  - plus, on the first deploy, every **"Verify on the first deploy (Phase 3)"** row in `.planning/HOSTING-RECORD.md`: runtime patch (otherwise publish self-contained `win-x64`), in-process hosting, content root, logs folder writable, client IP/proxy topology, HTTPS termination, Asia/Manila and en-PH, PFX EphemeralKeySet, app-pool memory, `__Secure-` cookies on the HTTPS host, SMTP 587 and HIBP 443 reachability, `AllowedHosts`, `requestLimits`, Data Protection cert and `App:PublicBaseUrl` for bootstrap
  - Read-only checks are automated. The **bootstrap of the first Manager and the first emailed-code sign-in (AUTH-12, AUTH-13) are a one-time manual step by the owner.** HOSTING-RECORD rows move to Verified with the evidence.

### Repo, merge gate & security tooling (C-27 / S-9, C-45)
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

### Deploy trigger, approval & rollback
- **D-11:** **The owner pressing Run is the approval.** A merge to `main` runs CI, then builds and stores the deploy package as a workflow artifact tied to its commit. A deploy runs only from `workflow_dispatch` (the GitHub "Run workflow" button or `gh workflow run`), choosing a build that passed CI. There is no auto-deploy on merge. The previous good package is kept for rollback.
- **D-12:** **No time window.** Deploys run whenever the owner presses Run. `app_offline.htm` shows a short branded "updating, back in a minute" page during the deploy.
- **D-13:** **Automatic rollback.** If the post-deploy smoke test fails, the workflow redeploys the last good package, re-runs the smoke test, and marks the run failed so the owner is notified.

### CI minutes budget (private repo: 2,000 free minutes per month)
- **D-14:** **Full ordered gate on ready PRs.** Every push to a ready PR runs the whole OPS-02 pipeline in its order. Draft PRs run only the fast part: locked restore, build, format, unit and architecture tests, web typecheck, lint, Prettier and Vitest. A newer push cancels the older run (`concurrency`). Changes only under `.planning/` or docs skip the heavy jobs.
- **D-15:** **Playwright: Chromium + a phone viewport on PRs, all three engines weekly** (a scheduled run on `main`). Locally, the full three-engine run before shipping continues as in Phase 4.
- **D-16:** **When minutes run out, CI stops; nothing is paid.** The GitHub spending limit stays at $0 (D-00). Until minutes reset on the 1st, a merge requires the local full gate (`dotnet build`, `dotnet test --solution`, `Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e`) with its output pasted in the PR.

### Public site after the switch
- **D-17:** **Simple holding page.** Until Phase 11's real public pages, visitors see one branded, fast page built with the Phase 2 design system: shop name, a short "new website on the way" line, phone, Facebook link, address and hours. The copy lives in the client (no CMS). It replaces `PublicPlaceholderPage` on the public routes. It must meet the existing gates: axe, Lighthouse ≥ 95 mobile, bundle budgets, OR-4 (no long dash). The admin portal (`/admin/...`) stays as built in Phase 4.

### Cutover-day steps & roles
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope & requirements
- `.planning/ROADMAP.md` § "Phase 3: CI/CD & Staging Deploy" — goal, success criteria, owner prerequisites (amended by this CONTEXT)
- `.planning/REQUIREMENTS.md` — OPS-01..OPS-05
- `.planning/PROJECT.md` — Prime Directive 1 (overridden by D-01), core value, constraints
- `CSPS-PRD.md` §18 (repo, CI, deploy) and §2 (stack)

### Hosting facts (deploy, secrets, first-deploy checks)
- `.planning/HOSTING-RECORD.md` — Basic plan facts (no staging, one DB, Web Deploy offered, no scheduler), app settings and secrets in app-pool env vars, D-33 SQL Server 2025 and compat level, and every "Verify on the first deploy (Phase 3)" row (D-06)

### Prior decisions that bind this phase
- `.planning/phases/01-hosting-verification-backend-foundation/01-CONTEXT.md` — D-00 (free only, substitute security set), D-10 (cron via Actions), D-11 (no staging), D-13 (compat level), D-19 (14-day cooldown)
- `.planning/phases/02-web-foundation-design-system/02-CONTEXT.md` — quality gates, Lighthouse 13.5.0 + in-house assert script (replaces `@lhci/cli`), Playwright host 5199, bundle budgets
- `.planning/phases/04-identity-authentication/04-RESEARCH.md` § "Phase 3 Deferral: What Changes for Phase 4" — the local substitutes CI must now enforce (QUAL-05 Release-sink check, coverage gate, `npm audit`, license gate, Dependabot)
- `.planning/phases/04-identity-authentication/04-CONTEXT.md` — D-37 Testing environment for E2E (the sink is compiled out of Release)

### Operations docs to build on
- `docs/operations/bootstrap-manager.md` — first-Manager bootstrap (D-18 step 8)
- `docs/operations/mail-setup.md` — mail settings for the app-pool variables
- `docs/operations/data-protection-rotation.md` — PFX handling
- `docs/development.md` — local gate commands
- `docs/license-exceptions.json`, `docs/allowed-licenses.json` — license gate inputs

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tools/scripts/Invoke-CoverageGate.ps1` — coverage thresholds; CI calls it as the coverage gate
- `tools/scripts/New-ThirdPartyNotices.ps1` + `THIRD-PARTY-NOTICES.md` — the NuGet license gate and generated notices (last pipeline step)
- `web/scripts/verify.mjs` (`npm run verify`), `web/scripts/e2e.mjs` (`npm run e2e`), `web/scripts/lighthouse.mjs` (`npm run lighthouse`), `web/scripts/license-gate.mjs` — web gates ready to call from CI
- `tools/Csps.HostProbe` — the probe built in Phase 1 for the host facts; candidate for the first-deploy checks (D-06)
- `tools/Csps.BootstrapManager` — first-Manager bootstrap command
- `src/Csps.Server/web.config` — the starting point for OPS-05
- `web/src/modules/public/pages/PublicPlaceholderPage.tsx` — what the holding page (D-17) replaces

### Established Patterns
- No `.github/` folder exists yet: workflows, Dependabot, CODEOWNERS and the PR template are all new.
- Tests pick their SQL backend from `CSPS_TEST_SQL=localdb|container`; CI (ubuntu) uses the SQL 2025 container image `mssql/server:2025-CU9-ubuntu-24.04`.
- Production never runs `Database.Migrate()`; it gets reviewed idempotent scripts (MigrationScriptTests prove them at 160 and 170).
- The local ports (5180, 5115/7028, 5199) and preflight script apply to local runs only, not to CI runners.

### Integration Points
- `/gsd-ship` merge step: where the D-08 green-checks gate is enforced.
- The HOSTING-RECORD Facts table: updated with evidence after the first deploy.
- `docs/operations/`: home for the cutover runbook (D-18) and the deploy/rollback procedure.

</code_context>

<specifics>
## Specific Ideas

- The owner will "save a bak file of the database and never modify live/legacy data": legacy data is preserved byte-for-byte in the `.bak`, never transformed on the host.
- "We'll surrender the old site now": the legacy site is retired in Phase 3, on purpose.
- The `app_offline.htm` page and the holding page use the shop's look (Phase 2 tokens), not a generic IIS message.

</specifics>

<deferred>
## Deferred Ideas

- **Staff order recording between the switch and the order phases.** Not discussed by the owner's choice. It may need a plan (paper or spreadsheet) and possibly a later import; raise it before the switch date.
- **Old legacy URLs and SEO** (redirects or a friendly 404 for saved links). Not discussed; a candidate for Phase 11 or the hardening phase.
- **Going public later.** It would unlock enforced rules, CodeQL, secret scanning and unlimited minutes. It needs a fresh scrubbed repo (the owner prefers to keep this repo private).
- **Roadmap amendments:** reword the Phase 3 title and OPS-04 (no staging), record the Prime Directive 1 override in PROJECT.md, and update Phases 16/17 (legacy import now goes from the `.bak` into a database that already serves CSPS; no live-site cutover remains). Do this in planning or with `/gsd-phase` edit.

</deferred>

---

*Phase: 03-ci-cd-staging-deploy*
*Context gathered: 2026-10-15*
