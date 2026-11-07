---
phase: 10-admin-dashboard
scope: wave 1 (plans 10-01, 10-02, 10-03, 10-04)
created: 2026-11-06T23:02:57-06:00
updated: 2026-11-06T23:12:00-06:00
reviewed: 2026-11-06T23:02:57-06:00
depth: standard (with cross-file checks against plans 10-11 and 10-14)
diff_range: b8d2494f23b4de7a6734ecea1ae8c6ef88438d1c..f080de66e114dcd193debf57e055f31cdfc1e81c
files_reviewed: 21
files_reviewed_list:
  - src/Csps.Domain/Auditing/AuditActions.cs
  - src/Csps.Domain/Money/LedgerEntryKind.cs
  - src/Csps.Domain/Money/MoneyOnHand.cs
  - src/Csps.Domain/Money/MoneyParty.cs
  - src/Csps.Domain/Money/MoneyPartyStatus.cs
  - src/Csps.Domain/Money/MoneyRules.cs
  - src/Csps.Domain/Money/MoneyTransfer.cs
  - src/Csps.Domain/Orders/OrderStatusRules.cs
  - src/Csps.Domain/Time/BusinessClock.cs
  - src/Csps.Domain/Time/DayPart.cs
  - src/Csps.Infrastructure/Money/StaffLedgerQuery.cs
  - src/Csps.Infrastructure/Money/StaffLedgerRow.cs
  - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
  - tests/Csps.Domain.UnitTests/Money/MoneyOnHandTests.cs
  - tests/Csps.Domain.UnitTests/Money/MoneyTransferTests.cs
  - tests/Csps.Domain.UnitTests/Orders/OrderStatusRulesTests.cs
  - tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs
  - web/src/components/data/IncomeExpenseChart.test.tsx
  - web/src/components/data/IncomeExpenseChart.tsx
  - web/src/components/data/data.recipe.ts
findings:
  critical: 0
  warning: 5
  info: 6
  total: 11
status: issues_found
---

# Phase 10 wave 1: code review

*Created: 2026-11-06T23:02:57-06:00 · Updated: 2026-11-06T23:02:57-06:00*

**Reviewed:** 2026-11-06T23:02:57-06:00
**Depth:** standard, plus cross-file checks against the plans that consume this wave (10-11, 10-14)
**Files reviewed:** 21
**Status:** issues_found (advisory; nothing was edited or committed)

## Summary

I read every source and test file in the wave 1 diff, the four plans and summaries, and the project rules.

The money and time rules are sound. Money math is `decimal` throughout. `MoneyOnHand.Of` is exact. `MoneyTransfer` has no edit path. Every refusal uses the UI-SPEC wording under the right field. The Admin D-49 message carries no figure. `BusinessClock` reads no device clock. `WeekOf`, `SameDayLastMonth` and `DayPart` are correct at every edge I traced: year end, leap year, month ends, 12:00:00 and 18:00:00. `OverdueStatuses` matches the web `OPEN_STATUSES` set in `dueFlag.ts`. The ledger union keeps every named SoftDelete filter. It has no inline SQL and a full, stable tie-break, so pages have no gap or repeat.

Rule checks on the added lines: no `FromSql`, `SqlQuery` or `ExecuteSql`. No `DateTime.Now`, `Today` or `UtcNow`. No em or en dash in `web/src`. No new `style` attribute: the only style object is the existing `--tip-x` one. No package added.

No critical issues. The warnings are in the chart: tick labels can collide, the `labels` prop cannot hold the D-50 wording, and the line bridges missing months. There is also one risk for plan 10-14 (ledger reads with no shared snapshot) and one open verification gate (the parity pixel run).

## Warnings

### WR-01: Tick labels pile on top of each other when the loss is much bigger than the top

**File:** `web/src/components/data/IncomeExpenseChart.tsx:146-162`
**What is wrong:** `step` comes only from the largest positive figure (`max`). The bottom is the lowest figure rounded to that step. When the loss is much larger than the top, the 0, half-top and top ticks are squeezed into a few pixels near the top of the plot. Each tick label is 11px tall.
**Failure scenario:** On a 6-month dashboard, one month has refunds of ₱15,000 more than its payments (income −15,000). The largest positive figure is ₱2,000 of expenses. Then top = 2,000, step = 1,000 and bottom = −15,000. In the 180px plot, the ticks "₱2k", "₱1k" and "₱0" sit at y ≈ 12, 22.6 and 33.2: about 10.6px apart for 11px text, so they touch or overlap. With income −50,000 and top 3,000 they fall within 10px and become unreadable. Also, "₱2k" labels the 1,500 line (see IN-05).
**Fix:** Choose the step from the whole range, for example `const span = top - bottom; const step = 10 ** Math.floor(Math.log10(Math.max(1, span)))`. Round top and bottom to that step. Alternatively, drop the half-top tick when `y(0) - y(top) < 2 * 14`. Add a test with `income: -15000` and `expenses: 2000` that checks the tick y values are at least 14px apart.

