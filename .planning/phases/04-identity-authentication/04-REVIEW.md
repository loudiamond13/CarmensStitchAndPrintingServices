---
phase: 04-identity-authentication
reviewed: 2026-10-15T17:14:57.378Z
depth: standard
status: issues_found
files_reviewed: 245
findings:
  critical: 1
  warning: 16
  info: 19
  total: 36
created: 2026-10-15T00:00:00-05:00
updated: 2026-10-15T00:00:00-05:00
files_reviewed_list:
  - src/Csps.Application/Auth/AcceptInviteHandler.cs
  - src/Csps.Application/Auth/AcceptInviteRequest.cs
  - src/Csps.Application/Auth/AcceptInviteRequestValidator.cs
  - src/Csps.Application/Auth/AuthErrors.cs
  - src/Csps.Application/Auth/AuthSettings.cs
  - src/Csps.Application/Auth/CheckInviteHandler.cs
  - src/Csps.Application/Auth/CheckResetLinkHandler.cs
  - src/Csps.Application/Auth/ForgotPasswordHandler.cs
  - src/Csps.Application/Auth/ForgotPasswordRequest.cs
  - src/Csps.Application/Auth/ForgotPasswordRequestValidator.cs
  - src/Csps.Application/Auth/InviteLinkLookup.cs
  - src/Csps.Application/Auth/InviteTokenRequest.cs
  - src/Csps.Application/Auth/ListSessionsHandler.cs
  - src/Csps.Application/Auth/PasswordRules.cs
  - src/Csps.Application/Auth/RefreshHandler.cs
  - src/Csps.Application/Auth/ResendCodeHandler.cs
  - src/Csps.Application/Auth/ResetLinkLookup.cs
  - src/Csps.Application/Auth/ResetPasswordHandler.cs
  - src/Csps.Application/Auth/ResetPasswordRequest.cs
  - src/Csps.Application/Auth/ResetPasswordRequestValidator.cs
  - src/Csps.Application/Auth/ResetTokenRequest.cs
  - src/Csps.Application/Auth/RevokeSessionHandler.cs
  - src/Csps.Application/Auth/SessionIssuer.cs
  - src/Csps.Application/Auth/SessionListItem.cs
  - src/Csps.Application/Auth/SessionResponse.cs
  - src/Csps.Application/Auth/SetNewPasswordHandler.cs
  - src/Csps.Application/Auth/SetNewPasswordRequest.cs
  - src/Csps.Application/Auth/SetNewPasswordRequestValidator.cs
  - src/Csps.Application/Auth/SignInHandler.cs
  - src/Csps.Application/Auth/SignInRequest.cs
  - src/Csps.Application/Auth/SignInRequestValidator.cs
  - src/Csps.Application/Auth/SignOutHandler.cs
  - src/Csps.Application/Auth/SignOutOthersHandler.cs
  - src/Csps.Application/Auth/UserAccount.cs
  - src/Csps.Application/Auth/VerifyCodeHandler.cs
  - src/Csps.Application/Auth/VerifyCodeOutcome.cs
  - src/Csps.Application/Auth/VerifyCodeRequest.cs
  - src/Csps.Application/Auth/VerifyCodeRequestValidator.cs
  - src/Csps.Application/Common/ConcurrencyConflictException.cs
  - src/Csps.Application/Common/ConflictRetry.cs
  - src/Csps.Application/Common/ListQueryRules.cs
  - src/Csps.Application/Common/ResponseFloor.cs
  - src/Csps.Application/Common/ValidationResults.cs
  - src/Csps.Application/Email/AuthEmail.cs
  - src/Csps.Application/Ports/IAccessTokenIssuer.cs
  - src/Csps.Application/Ports/IAccountTokens.cs
  - src/Csps.Application/Ports/IAuditTrail.cs
  - src/Csps.Application/Ports/ICodeMac.cs
  - src/Csps.Application/Ports/ICommonPasswords.cs
  - src/Csps.Application/Ports/IEmailOutbox.cs
  - src/Csps.Application/Ports/IPwnedPasswords.cs
  - src/Csps.Application/Ports/IRequestContext.cs
  - src/Csps.Application/Ports/ISecureRandom.cs
  - src/Csps.Application/Ports/ISessionCache.cs
  - src/Csps.Application/Ports/ISessions.cs
  - src/Csps.Application/Ports/ITwoFactorChallenges.cs
  - src/Csps.Application/Ports/IUnitOfWork.cs
  - src/Csps.Application/Ports/IUserAccounts.cs
  - src/Csps.Application/Users/BootstrapManagerCommand.cs
  - src/Csps.Application/Users/BootstrapManagerCommandValidator.cs
  - src/Csps.Application/Users/BootstrapManagerHandler.cs
  - src/Csps.Application/Users/UserErrors.cs
  - src/Csps.Domain/Auditing/AuditActions.cs
  - src/Csps.Domain/Auditing/IpPrefix.cs
  - src/Csps.Domain/Common/Error.cs
  - src/Csps.Domain/Common/ErrorKind.cs
  - src/Csps.Domain/Identity/AccountToken.cs
  - src/Csps.Domain/Identity/DeviceSummary.cs
  - src/Csps.Domain/Identity/PasswordChangeReason.cs
  - src/Csps.Domain/Identity/PasswordPolicy.cs
  - src/Csps.Domain/Identity/PasswordRuleFailure.cs
  - src/Csps.Domain/Identity/PersonalInfo.cs
  - src/Csps.Domain/Identity/RefreshToken.cs
  - src/Csps.Domain/Identity/SessionOutcomes.cs
  - src/Csps.Domain/Identity/SessionSettings.cs
  - src/Csps.Domain/Identity/SixDigitCode.cs
  - src/Csps.Domain/Identity/TokenHash.cs
  - src/Csps.Domain/Identity/TwoFactorChallenge.cs
  - src/Csps.Domain/Identity/TwoFactorCode.cs
  - src/Csps.Domain/Identity/TwoFactorOutcomes.cs
  - src/Csps.Domain/Identity/TwoFactorSettings.cs
  - src/Csps.Domain/Identity/UserSession.cs
  - src/Csps.Infrastructure/Auditing/AuditTrail.cs
  - src/Csps.Infrastructure/Content/SiteSettingsReader.cs
  - src/Csps.Infrastructure/DependencyInjection.cs
  - src/Csps.Infrastructure/Email/AppLinksOptions.cs
  - src/Csps.Infrastructure/Email/EmailDispatcher.cs
  - src/Csps.Infrastructure/Email/EmailDispatcherOptions.cs
  - src/Csps.Infrastructure/Email/EmailHtmlLayout.cs
  - src/Csps.Infrastructure/Email/EmailOutboxMessage.cs
  - src/Csps.Infrastructure/Email/EmailPreviewOptions.cs
  - src/Csps.Infrastructure/Email/EmailRegistration.cs
  - src/Csps.Infrastructure/Email/EmailRenderer.cs
  - src/Csps.Infrastructure/Email/EmailSenderOptions.cs
  - src/Csps.Infrastructure/Email/IEmailTransport.cs
  - src/Csps.Infrastructure/Email/InMemoryEmailSink.cs
  - src/Csps.Infrastructure/Email/MailKitTransport.cs
  - src/Csps.Infrastructure/Email/OutboxEmailSender.cs
  - src/Csps.Infrastructure/Email/OutboxSignal.cs
  - src/Csps.Infrastructure/Email/SmtpOptions.cs
  - src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs
  - src/Csps.Infrastructure/Idempotency/IdempotencyRecord.cs
  - src/Csps.Infrastructure/Idempotency/IdempotencyRegistration.cs
  - src/Csps.Infrastructure/Identity/AccountTokenStore.cs
  - src/Csps.Infrastructure/Identity/ApplicationUser.cs
  - src/Csps.Infrastructure/Identity/AuthSecretsOptions.cs
  - src/Csps.Infrastructure/Identity/HmacCodeMac.cs
  - src/Csps.Infrastructure/Identity/IdentityRegistration.cs
  - src/Csps.Infrastructure/Identity/SecureRandom.cs
  - src/Csps.Infrastructure/Identity/SessionCache.cs
  - src/Csps.Infrastructure/Identity/SessionStore.cs
  - src/Csps.Infrastructure/Identity/TestingAccountActivation.cs
  - src/Csps.Infrastructure/Identity/TwoFactorChallengeStore.cs
  - src/Csps.Infrastructure/Identity/UserAccounts.cs
  - src/Csps.Infrastructure/Passwords/CommonPasswordList.cs
  - src/Csps.Infrastructure/Passwords/HibpPwnedPasswords.cs
  - src/Csps.Infrastructure/Passwords/HibpRangeParser.cs
  - src/Csps.Infrastructure/Passwords/PasswordCheckRegistration.cs
  - src/Csps.Infrastructure/Passwords/TestingPwnedPasswords.cs
  - src/Csps.Infrastructure/Persistence/Configurations/AccountTokenConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/EmailOutboxMessageConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/IdempotencyRecordConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/RefreshTokenConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/RoleConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/TwoFactorChallengeConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/TwoFactorCodeConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/UserSessionConfiguration.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContextOptions.cs
  - src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261015020438_AddIdentity.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261015022016_AddEmailOutbox.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261015032323_AddTwoFactorChallenges.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261015042245_AddUserSessions.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261015060201_AddAccountTokens.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261015081003_AddIdempotencyRecords.cs
  - src/Csps.Infrastructure/Seeding/BootstrapManagerOptions.cs
  - src/Csps.Infrastructure/Seeding/BootstrapTargetGuard.cs
  - src/Csps.Infrastructure/Seeding/SystemRequestContext.cs
  - tools/Csps.BootstrapManager/Program.cs
  - tools/Csps.EmailPreview/Program.cs
  - tools/scripts/Initialize-DevSecrets.ps1
  - tools/scripts/New-ThirdPartyNotices.ps1
  - src/Csps.Server/Composition/ApplicationRegistration.cs
  - src/Csps.Server/Composition/AuthRegistration.cs
  - src/Csps.Server/Composition/BuildFlavor.cs
  - src/Csps.Server/Composition/SecurityRegistration.cs
  - src/Csps.Server/Controllers/AuthSessionController.cs
  - src/Csps.Server/Controllers/InviteController.cs
  - src/Csps.Server/Controllers/PasswordController.cs
  - src/Csps.Server/Controllers/SessionsController.cs
  - src/Csps.Server/Controllers/SignInController.cs
  - src/Csps.Server/Controllers/SiteSettingsController.cs
  - src/Csps.Server/Controllers/TestingEmailsController.cs
  - src/Csps.Server/Controllers/TestingFixturesController.cs
  - src/Csps.Server/Http/CorrelationId.cs
  - src/Csps.Server/Http/CspsProblemDetails.cs
  - src/Csps.Server/Http/HttpRequestContext.cs
  - src/Csps.Server/Http/PlainEnglish.cs
  - src/Csps.Server/Http/RequestBodyLimitMiddleware.cs
  - src/Csps.Server/Http/ResultHttpExtensions.cs
  - src/Csps.Server/Logging/SensitiveDataMasking.cs
  - src/Csps.Server/Program.cs
  - src/Csps.Server/Security/AccessTokenIssuer.cs
  - src/Csps.Server/Security/AuthCookies.cs
  - src/Csps.Server/Security/IdempotencyExemptAttribute.cs
  - src/Csps.Server/Security/IdempotencyMiddleware.cs
  - src/Csps.Server/Security/RateLimitSettings.cs
  - src/Csps.Server/Security/RateLimitingRegistration.cs
  - src/Csps.Server/Security/RequireCsrfHeaderAttribute.cs
  - src/Csps.Server/Testing/TestingConfiguration.cs
  - src/Csps.Server/Testing/TestingControllersFeatureProvider.cs
  - src/Csps.Server/Testing/TestingHostRegistration.cs
  - src/Csps.Server/Testing/TestingOnlyAttribute.cs
  - web/eslint.config.mjs
  - web/playwright.config.ts
  - web/scripts/budget.ts
  - web/scripts/class-gate.config.mjs
  - web/scripts/owner-review.mjs
  - web/scripts/render-email-logo.mjs
  - web/src/components/actions/Button.tsx
  - web/src/components/actions/ButtonLink.tsx
  - web/src/components/actions/button.recipe.ts
  - web/src/components/actions/index.ts
  - web/src/components/brand/Logo.tsx
  - web/src/components/brand/brand.recipe.ts
  - web/src/components/entry/OtpInput.tsx
  - web/src/components/layout/layout.recipe.ts
  - web/src/components/lists/cells.tsx
  - web/src/components/navigation/Topbar.tsx
  - web/src/components/navigation/UserMenu.tsx
  - web/src/components/overlays/Modal.tsx
  - web/src/components/overlays/index.ts
  - web/src/components/overlays/useInertOutside.ts
  - web/src/components/states/ErrorState.tsx
  - web/src/components/states/LoadingRegion.tsx
  - web/src/components/states/Note.tsx
  - web/src/components/states/index.ts
  - web/src/components/states/states.recipe.ts
  - web/src/core/api/apiClient.ts
  - web/src/core/api/http/HttpError.ts
  - web/src/core/api/http/httpClient.ts
  - web/src/core/routes/router.tsx
  - web/src/layouts/AdminLayout.tsx
  - web/src/layouts/AuthLayout.tsx
  - web/src/lib/query/keys.ts
  - web/src/modules/admin/authCopy.ts
  - web/src/modules/admin/authSchemas.ts
  - web/src/modules/admin/components/AuthCards.tsx
  - web/src/modules/admin/components/AuthFrame.tsx
  - web/src/modules/admin/components/AuthHeader.tsx
  - web/src/modules/admin/components/NewPasswordFields.tsx
  - web/src/modules/admin/components/SessionsView.tsx
  - web/src/modules/admin/components/SignInForm.tsx
  - web/src/modules/admin/components/SignOutDeviceDialog.tsx
  - web/src/modules/admin/components/SignOutDialog.tsx
  - web/src/modules/admin/components/SignOutOthersDialog.tsx
  - web/src/modules/admin/components/authHeadingLevel.ts
  - web/src/modules/admin/components/deviceSummary.ts
  - web/src/modules/admin/copy.ts
  - web/src/modules/admin/guard.ts
  - web/src/modules/admin/hooks/usePostSignInToast.ts
  - web/src/modules/admin/hooks/useSession.ts
  - web/src/modules/admin/hooks/useSessionCapWarning.ts
  - web/src/modules/admin/hooks/useSessionsQuery.ts
  - web/src/modules/admin/pages/AcceptInvitePage.tsx
  - web/src/modules/admin/pages/AdminNotFoundPage.tsx
  - web/src/modules/admin/pages/AdminPreviewPage.tsx
  - web/src/modules/admin/pages/ForgotPasswordPage.tsx
  - web/src/modules/admin/pages/NewPasswordPage.tsx
  - web/src/modules/admin/pages/ResetPasswordPage.tsx
  - web/src/modules/admin/pages/SessionsPage.tsx
  - web/src/modules/admin/pages/SignInPage.tsx
  - web/src/modules/admin/pages/VerifyCodePage.tsx
  - web/src/modules/admin/previewCopy.ts
  - web/src/modules/admin/routes.tsx
  - web/src/modules/admin/sections.ts
  - web/src/modules/admin/services/authService.ts
  - web/src/modules/admin/services/inviteService.ts
  - web/src/modules/admin/services/passwordService.ts
  - web/src/modules/admin/services/session.ts
  - web/src/modules/admin/services/sessionsService.ts
  - web/src/utils/format.ts
  - web/src/utils/passwordRules.ts
