---
phase: "03"
slug: "ci-cd-staging-deploy"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-15T20:19:24-05:00"
updated: "2026-10-15T21:37:00-05:00"
---

# Phase 03 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `03-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | xunit.v3 on MTP (.NET) with Shouldly; Vitest (web + `web/scripts`); Node `--test` (tools/openapi-gen) |
| **Config file** | `global.json` (MTP runner), `web/vitest.config.ts` (includes `scripts/**/*.test.ts`) |
| **Quick run command** | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiWorkflowTests"` · `npm --prefix web test -- --run scripts/merge-gate.test.ts` |
| **Full suite command** | `dotnet test --solution Csps.slnx` and `npm --prefix web run verify` (run the shared-machine preflight first) |
| **Estimated runtime** | ~30 seconds quick; several minutes full |

---

## Sampling Rate

- **After every task commit:** the quick command for the touched area (CiWorkflowTests, CiRepoHygieneTests or the specific vitest file)
- **After every plan wave:** full suite command (preflight first); once the workflow exists, the PR's `gate` check
- **Before `/gsd-verify-work`:** full local gate green plus a green `gate (full)` on the Phase 3 PR
- **Max feedback latency:** 60 seconds for quick commands

---

## Per-Task Verification Map

Filled in by the planner (2026-10-15); execution updates status. The research's `CiRepoHygieneTests` became `RepoRulesTests` (03-05), `HygieneWorkflowTests` (03-10, 03-15), `DeployWorkflowTests` (03-12) and `CutoverRunbookTests` (03-14), each created by the plan that owns its files.

