---
phase: 05-profile-user-management
plan: 21
subsystem: api
tags: [users, deactivate, activate, last-manager-guard, applock, race, sessions, user-03, user-04, user-05, user-06, d-16, d-18, d-19, d-21]
created: 2026-10-18T05:14:00-05:00
updated: 2026-10-18T05:14:00-05:00
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-17 UsersController, UserErrors and roster reads; 05-19 create user; 04 sessions, SessionCache, SessionStore.RevokeAllAsync, IdempotencyGate; 05-09 ConcurrentRequests"
provides:
  - "POST /api/v1/users/{id}/deactivate and /activate (Manager policy, Idempotency-Key, no version): 204, 401, 403, 404 users.not-found, 409 busy, 422"
  - "Deactivating or reactivating ends every session of that person (SessionRevocationReason.AccountChanged = 9), evicts the person from the session cache after the commit, and rotates EditVersion (SEC-08 stamps the Manager)"
  - "IManagerRosterLock / ManagerRosterLock: one transaction-owned sp_getapplock on 'csps-active-managers', taken before the target is read or Managers are counted (D-18, no trigger, OR-7)"
  - "ManagerGuard.CheckAsync(target, callerId, removesActiveManager, ct): users.own-account (D-19) and users.last-active-manager (D-18), shared by 05-23 demote, 05-24 lock, 05-26 delete"
  - "IUserAccounts.SetActiveAsync and CountActiveManagersAsync"
  - "Audit user.deactivated and user.activated (target User id, no detail); auth.sessions-revoked detail account-changed"
affects: [05-22 Users screen actions, 05-23 role change, 05-24 lock, 05-26 delete, 05-33 audit log screen, 05-37 verification]

actuals:
  tokens: 22000
  tasks: 3
  commits: 5
plan_head_before: 8e7c8c63c201f7b117483eeaf435d84433c2aaf0
plan_head_after: 0c5189a9638d7ee70ca31705359907903cf10bba

tech-stack:
  added: []
  patterns:
    - "One reviewed lock per rule: the Manager roster rule takes sp_getapplock first inside InTransactionAsync, the same shape as AccountTokenStore.LockAccountAsync; it is held by the idempotency gate's transaction until the answer is stored, so the loser of a race counts the real remaining Managers"
    - "A guard that every reducing action shares (ManagerGuard) with a removesActiveManager flag, so activate reuses the own-account rule without the Manager count"
    - "No-op by comparison: SetActiveAsync returns false when the state already matches, and the handler then writes, revokes, audits and evicts nothing"

key-files:
  created:
    - src/Csps.Application/Ports/IManagerRosterLock.cs
    - src/Csps.Infrastructure/Identity/ManagerRosterLock.cs
    - src/Csps.Application/Users/ManagerGuard.cs
    - src/Csps.Application/Users/DeactivateUserHandler.cs
    - src/Csps.Application/Users/ActivateUserHandler.cs
    - tests/Csps.Server.IntegrationTests/Users/UserLifecycleTests.cs
    - tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs
    - tests/Csps.Application.UnitTests/Users/ManagerGuardTests.cs
    - tests/Csps.Application.UnitTests/Users/DeactivateUserHandlerTests.cs
    - tests/Csps.Application.UnitTests/Users/ActivateUserHandlerTests.cs
    - tests/Csps.Application.UnitTests/Users/EvictionProbe.cs
  modified:
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Infrastructure/Identity/IdentityRegistration.cs
    - src/Csps.Application/Users/UserErrors.cs
    - src/Csps.Domain/Identity/SessionOutcomes.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Server/Controllers/UsersController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Users/UserFixtures.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md
    - .planning/phases/05-profile-user-management/deferred-items.md

key-decisions:
  - "SessionRevocationReason.AccountChanged is stored as 9, not 7: the plan said 7, but 7 is Expired and 8 is PasswordChanged in the shipped enum (stored as a byte), so 9 is the next free value and nothing is renumbered"
  - "Activate takes no roster lock (it can only add an active Manager) but still runs ManagerGuard with removesActiveManager false, so a Manager cannot activate their own account (D-19)"
  - "A deactivated or reactivated person is evicted from the session cache whenever the state changed (not only when a session was revoked); a no-op evicts nothing"
  - "The lock is registered in IdentityRegistration.cs next to IAccountTokens (DependencyInjection.cs only calls it)"

