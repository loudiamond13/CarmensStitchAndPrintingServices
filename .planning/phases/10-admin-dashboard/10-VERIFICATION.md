---
phase: 10-admin-dashboard
created: 2026-11-09T08:15:00-06:00
updated: 2026-11-10T01:36:00-06:00
verified: 2026-11-10T07:36:00Z
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
  - "web/e2e/auth.ts"
  - "web/e2e/dashboard-sweep.spec.ts"
  - "web/e2e/dashboard.spec.ts"
  - "web/e2e/fixture-selftest.spec.ts"
  - "web/e2e/fixtures.ts"
  - "web/e2e/money.spec.ts"
  - "web/e2e/orders-filters.spec.ts"
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
covered_digest: "v3:sha256:47e554181e3199532b6e342ba8fbcf2c5e1c98d0d57bc750662b4e29fb6af410"
re_verification:
  previous_status: human_needed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  note: "The report at HEAD 4b7f6251 had no gaps. This run re-checks the D-111 commits (git diff c9081a3e..HEAD: 3bea5c9e, 4f773e95, 7586b8e6, 647e2aa5) and trims the human list to what is still open."
decision_coverage:
  honored: 61
  total: 61
  not_honored: []
  note: "Carried from the first report. The gate flagged D-106 as a false negative (10-REVIEW-wave1-FIX.md lines 19 and 20 record both D-106 fixes). D-107 to D-110 are owner rulings made after the gate ran and each is honored in code. D-111 (owner, 2026-11-09) is also honored: the seven items it changes are built (see below) and the six items it leaves as they are were not touched."
human_verification:
  - test: "Phase PR CI: the parity pixel snapshot job"
    expected: "The parity job is green on the phase PR before merge"
    why_human: "Ship gate D-1 (10-REVIEW.md). UAT test 18 is blocked: no phase PR exists yet, so CI has not run. Locally the parity overlay run also shows 18 known failures, all in the Delete Order dialog cascade list (confirm-delete-order and confirm-delete-order-typed), named in 10-04-SUMMARY.md as not touched by Phase 10"
  - test: "One clean CI run: full e2e, the Server tests, and web/scripts/third-party-notices.test.ts"
    expected: "No e2e failures; ExpenseListTimingTests within 300 ms; third-party-notices.test.ts passes"
    why_human: "UAT test 19 is blocked on the phase PR's CI. Locally the full run failed under TheBETSLLC load, one timing test missed by 3.7 ms (known machine issue D-76, D-88, D-103), and third-party-notices.test.ts timed out at 120 s and again alone at 173 s (it scans node_modules; no package, web/scripts or lock file changed in Phase 10)"
  - test: "P10-BL-20: the owner's Phase 10 sign-off"
    expected: "The owner approves or rejects the sign-off, then gives the go-ahead to ship"
    why_human: "Owner decision. Nothing has been pushed; the sign-off blocks the phase close, the phase PR and the merge"
  - test: "P10-BL-13 follow-up: should the Audit Log screen also show hand-over yes or no?"
    expected: "A: keep it in the stored record only (recommended, built today). B: also show a Hand-over line (needs new wording the owner approves)"
    why_human: "A small open owner choice inside a ruled item. Not blocking: the code uses option A"
---

# Phase 10: Admin Dashboard Verification Report

*Created: 2026-11-09T08:15:00-06:00 · Updated: 2026-11-10T01:36:00-06:00*

**Phase Goal:** Staff land on a dashboard that shows how the business stands today: active work, money owed, money collected and money spent. Each staff member also sees the money they hold and can hand it to a coworker (owner addition, 2026-10-07).
**Verified:** 2026-11-10T07:36:00Z (HEAD 2feec678)
**Status:** human_needed
**Re-verification:** Yes. The earlier report was written at HEAD 4b7f6251 (no gaps). This run covers the owner ruling D-111 and the four code commits that built it.

## Result in plain words

The goal is still met in the code. Nothing regressed.

What changed since the last report (`git diff c9081a3e..HEAD`: 49 files). Seven rulings were built, test first, by quick 261109-vj6. Here is what I read in the code and ran:

| D-111 item | What the code does now | Money still server-side? |
|---|---|---|
| P10-BL-08, new audit entry | `CreateMoneyTransferHandler.cs` calls `audit.Record(AuditActions.MoneyTransferAdded, ...)` right after `transfers.Add(transfer)` and before the one `unitOfWork.SaveChangesAsync`. `IAuditTrail.Record` only adds to the unit of work ("Nothing is saved here"), so the entry and the transfer commit together or not at all. The sender is the actor. The detail is ids, amount, date and `note=yes\|no`, never the note text (`MoneyAuditDetail.Snapshot(..., hasNote:)`). It sits after every refusal `return`, so a refused transfer writes none. | Yes. The handler still reads sums under the staff-money lock and the domain decides. The balance in the response is still read after the save. |
| P10-BL-13, removed record | `MoneyAuditDetail.Removed` adds `handover=yes\|no`. The delete detail is unchanged. | Yes. |
| P10-BL-02, Orders newest first | `OrderReader.Sort`: `Newest` is `CreatedAtUtc` descending then `Id` descending, the same keys as the dashboard's Recent orders. | Yes. Sort only; no figure changes. |
| P10-BL-04, kept figures | `DashboardPage.tsx` shows one alert line "Showing figures from {time}. Couldn't refresh." with Try Again only when `summary.isError && data !== undefined && !isFetching`. `DashboardKpiRow`, `OrdersByStatusCard` and `RecentOrdersCard` fall back to their own error only when there is no data. The figures kept are the last server answer. | Yes. The page does no arithmetic. |
| P10-BL-17, chart ticks | `IncomeExpenseChart.tick()` writes `₱1.5k` for a half thousand, whole thousands as before, below ₱1,000 in full, below zero with U+2212. | Yes. Label formatting only. |
| P10-BL-05, WebKit guard | `web/e2e/fixtures.ts`: an anchored regex on the whole message (`^/host/api/... due to access control checks.$`), counted only when the browser is WebKit, the host is the app's own origin and the path starts with `/api/`. Any other page error is still a finding. `auth.ts` lost its sign-in wait. | Not applicable (test code). |
| P10-BL-18 and the five others | Ruled "today's behavior stays". The Delete Transfer comment now cites D-111. The warning is a labelled preview built only from server balances; no code change. | The one browser subtraction is now owner-approved. |

Nothing under `Directory.Packages.props`, `web/package.json`, the lock file or `src/Csps.Infrastructure/Persistence` changed (`git diff c9081a3e..HEAD --stat` on those paths is empty), so there is no migration, package, trigger or index change.

## User Flow Coverage

The roadmap marks this phase `mode: mvp`, but the goal is not written as a user story, so I used the six success criteria as the flow, as before. UAT tests 2 to 13 are the owner's own run of this flow and all passed.

