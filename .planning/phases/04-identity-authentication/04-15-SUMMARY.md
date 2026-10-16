---
phase: 04-identity-authentication
plan: 15
subsystem: auth
tags: [refresh, rotation, grace-window, reuse-detection, sign-out, sign-out-others, concurrency-retry, auth-05, auth-06, auth-10, audit-01, d-05, d-39, d-43, d-44]
status: complete
created: "2026-10-15T00:14:00-05:00"
updated: "2026-10-15T00:14:00-05:00"

requires: ["04-14", "04-34"]
provides:
  - "POST /api/v1/auth/refresh: refresh cookie + X-CSPS-CSRF in, 200 SessionResponse (new 15 minute access token, same session end) and a rotated single-use cookie out; 401 auth.session-ended with the cookie deleted; 409 auth.session-busy after two lost races (cookie kept)"
  - "POST /api/v1/auth/sign-out: revokes the cookie's session, deletes the cookie, 204 even with no or an unknown cookie; audits auth.signed-out"
  - "POST /api/v1/auth/sign-out-others (Staff): revokes every other active session of the caller from the token's user and sid, keeps this one, 204 when there was nothing to revoke; audits auth.sessions-revoked (sign-out-others) once"
  - "RefreshHandler, SignOutHandler, SignOutOthersHandler, AuthSessionController, RefreshOutcome"
  - "ConcurrencyConflictException (Application) raised by CspsUnitOfWork.SaveChangesAsync on EF's DbUpdateConcurrencyException after clearing the change tracker; ConflictRetry runs a load-decide-save pass twice"
  - "AuthErrors.SessionEnded (auth.session-ended) and AuthErrors.SessionBusy (auth.session-busy)"
  - "Test support: AuthClient.SignInFullyAsync/ReadDeviceAsync/RefreshAsync/SignOutAsync/SignOutOthersAsync/SiteSettingsStatusAsync, FakeUnitOfWork conflict switches"
affects: [04-16, 04-25, 04-29, 04-30, 04-32, web refresh interceptor, web sign-out, profile devices page]

requirements-completed: []

actuals:
  tokens: 23500
  tasks: 3
  commits: 6
plan_head_before: f2609e70e649294b27f5b21a0aa9d7eb3cc6cdf9
plan_head_after: 7071b73a5b4ae47b84984b710cd3a0587fbf007b

tech-stack:
  added: []
  patterns:
    - "A save that loses a race throws ConcurrencyConflictException (Application never sees EF); handlers run through ConflictRetry, which loads again and decides afresh once, then answers 409 auth.session-busy instead of lying or signing anyone out"
    - "The cookie is deleted only on a 401 from refresh; a 409 keeps it so the client can retry"
    - "Reuse: revocation committed first, then cache eviction, then the alarm through RecordIndependentlyAsync"
    - "Sign-out-others reads user and session only from IRequestContext; without both it revokes nothing"

key-files:
  created:
    - src/Csps.Application/Auth/RefreshHandler.cs
    - src/Csps.Application/Auth/SignOutHandler.cs
    - src/Csps.Application/Auth/SignOutOthersHandler.cs
    - src/Csps.Application/Common/ConcurrencyConflictException.cs
    - src/Csps.Application/Common/ConflictRetry.cs
    - src/Csps.Server/Controllers/AuthSessionController.cs
    - tests/Csps.Application.UnitTests/Auth/RefreshHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/SignOutHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/RefreshEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/RefreshRotationTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/SignOutEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/SignOutOthersEndpointTests.cs
  modified:
    - src/Csps.Application/Auth/AuthErrors.cs
    - src/Csps.Application/Auth/VerifyCodeHandler.cs
    - src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs
    - tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Application.UnitTests/Auth/AuthTestDoubles.cs
    - tests/Csps.Application.UnitTests/Auth/VerifyCodeHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/SessionStoreTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md

key-decisions:
  - "The deactivated or locked check uses UserAccount.LockoutEnd against the injected TimeProvider (as VerifyCodeHandler does) instead of a second IUserAccounts.IsLockedOutAsync call, so one fake clock decides everything in tests and there is no extra query"
  - "A revoked-for-inactivity session is audited as auth.session-revoked (UserSession id, written with Record in the revoking save); the audit-log doc row now names this case"
  - "A refresh or sign-out that loses its save race twice answers 409 auth.session-busy and keeps the cookie, rather than 401 (which would sign a tab out) or a false 204"
  - "sign-out-others without a user or sid in the request context answers 401 auth.session-ended and revokes nothing, so the keep-this-device rule (D-05) cannot be bypassed"
  - "Actions carry [AllowAnonymous] or [Authorize(Policy = Staff)] one by one (no class-level attribute), because a class-level AllowAnonymous would win over the Staff policy"

