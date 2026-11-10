---
phase: 10-admin-dashboard
created: 2026-11-09T08:15:00-06:00
updated: 2026-11-09T21:40:00-06:00
verified: 2026-11-10T03:40:00Z
status: human_needed
score: 6/6 must-haves verified
requirements_score: 14/14 requirements satisfied in code
behavior_unverified: 0
overrides_applied: 0
covered_files:
  - ".planning/phases/10-admin-dashboard/10-01-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-01-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-02-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-02-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-03-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-03-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-04-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-04-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-05-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-05-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-06-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-06-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-07-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-07-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-08-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-08-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-09-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-09-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-10-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-10-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-11-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-11-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-12-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-12-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-13-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-13-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-14-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-14-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-15-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-15-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-16-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-16-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-17-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-17-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-18-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-18-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-19-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-19-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-20-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-20-SUMMARY.md"
  - ".planning/phases/10-admin-dashboard/10-21-PLAN.md"
  - ".planning/phases/10-admin-dashboard/10-21-SUMMARY.md"
  - "src/Csps.Application/Audit/AuditChangeLines.cs"
  - "src/Csps.Application/Dashboard/ChartMonths.cs"
  - "src/Csps.Application/Dashboard/DashboardChartResponse.cs"
  - "src/Csps.Application/Dashboard/DashboardPeriod.cs"
  - "src/Csps.Application/Dashboard/DashboardSummaryResponse.cs"
  - "src/Csps.Application/Dashboard/GetDashboardChartHandler.cs"
  - "src/Csps.Application/Dashboard/GetDashboardChartRequest.cs"
  - "src/Csps.Application/Dashboard/GetDashboardChartRequestValidator.cs"
  - "src/Csps.Application/Dashboard/GetDashboardSummaryHandler.cs"
  - "src/Csps.Application/Money/CreateMoneyHandoverRequest.cs"
  - "src/Csps.Application/Money/CreateMoneyHandoverRequestValidator.cs"
  - "src/Csps.Application/Money/CreateMoneyTransferHandler.cs"
  - "src/Csps.Application/Money/CreateMoneyTransferRequest.cs"
  - "src/Csps.Application/Money/CreateMoneyTransferRequestValidator.cs"
  - "src/Csps.Application/Money/DeleteMoneyTransferHandler.cs"
  - "src/Csps.Application/Money/GetLedgerHandler.cs"
  - "src/Csps.Application/Money/GetLedgerRequest.cs"
  - "src/Csps.Application/Money/GetLedgerRequestValidator.cs"
  - "src/Csps.Application/Money/GetMyMoneyHandler.cs"
  - "src/Csps.Application/Money/GetStaffMoneyHandler.cs"
  - "src/Csps.Application/Money/HandOverMoneyHandler.cs"
  - "src/Csps.Application/Money/LedgerPage.cs"
  - "src/Csps.Application/Money/LedgerPageResponse.cs"
  - "src/Csps.Application/Money/LedgerRowView.cs"
  - "src/Csps.Application/Money/LedgerRunningBalance.cs"
  - "src/Csps.Application/Money/ListMoneyTransfersHandler.cs"
  - "src/Csps.Application/Money/ListMoneyTransfersRequest.cs"
  - "src/Csps.Application/Money/ListMoneyTransfersRequestValidator.cs"
  - "src/Csps.Application/Money/ListStaffBalancesHandler.cs"
  - "src/Csps.Application/Money/ListTransferRecipientsHandler.cs"
  - "src/Csps.Application/Money/MoneyAuditDetail.cs"
  - "src/Csps.Application/Money/MoneyAuditTargets.cs"
  - "src/Csps.Application/Money/MoneyErrors.cs"
  - "src/Csps.Application/Money/MoneyParties.cs"
  - "src/Csps.Application/Money/MoneyTransferListResponse.cs"
  - "src/Csps.Application/Money/MoneyTransferResponse.cs"
  - "src/Csps.Application/Money/MoneyWrite.cs"
  - "src/Csps.Application/Money/RemoveMoneyTransferHandler.cs"
  - "src/Csps.Application/Money/StaffBalancesResponse.cs"
  - "src/Csps.Application/Money/StaffMoneyAccess.cs"
  - "src/Csps.Application/Money/StaffMoneyResponse.cs"
  - "src/Csps.Application/Money/StaffMoneySums.cs"
  - "src/Csps.Application/Money/StaffPerson.cs"
  - "src/Csps.Application/Money/TransferRecipientResponse.cs"
  - "src/Csps.Application/Orders/ListOrdersHandler.cs"
  - "src/Csps.Application/Orders/OrderListEntries.cs"
  - "src/Csps.Application/Ports/IDashboardReader.cs"
  - "src/Csps.Application/Ports/IMoneyTransfers.cs"
  - "src/Csps.Application/Ports/IOrderReader.cs"
  - "src/Csps.Application/Ports/IStaffMoneyLock.cs"
  - "src/Csps.Application/Ports/IStaffMoneyReader.cs"
  - "src/Csps.Application/Ports/StaffMoneyBusyException.cs"
  - "src/Csps.Domain/Auditing/AuditActions.cs"
  - "src/Csps.Domain/Money/LedgerEntryKind.cs"
  - "src/Csps.Domain/Money/MoneyOnHand.cs"
  - "src/Csps.Domain/Money/MoneyParty.cs"
  - "src/Csps.Domain/Money/MoneyPartyStatus.cs"
  - "src/Csps.Domain/Money/MoneyRules.cs"
  - "src/Csps.Domain/Money/MoneyTransfer.cs"
  - "src/Csps.Domain/Orders/OrderStatusRules.cs"
  - "src/Csps.Domain/Time/BusinessClock.cs"
  - "src/Csps.Domain/Time/DayPart.cs"
  - "src/Csps.Infrastructure/Dashboard/DashboardReader.cs"
  - "src/Csps.Infrastructure/Dashboard/DashboardRegistration.cs"
  - "src/Csps.Infrastructure/DependencyInjection.cs"
  - "src/Csps.Infrastructure/Money/MoneyRegistration.cs"
  - "src/Csps.Infrastructure/Money/MoneyTransferStore.cs"
  - "src/Csps.Infrastructure/Money/StaffLedgerDetails.cs"
  - "src/Csps.Infrastructure/Money/StaffLedgerQuery.cs"
  - "src/Csps.Infrastructure/Money/StaffLedgerRow.cs"
  - "src/Csps.Infrastructure/Money/StaffMoneyLock.cs"
  - "src/Csps.Infrastructure/Money/StaffMoneyReader.cs"
  - "src/Csps.Infrastructure/Orders/OrderReader.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/Configurations/MoneyTransferConfiguration.cs"
  - "src/Csps.Infrastructure/Persistence/CspsDbContext.cs"
  - "src/Csps.Infrastructure/Persistence/Locking/DatabaseLockExceptions.cs"
  - "src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261107110304_AddMoneyTransfers.Designer.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/20261107110304_AddMoneyTransfers.cs"
  - "src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs"
  - "src/Csps.Server/Composition/ApplicationRegistration.cs"
  - "src/Csps.Server/Composition/DashboardApplicationRegistration.cs"
  - "src/Csps.Server/Composition/MoneyApplicationRegistration.cs"
  - "src/Csps.Server/Composition/OpenApiRegistration.cs"
  - "src/Csps.Server/Controllers/DashboardController.cs"
  - "src/Csps.Server/Controllers/MoneyTransfersController.cs"
  - "src/Csps.Server/Controllers/StaffMoneyController.cs"
  - "tools/openapi-gen/openapi.v1.json"
  - "web/e2e/dashboard.spec.ts"
  - "web/e2e/money.spec.ts"
  - "web/src/components/data/IncomeExpenseChart.tsx"
  - "web/src/components/data/data.recipe.ts"
  - "web/src/components/lists/Pagination.tsx"
  - "web/src/components/lists/ResponsiveTable.tsx"
  - "web/src/components/lists/SkeletonTable.tsx"
  - "web/src/components/lists/cells.tsx"
  - "web/src/components/lists/lists.recipe.ts"
  - "web/src/components/money/KpiCard.tsx"
  - "web/src/components/navigation/Sidebar.tsx"
  - "web/src/components/navigation/index.ts"
  - "web/src/components/overlays/overlays.recipe.ts"
  - "web/src/components/states/ErrorState.tsx"
  - "web/src/components/states/LoadingRegion.tsx"
  - "web/src/core/routes/router.tsx"
  - "web/src/layouts/AdminLayout.tsx"
  - "web/src/lib/forms/mayHaveSaved.ts"
  - "web/src/lib/forms/useSubmission.ts"
  - "web/src/lib/url-state/usePagedList.ts"
  - "web/src/modules/admin/auditCopy.ts"
  - "web/src/modules/admin/components/DashboardKpiRow.tsx"
  - "web/src/modules/admin/components/DeleteTransferDialog.tsx"
  - "web/src/modules/admin/components/ExpenseModal.tsx"
  - "web/src/modules/admin/components/IncomeExpenseCard.tsx"
  - "web/src/modules/admin/components/LedgerCard.tsx"
  - "web/src/modules/admin/components/LedgerTable.tsx"
  - "web/src/modules/admin/components/MoneyOnHandCard.tsx"
  - "web/src/modules/admin/components/MoneyStrip.tsx"
  - "web/src/modules/admin/components/OrderBalanceCell.tsx"
  - "web/src/modules/admin/components/OrdersByStatusCard.tsx"
  - "web/src/modules/admin/components/OrdersTable.tsx"
  - "web/src/modules/admin/components/RecentOrdersCard.tsx"
  - "web/src/modules/admin/components/RemoveTransferDialog.tsx"
  - "web/src/modules/admin/components/StaffBalancesTable.tsx"
  - "web/src/modules/admin/components/TransferActionDialogs.tsx"
  - "web/src/modules/admin/components/TransferButton.tsx"
  - "web/src/modules/admin/components/TransferModal.tsx"
  - "web/src/modules/admin/components/TransfersCard.tsx"
  - "web/src/modules/admin/components/TransfersTable.tsx"
  - "web/src/modules/admin/components/dashboard.recipe.ts"
  - "web/src/modules/admin/components/money.recipe.ts"
  - "web/src/modules/admin/components/showcase/Phase10Demos.tsx"
  - "web/src/modules/admin/components/showcase/ShowcaseDemos.tsx"
  - "web/src/modules/admin/components/showcase/showcase.recipe.ts"
  - "web/src/modules/admin/components/showcase/showcaseCopy.ts"
  - "web/src/modules/admin/components/showcase/showcaseSections.ts"
  - "web/src/modules/admin/dashboardCopy.ts"
  - "web/src/modules/admin/guard.ts"
  - "web/src/modules/admin/hooks/useBusinessToday.ts"
  - "web/src/modules/admin/hooks/useCleanStaffMoneyUrl.ts"
  - "web/src/modules/admin/hooks/useDashboardChartQuery.ts"
  - "web/src/modules/admin/hooks/useDashboardRange.ts"
  - "web/src/modules/admin/hooks/useDashboardSummaryQuery.ts"
  - "web/src/modules/admin/hooks/useExpenseAction.ts"
  - "web/src/modules/admin/hooks/useLedgerQuery.ts"
  - "web/src/modules/admin/hooks/useMoneyListParams.ts"
  - "web/src/modules/admin/hooks/useMyMoneyQuery.ts"
  - "web/src/modules/admin/hooks/useOrderAction.ts"
  - "web/src/modules/admin/hooks/useOrderChildSave.ts"
  - "web/src/modules/admin/hooks/useOrderQuery.ts"
  - "web/src/modules/admin/hooks/useRefreshExpenses.ts"
  - "web/src/modules/admin/hooks/useRefreshMoney.ts"
  - "web/src/modules/admin/hooks/useRefreshOrders.ts"
  - "web/src/modules/admin/hooks/useStaffBalancesQuery.ts"
  - "web/src/modules/admin/hooks/useStaffMoneyQuery.ts"
  - "web/src/modules/admin/hooks/useTransferAction.ts"
  - "web/src/modules/admin/hooks/useTransferDeletion.ts"
  - "web/src/modules/admin/hooks/useTransferRecipientsQuery.ts"
  - "web/src/modules/admin/hooks/useTransferRowActions.ts"
  - "web/src/modules/admin/hooks/useTransfersQuery.ts"
  - "web/src/modules/admin/moneyCopy.ts"
  - "web/src/modules/admin/moneySchemas.ts"
  - "web/src/modules/admin/pages/AuditLogPage.tsx"
  - "web/src/modules/admin/pages/DashboardPage.tsx"
  - "web/src/modules/admin/pages/DeletedExpensesPage.tsx"
  - "web/src/modules/admin/pages/DeletedOrdersPage.tsx"
  - "web/src/modules/admin/pages/ExpensesPage.tsx"
  - "web/src/modules/admin/pages/MoneyPage.tsx"
  - "web/src/modules/admin/pages/OrderFormPage.tsx"
  - "web/src/modules/admin/pages/OrdersPage.tsx"
  - "web/src/modules/admin/pages/StaffMoneyPage.tsx"
  - "web/src/modules/admin/pages/UsersPage.tsx"
  - "web/src/modules/admin/routes.tsx"
  - "web/src/modules/admin/sections.ts"
  - "web/src/modules/admin/services/dashboardService.ts"
  - "web/src/modules/admin/services/moneyService.ts"
  - "web/src/test/dashboardFixtures.ts"
  - "web/src/test/moneyFixtures.ts"
  - "web/src/types/api.generated.ts"
  - "web/src/utils/format.ts"
  - "web/src/utils/toFiniteFigure.ts"
