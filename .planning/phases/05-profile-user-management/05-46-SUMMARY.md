---
phase: 05-profile-user-management
plan: 46
subsystem: auth
tags: [gap-closure, wr-03, d-49, email-confirmation, tdd, tracer, security]
created: "2026-10-19T03:15:00-05:00"
updated: "2026-10-19T03:15:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-VERIFICATION.md gap 3 (WR-03, partial); owner ruling D-49; IUserAccounts.ConfirmEmailAsync"
provides:
  - "An account created with a Manager-set temporary password keeps EmailConfirmed false (T-05-112)"
  - "SignInHandler lets an unconfirmed account holding a temporary password reach the code step; every other unconfirmed account keeps the one generic 401 (T-05-113)"
  - "VerifyCodeHandler confirms the address on the first correct emailed code; a wrong, used-up or expired code never does"
affects: [05-VERIFICATION gap 3, 05-47]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4
plan_head_before: 902d8da2b6608465c00e2652480a15119707c2e3
plan_head_after: d087ec5bac0b2cf5a42b0988abb2af7a807744f9

tech-stack:
  added: []
  patterns:
    - "NewUserAccount.KeepEmailUnconfirmed: a created account can hold a password and still start with an unproved address"

key-files:
  created: []
  modified:
    - src/Csps.Application/Users/CreateUserHandler.cs
    - src/Csps.Application/Auth/SignInHandler.cs
    - src/Csps.Application/Auth/VerifyCodeHandler.cs
    - src/Csps.Application/Auth/UserAccount.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs
    - tests/Csps.Application.UnitTests/Users/CreateUserHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/SignInHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/VerifyCodeHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs
    - docs/api/users.md

key-decisions:
  - "The temporary-password account is created with its password and a KeepEmailUnconfirmed flag on NewUserAccount, not by creating it passwordless and calling SetPasswordAsync: the extra Identity update after the insert deadlocked the 20-run same-email race test (TwoCreatesWithTheSameEmail...) every time, while the flag keeps the statement sequence of the old flow"

requirements-completed: [USER-02]

coverage:
  - id: D1
    description: "A temporary-password account is unconfirmed after create and after a wrong code, confirmed after the correct code, and the person signs in again with the new password"
    requirement: "USER-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/CreateUserEndpointTests.cs#ATemporaryPasswordAddressStaysUnprovedUntilTheFirstCorrectCode"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/CreateUserHandlerTests.cs#ATemporaryPasswordCreatesTheAccountWithItMarksItMustChangeAndSendsNoEmail"
        status: pass
    human_judgment: false
  - id: D2
    description: "Sign-in: an unconfirmed temporary-password account with the right password gets a challenge and the code email; unconfirmed accounts with no reason or with Breach get the generic 401 (detail unconfirmed, one hash check, full floor); a wrong password is counted"
    requirement: "USER-02"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/SignInHandlerTests.cs#AnUnconfirmedAccountWithATemporaryPasswordAndTheRightPasswordStartsAChallengeAndQueuesTheCodeEmail"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/SignInHandlerTests.cs#EveryFailureIsAuditedIndependentlyWithItsReason"
        status: pass
    human_judgment: false
  - id: D3
    description: "A correct code confirms the address once, before the hand-over; a confirmed account's code, and a wrong, used-up or expired code, never call ConfirmEmailAsync"
    requirement: "USER-02"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/VerifyCodeHandlerTests.cs#ACorrectCodeOnAnUnconfirmedAccountConfirmsTheAddressOnceBeforeTheHandOver"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/VerifyCodeHandlerTests.cs#AWrongUsedUpOrExpiredCodeNeverConfirmsTheAddress"
        status: pass
    human_judgment: false
  - id: D4
    description: "The Add User flow is unchanged in the browser and the invitation and bootstrap routes are unaffected"
    requirement: "USER-02"
    verification:
      - kind: e2e
        ref: "npm --prefix web run e2e -- --grep @users-add --project chromium (3 passed)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/InviteTests.cs; tests/Csps.Infrastructure.IntegrationTests/Seeding/BootstrapManagerTests.cs"
        status: pass
    human_judgment: false
---

# Phase 5 Plan 46: A temporary-password address stays unproved until the first correct code Summary

**An account a Manager creates with a temporary password now starts with EmailConfirmed false; sign-in still reaches the code step for it, and the first correct emailed code confirms the address (D-49, WR-03).**

## Performance

- **Duration:** about 25 min
- **Completed:** 2026-10-19
- **Tasks:** 2 (1 tracer, 1 auto)
- **Files modified:** 11

## Accomplishments

- WR-03 first half closed: a mistyped address on the temporary-password route no longer gives its owner a reset path. Reset links and forgot-password already refuse unconfirmed accounts (plan 05-47 pins that), and the address only counts as confirmed after someone enters a code emailed to it.
- `CreateUserHandler` marks the temporary-password account `KeepEmailUnconfirmed`. The password is still hashed by the account port and goes nowhere else (D-14). The invitation route is unchanged.
- `SignInHandler` refuses an unconfirmed account only when it does not hold a Manager-set temporary password. The one real hash check, the response floor, the account-lockout counting and the generic 401 are untouched for every other branch.
- `VerifyCodeHandler.AcceptAsync` calls `ConfirmEmailAsync` first (Identity first) when the account is unconfirmed, before the set-new-password hand-over or the session start. `auth.two-factor-verified` already records the moment; no new audit code.
- `docs/api/users.md`: the `POST /users` row says the address stays unconfirmed until the first correct code.
- Tracer verified end-to-end before Task 2: new journey test (create, unconfirmed, sign in, wrong code 400 `auth.code-wrong` still unconfirmed, correct code `set-new-password` reason `temporary` and confirmed, new password 200, sign in again 200).

