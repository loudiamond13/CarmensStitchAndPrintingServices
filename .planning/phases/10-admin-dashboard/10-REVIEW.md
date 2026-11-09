---
phase: 10-admin-dashboard
scope: phase-end
created: 2026-11-09T00:33:00-06:00
updated: 2026-11-09T00:33:00-06:00
reviewed_range: 7f127c2a..HEAD (excluding .planning/)
depth: deep
files_reviewed: 62
files_reviewed_list:
  - src/Csps.Application/Dashboard/ChartMonths.cs
  - src/Csps.Application/Dashboard/DashboardPeriod.cs
  - src/Csps.Application/Dashboard/GetDashboardChartHandler.cs
  - src/Csps.Application/Dashboard/GetDashboardSummaryHandler.cs
  - src/Csps.Application/Money/CreateMoneyHandoverRequestValidator.cs
  - src/Csps.Application/Money/CreateMoneyTransferHandler.cs
  - src/Csps.Application/Money/CreateMoneyTransferRequestValidator.cs
  - src/Csps.Application/Money/DeleteMoneyTransferHandler.cs
  - src/Csps.Application/Money/GetLedgerHandler.cs
  - src/Csps.Application/Money/GetMyMoneyHandler.cs
  - src/Csps.Application/Money/GetStaffMoneyHandler.cs
  - src/Csps.Application/Money/HandOverMoneyHandler.cs
  - src/Csps.Application/Money/LedgerPageResponse.cs
  - src/Csps.Application/Money/LedgerRowView.cs
  - src/Csps.Application/Money/LedgerRunningBalance.cs
  - src/Csps.Application/Money/ListMoneyTransfersHandler.cs
  - src/Csps.Application/Money/ListStaffBalancesHandler.cs
  - src/Csps.Application/Money/ListTransferRecipientsHandler.cs
  - src/Csps.Application/Money/MoneyAuditDetail.cs
  - src/Csps.Application/Money/MoneyParties.cs
  - src/Csps.Application/Money/RemoveMoneyTransferHandler.cs
  - src/Csps.Application/Money/StaffMoneyAccess.cs
  - src/Csps.Application/Money/StaffMoneySums.cs
  - src/Csps.Application/Orders/ListOrdersHandler.cs
  - src/Csps.Application/Orders/OrderListEntries.cs
  - src/Csps.Domain/Money/MoneyTransfer.cs
  - src/Csps.Domain/Orders/OrderStatusRules.cs
  - src/Csps.Domain/Time/BusinessClock.cs
  - src/Csps.Infrastructure/Dashboard/DashboardReader.cs
  - src/Csps.Infrastructure/Money/StaffLedgerQuery.cs
  - src/Csps.Infrastructure/Money/StaffMoneyLock.cs
  - src/Csps.Infrastructure/Money/StaffMoneyReader.cs
  - src/Csps.Infrastructure/Orders/OrderReader.cs
  - src/Csps.Infrastructure/Persistence/Configurations/MoneyTransferConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261107110304_AddMoneyTransfers.cs
  - src/Csps.Server/Controllers/DashboardController.cs
  - src/Csps.Server/Controllers/MoneyTransfersController.cs
  - src/Csps.Server/Controllers/StaffMoneyController.cs
  - src/Csps.Server/Http/CspsProblemDetails.cs
  - src/Csps.Server/Program.cs
  - src/Csps.Server/Security/RateLimitingRegistration.cs
  - docs/api/dashboard.md
  - web/src/components/data/IncomeExpenseChart.tsx
  - web/src/components/money/KpiCard.tsx
  - web/src/modules/admin/components/DashboardKpiRow.tsx
  - web/src/modules/admin/components/DeleteTransferDialog.tsx
  - web/src/modules/admin/components/ExpenseModal.tsx
  - web/src/modules/admin/components/LedgerCard.tsx
  - web/src/modules/admin/components/OrdersByStatusCard.tsx
  - web/src/modules/admin/components/RecentOrdersCard.tsx
  - web/src/modules/admin/components/TransferModal.tsx
  - web/src/modules/admin/components/TransfersCard.tsx
  - web/src/modules/admin/hooks/useBusinessToday.ts
  - web/src/modules/admin/hooks/useMoneyListParams.ts
  - web/src/modules/admin/hooks/useOrderChildSave.ts
  - web/src/modules/admin/hooks/useRefreshExpenses.ts
  - web/src/modules/admin/hooks/useRefreshMoney.ts
  - web/src/modules/admin/hooks/useRefreshOrders.ts
  - web/src/modules/admin/hooks/useTransferAction.ts
  - web/src/modules/admin/moneySchemas.ts
  - web/src/modules/admin/services/dashboardService.ts