patterns-established:
  - "ManagerGuard.IsActiveManager is the one definition of an active Manager in Application: role Manager, active, not deleted, not Manager-locked; a failed-password lockout does not matter"
  - "Race tests reset the shared test database with ResetAsync before each run so the survivor count is exact"

requirements-completed: [USER-03, USER-04, USER-05, USER-06]

coverage:
  - id: D1
    description: "USER-03 / USER-05 / D-16: a Manager deactivates a signed-in colleague; their next request with the old token and their refresh answer 401, signing in answers the generic 401, the roster shows Inactive; activating lets them sign in again"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UserLifecycleTests.cs#ADeactivatedColleagueIsSignedOutAtOnceCannotSignInAndComesBackWhenActivated"
        status: pass
    human_judgment: false
  - id: D2
    description: "USER-06 / D-40: user.deactivated and user.activated target the User id with no detail, and auth.sessions-revoked records account-changed, all with the Manager as actor"
    requirement: "USER-06"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UserLifecycleTests.cs#ADeactivatedColleagueIsSignedOutAtOnceCannotSignInAndComesBackWhenActivated"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/DeactivateUserHandlerTests.cs#ASuccessEndsEverySessionRecordsBothEntriesOnceAndEvictsAfterTheCommit"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-21 / SEC-08: deactivating rotates the edit version and stamps the Manager as the last changer; a repeat is a 204 that changes, records and revokes nothing (USER-04 idempotency edge)"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UserLifecycleTests.cs#DeactivatingRotatesTheEditVersionAndStampsTheManagerAsTheLastChanger"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UserLifecycleTests.cs#RepeatingADeactivateOrAnActivateAnswers204AndChangesAndRecordsNothingMore"
        status: pass
    human_judgment: false
  - id: D4
    description: "USER-04 / D-18 / T-05-60: two Managers deactivating each other together (20 runs, three full repeats) give exactly one 204 and one 422 users.last-active-manager and exactly one active Manager remains; a Manager-locked caller does not count; a failed-password lockout does"
    requirement: "USER-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs#TwoManagersDeactivatingEachOtherTogetherLeaveExactlyOneActiveEveryTime"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs#ACallerWhoIsNotAnActiveManagerDoesNotCountSoTheOnlyOtherManagerCannotBeRemoved"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs#AFailedPasswordLockoutStillCountsAsAnActiveManager"
        status: pass
    human_judgment: false
  - id: D5
    description: "D-19: a Manager deactivating or activating their own account answers 422 users.own-account and nothing changes"
    requirement: "USER-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs#AManagerActingOnTheirOwnAccountIsRefusedAndNothingChanges"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/ManagerGuardTests.cs#TheCallersOwnAccountIsRefusedWhetherOrNotTheChangeRemovesAManager"
        status: pass
    human_judgment: false
  - id: D6
    description: "T-05-62: an Admin gets 403, an anonymous caller 401, an unknown person 404 users.not-found, on both routes and in the authorization matrix"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UserLifecycleTests.cs#AnAdminIsRefusedWith403AnAnonymousCallerWith401AndAnUnknownPersonWith404"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (matrix rows POST /api/v1/users/{id}/deactivate and /activate)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The roster lock is taken before the target is read, and the handlers' no-op, not-found, busy and eviction-after-commit paths are pinned by unit tests; audit-log.md documents the new events"
    requirement: "USER-06"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/DeactivateUserHandlerTests.cs#TheRosterLockIsTakenBeforeTheTargetIsRead"
        status: pass
    human_judgment: true
    rationale: "The audit-log.md wording is documentation the owner reads; the grep acceptance only checks the words are present."

duration: 24min
completed: 2026-10-18
---

# Phase 5 Plan 21: Deactivate, activate and the race-safe last-Manager guard Summary

**Managers deactivate and reactivate staff (`POST /api/v1/users/{id}/deactivate` and `/activate`): deactivation ends every session at once and evicts the person from the session cache, while one transaction-owned `sp_getapplock` plus `ManagerGuard` keeps at least one active Manager standing even when two Managers deactivate each other in the same instant.**

## Performance

- **Duration:** about 24 min
- **Started:** 2026-10-18T04:49:00-05:00
- **Completed:** 2026-10-18T05:13:00-05:00
- **Tasks:** 3
- **Files modified:** 26 (11 created)

## Accomplishments

