---
created: "2026-10-17T11:12:00-05:00"
updated: "2026-10-17T12:05:00-05:00"
phase: 03-ci-cd-staging-deploy
verified: 2026-10-17T16:12:00Z
status: passed
score: 6/7 must-haves verified
covered_files:
  - .github/CODEOWNERS
  - .github/dependabot.yml
  - .github/pull_request_template.md
  - .github/workflows/ci.yml
  - .github/workflows/codeql.yml
  - .github/workflows/deploy.yml
  - .github/workflows/hygiene.yml
  - .github/workflows/weekly.yml
  - .planning/phases/03-ci-cd-staging-deploy/03-01-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-01-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-02-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-02-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-03-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-03-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-04-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-04-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-05-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-05-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-06-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-06-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-07-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-07-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-08-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-08-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-09-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-09-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-10-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-10-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-11-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-11-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-12-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-12-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-13-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-13-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-14-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-14-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-15-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-15-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-16-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-16-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-17-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-17-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-18-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-18-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-19-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-19-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-20-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-20-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-21-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-21-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-22-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-22-SUMMARY.md
  - .planning/phases/03-ci-cd-staging-deploy/03-23-PLAN.md
  - .planning/phases/03-ci-cd-staging-deploy/03-23-SUMMARY.md
  - src/Csps.Server/web.config
  - tools/scripts/Merge-PullRequest.ps1
  - web/scripts/ci-classify.mjs
  - web/scripts/deploy.mjs
  - web/scripts/merge-gate.mjs
  - web/scripts/package-check.mjs
  - web/scripts/smoke.mjs
  - web/src/modules/admin/routes.test.tsx
  - web/src/modules/public/pages/HoldingPage.tsx
covered_digest: "v3:sha256:c76d0c05d4c1fb9656902f60381cc50ebe0df79b1efc0d76a599869fd99d270c"
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Lighthouse CI asserts LCP under 2000 ms on the holding page (Success Criteria 1 and 6)"
    reason: "LCP is report-only in CI until Phase 11 (REPORT_ONLY_METRICS in web/scripts/lighthouse-assert.mjs). Every other Lighthouse assertion stays a hard failure; the 2000 ms target is unchanged and is printed on every run. Recorded in deferred-items.md and 03-UAT.md test 80."
    accepted_by: "owner (decision 2026-10-16, recorded in deferred-items.md; confirmed by the owner in /gsd-verify-work 03 on 2026-10-17)"
    accepted_at: "2026-10-16T00:00:00-05:00"
unverified_prohibitions: 11
human_verification:
  - test: "After /gsd-ship 3 lands the phase branch on main (it carries commit 0e65223), run GitHub, Actions, Weekly, Run workflow on main"
    expected: "The Weekly all-engine run finishes green, including the Firefox and WebKit end-to-end steps. This closes gap G-03-6 (run 39043267415 failed at step 4 web vitest + coverage on the flaky /admin redirect test)."
    why_human: "Needs the ship merge first and then a GitHub-hosted run; the owner decided on 2026-10-17 that there is no separate gap plan and that the gap closes on a green re-run after ship."
  - test: "Review the 11 judgment-tier prohibitions listed under Prohibitions (non-authoritative judge verdicts)"
    expected: "Owner agrees each MUST NOT held. Two need a conscious yes: 03-05 (repo stays private; the repo is now public by owner decision 2026-10-16) and 03-01 (no CodeQL or dependency review; both are now in use because the repo is public and they are free)."
    why_human: "Judgment-tier prohibitions are never silently passed (ADR-550 D4). The autonomous judge is not authoritative."
  - test: "Confirm the LCP report-only override above"
    expected: "Owner confirms the waiver stands until Phase 11, and that Phase 11 empties REPORT_ONLY_METRICS."
    why_human: "The override was written by the verifier from the recorded owner decision, not typed by the owner."
---

# Phase 3: CI/CD & Deploy Verification Report

