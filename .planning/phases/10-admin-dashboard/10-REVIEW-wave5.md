---
phase: 10-admin-dashboard
created: 2026-11-07T10:06:00-06:00
updated: 2026-11-07T10:07:00-06:00
reviewed: 2026-11-07T10:06:00-06:00
scope: "wave 5: plan 10-10 and plan 10-11 (git diff 06efa0dc..ba1f2cd8), .planning/ excluded"
depth: standard
advisory: true
files_reviewed: 42
files_reviewed_list:
  - docs/api/staff-money.md
  - src/Csps.Application/Money/CreateMoneyTransferHandler.cs
  - src/Csps.Application/Money/CreateMoneyTransferRequest.cs
  - src/Csps.Application/Money/CreateMoneyTransferRequestValidator.cs
  - src/Csps.Application/Money/MoneyErrors.cs
  - src/Csps.Application/Money/MoneyParties.cs
  - src/Csps.Application/Money/MoneyTransferResponse.cs
  - src/Csps.Application/Ports/IMoneyTransfers.cs
  - src/Csps.Application/Ports/IStaffMoneyLock.cs
  - src/Csps.Application/Ports/StaffMoneyBusyException.cs
  - src/Csps.Infrastructure/Money/MoneyRegistration.cs
  - src/Csps.Infrastructure/Money/MoneyTransferStore.cs
  - src/Csps.Infrastructure/Money/StaffMoneyLock.cs
  - src/Csps.Server/Composition/MoneyApplicationRegistration.cs
  - src/Csps.Server/Controllers/MoneyTransfersController.cs
  - tests/Csps.Application.UnitTests/Money/CreateMoneyTransferHandlerTests.cs
  - tests/Csps.Application.UnitTests/Money/CreateMoneyTransferRequestValidatorTests.cs
  - tests/Csps.Application.UnitTests/Money/MoneyPartiesTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Money/MoneyFixtures.cs
  - tests/Csps.Server.IntegrationTests/Money/MoneyTransferAttributionTests.cs
  - tests/Csps.Server.IntegrationTests/Money/MoneyTransferConcurrencyTests.cs
  - tests/Csps.Server.IntegrationTests/Money/MoneyTransferEndpointTests.cs
  - tools/openapi-gen/openapi.v1.json
  - web/src/modules/admin/components/IncomeExpenseCard.test.tsx
  - web/src/modules/admin/components/IncomeExpenseCard.tsx
  - web/src/modules/admin/components/dashboard.recipe.node.test.ts
  - web/src/modules/admin/components/dashboard.recipe.ts
  - web/src/modules/admin/dashboardCopy.ts
  - web/src/modules/admin/hooks/useDashboardChartQuery.ts
  - web/src/modules/admin/hooks/useDashboardRange.test.tsx
  - web/src/modules/admin/hooks/useDashboardRange.ts
  - web/src/modules/admin/hooks/useRefreshExpenses.test.tsx
  - web/src/modules/admin/hooks/useRefreshExpenses.ts
  - web/src/modules/admin/hooks/useRefreshOrders.test.tsx
  - web/src/modules/admin/hooks/useRefreshOrders.ts
  - web/src/modules/admin/pages/DashboardPage.test.tsx
  - web/src/modules/admin/pages/DashboardPage.tsx
  - web/src/modules/admin/services/dashboardService.test.ts
  - web/src/modules/admin/services/dashboardService.ts
  - web/src/test/dashboardFixtures.ts
  - web/src/types/api.generated.ts
findings:
  critical: 0
  warning: 2
  info: 8
  total: 10
status: issues_found
---

# Phase 10 wave 5: Code Review Report

*Created: 2026-11-07T10:06:00-06:00 · Updated: 2026-11-07T10:06:00-06:00*

