---
phase: 06-company-expenses
part: B (Infrastructure and Server)
created: 2026-10-25T23:25:05-05:00
updated: 2026-10-25T23:25:05-05:00
reviewed: 2026-10-26T04:25:05Z
depth: deep
files_reviewed: 31
files_reviewed_list:
  - src/Csps.Infrastructure/Auditing/AuditLogReader.cs
  - src/Csps.Infrastructure/Common/LikePattern.cs
  - src/Csps.Infrastructure/DependencyInjection.cs
  - src/Csps.Infrastructure/Expenses/CompanyExpenseReader.cs
  - src/Csps.Infrastructure/Expenses/CompanyExpenseStore.cs
  - src/Csps.Infrastructure/Expenses/ExpenseCategoryStore.cs
  - src/Csps.Infrastructure/Expenses/ExpensesRegistration.cs
  - src/Csps.Infrastructure/Expenses/TestingExpenseSeeder.cs
  - src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs
  - src/Csps.Infrastructure/Identity/AccountTokenStore.cs
  - src/Csps.Infrastructure/Identity/ManagerRosterLock.cs
  - src/Csps.Infrastructure/Identity/StaffDirectory.cs
  - src/Csps.Infrastructure/Identity/UserDirectory.cs
  - src/Csps.Infrastructure/Persistence/Configurations/CompanyExpenseConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/ExpenseCategoryConfiguration.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
  - src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
  - src/Csps.Infrastructure/Persistence/Locking/DatabaseLock.cs
  - src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261025114714_AddExpenseCategories.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261025121237_AddCompanyExpenses.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261026024441_AddDatabaseLocks.cs
  - src/Csps.Infrastructure/Seeding/CompanyExpensesSeedStep.cs
  - src/Csps.Infrastructure/Seeding/DevSeedSteps.cs
  - src/Csps.Server/Composition/ApplicationRegistration.cs
  - src/Csps.Server/Composition/ExpensesApplicationRegistration.cs
  - src/Csps.Server/Controllers/CompanyExpensesController.cs
  - src/Csps.Server/Controllers/ExpenseCategoriesController.cs
  - src/Csps.Server/Controllers/StaffController.cs
  - src/Csps.Server/Controllers/TestingExpensesController.cs
findings:
  critical: 0
  warning: 1
  info: 6
  total: 7
status: issues_found
---

# Phase 6: Code Review Report, Part B (Infrastructure and Server)

*Created: 2026-10-25T23:25:05-05:00 · Updated: 2026-10-25T23:25:05-05:00*

**Reviewed:** 2026-10-26T04:25:05Z
**Depth:** deep
**Files Reviewed:** 31
**Status:** issues_found

## Summary

I reviewed the Infrastructure and Server files of phase 6 at deep depth. The main focus was the EF-only lock rebuild from plan 06-21. To check it, I traced these files too: `IdempotencyMiddleware`, `CspsUnitOfWork` and its deadlock test, `UserAccounts.CountActiveManagersAsync`, `AuditTrail`, and every Application caller of `LockAccountAsync` and `LockActiveManagersAsync`.

**The lock guarantees hold.** I tried to find a window where two requests both go ahead, and found none:

- **Roster lock (`active-managers`).** `ExecuteUpdateAsync` runs as a primary-key seek inside the caller's transaction, so its exclusive row lock lasts until commit.
  - The count read (`CountActiveManagersAsync`) runs on the same scoped context, after the lock is held.
  - A rollback to a savepoint frees a lock taken after that savepoint. This is safe because `CspsUnitOfWork` takes the lock again on each retry before it reads.
- **Account stripe lock.** Every caller runs inside `InTransactionAsync`. I checked all nine handlers plus `UpdateUserHandler`.
  - No transaction takes two stripes.
  - The only handler that takes both locks takes the roster lock first. No handler takes them in the other order.
  - Two people who share a stripe only wait for each other. No handler touches another person's rows after it takes a stripe, so sharing a stripe adds no deadlock cycle.
