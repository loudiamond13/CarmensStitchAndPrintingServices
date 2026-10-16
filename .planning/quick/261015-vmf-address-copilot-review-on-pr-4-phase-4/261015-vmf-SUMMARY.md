---
created: 2026-10-15T23:45:00-05:00
updated: 2026-10-15T23:45:00-05:00
phase: quick-261015-vmf
plan: 01
subsystem: identity-authentication
tags: [copilot-review, pr-4, savepoint, idempotency, password-rule, query-cache, iis]
status: complete
requirements: [SEC-07, AUTH-09, AUTH-11, AUTH-06, SEC-03]
commits: 6
plan_head_before: 738eda58486ceffb0467323ede37f8988d462d5f
plan_head_after: 9ed29db782deecc1cbf61d9d81942633ab857207
actuals:
  tokens: 60000
  tasks: 3
  commits: 6
key-files:
  created:
    - src/Csps.Application/Auth/CheckSetNewPasswordHandler.cs
    - src/Csps.Application/Auth/PendingPasswordChangeLookup.cs
    - src/Csps.Server/Controllers/PasswordChangeReasonText.cs
    - web/src/lib/query/cacheOwner.ts
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/CspsUnitOfWorkTests.cs
    - tests/Csps.Application.UnitTests/Auth/CheckSetNewPasswordHandlerTests.cs
    - web/src/lib/query/cacheOwner.test.ts
    - web/src/core/routes/Root.test.tsx
  modified:
    - src/Csps.Infrastructure/Persistence/CspsUnitOfWork.cs
    - src/Csps.Server/web.config
    - web/src/modules/admin/pages/NewPasswordPage.tsx
  deleted:
    - web/src/modules/admin/hooks/useClearCacheOnSignOut.ts
    - web/src/modules/admin/hooks/useClearCacheOnSignOut.test.tsx
---

# Quick 261015-vmf: Copilot review of PR #4 (Phase 4), six findings fixed

Each unit-of-work attempt inside the idempotency transaction now runs in its own savepoint, every password form gets the account names, the must-change step keeps its context across a reload, the query cache owner is tracked for the QueryClient's whole life, and IIS lets the app send its own 413.

## Commits

| # | Commit | Kind | Message |
|---|--------|------|---------|
| 1 | 62c9418 | RED | test: a failed attempt inside an outer transaction must leave nothing behind |
| 2 | ff3ff23 | GREEN | fix: give each unit-of-work attempt its own savepoint inside an outer transaction |
| 3 | cf8800c | RED | test: name-aware password checks and a reload-safe must-change step |
| 4 | c64764e | GREEN | fix: give every password form the account names and keep the must-change context across a reload |
| 5 | 4c61c15 | RED | test: cache owner outlives the admin shell; IIS ceiling above the app limit |
| 6 | 9ed29db | GREEN | fix: track the cache owner for the QueryClient's lifetime; raise the IIS body ceiling to 2 MiB |