covered_digest: "v3:sha256:d0abae41716cd11fefd1c12ea3944260cdd71baff4a5e8bee8761bf08065da66"
re_verification:
  previous_status: human_needed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  note: "The earlier report (HEAD 305e5fae) had no gaps. This run re-checks 13 later commits and trims the human list."
decision_coverage:
  honored: 61
  total: 61
  not_honored: []
  note: "Carried from the first report. The gate flagged D-106 as a false negative (10-REVIEW-wave1-FIX.md lines 19 and 20 record both D-106 fixes). D-107 to D-110 are owner rulings made after the gate ran; each is honored in code, see below."
human_verification:
  - test: "Phase PR CI: the parity pixel snapshot job"
    expected: "The parity job is green on the phase PR before merge"
    why_human: "Ship gate D-1 (10-REVIEW.md). UAT test 18 is blocked: no phase PR exists yet, so CI has not run. Locally the parity overlay run also shows 18 known failures, all in the Delete Order dialog cascade list (confirm-delete-order and confirm-delete-order-typed), named in 10-04-SUMMARY.md as not touched by Phase 10"
  - test: "One clean full e2e run and one clean Server test run on CI or a quiet machine"
    expected: "No e2e failures; ExpenseListTimingTests within 300 ms"
    why_human: "UAT test 19 is blocked on the phase PR's CI. Locally the full run failed under TheBETSLLC load and one timing test missed by 3.7 ms (known machine issue D-76, D-88, D-103)"
  - test: "P10-BL-18: the Delete Transfer warning shows a balance worked out in the browser"
    expected: "The owner accepts this one labelled preview (option A), or asks for a server figure (option B)"
    why_human: "Core Value says money is computed on the server. Still open in DECISIONS.md; it is the one client-side figure on the money screens"
  - test: "The other open parked items: P10-BL-01 to P10-BL-05, P10-BL-07 to P10-BL-11, P10-BL-13 and P10-BL-17, then the P10-BL-20 phase sign-off"
    expected: "Each gets a dated owner ruling in DECISIONS.md (the code uses the recommended option today)"
    why_human: "Owner decisions; none was decided for the owner. P10-BL-01 matters for Phases 15 to 17 (legacy import). P10-BL-17 is visible to staff (a chart axis label can read the wrong thousand)"
