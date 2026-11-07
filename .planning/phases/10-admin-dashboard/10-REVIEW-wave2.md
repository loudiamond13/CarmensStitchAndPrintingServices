---
phase: 10-admin-dashboard
scope: wave 2 (plan 10-05, dashboard summary endpoint)
created: 2026-11-07T00:40:00-06:00
updated: 2026-11-07T05:05:00-06:00
reviewed: 2026-11-07T00:40:00-06:00
depth: standard (with cross-file checks against Order.Import, BusinessClock, CompanyExpenseReader and plans 10-06, 10-07)
diff_range: 8586933e..8886c2ad (excluding .planning/)
files_reviewed: 23
files_reviewed_list:
  - docs/api/dashboard.md
  - src/Csps.Application/Dashboard/DashboardPeriod.cs
  - src/Csps.Application/Dashboard/DashboardSummaryResponse.cs
  - src/Csps.Application/Dashboard/GetDashboardSummaryHandler.cs
  - src/Csps.Application/Orders/ListOrdersHandler.cs
  - src/Csps.Application/Orders/OrderListEntries.cs
  - src/Csps.Application/Ports/IDashboardReader.cs
  - src/Csps.Application/Ports/IOrderReader.cs
  - src/Csps.Infrastructure/Dashboard/DashboardReader.cs
  - src/Csps.Infrastructure/Dashboard/DashboardRegistration.cs
  - src/Csps.Infrastructure/DependencyInjection.cs
  - src/Csps.Infrastructure/Orders/OrderReader.cs
  - src/Csps.Server/Composition/ApplicationRegistration.cs
  - src/Csps.Server/Composition/DashboardApplicationRegistration.cs
  - src/Csps.Server/Controllers/DashboardController.cs
  - tests/Csps.Application.UnitTests/Dashboard/GetDashboardSummaryHandlerTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Dashboard/DashboardSummaryEndpointTests.cs
  - tests/Csps.Testing/OrderSeeding.cs
  - tools/openapi-gen/openapi.v1.json
  - web/src/types/api.generated.ts
findings:
  critical: 0
  warning: 2
  info: 8
  total: 10
status: issues_found
---

# Phase 10 wave 2: code review

*Created: 2026-11-07T00:40:00-06:00 · Updated: 2026-11-07T00:40:00-06:00*

**Reviewed:** 2026-11-07T00:40:00-06:00
**Depth:** standard, with cross-file checks
**Files reviewed:** 23
**Status:** issues_found (advisory)

## Summary

This review covers plan 10-05: `GET /api/v1/dashboard/summary`, its handler, period, reader and port, `OrderReader.ListNewestAsync`, the shared
`OrderListEntries.From` mapping, the controller, the registrations, the tests, the contract files and `docs/api/dashboard.md`. No tests
were run, because two executors are using the machine.

The core is sound. I traced every figure against D-01 to D-08, D-11, D-12, D-13, D-38, D-54 and D-55 and found no wrong formula:

- **Money:** every money value is `decimal` and is summed in SQL.
- **Dates:** date columns (`DueDate`, `PaymentDate`, `RefundDate`) are compared with `DateOnly` values from one `BusinessClock` read.
  `StatusChangedAtUtc` is compared with the month's UTC range. Nothing reads `DateTime.Now`.
- **Soft deletes:** the named SoftDelete filters cover orders, payments, refunds and the list row subqueries.
- **D-05 comparison window:** it runs from the 1st of last month to `SameDayLastMonth`, and the March 31 clamp is tested.
- **Authorization:** default-deny holds. The controller carries `Policies.Staff` at class level and the matrix row is 401/200/200.
  The first name comes from the token's user id.
- **Caching:** `Cache-Control: no-store` is set and tested. Nothing is cached on the server.
- **Code rules:** there is no inline SQL, and the controller action calls one handler.
- **Query count:** the reader runs exactly four commands and the newest-orders read runs one, and both are pinned. There is no N+1.

The two warnings are a must-have edge that no test pins at the instant level, and a forward data risk for the legacy import that this
endpoint creates. The info items are documentation that claims too much, and notes for plans 10-06, 10-07 and Phase 16.

## Warnings

### WR-01: No test pins the week boundary at the Manila instant (Monday 00:00, Sunday 23:59)

**File:** `tests/Csps.Infrastructure.IntegrationTests/Dashboard/DashboardReaderTests.cs:16-19`,
`tests/Csps.Application.UnitTests/Dashboard/GetDashboardSummaryHandlerTests.cs:44-79`

