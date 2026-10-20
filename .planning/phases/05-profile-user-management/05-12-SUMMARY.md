---
phase: 05-profile-user-management
plan: 12
subsystem: api
tags: [password-change, lockout, sessions, idempotency, audit, email, prof-03, d-41-q9]
created: 2026-10-18T00:38:00-05:00
updated: 2026-10-18T00:38:00-05:00

requires:
  - phase: 05-profile-user-management
    provides: "05-09 ProfileController; 05-06 profile/session groundwork; 05-38 AuditKey.Of and the profile audit pattern"
provides:
  - "POST /api/v1/profile/password (204): current password checked, full rule, other devices signed out, notice email, audit"
  - "ChangePasswordHandler, ChangePasswordRequest, ChangePasswordRequestValidator, ProfileErrors (WrongPassword, PasswordLocked)"
  - "SessionRevocationReason.PasswordChanged = 8"
  - "PasswordChangedEmail.OtherDevicesOnly and the 'every other device' email line"
  - "IdempotencyOutcome.KeepChanges: an endpoint can commit its change when its answer is not a stored one"
affects: [05-18 Security tab, 05-31 email review, 05-37 verification, 05-43]

actuals:
  tokens: 21000
  tasks: 3
  commits: 6
plan_head_before: 9c5a9c7dcd0f2c2255dce947d48ca21bce78ba63
plan_head_after: 6dc1ccb3573635362153bf0e105e20ffe5960341

tech-stack:
  added: []
  patterns:
    - "A wrong current password is a counted failure in its own transaction (count, lockout email and auth.lockout together), like sign-in"
    - "The current password is verified before the new one is judged, so 'same as current' and the breach lookup are never a guessing oracle"
    - "A 429 that follows a committed change opts out of the idempotency rollback with IdempotencyOutcome.KeepChanges"

key-files:
  created:
    - src/Csps.Application/Profile/ChangePasswordHandler.cs
    - src/Csps.Application/Profile/ChangePasswordRequest.cs
    - src/Csps.Application/Profile/ChangePasswordRequestValidator.cs
    - src/Csps.Application/Profile/ProfileErrors.cs
    - tests/Csps.Server.IntegrationTests/Profile/ChangePasswordTests.cs
    - tests/Csps.Application.UnitTests/Profile/ChangePasswordHandlerTests.cs
    - tests/Csps.Application.UnitTests/Profile/ChangePasswordRequestValidatorTests.cs
  modified:
    - src/Csps.Domain/Identity/SessionOutcomes.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Email/AuthEmail.cs
    - src/Csps.Infrastructure/Email/EmailRenderer.cs
    - src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs
    - src/Csps.Server/Security/IdempotencyMiddleware.cs
    - src/Csps.Server/Controllers/ProfileController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyProbeController.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md
    - docs/api/auth.md

key-decisions:
  - "PasswordChanged is stored as 8, not 6: AccountInactive = 6 and Expired = 7 already exist, and stored enum values are never renumbered"
  - "The current password is verified (and a failure counted) before the same-as-current check and the breach lookup, so neither can be used to guess the current password and a stolen session cannot spend breach lookups"
  - "auth.sessions-revoked (password-changed) is written only when another device was actually signed out, as sign-out-others does; auth.password-changed (profile) is always written"
  - "The lock-causing 429 commits its count through IdempotencyOutcome.KeepChanges instead of exempting the endpoint, so Idempotency-Key stays required (SEC-06)"
  - "The form's composition rules (length, control characters, number, symbol) live in the validator so they answer before any database work and mirror the web form (OR-3); name, email and breach rules stay in the handler"

patterns-established:
  - "ProfileErrors: profile-specific error values beside AuthErrors"
  - "IdempotencyOutcome.KeepChanges(HttpContext): commit the change, store no answer, let the key run again"

requirements-completed: [PROF-03]