**Reviewed:** 2026-11-07T10:06:00-06:00
**Depth:** standard, with call chains followed into MoneyTransfer.Record, MoneyRules, StaffDirectory, DatabaseLocks, ConflictRetry, CspsUnitOfWork (savepoints), the idempotency gate and middleware, the session check, the user deactivate, delete and lock handlers, IncomeExpenseChart, SegmentedControl, LoadingRegion, useDelayedFlag, formatMonthShort, useSubmission and the query client defaults
**Files Reviewed:** 42
**Status:** issues_found (advisory review: nothing was edited, committed or run; no test suite was run)

## Summary

Plan 10-10 (staff money transfer) is sound where it matters most. I found no blocker in the money math or the lock.

- **Lock and balance check.** Inside `AttemptAsync` the `staff-money` lock is the first statement (handler line 73). Both people and both balances are read after it (lines 76-85), the domain decides, the row is inserted and the sender's balance is read again, all in one transaction. The lock is an `ExecuteUpdate` on the standing row. It is taken inside a savepoint of the idempotency gate's outer transaction, so SQL Server holds it until the gate commits the stored answer. A second transfer waits and then reads committed data. There is no time-of-check to time-of-use gap.
- **Deadlock risk.** Only transfers take this lock, and the gate writes its claim rows outside the request transaction. An expense, payment or refund save never waits on the lock, and nothing that holds the lock waits on a lock they hold first. I found no lock cycle.
- **Status mapping.** Field and balance refusals are 400. A lock timeout becomes `StaffMoneyBusyException`, then 409 "Something changed at the same time. Try again." A lost save race retries once, then 409. A replay with another body is 422 from the gate. No internal detail reaches the body.
- **Rules.** Self-transfer, a sender at or below 0.00, more than held, the D-49 leaver cap (Manager sees the figure, Admin does not), the D-56 recipient rule, the legacy holder and role-less accounts are all decided under the lock. `CanPay` is not used. Users have no soft-delete query filter and roles are replaced, not stripped, so a deleted leaver is still found with a role. Amounts stay `decimal`; the balance check bounds the amount, so it always fits `decimal(18,2)`.
- **Security.** `[Authorize(Policy = Policies.Staff)]` (Admin or Manager), matrix row 401/400/400, `no-store`. The request record has no sender member. The sender is `requestContext.UserId`. Stamps come from the interceptor. The attribution test forges ten members, and none sticks. No inline SQL.
- **Dates.** The validator and the domain both use `clock.Today` from `IBusinessCalendar`. No `DateTime.Now` or UTC date in the diff.

Plan 10-11 (chart card) meets its must-haves. Every figure is the server's. Month names come from the `yyyy-MM` key through `formatMonthShort`, which formats in UTC, so there is no device zone shift. D-50 and D-104 words are passed. The range lives in the URL through `literalParser`, with fallback and one replace. The extra `['dashboard']` invalidation causes no refetch storm: dashboard queries are only mounted on `/admin`, and no order or expense write runs there, so the invalidation only marks inactive queries stale. No em or en dash, no `style` attribute and no direct `fetch` in the changed web files.

The two warnings: the transfer handler does not check the sender's own account state under the lock, and the chart card goes silent for screen reader users after Try Again.

## Warnings

### WR-01: The sender's own account state is never checked under the lock

