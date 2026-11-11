---
phase: 10-admin-dashboard
plan: 01
subsystem: database
tags: [ef-core, sql-server, linq, union-all, ledger, money, tdd]
created: "2026-11-06T21:15:00-06:00"
updated: "2026-11-06T21:15:00-06:00"

requires:
  - phase: 09-order-images-and-maintenance
    provides: orders, payments, refunds, order expenses, company expenses and the named SoftDelete filters
provides:
  - "LedgerEntryKind: the six ledger row kinds with fixed int values"
  - "StaffLedgerQuery: For, Ordered, PageAsync, SumNewerAsync and CountAsync over one UNION ALL of payments, refunds, company expenses and order expenses"
  - "Proof that EF Core 10 translates the Concat ledger and the Take-before-Sum newer-rows sum on SQL Server (A1 and A2)"
affects: [10-14 staff ledger page, 10-08 money transfers]

actuals:
  tokens: 6957
  tasks: 2
  commits: 4
plan_head_before: b8d2494f23b4de7a6734ecea1ae8c6ef88438d1c
plan_head_after: ced22fd90fb710f70a8809afb3d520ef07376126

tech-stack:
  added: []
  patterns:
    - "Union of narrow same-typed projections filled by member initializers (not constructors), each stamping its kind as an int constant"
    - "Running-balance support: sum of the rows newer than a page read in one aggregate statement"

key-files:
  created:
    - src/Csps.Domain/Money/LedgerEntryKind.cs
    - src/Csps.Infrastructure/Money/StaffLedgerRow.cs
    - src/Csps.Infrastructure/Money/StaffLedgerQuery.cs
    - tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs
  modified: []

key-decisions:
  - "A1: translated. One Concat of four same-typed projections runs as one UNION ALL statement; the per-source fallback is not needed."
  - "A2: translated. ordered.Take(n).SumAsync(...) runs as one SELECT COALESCE(SUM(...)) over a TOP(n) subquery; the in-memory fallback is not needed."
  - "StaffLedgerRow uses init properties filled by member initializers, because EF Core refuses a set operation over constructor projections."
  - "The ledger tie-break on source id follows SQL Server uniqueidentifier order, not .NET Guid order; tests compare with SqlGuid."

requirements-completed: [MONEY-02]

coverage:
  - id: D1
    description: "One LINQ Concat of narrow projections over payments, refunds, company expenses and order expenses pages one person's rows newest first in one UNION ALL statement, with the signs from the UI-SPEC and no row of another person"
    requirement: MONEY-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#APersonsPaymentsAndCompanyExpenseComeBackNewestFirstAndAnotherPersonsAreAbsent"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#APageReadRunsOneStatementThatIsAUnionAll"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#RefundsAndOrderExpensesJoinTheUnionWithNegativeSigns"
        status: pass
    human_judgment: false
  - id: D2
    description: "Payments, refunds and order expenses on a deleted order and a deleted company expense never reach a ledger, and no query filter is lifted"
    requirement: MONEY-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#ADeletedOrderTakesItsPaymentRefundAndExpenseOutOfTheLedger"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#ADeletedExpenseIsNotInTheLedger"
        status: pass
    human_judgment: false
  - id: D3
    description: "Pages follow the order with no gap or repeat, the same-day tie order is stable, a page costs the same number of commands at sizes 10 and 100, and the newer-rows sum comes back from the database in one statement"
    requirement: MONEY-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#PagesFollowTheOrderWithNoGapAndNoRepeat"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#RowsOnTheSameDayOrderByRecordedTimeThenKindThenIdAndPagesStayWhole"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#APageOfAnySizeRunsTheSameNumberOfCommands"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs#SumNewerRunsOneStatementThatSumsInTheDatabase"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-11-06
status: complete
---

# Phase 10 Plan 01: The staff ledger union query runs on SQL Server Summary

**One EF Core UNION ALL of four narrow money projections (payments, refunds, company expenses, order expenses) pages a person's ledger newest first on SQL Server, with the newer-rows sum read as one aggregate statement.**

*Created: 2026-11-06T21:15:00-06:00 · Updated: 2026-11-06T21:15:00-06:00*

## Performance

- **Duration:** about 30 min
- **Completed:** 2026-11-06
- **Tasks:** 2 (Task 1 tracer, Task 2 auto), both TDD
- **Files created:** 4 (no file modified)

## Accomplishments

- **A1: translated.** `payments.Concat(refunds).Concat(companyExpenses).Concat(orderExpenses)` runs as one `UNION ALL` statement on LocalDB. The per-source fallback was not needed.
- **A2: translated.** `ordered.Take(skip).SumAsync(row => row.Signed)` runs as one `SELECT COALESCE(SUM(...)) FROM (SELECT TOP(@p) ... ORDER BY ...)`. The in-memory fallback was not needed. Test evidence: `SumNewerRunsOneStatementThatSumsInTheDatabase` asserts one command containing `SUM(`.
- The union is ordered newest first: date, recorded time (both descending), kind, then source id. Pages 1, 2 and 3 of 25 rows join with no gap and no repeat.
- A page costs one SQL command at page size 10 and at 100.
- Money on a deleted order (payment, refund, order expense) and a deleted company expense stays out of the ledger. No query filter is lifted anywhere.
- The query is final in shape. Plan 10-14 adds a transfers projection (kinds 3 and 4) and row details on top of it. The `Deleted` column is a constant `false` for now.