findings:
  critical: 0
  warning: 5
  info: 8
  total: 13
deferred_items_judged: 12
status: issues_found
---

# Phase 10 Phase-End Code Review

*Created: 2026-11-09T00:33:00-06:00 · Updated: 2026-11-09T00:33:00-06:00*

**Reviewed:** 2026-11-09T00:33:00-06:00
**Depth:** deep (cross-wave)
**Range:** 7f127c2a..HEAD, excluding `.planning/` (395 files)
**Status:** issues_found

## Summary

This pass looked across the eleven waves for what a single wave review could not see. It read the dashboard, staff money, ledger and transfer code side by side, traced every money figure from the database to the screen, checked the authorization matrix rows, the staff-money lock (D-53), rowversion use and the client refresh paths.

The range also holds the Phase 9 squash commit (`a7c40cf2`) with the last Phase 9 fixes (upload slot middleware, maintenance cursors, the removed backup probe). Phase 9's own reviews own that code; this pass only checked that its server plumbing changes do not touch the money paths.

The server side holds up well. Every balance is summed on the server from one formula (`MoneyOnHand.Of`), the ledger and the balance read the same six sources under the same SoftDelete filters, the lock is taken before every read in transfer and hand-over, the sender is always the token's user, and every new endpoint has matrix rows with exact statuses. No BLOCKER was found.

The open risks sit at the edges where waves met:

- The transfer window learned (wave 7) to re-read money after a save that may have run. The order and expense windows, which move the same money, never did (WR-01).
- The money answers are narrowed through `toFiniteFigure`. The dashboard summary, the busiest money screen, still uses bare `Number()` (WR-02).
- The wave 8 past-the-end and Rows per page fixes reached the two money lists only. Six other lists keep the old faults (WR-03).
- One chart label bug from wave 1 was never ruled or parked (WR-04).
- The Transfer window's Date default never follows a newer business day (WR-05, widens wave 7 IN-08).

Several wave 1 to 3 info items that were sent to this review are still open. They are grouped in IN-01 to IN-05 so they are not lost.

Evidence run for this review: `npx vitest run scripts/third-party-notices.test.ts` on the main checkout passed 11 of 11 in 11.7 s (the slow case took 11.0 s against its 120 s limit). The preflight check showed all four ports free and no other project's test processes.

## Warnings

### WR-01: An order or expense save that may have run refreshes nothing, so money, the dashboard and the order page stay old

**Files:** `web/src/modules/admin/hooks/useOrderChildSave.ts:118-149`, `:151-160`; `web/src/modules/admin/components/ExpenseModal.tsx:239-271`, `:274-290`; compare `web/src/modules/admin/hooks/useTransferAction.ts:70-76`

**Problem:** Wave 7 WR-03 fixed the transfer window: after a 5xx, a 408, a timeout or no answer, it reads the money answers again. Its outcome sent "key handling across a closed and reopened window" for orders and expenses to this review. The order windows (payment, refund, order expense, item, discount) and the company expense window still treat that failure as a plain line. `showFailure` ends in `showLine(errorLine(copy))` with no refresh. `useRefreshOrders` and `useRefreshExpenses` run only on success. A payment or expense also moves money on hand (MONEY-01, ORD-22, CEXP-05), so after such a failure the order page, the dashboard KPIs and chart, the money strip and the ledger all keep the figures from before the save.

**Failure scenario:**

