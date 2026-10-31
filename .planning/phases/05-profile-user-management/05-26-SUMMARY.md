---
phase: 05-profile-user-management
plan: 26
subsystem: api
tags: [users, soft-delete, manager-guard, roster-lock, outbox, in-08, audit, openapi, user-03, user-04, user-05, user-06, d-07, d-08, d-09, d-10, d-11, d-18, d-19, d-21, d-40]
created: "2026-10-18T08:25:00-05:00"
updated: "2026-10-18T08:25:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-21/05-24 lifecycle handler shape (roster lock, ManagerGuard, AccountChanged revocation, eviction after commit); 05-10 IsBlocked on every auth path; 05-17 actor fixtures and RecordedBy/LastChangedBy with formerStaff; 05-07 outbox retention rule and email outbox"
provides:
  - "DELETE /api/v1/users/{id} (Manager policy, no version, 204; 401, 403, 404, 409, 422): final soft delete"
  - "IUserAccounts.SoftDeleteAsync(id, now, ct): scrambles Email and UserName (normalized upper-case), clears PendingEmail, sets DeletedAtUtc, rotates EditVersion and SecurityStamp; false when already deleted"
  - "DeletedAddress.For(id): deleted-{id:N}@deleted.invalid, unique per id, in the reserved .invalid domain"
  - "DeleteUserHandler: roster lock first, ManagerGuard, soft delete, revoke every session (AccountChanged) and every open Invitation, PasswordReset and EmailChange link, scrub the outbox, audit user.deleted, evict after commit"
  - "OutboxEmailSender refuses any recipient in .invalid (message never echoes the address); IEmailOutbox.ScrubRecipientAsync and EmailOutboxMessage.IsClosed/Readdress"
  - "AuditActions.UserDeleted (user.deleted), in All; contract snapshot and TS types for DeleteUser; audit-log.md row; SEC-06 wording note"
affects: [05-30 Account access section (Delete User action), 05-37 screen review, 05 security review, Phase 9 JOB-01 purge]

actuals:
  tokens: 23000
  tasks: 3
  commits: 6
plan_head_before: c1fd6d8125afc789149841b2e140c276521075ca
plan_head_after: d1a4aa31a9f59eb43ba88639a4bd831e6b39fb5a

tech-stack:
  added: []
  patterns:
    - "A delete keeps the row and the names (D-08) and frees the address by scrambling it per id; the address is in the reserved .invalid domain, so the outbox guard is defense in depth"
    - "Outbox hygiene on delete: rows for the old address (and any waiting email-change address) are expired if unsent, readdressed to the scrambled address and left without bodies, on the same unit of work as the delete"

key-files:
  created:
    - src/Csps.Application/Users/DeleteUserHandler.cs
    - src/Csps.Application/Users/DeletedAddress.cs
    - tests/Csps.Server.IntegrationTests/Users/DeleteUserTests.cs
    - tests/Csps.Application.UnitTests/Users/DeleteUserHandlerTests.cs
  modified:
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Application/Ports/IEmailOutbox.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Infrastructure/Email/OutboxEmailSender.cs
    - src/Csps.Infrastructure/Email/EmailOutboxMessage.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Server/Controllers/UsersController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs
    - tests/Csps.Server.IntegrationTests/Users/UserFixtures.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailOutboxTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Application.UnitTests/Auth/AuthTestDoubles.cs
    - tests/Csps.Application.UnitTests/Auth/SignInHandlerTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md
    - .planning/REQUIREMENTS.md

key-decisions:
  - "The scrambled address is built in Application (DeletedAddress.For) and used by both the handler (outbox replacement) and the Identity adapter, so the two can never disagree"
  - "SoftDeleteAsync returns a bool like SetActiveAsync and SetManagerLockAsync: true when it deleted, false when the account was already deleted and nothing was written; the handler answers 404 for both a missing and a deleted person, so a second DELETE changes and records nothing"
  - "Delete also scrubs the address of a waiting email change (read through IUserDirectory.GetProfileAsync before the delete clears it), not only the sign-in address"
  - "The outbox guard checks the domain after the last @, ignoring a trailing dot and case: 'invalid' alone or any '*.invalid' is refused; 'notinvalid.example.com' is still queued"

