---
phase: 06-company-expenses
plan: 21
subsystem: database
tags: [d-50, locks, concurrency, idempotency, ef-core, no-inline-sql, tdd]
created: "2026-10-25T22:30:00-05:00"
updated: "2026-10-25T22:30:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: the three locks to rebuild (plans 06-11 and earlier), the guard test and the owner review pack (06-19, 06-20)
provides:
  - "D-50 built: no C# file under src (outside generated migrations) holds hand-written SQL; NoInlineSqlTests allows no file"
  - "DatabaseLocks table (Name varchar(80) key, TakenAtUtc, ExpiresAtUtc, HolderId, index IX_DatabaseLocks_ExpiresAtUtc) with 65 standing rows, from the one migration AddDatabaseLocks"
  - "DatabaseLocks.TakeAsync: a lock is one ExecuteUpdateAsync on its standing row inside the caller's transaction (Phase 7 reuses it for MONEY-05 and ORD-05)"
  - "ManagerRosterLock, AccountTokenStore.LockAccountAsync and IdempotencyGate rebuilt on that table with the same guarantees"
affects: [07-orders, 06-verification]

actuals:
  tokens: 36000
  tasks: 4
  commits: 8
plan_head_before: 3d472d143bd955d72b679080e413cd194794cfb3
plan_head_after: 4f23620f24b87c23738c9d23efaf074e2d32c4d6

tech-stack:
  added: []
  patterns:
    - "Lock rows: a standing row updated inside the transaction holds an exclusive row lock to commit, with the wait inside SQL Server so deadlocks are still detected"
    - "Lock striping: the per-person lock is one of 64 fixed rows chosen from a SHA-256 of the person's id"
    - "Idempotency claim: a row committed on its own, removed in the same commit as the stored answer, with a 2 minute lease for crashes"

key-files:
  created:
    - src/Csps.Infrastructure/Persistence/Locking/DatabaseLock.cs
    - src/Csps.Infrastructure/Persistence/Locking/DatabaseLocks.cs
    - src/Csps.Infrastructure/Persistence/Configurations/DatabaseLockConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261026024441_AddDatabaseLocks.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261026024441_AddDatabaseLocks.Designer.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksMigrationTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/AccountTokenLockTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Idempotency/IdempotencyGateTests.cs
  modified:
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/Identity/ManagerRosterLock.cs
    - src/Csps.Infrastructure/Identity/AccountTokenStore.cs
    - src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs
    - tests/Csps.Testing/CspsDatabase.cs
    - tests/Csps.Server.IntegrationTests/Auth/ForgotPasswordTests.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyProbeController.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs
    - tests/Csps.ArchitectureTests/NoInlineSqlTests.cs
    - docs/api/auth.md
    - docs/operations/cutover-runbook.md
    - docs/development.md
    - docs/web/owner-review.md
    - web/scripts/owner-review.mjs
    - web/scripts/owner-review.test.ts
    - .planning/STATE.md

key-decisions:
  - "D-50 built as option 2: every lock is a row of the new DatabaseLocks table taken with EF's own API; no trigger, drop or rename (OR-7)."
  - "A SQL Server rollback to a savepoint frees a lock taken after that savepoint (the plan said it would not). Safe: the attempt's writes go with it and the retry takes the lock again; a lock taken before the savepoint stays."
  - "Account lock row = first byte of SHA-256 of the id, modulo 64, so version 7 ids (time-ordered) still spread evenly."
  - "Idempotency claim is deleted inside the request transaction, so a duplicate never sees the key free before the answer is stored."

requirements-completed: [PERF-04]

