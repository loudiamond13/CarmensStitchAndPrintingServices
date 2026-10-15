---
phase: 04-identity-authentication
plan: 12
subsystem: auth
tags: [sign-in, timing-parity, lockout, ticket-cookie, two-factor-first-step, response-floor, auth-01, auth-02, auth-07, auth-10, audit-01, d-02, d-08, d-25, d-32, d-39]
status: complete
created: "2026-10-14T23:16:00-05:00"
updated: "2026-10-14T23:16:00-05:00"

requires: ["04-06", "04-08", "04-09", "04-10", "04-11", "04-33"]
provides:
  - "POST /api/v1/auth/sign-in: anonymous, no-store, 200 {resendAfterSeconds} + __Secure-csps_2fa ticket cookie, 400 field errors, one generic 401"
  - "SignInHandler (validate, one hash per branch, lockout, challenge + code MAC + code email, audit) with SignInRequest/Validator/Outcome and AuthErrors"
  - "AuthSettings (section Auth, D-39 defaults, ToTwoFactorSettings/ToSessionSettings/Validate), ResponseFloor.WaitAsync, ValidationResults.ToError"
  - "AuthCookies (RefreshCookieName __Secure-csps_rt, TicketCookieName __Secure-csps_2fa, CookiePath, SetTicket, ClearTicket), AuthRegistration.AddCspsAuth"
  - "Test helper AuthClient (https cookie clients, staff in 4 states, sign-in, sink reads) for later auth plans"
affects: [04-13, 04-14, 04-15, 04-16, 04-19, 04-24, 04-25, web sign-in page]

requirements-completed: [AUTH-01, AUTH-07]

actuals:
  tokens: 32000
  tasks: 3
  commits: 6
plan_head_before: 9b0d07d2a17b6246aeba1ac3223ef2b2bcecd03d
plan_head_after: 829199f761d6ae2cead665770145cf8539966dc6

tech-stack:
  added: []
  patterns:
    - "Every sign-in branch verifies exactly one hash (dummy for unknown or passwordless) and awaits ResponseFloor; blocked accounts verify the real hash but are never counted"
    - "ResponseFloor re-measures after each delay because a coarse Windows timer can fire up to ~15 ms early"
    - "Identity mutations first, then the tracked challenge, outbox and audit rows, one SaveChanges inside InTransactionAsync (Pitfall 13)"
    - "Failed-attempt audit goes through RecordIndependentlyAsync after the transaction; the lockout audit rides the transaction that locks"

key-files:
  created:
    - src/Csps.Application/Auth/AuthSettings.cs
    - src/Csps.Application/Auth/AuthErrors.cs
    - src/Csps.Application/Auth/SignInRequest.cs
    - src/Csps.Application/Auth/SignInRequestValidator.cs
    - src/Csps.Application/Auth/SignInHandler.cs
    - src/Csps.Application/Common/ResponseFloor.cs
    - src/Csps.Application/Common/ValidationResults.cs
    - src/Csps.Server/Controllers/SignInController.cs
    - src/Csps.Server/Security/AuthCookies.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - tests/Csps.Application.UnitTests/Auth/SignInHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/AuthSettingsTests.cs
    - tests/Csps.Application.UnitTests/Auth/SignInRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Common/ResponseFloorTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs
    - tests/Csps.Server.IntegrationTests/Auth/SignInEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/SignInTimingTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/LockoutTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/AuthRegistrationTests.cs
  modified:
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Program.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md

key-decisions:
  - "Lockout audit uses Record in the same unit of work as the failed count and the lockout email, so the entry exists exactly when the lock does; docs/operations/audit-log.md was changed from RecordIndependentlyAsync to match (the code-step lockout path is left to its plan)"
  - "State checks run before the password result: a deactivated, unconfirmed or locked account is never counted, even with a wrong password; a passwordless account takes the dummy hash"
  - "The handler has no logger, so no password, email or code can reach a log from it; the host log sink is checked in an integration test"
  - "Validation errors use camelCase field keys (email, password) from a reusable ValidationResults.ToError"
  - "AuthSettings is bound once at start and registered as a singleton value; an unusable value stops the start naming the setting only"
---

# Phase 4 Plan 12: Sign-in First Step Summary