**Phase Goal:** Every pull request is gated by the full pipeline. A deploy runs only when the owner presses Run on a build of `main` that passed CI. It puts CSPS on the live SmarterASP.NET site, where CSPS replaces the legacy site, and a smoke test proves it or the last good package is put back automatically.
**Verified:** 2026-10-17T16:12:00Z
**Status:** passed (owner confirmations recorded 2026-10-17; Weekly re-run is an after-ship check)
**Re-verification:** No, initial verification

## Goal Achievement

The goal is achieved in the codebase and on the live site. The three open items are all after-ship or owner-confirmation items, not missing implementation. The one open failure in the evidence (the Weekly all-engine run, G-03-6) is a real failing run on `main` today. The owner decided on 2026-10-17 that it is not a gap plan and closes when the phase branch lands on `main` and a Weekly re-run is green. It is reported here as human-verification, not as passed.

### Observable Truths

| # | Truth (ROADMAP Success Criteria) | Status | Evidence |
|---|----------------------------------|--------|----------|
| 1 | Merge gate: every PR runs the ordered pipeline and the merge command refuses unless every check is green and the DoD ticked | VERIFIED (override: LCP report-only) | `.github/workflows/ci.yml` steps are numbered 1 restore/npm ci/audits, 2 build/format, 3 unit/integration/architecture, 4 web typecheck/lint/prettier/vitest+coverage/openapi, 5 web build/budget/SQL container/Playwright/Lighthouse, 6 coverage gate/licenses/notices, 7 package. Mode comes from `web/scripts/ci-classify.mjs`. `web/scripts/merge-gate.mjs` (788 lines) plus `tools/scripts/Merge-PullRequest.ps1` implement the refusals (UAT tests 15 to 18 pass). The ruleset on `main` is also `active` on GitHub with required checks gate result, secret scan, commit messages, actionlint, zizmor, dependency review, analyze (csharp), analyze (javascript-typescript), no bypass actors, linear history, PR required. Last 3 `main` CI runs are `success`. LCP is measured and printed but not failed (see override). |
| 2 | Supply chain: Dependabot with 14-day cooldown, gitleaks, NuGetAudit, npm audit, license gates, SHA-pinned actions with least privilege | VERIFIED | `.github/dependabot.yml` covers nuget, npm, github-actions, monthly, `default-days: 14` on each. `hygiene.yml` has secret scan (gitleaks 8.30.1, SHA-256 checked), commit messages, actionlint, zizmor, dependency review. `codeql.yml` runs csharp and javascript-typescript. All five workflows have `permissions: {}` at top. Every `uses:` is a 40-hex SHA (the only exception is the local reusable `./.github/workflows/ci.yml`). GitHub reports secret scanning, push protection and Dependabot security updates enabled. This is stronger than the roadmap text, which assumed a private repo. |
| 3 | Live deploy: only the owner pressing Run, on a CI-passed build of `main`; smoke test; automatic rollback | VERIFIED | `deploy.yml` has `on: workflow_dispatch` only, job `if: github.ref == 'refs/heads/main'`, concurrency group `deploy-production` with no cancel. `deploy.mjs` `findPackage` accepts only a `success` push run of `ci.yml` on `main` for exactly that commit (`csps-package-<sha>` artifact) or an existing `deploy-*` release for it; a malformed sha is refused before any `gh` call. `executeDeploy` rolls back to the last good release on a failed sync or smoke, or puts the branded offline page back on a first deploy. Named test `rolls back to the last good release when the smoke test fails: offline, sync it, online, smoke` ran and passed in this verification (1 passed). Live: Deploy run 39006538697 on `main`, sha bd34a88, smoke 12 of 12 PASS, release `deploy-20261017053115-bd34a88` created (log read with `gh run view --log`). A live smoke failure with real rollback has not been exercised (only dry run 38996354195 and the fakes in `deploy.test.ts`); the code path is covered by 95 unit tests. |
| 4 | Hosting configuration: in-process, HTTPS redirect, banners removed, compression, immutable assets, no-cache index.html; each smoke-checked; secrets only on server | VERIFIED | `src/Csps.Server/web.config`: AspNetCoreModuleV2 `hostingModel="inprocess"`, `removeServerHeader="true"`, `X-Powered-By` removed, IIS compression off (app compresses), HttpToHttps 301 rule. `smoke.mjs` checks https-redirect, security-headers, no-banners, shell-cache, hashed-asset, json-not-compressed, host-filter, request-limit. Independent live check from this session: `http://` returned 301 to https; `/` returned `Cache-Control: no-cache`, `Content-Encoding: gzip`, HSTS and strict CSP, no `Server` or `X-Powered-By`; `/assets/index-CnEtPxSX.js` returned `public, max-age=31536000, immutable`; `/api/v1/nope` returned `application/problem+json` 404 with a traceId; `/health` returned 200 `no-store` Healthy with self, database, time-zone. `ci.yml` has no `secrets.` reference; the deploy secrets are used only in `deploy.yml`. First Manager bootstrapped and signed in (03-CUTOVER-LOG.md, UAT test 2). |
| 5 | Legacy retired safely: `.bak` and site files kept off host, restore receipt, new empty DB with compat level verified | VERIFIED | `03-CUTOVER-LOG.md` steps 1 to 3: `.bak` and site zip kept in `_local` (git-ignored, `git check-ignore _local` confirms; `git ls-files _local` empty), 17 tables and 988 rows receipt confirmed by owner, legacy DB deleted by owner, new SQL Server 2025 DB at compat level 170 (D-03 allows 160 or 170), schema applied from the reviewed idempotent script (9 migrations). The deploy pipeline has no DB reference (`grep` for sqlcmd, SqlClient, Migrate, connection string, `.bak` in `deploy.mjs` found nothing). |
| 6 | Holding page: every public path shows one branded page that passes axe, Lighthouse, budgets, no-long-dash | VERIFIED (override: LCP report-only) | `web/src/modules/public/pages/HoldingPage.tsx` exists and is routed in `core/routes/router.tsx`; no placeholder, `href="#"` or TODO found. Live: `/` and `/products` both serve the same 1579-byte shell with the holding-page chunk preloaded, UAT test 1 (phone) passed by the owner. Lighthouse performance, accessibility, best practices and SEO pass; LCP about 2.13 to 2.19 s misses 2.0 s and is waived to report-only until Phase 11. |
| 7 | Weekly all-engine run is green on `main` (plan 03-11, OPS-02 / D-15) | UNCERTAIN (human) | Weekly run 39043267415 on `main` failed at step 4 `web vitest + coverage` on `web/src/modules/admin/routes.test.tsx`; the Firefox and WebKit steps never ran. The fix, commit 0e65223, is on this branch only (`git diff origin/main..HEAD` shows +9 lines in that file). It is not on `main`, so the run cannot be green until the branch ships. Owner decision 2026-10-17: closes on a green re-run after `/gsd-ship 3`. |

