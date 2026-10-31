---
phase: 05-profile-user-management
plan: 40
subsystem: api
tags: [users, email-change, manager, confirm-by-link, save-at-once, invitation, sessions, audit, outbox, openapi, user-03, prof-02, c-9, d-45, d-40, d-21]
created: "2026-10-18T06:55:00-05:00"
updated: "2026-10-18T06:55:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-23 UpdateUserHandler, UpdateUserRequest(+Validator), UserDetailsChange, UpdateDetailsAsync, UserErrors.EmailInUse; 05-14/05-15/05-39 AccountTokenPurpose.EmailChange, SetPendingEmailAsync, EmailChangeConfirmEmail, EmailChangeNoticeEmail, the profile cancel handler; 05-19 InviteEmail.InvitedBy; 05-21 session revocation (AccountChanged) and cache eviction"
provides:
  - "PUT /api/v1/users/{id} also carries email (required) and emailChange (confirm | now): the Manager chooses how a changed email applies and the server never infers it (D-45)"
  - "confirm: sign-in email stays, new address pending, 24-hour link naming the Manager to the new address, notice to the old address, audit user.email-change-started"
  - "now: email and user name move in the same guarded save, every session ends and is evicted, open email-change links close, pending cleared, a new 'A Manager changed your CSPS sign-in email' notice goes to the old address, audit user.details-changed fields=email plus auth.sessions-revoked account-changed"
  - "An invited person (no password) always moves at once whichever choice is sent; the invitation is replaced by a fresh 7-day one to the new address (user.invitation-resent); no notice to the old address"
  - "DELETE /api/v1/users/{id}/email-change (Manager, no version): CancelUserEmailChangeHandler"
  - "EmailChangeConfirmEmail.ChangedBy, ManagerEmailChangedEmail (AuthEmailKind 10), AuditActions.UserEmailChangeStarted and UserInvitationResent, EditOutcome.EmailTaken, EditedFields.Email, UserErrors.EmailChangeChoiceRequired"
affects: [05-25 Edit User panel, 05-27 resend invitation, 05-30 Edit User UI, 05-31 email preview, 05-37 screen review]

actuals:
  tokens: 39700
  tasks: 2
  commits: 3
plan_head_before: 807cb49ea712c1ca4aa80b8f16ddf82e36aa3464
plan_head_after: 9230f04cfa5ff08d3a2146e3cc7e580f442e257e

tech-stack:
  added: []
  patterns:
    - "The apply mode is an explicit request member (emailChange) validated in the handler against the stored person, because 'is the email changing' needs the stored address; the validator only checks the email shape"
    - "A moved email clears the pending address in the same version-guarded UPDATE as the move, so no second write can lose a race"
    - "One revocation per save: a role change and an at-once email together revoke sessions once and write one auth.sessions-revoked entry"

key-files:
  created:
    - src/Csps.Application/Users/CancelUserEmailChangeHandler.cs
    - tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs
    - tests/Csps.Application.UnitTests/Users/CancelUserEmailChangeHandlerTests.cs
  modified:
    - src/Csps.Application/Users/UpdateUserRequest.cs
    - src/Csps.Application/Users/UpdateUserRequestValidator.cs
    - src/Csps.Application/Users/UpdateUserHandler.cs
    - src/Csps.Application/Users/UserErrors.cs
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Application/Email/AuthEmail.cs
    - src/Csps.Infrastructure/Email/EmailRenderer.cs
    - src/Csps.Infrastructure/Email/EmailPreviewOptions.cs
    - tools/Csps.EmailPreview/Program.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Server/Controllers/UsersController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Users/UserEditConcurrencyTests.cs
    - tests/Csps.Application.UnitTests/Users/UpdateUserHandlerTests.cs
    - tests/Csps.Application.UnitTests/Email/AuthEmailTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailPreviewTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md
    - docs/operations/mail-setup.md
    - docs/api/auth.md
    - .planning/phases/05-profile-user-management/deferred-items.md

