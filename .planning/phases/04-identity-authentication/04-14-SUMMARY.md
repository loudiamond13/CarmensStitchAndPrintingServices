---
phase: 04-identity-authentication
plan: 14
subsystem: auth
tags: [two-factor, verify-code, resend, cross-ticket-cap, anti-csrf, refresh-cookie, must-change-handoff, auth-02, auth-03, auth-04, auth-05, audit-01, d-03, d-10, d-13, d-39]
status: complete
created: "2026-10-14T23:56:00-05:00"
updated: "2026-10-14T23:56:00-05:00"

requires: ["04-05", "04-08", "04-11", "04-12", "04-13"]
provides:
  - "POST /api/v1/auth/two-factor/verify: ticket cookie + emailed code -> 200 {next: signed-in, session} with the __Secure-csps_rt cookie, or {next: set-new-password, reason} with no session"
  - "POST /api/v1/auth/two-factor/resend: 200 {resendAfterSeconds: 60}, 429 auth.resend-cooldown (Retry-After) or auth.resend-cap (no wait time)"
  - "VerifyCodeHandler (ticket check, wrong/used-up/expired answers, cross-ticket cap with lock + email, must-change hand-off, session start) and ResendCodeHandler"
  - "RequireCsrfHeaderAttribute: X-CSPS-CSRF: 1 and Sec-Fetch-Site same-origin on every cookie-reading auth action (403 auth.csrf-check-failed)"
  - "AuthCookies.SetRefresh/ClearRefresh; AuthErrors for every code, ticket, CSRF and resend answer; AuthSettings.CodeLockoutDuration"
  - "Test support: AuthClient.ReadCodeAsync/VerifyAsync/ResendAsync/WithClock/RequirePasswordChangeAsync/DeactivateAsync, SteppedClock, AuthTestDoubles"
affects: [04-15, 04-16, 04-21, 04-24, web sign-in code page]

requirements-completed: [AUTH-02, AUTH-03, AUTH-04]

actuals:
  tokens: 118000
  tasks: 3
  commits: 6
plan_head_before: 793718b3571952d7877a64f1c63a53c89b4bc4c4
plan_head_after: a5d9e6684e3707836b261f59d9550fc8ee0f410d

tech-stack:
  added: []
  patterns:
    - "Code errors are 400 Validation errors on field code, so the page can show them under the boxes; the cap is a 429 with no Retry-After"
    - "The failed try commits before the answer; the failed/exhausted audit goes through RecordIndependentlyAsync, the lockout audit rides the lock transaction"
    - "The cross-ticket cap is evaluated for any attempt that recorded a new failure, before the used-up message, so the 10th wrong code wins"
    - "Cookie-reading actions carry [RequireCsrfHeader], an async authorization filter that writes the shared ProblemDetails answer"
    - "Minute-scale rules are tested over HTTP with SteppedClock: UTC time moves only when the test says, timers stay real"

key-files:
  created:
    - src/Csps.Application/Auth/VerifyCodeRequest.cs
    - src/Csps.Application/Auth/VerifyCodeRequestValidator.cs
    - src/Csps.Application/Auth/VerifyCodeOutcome.cs
    - src/Csps.Application/Auth/VerifyCodeHandler.cs
    - src/Csps.Application/Auth/ResendCodeHandler.cs
    - src/Csps.Server/Security/RequireCsrfHeaderAttribute.cs
    - tests/Csps.Application.UnitTests/Auth/VerifyCodeHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/ResendCodeHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/AuthTestDoubles.cs
    - tests/Csps.Server.IntegrationTests/Auth/VerifyCodeEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/CrossTicketCapTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/ResendCodeEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/CsrfHeaderTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/SteppedClock.cs
  modified:
    - src/Csps.Application/Auth/AuthErrors.cs
    - src/Csps.Application/Auth/AuthSettings.cs
    - src/Csps.Application/Auth/SessionIssuer.cs
    - src/Csps.Server/Controllers/SignInController.cs
    - src/Csps.Server/Security/AuthCookies.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs
    - tests/Csps.Application.UnitTests/Auth/AuthSettingsTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md