**Score:** 6/7 truths verified (the 7th is the open Weekly item; 1 override applied; 0 behavior-unverified)

### Deferred Items

None filtered to later phases. The LCP waiver names Phase 11 but is an accepted override of this phase's gate, not a gap handed forward.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `.github/workflows/ci.yml` | Ordered gate, modes, package job | VERIFIED | 349 lines, stages 1 to 7, package upload only on push to main |
| `.github/workflows/deploy.yml` | Manual-only, main-only deploy | VERIFIED | 84 lines, `workflow_dispatch` only |
| `.github/workflows/hygiene.yml`, `codeql.yml`, `weekly.yml` | Secret scan, lint, dependency review, CodeQL, weekly engines | VERIFIED | Present, active on GitHub; weekly currently red (truth 7) |
| `web/scripts/deploy.mjs` | Offline, sync, smoke, release, rollback | VERIFIED | 956 lines, 95 tests |
| `web/scripts/smoke.mjs` | 12 production checks | VERIFIED | 810 lines, 12 of 12 pass live |
| `web/scripts/merge-gate.mjs`, `tools/scripts/Merge-PullRequest.ps1` | Process merge gate and the one merge command | VERIFIED | Present, tested |
| `web/scripts/ci-classify.mjs` | docs, fast, full, package modes | VERIFIED | Present, tested |
| `src/Csps.Server/web.config` | In-process IIS config | VERIFIED | 37 lines, covered by `WebConfigTests.cs` |
| `.github/CODEOWNERS`, `pull_request_template.md`, `dependabot.yml` | Repo hygiene | VERIFIED | CODEOWNERS names `@loudiamond13` for all paths and `/.github/`; template has 12 unticked DoD items |
| `web/src/modules/public/pages/HoldingPage.tsx` | Holding page | VERIFIED | Substantive, routed, live |
| `docs/operations/{ci,deploy,cutover-runbook,branch-rules}.md`, `main-ruleset.json` | Runbooks | VERIFIED | Present; UAT test 8 passed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `deploy.yml` | `deploy.mjs` | `run: node web/scripts/deploy.mjs` with inputs and secrets in env only | WIRED | Confirmed in file |
| `deploy.mjs` | `smoke.mjs` | child process `node smoke.mjs --origin <url>` | WIRED | `smokeStep` runs it; live log shows the call |
| `deploy.mjs` | `ci.yml` package | `gh run list --workflow ci.yml --branch main --commit <sha> --status success`, then `gh run download -n csps-package-<sha>` | WIRED | Live deploy used run 39006074317's artifact |
| `ci.yml` | `ci-classify.mjs` | `classify` job output `mode` gates steps | WIRED | Steps use `needs.classify.outputs.mode` |
| `Merge-PullRequest.ps1` | `merge-gate.mjs` | merge script runs the gate first | WIRED | Per review trace and UAT 7 (gate allowed PR 7) |
| GitHub ruleset | required checks | `gate result`, `secret scan`, etc. | WIRED | Ruleset `active`, no bypass |