- **Duplicate request guard (idempotency claim).**
  - The claim is inserted and committed on its own connection, so a second insert fails at once with error 2627 and the duplicate gets `Busy`.
  - The claim is deleted inside the same commit that stores the answer, so no duplicate sees the key free before the answer is stored.
  - After a rollback, the claim is freed only after the rollback ends.
  - Only one request can take over a stale claim. The update is filtered on `ExpiresAtUtc <= now` and reads the row again under the lock.
  - The release is filtered on `HolderId`.
  - The unique index `UX_IdempotencyRecords_Key_Route_UserId` treats NULL user ids as equal, so it still guards anonymous requests.

**Other checks were clean:**

- No inline SQL anywhere under `src` (grep for `ExecuteSql`, `FromSql`, `SqlQuery`, `SqlCommand`, `CommandText`, `sp_getapplock` and table hints, outside migrations, found nothing).
- The three migrations only add tables and create no trigger.
- Every action declares a policy, through the controller-level `Staff` policy plus `Manager` on the Manager-only routes. The testing controller is compiled into Debug builds only and is removed outside Testing.
- Soft-delete filters are used correctly, including the named-filter opt-outs.
- The list, KPI and detail reads keep a fixed number of SQL commands.
- Expense audit details hold only date, category, amount and payer, never description or notes text.

The one Warning: the idempotency gate's error handling catches the wrong exception types. EF's default SQL Server strategy wraps deadlocks and other temporary SQL errors in `InvalidOperationException`, and these catches never see that type. As a result, one deadlock handler can never run, and the "purge never fails the POST" promise is not kept. The Info items are smaller robustness and maintainability points.

No structural findings (fallow) and no external reviewer evidence were provided.

## Narrative Findings (AI reviewer)

## Warnings

### B-WR-01: The idempotency gate's catches miss EF-wrapped temporary SQL errors: one deadlock handler can never run, and a failed purge or release still fails the request

**File:** `src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs:334`, `:356`, `:381` (also `:254-262`)

**Issue:**

- **How EF reports these errors.** The context uses EF's default SQL Server strategy, which does not retry. `CspsDbContextOptions.Configure` has no `EnableRetryOnFailure`. This strategy wraps every error SQL Server calls temporary (deadlock 1205, dropped connections and similar) in an `InvalidOperationException`, with the `SqlException` as its inner exception.
  - The codebase already relies on this. See the comment at `CspsUnitOfWork.cs:44-47` and its test `CspsUnitOfWorkTests.ADeadlockVictimIsALostRaceAndTheOtherSaveGoesThrough`.
  - `DatabaseLocks.IsLockFailure` also walks the inner-exception chain for the same reason.
  - `IdempotencyGate` does not account for this:
- **Dead deadlock handler.** `TakeOverIfStaleAsync` (line 334) uses `catch (SqlException error) when (error.Number == DeadlockVictim)`. `ExecuteUpdateAsync` runs through the strategy, so a deadlock arrives as `InvalidOperationException` and this catch never runs. The deadlock escapes from `BeginAsync` as a 500 instead of the documented "the key reads as in progress".
- **Purge failure fails the POST.** `PurgeExpiredAsync` (line 381) catches only `DbException`. The comment at line 363 promises "A failure is logged and ignored: the POST must not fail because old rows could not be removed". A deadlock or connection error in either purge statement is an `InvalidOperationException`, not a `DbException`, so every covered POST that hits one fails with a 500.
  - The purge runs at the start of every keyed POST and deletes rows that other requests may be inserting or deleting at the same moment. This is exactly where a deadlock can happen.
- **Release failure escapes.** `ReleaseClaimAsync` (line 356) also catches only `DbException`.
  - When this happens in `IdempotencyLease.EndUnfinishedAsync`, the exception leaves `DisposeAsync`. It replaces the handler's original exception and skips `_transaction.DisposeAsync()` (lines 140-146).
  - When this happens in the `BeginAsync` catch (line 261), it hides the original error.
  - The promise "a claim that cannot be freed ends with its lease" is kept for the data, but the request now fails with the wrong error.

**Fix:** Use one helper that walks the inner-exception chain, as `DatabaseLocks` and `CspsUnitOfWork` already do, and filter on it:
```csharp
private static bool HasSqlError(Exception error, params int[] numbers)
{
    for (var current = error; current is not null; current = current.InnerException)
    {
        if (current is SqlException sql && (numbers.Length == 0 || numbers.Contains(sql.Number)))
        {
            return true;
        }
    }
    return false;
}

// TakeOverIfStaleAsync
catch (Exception error) when (HasSqlError(error, DeadlockVictim)) { return false; }

// PurgeExpiredAsync and ReleaseClaimAsync
catch (Exception exception) when (exception is DbException || HasSqlError(exception)) { Log...(logger, exception); }
```
Add one test for each path. For example, start a purge while another connection holds an expired claim row, and assert that the POST still gets 201.