key-decisions:
  - "D-45 override of the plan's OQ-4 default: the API member is emailChange with the values confirm and now (trimmed, any letter case). A changed email with a missing or unknown value is 400 under emailChange ('Choose how the email change applies.', pending owner review per D-48); an unchanged email ignores the member."
  - "The member is required even for an invited person (uniform contract, 'the server never infers it'); the outcome for them is the same either way."
  - "The same address in another letter case is the same address (no change), matching the profile route's 'already your email' rule."
  - "email is required on every PUT (the plan's edge: missing, blank or malformed is 400 under email with 'Enter a valid email, like name@gmail.com'), so the 05-23 tests and the contract now send the stored email."
  - "DELETE /users/{id}/email-change refuses the caller's own account with 422 users.own-account (D-19: a Manager uses My Profile for their own); the plan did not say, and this keeps every Manager action on a person consistent."
  - "No notice goes to the old address of an invited person: they never set up the account, and the plan keeps their move simple."
  - "The audit code user.invitation-resent is added here (plan 05-27 planned to add it); 05-27 must reuse the constant, not declare it again."

patterns-established:
  - "A Manager action that also tells the person by email queues the mail inside the same transaction as the state change and the audit entry (outbox), so none of the three can exist without the others"

requirements-completed: [USER-03, PROF-02]

coverage:
  - id: D1
    description: "USER-03 / D-45 confirm: a Manager's changed email with emailChange=confirm keeps the sign-in email, shows the new address as pendingEmail without rotating the version, mails the new address a link naming the Manager and the old address a notice, does not sign the person out, and applies only when the link is confirmed"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs#ConfirmByLinkLeavesTheSignInAloneUntilTheNewInboxConfirmsAndNamesTheManager"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/UpdateUserHandlerTests.cs#ConfirmByLinkKeepsTheSignInStartsAPendingChangeAndEmailsBothAddresses"
        status: pass
    human_judgment: false
  - id: D2
    description: "D-45 save at once: the email and user name move in the guarded save, the person's old token dies on the next request, the new email signs in and the old does not, open links die, the old address gets the new Manager-changed notice, audit is field names only"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs#SaveAtOnceMovesTheEmailNotifiesTheOldAddressSignsThePersonOutAndClosesOpenLinks"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/UpdateUserHandlerTests.cs#SaveAtOnceMovesTheEmailEndsEverySessionClosesOpenLinksAndNotifiesTheOldAddress"
        status: pass
    human_judgment: false
  - id: D3
    description: "The choice is explicit: a changed email with a missing or unknown emailChange is 400 under emailChange and changes nothing; an unchanged email ignores it (prohibition test)"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs#ChangingTheEmailWithoutAValidChoiceAnswers400OnTheChoiceFieldAndChangesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs#AnUnchangedEmailIgnoresTheChoiceAndSavesTheRest"
        status: pass
    human_judgment: false
  - id: D4
    description: "An invited person's address moves at once whichever choice is sent, the old invitation link dies and a fresh 7-day one naming the Manager goes to the new address; audit user.details-changed fields=email and user.invitation-resent"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs#AnInvitedPersonsAddressMovesAtOnceWhicheverWayIsChosenAndTheOldInviteDies"
        status: pass
    human_judgment: false
  - id: D5
    description: "A taken address is 400 under email, a missing, blank, malformed or over-256 email is 400 under email with the sign-in message, a stale form is 409, and none of them changes or sends anything"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs#AnAddressAnotherAccountUsesAnswers400OnTheEmailFieldAndChangesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs#AMissingBlankOrMalformedEmailAnswers400OnTheEmailFieldAndChangesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs#AStaleFormWithANewEmailAnswers409AndMovesNothing"
        status: pass
    human_judgment: false
  - id: D6
    description: "DELETE /api/v1/users/{id}/email-change calls off a waiting change (links die, pending cleared, Manager is the actor), answers 204 with nothing waiting, 404 users.not-found for unknown or deleted, 422 for the caller's own account, 403 for an Admin; matrix row 401/403/404"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs#ACanceledChangeClosesTheLinkClearsTheWaitingAddressAndRecordsTheManager"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs#DELETE /api/v1/users/{id:guid}/email-change"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/CancelUserEmailChangeHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: D7
    description: "Email copy: the Manager-started confirm email carries the sentence '{Manager} changed the sign-in email for your CSPS staff account to {new}.', and the new Manager-changed notice exists in the preview tool; the wording of the notice and of the choice error is built from D-45 but not approved"
    requirement: "PROF-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs#AManagerStartedConfirmEmailNamesTheManagerInsteadOfTheSelfSentence"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs#TheManagerChangedNoticeGoesToTheOldAddressWithTheTimeTheSignedOutLineAndNoLinkOrToken"
        status: pass
    human_judgment: true
    rationale: "Owner ruling D-48: every new or amended string is built as specified but needs the owner's approval in the 05-31 and 05-37 reviews"