### WR-02: One `labels.profit` word cannot carry the owner's D-50 wording, so plan 10-11 will trip

**File:** `web/src/components/data/IncomeExpenseChart.tsx:55-60, 182-192, 288-299`
**What is wrong:** UI-SPEC D3 and D-50 (OQ-3 A) set the legend to "Income (payments minus refunds)" and "Profit (income minus expenses)", and the tooltip row to plain "Profit". The prop has one `profit` word for both places. The tooltip's "Income" and "Expenses" rows are hard-coded and ignore `labels`. The 10-04 SUMMARY flags this as an open question, but nothing records a ruling.
**Failure scenario:** Plan 10-11 passes `labels={{ profit: 'Profit (income minus expenses)', ... }}` to match the legend copy. Every tooltip then reads "Profit (income minus expenses) ₱68,130.00", which breaks the UI-SPEC copy table. If it passes "Profit" instead, the legend breaks the copy table.
**Fix:** Ask the owner. My recommendation is a separate tooltip word: `labels: { income, expenses, profit, profitTip, net }`, with `profitTip` defaulting to `profit`. Record the ruling as a D-number and point plan 10-11 at it. Add a test where the legend and tooltip words differ.

### WR-03: The profit line joins straight across a month that has no profit figure

**File:** `web/src/components/data/IncomeExpenseChart.tsx:167-173`
**What is wrong:** `profitPoints` skips months whose `profit` is undefined. `profitPath` then joins the remaining points with `L`. The component supports a missing profit on purpose (no point, no tooltip row, no name part), but the line still draws through that month as if it had a value.
**Failure scenario:** The server sends Aug +20,000, then Sep with no profit, then Oct −12,000. The chart draws a line from Aug straight to Oct that crosses zero inside Sep's column. A reader sees a Sep value that the server never sent. That goes against "draw only the server's figures" (D-36).
**Fix:** Start a new subpath after each gap: build the path by walking `data` in order and emitting `M` for the first point after a gap and `L` otherwise. Add a three-month test with the middle profit missing that checks the `d` attribute has two `M` commands. If the server will always send profit, make `profit` required when `showProfit` is on and remove the gap branch.

### WR-04: The ledger reads have no shared snapshot, so plan 10-14's running balance can disagree with the balance shown

**File:** `src/Csps.Infrastructure/Money/StaffLedgerQuery.cs:93-123`
**What is wrong:** `PageAsync`, `SumNewerAsync` and `CountAsync` each run as their own statement. Plan 10-14 adds a fourth read, the current balance from `GetSumsAsync`. It then computes `balanceAfterFirst = balance - NewerSum` and promises that "the newest row's balanceAfter equals the current balance". D-53 says payment, refund and expense saves take no lock, so a write can commit between those reads.
**Failure scenario:** Liza opens page 2 of her ledger. Between the balance read and the newer-rows sum, a coworker records a ₱500 payment received by Liza, dated today. The balance read does not include it, but the newer-rows sum does. Every `balanceAfter` on page 2 is then ₱500 too low and does not join with page 1. The Core Value is that staff always see correct balances, and this shows a wrong one until a reload.
**Fix:** In plan 10-14, run the four reads in one transaction that sees one snapshot. One option is `IsolationLevel.Snapshot`, which needs `ALLOW_SNAPSHOT_ISOLATION ON` on the database: a database setting, so the owner must approve it. Another is a short `Serializable` read transaction. Or take the header balance from the same reads (the sum of the whole union) instead of a separate `GetSumsAsync`. Add a test that commits a row between the reads (an interceptor hook) and checks the page still joins.

### WR-05: Plan 10-04's parity gate is still open

**File:** `.planning/phases/10-admin-dashboard/10-04-SUMMARY.md` (coverage D5); affects `web/src/components/data/IncomeExpenseChart.tsx`
**What is wrong:** The plan's `<verify>` fails the task on "any failed look-equality scenario". The second parity run exited 1. The `chart-6-months` and `chart-12-months` pixel snapshots failed, and the baseline run on the base commit never ran. The SUMMARY still says `status: complete`.

I traced the default drawing by hand. `zeroY` equals the old `H - B`, `y()` reduces to the old formula when `bottom` is 0, and the closing zero line uses `chartAxisClasses` like the old axis line. So I expect the DOM without the new props to be unchanged, and the pixel failures look environmental. That is still not evidence.
**Failure scenario:** A real pixel change to the approved chart ships unnoticed because the failure was put down to the environment without a baseline comparison.
**Fix:** Run `npm --prefix web run parity -- --grep @data` on the base commit and on the head, on a quiet machine or in CI, and compare. Record the result against coverage D5. Do not mark DASH-03's parity truth as passed until then.

## Info

### IN-01: The paging helpers accept bad arguments and unordered queries