patterns-established:
  - "Handlers that load, decide and save run through ConflictRetry; the unit of work clears the tracker on a conflict"

coverage:
  - id: D1
    description: "Refresh renews the access token for the same session and sid, rotates the cookie on the same expiry and moves LastActiveAt"
    requirement: "AUTH-05"
    verification:
      - "RefreshEndpointTests.ARefreshRenewsTheAccessTokenAndRotatesTheCookieOnTheSameExpiry, TheRotatedCookieRefreshesAgain, ABrowserSessionKeepsAnExpiryFreeCookie; RefreshHandlerTests"
  - id: D2
    description: "No or unknown cookie is 401 auth.session-ended with the cookie deleted; no X-CSPS-CSRF is 403"
    requirement: "AUTH-05"
    verification:
      - "RefreshEndpointTests.NoCookieIsASessionEndedAnswerThatDeletesTheCookie, AnUnknownTokenIsASessionEndedAnswerThatDeletesTheCookie, ARefreshWithoutTheAntiCsrfHeaderIsRefused; matrix row POST /api/v1/auth/refresh"
  - id: D3
    description: "Two tabs refreshing at once both succeed; a replay after the 30 s grace revokes the whole session, fails the newest cookie and access token, and audits auth.refresh-reuse-detected"
    requirement: "AUTH-06"
    verification:
      - "RefreshRotationTests.TwoTabsRefreshingWithTheSameCookieBothSucceedAndBothKeepWorking, ReplayingAUsedTokenAfterTheGraceWindowRevokesTheWholeSession, ReplayingAUsedTokenInsideTheGraceWindowIsNotAnAlarm; RefreshHandlerTests (conflict retry)"
  - id: D4
    description: "A session never outlives its fixed end: 12 hours exactly refused, 89 days refreshes with the expiry unchanged, 90 days refused"
    requirement: "AUTH-05"
    verification:
      - "RefreshRotationTests.ABrowserSessionRefreshedAtExactlyTwelveHoursIsRefused, APersistentSessionRefreshedAt89DaysKeepsItsExpiry; RefreshHandlerTests boundary theory"
  - id: D5
    description: "A deactivated or locked account loses its session at the next refresh (revoked AccountInactive, cookie deleted, access token refused, auth.session-revoked audited)"
    requirement: "AUTH-10"
    verification:
      - "InactiveAccountTests.AnAccountThatBecomesInactiveLosesItsSessionAtTheNextRefresh (deactivated, locked); RefreshHandlerTests"
  - id: D6
    description: "Sign-out revokes the session, clears the cookie, stops the access token, audits auth.signed-out, and is a 204 with no cookie"
    requirement: "AUTH-06"
    verification:
      - "SignOutEndpointTests (5 tests); SignOutHandlerTests; matrix row POST /api/v1/auth/sign-out"
  - id: D7
    description: "Sign-out-others ends the caller's other sessions (tokens and refresh cookies fail), keeps this device, leaves other users alone, is a 204 with nothing to revoke, and audits once"
    requirement: "AUTH-06"
    verification:
      - "SignOutOthersEndpointTests (5 tests, includes three devices and another user); SignOutHandlerTests; matrix row POST /api/v1/auth/sign-out-others (anonymous 401, Admin 204, Manager 204)"
  - id: D8
    description: "Prohibition D-05: the caller's own session is never ended by sign-out-others"
    requirement: "AUTH-06"
    verification:
      - "SignOutOthersEndpointTests.OtherDevicesAreSignedOutAndThisOneKeepsWorking; SignOutHandlerTests.SigningOutOthersWithoutAUserOrASessionRefusesAndNeverRevokesAll"
---

# Phase 4 Plan 15: Rotating Refresh, Sign-out and Sign-out-others Summary

Staff sessions now stay alive with a rotating single-use refresh cookie on a fixed 90 day or 12 hour end, survive two tabs refreshing together and a lost response (30 second grace sibling), die as a whole family when an old token is replayed, end when the account is deactivated or locked, and can be ended from this device or from every other device while keeping this one.