1. Liza records a ₱5,000.00 payment on ORD-2026-0041. The server commits, but the answer is lost (a proxy 502 or a dropped phone connection).
2. The window shows "Something went wrong. Please try again." The Payments tab and the order balance still show the old figures.
3. Liza closes the window. The `useSubmission` key goes with it.
4. She opens Add Payment again and saves the same ₱5,000.00 under a new key. The order is not fully paid by the old figures, so the server records a second payment. Her money on hand and Collected this month are both ₱5,000.00 too high.

**Fix:** Give the order and expense windows the same rule as the transfer window, in one shared place:

```ts
// lib/forms/mayHaveRun.ts (export the existing check from useSubmission)
export function mayHaveSaved(error: unknown): boolean {
  return !isHttpError(error) || error.kind !== 'http' || error.status >= 500 || error.status === 408;
}

// useOrderChildSave.ts, at the top of showFailure
if (mayHaveSaved(error)) {
  void refetchOrder(orderId);
  void refreshAll(); // useRefreshOrders()
}
```

Do the same in `ExpenseModal.tsx` with `useRefreshExpenses()`, and use the helper in `useTransferAction.ts` so the three paths cannot drift. Add one test per window: a 500, then the order (or expense list) and `['staff-money']` are read again. The key across a closed and reopened window stays as built: with the fresh figures on screen, a person can see the first save landed.

### WR-02: The dashboard summary still uses bare `Number()`, so a bad figure shows as ₱NaN while every money answer refuses it

**Files:** `web/src/modules/admin/components/DashboardKpiRow.tsx:14-17`, `:42-83`; `web/src/modules/admin/components/OrdersByStatusCard.tsx:34-42`; `web/src/modules/admin/components/RecentOrdersCard.tsx:65`; compare `web/src/modules/admin/services/dashboardService.ts:39-62` and `web/src/modules/admin/services/moneyService.ts:115-125`, `:254-258`, `:363-367`

**Problem:** Waves 5 and 6 built `toFiniteFigure` and moved the chart, my money, the ledger, the staff balances and the transfer list onto it, so an answer the browser cannot read fails the query and the card shows its alert. Wave 5 IN-01 sent "the other `toNumber` copies" to this review. The summary was never moved. `DashboardKpiRow` and `OrdersByStatusCard` each keep a private `toNumber` that is bare `Number(value)`, and `RecentOrdersCard` does `Number(entry.total)`. The generated types allow `number | string`, so a text figure, a blank, or an Android-era contract change reaches `formatPeso` as `NaN`. The status card then draws `NaN%` bars, because `Math.max` of counts with a `NaN` is `NaN`.

**Failure scenario:** A later server change serialises decimals as strings with a thousands separator (`"12,450.00"`), or a proxy returns a partial body. Total receivables reads "₱NaN" next to real cards, with no alert and no Try Again. Staff read a broken number as the shop's position, against the Core Value.

**Fix:** Add `parseDashboardSummary` in `dashboardService.ts` beside `parseDashboardChart`. Narrow every money figure, count and percent with `toFiniteFigure`, throw `DashboardChartContractError` (or a renamed `DashboardContractError`) on `null`, and call it in `useDashboardSummaryQuery`'s `queryFn`. Then the three cards read plain numbers and the three local `toNumber` copies go. Test: a summary with `receivables: "abc"` shows the KPI alert, not ₱NaN.

### WR-03: The wave 8 past-the-end and Rows per page fixes reach only the two money lists

**Files:** `web/src/modules/admin/pages/OrdersPage.tsx:127-139`, `:381`; `ExpensesPage.tsx:264-270`, `:587`; `DeletedOrdersPage.tsx:189-195`, `:300`; `DeletedExpensesPage.tsx:170-176`, `:339`; `AuditLogPage.tsx:182-188`, `:397`; `UsersPage.tsx:221-227`, `:478`; compare `web/src/modules/admin/components/LedgerCard.tsx:52-55`, `:111`, `:133-143` and `TransfersCard.tsx:43-46`