- Deactivate and activate routes (Manager only, 204): the handler switches the account through `IUserAccounts.SetActiveAsync` (rotating EditVersion so SEC-08 stamps the Manager and an open form goes stale), revokes every session with `AccountChanged`, records `user.deactivated` or `user.activated` plus `auth.sessions-revoked` (`account-changed`) when a session was open, and evicts the person from the session cache after the commit. The colleague's next request with the old token and their refresh both answer 401; signing in answers the generic 401.
- Repeating either action on a person already in that state is a 204 that writes, revokes, audits and evicts nothing.
- `IManagerRosterLock` (`csps-active-managers`) is the first call inside the transaction, before the target is read; `ManagerGuard` then refuses the caller's own account (`users.own-account`) and the last active Manager (`users.last-active-manager`). 20 racing pairs gave one 204 and one 422 each time, repeated three times in a row. No trigger was added; `TriggerInventoryTests` still passes.
- The guard is reusable: `CheckAsync(target, callerId, removesActiveManager, ct)` is what 05-23, 05-24 and 05-26 call.
- Contract refreshed (OpenAPI snapshot and `api.generated.ts`), two matrix rows, audit-log.md documents the events and the new revocation detail.

## Task Commits

1. **Task 1 (tracer): deactivate signs a person out at once** - `c9d6a79` (test, RED), `7958d99` (feat, GREEN)
2. **Task 2: race-safe last-Manager guard and self-action refusal** - `017e60b` (test, RED), `b2c7ab7` (feat, GREEN)
3. **Task 3: guard and handler units, audit events documented** - `0c5189a` (test, characterization)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## TDD Gate Compliance

- **Task 1 RED** (`c9d6a79`): all 4 `UserLifecycleTests` failed on the planned assertions: 404 where 204 or 403 was planned (the routes did not exist). Semantic assessment: the target tests ran and failed for the intended reason; no setup, load or compile faults. The `check tdd-red-evidence` classifier does not read dotnet MTP console output, so RED was judged by hand from the real output.
- **Task 1 GREEN** (`7958d99`): 4 of 4 lifecycle tests, 156 of 156 authorization tests, 9 of 9 OpenAPI snapshot tests and 9 of 9 audit-catalog tests pass.
- **Task 2 RED** (`017e60b`): 4 of 6 failed on the planned assertions: both racing requests answered 204 where one 204 and one 422 were planned (run 0), the Manager-locked caller removed the only other Manager (204 where 422 was planned), and own-account deactivate and activate answered 204 where 422 was planned. The other 2 passed at once (an Admin target and a failed-password lockout need no guard), committed with the red cases as characterization.
- **Task 2 GREEN** (`b2c7ab7`): 6 of 6 pass, three runs in a row (60 race rounds); `UserLifecycleTests` 4 of 4; architecture tests 217 of 217.
- **Task 3** (`0c5189a`): all 113 `Users` unit tests passed at once because Tasks 1 and 2 had already built the code, so they are committed as characterization tests and no separate GREEN commit exists. There is no REFACTOR commit.

## Tracer Gate

Tracer verified end-to-end (both `<verify>` commands passed after GREEN: `UserLifecycleTests` and the `Authorization` classes), then expansion (Task 2) proceeded.

## Verification

- `dotnet test --project tests/Csps.Server.IntegrationTests`: 879 passed. `Csps.Application.UnitTests` 659 passed, `Csps.Domain.UnitTests` 594 passed, `Csps.ArchitectureTests` 217 passed, `Csps.Infrastructure.IntegrationTests` 478 passed and 1 skipped (pre-existing), including `TriggerInventoryTests` (no trigger added).
- Coverage gate passed: Csps.Domain 100% line and 100% branch; Csps.Application 99.6% line (rule 95%).
- `npm --prefix tools/openapi-gen run check` passes. Builds had 0 warnings.
- Acceptance greps: `csps-active-managers` in `ManagerRosterLock.cs` 1; `users.last-active-manager` and `users.own-account` in `UserErrors.cs` 2; `EvictUserAsync` in `DeactivateUserHandler.cs` 1; matrix rows for `/deactivate` and `/activate` 2; audit-log.md lines naming `user.deactivated`, `user.activated` or `account-changed` 3.
- Lock-before-read order check (task 2 acceptance): `DeactivateUserHandler.cs` line 67 `LockActiveManagersAsync`, line 69 `FindByIdAsync` (first target read).
- The plan's `AccountChanged[[:space:]]*=[[:space:]]*7` grep does not hold by design: the value is 9 (see Deviations).

