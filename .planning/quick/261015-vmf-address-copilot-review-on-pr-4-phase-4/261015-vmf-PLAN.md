---
created: 2026-10-15T22:58:00-05:00
updated: 2026-10-15T22:58:00-05:00
phase: quick-261015-vmf
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
  - src/Csps.Application/Ports/IUnitOfWork.cs
  - tests/Csps.Infrastructure.IntegrationTests/Persistence/CspsUnitOfWorkTests.cs
  - tests/Csps.Server.IntegrationTests/Auth/PasswordResetTests.cs
  - src/Csps.Application/Auth/InviteTokenRequest.cs
  - src/Csps.Application/Auth/CheckInviteHandler.cs
  - src/Csps.Application/Auth/ResetTokenRequest.cs
  - src/Csps.Application/Auth/CheckResetLinkHandler.cs
  - src/Csps.Application/Auth/PendingPasswordChangeLookup.cs
  - src/Csps.Application/Auth/CheckSetNewPasswordHandler.cs
  - src/Csps.Application/Auth/SetNewPasswordHandler.cs
  - src/Csps.Server/Controllers/PasswordController.cs
  - src/Csps.Server/Controllers/SignInController.cs
  - src/Csps.Server/Controllers/PasswordChangeReasonText.cs
  - src/Csps.Server/Composition/ApplicationRegistration.cs
  - tools/openapi-gen/openapi.v1.json
  - tests/Csps.Application.UnitTests/Auth/CheckInviteHandlerTests.cs
  - tests/Csps.Application.UnitTests/Auth/CheckResetLinkHandlerTests.cs
  - tests/Csps.Application.UnitTests/Auth/CheckSetNewPasswordHandlerTests.cs
  - tests/Csps.Server.IntegrationTests/Auth/InviteTests.cs
  - tests/Csps.Server.IntegrationTests/Auth/MustChangePasswordTests.cs
  - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs
  - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
  - web/src/types/api.generated.ts
  - web/src/modules/admin/services/passwordService.ts
  - web/src/modules/admin/services/passwordService.test.ts
  - web/src/modules/admin/services/inviteService.test.ts
  - web/src/modules/admin/pages/AcceptInvitePage.tsx
  - web/src/modules/admin/pages/AcceptInvitePage.test.tsx
  - web/src/modules/admin/pages/ResetPasswordPage.tsx
  - web/src/modules/admin/pages/ResetPasswordPage.test.tsx
  - web/src/modules/admin/pages/NewPasswordPage.tsx
  - web/src/modules/admin/pages/NewPasswordPage.test.tsx
  - web/src/modules/admin/pages/VerifyCodePage.tsx
  - web/src/modules/admin/pages/VerifyCodePage.test.tsx
  - web/src/modules/admin/authCopy.ts
  - web/e2e/auth-overflow.spec.ts
  - .planning/phases/04-identity-authentication/04-UI-SPEC.md
  - web/src/lib/query/cacheOwner.ts
  - web/src/lib/query/cacheOwner.test.ts
  - web/src/core/routes/Root.tsx
  - web/src/core/routes/Root.test.tsx
  - web/src/modules/admin/services/session.ts
  - web/src/layouts/AdminLayout.tsx
  - web/src/modules/admin/hooks/useClearCacheOnSignOut.ts
  - web/src/modules/admin/hooks/useClearCacheOnSignOut.test.tsx
  - src/Csps.Server/web.config
  - tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs
autonomous: true
requirements:
  - SEC-07
  - AUTH-09
  - AUTH-11
  - AUTH-06
  - SEC-03

estimate:
  tokens: 170000
  raw_tokens: 170000
  tasks: 3
  confidence: low