| Step | Expected | Evidence | Status |
|---|---|---|---|
| Sign in | Staff land on the dashboard | `guard.ts:6` default `/admin`; `routes.tsx` index is the dashboard page. UAT test 2 pass | VERIFIED |
| Read the shop's state | Greeting, Manila date, KPIs, chart, statuses, recent orders | `DashboardPage.tsx`. UAT tests 3 to 5 pass. D-111 adds a kept-figures line on a failed refresh | VERIFIED |
| See own money | Money on hand on the dashboard and on My Money | `MoneyStrip`, `/admin/money`. UAT tests 6, 9 pass | VERIFIED |
| Hand money to a coworker | Transfer window, locked server check, one audit entry | `TransferModal.tsx`, `CreateMoneyTransferHandler.cs`. UAT tests 7, 8, 12, 13 pass | VERIFIED |

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Landing: greeting, Manila date, View Orders and New Order | VERIFIED | `routes.tsx`, `guard.ts`, `BusinessClock.cs` DayPart, `DashboardPage.tsx`. The header still builds from the server's summary. `DashboardPage.test.tsx` passes in my run (see below). UAT test 2 pass. |
| 2 | KPI cards per C-40 | VERIFIED | `DashboardReader.cs` and `GetDashboardSummaryHandler.cs` unchanged. `DashboardKpiRow.tsx` only changes when the error shows (first read only). `DashboardKpiRow.test.tsx` 33 tests pass in my run. |
| 3 | Chart and lists: 6 or 12 months, orders by status, 6 recent orders | VERIFIED | Server side unchanged. The chart tick label changed (D-111) and `IncomeExpenseChart.test.tsx` passes. Recent orders keep the created-time sort; the Orders list now matches it. |
| 4 | Card states: skeleton, empty, error with retry on every card | VERIFIED | First-load failure still shows each card's own alert with retry (tests pass). D-111 adds the kept-figures state for a later failed refresh, with Try Again. `DashboardPage.test.tsx` has 118 changed lines for it and passes. |
| 5 | Money on hand: server-computed, ledger, dashboard card, Admin own only, Manager all | VERIFIED | `MoneyOnHand.cs`, `StaffMoneyReader.cs`, `StaffMoneyAccess.cs` unchanged by D-111. |
| 6 | Coworker transfers: rules, locked check, double-click, no edit, Manager-only audited delete, matrix rows | VERIFIED | `CreateMoneyTransferHandler.cs` still takes the lock first, reads both people and balances, lets `MoneyTransfer.Record` decide every rule, then saves once. The new audit entry joins that one save. `CreateMoneyTransferHandlerTests` pass in my run. Delete and permanent remove are unchanged apart from the `handover` flag in the removed record. The 13 matrix rows are untouched (no controller, policy or route changed). |

**Score:** 6/6 truths verified (0 present but behavior-unverified).

### Requirements Coverage

Every ID in the plan frontmatter is in REQUIREMENTS.md, and REQUIREMENTS.md maps exactly these 14 IDs to Phase 10. No orphans. The checkboxes and traceability rows still read Pending; they are updated at ship.

| Requirement | Source Plans | Status | Evidence |
|---|---|---|---|
| DASH-01 | 10-02, 10-05, 10-07 | SATISFIED | Truth 1 |
| DASH-02 | 10-02, 10-05, 10-09 | SATISFIED | Truth 2 |
| DASH-03 | 10-04, 10-06, 10-11 | SATISFIED | Truth 3 (chart tick wording only) |
| DASH-04 | 10-02, 10-05, 10-09 | SATISFIED | Truth 3 |
| DASH-05 | 10-05, 10-09 | SATISFIED | Truth 3 (the sort now matches the Orders list) |
| DASH-06 | 10-07, 10-09, 10-11, 10-21 | SATISFIED | Truth 4 |
| MONEY-01 | 10-03, 10-08 | SATISFIED | Truth 5 |
| MONEY-02 | 10-01, 10-08, 10-13, 10-14, 10-17, 10-21 | SATISFIED | Truth 5 |
| MONEY-03 | 10-16, 10-19, 10-20 | SATISFIED | Truth 5 |
| MONEY-04 | 10-03, 10-10, 10-12, 10-15, 10-19 | SATISFIED | Truth 6 |
| MONEY-05 | 10-03, 10-10, 10-12, 10-15 | SATISFIED | Truth 6 |
| MONEY-06 | 10-12, 10-18, 10-20 | SATISFIED | Truth 6 (audited delete; D-111 adds the audited add) |
| MONEY-07 | 10-03, 10-18, 10-20 | SATISFIED | Truth 6 |
| MONEY-08 | 10-08, 10-10, 10-12, 10-14, 10-16, 10-18 | SATISFIED | Truth 6 and the matrix below |

### Authorization Matrix