### SQL EF ran for page 2 of 10 (one statement)

```sql
SELECT [u1].[Kind], [u1].[SourceId], [u1].[Date], [u1].[RecordedAtUtc], [u1].[Signed], [u1].[Deleted]
FROM (
    SELECT 1 AS [Kind], [o].[Id] AS [SourceId], [o].[PaymentDate] AS [Date], [o].[CreatedAtUtc] AS [RecordedAtUtc], [o].[Amount] AS [Signed], CAST(0 AS bit) AS [Deleted]
    FROM [OrderPayments] AS [o]
    INNER JOIN (SELECT [o0].[Id], [o0].[DeletedAtUtc] FROM [Orders] AS [o0] WHERE [o0].[DeletedAtUtc] IS NULL) AS [o1] ON [o].[OrderId] = [o1].[Id]
    WHERE [o1].[DeletedAtUtc] IS NULL AND [o].[ReceivedByUserId] = @userId
    UNION ALL
    SELECT 2 AS [Kind], [o2].[Id], [o2].[RefundDate], [o2].[CreatedAtUtc], -[o2].[Amount], CAST(0 AS bit)
    FROM [OrderRefunds] AS [o2]
    INNER JOIN (... Orders not deleted ...) AS [o4] ON [o2].[OrderId] = [o4].[Id]
    WHERE [o4].[DeletedAtUtc] IS NULL AND [o2].[RefundedByUserId] = @userId
    UNION ALL
    SELECT 5 AS [Kind], [c].[Id], [c].[ExpenseDate], [c].[CreatedAtUtc], -[c].[Amount], CAST(0 AS bit)
    FROM [CompanyExpenses] AS [c]
    WHERE [c].[DeletedAtUtc] IS NULL AND [c].[PaidByUserId] = @userId
    UNION ALL
    SELECT 6 AS [Kind], [o5].[Id], [o5].[ExpenseDate], [o5].[CreatedAtUtc], -[o5].[Amount], CAST(0 AS bit)
    FROM [OrderExpenses] AS [o5]
    INNER JOIN (... Orders not deleted ...) AS [o7] ON [o5].[OrderId] = [o7].[Id]
    WHERE [o7].[DeletedAtUtc] IS NULL AND [o5].[PaidByUserId] = @userId
) AS [u1]
ORDER BY [u1].[Date] DESC, [u1].[RecordedAtUtc] DESC, [u1].[Kind], [u1].[SourceId]
OFFSET @p ROWS FETCH NEXT @p ROWS ONLY
```

(The `...` lines are shortened here; the logged statement repeats the same Orders subselect as the payments branch.) The newer-rows sum wraps the same union in `SELECT COALESCE(SUM([u2].[Signed]), 0.0) FROM (SELECT TOP(@p) [u1].[Signed] FROM (<union>) AS [u1] ORDER BY ...) AS [u2]`.

## Task Commits

1. **Task 1: payments and company expenses as one newest-first union (tracer)**
   - RED `b78dbe10` (test): two tests; stubs return no rows
   - GREEN `58741fda` (feat): two-source union, ordering, page read
2. **Task 2: refunds, order expenses, deletes, paging and the newer-rows sum**
   - RED `a73b8674` (test): nine more tests; SumNewer and Count stubs return 0
   - GREEN `ced22fd9` (feat): refund and order expense sources, `SumNewerAsync`, `CountAsync`, one added test for the one-statement sum

**Plan metadata:** the SUMMARY commit follows this file.

## Files Created/Modified

- `src/Csps.Domain/Money/LedgerEntryKind.cs`: the six kinds, `PaymentReceived = 1` to `OrderExpensePaid = 6`
- `src/Csps.Infrastructure/Money/StaffLedgerRow.cs`: the narrow row (Kind, SourceId, Date, RecordedAtUtc, Signed, Deleted)
- `src/Csps.Infrastructure/Money/StaffLedgerQuery.cs`: the union, order, page read, newer-rows sum and count
- `tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs`: 12 tests against a real `CSPS_Test_<guid>` database

## Decisions Made

- `StaffLedgerRow` is a record with `init` properties and the projections use member initializers. The plan listed a positional record, but EF Core 10 fails a Concat of constructor projections with "Unable to translate set operation after client projection has been applied". Plan 10-14 must add its transfers projection the same way.
- The final tie-break on source id follows SQL Server `uniqueidentifier` order, which is not .NET `Guid` order. It is stable and gives gap-free pages, which is what MONEY-02 needs. Tests compute the expected order with `SqlGuid`.
- Refunds are only allowed on a cancelled order (or one with customer credit), so the test seeder cancels the order before adding refunds.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Constructor projection cannot be unioned**
- **Found during:** Task 1 GREEN
- **Issue:** The positional record `StaffLedgerRow(...)` made `Concat` throw `InvalidOperationException: Unable to translate set operation after client projection has been applied`.
- **Fix:** `StaffLedgerRow` became an `init`-property record and each source projection uses a member initializer. The artifact still holds the six planned columns.
- **Files modified:** `src/Csps.Infrastructure/Money/StaffLedgerRow.cs`, `src/Csps.Infrastructure/Money/StaffLedgerQuery.cs`
- **Verification:** the union runs as one `UNION ALL` statement; all 12 tests pass.
- **Committed in:** `58741fda`