duration: 30min
completed: 2026-10-18
---

# Phase 5 Plan 40: Manager changes a colleague's email (confirm by link or at once) Summary

**PUT /api/v1/users/{id} now carries the sign-in email and an explicit emailChange choice (D-45): confirm sends the C-9 link naming the Manager, now moves the email in the guarded save and signs the person out, an invited person always moves at once, and DELETE /users/{id}/email-change calls off a waiting change.**

## Performance

- **Duration:** about 30 min of execution after reading (start time was not captured at launch; the RED commit landed at 06:33 and the last test commit at 06:48, America/Chicago)
- **Completed:** 2026-10-18T06:55:00-05:00
- **Tasks:** 2 (tracer plus unit coverage)
- **Files modified:** 30 (3 created, 27 modified)

## D-45 override (owner ruling, applied over the plan)

The plan was written for the OQ-4 contract default (C-9 only). The owner ruled D-45 after planning, so the executor built the choice instead. **05-25, 05-30 and the verifier must pick this up.**

- **Contract:** `UpdateUserRequest` gains `email` (string, always required) and `emailChange` (string, `confirm` or `now`, trimmed, any letter case). Documented in the OpenAPI description and in `docs/api/auth.md` ("A Manager changes a colleague's email").
- **Edit User UI (05-25/05-30) must offer the two choices with "Confirm by link" preselected and send the chosen value explicitly.** Wording on the form: "Confirm by link" and "Save at once". The UI needs to send `emailChange` only when the email is changed, but may always send it: the server ignores it when the email is unchanged.
- **Behavior:** when the email differs (a different letter case is the same address) and `emailChange` is missing or unknown: 400 under `emailChange`, "Choose how the email change applies." and nothing changes. Taken address: 400 under `email`, "Another account already uses this email." A missing, blank or malformed email: 400 under `email`, "Enter a valid email, like name@gmail.com".
- **confirm** is the plan's C-9 path as written: pending address, 24-hour link to the new address with "{Manager name} changed the sign-in email for your CSPS staff account to {new email}.", notice to the old address, applies on confirmation, Manager cancel route, audit `user.email-change-started` (no detail).
- **now:** the email and user name change in the same guarded save (and any pending address is cleared in that UPDATE); every session is revoked (reason account-changed) and evicted after the commit; open EmailChange links are revoked; a new notice email goes to the old address; audit `user.details-changed` with `fields=email` (names joined with a name change in the same save, e.g. `fields=first-name,email`) plus `auth.sessions-revoked` / `account-changed` when a session was open. Uniqueness and email rules still apply.
- **Invited person (no password):** the address moves at once whichever value is sent, the old invitation is revoked and a fresh 7-day one with the Manager line goes to the new address; audit `user.details-changed` `fields=email` and `user.invitation-resent`. No notice goes to the old address.
- **Prohibition (rewritten from the plan, as instructed):** MUST NOT move a colleague's email at once unless the Manager explicitly chose "now"; the old address is always notified and the person is signed out. Tests: `ChangingTheEmailWithoutAValidChoiceAnswers400OnTheChoiceFieldAndChangesNothing` (nothing moves without a valid choice), `ConfirmByLinkLeavesTheSignInAloneUntilTheNewInboxConfirmsAndNamesTheManager`, `SaveAtOnceMovesTheEmailNotifiesTheOldAddressSignsThePersonOutAndClosesOpenLinks`. The plan's frontmatter prohibition text was superseded and is not edited in the PLAN file.
- **New email (wording pending owner review, D-48):** subject "A Manager changed your CSPS sign-in email", heading "Your sign-in email was changed", preheader "Sign in with your new email from now on.", body "{Manager} changed your sign-in email to {new}.", "Changed {time}.", "From now on, sign in with {new}. This address, {old}, no longer signs in to CSPS.", the signed-out line, "If you didn't expect this, tell a Manager." No button. It is in the preview tool as `manager-changed-email`, so 05-31 shows it; it is listed in `deferred-items.md` for the owner's review with the choice error text.