13 of 13 new controller actions still have rows in `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`. No file under `src/Csps.Server` changed in the D-111 range, so no route, policy or role changed.

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| Sign-in | Dashboard | `safeReturnUrl` default `/admin`, index route | WIRED |
| `DashboardPage` | `GET dashboard/summary` | `useDashboardSummaryQuery` to `dashboardService` | WIRED |
| `DashboardPage` stale line | `summary.refetch()` | Try Again `onClick` | WIRED |
| `IncomeExpenseCard` | `GET dashboard/chart` | `useDashboardChartQuery` | WIRED |
| `MoneyStrip`, `MoneyOnHandCard` | `GET staff-money/me` | `useMyMoneyQuery` | WIRED |
| `TransferModal` | `POST money-transfers` and `/handovers` | `useTransferAction`, one Idempotency-Key per submission | WIRED |
| `CreateMoneyTransferHandler` | audit log row | `IAuditTrail.Record` before `SaveChangesAsync`, same unit of work | WIRED |
| Audit Log screen | `money-transfer.added` | `AUDIT_ACTIONS` has the label; `AuditChangeLines.ReadTransfer` reads the detail; `AuditActions.All` lists it | WIRED |
| Delete and remove dialogs | `DELETE money-transfers/{id}` and `/permanent` | `useTransferDeletion` with the row version | WIRED |
| Orders list "Newest first" | `OrderReader.Sort` | `OrderListSort.Newest` to created time then id descending | WIRED |

### Server-side money

Still server-side. D-111 added no money arithmetic in the browser. The one browser figure remains the labelled Delete Transfer warning preview (a subtraction of server balances), which the owner approved in D-111 (P10-BL-18 A).

### Schema, SQL, packages, dashes

| Check | Result |
|---|---|
| Schema, SQL, triggers, packages | `git diff c9081a3e..HEAD --stat` on `Directory.Packages.props`, `web/package.json`, `web/package-lock.json` and `src/Csps.Infrastructure/Persistence` is empty. The only `src/` changes are two Application files, one Domain constants file, one Infrastructure reader and one Application port. No trigger, no inline SQL (the sort is LINQ), no JSON column, no drop or rename. |
| Long dash in `web/src` (OR-4) | `no-long-dash.node.test.ts` and `source-layout.node.test.ts` pass in my run (2 files, 8 tests). |

### Behavioral Spot-Checks (run by me)

Preflight first. It showed ports 5180, 5115, 7028 and 5199 free, but TheBETSLLC running its own integration tests with many `BetsLLC_Test_*` databases open in LocalDB. So I did not run any test that needs LocalDB. I ran only tests with no database, no server and no browser.

| Behavior | Command | Result | Status |
|---|---|---|---|
| Transfer handler (audit entry added, none on a refusal), removed-record detail, audit line reading, removed-transfer handler | `dotnet test --project tests/Csps.Application.UnitTests --filter-class` on `CreateMoneyTransferHandlerTests`, `MoneyAuditDetailTests`, `AuditChangeLinesTests`, `RemoveMoneyTransferHandlerTests` | `Test run summary: Passed! total: 119, failed: 0` | PASS |
| New action is in the closed audit list | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AuditActionsTests"` | `Passed! total: 87, failed: 0` | PASS |
| Chart ticks, dashboard page (kept figures), KPI row, status card, recent orders, audit label, dashboard recipe | `npx vitest run --maxWorkers=2` on 7 files | `Test Files  7 passed (7)`, `Tests  240 passed (240)` | PASS |
| OR-4 dash guard and source layout | `npx vitest run --maxWorkers=2 no-long-dash source-layout` | `Test Files  2 passed (2)`, `Tests  8 passed (8)` | PASS |

Not run by me, so quoted from the quick summary and not counted as my evidence: the Server integration classes `MoneyTransferEndpointTests` (63 new lines), `ListOrdersEndpointTests` and `OrderListQueryCountTests` (quick 261109-vj6 reports 104 and 59 passed under LocalDB after a clear preflight); `OrderListTimingTests` (newest sort p95 35.2 ms against the 300 ms limit); and the e2e runs (`@fixture` 36 passed on three engines, `@money`, `@orders-filters` and `@dashboard` 22 passed on WebKit and iPhone). I did not run e2e or any LocalDB test because TheBETSLLC was using the machine.

### Probe Execution

