---
phase: 04-identity-authentication
fixed_at: 2026-10-15T14:50:00-05:00
review_path: .planning/phases/04-identity-authentication/04-REVIEW.md
iteration: 1
findings_in_scope: 17
fixed: 16
skipped: 1
status: partial
created: 2026-10-15T14:50:00-05:00
updated: 2026-10-15T14:50:00-05:00
---

# Phase 4: Code Review Fix Report

**Fixed at:** 2026-10-15T14:50:00-05:00
**Source review:** .planning/phases/04-identity-authentication/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 17 (CR-01, WR-01 to WR-16; Info findings out of scope)
- Fixed: 16 (CR-01 is a partial fix, see below)
- Skipped: 1 (WR-06, not reproducible)

Every fix was written test first (the failing test was run before the fix wherever the finding could be reproduced). Work was done in the main checkout because `workflow.use_worktrees` is `false`; no worktree or recovery sentinel was created. Nothing was pushed.

## Verification

Run in the main checkout (not a worktree), after all fixes, with `CSPS_TEST_SQL=localdb` set for the process only and the shared-machine preflight clear (ports 5180, 5115, 7028 and 5199 free, no other-project processes):

- `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- `dotnet test --solution Csps.slnx`: 2132 total, 2131 passed, 0 failed, 1 skipped (the skip was already there). Domain, Application, Architecture, Infrastructure integration and Server integration projects all passed.
- `npm run lint` (`eslint . --max-warnings 0`): clean.
- `npm run typecheck`: clean.
- `npm run format:check`: clean.
- `npx vitest run` in `web/`: 144 files, 3791 tests, all passed.
- `npm run build:budget`: built; real numbers are public JS 134,556 B, admin JS 194,392 B (limit 250,000 B), CSS 13,595 B.

Notes on test runs:
- One earlier run of `src/modules/admin/routes.test.tsx` failed once with an unhandled `GET /api/v1/sessions` MSW request while the machine was busy. It failed identically with my uncommitted changes stashed, and it passed three times in a row afterward and in the full web run. It looks like an existing timing flake in that test (a request arrives after the test ends). It is not caused by these fixes, but it is not fixed either.
- A full-solution run found one Server integration test that asserted the old, buggy WR-01 behavior (a temporary password accepted as the new password). It was updated in commit 50d93b8.

## Fixed Issues

### CR-01: A failed sign-out call is swallowed, and the sign-in loader then restores the session from the still-valid refresh cookie

**Status:** fixed in part, requires human verification and an owner decision for the rest
**Files modified:** `web/src/modules/admin/services/session.ts`, `web/src/modules/admin/services/session.test.ts`, `web/src/layouts/AdminLayout.test.tsx`
**Commit:** 863c547
**Applied fix:**
- `signOut()` now retries a 409 (lost save race) once, as the refresh path does.
- After a sign-out, `ensureSession()` no longer uses the leftover refresh cookie to restore the session in this page load. A flag is set by `signOut()` and cleared by the next `acceptSession` (a new sign-in or a refresh that is asked for explicitly). So when the server call fails, the person lands on the sign-in page with the "You've signed out." notice and stays there. The new AdminLayout test (`Logout stays on the sign-in page when the server call failed but the refresh cookie still works`) failed before the fix (the router bounced to `/admin`) and passes now.

**Not applied (owner decision):** the reviewer's wider fix, which is to keep the local session and show a "We couldn't sign you out" toast when the server call fails. UI-SPEC "Logout" (04-UI-SPEC.md, "Logout (UserMenu and Sidebar)") says that if the request fails the local session is still cleared and the same navigation happens, and the review fix would add new copy. Changing that is an owner decision. What stays open: after a failed server call the HttpOnly cookie is still valid on the server, and a full page reload (which loses the in-memory flag) will boot the session from it again (CWE-613 remains for that case). If the owner wants that closed, the fix is the reviewer's wider one.

### WR-01: The must-change step accepts the current (temporary or breached) password as the "new" password

**Status:** fixed: requires human verification (logic change)
**Files modified:** `src/Csps.Application/Auth/SetNewPasswordHandler.cs`, `tests/Csps.Application.UnitTests/Auth/SetNewPasswordHandlerTests.cs`, `tests/Csps.Server.IntegrationTests/Auth/MustChangePasswordTests.cs`
**Commits:** 2d3c916, 50d93b8
**Applied fix:** After the policy check and before the transaction, `IUserAccounts.CheckPasswordAsync` is called; a match returns a 400 with the message "Choose a different password from your current one." (public constant `SetNewPasswordHandler.SameAsCurrentMessage`). No new port. The web mirror needs no change because the client cannot know the current password; the message is shown from the server's field error. The integration test that used to expect the temporary password to be accepted now expects it to be refused, then accepts a different one.

### WR-02: SignIn and ResendCode let `ConcurrencyConflictException` escape, which gives a 500

**Status:** fixed: requires human verification (logic change)
**Files modified:** `src/Csps.Application/Auth/ResendCodeHandler.cs`, `src/Csps.Application/Auth/SignInHandler.cs`, `tests/Csps.Application.UnitTests/Auth/ResendCodeHandlerTests.cs`, `tests/Csps.Application.UnitTests/Auth/SignInHandlerTests.cs`
**Commit:** cc49249
**Applied fix:**
- `ResendCodeHandler` runs its whole attempt inside `ConflictRetry`; the loser of a double click reads again and gets the normal 429 cooldown. After two lost races it also answers the cooldown, never a 500.
- `SignInHandler` runs `StartChallengeAsync` inside `ConflictRetry`; a null outcome after two lost races is the generic `InvalidCredentials`, and the response floor still applies.
- The SignIn test file had a private copy of `FakeUnitOfWork` that could not simulate conflicts. It was removed in favor of the shared one in `AuthTestDoubles.cs`.

### WR-03: Setting a new password at the must-change step leaves the person's other sessions alive

**Status:** fixed: requires human verification (logic change)
**Files modified:** `src/Csps.Application/Auth/SetNewPasswordHandler.cs`, `tests/Csps.Application.UnitTests/Auth/SetNewPasswordHandlerTests.cs`
**Commit:** 8c157ed
**Applied fix:** The handler now takes `ISessions` and `ISessionCache`. Inside the transaction, after the password change and before `SessionIssuer.StartAsync`, it calls `RevokeAllAsync(..., PasswordReset)` and records `SessionsRevoked` with detail `password-reset`. After the commit it evicts the user from the session cache. Tests check the order (revoke before the new session is added), the audit entry and the eviction, and that a rejected password revokes and evicts nothing.

### WR-04: A temporary lockout makes Refresh revoke the session for good

**Status:** fixed: requires human verification (behavior change, see note)
**Files modified:** `src/Csps.Application/Auth/RefreshHandler.cs`, `tests/Csps.Application.UnitTests/Auth/RefreshHandlerTests.cs`, `tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs`
**Commit:** 6d35838
**Applied fix:** A deactivated or missing account still revokes the session. A temporary lock (`LockoutEnd > now`) now answers `SessionEnded` (401) without revoking, saving or rotating anything, so the session recovers when the lock passes. AUTH-10 ("locked users cannot ... refresh") still holds, because the refresh is refused. The old unit and integration tests that required a lock to revoke the session were split: deactivated and missing still revoke; a new test covers the lock.
**Note for the owner:** this changes the T-04-53 behavior for locked accounts (documented in the 04-15 plan and the old tests). The review itself said to record the decision in D-39 if the owner wants a code lockout to end sessions. Please confirm.

### WR-05: Failed-password counter can be lost under concurrent guesses

**Status:** fixed: requires human verification (concurrency logic)
**Files modified:** `src/Csps.Infrastructure/Identity/UserAccounts.cs`, `tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs`
**Commit:** 12051a0
**Applied fix:** `RecordFailedPasswordAsync` now retries when Identity answers `ConcurrencyFailure` (up to 16 times): it reloads the user from the database through `CspsDbContext` (added to the constructor) and counts again, recomputing "was locked" each time so exactly one call reports `LockedNow`. This is the reviewer's second option; the set-based update was not used because it would have to re-implement Identity's lockout rule. The new test runs 8 wrong guesses in parallel on separate scopes against LocalDB; it failed with `ConcurrencyFailure` before the fix and now passes (run three times). It asserts one `LockedNow`, a lockout set, and a final count of 3 (8 guesses, 5 to lock and restart the count).

### WR-07: Identity's default `AllowedUserNameCharacters` rejects valid staff emails

**Status:** fixed
**Files modified:** `src/Csps.Infrastructure/Identity/IdentityRegistration.cs`, `tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs`
**Commit:** 5c4317f
**Applied fix:** `options.User.AllowedUserNameCharacters = string.Empty;`. New theory creates accounts for `o'brien...`, `rey!#$%&*=?^...` and `josé...` addresses; all three failed with `InvalidUserName` before the fix.