**Problem:** Wave 8 WR-01 (a page past the last shows an empty state next to "Showing 45 ...") and WR-02 (after a size that fits every row, Rows per page vanishes and the smaller sizes cannot be chosen again) were fixed for the ledger. The outcomes say "Orders, Expenses and the other clamped lists go to the phase-end code review". The same `pastTheEnd` rule and `sizeOnlyWhenSinglePage` were copied into `TransfersCard`, but the six other paged lists still use the old pattern: a row-less page with a non-zero total renders its empty state, its result bar and its pager until the clamp lands, and the pager drops Rows per page once one page holds every row.

**Failure scenario:** Carmen opens a shared Orders link at `?page=4`. Someone deleted orders, so only 3 pages remain. For one round trip the list says "No orders match these filters" beside "Showing 52 orders". On Expenses she picks 50 rows per page with 38 expenses; Rows per page disappears and she cannot go back to 10 without editing the address.

**Fix:** Move the shared logic into one hook and use it in all eight lists, which also settles deferred item 7:

```ts
// lib/url-state/usePagedList.ts
export function usePagedList(query, total: number, size: number, clampPage: (count: number) => void) {
  const rows = query.data?.rows ?? query.data?.items;
  const pastTheEnd = rows?.length === 0 && total > 0;
  const loading = (query.isFetching && (query.data === undefined || query.isError)) || pastTheEnd;
  const failed = query.isError && !query.isFetching;
  const pageCount = Math.ceil(total / size);
  const fresh = query.isSuccess && !query.isPlaceholderData;
  useEffect(() => { if (fresh) clampPage(pageCount); }, [fresh, pageCount, clampPage]);
  return { pastTheEnd, loading, failed, pageCount };
}
```

Pass `sizeOnlyWhenSinglePage` on every list pager (or make it the default and drop the prop). Reuse the wave 8 tests as a shared table test over the eight lists.

### WR-04: The chart's middle gridline is mislabelled for tops of 3,000 to 9,000, and the item was never ruled or parked

**File:** `web/src/components/data/IncomeExpenseChart.tsx:108-111`, `:164-166`, `:180`

**Problem:** Wave 1 IN-05 found that `tick()` rounds to whole thousands, so `tick(1500)` reads "₱2k". The outcome sent IN-01 to IN-05 to this review (D-106), and the wave said "ask the owner, because it changes approved output". It is not in the parked list. `step` is a power of ten and `top = ceil(max / step) * step`, so any month high between ₱2,001 and ₱9,999 with an odd top (3,000, 5,000, 7,000, 9,000) puts "₱2k", "₱3k", "₱4k" or "₱5k" on the 1,500, 2,500, 3,500 or 4,500 line. A below-zero bottom has the same fault ("−₱2k" for −1,500). A new shop's first months sit exactly in that range.

**Failure scenario:** October income is ₱2,600. The axis reads ₱0, ₱2k, ₱3k. The ₱2k label sits at the 1,500 line, so a bar of ₱1,600 looks like it is below ₱2,000 by a hair instead of at the 1,600 it is.

**Fix:** Needs the owner (it changes App. D.3 output). Park it as a new P10-BL item with option A (recommended): one decimal place for the half tick, `Math.round(value / 100) / 10` with a trailing ".0" trimmed, so 1,500 reads "₱1.5k". Option B: keep App. D.3 as is. Add the tick test once ruled.

### WR-05: The Transfer window's Date default never follows a newer business day, even the one its own fresh read brings

**Files:** `web/src/modules/admin/components/TransferModal.tsx:122-128`, `:236-243`; `web/src/modules/admin/hooks/useBusinessToday.ts:14-17`, `:25-36`

**Problem:** Wave 7 IN-08 framed this as a window left open across Manila midnight. It is wider. Phase 10 added `['dashboard']` and `['staff-money']` to `ANSWER_ROOTS`, and a held answer is trusted for up to 5 minutes. When the window opens, `today` comes from the newest held answer at once, and `useForm` copies it into `defaultValues.transferDate` on that first render only. The window's own `staff-money/me` read (`refetchOnMount: 'always'`) then brings the new day: `today` and the schema's future-date limit move, but the Date field keeps the old day. The server accepts any past day (D-20), so the transfer is saved on the wrong date with no message.

