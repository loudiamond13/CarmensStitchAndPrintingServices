---
phase: 04-identity-authentication
plan: 18
subsystem: auth-password-recovery
tags: [forgot-password, account-tokens, reset-link, enumeration, email-cap, applock, auth-08, audit-01, d-16, d-20, d-28, d-39]
status: complete
created: "2026-10-15T01:12:00-05:00"
updated: "2026-10-15T01:12:00-05:00"

requires: ["04-16", "04-17", "04-09", "04-12"]
provides:
  - "POST /api/v1/auth/password/forgot {email} (anonymous, no-store): always 202 with no body for any well-formed address, 400 field error for a missing or malformed one; every answer takes at least the 500 ms floor"
  - "AccountToken (Domain) + AccountTokenPurpose {PasswordReset = 1, Invitation = 2}: 32-byte SHA-256 hash, CreatedAt, ExpiresAt, UsedAt, RevokedAt, RowVersion; Create, IsUsable, Use, Revoke"
  - "AccountTokens table (migration AddAccountTokens): FK to AspNetUsers cascade, unique UX_AccountTokens_TokenHash binary(32), Purpose tinyint, index (UserId, Purpose, CreatedAt), rowversion"
  - "IAccountTokens.{Add, FindByHashAsync, LockAccountAsync, RevokeOpenAsync} and AccountTokenStore"
  - "ForgotPasswordRequest(Email) + Empty, ForgotPasswordRequestValidator (sign-in email rule and messages), ForgotPasswordHandler, PasswordController"
  - "Audit auth.password-reset-requested with detail sent, deactivated, unknown-account or capped"
  - "Test support: AuthClient.ForgotRoute / ForgotPasswordAsync; RecordingOutbox.Recent and Counts"
affects: [04-19, 04-20, 04-24, web forgot-password page]

requirements-completed: []

actuals:
  tokens: 60000
  tasks: 2
  commits: 4
plan_head_before: f9346cdbb77f591f532fe09be9285d55af12c27e
plan_head_after: d57c44328233704eb87e0eb70884c85c0dfef84b

tech-stack:
  added: []
  patterns:
    - "One transaction-owned sp_getapplock per account serializes forgot-password requests, so the hourly cap is counted after the previous request committed and the newer request revokes the older link"
    - "Every branch (active, deactivated, unconfirmed, unknown) runs the same shape: one transaction, one audit entry, one save, then the response floor"

key-files:
  created:
    - src/Csps.Domain/Identity/AccountToken.cs
    - src/Csps.Application/Ports/IAccountTokens.cs
    - src/Csps.Application/Auth/ForgotPasswordRequest.cs
    - src/Csps.Application/Auth/ForgotPasswordRequestValidator.cs
    - src/Csps.Application/Auth/ForgotPasswordHandler.cs
    - src/Csps.Infrastructure/Identity/AccountTokenStore.cs
    - src/Csps.Infrastructure/Persistence/Configurations/AccountTokenConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261015060201_AddAccountTokens.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261015060201_AddAccountTokens.Designer.cs
    - src/Csps.Server/Controllers/PasswordController.cs
    - tests/Csps.Domain.UnitTests/Identity/AccountTokenTests.cs
    - tests/Csps.Application.UnitTests/Auth/ForgotPasswordHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/ForgotPasswordRequestValidatorTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/ForgotPasswordTests.cs
  modified:
    - src/Csps.Application/Auth/SignInRequestValidator.cs
    - src/Csps.Infrastructure/Identity/IdentityRegistration.cs
    - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - src/Csps.Server/Composition/AuthRegistration.cs
    - tests/Csps.Application.UnitTests/Auth/AuthTestDoubles.cs
    - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/operations/audit-log.md

key-decisions:
  - "Only an active account with a confirmed email gets a link. An unconfirmed (invited, not yet accepted) account is answered like an unknown address: no email, audit detail unknown-account"
  - "The per-account hourly cap is counted from the email outbox by kind and address (PasswordReset and DeactivatedNotice), inside the account lock, so a capped request changes nothing and cannot revoke a valid link"
  - "Two requests at the same moment are serialized with sp_getapplock (transaction-owned, 10 s wait) instead of a filtered unique index, so AccountTokens carries no extra constraint that Phase 5 invitations would have to live with"
  - "AccountToken has a RowVersion (project rule: rowversion per aggregate), so plan 04-19 can spend a link once even when two requests race"
  - "A lost optimistic-concurrency race that repeats still answers 202, because the other request already saved a link or notice for the address"
---

# Phase 4 Plan 18: Forgot Password Summary

A staff member who forgot their password asks for a reset link and gets one email with a fragment-only link whose token the database knows only as a 30-minute SHA-256 hash, while every other address (deactivated, unconfirmed, unknown) gets the same empty 202 after the same 500 ms floor.

## What was built