coverage:
  - id: D1
    description: "Two Managers removing each other at the same moment still leave exactly one active Manager (roster lock row)"
    requirement: PERF-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs (15 tests, the 10 and 20 round races)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/DatabaseLocksTests.cs (12 tests, 30 wait rounds each for commit and rollback)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two link requests for one person at the same moment leave exactly one usable link"
    requirement: PERF-04
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Identity/AccountTokenLockTests.cs (30 rounds at the store)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/ForgotPasswordTests.cs#TwoRequestsForTheSamePersonAtTheSameMomentLeaveOneUsableLinkEveryRound (10 rounds)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A duplicate request gets 409 in-progress at once, a finished key replays, a rollback frees the key, and every key runs once"
    requirement: PERF-04
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Idempotency/IdempotencyGateTests.cs (10 tests, 50 and 20 round races)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs (42 tests incl. two 20 round races)"
        status: pass
    human_judgment: false
  - id: D4
    description: "No hand-written SQL in src and one additive migration only"
    requirement: PERF-04
    verification:
      - kind: integration
        ref: "tests/Csps.ArchitectureTests/NoInlineSqlTests.cs#NoFileIsAllowedInlineSql"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence (MigrationScriptTests, TriggerInventoryTests, DatabaseLocksMigrationTests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "How long a key reads as in progress after a crash (2 minutes) is the owner's choice"
    verification: []
    human_judgment: true
    rationale: "A behavior and timing choice that belongs to the owner; parked in the STATE.md Owner backlog with the built option first."

duration: 52min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 21: Database locks on EF only (D-50) Summary

**The Manager roster lock, the per-person sign-in link lock and the duplicate request guard now run on rows of one new DatabaseLocks table taken with EF's own API, proven by many-round race tests, and NoInlineSqlTests allows no file.**

## Performance

- **Duration:** about 52 min
- **Started:** 2026-10-25T21:36:00-05:00 (approximate)
- **Completed:** 2026-10-25T22:30:00-05:00
- **Tasks:** 4 (each a RED then a GREEN commit)
- **Files modified:** 26 in the task commits

## Accomplishments

- **Roster lock (tracer):** `DatabaseLocks.TakeAsync` updates the lock row inside the open transaction, so a second Manager change waits until the first commits or rolls back. It throws with no transaction, and a lock not had within 10 seconds or lost to a deadlock throws `InvalidOperationException` with the lock's old message.
- **Per-person link lock:** one of 64 fixed rows chosen from the person's id. Two people on the same row only take turns.
- **Duplicate request guard:** a claim row committed on its own (`idem:` plus a SHA-256, so no request data is stored). A duplicate gets 409 `idempotency.in-progress` at once. The claim is removed in the same commit as the stored answer, freed right after a rollback, purged when expired and taken over by exactly one request when stale. The unique index `UX_IdempotencyRecords_Key_Route_UserId` is still the last guard.
- **Guard and docs:** `NoInlineSqlTests` allows no file; runbook, developer guide, API doc and the owner review pack are updated; one Owner backlog item is parked.

## Task Commits

1. **Task 1 (tracer): DatabaseLocks table and roster lock** - RED `f45e99f5` (test), GREEN `6e7a47c7` (feat)
2. **Task 2: account link lock** - RED `a882a2f0` (test), GREEN `888a62be` (feat)
3. **Task 3: duplicate request guard** - RED `28e94148` (test), GREEN `2de40876` (feat)
4. **Task 4: guard with no allowed file, docs, review pack, backlog** - RED `c536ab31` (test), GREEN `4f23620f` (feat)

**Plan metadata:** the docs commit that follows this file.

## TDD Gate Compliance

All four tasks have a `test(06-21)` commit before the `feat(06-21)` commit. RED evidence and my semantic assessment:

- Tasks 1 to 3: RED is a compile failure (the lock types, the `AccountTokenStore(context, time)` constructor, `IdempotencyGate.ClaimName`, `ClaimLease` and `TryClaimAsync` did not exist). This is not a runtime assertion failure, so it would not pass the strict `INVALID_RED` classifier; C# cannot name a type that is absent. The behavior was proved by the GREEN runs.
- Task 2 and 3 server-side race tests (`ForgotPasswordTests` 10 rounds, `IdempotencyTests` hold and send-together) already passed against the old `sp_getapplock` code. They are characterization tests that pin the guarantee across the rebuild, and they stayed green after it.
- Task 4: the RED assertion that fails is `owner-review.test.ts` (`expected ... to contain 'built it'`). `NoFileIsAllowedInlineSql` passed at once because the allow-list was already emptied in Task 3 (see deviation 2).

## Files Created/Modified

See the frontmatter lists. The migration is `20261026024441_AddDatabaseLocks` (EF-generated name; the plan guessed `20261026000000`). Up creates only DatabaseLocks, its index and the 65 rows; Down drops only that table. The per-migration idempotent script (in the git-ignored `artifacts/migrations/AddDatabaseLocks.sql`) has one table, one index, one insert block, no trigger and no change to an existing table.

## Decisions Made

See `key-decisions`. In plain words: the only schema addition is one small table; the lock helper is reusable for Phase 7; the crash window is parked for the owner rather than decided.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Wrong assumption in the plan] A rollback to a savepoint frees a lock taken after it**
- **Found during:** Task 1 (`ALockTakenAfterASavepointIsStillHeldAfterTheRollbackToIt` failed: the second taker did not wait)
- **Issue:** The plan, and my first comment in `DatabaseLocks.cs`, said SQL Server holds the row lock also after a rollback to a savepoint. It does not for a lock taken after the savepoint.
- **Why it is safe:** `CspsUnitOfWork` takes a savepoint per attempt. A failed attempt rolls back its writes together with the lock, and the retry takes the lock again before it reads. A lock taken before the savepoint (the roster lock taken outside, then an inner attempt) stays held. No guarantee is weakened.
- **Fix:** Replaced the test by two that pin the real behavior (lock before a savepoint stays; a retried attempt retakes and holds it to the end) and corrected the comment.
- **Files modified:** `tests/.../DatabaseLocksTests.cs`, `src/.../Locking/DatabaseLocks.cs`
- **Commit:** `6e7a47c7`