**Failure scenario:** Paolo loads the dashboard at 23:58 on Nov 7. At 00:01 on Nov 8 he presses Transfer on the strip. The summary answer is 3 minutes old, so the form opens dated 2026-11-07. The fresh money read says 2026-11-08 a moment later, but the field still says Nov 7. He records ₱1,000.00 and the ledger shows it on Nov 7. At a month end the same thing moves a transfer into the previous month.

**Fix:** Follow a newer day while the person has not touched the field:

```ts
// TransferForm: also take getFieldState from useForm (it already gives setValue and getValues)
useEffect(() => {
  if (!getFieldState('transferDate').isDirty && getValues('transferDate') !== today) {
    setValue('transferDate', today, { shouldValidate: false });
  }
}, [today, getFieldState, getValues, setValue]);
```

Test: open with a held day of 2026-11-07, then answer `me` with `today: 2026-11-08`; the Date field reads 2026-11-08. A typed date is kept. This closes wave 7 IN-08 too (deferred item 6).

## Info

### IN-01: Four argument guards sent to this review are still missing (wave 1 IN-01, wave 2 IN-05, wave 2 IN-07, wave 3 IN-04)

**Files:** `src/Csps.Infrastructure/Money/StaffLedgerQuery.cs:125`, `:136`; `src/Csps.Infrastructure/Orders/OrderReader.cs:55`; `src/Csps.Application/Dashboard/ChartMonths.cs:17-35`; `src/Csps.Application/Dashboard/GetDashboardSummaryHandler.cs:93-98`

**Problem:** `PageAsync` and `SumNewerAsync` still take `IQueryable` (not `IOrderedQueryable`) and do not guard `page` or `pageSize`. `ListNewestAsync` passes any `count` to `Take`. `ChartMonths.Build` is public and a negative `months` throws from the `List` capacity. `GreetingOf` maps any unknown `DayPart` to "evening" without a sign. Every caller is validated today, so nothing is wrong now; a later caller that skips the validator gets a SQL error (500) or a silent wrong greeting instead of a clear argument error.

**Fix:** `IOrderedQueryable<StaffLedgerRow>` plus `ArgumentOutOfRangeException.ThrowIfLessThan(page, 1)` and `(pageSize, 1)`; `ThrowIfNegativeOrZero(count)` and `ThrowIfNegativeOrZero(months)`; list `DayPart.Evening` explicitly and throw `ArgumentOutOfRangeException` for anything else. One small test each.

### IN-02: Two rules are written twice and can drift (wave 1 IN-03, wave 2 IN-06)

**Files:** `src/Csps.Domain/Orders/OrderStatusRules.cs:48`; `src/Csps.Application/Dashboard/GetDashboardSummaryHandler.cs:65` vs `src/Csps.Application/Expenses/GetCompanyExpenseKpisHandler.cs:27`

**Problem:** `CanBeOverdue` repeats the four statuses instead of reading `OverdueStatuses`. The dashboard shows a top category when `ThisMonthCount > 0`; the expenses page when `ThisMonthTotal > 0m`. Both agree today because amounts are above zero, but the docs promise the two pages agree.

**Fix:** `CanBeOverdue(status) => OverdueStatuses.Contains(status)`. Use `totals.ThisMonthTotal > 0m` in the dashboard handler.

### IN-03: The dashboard API doc and contract still say things the code does not do (wave 2 IN-01 to IN-04, wave 3 IN-01 to IN-03)

**Files:** `docs/api/dashboard.md:17`, `:108`, `:136-151`; `src/Csps.Server/Controllers/DashboardController.cs:21-24`; `src/Csps.Application/Dashboard/ChartMonths.cs:35-44`; `web/src/types/api.generated.ts:2648`, `:5664`

**Problem:** The doc still promises "one consistent picture" while the summary runs separate reads with no shared transaction. It says "a fixed number of SQL commands" with no handler-level count test. The chart example shows `0.00` while a gap month is `0m - 0m` and serialises as `0`. The controller summary lists only the first fields, and that text is published in the OpenAPI contract. The contract still types `months` as a free string and `DashboardChartResponse.months` as `number | string`. An Android client built from it learns none of the 6-or-12 rule.

