---
phase: 05-profile-user-management
plan: 19
subsystem: api
tags: [users, create, invitation, temporary-password, idempotency, attribution, race, user-02, sec-08, c-4, d-12, d-13, d-14]
created: 2026-10-18T03:33:00-05:00
updated: 2026-10-18T03:33:00-05:00
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-06 AuthSettings.InviteLinkLifetime (7 days); 05-11 CreatedById stamping from the token; 05-17 UsersController, UserErrors, roster list and detail reads"
provides:
  - "POST /api/v1/users (Manager policy, Idempotency-Key): 201 { id } with a Location, 400 field errors, 401, 403"
  - "Access 'invitation' (default): account with no password, 7-day Invitation token, invite email whose first line is '{Manager first last} set up your account.'"
  - "Access 'temporary-password': account created with the Manager's password (basic rule only), must-change reason Temporary, no email; the password is never returned, logged, audited, emailed or stored in plain text"
  - "UserErrors.EmailInUse (400 on field email, 'Another account already uses this email.') and EmailInUseException from IUserAccounts.CreateAsync"
  - "AuditActions.UserCreatedTemporary ('user.created-temporary', no detail) and user.invited detail 'manager'"
  - "InviteEmail.InvitedBy; CreateUserHandler, CreateUserRequest(+Validator), CreateUserResponse"
  - "USER-02 amended to allow the temporary-password route"
affects: [05-22 Add User panel, 05-27 resend invitation, 05-29 Manager password reset, 05-33 audit log screen, 05-31 email review]

actuals:
  tokens: 21000
  tasks: 3
  commits: 7
plan_head_before: d09e3deecf25b117e1396620ae52fabafb9d53dc
plan_head_after: 7ad8389ed97bae6fe8c5ba56396df9a315f5d74f

tech-stack:
  added: []
  patterns:
    - "A port throws a typed exception (EmailInUseException : InvalidOperationException) for a taken address, whether Identity's lookup or the unique index found it; the handler turns it into the field error after the savepoint rolls back"
    - "A failed Identity insert detaches the row from the scoped context, so the idempotency gate's later save on the same request does not insert it again"
    - "One handler, two access routes: the validator canonicalizes role and access text (any letter case), and the password rule runs only on the temporary route"

key-files:
  created:
    - src/Csps.Application/Users/CreateUserHandler.cs
    - src/Csps.Application/Users/CreateUserRequest.cs
    - src/Csps.Application/Users/CreateUserRequestValidator.cs
    - src/Csps.Application/Users/CreateUserResponse.cs
    - src/Csps.Application/Ports/EmailInUseException.cs
    - tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs
    - tests/Csps.Application.UnitTests/Users/CreateUserHandlerTests.cs
  modified:
    - src/Csps.Application/Users/UserErrors.cs
    - src/Csps.Application/Email/AuthEmail.cs
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Infrastructure/Email/EmailRenderer.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Server/Controllers/UsersController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/05-profile-user-management/deferred-items.md
    - .gitleaks.toml

key-decisions:
  - "A taken address is signalled by EmailInUseException from IUserAccounts.CreateAsync (a subclass of InvalidOperationException, so other callers still fail loudly), not by a new TryCreate method; the plan named the mapping inside UserAccounts"
  - "Role and access text are accepted in any letter case and canonicalized (Admin or Manager; invitation or temporary-password); an invitation ignores a temporaryPassword sent with it"
  - "The temporary-password empty message is 'Enter a temporary password.' (UI-SPEC), not PasswordPolicy's 'Enter a new password.'; every other message is PasswordPolicy.MessageFor"
  - "CreateUserRequest.ToString prints the type name only, so the temporary password cannot reach a log through the request"

requirements-completed: [USER-02, SEC-08]