**File:** `src/Csps.Application/Money/CreateMoneyTransferHandler.cs:76-91`
**Issue:** The handler re-reads the sender's `StaffState` under the lock, but it refuses only `null`. Accounts are soft-deleted, so `null` almost never happens. A sender who is deactivated, deleted, Manager-locked or no longer Admin or Manager goes on to `MoneyTransfer.Record`, and `Record` never looks at `sender.Status`. The only guard is the session check at the start of the request. The deactivate, delete and lock handlers evict the session cache only after their own commit (`DeactivateUserHandler.cs:46-57`, `DeleteUserHandler.cs:52-61`, `LockUserHandler.cs:47-58`). A request that is already past authentication, or that lands between the commit and the eviction, still runs. D-17 says money held by a leaver is moved only by a Manager hand-over. This path lets a leaver move it themselves.
**Failure scenario:** A Manager deactivates Liza while she is pressing Transfer on her phone. Her request passed the session check a moment earlier. It takes the lock, reads Liza as deactivated, and records a 600.00 transfer from her to a friend. The leaver's money left without a Manager hand-over and with no audit entry. The test fixtures show the gap plainly: `MoneyFixtures.DeactivateAccountAsync` flips `IsActive` without revoking sessions, and a transfer posted with the old token afterwards would succeed. No test covers it.
**Fix:** Refuse any sender who is not current, signed-in staff, next to the existing null check:
```csharp
if (senderState is not { IsActive: true, IsDeleted: false, IsManagerLocked: false, Role: Roles.Admin or Roles.Manager }
    || senderState.Id == LegacyHolder.Id)
{
    return Result.Failure<MoneyTransferSavedResponse>(AuthErrors.SessionEnded);
}
```
Write the failing tests first: one handler unit test per state (deactivated, deleted, locked, role-less), and one endpoint test that deactivates the sender with the fixture, posts with the old token, and expects 401 and no stored row. Whether the answer is 401 "session ended" or a 400 under a field is the owner's wording call.

### WR-02: After Try Again, the chart card neither shows it is working nor says the chart loaded

**File:** `web/src/modules/admin/components/IncomeExpenseCard.tsx:62-90`
**Issue:** On an error the card swaps the whole `LoadingRegion` for `ErrorState`. With TanStack Query 5, `isError` stays true while a retry runs, so the banner stays up, with no busy state, until the new answer arrives. The query client sets `retry: false`, but the HTTP client retries on its own, so this can take several seconds. When the retry succeeds, a new `LoadingRegion` mounts with `loading={false}`. Its phase starts at `idle`, so it says nothing. The alert just disappears. The project's loading contract (UI-SPEC "Loading announcement", `components/states/copy.ts`) is "Loading {things}…" then "{Things} loaded." This is the same gap wave 4 WR-02 found for Orders by status, now in a new card. No test checks any announcement after Try Again.
**Failure scenario:** A screen reader user on a weak connection hears "Couldn't load the chart." They press Try Again. Nothing is announced while it retries, and nothing is announced when the chart comes back. They cannot tell whether the press did anything, and may press it again and again.
**Fix:** Keep one `LoadingRegion` mounted around the body in every state, and drive it with the query's fetch state:
```tsx
<LoadingRegion loading={data === null ? query.isFetching || query.isPending : marked} failed={query.isError} things={COPY.things}>
  {query.isError ? errorBody : data === null ? skeleton : empty-or-chart}
</LoadingRegion>
```
If the banner should stay visible during the retry, at least disable Try Again or set `aria-busy` on it while `query.isFetching`. Add a test: fail once, press Try Again, and expect the status to read "Loading the chart…" and then "The chart loaded.". Apply the same fix to the KPI row and Orders by status together with wave 4 WR-02, so the cards behave alike.

## Info

### IN-01: The chart's `number | string` narrowing is bare `Number()`, copied ten times, and the server's `months` is never read

**File:** `web/src/modules/admin/components/IncomeExpenseCard.tsx:34-37`, `:59`, `:98`
**Issue:** `toNumber` is `Number(value)` with no check that the result is finite. Text such as `"1,234.00"` or `"abc"` becomes `NaN`, and the chart would draw `NaN` path coordinates, which the browser reports as a console error. The same helper now exists in ten files (`DashboardKpiRow`, `ExpenseKpiRow`, `OrdersByStatusCard`, `ExpensesPage`, `OrdersPage` and others). The response's `months` (also `number | string`) is never read: the sub line and the empty message use the URL range. That is the documented choice, but it means a server answer for the wrong window cannot be noticed. `dashboardService.chart(months: number)` also accepts any number, though only 6 and 12 are valid.
**Failure scenario:** Today the server always sends JSON numbers, so nothing breaks. A later contract change (for example money sent as text with grouping) would silently draw a broken chart instead of the error state.
**Fix:** Move one `toNumber` into `utils/` that throws (or returns null) for a non-finite result, and use it in all ten places. Type the service as `chart(months: 6 | 12, ...)`.