---

# Phase 04: Code Review Report

Reviewed in four parallel parts at standard depth (production code only; tests excluded). Finding IDs are renumbered across parts.

## Part 1: Domain and Application

**Reviewed:** 2026-10-15
**Depth:** standard
**Files Reviewed:** 82
**Status:** issues_found

### Summary

The Domain and Application layers are in good shape. Strong points I traced and found correct:

- Secrets are stored only as SHA-256 hashes or MACs, and compared in fixed time.
- The response floor, the dummy hash and the generic 401 hold the CWE-203/204 line on sign-in and forgot-password.
- Refresh rotation is guarded by the session `RowVersion`, so concurrent rotations cannot both win.
- Wrong-code counting is guarded by concurrency tokens on `TwoFactorCode` (`FailedAttempts`, `SupersededAt`, `ConsumedAt`), so parallel guesses cannot beat the 5-try limit.
- Reset and invite links are single-use, and the `Use` plus `RevokeOpen` save happens first.
- Rate limiting is applied at the controllers.

I found no Critical issue. Four Warnings are real behavior or security defects, each verified against the source and the Infrastructure it relies on.

### Warnings

### WR-01: The must-change step accepts the current (temporary or breached) password as the "new" password

**File:** `src/Csps.Application/Auth/SetNewPasswordHandler.cs:80-91`
**Issue:** D-13 exists to force a person to replace a Manager-set temporary password (D-21) or a breached one. `ApplyAsync` runs `PasswordRules.CheckAsync` and then `SetPasswordAsync`. Nothing compares the new value with the current password.
- For a temporary password such as `Tela-Sukat-7381`, which a Manager knows and which is not in HIBP, the person can type the same value. It passes every rule, the flag is cleared, and the Manager-known password stays live.
- For a Breach reason, the same breached password is accepted whenever HIBP is down (fail-open to the 10k common list only).
- This defeats the purpose of the gate.

