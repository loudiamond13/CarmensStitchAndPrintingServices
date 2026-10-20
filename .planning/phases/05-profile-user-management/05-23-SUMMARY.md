---
phase: 05-profile-user-management
plan: 23
subsystem: api
tags: [users, edit-user, edit-version, optimistic-concurrency, role-change, last-manager-guard, applock, sessions, audit, user-03, user-04, user-05, user-06, sec-07, sec-08, d-18, d-19, d-20, d-40]
created: "2026-10-18T06:27:00-05:00"
updated: "2026-10-18T06:27:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-09 UpdateNameAsync, EditResult, EditErrors.Stale, ConcurrentRequests; 05-17 GetUser read model (UserDetailResponse); 05-19 CreateUserRequestValidator.CanonicalRole; 05-21 IManagerRosterLock, ManagerGuard, UserErrors.OwnAccount and LastActiveManager, SessionRevocationReason.AccountChanged"
provides:
  - "PUT /api/v1/users/{id} (Manager policy): names and role with the edit version, answers the fresh user detail; 400, 401, 403, 404, 409 edit.stale, 422 users.own-account and users.last-active-manager"
  - "UpdateUserHandler, UpdateUserRequest(+Validator): the one user action that carries the row version (D-21)"
  - "IUserAccounts.UpdateDetailsAsync(id, UserDetailsChange, expectedVersion, ct) returning DetailsEditResult (outcome, version, really-changed fields, previous role); UpdateNameAsync delegates to it"
  - "A role change swaps the person's one role inside the version rotation, revokes every session (AccountChanged) and evicts the person after the commit"
  - "Audit user.details-changed (fields=first-name,last-name) and user.role-changed (role=admin>manager), always separate entries, field names and role values only"
  - "success criterion 6 proven for users: 20-run two-writer test, one 200 and one 409 each run, winner's values and last changer stored"
affects: [05-24 lock, 05-25 Edit User panel, 05-26 delete, 05-37 screen review, 05-40 Manager email change]

actuals:
  tokens: 22500
  tasks: 2
  commits: 4
plan_head_before: 2fbebc0b5bd5560a8d7f2912f19d464ba4de8008
plan_head_after: 5c2d59bfe5d0ffc8f278356fe0a9a945d9811021

tech-stack:
  added: []
  patterns:
    - "One port method per edit surface: UpdateDetailsAsync owns the version guard, the change detection and the role swap, and reports which fields really changed so the handler audits only those"
    - "Role swap by link rows only (RemoveRange plus Add on AspNetUserRoles) after the guarded account UPDATE, so no second ConcurrencyStamp write can lose a race"
    - "Roster lock before any read whenever the requested role is not Manager, because the EF identity map would hand back a stale role if the target were read first"

key-files:
  created:
    - src/Csps.Application/Users/UpdateUserHandler.cs
    - src/Csps.Application/Users/UpdateUserRequest.cs
    - src/Csps.Application/Users/UpdateUserRequestValidator.cs
    - tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Users/UserEditConcurrencyTests.cs
    - tests/Csps.Application.UnitTests/Users/UpdateUserHandlerTests.cs
  modified:
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - src/Csps.Server/Controllers/UsersController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md

key-decisions:
  - "The roster lock is taken whenever the requested role is not Manager (not only for a proven demotion): the person's current role cannot be read safely before the lock is held, because UserManager.FindByIdAsync caches the tracked row in the request's context and a second read inside the transaction would return that stale row. An Admin kept as Admin takes the lock needlessly but harmlessly; ManagerGuard still counts Managers only for a real demotion."
  - "The guard runs before the version check, so a stale form that would demote the last active Manager answers 422 users.last-active-manager rather than 409; either way nothing changes."
  - "The role is swapped by editing the AspNetUserRoles link rows after the guarded UPDATE, not through UserManager.AddToRole/RemoveFromRole, so no extra save of the account row can fail on a racing bookkeeping write and the stamp interceptor sees one staff edit."
  - "auth.sessions-revoked (account-changed) is written only when a session was open, the same rule as deactivate; user.role-changed is always written for a real role change."
  - "PUT is not covered by the Idempotency-Key middleware (POST only), so the session-cache eviction here runs after the handler's own transaction commits; the ordering gap logged for 05-21 does not apply to this endpoint."