key-decisions:
  - "IssuedSession gained a SessionId member so auth.signed-in can target the UserSession id (audit-log.md says UserSession); the handler cannot read it from the request context before the caller is authenticated"
  - "The code cap lock length is AuthSettings.CodeLockoutDuration (default 15 minutes, validated), not a literal; Identity's own password lockout stays at its configured 15 minutes"
  - "A locked or deactivated account's ticket answers 401 auth.ticket-expired on verify and resend, like a closed challenge, so a pending ticket cannot outlive a lock"
  - "An expired code answers 400 and writes no audit entry and no failed try (nothing was guessed); only wrong and used-up tries are audited"
  - "RequireCsrfHeader is an authorization filter (runs before model binding), so a cross-site call is refused before any body is read"

patterns-established:
  - "Tests that need minute-scale time over HTTP derive a host with AuthClient.WithClock(factory, new SteppedClock())"

coverage:
  - id: D1
    description: "A correct code starts a session whose refresh cookie matches the chosen kind; the access token works on the API"
    requirement: "AUTH-02"
    verification:
      - "VerifyCodeEndpointTests.ACorrectCodeStartsAPersistentSession, ABrowserSessionCookieHasNoExpiryAndTheSessionLastsTwelveHours"
  - id: D2
    description: "Wrong, used-up and expired codes, single use, another user's and superseded codes never verify"
    requirement: "AUTH-03"
    verification:
      - "VerifyCodeEndpointTests wrong/five-wrong/expired/another-user/superseded cases; VerifyCodeHandlerTests"
  - id: D3
    description: "The 10th wrong code across sign-ins locks 15 minutes, cancels open sign-ins and queues one lockout email"
    requirement: "AUTH-03"
    verification:
      - "CrossTicketCapTests.TenWrongCodesAcrossTwoSignInsLockTheAccount, NineWrongCodesDoNotLockTheAccount, WrongCodesOfOneAccountNeverLockAnother"
  - id: D4
    description: "Resend: 60 s cooldown with Retry-After, 5 codes an hour with no wait time, only the newest code works"
    requirement: "AUTH-04"
    verification:
      - "ResendCodeEndpointTests; ResendCodeHandlerTests"
  - id: D5
    description: "Must-change accounts stop after the code with no session and no cookie"
    requirement: "AUTH-02"
    verification:
      - "VerifyCodeEndpointTests.AMustChangeAccountGetsTheHandOffAndNoSession; VerifyCodeHandlerTests"
  - id: D6
    description: "Cookie-reading endpoints need X-CSPS-CSRF: 1 and a same-origin fetch"
    requirement: "AUTH-05"
    verification:
      - "CsrfHeaderTests; ResendCodeEndpointTests.ResendWithoutTheHeaderIsRefused; Authorization matrix sends the header"
---

# Phase 4 Plan 14: The Code Step and Resend Summary

Staff sign-in now finishes: the emailed six-digit code turns the pending ticket into a session whose refresh cookie lasts 90 days or ends with the browser, wrong codes are capped per code and per account across sign-ins, Resend Code follows the 60 second and five-an-hour rules, and every cookie-reading auth endpoint needs the anti-CSRF header.

## What was built