must_haves:
  truths:
    - "Finding 1: inside an outer transaction (the idempotency gate's, opened for POST /api/v1/auth/password/reset), each InTransactionAsync attempt runs in its own savepoint. When the attempt throws, everything it wrote since the savepoint is rolled back before the exception leaves, so a ConflictRetry second pass starts from a clean state"
    - "A reset whose later save loses a race (the session rows change under it) is retried and answers 204: the password is changed once, every session is revoked, the link is spent once and exactly one PasswordResetCompleted audit row exists. Before the fix the same scenario answers 404 auth.link-invalid with a partial change committed"
    - "A failed rollback to the savepoint surfaces as its own (non-conflict) error, so no retry ever runs on a transaction in an unknown state; without an outer transaction InTransactionAsync behaves exactly as before"
    - "Finding 2: POST /api/v1/auth/invite/check answers {email, firstName, lastName}; AcceptInvitePage builds its zod schema with both names, so a password containing the invited person's last name is refused in the browser with the containsIdentity message and no accept request is sent"
    - "Finding 3: POST /api/v1/auth/password/reset/check answers {email, firstName, lastName}; the reset form refuses a password containing either name in the browser and sends no reset request"
    - "Finding 4: a new POST /api/v1/auth/password/set-new/check (ticket cookie, anti-CSRF header, read-only, idempotency-exempt, Reset rate-limit policy) answers 200 {email, firstName, lastName, reason} only for a sign-in that passed the code step and is still usable, and 401 auth.ticket-expired otherwise (no cookie, code not yet verified, spent, expired, deactivated or locked account). It never spends the ticket"
    - "The must-change screen loads that context on every arrival, including after a reload, and applies the email and both names in its zod schema; a 401 from the check sends the person to /admin/login with the timed-out notice; names and email never appear in a URL or in browser storage"
    - "Finding 5: the query cache owner is tracked for the QueryClient's whole life (registered in Root, fed from the session singleton at module scope), so signing out, or a different user signing in, clears the cache even when the admin shell is not mounted (for example on the reset-password page)"
    - "Finding 6: web.config sets the IIS ceiling to 2097152 bytes (2 MiB), above the app's 1 MiB RequestBodyLimitMiddleware.MaxBytes, so an oversized JSON body up to 2 MiB gets the app's 413 ProblemDetails with a traceId instead of an IIS 404.13 page"
    - "Zero warnings: dotnet build Csps.slnx, the Application unit tests, the Infrastructure and Server integration projects on LocalDB, and npm --prefix web run verify all pass"
  artifacts:
    - path: src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
      provides: "InTransactionAsync: savepoint per attempt when an outer transaction exists"
      contains: "CreateSavepointAsync"
    - path: tests/Csps.Infrastructure.IntegrationTests/Persistence/CspsUnitOfWorkTests.cs
      provides: "LocalDB proof that a failed attempt inside an outer transaction leaves nothing behind"
      contains: "ConcurrencyConflictException"
    - path: src/Csps.Application/Auth/CheckSetNewPasswordHandler.cs
      provides: "Read-only must-change context lookup by ticket"
      contains: "class CheckSetNewPasswordHandler"
    - path: src/Csps.Server/Controllers/PasswordController.cs
      provides: "POST set-new/check endpoint"
      contains: "set-new/check"
    - path: web/src/modules/admin/pages/NewPasswordPage.tsx
      provides: "S3 loads its validation context from the check and uses both names"
      contains: "checkSetNewPassword"
    - path: web/src/lib/query/cacheOwner.ts
      provides: "trackQueryClient and setCacheOwner, outside React"
      contains: "setCacheOwner"
    - path: src/Csps.Server/web.config
      provides: "IIS outer backstop above the app body limit"
      contains: "2097152"
  key_links:
    - from: src/Csps.Server/Security/IdempotencyMiddleware.cs
      to: src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
      via: "the gate's open transaction makes InTransactionAsync take the savepoint path"
      pattern: "CurrentTransaction"
    - from: web/src/modules/admin/pages/NewPasswordPage.tsx
      to: src/Csps.Server/Controllers/PasswordController.cs
      via: "passwordService.checkSetNewPassword posts to /auth/password/set-new/check with the ticket cookie"
      pattern: "set-new/check"
    - from: web/src/modules/admin/services/session.ts
      to: web/src/lib/query/cacheOwner.ts
      via: "module-scope subscribeSession feeds setCacheOwner"
      pattern: "setCacheOwner"
    - from: web/src/core/routes/Root.tsx
      to: web/src/lib/query/cacheOwner.ts
      via: "Root registers its QueryClient with trackQueryClient"
      pattern: "trackQueryClient"
---

<objective>
Fix the six findings of GitHub Copilot's review of PR #4 (Phase 4 identity and authentication). The orchestrator triaged all six against the code and accepted them:

1. [Critical] A ConflictRetry inside an outer transaction keeps the failed attempt's earlier saves (partial password reset).
2. The invite check does not return LastName, so the browser cannot apply the last-name rule.
3. The reset-link check returns Email only, so the browser cannot apply either name rule.
4. The must-change step has no validation context, and loses even the email after a reload.
5. Cache-owner tracking lives in AdminShell, so it dies when a non-admin route unmounts the shell.
6. The IIS body ceiling equals the app cap, so IIS answers with HTML before the app can send its 413 ProblemDetails.

Purpose: Core Value says staff-account security and data integrity must hold. A reset that commits half its work while old sessions stay alive breaks both (SEC-07, AUTH-09). OR-3 requires the browser to check every rule the server checks (AUTH-11). A cache that outlives its owner leaks one person's data to the next person on a shared shop computer (CWE-200).
Output: the savepoint fix with LocalDB tests, the name-aware checks and the new must-change check endpoint with server and web tests, the module-scope cache-owner tracker, and the raised IIS ceiling.
</objective>

<execution_context>
@~/.claude/gsd-core/workflows/execute-plan.md
@~/.claude/gsd-core/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md
@.claude/CLAUDE.md
@src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
@src/Csps.Application/Common/ConflictRetry.cs
@src/Csps.Application/Auth/ResetPasswordHandler.cs
@src/Csps.Application/Auth/SetNewPasswordHandler.cs
@src/Csps.Server/Controllers/PasswordController.cs
@web/src/modules/admin/pages/NewPasswordPage.tsx
@web/src/modules/admin/pages/ResetPasswordPage.tsx
@web/src/modules/admin/hooks/useClearCacheOnSignOut.ts

Working tree: all work happens in this git worktree (branch `gsd/phase-04-identity-authentication`). Every path in this plan is relative to its root. Do not read from or write to C:\Work\CarmensStitchAndPrintingServices, where another session is working on a different branch.

