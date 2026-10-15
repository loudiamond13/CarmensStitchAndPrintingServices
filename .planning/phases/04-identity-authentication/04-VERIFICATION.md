---
phase: 04-identity-authentication
verified: 2026-10-15T23:10:00Z
created: "2026-10-15T18:10:00-05:00"
updated: "2026-10-15T18:10:00-05:00"
status: human_needed
score: 6/6 must-haves verified
covered_files:
  - ".planning/phases/04-identity-authentication/04-01-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-01-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-02-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-02-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-03-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-03-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-04-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-04-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-05-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-05-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-06-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-06-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-07-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-07-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-08-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-08-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-09-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-09-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-10-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-10-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-11-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-11-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-12-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-12-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-13-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-13-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-14-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-14-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-15-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-15-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-16-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-16-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-17-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-17-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-18-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-18-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-19-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-19-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-20-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-20-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-21-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-21-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-22-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-22-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-23-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-23-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-24-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-24-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-25-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-25-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-26-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-26-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-27-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-27-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-28-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-28-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-29-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-29-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-30-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-30-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-31-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-31-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-32-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-32-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-33-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-33-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-34-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-34-SUMMARY.md"
  - ".planning/phases/04-identity-authentication/04-35-PLAN.md"
  - ".planning/phases/04-identity-authentication/04-35-SUMMARY.md"
  - "src/Csps.Application/Auth/AuthSettings.cs"
  - "src/Csps.Application/Auth/ForgotPasswordHandler.cs"
  - "src/Csps.Application/Auth/RefreshHandler.cs"
  - "src/Csps.Application/Auth/ResendCodeHandler.cs"
  - "src/Csps.Application/Auth/ResetPasswordHandler.cs"
  - "src/Csps.Application/Auth/SignInHandler.cs"
  - "src/Csps.Application/Auth/SignOutOthersHandler.cs"
  - "src/Csps.Application/Auth/VerifyCodeHandler.cs"
  - "src/Csps.Domain/Auditing/AuditActions.cs"
  - "src/Csps.Domain/Identity/PasswordPolicy.cs"
  - "src/Csps.Domain/Identity/TwoFactorChallenge.cs"
  - "src/Csps.Domain/Identity/UserSession.cs"
  - "src/Csps.Infrastructure/Email/EmailDispatcher.cs"
  - "src/Csps.Infrastructure/Email/MailKitTransport.cs"
  - "src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs"
  - "src/Csps.Server/Controllers/AuthSessionController.cs"
  - "src/Csps.Server/Controllers/PasswordController.cs"
  - "src/Csps.Server/Controllers/SignInController.cs"
  - "src/Csps.Server/Security/AuthCookies.cs"
  - "src/Csps.Server/Security/IdempotencyMiddleware.cs"
  - "src/Csps.Server/Security/RateLimitSettings.cs"
  - "src/Csps.Server/Security/RateLimitingRegistration.cs"
  - "tests/Csps.ArchitectureTests/ReleaseHasNoEmailSinkTests.cs"
  - "tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs"
  - "tools/Csps.BootstrapManager/Program.cs"
  - "web/e2e/auth.spec.ts"
  - "web/src/components/entry/OtpInput.tsx"
  - "web/src/modules/admin/components/NewPasswordFields.tsx"
  - "web/src/modules/admin/pages/SignInPage.tsx"
  - "web/src/modules/admin/pages/VerifyCodePage.tsx"
  - "web/src/modules/admin/services/authService.ts"