---

# Phase 10: Admin Dashboard Verification Report

*Created: 2026-11-09T08:15:00-06:00 · Updated: 2026-11-09T21:40:00-06:00*

**Phase Goal:** Staff land on a dashboard that shows how the business stands today: active work, money owed, money collected and money spent. Each staff member also sees the money they hold and can hand it to a coworker (owner addition, 2026-10-07).
**Verified:** 2026-11-10T03:40:00Z (HEAD 4b7f6251)
**Status:** human_needed
**Re-verification:** Yes. The first report was written at HEAD 305e5fae. It had no gaps. This run covers the 13 commits since.

## Result in plain words

The goal is still met in the code. Nothing regressed.

What changed since the first report: only web code, web tests and planning files. `git diff --stat 305e5fae..HEAD` lists 52 files and none is under `src/` or `tests/`. So the .NET side (controllers, handlers, readers, the migration, the authorization matrix) is byte for byte what I checked and ran last time. I did not re-run the .NET tests: they share LocalDB with TheBETSLLC's integration run that is going on now, and nothing they test has changed.

The web changes are the owner's rulings D-107, D-109 and D-110, made after the UI review:

- one KPI column at 420 px and below (`dashboard.recipe.ts`, `pg-xs:grid-cols-[minmax(0,1fr)]`);
- footer buttons in windows wrap instead of sticking out past the screen edge (`overlays.recipe.ts`);
- 44 px tap areas on the money strip's Transfer and View Ledger (`hitAreaClasses`);
- the Transfer button names the strip's loading or failure line (`MoneyStrip.tsx`, `TransferButton.tsx`) and, on My Money's Mine content, the balance card's line (`MoneyPage.tsx`);
- All Staff and Transfers fit their cards at 768 px (`fitTablet`, and a wrapping Actions cell on tablets);
- the focus after a transfer delete follows the rows still listed;
- the chart keeps the shown range's line and dims its empty message while the other range loads.

