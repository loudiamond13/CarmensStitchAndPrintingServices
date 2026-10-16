---
created: "2026-10-15T19:45:00-05:00"
updated: "2026-10-15T19:45:00-05:00"
phase: 03-ci-cd-staging-deploy
kind: discussion-log
---

# Phase 3: CI/CD & Staging Deploy - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md. This log preserves the alternatives considered.

**Date:** 2026-10-15
**Phase:** 03-ci-cd-staging-deploy
**Areas discussed:** First deploy target, Repo visibility & gate, Deploy approval & trigger, CI minutes budget, Cutover-day steps & roles, Public site after switch

Before the areas: the owner asked for a dedicated Phase 3 branch. Base offered: Phase 4 tip (recommended) or `main`. Chosen: Phase 4 tip → `gsd/phase-03-ci-cd-staging-deploy`.

---

## First deploy target

| Option | Description | Selected |
|--------|-------------|----------|
| Free trial host | A free SmarterASP.NET 60-day trial account as a throwaway test host | |
| Build it, keep it dormant | Pipeline built and dry-run; first real deploy at cutover (Phase 17) | |
| Subfolder on live site | CSPS beside legacy; needs the one DB | |

**User's choice (free text):** "lets deploy to the live site. I will save a bak file of the database and will never modify live/legacy data"

| Option | Description | Selected |
|--------|-------------|----------|
| Present but locked | Prod job guarded by a cutover switch | |
| Add it in Phase 17 | Prod job written at cutover | |

**User's choice (free text):** "present not lock. we'll surrender the old site now"

Claude explained the consequences (staff lose legacy order screens until the order phases; Prime Directive 1 override; one shared DB and a likely `AspNetUsers` name collision).

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, replace it now | Owner override of Prime Directive 1 | ✓ |
| Not yet, keep legacy up | Back to dormant or trial host | |

| Option | Description | Selected |
|--------|-------------|----------|
| Own schema `csps` | CSPS tables in a separate schema inside the legacy DB | |
| Fresh SQL 2025 DB | Keep the .bak, delete legacy DB on host, new DB for CSPS only | ✓ |
| Check legacy names first | Restore locally, list table names, then decide | |

| Option | Description | Selected |
|--------|-------------|----------|
| Restore + count locally | Restore to CSPS_Legacy_Restore; table/row-count receipt before delete | ✓ |
| Your backup is enough | No local check | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep legacy files | Download legacy site files for a same-day fallback | ✓ |
| No way back | Fix forward only | |

| Option | Description | Selected |
|--------|-------------|----------|
| Roadmap set + host facts | Roadmap smoke checks + HOSTING-RECORD first-deploy rows; bootstrap manual | ✓ |
| Only health checks | /health + ProblemDetails route | |

---

## Repo visibility & gate

| Option | Description | Selected |
|--------|-------------|----------|
| Public, scrubbed | Enforced rules, CodeQL, secret scanning, unlimited minutes after scrubbing | ✓ (then reversed) |
| Stay private | Honor-system gate, free substitutes, 2,000 minutes | |

Follow-ups (history: fresh public repo vs rewrite; planning docs location) were answered with "Will keep this repo private" and "will keep repo private, dont worry planning folder getting pushed". **Final: private.**

| Option | Description | Selected |
|--------|-------------|----------|
| Checks required, you bypass | Green checks + linear history, 0 approvals, CODEOWNERS for later | ✓ |
| 1 approval required | Blocks solo owner's own PRs | |

Claude checked GitHub (`gh api`): account plan Free, repo private, rulesets endpoint returns 403 "Upgrade to GitHub Pro or make this repository public".

| Option | Description | Selected |
|--------|-------------|----------|
| Process gate | /gsd-ship refuses to merge unless the PR head is green; DoD ticked | ✓ |
| Honor system only | Nothing blocks a merge | |

| Option | Description | Selected |
|--------|-------------|----------|
| D-00 set | Dependabot, gitleaks, NuGetAudit, npm audit, license gates, analyzers | ✓ |
| D-00 set + Semgrep | Adds Semgrep CE (LGPL-2.1 engine, needs a license exception) | |

---

## Deploy approval & trigger

| Option | Description | Selected |
|--------|-------------|----------|
| You press Run | Merge builds the package; deploy only on workflow_dispatch | ✓ |
| Auto on merge | Every merge deploys | |

| Option | Description | Selected |
|--------|-------------|----------|
| No limit, show a notice | app_offline.htm during the deploy | ✓ |
| Quiet hours only | Refuse outside a Manila-time window | |

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-redeploy previous | Redeploy last good package on smoke failure | ✓ |
| Stop and alert only | Leave new build up | |

---

## CI minutes budget

| Option | Description | Selected |
|--------|-------------|----------|
| Full gate, draft PRs skip | Full pipeline on ready PRs; fast part on drafts; cancel superseded runs; docs-only skip | ✓ |
| Fast gate per push, full at ready | Slow part only at ready or by label | |

| Option | Description | Selected |
|--------|-------------|----------|
| Chromium on PRs, all 3 weekly | Chromium + phone viewport per PR; 3 engines weekly | ✓ |
| All 3 on every PR | About 3× Playwright minutes | |

| Option | Description | Selected |
|--------|-------------|----------|
| Stop, run gate locally | $0 spending limit; local full gate pasted in PR | ✓ |
| Allow small overage | Breaks D-00 | |

---

## More gray areas offered

Offered: Cutover-day steps & roles, Staff orders meanwhile, Public site after switch, Old links & SEO. Chosen: Cutover-day steps & roles, Public site after switch.

## Public site after switch

| Option | Description | Selected |
|--------|-------------|----------|
| Simple holding page | Branded page with name, "new website on the way", phone, Facebook, address, hours | ✓ |
| Placeholder as is | Keep the current placeholder | |
| Pull Phase 11 forward | Build real public pages first | |

## Cutover-day steps & roles

| Option | Description | Selected |
|--------|-------------|----------|
| You on panel, me on runbook | Owner does panel steps and pastes results; Claude writes runbook and verifies | ✓ |
| You do it all from a list | Owner runs every step | |

| Option | Description | Selected |
|--------|-------------|----------|
| When Phase 3 is ready | Switch once pipeline and runbook are verified | ✓ |
| A quiet evening | Low-traffic Manila evening | |

---

## Claude's Discretion

Workflow file layout and job split, merge-gate script implementation, deploy runner choice, last-good-package storage, `web.config` contents, smoke test implementation.

## Deferred Ideas

- Staff order recording between the switch and the order phases (not discussed)
- Old legacy URLs and SEO (not discussed)
- Going public later (needs a fresh scrubbed repo)
- Roadmap amendments: Phase 3 title, OPS-04, Prime Directive 1, Phases 16/17