**Fix:** Reject a new password that matches the stored one. `IUserAccounts.CheckPasswordAsync` already exists, so no new port is needed:
```csharp
if (await accounts.CheckPasswordAsync(user.Id, request.NewPassword!, cancellationToken).ConfigureAwait(false) == PasswordCheck.Succeeded)
{
    return Result.Failure<IssuedSession>(AuthErrors.NewPasswordRejected("Choose a password you haven't used before."));
}
```
Put this after the policy check and before the transaction. Add a matching message to the web mirror.

### WR-02: SignIn and ResendCode let `ConcurrencyConflictException` escape, which gives a 500

**File:** `src/Csps.Application/Auth/ResendCodeHandler.cs:55-77`, `src/Csps.Application/Auth/SignInHandler.cs:169-195`
**Issue:** `CspsUnitOfWork.SaveChangesAsync` converts `DbUpdateConcurrencyException` into `ConcurrencyConflictException`. Only `VerifyCodeHandler` and `SetNewPasswordHandler` catch it, and the other handlers use `ConflictRetry`. Nothing in `Csps.Server` maps it; the only handler is `UseExceptionHandler` to 500 (`Program.cs:101`). Two paths hit it:
- **ResendCode:** `IssueCode` sets `SupersededAt` on the active code, which is a concurrency token (`TwoFactorCodeConfiguration`). A double click on Resend makes two requests load the same code, and the second save conflicts. The user gets "Something went wrong" instead of the normal cooldown 429.
- **SignIn:** `StartChallengeAsync` calls `InvalidateOpenAsync`, which changes the existing challenge row (`RowVersion`). A double-submitted login, or two tabs, with an earlier open challenge makes the second request throw. It returns a 500 and skips the response floor. It also shows that the password was correct, because only a correct password reaches this code.

**Fix:**
- In `ResendCodeHandler`, wrap `SendAsync` with `ConflictRetry.RunAsync(...)`, or catch the exception and return `AuthErrors.ResendCooldown(settings.ResendCooldown)` (as `VerifyCodeHandler` does with `TicketExpired`).
- In `SignInHandler`, wrap `StartChallengeAsync` with `ConflictRetry.RunAsync(() => StartChallengeAsync(...), null)`. Treat a null outcome as the generic `InvalidCredentials`, and keep the `ResponseFloor.WaitAsync` call on that path.

### WR-03: Setting a new password at the must-change step leaves the person's other sessions alive

**File:** `src/Csps.Application/Auth/SetNewPasswordHandler.cs:94-124`
**Issue:** `ResetPasswordHandler` ends every session on a password change (`sessions.RevokeAllAsync` with `PasswordReset`, plus eviction). `SaveAsync` here changes the password and starts a new session, but never revokes the account's earlier sessions. This hurts most in the Breach case. The password was found in a breach, so an attacker may already hold a refresh session from it. Changing the password does not end that session, and the 90-day refresh chain keeps working. (Sessions, not tokens: `SetPasswordAsync` renews the Identity security stamp, but session validity is checked by `ISessionCache`/`UserSession`, not the stamp.)

**Fix:** Inside the transaction, after `SetPasswordAsync`, revoke all existing sessions before creating the new one. Evict them from the cache after the commit:
```csharp
await sessions.RevokeAllAsync(user.Id, null, SessionRevocationReason.PasswordReset, now, cancellationToken).ConfigureAwait(false);
audit.Record(AuditActions.SessionsRevoked, UserTarget, Key(user.Id), "password-reset");
// ... after the transaction: await sessionCache.EvictUserAsync(user.Id, cancellationToken);
```
This needs `ISessions` and `ISessionCache` in the constructor. Call `RevokeAllAsync` before `sessionIssuer.StartAsync`, so the new session is not revoked.

### WR-04: A temporary lockout makes Refresh revoke the session for good, so anyone who knows an email can force a sign-out

**File:** `src/Csps.Application/Auth/RefreshHandler.cs:65-70` (with `SignInHandler.cs:86-89`)
**Issue:** `user.LockoutEnd > now` is treated like a deactivated account: `EndForInactiveAccountAsync` permanently revokes the session (`AccountInactive`). `LockoutEnd` is also set by five wrong passwords (`CountFailureAsync`), which any unauthenticated caller can cause for a known staff email, and by the code lockout. A signed-in Admin or Manager whose access token expires inside a 15-minute lockout window loses the session, not just sign-in, and has to go through password plus emailed code again. An attacker who re-locks every 15 minutes can keep staff from holding a session. Per-IP rate limiting slows this down but does not remove it. The code comment cites AUTH-10/T-04-53, so this follows the stated rule, but the result is an availability weakness (CWE-645) that goes beyond what a lockout is meant to do.