The status stays `human_needed`. The owner's hands-on UAT is done (147 passed, 0 issues, 2 blocked). What is left is the two UAT items that can only run on the phase PR's CI, and owner rulings that are still open.

Closed since the first report, no longer on the human list:

| Item | How it closed |
|---|---|
| P10-BL-06 (320 px sideways scroll) | Ruled D-107, option A. Fixed in `c0438e17`. `test.fixme` is gone from `dashboard.spec.ts`; the KPI-fit check is now active. |
| P10-BL-15 (screenshot review) | Ruled D-107. UAT tests 14 to 17 passed. |
| P10-BL-16 (window buttons at 320 px) | Ruled D-107. Fixed. UAT test 15 passed. |
| P10-BL-12, P10-BL-14, P10-BL-19 | Ruled D-107 (recommended options), fixed in quick 261109-c4l. |
| P10-BL-21 | Ruled D-109 and D-110, fixed in quick 261109-fmv. |
| Screenshot review (item 3 before) | UAT tests 14 to 17 passed. |

## User Flow Coverage

The roadmap marks this phase `mode: mvp`, but the goal is not written as a user story, so I used the six success criteria as the flow, as the first report did. UAT tests 2 to 13 are the owner's own run of this flow and all passed.

| Step | Expected | Evidence | Status |
|---|---|---|---|
| Sign in | Staff land on the dashboard | `guard.ts:6` default `/admin`; `routes.tsx` index is the dashboard page. UAT test 2 pass | VERIFIED |
| Read the shop's state | Greeting, Manila date, KPIs, chart, statuses, recent orders | `DashboardPage.tsx`. UAT tests 3 to 5 pass | VERIFIED |
| See own money | Money on hand on the dashboard and on My Money | `MoneyStrip`, `/admin/money`. UAT tests 6, 9 pass | VERIFIED |
| Hand money to a coworker | Transfer window, locked server check | `TransferModal.tsx`, `CreateMoneyTransferHandler.cs`. UAT tests 7, 8, 12, 13 pass | VERIFIED |

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Landing: greeting, Manila date, View Orders and New Order | VERIFIED | Unchanged since the first report (`routes.tsx` index route, `guard.ts`, `BusinessClock.cs` DayPart, `DashboardPage.tsx`). `DashboardPage.test.tsx` passes in my run. UAT test 2 pass. |
| 2 | KPI cards per C-40 | VERIFIED | `DashboardReader.cs`, `GetDashboardSummaryHandler.cs`, `DashboardKpiRow.tsx` unchanged. `DashboardKpiRow.test.tsx` 33 tests pass in my run. UAT test 3 pass. The one-column phone layout (D-107) changes only the grid, not the figures. |
| 3 | Chart and lists: 6 or 12 months, orders by status, 6 recent orders | VERIFIED | Server side unchanged. `IncomeExpenseCard.tsx` changed under D-107 (range line stays on the shown range, empty message dims while loading); `IncomeExpenseCard.test.tsx` passes with 47 new test lines. UAT tests 4 and 5 pass. |
| 4 | Card states: skeleton, empty, error with retry on every card | VERIFIED | Each card reads its own query. `ErrorState.test.tsx` (22) and `loading.test.tsx` (19) pass in my run. |
| 5 | Money on hand: server-computed, ledger, dashboard card, Admin own only, Manager all | VERIFIED | `MoneyOnHand.cs`, `StaffMoneyReader.cs`, `StaffMoneyAccess.cs` unchanged. `MoneyOnHandCard.test.tsx` 25 pass, `MoneyPage.test.tsx` pass (133 new test lines). UAT tests 6, 9, 10, 11 pass. |
| 6 | Coworker transfers: rules, locked check, double-click, no edit, Manager-only audited delete, matrix rows | VERIFIED | All server code unchanged. `TransferModal.test.tsx` and `DeleteTransferDialog.test.tsx` pass in my run. The first report's server runs (506 of 506 integration, 40 of 40 infrastructure) still describe this code. UAT tests 7, 8, 12, 13 pass. |

