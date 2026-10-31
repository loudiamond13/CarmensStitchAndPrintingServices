---
phase: 05-profile-user-management
plan: 27
subsystem: api
tags: [users, account-access, invitation, reset-link, temporary-password, email-cap, outbox, audit, openapi, user-07, user-02, user-05, user-06, c-4, d-13, d-14, d-21, d-24, d-40, d-41]
created: "2026-10-18T09:20:00-05:00"
updated: "2026-10-18T09:20:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-19 invitation path and the basic temporary-password rule; 05-21/05-26 UserErrors.OwnAccount, UserAccount.IsBlocked/HasPassword, eviction after commit; 05-40 AuditActions.UserInvitationResent and the amended Invite email with InvitedBy; 04 forgot-password cap, ManagerResetEmail and the must-change flow"
provides:
  - "POST /api/v1/users/{id}/resend-invitation (Manager policy, 204): revokes the open invitation and emails a fresh 7-day link naming the Manager; 422 users.already-set-up / users.blocked, 404 unknown or deleted"
  - "POST /api/v1/users/{id}/send-reset-link (204): emails a 30-minute single-use reset link that names the Manager, replacing any open one; shared hourly cap with forgot-password (429 users.reset-link-capped); 422 users.blocked / users.no-password"
  - "POST /api/v1/users/{id}/temporary-password { temporaryPassword } (204): basic rule only, ends every session, clears the failed-password lockout, marks must-change (Temporary), queues the 'reset by a Manager' notice; 422 users.own-account / users.blocked, 400 on temporaryPassword"
  - "ResendInvitationHandler, SendResetLinkHandler, SetTemporaryPasswordHandler, SetTemporaryPasswordRequest(+Validator), ManagerResetLinkEmail (AuthEmailKind.ManagerResetLink = 11), ResetEmailCap (internal), TemporaryPasswordRule.MustMeetBasicRule (shared with Add User)"
  - "IUserAccounts.MarkStaffEditAsync: moves the edit version so SEC-08 stamps the Manager and an open edit form goes stale"
  - "AuditActions.UserResetLinkSent (user.reset-link-sent), UserTemporaryPasswordSet (user.temporary-password-set), SessionsRevokedDetails gains temporary-password; user.invitation-resent reused from 05-40"
affects: [05-30 Account access section, 05-31 email previews (ManagerResetLinkEmail), 05-37 screen review, 05 security review]

actuals:
  tokens: 70000
  tasks: 3
  commits: 6
plan_head_before: 89778b8e8eea0a8799730019435572475e92122d
plan_head_after: 54e09ff5a81d0f2e7bb9ac52015e760945d7211e

tech-stack:
  added: []
  patterns:
    - "Account-access handlers share one shape: caller and Manager profile first, then one transaction under the per-account link lock: NotFound for missing or deleted, Blocked, the rule for that action, change, queue the mail, audit with no detail, save"
    - "One hourly cap of reset-link emails per address, counted over both stored kinds (PasswordReset and ManagerResetLink) by ResetEmailCap, and used by forgot-password and the Manager's send alike"
    - "The temporary password rule lives in one FluentValidation extension (MustMeetBasicRule) used by Add User and Set Temporary Password"

key-files:
  created:
    - src/Csps.Application/Users/ResendInvitationHandler.cs
    - src/Csps.Application/Users/SendResetLinkHandler.cs
    - src/Csps.Application/Users/SetTemporaryPasswordHandler.cs
    - src/Csps.Application/Users/SetTemporaryPasswordRequest.cs
    - src/Csps.Application/Users/SetTemporaryPasswordRequestValidator.cs
    - src/Csps.Application/Auth/ResetEmailCap.cs
    - tests/Csps.Server.IntegrationTests/Users/ResendInvitationTests.cs
    - tests/Csps.Server.IntegrationTests/Users/ManagerResetLinkTests.cs
    - tests/Csps.Server.IntegrationTests/Users/TemporaryPasswordTests.cs
    - tests/Csps.Application.UnitTests/Users/AccountAccessHandlerTests.cs
  modified:
    - src/Csps.Application/Users/UserErrors.cs
    - src/Csps.Application/Users/CreateUserRequestValidator.cs
    - src/Csps.Application/Auth/ForgotPasswordHandler.cs
    - src/Csps.Application/Email/AuthEmail.cs
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Infrastructure/Email/EmailRenderer.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Server/Controllers/UsersController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
    - tests/Csps.Application.UnitTests/Email/AuthEmailTests.cs
    - tests/Csps.Application.UnitTests/Auth/ForgotPasswordHandlerTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md