## Info

### B-IN-01: A stale claim freed between the read and the takeover turns away a request whose key is actually free

**File:** `src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs:304-332`

**Issue:** `TakeOverIfStaleAsync` first reads the expired claim, then runs the takeover update. Any other POST's `PurgeExpiredAsync` may delete that same expired row in between. The update then changes 0 rows and the method returns `false`, so the caller gets `Busy` (409 in-progress) even though nothing holds the key. Only `null` (gone) makes `TryClaimAsync` insert again.

**Fix:** When `changed == 0`, read the row once more and return `null` if it is gone, so the insert loop runs again.

### B-IN-02: A cancelled claim insert can leave the key "in progress" for the whole lease

**File:** `src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs:272-279`, `:242`

**Issue:** `TryClaimAsync` passes `RequestAborted` to `SaveChangesAsync`. If the client goes away after SQL Server commits the insert but before the client sees the reply, an `OperationCanceledException` leaves `BeginAsync` without a release. The claim then blocks the same key for `ClaimLease` (2 minutes). The old transaction-owned lock was freed when the connection reset. The window is small and the lease bounds it.

**Fix:** Pass `CancellationToken.None` to the claim insert and the takeover update, as the release already does. Or catch `OperationCanceledException` around the claim and call `ReleaseClaimAsync(name, holderId)` before rethrowing.

### B-IN-03: A wait under half a second becomes a wait with no limit

**File:** `src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs:67`

**Issue:** `SetCommandTimeout(TimeSpan)` rounds to whole seconds, and 0 means "wait forever". A future caller passing `TimeSpan.FromMilliseconds(300)` would get a lock wait with no limit. Production passes only `DefaultWait` (10 s) today.

**Fix:** Add `ArgumentOutOfRangeException.ThrowIfLessThan(wait, TimeSpan.FromSeconds(1));` at the top of `TakeAsync`.

### B-IN-04: The general unit of work depends on a feature store

**File:** `src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs:3`, `:35`

**Issue:** `CspsUnitOfWork` (Persistence) calls `ExpenseCategoryStore.TranslateSaveFailure` (Expenses) on every `DbUpdateException` in the app. Phase 7 will add order constraints, and this pattern would make the unit of work grow one feature translator at a time.

**Fix:** Add an internal `ISaveFailureTranslator` with one implementation per feature, inject them all as `IEnumerable<ISaveFailureTranslator>`, and use the first non-null result.

### B-IN-05: A deadlock while saving a form edit shows "someone else changed this"

**File:** `src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs:44-50`

**Issue:** A deadlock victim becomes `ConcurrencyConflictException`. Form edits are never retried, so for them (for example `UpdateCompanyExpense`) the user gets the 409 `edit.stale` banner even though nobody else changed the row. The data is safe because the loser saved nothing. Only the message is misleading.

**Fix:** None needed for safety. If wanted, use a separate `LostRaceException` that form handlers map to a plain "Please try again" message.

### B-IN-06: The 2-minute lease note says "only one of them saves", but routes that keep changes can save twice

**File:** `src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs:191-195` (also the STATE.md Owner backlog item text)

**Issue:**

- The class summary and the owner backlog option (2) both say that a taken-over claim "can never store a second answer", and that "the database still lets only one of them save". This is true for stored answers.
- It is not true for `IdempotencyOutcome.KeepChanges` routes (`ProfileController.cs:91, 120, 148`). There, `CommitWithoutRecordAsync` commits the business change with no record, so no unique index guards it.
- So if a kept-change request runs longer than the lease, a takeover runs the same change twice. The impact is small today: these routes are profile actions.
- The owner should know this before choosing a shorter lease.

**Fix:** Change the backlog wording to: "for routes that keep changes without storing an answer (profile actions), both may apply". Or leave the claim in place in `CommitWithoutRecordAsync` until the lease ends, if the owner wants the stronger guarantee.

---

_Reviewed: 2026-10-26T04:25:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