coverage:
  - id: D1
    description: "USER-02 / D-12 / D-13: a Manager invites Ana by email; the roster shows her pending and active; the email opens with the Manager's name and says 7 days; she sets a password and signs in with the emailed code; Admin gets 403 and anonymous 401 and nothing is created"
    requirement: "USER-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs#AManagerInvitesAnaWhoReadsWhoSetUpHerAccountSetsHerPasswordAndSignsIn"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs#AnAdminIsRefusedWith403AndAnAnonymousCallerWith401AndNothingIsCreated"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs#AnInviteFromAManagerOpensWithTheirNameAndEncodesItInTheHtml"
        status: pass
    human_judgment: false
  - id: D2
    description: "C-4 / 04 D-21 / D-14: the temporary-password route (basic rule messages, 8 to 64 characters, no breach or name check), must-change at first sign-in through the code then 'set-new-password', no email, and the password is never in the response, mails, audit or idempotency record"
    requirement: "USER-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs#ATemporaryPasswordNeedsTheCodeThenANewPasswordAndIsNeverReturnedOrEmailed"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs#ATemporaryPasswordThatBreaksTheBasicRuleIsA400OnItsFieldAndNothingIsCreated"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs#ABreachedLookingButBasicValidPasswordIsAcceptedAndTheIdempotencyRecordHoldsNoCopyOfIt"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/CreateUserHandlerTests.cs#ATemporaryPasswordCreatesTheAccountWithItMarksItMustChangeAndSendsNoEmail"
        status: pass
    human_judgment: false
  - id: D3
    description: "Empty and encoding edges: every missing or unknown field is a 400 on that field before anything is created; names at 100 characters; the email is trimmed and compared case-insensitively"
    requirement: "USER-02"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/CreateUserHandlerTests.cs#EveryMissingOrUnknownFieldIsA400OnThatFieldBeforeAnythingIsCreated"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs#TheEmailIsTrimmedAndComparedWithoutRegardToLetterCase"
        status: pass
    human_judgment: false
  - id: D4
    description: "SEC-08 / SEC-06: CreatedById is the Manager and CreatedAtUtc the server clock whatever the body claims, UpdatedBy stays empty, and a replayed key returns the first 201 with one account, one invite and no new stamp"
    requirement: "SEC-08"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs#TheCreatorAndTheTimeComeFromTheTokenAndTheClockWhateverTheBodyClaims"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs#ARepeatedKeyAndBodyGivesTheFirstAnswerBackWithOneAccountOneInviteAndNoNewStamp"
        status: pass
    human_judgment: false
  - id: D5
    description: "T-05-56: two creates for one address sent together (20 runs) give exactly one 201 and one 400 on the email field; the unique index alone also refuses a duplicate and leaves no row tracked; a deleted account's scrambled address is free again"
    requirement: "USER-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs#TwoCreatesWithTheSameEmailSentTogetherGiveOneAccountAndOneEmailFieldErrorEveryTime"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs#TheUniqueEmailIndexAloneRefusesADuplicateAndLeavesNoRowTracked"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs#AnAddressOfADeletedAccountCanBeInvitedAgainAsASeparateNewAccount"
        status: pass
    human_judgment: false
  - id: D6
    description: "USER-02 wording amended to allow the Manager-set temporary-password route; audit-log.md documents user.invited detail manager and user.created-temporary"
    requirement: "USER-02"
    verification: []
    human_judgment: true
    rationale: "Requirement and documentation wording; the owner reads and approves it (the grep acceptance checks only that the words are present)."

duration: 24min
completed: 2026-10-18
---

# Phase 5 Plan 19: Create user (invitation or temporary password) Summary

