---
phase: "03"
slug: "ci-cd-staging-deploy"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-15T20:19:24-05:00"
updated: "2026-10-15T20:19:24-05:00"
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

Filled in by the planner/executor per task. Requirement-level map:

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| OPS-01 | CODEOWNERS, PR template DoD, branch-rules doc, `.gitignore` entries | unit (repo-file lint) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiRepoHygieneTests"` | ❌ W0 | ⬜ pending |
| OPS-01 | Merge gate refuses draft / behind / red / pending / unticked DoD; allows planning-only `[ci skip]` head via parent | unit | `npm --prefix web test -- --run scripts/merge-gate.test.ts` | ❌ W0 | ⬜ pending |
| OPS-02 | `ci.yml` step order, SHA pins, `permissions: {}`, timeouts, `persist-credentials: false`, no injection sinks | unit (text lint) | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiWorkflowTests"` | ❌ W0 | ⬜ pending |
| OPS-02 | E2E harness honors `CSPS_E2E_CONNECTION` for seed and host | unit | `npm --prefix web test -- --run scripts/e2e.test.ts` | ✅ extend | ⬜ pending |
| OPS-02 | Pipeline runs green on ubuntu | integration (real CI) | `gh pr checks <n>` | manual once | ⬜ pending |
| OPS-03 | `dependabot.yml` ecosystems + 14-day cooldown; gitleaks checksum-verified | unit | `CiWorkflowTests` | ❌ W0 | ⬜ pending |
| OPS-04 | msdeploy args and deploy orchestration (offline → sync → online → smoke → release / rollback) | unit | `npm --prefix web test -- --run scripts/deploy.test.ts` | ❌ W0 | ⬜ pending |
| OPS-04 | `deploy.yml` dispatch-only, concurrency, `main` guard, input validation, least privilege | unit | `CiWorkflowTests` | ❌ W0 | ⬜ pending |
| OPS-04 | Smoke checks pass and fail correctly against fake responses | unit | `npm --prefix web test -- --run scripts/smoke.test.ts` | ❌ W0 | ⬜ pending |
| OPS-05 | `web.config` in-process, header removal, `urlCompression` off | unit | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*WebConfigTests"` | ✅ extend | ⬜ pending |
| OPS-05 | Publish output has no `logs/`, no `appsettings.Development.json`, no `app_offline.htm` | unit + CI step | `npm --prefix web test -- --run scripts/package-check.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/Csps.ArchitectureTests/CiWorkflowTests.cs` — workflow and Dependabot text assertions
- [ ] `tests/Csps.ArchitectureTests/CiRepoHygieneTests.cs` — CODEOWNERS, PR template DoD, branch-rules doc
- [ ] `web/scripts/merge-gate.test.ts`, `smoke.test.ts`, `deploy.test.ts`, `package-check.test.ts`
- [ ] Extend `web/scripts/e2e.test.ts` and `WebConfigTests`
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