### IN-02: The transfer-against-expense race test cannot fail

**File:** `tests/Csps.Server.IntegrationTests/Money/MoneyTransferConcurrencyTests.cs:51-90`
**Issue:** The test accepts both serial outcomes, which is right under D-53. But the SUMMARY shows it passed with the lock removed and with the lock moved after the reads. So it does not test the lock at all. It only shows that an expense is never refused. D-53 asks for a race test that "proves the transfer still never overdraws". The proof is really a design argument: an expense never checks a balance, so any interleaving matches one serial order. The two-transfer and leaver races are the real lock tests.
**Failure scenario:** A reader takes this test as evidence that the lock covers expenses. It does not, and it never could.
**Fix:** Keep the test, but rename it and its comment to say what it proves ("an expense is never refused and the end balance is one of the two serial outcomes"). State the D-53 argument in `docs/api/staff-money.md` in place of "a race test proves a transfer still never overdraws".

### IN-03: The lock timeout is mapped by message text, a missing lock row reads as "busy" forever, and the cause is never logged

**File:** `src/Csps.Infrastructure/Money/StaffMoneyLock.cs:29-31` (with `src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs:84-87`)
**Issue:** `DatabaseLocks.TakeAsync` throws the caller's message both for a timeout and for "the lock row is missing" (`changed != 1`). The adapter turns any `InvalidOperationException` with that text into `StaffMoneyBusyException`, drops the inner SQL error, and the handler answers 409 without a log line. No infrastructure test holds the row in another transaction and checks that the adapter throws `StaffMoneyBusyException`. The handler test only uses a substitute. This copies the order-number pattern.
**Failure scenario:** The production script for `AddMoneyTransfers` is applied without its `InsertData` for the `staff-money` row. Every transfer answers "Something changed at the same time. Try again." The logs show nothing. Staff retry and give up.
**Fix:** Let a missing row throw its own error (a loud 500), pass the inner exception into `StaffMoneyBusyException`, log a warning on the 409 path, and add one integration test that holds the row and expects the busy exception within the wait.

### IN-04: One wrongly typed field is reported as three missing fields

**File:** `src/Csps.Server/Controllers/MoneyTransfersController.cs:39-42`
**Issue:** With `EmptyBodyBehavior.Allow` and the automatic 400 turned off, a JSON body that fails to bind (for example `"toUserId": "abc"` or a malformed date type) becomes `null`, then `CreateMoneyTransferRequest.Empty`. The answer lists "Choose who got the cash.", "Enter the amount." and "Enter the transfer date." although the client sent all three. The company-expense create has the same behavior.
**Failure scenario:** A future Android client sends the amount as `"1,000.00"`. The user sees every field marked as empty and cannot tell which one is wrong.
**Fix:** Low priority, and shared with the other creates. If it is fixed, do it once for all create actions: on a binding failure, answer one plain-English 400 such as "Check the form and try again." rather than the empty-body list.

### IN-05: A transfer create writes no audit entry, while a company expense create does

**File:** `src/Csps.Application/Money/CreateMoneyTransferHandler.cs:97-99` (compare `src/Csps.Application/Expenses/CreateCompanyExpenseHandler.cs:76-80`)
**Issue:** The plan relies on the `CreatedBy` and `CreatedAt` stamps for "who recorded it", and the audit catalog has only delete, permanent delete and hand-over events for transfers. That matches MONEY-06 and D-17. Company expense creates, however, write `company-expense.added`. A transfer moves money between people, so the owner may expect the same trail. Without WR-01's fix, a leaver's transfer would also leave no audit entry.
**Fix:** Owner's call. Options: (1) keep it as is and record a ruling that stamps are enough for a normal transfer; (2) add a `money-transfer.added` event with from, to, amount, date and `note=yes|no` (the D-52 style).