- **Tracer (Task 1):** `POST /api/v1/auth/two-factor/verify` reads `__Secure-csps_2fa`, validates the code (`Enter all 6 digits.`), and for a correct code completes the challenge, starts the session through `SessionIssuer`, writes `auth.2fa-verified` (target `User`) and `auth.signed-in` (target `UserSession`) in one save, clears the ticket cookie and sets `__Secure-csps_rt` (HttpOnly, Secure, SameSite=Strict, Path `/api/v1/auth`; expiry only for "Keep me signed in"). `RequireCsrfHeaderAttribute` was added and the matrix now sends `X-CSPS-CSRF: 1` on every request. The returned access token reads `/api/v1/site-settings` with 200.
- **Code errors and the cap (Task 2):** wrong, used-up and expired codes are 400 on field `code` with the UI-SPEC wording. The wrong try is saved before the answer, and failed/exhausted audits use the independent path. The failure count across all of the account's sign-ins in the last hour decides the cap: the tenth wrong code (even one that also uses a code up) cancels every open challenge, locks 15 minutes, queues one `AccountLockedEmail` (cause: sign-in codes), writes `auth.lockout` detail `code` and answers 429 `auth.code-lockout` with no Retry-After. A must-change account (Temporary or Breach) moves the challenge to AwaitingNewPassword after a correct code and answers `{next: set-new-password, reason}` with no session, no refresh cookie and the ticket kept.
- **Resend (Task 3):** `POST /api/v1/auth/two-factor/resend` uses the Domain `CheckResend` (cap before cooldown) over the durable count of codes sent in the last hour. Allowed: new code (the old one is superseded), one `SignInCodeEmail`, `auth.2fa-resent`, 200 `{resendAfterSeconds: 60}`. Cooling down: 429 `auth.resend-cooldown` with whole-second `Retry-After`. Cap: 429 `auth.resend-cap` "You've asked for too many codes." with no wait time (D-10).

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | Sign in, read the code from the sink, verify it, use the access token | 3dfdf7e (RED), 16e09a6 |
| 2 | Code errors, cross-ticket cap with lockout email, must-change hand-off | 1a00111 (RED), 0b3ef81 |
| 3 | Resend cooldown, hourly cap, supersede | fb853a1 (RED), a5d9e66 |

Tracer gate: interactive, `human_verify_mode` end-of-phase and automated-only `<verify>`, so the three verify commands were re-run before expanding (VerifyCodeEndpointTests 12, CsrfHeaderTests 9, Authorization 78, all passed). Tracer verified end-to-end, expanding.

## RED / GREEN evidence

- Task 1 RED: 12 verify tests and 9 CSRF tests failed with 404; GREEN: all pass.
- Task 2 RED: `VerifyCodeHandlerTests` did not compile (the handler had no outbox yet); 7 of 19 endpoint tests and all 3 cap tests failed on the placeholder 401. GREEN: unit 143, endpoint 19, cap 3 pass.
- Task 3 RED: `ResendCodeHandlerTests` did not compile (no handler); 5 resend tests and 5 matrix cases failed with 404. GREEN: unit 158, resend 5 pass.

## Verification

- `dotnet build`: 0 warnings, 0 errors.
- Domain 576, Application 158, Architecture 127, Infrastructure integration 321 (320 passed, 1 skipped), Server integration 444: all green after the preflight.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): Csps.Domain 100% line and branch; Csps.Application 100% line (462/462), branch 98.9% (not gated). PASS.
- `npm --prefix tools/openapi-gen run check` passes; `OpenApiSnapshotTests` pass against the refreshed snapshot.
- Acceptance greps: `two-factor/verify`, `two-factor/resend`, `RequireCsrfHeader` in SignInController.cs; `VerifyCodeResponse` and `ResendCodeResponse` in api.generated.ts; `LockoutCause.Code`, `RequirePasswordChange` and `AccountCapReached` in VerifyCodeHandler.cs; the UI-SPEC messages and `auth.resend-cap` in AuthErrors.cs: all present.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] Session id for the signed-in audit entry**
- **Found during:** Task 1.
- **Issue:** `docs/operations/audit-log.md` says `auth.signed-in` targets the `UserSession` id, but `IssuedSession` (plan 04-13) did not expose the new session's id and the request is not yet authenticated.
- **Fix:** added `SessionId` to `IssuedSession` (set by `SessionIssuer`).
- **Files modified:** src/Csps.Application/Auth/SessionIssuer.cs
- **Commit:** 16e09a6