**Fix:** Revoke the session for a deactivated or missing account only. For a temporary lock, return `SessionEnded` (a 401) without revoking, so the session recovers once the lock passes:
```csharp
if (user is null || !user.IsActive)
{
    await EndForInactiveAccountAsync(lookup, now, cancellationToken).ConfigureAwait(false);
    return Result.Failure<RefreshOutcome>(AuthErrors.SessionEnded);
}

if (user.LockoutEnd > now)
{
    return Result.Failure<RefreshOutcome>(AuthErrors.SessionEnded);   // keep the session; the lock expires
}
```
If the owner wants a code-lockout to kill sessions, apply that rule only to code lockouts, and record the decision in D-39.

### Info

### IN-01: `PasswordRules.CheckAsync` awaits the breach call without `ConfigureAwait(false)`

**File:** `src/Csps.Application/Auth/PasswordRules.cs:75`
**Issue:** Every other `await` in Application uses `.ConfigureAwait(false)`. This one is missing it. It is harmless under ASP.NET Core, but it is inconsistent and may trip CA2007 if that analyzer is enabled for the library.
**Fix:** `var answer = await pwned.CheckAsync(normalized, cancellationToken).ConfigureAwait(false);`

### IN-02: Magic strings and repeated helpers

**File:** `src/Csps.Application/Auth/SignInHandler.cs:68-89`, `ForgotPasswordHandler.cs:66-116`, and others
**Issue:**
- The audit detail strings (`"unknown-account"`, `"no-password"`, `"deactivated"`, `"unconfirmed"`, `"locked"`, `"bad-password"`, `"password"`, `"code"`) are literals, even though `AuditActions.SignInFailureReasons`, `LockoutDetails` and `SessionsRevokedDetails` list them as the contract. A typo would not be caught.
- The `Key(Guid)` helper is copied into 7 handlers.
- `NewPasswordRequired = "Enter a new password."` is declared three times in the validators and once more in `PasswordPolicy.MessageFor`.
- `InviteLinkLookup` and `ResetLinkLookup` are near copies of each other.

**Fix:** Add `const` members to `AuditActions` for the details. Share one `AuditKey.Of(Guid)` extension. Define one `PasswordRules.NewPasswordRequired` and reference it from the three validators.

### IN-03: Dead port member and discarded return values

**File:** `src/Csps.Application/Ports/IUserAccounts.cs:73-77` (`IsLockedOutAsync`); `SignInHandler.cs:118-133` and `138-165`
**Issue:**
- `IUserAccounts.IsLockedOutAsync` is never called from Application or Server; only the Infrastructure implementation and its own use of Identity reference it. It is dead surface area.
- `CountFailureAsync` returns `result.LockedNow`, and `RecheckBreachAsync` returns `breached`. Both values are discarded and exist only to satisfy `InTransactionAsync<T>`.
- In `RecheckBreachAsync`, the non-breach branch relies on `ClearBreachRecheckAsync` saving through UserManager, because `SaveChangesAsync` is called only when breached. That is correct today but easy to break.

**Fix:** Remove `IsLockedOutAsync` from the port. Return a constant `true` from the two lambdas (or add a non-generic `InTransactionAsync` overload). Add a one-line comment, or call `SaveChangesAsync` on both branches.

### IN-04: `ListQueryRules` messages hard-code the limits

**File:** `src/Csps.Application/Common/ListQueryRules.cs:25,35`
**Issue:** "Use a page size from 1 to 100." and "Use 100 characters or fewer." repeat the numbers that `ListQueryLimits` defines. Changing the constant would leave a wrong message.
**Fix:** Build the messages from the constants, for example `$"Use a page size from 1 to {ListQueryLimits.MaxPageSize}."` with `CultureInfo.InvariantCulture`.

### IN-05: The breach lookup (an outbound HTTP call) runs inside an open database transaction

**File:** `src/Csps.Application/Auth/AcceptInviteHandler.cs:60-72`, `ResetPasswordHandler.cs:66-79`
**Issue:** `passwordRules.CheckAsync` calls HIBP inside `InTransactionAsync`. A slow or down HIBP service holds a transaction and a pooled connection for the whole timeout, and the 256 MB, one-DB host has a small connection budget. The read-only lookups ahead of it take no meaningful locks, but the retry from `ConflictRetry` can repeat the HTTP call. `SignInHandler.RecheckBreachAsync` and `SetNewPasswordHandler` already do the call before the transaction.
**Fix:** Look up the link, run the password check, then open the transaction. Re-read the token inside it, since the link must still be usable at commit time. The row-version check on the token already guards this.

### IN-06: `ToString` on some records can print personal data, and an audit doc line is wrong

**File:** `src/Csps.Application/Auth/UserAccount.cs:17`, `src/Csps.Application/Email/AuthEmail.cs:62,92,106,122`, `src/Csps.Domain/Auditing/AuditActions.cs:54-55`
**Issue:**
- `UserAccount` and the notice emails (`AccountLockedEmail`, `PasswordChangedEmail`, `ManagerResetEmail`, `DeactivatedNoticeEmail`) keep the generated `ToString`. It prints the email address and names, which the project treats as data to keep out of logs. The secret-bearing records already override `ToString`.
- The `AuditActions.PasswordChanged` summary says "A signed-in user changed their own password", but it is recorded by `SetNewPasswordHandler`, where no session exists yet.

**Fix:** Override `ToString` to return the type name on `UserAccount` and on the base `AuthEmail`. Reword the `PasswordChanged` summary.

---

_Reviewed: 2026-10-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Part 2: Infrastructure and tools

**Reviewed:** 2026-10-15
**Depth:** standard
**Files Reviewed:** 62
**Status:** issues_found

### Summary

The Infrastructure layer is carefully built. SQL is parameterized (the two `sp_getapplock` calls use parameters, and the lock resource is a hash or a GUID). Secrets stay out of logs and error messages. TLS is required for SMTP with default certificate checks. Tokens, tickets and codes are stored only as SHA-256 or HMAC values. The outbox is encrypted. The migrations contain no JSON columns, nothing migrates at startup, and the tools refuse unsafe databases. No Critical (data-loss or auth-bypass) defect was found in this scope.

Five Warnings were verified against the source: a lockout-counter race, a latent EF boolean-default trap, an Identity username-character restriction that rejects valid emails, hard-coded lifetimes in email copy that are configurable elsewhere, and a send-success path that can cause duplicate emails. Four Info items follow.

### Warnings

### WR-05: Failed-password counter can be lost under concurrent guesses (lockout throttle bypass)

**File:** `src/Csps.Infrastructure/Identity/UserAccounts.cs:107-116` (caller `src/Csps.Application/Auth/SignInHandler.cs:116-132`)
**Issue:** `RecordFailedPasswordAsync` uses `UserManager.AccessFailedAsync`, which does a read-modify-write on the user row guarded by `ConcurrencyStamp`. Identity's EF store answers a lost race with `IdentityResult.Failed(ConcurrencyFailure)`, and `Require(...)` turns that into an `InvalidOperationException`. If N guesses for one account run in parallel, every guess has already been verified as wrong by `CheckPasswordAsync` and only one increment is saved. The other N-1 requests fail with a 500, and their failures are never counted. An attacker who spreads requests over several source IPs (the rate limiter is per client) gets about N guesses per counted failure, so the 5-attempt lockout is weaker than intended (CWE-307, CWE-362). The password still has to pass the emailed code step, which limits the impact.
**Fix:** Make the increment atomic or retry on concurrency failure. Preferred is a set-based update:
```csharp
// in UserAccounts.RecordFailedPasswordAsync
await context.Database.ExecuteSqlInterpolatedAsync(
    $"UPDATE AspNetUsers SET AccessFailedCount = AccessFailedCount + 1 WHERE Id = {id}", cancellationToken);
// then reload, and set LockoutEnd when the new count reaches Lockout.MaxFailedAccessAttempts
```
Alternatively catch the `ConcurrencyFailure` code in `Require`, reload the user and repeat `AccessFailedAsync` up to a small bound, so no wrong guess goes uncounted.