**`POST /api/v1/users` lets a Manager add staff by a 7-day emailed invitation (opening with the Manager's name) or with a one-time temporary password the person must replace at first sign-in, stamped to the Manager, replay-safe and race-safe on the email.**

## Performance

- **Duration:** about 24 min
- **Started:** 2026-10-18T03:08:00-05:00
- **Completed:** 2026-10-18T03:32:00-05:00
- **Tasks:** 3
- **Files modified:** 26 (7 created)

## Accomplishments

- Invitation route: account with no password, `AccountToken` Invitation using `InviteLinkLifetime` (7 days), `InviteEmail(... InvitedBy)` whose first paragraph reads "{Manager first last} set up your account." (HTML-encoded; the bootstrap text is unchanged), audit `user.invited` with detail `manager` and the Manager as actor.
- Temporary-password route: validator applies only the basic rule (04 D-21) with UI-SPEC messages, the handler creates the account with the password (hashed by the account port), sets must-change (Temporary), sends no email, and audits `user.created-temporary` with no detail. The 201 body is `{ id }`.
- Server-set attribution: CreatedById and CreatedAtUtc come from the token and the clock; forged `createdById`, `createdAtUtc`, `updatedById` and `updatedAtUtc` are ignored and UpdatedBy stays empty; a replayed key returns the stored 201 with one account, one mail and an unchanged row.
- Race safety: `UserAccounts.CreateAsync` throws `EmailInUseException` for Identity's duplicate check and for a unique-index violation (detaching the failed row), and the handler answers the same 400 on `email`. 20 racing pairs gave one 201 and one 400 each.
- Contract refreshed (OpenAPI snapshot and `api.generated.ts`), matrix row `POST /api/v1/users` (401, 403, 400), USER-02 amended, audit-log.md updated.

## Task Commits

1. **Task 1 (tracer): a Manager invites Ana** - `e15943a` (test, RED), `f90ddbd` (feat, GREEN)
2. **Task 2: temporary-password route** - `8c09859` (test, RED), `680b816` (feat, GREEN)
3. **Task 3: attribution, replay and race safety; wording** - `b364b3a` (test, RED), `77a229f` (feat, fix), `7ad8389` (docs)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## TDD Gate Compliance

- **Task 1 RED** (`e15943a`): both endpoint tests failed on the planned status assertions (404 where 201 and 403 were planned; the route did not exist). Semantic assessment: the targets ran and failed for the intended reason, no setup or load faults. The two `EmailRendererTests` cases name `InvitedBy`, which did not exist yet, so that test project failed to compile in RED; this is a compile-level RED, not an assertion-level one, and the endpoint tests carry the assertion-level evidence for the same behaviour. The `check tdd-red-evidence` classifier does not read dotnet MTP console output, so RED was judged by hand from the real output.
- **Task 1 GREEN** (`f90ddbd`): 2 of 2 endpoint tests, 61 of 61 renderer tests, 113 of 113 matrix tests pass.
- **Task 2 RED** (`8c09859`): 8 handler tests and 9 endpoint tests failed on the planned assertions: no `temporaryPassword` field error (KeyNotFound on the field), `access` error 400 where 201 was planned. Semantic assessment as above.
- **Task 2 GREEN** (`680b816`): 29 of 29 handler tests, 11 of 11 endpoint tests pass.
- **Task 3 RED** (`b364b3a`): 16 of 17 cases passed at once (attribution, replay, case-insensitive email, deleted-address reuse), committed with the red case as one commit; the failing one was the race, which answered 500 where one 201 and one 400 were planned.
- **Task 3 GREEN** (`77a229f`): 17 of 17 pass, the race 3 more times in a row.
- No REFACTOR commit was needed.

## Tracer Gate

Tracer verified end-to-end (both `<verify>` commands passed after GREEN: `CreateUserEndpointTests` and `EmailRendererTests`), then expansion (Task 2) proceeded.

## Verification

- `dotnet test --project tests/Csps.Server.IntegrationTests`: 863 passed (includes the authorization matrix, `SensitiveDataMaskingTests`, idempotency coverage and the OpenAPI snapshot).
- `Csps.Application.UnitTests` 632 passed, `Csps.Domain.UnitTests` 593 passed, `Csps.ArchitectureTests` 217 passed, `Csps.Infrastructure.IntegrationTests` 478 passed and 1 skipped (pre-existing).
- Coverage gate: Csps.Domain 100% line and 100% branch; Csps.Application 99.6% line (rule 95%). Passed.
- `npm --prefix tools/openapi-gen run check` passes; `npm --prefix web run typecheck` clean. Builds had 0 warnings.
- Acceptance greps: `InviteLinkLifetime` in the handler 1, `set up your account.` in the renderer 1, matrix row 1, `user.created-temporary` in AuditActions 1 and in audit-log.md 1 line, `PasswordChangeReason.Temporary` in the handler 1, USER-02 line shows the amended text.

## Files Created/Modified

See the frontmatter `key-files`. The handler, request, validator and response are new in `Csps.Application/Users`; the typed exception is in `Csps.Application/Ports`.

## Decisions Made

See `key-decisions`. In short: typed exception for the taken address, case-insensitive role and access text, the UI-SPEC "Enter a temporary password." message, and a request `ToString` that hides the password.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] gitleaks flagged the new test's sample password**
- **Found during:** Task 2 (RED commit)
- **Issue:** the pre-commit gitleaks hook reported `generic-api-key` on the fake sample-password constant in the new `CreateUserEndpointTests.cs`. It is the same fake sample password the existing auth tests use, and `.gitleaks.toml` says a new file needs its own allowlist entry.
- **Fix:** added the file to the existing "sample passwords in .NET integration tests" allowlist.
- **Files modified:** `.gitleaks.toml`
- **Committed in:** `8c09859`

