---
phase: 05-profile-user-management
reviewed: 2026-10-18T20:22:00-05:00
created: 2026-10-18T20:22:00-05:00
updated: 2026-10-18T20:22:00-05:00
depth: standard
files_reviewed: 400
files_reviewed_list:
  - "412 files from the 43 SUMMARY key-files plus the phase evaluation scope, reviewed in four lanes (lists kept outside the repo)"
findings:
  critical: 1
  warning: 21
  info: 24
  total: 46
status: issues_found
---

# Phase 5: Code Review Report

*Created: 2026-10-18T20:22:00-05:00 · Updated: 2026-10-18T20:22:00-05:00*

The scope (412 files) was too large for one reviewer, so four gsd-code-reviewer lanes reviewed it at standard depth in parallel and their reports are merged here. Finding ids are renumbered across lanes; each finding names its lane and its id inside that lane. Items already recorded in `deferred-items.md` for the security review (unsalted RequestHash, KeepChanges opt-in, 60 s eviction window) were excluded from all lanes.

## Summary

### Backend source (src/, tools/)

The last-Manager guard is sound. `IManagerRosterLock` is an `sp_getapplock` with transaction owner, taken first and
before the target is read, in Deactivate, Lock, Delete and demoting Update. A PUT/DELETE gets its own transaction from
`InTransactionAsync`, and a POST runs inside the idempotency lease, so the lock always has a transaction to belong to.
Authorization is default-deny at class level, `/profile` always acts on the token's user, and no SQL trigger was added
(OR-7). No SQL injection, secret or token-leak path was found, and the audit details hold fixed words only.

No BLOCKER was proven. The known items you listed are not repeated here. The warnings are:

- open password-reset links survive a Manager-set temporary password, a profile password change and an at-once email move;
- Identity concurrency failures become 500 where the API contract says 409;
- a temporary-password account is created with the email pre-confirmed;
- a pending-address scrub can hit another account's mail;
- two definitions of "active Manager";
- the idempotency transaction defeats the "no connection held during the HIBP call" design.

### Backend tests (tests/)

All 78 files in the lane were opened or scanned. Fully read: the shared helpers (AuthClient, UserFixtures, AccountStateFixtures, AuthTestDoubles, ConcurrentRequests), the authorization matrix and idempotency allow-list, every Users, Profile, Audit, Idempotency, RateLimiting and Testing server integration test except InviteTests and PasswordResetTests (scanned with pattern searches only), the persistence, schema, bootstrap, outbox and preview infrastructure tests, and the Delete, Deactivate, Lock, ManagerGuard, AccountAccess, ChangePassword, BootstrapManager and most of the UpdateUser unit tests. The remaining unit-test files (Activate, CancelUserEmailChange, Create, GetUser, ListUsers, EmailChange, EmailChangePending, ListAuditLog, SignIn, ResetPassword, AcceptInvite, validators, AuthEmail, AuthSettings, UpdateProfileName, GetProfile) got a mechanical scan only: a script checked every [Fact]/[Theory] body for assertions, and I grepped for sleeps, wall-clock reads, unseeded random, global mutable state and environment mutation. Nothing turned up in that scan, but I did not read those files line by line.

Database targeting is sound. Every database in the lane comes from `CspsDatabase` (`CreateAsync`, `CreateEmptyAsync`, or the class fixture). No test builds a connection string to a non-test database, with one exception (WR-02). No test sets environment variables or touches files outside `Path.GetTempPath()`. Where tests use `ResetAsync()` on the shared class database, xUnit runs tests within a class serially, so that is safe.

Overall quality is high: the handlers are tested branch by branch, the 20-round race tests are a good pattern, and secrets-in-audit and secrets-in-idempotency-record checks are present. The defects are concentrated in three areas:

1. A systematic "no email was sent" assertion that does not wait for the asynchronous outbox.
2. Race tests whose pass criteria exclude a legitimate outcome, and which have no timeout.
3. Missing negative cases for sensitive-field exposure and for the rate limit on the password-change endpoint.

No finding rises to BLOCKER: nothing in the lane touches a non-test database today or fails to protect a control that is currently broken. WR-02 and WR-08 are the closest.

### Web admin module (web/src/modules/admin)

The lane is in good shape on the points the brief stressed. Passwords and tokens never reach URLs, storage or toasts: the email-change and invite/reset tokens travel in POST bodies (`profileService`, `inviteService`) and are read from the fragment, which is cleaned before the first request. The access token stays in memory, and the temporary password is dropped by `AddUserPanel` and `TemporaryPasswordDialog` after close. There is no `dangerouslySetInnerHTML`, no `any`, and no long dash anywhere in the lane (OR-4 grep clean). Client schemas match the backend validators I compared: `CreateUserRequestValidator`, `UpdateUserRequestValidator`, `SetTemporaryPasswordRequestValidator`, `ChangePasswordRequestValidator` and `RequestEmailChangeRequestValidator`. Name length counts UTF-16 units after trim, email shape and 256 cap, role and access enums, and the basic-rule password all agree. The audit action allow-list matches the codes the server emits. The 409 `edit.stale` handling (ConflictBanner, Load Latest replaces typed values only after the latest version arrives) is correct in both `ProfilePage` and `EditUserPanel`. The `SetPendingEmailAsync` path does not bump the edit version, so the email-change card does not make the name form stale.

One real defect: the shared "Sign Out Other Devices" dialog silently does nothing the second time it is used in a session. Four warnings and four info items follow.

### Shared web (web/ outside modules/admin, .gitleaks.toml)

Read in full: every non-test source file in the lane (overlays, navigation, lists, forms, entry, data, states, layouts, `usePresence`, error boundaries, utils, dev previews, recipes, `app.css`, `rulings.css`, build scripts, Playwright config and fixtures). I read the owner-review script's control flow, its file-writing and process-spawning paths and the Phase 5 seeding code. I read the e2e specs most relevant to this phase (`profile-email`, `audit-log`, the Add User temporary-password journey in `users.spec.ts`) and skimmed the rest for test smells. I did not run anything, as instructed.

**Security items asked for in the lane brief: no defect found.**
- `urlFragment.ts`: the token is read from the fragment only. `removeFragment` uses `replaceState` and keeps `history.state`. The server builds the link with `Uri.EscapeDataString` over a Base64Url token (`AppLinksOptions.cs:62`, `SecureRandom.cs:15`), so `URLSearchParams` decoding is lossless. The e2e spec asserts the token is gone from the address bar.
- `temporaryPassword.ts`: CSPRNG only (`crypto.getRandomValues`), with correct rejection sampling for both the word index and the digit group. The test pins the no-`Math.random` rule.
- `describeHttpError.ts`: server text never reaches the screen except the `traceId` (see IN-04 for the one deliberate exception, field messages).
- OR-4: no em or en dash anywhere in `web/src`. OR-5: no `fetch` outside `core/api/http` in this lane. Strict CSP: the only `style=` use is `dev/previews/AdminShell.tsx:39`, which is dev-only and sets a CSS custom property through the CSSOM.
- `.gitleaks.toml`: every allowlist is a single exact file path limited to `targetRules = ['generic-api-key']`. All 19 allowlisted files exist. Nothing is broad enough to hide a real secret outside those files (see IN-08 for the residual risk inside them).
- Focus management in `Modal`, `ConfirmDialog`, `MobileNavDrawer` and `UserMenu` is sound: trap, `inert` outside, focus return, an Esc stack, and no state change after close.

No blockers. Three warnings and eight info items follow.

## Critical Issues

### CR-01: "Sign Out Other Devices" does nothing on every use after the first

**File:** `web/src/modules/admin/components/SignOutOthersDialog.tsx:24-47`
(mounted permanently at `web/src/layouts/AdminLayout.tsx:226` and `web/src/modules/admin/pages/SessionsPage.tsx:147`)
**Issue:** The dialog drives the request through `useSubmission<undefined, undefined>` and never calls `submission.reset()`. By the hook's own contract (`lib/forms/useSubmission.ts`), a succeeded submission triggered again with the same data "sends nothing: submit resolves with the same success outcome and onSuccess does not run again". A submission with no data serializes to the fixed `NO_DATA` sentinel, so every later `submit()` is "the same submission". `AdminLayout` keeps `SignOutOthersDialog` mounted for the whole admin session (only `open` toggles), and `SessionsPage` does the same. So:

1. First use works: request sent, toast, `onSignedOut`, `onClose`.
2. The next time the person opens the dialog and presses "Sign Out Other Devices" (a new phone signed in, a lost device found later, any later use), `submit()` returns the cached success. No request goes out, `onSuccess` does not run, so there is no toast, no list refresh and no `onClose`. `SignOutDialog.settle()` sees `ok: true`, clears pending, and the dialog just sits open.

This is a security control ("use this if you signed in on a shared or lost device") that fails silently, and the person is led to believe nothing happened rather than that the others are still signed in. The existing test "opens again without the failure line" does not cover a second successful confirm.

**Fix:** Forget the finished submission as soon as it succeeds, as the other dialogs in this lane already do (`ProfilePage` resend/cancel, `EditUserPanel.afterAction`). Add a regression test that confirms twice on one mounted instance and expects two requests.
```tsx
const submission = useSubmission<undefined, undefined>(
  async () => {
    await authService.signOutOthers();
    return undefined;
  },
  {
    onSuccess: () => {
      // A later press is a new request, so the finished one is forgotten.
      submission.reset();
      toast.show({ title: AUTH_COPY.toasts.signedOutOthers.title, message: AUTH_COPY.toasts.signedOutOthers.body });
      onSignedOut?.();
      onClose();
    },
  },
);
```

*Lane: Web admin module (web/src/modules/admin) (lane id CR-01).*

## Warnings

### WR-01: Open password-reset links stay valid after a Manager sets a temporary password, after a profile password change, and after an at-once email move

**File:** `src/Csps.Application/Users/SetTemporaryPasswordHandler.cs:103-111`, `src/Csps.Application/Profile/ChangePasswordHandler.cs:99-130`, `src/Csps.Application/Users/UpdateUserHandler.cs:248-253`
**Issue:** These three flows each exist to take control of an account back, yet none of them revokes open `PasswordReset` tokens. `SetTemporaryPasswordHandler` revokes the Invitation token only when `!target.HasPassword`, and `ChangePasswordHandler` revokes none. `StartEmailAsync` on the MoveNow path revokes only `EmailChange` links.

