---
phase: "12"
slug: "consent-analytics-legal"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-15T21:53:00-06:00"
updated: "2026-11-15T21:53:00-06:00"
---

# Phase 12: Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The requirement-to-test map is in `12-RESEARCH.md` § Validation Architecture; this file is the execution contract built from it.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 (MTP v2), Shouldly, NSubstitute, `FakeTimeProvider`, ArchUnitNET. Web: Vitest 5, RTL, MSW 3, in-house axe matcher. E2E: Playwright 1.63 + @axe-core/playwright |
| **Config file** | `tests/Directory.Build.props`, `web/vite.config.*`, `web/playwright.config.ts` |
| **Quick run command** | `dotnet test --project <touched test project> --filter-class "*<Class>*"` (with `CSPS_TEST_SQL=localdb` set for that process only) or `npm --prefix web run test -- --run <touched path>` |
| **Full suite command** | after preflight: `dotnet test Csps.slnx` and `npm --prefix web run verify` |
| **Estimated runtime** | quick ~30 seconds; full suite several minutes |

---

## Sampling Rate

- **After every task commit:** the quick command for the touched test file.
- **After every plan wave:** `dotnet test Csps.slnx` and `npm --prefix web run verify` (after preflight).
- **Before `/gsd-verify-work`:** full suite plus `npm --prefix web run e2e` and `npm --prefix web run lighthouse` green.
- **Max feedback latency:** 60 seconds for the quick command.

---

## Per-Task Verification Map

Filled by the planner per task (each task's `<automated>` verify). Source map: `12-RESEARCH.md` § Phase Requirements → Test Map, rows ANL-01 to ANL-09 and LEGAL-01 to LEGAL-05.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| (planner fills) | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/fixtures/legal-pages.json` and `tests/fixtures/consent-cookie-cases.json` (shared C# and TS fixtures)
- [ ] `web/e2e/fixtures.ts`: a default "decided" consent cookie so Phase 11 specs keep passing; opt-out for `@consent`, `@gpc`, `@visitor-stats`
- [ ] Testing-only analytics seeding (the `TestingFixturesController` pattern, Testing environment only) for E2E ranges older than 13 months
- [ ] E2E server config: raised `RateLimits:AnalyticsCollect` / `Consent` / `AnalyticsClear`
- [ ] Authorization matrix rows, anonymous allow-list entries and idempotency allow-list entries for every new action

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| First public Gallery photo loads on the live site | D-133 carry-over | Needs the owner's live admin login | In live admin add one Gallery photo marked shown; open `/gallery` on a phone; confirm it loads from `res.cloudinary.com` with no CSP error |
| Owner approves each legal page's text | LEGAL-05, D-14 | Owner judgment | Read each page; flip its approved flag in code through a reviewed release |
| Safari and Facebook in-app browser cookie behaviour | ANL-01, ANL-07 | Not reproducible in CI | On a real iPhone and in the Facebook app, accept, revisit after a day, confirm the choice holds |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
