---
phase: 11-public-site-content-management
plan: 01
subsystem: infra
tags: [npm-audit, sql-server, deadlock, concurrency, locks, ef-core]
created: "2026-11-11T20:03:00-05:00"
updated: "2026-11-11T20:03:00-05:00"

requires:
  - phase: 10-money-and-expenses
    provides: StaffMoneyLock deadlock fix (eb3ad29a), the idempotency gate's outer transaction (D-46), DatabaseLocks
provides:
  - audit exceptions for glob and minimatch valid to 2026-12-14 (D-45)
  - order-number lock, Manager roster lock and account-token lock answer a deadlock as a lost race (409), not a 500
  - LockDeadlockScenario test helper that makes a real deadlock on a standing lock row
affects: [phase-11 CI, order create and import, users and profile link handlers]

actuals:
  tokens: 12000
  tasks: 3
  commits: 6
plan_head_before: 24e4cef7ec03832dbb2b7fd29c27fa1abbe989bf
plan_head_after: 7b7b1ce34b71251af40f389c6bdd01354814656f

tech-stack:
  added: []
  patterns:
    - "A lock that is taken inside the gate's outer transaction catches DatabaseLockTimeoutException with SqlErrors.DeadlockVictim, clears the change tracker and throws ConcurrencyConflictException; a plain timeout keeps its own busy answer"

key-files:
  created:
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/LockDeadlockScenario.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/ManagerRosterLockTests.cs
  modified:
    - docs/audit-exceptions.json
    - src/Csps.Infrastructure/Orders/OrderNumberAllocator.cs
    - src/Csps.Infrastructure/Identity/ManagerRosterLock.cs
    - src/Csps.Infrastructure/Identity/AccountTokenStore.cs
    - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderNumberAllocatorTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/AccountTokenLockTests.cs
    - tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/ImportOrderHandlerTests.cs
    - .planning/phases/999.6-owner-items-parked-during-phase-10-execution/DECISIONS.md

key-decisions:
  - "No new decision. D-45 (audit extension) and D-119 (P10-BL-22 moved into Phase 11) were already ruled by the owner on 2026-11-11."

requirements-completed: [OPS-03, ORD-14, SEC-07]

coverage:
  - id: D1
    description: "The npm audit gate keeps passing through 2026-12-14 with the owner-extended glob and minimatch exceptions, and fails after that date"
    requirement: OPS-03
    verification:
      - kind: other
        ref: "npm --prefix web run audit:check -- --today 2026-11-15 (exit 0); --today 2026-12-15 (exit 1, both advisories 'was accepted until 2026-12-14')"
        status: pass
      - kind: unit
        ref: "web/scripts/audit-policy.test.ts (14 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A deadlock on the order-number lock inside an outer transaction is a lost race with the transaction ended; create and import answer the order busy 409; a plain timeout still gives OrderNumberBusyException"
    requirement: ORD-14
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderNumberAllocatorTests.cs#ADeadlockOnTheLockInsideAnOuterTransactionIsALostRaceWithTheTransactionEnded"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs#ADeadlockVictimOnTheNumberLockIsTheSame409AsABusyNumberLockAndTheTransactionRollsBack; ImportOrderHandlerTests.cs#ADeadlockVictimOnTheNumberLockIsTheSame409"
        status: pass
    human_judgment: false
  - id: D3
    description: "The Manager roster lock and the account-token lock end a lost deadlock as a lost race, and every caller maps it to the busy 409"
    requirement: SEC-07
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Identity/ManagerRosterLockTests.cs and AccountTokenLockTests.cs#ADeadlockOnTheLockInsideAnOuterTransactionIsALostRaceWithTheTransactionEnded"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-11-11
status: complete
---

# Phase 11 Plan 01: The audit gate keeps passing, and a lock deadlock answers 409 instead of 500 Summary

**The glob and minimatch audit exceptions now run to 2026-12-14, and the order-number, Manager roster and account-token locks turn a lost deadlock into a 409 lost race instead of a 500 from a failed savepoint rollback (SQL error 3903).**

## Performance

- **Duration:** about 25 min
- **Tasks:** 3 of 3
- **Files:** 2 created, 9 modified (plus this summary)

## Accomplishments