covered_digest: "v3:sha256:6c57e33b4a5de1bd1e94fe0bb6ac8d95e983d1673160084508c5d197cad0a549"
behavior_unverified: 0
overrides_applied: 0
deferred:
  - truth: "A JOB-01 maintenance job purges expired idempotency keys (SEC-06 requirement text)"
    addressed_in: "Phase 9"
    evidence: "REQUIREMENTS.md maps JOB-01 to Phase 9; 04-CONTEXT.md Deferred Ideas lists 'Purging expired idempotency, outbox and token rows: JOB-01'. Expired keys are already ignored at once (IdempotencyTests.AKeyOlderThan24HoursIsReplacedAndTheHandlerRunsAgain)."
  - truth: "Analytics beacons are on the idempotency allow-list, and rate limits cover consent, analytics ingestion, inquiry and public endpoints (SEC-03 and SEC-06 requirement text)"
    addressed_in: "Phase 12 and Phase 13"
    evidence: "REQUIREMENTS.md maps ANL-05 to Phase 12 and INQ-01 to Phase 13; those endpoints do not exist yet. The auth endpoints, 1 MB body limit and list caps (the Phase 4 roadmap contract) are built."
  - truth: "Manager-facing buttons: set a temporary password, send an invite or a reset link (USER-02, USER-07)"
    addressed_in: "Phase 5"
    evidence: "04-CONTEXT.md D-21, D-23, D-24 and Deferred Ideas; the Phase 4 side (must-change gate, invite acceptance, bootstrap invite) is built and tested."
human_verification:
  - test: "Send a real sign-in code through the running app to a real inbox over the business SMTP server"
    expected: "Mail from 'Carmen's Stitch & Printing' <no-reply@cspstailoring.com> arrives with the code in the subject, branded HTML with the inline logo, and passes SPF/DKIM/DMARC; the connection used StartTls or SSL"
    why_human: "Automated tests use the in-memory sink and a stubbed transport; only the socket-option mapping is unit-tested. Live SMTP from the app (dev secrets or the first deploy) is a documented Phase 3 deferral (04-32 SUMMARY: AUTH-13 live send 'only provable on the Phase 3 first deploy'). The owner's Gmail D2 check proved the mailbox and DNS, not this app's send path."
  - test: "On the first HTTPS deploy, sign in and inspect the Set-Cookie headers for __Secure-csps_rt and __Secure-csps_2fa"
    expected: "HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth, with Expires only when 'Keep me signed in' is ticked"
    why_human: "Chromium E2E and the cookie spec pass locally over HTTPS on 5199, but production IIS/proxy behaviour (cookie prefix acceptance, Set-Cookie passthrough) cannot be exercised before Phase 3 deploys it (04-CONTEXT Deferred Ideas)."
  - test: "Run the opt-in live Have I Been Pwned check (CSPS_LIVE_HIBP=1) once"
    expected: "A known-breached password is reported Breached and a random long password is reported Clean through the real k-anonymity range API"
    why_human: "HibpLiveTests is the one skipped test (opt-in, needs the network). The parser, padding handling and fail modes are covered by offline tests."
---

# Phase 4: Identity & Authentication Verification Report

**Phase Goal:** Staff can securely sign in with email, password and a mandatory 6-digit code sent by email. They stay signed in the way they chose, can recover a forgotten password and can sign out everywhere. Every authentication event is audited.
**Verified:** 2026-10-15T23:10:00Z
**Status:** human_needed
**Re-verification:** No, initial verification
**Mode:** mvp phase; the goal is stated as outcomes, so the six ROADMAP success criteria were verified as the contract.

All six success criteria are met in the code and by passing tests that I ran myself. The only open items are live-environment checks the owner deliberately deferred to the Phase 3 first deploy (real SMTP, production cookie headers, live HIBP). No gap blocks the phase goal.

## Goal Achievement

