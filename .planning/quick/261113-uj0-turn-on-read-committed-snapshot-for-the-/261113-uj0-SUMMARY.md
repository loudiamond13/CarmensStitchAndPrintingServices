---
created: 2026-11-13T23:15:00-06:00
updated: 2026-11-13T23:15:00-06:00
phase: quick-261113-uj0
plan: 01
subsystem: database
tags: [sql-server, read-committed-snapshot, migration, deadlock, d-p11-bl-35]
requires: []
provides:
  - "READ_COMMITTED_SNAPSHOT on for every database built by the EF migrations (tests, CI container, production after the owner applies the script)"
affects: [uploads, production-script, deploy-runbook]
tech-stack:
  added: []
  patterns: ["non-transactional ALTER DATABASE CURRENT in a migration with suppressTransaction: true, guarded by the current value"]
key-files:
  created:
    - src/Csps.Infrastructure/Persistence/Migrations/20261114042819_TurnOnReadCommittedSnapshot.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261114042819_TurnOnReadCommittedSnapshot.Designer.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/ReadCommittedSnapshotMigrationTests.cs
  modified:
    - tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Content/SiteSettingsReaderTests.cs
    - docs/operations/deploy.md
    - .planning/HOSTING-RECORD.md
    - .planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md
decisions:
  - "Down turns the setting off and does not refuse (no data is lost), unlike the column migrations under D-39"
  - "The idempotent script writes this migration with no BEGIN TRANSACTION or COMMIT at all, so the transaction-count test now counts every migration except this one"
metrics:
  tasks: 3
  commits: 3
status: complete
actuals:
  tokens: 40000
  tasks: 3
  commits: 3
plan_head_before: 5f15ba624a2477577477696224bf4c7841a3569d
plan_head_after: a673aab71477b701da4a1337c73c4f2ead5920f6
---

# Quick 261113-uj0: Turn on read committed snapshot for the CSPS database Summary

One migration turns READ_COMMITTED_SNAPSHOT on for the database it runs on, so reads stop waiting for other requests' unfinished saves and two photo uploads at the same moment no longer answer 500 (D-P11-BL-35).

## Commits

| Task | Commit | What |
|------|--------|------|
| 1 | b0c8a4e4 | `fix(11)`: migration, four new Infrastructure tests, the two-orders upload test, the transaction-count test update |
| 2 | 88f01be1 | `test(11)`: SiteSettingsReaderTests stalls its read with a schema lock instead of a row lock |
| 3 | a673aab7 | `docs(11)`: deploy.md step, HOSTING-RECORD fact and consequence, DECISIONS P11-BL-35 built, P11-BL-64 parked |

Real migration files: `src/Csps.Infrastructure/Persistence/Migrations/20261114042819_TurnOnReadCommittedSnapshot.cs` and `.Designer.cs` (the plan's 20261114000001 was a placeholder). The model snapshot is unchanged.

## RED (before the migration)

Command: `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*ReadCommittedSnapshotMigrationTests"`

```
total: 4  failed: 4  succeeded: 0   (exit 2)
AMigratedDatabaseHasReadCommittedSnapshotOn: await IsOnAsync(database.DatabaseName) should be True but was False
TwoTransactionsThatEachChangedOneRowReadTheOtherRowWithoutADeadlock: the second transaction's read ended with: SqlException (0x80131904): Transaction (Process ID 84) was deadlocked on lock resources with another process and has been chosen as the deadlock victim. ... Error Number:1205,State:51,Class:13
TheProductionScript... / UndoingTheMigration...: index should be greater than 0 but was -1 (migration not found)
```

HTTP probe before the migration (`UploadsToTwoDifferentOrdersSentTogetherBothSaveEveryTime`, 3 runs): 3 of 3 failed. Detail of the last run: round 1, second upload answered 500 `{"title":"Something went wrong.","status":500,...}`. So the regression test is a real red before the change, not just a guard.

## GREEN (after the migration)

- Build: `0 Warning(s) 0 Error(s)`. `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- Task 1 Infrastructure classes (12 classes): `total: 218 failed: 0 succeeded: 218`.
- `OrderImagesEndpointTests`: `total: 22 failed: 0 succeeded: 22`. The new upload test, 3 more runs: 3 of 3 passed (10 rounds each).
- Model snapshot: `git diff --quiet HEAD -- CspsDbContextModelSnapshot.cs` clean. Migration holds 2 `ALTER DATABASE CURRENT` and 0 other forms, 2 `suppressTransaction: true`.
- Gitleaks: no leaks on each of the three commits.

### Generated script part for this migration (`dotnet ef migrations script <before> <this> --idempotent`)

```
IF NOT EXISTS (SELECT * FROM [__EFMigrationsHistory] WHERE [MigrationId] = N'20261114042819_TurnOnReadCommittedSnapshot')
BEGIN
    IF (SELECT is_read_committed_snapshot_on FROM sys.databases WHERE database_id = DB_ID()) = 0 ALTER DATABASE CURRENT SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
END;
GO

IF NOT EXISTS (SELECT * FROM [__EFMigrationsHistory] WHERE [MigrationId] = N'20261114042819_TurnOnReadCommittedSnapshot')
BEGIN
    INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion]) VALUES (N'20261114042819_TurnOnReadCommittedSnapshot', N'10.0.13');