Facts the planner verified (do not re-derive):
- `IdempotencyGate` (src/Csps.Infrastructure/Idempotency/IdempotencyGate.cs) opens a transaction on the request's scoped `CspsDbContext` with the default isolation level (read committed) for every non-exempt POST. `POST /api/v1/auth/password/reset` is not exempt. `AuthClient.ResetPasswordAsync` always sends an Idempotency-Key, so every reset test goes through the gate.
- `ResetPasswordHandler.AttemptAsync` saves twice: spend the link, then save the rest. Between them, `UserAccounts.SetPasswordAsync`, `ClearLockoutAsync` and the other account calls go through Identity's `UserManager` with `AddEntityFrameworkStores`, and the store auto-saves the whole context. So the new password is already written before `sessions.RevokeAllAsync` tracks the session rows, and the conflict on the second explicit save (UserSession has `IsRowVersion`) is what triggers the retry.
- `CspsUnitOfWork.SaveChangesAsync` already clears the change tracker and wraps `DbUpdateConcurrencyException` in `ConcurrencyConflictException`. EF Core's own automatic savepoint around a SaveChanges only undoes that one save, not the attempt's earlier saves.
- No connection string enables MARS (SQL Server savepoints are unavailable with MARS). SQL Server savepoint names are limited to 32 characters. EF Core SqlServer's `ReleaseSavepointAsync` is a no-op (SQL Server has no release statement).
- `CspsUnitOfWork` is internal and the Infrastructure project has `InternalsVisibleTo Csps.Infrastructure.IntegrationTests`. `CspsDatabase.CreateContext()` (tests/Csps.Testing/CspsDatabase.cs) returns a `CspsDbContext` on the class fixture's database. SiteSettings has a seeded row (HasData) with a rowversion, so it can stand in for a conflicting row without any setup.
- `SessionStore` (the `ISessions` implementation) is internal and registered scoped in src/Csps.Infrastructure/Identity/IdentityRegistration.cs; the Server test project has no InternalsVisibleTo, so a test decorator must build the inner instance from the removed descriptor's `ImplementationType` with `ActivatorUtilities.CreateInstance`. `CspsDbContext` is public. `AuthClient.WithClock` (tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs) shows the `WithWebHostBuilder` + `ConfigureTestServices` pattern.
- `UserAccount` (src/Csps.Application/Auth/UserAccount.cs) has non-null `Email`, `FirstName`, `LastName` and `MustChangePassword`. `TwoFactorChallenge` holds `PasswordChangeReason` and `CanSetNewPassword(now)`. `SetNewPasswordHandler.ApplyAsync` checks: ticket present, challenge found by `TokenHash.Compute(ticket)`, `CanSetNewPassword(now)`, user found, active and not locked; otherwise `AuthErrors.TicketExpired` (401).
- The ticket cookie `__Secure-csps_2fa` has `Path=/api/v1/auth`, so `/api/v1/auth/password/set-new/check` receives it. `SignInController.ReasonText` maps `PasswordChangeReason` to "temporary" or "breach".
- The shared web client sends `X-CSPS-CSRF: 1` on every request. A bodiless POST is written like `authService.resendCode`: `client.post(path, undefined, { signal, skipAuthRefresh: true })`.
- The web password rule already handles names: `newPasswordSchema(personal)` in web/src/modules/admin/authSchemas.ts takes `{ email, firstName, lastName }` (nullable names), and `checkPassword` in web/src/utils/passwordRules.ts tests all three. Today AcceptInvitePage passes `lastName: null`, ResetPasswordPage passes both names null, and NewPasswordPage passes both names null with the email from memory (`getPendingEmail`).
- NewPasswordPage reads the reason from memory (`getPasswordChangeReason`, set by VerifyCodePage). After this plan it gets the reason from the check, so that memory state loses its only reader.
- ResetPasswordRoute already has the pattern to copy for S3: a `Phase` union (checking, form, invalid, failed), an AbortController effect, `CheckingCard` inside `LoadingRegion`, and a failed card with retry. AUTH_COPY.reset holds `checking`, `checked`, `checkFailed` and `retry` strings.
- The OpenAPI contract is a committed snapshot: refresh with `CSPS_WRITE_OPENAPI_SNAPSHOT=1 dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"` (for that one command), run it again without the switch, then `npm --prefix tools/openapi-gen ci` (if its node_modules is missing) and `npm --prefix tools/openapi-gen run generate`, and commit both files.
- New anonymous endpoints must be added to `AuthorizationMatrix.Rows` and `AnonymousAllowList`, `IdempotencyAllowList` (exempt POSTs), and `RateLimitTests.LimitedEndpoints`.
- The QueryClient is created in web/src/core/routes/Root.tsx (`useState(createQueryClient)`), the root of both the public and the admin trees. session.ts is admin-chunk only (PERF-01): Root must never import it. `useClearCacheOnSignOut` is called only in web/src/layouts/AdminLayout.tsx. `sessionsListKey` lives in web/src/lib/query/keys.ts. `sessionResponse()` in web/src/test/sessionFixtures.ts builds a SessionResponse.
- `RequestBodyLimitMiddleware.MaxBytes` (src/Csps.Server/Http/RequestBodyLimitMiddleware.cs) is a public 1_048_576 constant. Kestrel and `IISServerOptions` use it too.
- web/e2e/auth-overflow.spec.ts mocks `reset/check` (email only) and `invite/check` (email, firstName), and opens /admin/login/new-password directly with no mock. web/e2e/auth-must-change.spec.ts runs against the real server.
- 04-UI-SPEC.md line 240 says S3 opened directly fails on the first save, and S3 item 3 says the hidden username input renders "only when {email} is in memory". Both become false in Task 2.

Binding rules for the executor (from CLAUDE.md, .claude/CLAUDE.md and user memory):
- TDD per task: write or adjust the tests first, run them and see them fail, commit them as `test(quick-261015-vmf): ... (RED)`, then implement and commit `fix(quick-261015-vmf): ...`. Record the failing output in the SUMMARY.
- Zero warnings everywhere. OR-2: minimal comments that say what the code does, no history narration. OR-3: the browser checks every rule the server checks. OR-4: no em dash or en dash in web/src (the ellipsis character already used in AUTH_COPY is fine). OR-5/OR-6: API calls stay in module services and new files stay inside the owner tree.
- No new dependencies and no schema change (no migration).
- Shared machine: before any full test run (web verify, a whole integration project, Playwright) run `powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`. If another project holds a port or its test processes are listed, wait. Never kill another project's processes. Another CSPS session may be testing from the main checkout: if it holds 5180 or 5199, skip Playwright and rely on the unit and integration tests (say so in the SUMMARY). Set `CSPS_TEST_SQL=localdb` for the process only (for example `CSPS_TEST_SQL=localdb dotnet test ...` in Git Bash). LocalDB is `(localdb)\MSSQLLocalDB` with `CSPS_Test_<guid>` databases created by the fixture; never touch `BetsLLC_*`.
- Web: run `npm ci` in `web/` first when `web/node_modules` is missing.
- Every .md created or edited gets ISO 8601 `created:`/`updated:` timestamps with -05:00. In files with frontmatter, change only `updated:`. Leave other Phase 4 artifacts (04-*.md plans, summaries, research) untouched.
- Commits end with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No model identifier anywhere else (code, comments, docs, SUMMARY).
</context>

