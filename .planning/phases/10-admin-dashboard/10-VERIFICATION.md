---
phase: 10-admin-dashboard
created: 2026-11-09T08:15:00-06:00
updated: 2026-11-13T23:50:00-06:00
verified: 2026-11-14T05:50:00Z
status: passed
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
covered_digest: "v3:sha256:05f8b831cdd861f8b1bc789d1f41e8fd490f555cfd96b98064086d9475bd69f7"
re_verification:
  previous_status: human_needed
  previous_score: 6/6
  gaps_closed: []
  gaps_remaining: []
  regressions: []
  note: "The earlier report (HEAD 255245d9, 2026-11-10) was marked stale only because Phase 11 later edited 22 of the files it covers. This run re-checks the code on branch gsd/phase-11-public-site-content-management (HEAD 6d31983c, clean tree), 433 commits after the Phase 10 merge 25bd3431. Phase 11 changed none of the Phase 10 behavior."
decision_coverage:
  honored: 62
  total: 62
  not_honored: []
  note: "Carried from the earlier report. The rulings since then (D-113, D-114, D-119, D-120, D-121) close owner items and change no code."
human_verification: []
human_items_resolved:
  - item: "UAT test 18: the parity pixel snapshot job on the phase PR"
    resolved_by: "10-UAT.md test 18 result: pass. Owner confirmed 2026-11-13 from CI run 42979065519 on 89d723cd (parity 10/10 and 15/15, e2e 713 passed). PR 24 merged as 25bd3431."
  - item: "UAT test 19: one clean full test run on the phase PR's CI"
    resolved_by: "10-UAT.md test 19 result: pass. Same CI run: .NET 1323, 2561 (Server, with ExpenseListTimingTests), 9 and 1067 tests, web 9076, e2e 713 and Lighthouse all passed."
  - item: "P10-BL-20: the owner's Phase 10 sign-off"
    resolved_by: "D-114 (owner, 2026-11-10: screens passed, go-ahead to ship) and D-121 (owner, 2026-11-11: item 3, the three quick 261109-vj6 choices, approved as built). 10-UAT.md status is complete, 149 of 149 pass."
  - item: "The Transfer window with a failing date read (D-112)"
    resolved_by: "Covered by TransferModal.test.tsx, which passed in this run, and by the CI e2e run that included the IN-02 toast waits. The owner's hands-on network-cut look was never recorded as done, and I treat it as an optional extra, not a blocker. See Human Verification below."
  - item: "P10-BL-13 follow-up: hand-over yes or no on the Audit Log screen"
    resolved_by: "D-113 (owner, 2026-11-10): option A, stored record only. The code does A."
carried_to_phase_11:
  - "P10-BL-22 order-number deadlock: built in Phase 11 plan 11-01 (commit ab2cc829). See the section on Phase 11 changes."
  - "P10-BL-23 owner review (expense list deferred-join query, create-user roster lock): carried by D-119; DECISIONS.md already records D-120 approving both as built."
  - "P10-BL-20 item 3 owner review (quick 261109-vj6 choices): carried by D-119; DECISIONS.md already records D-121 approving them."
  - "Dependabot alert 6 (minimatch, GHSA-g3hv-75wg-m249): dev-only, carried by D-119; a package change needs the owner's approval."
---

# Phase 10: Admin Dashboard Verification Report
*Created: 2026-11-09T08:15:00-06:00 · Updated: 2026-11-13T23:50:00-06:00*

**Phase Goal:** Staff land on a dashboard that shows how the business stands today: active work, money owed, money collected and money spent. Each staff member also sees the money they hold and can hand it to a coworker (owner addition, 2026-10-07).
**Verified:** 2026-11-14T05:50:00Z (HEAD 6d31983c, branch `gsd/phase-11-public-site-content-management`, clean working tree)
**Status:** passed
**Re-verification:** Yes. The earlier report (HEAD 255245d9) was marked stale because Phase 11 edited files it covers. This run checks today's code.