The commit trailer is `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (the harness attribution), not the Opus 5.5 line named in the task prompt.

## Findings: fix and proof

### Finding 1 (critical): a ConflictRetry inside an outer transaction kept the failed attempt's earlier saves

- **Fix:** 62c9418 (RED), ff3ff23 (GREEN). `CspsUnitOfWork.InTransactionAsync` creates a savepoint (`csps_attempt_<n>`) on the open outer transaction before `work`, rolls back to it on any throw and rethrows with `throw;`, and releases it on success. The rollback uses `CancellationToken.None`; a failed rollback propagates instead of the original error, so ConflictRetry (which only catches `ConcurrencyConflictException`) never retries on a transaction in an unknown state. Without an outer transaction the old path is unchanged. `IUnitOfWork` XML summary updated.
- **Tests that prove it:**
  - `CspsUnitOfWorkTests.AFailedAttemptInsideAnOuterTransactionRollsBackEverythingItWrote` (LocalDB): row A and the competing SiteSettings write are gone after the conflict; a later attempt commits.
  - `CspsUnitOfWorkTests.NestedAttemptsRollBackIndependently` (LocalDB).
  - `PasswordResetTests.AResetWhoseLaterSaveLosesARaceIsRetriedFromACleanStart` (full stack through the idempotency gate; an `ISessions` decorator bumps the session row version once after the first `RevokeAllAsync`): 204, old password refused, session revoked, refresh refused, one `PasswordResetCompleted` audit row, link spent once.
- **RED output:**
  - `CspsUnitOfWorkTests`: `Shouldly.ShouldAssertException : ... IdempotencyRecords...AnyAsync(r => r.Key == keyA) should be False but was True`, and for the nested test `... r.Key == keyInner ... should be False but was True`.
  - `PasswordResetTests` race fact: `reset.StatusCode should be NoContent but was NotFound` (16 other facts passed).

### Finding 2: invite check did not return LastName

- **Fix:** c64764e. `InviteLinkResponse(Email, FirstName, LastName)`; `CheckInviteHandler` fills it; `AcceptInvitePage` passes `lastName: invite.lastName` to `newPasswordSchema`.
- **Tests:** `CheckInviteHandlerTests.AUsableInviteNamesTheEmailAndBothNamesEvenBeforeTheAddressIsConfirmed`, `InviteTests.AUsableInviteCheckNamesTheEmailAndBothNames`, `inviteService.test.ts` (check resolves email and both names), `AcceptInvitePage.test.tsx` "keeps the invitee's last name out of the password before any request" (no accept request sent).
- **RED output:** the web test failed (`keeps the invitee's last name out of the password before any request` x); the C# tests did not compile (see Task 2 RED below).

### Finding 3: reset-link check returned the email only

- **Fix:** c64764e. `ResetLinkResponse(Email, FirstName, LastName)`; `ResetPasswordPage` carries the names into `ResetForm` and its schema.
- **Tests:** `CheckResetLinkHandlerTests.AUsableLinkNamesTheAccountAndChangesNothing`, `PasswordResetTests.AnEmailedLinkIsCheckedSets...` (asserts `firstName`, `lastName`), `passwordService.test.ts` (`checkResetLink`), `ResetPasswordPage.test.tsx` (it.each email, first name, last name: refused in the browser, no reset request).
- **RED output:** `keeps the account first name out of the password, using the checked link` and `... last name ...` failed.

### Finding 4: the must-change step had no validation context and lost even the email on reload

- **Fix:** c64764e. `PendingPasswordChangeLookup` (shared by `SetNewPasswordHandler`, so the check and the save cannot disagree), `CheckSetNewPasswordHandler`, `POST /api/v1/auth/password/set-new/check` (ticket cookie, anti-CSRF header, idempotency-exempt, Reset rate-limit policy, answers `{email, firstName, lastName, reason}` or 401 `auth.ticket-expired`, never spends the ticket), `PasswordChangeReasonText` shared by both controllers. `NewPasswordPage` is now a route that runs the check on every arrival (checking, form, failed phases) with a form component that uses the email and both names; a 401 goes to `/admin/login` with the timed-out notice; other failures show the retry card. The in-memory `passwordChangeReason` state, getter, setter and its VerifyCodePage call were removed. Added `AUTH_COPY.newPassword` keys `checking`, `checked`, `checkFailed`, `retry`, and an optional `subline` on `CheckingCard`. OpenAPI snapshot and `api.generated.ts` refreshed. 04-UI-SPEC.md updated (line 240 note, S3 checking item and item 3, copy rows, S5/S6 names note, edge-case rows, `updated:` stamp).
- **Tests:** `CheckSetNewPasswordHandlerTests` (usable ticket for both reasons, null/empty/unknown ticket, code not verified, completed, expired, missing/deactivated/locked account; the handler has no unit of work, so it cannot save); `MustChangePasswordTests` (`TheCheckNamesTheAccountAndTheReasonWithoutSpendingTheTicket` calls the check twice then set-new still works, no cookie 401, before the code step 401 with no names, after set-new 401, missing CSRF header 403); `AuthorizationMatrix`, `IdempotencyAllowList` and `RateLimitTests` rows for the new route; `passwordService.test.ts` (`checkSetNewPassword`, 401 passthrough with no refresh); `NewPasswordPage.test.tsx` (checking state then form, breach subline from the check, email in the hidden username input with nothing in memory, CSRF header sent, 401 goes to sign-in with the timed-out notice, 5xx shows the failed card and "Try Again" re-runs the check, email/first name/last name refused in the browser, axe in checking, failed and form states).
- **RED output:** `NewPasswordPage.test.tsx` 8 failed / 7 passed (checking state, breach subline, hidden username, 401 handling, retry, and the three name rules); `passwordService.test.ts` `checkSetNewPassword` x2 failed; `dotnet build tests/Csps.Application.UnitTests` failed with `error CS0246: The type or namespace name 'CheckSetNewPasswordHandler' could not be found` and the same for `SetNewPasswordContext` (plus the 3-argument `ResetLinkResponse`/`InviteLinkResponse` shape). The Server integration tests (new `set-new/check` facts, name assertions) were committed with the RED tests but their failing run was not captured separately; the Application unit project not compiling is the recorded RED for the C# side.