## Files Created/Modified

See the frontmatter `key-files`. The Application layer holds the port, guard and two handlers; the Infrastructure layer holds the lock and the two `UserAccounts` methods; the controller adds two actions.

## Decisions Made

See `key-decisions`. In short: `AccountChanged = 9`, activate takes no roster lock but keeps the own-account rule, eviction whenever the state changed, and the lock is registered beside `IAccountTokens`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug in plan] `AccountChanged` cannot be stored as 7**
- **Found during:** Task 1 (reading `SessionOutcomes.cs` before the edit)
- **Issue:** the plan (and its truth "stored value 7") says to append `AccountChanged = 7`, but `Expired = 7` and `PasswordChanged = 8` already exist, and `RevokedReason` is stored as a byte. Reusing 7 would make a deactivation read back as "Expired" and would break the plan's own rule "append, never renumber".
- **Fix:** appended `AccountChanged = 9`, the next free value. No stored value changes. The plan's acceptance grep for `= 7` therefore does not match; the intent (a new, appended, never-renumbered reason) is met.
- **Files modified:** `src/Csps.Domain/Identity/SessionOutcomes.cs`
- **Committed in:** `7958d99`

**2. [Rule 3 - Blocking] The audit catalog tests pinned the old catalog**
- **Found during:** Task 1 (GREEN)
- **Issue:** `AuditActionsTests` pins the catalog at 26 codes and `SessionsRevokedDetails` at three values; adding two codes and `account-changed` changes both.
- **Fix:** count updated to 28, details updated, plus a test that the two new codes are in the catalog.
- **Files modified:** `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs`
- **Committed in:** `7958d99`

**3. [Plan addition] Registration file, shared fixture and extra test files**
- The plan names `DependencyInjection.cs` for registering the lock; the service registrations for identity live in `IdentityRegistration.cs` (which `DependencyInjection` calls), so `IManagerRosterLock` is registered there beside `IAccountTokens`.
- Added `UserFixtures.ActionAsync` (a lifecycle POST helper the later reducing-action plans reuse), `ActivateUserHandlerTests.cs` (the plan says "Activate mirrors it") and `EvictionProbe.cs` (a hand-written session cache fake, because NSubstitute cannot configure `ValueTask` returns without tripping CA2012).
- **Committed in:** `017e60b`, `0c5189a`

---

**Total deviations:** 2 auto-fixed (1 plan bug, 1 blocking), 1 plan addition. **Impact:** none on scope; every behaviour in the plan's truths holds.

## Issues Encountered

- The USER-05 edge assumptions the planner flagged are confirmed and tested: the target's very next request after the commit answers 401 (no grace window beyond the cache eviction), and a person with no sessions is a no-op for revocation (only `user.deactivated` is written; no `auth.sessions-revoked`). The verifier can close that flag in 05-37.
- The session-cache eviction runs when the handler returns, which is before the idempotency gate commits the surrounding transaction (the same order as `SignOutOthersHandler` and `RevokeSessionHandler`). A request by the deactivated person that reaches the cache in that few-millisecond window could re-cache "active" for up to 60 seconds. Logged in `deferred-items.md` for `/gsd-secure-phase 5`.
- `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows as modified (line endings only, from an earlier plan). It was left alone as instructed.
- A stray `python` process started by a mistaken shell command was killed at once; nothing was left running.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. The two new routes and the lock are in the plan's threat model: T-05-60 (race removing the last Manager: lock before read plus the 20-run test), T-05-61 (a deactivated person's live token: revoke all plus eviction, the old-token 401 test), T-05-62 (Admin calling lifecycle actions: Manager policy and matrix rows).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`ManagerGuard` and `IManagerRosterLock` are ready for 05-23 (demote), 05-24 (lock) and 05-26 (delete): each takes the lock first inside its transaction, reads the target, calls `CheckAsync(..., removesActiveManager: true, ...)` and then acts. The routes and error codes are typed in `web/src/types/api.generated.ts` for the Users screen actions (05-22). The two guard messages are the first lines of the UI-SPEC banners; the second lines ("Make another user a Manager first, then try again.") belong to the client.

## Self-Check: PASSED

All created files exist on disk and commits c9d6a79, 7958d99, 017e60b, b2c7ab7 and 0c5189a are ancestors of HEAD.