**Score:** 6/6 truths verified (0 present but behavior-unverified).

### Requirements Coverage

Every ID in the plan frontmatter is in REQUIREMENTS.md, and REQUIREMENTS.md maps exactly these 14 IDs to Phase 10 (lines 437 to 450). No orphans. The checkboxes and traceability rows still read Pending; they are updated at ship.

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| DASH-01 | 10-02, 10-05, 10-07 | SATISFIED | Truth 1 |
| DASH-02 | 10-02, 10-05, 10-09 | SATISFIED | Truth 2 |
| DASH-03 | 10-04, 10-06, 10-11 | SATISFIED | Truth 3 |
| DASH-04 | 10-02, 10-05, 10-09 | SATISFIED | Truth 3 |
| DASH-05 | 10-05, 10-09 | SATISFIED | Truth 3 |
| DASH-06 | 10-07, 10-09, 10-11, 10-21 | SATISFIED | Truth 4 |
| MONEY-01 | 10-03, 10-08 | SATISFIED | Truth 5 |
| MONEY-02 | 10-01, 10-08, 10-13, 10-14, 10-17, 10-21 | SATISFIED | Truth 5 |
| MONEY-03 | 10-16, 10-19, 10-20 | SATISFIED | Truth 5 |
| MONEY-04 | 10-03, 10-10, 10-12, 10-15, 10-19 | SATISFIED | Truth 6 |
| MONEY-05 | 10-03, 10-10, 10-12, 10-15 | SATISFIED | Truth 6 |
| MONEY-06 | 10-12, 10-18, 10-20 | SATISFIED | Truth 6 |
| MONEY-07 | 10-03, 10-18, 10-20 | SATISFIED | Truth 6 |
| MONEY-08 | 10-08, 10-10, 10-12, 10-14, 10-16, 10-18 | SATISFIED | Truth 6 and the matrix below |