### WR-06: `HasDefaultValue(true)` on a `bool` silently turns an inactive insert into an active account

**File:** `src/Csps.Infrastructure/Persistence/Configurations/ApplicationUserConfiguration.cs:165`
**Issue:** `IsActive` has a CLR default of `false` and a database default of `true`. EF treats `false` on an Added entity as "not set", leaves the column out of the INSERT, and the database default `true` applies. Any code that inserts `new ApplicationUser { IsActive = false }` creates an active account. This is a security-relevant trap, because the Phase 4 text and the migration snapshot (`CspsDbContextModelSnapshot.cs:557-560`, `ValueGeneratedOnAdd`) show EF is relying on the database default. Updates are not affected, which is why the current tests that deactivate an existing user pass. A later user-management or legacy-data import that creates a deactivated user would misbehave. EF also logs a "bool with default" model-validation warning, which conflicts with the zero-warnings rule.
**Fix:** Remove the database default and let the property initializer carry the value, or give the property a sentinel that is not a valid state.
```csharp
builder.Property(user => user.IsActive).HasDefaultValue(true).HasSentinel(true);
```
This needs a new migration. If the existing default must stay for raw SQL inserts, keep the default and add `HasSentinel(true)` so an explicit `false` is written.

### WR-07: Identity's default `AllowedUserNameCharacters` rejects valid staff emails

**File:** `src/Csps.Infrastructure/Identity/IdentityRegistration.cs:264-278` (use at `UserAccounts.cs:52-66`)
**Issue:** `UserName` is set to the email, and `IdentityOptions.User.AllowedUserNameCharacters` is left at its default (`a-zA-Z0-9-._@+`). The app's own validator, `SignInRequestValidator.IsEmailShaped` (`src/Csps.Application/Auth/SignInRequestValidator.cs:36-45`), only requires one `@` with text on both sides. An address such as `o'brien@example.com`, or any with `!#$%&*/=?^{|}~` or non-ASCII letters, passes validation and then fails `users.CreateAsync` with `InvalidUserName`. `Require` throws `InvalidOperationException`, so the invite or bootstrap path ends in a 500 or "Failed" instead of a clean message.
**Fix:** Allow every character, because the email validator and unique index are the real rules:
```csharp
options.User.AllowedUserNameCharacters = string.Empty;
```
Add a test that creates an account for `o'brien@example.com`.

### WR-08: Email copy hard-codes lifetimes that `AuthSettings` makes configurable

**File:** `src/Csps.Infrastructure/Email/EmailRenderer.cs:61,66,76,82,97,153`
**Issue:** The text says "It works for 15 minutes", "paused sign-in for 15 minutes", "This link works for 30 minutes" and "72 hours". `AuthSettings` (`CodeLifetime`, `CodeLockoutDuration`, `ResetLinkLifetime`, `InviteLinkLifetime`) are `init` properties bound from the `Auth` configuration section, so the real expiry can differ from the email. The email records already carry the true `ExpiresAt` (`SignInCodeEmail`, `PasswordResetEmail`, `InviteEmail`), but the renderer ignores it. Staff are told a code or link is valid for the wrong time. The lockout length also lives separately in `IdentityRegistration` (`DefaultLockoutTimeSpan = 15 minutes`).
**Fix:** Derive the wording from the record, for example `var minutes = (int)Math.Round((email.ExpiresAt - email.RequestedAt).TotalMinutes)` and format it as "15 minutes" or "72 hours". Source the Identity lockout length from one setting that the email also reads.

### WR-09: A failure after a successful SMTP send is recorded as a send failure and retried, so staff can get duplicate emails

**File:** `src/Csps.Infrastructure/Email/MailKitTransport.cs:66-69` (with `EmailDispatcher.cs:143-157`)
**Issue:** `SendAsync` ends with `await client.DisconnectAsync(quit: true, ...)`. After `client.SendAsync` returns, the server has accepted the message. If `QUIT` or the socket close throws (an `IOException` or `SmtpProtocolException` after the server drops the connection), the dispatcher classifies the exception as `smtp-connect` or `smtp-send`, schedules a retry and sends the sign-in code or reset link again. A reset link or code arriving twice is confusing and weakens the "only once" message. The same happens if the process stops between the send and `MarkSent` is saved, but this one is avoidable.
**Fix:** Treat the message as sent once `SendAsync` has returned, and ignore errors from the disconnect:
```csharp
await client.SendAsync(message, cancellationToken).ConfigureAwait(false);
try { await client.DisconnectAsync(quit: true, cancellationToken).ConfigureAwait(false); }
catch (Exception) when (!cancellationToken.IsCancellationRequested) { /* the message is already accepted */ }
```

### Info

### IN-07: `BootstrapTargetGuard.IsLocalServer` misses some loopback forms, so the `CSPS_*` allow-list is skipped

**File:** `src/Csps.Infrastructure/Seeding/BootstrapTargetGuard.cs:258-273`
**Issue:** `tcp:[::1],1433` becomes host `[::1]`, which is not in `LoopbackHosts` (`::1` without brackets). Named-pipe sources (`np:\\.\pipe\...`) and the machine's own host name are also treated as remote. For those the `CSPS_Dev | CSPS_E2E | CSPS_Test_<guid>` rule is not applied and the command only needs `--confirm-database`. `BetsLLC_*`, `CSPS_Legacy_Restore` and the system databases are still refused by name, so the exposure is limited to other non-protected local databases.
**Fix:** Trim `[` and `]` from `host` before the comparison, and treat `np:` sources whose pipe path names `localhost`/`.`/`LOCALDB#` as local. If a remote host is meant to be allowed only for production, say so in the summary comment, as the doc comment currently says "on this machine only CSPS_Dev ...".

### IN-08: Closed email-outbox rows keep the recipient address indefinitely

**File:** `src/Csps.Infrastructure/Email/EmailOutboxMessage.cs:30,155-160`
**Issue:** `Scrub()` removes the subject and bodies, but `ToAddress` and the metadata remain, and nothing in the reviewed code purges sent, failed or expired rows (the rate-limit query `CountRecentAsync` needs recent rows only). Staff email addresses accumulate without a retention rule, and the `IX_EmailOutbox_*` indexes grow. The idempotency table at least names a purge job (JOB-01).
**Fix:** Record a retention rule and add the purge to the planned cleanup job (for example delete closed rows older than 30 days), or note in the phase docs that it is deferred.

### IN-09: `HibpPwnedPasswords.CheckAsync` omits `ConfigureAwait(false)` and has no response size cap

**File:** `src/Csps.Infrastructure/Passwords/HibpPwnedPasswords.cs:83,90`
**Issue:** Every other await in the layer uses `ConfigureAwait(false)`; these two do not. The response body is read with `ReadAsStringAsync` without a size limit. The range answer is normally under 100 KB, and the 3 s total timeout bounds the wait, but a malformed or hostile response could still be read in full (memory pool is 256 MB).
**Fix:** Add `.ConfigureAwait(false)`, and set `HttpClient.MaxResponseContentBufferSize` (for example 1 MB) when the typed client is registered.