**What is wrong:** the plan lists this must-have: "[EDGE DASH-02 boundary] at a business Monday 00:00 the week starts that day; at
Sunday 23:59 it still holds the Sunday's orders". Every reader and handler test runs at Wednesday 10:00 or March 31 10:00. The domain
test `WeekRunsMondayToSunday` checks `WeekOf` with dates only. No test builds `DashboardPeriod.From` at Sunday 16:00 UTC (Monday 00:00
Manila) or at Sunday 15:59 UTC (Sunday 23:59 Manila). The doc (`docs/api/dashboard.md:58`) and the SUMMARY both state this behavior
as if it were tested.

**Failure scenario:** a later change builds the week from `clock.UtcNow` instead of `clock.Today`, for example in a 10-06 refactor that
shares period code with the chart. For eight hours every Monday, `dueThisWeek` then uses last week's Monday to Sunday. All current
tests still pass, because they run at 10:00 local, when the UTC date and the Manila date are the same.

**Fix:** add a theory to `GetDashboardSummaryHandlerTests` that checks the period at the two instants:

```csharp
[Theory]
[InlineData("2026-11-01T16:00:00Z", "2026-11-02", "2026-11-02", "2026-11-08")] // Mon 00:00 Manila
[InlineData("2026-11-08T15:59:00Z", "2026-11-08", "2026-11-02", "2026-11-08")] // Sun 23:59 Manila
public async Task TheWeekFollowsTheManilaDateAtItsEdges(string utc, string today, string monday, string sunday) { ... }
```

Also add one reader case at Sunday 23:59 Manila: an order due that Sunday counts in `dueThisWeek`.

### WR-02: Imported orders will break "Completed this month" and "Recent orders" in the cut-over month

**File:** `src/Csps.Infrastructure/Dashboard/DashboardReader.cs:55-57`, `src/Csps.Infrastructure/Orders/OrderReader.cs:59-62`
(depends on `src/Csps.Domain/Orders/Order.cs:351-353` and `RecordStampInterceptor.cs:54`)

**What is wrong:** both new figures depend on timestamps that the import path does not carry from legacy data:

- `completed` counts orders whose `StatusChangedAtUtc` falls in this month. `Order.Import` sets `StatusChangedAtUtc = now` when the
  snapshot has no status history (line 352).
- `recentOrders` sorts by `CreatedAtUtc`. The record stamp interceptor sets that column at save time, and `Order.Import` cannot set it.
  The test helper `OrderSeeding.AddAsync` has to overwrite it with `ExecuteUpdate` (lines 106-110), which shows the gap.

**Failure scenario:** Phase 17 imports 3,000 legacy orders on the 12th of a month, and the legacy data has no status history. On the
dashboard, "Completed" then shows every legacy Completed order as completed this month, for example 2,400. "Recent orders" shows the
last six rows the import happened to write, not the six newest real orders. Staff see wrong numbers on their first day (Core Value:
migrated data must stay correct).

**Fix:** no code change in this plan. Record it now so Phase 15 and 16 plan for it:

- Add a backlog item, or a line in the Phase 15 mapping questions, saying the import must carry the legacy creation time into
  `CreatedAtUtc`.
- The import must also give every imported order at least one `ImportedStatusChange` with the real (or best-known) change time.
- Phase 16 reconciliation should check that the dashboard's `completed` count and `recentOrders` match the legacy data on a rehearsal
  database.

## Info

### IN-01: The doc promises "one consistent picture", but the reads are separate commands

**File:** `docs/api/dashboard.md:17-18`, `src/Csps.Application/Dashboard/GetDashboardSummaryHandler.cs:11-12`

**What is wrong:** the summary runs 7 commands (name, orders, payments, refunds, two expense reads, newest orders) with no shared
transaction. One clock read does make the dates consistent. The data is not: if a payment is saved between the orders read and the
payments read, `receivables` still shows the old balance while `collected.thisMonth` already includes the payment. The next visit is
right, so the harm is small.

**Fix:** reword the doc to "every figure uses the same business date and instant". A snapshot transaction needs a database setting
change, which is the owner's call. Do not add it silently.

### IN-02: The controller's OpenAPI summary lists only the first fields

**File:** `src/Csps.Server/Controllers/DashboardController.cs:20-24`

**What is wrong:** the XML summary says "the business today, the part of the day..., the signed-in person's first name and the order
figures". It was written in Task 1 and never updated. It is published in `openapi.v1.json` and in the comment of
`api.generated.ts:417-419`, so Android and web readers see an incomplete description.

**Fix:** list collected, expenses, statuses and recent orders, then regenerate the contract. 10-06 rewrites these files anyway.

### IN-03: The doc's command count leaves out the settings read, and no test pins the endpoint total