### Authorization Matrix

Unchanged from the first report: 13 of 13 new controller actions have rows in `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` (dashboard summary and chart 401/200/200; staff-money me and me/ledger 401/200/200; staff-money list 401/403/200; staff-money by id and ledger 401/403/404; money-transfers list 401/200/200; create 401/400/400; handovers 401/403/400; recipients 401/200/200; delete and permanent 401/403/404). No file under `src/` or `tests/` changed since that check.

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| Sign-in | Dashboard | `safeReturnUrl` default `/admin`, index route | WIRED |
| `DashboardPage` | `GET dashboard/summary` | `useDashboardSummaryQuery` to `dashboardService` | WIRED |
| `IncomeExpenseCard` | `GET dashboard/chart` | `useDashboardChartQuery` | WIRED |
| `MoneyStrip`, `MoneyOnHandCard` | `GET staff-money/me` | `useMyMoneyQuery` | WIRED |
| `TransferButton` | the strip or balance card's loading and failure line | `pendingReasonId` to `aria-describedby` (`MoneyStrip.tsx`, `MoneyPage.tsx`; new under D-107, D-109) | WIRED |
| `TransferModal` | `POST money-transfers` and `/handovers` | `useTransferAction`, one Idempotency-Key per submission | WIRED |
| Delete and remove dialogs | `DELETE money-transfers/{id}` and `/permanent` | `useTransferDeletion` with the row version | WIRED |
| Order, payment, refund and expense saves | Dashboard and money queries | `useRefreshOrders`, `useRefreshExpenses`, `useRefreshMoney` | WIRED |

### Server-side money

Unchanged. The one browser figure is the labelled warning preview in the Delete Transfer dialog (P10-BL-18, still open).

### Schema, SQL, packages, dashes

| Check | Result |
|---|---|
| Server, schema, SQL, triggers, packages | No file under `src/`, `tests/`, `Directory.Packages.props` or `web/package.json` changed since 305e5fae, so the first report's results stand (no trigger, no inline SQL, no JSON column, no drop or rename, no package change). |
| Long dash in `web/src` (OR-4) | Search for U+2014 and U+2013 under `web/src`: 0 matches. `no-long-dash.node.test.ts` and `source-layout.node.test.ts` pass in my run. |

### Behavioral Spot-Checks (run by me)