**2. [Rule 3 - Blocking] The audit catalog count test**
- **Found during:** Task 2 (GREEN)
- **Issue:** `AuditActionsTests` pins the catalog at 25 codes; adding `user.created-temporary` makes it 26.
- **Fix:** count updated, plus a test that the new code is in the catalog.
- **Files modified:** `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs`
- **Committed in:** `680b816`

**3. [Plan addition] Two extra tests for the race fix**
- A handler unit test for the `EmailInUseException` branch (keeps Application coverage) and `TheUniqueEmailIndexAloneRefusesADuplicateAndLeavesNoRowTracked` in `UserAccountsTests`. On LocalDB the race is always settled by Identity's own lookup (20 of 20 runs, because its read waits for the other create's uncommitted row), so the unique-index branch was never reached by the endpoint race test. The index test clears Identity's validators so only the index is left, which is also how a host with row-versioned reads would behave. The existing `CreatingADuplicateEmailFails` now asserts `EmailInUseException`.
- **Committed in:** `77a229f`

**4. [Rule 2 - Missing critical] Request `ToString` hides the password**
- `CreateUserRequest.ToString()` returns the type name only (as `ChangePasswordRequest` does), so a logged request cannot show the temporary password (T-05-54). Tested in `NoAuditEntryHoldsThePasswordANameOrTheEmail`.
- **Committed in:** `f90ddbd`

---

**Total deviations:** 2 auto-fixed (blocking), 1 plan addition, 1 hardening (Rule 2). **Impact:** none on scope; the contract and behaviour match the plan's truths.

## Issues Encountered

- The EmailRenderer test cases could not compile before `InviteEmail.InvitedBy` existed (see TDD Gate Compliance).
- `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows as modified (line endings only, from an earlier plan). It was left alone as instructed.
- Deferred (see `deferred-items.md`): the idempotency record keeps an unsalted SHA-256 of the request body, which for the temporary route includes the password. Same exposure as the password and email-change routes, already queued for `/gsd-secure-phase 5`.

## Authentication Gates

None.

## Known Stubs

None.

## Threat Flags

None. `POST /api/v1/users` and its trust boundaries are in the plan's threat model (T-05-53 to T-05-56): Manager-only policy and matrix rows (T-05-53), response `{ id }` only with tests on the response, mails, audit and idempotency record (T-05-54), creator from the token with a forged-field test (T-05-55), unique index mapped to the field error with a 20-run race (T-05-56).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

`POST /api/v1/users` is final and typed in `web/src/types/api.generated.ts` for the Add User panel (05-22). The shown-once step of the panel keeps the generated password in the browser only: the API never returns it. 05-27 (resend invitation) and 05-29 (Manager password reset) can reuse `InviteEmail` and the `Temporary` must-change path.

## Self-Check: PASSED

All created files exist on disk and commits e15943a, f90ddbd, 8c09859, 680b816, b364b3a, 77a229f and 7ad8389 are ancestors of HEAD.
