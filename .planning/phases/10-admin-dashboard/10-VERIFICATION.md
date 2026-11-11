---
phase: 10-admin-dashboard
created: 2026-11-09T08:15:00-06:00
updated: 2026-11-10T07:00:00-06:00
verified: 2026-11-10T12:50:00Z
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
  - "web/e2e/money-sweep.spec.ts"
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
  - "web/src/modules/admin/components/TransferModal.test.tsx"
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
covered_digest: "v3:sha256:8981098b1a489f3d5e3d362f6d633354a57d4d953da6456116cf550b3b9160e1"
re_verification:
  previous_status: human_needed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  note: "The report at HEAD 2feec678 had no gaps. This run re-checks the code review fix commits (git diff 2feec678..HEAD: 5f12c822, 20722663, aaf930cd, 925a66d8, 255245d9) and the UAT record. No file under src/ changed in that range."
decision_coverage:
  honored: 62
  total: 62
  not_honored: []
  note: "Carried from the earlier reports (61 of 61), plus D-112 (owner, 2026-11-10: the Transfer window shows a failure line and Try Again when the business date cannot be read). D-112 is honored in code: see Truth 6."
human_verification:
  - test: "UAT test 18: the parity pixel snapshot job on the phase PR"
    expected: "The parity job is green on the phase PR before merge"
    why_human: "Ship gate D-1. Blocked by owner ruling 2026-11-09: no phase PR exists yet, so CI has not run. Run /gsd-ship 10 and let CI judge. Locally the overlay run showed 18 known failures, all in the Delete Order dialog (confirm-delete-order, confirm-delete-order-typed), which 10-04-SUMMARY.md names as untouched by Phase 10"
  - test: "UAT test 19: one clean full test run on the phase PR's CI"
    expected: "No e2e failures; ExpenseListTimingTests within 300 ms; web/scripts/third-party-notices.test.ts passes; the Server tests pass in one pass"
    why_human: "Blocked by owner ruling 2026-11-09 until the phase PR's CI runs. Locally the full run missed one timing test by 3.7 ms under TheBETSLLC load (D-76, D-88, D-103) and the notices test timed out while scanning node_modules. No package or lock file changed in Phase 10"
  - test: "P10-BL-20: the owner's Phase 10 sign-off"
    expected: "The owner approves or rejects the sign-off, then gives the go-ahead to ship"
    why_human: "Owner decision. Nothing has been pushed. The sign-off blocks the phase close, the phase PR and the merge"
  - test: "Quick look at the Transfer window with a failing date read (D-112)"
    expected: "With the network cut after the page has been open longer than 5 minutes, opening Transfer shows \"Couldn't load the transfer form.\" with Try Again, never an endless skeleton; Try Again fills the Date once the network is back"
    why_human: "The fix is covered by a unit test that passed in my run, but the owner's ruling fixed the wording and 10-REVIEW-FIX.md says a quick look is still worthwhile. Also the new e2e toast waits (IN-02) were type-checked and linted only, not run, because the machine is shared"
  - test: "P10-BL-13 follow-up: should the Audit Log screen also show hand-over yes or no?"
    expected: "A: keep it in the stored record only (recommended, built today). B: also show a Hand-over line (needs new wording the owner approves)"
    why_human: "Ruled D-113 (owner, 2026-11-10): option A. Closed; the code already does A"
---

# Phase 10: Admin Dashboard Verification Report
*Created: 2026-11-09T08:15:00-06:00 · Updated: 2026-11-10T07:00:00-06:00*

**Phase Goal:** Staff land on a dashboard that shows how the business stands today: active work, money owed, money collected and money spent. Each staff member also sees the money they hold and can hand it to a coworker (owner addition, 2026-10-07).
**Verified:** 2026-11-10T12:50:00Z (HEAD 255245d9, branch `gsd/phase-10-admin-dashboard`, clean working tree)
**Status:** human_needed
**Re-verification:** Yes. The earlier report was written at HEAD 2feec678. Source files changed after it, through the code review fix commits. This run replaces it.

## Result in plain words

The goal is met in the code. I found no gaps and no regressions. The status is `human_needed` only because two CI checks and the owner sign-off cannot happen until the phase PR exists.

What changed since the last report (`git diff 2feec678..HEAD`: 12 files, no file under `src/`):