END;
GO
```

The layout differs a little from the planner's note: there is no `BEGIN TRANSACTION` or `COMMIT` for this migration at all. The history insert is its own guarded batch with no transaction. deploy.md describes this (ALTER in its own piece, history insert in the next piece).

## Deviations from Plan

### Contingency A applied

**[Contingency A] `MigrationScriptTests.IdempotentScriptWrapsEachMigrationInItsOwnTransaction` failed (BEGIN TRANSACTION count 33, expected 34)** because this migration has no transaction block. The test now expects every migration except `TurnOnReadCommittedSnapshot` to have one BEGIN TRANSACTION and one COMMIT; the assertion stays. Commit b0c8a4e4.

### Task 2 rule (ii) applied, with a different wait

**[Rule 1 - test] `SiteSettingsReaderTests.JoinedCallerCompletesWhenTheFirstCallerIsCancelledAndItsScopeEnds` failed in the full Infrastructure run** (`Task first should throw OperationCanceledException but did not`). It held an UPDATE row lock so the cache read stayed busy. Reads no longer wait for row locks, so the read finished at once. The plan's rule (ii) says to turn the staged wait into a write wait on the same row, but the code under test only issues a SELECT, so a write wait cannot stall it. The test now holds a schema lock (`ALTER TABLE dbo.SiteSettings ADD ReaderBlocker int NULL;` in the throwaway ad hoc test database, left uncommitted until the existing commit step), which readers still wait for under read committed snapshot. Every assertion is unchanged. Class run 3 times after the change: 7 of 7 each. Commit 88f01be1.

No other deviation. No application code changed.

## Read committed snapshot audit

Grep over `src` for `BeginTransactionAsync|IsolationLevel|InTransactionAsync|RunInSavepointAsync` and for `LockAsync|TakeAsync|LockActiveManagersAsync` in Application, then each listed handler read.

| Spot | What it reads | Why it stays correct |
|------|---------------|----------------------|
| `DatabaseLocks.TakeAsync` (DatabaseLocks.cs 85 to 89) | Nothing; it is an UPDATE of the lock row | A writer still waits for a writer, so every lock keeps serializing. Proven by the lock test classes (218 green). |
| Roster lock handlers: Delete, Deactivate, Create, Update (non-Manager role), Lock user | The user and the active-Manager count, after the lock | Lock first, then read. A statement that starts after the lock sees every earlier commit. |
| `ActivateUserHandler`, `UnlockUserHandler` | The user, then a conditional update | They only add an active Manager (`removesActiveManager: false`), never take one away, so no roster race. |
| `OrderNumberAllocator` (lock at 34, counter read at 50) | The counter after the lock | Lock first. |
| `HandOverMoneyHandler` 61, `CreateMoneyTransferHandler` 60 | Money rows after the money lock | Lock first. |
| Content handlers with `siteLock.TakeAsync` (Create/Update/Move/Delete gallery, product line, testimonial, closure, photos, share picture; checked `CreateGalleryUploadHandler` 167 and `UploadProductLinePhotoHandler` 147) | Titles, positions, photos, after the lock | Lock is the first call in the transaction. |
| `OrderStore.LockAsync` (97 to 123) | Matches the loaded `RowVersion` in an UPDATE | A reader seeing an older row now fails the row-version match and takes the existing `ConcurrencyConflictException` retry. No new answer. |
| `OrderChildWrite`, `DeleteOrderHandler`, `RestoreOrderHandler`, `PermanentlyDeleteOrderHandler`, `UpdateOrderDetailsHandler` and other tracked-entity saves | The order and children | Writes match the row version of the order, so a stale read becomes a stale-edit retry. A child added by a racing upload moves the order row version, so the delete loses and reads again. |
| `UploadOrderImageHandler.CheckOrderAsync` (103), `CreateGalleryUploadHandler` 86, `UploadProductLinePhotoHandler` 73 | Best-effort pre-check before storage | The decision is made again under the lock at save time; a file that reached storage and lost is queued as `UploadUndone` (existing path). |
| `StaffMoneyReader` (108) | Explicit SERIALIZABLE transaction | Read committed snapshot does not change serializable. |
| `IdempotencyGate.TakeOverIfStaleAsync` (312 to 360) | A claim row | The takeover UPDATE re-checks `ExpiresAtUtc <= now`. A read in a narrow window shows "in progress" (existing 409) instead of waiting; the client retries. |
| `DeleteExpenseCategoryHandler`, `DeleteOrderListEntryHandler` | A use count, then a delete | The foreign keys refuse the delete and map to `CategoryInUseException` and `OrderListEntryInUseException`. The code was already built for this race. |
| Account-token handlers (`ForgotPassword`, `Change/Cancel/Confirm/Request/ResendEmailChange`, `CancelUserEmailChange`, `ResendInvitation`, `SendResetLink`, `SetTemporaryPassword`, `UpdateUser`) | Tokens and the account | All call `tokens.LockAccountAsync` first. |
| Sign-in and password flows (`SignIn`, `VerifyCode`, `SetNewPassword`, `AcceptInvite`, `ResetPassword`) | Challenge or token, then spend | The challenge or token is spent and saved first with a row version, so a second request on the same one loses. |
| `UserAccounts.CreateAsync` | Identity reads, unique email index | Every create runs under the roster lock; the unique index backs it (`EmailInUseException`). |
| Claims by conditional UPDATE: `ImageDeletionQueue`, `MaintenanceCursors`, `MaintenanceRunLock` | Nothing before the UPDATE | Writers still wait for writers. |
| `BootstrapManagerHandler.CreateAsync` | `AnyActiveManagerAsync`, then create | **Finding.** No lock before the check; it used to wait for another copy's unfinished save. Parked as P11-BL-64 (see below). Very unlikely: a one-time command run by hand. |
| Test deadlock setups (`LockDeadlockScenario`, `CreateUserDeadlockTests`, `DeadlockAsync` helpers) | UPDATE waits | Still deadlock; the lock tests pass. |

## Full runs

| Suite | Result |
|-------|--------|
| Infrastructure integration (full, before the SiteSettingsReaderTests fix) | total 1190, failed 1, succeeded 1188, skipped 1. The one failure is the SiteSettingsReaderTests case above, fixed in 88f01be1. |
| `SiteSettingsReaderTests` class after the fix | 7 of 7, three runs. |
| Server integration (full) | total 2819, failed 1, succeeded 2818, skipped 0, 11 m 44 s. The failure is `PublicCacheInvalidationTests.ChangingAProductLineTitle...` (got "Volleyball Jerseys", wanted "Basketball Kits"): the known D-28-1 test-order flake in `deferred-items.md`, unrelated to this change. Passed alone, 1 of 1. |
| Architecture tests | total 290, failed 0 (includes the HostingRecord and DeployWorkflow doc lint over the new text). |
| Coverage gate | Domain line 100% (4227/4227), branch 100% (1813/1813), PASS. Application line 98% (11569/11794), branch 95.8% (not gated), PASS. "Coverage gate passed." |

Flakes: only the known D-28-1 flake above. No new flake.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access. The new ALTER DATABASE is the plan's T-uj0-01 surface, limited to `CURRENT`, and checked by a script test and a grep.

## Notes

- Only `CSPS_Test_` databases made by the tests were altered. `CSPS_Dev` and `CSPS_E2E` get the setting the next time their own seed flow migrates them; that first run briefly ends other connections to that database once. Nothing touched production or any `BetsLLC_*` database. No dev server, Playwright or e2e ran.
- No EF warning appeared when applying the migration.
- No package, trigger, table or column change. The setting is the only change.
- A short-lived background shell loop used to wait for the full runs has ended; nothing is left running.

## Open for the owner

- **P11-BL-64** (open, blocks applying the next production script): the one-time first-Manager command checks "any active Manager" without taking the roster lock, so two copies run at the same instant could create two Managers. Options in DECISIONS.md: A, a small quick task takes the roster lock first; B (recommended), accept it because the command is run once by hand.
- Apply the next production script while the shop is quiet, then run `SELECT name, is_read_committed_snapshot_on FROM sys.databases WHERE name = DB_NAME();` and expect 1. Paste only the value.

## Self-Check: PASSED

- Files exist: the migration and Designer, `ReadCommittedSnapshotMigrationTests.cs`, deploy.md, HOSTING-RECORD, DECISIONS.
- Commits b0c8a4e4, 88f01be1 and a673aab7 are on the branch, `git rev-list --count 5f15ba62..HEAD` is 3.