### IN-10: `AppLinksOptions.IsValid` accepts URLs with user info

**File:** `src/Csps.Infrastructure/Email/AppLinksOptions.cs:416-425`
**Issue:** A value such as `https://staff@evil.example` or `https://example.com/anything` passes: the check only requires an absolute https URL with no query or fragment. The value is operator-supplied configuration, so this is a hardening gap rather than an exploit, but reset and invite links are built from it.
**Fix:** Also require `string.IsNullOrEmpty(url.UserInfo)`, and decide whether a non-root path is allowed.

---

_Reviewed: 2026-10-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Part 3: Server and web build scripts

**Reviewed:** 2026-10-15
**Depth:** standard
**Files Reviewed:** 37
**Status:** issues_found

### Summary

The Server layer is in good shape for the security properties the review brief named. Checked and found sound:

- Every controller and action declares `[Authorize(Policy = ...)]` or `[AllowAnonymous]` explicitly. The fallback policy is default-deny.
- The refresh and ticket cookies are `__Secure-` prefixed, HttpOnly, Secure and SameSite=Strict, scoped to `/api/v1/auth`. They are deleted with matching attributes.
- The cookie-reading POSTs carry `[RequireCsrfHeader]` (custom header plus `Sec-Fetch-Site`). There is no CORS, so a cross-origin page cannot add the header.
- JwtBearer pins algorithm, type (`at+jwt`), issuer, audience and lifetime, and checks the active session on every request.
- ProblemDetails never leaks exception text; 5xx bodies are reduced to the reference text.
- The Testing controllers are compiled only under `CSPS_TESTING` (Debug). They are removed from the application parts unless the environment is `Testing`, and a Debug build refuses to start as Production.
- No open-redirect sink exists (no redirect built from user input), and email links come from `App:PublicBaseUrl`, not the Host header.

No Critical issues were found. The Warnings are a latent idempotency scoping flaw, an oversize-body status mapping that is untested and goes wrong for chunked bodies, a rate-limit bucket granularity that is weak against IPv6, and a bundle-budget gap for the shipped admin app.

### Warnings

### WR-10: Idempotency scope uses the route pattern and the body only, not the actual path or query

**File:** `src/Csps.Server/Security/IdempotencyMiddleware.cs:109-110` and `121-142`
**Issue:** The stored-answer scope is `"POST " + endpoint.RoutePattern.RawText`, and the request hash covers the body bytes only. For a templated route such as `POST /orders/{id}/payments` or `/orders/{id}/cancel`, two requests for different resources share the same scope. They also share the same hash when the body is empty or identical. If a client reuses a key (a stale form, a bug, an Android client that follows the same pattern), the second request gets `Idempotent-Replayed: true` with the first resource's answer. It never runs and never gets the 422 mismatch. For an order or payment system this is a silent lost write.

No templated POST route exists in Phase 4, so the flaw is latent. Phase 5 onwards will hit it, and the gate is the shared mechanism (SEC-06).

**Fix:** Hash the concrete request target together with the body. Keep the pattern as the scope key if wanted.
```csharp
// in InvokeAsync, replace `var requestHash = await HashBodyAsync(...)`
var requestHash = await HashRequestAsync(context.Request, context.RequestAborted).ConfigureAwait(false);

private static async Task<byte[]> HashRequestAsync(HttpRequest request, CancellationToken ct)
{
    request.EnableBuffering((int)RequestBodyLimitMiddleware.MaxBytes, RequestBodyLimitMiddleware.MaxBytes);
    using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
    // Bind the key to the exact target: path + query, length-prefixed so it cannot blur into the body.
    var target = Encoding.UTF8.GetBytes($"{request.Path}{request.QueryString}\n");
    hash.AppendData(target);
    // ... then append the body bytes as today
}
```
Add a test with two ids and one key that expects 422, not a replay.

### WR-11: A chunked body over 1 MB becomes a 500, not the 413 the middleware promises (and it is untested)

**File:** `src/Csps.Server/Program.cs:101-104`, `src/Csps.Server/Http/RequestBodyLimitMiddleware.cs:28-33`, `src/Csps.Server/Security/IdempotencyMiddleware.cs:124-133`
**Issue:** `RequestBodyLimitMiddleware` answers 413 only for a declared `Content-Length` over the limit. For a chunked or undeclared body it relies on `IHttpMaxRequestBodySizeFeature`, which makes the later read throw `BadHttpRequestException` (413). That read happens either in `IdempotencyMiddleware.HashBodyAsync` or in MVC body binding, both inside `UseExceptionHandler`. The handler is registered unconditionally as `CspsProblemDetails.WriteAsync(context, 500)`, so any exception, including the framework's own 413, is rewritten to "Something went wrong. Reference: ...", and it is logged as a server error.

`EnableBuffering(bufferThreshold, bufferLimit)` in the idempotency path has the same shape: its overflow throws `InvalidDataException`, which also becomes a 500.

The class summary and SEC-03/T-04-18 promise a 413 for "any other body", but `RequestBodyLimitTests` only covers the `Content-Length` case.

**Fix:** Map the exception to its own status in the handler, and add a chunked-body test on a real Kestrel host.
```csharp
ExceptionHandler = static context =>
{
    var feature = context.Features.Get<IExceptionHandlerFeature>();
    var status = feature?.Error is BadHttpRequestException bad ? bad.StatusCode : StatusCodes.Status500InternalServerError;
    return CspsProblemDetails.WriteAsync(context, status);
},
```
In `HashBodyAsync`, catch `InvalidDataException` and write the same 413.

### WR-12: Auth rate limits key IPv6 clients by /64, which a single subscriber can rotate through

**File:** `src/Csps.Server/Security/RateLimitingRegistration.cs:80-97` (comment at 68-71)
**Issue:** The bucket is the first 64 bits of the address, on the stated assumption that "one host owns a /64". Residential and mobile IPv6 delegations are usually a /56 or /64 per device on a /48-/60. A site with a /48 has 65,536 distinct /64 buckets. A sign-in or forgot-password attacker on IPv6 can rotate the source address across prefixes and get a fresh 10/min, 5/15 min bucket each time. That defeats SEC-03 (CWE-307, CWE-799) for IPv6 sources, and each limiter pass also creates a new idempotency row on the anonymous POSTs. The project already truncates audit IPs to /48 for IPv6 (D-32), so the two policies disagree. Account-level lockout in the handlers still protects password guessing, but the per-address limit is the only throttle on email-sending endpoints.

**Fix:** Bucket IPv6 at /48 (6 bytes), matching the audit truncation, or add a second coarser partition. This is a one-line change.
```csharp
private const int IPv6PrefixBytes = 6; // /48
...
return $"{new IPAddress(bytes)}/48";
```
Update the doc comment and `PartitionKey` tests.

### WR-13: The admin bundle budget is not enforced for the shipped admin app

**File:** `web/scripts/budget.ts:90-95`, `101-106`, `242-245`
**Issue:** Since Phase 4 the guarded admin app ships in every build (`adminRoutes` in `src/modules/admin/routes.tsx`, per the comment at `budget.ts:98`). The budget code did not follow that change:
- `adminJs` is measured only when `devRoutes` is true, so the production build never measures it (line 243).
- `ADMIN_ROUTE` is `AdminLayout`, `UrlStateLayout` and `AdminPreviewPage`. `AdminPreviewPage` is dev-only and listed in `DEV_ONLY_MODULE_PREFIXES`, so it cannot exist in a production chunk.
- The real shipped admin entries (`AuthLayout`, `SignInPage`, `VerifyCodePage`, `SessionsPage`, `guard`) are not part of any measurement.