**File:** `src/Csps.Infrastructure/Money/StaffLedgerQuery.cs:93-113`
**What is wrong:** `PageAsync` does not guard `page < 1` or `pageSize < 1`. SQL Server rejects a negative OFFSET or a FETCH of 0, which surfaces as a 500. `SumNewerAsync` and `PageAsync` take `IQueryable`, not `IOrderedQueryable`, so a caller can pass `For(...)` without `Ordered(...)` and get arbitrary rows from `Take`.
**Scenario:** Plan 10-14 forgets `InclusiveBetween(1, MaxPage)` on the ledger validator, and `?page=0` returns 500 instead of a field error.
**Fix:** Take `IOrderedQueryable<StaffLedgerRow>` in both methods. Add `ArgumentOutOfRangeException.ThrowIfLessThan(page, 1)` and `ThrowIfLessThan(pageSize, 1)`. Reuse `ListUsersRequestValidator.MaxPage` in the 10-14 validator.

### IN-02: `Record` does not check the sender's own status

**File:** `src/Csps.Domain/Money/MoneyTransfer.cs:80-131`
**What is wrong:** The doc says Record checks "every rule again so no caller can skip one", but it accepts a sender who is Deactivated, Deleted or NotStaff. Only `RecordHandover` checks the sender's status.
**Scenario:** A handler bug in plan 10-10 or 10-12 sends a leaver-to-coworker move through `Record` instead of `RecordHandover`. The transfer is stored with `IsHandover = false`, and the Manager-only hand-over audit event is skipped. The per-request session check makes a stale token unlikely, so this is defence in depth only.
**Fix:** Refuse `sender.Status is not MoneyPartyStatus.Active` at the top of `Record` with a server-only message (as was done for `HandoverSenderActive`), and add a test.

### IN-03: The overdue status set is written twice, and there is no overdue rule

**File:** `src/Csps.Domain/Orders/OrderStatusRules.cs:36-49`
**What is wrong:** `CanBeOverdue` repeats the four statuses instead of reading `OverdueStatuses`. No Domain function states "overdue means the due date is before business today and the status can be overdue", so plan 10-05 and later readers will each write the date comparison (`<` against `<=`) themselves.
**Fix:** `CanBeOverdue(status) => OverdueStatuses.Contains(status)`. Add `IsOverdue(OrderStatus status, DateOnly? due, DateOnly today) => CanBeOverdue(status) && due < today`, matching `dueFlag.ts` (`days < 0`), and use it in 10-05.

### IN-04: The server and browser trims differ, which matters for the OR-3 mirror

**File:** `src/Csps.Domain/Money/MoneyTransfer.cs:230`
**What is wrong:** .NET `string.Trim()` removes U+0085 but not U+FEFF. JavaScript `trim()` removes U+FEFF but not U+0085. The note limit (200 after trim) and "blank becomes null" can therefore differ between the zod schema and the domain.
**Scenario:** A note pasted with a leading byte-order mark and 200 other characters passes zod (201 before trim, 200 after) but the server counts 201 and refuses it.
**Fix:** In the web schema for the transfer form (later plan), trim with the same character set as .NET, or have both sides strip U+FEFF and U+0085 explicitly. Add a test on each side.

### IN-05: The half-top tick is rounded to a whole thousand and can mislabel its gridline (existing behaviour)

**File:** `web/src/components/data/IncomeExpenseChart.tsx:99-102`
**What is wrong:** `tick(1500)` reads "₱2k", because `Math.round(1.5)` is 2. Any top of 3,000, 30,000 and so on puts a wrong label on the middle gridline. This was already in App. D.3. It now also shows in the new below-zero layout.
**Fix:** Ask the owner, because it changes approved output. A suggestion: `Math.round(value / 100) / 10` with a trailing ".0" trimmed ("₱1.5k").

### IN-06: True-pixel drawing works only with `showProfit`, but UI-SPEC D-51 says the chart always measures

**File:** `web/src/components/data/IncomeExpenseChart.tsx:133-152`
**What is wrong:** The parity-driven change (10-04 deviation 1) ties measuring and label thinning to `showProfit`. That is a sound fix for parity, but the CONTEXT has no recorded ruling for it, and any future chart without `showProfit` keeps about 6px text on phones.
**Fix:** Record an owner ruling (for example, "D-51 applies to the dashboard card only") in 10-CONTEXT.md and point the UI-SPEC D3 bullet at it. Alternatively, add a separate `fitWidth` prop so the behaviour is not tied to profit.

---

_Reviewed: 2026-11-06T23:02:57-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Outcomes (owner rulings 2026-11-06)

| Finding | Outcome |
|---|---|
| WR-01 | Fix now, test-first (D-106). |
| WR-02 | Fix now: separate legend and tooltip words, tooltip Income and Expenses from `labels` (D-104). |
| WR-03 | Fix now, test-first (D-106). |
| WR-04 | Deferred to plan 10-14: one serializable read transaction (D-105). |
| WR-05 | Deferred: parity pixel snapshots get confirmed by the CI run on the phase PR. |
| IN-01 to IN-05 | Deferred to the phase-end code review (D-106). |
| IN-06 | Recorded: true-pixel drawing only with `showProfit` is the 10-04 parity fix; fold into the phase-end review. |