### Data-Flow Trace (Level 4)

Not applicable to the pipeline artifacts. The holding page renders static owner-supplied shop facts by design (D-17); no dynamic data source is expected.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Failed smoke rolls back to last good release | `npx vitest run scripts/deploy.test.ts -t "rolls back to the last good release when the smoke test fails"` | 1 passed, 94 skipped | PASS |
| Live HTTP to HTTPS | `curl -I http://cspstailoring.com/` | 301 to https | PASS |
| Live cache, compression, headers | `curl -I -H "Accept-Encoding: gzip" https://cspstailoring.com/` | no-cache, gzip, HSTS, CSP, no Server banner | PASS |
| Live hashed asset | `curl -I /assets/index-CnEtPxSX.js` | `immutable`, max-age 31536000 | PASS |
| Live unknown API route | `curl -i /api/v1/nope` | 404 `application/problem+json` with traceId | PASS |
| Live health | `curl -i /health` | 200, no-store, Healthy x3 | PASS |

The full .NET and web suites were not re-run here; the orchestrator's run this session (2263 .NET passed, 4453 web passed, 1 opt-in skip) is taken as given.

### Probe Execution

Step 7c: SKIPPED. No `scripts/*/tests/probe-*.sh` files exist and the PLANs declare none. The HostProbe tool (`tools/Csps.HostProbe`) was a one-time host check, run on 2026-10-16 (runs 39000637708 and 39000906168) and removed from the live site by the first deploy.

### Requirements Coverage

All five Phase 3 IDs appear in at least one PLAN `requirements:` field; none is orphaned.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| OPS-01 | 03-03, 03-05, 03-15, 03-16, 03-17, 03-23 | Repo, PR template with DoD, Conventional Commits, `.gitignore`, CODEOWNERS, merge gate | SATISFIED in code; REQUIREMENTS.md not updated | Repo exists, template, CODEOWNERS, `commit-lint.mjs`, merge gate and an active ruleset are all present. REQUIREMENTS.md still shows `- [ ] OPS-01` (line 58) and `Pending` in the traceability table (line 361), and the text says "private" and "ready to switch on". The repo is public since 2026-10-16 and the ruleset is on. Bookkeeping to fix at close-out. |
| OPS-02 | 03-01, 03-02, 03-04, 03-11, 03-15, 03-16 | Ordered CI pipeline, SHA pinning, least privilege | SATISFIED | See truth 1 and 2. Weekly all-engine run is the open item (truth 7). |
| OPS-03 | 03-05, 03-10, 03-11, 03-16 | Supply-chain security | SATISFIED | See truth 2 |
| OPS-04 | 03-06, 03-07, 03-08, 03-09, 03-12 to 03-14, 03-17 to 03-23 | Owner-run deploy, Web Deploy, smoke test, automatic rollback | SATISFIED | See truth 3, live run 39006538697 |
| OPS-05 | 03-07, 03-08, 03-13, 03-19 to 03-22 | `web.config` and hosting config, secrets only on server | SATISFIED | See truth 4 |