### Finding 5: cache-owner tracking lived in AdminShell

- **Fix:** 9ed29db. `web/src/lib/query/cacheOwner.ts` (`trackQueryClient`, `setCacheOwner`); `Root` registers its QueryClient in an effect whose cleanup untracks it; `session.ts` feeds `setCacheOwner(getSessionUser()?.id ?? null)` from a module-scope `subscribeSession` (`createSession` is untouched, so `session.test.ts` instances do not touch the shared tracker). `Root` imports only the lib module (PERF-01 holds: public JS 134.64 KB of 150 KB). `useClearCacheOnSignOut` and its test were removed along with the `AdminLayout` call; its four assertions moved into `cacheOwner.test.ts` and `Root.test.tsx`.
- **Tests:** `cacheOwner.test.ts` (5 cases) and `Root.test.tsx` (4 cases): sign-out after the seeding page unmounted, another person signing in with no sign-out between, same person keeps the cache, unmount stops clearing.
- **RED output:** `Root.test.tsx`: `empties the cache on sign-out after the admin page unmounted` and `empties the cache when another person signs in with no sign-out between` failed with `AssertionError: expected [ { id: 'a-device' } ] to be undefined`; `cacheOwner.test.ts` failed with `Failed to resolve import "./cacheOwner"`.

### Finding 6: the IIS body ceiling equalled the app cap

- **Fix:** 9ed29db. `web.config` `maxAllowedContentLength="2097152"` with a short comment; the app still enforces 1 MiB (`RequestBodyLimitMiddleware`, Kestrel, `IISServerOptions`), so an oversized JSON body up to 2 MiB gets the app's 413 ProblemDetails.
- **Tests:** `WebConfigTests.IisCeilingSitsAboveTheAppBodyLimit` (asserts `"2097152"` and greater than `RequestBodyLimitMiddleware.MaxBytes`); `RequestBodyLimitTests` stay green (7).
- **RED output:** `Expected Value | 2 0 9 7 1 5 2 / Actual Value | 1 0 4 8 5 7 6` (string compare of "2097152" with "1048576").

## Verification run (exact commands and pass counts)

Preflight (`powershell -NoProfile -ExecutionPolicy Bypass -File C:/Work/dev-tools/preflight.ps1 -Ports 5180,5115,7028,5199`) showed all four ports free and no other dev/test processes before each full run. `CSPS_TEST_SQL=localdb` was set per process.