Preflight first. It showed TheBETSLLC running its own integration and web tests and port 5180 held by the owner's web dev server (path in this project), so I ran only web unit tests with two workers, no server, no database, no browser.

| Behavior | Command | Result | Status |
|---|---|---|---|
| Every web test file touched by the 13 commits, plus the dashboard and money pages and the OR-4 and layout guards | `npx vitest run --maxWorkers=2` on 33 files (MoneyStrip, IncomeExpenseCard, StaffBalancesTable, TransfersCard, DashboardKpiRow, MoneyOnHandCard, TransferModal, DeleteTransferDialog, MoneyPage, DashboardPage, both recipe tests, `src/components/states`, `lists`, `overlays`, no-long-dash, source-layout) | `Test Files  33 passed (33)`, `Tests  759 passed (759)`, no failures, no flake | PASS |

Earlier evidence from the commits (quoted from their summaries, not re-run by me): quick 261109-c4l ran the full Vitest suite, 324 files, 9035 passed; `@dashboard` 20 passed on all five browser projects; `@dashboard-sweep` 40 passed; `@money-sweep` 45 passed. Quick 261109-fmv reports `@money` and `@money-sweep` passing and the focus test 15 of 15 in three runs.

### Probe Execution

Not applicable: no plan declares a probe.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| (all phase files) | | `TBD`, `FIXME`, `XXX` in `web/src/modules/admin` and `web/e2e` | none found | |
| `web/e2e/` | | `test.fixme` | none found (the one in `dashboard.spec.ts` is removed) | |
| `web/e2e/dashboard-sweep.spec.ts` | 170 to 171 | Comment still says P10-BL-06 is "open" and "left failing on purpose ... No fixme" | Info | The comment is stale after D-107. The test itself is active and passes per quick 261109-c4l. Worth a one-line comment fix in a later change; not a gap. |
| `.planning/phases/999.6-.../DECISIONS.md` | P10-BL-20 | Sign-off text still lists P10-BL-06, 15, 16 and 19 as owner steps | Info | Stale. These are ruled. P10-BL-20 stays open until the owner signs off. |
| `10-VALIDATION.md` | 5 to 7 | status `draft`, `nyquist_compliant: false` | Info | `/gsd-validate-phase 10` has not run. Not a code gap. |

### Known failures that predate this work

- Parity `@overlays`: 18 failures, all and only `confirm-delete-order` and `confirm-delete-order-typed` (the Delete Order dialog). Named in `10-04-SUMMARY.md` as untouched by Phase 10 and failing before quick 261109-c4l (its summary says so). The CI parity run on the phase PR is the judge.
- `ExpenseListTimingTests` missed its 300 ms limit by 3.7 ms once under load (D-76, D-88, D-103).

### Human Verification Required

#### 1. CI parity snapshots (ship gate D-1)
**Test:** Open the phase PR and let CI run (`/gsd-ship 10`).
**Expected:** The parity pixel snapshot job is green before merge.
**Why human:** UAT test 18 is blocked. No PR exists and the branch is not pushed. Snapshots differ locally by glyph edges, so only CI can confirm.

#### 2. One clean full run
**Test:** Run the full e2e suite and the Server tests once on the phase PR's CI.
**Expected:** No e2e failures, and `ExpenseListTimingTests` under 300 ms.
**Why human:** UAT test 19 is blocked on the same PR.

#### 3. P10-BL-18: browser-computed warning in Delete Transfer
**Test:** Read the parked item and the Delete Transfer warning.
**Expected:** The owner accepts the labelled preview (A) or asks for a server figure (B).
**Why human:** Core Value says money is computed on the server; this is the one exception and has no ruling.

#### 4. The other open parked items
**Test:** Rule on P10-BL-01 to P10-BL-05, P10-BL-07 to P10-BL-11, P10-BL-13 and P10-BL-17, then sign off P10-BL-20.
**Expected:** A dated owner ruling for each in `.planning/phases/999.6-owner-items-parked-during-phase-10-execution/DECISIONS.md`.
**Why human:** Owner decisions. The code uses the recommended option for each today. P10-BL-01 matters for Phases 15 to 17.

### Gaps Summary

No gaps. All six success criteria and all 14 requirements are met in the code. The owner's hands-on UAT is finished with no issues. What remains is CI work that needs the phase PR (items 1 and 2) and owner rulings (items 3 and 4).

---

_Verified: 2026-11-10T03:40:00Z_
_Verifier: Claude (gsd-verifier)_