patterns-established:
  - "Roster-changing handlers that remove an active Manager (deactivate, lock, delete) share one shape: roster lock, read, NotFound for missing or deleted, ManagerGuard with removesActiveManager, change, revoke, audit, evict after commit"
  - "Race tests run 20 times for the mutual case, resetting the database each run (now deactivate, lock and delete)"

requirements-completed: [USER-03, USER-04, USER-05, USER-06]

coverage:
  - id: D1
    description: "A Manager deletes a colleague: 204, the next request with the old token is 401, refresh and sign-in with the old address fail, a reset link issued before the delete reads as invalid, the roster no longer lists them and their detail answers 404 users.not-found"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/DeleteUserTests.cs#ADeletedColleagueIsSignedOutCannotSignInOrUseALinkAndTheirNameStaysOnWhatTheyRecorded"
        status: pass
    human_judgment: false
  - id: D2
    description: "The name stays: records the deleted person created or last changed still show their name with formerStaff true; the row keeps first and last name, the address is deleted-{id:N}@deleted.invalid with upper-case normalized forms, PendingEmail cleared, DeletedAtUtc set, EditVersion and security stamp rotated"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/DeleteUserTests.cs#ADeletedColleagueIsSignedOutCannotSignInOrUseALinkAndTheirNameStaysOnWhatTheyRecorded"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/DeleteUserHandlerTests.cs#TheScrambledAddressIsUniquePerIdAndInTheReservedDomain"
        status: pass
    human_judgment: false
  - id: D3
    description: "A second DELETE answers 404 users.not-found 'This user was deleted.' and changes nothing (one audit entry, same version and deletion time); an unknown id is the same 404; the freed address can be invited again and makes a separate new account; there is no restore or undelete route and a deleted person cannot be reactivated"
    requirement: "USER-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/DeleteUserTests.cs#ASecondDeleteOfTheSamePersonAnswers404AndRecordsNothingNew"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/DeleteUserTests.cs#TheFreedAddressCanBeInvitedAgainAndMakesASeparateNewAccount"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/DeleteUserTests.cs#ThereIsNoWayToBringADeletedPersonBack"
        status: pass
    human_judgment: false
  - id: D4
    description: "Deleting respects the last active Manager and never one's own account, including two Managers deleting each other at once (20 runs: one 204, one 422 users.last-active-manager, one active Manager left); the roster lock is taken before the target is read"
    requirement: "USER-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs#TwoManagersDeletingEachOtherTogetherLeaveExactlyOneActiveEveryTime"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs#AManagerDeletingTheirOwnAccountIsRefusedAndNothingChanges"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/DeleteUserHandlerTests.cs#TheRosterLockIsTakenBeforeTheTargetIsRead"
        status: pass
    human_judgment: false
  - id: D5
    description: "user.deleted targets the User id with no detail and the Manager as actor; Admin 403, anonymous 401; the authorization matrix has the DELETE row; the contract snapshot and TS types match"
    requirement: "USER-06"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/DeleteUserTests.cs#DeletingIsAuditedAgainstTheUserWithNoDetailByTheManager"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/DeleteUserTests.cs#AnAdminIsRefusedWith403AnAnonymousCallerWith401AndNothingIsDeleted"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false
  - id: D6
    description: "Outbox hygiene (IN-08 part): mail to a .invalid recipient is refused without echoing the address; a delete expires mail still waiting for the old address (never sent) and leaves no outbox row with the old address"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailOutboxTests.cs#MailToAReservedInvalidDomainIsRefusedWithoutEchoingTheAddressAndQueuesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailOutboxTests.cs#ScrubbingARecipientReaddressesClosedRowsAndExpiresWaitingOnesWithoutSendingThem"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/DeleteUserTests.cs#AMailWaitingForTheDeletedPersonIsNeverSentAndNoOutboxRowKeepsTheOldAddress"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-10-18
---

# Phase 5 Plan 26: Delete User Summary

**Final soft delete for staff: DELETE /api/v1/users/{id} scrambles the address per id, ends every session and link, keeps the name on everything the person recorded, respects the last-Manager guard under the roster lock, and scrubs the outbox so a deleted address is never mailed or kept.**

## Performance

- **Duration:** about 45 min
- **Started:** 2026-10-18T07:52:00-05:00
- **Completed:** 2026-10-18T08:25:00-05:00
- **Tasks:** 3
- **Files modified:** 23 (4 created, 19 modified)

## Accomplishments