<tasks>

<task type="tracer" tdd="true">
  <name>Task 1: Finding 1 end to end: each retried attempt inside the idempotency transaction starts from its own savepoint</name>
  <files>tests/Csps.Infrastructure.IntegrationTests/Persistence/CspsUnitOfWorkTests.cs, tests/Csps.Server.IntegrationTests/Auth/PasswordResetTests.cs, src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs, src/Csps.Application/Ports/IUnitOfWork.cs</files>
  <read_first>
    - src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs (all of it)
    - src/Csps.Application/Common/ConflictRetry.cs and src/Csps.Application/Auth/ResetPasswordHandler.cs (AttemptAsync, ApplyAsync)
    - src/Csps.Infrastructure/Identity/SessionStore.cs lines 60-100 (RevokeAllAsync tracks the session and refresh-token rows)
    - tests/Csps.Server.IntegrationTests/Auth/PasswordResetTests.cs lines 187-221 (AResetEndsEverySessionAtOnceAndAuditsIt: how a staff member gets live sessions and how revocation and audit are asserted)
    - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs around WithClock (line 263) for the ConfigureTestServices pattern
    - tests/Csps.Infrastructure.IntegrationTests/Email/EmailOutboxTests.cs lines 120-170 (InTransactionAsync test style, Shouldly, TestContext cancellation)
  </read_first>
  <behavior>
    - Infrastructure (real LocalDB, new CspsUnitOfWorkTests with IClassFixture of CspsDatabase, `new CspsUnitOfWork(context)` on `database.CreateContext()`):
      - Test A: open an outer transaction on the context. Call InTransactionAsync with work that inserts row A (any simple entity with no foreign key, for example an IdempotencyRecord or an audit entry) and saves, then provokes a real conflict: load the seeded SiteSettings row tracked, change it behind EF through `context.Database.ExecuteSql...` on the same context (same connection and transaction, so nothing blocks), modify the tracked entity and save, which throws ConcurrencyConflictException. Assert the call throws ConcurrencyConflictException. Still inside the outer transaction, assert (AsNoTracking on the same context) that row A is gone and the SiteSettings row is back to its value before the attempt. Then a second InTransactionAsync inserts row B and succeeds; commit the outer transaction; from a fresh context assert A is absent and B is present.
      - Test B (nesting): inside the outer transaction, a middle InTransactionAsync inserts row M, calls an inner InTransactionAsync that inserts row I and throws, catches that exception and returns; commit; assert M is present and I is absent (savepoint names never collide).
      - Today Test A fails (row A survives) and Test B fails (row I survives).
    - Server (real stack through the idempotency gate), new fact in PasswordResetTests, for example `AResetWhoseLaterSaveLosesARaceIsRetriedFromACleanStart`: the staff member has at least one live session (as in AResetEndsEverySessionAtOnceAndAuditsIt). Build the factory with ConfigureTestServices replacing ISessions by a test-only decorator that wraps the original implementation and, on its first RevokeAllAsync call only, after delegating, updates that user's UserSessions rows through the scoped CspsDbContext (any column set to itself bumps the rowversion). Reset with a fresh link. Assert: 204 (today: 404 auth.link-invalid); the old password is refused and the new one signs in through the code step; every UserSessions row of the user has RevokedAt set and the earlier refresh token is refused; exactly one PasswordResetCompleted audit row for the user; the AccountTokens row has UsedAt set.
  </behavior>
  <action>
    RED: write the two Infrastructure tests and the Server fact described in behavior. Run `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CspsUnitOfWorkTests"` and `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*PasswordResetTests"`, confirm the new tests fail for the reason above (the Server fact gets 404), and commit `test(quick-261015-vmf): a failed attempt inside an outer transaction must leave nothing behind (RED)`.

    GREEN, in CspsUnitOfWork.InTransactionAsync, per Copilot finding 1: when `context.Database.CurrentTransaction` is not null, create a savepoint on that transaction before running `work`, with a short name unique per call (at most 32 characters, for example a prefix plus a per-instance counter, so nested calls never share a name). When `work` returns, release the savepoint (a no-op on SQL Server, correct elsewhere) and return the result. When `work` throws, roll back to the savepoint and rethrow the original exception with `throw;`. Do not swallow a failure of the rollback itself: if rolling back to the savepoint throws, that exception propagates instead, so ConflictRetry (which only catches ConcurrencyConflictException) never retries on a transaction in an unknown state and the gate rolls the whole request back. Do not add any other change-tracker clearing: SaveChangesAsync already clears it on a conflict. Leave the no-outer-transaction branch as it is. Keep the existing one-line comment style (OR-2), for example a short note that each attempt gets its own savepoint so a retry starts clean.

    Update the IUnitOfWork.InTransactionAsync XML summary so it states that joining an open transaction happens inside a savepoint and a throwing `work` leaves nothing behind in either case.

    Run the two filtered commands again, then the Application unit tests (the other ConflictRetry users: AcceptInvite, Refresh, SignOut, SignOutOthers, RevokeSession, ResendCode, ForgotPassword, SignIn use the same port and must stay green). Commit `fix(quick-261015-vmf): give each unit-of-work attempt its own savepoint inside an outer transaction`.
  </action>
  <verify>
    <automated>CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CspsUnitOfWorkTests" && CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*PasswordResetTests" && dotnet test --project tests/Csps.Application.UnitTests && grep -q "CreateSavepointAsync" src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs && dotnet build Csps.slnx</automated>
  </verify>
  <done>Both Infrastructure tests and the new reset fact failed before the change and pass after it. A conflict on the later save inside the gate's transaction leaves no trace of the failed attempt, the retry completes the reset (204, password changed once, all sessions revoked, one audit row), nested calls roll back independently, and the no-outer-transaction path is unchanged. Application unit tests pass, the build has zero warnings, and the RED and GREEN commits are made.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Findings 2, 3 and 4: the browser gets the names for every password form, and the must-change step keeps its context across a reload</name>
  <files>src/Csps.Application/Auth/InviteTokenRequest.cs, src/Csps.Application/Auth/CheckInviteHandler.cs, src/Csps.Application/Auth/ResetTokenRequest.cs, src/Csps.Application/Auth/CheckResetLinkHandler.cs, src/Csps.Application/Auth/PendingPasswordChangeLookup.cs, src/Csps.Application/Auth/CheckSetNewPasswordHandler.cs, src/Csps.Application/Auth/SetNewPasswordHandler.cs, src/Csps.Server/Controllers/PasswordController.cs, src/Csps.Server/Controllers/SignInController.cs, src/Csps.Server/Controllers/PasswordChangeReasonText.cs, src/Csps.Server/Composition/ApplicationRegistration.cs, tools/openapi-gen/openapi.v1.json, web/src/types/api.generated.ts, tests/Csps.Application.UnitTests/Auth/CheckInviteHandlerTests.cs, tests/Csps.Application.UnitTests/Auth/CheckResetLinkHandlerTests.cs, tests/Csps.Application.UnitTests/Auth/CheckSetNewPasswordHandlerTests.cs, tests/Csps.Server.IntegrationTests/Auth/InviteTests.cs, tests/Csps.Server.IntegrationTests/Auth/PasswordResetTests.cs, tests/Csps.Server.IntegrationTests/Auth/MustChangePasswordTests.cs, tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs, tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs, tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs, tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs, web/src/modules/admin/services/passwordService.ts, web/src/modules/admin/services/passwordService.test.ts, web/src/modules/admin/services/inviteService.test.ts, web/src/modules/admin/pages/AcceptInvitePage.tsx, web/src/modules/admin/pages/AcceptInvitePage.test.tsx, web/src/modules/admin/pages/ResetPasswordPage.tsx, web/src/modules/admin/pages/ResetPasswordPage.test.tsx, web/src/modules/admin/pages/NewPasswordPage.tsx, web/src/modules/admin/pages/NewPasswordPage.test.tsx, web/src/modules/admin/pages/VerifyCodePage.tsx, web/src/modules/admin/pages/VerifyCodePage.test.tsx, web/src/modules/admin/services/session.ts, web/src/modules/admin/authCopy.ts, web/e2e/auth-overflow.spec.ts, .planning/phases/04-identity-authentication/04-UI-SPEC.md</files>
  <read_first>
    - src/Csps.Application/Auth/InviteTokenRequest.cs, ResetTokenRequest.cs, CheckInviteHandler.cs, CheckResetLinkHandler.cs, ResetLinkLookup.cs (the lookup-helper pattern to copy)
    - src/Csps.Application/Auth/SetNewPasswordHandler.cs lines 18-80 (the ticket and account checks to share)
    - src/Csps.Server/Controllers/PasswordController.cs (CheckLink and SetNew attributes) and SignInController.cs lines 14-30 and 120-129 (VerifyCodeResponse, ReasonText)
    - tests/Csps.Server.IntegrationTests/Auth/MustChangePasswordTests.cs lines 20-100 (how a test reaches the must-change step and sends the ticket cookie and CSRF header)
    - tests/Csps.Application.UnitTests/Auth/CheckResetLinkHandlerTests.cs and SetNewPasswordHandlerTests.cs (doubles from AuthTestDoubles.cs)
    - web/src/modules/admin/pages/ResetPasswordPage.tsx lines 150-245 (the check-then-form route pattern) and NewPasswordPage.tsx (all)
    - web/src/modules/admin/pages/AcceptInvitePage.tsx around line 49 (schema) and web/src/modules/admin/services/passwordService.ts
    - web/src/modules/admin/pages/NewPasswordPage.test.tsx lines 1-80 (MSW probe and render helpers)
    - .planning/phases/04-identity-authentication/04-UI-SPEC.md line 240, the S3 section (lines 291-302) and the copy table rows for S3 and S5 (around lines 456-470)
  </read_first>
  <behavior>
    - Application unit: CheckInviteHandler returns `InviteLinkResponse(Email, FirstName, LastName)`; CheckResetLinkHandler returns `ResetLinkResponse(Email, FirstName, LastName)`.
    - Application unit, new CheckSetNewPasswordHandlerTests: a usable must-change ticket returns the account's email, first name, last name and the challenge's PasswordChangeReason; a null or empty ticket, an unknown ticket, a challenge that cannot set a new password (code not verified, completed, expired), a missing, deactivated or locked account all return AuthErrors.TicketExpired; the handler never saves (the unit-of-work double records no save).
    - Server integration: InviteTests asserts `lastName` in the invite-check body; PasswordResetTests asserts `firstName` and `lastName` in the reset-check body. MustChangePasswordTests: after the code step answers set-new-password, `POST /api/v1/auth/password/set-new/check` with the ticket cookie and CSRF header answers 200 with email, firstName, lastName and reason "temporary"; calling it twice and then set-new still works (the check never spends the ticket); without a cookie it is 401 auth.ticket-expired; for a ticket that has not passed the code step it is 401 (no names before the second factor); after set-new succeeded it is 401; without the CSRF header it is 403. Authorization matrix, idempotency coverage and rate-limit tests include the new route (Reset policy, limit 10).
    - Web: AcceptInvitePage refuses a password containing the invited last name in the browser with AUTH_COPY's containsIdentity message and sends no accept request. ResetPasswordPage refuses a password containing the first name or the last name and sends no reset request. passwordService.checkSetNewPassword posts to `/api/v1/auth/password/set-new/check` with no body, the CSRF header and no auth refresh. NewPasswordPage: with nothing in session memory (the reload case) it shows the checking state, then the form with the hidden username input holding the email from the check; a password containing the first or last name from the check is refused in the browser with no set-new request; the breach reason from the check shows the breach subline; a 401 from the check sends the person to /admin/login with the timed-out notice; a 5xx or network failure shows the check-failed card and "Try Again" runs the check again; axe passes in the checking and form states.
  </behavior>
  <action>
    RED: update and add the tests listed in behavior (Application unit, Server integration, web vitest). Update MSW fixtures and expected records to the new shapes. Add an AuthClient helper for the new route, mirroring the set-new helper. Run them, confirm the failures, and commit `test(quick-261015-vmf): name-aware password checks and a reload-safe must-change step (RED)`. The C# and TS tests may not compile until GREEN: that counts as RED; record it in the SUMMARY.

    GREEN, server (Copilot findings 2 and 3): add `LastName` to InviteLinkResponse and `FirstName` and `LastName` to ResetLinkResponse (update the XML param docs) and fill them in CheckInviteHandler and CheckResetLinkHandler from the looked-up account. Update the controller XML `returns` text ("the account email and names").

    GREEN, server (Copilot finding 4): the screen gets its context from the server by the ticket cookie it already holds, on every arrival, so a reload keeps it and nothing goes into a URL or browser storage. VerifyCodeOutcome and VerifyCodeResponse stay as they are, because one source serves both the first arrival and a reload.
    - Extract the ticket and account checks of SetNewPasswordHandler.ApplyAsync into an internal static `PendingPasswordChangeLookup.FindAsync(ticket, now, challenges, accounts, cancellationToken)` (same style as ResetLinkLookup) that returns the challenge and the account, or null. Make SetNewPasswordHandler use it, so the check and the save can never disagree on what a usable step is. Its existing tests must stay green.
    - Add `CheckSetNewPasswordHandler(ITwoFactorChallenges, IUserAccounts, TimeProvider)` returning `Result<SetNewPasswordContext>`, a public record `SetNewPasswordContext(string Email, string FirstName, string LastName, PasswordChangeReason Reason)`, with AuthErrors.TicketExpired for every unusable case. Read-only: no unit of work, no audit. Register it scoped in ApplicationRegistration next to SetNewPasswordHandler.
    - Move `ReasonText` from SignInController into an internal static class in src/Csps.Server/Controllers/PasswordChangeReasonText.cs and use it from both controllers.
    - In PasswordController add `[HttpPost("set-new/check")]` with `[EnableRateLimiting(RateLimitPolicies.Reset)]`, `[IdempotencyExempt("Read-only lookup; changes nothing.")]`, `[RequireCsrfHeader]`, `[EndpointName("CheckSetNewPassword")]`, ProducesResponseType for 200 with a public `SetNewPasswordContextResponse(string Email, string FirstName, string LastName, string Reason)` record (declared in the controller file, like VerifyCodeResponse), 401 and 403. It reads the ticket from `AuthCookies.TicketCookieName`, never clears or changes cookies, and maps the reason with the shared text helper. Add the route to AuthorizationMatrix (row with 401 for all three callers and the AnonymousAllowList entry), IdempotencyAllowList (same reason text) and RateLimitTests.LimitedEndpoints (10).
    - Refresh the OpenAPI snapshot and regenerate web/src/types/api.generated.ts as described in context.

    GREEN, web (OR-3):
    - passwordService: add `checkSetNewPassword(signal?)` returning the generated `SetNewPasswordContextResponse` type, written like authService.resendCode; export the type alias.
    - AcceptInvitePage: pass `lastName: invite.lastName` to newPasswordSchema.
    - ResetPasswordPage: the form phase carries email, firstName and lastName from the check; ResetForm takes the names as props and builds the schema with them.
    - NewPasswordPage: restructure like ResetPasswordRoute: a route component that runs the check in an AbortController effect (checking, form, failed phases), and an inner form component that owns useForm with `newPasswordSchema({ email, firstName, lastName })` from the check and shows the reason from the check. A 401 from the check: set the timed-out notice and navigate to /admin/login (as the save's 401 already does). Any other failure: the failed card with the retry button, like S5. Keep the save's existing 401 and 400 handling. Add AUTH_COPY.newPassword keys `checking: 'Checking your sign-in…'`, `checked: 'Sign-in checked.'`, `checkFailed: 'We could not check your sign-in yet.'`, `retry: 'Try Again'` (SPEC-GAP, mirroring the S5 wording; no long dash per OR-4). Rewrite the header comment so it describes the check (OR-2, short).
    - The page no longer reads the reason or the email from session memory. Remove the now-unused `passwordChangeReason` state and its getter and setter from session.ts, the setter call in VerifyCodePage.tsx, and test usages, leaving no dead exports. `getPendingEmail` stays (VerifyCodePage still uses it).
    - web/e2e/auth-overflow.spec.ts: the S3 test mocks `**/api/v1/auth/password/set-new/check` with 200 `{ email: LONG_EMAIL, firstName: 'Maria', lastName: <a long last name>, reason: 'temporary' }`; add `firstName` and `lastName` to the reset-check mock and `lastName` to the invite-check mock. Run Playwright for auth-overflow and auth-must-change only if preflight shows 5180 and 5199 free; otherwise state in the SUMMARY that they were updated but not run.

    Docs: in .planning/phases/04-identity-authentication/04-UI-SPEC.md, update only the statements this task makes false: the line-240 note (S3 now checks the pending sign-in on arrival and a 401 goes to S1 with the timed-out notice), S3 item 3 (the email comes from the check), add the S3 checking and check-failed copy rows next to the S5 ones, and note that the S5 and S6 checks return the account names for the password rule. Refresh its `updated:` stamp.

    Run the commands in verify, then commit `fix(quick-261015-vmf): give every password form the account names and keep the must-change context across a reload`.
  </action>
  <verify>
    <automated>dotnet test --project tests/Csps.Application.UnitTests && CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MustChangePasswordTests" && CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*InviteTests" && CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*AuthorizationMatrixTests" && CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests" && npm --prefix web run test -- --run src/modules/admin/pages/AcceptInvitePage.test.tsx src/modules/admin/pages/ResetPasswordPage.test.tsx src/modules/admin/pages/NewPasswordPage.test.tsx src/modules/admin/pages/VerifyCodePage.test.tsx src/modules/admin/services/passwordService.test.ts && grep -q "set-new/check" web/src/types/api.generated.ts && grep -q "lastName: invite.lastName" web/src/modules/admin/pages/AcceptInvitePage.tsx</automated>
  </verify>
  <done>The invite and reset checks return both names, the new set-new/check returns the must-change context only after the code step and never spends the ticket, and every password form (S3, S5, S6) applies the email and both names in the browser before any request. S3 survives a reload with the right email, names and reason, and a 401 check sends the person to sign in with the timed-out notice. The OpenAPI snapshot and generated types match, the matrix, idempotency and rate-limit lists include the route, the UI-SPEC statements are true again, and the RED and GREEN commits are made.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Findings 5 and 6: the cache owner lives as long as the QueryClient, and IIS lets the app send its own 413</name>
  <files>web/src/lib/query/cacheOwner.ts, web/src/lib/query/cacheOwner.test.ts, web/src/core/routes/Root.tsx, web/src/core/routes/Root.test.tsx, web/src/modules/admin/services/session.ts, web/src/layouts/AdminLayout.tsx, web/src/modules/admin/hooks/useClearCacheOnSignOut.ts, web/src/modules/admin/hooks/useClearCacheOnSignOut.test.tsx, src/Csps.Server/web.config, tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs</files>
  <read_first>
    - web/src/modules/admin/hooks/useClearCacheOnSignOut.ts and its test (the clearing rule to keep)
    - web/src/core/routes/Root.tsx and web/src/lib/query/queryClient.ts
    - web/src/modules/admin/services/session.ts (the module-scope singleton and configureSession call at the bottom; subscribeSession, getSessionUser)
    - web/src/layouts/AdminLayout.tsx around line 143 and any AdminLayout.test.tsx case about clearing the cache
    - src/Csps.Server/web.config and tests/Csps.Server.IntegrationTests/Http/WebConfigTests.cs lines 25-36
  </read_first>
  <behavior>
    - cacheOwner unit tests: `setCacheOwner(null)` clears every tracked client; a change from user A to user B clears; A to A and null to A do not clear; a client whose untrack function was called is no longer cleared.
    - Root integration test (the unmount scenario of Copilot finding 5): render a memory router with Root as the root route and two child routes, an admin-like route whose component seeds `sessionsListKey` data through useQueryClient, and a non-admin route (for example /admin/reset-password) whose component exposes the same client. Accept a session for user A, seed the data, navigate to the non-admin route (the seeding component unmounts and no AdminShell exists), then clearSession() and acceptSession() for user B: the Root client holds no `sessionsListKey` data. A second case: A to B directly, with no sign-out between, also clears. Today both fail because nothing tracks the owner outside AdminShell.
    - WebConfigTests: the renamed fact (for example `IisCeilingSitsAboveTheAppBodyLimit`) asserts maxAllowedContentLength is "2097152" and parses to a value greater than `RequestBodyLimitMiddleware.MaxBytes`. Today it fails (1048576).
  </behavior>
  <action>
    RED: write cacheOwner.test.ts, Root.test.tsx and the renamed WebConfigTests fact as described. Run `npm --prefix web run test -- --run src/lib/query/cacheOwner.test.ts src/core/routes/Root.test.tsx` and `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*WebConfigTests"`, confirm the failures, and commit `test(quick-261015-vmf): cache owner outlives the admin shell; IIS ceiling above the app limit (RED)`.

    GREEN, per Copilot finding 5 (outside React's component lifecycle, and without pulling session.ts into the public bundle, PERF-01):
    - Add web/src/lib/query/cacheOwner.ts with `trackQueryClient(client): () => void` (adds the client to a module-level set and returns an untrack function) and `setCacheOwner(id: string | null): void`, which keeps the existing rule: clear every tracked client when the id is null, or when it differs from a previous non-null owner, then remember the id. Short OR-2 comment on why (one person's cached data never reaches the next person, CWE-200).
    - Root.tsx: register its QueryClient with trackQueryClient in an effect whose cleanup untracks it, so registration lasts exactly as long as the client. Root imports only the lib module, never session.ts.
    - session.ts: at module scope, next to the configureSession call, subscribe the singleton to its own changes and pass `getSessionUser()?.id ?? null` to setCacheOwner. Keep createSession free of it, so session.test.ts instances do not touch the shared tracker.
    - Delete useClearCacheOnSignOut.ts and its test, and remove its import and call from AdminLayout.tsx. Move any still-relevant assertion (for example "a sign-out empties the cache") into Root.test.tsx or cacheOwner.test.ts instead of losing it. Adjust AdminLayout.test.tsx only if a case depended on the hook.

    GREEN, per Copilot finding 6: in src/Csps.Server/web.config set `maxAllowedContentLength="2097152"` and add one short XML comment above requestLimits saying it is an outer backstop above the app's 1 MiB limit, so the app answers 413 itself. The app keeps enforcing 1 MiB through RequestBodyLimitMiddleware, Kestrel and IISServerOptions (no code change there; RequestBodyLimitTests must stay green).

    Run the verify commands, then `npm --prefix web run verify` (after preflight) for the zero-warning gate including coverage and the bundle budgets, and commit `fix(quick-261015-vmf): track the cache owner for the QueryClient's lifetime; raise the IIS body ceiling to 2 MiB`.
  </action>
  <verify>
    <automated>npm --prefix web run test -- --run src/lib/query/cacheOwner.test.ts src/core/routes/Root.test.tsx src/layouts/AdminLayout.test.tsx && test ! -f web/src/modules/admin/hooks/useClearCacheOnSignOut.ts && grep -q 'maxAllowedContentLength="2097152"' src/Csps.Server/web.config && CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*WebConfigTests" && CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*RequestBodyLimitTests"</automated>
  </verify>
  <done>The cache is cleared on sign-out or a user change whether or not the admin shell is mounted, proven by the Root unmount test. The hook is gone, Root stays free of session.ts, and the public bundle budget holds. web.config allows 2 MiB at IIS while the app still answers 413 ProblemDetails above 1 MiB. Web verify passes with zero warnings, and the RED and GREEN commits are made.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → POST /api/v1/auth/password/reset (idempotency gate transaction) | One request's business changes and its stored answer commit together; concurrent refreshes and sign-outs touch the same session rows |
| browser (ticket cookie) → POST /api/v1/auth/password/set-new/check | An HttpOnly single-use ticket unlocks the account's email and names |
| browser → POST /api/v1/auth/invite/check and /password/reset/check | A link token unlocks the account's email and names |
| person A → person B on one shop computer (TanStack Query cache) | Cached lists of one signed-in person must not reach the next |
| internet → IIS → ASP.NET Core | Request bodies cross IIS request filtering before the app's own limit |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-vmf-01 | Tampering (CWE-362, CWE-662) | CspsUnitOfWork.InTransactionAsync under the idempotency gate | critical | mitigate | Each attempt runs in its own savepoint and rolls back to it on any throw, so a ConflictRetry pass never commits a half-done reset (spent link or new password while old sessions stay active). A failed rollback surfaces as a non-conflict error, so no retry runs on a dirty transaction. Proven by CspsUnitOfWorkTests (LocalDB) and the PasswordResetTests race fact. |
| T-vmf-02 | Spoofing (CWE-613) | Password reset session revocation | high | mitigate | The retried reset revokes every session; the race fact asserts all UserSessions rows are revoked and the earlier refresh token is refused. |
| T-vmf-03 | Information Disclosure (CWE-200, CWE-204) | set-new/check | medium | mitigate | Names and email are returned only for a ticket that passed the code step (CanSetNewPassword), from an active, unlocked account, through the same shared lookup as the save. Every other case is the same 401 auth.ticket-expired. The route needs the anti-CSRF header and shares the Reset rate limit (10). MustChangePasswordTests cover no cookie, code not verified, spent ticket and missing header. |
| T-vmf-04 | Information Disclosure (CWE-598) | Must-change context in the browser | medium | mitigate | The context is fetched by the HttpOnly cookie on each arrival and held in component state only: never a URL, query string, storage or BroadcastChannel message. |
| T-vmf-05 | Information Disclosure (CWE-640) | invite/check and reset/check adding names | low | accept | These answers already reveal the account email to the holder of a valid single-use link; the names belong to the same person, invalid links still get one uniform 404, and the person needs the names for the password rule (OR-3). |
| T-vmf-06 | Information Disclosure (CWE-200) | TanStack Query cache across users | medium | mitigate | The owner is tracked at module scope for the QueryClient's whole life and every tracked client is cleared on sign-out or a user change; Root.test.tsx reproduces the unmounted-shell scenario. |
| T-vmf-07 | Denial of Service (CWE-770) | IIS request filtering at 2 MiB | low | accept | IIS still rejects bodies above 2 MiB, and the app rejects anything above 1 MiB before reading it (Kestrel, IISServerOptions and RequestBodyLimitMiddleware), so the extra MiB only reaches the app's own 413. |
| T-vmf-SC | Tampering | npm / NuGet installs | high | mitigate | No new dependencies in this plan, so no package-legitimacy gate is needed. `npm ci` only restores the existing lockfiles. |
</threat_model>

<verification>
After all three tasks, run preflight, then:
- `dotnet build Csps.slnx` (zero warnings)
- `dotnet test --project tests/Csps.Application.UnitTests`
- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests`
- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests` (the whole project: every ConflictRetry user, the authorization matrix, idempotency coverage, rate limits, CSRF and the OpenAPI snapshot)
- `npm --prefix tools/openapi-gen run check` (the generated web types match the committed snapshot)
- `npm --prefix web run verify`
- Playwright `auth-overflow` and `auth-must-change` only when preflight shows 5180 and 5199 free
</verification>

<success_criteria>
- All six Copilot findings are fixed, each with a test that failed before its fix and passes after it.
- A conflict on a later save inside the gate's transaction leaves nothing from the failed attempt, and the retried reset completes once.
- Invite, reset and must-change forms check the email and both names in the browser before any request; the must-change context survives a reload without a URL or storage.
- The query cache is cleared on sign-out or a user change with or without the admin shell mounted.
- IIS allows 2 MiB and the app keeps answering 413 ProblemDetails above 1 MiB.
- Zero warnings across build, analyzers, lint, types and tests; no new dependencies; no schema change.
</success_criteria>

<output>
Create `.planning/quick/261015-vmf-address-copilot-review-on-pr-4-phase-4/261015-vmf-SUMMARY.md` when done, with `created:`/`updated:` timestamps, the RED failure output per task, and whether Playwright ran.
</output>
