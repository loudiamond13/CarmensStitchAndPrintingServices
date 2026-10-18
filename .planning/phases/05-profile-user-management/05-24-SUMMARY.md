---
phase: 05-profile-user-management
plan: 24
subsystem: api
tags: [users, manager-lock, sessions, audit, roster-lock, manager-guard, openapi, user-03, user-04, user-05, d-16, d-17, d-18, d-19, d-21, d-40]
created: "2026-10-18T07:05:00-05:00"
updated: "2026-10-18T07:05:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-21 DeactivateUserHandler structure, ManagerGuard, IManagerRosterLock, UserErrors.OwnAccount and LastActiveManager, SessionRevocationReason.AccountChanged, CountActiveManagersAsync (Manager-locked counts as not active); 05-10 IsBlocked on every sign-in, reset and link path; 05-05 ApplicationUser.ManagerLockedAtUtc; 05-23 and 05-40 UpdateUserHandler (version-guarded edit, untouched here)"
provides:
  - "POST /api/v1/users/{id}/lock and /unlock (Manager policy, Idempotency-Key, no version, 204): set and clear the Manager lock"
  - "IUserAccounts.SetManagerLockAsync(id, lockedAt, ct): true only on a real change; rotates EditVersion then; the stamp interceptor records the Manager as the last changer (SEC-08)"
  - "LockUserHandler (roster lock first, then read, then ManagerGuard with removesActiveManager) and UnlockUserHandler (no guard, no roster lock)"
  - "AuditActions.UserLocked (user.locked) and UserUnlocked (user.unlocked), both in All, target User id, no detail; the revocation is a second auth.sessions-revoked entry (account-changed) only when a session was open"
  - "Contract snapshot and generated TS types for LockUser and UnlockUser; docs/operations/audit-log.md rows for both codes"
affects: [05-25 Edit User panel, 05-30 Account access section (calls lock and unlock), 05-26 delete (reuses the guard), 05-37 screen review]

actuals:
  tokens: 13000
  tasks: 2
  commits: 4
plan_head_before: 62c5375cd4e912e49517795b2ee6e077d8c29de2
plan_head_after: 9df0f3261b0672e7faccc5352615f0f46b71a2d5

tech-stack:
  added: []
  patterns:
    - "Lock and unlock mirror deactivate and activate: one transaction (set, revoke all with AccountChanged, record), cache eviction after the commit, a no-op answers 204 with nothing written, recorded or revoked"
    - "The only handler that needs the roster applock is the one that removes an active Manager; unlock restores a Manager, so it takes no lock and runs no guard"

key-files:
  created:
    - src/Csps.Application/Users/LockUserHandler.cs
    - src/Csps.Application/Users/UnlockUserHandler.cs
    - tests/Csps.Server.IntegrationTests/Users/LockUserTests.cs
    - tests/Csps.Application.UnitTests/Users/LockUserHandlerTests.cs
  modified:
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Server/Controllers/UsersController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md

key-decisions:
  - "Unlock takes no roster lock and runs no guard: it can only add an active Manager back, and a Manager-locked person cannot call it on themselves (every auth path refuses them)"
  - "The lock instant comes from TimeProvider, never DateTime.Now; the stored value only means 'locked since', and nothing in the code reads it as an expiry, so no timer can lift it (D-16)"
  - "A second Lock keeps the first lock time and a second Unlock changes nothing: SetManagerLockAsync compares only locked or not, so a repeat is a no-op without a write, an audit entry or a revocation"

patterns-established:
  - "Race tests run 20 times for the mutual case (lock/lock, like deactivate/deactivate) and 10 for the mixed lock-versus-deactivate case, resetting the database each run"

requirements-completed: [USER-03, USER-04, USER-05]