Staff sign-in now works up to the code step: the right email and password answer 200 with a 60 second resend wait, set the `__Secure-csps_2fa` pending-login cookie and queue a "{six digits} is your CSPS sign-in code" email that says which browser asked. Every failure is one 401 with equal work and a 500 ms floor, five wrong passwords lock the account for 15 minutes with one plain email, and every attempt is audited without personal data.

## What was built

- **Tracer (Task 1):** `SignInController` (thin: `body ?? SignInRequest.Empty`, then `ToHttpResult` and the ticket cookie) calls `SignInHandler`, which validates, finds the account, checks the password once, resets the failed count, closes the user's open challenges, creates the challenge (`Persistent = KeepSignedIn`), its code MAC and the code email, records `auth.2fa-issued` and commits in one `InTransactionAsync`. Cookie: HttpOnly, Secure, SameSite Strict, Path `/api/v1/auth`, expiring with the 30 minute challenge. No refresh cookie exists yet. `AuthCookies` also fixes the refresh cookie name `__Secure-csps_rt` (D-38). The matrix row, allow-list key and API contract (`SignInRequest`, `SignInResponse`, `ProblemDetails`, the route) were refreshed; `npm --prefix tools/openapi-gen run check` passes.
- **Equal answers and timing (Task 2):** unknown email and passwordless accounts take `VerifyDummyPassword`; every other account takes the real `CheckPasswordAsync`. Deactivated, unconfirmed and locked accounts are checked but never counted; only a wrong password on an open account calls `RecordFailedPasswordAsync`. Six failures return the same `AuthErrors.InvalidCredentials`, and the six HTTP bodies are byte-identical apart from `traceId`.
- **Lockout, inactive accounts and audit (Task 3):** the failure that locks (`LockedNow`) queues one `AccountLockedEmail` (links to `/admin/forgot-password`, no token) and `auth.lockout` ("password") in the same transaction as the count. Further attempts while locked change nothing and send nothing. Every failure writes `auth.sign-in-failed` with its reason through `RecordIndependentlyAsync` (target `User` id only when the account exists).
- **Settings and helpers:** `AuthSettings` holds the D-39 limits and the reset and invite lifetimes for later plans, with `ToTwoFactorSettings`, `ToSessionSettings` and a `Validate` that names the setting. `ResponseFloor`, `ValidationResults` and the `AuthClient` test helper are reusable by 04-13 to 04-16.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | Right email and password produce a ticket cookie and a code email through the real stack | ce04a29 (RED), a9c32f2 |
| 2 | One generic answer and equal timing for every failure | d55bc0e (RED), 21cfdd9 |
| 3 | Lockout with one email, inactive accounts kept out, sign-in audit trail | 352db56 (RED), 829199f |

Tracer gate: interactive, `human_verify_mode` end-of-phase and an automated-only `<verify>`, so the three verify commands were re-run after the slice (SignInEndpointTests 11 passed, Authorization 75 passed, openapi check passed) before expanding. Tracer verified end-to-end, expanding.

## RED / GREEN evidence

- Task 1 RED: all 11 endpoint tests failed with 404 (no route). GREEN: 11 passed.
- Task 2 RED: 1 unit test failed (a wrong password was not counted), `ResponseFloorTests.WaitsAgainWhenTheTimerFiresEarly` failed, and the timing test failed. GREEN: all pass.
- Task 3 RED: 7 handler unit tests and 9 integration tests failed (audit detail null, no lockout email). GREEN: all pass.

## Timing test (real host, real 500 ms floor, 8 interleaved rounds)

| Branch | Median |
|--------|--------|
| unknown email | 507 ms |
| wrong password (fresh account per round) | 508 ms |
| deactivated | 505 ms |
| success | 509 ms |

Overall median 508 ms, min 502 ms, max 520 ms (final run). The spread between branch medians is 4 ms, against the 20% (about 100 ms) allowed. The first GREEN run of the test before the floor fix measured a minimum of 489 ms.

## Verification

