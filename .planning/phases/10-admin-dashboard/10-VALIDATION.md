---
phase: "10"
slug: "admin-dashboard"
# status lifecycle: draft (seeded by plan-phase) to validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-11-05T14:15:00-06:00"
updated: "2026-11-05T14:15:00-06:00"
---

# Phase 10: Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `10-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 on Microsoft.Testing.Platform, Shouldly, NSubstitute, Respawn. Web: Vitest, RTL, MSW, Playwright |
| **Config file** | `global.json`, `web/vitest.config.ts`, `web/playwright.config.ts` |
| **Quick run command** | `dotnet test --project tests/<Project> --filter-class "*<Class>"` · `npm --prefix web run test -- --run <path>` |
| **Full suite command** | preflight (`powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`), then `dotnet test --solution Csps.slnx` (`CSPS_TEST_SQL=localdb` in that process only), `npm --prefix web run verify`, `npm --prefix web run e2e` |
| **Estimated runtime** | quick ~30-90 seconds; full several minutes |

---

## Sampling Rate

- **After every task commit:** the quick command for the touched test class or file
- **After every plan wave:** the .NET project suites the wave touched, plus `npm --prefix web run test -- --run` for touched folders
- **Before `/gsd-verify-work`:** full suite must be green (after preflight)
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

Filled from the PLAN.md files once planning finishes. Requirement-level map:

| Requirement | Behavior | Test Type | Automated Command | File Exists |
|-------------|----------|-----------|-------------------|-------------|
| DASH-01 | Greeting, today in Manila, landing on `/admin` | integration + component + e2e | `*DashboardSummaryEndpointTests` · `DashboardPage.test.tsx` · `routes.test.tsx` · `dashboard.spec.ts` | ❌ W0 / ✅ extend |
| DASH-02 | KPI cards per C-40 and D-52 to D-55 | integration + unit + component | `*DashboardReaderTests` · `*GetDashboardSummaryHandlerTests` · `DashboardPage.test.tsx` | ❌ W0 |
| DASH-03 | Chart 6/12 months, profit line, URL range | integration + component | `*DashboardChartEndpointTests` · `IncomeExpenseChart.test.tsx` · `useDashboardRange.test.tsx` | ❌ W0 / ✅ extend |
| DASH-04 | Orders by status, active total | component | `OrdersByStatusCard.test.tsx` | ❌ W0 |
| DASH-05 | 6 newest orders link to detail | integration + component | `*DashboardReaderTests` · `RecentOrdersCard.test.tsx` | ❌ W0 |
| DASH-06 | Skeleton, empty, error with retry per card; axe clean | component | `DashboardPage.test.tsx` | ❌ W0 |
| MONEY-01 | Server-computed money on hand | unit + integration | `*MoneyOnHandTests` · `*StaffMoneyReaderTests` · `*StaffMoneyBalanceTests` | ❌ W0 |
| MONEY-02 | Ledger with running balance and paging | unit + integration + component | `*LedgerRunningBalanceTests` · `*StaffLedgerQueryTests` (spike first) · `LedgerTable.test.tsx` | ❌ W0 |
| MONEY-03 | Admin own only (403 others), Manager all | integration + component | `*StaffMoneyAccessTests` · `StaffMoneyPage.test.tsx` | ❌ W0 |
| MONEY-04 | Transfer rules, idempotent create, zod mirror | unit + integration + component | `*MoneyTransferTests` · `*MoneyTransferEndpointTests` · `*MoneyTransferAttributionTests` · `moneySchemas.test.ts` · `TransferModal.test.tsx` | ❌ W0 |
| MONEY-05 | Never overdraw under concurrency (D-53 race test) | integration | `*MoneyTransferConcurrencyTests` · `*DatabaseLocksMigrationTests` (66 to 67) | ❌ W0 / ✅ update |
| MONEY-06 | Manager-only delete with version, audit (D-52) | integration + unit | `*MoneyTransferDeletionTests` · `*AuditChangeLinesTests` · `auditCopy.test.ts` | ❌ W0 / ✅ extend |
| MONEY-07 | No edit route | integration | `*AuthorizationCoverageTests` + route-absence assertion | ✅ / ❌ |
| MONEY-08 | Matrix rows for every new endpoint | integration | `*AuthorizationMatrixTests` | ✅ add rows |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs`: the `Concat` ledger spike against LocalDB (assumptions A1, A2). First; it decides the ledger query shape
- [ ] `tests/Csps.Infrastructure.IntegrationTests/Money/StaffMoneyReaderTests.cs`
- [ ] `tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs`
- [ ] `tests/Csps.Infrastructure.IntegrationTests/Persistence/MoneyTransfersMigrationTests.cs`
- [ ] Domain, Application and Server test folders for Money and Dashboard
- [ ] Transfer test client helper (create with key, delete with version)
- [ ] Web fixtures `web/src/test/dashboardFixtures.ts`, `moneyFixtures.ts` and MSW handlers
- [ ] e2e `dashboard.spec.ts`, `money.spec.ts`; update `admin.spec.ts`, `admin-keyboard.spec.ts`, `motion.spec.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chart reads well on a real phone | DASH-03 (D-51) | Visual judgement | Open the dashboard at 320 px and 375 px with 12 months; month labels skip every other one and text stays readable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