patterns-established:
  - "UserDetailsChange(FirstName, LastName, Role?) is the extension point for 05-40: add an Email field and an explicit apply-mode (Confirm by link or Save at once, D-45) to the request, the change record and the port without reshaping the handler"
  - "Any PUT on the caller's own id answers 422 users.own-account before validation or any read"

requirements-completed: [USER-03, USER-04, USER-05, USER-06, SEC-07, SEC-08]

coverage:
  - id: D1
    description: "USER-03 / SEC-07: a Manager renames a colleague with the version they loaded; the answer is the fresh detail with a new version and the Manager as last changer"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs#AManagerRenamesAColleagueWithTheVersionTheyLoadedAndTheChangeIsAttributedAndAudited"
        status: pass
    human_judgment: false
  - id: D2
    description: "SEC-07 / success criterion 6: two Managers saving the same person with the same version give exactly one 200 and one 409 edit.stale every time (20 runs, Admin and Manager targets); the stored names and last changer are the winner's (SEC-08)"
    requirement: "SEC-07"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UserEditConcurrencyTests.cs#TwoManagersSavingTheSamePersonWithTheSameVersionGiveExactlyOneWinnerEveryTime"
        status: pass
    human_judgment: false
  - id: D3
    description: "USER-06 / D-40: user.details-changed names only the changed fields; an identical save writes no audit entry and keeps the version; no name or email enters an audit detail"
    requirement: "USER-06"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs#OnlyTheFieldThatChangedIsNamedAndNoNameOrEmailEntersTheAuditLog"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs#SavingTheValuesAlreadyStoredAnswers200WritesNoAuditEntryAndKeepsTheVersion"
        status: pass
    human_judgment: false
  - id: D4
    description: "USER-05: a role change signs the person out at once (next request 401), records user.role-changed (role=admin>manager) and auth.sessions-revoked (account-changed); a name-only edit does not sign them out; a name and role save writes two separate entries"
    requirement: "USER-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs#PromotingAnAdminToManagerSignsThemOutAtOnceAndRecordsTheRoleChange"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs#ASaveThatChangesTheNameAndTheRoleWritesTwoSeparateEntries"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs#ANameOnlyEditKeepsTheRoleAndDoesNotSignThePersonOut"
        status: pass
    human_judgment: false
  - id: D5
    description: "USER-04 / D-18: two Managers demoting each other together (20 runs) give one 200 and one 422 users.last-active-manager and exactly one active Manager remains; a Manager-locked caller does not count"
    requirement: "USER-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs#TwoManagersDemotingEachOtherTogetherLeaveExactlyOneActiveManagerEveryTime"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs#DemotingTheOnlyOtherActiveManagerIsRefusedWhenTheCallerIsManagerLocked"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/UpdateUserHandlerTests.cs#TheRosterLockIsTakenBeforeTheTargetIsReadWhenTheRoleIsNotManager"
        status: pass
    human_judgment: false
  - id: D6
    description: "D-19 and the edge cases: own id answers 422 users.own-account; blank names, a bad role or a missing version answer 400 with the shared messages; unknown or deleted id is 404; a failed password between GET and PUT causes no false 409; a stale resend is 409; an Admin gets 403"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs#ABadFormAnswers400WithTheFieldMessageAndChangesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs#AFailedPasswordBetweenOpeningTheFormAndSavingDoesNotCauseAFalse409"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#PUT /api/v1/users/{id:guid}"
        status: pass
    human_judgment: false

duration: 30min
completed: 2026-10-18
---

# Phase 5 Plan 23: Edit User (name and role) Summary

**PUT /api/v1/users/{id} lets a Manager edit a colleague's name and role under the edit version (409 edit.stale on a stale one, 20-run two-writer proof), with the last-Manager guard under the roster lock and immediate sign-out on a role change.**

## Performance

- **Duration:** about 30 min
- **Started:** 2026-10-18T05:58:00-05:00 (approximate, not captured at launch)
- **Completed:** 2026-10-18T06:27:00-05:00
- **Tasks:** 2
- **Files modified:** 17 (6 created, 11 modified)

## Accomplishments