| Commit | What it did | What I checked |
|---|---|---|
| 5f12c822 (WR-01, owner ruling D-112) | `TransferModal.tsx` now reads `useBusinessTodayState` (which has `isError`, `error`, `refetch`) instead of `useBusinessToday`. When the business date cannot be read, the window shows `ErrorState` ("Couldn't load the transfer form.") with Try Again, and the loading region is marked failed. The noun sits in `moneyCopy.ts` as `failedThings: 'the transfer form'`. | I read the diff and `useBusinessToday.ts`. `isError` is true only when no held or probed date exists and the probe failed. `refetch` calls `probe.refetch()`. The new test in `TransferModal.test.tsx` passes in my run (see below). |
| 20722663 (IN-01) | A test title said 100 codes while it asserted 101. Renamed to "mirrors every code of the API". | One line, test only. `auditCopy.test.ts` passes (48 tests). |
| aaf930cd (IN-02) | The `recordTransfer` e2e helper in `money.spec.ts` and `money-sweep.spec.ts` waits for any earlier "Transfer recorded" toast to leave, then expects exactly one. | Read the diff. Test code only. Not run (e2e not allowed here). |
| 925a66d8 (IN-04) | One bullet in the ROADMAP Phase 16 notes about tie order under "Newest first". | Docs only. |
| 255245d9 | Adds `10-REVIEW-FIX.md`. | Read it. It records 4 findings fixed and IN-03 (WebKit guard wording match) deferred, optional, within D-111 scope. |

Nothing under `src/`, `Directory.Packages.props`, `web/package.json` or `web/package-lock.json` changed in `2feec678..HEAD` (`git diff --stat` on those paths printed nothing). So there is no migration, package, trigger, schema or money-arithmetic change in this range.

## User Flow Coverage

The roadmap marks this phase `mode: mvp`, but the goal is not written as a user story, so I used the six success criteria as the flow. UAT tests 1 to 17 are the owner's own hands-on run of this flow and all record `result: pass`.

| Step | Expected | Evidence | Status |
|---|---|---|---|
| Sign in | Staff land on the dashboard | `routes.tsx:182` `{ index: true, lazy: dashboardPage }`. UAT test 2 pass | VERIFIED |
| Read the shop's state | Greeting, business date, KPIs, chart, statuses, recent orders | `DashboardPage.tsx` uses `useDashboardSummaryQuery`, `IncomeExpenseCard`, `OrdersByStatusCard`, `RecentOrdersCard`. UAT tests 3 to 5 pass | VERIFIED |
| See own money | Money on hand on the dashboard and on My Money | `MoneyStrip` in `DashboardPage.tsx:92`, `MoneyPage` route at `routes.tsx:116`. UAT tests 6, 9 pass | VERIFIED |
| Hand money to a coworker | Transfer window, locked server check, one audit entry | `TransferModal.tsx`, `CreateMoneyTransferHandler.cs`. UAT tests 7, 8, 12, 13 pass | VERIFIED |

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Landing: greeting, business date, View Orders and New Order | VERIFIED | Index route is the dashboard (`routes.tsx:182`). `DashboardPage.tsx:47` builds the title from the server's `data.greeting` and `data.firstName` (`COPY.greeting(...)`). `DashboardPage.test.tsx` passes in my run. UAT test 2 pass. |
| 2 | KPI cards per C-40 | VERIFIED | `DashboardKpiRow.tsx`, `GetDashboardSummaryHandler.cs`, `DashboardReader.cs`, none changed since the last report. `DashboardKpiRow.test.tsx` passes in my run. UAT test 3 pass. |
| 3 | Chart and lists: 6 or 12 months, orders by status, 6 recent orders | VERIFIED | `IncomeExpenseCard` reads `GET dashboard/chart`; `OrdersByStatusCard` and `RecentOrdersCard` read the summary. `IncomeExpenseChart.test.tsx` passes in my run. `OrderReader.cs:149` keeps `Newest` as `CreatedAtUtc` descending then `Id` descending. UAT tests 4, 5 pass. |
| 4 | Card states: skeleton, empty, error with retry on every card | VERIFIED | Each card has its own loading region and alert with Try Again. `dashboardCopy.ts:26` has the kept-figures line "Showing figures from {time}. Couldn't refresh." (D-111). `DashboardPage.test.tsx` passes. |
| 5 | Money on hand: server-computed, ledger, dashboard card, Admin own only, Manager all | VERIFIED | `MoneyOnHand.cs`, `StaffMoneyReader.cs`, `StaffMoneyAccess.cs` unchanged. Matrix rows: Admin 403 on `GET /staff-money`, `/staff-money/{userId}` and `/{userId}/ledger`; Manager 200 or 404 for a random id. UAT tests 6, 9, 10, 11 pass. |
| 6 | Coworker transfers: rules, locked check, double-click, no edit, Manager-only audited delete, matrix rows | VERIFIED | `CreateMoneyTransferHandler.cs` takes `moneyLock.LockAsync` first (line 61 area), reads both people and balances, calls `MoneyTransfer.Record(...)` at line 79 so the domain decides every rule, then `audit.Record(` at line 87 before the single save. Sender is `callerId` from the token. Delete and permanent remove need `Policies.Manager` (`MoneyTransfersController.cs:147`, `:171`). There is no update endpoint (controller has GET, POST, POST handovers, GET recipients, DELETE, DELETE permanent only). D-112 is built: the window no longer hangs on a skeleton when the date cannot be read. |