- **Tracer (Task 1):** `AccountToken` and `AccountTokenPurpose` in the Domain, the `AccountTokens` table and the `AddAccountTokens` migration, `IAccountTokens` with `AccountTokenStore`, the forgot-password form, validator (reusing the sign-in email rule and messages), handler and `PasswordController` (`POST /api/v1/auth/password/forgot`, anonymous, no-store). An active account gets one `PasswordResetEmail` whose link is `{App:PublicBaseUrl}/admin/reset-password#token=...`; a test reads the Testing sink, hashes the token from the link and finds exactly the stored row (purpose 1, expires 30 minutes after creation, never the plain token). Matrix row and allow-list key added; OpenAPI snapshot and TS types refreshed (`npm --prefix tools/openapi-gen run check` passes).
- **Same answer for every address (Task 2):** active, deactivated, unconfirmed and unknown addresses all get 202 with an empty body, the same headers and at least 500 ms (HTTP test measures 490 ms or more; unit test proves 499 ms is still waiting and 500 ms completes at the same fake instant for all six branches).
- **Deactivated notice (D-20):** a deactivated account gets `DeactivatedNoticeEmail` ("Your account is deactivated. Ask a Manager if you need access."), no token and no link (test asserts no `http`, no `href=`, no `token=` and no AccountTokens row). An unknown address gets no email and no outbox row.
- **Hourly cap (D-39):** `CountRecentAsync` for `PasswordReset` and for `DeactivatedNotice` over the last hour against `AuthSettings.ResetEmailsPerHour` (3). Four requests in an hour produce three emails and audit details `sent, sent, sent, capped`; the capped request still answers 202 and revokes nothing.
- **One live link at a time:** a new request takes the per-account lock, revokes the earlier open reset tokens, then adds its own. Two simultaneous requests leave two rows with exactly one usable and one revoked. With the lock disabled the race test fails on every run (checked three times), so the test proves the lock.
- **Audit (AUDIT-01):** `auth.password-reset-requested` carries `sent`, `deactivated`, `unknown-account` or `capped`; the target is the user id when known and null otherwise; no entry holds the email or the token. `docs/operations/audit-log.md` row updated.

## Verification

| Check | Result |
| --- | --- |
| Csps.Domain.UnitTests | 590 passed |
| Csps.Application.UnitTests | 239 passed |
| Csps.ArchitectureTests | 127 passed |
| Csps.Server.IntegrationTests | 507 passed (includes 12 ForgotPasswordTests, the matrix and the OpenAPI snapshot) |
| Csps.Infrastructure.IntegrationTests | 322 passed, 1 skipped (the live HIBP test, by design); MigrationScriptTests 7 passed |
| Coverage gate | Domain 100% line and branch; Application 99.8% line (rule 95%) |
| `npm --prefix tools/openapi-gen run check` | Generated API types match the snapshot |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] A per-account lock so the cap and "one live link" hold under concurrency**
- **Found during:** Task 2 (truth 5 and the D-39 cap).
- **Issue:** `RevokeOpenAsync` plus `Add` in two simultaneous transactions can both see no open token and both add one, and the outbox-based cap can be counted by both requests before either commits.
- **Fix:** `IAccountTokens.LockAccountAsync` (a transaction-owned `sp_getapplock` per account, parameterized, constant SQL) called first inside the transaction; the cap is counted and the old links revoked after it. This adds one method to the port beyond the three the plan lists.
- **Files modified:** `src/Csps.Application/Ports/IAccountTokens.cs`, `src/Csps.Infrastructure/Identity/AccountTokenStore.cs`, `src/Csps.Application/Auth/ForgotPasswordHandler.cs`
- **Commit:** d57c443

**2. [Rule 2 - Missing critical] RowVersion on AccountToken**
- **Found during:** Task 1 (aggregate design; project rule "rowversion per aggregate").
- **Issue:** The plan's column list had no concurrency token, so plan 04-19 could not guarantee a link is spent once under a race.
- **Fix:** `RowVersion` (rowversion) on `AccountToken` and in the migration.
- **Commit:** b4b443c

**3. [Rule 1 - Scope] Unconfirmed accounts answered like unknown addresses**
- **Issue:** The plan says "active" and "deactivated" only. An invited account whose email is not confirmed is neither, and a reset link for it would let someone skip the invitation step.
- **Fix:** active but unconfirmed is treated as unknown (no email, audit `unknown-account`). Listed under Decisions for the owner.
- **Commit:** d57c443

**4. [Process] RED commits**
- The Task 1 RED commit does not compile (the types it tests do not exist yet), the same convention as earlier plans in this phase. The Task 2 RED commit compiles; 7 of its 20 unit tests fail and the new HTTP tests fail against the Task 1 handler.

### Plan files touched beyond the list
- `src/Csps.Application/Auth/SignInRequestValidator.cs` (`IsEmailShaped` is now `internal` so the forgot-password validator reuses the exact sign-in rule), `tests/Csps.Application.UnitTests/Auth/AuthTestDoubles.cs` (`RecordingOutbox` can report recent counts), `tests/Csps.Application.UnitTests/Auth/ForgotPasswordRequestValidatorTests.cs`, `tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs` (forgot helper) and `docs/operations/audit-log.md`.

## Decisions for the owner

None blocking. For awareness:

1. **Unconfirmed (invited, not yet accepted) accounts get no reset email.** They are answered like an unknown address. Say so if invited staff who lost their invite should be able to use "Forgot password" instead (that would need plan 04-19 to confirm the email on reset).
2. **Locked accounts do get a link.** A lockout is temporary and a reset never signs anyone in (plan 04-19 owns the completion rules).
3. **A busy answer is still 202.** If two requests keep losing a database race, the caller still sees 202 because the other request already saved a link or notice.

## Threat Flags

None. The one new endpoint and the table are covered by T-04-62 to T-04-65. The `sp_getapplock` call uses constant SQL with the resource passed as a parameter.

## Known Stubs

None.

## Self-Check: PASSED

- Files: `AccountToken.cs`, `IAccountTokens.cs`, `AccountTokenStore.cs`, `AccountTokenConfiguration.cs`, `20261015060201_AddAccountTokens.cs`, `ForgotPasswordHandler.cs`, `PasswordController.cs` and the four test files exist.
- Commits: 809e423, b4b443c, 00053c5 and d57c443 are on branch gsd/phase-04-identity-authentication (`git rev-list --count f9346cd..HEAD` is 4).