- A Manager can delete a person for good (D-07): the row and names stay (D-08, so Recorded by and Last changed by still show the name with formerStaff true), the address becomes `deleted-{id:N}@deleted.invalid` (D-10, the real address can be invited again as a new account), every session and every open invitation, reset and email-change link is revoked in the same transaction, and the person disappears from the roster and answers 404 (D-09, no restore path).
- The last-Manager guard covers delete: the roster lock is taken first, then ManagerGuard; own account and last active Manager answer 422, and two Managers deleting each other 20 times always leave exactly one.
- The outbox never mails a `.invalid` recipient and forgets the old address on delete (rows expired if unsent, readdressed, no bodies), closing the delete part of the IN-08 note. SEC-06's wording now names the two version-free DELETE routes, and `user.deleted` is documented in `docs/operations/audit-log.md`.

## Task Commits

1. **Task 1: Tracer, delete and the name stays (D-07, D-08, D-09, D-11)** - `df9170b` (test, RED), `f40e3fa` (feat, GREEN)
2. **Task 2: Last active Manager and own account (USER-04, D-18, D-19)** - `53c39b9` (test, RED), `24f8ba6` (feat, GREEN)
3. **Task 3: Outbox guard and scrub, SEC-06 wording (IN-08 part, D-41 Q4)** - `7e44bcf` (test, RED), `d1a4aa3` (feat, GREEN)

**Plan metadata:** recorded in the docs commit that follows this file (`docs(05-26): complete delete user plan`).

## TDD Gate Compliance

All three tasks have a `test(05-26)` RED commit before the `feat(05-26)` GREEN commit. No REFACTOR commits were needed.

- **RED 1 (`df9170b`):** `DeleteUserTests`, 8 tests ran and all 8 failed on assertions for the planned behavior (DELETE answered 404 instead of 204; the unknown-person and audit tests failed on the missing problem code and missing audit row). `semanticAssessment`: the target tests executed and failed for the intended reason; no compile, setup or discovery fault. The xUnit MTP report is not a format `gsd check tdd-red-evidence` supports, so the semantic inspection above is the evidence.
- **RED 2 (`53c39b9`):** `LastManagerGuardTests`, 3 of 15 failed on assertions (expected 422, got 204 for own-account, last-Manager and the 20-run mutual delete). The 12 other tests were the existing deactivate/lock cases plus one new delete case that is already correct after Task 1. `semanticAssessment`: intended failures only.
- **RED 3 (`7e44bcf`):** the 4 `.invalid` guard theory cases and the delete-level outbox test failed on assertions (mail queued, old address kept). The `notinvalid.example.com` control case passed on purpose. `semanticAssessment`: intended failures only.
- Tests that call a member that does not exist before GREEN (`ScrubRecipientAsync` directly, `Readdress`, the handler's roster-lock and guard unit tests that need the final constructor) cannot compile in a RED commit without making the whole run INVALID_RED. They were written in the GREEN commit of the same task. The integration tests that exercise the same behavior through the endpoint were RED first.

## Files Created/Modified

- `src/Csps.Application/Users/DeleteUserHandler.cs` - the use case (lock, read, guard, soft delete, revoke sessions and links, outbox scrub, audit, evict after commit)
- `src/Csps.Application/Users/DeletedAddress.cs` - the scrambled address format and reserved domain
- `src/Csps.Infrastructure/Identity/UserAccounts.cs` and `src/Csps.Application/Ports/IUserAccounts.cs` - `SoftDeleteAsync`
- `src/Csps.Infrastructure/Email/OutboxEmailSender.cs`, `EmailOutboxMessage.cs` and `src/Csps.Application/Ports/IEmailOutbox.cs` - the `.invalid` guard, `ScrubRecipientAsync`, `IsClosed`, `Readdress`
- `src/Csps.Domain/Auditing/AuditActions.cs`, `src/Csps.Server/Controllers/UsersController.cs`, `src/Csps.Server/Composition/ApplicationRegistration.cs` - `user.deleted`, the DELETE action, DI
- `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` - regenerated contract (DeleteUser)
- `docs/operations/audit-log.md`, `.planning/REQUIREMENTS.md` - `user.deleted` row, SEC-06 wording
- Tests: `DeleteUserTests`, `DeleteUserHandlerTests`, `LastManagerGuardTests`, `EmailOutboxTests`, `UserFixtures.DeleteAsync`, the matrix row, `AuditActionsTests` (34 to 35 codes)

## Decisions Made

See `key-decisions` above. In short: one shared `DeletedAddress`, a bool-returning `SoftDeleteAsync` like its siblings, scrubbing of the waiting email-change address too, and an outbox guard on the domain after the last `@`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] A waiting email-change address is scrubbed as well**
- **Found during:** Task 3 (outbox scrub)
- **Issue:** The plan scrubs the person's outbox rows by their sign-in address only. A person with an email change waiting has mail (the confirmation link) addressed to the pending address, which would keep that address in the outbox until the Phase 9 purge.
- **Fix:** `DeleteUserHandler` reads `PendingEmail` through `IUserDirectory.GetProfileAsync` before the delete clears it and scrubs that address too.
- **Files modified:** `src/Csps.Application/Users/DeleteUserHandler.cs`, `tests/Csps.Application.UnitTests/Users/DeleteUserHandlerTests.cs`
- **Verification:** `AnAddressWaitingForAnEmailChangeConfirmationIsScrubbedToo`
- **Committed in:** `d1a4aa3`