Not applicable: no plan declares a probe.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| Files changed since `c9081a3e` under `src` and `web` | | `TBD`, `FIXME`, `XXX` | none found | |
| `web/e2e/` | | `test.fixme` | none found | |
| `web/e2e/dashboard-sweep.spec.ts` | 170 | The stale "left failing on purpose" comment | fixed (now cites D-107, P10-BL-06 A) | |
| `.planning/phases/999.6-.../DECISIONS.md` | P10-BL-20 | Sign-off list | fixed: it now lists only the parity snapshots, one clean CI run and the owner's sign-off. The working copy of this file has a small uncommitted "Waiting for you" paragraph | Info |
| `IncomeExpenseChart.tsx` | `tick` | `toFixed(1)` would round a value such as 1250 to "1.3k" | Info | The ticks are 0, the half and the top (`TICK_FRACTIONS = [0, 0.5, 1]`), and the top is a multiple of a power of ten (`step = 10^floor(log10(max))`), so from ₱1,000 up only whole and half thousands occur. Not a gap |
| `10-VALIDATION.md` | 5 to 6 | status `draft`, `nyquist_compliant: false` | Info | `/gsd-validate-phase 10` has not run. Not a code gap. |

### Known failures that predate this work

- Parity `@overlays`: 18 failures, all and only `confirm-delete-order` and `confirm-delete-order-typed` (the Delete Order dialog), named in `10-04-SUMMARY.md` as untouched by Phase 10. The CI parity run on the phase PR is the judge.
- `ExpenseListTimingTests` missed its 300 ms limit by 3.7 ms once under load (D-76, D-88, D-103).
- `web/scripts/third-party-notices.test.ts` timed out locally under load (120 s in the full run, 173 s alone) in quick 261109-vj6, and failed on an assertion once in plan 10-15 where the worktree's `node_modules` differed from the lock file. No package, lock file or `web/scripts` file changed in Phase 10 (`git diff c9081a3e..HEAD` on `web/package.json` and the lock file is empty). It needs one run on a clean checkout, which is the CI job.

### Human Verification Required

#### 1. CI parity snapshots (ship gate D-1)
**Test:** Open the phase PR and let CI run (`/gsd-ship 10`).
**Expected:** The parity pixel snapshot job is green before merge.
**Why human:** UAT test 18 is blocked. No PR exists and the branch is not pushed. Snapshots differ locally by glyph edges, so only CI can confirm.

#### 2. One clean CI run
**Test:** On the phase PR's CI, one full e2e run, one Server test run and `web/scripts/third-party-notices.test.ts`.
**Expected:** No e2e failures, `ExpenseListTimingTests` under 300 ms, and the notices test passes.
**Why human:** UAT test 19 is blocked on the same PR. The notices test could not finish on this loaded machine.

#### 3. P10-BL-20: the owner's sign-off
**Test:** Read the sign-off in DECISIONS.md.
**Expected:** The owner approves or rejects it, and says whether to ship.
**Why human:** Owner decision.

#### 4. P10-BL-13 follow-up (small, not blocking)
**Test:** Choose A (keep hand-over yes or no in the stored record only; built) or B (also show it on the Audit Log screen, with new wording).
**Expected:** A dated ruling in DECISIONS.md.
**Why human:** Owner decision. The code uses option A today.

Closed since the last report, no longer on the human list: P10-BL-01 to P10-BL-05, P10-BL-07 to P10-BL-11, P10-BL-13 (the item itself), P10-BL-17 and P10-BL-18, all ruled in D-111 (option A on each). P10-BL-02, 04, 05, 08, 13 and 17 are built; 01 is carried into the Phase 16 plan; 03, 07, 09, 10, 11 and 18 keep today's behavior.

### Gaps Summary

No gaps. All six success criteria and all 14 requirements are met in the code, and the D-111 changes keep them met: money is still computed on the server, the new audit entry joins the transfer's single save, the Orders sort is a LINQ order by created time then id, the kept-figures state shows only the server's last answer, and the WebKit guard is narrow. What remains is CI work that needs the phase PR (items 1 and 2) and owner decisions (items 3 and 4).

---

_Verified: 2026-11-10T07:36:00Z_
_Verifier: Claude (gsd-verifier)_