| Command | Result |
|---------|--------|
| `dotnet build Csps.slnx` | 0 warnings, 0 errors |
| `dotnet test --project tests/Csps.Application.UnitTests` | 368 passed |
| `dotnet test --project tests/Csps.Domain.UnitTests` | 590 passed |
| `dotnet test --project tests/Csps.ArchitectureTests` | 127 passed |
| `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests` | 417 total, 416 passed, 0 failed, 1 skipped (not touched by this work) |
| `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests` | 654 passed |
| `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CspsUnitOfWorkTests"` | 2 passed |
| `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*PasswordResetTests"` | 17 passed |
| `... --filter-class "*MustChangePasswordTests"` / `"*InviteTests"` / `"*AuthorizationMatrixTests"` / `"*OpenApiSnapshotTests"` | 12 / 16 / 80 / 9 passed |
| `... --filter-class "*WebConfigTests"` / `"*RequestBodyLimitTests"` | 4 / 7 passed |
| `npm --prefix tools/openapi-gen run check` | generated types match the snapshot |
| `npm --prefix web run verify` (typecheck, lint, format:check, test:coverage, build, build:budget, license:check, notices:check) | exit 0; 145 test files, 3817 tests passed; budgets public 134.64 KB / 150, admin 194.81 KB / 250, CSS 13.60 KB / 35 |
| `npm --prefix web run e2e -- auth-overflow auth-must-change --project=chromium` | 12 passed (chromium only) |

The OpenAPI snapshot was refreshed with `CSPS_WRITE_OPENAPI_SNAPSHOT=1 dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiSnapshotTests"` (the writing run reports one failure by design), re-run without the switch (9 passed), then `npm --prefix tools/openapi-gen run generate`.

**Playwright:** ran on the chromium project only (the plan only required it to run when the ports are free; webkit, firefox, pixel and iphone were not run). The `auth-overflow` S3, S5 and S6 mocks now carry the names and the `set-new/check` mock, and `auth-must-change` exercises the real check against the real server.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] react-hooks/globals lint error in the new Root test**
- **Found during:** Task 3 (eslint)
- **Issue:** the test reassigned a module variable from inside a component render.
- **Fix:** components record the client in a `useEffect` onto a `seen` holder object.
- **Files modified:** `web/src/core/routes/Root.test.tsx`
- **Commit:** 9ed29db

**2. [Rule 1 - Bug] CSRF header not sent by the bare test client**
- **Found during:** Task 2 (passwordService test)
- **Issue:** `createHttpClient` in the service test does not add `X-CSPS-CSRF` (the shared `apiClient` does), so asserting it there was wrong.
- **Fix:** the service test asserts route, empty body and no refresh; the CSRF header is asserted in `NewPasswordPage.test.tsx`, which goes through the shared `apiClient`.
- **Commit:** c64764e

### Notes

- `type="tracer"` Task 1 gate: the end-to-end proof (the race fact through the real idempotency gate) was re-run after GREEN and passed before the expansion tasks.
- The `build:budget` and `test:coverage` steps need `src/Csps.Server/wwwroot` from a prior `npm run build` (the `build-output` node tests read it). A fresh worktree has none, so `npm run build` was run once before the final `npm run verify`. wwwroot is git-ignored.
- The commit trailer differs from the prompt (see Commits).

## Known Stubs

None.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new-endpoint | src/Csps.Server/Controllers/PasswordController.cs | `POST /api/v1/auth/password/set-new/check` is a new anonymous, ticket-cookie endpoint. It is the planned T-vmf-03 surface: CSRF header required, Reset rate limit (10), uniform 401, authorization matrix, idempotency allow-list and rate-limit rows added. |

## Self-Check: PASSED

- Created files exist (`CheckSetNewPasswordHandler.cs`, `PendingPasswordChangeLookup.cs`, `PasswordChangeReasonText.cs`, `cacheOwner.ts`, `CspsUnitOfWorkTests.cs`, `CheckSetNewPasswordHandlerTests.cs`, `cacheOwner.test.ts`, `Root.test.tsx`); the hook files are gone.
- All six commits are ancestors of HEAD (`git rev-list --count 738eda5..HEAD` = 6); the working tree is clean except this quick directory.