The PERF-01 limit of 250 KB gz for admin JS is therefore not checked against what users download. A regression in the sign-in or devices code would pass `npm run budget` and the production build.

**Fix:** Measure admin JS in every build, using real routes (for example `AuthLayout` plus `SignInPage` for the unauthenticated entry, and `AdminLayout` plus `SessionsPage` for the signed-in entry, taking the larger). Keep `AdminPreviewPage` out of the production list. Update `budget.test.ts` to match.
```ts
export const ADMIN_ROUTE = ['src/layouts/AdminLayout.tsx', 'src/lib/url-state/UrlStateLayout.tsx', 'src/modules/admin/pages/SessionsPage.tsx'];
// evaluateBudgets: push measureRoute(... 'adminJs' ...) for every build, not only `devRoutes`
```

### Info

### IN-11: Duplicate literal for the E2E origin in `playwright.config.ts`

**File:** `web/playwright.config.ts:20` and `44`
**Issue:** `const origin = 'https://localhost:5199'` is defined and used for `webServer`, but `use.baseURL` repeats the literal. If the port changes (the config is guarded by a shared-machine rule), the two can drift and tests would hit a different host than the one started.
**Fix:** `use: { baseURL: origin, ... }`.

### IN-12: `SignInResponse` and `ResendCodeResponse` are identical records declared in the controller file

**File:** `src/Csps.Server/Controllers/SignInController.cs:14` and `24`
**Issue:** Both are `record(int ResendAfterSeconds)`. Every other response type (`SessionResponse`, `InviteLinkResponse`, `ResetLinkResponse`) lives in Application, and the project rule is thin controllers with the contract in the use-case layer. Two names for one shape also produce two schemas in the generated OpenAPI and TypeScript client.
**Fix:** Move one record to `Csps.Application.Auth` (for example `ResendWaitResponse`) and return it from both actions.

---

_Reviewed: 2026-10-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Part 4: Web client (web/src)

**Reviewed:** 2026-10-15
**Depth:** standard
**Files Reviewed:** 64
**Status:** issues_found

### Summary

The token handling is sound where the brief asked me to look hardest. The access token lives only in `session.ts` module memory. It is not written to storage, a URL or a BroadcastChannel message: the channel carries only `{type, expiresAt}`. The reset and invite tokens are read from the fragment, removed with `history.replaceState`, and sent only in POST bodies. The HTTP client refuses secret-looking query parameter names. `safeReturnUrl` is not exploitable as an open redirect: it requires a decoded `/admin` prefix, rejects backslashes, control characters, double encoding and dot segments, and the resulting value is only ever passed to the router's `navigate`. No `innerHTML`, `eval` or storage use was found. The only inline style is a CSS custom property set through React's CSSOM path, which a strict CSP allows. No em or en dash appears in non-test client code (OR-4). The password rules match `Csps.Domain/Identity/PasswordPolicy.cs` rule for rule, including order.

The defects are about session lifecycle and state hygiene, not token leakage:

- Logout can silently fail and then be undone by the sign-in route loader (CR-01).
- Cached per-user query data survives sign-out (WR-14).
- A list that should refresh after "Sign Out Other Devices" does not when the dialog is opened from the user menu (WR-15).
- Transient network errors at boot are treated as "no session" and drop the deep link (WR-16).

### Critical Issues

### CR-01: A failed sign-out call is swallowed, and the sign-in loader then restores the session from the still-valid refresh cookie

**File:** `web/src/modules/admin/services/session.ts:246-254` (also `web/src/modules/admin/guard.ts:63-75`, `web/src/layouts/AdminLayout.tsx:152-154`)
**Issue:** `signOut()` wraps `deps.auth.signOut()` in `try { } catch { }`, then clears the local session, broadcasts `signed-out` and shows the "You've signed out." notice, whatever happened on the server. The server endpoint can legitimately fail in ways the user cannot see:

- `POST /auth/sign-out` documents a 409 when two saves lose a race. The refresh path retries 409 once; sign-out does not.
- It is rate limited with the Refresh policy (429).
- It can also hit a 5xx, a timeout or a network drop.

In all these cases the HttpOnly refresh cookie stays valid. `AdminShell` then runs `navigate('/admin/login')`. The `admin/login` route loader (`redirectIfSignedInLoader`) calls `ensureSession()`. With `token === null` that calls `refreshSession()` and `POST /auth/refresh` with the surviving cookie. That succeeds, so the loader throws `redirect('/admin')` and the person is back in the admin area. This happens with no error shown, and the "signed out" notice is never displayed. Other tabs were also told `signed-out`, so they end their sessions while the server session lives.

If the network is simply down, the person is shown the sign-in page while a valid (possibly 90-day "keep me signed in") refresh cookie remains for the next visitor on that device (CWE-613). The inline comment ("the server session ends at its own expiry") understates this, because the cookie is what restores access.

**Fix:** Make the outcome visible and retry the recoverable cases. Treat a 409 like the refresh path does, and do not claim success on failure:
```ts
async function signOut(): Promise<{ readonly serverEnded: boolean }> {
  let serverEnded = false;
  for (let attempt = 0; attempt < 2 && !serverEnded; attempt++) {
    try {
      await deps.auth.signOut();
      serverEnded = true;
    } catch (error) {
      if (!(isHttpError(error) && error.status === 409)) break;
      await sleep(BUSY_RETRY_MS);
    }
  }
  endSession('signed-out', false);
  channel?.postMessage({ type: 'signed-out' } satisfies ChannelMessage);
  return { serverEnded };
}
```
In `AdminShell`, if `serverEnded` is false, stay on the page and show an error toast ("We couldn't sign you out. Check your connection and try again."), or at least skip the redirect-away. The local session should also not be cleared in that case, so the person can retry.

### Warnings

### WR-14: The TanStack Query cache survives sign-out and sign-in, so another account's devices list can be shown

**File:** `web/src/lib/query/keys.ts:13`, `web/src/modules/admin/hooks/useSessionsQuery.ts:8-15`, `web/src/modules/admin/services/session.ts:157-164`, `web/src/lib/query/queryClient.ts:8`
**Issue:** `sessionsListKey` has no user identity ("one list per signed-in person, so no params"). The single `QueryClient` lives in `Root`, above both the admin and auth layouts, so it persists across logout and login in the same page load. Nothing calls `queryClient.clear()`, `removeQueries` or `resetQueries`. This was confirmed by search: no non-test file does. On logout, user A's cached `['sessions','list',{}]` data stays for `gcTime` (5 minutes). If user B signs in on the shared workstation and opens Signed-in Devices within that window, `useQuery` returns A's cached rows immediately. `staleTime` is 0, so a refetch follows, but until it answers `SessionsPage` renders A's device labels, sign-in times and activity (`rows = query.data`). This is a cross-account data disclosure, small but real on a shared shop computer. It will also apply to every admin list added in later phases that uses the same client.
**Fix:** Clear the cache whenever the session identity ends or changes. For example, in `Root` or a small admin hook:
```ts
const queryClient = useQueryClient();
useEffect(() => subscribeSession(() => {
  if (getSessionSnapshot().user === null) queryClient.clear();
}), [queryClient]);
```
Alternatively, add the signed-in user id to the key (`listKey('sessions', { user: id })`) and call `queryClient.clear()` in the `endSession` path.