## Result in plain words

The goal is met in today's code. All six success criteria and all 14 requirements hold, and Phase 11 broke none of them. The earlier `human_needed` status is gone because every item behind it is now closed: the two CI checks (UAT 18 and 19) passed on PR 24's CI run, the owner signed off, and UAT is complete with 149 of 149 passed.

I read the code, not the SUMMARY files, and I ran the targeted tests listed below on the current branch. Nothing under the Phase 10 money or dashboard code changed since the merge.

## What Phase 11 changed in Phase 10's files

`git diff 25bd3431..HEAD` touches 812 files. Of the 188 implementation files the earlier report covered, 22 changed. I read each diff. None of them touches a Phase 10 behavior.

| Changed Phase 10 file | What Phase 11 did | Effect on Phase 10 |
|---|---|---|
| `AuditActions.cs` | 124 added lines (new site-content codes). No line removed | The money codes (`money-transfer.added`, deleted, removed, hand-over) are intact. `AuditActionsTests` passed (197 Domain tests in the run) |
| `OrderReader.cs` | +30 lines: a join for the public-website consenter and a `publicWebsite` block in the order detail | None. The list sort (`Newest` = `CreatedAtUtc` desc then `Id` desc) that feeds Recent Orders is not touched |
| `DatabaseLocks.cs`, `DatabaseLockConfiguration.cs` | A new standing lock row `site-content` (68 rows, was 67). The `staff-money` lock and the shared `TakeAsync` are unchanged | None. `StaffMoneyLock` still takes its lock by updating the `staff-money` row and still turns a lost deadlock into a 409 |
| `CspsDbContext.cs`, `DependencyInjection.cs`, `ApplicationRegistration.cs`, `CspsDbContextModelSnapshot.cs` | New DbSets, content registrations, an invalidation interceptor | Nothing removed. No new migration touches `MoneyTransfers`. The eight new migrations are content, orders and the snapshot setting |
| `router.tsx`, `routes.tsx` | The public pages moved into `PublicLayout`; a Manager-only `site-content/*` route was added | `{ index: true, lazy: dashboardPage }` is still the admin index (`routes.tsx:186`). `money` and `money/staff/:userId` routes are intact |
| `Sidebar.tsx`, `navigation/index.ts`, `sections.ts` | A Manager-only Site Content item | My Money and the dashboard section mapping are intact. `sections.test.ts` and the navigation tests passed |
| `cells.tsx`, `lists.recipe.ts` | New optional `disabled` and `busy` props on `RowAction`, and a `flowActions` cell kind | Additive. The ledger and transfer tables use the old props and their tests passed |
| `auditCopy.ts`, `ShowcaseDemos.tsx`, `showcaseCopy.ts`, `showcaseSections.ts`, `OrderFormPage.tsx`, `api.generated.ts`, `openapi.v1.json` | New wording and demos, order form public-website card, regenerated contract | All 13 Phase 10 endpoints are still in `openapi.v1.json` |

Nothing changed in `Directory.Packages.props`, `web/package.json` or `web/package-lock.json` since the merge.

## Phase 10 carry-over items (carried, not Phase 10 gaps)

Recorded in ROADMAP.md under Phase 11 by D-119. I list them as carried and check what the code says today.