### Prohibitions (non-authoritative judge verdicts)

Source: `must_haves.prohibitions` in 12 PLAN files: 11 are `verification: judgment` and the 2 in 03-23 are `automated` (shown on one row). These verdicts are the verifier's judgment, NOT authoritative, and each is flagged `unverified-prohibition: human review recommended`. None is a silent pass.

| Plan | Prohibition (short) | Judge verdict | Basis |
|------|---------------------|---------------|-------|
| 03-01 | No paid service, no tool outside the license allow-list (named no CodeQL, no dependency-review) | Held on cost; wording superseded | Nothing paid is in use; spending limit not checked here. CodeQL and dependency review are now used because the repo became public, where they are free. Owner should confirm the wording change. |
| 03-03 | No merge on Claude's initiative or raw `gh pr merge` | Held (by design) | Merges go through `Merge-PullRequest.ps1` (cutover log shows PRs 1, 4, 6 by the script). History of intent cannot be proven from code alone. |
| 03-05 | Do not change repo visibility; repo stays private | Superseded | Repo is `PUBLIC` (verified with `gh repo view`) per owner decision 2026-10-16 recorded in `.claude/CLAUDE.md`. `.planning/` is still in the repo. Owner to confirm. |
| 03-06 | Deploy pipeline must not migrate or connect to a DB | Held | `deploy.mjs` has no DB, `.bak` or migrate reference; `webdeploy-dbfullsql-provider` is an opt-out in 03-COVERAGE.md. |
| 03-09 | No placeholder or invented contact facts on the live page | Held | No bracketed text, `#` link or TODO in `HoldingPage.tsx`; owner confirmed the page on a phone (UAT 1). Facts not independently cross-checked against the owner's list. |
| 03-11 | CI must not touch the hosted production DB or hold a production secret | Held | `ci.yml` has no `secrets.` reference; CI uses its loopback SQL container. |
| 03-12 | Deploy never gains an automatic trigger; dispatched only on the owner's instruction | Held | `on:` holds only `workflow_dispatch`. Whether Claude dispatched only on instruction cannot be proven from code. |
| 03-14 | No legacy data value in receipt, git or chat; `.bak` stays in `_local/` | Held on files | `_local` is git-ignored and untracked; the receipt holds names and counts per the cutover log. Chat history not audited. |
| 03-16 | Do not lower thresholds or add retries to pass the pipeline | Partly conflicts, owner-decided | Playwright `retries: 0`. LCP was moved to report-only (override above). It was returned to the owner who chose it, which is what the prohibition allows, but it is a loosened gate. |
| 03-18 | No modification of legacy data on host, no data out of `_local/` | Held | No deploy code touches data; cutover log shows the owner deleted the legacy DB himself after the receipt. |
| 03-19 | No in-place legacy migration; new DB starts empty | Held | Cutover log: new empty DB, schema from the idempotent script only. |
| 03-23 | No rename or branch change; no change to requirement IDs or the Coverage table (automated) | Held | Branch is still `gsd/phase-03-ci-cd-staging-deploy`; requirement IDs OPS-01 to OPS-05 unchanged in REQUIREMENTS.md. |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| (scanned `deploy.mjs`, `smoke.mjs`, `merge-gate.mjs`, `ci-classify.mjs`, `package-check.mjs`, `commit-lint.mjs`, the PowerShell scripts, `.github`, `docs/operations`, `web.config`) | n/a | TBD, FIXME, XXX | none found | No debt markers |
| `src/Csps.Infrastructure/DataProtection/DataProtectionRegistration.cs` | 52-67 | Certificate private key written to the machine key store at registration and not disposed when the container never resolves the owner (REVIEW WR-01; used by `tools/Csps.BootstrapManager`) | Warning | Private key file can stay on the machine where the tool runs. Open in `03-REVIEW-DISPOSITION.md`. |
| Data Protection certificate loading | n/a | A killed or crashed process leaves the key file with no sweep or documentation (REVIEW WR-02) | Warning | Same family; includes an IIS worker crash. Open. |
| Review INFO items IN-01 to IN-06 | n/a | Docs still say compat level 160; IIS redirect builds target from `Host`; stale smoke comment; `Restore-LegacyReceipt.ps1` hides the VERIFYONLY failure reason; redeploy of the live build rolls back to an older release; non-main dispatch ends skipped | Info | None blocks the goal. 8 of 12 review findings are `open` in the disposition file. |