**File:** `docs/api/dashboard.md:106-108`

**What is wrong:** the doc says the server makes "a fixed number of SQL commands". The reader (4) and the newest-orders read (1) are
pinned, but no test pins the handler's total. The business calendar may also read SiteSettings on a cache miss.

**Fix:** say "seven commands, plus the cached site settings read", or add a handler-level command count test.

### IN-04: "Highest id first" for ties uses SQL Server's GUID order

**File:** `docs/api/dashboard.md:97`, `src/Csps.Infrastructure/Orders/OrderReader.cs:60-61`

**What is wrong:** SQL Server sorts `uniqueidentifier` by its last byte group first. For version 7 ids those bytes are random, so
"highest id first" is not the .NET or string order a client would assume. The test admits this ("The database orders ids its own
way"). The tie order is stable, but no client can reproduce it.

**Fix:** reword it to "ties are ordered by id, the same way every time". Do not promise an order a client could rebuild.

### IN-05: `ListNewestAsync` does not guard its count

**File:** `src/Csps.Infrastructure/Orders/OrderReader.cs:55`, `src/Csps.Application/Ports/IOrderReader.cs:48`

**What is wrong:** the port doc says "from 1", but a negative count reaches `Take` and fails as a SQL error, not as a clear argument
error. Today the only caller passes the constant 6.

**Fix:** add `ArgumentOutOfRangeException.ThrowIfNegativeOrZero(count);` at the top of the method.

### IN-06: The top-category gate differs from the expenses KPI handler

**File:** `src/Csps.Application/Dashboard/GetDashboardSummaryHandler.cs:65` vs
`src/Csps.Application/Expenses/GetCompanyExpenseKpisHandler.cs:27`

**What is wrong:** the dashboard shows a top category when `ThisMonthCount > 0`. The expenses page shows one when
`ThisMonthTotal > 0m`. The two give the same answer today, because amounts are above zero. The doc says the two pages agree, and
two separate rules for one figure can drift apart.

**Fix:** use the same condition, `totals.ThisMonthTotal > 0m`, in both handlers.

### IN-07: For plan 10-07, `greeting` and `status` are plain strings, and the `today` weekday needs care

**File:** `web/src/types/api.generated.ts` (`DashboardSummaryResponse.greeting`, `DashboardStatusCount.status`),
`GetDashboardSummaryHandler.cs:93-98`

**What is wrong:** the contract types `greeting` and `status` as `string`, so the page must narrow them to its copy keys itself. The
server maps any unknown `DayPart` value to "evening" without warning (`_ => "evening"`).

The 10-07 subline needs the weekday of `today` ("Wednesday"). `new Date("2026-11-04")` parses as UTC midnight, so it shows Tuesday on
any device west of UTC.

**Fix:**

- In 10-07, narrow both strings with a zod enum in the service and treat an unknown value as an error.
- Build the weekday from the year, month and day parts, or with the existing date formatter in UTC.
- On the server, list `DayPart.Evening` explicitly and throw on an unknown value.

### IN-08: For plan 10-07, a "View all" link to the Orders list will show a different order

**File:** `src/Csps.Infrastructure/Orders/OrderReader.cs:147` vs `:59-62`

**What is wrong:** D-38 says "newest created, matching 'Newest first'". The Orders list's "Newest first" sorts by `OrderDate`, then
`CreatedAtUtc`, then id ascending, and it hides old Completed and Cancelled orders. The dashboard sorts by `CreatedAtUtc`, then id
descending. A back-dated order created today is first on the dashboard but lower in the list. RESEARCH knows about this difference.

**Fix:** if 10-07 adds a "View all" link, either word it so it does not promise the same order, or ask the owner whether the list's
"Newest first" should sort by creation time. The second option changes behavior, so it is the owner's call.

---

_Reviewed: 2026-11-07T00:40:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard with cross-file checks_

## Outcomes (owner away; recorded 2026-11-07)

| Finding | Outcome |
|---|---|
| WR-01 | Fixed (`ecf977d6`): handler and reader tests at Monday 00:00 Manila (Sunday 16:00Z) and Sunday 23:59 Manila (15:59Z). The Monday case fails when the period uses the UTC date (checked, then reverted). |
| WR-02 | Parked for the owner: P10-BL-01 in phase 999.6 (legacy import dates). Nothing to change in Phase 10. |
| Info: date parsing and plain-string types | Sent to the plan 10-07 executor while it runs; its SUMMARY records the result. |
| Info: "View all" sort | Parked for the owner: P10-BL-02. |
| Other info items | Deferred to the phase-end code review. |