### Observable Truths (ROADMAP Phase 4 success criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Sign-in with the emailed code. Email + password, 6-digit code by email, paste or type it (`one-time-code`), reach the admin portal. Unknown email, wrong password, deactivated or locked account get the same generic error with similar timing and no session | VERIFIED | `SignInHandler` checks exactly one hash per branch (real or `VerifyDummyPassword`), returns the single `AuthErrors.InvalidCredentials` and waits `ResponseFloor` (500 ms) on every path. `VerifyCodeHandler.AcceptAsync` issues the session only after `challenge.Verify` returns Ok. `OtpInput.tsx` sets `autoComplete='one-time-code'` on box 1 and has a paste handler; `VerifyCodePage` never auto-submits. Tests I ran: `SignInEndpointTests`, `InactiveAccountTests`, `SignInTimingTests.EveryBranchTakesAtLeastTheFloorAndTheMediansAgree`, `VerifyCodeEndpointTests` (643/643 Server integration pass); Playwright `@auth` sign-in with emailed code plus reload (2/2 pass, chromium) |
| 2 | Code and lockout limits: code valid 15 min, single use, dies after 5 wrong tries, per-account cap across tickets; resend after 60 s, 5/hour, each resend invalidates the previous; 5 bad passwords lock 15 min and email the user; per-IP and per-account rate limits | VERIFIED | `TwoFactorSettings` defaults 15 min / 5 attempts / 60 s / 5 per hour / cap 10 per hour. `TwoFactorChallenge.Verify` consumes the code once, returns Exhausted at 5 failures; `IssueCode` supersedes the previous code; `CheckResend` checks the cap before the cooldown. `VerifyCodeHandler.RejectAsync` applies the cross-ticket cap and `LockAsync` (lock + email + audit in one transaction). `SignInHandler.CountFailureAsync` locks and queues `AccountLockedEmail`. `RateLimitingRegistration` registers six sliding-window policies (sign-in 10/min, verify 10/min, resend 5/min, forgot 5/15 min, reset 10/15 min, refresh 60/min), IPv6 bucketed by /64 (D-49), 429 with `Retry-After`. Tests: Domain 590/590, Application 357/357, `CrossTicketCapTests`, `LockoutTests`, `ResendCodeEndpointTests` pass |
| 3 | Sessions: "Keep me signed in" survives restart for 90 days; otherwise browser-session cookie, 12 h cap; several tabs refresh without signing each other out, replay of a rotated token revokes the family; sign out and sign out of all devices end sessions immediately | VERIFIED | `SessionSettings` 90 d / 12 h / 30 s grace / 5 siblings. `AuthCookies.SetRefresh` sets `__Secure-csps_rt`, HttpOnly, Secure, SameSite=Strict, Path=/api/v1/auth, and Expires only when persistent. `RefreshHandler` rotates, issues a grace sibling inside 30 s, and on `ReuseDetected` revokes the session, evicts the cache and audits `auth.refresh-reuse-detected`. `SignOutHandler`/`SignOutOthersHandler` revoke and evict the session cache. Tests: `RefreshRotationTests` (two tabs both succeed; replay after grace revokes; replay inside grace is no alarm; 12 h and 89-day edges), `SignOutOthersEndpointTests`, `SessionRevocationTests`; Playwright `@auth-cookies` (both variants) and `@auth-multitab` pass. Note: "sign out of all devices" signs out every OTHER device and keeps the current one by owner ruling D-05/D-44; a password reset ends all sessions including the current one |
| 4 | Password reset: link request never reveals account existence; password 8-64 chars with a number and a symbol, not in breach corpora, no email/name; strength meter; after reset all sessions revoked and a "password changed" email sent | VERIFIED | `ForgotPasswordHandler` answers success for any well-formed email, same floor timing, deactivated gets a notice with no link, unknown gets nothing, 3 emails/hour cap. `ResetPasswordHandler` in one transaction: spends the 30-min hashed single-use link, checks `PasswordRules` (fail-open to the common-password floor), sets the password, clears lockout, revokes all sessions (`RevokeAllAsync(id, null, ...)`), queues `PasswordChangedEmail`, audits. `PasswordPolicy` enforces 8-64 code points (NFC), number, symbol, no email local part/first/last name (parts under 3 ignored). `NewPasswordFields` renders `PasswordField showStrength`. Tests: `ForgotPasswordTests`, `PasswordResetTests`, `PasswordPolicyTests`; Playwright `@auth-reset` passes |
| 5 | Bootstrap, email and audit: `bootstrap-manager` CLI creates a first Manager who can sign in; auth emails through the outbox from the business sender over TLS; E2E reads codes from a Testing-only sink and a test proves it is absent from Release; sign-in, 2FA, lockout and reset events are audited | VERIFIED (live SMTP deferred, see Human Verification) | `tools/Csps.BootstrapManager/Program.cs` plus `BootstrapTargetGuard` (refuses non-dev DBs, pending migrations, never migrates); `BootstrapManagerTests`, `BootstrapSignInTests` (empty DB -> bootstrap -> invite -> set password -> full sign-in) and Playwright `@auth-invite` pass. Outbox: `EmailOutboxMessage`, `OutboxEmailSender`, `EmailDispatcher`; `MailKitTransport.SocketOptionsFor` maps only StartTls/SslOnConnect; `MailSafetyTests` pass. Sink: `ReleaseHasNoEmailSinkTests` builds Release and asserts no sink/Testing type and no `api/testing` string (ArchitectureTests 127/127 pass); `CSPS_TESTING` symbol defined for Debug only. `AuditActions` catalog has sign-in-failed, 2fa issued/resent/verified/failed/exhausted, lockout, signed-in/out, sessions revoked, reset requested/completed/link-invalid, password changed, breach found/unavailable, invite accepted, bootstrap created; handlers write them through `IAuditTrail` (asserted in `LockoutTests`, `PasswordResetTests`, `SignOutOthersEndpointTests` etc.) |
| 6 | Idempotent form posts: every state-changing POST needs an `Idempotency-Key`; replay returns the first response; same key + different body 422; duplicate mid-request 409; missing key 400; discovery test fails on an uncovered POST; keys expire after 24 h | VERIFIED | `IdempotencyMiddleware` is default-on for every POST except `[IdempotencyExempt]` endpoints; 400 `idempotency.key-missing`, 422 `key-mismatch`, 409 `in-progress`; stores 2xx/400/404/422 only, never a Set-Cookie answer, with the business change in one transaction (`IdempotencyGate`). `IdempotencyAllowList` lists 9 exempt Phase 4 endpoints each with a written reason equal to the attribute. `IdempotencyTests.ARepeatedForgotPostQueuesOneEmailAndGetsTheFirstAnswerBack`, `...SameKeyWithADifferentBody...`, `...DuplicateThatArrivesWhileTheFirstRuns...`, `...KeyOlderThan24Hours...`, and `IdempotencyCoverageTests` (discovery) pass. Web: `httpClient.ts` sends `Idempotency-Key` on unsafe methods and reuses it on retry (WEB-09) |