**Fix:** Reword the doc to "every figure uses the same business date and instant", say "seven commands plus the cached settings read", seed the gap months as `0.00m` (scale 2) or change the example to `0`, list all summary fields in the controller XML summary, and add an `enum: ["6","12"]` operation transformer for `months`. Regenerate the contract.

### IN-04: The note trim still differs between the browser and the server (wave 1 IN-04)

**Files:** `src/Csps.Domain/Money/MoneyTransfer.cs:230`; `src/Csps.Application/Money/CreateMoneyTransferRequestValidator.cs:32-33`; `web/src/modules/admin/moneySchemas.ts:111-115`

**Problem:** .NET `Trim()` removes U+0085 but not U+FEFF; JavaScript `trim()` removes U+FEFF but not U+0085. A note pasted with a leading byte-order mark and 200 other characters passes zod and is refused by the server, so the OR-3 mirror is not exact.

**Fix:** Strip both U+FEFF and U+0085 explicitly on both sides before trimming, with one test each.

### IN-05: True-pixel chart drawing is tied to `showProfit` with no recorded ruling (wave 1 IN-06)

**File:** `web/src/components/data/IncomeExpenseChart.tsx:17`, `:149-163`

**Problem:** UI-SPEC D-51 says the chart draws at the real width on phones. The code measures only when `showProfit` is set. That is the 10-04 parity fix and is fine for the dashboard, but CONTEXT has no ruling, so any later chart without `showProfit` keeps the scaled 640 drawing with small text on phones.

**Fix:** Add a separate `fitWidth` prop (default true where `showProfit` is set today), or record "D-51 applies to the dashboard card" in 10-CONTEXT.md and point the UI-SPEC D3 bullet at it.

### IN-06: The browser works out the D-33 resulting balance, which the server-only money rule does not allow without a ruling

**File:** `web/src/modules/admin/components/DeleteTransferDialog.tsx:6-9`, `:65-67`

**Problem:** CLAUDE.md says money is computed server-side only. The delete dialog subtracts the transfer amount from the receiver's balance in the browser (`round2(held - transfer.amount)`). The code is correct to the centavo, it is labelled as a preview and the server's figures win after the delete. The exception rests on threat note T-10-44 in plan 10-20, not on an owner ruling, so the next reviewer will flag it again.