Scenario:
1. A reset link was emailed to the person (forgot-password, or a Manager's send-reset-link, valid 30 minutes).
2. The Manager sets a temporary password because the mailbox is suspect, or the person changes their password, or the Manager moves the email to a new address.
3. `ResetPasswordHandler` (`AccountLinkLookup.MayUse`) only checks that the token is usable and that the account is not blocked and is confirmed. So whoever holds the old link, or the old mailbox, can still set a password.
4. That also runs `ClearMustChangePasswordAsync`, which silently cancels the Manager's forced change.

For the MoveNow case, the old address is exactly the one the Manager no longer trusts.
**Fix:** In all three transactions, call `tokens.RevokeOpenAsync(id, AccountTokenPurpose.PasswordReset, now, ct)` before the audit rows. In `StartEmailAsync` do it for `EmailStep.MoveNow` with `target.HasPassword`. The `tokens.LockAccountAsync` the first two handlers already take (SetTemporaryPassword) or should take (ChangePassword) serializes it against a racing forgot-password.

*Lane: Backend source (src/, tools/) (lane id WR-01).*

### WR-02: Identity concurrency failures in the simple mutators surface as 500, while controllers and OpenAPI promise 409

**File:** `src/Csps.Infrastructure/Identity/UserAccounts.cs:159-186`, `:593-598`, `:560-567`
**Issue:** `ResetFailedCountAsync`, `LockUntilAsync`, `ClearLockoutAsync`, `SetPasswordAsync`, the `UpdateAsync` helper (used by `ConfirmEmailAsync`, `SetMustChangePasswordAsync`, `ClearMustChangePasswordAsync` and `Mark/ClearBreachRecheckAsync`) and `KeepAccountAsLastChangerAsync` all pass `IdentityResult` straight to `Require`. `UserManager.UpdateAsync` swallows `DbUpdateConcurrencyException` into a `ConcurrencyFailure` result, so a lost race throws `InvalidOperationException`. That bypasses `ConflictRetry`, which only catches `ConcurrencyConflictException`, and the user gets "Something went wrong" instead of the documented 409 or a retry.

`LoadAsync` uses `FindByIdAsync` (the identity map), so the entity's `ConcurrencyStamp` and `EditVersion` are as old as the first read of the request. The race window is the whole handler, not one statement. Any concurrent wrong-password count (`AccessFailedAsync` changes the stamp) fails SetTemporaryPassword, ChangePassword, RequestEmailChange or ConfirmEmailChange for that account. An attacker spraying wrong passwords at a victim's address can therefore make the victim's password change fail intermittently.
**Fix:** Give these methods the same bounded reload-and-retry loop the others have, or factor one `MutateAsync(id, Action<ApplicationUser>)` that does:
```csharp
for (var attempt = 1; ; attempt++)
{
    var user = await LoadAsync(id, ct);
    change(user);
    var result = await users.UpdateAsync(user);
    if (result.Succeeded) return;
    if (attempt == CountAttempts || !IsConcurrencyFailure(result)) Require(result, action);
    await context.Entry(user).ReloadAsync(ct);
}
```
Use it for all of them. Alternatively map a leftover `ConcurrencyFailure` to `ConcurrencyConflictException` so `ConflictRetry` and the 409 path apply.

*Lane: Backend source (src/, tools/) (lane id WR-02).*

### WR-03: An account created with a temporary password is born with `EmailConfirmed = true` for an address nobody has proved

**File:** `src/Csps.Infrastructure/Identity/UserAccounts.cs:68`, `src/Csps.Application/Users/CreateUserHandler.cs:103-111`, `src/Csps.Application/Auth/AccountLinkLookup.cs:48-49`
**Issue:** The temporary-password route sends no email and marks the address confirmed. Forgot-password (`ForgotPasswordHandler`) and `MayUse` only require `EmailConfirmed`.

If the Manager mistypes the address and it lands in someone else's inbox, that stranger can:
1. Request a reset link and set a password.
2. Receive the emailed sign-in code.
3. Sign in as an Admin or Manager before the real person ever does.

The must-change flag does not help: the reset path clears it. The identity-proof step the invitation route provides is skipped entirely. D-14 may accept this, but nothing in the code limits the exposure window.
**Fix:** Cheapest: keep `EmailConfirmed = false` and let the first successful 2FA code verify (which already proves mailbox control) set it. That needs `SignInHandler` to allow unconfirmed-with-temporary-password through to the code step. Otherwise record this as an owner-accepted risk, and at least show the Manager the address back before saving.

*Lane: Backend source (src/, tools/) (lane id WR-03).*

### WR-04: Scrubbing a deleted person's pending address can expire another live account's mail

**File:** `src/Csps.Application/Users/DeleteUserHandler.cs:99-103`, `src/Csps.Infrastructure/Email/OutboxEmailSender.cs:60-79`
**Issue:** `ScrubRecipientAsync(pending, …)` expires every unsent outbox row addressed to the pending address and readdresses all closed rows, with no regard to who owns those rows. A pending address is not reserved: `CreateUserHandler` and `UpdateUserHandler` check only `Email`/`UserName`. Another account can therefore be invited at that address while A's change is waiting. Deleting A then expires the new account's unsent invitation or sign-in code and rewrites that account's mail history to `deleted-…@deleted.invalid`.
**Fix:** Scrub the pending address only for rows that belong to the deleted account's own change flow, for example by `Kind IN (EmailChangeConfirm)`. Better, add a user-id column to the outbox rows that matter and scrub by id, or skip the scrub when another live account holds the pending address (`FindByEmailAsync(pending)` non-null).

*Lane: Backend source (src/, tools/) (lane id WR-04).*

### WR-05: Two inconsistent definitions of "active Manager"; a soft-deleted Manager still looks active

**File:** `src/Csps.Infrastructure/Identity/UserAccounts.cs:233-238` vs `:240-252`, `:310-343`
**Issue:** `CountActiveManagersAsync` and `ManagerGuard.IsActiveManager` exclude deleted and Manager-locked accounts. `AnyActiveManagerAsync`, which gates the bootstrap command, counts any Manager with `IsActive`. `SoftDeleteAsync` never clears `IsActive`, so a deleted or locked Manager counts as "active" for bootstrap. If the roster is ever left without a usable Manager (data repair, an old migrated row, the stale-session case the guard tolerates), bootstrap refuses with `bootstrap.manager-exists` and there is no recovery path.
**Fix:** Make `AnyActiveManagerAsync` call `CountActiveManagersAsync(null, ct) > 0`, so there is one definition. Optionally set `IsActive = false` in `SoftDeleteAsync`.

*Lane: Backend source (src/, tools/) (lane id WR-05).*

### WR-06: The default-on idempotency transaction holds a DB connection and applock across slow external calls, defeating the stated design in several handlers

**File:** `src/Csps.Server/Security/IdempotencyMiddleware.cs:79-98`, `src/Csps.Application/Profile/ChangePasswordHandler.cs:74-76`, `src/Csps.Application/Auth/ResetPasswordHandler.cs:61-72`, `src/Csps.Application/Auth/AcceptInviteHandler.cs:55-72`, `src/Csps.Application/Auth/ForgotPasswordHandler.cs:52`
**Issue:** `gate.BeginAsync` opens a transaction and takes `sp_getapplock` before the endpoint runs, and holds both until the response is buffered. The handlers' comments say the HIBP HTTP call (up to 3 s) runs "before any transaction opens, so a slow breach service never holds a connection". For every non-exempt POST that is no longer true. The same applies to ForgotPassword's 500 ms `ResponseFloor` wait.

Anonymous POSTs (reset-password, accept-invite, forgot-password) can pin pool connections for seconds each. With the 256 MB host and a default pool of 100, a modest distributed burst can starve every other request. The rate limiter is per IP only.
**Fix:** Either exempt the anonymous slow endpoints from the lease (they are already single-use or rate-limited) and give them their own natural idempotency, or open the lease lazily: start the transaction when the first `InTransactionAsync` or `SaveChanges` runs, not before the handler. At minimum, correct the handler comments and set a tighter rate-limit partition for these routes.

*Lane: Backend source (src/, tools/) (lane id WR-06).*

### WR-07: "No email was sent" assertions read the sink immediately, so they can pass while a mail is sent

**File:** `tests/Csps.Server.IntegrationTests/Users/LockUserTests.cs:52-58`, plus the same pattern in:
- `Users/TemporaryPasswordTests.cs:210`
- `Users/ManagerResetLinkTests.cs:196,213,234,255`
- `Users/ResendInvitationTests.cs:120,146,167,188`
- `Users/ManagerEmailChangeTests.cs:243,307,376`
- `Profile/EmailChangeTests.cs:158,209,275,294`
- `Profile/EmailChangePendingTests.cs:286`

**Issue:** These are the security-relevant negatives: D-17 (a locked account's forgot-password sends nothing), a blocked person gets no reset link or invitation, a rejected email-change request mails nobody, and the "email already used" case does not reveal itself by mailing the other address. Each one calls `AuthClient.ReadEmailsAsync(...)` and asserts empty or unchanged straight after the HTTP response.

Mail only reaches the Testing sink after the outbox dispatcher runs, which is asynchronous after the commit (the host is configured with a 1 s sweep plus a post-commit signal; see `CspsApiFactory` and `EmailOutboxTests`). A regression that queues a mail would be caught only if the dispatcher happens to finish before the next HTTP round trip. On a loaded machine, or with the sweep interval rather than the signal doing the work, the assertion passes while the mail is sent. `DeleteUserTests.cs:219` shows the authors knew this and sleeps 2.5 s there, but the other call sites do not.

`LockUserTests.cs:58` is the clearest case: `forgot` returns 202, then the count is compared to the pre-request count with no wait.

**Fix:** Assert on the durable state instead of the racy sink. The outbox row is committed with the request, so no wait is needed. Add a helper next to `AuthClient`:

```csharp
// Counts outbox rows for an address; rows are committed with the request, so there is no race.
public static async Task<int> OutboxCountAsync(CspsDatabase database, string to, CancellationToken ct) {
    await using var context = database.CreateContext();
    return await context.EmailOutbox.AsNoTracking().CountAsync(m => m.ToAddress == to, ct);
}
```

Use it for every "sends nothing" check, as `InactiveAccountTests.cs:35` and `:134` already do. Where the sink must be used, wait for a known later message first (as `EmailChangePendingTests.cs:65-69` does) before asserting the count.

*Lane: Backend tests (tests/) (lane id WR-01).*

### WR-08: BootstrapManager tests point a live connection string at another project's database

**File:** `tests/Csps.Infrastructure.IntegrationTests/Seeding/BootstrapManagerTests.cs:284-293` and `307-316`

**Issue:** `ABetsDatabaseIsRefusedWithoutOpeningAConnection` and `APromptedConnectionIsUsedWhenTheVariableIsNotSet` build `Server=(localdb)\MSSQLLocalDB;Database=BetsLLC_Dev;Integrated Security=true` and pass it to the real `BootstrapProgram.RunAsync`. That is the shared LocalDB instance and TheBETSLLC's database name, which CLAUDE.md says must never be created, reset, restored over or dropped.

Today the guard refuses first, so nothing connects. But the tests exist to detect a regression in that guard, and when the guard regresses the program will connect to `BetsLLC_Dev` and try to read and insert a Manager, outbox row, token and audit rows into the other project's database. The test name claims it never opens a connection, yet nothing asserts that.

**Fix:** The guard is a pure function of the string, so use an unreachable host that still carries the protected database name. A regression then fails with a connection error instead of writing to the neighbour's database:

```csharp
var connection = "Server=db.invalid.example;Database=BetsLLC_Dev;Integrated Security=true;Connect Timeout=1";
```

`GuardRefusesProtectedDatabasesEvenWhenConfirmed` (line 38-41) already uses `Server=db.example.net` for a `betsllc_live` case, so the pattern is established.

*Lane: Backend tests (tests/) (lane id WR-02).*

### WR-09: Rate-limit test omits `POST /api/v1/profile/password`, the new current-password oracle

**File:** `tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs:43-64`

**Issue:** `LimitedEndpoints` lists every auth endpoint and the profile email-change routes, but not `POST /api/v1/profile/password`. `ProfileController` puts `[EnableRateLimiting(RateLimitPolicies.Reset)]` on it (this is the endpoint that checks a current password), and the theory is named `EveryAuthEndpointCarriesItsPolicy`. If the attribute is dropped or the policy is renamed, nothing fails. The per-account five-failure lockout covers one account but is not the per-address limit that SEC-03 describes.

**Fix:** Add the row. This endpoint needs a valid bearer to get past auth, but the limiter runs before authentication (Program.cs line 129-130), so the same unauthenticated loop works:

```csharp
{ "POST", "/api/v1/profile/password", 10 },
```

Consider adding a reflection check that every `[HttpPost]`, `[HttpPut]` or `[HttpDelete]` action carrying a rate-limit attribute is present in this list, so the next endpoint cannot be forgotten.

*Lane: Backend tests (tests/) (lane id WR-03).*

### WR-10: No test that user, roster and profile responses omit credential fields

**File:** `tests/Csps.Server.IntegrationTests/Users/GetUserEndpointTests.cs:15-40`, `Users/ListUsersEndpointTests.cs:15-34`, `Profile/ProfileEndpointTests.cs:21-39`

**Issue:** The roster test deserialises into the typed `ListedUser` record, and the detail and profile tests read only the properties they expect. Nothing asserts that `passwordHash`, `securityStamp`, `concurrencyStamp`, `accessFailedCount`, or token data are absent. These endpoints return an Identity-backed account, so the realistic regression is a projection change that serialises the entity (CWE-200). The audit "people" test (`AuditLogEndpointTests.cs:245-248`) already asserts the exact property set, which shows the intended standard.

**Fix:** In each of the three tests, assert the exact set of property names, for example:

```csharp
detail.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal)
      .ShouldBe(["createdAt","email","firstName","hasPassword","id","inviteState","lastChangedBy","lastName",
                 "managerLocked","pendingEmail","recordedBy","role","status","updatedAt","version"]);
```

For the roster, read the raw JSON of one row instead of (or in addition to) the typed record.

*Lane: Backend tests (tests/) (lane id WR-04).*

### WR-11: Concurrent last-Manager tests require exactly {204, 422}; a 401 is a legitimate outcome

**File:** `tests/Csps.Server.IntegrationTests/Users/LastManagerGuardTests.cs:114-123, 191-200, 221-228, 307-316`; `Users/UpdateUserEndpointTests.cs:318-327`

**Issue:** Two Managers act on each other at the same instant. The test comment says a warm session cache keeps the loser's token valid until the winner's eviction so the 422 comes from the guard. The loser has to authenticate before the winner's transaction (roster lock, writes, commit, session revoke, cache eviction) completes. Both requests are released together, but the loser can be delayed by thread-pool scheduling or a CI noisy neighbour. If it is, its token is already revoked and it correctly gets 401. That is acceptable security behaviour (the account was just removed), yet these assertions fail with `[204, 401]`.

The tests loop 20 times and there are five such loops, so a rare ordering will eventually fail a build for a non-bug.

**Fix:** Accept the legitimate outcomes while keeping the invariant that matters:

```csharp
var statuses = new[] { first.StatusCode, second.StatusCode };
statuses.Count(s => s == HttpStatusCode.NoContent).ShouldBe(1, $"run {run}");
statuses.Single(s => s != HttpStatusCode.NoContent).ShouldBeOneOf(HttpStatusCode.UnprocessableEntity, HttpStatusCode.Unauthorized);
```

Keep the final `ActiveManagersAsync().Count.ShouldBe(1)` check, which is the real guarantee. If the 422 path must be proven, keep a separate test that holds the loser's request after authentication, for example by driving the handlers directly.

*Lane: Backend tests (tests/) (lane id WR-05).*

### WR-12: `ConcurrentRequests.SendTogetherAsync` has no timeout, so a deadlock hangs the run

**File:** `tests/Csps.Testing/ConcurrentRequests.cs:16-47`

**Issue:** The helper waits on `bothWaiting` and then `Task.WhenAll` with no timeout or cancellation parameter. Its callers (`LastManagerGuardTests`, `UserEditConcurrencyTests`, `ProfileConcurrencyTests`, `CreateUserEndpointTests`, `UpdateUserEndpointTests`) exist precisely to catch lock-ordering and race bugs in `LockActiveManagersAsync` and the unique-email path. A lock-ordering bug that deadlocks, or a thread-pool starvation that keeps one runner from reaching the gate, makes the test run forever instead of failing. There is no `[Fact(Timeout = ...)]` on any of these tests either (a grep for `Timeout` finds none in the server tests).

There is also a minor leak: if one sender throws, `Task.WhenAll` rethrows and the other task's `HttpResponseMessage` is never disposed.

**Fix:**

```csharp
public static async Task<(HttpResponseMessage First, HttpResponseMessage Second)> SendTogetherAsync(
    Func<Task<HttpResponseMessage>> first, Func<Task<HttpResponseMessage>> second, TimeSpan? limit = null)
{
    ...
    using var cts = new CancellationTokenSource(limit ?? TimeSpan.FromSeconds(30));
    await bothWaiting.Task.WaitAsync(cts.Token);
    release.SetResult();
    var both = Task.WhenAll(firstTask, secondTask);
    try { var r = await both.WaitAsync(cts.Token); return (r[0], r[1]); }
    catch { /* dispose whichever responses completed */ throw; }
}
```

Alternatively add `Timeout = 120_000` to the race tests.

*Lane: Backend tests (tests/) (lane id WR-06).*

### WR-13: Audit-log tests read an unscoped top-100 page of a shared, append-only log

**File:** `tests/Csps.Server.IntegrationTests/Audit/AuditLogEndpointTests.cs:132-151` (worst case), also `113-129`, `154-181`, `184-200`

**Issue:** The class docs say the database is shared and the log is append-only, so tests find entries "by person or by reference". Several tests then fetch `pageSize=100` with no actor, target or action filter and look for a reference inside it.

`OnlyTheLastSevenBusinessDaysAreListedAndTheBoundaryIsTheStartOfTheSixthDayBack` inserts an entry exactly at the start of the six-days-back boundary and requires it to appear in the newest 100 entries of the whole class database. Every other test in the class writes entries timestamped "now", all newer, so the boundary entry is pushed off page 1 once the class has written 100 newer rows.

I counted about 33 direct inserts plus the entries written by API calls in this class, so it passes today with little headroom, and the count grows with each new test. The negative half (`refs.ShouldNotContain(justBefore)`, `eightDaysAgo`) passes vacuously whenever those entries are off the page. Test order within a class is not stable across xUnit versions.

**Fix:** Scope each read with a filter that matches only the test's own rows. `target=` and `actor=` already exist; give the seven-day test a fresh subject via `UserFixtures.CreateAsync`, insert all four entries with `targetId = subject.Id`, and read with `target={id}&pageSize=100`. The `ADayRunsFromMidnight...` test (line 356-376) already follows that pattern.

*Lane: Backend tests (tests/) (lane id WR-07).*

### WR-14: Missing test pins an inconsistent definition of "active Manager" in the bootstrap path

**File:** `tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs:347-384` (source: `src/Csps.Infrastructure/Identity/UserAccounts.cs:233-238`)

**Issue:** `AnyActiveManagerAsync` is what `BootstrapManagerHandler` uses to decide whether the first-Manager command must refuse. It returns `managers.Any(m => m.IsActive)`. The Phase 5 definition (D-18, `ManagerGuard.IsActiveManager`, `CountActiveManagersAsync`, and the test helper `ActiveManagersAsync` in `LastManagerGuardTests`) is: role Manager, active, not deleted, not Manager-locked. The tests cover only "deactivated Manager does not count" (`DeactivatedManagerDoesNotCount`); there is no case for a Manager-locked or soft-deleted Manager.

The result is that a database whose only Manager is soft-deleted or Manager-locked (reachable by direct SQL, or by a path the guard does not cover) still counts as having an active Manager, so the bootstrap recovery command refuses ("An active Manager already exists") when it is needed most. This is a source defect revealed by the absent test, so the production fix belongs to the source-side review lane.

**Fix:** Add two cases beside `DeactivatedManagerDoesNotCount`: a Manager with `ManagerLockedAtUtc` set, and one with `DeletedAtUtc` set, each expecting `AnyActiveManagerAsync == false`. Then align the query with `CountActiveManagersAsync` (`user.IsActive && ManagerLockedAtUtc == null && DeletedAtUtc == null`). The query can also move into the database rather than loading every Manager through `GetUsersInRoleAsync`.

*Lane: Backend tests (tests/) (lane id WR-08).*

### WR-15: Change Email dialog keeps the current password in memory after it closes

**File:** `web/src/modules/admin/components/ChangeEmailDialog.tsx:38-49, 58-61, 100-108`
**Issue:** `ChangeEmailDialog` always renders `ChangeEmailForm`. When `open` goes false only the `Modal` unmounts; the form component, its react-hook-form state (`currentPassword`) and its `useSubmission` last-submission record (which holds `JSON.stringify(values)`, so the password in clear text) stay alive until the dialog is opened again or the Profile page unmounts. `AddUserPanel` and `TemporaryPasswordDialog` have an explicit discard (`DISCARD_MS` timer, `reset()`, `submission.reset()`) so "nothing of the password is kept" after close (T-05-87). The Change Email dialog holds a more sensitive secret (the account password) and has no equivalent. This is memory only, but it is inconsistent with the module's stated rule and survives a Cancel as well as a successful send.
**Fix:** Mirror the other two dialogs: after close plus the exit time, call `reset({ newEmail: '', currentPassword: '' })` and `submission.reset()`. Or simpler, render the form only while mounted-open: `{open && <ChangeEmailForm ... />}` is not possible because the Modal needs the exit animation, so use the discard timer pattern.
```tsx
const discard = useEffectEvent(() => { reset({ newEmail: '', currentPassword: '' }); submission.reset(); });
useEffect(() => {
  if (open) return undefined;
  const timer = window.setTimeout(discard, DISCARD_MS);
  return () => window.clearTimeout(timer);
}, [open]);
```

*Lane: Web admin module (web/src/modules/admin) (lane id WR-01).*

### WR-16: An account action's reload wipes whatever the Manager typed while the request ran

**File:** `web/src/modules/admin/components/EditUserPanel.tsx:349-373, 398-402, 389-394`
**Issue:** The account buttons (Lock, Unlock, Resend, Send Reset Link, Cancel Email Change, Set Temporary Password) are `aria-disabled` only while the form is dirty at click time (`waiting = isDirty || pending`, where `pending` is the Save submission only). While a lock/unlock/resend/reset/cancel request is in flight, and during the following `readLatest()` fetch, the form is still editable. When `readLatest` resolves it calls `setPerson(latest)` and `reset(valuesOf(latest))` (and the `values` prop changes too), which silently replaces anything typed in that window with the saved values. No banner, no toast. The same happens for `closeTemporary`, which calls `readLatest()` on close. The comment says the form "was clean", which holds at click time but not at completion time.
**Fix:** Either include the action submissions in `waiting` and make the form inert while they run (disable inputs or add `aria-busy` plus ignoring input), or make `readLatest` from an account action refresh only the fields that actions change (`pendingEmail`, `status`, `managerLocked`, `hasPassword`, `version`) and leave the dirty form values alone:
```tsx
const accessBusy = [lockAction, unlockAction, cancelEmailAction, resendAction, resetLinkAction].some((a) => a.pending);
const waiting = isDirty || pending || accessBusy;
```
and in `afterAction` call `reset(valuesOf(latest), { keepDirtyValues: true })` when the form became dirty meanwhile.

*Lane: Web admin module (web/src/modules/admin) (lane id WR-02).*

### WR-17: A refused role at sign-in is swallowed and the person is bounced with no explanation

**File:** `web/src/modules/admin/services/session.ts:154-169, 180-187`; callers `web/src/modules/admin/pages/VerifyCodePage.tsx:114-116` and `web/src/modules/admin/pages/NewPasswordPage.tsx:52-56`
**Issue:** The new `acceptSession` refuses a session whose role is not exactly `Admin` or `Manager` and calls `clearSession()`. `completeSignIn` returns `void`, so `VerifyCodePage` and `NewPasswordPage` cannot tell. They go on to `navigate(safeReturnUrl(returnUrl))` (and `NewPasswordPage` first leaves the one-shot `password-saved` toast). The `/admin` guard then boots a session from the refresh cookie, is refused the same way, and redirects to `/admin/login?returnUrl=...` with no notice. The person sees the sign-in form again after a correct password and code, with no message and no way to know why. (The same path through `requestSession` correctly treats it as a 401.)
**Fix:** Make `completeSignIn` report whether it kept the session and let the callers show an error instead of navigating:
```ts
function completeSignIn(response: SessionResponse): boolean {
  acceptSession(response);
  resendAvailableAt = null;
  if (snapshot.user === null) return false;
  channel?.postMessage({ type: 'refreshed', expiresAt: tokenExpiresAt } satisfies ChannelMessage);
  return true;
}
```
and in the pages: `if (!completeSignIn(response.session)) { setBanner(describeHttpError(undefined)); return; }` (and set the `password-saved` toast only after it returns true).

*Lane: Web admin module (web/src/modules/admin) (lane id WR-03).*

### WR-18: Audit Log "people" failure is invisible and mislabels deep-linked filters

**File:** `web/src/modules/admin/pages/AuditLogPage.tsx:152, 184-197, 233-280`
**Issue:** `useAuditPeopleQuery()` is read only for `isPending` and `data`. If the request fails (network, 5xx), `loadingPeople` becomes false, `everyone` is `[]`, and Done by / Done to offer only "System" (or nothing) with no error and no retry. A deep link such as the Edit panel's "See this user's activity" (`?target=<id>&range=all`) then shows the chip value "Unknown person" and the filter summary "done to Unknown person", which reads as a data problem rather than a failed lookup. The Manager cannot tell the filter is working on a real id.
**Fix:** Surface `people.isError`: keep the selects disabled with a "Couldn't load staff" placeholder and an inline retry (`people.refetch()`), and have `nameOf` return a distinct "Name unavailable" label while `people.isError`.

*Lane: Web admin module (web/src/modules/admin) (lane id WR-04).*

### WR-19: Every failed list load is explained as an internet problem

**File:** `web/src/components/states/copy.ts:10` (used at `web/src/components/states/ErrorState.tsx:41-46`, reached from `web/src/components/lists/ResponsiveTable.tsx:284`)
**Issue:** `ResponsiveTable` renders `<ErrorState things={things} error={error} />`. With `things` set, `ErrorState` always shows `loadFailedBody` = "Check your internet connection. Your data is safe. Nothing was changed.", whatever the error was. A 403 (a Manager demoted while the page was open), a 404 or a 5xx therefore tells the user to check their connection, and the guidance is wrong. The `HttpError` is already passed in, but only its `traceId` is used. `describeHttpError` exists to give the right words per status and is not consulted. The "Nothing was changed" claim is also stated unconditionally.
**Fix:** In `ErrorState`'s list-load branch, take the body from the mapper for non-network failures and keep the approved reassurance line for network/timeout only:
```tsx
const mapped = props.things === undefined ? null : describeHttpError(error);
const message =
  props.things === undefined
    ? (props.message ?? '')
    : isHttpError(error) && (error.kind === 'network' || error.kind === 'timeout')
      ? STATES_COPY.error.loadFailedBody
      : (mapped?.body ?? STATES_COPY.error.loadFailedBody);
```

*Lane: Shared web (web/ outside modules/admin, .gitleaks.toml) (lane id WR-01).*

### WR-20: Several controls are smaller than the project's 44 px touch-target rule

**File:** `web/src/components/navigation/navigation.recipe.ts:150` (`topbarMenuClasses`, `size-9`, 36 px; it is the only way to open navigation on a phone) and `:47` (`sidebarToggleClasses`, 36 px); `web/src/components/lists/lists.recipe.ts:184` (`iconButtonBase`, `size-9`, 36 px, used by every `RowAction`, with only `gap-0.5` between them) and `:264` (`filterChipClearClasses`, 22 px)
**Issue:** CLAUDE.md makes "touch targets >= 44px" binding and responsive 320-1920 px. The pagination buttons (`lists.recipe.ts:273`) and the Phase 4 sign-in links (OQ-5 `::before` hit area) are 44 px, so the rule is known and applied elsewhere. The four controls above are not. The row-action buttons sit 2 px apart on phone cards, which invites mis-taps on Edit / Deactivate / Delete, and Delete is destructive. WCAG 2.5.8 (24 px) is met, but the project rule is not, and no spec in the lane measures target size (`a11y-rulings.spec.ts` covers opacity, weight and focus visibility only). I could not find an owner ruling that waives it; the chip clear carries an "O-8 size kept" note, which may be a ruling, so confirm before changing the look.
**Fix:** Keep the drawn size and add an invisible 44 px hit area, the way OQ-5 did, for example on the button class: `relative before:absolute before:left-1/2 before:top-1/2 before:size-11 before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']`. Add an e2e assertion that every visible `button, a[href]` inside the admin shell has a hit box of at least 44x44, or an explicit allow-list.

*Lane: Shared web (web/ outside modules/admin, .gitleaks.toml) (lane id WR-02).*

### WR-21: `build-output.node.test.ts` can pass against a stale build, and ignores a failed build

**File:** `web/src/test/build-output.node.test.ts:34-44` and `:248-253`
**Issue:** The build runs only when `wwwroot/index.html` is missing. Whenever any earlier build exists, every assertion (CSP-safe HTML, no dev copy, no secrets in the showcase chunks, T-05-96) runs against that old output, not the current source. The `adminJs <= 250_000` check reads `artifacts/budget/budget.production.json`, which is only rewritten by a build, so it can report a number from a previous build. The `spawnSync` result is never checked: a failed build leaves a partial `wwwroot`, and the suite then fails (or worse, passes) on whatever is there. These are security gates (T-05-96 showcase chunks are public), so a silent stale pass is a real gap.
**Fix:** Compare the newest source mtime with `index.html` as `owner-review.mjs` does for `BUILD_INPUTS`, or always rebuild in CI, and fail loudly on a bad exit code:
```ts
const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { cwd: webDirectory, env, stdio: 'inherit' });
if (result.status !== 0) {
  throw new Error(`vite build failed with exit code ${String(result.status)}`);
}
```

*Lane: Shared web (web/ outside modules/admin, .gitleaks.toml) (lane id WR-03).*

## Info

### IN-01: Hard-coded "15 minutes" in the lockout message, while the duration is configurable

**File:** `src/Csps.Application/Profile/ProfileErrors.cs:19`
**Issue:** `PasswordLockedMessage` says "Try again in 15 minutes", but `AuthSettings.PasswordLockoutDuration` is bound from configuration. The `Retry-After` header and the message can disagree.
**Fix:** Build the message from the actual remaining time or the configured duration, or drop the number: "Too many wrong passwords. Try again later."

*Lane: Backend source (src/, tools/) (lane id IN-01).*

### IN-02: Near-duplicate code makes the roster handlers and mutators hard to keep in step

**File:** `src/Csps.Infrastructure/Identity/UserAccounts.cs:198-218`, `:254-343`, `:465-485`; `src/Csps.Application/Users/{Deactivate,Lock,Delete}UserHandler.cs`
**Issue:**
- Five retry loops (`MarkStaffEdit`, `SetActive`, `SetManagerLock`, `SoftDelete`, `SetPendingEmail`) differ only in the mutation, and WR-02 shows the cost of that.
- The Deactivate, Lock and Delete handlers share about 90% of their body; only the account call and the audit action differ.
- `MaxPage = 100_000` is duplicated in `ListUsersRequestValidator` and `ListAuditLogRequestValidator`.
- The literal `"User"` is repeated where other handlers use `UserTarget`.

**Fix:** One generic `MutateWithRetryAsync`, a shared roster-action helper, and a single `ListQueryLimits.MaxPage` constant.

*Lane: Backend source (src/, tools/) (lane id IN-02).*

### IN-03: Case handling of outbox address lookups relies on database collation

**File:** `src/Csps.Infrastructure/Email/OutboxEmailSender.cs:50-57`, `:60-66`; `src/Csps.Application/Ports/IEmailOutbox.cs:24`
**Issue:** The port promises that the comparison "ignores case", but the code uses plain `ToAddress == to`, which is case-insensitive only under a CI collation. The project pins compat level 160 "until the host level is verified" and the host collation is not recorded. Under a CS collation the reset-email cap and the delete-time scrub would miss case variants of the same address.
**Fix:** Compare on a normalized column, or `ToUpper()`/`COLLATE` explicitly, or record and test the production collation.

*Lane: Backend source (src/, tools/) (lane id IN-03).*

### IN-04: An unauthenticated caller can exhaust the shared reset-email cap and block a Manager's "send reset link"

**File:** `src/Csps.Application/Auth/ResetEmailCap.cs:21-32`, `src/Csps.Application/Users/SendResetLinkHandler.cs:75-78`
**Issue:** Forgot-password and `SendResetLink` share one 3-per-hour budget per address. Anyone who knows a staff email can spend it with forgot-password calls, so the Manager's button answers 429 `users.reset-link-capped` for an hour. The Manager can still set a temporary password, so impact is low, but the cap is shared on purpose and that side effect is not documented.
**Fix:** Count Manager-sent links against a separate (or higher) budget, or note the behavior in the endpoint docs and the UI copy.

---

_Reviewed: 2026-10-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

*Lane: Backend source (src/, tools/) (lane id IN-04).*

### IN-05: Duplicated fixture helpers and stale "later plan" comments

**File:** `Profile/EmailChangeTests.cs:643-659`, `Profile/EmailChangePendingTests.cs:423-448`, `Users/CreateUserEndpointTests.cs:330-344`

**Issue:** `SoftDeleteAsync` is copied three times (and `ManagerLockAsync` is a fourth copy of `AccountStateFixtures.ManagerLockAsync` in `EmailChangePendingTests`). The comments say the delete feature "comes in a later plan" or is "the later delete feature", but `DeleteUserTests` shows it exists. The copies also drift: `CreateUserEndpointTests` scrambles to `deleted.{guid}@deleted.invalid`, while production uses `deleted-{id:N}@deleted.invalid` (`DeleteUserTests.cs:88`, `DeletedAddress.For`). The test therefore does not model what the real delete leaves behind.

**Fix:** Put one `SoftDeleteAsync(CspsDatabase, Guid)` in `AccountStateFixtures` (or call the real `DELETE` endpoint), reuse `DeletedAddress.For(id)`, and delete the stale comments.

*Lane: Backend tests (tests/) (lane id IN-01).*

### IN-06: Reflection and record-getter tests of little value

**File:** `Auth/AccountLinkLookupTests.cs`, `Common/AuditKeyTests.cs:19-27`, `Auth/UserAccountTests.cs:11-33,65-100`

**Issue:** `AccountLinkLookupTests` asserts by type name that two old classes no longer exist, which passes whatever the behaviour is. `AuditKeyTests.NoTypeKeepsItsOwnGuidKeyHelper` finds only methods literally named `Key(Guid)` returning string, so a copy named `KeyOf` or `Format` passes. `UserAccountTests` mostly asserts that record constructors assign properties. These count toward coverage without testing behaviour.

**Fix:** Delete them, or replace the structure checks with an ArchUnitNET rule (the project already has `Csps.ArchitectureTests`).

*Lane: Backend tests (tests/) (lane id IN-02).*

### IN-07: Test name and magic count disagree in `AuditActionsTests`

**File:** `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs:11-17`

**Issue:** `CatalogHoldsTheTwentyOneAuthCodesAndTheProfileAndUserCodes` asserts `All.Count.ShouldBe(37)`. The name no longer describes the number, and a plain count makes every new action a test edit with no information about which action is missing.

**Fix:** Drop the count, or assert the full expected list of names so a failure shows the difference.

*Lane: Backend tests (tests/) (lane id IN-03).*

### IN-08: Mismatched user name and normalized user name in `NewRawUser`

**File:** `tests/Csps.Infrastructure.IntegrationTests/Identity/IdentitySchemaTests.cs:259-268`

**Issue:** `UserName` and `NormalizedUserName` are built from two separate `Guid.NewGuid()` calls, so the normalised value is not the normalised form of the user name. It works because only the email uniqueness is tested, but it writes inconsistent Identity rows.

**Fix:**

```csharp
var userName = $"{name}.{Guid.NewGuid():N}";
... UserName = userName, NormalizedUserName = userName.ToUpperInvariant(),
```

*Lane: Backend tests (tests/) (lane id IN-04).*

### IN-09: Unicode normalisation test relies on raw non-ASCII characters in source

**File:** `tests/Csps.Application.UnitTests/Profile/ChangePasswordHandlerTests.cs:239-248`

**Issue:** `composed` and `decomposed` are visually identical in source. I checked the bytes and they do differ (`c3 a9` versus `65 cc 81`), so the test is correct today. An editor or formatter that normalises Unicode would silently turn it into a test of identical strings that always fails the other way.

**Fix:** Use escapes: `"Café#Tahi2026"` and `"Café#Tahi2026"`.

*Lane: Backend tests (tests/) (lane id IN-05).*

### IN-10: Fixed 2.5 s sleeps and a timing-dependent overlap test

**File:** `Csps.Infrastructure.IntegrationTests/Email/EmailOutboxTests.cs:89,167`, `Csps.Server.IntegrationTests/Users/DeleteUserTests.cs:219`, `Idempotency/IdempotencyTests.cs:186-218`

**Issue:** The "nothing is sent" tests wait 2.5 s of wall clock, which is slow and still only a bound on the 1 s sweep. `ADuplicateThatArrivesWhileTheFirstRunsGetsAConflict` depends on the forgot handler's 500 ms response floor to make two un-synchronised `Task.WhenAll` requests overlap; if the floor changes the test silently stops overlapping and fails with `[202, 202]` or passes without testing the race.

**Fix:** For the sleeps, assert on the outbox table (see WR-01) and drop the delay. For the overlap test, use `ConcurrentRequests.SendTogetherAsync` so the overlap does not depend on a handler's internal delay.

*Lane: Backend tests (tests/) (lane id IN-06).*

### IN-11: "No timer" lock test has no positive control

**File:** `tests/Csps.Server.IntegrationTests/Users/LockUserTests.cs:87-107`

**Issue:** After advancing 30 days the test asserts that the Manager-lock flag is still set (a database read that a lazily evaluated expiry would never change) and that sign-in returns the generic 401. The 401 is deliberately indistinguishable from every other refusal (04 D-02), so any unrelated failure also satisfies it.

**Fix:** After the 401, unlock the account through the API and assert that the same sign-in at the same clock now succeeds. That proves the 401 was caused by the lock.

*Lane: Backend tests (tests/) (lane id IN-07).*

### IN-12: Fixtures create states the product cannot reach, and tests then depend on them

**File:** `Users/LastManagerGuardTests.cs:47-60,160-175,259-275`, `Users/UpdateUserEndpointTests.cs:334-351`

**Issue:** These tests make the caller deactivated or Manager-locked through `AuthClient.DeactivateAsync` or `AccountStateFixtures.ManagerLockAsync`, which flip the flag without revoking sessions. They then use that caller's still-valid access token against Manager-only endpoints and expect the endpoint to run. In production, lock and deactivate always revoke the caller's sessions, so this state cannot exist. If authentication is later hardened to re-check `IsActive` or the lock per request, these tests will fail for a reason unrelated to the last-Manager guard. `DeleteUserTests.cs:242-256` has a related softness: `restore` and `undelete` are routes that never existed, so the 404 proves nothing about deleted people, and the `activate` 404 does not assert the `users.not-found` code.

**Fix:** Reach the same state through the real action (one Manager locks another through the API, then use the second Manager's token before it is evicted), or comment that the setup deliberately bypasses revocation. Add the `users.not-found` code assertion on the `activate` call.

---

_Reviewed: 2026-10-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

*Lane: Backend tests (tests/) (lane id IN-08).*

### IN-13: Header comments carry plan numbers and history, against OR-2

**File:** many, for example `web/src/modules/admin/components/EditUserPanel.tsx:1-18`, `usersService.ts:1`, `auditLogService.ts:1`, `usersGuards.ts:1`, `useUserAction.ts:1`
**Issue:** OR-2 asks for "minimal, concise" comments with "no history narration". The new files open with 10 to 18 line blocks that list plan numbers (`plan 05-22`, `05-30`), decision ids and review-pack notes. The Edit panel header is a full behaviour spec, and `EditUserPanel` line 12 to 13 describes toast behaviour that lives in `UsersPage`.
**Fix:** Cut each header to what the code does in two or three lines and leave decision ids in `.planning`.

*Lane: Web admin module (web/src/modules/admin) (lane id IN-01).*

### IN-14: Server field errors on `access` (Add User) have nowhere to show and no focus target

**File:** `web/src/modules/admin/components/AddUserPanel.tsx:38, 120-125, 132-151, 353-368`
**Issue:** `FIELD_ORDER` includes `access`, but the `access` Controller renders only a `RadioGroup` and ignores `fieldState.error`, and `focusField('access')` resolves `namedItem` to a `RadioNodeList`, which fails the `instanceof HTMLElement` test. A server 400 naming only `access` would set an error, return from `showFailure`, and show nothing. Client validation makes this practically unreachable today, but a server-side change would produce a silent failure.
**Fix:** Drop `access` from the server-error loop so it falls through to the `showLine` banner, or render `fieldState.error` under the group and focus the checked radio as `EditUserPanel.focusField` does for `emailChange`.

*Lane: Web admin module (web/src/modules/admin) (lane id IN-02).*

### IN-15: Audit Log "today" is fixed when the page opens

**File:** `web/src/modules/admin/pages/AuditLogPage.tsx:141`, `components/AuditCustomRange.tsx:35`
**Issue:** `businessToday(new Date())` is read once (documented as WEB-10). A tab left open past midnight Manila time keeps resolving "Last 7 days", `max` on the custom range and the kept floor against yesterday. New entries from the new day are outside the default range until the page is reopened.
**Fix:** Acceptable as designed; if wanted, recompute `today` on window focus or when `document.visibilityState` returns to visible.

*Lane: Web admin module (web/src/modules/admin) (lane id IN-03).*

### IN-16: Dead and unassociated error states in the Edit panel's email choice and `RoleField`

**File:** `web/src/modules/admin/components/EditUserPanel.tsx:88-95, 615-639`; `web/src/modules/admin/components/RoleField.tsx:31-34`
**Issue:** `emailChange` is initialised to `'confirm'` and the radio renders `field.value === 'now' ? 'now' : 'confirm'`, so the schema branch that rejects `emailChange === ''` can never fire, and the extra error `<p>` under the radio group is dead markup. Where it could show (a server error), neither that `<p>` nor `RoleField`'s error `<p>` is tied to its control with `aria-describedby`, and neither has `role="alert"`, so screen readers would not announce them.
**Fix:** Remove the dead `''` branch, or if the empty choice is meant to be possible, give the radio group and `RoleField` `aria-describedby` and `aria-invalid` for their error text.

---

_Reviewed: 2026-10-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

*Lane: Web admin module (web/src/modules/admin) (lane id IN-04).*

### IN-17: `ConfirmDialog` duplicates `errorLine`

**File:** `web/src/components/overlays/ConfirmDialog.tsx:66-70`
**Issue:** `failureText` is character-for-character the same as `errorLine` in `web/src/utils/describeHttpError.ts:66-69`, which already imports into this file (`describeHttpError`).
**Fix:** Import `errorLine` and delete `failureText`.

*Lane: Shared web (web/ outside modules/admin, .gitleaks.toml) (lane id IN-01).*

### IN-18: `ResponsiveTable` declares `onToggleRow` but never uses it

**File:** `web/src/components/lists/ResponsiveTable.tsx:95-96` (prop), `:145-169` (destructuring omits it)
**Issue:** The documented "kept for the caller's wiring" prop is accepted and ignored, which invites callers to think the table calls it.
**Fix:** Remove it from `ResponsiveTableProps` (the caller owns the toggle, as the comment on `detail` says).

*Lane: Shared web (web/ outside modules/admin, .gitleaks.toml) (lane id IN-02).*

### IN-19: Modal Close button and Cancel look live while `loading`

**File:** `web/src/components/overlays/Modal.tsx:136-140, 249-253`
**Issue:** While `loading` (a save or delete in flight), Esc, the scrim and the Close button do nothing, but the Close button has no `aria-disabled`, so a screen-reader or keyboard user presses it with no feedback and no announcement.
**Fix:** Add `aria-disabled={loading || undefined}` to the Close button (keep it focusable, as `Button` does for WEB-09).

*Lane: Shared web (web/ outside modules/admin, .gitleaks.toml) (lane id IN-03).*

### IN-20: "Server text never reaches the screen" is no longer literally true

**File:** `web/src/utils/describeHttpError.ts:1-4`, `web/src/lib/forms/serverFieldMessage.ts:5-11`
**Issue:** The header comment promises that only the `traceId` is shown. Field validation messages from the server are shown under the fields through `serverFieldMessage` (rendered as text, so there is no XSS, and plain-English field messages are by design). The guarantee now depends on every FluentValidation message being safe to display, which nothing in this lane enforces. Separately, `find` returns the first case-insensitive key match even when its array is empty, so `{ Email: [], email: ['Taken.'] }` yields `undefined`.
**Fix:** Reword the comment to say field messages are the one exception, and use `Object.entries(errors).flatMap(([k, v]) => (k.toLowerCase() === wanted ? v : []))[0]`.

*Lane: Shared web (web/ outside modules/admin, .gitleaks.toml) (lane id IN-04).*

### IN-21: Fixed sleeps in e2e specs

**File:** `web/e2e/keyboard.spec.ts:234` (`waitForTimeout(5000)`), `web/e2e/motion.spec.ts:67, 105, 150, 224, 236, 372, 382, 446, 467`
**Issue:** Real-time sleeps slow every run (five projects) and are timing-fragile on a loaded shared machine. The 5 s sleep exists to prove a toast does not auto-dismiss, which Playwright's clock can do deterministically.
**Fix:** Use `page.clock.install()` and `page.clock.fastForward(5000)` for the toast, and wait on `data-state` / `animationend` for the motion cases.

*Lane: Shared web (web/ outside modules/admin, .gitleaks.toml) (lane id IN-05).*

### IN-22: `MobileNavDrawer` closes on any anchor click, including modified ones

**File:** `web/src/components/navigation/MobileNavDrawer.tsx:102-107`
**Issue:** `onDocumentClick` closes the drawer for any click on an `a[href]` inside the panel, including Ctrl/Cmd/Shift-click (which opens a new tab and does not navigate here) and a click whose default was prevented. The drawer vanishes although the page did not change.
**Fix:** Skip when `event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey`.

*Lane: Shared web (web/ outside modules/admin, .gitleaks.toml) (lane id IN-06).*

### IN-23: Production defaults that look like real data, and a needless tab stop

**File:** `web/src/components/navigation/Topbar.tsx:118-119`; `web/src/components/lists/ResponsiveTable.tsx:209-214`
**Issue:** (a) `Topbar` defaults `user` to "Carmen Reyes" and `role` to `'manager'`. The real shell always passes both, but a forgotten prop would show a real-looking name with the more privileged role (display only, the server enforces roles). `Sidebar` defaults to the safer `'admin'`. (b) The table frame always has `role="region"` and `tabIndex={0}`, even on phones where it does not scroll (`pg-phone:overflow-visible`) and on desktop when the table fits, so it adds an unneeded tab stop and region landmark.
**Fix:** Make `user` and `role` required on `Topbar` (the showcase can pass them). For the frame, keep `tabIndex` only where it overflows (a `ResizeObserver` check), or accept it as a documented trade-off.

*Lane: Shared web (web/ outside modules/admin, .gitleaks.toml) (lane id IN-07).*

### IN-24: Gitleaks allowlists are file-wide for the generic key rule; temporary-password entropy is modest

**File:** `.gitleaks.toml:9-40`; `web/src/utils/temporaryPassword.ts:1-6`
**Issue:** (a) The allowlists are tight (exact paths, one rule), which is good. The residual risk is that a genuine high-entropy value pasted into any of those 19 files is invisible to `generic-api-key`. Gitleaks can scope by `regexes` or `stopwords` instead of by file. (b) The suggested temporary password has 40 x 40 x 10,000 = 16 million values (about 24 bits). With the 2FA email code, lockout and rate limits, and a forced change at first sign-in, this is acceptable and documented, but the value stays valid until first use. Three words would raise it to about 37 bits at little cost to readability.
**Fix:** (a) Prefer `stopwords = ['Staff#2027', ...]` or a `regexes` allowlist for the fake values. (b) Optional: a third word, or document the maximum lifetime of an unused temporary password.

---

_Reviewed: 2026-10-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

*Lane: Shared web (web/ outside modules/admin, .gitleaks.toml) (lane id IN-08).*

## Id map

| Id | Lane | Id in lane |
|----|------|------------|
| WR-01 | Backend source (src/, tools/) | WR-01 |
| WR-02 | Backend source (src/, tools/) | WR-02 |
| WR-03 | Backend source (src/, tools/) | WR-03 |
| WR-04 | Backend source (src/, tools/) | WR-04 |
| WR-05 | Backend source (src/, tools/) | WR-05 |
| WR-06 | Backend source (src/, tools/) | WR-06 |
| IN-01 | Backend source (src/, tools/) | IN-01 |
| IN-02 | Backend source (src/, tools/) | IN-02 |
| IN-03 | Backend source (src/, tools/) | IN-03 |
| IN-04 | Backend source (src/, tools/) | IN-04 |
| WR-07 | Backend tests (tests/) | WR-01 |
| WR-08 | Backend tests (tests/) | WR-02 |
| WR-09 | Backend tests (tests/) | WR-03 |
| WR-10 | Backend tests (tests/) | WR-04 |
| WR-11 | Backend tests (tests/) | WR-05 |
| WR-12 | Backend tests (tests/) | WR-06 |
| WR-13 | Backend tests (tests/) | WR-07 |
| WR-14 | Backend tests (tests/) | WR-08 |
| IN-05 | Backend tests (tests/) | IN-01 |
| IN-06 | Backend tests (tests/) | IN-02 |
| IN-07 | Backend tests (tests/) | IN-03 |
| IN-08 | Backend tests (tests/) | IN-04 |
| IN-09 | Backend tests (tests/) | IN-05 |
| IN-10 | Backend tests (tests/) | IN-06 |
| IN-11 | Backend tests (tests/) | IN-07 |
| IN-12 | Backend tests (tests/) | IN-08 |
| CR-01 | Web admin module (web/src/modules/admin) | CR-01 |
| WR-15 | Web admin module (web/src/modules/admin) | WR-01 |
| WR-16 | Web admin module (web/src/modules/admin) | WR-02 |
| WR-17 | Web admin module (web/src/modules/admin) | WR-03 |
| WR-18 | Web admin module (web/src/modules/admin) | WR-04 |
| IN-13 | Web admin module (web/src/modules/admin) | IN-01 |
| IN-14 | Web admin module (web/src/modules/admin) | IN-02 |
| IN-15 | Web admin module (web/src/modules/admin) | IN-03 |
| IN-16 | Web admin module (web/src/modules/admin) | IN-04 |
| WR-19 | Shared web (web/ outside modules/admin, .gitleaks.toml) | WR-01 |
| WR-20 | Shared web (web/ outside modules/admin, .gitleaks.toml) | WR-02 |
| WR-21 | Shared web (web/ outside modules/admin, .gitleaks.toml) | WR-03 |
| IN-17 | Shared web (web/ outside modules/admin, .gitleaks.toml) | IN-01 |
| IN-18 | Shared web (web/ outside modules/admin, .gitleaks.toml) | IN-02 |
| IN-19 | Shared web (web/ outside modules/admin, .gitleaks.toml) | IN-03 |
| IN-20 | Shared web (web/ outside modules/admin, .gitleaks.toml) | IN-04 |
| IN-21 | Shared web (web/ outside modules/admin, .gitleaks.toml) | IN-05 |
| IN-22 | Shared web (web/ outside modules/admin, .gitleaks.toml) | IN-06 |
| IN-23 | Shared web (web/ outside modules/admin, .gitleaks.toml) | IN-07 |
| IN-24 | Shared web (web/ outside modules/admin, .gitleaks.toml) | IN-08 |