### WR-08: Email copy hard-codes lifetimes that `AuthSettings` makes configurable

**Status:** fixed: requires human verification (record shape and wiring changed)
**Files modified:** `src/Csps.Application/Email/AuthEmail.cs`, `src/Csps.Application/Auth/AuthSettings.cs`, `src/Csps.Application/Auth/SignInHandler.cs`, `src/Csps.Application/Auth/VerifyCodeHandler.cs`, `src/Csps.Application/Users/BootstrapManagerHandler.cs`, `src/Csps.Infrastructure/Email/EmailRenderer.cs`, `src/Csps.Server/Composition/AuthRegistration.cs`, `tools/Csps.EmailPreview/Program.cs`, `tests/Csps.Application.UnitTests/Auth/AuthSettingsTests.cs`, `tests/Csps.Application.UnitTests/Auth/VerifyCodeHandlerTests.cs`, `tests/Csps.Application.UnitTests/Email/AuthEmailTests.cs`, `tests/Csps.Infrastructure.IntegrationTests/Email/EmailRendererTests.cs`
**Commit:** 9d5e242
**Applied fix:**
- The sign-in code and reset emails word their lifetime from `ExpiresAt - RequestedAt`. `InviteEmail` gained `RequestedAt` so the invite does the same. `AccountLockedEmail` gained `LockedFor` (the real pause length) and its subject and body use it. Whole hours read as hours ("72 hours", "1 hour"), anything else as minutes. Defaults print exactly the old text (15 minutes, 30 minutes, 72 hours).
- New `AuthSettings.PasswordLockoutDuration` (default 15 minutes, validated) is now the one source of the password lockout length: the handler passes it to the email and `AddCspsAuth` applies it to Identity with `PostConfigure<IdentityOptions>`, so the email and the real lock cannot disagree. The code-lockout email uses `CodeLockoutDuration`.
- A renderer test with non-default lifetimes (10 and 45 minutes, 24 hours, 1 hour, a 30 minute lock) failed before the change.