**Score:** 6/6 truths verified (0 present but behavior-unverified).

### Requirements Coverage

Every ID in the plan frontmatter is in REQUIREMENTS.md (lines 164 to 169 and 175 to 181), and the traceability table maps exactly these 14 IDs to Phase 10 (lines 437 to 450). No orphans. The checkboxes and traceability rows still read Pending; they are updated at ship.

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

I counted the rows in `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`: 2 dashboard, 5 staff-money, 6 money-transfers, 13 in all, one per new action. Examples: `GET /api/v1/staff-money` Anonymous 401, Admin 403, Manager 200. `DELETE /api/v1/money-transfers/{id}` Anonymous 401, Admin 403, Manager 404 (random id). No controller changed in the range since the last report.

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| Sign-in | Dashboard | index route `routes.tsx:182` | WIRED |
| `DashboardPage` | `GET dashboard/summary` | `useDashboardSummaryQuery` | WIRED |
| `IncomeExpenseCard` | `GET dashboard/chart` | `useDashboardChartQuery` | WIRED |
| `MoneyStrip` | `GET staff-money/me` | `useMyMoneyQuery` | WIRED |
| `TransferModal` | business date, then `POST money-transfers` | `useBusinessTodayState` to `ErrorState onRetry={todayState.refetch}`, then `useTransferAction` | WIRED (the retry now reaches the probe) |
| `CreateMoneyTransferHandler` | audit row | `audit.Record(` before `SaveChangesAsync`, same unit of work | WIRED |
| Delete and remove dialogs | `DELETE money-transfers/{id}` and `/permanent` | `useTransferDeletion` | WIRED |
| Orders list "Newest first" | `OrderReader.Sort` | LINQ `OrderByDescending(CreatedAtUtc).ThenByDescending(Id)` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Real data | Status |
|---|---|---|---|---|
| `DashboardPage` and cards | `summary.data` | `GET dashboard/summary` to `GetDashboardSummaryHandler` to `DashboardReader` (EF queries) | Yes | FLOWING |
| `MoneyStrip` | `money.data` | `GET staff-money/me` to `StaffMoneyReader` sums | Yes | FLOWING |
| `TransferModal` date | `todayState.today` | held server answers or a small `ordersService.list` probe, never the device clock | Yes | FLOWING |

The browser does no money arithmetic apart from the labelled Delete Transfer warning preview, which the owner approved in D-111 (P10-BL-18 A). No change to that in this range.

### Behavioral Spot-Checks (run by me)

I ran the preflight first (`preflight.ps1 -Ports 5180,5115,7028,5199`): all four ports free, no dev or test processes, LocalDB sessions 0 on every database. I still ran only tests with no database, server or browser.

| Behavior | Command | Result | Status |
|---|---|---|---|
| Transfer window failure line and recovery (D-112), audit code mirror, business-date hook, dashboard page, KPI row, chart, OR-4 dash guard, source layout | `npx vitest run --maxWorkers=2` on `TransferModal.test.tsx`, `auditCopy.test.ts`, `useBusinessToday.test.tsx`, `DashboardPage.test.tsx`, `DashboardKpiRow.test.tsx`, `IncomeExpenseChart.test.tsx`, `no-long-dash`, `source-layout` | `Test Files  8 passed (8)`, `Tests  266 passed (266)` | PASS |
| Transfer handler (audit entry added, none on a refusal), audit detail, audit line reading, removed-transfer handler | `dotnet test --project tests/Csps.Application.UnitTests` with `--filter-class` on `CreateMoneyTransferHandlerTests`, `MoneyAuditDetailTests`, `AuditChangeLinesTests`, `RemoveMoneyTransferHandlerTests` | `Test run summary: Passed! total: 119, failed: 0` | PASS |
| New action is in the closed audit list | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*AuditActionsTests"` | `succeeded: 87, failed: 0` | PASS |

Not run by me: the Server integration tests (they need LocalDB), Playwright e2e, parity snapshots, and the full suites. 10-REVIEW-FIX.md says the fixer ran `npm run typecheck` (no errors), `npx eslint --max-warnings 0` on the changed files (clean) and `npm run lint` (exit 0). I did not repeat those and do not count them as my evidence.