coverage:
  - id: D1
    description: "A Manager locks a colleague: they are signed out at once (old token 401, refresh 401), sign-in gives the generic 401, forgot-password is the neutral 202 with no email, a reset link issued before the lock reads as invalid, and the roster shows Locked"
    requirement: "USER-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LockUserTests.cs#ALockedColleagueIsSignedOutAtOnceCannotSignInOrResetTheirWayBackAndIsBackOnlyAfterUnlock"
        status: pass
    human_judgment: false
  - id: D2
    description: "Unlock restores sign-in; the Manager lock has no timer (still locked after 30 days on a stepped clock); unlock leaves the 15-minute failed-password lockout in place"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LockUserTests.cs#AManagerLockHasNoTimerAndStaysAfterThirtyDays"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LockUserTests.cs#UnlockLeavesTheFifteenMinuteFailedPasswordLockoutInPlace"
        status: pass
    human_judgment: false
  - id: D3
    description: "Repeating a lock or an unlock answers 204 with no new audit entry, no revocation and no version change; a real change rotates the edit version and stamps the Manager as last changer"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LockUserTests.cs#LockingAnAlreadyLockedAccountOrUnlockingAnUnlockedOneAnswers204AndChangesAndRecordsNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LockUserTests.cs#LockAndUnlockRotateTheEditVersionAndStampTheManagerAsTheLastChanger"
        status: pass
    human_judgment: false
  - id: D4
    description: "user.locked and user.unlocked target the User id with no detail; the revocation is recorded once as auth.sessions-revoked account-changed; Admin 403, anonymous 401, unknown person 404"
    requirement: "USER-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LockUserTests.cs#LockAndUnlockAreAuditedAgainstTheUserWithNoDetailAndTheRevocationIsRecordedOnce"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (matrix rows for /lock and /unlock)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Locking respects the last active Manager and never one's own account, including two Managers locking each other at once (20 runs) and a lock racing a deactivate (10 runs)"
    requirement: "USER-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs#TwoManagersLockingEachOtherTogetherLeaveExactlyOneActiveEveryTime"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs#ALockAndADeactivateOnTheTwoManagersAtTheSameTimeLeaveExactlyOneActive"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/LockUserHandlerTests.cs#TheRosterLockIsTakenBeforeTheTargetIsRead"
        status: pass
    human_judgment: false

duration: 19min
completed: 2026-10-18
---

# Phase 5 Plan 24: Manager Lock and Unlock Summary

**Manager lock and unlock: untimed, signs the person out at once, never lifted by a reset or the clock, unlock leaves the failed-password lockout alone, and locking an active Manager runs the same roster lock and last-Manager guard as deactivation.**

## Performance

- **Duration:** 19 min
- **Started:** 2026-10-18T06:46:00-05:00
- **Completed:** 2026-10-18T07:05:00-05:00
- **Tasks:** 2 (a tracer and an auto task, both TDD)
- **Files modified:** 16 (4 created, 12 modified)

## Accomplishments

- `POST /api/v1/users/{id}/lock` and `/unlock` (Manager only, no version, 204). Lock sets `ManagerLockedAtUtc`; unlock clears it. Both end every session with `AccountChanged`, record `user.locked` or `user.unlocked` with no detail, and evict the person from the session cache after the commit.
- D-17 holds end to end: a locked person's forgot-password is the neutral 202 with no email, a reset link issued before the lock reads as invalid, and the lock is still on afterwards (the 05-10 rules, re-proven through the real routes).
- D-18 and D-19: `LockUserHandler` takes the roster lock before reading the target, then runs `ManagerGuard` with `removesActiveManager: true`. Own account answers 422 `users.own-account`, the last active Manager 422 `users.last-active-manager`. Twenty runs of two Managers locking each other leave exactly one active; ten runs of a lock racing a deactivate do the same.
- Repeating a lock or an unlock is a 204 that writes, records and revokes nothing, and leaves the edit version alone. A real change rotates the version and the stamp interceptor records the Manager as the last changer (SEC-08).
- Contract snapshot and generated types refreshed; audit-log guide documents both codes.

## Task Commits

1. **Task 1 (tracer): a Manager locks a colleague, unlock restores access**
   - RED: `566c6d5` (test) - `LockUserTests`, 7 tests, all failing with 404 on the missing routes
   - GREEN: `0ea88fe` (feat) - port method, Infrastructure implementation, both handlers, controller routes, audit codes, matrix rows, contract
2. **Task 2: locking respects the last active Manager**
   - RED: `7b0e67a` (test) - 4 of the new/extended integration cases failing (422 expected, 204 returned)
   - GREEN: `9df0f32` (feat) - roster lock and guard in `LockUserHandler`, handler unit tests for the order and guard branches, audit-log guide

**Plan metadata:** the docs commit that follows this summary (STATE.md, ROADMAP.md, REQUIREMENTS.md).

## TDD Gate Compliance

