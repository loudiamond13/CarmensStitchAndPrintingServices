---
phase: "06"
slug: "company-expenses"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-10-25T03:08:22-05:00"
updated: "2026-10-25T04:27:00-05:00"
---

# Phase 06: Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Source: `06-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 on MTP, Shouldly, NSubstitute, FakeTimeProvider, Respawn, ArchUnitNET, coverlet.MTP. Web: Vitest + RTL + jsdom + in-house axe matcher, MSW, Playwright + @axe-core/playwright |
| **Config file** | `global.json`, `web/vitest.config.ts`, `web/src/test/setup.ts`, `web/playwright.config.ts` |
| **Quick run command** | `dotnet test --project tests/<Project> --filter-class "*<Class>"` · `npm --prefix web run test -- --run <path>` |
| **Full suite command** | preflight, then `dotnet test --solution Csps.slnx` (`CSPS_TEST_SQL=localdb` in that process only), `tools/scripts/Invoke-CoverageGate.ps1`, `npm --prefix web run verify`, `npm --prefix web run e2e` |
| **Estimated runtime** | ~30 s per filtered class; full suite several minutes |

---

## Sampling Rate

- **After every task commit:** the touched class via `--filter-class`, or `npm --prefix web run test -- --run <path>`
- **After every plan wave:** preflight, `dotnet test --solution Csps.slnx`, `npm --prefix web run verify`
- **Before `/gsd-verify-work`:** full suite, coverage gate and e2e on all engines must be green, zero warnings
- **Max feedback latency:** ~60 seconds per task check

---

## Per-Task Verification Map