coverage:
  - id: D1
    description: "A signed-in staff member changes their password from My Profile: 204, this device stays signed in, every other device's access and refresh tokens stop working, the new password signs in and the old one does not"
    requirement: "PROF-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ChangePasswordTests.cs#ChangingMyPasswordKeepsThisDeviceAndSignsOutTheOthers"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ChangePasswordTests.cs#TheNewPasswordSignsInAndTheOldOneDoesNot"
        status: pass
    human_judgment: false
  - id: D2
    description: "The full password rule applies to the new password (8 to 64, number, symbol, not name or email, not breached, not common; breach service down accepts with a recheck mark) and a new password equal to the current one is refused"
    requirement: "PROF-03"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Profile/ChangePasswordHandlerTests.cs#APolicyFailureIsAFieldErrorOnNewPasswordAndNothingIsSaved"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ChangePasswordTests.cs#ARefusedNewPasswordIsAFieldErrorOnNewPasswordAndChangesNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ChangePasswordTests.cs#WhenTheBreachServiceIsDownAnUncommonPasswordIsAcceptedAndMarkedForARecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-41 Q9: a wrong current password is a field error under currentPassword and counts toward the lockout; the fifth locks for 15 minutes with the lockout email and auth.lockout, answers 429 profile.password-locked with Retry-After, and a locked account is refused without a password check"
    requirement: "PROF-03"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Profile/ChangePasswordHandlerTests.cs#TheWrongPasswordThatLocksTheAccountAnswers429AndSendsTheOneLockoutEmail"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ChangePasswordTests.cs#FiveWrongCurrentPasswordsLockTheAccountLikeSignInDoes"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ChangePasswordTests.cs#TheLockoutSendsOneEmailAndWritesOneAuditEntry"
        status: pass
    human_judgment: false
  - id: D4
    description: "One notice email per change, with the line 'For your safety, every other device signed in to your account was signed out.' and the Reset Password button; auth.password-changed (profile) and auth.sessions-revoked (password-changed) are audited with fixed words only"
    requirement: "PROF-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs#PasswordChangedFromMyProfileNamesOnlyTheOtherDevices"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ChangePasswordTests.cs#TheChangeAndTheRevocationAreAuditedWithFixedWordsOnly"
        status: pass
    human_judgment: false
  - id: D5
    description: "The wording of the notice email and of the field errors is built as the UI-SPEC writes it but is not yet approved by the owner (D-48)"
    verification: []
    human_judgment: true
    rationale: "Owner wording review is scheduled for 05-31 (email) and 05-37 (screens); no test can approve wording"

duration: 26min
completed: 2026-10-18
status: complete
---

# Phase 5 Plan 12: Change password from My Profile Summary

**POST /api/v1/profile/password changes the caller's password after the current one is verified, signs out every other device, keeps this one, sends the notice email, and counts wrong current passwords toward the sign-in lockout, with a small opt-in on the idempotency gate so the lock-causing 429 is not rolled back.**

## Performance

- **Duration:** 26 min
- **Started:** 2026-10-18T00:09:00-05:00
- **Completed:** 2026-10-18T00:35:00-05:00
- **Tasks:** 3
- **Files modified:** 25 (7 created, 18 modified)

## Accomplishments

- PROF-03 holds end to end: device A changes the password and keeps working, device B's access token and refresh both answer 401, the new password signs in and the old one does not.
- D-41 Q9 is enforced: four wrong current passwords are 400s under `currentPassword`, the fifth locks the account for 15 minutes (one lockout email, one `auth.lockout` with detail `password`) and answers 429 `profile.password-locked` with `Retry-After`; while locked the endpoint answers the same 429 without checking the password.
- The notice email uses a new "every other device" sentence for a profile change; the audit gets `auth.password-changed` (profile) and `auth.sessions-revoked` (password-changed), fixed words only.
- The authorization matrix, the idempotency coverage test, the OpenAPI snapshot and the generated web types all include the new endpoint.

## Task Commits

TDD gate sequence (RED then GREEN for each task):

1. **Task 1 (tracer): change my password, other devices signed out**
   - RED `47e77ad` test(05-12): change my password from My Profile (RED)
   - GREEN `4d88705` feat(05-12): change password from My Profile; other devices signed out (PROF-03)
2. **Task 2: wrong current passwords count toward the lockout**
   - RED `63fe001` test(05-12): wrong current passwords count toward the lockout (RED)
   - GREEN `79818e4` feat(05-12): current-password failures count toward the lockout (D-41 Q9)
3. **Task 3: password-changed email names other devices**
   - RED `13ad307` test(05-12): other-devices line in the password-changed email (RED)
   - GREEN `6dc1ccb` feat(05-12): password-changed email names other devices for a profile change

**Plan metadata:** the docs commit that holds this summary (see git log).

## TDD Gate Compliance

All three tasks have a `test(05-12)` commit before the `feat(05-12)` commit. No REFACTOR commit was needed.

