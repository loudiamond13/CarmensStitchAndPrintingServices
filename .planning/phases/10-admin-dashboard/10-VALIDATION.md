---
phase: "10"
slug: "admin-dashboard"
# status lifecycle: draft (seeded by plan-phase) to validated (set by validate-phase §6)
status: validated
nyquist_compliant: true
wave_0_complete: true
created: "2026-11-05T14:15:00-06:00"
updated: "2026-11-10T08:00:00-06:00"
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

Requirement-level map, audited 2026-11-10 at HEAD 6196cad0. Every listed test file exists and the runs below were green.

| Requirement | Behavior | Test Type | Automated Command | Status |
|-------------|----------|-----------|-------------------|--------|
| DASH-01 | Greeting, today in Manila, landing on `/admin` | integration + component + e2e | `*DashboardSummaryEndpointTests` · `DashboardPage.test.tsx` · `routes.test.tsx` · `dashboard.spec.ts` | ✅ (e2e runs in CI) |
| DASH-02 | KPI cards per C-40 and D-52 to D-55 | integration + unit + component | `*DashboardReaderTests` · `*GetDashboardSummaryHandlerTests` · `DashboardPage.test.tsx` | ✅ |
| DASH-03 | Chart 6/12 months, profit line, URL range | integration + component | `*DashboardChartEndpointTests` · `IncomeExpenseChart.test.tsx` · `useDashboardRange.test.tsx` | ✅ |
| DASH-04 | Orders by status, active total | component | `OrdersByStatusCard.test.tsx` | ✅ |
| DASH-05 | 6 newest orders link to detail | integration + component | `*DashboardReaderTests` · `RecentOrdersCard.test.tsx` | ✅ |
| DASH-06 | Skeleton, empty, error with retry per card; axe clean | component | `DashboardPage.test.tsx` | ✅ |
| MONEY-01 | Server-computed money on hand | unit + integration | `*MoneyOnHandTests` · `*StaffMoneyReaderTests` · `*StaffMoneyBalanceTests` | ✅ |
| MONEY-02 | Ledger with running balance and paging | unit + integration + component | `*LedgerRunningBalanceTests` · `*StaffLedgerQueryTests` · `LedgerTable.test.tsx` | ✅ |
| MONEY-03 | Admin own only (403 others), Manager all | integration + component | `*StaffMoneyAccessTests` · `StaffMoneyPage.test.tsx` | ✅ |
| MONEY-04 | Transfer rules, idempotent create, zod mirror | unit + integration + component | `*MoneyTransferTests` · `*MoneyTransferEndpointTests` · `*MoneyTransferAttributionTests` · `moneySchemas.test.ts` · `TransferModal.test.tsx` | ✅ |
| MONEY-05 | Never overdraw under concurrency (D-53 race test) | integration | `*MoneyTransferConcurrencyTests` · `*DatabaseLocksMigrationTests` | ✅ |
| MONEY-06 | Manager-only delete with version, audit (D-52) | integration + unit | `*MoneyTransferDeletionTests` · `*AuditChangeLinesTests` · `auditCopy.test.ts` | ✅ |
| MONEY-07 | No edit route | integration | `*MoneyTransferRoutesTests` (PUT and PATCH answer 405 or 404 and change nothing) · `*AuthorizationCoverageTests` | ✅ |
| MONEY-08 | Matrix rows for every new endpoint | integration | `*AuthorizationMatrixTests` (13 new rows) | ✅ |

### Audit runs (2026-11-10, after preflight: ports free, no dev or test processes)

| Suite | Command | Result |
|-------|---------|--------|
| Domain Money | `dotnet test --project tests/Csps.Domain.UnitTests --filter-namespace Csps.Domain.UnitTests.Money` | 54 passed, 0 failed |
| Application Money | `--filter-namespace Csps.Application.UnitTests.Money` | 225 passed, 0 failed |
| Application Dashboard | `--filter-namespace Csps.Application.UnitTests.Dashboard` | 72 passed, 0 failed |
| Application audit lines | `--filter-class *AuditChangeLinesTests` | 71 passed, 0 failed |
| Infrastructure Money / Dashboard (LocalDB) | `--filter-namespace ...Money` · `...Dashboard` | 43 and 21 passed, 0 failed |
| Infrastructure migrations (LocalDB) | `*MoneyTransfersMigrationTests` · `*DatabaseLocksMigrationTests` | 13 and 3 passed, 0 failed |
| Server Money / Dashboard (LocalDB) | `--filter-namespace Csps.Server.IntegrationTests.Money` · `...Dashboard` | 163 and 27 passed, 0 failed |
| Server authorization (LocalDB) | `*AuthorizationMatrixTests` · `*AuthorizationCoverageTests` | 407 and 13 passed, 0 failed |
| Web components | `npx vitest run --maxWorkers=2` on the 11 web files in the map | 11 files, 415 tests passed |

Not run here: Playwright e2e (`dashboard.spec.ts`, `money.spec.ts`) and parity snapshots. They run on the phase PR's CI (UAT tests 18 and 19).

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs`: the `Concat` ledger spike against LocalDB (assumptions A1, A2). First; it decides the ledger query shape
- [x] `tests/Csps.Infrastructure.IntegrationTests/Money/StaffMoneyReaderTests.cs`
- [x] `tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs`
- [x] `tests/Csps.Infrastructure.IntegrationTests/Persistence/MoneyTransfersMigrationTests.cs`
- [x] Domain, Application and Server test folders for Money and Dashboard
- [x] Transfer test client helper (create with key, delete with version)
- [x] Web fixtures `web/src/test/dashboardFixtures.ts`, `moneyFixtures.ts` and MSW handlers
- [x] e2e `dashboard.spec.ts`, `money.spec.ts`; update `admin.spec.ts`, `admin-keyboard.spec.ts`, `motion.spec.ts`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Chart reads well on a real phone | DASH-03 (D-51) | Visual judgement | Open the dashboard at 320 px and 375 px with 12 months; month labels skip every other one and text stays readable |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** Nyquist audit passed 2026-11-10 (no gaps). Phase sign-off stays with the owner (P10-BL-20).

## Validation Audit 2026-11-10

| Metric | Count |
|---|---|
| Gaps found | 0 |
| Resolved | 0 |
| Escalated | 0 |