**Score:** 6/6 truths verified (0 present-but-behavior-unverified). Every behavior-dependent truth (rotation, reuse revocation, grace window, lockout, cap, cooldown, single-flight idempotency) has a passing behavioral test; none rests on symbol presence alone.

### Deferred Items

Items in the requirement text that belong to later phases (not Phase 4 gaps).

| # | Item | Addressed In | Evidence |
|---|------|--------------|----------|
| 1 | JOB-01 purge job for expired idempotency keys | Phase 9 | REQUIREMENTS.md: JOB-01 -> Phase 9; CONTEXT Deferred Ideas. Expired keys are already ignored at once |
| 2 | Analytics beacon exemption; rate limits on consent, analytics, inquiry and public endpoints | Phase 12, 13 | ANL-05 -> Phase 12, INQ-01 -> Phase 13; those endpoints do not exist yet |
| 3 | Manager UI for temporary password, invite and reset link | Phase 5 | CONTEXT D-21, D-23, D-24 |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/Csps.Domain/Identity/TwoFactorChallenge.cs`, `UserSession.cs`, `PasswordPolicy.cs` | Pure Domain rules | VERIFIED | Substantive state machines; Domain unit tests 590/590 |
| `src/Csps.Application/Auth/*Handler.cs` (sign-in, verify, resend, refresh, sign-out, sign-out-others, forgot, reset, set-new, invite, sessions) | One handler per use case | VERIFIED | Real logic, audit + outbox + unit of work; Application tests 357/357 |
| `src/Csps.Server/Controllers/{SignIn,AuthSession,Password,Invite,Sessions}Controller.cs` | Thin controllers, explicit authz | VERIFIED | Wired to handlers; all in the authorization matrix (matrix tests pass) |
| `src/Csps.Server/Security/{IdempotencyMiddleware,RateLimitingRegistration,AuthCookies,RequireCsrfHeader}` | SEC-03, SEC-06, cookies, CSRF header | VERIFIED | Registered in the pipeline; exercised by integration tests |
| `src/Csps.Infrastructure/{Identity,Email,Passwords,Idempotency}` | Stores, outbox, MailKit, HIBP, gate | VERIFIED | Infrastructure integration 414 pass, 1 skipped (live HIBP, opt-in) |
| `tools/Csps.BootstrapManager/Program.cs` | AUTH-12 CLI | VERIFIED | Guarded; tested end to end |
| `web/src/modules/admin/pages/*` (SignIn, VerifyCode, NewPassword, ForgotPassword, ResetPassword, AcceptInvite, Sessions) | S1-S7 screens | VERIFIED | Lazy-routed in `routes.tsx`; services call the typed API; Playwright pass |
| `web/src/components/entry/OtpInput.tsx`, `forms/PasswordField.tsx` | A11Y-03 inputs | VERIFIED | `one-time-code`, paste handler, no auto-submit, strength meter, `current-password`/`new-password`/`username` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `SignInPage` / `VerifyCodePage` | `/api/v1/auth/sign-in`, `/two-factor/verify`, `/resend` | `authService` over `apiClient` (`skipAuthRefresh`) | WIRED | E2E sign-in passes against the real host |
| `AdminLayout` user menu | `POST /auth/sign-out-others` | `SignOutOthersDialog` -> `authService.signOutOthers` | WIRED | Confirmed by grep and component tests |
| `VerifyCodeHandler` / `RefreshHandler` | `SessionIssuer`, `ISessions`, `ISessionCache` | DI in `AuthRegistration` | WIRED | Rotation and revocation tests pass over the real stack |
| Handlers | `IAuditTrail`, `IEmailOutbox`, `IUnitOfWork` | constructor injection | WIRED | One transaction commits state + email + audit (`InTransactionAsync`) |
| `IdempotencyMiddleware` | every POST route | endpoint metadata check | WIRED | Discovery test fails on any uncovered, un-allow-listed POST |
| `httpClient.ts` | `Idempotency-Key` header | `request.idempotencyKey` | WIRED | Key reused on the 401-refresh retry |
| Testing sink / fixtures | Debug + Testing environment only | `#if CSPS_TESTING` | WIRED (absent in Release) | `ReleaseHasNoEmailSinkTests` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `SessionsPage` / `SessionsView` | session list | `GET /api/v1/sessions` -> `ListSessionsHandler` -> `ISessions` query | Yes (EF query over `UserSession`) | FLOWING |
| `VerifyCodePage` countdown | `resendAfterSeconds` | server `ResendCodeResponse` (from `AuthSettings.ResendCooldown`) | Yes | FLOWING |
| Admin shell user | `SessionResponse.user` | `SessionIssuer` / `RefreshHandler` from `UserAccount` | Yes | FLOWING |

### Behavioral Spot-Checks (run by me, 2026-10-15, `CSPS_TEST_SQL=localdb`, preflight clear)

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Domain rules | `dotnet test --project tests/Csps.Domain.UnitTests` | 590/590 | PASS |
| Application handlers | `dotnet test --project tests/Csps.Application.UnitTests` | 357/357 | PASS |
| API end to end (auth, refresh, lockout, reset, idempotency, rate limit, authz matrix) | `dotnet test --project tests/Csps.Server.IntegrationTests` | 643/643 | PASS |
| Outbox, MailKit, bootstrap, HIBP, stores | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests` | 414 pass, 1 skipped (live HIBP opt-in) | PASS |
| Layers, Release has no sink, mail safety | `dotnet test --project tests/Csps.ArchitectureTests` | 127/127 | PASS |
| Browser flows (chromium): sign-in + code, cookies x2, two tabs, invite x2, must-change x2, reset | `npm --prefix web run e2e -- --project=chromium ...` | 10/10 | PASS |

The orchestrator's full-solution run (2131 pass, 1 skipped, 0 failed), clean build and `npm run verify` are consistent with these targeted results.

### Probe Execution

Step 7c: SKIPPED. No `scripts/*/tests/probe-*.sh` exists and no plan declares a probe.

### Requirements Coverage

All 18 phase IDs appear in at least one PLAN `requirements:` field; none is orphaned in REQUIREMENTS.md.

| Requirement | Source Plans | Description | Status | Evidence |
|-------------|--------------|-------------|--------|----------|
| AUTH-01 | 02, 07, 08, 12, 26, 32 | Email + password, generic error, similar timing | SATISFIED | `SignInHandler`, `SignInTimingTests` |
| AUTH-02 | 05, 11, 14, 21, 27 | Mandatory emailed 6-digit code bound to a ticket | SATISFIED | `TwoFactorChallenge`, `VerifyCodeEndpointTests` |
| AUTH-03 | 05, 11, 14 | 15 min, single use, 5 tries, HMAC, fixed time, cross-ticket cap | SATISFIED | `HmacCodeMac`, `TokenHash.Equal`, `CrossTicketCapTests` |
| AUTH-04 | 05, 11, 14, 27 | Resend 60 s, 5/hour, invalidates previous | SATISFIED | `ResendCodeHandler`, `ResendCodeEndpointTests` |
| AUTH-05 | 06, 13, 14, 15, 25, 26, 27, 30, 32, 34 | Keep-signed-in 90 d / 12 h, 15 min memory-only access token, hashed rotating cookie | SATISFIED | `RefreshHandler`, `AuthCookies`, `RefreshRotationTests`, `@auth-cookies` |
| AUTH-06 | 06, 13, 15, 16, 25, 29, 30, 32, 34 | Sign out, sign out of all (others, D-05), family revocation with grace | SATISFIED | `SignOut*Tests`, `RefreshRotationTests` |
| AUTH-07 | 08, 12 | 5 failed passwords lock 15 min + email | SATISFIED | `LockoutTests` |
| AUTH-08 | 18, 19, 20, 28 | Reset by email, constant response, hashed 30-min single-use link | SATISFIED | `ForgotPasswordTests`, `PasswordResetTests` |
| AUTH-09 | 04, 19, 21, 28, 31 | Reset enforces policy, revokes sessions, sends "changed" email | SATISFIED | `ResetPasswordHandler`, `AResetEndsEverySessionAtOnceAndAuditsIt` |
| AUTH-10 | 08, 12, 15, 19 | Deactivated/locked cannot sign in, refresh or reset into a session | SATISFIED | `InactiveAccountTests`; D-46 amends lockout-refresh (refused, not revoked) |
| AUTH-11 | 02, 04, 17, 19, 21, 22, 28, 31 | 8-64 chars, number + symbol, HIBP, no name/email, strength meter | SATISFIED | `PasswordPolicy`, `HibpPwnedPasswords`, `PasswordField showStrength` |
| AUTH-12 | 22, 31, 35 | Bootstrap first Manager on an empty DB | SATISFIED | `BootstrapManagerTests`, `BootstrapSignInTests`, `@auth-invite` |
| AUTH-13 | 01, 02, 09, 22, 23, 32, 33 | Auth emails via outbox, TLS SMTP, no extra secrets | SATISFIED in code; live send deferred (human item 1) | `OutboxEmailSender`, `MailKitTransport`, `MailSafetyTests` |
| QUAL-05 | 09, 10 | Testing-only sink absent from Release | SATISFIED | `ReleaseHasNoEmailSinkTests` |
| SEC-03 | 07, 24 | Auth rate limits, body limit, list caps | SATISFIED for Phase 4 scope | `RateLimitingRegistration`; consent/analytics/inquiry parts deferred |
| SEC-06 | 20 | Idempotency-Key on state-changing POSTs | SATISFIED for Phase 4 scope | `IdempotencyMiddleware`, coverage test; purge job and beacons deferred |
| A11Y-03 | 26, 27, 28, 31, 32 | Paste allowed, autocomplete, no puzzles | SATISFIED | `OtpInput`, E2E `@auth` ("never submits by itself") |
| AUDIT-01 | 03, 12, 14-16, 18, 19, 21, 22, 35 | Auth events audited | SATISFIED for the auth subset in this phase | `AuditActions`, handler tests (user CRUD, orders and content events belong to later phases) |

### Anti-Patterns Found

None blocking. A scan of tracked `src/`, `tools/`, `web/src`, `web/e2e` and `tests/` found no `TBD`/`FIXME`/`XXX` debt markers (the one hit is a placeholder-string list in `HostingRecordTests.cs`), no `TODO`/`HACK`/`PLACEHOLDER` in `src/` or `web/src`, and no stubbed handlers. Review disposition: 04-REVIEW-FIX closed 16 of 17 findings; WR-06 was skipped with a failing-test attempt that passed on unchanged code (EF Core 8+ sentinel behaviour), which I accept.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `.planning/REQUIREMENTS.md` | 84-89, 111, 368, 371, 381-386, 399 | AUTH-08..AUTH-13, SEC-03, SEC-06 and AUDIT-01 still show `[ ]` / Pending | Warning (documentation only) | Traceability lags the code; update when the phase is closed. SEC-03 and SEC-06 should be marked partial/Complete with the deferred parts noted |
| `.planning/phases/04-identity-authentication/04-REVIEW-DISPOSITION.md` | n/a | Stale relative to 04-REVIEW-FIX.md | Info | Orchestrator already noted it |
| `.planning/phases/04-identity-authentication/deferred-items.md` | 04-20 entry | Flaky `ResendCodeEndpointTests.TheSixthCodeInAnHourIsRefusedWithNoWaitTime` seen once | Info | Passed in my 643/643 run; not investigated upstream |
| 35 SUMMARY files | frontmatter | Only 5 fill `requirements-completed` | Info | Not evidence of absence; checked against code and tests instead |

### Human Verification Required

#### 1. Live SMTP send from the app

**Test:** With real SMTP secrets in dev (D-27) or at the first deploy, sign in once and check the inbox, then the message source.
**Expected:** Code in the subject, From "Carmen's Stitch & Printing" <no-reply@cspstailoring.com>, no Reply-To, branded HTML with inline logo, SPF/DKIM/DMARC pass, TLS used.
**Why human:** Automated tests never open a real SMTP session; this is the documented Phase 3 deferral.

#### 2. Production Set-Cookie behaviour

**Test:** After the first HTTPS deploy, inspect the sign-in responses.
**Expected:** `__Secure-csps_rt` and `__Secure-csps_2fa` with HttpOnly, Secure, SameSite=Strict, Path=/api/v1/auth.
**Why human:** Needs the real IIS host (Phase 3). Local HTTPS Chromium/Firefox/WebKit specs already pass.

#### 3. Live HIBP reachability

**Test:** `CSPS_LIVE_HIBP=1` run of `HibpLiveTests` (and the same from the host at first deploy).
**Expected:** Breached and clean passwords classified correctly.
**Why human:** Opt-in network test; fail-open and fail-closed behaviour are covered offline.

### Gaps Summary

No gaps. Every ROADMAP success criterion and every requirement ID claimed by the 35 plans is backed by code that is substantive, wired and exercised by tests I ran (Domain, Application, Server integration, Infrastructure integration, Architecture, and a Chromium E2E slice). Owner rulings D-45 to D-49 are reflected in the code (lockout refresh refusal without revoke, /64 IPv6 buckets, configurable password lockout length). The status is `human_needed` solely because three live-environment checks, which the owner explicitly scheduled for the Phase 3 first deploy, cannot be proven from the repository. Housekeeping before closing the phase: update the AUTH-08..13, SEC-03, SEC-06 and AUDIT-01 checkboxes and traceability rows in REQUIREMENTS.md.

---

_Verified: 2026-10-15T23:10:00Z_
_Verifier: Claude (gsd-verifier)_