## Accomplishments

- A Manager can fix a colleague's sign-in email either safely (link, notice, no sign-out) or at once (signed out, old address told), by an explicit choice per change.
- An invited person's address moves with a fresh invitation, and the old invitation link stops working.
- A Manager can cancel a colleague's waiting change from the roster side.
- The contract, the audit catalogue (`user.email-change-started`, `user.invitation-resent`), the API doc and the mail doc are refreshed.

## Task Commits

1. **Task 1 (tracer): Manager email change, confirm by link or at once**
   - RED `cfb94f6` test(05-40): a Manager changes a staff email by link or at once (RED)
   - GREEN `b831e8a` feat(05-40): a Manager chooses how a colleague's email change applies (USER-03, C-9, D-45)
2. **Task 2: unit coverage for the Manager email branches and the cancel handler**
   - `9230f04` test(05-40): Manager email branches and the cancel handler, unit level (characterization)

**Plan metadata:** the docs commit that carries this summary, STATE.md, ROADMAP.md and REQUIREMENTS.md follows (not counted in `actuals.commits`).

## TDD Gate Compliance

Task 1 has a `test(05-40)` commit before its `feat(05-40)` commit. Task 2 produced one characterization `test(05-40)` commit (no `fix` commit was needed). No REFACTOR commit.

- **RED evidence:** `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ManagerEmailChangeTests"`, exit 2, 23 failed and 4 passed of 27. Semantic assessment: every failing test executed and failed on its planned assertion (the PUT ignored `email`, so field-error cases answered 200, the confirm and notice mails never arrived, and the DELETE route answered 404). Two tests, `SaveAtOnceMoves...` and `ACanceledChange...`, ended in the sink-wait timeout because the planned confirmation mail was never sent; that is the missing behavior, not a build, fixture or discovery fault. The four that passed were regression guards that already held (an unchanged email ignores the choice twice, the same address in another letter case, and a stale form is 409). The xunit MTP report is not a format `gsd check tdd-red-evidence` parses, so the classifier was not used and this assessment stands as the record.
- **Order note:** the renderer and `AuthEmailTests` additions were written with the GREEN code, because they name new members (`ChangedBy`, `ManagerEmailChangedEmail`) and a RED commit of them would only have been a build failure (INVALID_RED). The behavior they cover (the Manager sentence, the notice text) was driven end to end by the RED integration cases, which read the real mails from the test sink.
- **Task 2:** all new `UpdateUserHandlerTests` and the new `CancelUserEmailChangeHandlerTests` passed on first run, as the plan allows when behavior is already driven by Task 1. They are committed as characterization tests.

## Tracer Gate