- A Manager edits another person's first name, last name and role with the version they loaded; a stale version is 409 `edit.stale` with the shared text, and the winner of two racing saves is the only one stored and the only last changer (success criterion 6, SEC-07, SEC-08).
- Any PUT on the caller's own id answers 422 `users.own-account` before validation or any read (D-19, T-05-66).
- Demoting a Manager takes the roster lock first, then `ManagerGuard` refuses the last active Manager with 422 `users.last-active-manager`; two Managers demoting each other together leave exactly one active Manager in 20 of 20 runs (D-18, T-05-60).
- A role change ends every session of the person at once (`AccountChanged`), evicts them from the session cache after the commit and writes `user.role-changed` with `role=admin>manager` plus `auth.sessions-revoked`; names are their own `user.details-changed` entry, never merged (D-40, USER-06).
- A save of the values already stored is a 200 that writes, revokes and evicts nothing and keeps the version.

## Task Commits

1. **Task 1 (tracer): Manager renames a colleague, second writer gets 409**
   - RED `5ab89b0` test(05-23): a Manager edits a user with the edit version (RED)
   - GREEN `3c368fa` feat(05-23): edit a user with the edit version; two writers never both win (USER-03, SEC-07)
2. **Task 2: role change signs out, demotion respects the last Manager**
   - RED `34ad5a5` test(05-23): role changes revoke sessions and respect the last Manager (RED)
   - GREEN `5c2d59b` feat(05-23): role change signs the person out; demotion respects the last Manager (USER-04, USER-05)

**Plan metadata:** the docs commit that carries this summary, STATE.md, ROADMAP.md and REQUIREMENTS.md follows (not counted in `actuals.commits`).

## TDD Gate Compliance

Both tasks have a `test(05-23)` commit before the `feat(05-23)` commit. No REFACTOR commit was needed.

- **RED 1 evidence:** `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*UpdateUserEndpointTests" --filter-class "*UserEditConcurrencyTests"`, exit 2, 15 failed. Semantic assessment: every target test executed and failed on its planned assertion (the PUT route did not exist, so the status assertions such as `response.StatusCode should be OK but was MethodNotAllowed` and `statuses.Count(OK) should be 1` failed); no build, fixture or discovery fault. The xunit MTP report is not one of the formats `gsd check tdd-red-evidence` parses, so the classifier was not used and the assessment above stands as the record.
- **RED 2 evidence:** same command for `*UpdateUserEndpointTests`, exit 2, 5 failed and 16 passed. The five failures were assertion failures on the planned behavior (role stayed Admin, last-Manager guard answered 200, both demotions returned 200, no `user.role-changed` entry). The 16 passing tests were Task 1 tests plus the regression guards for behavior that already held (letter-case role, name-only edit keeps the session).
- **Order note:** `UpdateUserHandlerTests` and the `AuditActionsTests` additions were written with the GREEN code, not before it. They reference the new constructor and constants, so a RED commit of them would only have been a build failure (INVALID_RED); the behavior they cover was already red-tested end to end by the integration cases.

## Tracer Gate

Task 1 was a tracer with an automated-only `<verify>` and `human_verify_mode` end-of-phase. After the GREEN commit both verify commands were re-run: `UpdateUserEndpointTests` and `UserEditConcurrencyTests` 15 of 15 passed. Tracer verified end-to-end, expanded to Task 2.

## Verification

- `dotnet test --project tests/Csps.Server.IntegrationTests` (CSPS_TEST_SQL=localdb): 905 passed, 0 failed.
- `dotnet test --project tests/Csps.Application.UnitTests`: 683 passed; `Invoke-CoverageGate.ps1`: Csps.Domain 100% line and 100% branch, Csps.Application 99.6% line (rule 95%), gate passed.
- `Csps.Domain.UnitTests` 596, `Csps.ArchitectureTests` 217, `Csps.Infrastructure.IntegrationTests` 478 passed. No build, analyzer or test warnings.
- `npm --prefix tools/openapi-gen run check` passes; `npm --prefix web run typecheck` is clean.
- Acceptance greps: `HttpPut` in UsersController = 1, `SendTogetherAsync` in the concurrency test = 1, `user.details-changed` = 1 and `user.role-changed` = 1 in AuditActions, `LockActiveManagersAsync` in the handler = 1.
- Preflight run before the full runs: ports 5180, 5115, 7028 and 5199 free, no other project's test processes.

## Files Created/Modified

