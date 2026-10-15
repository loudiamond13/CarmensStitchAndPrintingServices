---
phase: 04-identity-authentication
plan: 19
subsystem: auth-password-recovery
tags: [reset-password, reset-link, account-tokens, session-revocation, breach-floor, lockout, auth-08, auth-09, auth-10, auth-11, audit-01, d-14, d-17, d-18, d-19]
status: complete
created: "2026-10-15T01:50:00-05:00"
updated: "2026-10-15T01:50:00-05:00"

requires: ["04-18", "04-17", "04-13", "04-09", "04-08", "04-03"]
provides:
  - "POST /api/v1/auth/password/reset/check {token} (anonymous, no-store): 200 {email} for a usable link, otherwise the one 404 auth.link-invalid 'This link has expired'"
  - "POST /api/v1/auth/password/reset {token, newPassword} (anonymous, no-store): 204 with no body and no cookie; 400 on newPassword for a refused password; 404 auth.link-invalid; 409 only after two lost races"
  - "CheckResetLinkHandler, ResetPasswordHandler, ResetLinkLookup (shared token lookup), ResetTokenRequest, ResetLinkResponse, ResetPasswordRequest and its validator, AuthErrors.LinkInvalid and NewPasswordRejected"
  - "Audit auth.password-reset-completed, auth.sessions-revoked (detail password-reset), auth.breach-check-unavailable on a skipped breach check, auth.password-reset-link-invalid (independent, no target, no detail)"
  - "Test support: AuthClient.CheckResetLinkAsync, ResetPasswordAsync, RequestResetTokenAsync; FakeUnitOfWork.Commits and Rollbacks; RecordingOutbox.FailWith"
affects: [04-20, 04-24, 04-27, web reset-password page]

requirements-completed: []

actuals:
  tokens: 16000
  tasks: 2
  commits: 4
plan_head_before: e9ae0437ab5966aa2af72a5d6c6acf9755e83eed
plan_head_after: d94cdc2da52320b1f7cb5929cecbc229dfd29090

tech-stack:
  added: []
  patterns:
    - "A reset spends the link and saves it first inside the transaction, so a second request on the same link loses on the token row-version before any other change; the loser rereads and gets the invalid-link answer"
    - "The session cache is evicted only after the transaction commits, so a rolled-back reset never evicts and a request cannot re-cache 'active' for a session about to be revoked"
    - "Every link failure (malformed, missing, unknown, used, revoked, expired, deactivated, unconfirmed) is one code path returning the same 404, audited independently without a target"

key-files:
  created:
    - src/Csps.Application/Auth/ResetTokenRequest.cs
    - src/Csps.Application/Auth/CheckResetLinkHandler.cs
    - src/Csps.Application/Auth/ResetLinkLookup.cs
    - src/Csps.Application/Auth/ResetPasswordRequest.cs
    - src/Csps.Application/Auth/ResetPasswordRequestValidator.cs
    - src/Csps.Application/Auth/ResetPasswordHandler.cs
    - tests/Csps.Application.UnitTests/Auth/ResetPasswordHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/CheckResetLinkHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/PasswordResetTests.cs
  modified:
    - src/Csps.Application/Auth/AuthErrors.cs
    - src/Csps.Server/Controllers/PasswordController.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs
    - tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs
    - tests/Csps.Application.UnitTests/Auth/AuthTestDoubles.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "An unconfirmed account (invited, not yet accepted) reads as an invalid link on check and reset, matching 04-18 where it gets no link: a reset must not let anyone skip the invitation step"
  - "auth.sessions-revoked (detail password-reset) is recorded on every completed reset, even when the account had no session, because the plan's truth lists it as part of the reset; sign-out-others records it only when something was revoked"
  - "A reset that loses two races in a row answers 409 auth.session-busy (the existing 'Something changed at the same time. Try again.' answer); the first lost race is retried and reads the spent link as 404 auth.link-invalid"
  - "Link-invalid audit entries are written through the independent path after the transaction closes, so they survive rollback and never join the reset's transaction"
  - "A missing password is the only field error before the lookup (400 'Enter a new password.'); the rest of the password rule runs in PasswordRules, so browser and server messages match"

duration: 14 min
completed: 2026-10-15
---

# Phase 4 Plan 19: Reset Password Summary

A staff member with an emailed reset link can have it checked (it names the account or says "This link has expired" for every kind of bad link), then set a new password under the full rule, which spends the link once, ends every session and any lockout, clears the must-change flag, queues "Your CSPS password was changed" and audits it, all in one transaction and without signing anyone in.

## What was built

- **Tracer (Task 1):** `POST /api/v1/auth/password/reset/check` and `POST /api/v1/auth/password/reset` on `PasswordController`, `CheckResetLinkHandler`, `ResetPasswordHandler`, the request records and validator, `AuthErrors.LinkInvalid`, matrix rows (check: 404 for all three callers with an empty body; reset: 400) with both allow-list keys, and the refreshed OpenAPI snapshot and TS types. The HTTP tracer test goes from an emailed link through check, reset (204, no body, no cookie), the "changed" email, a refused old password and a full sign-in with the new password through the code step, plus the audit entry.
- **Invalid links (Task 2):** a malformed, missing, unknown, used, revoked, expired (exactly 30:00 is expired), deactivated or unconfirmed-account link all read as the same 404 `auth.link-invalid`, audited with `auth.password-reset-link-invalid` (independent, no target, no token). Check and reset share `ResetLinkLookup`.
- **Full password rule (AUTH-11):** `PasswordRules` runs with the user's own email and names and `FailOpenWithFloor`: personal-information and length failures, a breached password and (service down) a common password are 400 on `newPassword` and leave the link unspent; service down plus an uncommon password is accepted, sets `BreachRecheckPending` and audits `auth.breach-check-unavailable`; otherwise any earlier recheck mark is cleared.
- **Every effect in one transaction:** link spent and saved first, other reset links revoked, new password and security stamp, lockout cleared, must-change cleared, all sessions revoked (the asking one included, reason PasswordReset), changed email queued with the "every device was signed out" line, `auth.password-reset-completed` and `auth.sessions-revoked`. An exception anywhere rolls back and evicts nobody; on success the user is evicted from the session cache after the commit.
- **Concurrency:** two simultaneous resets with the same link give exactly one 204 and one 404 (HTTP test); a lost first race is retried and reads the spent link, two lost races give 409.