key-decisions:
  - "ManagerResetLinkEmail is (To, Token, ExpiresAt, RequestedAt, ManagerName), like PasswordResetEmail and InviteEmail: the renderer words the lifetime from RequestedAt and ExpiresAt, so '30 minutes' is never hard-coded. The plan listed four parameters; 05-31's preview tool must pass five."
  - "The reset-email cap is shared in both directions: forgot-password also counts the Manager's sends (ResetEmailCap). It counts PasswordReset first and stops when that alone reaches the cap, so the existing single-count behavior of forgot-password is unchanged."
  - "A temporary password is a staff edit: IUserAccounts.MarkStaffEditAsync rotates EditVersion (Identity bookkeeping never does, by design of RecordStampInterceptor), so SEC-08 records the Manager and an open form reads stale. Resend and send-link do not change the account, so they leave the version alone."
  - "A person invited but not yet set up can be given a temporary password (the Edit panel shows the button for them): their address counts as confirmed, as when an account is added with a temporary password, and the open invitation is revoked."
  - "Resend, send-link and temporary-password all check Blocked before the action's own rule (already set up, no password), so a locked or deactivated person always gets the same 'Unlock or activate this person first.'"

patterns-established:
  - "A 204 with no body is what the idempotency record stores for secret-carrying actions; only the request hash of the body is kept (T-05-80)"

requirements-completed: [USER-07, USER-02, USER-05, USER-06]