**2. [Rule 3 - Blocking] RED commits carry compile stubs**
- **Found during:** Task 1 RED and Task 2 RED
- **Issue:** The tests call `StaffLedgerQuery`, `StaffLedgerRow` and `LedgerEntryKind`, which did not exist, so a test-only commit would fail to compile (an invalid RED).
- **Fix:** The RED commits include minimal stubs that return no rows, a zero sum or a zero count, so the tests build and fail on their planned assertions.
- **Committed in:** `b78dbe10`, `a73b8674`

**3. [Rule 2 - Missing critical] One extra test**
- **Found during:** Task 2 GREEN
- **Issue:** The plan needs the A2 outcome recorded "with the evidence line from the test run", but no test pinned that the sum is one database statement.
- **Fix:** Added `SumNewerRunsOneStatementThatSumsInTheDatabase` (one command, contains `SUM(`). It passed on its first run because it was added after the GREEN code.
- **Committed in:** `ced22fd9`

---

**Total deviations:** 3 auto-fixed (1 bug, 1 blocking, 1 missing critical)
**Impact on plan:** None on the plan's goal. The union shape, order and method signatures are as planned; only the row type's declaration style changed.

## TDD Gate Compliance

RED then GREEN for both tasks (commits above).

- **Task 1 RED:** 2 of 2 target tests failed on their assertions (`rows.Count` expected 3 but was 0; `Kind` list expected `[1, 5, 1]` but was `[]`). Seeding ran and committed rows first, so the failure is about the planned behavior. Semantic assessment: valid.
- **Task 2 RED:** 5 of 11 tests failed on planned assertions (kinds `[6, 2, 1]` expected but `[1]`; `SumNewer` expected -258.75 but 0; row count 25 expected but 15; page 1 ids missing the refunds and order expenses). Semantic assessment: valid.
- Three Task 2 tests (`ADeletedOrder...`, `ADeletedExpense...`, `APersonWithNoRows...`) passed at RED because the Task 1 sources already respect the filters and nothing else could be wrong yet. They are guards. To prove they bite, I temporarily added `IgnoreQueryFilters(["SoftDelete"])` to the refund and company expense sources: `ADeletedOrderTakesItsPaymentRefundAndExpenseOutOfTheLedger` and `ADeletedExpenseIsNotInTheLedger` both failed (2 failed, 10 passed). I then restored the file (the committed code has no `IgnoreQueryFilters`).
- `gsd_run check tdd-red-evidence` was not run: the xUnit v3 Microsoft Testing Platform console output is not a format that classifier supports (it reads TAP, JUnit, swift-testing and unittest). The evidence above is the real command output with my semantic assessment.

## Verification Results

- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*StaffLedgerQueryTests"`: total 12, succeeded 12, failed 0, skipped 0.
- `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*NoInlineSqlTests" --filter-class "*LayerTests"`: total 33, succeeded 33, failed 0.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- Acceptance greps: `Concat` count 1; `PaymentReceived = 1` on one line; `IgnoreQueryFilters` outside comments 0; `FromSql|SqlQuery|ExecuteSql` 0; `RefundHandedBack` 1; `OrderExpensePaid` 1.
- Test names contain `DeletedOrder`, `DeletedExpense`, `Page` and `SumNewer`.
- gitleaks on each staged change: no leaks found. No package added or bumped, no schema change, no trigger, no SQL view.
- Flakes: none seen. Every run of the final code passed.

## Issues Encountered

None beyond the deviations above. A temporary SQL dump test was used to capture the statements and then deleted; it was never committed.

## Known Stubs

None. The `Deleted = false` constant in each projection is deliberate until transfers join (plan 10-14).

## Threat Flags

None. T-10-01 (information disclosure) is mitigated and pinned: no filter is lifted, and the `DeletedOrder` and `DeletedExpense` tests fail if one is.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 10-14 can consume `StaffLedgerQuery.For`, `Ordered`, `PageAsync`, `SumNewerAsync` and `CountAsync` as they are. It adds a transfers projection (kinds 3 and 4, `Deleted` from the transfer) using member initializers, once the MoneyTransfers table exists (plan 10-08).
- No blockers.

## Self-Check: PASSED

- Files exist: `src/Csps.Domain/Money/LedgerEntryKind.cs`, `src/Csps.Infrastructure/Money/StaffLedgerRow.cs`, `src/Csps.Infrastructure/Money/StaffLedgerQuery.cs`, `tests/Csps.Infrastructure.IntegrationTests/Money/StaffLedgerQueryTests.cs`.
- Commits `b78dbe10`, `58741fda`, `a73b8674`, `ced22fd9` are on the branch.

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-06*