- `src/Csps.Application/Users/UpdateUserHandler.cs` - the use case: own-account refusal, validation, lock, guard, versioned save, audit, revoke, evict
- `src/Csps.Application/Users/UpdateUserRequest.cs`, `UpdateUserRequestValidator.cs` - the form and its OR-3 mirror (shared name, version and role messages)
- `src/Csps.Application/Ports/IUserAccounts.cs` - `UpdateDetailsAsync`, `UserDetailsChange`, `DetailsEditResult`, `EditedFields`
- `src/Csps.Infrastructure/Identity/UserAccounts.cs` - the guarded details update and the role swap; `UpdateNameAsync` delegates
- `src/Csps.Domain/Auditing/AuditActions.cs` - `UserDetailsChanged`, `UserRoleChanged` in `All`
- `src/Csps.Server/Controllers/UsersController.cs`, `Composition/ApplicationRegistration.cs`, `Composition/AuthRegistration.cs` - the PUT action and its registrations
- `tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs`, `UserEditConcurrencyTests.cs`, `tests/Csps.Application.UnitTests/Users/UpdateUserHandlerTests.cs`, `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs`, `Authorization/AuthorizationMatrix.cs` - the proofs and the matrix row
- `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` - refreshed contract
- `docs/operations/audit-log.md` - the two new codes and the extra `account-changed` cause

## Decisions Made

See `key-decisions` above. In short: lock whenever the requested role is not Manager, guard before the version check, role swap through the link rows, `auth.sessions-revoked` only when a session was open.

## Deviations from Plan

### Auto-fixed Issues

**1. [Interpretation] Lock condition: "requested role is not Manager" instead of "current role is Manager"**
- **Found during:** Task 2 design
- **Issue:** The plan says to take the lock when the requested role differs and the current role is Manager. The current role cannot be read before the lock without caching the tracked account row in the request's context (identity map), so a read inside the lock would return that stale row and a concurrent promotion or demotion could be missed.
- **Fix:** Take the lock first whenever the requested role is not Manager (the only requests that can remove a Manager), then read and let `ManagerGuard` count Managers only for a real demotion. Behavior the plan lists is unchanged: Manager-to-Manager edits take no lock, and the two-writer demotion race is serialized.
- **Files modified:** src/Csps.Application/Users/UpdateUserHandler.cs
- **Verification:** `TheRosterLockIsTakenBeforeTheTargetIsReadWhenTheRoleIsNotManager`, `NoLockIsTakenWhenTheRoleStaysOrBecomesManager`, and the 20-run demotion race
- **Committed in:** 5c2d59b

**2. [Tracer scope] The role field is validated but not applied in Task 1**
- **Found during:** Task 1
- **Issue:** The plan has the validator require a role in Task 1 and the role change arrive in Task 2. In the tracer commit `UserDetailsChange` had no role, so a differing role was ignored for the span of that one commit.
- **Fix:** Task 2 added `Role` to `UserDetailsChange` and applied it. No commit between the two is a release point.
- **Committed in:** 3c368fa (validated), 5c2d59b (applied)

**3. [Process] Unit tests written with GREEN**
- **Found during:** Task 2 (see TDD Gate Compliance for the reason)
- **Committed in:** 5c2d59b

---

**Total deviations:** 3 (1 design interpretation, 2 sequencing notes). **Impact on plan:** none on behavior or scope; all listed truths hold.

## Issues Encountered

- A stray Python-less environment meant the multi-line source edits were done with small Node scripts; no effect on the code.
- `ResetPasswordPage.test.tsx` still shows a line-ending-only difference from an earlier plan; left alone as instructed.

## Authentication Gates

None.

## Known Stubs

None. No placeholder values, empty data sources or TODO text in the files this plan touched.

## Threat Flags

None. The one new endpoint (`PUT /api/v1/users/{id}`) is the surface the plan's threat model covers (T-05-65, T-05-66, T-05-67); each `mitigate` entry has a passing test.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-25 (Edit User panel) can save through `PUT /api/v1/users/{id}` with `{ firstName, lastName, role, version }`; the generated types are in place.
- 05-40 (Manager email change, D-45) extends `UpdateUserRequest`, `UserDetailsChange` and `UpdateDetailsAsync` with an email field and an explicit apply-mode (Confirm by link or Save at once). Nothing email-related was implemented here.
- 05-24 (lock) and 05-26 (delete) reuse `ManagerGuard` and the roster lock exactly as this plan does.

## Self-Check: PASSED

- Created files exist: UpdateUserHandler.cs, UpdateUserRequest.cs, UpdateUserRequestValidator.cs, UpdateUserEndpointTests.cs, UserEditConcurrencyTests.cs, UpdateUserHandlerTests.cs.
- Commits `5ab89b0`, `3c368fa`, `34ad5a5` and `5c2d59b` are on `gsd/phase-05-profile-user-management`.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