### WR-09: A failure after a successful SMTP send is recorded as a send failure and retried

**Status:** fixed: requires human verification (no SMTP server in tests)
**Files modified:** `src/Csps.Infrastructure/Email/MailKitTransport.cs`, `tests/Csps.Infrastructure.IntegrationTests/Email/MailKitTransportTests.cs`
**Commit:** f854698
**Applied fix:** The disconnect after `SendAsync` goes through `CloseAfterSendAsync`, which swallows any error unless the cancellation token was cancelled. The test covers the helper with an `IOException`, an `SmtpProtocolException` and a cancelled token. There is no SMTP stub in the test project, so the end-to-end path through `SendAsync` is not exercised.

### WR-10: Idempotency scope uses the route pattern and the body only, not the actual path or query

**Status:** fixed
**Files modified:** `src/Csps.Server/Security/IdempotencyMiddleware.cs`, `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs`
**Commit:** d7b8df7
**Applied fix:** The request hash now starts with the length-prefixed path and query, then the body. The same key on another resource of the same route pattern, or with another query, now gets the 422 mismatch instead of a replay. The new probe-host test failed before (second request returned 200) and passes now; all 44 idempotency tests pass.

### WR-11: A chunked body over 1 MB becomes a 500, not the 413 the middleware promises

**Status:** fixed
**Files modified:** `src/Csps.Server/Http/CspsProblemDetails.cs`, `src/Csps.Server/Program.cs`, `src/Csps.Server/Security/IdempotencyMiddleware.cs`, `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyProbeController.cs`, `tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyTests.cs`
**Commit:** 5117587
**Applied fix:**
- New `CspsProblemDetails.WriteExceptionAsync` is the exception handler: a `BadHttpRequestException` with a 4xx status keeps that status (so the framework's own 413 stays a 413); everything else is still a generic 500 with the reference text.
- The idempotency hash now counts the body bytes itself and answers 413 when they pass 1 MB. The buffering limit is set above that count, so the framework's `IOException("Buffer limit exceeded.")` (the real exception type, found by experiment; the review guessed `InvalidDataException`) is never the first to trip.
- Two new tests (a probe action that throws the framework's 413, and a chunked 1 MB + 1 body through TestServer) both returned 500 before the fix. They run on the in-memory test server, not a real Kestrel host as the review suggested, so Kestrel's own `IHttpMaxRequestBodySizeFeature` enforcement is still untested.

### WR-12: Auth rate limits key IPv6 clients by /64

**Status:** fixed
**Files modified:** `src/Csps.Server/Security/RateLimitingRegistration.cs`, `tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitPartitionTests.cs`
**Commit:** 3918aeb
**Applied fix:** IPv6 buckets use the first 6 bytes (/48), the same prefix the audit log keeps (D-32). Partition key tests and the bucket-sharing test were updated (two /64s in one /48 now share a bucket; a different /48 does not). Trade-off to know: addresses inside one /48 now share a limit.

### WR-13: The admin bundle budget is not enforced for the shipped admin app

**Status:** fixed
**Files modified:** `web/scripts/budget.ts`, `web/scripts/budget.test.ts`, `web/scripts/vite-budget-plugin.test.ts`, `docs/web/budgets.md`
**Commit:** 8631f68
**Applied fix:** Admin JS is measured in every build, including production. There are two shipped entries: signed in (`AdminLayout`, `UrlStateLayout`, `SessionsPage`, `guard`) and signed out (`AuthLayout`, `SignInPage`, `guard`); the larger is reported as `adminJs`. `AdminPreviewPage` is no longer in any measured list. A missing chunk for any of those modules fails closed. Tests and the plugin tests were reshaped to match, and `docs/web/budgets.md` was updated. A real `npm run build:budget` measured admin JS at 194,392 B, under the 250,000 B limit.

### WR-14: The TanStack Query cache survives sign-out and sign-in

**Status:** fixed
**Files modified:** `web/src/modules/admin/hooks/useClearCacheOnSignOut.ts` (new), `web/src/modules/admin/hooks/useClearCacheOnSignOut.test.tsx` (new), `web/src/layouts/AdminLayout.tsx`
**Commit:** a82f28a
**Applied fix:** A new hook, used by `AdminShell`, clears the query cache when the session user becomes null or changes to another id (a plain refresh of the same person keeps it). It lives in the admin chunk so the public entry does not import the session module. Hook tests cover sign-out, a changed person, a refresh and unmount. The wiring in `AdminShell` has no layout-level test of its own.

### WR-15: "Sign Out Other Devices" from the user menu leaves the open devices list stale

**Status:** fixed
**Files modified:** `web/src/layouts/AdminLayout.tsx`, `web/src/modules/admin/hooks/useSessionsQuery.ts`, `web/src/modules/admin/pages/SessionsPage.tsx`, `web/src/layouts/AdminLayout.test.tsx`
**Commit:** 055c7a0
**Applied fix:** `AdminShell` passes `onSignedOut` to the dialog. The "keep only this device, then refetch" logic that `SessionsPage` had inline moved into a shared `refreshAfterSignedOutOthers(queryClient)` used by both. A new test renders `/admin/sessions` with two devices, signs out others from the user menu and waits for the second row to leave; it failed before the fix.

### WR-16: Boot treats any HTTP failure as "no session", then the sign-in loader drops the return path

**Status:** fixed: requires human verification (behavior change)
**Files modified:** `web/src/modules/admin/services/session.ts`, `web/src/modules/admin/services/session.test.ts`, `web/src/modules/admin/guard.ts`, `web/src/modules/admin/guard.test.ts`, `web/src/modules/admin/routes.tsx`
**Commit:** 0d07cbd
**Applied fix:**
- `ensureSession()` returns null only for a 401. A network failure, timeout, 429 or 5xx now rejects, so `requireSessionLoader` throws to the existing admin error screen (existing copy, with "Reload Page") instead of redirecting a person with a valid cookie to a sign-in that cannot work. The next boot tries the refresh again.
- `redirectIfSignedInLoader` now takes the request and redirects a live session to `safeReturnUrl(returnUrl)` instead of the fixed `/admin`, so a deep link survives a reload. The loader still never throws, so the sign-in page opens during an outage. `routes.tsx` passes the loader args through.

## Skipped Issues

### WR-06: `HasDefaultValue(true)` on a `bool` silently turns an inactive insert into an active account

**File:** `src/Csps.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs:17`
**Reason:** Not reproducible on this stack, so no code change was made. I wrote the test first: insert an `ApplicationUser` with `IsActive = false` through the context and read it back. It passed on the unchanged code. EF Core 8 and later use the `HasDefaultValue(...)` value as the sentinel for the property, so with a default of `true` an explicit `false` is written and `true` is left to the column default. The review described the old EF 7 behavior (sentinel = CLR default `false`). The CLR initializer on `ApplicationUser.IsActive` is already `true`, which also differs from the review's description. No migration is needed. The regression test was kept as a guard in `IdentitySchemaTests` (commit c3268da, `test(04): WR-06 ...`). The EF "bool with default" warning the review mentioned did not appear in any build here (0 warnings).
**Original issue:** `IsActive` has a database default of `true`, so an Added entity with `false` was said to insert as active.

## Open items for the owner

1. **CR-01 (rest of the review's fix):** decide whether a failed server sign-out should keep the local session and show an error, which contradicts UI-SPEC "Logout" and needs new copy. Until then a hard reload after a failed server sign-out can still restore the session from the cookie.
2. **WR-04:** confirm that a temporary lockout should refuse the refresh without ending the session (AUTH-10 still holds), and record it in D-39 if so.
3. **WR-12:** confirm that sharing one rate-limit bucket per IPv6 /48 is acceptable.
4. **WR-01:** the new plain-English message "Choose a different password from your current one." was chosen by me (the review suggested a similar line); please confirm the wording.

No schema change, migration or new package was made.

---

_Fixed: 2026-10-15T14:50:00-05:00_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