- Task 1 RED: `dotnet test --filter-class "*LockUserTests"` ran 7 tests, all 7 failed. Every failure was the planned assertion (`locked.StatusCode` expected 204, was 404 `We couldn't find that.`, because the routes did not exist). The audit-code literals were written as strings in the RED test so the project compiled (a compile error would have been INVALID_RED). Semantic assessment: valid RED, the target tests executed and failed for the intended reason. The MTP report is not one of the formats `gsd check tdd-red-evidence` reads, so the assessment above is the evidence.
- Task 1 GREEN: all 7 pass; the authorization matrix (168 tests) passes.
- Task 2 RED: `*LastManagerGuardTests` ran 11 tests, 4 failed on the planned assertion (expected 422, was 204): locking the last active Manager, the mutual-lock race, the lock-versus-deactivate race, and the own-account case for `lock`. The other 7 are the earlier cases plus one regression case that passes before and after.
- Task 2 GREEN: all 11 pass.
- No REFACTOR commit: nothing worth changing after GREEN.

## Files Created/Modified

- `src/Csps.Application/Users/LockUserHandler.cs` - lock use case with roster lock and guard
- `src/Csps.Application/Users/UnlockUserHandler.cs` - unlock use case, no guard
- `src/Csps.Application/Ports/IUserAccounts.cs`, `src/Csps.Infrastructure/Identity/UserAccounts.cs` - `SetManagerLockAsync`
- `src/Csps.Domain/Auditing/AuditActions.cs` - `UserLocked`, `UserUnlocked`
- `src/Csps.Server/Controllers/UsersController.cs`, `src/Csps.Server/Composition/ApplicationRegistration.cs` - routes and registration
- `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` - refreshed contract (`LockUser`, `UnlockUser`)
- `docs/operations/audit-log.md` - rows for `user.locked` and `user.unlocked`
- Tests: `LockUserTests`, `LockUserHandlerTests` (new); `LastManagerGuardTests`, `AuthorizationMatrix`, `UserAccountsTests`, `AuditActionsTests` (extended)

## Decisions Made

- Unlock takes no roster lock and runs no guard (the plan says so): it can only add an active Manager back.
- `SetManagerLockAsync` compares only locked versus not locked, so a second lock keeps the first lock time and a second unlock is a no-op.
- The lock time is stored from `TimeProvider` and nothing reads it as an expiry.

## Deviations from Plan

None - plan executed exactly as written, with two small notes on test construction that are not plan deviations:

- Task 2's RED commit also holds `LockUserHandlerTests`. The cases that touch the roster lock and the guard (`TheRosterLockIsTakenBeforeTheTargetIsRead`, own account, last Manager, Admin without a count) could not be written before the handler took those dependencies, because the constructor changes with the guard. They were added in the GREEN commit; the integration cases in the RED commit are what failed first. The handler tests present in the RED commit cover the Task 1 code and passed.
- `AuditActionsTests.CatalogHoldsTheTwentyOneAuthCodes...` pins the catalog size (32); it moved to 34 with the two new codes.

**Total deviations:** 0 auto-fixed. **Impact on plan:** none.

## Issues Encountered

- The first run of the RED test did not compile (`TestSessions.StartAsync` needs a `CspsApiFactory`, not the clock-derived host, and `DateTimeOffset.UtcNow` is banned). Fixed in the test before the RED commit, so the committed RED fails on behavior, not on compilation.

## Known Stubs

None.

## Threat Flags

None. Both routes sit behind the existing Manager policy and Idempotency-Key handling; no new trust boundary. T-05-69 (a locked person regaining access by reset) is mitigated by the 05-10 `IsBlocked` rules and proven here end to end. T-05-70 (locking the last active Manager) is mitigated by the roster lock plus `ManagerGuard` and the 20-run race test.

## User Setup Required

None - no external service configuration required.

## Verification

- `dotnet test --project tests/Csps.Server.IntegrationTests`: 953 passed, 0 failed.
- `dotnet test --project tests/Csps.Application.UnitTests` (through the coverage gate): 737 passed. Domain 598 passed.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): Domain 100% line and branch, Application 99.6% line. PASS.
- `npm --prefix tools/openapi-gen run check`: types match the snapshot.
- `*UserAccountsTests` (Infrastructure): 25 passed.
- Acceptance greps: `user.locked|user.unlocked` in AuditActions.cs = 2, `/lock|/unlock` in the matrix = 2, `LockActiveManagersAsync` in LockUserHandler.cs = 1, `user.locked` in audit-log.md = 1.

## Next Phase Readiness

- Ready for 05-25 and 05-30: the Edit panel's Account access section can call `LockUser` and `UnlockUser` from the generated types.
- 05-26 (delete) can reuse `ManagerGuard` and the roster lock the same way.

## Self-Check: PASSED

- Created files exist: LockUserHandler.cs, UnlockUserHandler.cs, LockUserTests.cs, LockUserHandlerTests.cs.
- Commits exist on the branch: 566c6d5, 0ea88fe, 7b0e67a, 9df0f32.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