**2. [Rule 3 - Blocking] Allow-list entries removed one task at a time**
- **Found during:** Task 1
- **Issue:** `EveryAllowedFileStillHoldsInlineSql` fails the moment a listed file loses its SQL, so the entry had to leave with the task that rebuilt the file.
- **Fix:** Each of Tasks 1, 2 and 3 removed its own file from `NoInlineSqlTests`' allow-list; Task 4 removed the list branch, the stale-entry test, added `NoFileIsAllowedInlineSql` and widened the skip-path theory.
- **Commits:** `6e7a47c7`, `888a62be`, `2de40876`, `c536ab31`

**3. [Rule 3 - Blocking] Round tests clean up their own rows**
- **Found during:** Task 3
- **Issue:** My new 20-round idempotency tests added about 80 stored rows to the shared test database. The existing `ExpiredRecordsOfAnyKeyRouteOrUserAreDeletedByTheNextCoveredPost` advances the clock a day and relies on fewer than 100 rows (the purge batch), so it started failing.
- **Fix:** Each round deletes its own key and business rows (`DeleteRecordsAsync`).
- **Commit:** `28e94148`

**4. [Design choice inside the plan] Stripe function**
- The plan allowed "for example the first four bytes modulo 64". I used the first byte of `SHA256(id bytes)` modulo 64 instead, because version 7 ids (used elsewhere) start with a timestamp and would crowd a few rows. Stable across processes; 10,000 random ids reach all 64 rows (tested).

**Total deviations:** 4 (1 Rule 1, 2 Rule 3, 1 design choice). **Impact:** none on the guarantees; one plan statement about savepoints was wrong and is corrected in code, comment and test.

## Verification Evidence

- Preflight clear (ports 5180, 5115, 7028, 5199 free, no dev or test processes).
- `dotnet build`: `0 Warning(s)`, `0 Error(s)`. `dotnet format --verify-no-changes`: only the known `UserDirectory.cs` IMPORTS item (deferred-items.md).
- Full runs after Task 4: Infrastructure integration `total: 590, failed: 0, succeeded: 589, skipped: 1` (the live HIBP test); Architecture `total: 241, failed: 0`; Application unit `total: 1223, failed: 0`; Server integration `total: 1315, failed: 0` in run 2 (see the flake below for runs 1 and 3).
- Race tests run a second time alone, all passing: `DatabaseLocksTests` 12/12, `AccountTokenLockTests` 4/4, `IdempotencyGateTests` 10/10, `LastManagerGuardTests` 15/15, `*Idempotency*` 54/54, `ForgotPasswordTests` 14/14. `*Password*` 79, `*EmailChange*` 85, `*Invit*` 24, `CreateCompanyExpenseEndpointTests` 22 all pass.
- `MigrationScriptTests` 6/6 (applies on the predecessor and twice), `TriggerInventoryTests` 2/2 (only `TR_AuditLog_AppendOnly`).
- Browser smoke: `npm --prefix web run e2e -- --grep @expenses-add` `5 passed (2.2m)` on chromium, firefox, webkit, pixel and iphone. The guarded seed migrated `CSPS_E2E` with the new table.
- `npm --prefix web run test -- --run scripts/owner-review.test.ts`: `Tests 107 passed (107)`.
- Acceptance greps: no `ExecuteSql` or `SqlParameter` outside comments in the three files; `IsRowVersion` 0 in the lock configuration; script has 0 `CREATE TRIGGER`, 1 `CREATE TABLE [DatabaseLocks]`, 0 changes to AspNet, Idempotency or Company tables; exactly two `_AddDatabaseLocks` migration files.

## Flake (recorded, not hidden)

`CompanyExpenseListQueryCountTests.ThePageSizeDoesNotChangeTheNumberOfSqlCommands` failed in the first and third full Server runs (`large.Count` should be 3 but was 4) and passed in the second full run and alone (3/3). It is the same known flake logged in 06-08 and 06-13 (`deferred-items.md`): a GET list route that touches no lock or idempotency code. Not caused by this plan; not touched.

## Issues Encountered

None open besides the flake above.

## Out of scope, reported only

`tools/Csps.DevSeed/Program.cs` sets the compatibility level with one raw SQL statement. It is a developer tool outside `src/`, so `NoInlineSqlTests` does not scan it and D-50 did not name it. The owner may rule on it if wanted.

## Behavior note

A duplicate that arrives in the few milliseconds while the first request is committing (claim deleted, not yet committed) waits for that commit and then replays the stored answer, instead of getting 409. That is correct and harmless.

## Parked for the owner

STATE.md Owner backlog: "Phase 6 duplicate-request guard after a crash (06-21, D-50)". Option 1 (recommended, built): `IdempotencyGate.ClaimLease` stays 2 minutes. Option 2: a shorter time such as 30 seconds. Nothing was decided for the owner.

## Known Stubs

None.

## Threat Flags

None. The new table is the plan's own surface (T-06-65 to T-06-73); the site's `db_datawriter` user needs no new right.

## Self-Check: PASSED

All created files exist and all eight task commits are ancestors of HEAD.