### Probe Execution

Not applicable: no plan declares a probe.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `TransferModal.tsx`, `moneyCopy.ts`, `money.spec.ts`, `money-sweep.spec.ts` | | `TBD`, `FIXME`, `XXX` | none found (grep) | |
| `web/e2e/fixtures.ts` | 77 to 82, 140 to 149, 177 to 179 | IN-03: the WebKit cancelled-request guard matches on wording only | Info (deferred, optional, in D-111 scope) | A real fault in the app's own `/api/` fetch could be hidden on WebKit if it produced the same sentence. Needs a WebKit e2e run to harden safely. Test code only, no product effect |
| `docs/api/orders.md` | `sort` row | Optional rewording from review IN-04 not done | Info | Docs wording only |
| `10-VALIDATION.md` | 5 to 6 | status `draft`, `nyquist_compliant: false` | Info | `/gsd-validate-phase 10` has not run. Not a code gap |

No debt markers, no stubs, no hardcoded empty data feeding a screen were found in the five files changed by the fix commits.

### Schema, SQL, packages, dashes

| Check | Result |
|---|---|
| Schema, SQL, triggers, packages | `git diff 2feec678..HEAD --stat` on `src`, `Directory.Packages.props`, `web/package.json` and `web/package-lock.json` printed nothing |
| Long dash in `web/src` (OR-4) | `no-long-dash.node.test.ts` passed in my run |
| Source layout (OR-6) | `source-layout.node.test.ts` passed in my run |

### Known failures that predate this work

- Parity `@overlays`: 18 failures, all and only `confirm-delete-order` and `confirm-delete-order-typed` (the Delete Order dialog), named in `10-04-SUMMARY.md` as untouched by Phase 10. The CI parity run on the phase PR is the judge.
- `ExpenseListTimingTests` missed its 300 ms limit by 3.7 ms once under load (D-76, D-88, D-103).
- `web/scripts/third-party-notices.test.ts` timed out locally under load. No package, lock file or `web/scripts` file changed in Phase 10. It needs one run on a clean checkout, which is the CI job.

I did not re-run these here. They are carried from `10-UAT.md` and the earlier report.

### UAT record

`10-UAT.md` frontmatter status is `partial`. I counted `result: pass` 147 times. The only other results are test 18 and test 19, both `result: blocked` with `blocked_by: release-build` (owner ruling 2026-11-09). No test is recorded as an issue or fail.

### Human Verification Required

#### 1. CI parity snapshots (UAT test 18, ship gate D-1)
**Test:** Open the phase PR and let CI run (`/gsd-ship 10`).
**Expected:** The parity pixel snapshot job is green before merge.
**Why human:** No PR exists and the branch is not pushed. Snapshots differ locally by glyph edges, so only CI can confirm.

#### 2. One clean CI run (UAT test 19)
**Test:** On the phase PR's CI, one full e2e run, one Server test run and `web/scripts/third-party-notices.test.ts`.
**Expected:** No e2e failures, `ExpenseListTimingTests` under 300 ms, and the notices test passes. This also runs the e2e toast helpers changed in IN-02, which were not run locally.
**Why human:** Blocked on the same PR. The shared machine cannot give a clean run.

#### 3. P10-BL-20: the owner's sign-off
**Test:** Read the sign-off in DECISIONS.md.
**Expected:** The owner approves or rejects it, and says whether to ship.
**Why human:** Owner decision.

#### 4. The Transfer window with a failing date read (D-112)
**Test:** Leave the dashboard open longer than 5 minutes, cut the network, press Transfer.
**Expected:** "Couldn't load the transfer form." with Try Again. Try Again fills the Date once the network is back.
**Why human:** The unit test passes, but the wording was ruled by the owner and the fix report asks for a quick look.

#### 5. P10-BL-13 follow-up (small, not blocking)
**Test:** Choose A (keep hand-over yes or no in the stored record only; built) or B (also show it on the Audit Log screen, with new wording).
**Expected:** A dated ruling in DECISIONS.md.
**Why human:** Owner decision. **Ruled D-113 (owner, 2026-11-10): option A.** Closed; the code already does A.

### Gaps Summary

No gaps. All six success criteria and all 14 requirements are met in the code. The five code review fix commits keep them met: the Transfer window now ends in a failure line with Try Again instead of an endless skeleton, nothing under `src/` changed, money is still computed on the server, and the transfer's audit entry still joins its single save. What remains is CI work that needs the phase PR (items 1 and 2), a quick owner look (item 4) and owner decisions (items 3 and 5).

---

_Verified: 2026-11-10T12:50:00Z_
_Verifier: Claude (gsd-verifier)_