### Human Verification Required

#### 1. Weekly all-engine run on main (closes G-03-6)

**Test:** After `/gsd-ship 3` lands the phase branch on `main` through `Merge-PullRequest.ps1`, run GitHub, Actions, Weekly, Run workflow on `main`.
**Expected:** Green, with Firefox and WebKit end-to-end steps passing.
**Why human:** Needs the ship merge first and then a GitHub-hosted run. Owner decision 2026-10-17: no separate gap plan.

#### 2. Judgment-tier prohibitions

**Test:** Read the Prohibitions table above.
**Expected:** Owner agrees. Two need a conscious yes: 03-05 (repo is public now) and 03-01 (CodeQL and dependency review are now in use).
**Why human:** Judgment-tier prohibitions are never auto-passed.

#### 3. LCP report-only override

**Test:** Confirm the waiver in the frontmatter `overrides:` entry.
**Expected:** Stands until Phase 11, which empties `REPORT_ONLY_METRICS`.
**Why human:** The entry was written by the verifier from the recorded owner decision.

### Owner Confirmations (2026-10-17, /gsd-verify-work 03)

- **Judgment-tier prohibitions:** owner confirmed all 11 held, including the superseded wording of 03-05 (repo is now public) and 03-01 (CodeQL and dependency review now in use, free on a public repo).
- **LCP report-only override:** owner confirmed the waiver stands until Phase 11, which empties `REPORT_ONLY_METRICS`. UAT test 80 is a deferred follow-up.
- **Weekly all-engine run (G-03-6):** owner confirmed it is an after-ship check: it closes on a green Weekly re-run on `main` once this phase's PR merges with 0e65223. UAT test 6 is a deferred follow-up and the gap stays listed as deferred.

### Gaps Summary

No missing or stubbed implementation was found. The pipeline, the owner-only deploy, the smoke test and the rollback code exist, are wired, and the live site at `https://cspstailoring.com` independently matches the claimed hosting configuration.

Items to carry forward, none a blocker to shipping:

1. **G-03-6, Weekly red on main.** Real and currently failing; closes after ship plus a green re-run. The branch's code diff against `main` is small (+9 lines in `routes.test.tsx`, plus docs), so shipping is low risk.
2. **REQUIREMENTS.md bookkeeping.** OPS-01 is unchecked and `Pending`, and OPS-01 and OPS-03 text still describe a private repo. Update the checkbox, the traceability row and the wording at close-out.
3. **`/gsd-secure-phase 3` has not run** (no `03-SECURITY.md`); the project workflow requires it before `/gsd-ship`. Review WR-01 and WR-02 (private key left in the machine key store) are the likely security-review inputs.
4. **Live automatic rollback has only been proven in unit tests.** A real failed-smoke rollback was never triggered on the host. This is accepted risk, not a failure, because the dry run and the 95 `deploy.test.ts` tests cover the logic.

---

_Verified: 2026-10-17T16:12:00Z_
_Verifier: Claude (gsd-verifier)_