### WR-15: "Sign Out Other Devices" from the user menu leaves the open devices list stale

**File:** `web/src/layouts/AdminLayout.tsx:164-170` (compare `web/src/modules/admin/pages/SessionsPage.tsx:109-112, 139-146`)
**Issue:** `AdminShell` renders `<SignOutOthersDialog onClose={...} />` without `onSignedOut`. When staff are on `/admin/sessions` and use the user-menu item (the very flow the dialog's own comment describes), the other sessions are ended on the server. The page's query is not touched, so the table keeps listing the devices as signed in, with working sign-out buttons, until a window-focus refetch. The same dialog opened from the page header does refresh the list via `afterSignedOutOthers`.
**Fix:** Have `AdminShell` invalidate the list on success:
```tsx
const queryClient = useQueryClient();
...
<SignOutOthersDialog
  onSignedOut={() => { void queryClient.invalidateQueries({ queryKey: sessionsListKey }); }}
  onClose={() => { setSignOutOthersOpen(false); }}
/>
```

### WR-16: Boot treats any HTTP failure as "no session", then the sign-in loader drops the return path

**File:** `web/src/modules/admin/services/session.ts:231-241`, `web/src/modules/admin/guard.ts:52-60, 63-75`
**Issue:** `ensureSession()` catches every `HttpError` and resolves `null`. That includes `network`, `timeout`, 429 and 5xx, not only a 401. `requireSessionLoader` then redirects a person who still holds a valid cookie to `/admin/login?returnUrl=...`. This means a brief outage, offline PWA launch or rate limit sends staff to a password-plus-emailed-code sign-in that cannot work, with no "couldn't reach the server" message. `requestSession` already records `refreshFailure = 'unauthorized' | 'other'`, but `ensureSession` ignores it.

When the cookie is valid (a reload, or a second tab), `redirectIfSignedInLoader` redirects to the fixed `ADMIN_HOME` and never reads `returnUrl`. A deep link such as `/admin/orders/123?tab=payments` is therefore lost on any transient refresh failure. Today `/admin` forwards to `/admin/sessions`, so later phases will land people on the wrong page.
**Fix:** Resolve `null` only for a 401 (`refreshFailure === 'unauthorized'`) and let other failures surface to a retryable error boundary or banner. Let `redirectIfSignedInLoader` take the `request` and redirect to `safeReturnUrl(new URL(request.url).searchParams.get('returnUrl'))` instead of `ADMIN_HOME`.

### Info

### IN-13: `refreshFailure` goes stale on the peer-tab shortcut, which can suppress the sign-out after a 401

**File:** `web/src/modules/admin/services/session.ts:135, 197, 204-210, 257-262`
**Issue:** `refreshFailure` is reset only inside `requestSession()`. When `refreshUnderLock` returns early (a peer tab just refreshed and this token is fresh), the previous value remains. If an earlier refresh ended `'other'` (a 503, say) and a later shortcut-refresh is followed by a retried 401, `handleUnauthorized` sees the stale `'other'`, returns early and leaves the tab on a dead session. The trigger is narrow but the state handling is wrong.
**Fix:** Set `refreshFailure = null` at the top of `refreshSession`'s inner async function, before the lock, or inside `refreshUnderLock` before the early return.

### IN-14: `safeReturnUrl` validates the decoded text but returns the raw text, and refuses any legitimate percent sign

**File:** `web/src/modules/admin/guard.ts:35-48`
**Issue:** Not exploitable (the result stays under `/admin` and goes only to `navigate`). Two inconsistencies:

- A value such as `%2Fadmin%2Forders` passes the decoded `/admin/orders` check, but the original `%2Fadmin...` is returned and handed to `navigate`. It resolves relative to the current route and lands on the public catch-all.
- `decoded.includes('%')` rejects any return path whose query legitimately holds a literal percent (`?q=50%25`), because the loader passes the still-encoded `search`. That person silently loses their place.

**Fix:** Require `value.startsWith('/')` so only the literal path is accepted, and decide whether to allow an encoded `%25` (check the double-decoded text only for path segments, not the query).

### IN-15: Dead copy keys duplicate the password rule messages

**File:** `web/src/modules/admin/authCopy.ts:23, 86-95, 166-170, 212`
**Issue:** These keys have no consumer in non-test code:

- `fallbackEmail`
- `menu.devices` and `menu.signOutOthers`
- `newPassword.errors.required`, `tooShort`, `tooLong`, `noNumber`, `noSymbol`, `containsIdentity`, `breached` and `common`
- `sessions.deviceLabel`

Only `confirmRequired`, `mismatch` and `breachCheckDown` are used. The live wording sits in `PASSWORD_RULE_MESSAGES` in `utils/passwordRules.ts`, so the two sets of strings can drift.
**Fix:** Delete the unused keys, or have `PASSWORD_RULE_MESSAGES` read from this copy module.

### IN-16: The resend announcement hardcodes 60 seconds while the countdown follows the server

**File:** `web/src/modules/admin/authCopy.ts:57` vs `web/src/modules/admin/pages/VerifyCodePage.tsx:199-203`
**Issue:** `resendStarted` says "You can ask for another in 60 seconds." The cooldown the screen enforces comes from `resendAfterSeconds`, which the server derives from `AuthSettings.ResendCooldown`. If that setting changes, the spoken status and the visible countdown disagree.
**Fix:** Make `resendStarted` a function of the seconds, like `resendIn`.

### IN-17: An unknown server role silently becomes `manager` in the shell

**File:** `web/src/modules/admin/services/session.ts:89`
**Issue:** `role: user.role === 'Admin' ? 'admin' : 'manager'`. `SessionUser.role` is a free `string`. Any other value (a new role, casing drift) is shown as Manager and drives role-based navigation. The server still enforces authorization, so this is not an access flaw, but a fail-open mapping in a security-relevant place hides contract drift.
**Fix:** Map `'Admin'` and `'Manager'` explicitly and treat anything else as a failed session (clear it and throw or reject), or at least log it.

### IN-18: Page-to-page import and triplicated form scaffolding

**File:** `web/src/modules/admin/pages/AcceptInvitePage.tsx:24`; `ResetPasswordPage.tsx:61-153`, `AcceptInvitePage.tsx:43-143`, `NewPasswordPage.tsx:37-133`
**Issue:** `AcceptInvitePage` imports `removeFragment` and `tokenFromHash` from `ResetPasswordPage`. A page that imports another page ties their lazy chunks together and puts a utility in the wrong layer under OR-6. The three set-password screens also repeat the same `focusField`, `onInvalid`, `onValid` and server-field-error mapping almost line for line.
**Fix:** Move `tokenFromHash` and `removeFragment` to `utils/` (for example `utils/urlFragment.ts`), and extract a shared `useSetPasswordForm` helper for the field-focus and server-error mapping.

### IN-19: `navigator` inside `createSession` shadows the global

**File:** `web/src/modules/admin/services/session.ts:128` (and uses at 179, 292-294)
**Issue:** `let navigator` is the router's navigate callback, but inside `createSession` it shadows the browser's global `navigator`. `browserLocks()` is outside the closure, so there is no bug today. Any later edit that reaches for `navigator.locks` or `navigator.userAgent` inside `createSession` will hit the wrong object.
**Fix:** Rename it to `routerNavigate`.

---

_Reviewed: 2026-10-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