**2. [Rule 2 - Missing critical] Configurable code-cap lock length**
- **Found during:** Task 2.
- **Issue:** the 15 minute lock for the cross-ticket cap needs a value; Identity's lockout length is fixed in `IdentityRegistration` and not reachable from the handler.
- **Fix:** `AuthSettings.CodeLockoutDuration` (default 15 minutes, validated, tested), so the limit is a setting like its neighbours.
- **Files modified:** src/Csps.Application/Auth/AuthSettings.cs, tests/Csps.Application.UnitTests/Auth/AuthSettingsTests.cs
- **Commit:** 0b3ef81

**3. [Rule 2 - Missing critical] Locked or deactivated accounts cannot finish a pending sign-in**
- **Found during:** Task 2 (T-04-46).
- **Issue:** the plan names an inactive user as 401; a pending ticket would also outlive a password lockout set after the code was sent.
- **Fix:** verify and resend treat a locked account like an inactive one (401 `auth.ticket-expired`).
- **Commit:** 0b3ef81, a5d9e66

### Plan interpretation

- Task 1 treats every outcome other than a correct code as 401 (fail closed) until Task 2 added the real answers; the RED for Task 2 and 3 unit tests is a compile failure, because the handler constructors those tests need did not exist yet.
- The `docs/operations/audit-log.md` `auth.lockout` row now also describes the `code` path as written with `Record` in the lock transaction.
- The matrix rows for verify and resend expect 401 for all callers (no ticket cookie), as planned; both carry `X-CSPS-CSRF: 1` from the matrix tests.
- The CSRF theory in `CsrfHeaderTests` covers the verify route; the resend route's missing-header refusal is in `ResendCodeEndpointTests` (the route lands in Task 3).

## Decisions for the owner

- AUTH-02, AUTH-03 and AUTH-04 are ticked complete (server behavior delivered; the sign-in code page comes in the web plans, as with AUTH-01 in 04-12). AUTH-05 stays open until refresh rotation (04-15) and AUDIT-01 stays open until the full event catalog is written.
- The resend cooldown answer uses the plain text "Wait a moment before asking for another code." (UI-SPEC has no wording for it; the page shows a countdown from `Retry-After`). Change `AuthErrors.ResendCooldownMessage` if you want other words.
- An expired code does not count as a wrong try and writes no audit entry. If you want expired attempts audited as `auth.2fa-failed`, it is a one-line change in `VerifyCodeHandler`.

## Known Stubs

None.

## Threat Flags

None. The two endpoints, the refresh cookie and the CSRF filter are the surfaces in the plan's threat model (T-04-46 to T-04-49, all mitigated: cross-ticket cap tested over two sign-ins, header and Sec-Fetch-Site checks tested, resend limits durable, no code or ticket in audits). Per-IP limits for these routes are plan 04-24.

## Notes for later plans

- 04-15 (refresh) and later cookie-reading endpoints add `[RequireCsrfHeader]`; the web client must send `X-CSPS-CSRF: 1` on verify and resend (and every cookie-reading call).
- 04-21 (set new password) reads the same ticket cookie: after a must-change hand-off the challenge is `AwaitingNewPassword` and verify/resend answer 401 for it, so the new-password handler must look it up by ticket itself and use `CanSetNewPassword` and `Complete`.
- Verify and resend answer a 401 `auth.ticket-expired` for any closed challenge; the web page should send the person back to sign-in with the "timed out" notice.
- `AuthClient.ReadCodeAsync(client, email, count)` reads the newest sign-in code from the Testing sink; use `count` when waiting for a second email.

## Self-Check: PASSED

All fourteen created files and the modified files exist, and the six commits (3dfdf7e, 16e09a6, 1a00111, 0b3ef81, fb853a1, a5d9e66) are ancestors of HEAD.