| Requirement | Behavior | Test Type | Automated Command | Plan · Task | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|-------------|--------|
| OPS-02 | Every workflow: approved full-SHA pins, `permissions: {}`, timeouts, `persist-credentials: false`, no `pull_request_target`, no injection sinks, pinned runners; ci.yml triggers, concurrency, .NET stage order | unit (text lint) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiWorkflowTests"` | 03-01 T3; extended 03-11 T1-T3, 03-13 T2 | ❌ W0 (03-01) | ⬜ pending |
| OPS-02 | Draft PR shows `gate (fast)` pass on GitHub | integration (real CI) | `gh pr checks gsd/phase-03-ci-cd-staging-deploy --json name,bucket` | 03-01 T3, 03-11 T1 | n/a | ⬜ pending |
| OPS-02 | E2E seed and host follow `CSPS_E2E_CONNECTION`; LocalDB default unchanged | unit + E2E | `npm --prefix web test -- --run scripts/e2e.test.ts`; `npm --prefix web run e2e -- --grep @smoke --project chromium` | 03-02 T1 | ✅ extend | ⬜ pending |
| OPS-02 | Coverage gate runs with Linux-safe paths | integration (local) | `powershell -NoProfile -ExecutionPolicy Bypass -File tools/scripts/Invoke-CoverageGate.ps1` | 03-02 T2 | ✅ | ⬜ pending |
| OPS-02 | CI modes docs/fast/full/package; empty diff is full; proven-tree reuse on main | unit + CLI | `npm --prefix web test -- --run scripts/ci-classify.test.ts` | 03-04 T1-T2 | ❌ W0 | ⬜ pending |
| OPS-02 | Full OPS-02 order, verify.mjs order kept, audits before build, CI container loopback with generated password, weekly all engines | unit (text lint) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiWorkflowTests"` | 03-11 T1-T3 | ❌ (03-01) | ⬜ pending |
| OPS-02 | Ready Phase 3 PR passes `gate (full)` and every Hygiene check on GitHub | integration (real CI) | `gh pr checks gsd/phase-03-ci-cd-staging-deploy --json name,bucket` | 03-16 T2 | n/a | ⬜ pending |
| OPS-01 | Merge gate refuses draft, behind, conflicting, red, pending, zero checks, unticked DoD; `[ci skip]` rule; local-gate mode | unit + real read-only gh | `npm --prefix web test -- --run scripts/merge-gate.test.ts`; `node web/scripts/merge-gate.mjs 3` (exit 1) | 03-03 T2-T3 | ❌ W0 | ⬜ pending |
| OPS-01 | CODEOWNERS, PR template DoD and local-gate sections, .gitignore PRD entries, branch-rules doc, ruleset JSON, CLAUDE.md merge rule | unit (repo-file lint) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*RepoRulesTests"` | 03-05 T1-T2 | ❌ W0 | ⬜ pending |
| OPS-01 | Conventional Commits on PR title and commits | unit + CLI on this branch | `npm --prefix web test -- --run scripts/commit-lint.test.ts` | 03-15 T1 | ❌ W0 | ⬜ pending |
| OPS-03 | Dependabot nuget, npm (two manifests), github-actions with cooldown 14 | unit | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*RepoRulesTests"` | 03-05 T3 | ❌ W0 | ⬜ pending |
| OPS-03 | gitleaks pinned and checksum-verified in CI and locally; narrow allowlist; hook | unit + local scan | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*HygieneWorkflowTests"` | 03-10 T1-T2 | ❌ W0 | ⬜ pending |
| OPS-03 | actionlint and zizmor jobs (as approved) | unit + local actionlint | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*HygieneWorkflowTests"` | 03-15 T2 | ❌ (03-10) | ⬜ pending |
| OPS-04 | msdeploy args, deploy plan, redaction, rollback, first deploy, online, probe, last-good selection | unit + `--plan` CLI | `npm --prefix web test -- --run scripts/deploy.test.ts` | 03-06 T2-T3 | ❌ W0 | ⬜ pending |
| OPS-04 | Smoke checks pass and fail correctly; local API tracer run | unit + local | `npm --prefix web test -- --run scripts/smoke.test.ts` | 03-07 T1-T2 | ❌ W0 | ⬜ pending |
| OPS-04 | deploy.yml dispatch-only, main-only, least privilege, no cancel, env-only inputs; offline page self-contained and never shipped | unit (text lint) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*DeployWorkflowTests"` | 03-12 T1-T2 | ❌ W0 | ⬜ pending |
| OPS-04 | Package built only on push to main with migrations script, content check, secret scan | unit + local package | `npm --prefix web test -- --run scripts/package-check.test.ts`; `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiWorkflowTests"` | 03-13 T1-T2 | ❌ W0 | ⬜ pending |
| OPS-04 | Receipt script guards; runbook shape and host-setting names | unit + guard run | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CutoverRunbookTests"` | 03-14 T2-T3 | ❌ W0 | ⬜ pending |
| OPS-04 | Holding page (D-17): facts, axe, OR-4, budgets, Lighthouse, every public path | unit + E2E + Lighthouse | `npm --prefix web test -- --run src/modules/public/pages/HoldingPage.test.tsx scripts/budget.test.ts`; `npm --prefix web run e2e -- --grep "@smoke\|@public"`; `npm --prefix web run lighthouse` | 03-09 T2-T3 | ❌ W0 | ⬜ pending |
| OPS-04 | Pipeline merged; main CI builds `csps-package-<sha>` | integration (real CI) | `gh run list --workflow ci.yml --branch main --limit 1 --json conclusion` | 03-17 T2 | n/a | ⬜ pending |
| OPS-04 | Dry run, first deploy, release, live smoke | integration (live, owner Run) | `gh run list --workflow deploy.yml --limit 1 --json conclusion`; `node web/scripts/smoke.mjs --origin <SITE_ORIGIN>` | 03-20 T2, 03-21 T2, 03-22 T2 | n/a | ⬜ pending |
| OPS-05 | web.config in-process, banners removed, body limit, `urlCompression` off, no rewrite until proven | unit + publish | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*WebConfigTests"` | 03-08 T1 | ✅ extend | ⬜ pending |
| OPS-05 | win-x64 publish has no logs or Development settings; locked restore with win-x64 | unit (Release publish) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*PublishOutputTests"`; `dotnet restore Csps.slnx --locked-mode` | 03-08 T2 | ❌ W0 | ⬜ pending |
| OPS-05 | HOSTING-RECORD rows (database, probe facts, smoke facts, sign-in facts) Verified and secret-free | unit (doc lint) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*HostingRecordTests"` | 03-19 T3, 03-20 T2, 03-21 T3, 03-22 T2 | ✅ | ⬜ pending |
| OPS-04 | Owner-approved wording applied: Phase 3 title and goal, success criteria, OPS-04 line and the Prime Directive 1 override match D-01 to D-19; GSD still resolves Phase 3, its requirement IDs and its branch | doc check (GSD lookups + region-scoped grep) | `node ~/.claude/gsd-core/bin/gsd-tools.cjs query roadmap.get-phase 3 --pick phase_name`; `grep -E '^- \[.\] \*\*OPS-04\*\*' .planning/REQUIREMENTS.md \| grep -ci staging` (prints 0) | 03-23 T2 | n/a | ⬜ pending |
| OPS-01 | Phases 16 and 17, MIG-04, MIG-08, CUT-02, OPS-01 and the remaining legacy-retirement text carry the approved wording; phase set still 17 | doc check (GSD lookups + region-scoped grep) | `node ~/.claude/gsd-core/bin/gsd-tools.cjs query roadmap.get-phase 16 --pick section \| grep -ci staging` (prints 0); `node ~/.claude/gsd-core/bin/gsd-tools.cjs query roadmap.milestone-scope --pick phase_count` (prints 17) | 03-23 T3 | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/Csps.ArchitectureTests/CiWorkflowTests.cs` + `WorkflowText.cs` — workflow text assertions (03-01)
- [ ] `tests/Csps.ArchitectureTests/RepoRulesTests.cs` — CODEOWNERS, PR template DoD, branch rules, Dependabot (03-05)
- [ ] `tests/Csps.ArchitectureTests/HygieneWorkflowTests.cs` (03-10), `DeployWorkflowTests.cs` (03-12), `CutoverRunbookTests.cs` (03-14), `PublishOutputTests.cs` (03-08)
- [ ] `web/scripts/merge-gate.test.ts`, `ci-classify.test.ts`, `smoke.test.ts`, `deploy.test.ts`, `package-check.test.ts`, `commit-lint.test.ts`
- [ ] Extend `web/scripts/e2e.test.ts`, `web/scripts/budget.test.ts` and `WebConfigTests`
- [ ] Framework install: none (no new test packages)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Pipeline green on ubuntu | OPS-02 | Needs a real GitHub Actions run | Open the Phase 3 PR; `gh pr checks <n>` shows `gate (full)` pass |
| Real deploy + smoke on the host | OPS-04 | Needs owner credentials and approval | Owner presses Run on `deploy.yml`; the run log and HOSTING-RECORD rows move to Verified |
| gitleaks pre-commit blocks a planted fake key | OPS-03 | Local hook behavior | Owner commits a fake key once and sees the block |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