coverage:
  - id: D1
    description: "A Manager resends an invitation: the old link answers 404, the new 7-day link names the Manager and works (and accepts a password), the account version stays, user.invitation-resent is recorded by the Manager with no detail and the answer is empty"
    requirement: "USER-07"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ResendInvitationTests.cs#AResentInvitationKillsTheOldLinkAndTheNewOneNamesTheManagerWorksForSevenDaysAndLeavesTheAccountAlone"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ResendInvitationTests.cs#AnExpiredInvitationIsReplacedByAWorkingOne"
        status: pass
    human_judgment: false
  - id: D2
    description: "Resend is refused with 422 users.already-set-up for a person with a password and users.blocked for a deactivated or locked person, 404 for unknown or deleted, 403 for an Admin, 401 anonymous; nothing is emailed or audited; a repeated request key sends one invitation"
    requirement: "USER-07"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ResendInvitationTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/AccountAccessHandlerTests.cs#ResendForABlockedPersonIsRefusedAndBlockedWinsOverAlreadySetUp"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Manager-sent reset link is a 30-minute single-use fragment link that names the Manager, replaces the earlier link, ends the person's sessions when used, is never shown to the Manager (204, empty body) and is recorded as user.reset-link-sent with no detail"
    requirement: "USER-07"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerResetLinkTests.cs#ASentLinkNamesTheManagerWorksOnceForThirtyMinutesEndsTheSessionsAndIsNeverShownToTheManager"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerResetLinkTests.cs#ASecondSendReplacesTheFirstLink"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs#AManagerResetLinkNamesTheManagerAndLinksToResetPasswordWithTheTokenInTheFragment"
        status: pass
    human_judgment: false
  - id: D4
    description: "Forgot-password and a Manager's send share one cap of 3 reset emails per address per hour in both directions: the fourth Manager send is 429 users.reset-link-capped and a forgot-password after three Manager sends sends nothing and audits capped; locked or deactivated people get 422 users.blocked, people with no password 422 users.no-password"
    requirement: "USER-07"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerResetLinkTests.cs#ManagerSendsCountTowardTheSameHourlyCapAsForgotPasswordAndTheFourthIs429"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerResetLinkTests.cs#ThreeManagerSendsUseUpTheHourSoForgotPasswordSendsNothingMore"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/AccountAccessHandlerTests.cs#ResetEmailsOfBothKindsInTheLastHourShareOneCapOfThree"
        status: pass
    human_judgment: false
  - id: D5
    description: "A Manager sets a temporary password: 204 with no body, both devices signed out on the next request, the failed-password lockout cleared, the 'reset by a Manager' notice emailed without the password, the next sign-in goes through the emailed code then must-change, the account version moves and the Manager is the last to change it"
    requirement: "USER-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/TemporaryPasswordTests.cs#ATemporaryPasswordSignsThePersonOutEverywhereClearsTheLockoutNotifiesThemAndForcesANewPasswordAtNextSignIn"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/AccountAccessHandlerTests.cs#ATemporaryPasswordIsSavedClearsTheLockoutEndsEverySessionNotifiesAndIsAuditedWithFixedWords"
        status: pass
    human_judgment: false
  - id: D6
    description: "Only the basic rule applies (400 on temporaryPassword with one message per broken rule, 64 characters allowed, 65 refused, a well-known password passes); the caller's own id is 422 users.own-account, a blocked person 422 users.blocked, unknown or deleted 404; the password is absent from responses, mail, audit details and the idempotency record"
    requirement: "USER-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/TemporaryPasswordTests.cs"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/AccountAccessHandlerTests.cs#TheValidatorGivesOneMessageForTheFirstRuleBroken"
        status: pass
    human_judgment: false
  - id: D7
    description: "Audit codes user.invitation-resent, user.reset-link-sent and user.temporary-password-set target the User id with no detail; auth.sessions-revoked carries detail temporary-password; the authorization matrix has all three rows; the contract snapshot, TS types and audit-log.md match"
    requirement: "USER-06"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false
  - id: D8
    description: "The wording of the Manager reset-link email and of the new 422 and 429 messages is built from UI-SPEC and the plan as written (owner ruling D-48: built, not yet approved)"
    verification: []
    human_judgment: true
    rationale: "Email and error wording is judged by the owner when the rendered previews are reviewed (05-31); 'users.reset-link-capped' text was written by the executor because neither the plan nor UI-SPEC gives one."

duration: 26min
completed: 2026-10-18
---

# Phase 5 Plan 27: Account Access Actions Summary