**Fix:** Either have the server send the figure (for example `GET /money-transfers/{id}/delete-preview` returning the receiver's balance after), or record an owner ruling that a labelled preview built only from server balances is allowed, and cite it in the file header.

### IN-07: Duplicated code between the money handlers and the figure parsers

**Files:** `src/Csps.Application/Money/CreateMoneyTransferHandler.cs:37-68`, `:109-112` and `HandOverMoneyHandler.cs` (the same `HandleAsync` body, `BalanceOf`, `ToActor`); `DeleteMoneyTransferHandler.cs:25`, `HandOverMoneyHandler.cs:33`, `RemoveMoneyTransferHandler.cs` (`TransferTarget`); `web/src/modules/admin/services/moneyService.ts:115`, `:254`, `:363` and `dashboardService.ts:39` (four copies of "toFiniteFigure or throw")

**Problem:** The two create handlers share about 30 lines (session check, clock, validation with the today key, `ConflictRetry`, the busy catch) and two helpers. Four web helpers wrap `toFiniteFigure` the same way with only the error class differing. A rule change (for example a new refusal on busy) has to be made in each copy.

**Fix:** A small `MoneyWrite.RunLockedAsync(...)` helper in the Money application folder for the shared create flow, `StaffMoneySums.BalanceOf(sums, id)` as one static, one `MoneyAuditTargets.Transfer` constant, and one `requireFigure(value, what, makeError)` in `utils/toFiniteFigure.ts`.

### IN-08: No real-database race test for two permanent removes

**Files:** `tests/Csps.Server.IntegrationTests/Money/MoneyTransferDeletionTests.cs:161-183` (delete race), `:312-334` (sequential removes); `src/Csps.Application/Money/RemoveMoneyTransferHandler.cs`

**Problem:** SEC-07 asks for a two-writer race test per aggregate. Delete has one against the database. Remove is only raced in unit tests with mocks. The "one audit entry" promise for a racing remove depends on the savepoint rollback dropping the first audit insert, which only a real database proves.

**Fix:** Copy the delete race test for `DELETE /money-transfers/{id}/permanent`: one 204, the other 404 or 409, and exactly one `money-transfer.permanently-deleted` entry per round.

## Deferred Items

Each item gets one call: fix now, defer to a named later phase or the backlog with a reason, or needs the owner.

### D-1: Wave 1 WR-05, parity pixel snapshots fail locally

**Call: defer to the Phase 10 PR CI run (ship gate), with a reason.** The diffs are glyph-edge antialiasing between this Windows machine and the CI Linux runner, and the baselines are made on CI. This is not a code fault, and chasing it locally would mean Windows baselines that CI then rejects. The condition is firm: `/gsd-ship 10` must not merge until the CI parity job is green on the PR. If CI fails, that is a real regression and gets fixed then.

### D-2: Wave 4 IN-07 thousands separator on Active orders, and IN-09 three "Try Again" buttons

**IN-07 call: fix now.** `KpiCard` shows a count as a raw number (`KpiCard.tsx:67`), while the status card uses `formatCount`. Change the count branch to `formatCount(value)` when `money` is false and `value` is a number, keeping the zero dimming. Below 1,000 the output is unchanged, so the parity snapshots do not move. One unit test with 1250.

**IN-09 call: defer to Phase 14 (manual accessibility pass), with a reason.** Each Try Again sits inside its own named region next to its own error line, so it is not a WCAG failure, and the UI-SPEC shows one per card. A cheap improvement for Phase 14: point each button's `aria-describedby` at its card's error line, so a screen reader says which one it is without any new words.

### D-3: Wave 5 IN-04, a wrongly typed field is reported as every field missing

**Call: defer to Phase 14 (hardening), with a reason.** It is shared by every create action that uses `EmptyBodyBehavior.Allow` with the automatic 400 off, not just transfers and company expenses. The web client never sends a mistyped body (zod builds it), so only a future Android client sees it. Phase 14 should change all create actions together: on a binding failure answer one plain 400 such as "Check the form and try again.", with a matrix-style test over every create route.

### D-4: Wave 5 IN-08, range-switch copy and the undimmed empty placeholder

**Call: needs the owner.** After 12M is chosen the sub reads "Last 12 months" while six bars are still drawn, and an all-zero placeholder is not dimmed. Both change what the screen says and how it looks, which is the owner's call. Park it next to P10-BL-15 with option A (recommended): the sub follows the months on screen (`query.data.months`) and the empty state gets `data-refetching` like the chart body. Option B: keep as built.

### D-5: Wave 7 IN-03 and wave 8 IN-07, list paging defaults and the separate count read

**Call: defer to Phase 14 (hardening), with a reason.** Both are shared by every list controller (orders, expenses, deleted lists, audit log, users, ledger, transfers), so they should change together, not money first. Nothing leaks: a malformed `deleted` gives the normal ledger, and a bad page size gives the default. The count and page drift only shifts a page edge between requests, and the clamp (WR-03) already covers a page past the end. Phase 14 should bind `page`, `pageSize` and flags as text and refuse bad values with the shared list message (CWE-20), and decide per list whether the count needs the D-105 style shared read.

### D-6: Wave 7 IN-07 Transfer reason wording, and IN-08 the business today in the Transfer window

**IN-07 call: needs the owner.** A keyboard user on an aria-disabled Transfer while the figure loads or failed hears no reason. Fixing it needs new copy, and it sits next to P10-BL-04 (what a failed refresh shows). Park it with P10-BL-04 and give two options: A (recommended) point `aria-describedby` at the strip's existing loading or failure line, so no new words are needed; B new reason lines.

**IN-08 call: fix now.** See WR-05: the Date field should follow a newer business day while it is untouched. The fix is small and needs no new words.

### D-7: Wave 10 IN-06, TransfersCard and LedgerCard share about 40 lines

**Call: fix now, as part of WR-03.** The duplicated block (past the end, loading, failed, page count, clamp) is the same block that six other lists need. One shared hook fixes the duplication and the six lists at once. Doing only the two money cards would leave the bigger copy in place.

### D-8: Wave 11 IN-03 the fixed 72 px Hand Over reserve, and IN-07 the showcase windows

**IN-03 call: needs the owner (P10-BL-15).** If the owner picks P10-BL-15 option B (buttons on their own row), the reserve goes away. If option A stays, measure the reserve from the rendered buttons in the Phase 14 320 px sweep instead of the fixed 72 px.

**IN-07 call: defer to the backlog, with a reason.** The showcase is in the dev-only route branch (`__DEV_ROUTES__` is a literal false in the production build), so no staff member meets it. The real windows have their own close animation and focus return tests. Note it for the next showcase change.

### D-9: Test gap, a Saturday 2026-11-07T16:00Z case for the chart month end and the week end

**Call: fix now, but with a different case.** The Saturday 16:00Z instant is Sunday 00:00 in Manila. That is the same Monday to Sunday week in UTC and in Manila, and it is not a month edge, so it would not fail for a UTC-date bug in the week or the month. The week start is already pinned at Monday 00:00 (2026-11-01T16:00Z) in `DashboardReaderTests.cs:46` and `GetDashboardSummaryHandlerTests.cs:67`, and the month start at 2026-10-31T16:30Z in `GetDashboardChartHandlerTests.cs:69`. The real gap is the chart's month end: the chart handler has only 2026-11-30T15:59Z, which is the same day in both zones. Add one chart handler case at 2026-11-30T16:00Z (Dec 1 00:00 Manila) expecting the window July to December 2026 and a last month of "2026-12". Drop the Saturday case.

### D-10: Wave 3, narrowing of the chart's `number | string` figures and the `months` query

**Call: done for the chart, open for the summary.** `parseDashboardChart` (`dashboardService.ts:49-62`) narrows every chart figure with `toFiniteFigure`, refuses a `months` that differs from the request, and `chart()` accepts only 6 or 12 (`:80-83`). The summary was never narrowed: see WR-02 (fix now). The contract's free-string `months` is in IN-03.

### D-11: Wave 6, order and expense writes invalidate `['staff-money']`

**Call: done.** `useRefreshOrders.ts:18-27` and `useRefreshExpenses.ts:14-25` both invalidate `staffMoneyKey`, `moneyTransfersKey` and `dashboardKey`, and every order write reaches it through `useApplyOrder`. Deletes, purges and restores use the same hooks. Only the "may have run" failure path is missing (WR-01).

### D-12: `scripts/third-party-notices.test.ts` on the main checkout

**Call: done, no change.** Run alone on the main checkout on 2026-11-09 after the preflight check: 11 of 11 passed in 11.7 s. The slow case spawns the script three times and took 11.0 s against its own 120 s limit, so the earlier timeout was machine load, not a fault. Record it as a flake under load if it times out again in a full run.

## Outcomes

| Finding | Outcome |
|---|---|
| WR-01 | TBD |
| WR-02 | TBD |
| WR-03 | TBD |
| WR-04 | TBD |
| WR-05 | TBD |
| IN-01 | TBD |
| IN-02 | TBD |
| IN-03 | TBD |
| IN-04 | TBD |
| IN-05 | TBD |
| IN-06 | TBD |
| IN-07 | TBD |
| IN-08 | TBD |
| D-1 (wave 1 WR-05) | TBD |
| D-2 (wave 4 IN-07, IN-09) | TBD |
| D-3 (wave 5 IN-04) | TBD |
| D-4 (wave 5 IN-08) | TBD |
| D-5 (wave 7 IN-03, wave 8 IN-07) | TBD |
| D-6 (wave 7 IN-07, IN-08) | TBD |
| D-7 (wave 10 IN-06) | TBD |
| D-8 (wave 11 IN-03, IN-07) | TBD |
| D-9 (Saturday 16:00Z test gap) | TBD |
| D-10 (wave 3 narrowing) | TBD |
| D-11 (wave 6 staff-money invalidation) | TBD |
| D-12 (third-party-notices test) | TBD |

---

_Reviewed: 2026-11-09T00:33:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