## Verification

| Check | Result |
| --- | --- |
| Csps.Domain.UnitTests | 590 passed |
| Csps.Application.UnitTests | 276 passed (37 new, in ResetPasswordHandlerTests and CheckResetLinkHandlerTests) |
| Csps.ArchitectureTests | 127 passed |
| Csps.Server.IntegrationTests | 530 passed (23 new across PasswordResetTests, InactiveAccountTests and the matrix; matrix and OpenAPI snapshot included) |
| Csps.Infrastructure.IntegrationTests | 322 passed, 1 skipped (the live HIBP test, by design) |
| Coverage gate | Domain 100% line and branch; Application 99.6% line (rule 95%) |
| `npm --prefix tools/openapi-gen run check` | Generated API types match the snapshot |
| Build | 0 warnings, 0 errors |
| Acceptance greps | reset/check in controller 1, auth.link-invalid in AuthErrors 1, ResetLinkResponse in api.generated.ts 2, ClearLockoutAsync 1, MarkBreachRecheckAsync 1, SessionRevocationReason.PasswordReset 1 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Unconfirmed accounts read as invalid links**
- **Found during:** Task 1 (link lookup).
- **Issue:** The plan names only deactivated accounts. An invited account whose email is not confirmed could otherwise reset its way past the invitation step (04-18 already gives such accounts no link).
- **Fix:** `ResetLinkLookup` requires `IsActive` and `EmailConfirmed`; unit and HTTP cases cover both.
- **Commit:** 4b866d3

**2. [Rule 2 - Missing critical] Link spent and saved before other changes**
- **Found during:** Task 1 (design against Pitfall 13: Identity saves on the shared context).
- **Issue:** Identity's `UserManager` saves immediately, so a lost race on the token row would surface as an Identity failure (a 500) after the password was already touched.
- **Fix:** the link is marked used, other reset links are revoked and a `SaveChangesAsync` runs first, so the race surfaces as a `ConcurrencyConflictException` that `ConflictRetry` turns into the invalid-link answer.
- **Commit:** 4b866d3

**3. [Rule 1 - Bug] Token shape check rejected canonical-looking test tokens**
- **Found during:** Task 2 (RED run).
- **Issue:** the first lookup used `Base64Url.IsValid`, which is stricter than "43 base64url characters" (it also checks the trailing bits), so a 43-character token with other trailing bits was refused before the hash was compared.
- **Fix:** the shape check is exactly 43 characters of `A-Z a-z 0-9 - _`; the hash match decides the rest.
- **Commit:** d94cdc2

**4. [Process] Task 1 delivered the whole handler**
- The plan describes Task 1 as the happy path and Task 2 as the remaining branches. The handler was written complete in Task 1, so the Task 2 RED commit has failing unit tests only through the token-shape issue above (15 of 37 failed); all of its HTTP tests already passed against the Task 1 code. The tests still pin every Task 2 behavior.

### Plan files touched beyond the list
- `src/Csps.Application/Auth/ResetLinkLookup.cs` (shared lookup), `tests/Csps.Application.UnitTests/Auth/CheckResetLinkHandlerTests.cs`, `tests/Csps.Application.UnitTests/Auth/AuthTestDoubles.cs` (commit and rollback counters, outbox failure switch) and `tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs` (reset helpers). `ResetLinkResponse` lives in `ResetTokenRequest.cs`.

## Decisions for the owner

None blocking. For awareness:

1. **Unconfirmed (invited, not yet accepted) accounts cannot use a reset link**, in line with 04-18. If invited staff who lost their invite should be able to recover through "Forgot password", a reset would need to confirm the email too.
2. **A pending sign-in code challenge started with the old password is not closed by a reset.** Finishing it still needs the emailed code, which goes to the account's own mailbox. Closing open challenges on reset is a small follow-up if you want it.
3. **Invalid reset answers have no timing floor.** The token is 256 bits, so there is nothing to enumerate; per-IP limits come in plan 04-24.

## Threat Flags

None. The two endpoints are the ones in T-04-66 to T-04-69; each mitigation has a test (single use, 30:00 expiry, same invalid answer, session revocation on pre-existing sessions, deactivated account stays deactivated, atomic rollback).

## Known Stubs

None.

## Self-Check: PASSED

- Files: `ResetTokenRequest.cs`, `CheckResetLinkHandler.cs`, `ResetLinkLookup.cs`, `ResetPasswordRequest.cs`, `ResetPasswordRequestValidator.cs`, `ResetPasswordHandler.cs`, `ResetPasswordHandlerTests.cs`, `CheckResetLinkHandlerTests.cs` and `PasswordResetTests.cs` exist.
- Commits: 2c4089a, 4b866d3, 0bb2042 and d94cdc2 are on branch gsd/phase-04-identity-authentication (`git rev-list --count e9ae043..HEAD` is 4).