RED evidence (the project runs xunit.v3 on Microsoft Testing Platform, whose console output is not one of the report formats `gsd check tdd-red-evidence` reads, so the evidence is the actual runs below with a semantic check):

- **Task 1:** `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ChangePasswordTests"` failed 7 tests, each on its target assertion (204 or 401 expected, 404 received, because the route did not exist); the 12 other tests matched by the filter passed. `AuditActionsTests.LockoutAndSessionRevokeDetailsAreFixed` failed on the missing `password-changed` detail. Semantic assessment: the target tests ran and failed on the planned status assertions.
- **Task 2:** `ChangePasswordHandlerTests` failed 5 of 46 (wrong password not counted, lock not applied, already-locked account still checked, no 429), and `ChangePasswordTests` failed the two lockout tests; the characterization tests for the rule, breach, session and retry behavior built in Task 1 passed, as expected. Semantic assessment: every failure was on the planned lockout assertion.
- **Task 3:** `EmailRendererTests` failed 1 of 48 (`PasswordChangedFromMyProfileNamesOnlyTheOtherDevices`), on the missing sentence.

## Files Created/Modified

- `src/Csps.Application/Profile/ChangePasswordHandler.cs` - the use case: ids, validation, lockout check, current-password check and count, same-as-current, full rule, one transaction for password, failed-count reset, breach mark, other-session revocation, notice email and audit; user evicted from the session cache after commit.
- `src/Csps.Application/Profile/ChangePasswordRequest.cs`, `ChangePasswordRequestValidator.cs`, `ProfileErrors.cs` - the form, its client-mirrored rules, and the 400 / 429 error values.
- `src/Csps.Server/Controllers/ProfileController.cs` - `POST password` with the Reset rate limit; opts into `IdempotencyOutcome.KeepChanges` for the locked answer.
- `src/Csps.Server/Security/IdempotencyMiddleware.cs`, `src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs` - `IdempotencyOutcome.KeepChanges` and `IdempotencyLease.CommitWithoutRecordAsync`.
- `src/Csps.Domain/Identity/SessionOutcomes.cs`, `AuditActions.cs`, `src/Csps.Application/Email/AuthEmail.cs`, `src/Csps.Infrastructure/Email/EmailRenderer.cs` - the stored reason, the audit detail, the email flag and sentence.
- `tools/openapi-gen/openapi.v1.json`, `web/src/types/api.generated.ts` - refreshed contract.
- `docs/operations/audit-log.md`, `docs/api/auth.md` - the new events and the new error code.
- Tests: `ChangePasswordTests` (16 integration), `ChangePasswordHandlerTests` and `ChangePasswordRequestValidatorTests` (unit), idempotency probe and tests for `KeepChanges`, the matrix row, the renderer cases.

## Decisions Made

See `key-decisions` above. The main one is keeping `Idempotency-Key` required and adding a narrow opt-in to the gate, rather than exempting the endpoint, because the plan and SEC-06 require the key and the rest of the gate (rollback of every other 401, 403, 409, 429, 5xx) stays unchanged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] PasswordChanged stored as 8, not 6**
- **Found during:** Task 1 (GREEN)
- **Issue:** The plan says to append `PasswordChanged = 6`, but `SessionRevocationReason` already has `AccountInactive = 6` and `Expired = 7`. Reusing 6 would clash and change stored data.
- **Fix:** Appended `PasswordChanged = 8`. The test pins the stored value with `(SessionRevocationReason)8`.
- **Files modified:** `src/Csps.Domain/Identity/SessionOutcomes.cs`, `tests/Csps.Server.IntegrationTests/Profile/ChangePasswordTests.cs`
- **Verification:** `grep -cE "PasswordChanged[[:space:]]*=[[:space:]]*8"` is 1. The plan's literal acceptance check (`= 6`) cannot hold by design.
- **Committed in:** `4d88705`