## What was built

- **Tracer (Task 1):** `POST /api/v1/auth/refresh` (`[AllowAnonymous]`, `[RequireCsrfHeader]`) reads `__Secure-csps_rt`, looks the token up by hash, calls `UserSession.Rotate`, adds the child token, issues an access token for the user's current role and the session id, and sets the rotated cookie with the same expiry. Any failure is 401 `auth.session-ended` ("Your session ended. Sign in again.") with the cookie deleted.
- **Grace, reuse, expiry, inactive accounts (Task 2):** the handler checks the user first (deactivated, locked or missing: session revoked as `AccountInactive`, cache evicted, `auth.session-revoked` audited, 401). `ReuseDetected` commits the revocation, evicts, then writes `auth.refresh-reuse-detected` through `RecordIndependentlyAsync`. `CspsUnitOfWork` turns EF's `DbUpdateConcurrencyException` into `ConcurrencyConflictException` (tracker cleared); the handler's second pass sees the consumed token inside the grace window and issues a sibling. `VerifyCodeHandler` maps the same exception to 401 `auth.ticket-expired`.
- **Sign-out and sign-out-others (Task 3):** `SignOutHandler` revokes the cookie's session (`SignedOut`), evicts it, audits `auth.signed-out`; always 204 (no cookie, unknown token, already ended). `SignOutOthersHandler` calls `ISessions.RevokeAllAsync(user, except: sid, SignedOutOtherDevices)`, evicts each returned id and audits `auth.sessions-revoked` (detail `sign-out-others`) only when something was revoked; always 204. The controller actions declare their policy one by one.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 (tracer) | A signed-in browser refreshes with the cookie and gets a new token and a rotated cookie | e7be32d (RED), e59ae87 |
| 2 | Tabs together, replayed tokens, absolute expiry, inactive accounts | ad5e057 (RED), a8539b5 |
| 3 | Sign out this device and sign out other devices | 9ed9102 (RED), 7071b73 |

Tracer gate: interactive, `human_verify_mode` end-of-phase and automated-only `<verify>`, so both verify commands were re-run before expanding (RefreshEndpointTests 6, Authorization 84, all passed). Tracer verified end-to-end, expanding.

## RED / GREEN evidence

- Task 1 RED: 6 refresh tests failed with 404. GREEN: 6 pass, matrix 84 pass.
- Task 2 RED: `RefreshHandlerTests` did not compile (no `ConcurrencyConflictException`, new constructor, `SessionBusy`); 2 of 5 rotation tests and 3 of 12 inactive-account tests failed over HTTP. GREEN: unit 19, rotation 5 (run 5 times, stable), inactive 12 pass.
- Task 3 RED: 10 sign-out endpoint tests failed with 404; `SignOutHandlerTests` did not compile. GREEN: unit 190 (all), sign-out endpoints 10 pass.

## Verification

- `dotnet build`: 0 warnings, 0 errors.
- Domain 576, Application 190, Architecture 127, Infrastructure integration 322 (321 passed, 1 skipped), Server integration 477: all green after the preflight.
- Coverage gate: Csps.Domain 100% line and branch; Csps.Application 99.8% line (593/594), branch 98.4% (not gated). PASS.
- `npm --prefix tools/openapi-gen run check` passes; `OpenApiSnapshotTests` pass against the refreshed snapshot.
- Acceptance greps: `"refresh"` in AuthSessionController.cs, `auth.session-ended` in AuthErrors.cs, `AuditActions.RefreshReuseDetected` and `ConcurrencyConflictException` in RefreshHandler.cs (the latter through `ConflictRetry`, see deviations), `ConcurrencyConflictException` in CspsUnitOfWork.cs, `SignedOutOtherDevices` in SignOutOthersHandler.cs, `POST /api/v1/auth/sign-out-others` in the matrix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] A second lost race must not sign a tab out or fake a sign-out**
- **Found during:** Task 2.
- **Issue:** the plan retries a conflict once. A second conflict would otherwise escape as a 500, or (if mapped to 401) sign the tab out for a session that is still good.
- **Fix:** after the retry a second conflict answers 409 `auth.session-busy` ("Something changed at the same time. Try again."); the refresh cookie is deleted only for 401. Sign-out and sign-out-others use the same rule so they never report a false 204.
- **Files modified:** src/Csps.Application/Auth/AuthErrors.cs, RefreshHandler.cs, SignOutHandler.cs, SignOutOthersHandler.cs, src/Csps.Server/Controllers/AuthSessionController.cs
- **Commits:** a8539b5, 7071b73