One row per planned task (19 plans, 50 tasks). Task IDs are `{plan}-T{n}`. Every row has an automated command; "❌" means the plan creates the test file. Commands assume the repository root as the working directory.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-T1 | 06-01 | 1 | CEXP-02 (D-08, D-09, D-13, D-15) | T-06-02, T-06-03 | Seeded categories readable by staff only; reseed after Respawn; no trigger | integration + unit | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListExpenseCategoriesEndpointTests"` | ❌ | ⬜ pending |
| 06-01-T2 | 06-01 | 1 | CEXP-05 (D-32) | T-06-01, T-06-04 | Staff lookup returns names only; blocked or invited people never listed | integration + unit | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*StaffLookupEndpointTests"` | ❌ | ⬜ pending |
| 06-01-T3 | 06-01 | 1 | CEXP-02 (D-27) | T-06-05 | Audit detail format carries no description or notes text; under 400 characters | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*AuditDetailFormatTests"` | ❌ | ⬜ pending |
| 06-02-T1 | 06-02 | 2 | CEXP-02 (D-01, D-33) | T-06-07 | Schema with soft-delete filter, amount check and index set; POST and GET | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CreateCompanyExpenseEndpointTests"` | ❌ | ⬜ pending |
| 06-02-T2 | 06-02 | 2 | CEXP-02, CEXP-05 (D-11, D-19, D-20, D-21, D-32) | T-06-07, T-06-09 | Amount > 0 and ≤ ₱1,000,000.00; date ≤ today+30; payer must be signed-in staff | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*CompanyExpenseTests"` | ❌ | ⬜ pending |
| 06-02-T3 | 06-02 | 2 | CEXP-04 (D-27, SEC-06, SEC-08) | T-06-06, T-06-08, T-06-10 | Forged attribution ignored; duplicate POST makes one row; add audited without text | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CompanyExpenseAttributionTests"` | ❌ | ⬜ pending |
| 06-03-T1 | 06-03 | 3 | CEXP-01 (D-23, D-25) | T-06-12 | Default window from the business today; total over every page; deleted rows excluded | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListCompanyExpensesEndpointTests"` | ❌ | ⬜ pending |
| 06-03-T2 | 06-03 | 3 | CEXP-01, CEXP-05 (D-19, D-26) | T-06-11, T-06-13 | Search treats `%`, `_`, `[` literally; never searches notes; caps enforced | integration + unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ListCompanyExpenses*"` | ❌ | ⬜ pending |
| 06-03-T3 | 06-03 | 3 | CEXP-01 (e2e seeding) | T-06-14 | Testing endpoint exists only in Debug Testing builds and stores the requested recorder (post-save stamp) | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*TestingExpensesTests"` | ❌ | ⬜ pending |
| 06-04-T1 | 06-04 | 4 | CEXP-01 (D-25) | T-06-17, T-06-18 | Real page replaces the dev preview; footer total from the server | component + E2E | `npm --prefix web run e2e -- --grep @expenses-list` | ❌ | ⬜ pending |
| 06-04-T2 | 06-04 | 4 | CEXP-04, CEXP-05 (D-08, D-13, D-16, D-23) | T-06-16 | Text-only rendering; stored tones; Upcoming from server today | component | `npm --prefix web run test -- --run src/components/status/status.test.tsx src/modules/admin/pages/ExpensesPage.test.tsx` | ✅ / ❌ | ⬜ pending |
| 06-05-T1 | 06-05 | 4 | CEXP-03 (D-24) | T-06-19, T-06-20 | 2026-10-31T23:00Z counts as November (Manila); deleted rows never count | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CompanyExpenseKpisEndpointTests"` | ❌ | ⬜ pending |
| 06-05-T2 | 06-05 | 4 | CEXP-03 | T-06-19 | Ties A to Z; empty month; AwayFromZero share | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CompanyExpenseKpisTests"` | ❌ | ⬜ pending |
| 06-06-T1 | 06-06 | 5 | PERF-04 | T-06-21 | Fixed command count at page size 10 and 100; compiled detail and KPI queries | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CompanyExpenseReaderQueryCountTests"` | ❌ W0 | ⬜ pending |
| 06-06-T2 | 06-06 | 5 | PERF-04 (D-28) | T-06-21, T-06-22 | p95 < 300 ms on ~5 years of fake data in its own database | timing | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ExpenseListTimingTests"` | ❌ W0 | ⬜ pending |
| 06-07-T1 | 06-07 | 5 | CEXP-01 (WEB-10) | T-06-23 | Search capped at 100, in the URL, debounced | hook + component | `npm --prefix web run test -- --run src/modules/admin/hooks/useExpensesListParams.test.tsx src/modules/admin/pages/ExpensesPage.test.tsx` | ❌ / ✅ | ⬜ pending |
| 06-07-T2 | 06-07 | 5 | CEXP-01 (D-11, D-15, D-23) | T-06-23 | Allow-list parsers for category and dates; pair rule | unit + component | `npm --prefix web run test -- --run src/lib/url-state/parsers.test.ts src/modules/admin/expensesSchemas.test.ts` | ✅ / ❌ | ⬜ pending |
| 06-07-T3 | 06-07 | 5 | CEXP-01 (WEB-10) | T-06-24 | List → Back restores filters and rows | E2E | `npm --prefix web run e2e -- --grep @expenses-filters` | ❌ | ⬜ pending |
| 06-08-T1 | 06-08 | 5 | CEXP-02, CEXP-04 | T-06-26 | PUT with row version; no retry on form saves | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*UpdateCompanyExpenseEndpointTests"` | ❌ | ⬜ pending |
| 06-08-T2 | 06-08 | 5 | CEXP-02, CEXP-05 (SEC-07, D-26, D-11) | T-06-25, T-06-26 | Stale rowversion gives 409 `edit.stale`; Admin edits only own (recorded or paid) | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CompanyExpenseConcurrencyTests"` | ❌ | ⬜ pending |
| 06-08-T3 | 06-08 | 5 | CEXP-04, CEXP-05 (D-27, SEC-08) | T-06-27, T-06-28, T-06-29 | Forged attribution ignored on update; payer change audited separately; names survive deletion | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CompanyExpensePayerTests"` | ❌ | ⬜ pending |
| 06-09-T1 | 06-09 | 6 | CEXP-03 (D-24) | T-06-30 | KPI cards show server figures only | component + E2E | `npm --prefix web run e2e -- --grep @expenses-kpis` | ❌ | ⬜ pending |
| 06-09-T2 | 06-09 | 6 | CEXP-03 (OR-4) | T-06-30 | Empty Top category uses EmptyValue; KPI failure never blocks the list | component | `npm --prefix web run test -- --run src/components/money/money.test.tsx src/modules/admin/pages/ExpensesPage.test.tsx` | ✅ | ⬜ pending |
| 06-10-T1 | 06-10 | 6 | CEXP-02 (D-01, D-02, D-31) | T-06-31, T-06-32 | Soft delete hides from list, total, KPIs; Admin 403 | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CompanyExpenseDeletionTests"` | ❌ | ⬜ pending |
| 06-10-T2 | 06-10 | 6 | CEXP-02 (D-03, D-07) | T-06-31, T-06-34 | Deleted list and restore Manager-only; restore replay idempotent | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListDeletedExpensesEndpointTests"` | ❌ | ⬜ pending |
| 06-10-T3 | 06-10 | 6 | CEXP-02 (D-04, D-06) | T-06-33 | Permanent delete audit keeps date, category, amount, payer only | integration + unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*DeleteCompanyExpenseHandlerTests"` | ❌ | ⬜ pending |
| 06-11-T1 | 06-11 | 3 | CEXP-01 (dev seed) | T-06-35 | Seed writes only to CSPS_Dev or CSPS_E2E; idempotent | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CompanyExpensesSeedStepTests"` | ❌ | ⬜ pending |
| 06-11-T2 | 06-11 | 3 | PERF-04 (no inline SQL) | T-06-36 | No raw SQL outside migrations and three existing sites (owner approval by name parked) | architecture | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*NoInlineSqlTests"` | ❌ | ⬜ pending |
| 06-12-T1 | 06-12 | 7 | CEXP-02 (D-18) | T-06-37 | One Idempotency-Key per submission | component | `npm --prefix web run test -- --run src/modules/admin/components/ExpenseModal.test.tsx src/modules/admin/components/PaidBySelect.test.tsx` | ❌ | ⬜ pending |
| 06-12-T2 | 06-12 | 7 | CEXP-02, CEXP-05 (OR-3, D-19, D-20, D-21, D-32) | T-06-38, T-06-39 | zod mirrors every server rule; no request while a rule fails | unit + component | `npm --prefix web run test -- --run src/modules/admin/expensesSchemas.test.ts src/modules/admin/components/ExpenseModal.test.tsx` | ❌ | ⬜ pending |
| 06-12-T3 | 06-12 | 7 | CEXP-02 (OQ-14) | T-06-37 | Add flow in real browsers; 320 px fit | E2E | `npm --prefix web run e2e -- --grep @expenses-add` | ❌ | ⬜ pending |
| 06-13-T1 | 06-13 | 7 | CEXP-02 (D-08, D-13, D-15) | T-06-40, T-06-42 | Category writes Manager-only; unique names under a race | integration + unit | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ExpenseCategoriesManagementTests"` | ❌ | ⬜ pending |
| 06-13-T2 | 06-13 | 7 | CEXP-02 (D-12, OQ-6, SEC-07) | T-06-43, T-06-44 | Stale category save gives 409; Others name protected | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ExpenseCategoryHandlerTests"` | ❌ | ⬜ pending |
| 06-13-T3 | 06-13 | 7 | CEXP-02 (D-10, D-11, D-30) | T-06-41 | Used category can't be deleted; FK race maps to 422 | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*ExpenseCategoryStoreTests"` | ❌ | ⬜ pending |
| 06-14-T1 | 06-14 | 8 | CEXP-02 | T-06-46 | Edit sends the opened version | component | `npm --prefix web run test -- --run src/modules/admin/components/ExpenseModal.test.tsx src/modules/admin/pages/ExpensesPage.test.tsx` | ✅ | ⬜ pending |
| 06-14-T2 | 06-14 | 8 | CEXP-02, CEXP-05 (SEC-07, D-26, OQ-7, D-11) | T-06-45, T-06-46 | 409 keeps typed values; 403 and 404 banners | component | `npm --prefix web run test -- --run src/modules/admin/components/PaidBySelect.test.tsx src/modules/admin/components/ExpenseCategorySelect.test.tsx` | ✅ | ⬜ pending |
| 06-14-T3 | 06-14 | 8 | CEXP-04 (OQ-8, D-26) | T-06-47 | Admins view, never edit, others' expenses | E2E | `npm --prefix web run e2e -- --grep @expenses-edit` | ❌ | ⬜ pending |
| 06-15-T1 | 06-15 | 9 | CEXP-02 (D-27) | T-06-48 | Typed change lines only; no raw detail or text | integration + unit | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ExpenseAuditViewerTests"` | ❌ | ⬜ pending |
| 06-15-T2 | 06-15 | 9 | CEXP-05 (D-27) | T-06-49, T-06-50 | Done to payer match through escaped LIKE; audit table untouched | component | `npm --prefix web run test -- --run src/modules/admin/auditCopy.test.ts src/modules/admin/components/AuditDetail.test.tsx src/modules/admin/pages/AuditLogPage.test.tsx` | ✅ | ⬜ pending |
| 06-15-T3 | 06-15 | 9 | CEXP-05 (D-27) | T-06-48 | Expense audit trail in real browsers | E2E | `npm --prefix web run e2e -- --grep @audit` | ✅ | ⬜ pending |
| 06-16-T1 | 06-16 | 9 | CEXP-02 (D-01, D-02, D-05) | T-06-51, T-06-52 | Delete only for Managers, behind ConfirmDialog | component | `npm --prefix web run test -- --run src/modules/admin/pages/ExpensesPage.test.tsx` | ✅ | ⬜ pending |
| 06-16-T2 | 06-16 | 9 | CEXP-02 (D-03, D-07) | T-06-51, T-06-53 | Deleted page Manager-only (loader redirect); restore key per action | component | `npm --prefix web run test -- --run src/modules/admin/pages/DeletedExpensesPage.test.tsx src/modules/admin/guard.test.ts` | ❌ / ✅ | ⬜ pending |
| 06-16-T3 | 06-16 | 9 | CEXP-02 (D-04, OQ-1, OQ-12) | T-06-52 | Permanent delete with an explicit warning | E2E | `npm --prefix web run e2e -- --grep @expenses-delete` | ❌ | ⬜ pending |
| 06-17-T1 | 06-17 | 10 | CEXP-02 (D-14, D-15) | T-06-54 | Settings nav and route Manager-only | component | `npm --prefix web run test -- --run src/components/navigation/Sidebar.test.tsx src/modules/admin/pages/SettingsPage.test.tsx` | ✅ / ❌ | ⬜ pending |
| 06-17-T2 | 06-17 | 10 | CEXP-02 (D-08, D-12, D-13) | T-06-55, T-06-56 | Category edit sends the version; names rendered as text | component | `npm --prefix web run test -- --run src/modules/admin/components/CategoryModal.test.tsx src/modules/admin/categorySchemas.test.ts` | ❌ | ⬜ pending |
| 06-17-T3 | 06-17 | 10 | CEXP-02 (D-10, D-30, OQ-4) | T-06-54 | Retire, use again, delete never-used, in real browsers | E2E | `npm --prefix web run e2e -- --grep @settings` | ❌ | ⬜ pending |
| 06-18-T1 | 06-18 | 11 | CEXP-01 to CEXP-05 (UI backstops) | T-06-58 | Axe-clean, no sideways scroll 320 to 1920, CSP clean | E2E | `npm --prefix web run e2e -- --grep @expenses-sweep` | ❌ | ⬜ pending |
| 06-18-T2 | 06-18 | 11 | CEXP-01 to CEXP-05 (showcase) | T-06-57 | Demo data only spec names and example.com | component + E2E | `npm --prefix web run test -- --run src/modules/admin/components/showcase/Phase6Demos.test.tsx` | ❌ | ⬜ pending |
| 06-19-T1 | 06-19 | 12 | CEXP-01 to CEXP-05 (owner review) | T-06-59 | Pack stays in git-ignored artifacts | unit | `npm --prefix web run test -- --run scripts/owner-review.test.ts scripts/design-side-by-side.test.ts` | ✅ | ⬜ pending |
| 06-19-T2 | 06-19 | 12 | D-29, 05 D-48 | T-06-60 | Nothing approved for the owner | unit + manual | `npm --prefix web run test -- --run scripts/owner-review.test.ts` | ✅ | ⬜ pending |
| phase gate | all | 1-12 | OR-7 | T-06-03 | Still only `TR_AuditLog_AppendOnly` | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*TriggerInventoryTests"` | ✅ | ⬜ pending |
| phase gate | all | 1-12 | SEC-02 | T-06-02, T-06-31, T-06-40 | Every new endpoint has a matrix row for anonymous, Admin and Manager | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*Authorization*"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Each item is planned in the first plan whose tests need it (MVP vertical slices), before those tests run:

- [ ] `tests/Csps.Testing/CommandCounter.cs` and a `CspsDatabase.CreateContext(params IInterceptor[])` overload (query-count guard): plan 06-06 Task 1
- [ ] Category reseed after `CspsDatabase.ResetAsync` from `ExpenseCategorySeed` (Respawn wipes `HasData` rows): plan 06-01 Task 1
- [ ] `tests/Csps.Server.IntegrationTests/CompanyExpenses/ExpenseFixtures.cs`, modelled on `Users/UserFixtures.cs`: plan 06-02 Task 1 (SeedAsync in 06-03 Task 1)
- [ ] Timing-test class fixture with its own database and bulk data builder: plan 06-06 Task 2 (`ExpenseTimingData`, `ExpenseTimingCollection`)
- [ ] Web: MSW handlers for the new services (`web/src/test/expenseFixtures.ts`): plan 06-04 Task 1, extended by later web plans; showcase fixtures with long descriptions and names: plan 06-18 Task 2
- [ ] E2E seeding endpoint `POST /api/testing/expenses` and `createExpense` helper: plan 06-03 Task 3

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live p95 from request logs after release | PERF-04 / D-28 | No staging site; live data only exists in production | Read the Serilog request log elapsed times for `/api/v1/company-expenses` after the first week |
| New and amended copy | D-48 (05) | Owner reviews copy before release | Owner reads the expense pages and dialogs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