- **D-45, done first and alone (`d57feb9c`):** both entries in `docs/audit-exceptions.json` now have `reviewBy` 2026-12-14 and `approved` 2026-11-11, with one sentence naming D-45 in each reason. Same two GHSA ids, no new entry, no `overrides`, no lockfile or package change. `git show --name-only --format= d57feb9c` lists only `docs/audit-exceptions.json`.
- **P10-BL-22, order-number lock:** `OrderNumberAllocator.TakeLockAsync` now catches `DatabaseLockTimeoutException`. A deadlock victim clears the change tracker and throws `ConcurrencyConflictException`. Any other timeout still throws `OrderNumberBusyException`. The handlers needed no change.
- **P10-BL-22, the two locks looked at "at the same time":** both had the same gap, so both were fixed the same way (table below).
- **New test helper:** `LockDeadlockScenario` makes a real deadlock on a standing lock row inside an outer transaction and returns what each request ended with.

### Lock findings (P10-BL-22)

| Lock | Before | After | Code changed |
|------|--------|-------|--------------|
| Manager roster (`ManagerRosterLock`) | A deadlock became `DatabaseLockTimeoutException` (an `InvalidOperationException`). The gate's savepoint rollback then failed with SQL error 3903, so the request answered 500. | `ConcurrencyConflictException` with the deadlock as its cause and the outer transaction marked ended. | Yes |
| Account token (`AccountTokenStore.LockAccountAsync`) | Same as the roster lock. | Same as the roster lock. | Yes |

A plain timeout on these two locks is unchanged (still `DatabaseLockTimeoutException`, as the plan said to keep it). All 15 callers (5 roster, 10 account-token: `CreateUser`, `UpdateUser`, `LockUser`, `DeleteUser`, `DeactivateUser`, `SendResetLink`, `SetTemporaryPassword`, `ResendInvitation`, `CancelUserEmailChange`, `RequestEmailChange`, `ResendEmailChange`, `ConfirmEmailChange`, `CancelEmailChange`, `ChangePassword`, `ForgotPassword`) already run their lock inside `ConflictRetry`, which answers `AuthErrors.SessionBusy` (409) for a `ConcurrencyConflictException`, so no handler change or new mapping was needed. No message text changed (P10-BL-23 stays in plan 11-06).

## TDD evidence

**RED, order-number lock** (`bb700755`): `OrderNumberAllocatorTests.ADeadlockOnTheLockInsideAnOuterTransactionIsALostRaceWithTheTransactionEnded` failed on the planned assertion:

```
Shouldly.ShouldAssertException : outcome ... should be of type Csps.Application.Common.ConcurrencyConflictException
    but was Microsoft.Data.SqlClient.SqlException
Microsoft.Data.SqlClient.SqlException (0x80131904): The ROLLBACK TRANSACTION request has no corresponding BEGIN TRANSACTION.
  at ... RelationalTransaction.RollbackToSavepointAsync ... CspsUnitOfWork.RunInSavepointAsync
Error Number:3903
Test run summary: Failed!  total: 3  failed: 1  succeeded: 2
```

Semantic assessment: the target test ran, deadlocked for real, and failed on the planned assertion (expected the lost-race exception, got the 3903 failure the backlog item describes). The other two allocator tests passed. Not a build, fixture or zero-test failure.

**GREEN** (`ab2cc829`): `dotnet test` on `*OrderNumberAllocatorTests` and `*OrderNumberTakenTests`: total 7, succeeded 7.

**Handler tests** (in the RED commit): `CreateOrderHandlerTests` and `ImportOrderHandlerTests` got one case each, where the allocator throws `ConcurrencyConflictException` and the answer is `OrderErrors.Busy`. They passed at once because the handlers already mapped both exceptions (the plan said so). They are guards for that mapping, not RED tests. Run: total 64, succeeded 64.

**RED, roster and account-token locks** (`21b27630`): both new tests failed with the same `SqlException ... ROLLBACK TRANSACTION request has no corresponding BEGIN TRANSACTION. Error Number:3903` (`Test run summary: Failed! total: 6 failed: 2 succeeded: 4`).

**GREEN** (`a49d8599`): `*ManagerRosterLockTests`, `*AccountTokenLockTests`, `*StaffMoneyLockTests`, `*OrderNumberAllocatorTests`: total 13, succeeded 13.

## Verification run

| Check | Result |
|-------|--------|
| `npm --prefix web run audit:check -- --today 2026-11-15` | exit 0: "Accepted: GHSA-3g3m-2fjr-6pw4 (glob)", "Accepted: GHSA-g3hv-75wg-m249 (minimatch)", "npm audit gate: no unaccepted advisories." |
| `npm --prefix web run audit:check -- --today 2026-12-15` | exit 1: "glob: GHSA-3g3m-2fjr-6pw4 was accepted until 2026-12-14. Review it with the owner." and the same for minimatch |
| `npm --prefix web run test -- --run scripts/audit-policy.test.ts` | 1 file, 14 tests passed |
| `dotnet test --project tests/Csps.Infrastructure.IntegrationTests` (whole project, `CSPS_TEST_SQL=localdb`) | total 1070, succeeded 1069, skipped 1 (`HibpLiveTests`, needs `CSPS_LIVE_HIBP=1`, not mine) |
| `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CreateOrderHandlerTests" --filter-class "*ImportOrderHandlerTests"` | total 64, succeeded 64 |
| `dotnet format Csps.slnx --verify-no-changes` | exit 0, no output (run after the allocator fix and again after the lock fixes) |
| `gitleaks protect --staged --no-banner` before each of the 6 commits | no leaks found |