## Task Commits

1. **Task 1 RED:** `24b270b` test(05-46): a temporary-password account is born confirmed (RED, D-49). The target test failed on `IsConfirmedAsync(id)` should be False but was True.
2. **Task 1 GREEN:** `31dafc2` feat(05-46): the first correct sign-in code confirms a temporary-password address (D-49)
3. **Task 2:** `f3981d9` test(05-46): D-49 branch units (characterization)
4. **Docs:** `d087ec5` docs(05-46): a temporary-password address stays unconfirmed until the first correct code

## Characterization tests (passed at once)

Task 2's unit tests passed on first run against the Task 1 handlers, so they were committed as characterization tests: the new cases in `CreateUserHandlerTests`, `SignInHandlerTests` (`unconfirmed-breach` added to every branch theory; two new Temporary cases), `VerifyCodeHandlerTests` (confirm once and before the hand-over, never for a confirmed account, never for wrong, used-up or expired codes) and `UserAccountsTests.APasswordAccountKeptUnconfirmedHoldsTheHashButNotTheConfirmation`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Create-without-password then SetPasswordAsync deadlocks the same-email race**
- **Found during:** Task 1 GREEN
- **Issue:** The plan said to create the temporary-password account with a null password and then call `SetPasswordAsync`. With that sequence `TwoCreatesWithTheSameEmailSentTogetherGiveOneAccountAndOneEmailFieldErrorEveryTime` (invitation and temporary-password create at once, 20 runs) failed 3 of 3 times with a 500: SQL Server picked the other create's insert as deadlock victim (error 1205), and the savepoint rollback then failed with "no corresponding BEGIN TRANSACTION". The same test passed 3 of 3 on the baseline.
- **Fix:** `NewUserAccount` gained an optional `KeepEmailUnconfirmed` flag; `UserAccounts.CreateAsync` sets `EmailConfirmed = Password is not null && !KeepEmailUnconfirmed`. The handler creates with the password and the flag, then calls `SetMustChangePasswordAsync` as before, so the statement sequence matches the old flow. No schema change, no migration; existing callers (fixtures, bootstrap, tests) are unaffected by the default.
- **Consequence for the plan's acceptance grep:** `grep -c SetPasswordAsync src/Csps.Application/Users/CreateUserHandler.cs` is 0, not at least 1. The behavior it stood for (address unconfirmed until the first correct code, password hashed and never leaked) is proved by the integration and unit tests.
- **Files modified:** `src/Csps.Application/Auth/UserAccount.cs`, `src/Csps.Infrastructure/Identity/UserAccounts.cs`, `src/Csps.Application/Users/CreateUserHandler.cs`
- **Verification:** race test passes 3 of 3 after the change; `CreateUserEndpointTests` 18 passed.
- **Commit:** `31dafc2`

**Total deviations:** 1 auto-fixed (1 bug). **Impact:** none on scope; the port gained one optional record member.

## Verification

- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*CreateUserEndpointTests"`: 18 passed. `*InviteTests`: 16 passed. `*SignInEndpointTests` 14, `*InactiveAccountTests` 30, `*ForgotPasswordTests` 12: passed.
- `dotnet test --project tests/Csps.Application.UnitTests --filter-class` `*CreateUserHandlerTests` (30), `*SignInHandlerTests` (70), `*VerifyCodeHandlerTests` (35): all passed.
- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests` `*BootstrapManagerTests` (54), `*UserAccountsTests` (26): passed.
- Full `Csps.Server.IntegrationTests` run: 1040 passed, 0 failed, 0 skipped. `Csps.ArchitectureTests`: 217 passed.
- `Invoke-CoverageGate.ps1`: Csps.Domain 100% line and branch; Csps.Application line 99.7% (2634/2641), branch 98.1%; PASS.
- `npm --prefix web run e2e -- --grep @users-add --project chromium`: 3 passed (invitation, temporary password with copy-once panel and forced replacement, 320 px phone).
- Acceptance greps: `PasswordChangeReason.Temporary` in `SignInHandler.cs` x1, `ConfirmEmailAsync` in `VerifyCodeHandler.cs` x1; the `SetPasswordAsync` grep is the deviation above.
- Preflight before the DB-backed and E2E runs: ports 5180, 5115, 7028, 5199 free, no foreign dev processes. No package, project file or migration changes. No `BetsLLC_*` database touched.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema; T-05-112 and T-05-113 are mitigated as planned.

## Self-Check: PASSED

- Files exist: `05-46-SUMMARY.md` (this file), all modified source and test files above.
- Commits `24b270b`, `31dafc2`, `f3981d9`, `d087ec5` are ancestors of HEAD.
- TDD gate: RED `test(05-46)` precedes GREEN `feat(05-46)`.