**2. [Rule 2 - Missing critical] sign-out-others fails closed without a user and sid**
- **Found during:** Task 3 (D-05).
- **Issue:** with no session id, `RevokeAllAsync(user, except: null)` would revoke the caller's own session.
- **Fix:** the handler answers 401 `auth.session-ended` and revokes nothing unless both ids are present (unit-tested).
- **Commit:** 7071b73

**3. [Rule 3 - Blocking] A class-level `[AllowAnonymous]` would override the Staff policy**
- **Found during:** Task 3.
- **Issue:** `SignInController` puts `[AllowAnonymous]` on the class; copying that pattern would make `sign-out-others` anonymous.
- **Fix:** `AuthSessionController` has no class-level auth attribute; each action declares `[AllowAnonymous]` or `[Authorize(Policy = Policies.Staff)]`.
- **Commit:** e59ae87, 7071b73

### Plan interpretation

- **Handler unit tests for sign-out** (`SignOutHandlerTests`) and a unit-of-work conflict test in `SessionStoreTests` are not in the plan's file list; they keep Application above the gate and prove the EF translation deterministically.
- **Shared retry helper:** the plan names the retry inside `RefreshHandler`; the same rule was needed for sign-out and sign-out-others, so it lives once in `Csps.Application.Common.ConflictRetry`. `RefreshHandler.cs` therefore contains `ConcurrencyConflictException` only indirectly (the plan's grep for it in that file would return 0; the exception is caught in `ConflictRetry.cs`).
- **Locked check** uses `UserAccount.LockoutEnd` and the injected clock rather than `IUserAccounts.IsLockedOutAsync` (see key-decisions).
- The matrix rows for refresh and sign-out expect the same status for every caller (401 and 204), because those routes read the cookie, not the token.

## Decisions for the owner

- **No requirement ticked.** AUTH-05, AUTH-06, AUTH-10 and AUDIT-01 each also carry later plans (web refresh/sign-out, profile devices page, password reset, the remaining event catalog), so none is fully delivered yet. 04-14 ticked AUTH-02 to AUTH-04 on server delivery; I kept to the stricter reading for this plan. Say so if you want AUTH-05 and the server half of AUTH-06 ticked now.
- **409 `auth.session-busy`** is a new, small answer (plain text above). The web refresh interceptor should retry a 409 once and treat only 401 as "signed out".
- Inactive-account revocation on refresh is audited as `auth.session-revoked` (documented in `docs/operations/audit-log.md`). If you want a dedicated action code for it, that is a one-constant change.

## Known Stubs

None.

## Threat Flags

None. The three routes and the unit-of-work exception are the surfaces in the plan's threat model (T-04-50 to T-04-54): replay is tested over HTTP (31 second replay revokes the family, the newest cookie and access token die, the alarm is audited), CSRF header refusal is tested on refresh and sign-out, sign-out-others takes the user and sid only from the token (another user's sessions untouched, tested), inactive accounts lose the session on the next refresh, and concurrent tabs are tested with a real race plus a deterministic conflict retry. Per-IP limits for these routes are plan 04-24.

## Notes for later plans

- The web client sends `X-CSPS-CSRF: 1` on refresh and sign-out; `sign-out-others` needs only the bearer token. After `sign-out-others` the UI must say "other devices" (04-30), never "all devices".
- A 401 from refresh means "signed out" (cookie already deleted); a 409 means "try again".
- Test helpers: `AuthClient.SignInFullyAsync(client, staff, keepSignedIn, signInsSoFar)` signs a device in (pass `signInsSoFar` when the same account signs in on more devices); use a separate client with an explicit cookie to replay a token, because the jar sends its own cookie.
- 04-16 (devices page) can reuse `ISessions.RevokeAllAsync`/`SessionRevocationReason.DeviceSignedOut` and `ConflictRetry`.

## Self-Check: PASSED

All created and modified files exist, and the six commits (e7be32d, e59ae87, ad5e057, a8539b5, 9ed9102, 7071b73) are ancestors of HEAD.