| Item | State today |
|---|---|
| P10-BL-22 order-number deadlock | Built in Phase 11 plan 11-01 (commit ab2cc829). `OrderNumberAllocator.cs` now catches `DatabaseLockTimeoutException` with the deadlock-victim code, clears the change tracker and throws `ConcurrencyConflictException` (a 409), the same pattern as `StaffMoneyLock`. A plain timeout still gives the busy answer. The tests in `OrderNumberAllocatorTests` passed in my run. The ROADMAP carry-over line still reads "fix it", but plan 11-01 is ticked and 11-01-SUMMARY says it is done, so that line is out of date |
| Effect of quick 261113-uj0 (read committed snapshot) on P10-BL-22 | It does not replace the fix and does not undo it. The order-number lock and the staff-money lock are exclusive updates of a standing row. Row versions change what a plain read waits for, not what a write waits for. The migration is built and its tests pass. In production it takes effect only when the owner applies the next script (DECISIONS D-P11-BL-35). The quick's own audit found one read that relied on waiting (first-Manager command, P11-BL-64), and the owner accepted it (D-P11-BL-64). It is not a Phase 10 path |
| P10-BL-23 owner review | Carried by D-119. DECISIONS.md already holds D-120 (owner, 2026-11-11): both changes approved as built |
| P10-BL-20 item 3 owner review | Carried by D-119. DECISIONS.md already holds D-121 (owner, 2026-11-11): the three choices stay as built |
| Dependabot alert 6 (minimatch) | Dev-only and carried. Not a Phase 10 code gap. A package change needs the owner's approval |

### Does read committed snapshot weaken MONEY-05 (no overdraft under concurrent transfers)?

I checked, because the transfer's balance check is a read. The handler takes `moneyLock.LockAsync` first, and only then reads both balances. Two transfers from one sender queue on the exclusive `staff-money` row. The second reads after the first has committed, so under snapshot reads it still sees the first transfer. An expense takes no lock by design (D-53, OD-16: an expense is never refused), so a transfer racing an expense matches one serial order, and the test for that says so. `MoneyTransferConcurrencyTests` ran on LocalDB with snapshot reads on (the migration is part of the test database build): 7 of 7 passed.

## User Flow Coverage

The roadmap marks this phase `mode: mvp`, but the goal is not written as a user story, so I used the six success criteria as the flow. The owner's own hands-on run of this flow is UAT tests 1 to 17, all `result: pass`.

| Step | Expected | Evidence | Status |
|---|---|---|---|
| Sign in | Staff land on the dashboard | `routes.tsx:186` `{ index: true, lazy: dashboardPage }`. UAT test 2 pass | VERIFIED |
| Read the shop's state | Greeting, business date, KPIs, chart, statuses, recent orders | `DashboardPage.tsx` lines 92 to 98 render `MoneyStrip`, `DashboardKpiRow`, `IncomeExpenseCard`, `OrdersByStatusCard`, `RecentOrdersCard` from `useDashboardSummaryQuery`. UAT tests 3 to 5 pass | VERIFIED |
| See own money | Money on hand on the dashboard and on My Money | `MoneyStrip` in `DashboardPage.tsx:92`; `money` route at `routes.tsx:203`. UAT tests 6, 9 pass | VERIFIED |
| Hand money to a coworker | Transfer window, locked server check, one audit entry | `TransferModal.tsx`, `CreateMoneyTransferHandler.cs`. UAT tests 7, 8, 12, 13 pass | VERIFIED |

## Goal Achievement

