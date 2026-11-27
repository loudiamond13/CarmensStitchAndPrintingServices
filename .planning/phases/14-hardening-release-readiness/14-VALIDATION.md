---
phase: "14"
slug: "hardening-release-readiness"
# status lifecycle: draft (seeded by plan-phase) -> validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-27T00:25:00-06:00"
updated: "2026-11-27T08:10:00-06:00"
---

# Phase 14: Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `14-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 on Microsoft.Testing.Platform, Shouldly, ArchUnitNET. Web: Vitest 5.0.4 (jsdom), RTL, in-house axe matcher. E2E: Playwright 1.63.0 (seven projects) |
| **Config file** | `global.json`, `tests/Directory.Build.props`; `web/vitest.config.ts`; `web/playwright.config.ts` |
| **Quick run command** | One .NET test class (`dotnet test --project <project> --filter-class "*<Class>"`) or one Vitest file (`npm --prefix web run test -- --run <file>`) |
| **Full suite command** | `dotnet test --solution Csps.slnx` (CSPS_TEST_SQL=localdb, after preflight); `npm --prefix web run verify`; `npm --prefix web run e2e` (after preflight) |
| **Estimated runtime** | Quick: under 60 s. Full .NET + verify: about 10 min. Full e2e: longer; run in the background |

---

## Sampling Rate

- **After every task commit:** the quick command for the touched file or class.
- **After every plan wave:** `npm --prefix web run verify` and `dotnet test --solution Csps.slnx` (localdb, after preflight).
- **Before `/gsd-verify-work`:** full e2e green on every project (D-25), CodeQL zero open alerts, ZAP CI run green with every alert given an outcome, live audit results quoted.
- **Max feedback latency:** 60 seconds for the quick command.

---

## Per-Requirement Verification Map

The planner fills the task IDs. Each row maps to a test from the research map.

| Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|-------------|----------|-----------|-------------------|-------------|--------|
| SEC-05 | Every row of `security-review.md` names a test that exists | arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*SecurityReviewDocTests"` | ❌ W0 | ⬜ pending |
| SEC-05 | `zap.yml` shape: no permissions, digest-pinned image, passive only, Production host step, gitleaks on report; `weekly.yml` calls it | arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*ZapWorkflowTests"` | ❌ W0 | ⬜ pending |
| SEC-05 | `live-audit.yml`: manual dispatch, main only, signed out, passive, seven pages | arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*LiveAuditWorkflowTests"` | ❌ W0 | ⬜ pending |
| SEC-05 | ZAP request list is GET-only under `/api/v1` | unit (node) | `npm --prefix web run test -- --run scripts/zap-requests.test.ts` | ❌ W0 | ⬜ pending |
| SEC-05 / D-36 | CI sign-in tool refuses any non-loopback database | unit/arch | planner names the class | ❌ W0 | ⬜ pending |
| SEC-05 / D-38 | `deploy.mjs` refuses a SHA with no green `zap.yml` run | unit (node) | planner names the file | ❌ W0 | ⬜ pending |
| SEC-05 / D-39 | `deploy.mjs` keeps certificate validation on and the SHA-256 pin | unit (node) | planner names the file | ❌ W0 | ⬜ pending |
| SEC-05 / D-06 | `AnalyticsBots.IsBot` true for the ZAP and Lighthouse user agents | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AnalyticsBotsTests"` | ✅ extend | ⬜ pending |
| SEC-05 / D-23 | `/openapi/v1.json` and `/scalar` return 404 in Production | integration | `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiExposureTests"` | ✅ | ⬜ pending |
| SEC-05 | Security headers (X-Frame-Options if chosen) | integration | `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SecurityHeadersTests"` | ✅ extend | ⬜ pending |
| PERF-06 | Plugin options: `manifest: false`, `navigateFallback: null`, no `/api` route, `/admin` scope, `injectRegister: false` (D-42) | unit (node) | `npm --prefix web run test -- --run scripts/pwa-config.test.ts` | ❌ W0 | ⬜ pending |
| PERF-06 | Built `sw.js` precaches only static assets, icons and the shell | unit (node, post-build) | `npm --prefix web run test -- --run scripts/pwa-build.test.ts` | ❌ W0 | ⬜ pending |
| PERF-06 | Manifest values and icon sizes | unit (node) | `npm --prefix web run test -- --run scripts/pwa-icons.test.ts` | ❌ W0 | ⬜ pending |
| PERF-06 | Admin documents carry manifest link and app tags; public documents do not | integration | `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ShellPageTests"` | ✅ extend | ⬜ pending |
| PERF-06 | Manifest and `sw.js` served with the right type and `no-cache` | integration | `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*SpaHostTests"` | ✅ extend | ⬜ pending |
| PERF-06 | No public chunk holds `virtual:pwa-register` or `workbox-window` | unit (budget) | `npm --prefix web run test -- --run scripts/budget.test.ts` | ✅ extend | ⬜ pending |
| PERF-06 | `useAppUpdate`: banner, skip-waiting, `onNeedReload` behavior, hourly throttle | unit | `npm --prefix web run test -- --run src/modules/admin/hooks/useAppUpdate.test.ts` | ❌ W0 | ⬜ pending |
| PERF-06 | UpdateBanner and OfflineCard announcements, focus, zero axe | component | `npm --prefix web run test -- --run src/modules/admin/components/UpdateBanner.test.tsx src/modules/admin/components/OfflineCard.test.tsx` | ❌ W0 | ⬜ pending |
| PERF-06 | Offline boot check | unit | `npm --prefix web run test -- --run src/modules/admin/guard.test.ts` | ✅ extend | ⬜ pending |
| PERF-06 | E2E: worker scope, no API or authenticated HTML cached, offline screen, update banner, two tabs | e2e | `npm --prefix web run e2e -- --grep @pwa --project chromium` | ❌ W0 | ⬜ pending |
| PERF-07 | UiLink passes `viewTransition` only when supported and motion allowed | unit | `npm --prefix web run test -- --run src/components/actions/links.test.tsx` | ✅ extend | ⬜ pending |
| PERF-07 | `usePrefersReducedMotion` follows media-query changes | unit | `npm --prefix web run test -- --run src/hooks/usePrefersReducedMotion.test.ts` | ❌ W0 | ⬜ pending |
| PERF-07 | E2E: one transition per nav click, none under reduced motion or for filters, drawers, Back and Forward | e2e | `npm --prefix web run e2e -- --grep "@motion\|@view-transitions"` | ✅ extend | ⬜ pending |
| PERF-07 | Motion inventory: every animation recipe has a reduced-motion rule (D-30 spinner kept) | unit (node) | `npm --prefix web run test -- --run src/test/motion-inventory.node.test.ts` | ❌ W0 | ⬜ pending |
| PERF-07 / D-05 | Budgets and CLS after the change; live Lighthouse at least 95 on seven pages (D-44) | build gate + live run | `npm --prefix web run build:budget`; `live-audit.yml` run | ✅ / ❌ W0 | ⬜ pending |
| LEGAL-06 | Runbook shape: timestamps, "the owner", no personal details; data requests cover access, correction, deletion and D-37; breach response covers 72 hours and owner steps | arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*OperationsRunbookTests"` | ❌ W0 | ⬜ pending |
| D-07 / D-40 | Restore drill script guards: fixed server and DB, `_local/` only, VERIFYONLY first, never touches other databases, dummy mail | arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*RestoreDrillScriptTests"` | ❌ W0 | ⬜ pending |
| A11Y-05 | Manual record shape: scripts for the flows, a row per step per reader, an outcome for every fail, `Signed:` line | arch | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*A11yManualRecordTests"` | ❌ W0 | ⬜ pending |
| A11Y-05 | Keyboard journeys | e2e | `npm --prefix web run e2e -- --grep @keyboard` | ✅ partial | ⬜ pending |
| D-25 | Full suite green on all seven projects | e2e | `npm --prefix web run e2e` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/Csps.ArchitectureTests/ZapWorkflowTests.cs`, `LiveAuditWorkflowTests.cs` (reuse `WorkflowText.cs`)
- [ ] `tests/Csps.ArchitectureTests/SecurityReviewDocTests.cs`, `OperationsRunbookTests.cs`, `A11yManualRecordTests.cs`, `RestoreDrillScriptTests.cs`
- [ ] `web/scripts/pwa-config.test.ts`, `pwa-build.test.ts`, `pwa-icons.test.ts`, `zap-requests.test.ts`
- [ ] `web/src/modules/admin/hooks/useAppUpdate.test.ts`, `UpdateBanner.test.tsx`, `OfflineCard.test.tsx`, `web/src/hooks/usePrefersReducedMotion.test.ts`, `web/src/test/motion-inventory.node.test.ts`
- [ ] `web/e2e/pwa.spec.ts` (`@pwa`)
- [ ] A Vitest stub for `virtual:pwa-register`, because the virtual module does not exist when the plugin is off in test mode
- [ ] No framework install needed

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| NVDA and VoiceOver passes on the critical flows | A11Y-05 | Real screen readers on the owner's devices (D-43) | Follow the flow scripts in the a11y record; fill one row per step per reader; sign |
| Owner signs the security checklist | SEC-05 | Owner sign-off | Owner reads `security-review.md` and adds the `Signed:` line |
| Install the admin portal as an app on a phone and a PC | PERF-06 | Real browser install UI | Follow the `docs/operations/` install how-to (D-28) |
| Restore drill of a real backup | D-07 / D-40 | Uses the local production backup in `_local/` | Run the drill script; compare with the live admin counts at backup time |
| CodeQL zero open alerts | SEC-05 | CI evidence | Quote the open-alert count from the GitHub API on the PR |
| Live Lighthouse and live ZAP results | SEC-05 / D-44 | Runs against the live site | Dispatch `live-audit.yml`; quote the results; re-run from the owner's PC if under 95 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency under 60 s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