- `dotnet build`: 0 warnings, 0 errors.
- Domain 576, Application 111, Architecture 127, Infrastructure integration 310 (309 passed, 1 skipped, 0 failed), Server integration 387: all green.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): Csps.Domain 100% line and branch; Csps.Application 100% line (286/286), branch 98% (not gated). PASS.
- Acceptance greps: `__Secure-csps_rt` and `__Secure-csps_2fa` in AuthCookies.cs, `EmptyBodyBehavior.Allow` in SignInController.cs, `POST /api/v1/auth/sign-in` in AuthorizationMatrix.cs, `SignInResponse` in api.generated.ts, `ResponseFloor.WaitAsync`, `VerifyDummyPassword`, `AccountLockedEmail` and `AuditActions.Lockout` in SignInHandler.cs: all present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The response floor could finish early**
- **Found during:** Task 2 RED (timing test measured a minimum of 489 ms against the 500 ms floor).
- **Issue:** `Task.Delay` uses a coarse Windows tick, so a delay of the remaining time can fire up to about 15 ms early and a response could be faster than the floor.
- **Fix:** `ResponseFloor.WaitAsync` re-measures after each delay and waits again for any rest. Covered by `ResponseFloorTests.WaitsAgainWhenTheTimerFiresEarly`, which uses a clock whose first timer fires 10 ms early.
- **Files modified:** src/Csps.Application/Common/ResponseFloor.cs
- **Commit:** 21cfdd9

**2. [Rule 2 - Missing critical] Lockout audit path and documentation**
- **Found during:** Task 3.
- **Issue:** `docs/operations/audit-log.md` (plan 04-03) listed `auth.lockout` as `RecordIndependentlyAsync`, while this plan's action says to record it in the same unit of work as the lockout email. An independent write could claim a lock that a rolled-back transaction never made.
- **Fix:** `Record` inside the transaction that counts the failure and queues the email; the doc row was updated to say so (the `code` lockout path is left to the code-verification plan).
- **Files modified:** src/Csps.Application/Auth/SignInHandler.cs, docs/operations/audit-log.md
- **Commit:** 829199f

### Plan interpretation

- Task 1 shipped the full success path but only a generic 401 for everything else (no counting, no audit); Task 2 added the branch table and counting with `auth.sign-in-failed` and a null detail; Task 3 added the reasons and the lockout. Each RED failed for the intended reason.
- The "no log record contains the password, the email or a code" check is an integration test on the host's log sink (`NoLogEventHoldsThePasswordOrTheEmail`). The handler has no logger, so a unit-level FakeLogger test would be vacuous.
- Extra files beyond the plan list: `ValidationResults.cs` (FluentValidation to `Error`), `AuthRegistrationTests.cs` (settings binding and cookie attributes), `AuthSettingsTests.cs`, `SignInRequestValidatorTests.cs`, `ResponseFloorTests.cs`, all to keep Application above the coverage gate and to test the pieces directly.
- The matrix row sends no body, so every caller meets the same 400 (the token is ignored for an anonymous route).

## Decisions for the owner

- `docs/operations/audit-log.md` now says `auth.lockout` for a password lockout is written with `Record` (atomic with the lock and its email) instead of the independent path. Revert is a one-line handler change if you prefer the independent path.
- AUTH-01 and AUTH-07 are ticked complete (generic answer, timing and the 5-failure 15-minute lock with its email are delivered). AUTH-02 (needs the code step), AUTH-10 (refresh and reset paths) and AUDIT-01 (the full event catalog) stay open.

## Known Stubs

None.

## Threat Flags

None. The new endpoint, the ticket cookie and the lockout email are the surfaces named in the plan's threat model (T-04-37 to T-04-41, all mitigated). Per-IP rate limiting for this route is plan 04-24.

## Notes for later plans

- 04-13 and 04-14 read the ticket from `__Secure-csps_2fa` (`AuthCookies.TicketCookieName`) and clear it with `AuthCookies.ClearTicket`; the controller route prefix `api/v1/auth` is shared, and `[ApiController]` classes in the same prefix may be split per resource.
- `AuthClient` in `tests/Csps.Server.IntegrationTests/Auth` creates staff in `Active`, `Deactivated`, `Unconfirmed` and `NoPassword` states, locks an account, signs in and reads the Testing sink; reuse it.
- Cross-ticket cap and resend limits (04-13, 04-14) should read `AuthSettings` for the numbers (`AccountFailureCap`, `SendsPerHour`, `ResendCooldown`).
- `UserAccounts.RecordFailedPasswordAsync` resets Identity's count when it locks, so `AccessFailedCount` reads 0 after a lockout; tests rely on `LockoutEnd`.

## Self-Check: PASSED

All twenty created files and six modified files exist, and the six commits (ce04a29, a9c32f2, d55bc0e, 21cfdd9, 352db56, 829199f) are ancestors of HEAD.