### Observable Truths (roadmap success criteria)

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | Landing: greeting, business date in Manila time, View Orders and New Order | VERIFIED | Admin index route is the dashboard. `DashboardPage.test.tsx` passed in my run. `DashboardController.cs` has `GET summary` under `Policies.Staff`. UAT test 2 pass |
| 2 | KPI cards per C-40 (active plus due this week, receivables, collected plus change, company expenses plus count and top category) | VERIFIED | `DashboardKpiRow.tsx`, `GetDashboardSummaryHandler.cs`, `DashboardReader.cs` are unchanged since merge. `DashboardKpiRow.test.tsx` and the Server `DashboardSummaryEndpointTests` passed. UAT test 3 pass |
| 3 | Chart 6 or 12 months, orders by status with active total, 6 recent orders linked to detail | VERIFIED | `IncomeExpenseCard` reads `GET dashboard/chart` (validator allows only 6 or 12). `DashboardChartEndpointTests` and `IncomeExpenseChart` tests passed. `OrderReader.cs` sort is unchanged. UAT tests 4, 5 pass |
| 4 | Every card has skeleton, empty and error with retry | VERIFIED | Each card has its own loading region and alert with Try Again (`DashboardPage.test.tsx` passed). UAT tests (loading region, empty state, alert) pass |
| 5 | Money on hand: server-computed, ledger, dashboard card; Admin own only (403 otherwise); Manager all | VERIFIED | `MoneyOnHand.Of` sums on the server (`MoneyOnHand.cs`). `StaffMoneyAccess.Check` decides role before any lookup, so a refusal is the same for a real and a made-up id. Controller: `GET staff-money` is `Policies.Manager`; `{userId}` and `{userId}/ledger` are `Staff` plus the handler check. Matrix rows: Admin 403 on all three, Manager 200 or 404. `StaffMoneyBalanceTests`, `StaffLedgerEndpointTests`, `StaffMoneyAccessEndpointTests` passed. UAT tests 6, 9, 10, 11 pass |
| 6 | Transfers: above zero, not to self, no future date, never above what is held even under two concurrent attempts; double-click records one; no edit; Manager-only audited delete; matrix rows | VERIFIED | `CreateMoneyTransferHandler.cs`: `moneyLock.LockAsync` first, sender state read under the lock, `MoneyTransfer.Record(...)` decides every rule in the domain, `audit.Record(...)` joins the single `SaveChangesAsync`. The sender is `callerId` from the token, never the request. `DELETE {id}`, `DELETE {id}/permanent` and `POST handovers` are `Policies.Manager`. There is no PUT or PATCH on `money-transfers`. Idempotency covers the money POSTs (`MoneyTransferEndpointTests`). `MoneyTransferConcurrencyTests` 7 of 7, `MoneyTransferDeletionTests` and the rest of the Money namespace passed |

**Score:** 6/6 truths verified (0 present but behavior-unverified).

The behavior-dependent truths (concurrent transfers, double-click, the audit entry on delete) each have a named test that exercises the invariant, and I ran those tests. None rests on symbol presence alone.

### Requirements Coverage

The union of `requirements:` across the 21 plan frontmatters is exactly DASH-01 to DASH-06 and MONEY-01 to MONEY-08, which is the 14 IDs in the ROADMAP phase block and in the REQUIREMENTS.md traceability table (lines 437 to 450). Each ID has its definition in REQUIREMENTS.md (lines 164 to 169 and 175 to 181). No orphans and no missing IDs.

| Requirement | Source plans | Status | Evidence |
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
| MONEY-05 | 10-03, 10-10, 10-12, 10-15 | SATISFIED | Truth 6 and the snapshot check above |
| MONEY-06 | 10-12, 10-18, 10-20 | SATISFIED | Truth 6 |
| MONEY-07 | 10-03, 10-18, 10-20 | SATISFIED | Truth 6 (no update endpoint) |
| MONEY-08 | 10-08, 10-10, 10-12, 10-14, 10-16, 10-18 | SATISFIED | Truth 6 and the matrix below |

### Authorization Matrix

`AuthorizationMatrix.cs` holds 13 rows for the 13 new actions: 2 dashboard, 5 staff money, 6 money transfers. They match the 13 paths in `openapi.v1.json` and the controllers. Examples: `GET /api/v1/staff-money` Anonymous 401, Admin 403, Manager 200. `DELETE /api/v1/money-transfers/{id}` Anonymous 401, Admin 403, Manager 404 (random id). `AuthorizationMatrixTests` and `AuthorizationCoverageTests` passed in my run (558 tests with the second class).

### Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| Sign-in | Dashboard | index route `routes.tsx:186` | WIRED |
| `DashboardPage` | `GET dashboard/summary` | `useDashboardSummaryQuery` | WIRED |
| `IncomeExpenseCard` | `GET dashboard/chart` | `useDashboardChartQuery` | WIRED |
| `MoneyStrip` | `GET staff-money/me` | `useMyMoneyQuery` | WIRED |
| `TransferModal` | business date, then `POST money-transfers` | `useBusinessTodayState` to `ErrorState onRetry={todayState.refetch}`, then `useTransferAction` | WIRED (D-112 failure line with Try Again is still in `TransferModal.tsx` lines 134 to 136) |
| `CreateMoneyTransferHandler` | audit row | `audit.Record(` before `SaveChangesAsync`, same unit of work | WIRED |
| `CreateMoneyTransferHandler` | `staff-money` lock | `IStaffMoneyLock` to `StaffMoneyLock` to `DatabaseLocks.TakeAsync` | WIRED |
| Delete and remove dialogs | `DELETE money-transfers/{id}` and `/permanent` | `useTransferDeletion` | WIRED |
| Admin router | dashboard and money pages | `adminRoutes` spread into `queryBranch` in `router.tsx:95` | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Real data | Status |
|---|---|---|---|---|
| `DashboardPage` and cards | `summary.data` | `GET dashboard/summary` to `GetDashboardSummaryHandler` to `DashboardReader` (EF queries) | Yes | FLOWING |
| `MoneyStrip` | `money.data` | `GET staff-money/me` to `StaffMoneyReader` sums | Yes | FLOWING |
| `TransferModal` date | `todayState.today` | held server answers or a small `ordersService.list` probe, never the device clock | Yes | FLOWING |

The browser does no money arithmetic apart from the labelled Delete Transfer warning preview the owner approved in D-111.

### Behavioral Spot-Checks (run by me, today, on this branch)

I ran the preflight first (`preflight.ps1 -Ports 5180,5115,7028,5199`): all four ports free, no dev or test processes, every LocalDB database at 0 sessions. I started no server and no browser, and ran no full suite. .NET runs used `CSPS_TEST_SQL=localdb` set on the command only.

| Behavior | Command (shortened) | Result | Status |
|---|---|---|---|
| Concurrent transfers, race with an expense, snapshot reads on | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MoneyTransferConcurrencyTests"` | total 7, failed 0 | PASS |
| Every Money and Dashboard endpoint test (balances, ledger, access, transfers, handovers, recipients, deletion, routes, attribution, summary, chart) | same project, `--filter-namespace` Money and Dashboard | total 190, failed 0 | PASS |
| Authorization matrix and coverage | same project, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests` | total 558, failed 0 | PASS |
| Order-number deadlock fix (P10-BL-22), snapshot migration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests` on `*OrderNumberAllocatorTests`, `*ReadCommittedSnapshotMigrationTests` | total 11, failed 0 | PASS |
| No other trigger than the audit one (OR-7) | `*TriggerInventoryTests` | total 2, failed 0 | PASS |
| Domain rules, audit codes, business clock | `dotnet test --project tests/Csps.Domain.UnitTests` on the audit-action, money-transfer, money-on-hand and business-clock test classes | total 197, failed 0 | PASS |
| Money and dashboard handlers | `dotnet test --project tests/Csps.Application.UnitTests`, `--filter-namespace` Money and Dashboard | total 297, failed 0 | PASS |
| Dashboard page, KPI row, Transfer window, chart, audit wording, sections, routes, My Money, Staff Money, ledger and transfer tables, all admin services | `npx vitest run --maxWorkers=2` on the matching paths | 46 files, 1010 tests passed | PASS |
| Navigation, admin layout, router, OR-4 long dash guard, source layout | `npx vitest run --maxWorkers=2` on those paths | 10 files, 319 tests passed | PASS |

Not run by me: Playwright e2e, parity snapshots and the full suites (shared machine). The owner confirmed one full green CI run on 89d723cd for the shipped code (UAT 19: .NET 1323, 2561, 9 and 1067, web 9076, e2e 713, Lighthouse). That run is the owner's evidence, not mine, and it predates Phase 11. Phase 11 has its own CI.