### IN-06: The nameless line for the legacy holder and role-less accounts is the executor's reading and still needs a ruling

**File:** `src/Csps.Application/Money/CreateMoneyTransferHandler.cs:86-89`, `src/Csps.Application/Money/MoneyErrors.cs:15-16`
**Issue:** The plan names the D-58 line only for an unknown id. The executor also uses it for the legacy holder and for an account with no staff role, so that "Legacy / unassigned" never shows. That is the safer reading, and the SUMMARY lists it as open question D8. It is not yet a dated ruling in 10-CONTEXT.
**Fix:** Ask the owner and record the answer as a D-number next to D-58, so the hand-over plan (10-12) uses the same rule.

### IN-07: TDD evidence is thin for the lock and most of the refusals

**File:** `.planning/phases/10-admin-dashboard/10-10-SUMMARY.md` (TDD Gate Compliance)
**Issue:** Task 3 has no RED commit: the race tests passed when first written, and the evidence is two mutations run and reverted by hand. Task 2's RED was made by leaving the legacy-holder mapping and three validator rules out of the tracer on purpose. Most Task 2 tests (balance and recipient refusals, owed caps, past date, empty body, replay, 422, forged stamps) passed at RED as characterization tests. Wave 4 IN-04 noted the same pattern. The mutation runs are good evidence, but they are not in git.
**Fix:** Nothing to change in the code. For the hand-over plan, write the race test before the lock call exists in that handler, so the RED commit shows `[Created, Created]`.

### IN-08: During a range switch the copy says the new range while the old months are drawn, and an empty placeholder is not dimmed

**File:** `web/src/modules/admin/components/IncomeExpenseCard.tsx:82-85`, `:98`
**Issue:** After 12M is chosen, the sub reads "Last 12 months" at once while six bars stay on screen until the twelve arrive. This is the executor's documented choice, not a spec rule. If the six old months were all zero, the empty state shows "Payments and expenses from the last 12 months show here." before the 12 months are known, and it is not dimmed: `data-refetching` is only on the chart body. Only `aria-busy` on the region signals the wait.
**Fix:** Owner's look call at the screenshot review (plan 10-21). If wanted, take the sub's month count from the shown data (`query.data.months`, narrowed) and put `data-refetching` on the empty state too.

---

_Reviewed: 2026-11-07T10:06:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Outcomes (owner away; recorded 2026-11-07)

| Finding | Outcome |
|---|---|
| WR-01 | Fix now (follows D-17): under the lock, refuse a sender who is deactivated, deleted, Manager-locked or has no role, with a race test that fails without the check. |
| WR-02 | Fix now: keep the chart card's loading region mounted so Try Again shows it is working and says "The chart loaded.", with a test. |
| IN-01 | Fix now in the chart path: a finite-number check on the narrowed figures and `months`, and read the server's `months`. Moving the ten copies into one helper is deferred to the phase-end code review. |
| IN-02 | Fix now (test-only): make the transfer-against-expense race test able to fail, and show it failing with the lock removed. |
| IN-03 | Fix now: map the lock timeout by exception type, log the cause, and add an infrastructure test for a real timeout. |
| IN-04 | Deferred to the phase-end code review: the company-expense create has the same behavior, so both are changed together. |
| IN-05 | Parked for the owner: P10-BL-08 (whether a normal transfer writes an audit entry). |
| IN-06 | Parked for the owner: already P10-BL-07. |
| IN-07 | Accepted as recorded: the 10-10 SUMMARY gives the mutation evidence; the IN-02 and WR-01 fixes add failing-first tests. |
| IN-08 | Deferred to the plan 10-21 screenshot review: the range-switch copy and the undimmed empty placeholder. |