Acceptance criteria re-checked: `reviewBy` 2026-12-14 on both entries and 0 left at 2026-11-14; ids are exactly the two GHSA ids; `SqlErrors.DeadlockVictim` and `ChangeTracker.Clear()` are in `OrderNumberAllocator.cs`; the allocator test name is in `OrderNumberAllocatorTests.cs`; `ManagerRosterLockTests.cs` exists; `grep -c "Fixed in plan 11-01"` on DECISIONS.md is 1.

## Task commits

| Task | Commit | Type |
|------|--------|------|
| 1 audit exceptions to 2026-12-14 (D-45) | `d57feb9c` | chore |
| 2 RED order-number deadlock test and handler guards | `bb700755` | test |
| 2 GREEN allocator fix | `ab2cc829` | fix |
| 3 RED roster and account-token deadlock tests, helper | `21b27630` | test |
| 3 GREEN roster and account-token fix | `a49d8599` | fix |
| 3 DECISIONS.md P10-BL-22 status | `7b7b1ce3` | docs |

## TDD Gate Compliance

Task 2 and Task 3 each have a `test(11-01)` commit before their `fix(11-01)` commit (the plan asked for `fix` rather than `feat` for GREEN). No REFACTOR commit. The plan is `type: execute`, so the gate is advisory.

## Decisions Made

None new. D-45 and D-119 were ruled by the owner on 2026-11-11 and are in 11-CONTEXT.md.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The worktree had no `web/node_modules`**
- **Found during:** Task 1 verify (`audit-policy.test.ts` needs vitest)
- **Issue:** the parallel worktree is a fresh checkout.
- **Fix:** `npm ci --ignore-scripts` in `web/`, which restores the lockfile versions. No package was added, bumped or overridden, and `package.json` and the lockfile are untouched (`git status` clean after).
- **Files modified:** none tracked.

**2. [Scope note] The plan said "keeps today's log line" for the allocator timeout**
- The allocator never had a log line (only `StaffMoneyLock` logs). None was added; the timeout path is the same as before (`OrderNumberBusyException`).

**3. [Scope note] The handler tests were green on first run**
- Both handlers already mapped `ConcurrencyConflictException` to `OrderErrors.Busy`, so those two tests are guards, not RED tests. The RED evidence for Task 2 is the allocator integration test.

**4. [Scope note] Plan header says to work in `C:/Work/CarmensStitchAndPrintingServices` on branch `gsd/phase-11-...`**
- Per the orchestrator, this ran in the isolated worktree on branch `worktree-agent-a10a75582c4c759f3`. Nothing was merged or pushed.

**Total deviations:** 1 auto-fixed (blocking, no tracked change), 3 notes. **Impact:** none on scope or behavior.

## Issues Encountered

None. Two lock tests make a real SQL Server deadlock (the roster test waits the default 10 s for SQL Server's deadlock check, as the plan's copy of the money-lock test does). Both ran in under 4 s each and passed on the first green run. No flake seen in the 1070-test project run.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema. T-11-01 (order-number deadlock DoS) is mitigated as planned; T-11-SC holds (no package change).

## Notes for later plans

- The Server integration test projects (endpoint and authorization-matrix tests) were not run in this plan. The change only turns an unmapped `InvalidOperationException` into a mapped `ConcurrencyConflictException` inside Infrastructure locks, which the 15 callers already handle; the full Infrastructure integration project passed.
- `OrderNumberAllocatorTests` still carries its own copy of the deadlock setup (same as `StaffMoneyLockTests`). The new `LockDeadlockScenario` helper could replace both copies later; not done here to keep this plan small.
- The audit gate fails from 2026-12-15 unless the owner rules again; this is by design (D-45).

## Self-Check: PASSED

- FOUND: docs/audit-exceptions.json, OrderNumberAllocator.cs, ManagerRosterLock.cs, AccountTokenStore.cs, ManagerRosterLockTests.cs, LockDeadlockScenario.cs
- FOUND commits: d57feb9c, bb700755, ab2cc829, 21b27630, a49d8599, 7b7b1ce3
- STATE.md and ROADMAP.md not modified.