Task 1 was a tracer with an automated-only `<verify>` and `human_verify_mode` end-of-phase. After the GREEN commit all three verify commands were re-run: `ManagerEmailChangeTests` 27 of 27, `EmailRendererTests` (with `EmailPreviewTests`) 77 of 77, and `npm --prefix tools/openapi-gen run check` clean. Tracer verified end-to-end, expanded to Task 2.

## Verification

- `dotnet test --project tests/Csps.Server.IntegrationTests` (CSPS_TEST_SQL=localdb): 935 passed, 0 failed (includes the authorization matrix with the new DELETE row, the OpenAPI snapshot, and the 05-23 edit and two-writer tests, all updated to send `email`).
- `dotnet test --project tests/Csps.Application.UnitTests`: 718 passed. `Invoke-CoverageGate.ps1`: Csps.Domain 100% line and 100% branch, Csps.Application 99.6% line (rule 95%), gate passed.
- `Csps.Domain.UnitTests` 597, `Csps.ArchitectureTests` 217, `Csps.Infrastructure.IntegrationTests` 486 passed and 1 skipped (pre-existing). Whole-solution build: 0 warnings, 0 errors.
- `npm --prefix tools/openapi-gen run check` passes; `npm --prefix web run typecheck` is clean; the web no-long-dash test passes.
- Acceptance greps: `user.email-change-started` = 1 in `AuditActions.cs` and 2 in `audit-log.md`; `changed the sign-in email for your CSPS staff account` = 1 in `EmailRenderer.cs`.
- Preflight run before the full runs: ports 5180, 5115, 7028 and 5199 free, no other project's test processes.

## Files Created/Modified

See `key-files` above. The main ones: `UpdateUserHandler.cs` (the email branches), `CancelUserEmailChangeHandler.cs` (new), `UserAccounts.UpdateDetailsAsync` (email in the guarded save, taken check, race handling), `EmailRenderer.cs` (Manager sentence and the new notice), `UsersController.cs` (the DELETE route and the PUT documentation), `ManagerEmailChangeTests.cs` (27 end-to-end cases).

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Owner-ruled change

**1. [D-45 override] The plan's single C-9 behavior became an explicit choice**
- **Found during:** orchestrator instruction before Task 1
- **Issue:** the plan implemented the OQ-4 default (confirm by link only, immediate move only for an invited person); the owner ruled D-45 (Manager chooses per change).
- **Fix:** the `emailChange` member, the `now` path, the new notice email, the prohibition rewrite and tests as described in "D-45 override" above.
- **Files modified:** all Task 1 files plus `ManagerEmailChangedEmail` in `AuthEmail.cs`, `EmailRenderer.cs`, `tools/Csps.EmailPreview/Program.cs` and its tests.
- **Committed in:** cfb94f6 (tests), b831e8a (code)

### Auto-fixed Issues