**Managers can resend an invitation, email a colleague a 30-minute reset link that names them (sharing forgot-password's hourly cap), and set a one-time temporary password that signs the person out everywhere, with the link and the password never shown, mailed to the Manager, logged or audited.**

## Performance

- **Duration:** about 26 min
- **Started:** 2026-10-18T13:49:55Z
- **Completed:** 2026-10-18T14:16:06Z
- **Tasks:** 3
- **Files modified:** 29 (10 created, 19 modified)

## Accomplishments

- **Resend invitation (USER-07, D-13):** the open invitation is revoked and a fresh 7-day link goes to the person with "{Manager} set up your account." as the first line. The old link answers 404, the new one works and can set a password. A person with a password gets 422 `users.already-set-up`, a deactivated or locked one 422 `users.blocked`.
- **Manager reset link (USER-07, D-41 Q5):** a new `ManagerResetLinkEmail` (own stored kind, UI-SPEC wording) with a 30-minute single-use link. A second send replaces the first. The cap of 3 reset emails per address per hour is now one number for forgot-password and the Manager, counted over both kinds (`ResetEmailCap`); the fourth send is 429 `users.reset-link-capped`. Locked or deactivated people get 422 `users.blocked`, people with no password 422 `users.no-password` ("Resend the invitation instead.").
- **Temporary password (C-4, 04 D-21, D-24, D-14):** basic rule only (the same extension Add User uses), then in one transaction: password saved, failed-password lockout ended, must-change (Temporary) set, edit version moved so SEC-08 stamps the Manager, every session revoked, the existing "A Manager reset your CSPS password" notice queued, `user.temporary-password-set` plus `auth.sessions-revoked` (detail `temporary-password`) audited. The session cache is evicted after commit. The next sign-in goes through the emailed code and then the must-change step.
- All three answer 204 with an empty body, so the Manager never sees a link or token, and the idempotency record stores only a request hash and no password.

## Task Commits

1. **Task 1 (tracer): a Manager resends an invitation (USER-07, D-13)** - `fd16216` (test, RED), `2774d23` (feat, GREEN)
2. **Task 2: Manager sends a reset link (USER-07, D-41 Q5)** - `e9350c7` (test, RED), `5df6792` (feat, GREEN)
3. **Task 3: Manager sets a temporary password (C-4, 04 D-24, D-14)** - `3b25983` (test, RED), `54e09ff` (feat, GREEN)

**Plan metadata:** recorded in the docs commit that follows this file (`docs(05-27): complete account access plan`).

The tracer gate (task 1) was verified end to end before expanding: `ResendInvitationTests` 8/8 plus the authorization matrix and contract snapshot passed.

## TDD Gate Compliance

All three tasks have a `test(05-27)` RED commit before the `feat(05-27)` GREEN commit. No REFACTOR commits were needed.

- **RED 1 (`fd16216`):** `ResendInvitationTests`, 8 of 8 ran and failed on the planned assertions (the route did not exist, so each answered 404 where 204, 403, 401 or 422 was expected). `semanticAssessment`: the target tests executed and failed for the intended reason; no compile, setup or discovery fault.
- **RED 2 (`e9350c7`):** `ManagerResetLinkTests`, 9 of 9 ran and failed on the status assertions for the same reason. `semanticAssessment`: intended failures only.
- **RED 3 (`3b25983`):** `TemporaryPasswordTests`, 15 of 15 ran and failed on `NoContent` expected, `NotFound` actual (checked on the main flow). `semanticAssessment`: intended failures only.
- The xUnit MTP report is not a format `gsd check tdd-red-evidence` supports, so the semantic inspection above is the evidence (same as 05-26).
- Tests that name a new type before GREEN (`EmailRendererTests` for `ManagerResetLinkEmail`, `AccountAccessHandlerTests`, `AuthEmailTests`, `AuditActionsTests`) cannot compile in a RED commit without making the whole run INVALID_RED. They were written in the GREEN commit of the same task; the endpoint tests for the same behavior were RED first.

## Files Created/Modified

- `src/Csps.Application/Users/ResendInvitationHandler.cs`, `SendResetLinkHandler.cs`, `SetTemporaryPasswordHandler.cs` - the three use cases (account lock, NotFound, Blocked, the action's own rule, change, mail, audit, one save)
- `src/Csps.Application/Users/SetTemporaryPasswordRequest.cs`, `SetTemporaryPasswordRequestValidator.cs` - the form (ToString prints the type name only) and the shared `MustMeetBasicRule`
- `src/Csps.Application/Auth/ResetEmailCap.cs`, `ForgotPasswordHandler.cs` - the shared hourly cap
- `src/Csps.Application/Users/UserErrors.cs`, `CreateUserRequestValidator.cs` - four new errors; Add User uses the shared rule
- `src/Csps.Application/Email/AuthEmail.cs`, `src/Csps.Infrastructure/Email/EmailRenderer.cs` - `ManagerResetLinkEmail` and its template
- `src/Csps.Application/Ports/IUserAccounts.cs`, `src/Csps.Infrastructure/Identity/UserAccounts.cs` - `MarkStaffEditAsync`
- `src/Csps.Domain/Auditing/AuditActions.cs`, `docs/operations/audit-log.md` - two new codes, the new revocation detail, the resent row widened
- `src/Csps.Server/Controllers/UsersController.cs`, `Composition/ApplicationRegistration.cs`, `Composition/AuthRegistration.cs` - three routes, handlers, validator
- `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` - regenerated contract (ResendUserInvitation, SendUserResetLink, SetUserTemporaryPassword)
- Tests: `ResendInvitationTests`, `ManagerResetLinkTests`, `TemporaryPasswordTests`, `AccountAccessHandlerTests`, the matrix rows, `EmailRendererTests`, `AuthEmailTests`, `ForgotPasswordHandlerTests`, `AuditActionsTests` (35 to 37 codes)

## Decisions Made

See `key-decisions` above. In short: five parameters for `ManagerResetLinkEmail`, a cap shared in both directions, a staff-edit marker for the temporary password, first-password handling for invited people, and Blocked before every action-specific rule.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The cap is shared in both directions**
- **Found during:** Task 2
- **Issue:** The plan says a Manager's send counts "toward the same hourly cap as forgot-password". Counting only on the Manager side would let a person's forgot-password requests still go out after three Manager sends, so up to six mails an hour could reach one inbox (T-05-78).
- **Fix:** `ResetEmailCap.IsReachedAsync` counts both stored kinds and is used by `SendResetLinkHandler` and `ForgotPasswordHandler`. It checks `PasswordReset` first and returns early, so forgot-password still makes one count call when that alone reaches the cap.
- **Files modified:** `src/Csps.Application/Auth/ResetEmailCap.cs`, `src/Csps.Application/Auth/ForgotPasswordHandler.cs`, `tests/Csps.Application.UnitTests/Auth/ForgotPasswordHandlerTests.cs`
- **Verification:** `ThreeManagerSendsUseUpTheHourSoForgotPasswordSendsNothingMore`, `ResetLinksAManagerSentCountTowardTheSameHourlyCap`, and the unchanged `ThreeEmailsInTheLastHourSendNothingMore`
- **Committed in:** `5df6792`

**2. [Rule 2 - Missing critical] A temporary password must count as a staff edit (D-21, SEC-08)**
- **Found during:** Task 3
- **Issue:** The plan says the temporary password rotates EditVersion and SEC-08 stamps the Manager, but `RecordStampInterceptor` treats password, lockout and must-change updates as Identity bookkeeping and stamps nothing. The first run showed the version unchanged.
- **Fix:** New port method `IUserAccounts.MarkStaffEditAsync` (with a concurrency retry like `SetActiveAsync`), called by the handler after the password changes. `UserAccounts.cs` and `IUserAccounts.cs` were not in the plan's file list.
- **Files modified:** `src/Csps.Application/Ports/IUserAccounts.cs`, `src/Csps.Infrastructure/Identity/UserAccounts.cs`, `src/Csps.Application/Users/SetTemporaryPasswordHandler.cs`
- **Verification:** the main `TemporaryPasswordTests` case asserts a new version and `lastChangedBy` equal to the Manager
- **Committed in:** `54e09ff`

**3. [Rule 2 - Missing critical] A person invited but not yet set up can be given a temporary password**
- **Found during:** Task 3
- **Issue:** UI-SPEC shows "Set Temporary Password" for anyone not locked or deactivated, including people with no password. Their address is unconfirmed, and only confirmed accounts may sign in, so the password would have been unusable, and the old invitation would still have been open.
- **Fix:** For a person without a password the handler confirms the address (as the Add User temporary route does) and revokes the open invitation.
- **Files modified:** `src/Csps.Application/Users/SetTemporaryPasswordHandler.cs`
- **Verification:** `AnInvitedPersonWhoGetsATemporaryPasswordCanSignInWithItAndTheOldInvitationDies`, `AnInvitedPersonGetsTheirFirstPasswordTheAddressCountsAsConfirmedAndTheInvitationDies`
- **Committed in:** `54e09ff`

**4. [Rule 3 - Blocking] `ManagerResetLinkEmail` takes `RequestedAt`**
- **Found during:** Task 2
- **Issue:** The plan's signature `(To, Token, ExpiresAt, ManagerName)` gives the renderer no way to word "30 minutes" without hard-coding it.
- **Fix:** `(To, Token, ExpiresAt, RequestedAt, ManagerName)`, matching `PasswordResetEmail` and `InviteEmail`. 05-31's preview tool must pass five arguments.
- **Files modified:** `src/Csps.Application/Email/AuthEmail.cs`, `src/Csps.Infrastructure/Email/EmailRenderer.cs`
- **Committed in:** `5df6792`

**5. [Rule 3 - Blocking] Existing tests and registration that the new members touched**
- **Found during:** Tasks 2 and 3
- **Issue:** `AuthEmailTests` and `AuditActionsTests` pin the email kinds, the catalog size (35 to 36 to 37) and the revocation details; the validator needs registering in `AuthRegistration.cs`; `CreateUserRequestValidator` moved to the shared rule extension.
- **Fix:** updated each; the new `UserErrors` messages for `users.no-password` and `users.reset-link-capped` (no text in the plan for the second) are in plain English.
- **Files modified:** `tests/Csps.Application.UnitTests/Email/AuthEmailTests.cs`, `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs`, `src/Csps.Server/Composition/AuthRegistration.cs`, `src/Csps.Application/Users/CreateUserRequestValidator.cs`
- **Committed in:** `5df6792`, `54e09ff`

---

**Total deviations:** 5 auto-fixed (3 missing critical, 2 blocking)
**Impact on plan:** All necessary for correctness, the stated truths, or to compile. No scope creep and no new packages.

## Issues Encountered

- A stray `python -` in one shell command started the Windows Store stub and blocked that command; I ended that one process (mine, started at the same second). It had no effect on the repository.
- The `auth.sessions-revoked` check in `TemporaryPasswordTests` first saw two entries, because the later must-change step records its own revocation. The test now picks the entry by its `temporary-password` detail.
- `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows a line-ending-only difference from an earlier plan; it was left alone as instructed.

## Verification

- `ResendInvitationTests` 8/8, `ManagerResetLinkTests` 9/9, `TemporaryPasswordTests` 15/15, `AccountAccessHandlerTests` 51/51, `EmailRendererTests` pass.
- Full runs: Csps.Server.IntegrationTests 1010/1010, Csps.Infrastructure.IntegrationTests 502 passed 1 skipped, Csps.ArchitectureTests 217/217, Csps.Application.UnitTests 805/805, Csps.Domain.UnitTests 600/600.
- Coverage gate: Csps.Domain 100% line and branch; Csps.Application 99.7% line (rule 95%).
- `npm --prefix tools/openapi-gen run check` passes; `OpenApiSnapshotTests` and `AuthorizationMatrixTests` pass.
- Acceptance greps: `user.invitation-resent`, `user.reset-link-sent` and `user.temporary-password-set` appear once each in `AuditActions.cs`; `user.temporary-password-set` is in `audit-log.md`; each route appears on one matrix line; `sent you this link to set a new password` appears once in `EmailRenderer.cs`.
- Staged-diff gitleaks scan was clean for every commit.

## Known Stubs

None.

## Threat Flags

None. The three POST routes and the new email kind are the surface in the plan's threat model (T-05-77 to T-05-80); each is mitigated and tested (empty 204 answers, shared cap, sessions revoked and evicted, no password in mail, audit or the idempotency record).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 05-30 (Account access section) can call the three routes by their operation ids `ResendUserInvitation`, `SendUserResetLink` and `SetUserTemporaryPassword` (already in the TS types) and show the documented messages: `users.already-set-up`, `users.blocked`, `users.no-password`, `users.reset-link-capped` (429), `users.own-account`.
- Plan 05-31 must construct `ManagerResetLinkEmail(To, Token, ExpiresAt, RequestedAt, ManagerName)` for the preview tool.
- The `users.reset-link-capped` text ("Too many reset emails went to this person in the last hour. Try again later.") and the Manager reset-link wording are for the owner to review with the email previews (D-48).

## Self-Check: PASSED

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