### Probe Execution

Not applicable: no plan declares a probe.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| All 188 Phase 10 implementation files | | `TBD`, `FIXME`, `XXX` | none found (grep) | |
| `web/e2e/fixtures.ts` | 77 to 82, 140 to 149, 177 to 179 | IN-03: the WebKit cancelled-request guard matches on wording only | Info (deferred, optional, D-111 scope) | Test code only, no product effect |
| `docs/api/orders.md` | `sort` row | Optional rewording from review IN-04 not done | Info | Docs wording only |

No stubs, no hardcoded empty data feeding a screen, and no debt markers.

### Schema, SQL, packages, dashes

| Check | Result |
|---|---|
| Schema | No Phase 11 migration touches `MoneyTransfers`. The phase's own `20261107110304_AddMoneyTransfers` is unchanged |
| Triggers (OR-7) | `TriggerInventoryTests` passed |
| Packages | `git diff 25bd3431..HEAD --stat` on `Directory.Packages.props`, `web/package.json`, `web/package-lock.json` printed nothing |
| Long dash in `web/src` (OR-4) | `no-long-dash.node.test.ts` passed |
| Source layout (OR-6) | `source-layout.node.test.ts` passed |

### Known failures that predate this work

The earlier report listed 18 parity `@overlays` failures (the Delete Order dialog), a 3.7 ms miss on `ExpenseListTimingTests` and a timed-out notices test, all on the shared machine. PR 24's CI run was green on all of them (UAT 18 and 19), so they are closed.

### UAT record

`10-UAT.md` frontmatter status is `complete`. I counted `result: pass` 149 times and no other result. Tests 18 and 19, which were `blocked` in the earlier report, now read `pass` with the owner's evidence. `10-SECURITY.md` has `threats_open: 0` and status `verified`. `10-VALIDATION.md` is now `validated` with `nyquist_compliant: true`, so the earlier Info line about it is closed.

## Human Verification Required

None blocking. The earlier items are resolved as listed in the frontmatter `human_items_resolved`. One optional item is left:

#### Optional: look at the Transfer window with a failing date read (D-112)
**Test:** Leave the dashboard open longer than 5 minutes, cut the network, press Transfer.
**Expected:** "Couldn't load the transfer form." with Try Again. Try Again fills the Date once the network is back.
**Why optional:** `TransferModal.test.tsx` passed in my run and asserts the wording the owner ruled. The e2e toast waits changed in IN-02 ran in the green CI run. The hands-on look was never recorded as done, so I note it and do not count it as a blocker.

## Bookkeeping gaps (not code, not goal blockers)

These are record-keeping lines that still say Phase 10 is open, though it shipped. They are WARNING level and do not change the status.

| Where | What it says now | What it should say |
|---|---|---|
| `.planning/REQUIREMENTS.md` lines 164 to 169, 175 to 181 and 437 to 450 | DASH-01 to MONEY-08 unchecked and `Pending` | Checked and `Complete` |
| `.planning/ROADMAP.md` line 65 and the progress table at line 1540 | `[ ]` and `21/21 In Progress` | `[x]` and Complete |
| `.planning/ROADMAP.md` line 1176 | P10-BL-22 "fix it" | Built in plan 11-01 (commit ab2cc829) |

The earlier report said these update at ship. The ship happened (PR 24), so they should be updated when the phase is closed.

## Gaps Summary

No gaps. All six success criteria and all 14 requirements are met in the code as it stands on the Phase 11 branch. Phase 11 added content features beside the Phase 10 code and did not change any Phase 10 money or dashboard path. The one Phase 11 change that touches a Phase 10 theme is the order-number deadlock fix (P10-BL-22), which is built and tested. The read committed snapshot quick does not weaken the transfer balance check, because the transfer takes its lock before it reads.

---

_Verified: 2026-11-14T05:50:00Z_
_Verifier: Claude (gsd-verifier)_