**2. [Rule 3 - Blocking] Existing Edit User tests needed the now-required email**
- **Found during:** Task 1 RED
- **Issue:** the plan makes `email` required (a missing one is 400 under `email`), so the 05-23 tests (`UpdateUserEndpointTests`, `UserEditConcurrencyTests`) and the 05-23 unit harness, which sent no email, would fail for the wrong reason.
- **Fix:** they now send the stored email; the empty-form unit test expects `email` among the reported fields.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Users/UpdateUserEndpointTests.cs`, `UserEditConcurrencyTests.cs`, `tests/Csps.Application.UnitTests/Users/UpdateUserHandlerTests.cs`
- **Committed in:** cfb94f6, b831e8a

**3. [Rule 2 - Missing critical] The caller's own account is refused on the cancel route**
- **Found during:** Task 1 design
- **Issue:** the plan is silent; D-19 says a Manager changes their own email through My Profile, and every other Manager action on a person refuses the caller's own id.
- **Fix:** `DELETE /users/{id}/email-change` answers 422 `users.own-account` for the caller's id before locking or reading.
- **Committed in:** b831e8a

### Scope and process notes

**4. [Scope] `user.invitation-resent` is declared here, not in 05-27.** Plan 05-27 lists adding it; this plan's truths require recording it, so the constant and its catalogue and doc rows are added now. 05-27 must reuse `AuditActions.UserInvitationResent` and its `AuditActionsTests` assertion exists already (the catalogue count test is 32).

**5. [Scope] The email preview tool now has eight samples.** The orchestrator asked for the new notice in the tool's list; 05-31's plan counts seven existing samples plus six new (13). It will now be 8 plus 6 = 14 (28 files); the 05-31 executor must raise the expected counts from the current 8 and 16.

**6. [Scope] Cancel handler tests live in a new file** (`CancelUserEmailChangeHandlerTests.cs`); the plan listed only `UpdateUserHandlerTests.cs`.

**7. [Docs] Three docs beyond the plan's list were updated**: `docs/api/auth.md` (the contract, per the orchestrator's "document in docs/api"), `docs/operations/mail-setup.md` (the preview now has eight emails) and `deferred-items.md` (the wording-review entry).

**8. [Process] Unit-level renderer tests written with GREEN** (see TDD Gate Compliance).

---

**Total deviations:** 1 owner-ruled change, 2 auto-fixes (Rules 2 and 3), 5 scope or process notes. **Impact on plan:** the owner ruling widens the plan as instructed; no listed truth other than the superseded prohibition changed.

## Issues Encountered

- A first draft of the choice-failure test used a 256-character email, which is exactly the allowed maximum; the test was corrected to 257 characters. No product change.
- `ResetPasswordPage.test.tsx` still shows a line-ending-only difference from an earlier plan; left alone as instructed.

## Authentication Gates

None.

## Known Stubs

None. No placeholder values, empty data sources or TODO text in the files this plan touched. (The new strings are real wording that awaits the owner's review, listed in `deferred-items.md`; they are not stubs.)

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: manager-immediate-email-move | src/Csps.Application/Users/UpdateUserHandler.cs | D-45 lets a Manager move a colleague's sign-in email at once with no confirmation from the new inbox. Mitigations built: it needs an explicit `emailChange=now`, the old address is always notified, every session of the person ends, open links close, and the change is audited (`user.details-changed` fields=email and `auth.sessions-revoked`) with the Manager as actor. This relaxes T-05-68's "confirmation at the new address" for the owner-chosen path only; the default selection in the UI stays "Confirm by link". |
| threat_flag: new-manager-cancel-route | src/Csps.Server/Controllers/UsersController.cs | `DELETE /api/v1/users/{id}/email-change` is a new Manager-only state change; covered by the matrix row (401/403/404), the link lock and the audit entry. |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 05-25/05-30 (Edit User panel) can save through `PUT /api/v1/users/{id}` with `{ firstName, lastName, role, version, email, emailChange }` and cancel with `DELETE /api/v1/users/{id}/email-change`; the generated types have `email` and `emailChange` (both optional in the type, but `email` is required by the API). The panel must show "Confirm by link" preselected and "Save at once".
- 05-27 reuses `AuditActions.UserInvitationResent`; its resend handler can follow the invitation block in `UpdateUserHandler.StartEmailAsync`.
- 05-31 shows the new `manager-changed-email` sample with the rest and the owner reviews its wording; expected counts move by one (8 samples now, 16 files).
- Session cache eviction after the commit is the same pattern as 05-23; the ordering gap logged for the idempotency gate does not apply to PUT or DELETE.

## Self-Check: PASSED

- Created files exist: `CancelUserEmailChangeHandler.cs`, `ManagerEmailChangeTests.cs`, `CancelUserEmailChangeHandlerTests.cs`.
- Commits `cfb94f6`, `b831e8a` and `9230f04` are on `gsd/phase-05-profile-user-management`.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