**2. [Rule 3 - Blocking] Two test doubles needed the new port member**
- **Found during:** Task 3
- **Issue:** `RecordingOutbox` (in `AuthTestDoubles.cs` and a private copy in `SignInHandlerTests.cs`) implement `IEmailOutbox`, so adding `ScrubRecipientAsync` broke the Application unit test build.
- **Fix:** each got a no-op `ScrubRecipientAsync`.
- **Files modified:** `tests/Csps.Application.UnitTests/Auth/AuthTestDoubles.cs`, `tests/Csps.Application.UnitTests/Auth/SignInHandlerTests.cs`
- **Committed in:** `d1a4aa3`

**3. [Rule 3 - Blocking] Catalog count test and a shared helper**
- **Found during:** Task 1
- **Issue:** `AuditActionsTests` pins the catalog size (34), and the scrambled address is needed by both Application and Infrastructure.
- **Fix:** the count is 35, and `DeletedAddress` (a small static class, not listed in the plan's files) holds the format.
- **Files modified:** `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs`, `src/Csps.Application/Users/DeletedAddress.cs`
- **Committed in:** `f40e3fa`

**4. Plan-ordering note (no rule):** the controller documentation and the 422 response in the contract were written in Task 1's commit, one task before the guard arrived in Task 2, so the snapshot was refreshed once. The behavior between those two commits briefly lacked the guard (the 422 cases are the RED of Task 2).

---

**Total deviations:** 3 auto-fixed (1 missing critical, 2 blocking), 1 ordering note
**Impact on plan:** All necessary for correctness or to compile. No scope creep and no new packages.

## Issues Encountered

- A stray `python` call in one shell command started the Windows Store stub and blocked that command until I ended that one process (my own). It had no effect on the repository.
- `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows a line-ending-only difference from an earlier plan; it was left alone as instructed.

## Verification

- `DeleteUserTests` 8/8, `LastManagerGuardTests` 15/15, `EmailOutboxTests` 15/15, `DeleteUserHandlerTests` 16/16, `AuditActionsTests` pass.
- Full runs: Csps.Server.IntegrationTests 969/969, Csps.Infrastructure.IntegrationTests 0 failed, 495 succeeded of 496 reported, Csps.Application.UnitTests 753/753, Csps.Domain.UnitTests 598/598.
- Coverage gate: Csps.Domain 100% line and branch; Csps.Application 99.6% line (rule 95%).
- `npm --prefix tools/openapi-gen run check` passes; `OpenApiSnapshotTests` pass.
- Staged-diff gitleaks scan was clean for every commit.

## Known Stubs

None.

## Threat Flags

None. The new DELETE endpoint and the outbox changes are the surface in the plan's threat model (T-05-73 to T-05-76); each is mitigated and tested.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-30 (Account access section) can call `DELETE /api/v1/users/{id}` and show the documented 422 messages (`users.own-account`, `users.last-active-manager`); the TS types already contain `DeleteUser`.
- The Phase 9 purge (JOB-01) still owns deleting closed outbox rows after 30 days; deleted people's rows are already scrubbed.
- Open for the Phase 5 security review (already listed in `deferred-items.md`): the session-cache eviction window before the idempotency transaction commits does not apply here (DELETE is not behind the idempotency gate, and eviction runs after the unit of work commits).

## Self-Check: PASSED

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