**2. [Rule 1 - Bug] The idempotency gate rolled back the lock-causing wrong password**
- **Found during:** Task 2 (GREEN, integration RED stayed red after the handler change)
- **Issue:** `IdempotencyMiddleware` wraps every covered POST in a transaction and rolls it back for 401, 403, 409, 429 and 5xx. The fifth wrong current password answered 429 but its failed count, lockout, email and audit entry were all discarded, so the account never locked.
- **Fix:** Added `IdempotencyOutcome.KeepChanges(HttpContext)` and `IdempotencyLease.CommitWithoutRecordAsync`. The profile controller calls it only for `profile.password-locked`; the middleware then commits the change but stores no answer, so the key may run again. Every other behavior of the gate is unchanged (the existing "429 loses its row" test still passes). Two probe-based tests cover the new path.
- **Files modified:** `src/Csps.Server/Security/IdempotencyMiddleware.cs`, `src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs`, `src/Csps.Server/Controllers/ProfileController.cs`, `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyProbeController.cs`, `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs`
- **Verification:** `*Idempotency*` (46 tests) and `ChangePasswordTests` (16) pass; `FiveWrongCurrentPasswordsLockTheAccountLikeSignInDoes` shows the lock persisting.
- **Committed in:** `79818e4`
- **For review:** this touches shared security middleware. It is additive and opt-in, but the owner/security review (`/gsd-secure-phase 5`) should look at it.

**3. [Rule 1 - Ordering] Current password verified before the same-as-current check and the breach lookup**
- **Found during:** Task 1 design
- **Issue:** The plan lists the rule check before the transaction that verifies the current password, and the WR-01 "same as current" check in SetNewPassword is done by a password lookup. Run first, either would let a stolen session test guesses against the current password without counting them (CWE-307), and a wrong password would still spend a breach lookup.
- **Fix:** Order is validation, lockout check, current-password check (counted), same-as-current by comparing the two NFC-normalized strings (no lookup), full rule (breach lookup still outside the transaction), then the transaction.
- **Files modified:** `src/Csps.Application/Profile/ChangePasswordHandler.cs`
- **Verification:** `ASamePasswordGuessCannotProbeTheCurrentPassword`, `AWrongCurrentPasswordNeverReachesTheBreachLookup`, `TheBreachLookupRunsBeforeTheTransaction`.
- **Committed in:** `4d88705`, `79818e4`

**4. [Rule 3 - Blocking] Validator registered in AuthRegistration, not ApplicationRegistration**
- **Found during:** Task 1
- **Issue:** All request validators are registered in `AuthRegistration.cs`; the plan only listed `ApplicationRegistration.cs`.
- **Fix:** Handler in `ApplicationRegistration.cs`, validator in `AuthRegistration.cs`.
- **Committed in:** `4d88705`

**5. [Rule 2 - Missing] 429 added to the endpoint contract and the docs**
- **Found during:** Task 2
- **Issue:** The new 429 was not declared with `ProducesResponseType`, so the OpenAPI snapshot and generated types did not show it.
- **Fix:** Added the attribute, refreshed the snapshot and types, and added `profile.password-locked` to `docs/api/auth.md`.
- **Committed in:** `79818e4`

---

**Total deviations:** 5 auto-fixed (3 Rule 1, 1 Rule 2, 1 Rule 3)
**Impact on plan:** All needed for correctness or to make the plan's own lockout tests pass. The shared-middleware change (item 2) is the one that goes beyond the plan's file list and should get a reviewer's eye.

## Issues Encountered

- The plan's `[Rule 1]` checks for the lockout test could not pass until the idempotency rollback was found (a debug run showed `AccessFailedCount` still 4 after the fifth attempt returned 429).
- `Retry-After` first came out as 901 because the wait was measured from the start of the request; it is now measured at answer time (at most 900).

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: stored-body-hash | src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs | `RequestHash` is an unsalted SHA-256 over a body that holds both passwords for this endpoint (and for reset and invite accept); recorded in `deferred-items.md` for the security review. |

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The Security tab (05-18) can call `POST /api/v1/profile/password` with a fresh `Idempotency-Key` per submission; a 400 carries `errors.currentPassword` or `errors.newPassword`, a 429 carries `code: profile.password-locked` and `Retry-After`.
- The notice-email wording ("every other device") is built as the UI-SPEC writes it and is waiting for the owner's wording review in 05-31 (D-48).
- Full suites at the end of this plan: Server integration 737, Application 466, Domain 591, Infrastructure integration 465, Architecture 217 tests, all passing; `npm --prefix tools/openapi-gen run check` passes.

## Self-Check: PASSED

- Created files exist (checked with `[ -f ]`): the four Application files, the three test files and this summary.
- Commits exist on the branch: `47e77ad`, `4d88705`, `63fe001`, `79818e4`, `13ad307`, `6dc1ccb`.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
