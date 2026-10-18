---
phase: 05-profile-user-management
plan: 10
subsystem: auth
tags: [aspnet-identity, sign-in, refresh, password-reset, invite, audit, testing-fixture, tdd]
created: 2026-10-17T22:25:00-05:00
updated: 2026-10-17T22:25:00-05:00

requires:
  - phase: 05-profile-user-management (plan 05-05)
    provides: UserAccount.IsBlocked / IsManagerLocked / IsDeleted, AccountStateFixtures, audit details manager-locked and deleted
provides:
  - One IsBlocked rule on every remaining auth path (code step, resend, refresh, must-change step, reset-link and invite-link lookups)
  - Forgot-password for a Manager-locked account sends nothing, answers the neutral 202 and audits detail manager-locked (D-41 Q5)
  - Deleted account in forgot-password reads as an unknown address
  - Refresh of a blocked account revokes the session and records auth.session-revoked (USER-05 support)
  - Testing-only staff fixture state manager-locked (server and e2e StaffState)
affects: [05-11, 05-19, 05-21, roster, e2e specs showing the Locked status]

plan_head_before: f10c205e65ef5983bf0f7ae17a888d0838c0339c
plan_head_after: f7ef67846930ae9cd87feb179a4832add325f0d7

actuals:
  tokens: 9000
  tasks: 3
  commits: 6

tech-stack:
  added: []
  patterns:
    - "Every auth path asks UserAccount.IsBlocked; a failed-password lockout (LockoutEnd) stays a separate temporary refusal"
    - "Table-driven integration theory over {deactivated, manager-locked, deleted} for each endpoint after sign-in"

key-files:
  created: []
  modified:
    - src/Csps.Application/Auth/VerifyCodeHandler.cs
    - src/Csps.Application/Auth/ResendCodeHandler.cs
    - src/Csps.Application/Auth/RefreshHandler.cs
    - src/Csps.Application/Auth/PendingPasswordChangeLookup.cs
    - src/Csps.Application/Auth/ForgotPasswordHandler.cs
    - src/Csps.Application/Auth/ResetLinkLookup.cs
    - src/Csps.Application/Auth/InviteLinkLookup.cs
    - src/Csps.Application/Auth/ResetPasswordHandler.cs
    - src/Csps.Infrastructure/Identity/TestingAccountActivation.cs
    - src/Csps.Server/Controllers/TestingFixturesController.cs
    - web/e2e/testing-api.ts
    - tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/PasswordResetTests.cs
    - tests/Csps.Server.IntegrationTests/Testing/TestingFixturesEndpointTests.cs
    - tests/Csps.Application.UnitTests/Auth/ForgotPasswordHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs

key-decisions:
  - "A deleted account in forgot-password is answered like an unknown address (nothing sent, audit unknown-account, no target), not with the deactivated notice"
  - "Manager lock is checked before the deactivated notice, so a locked and deactivated account sends nothing"
  - "ForgotPasswordHandler keeps its IsActive reads: they pick link versus notice, not whether the account may sign in"

patterns-established:
  - "Blocked-state theory: ApplyBlockAsync(factory, id, block) in InactiveAccountTests applies any of the three blocks"

requirements-completed: [USER-03, USER-05]

coverage:
  - id: D1
    description: "A Manager-locked, deactivated or deleted person cannot finish the code step, resend a code, or check/set a new password; nothing is issued and no extra email is sent"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs#ABlockedAccountCannotFinishTheCodeStep"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs#ABlockedAccountCannotAskForAnotherCode"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs#ABlockedAccountCannotCheckOrSetANewPassword"
        status: pass
    human_judgment: false
  - id: D2
    description: "A refresh for a blocked account revokes the session and records one auth.session-revoked, so a Manager lock or delete ends open sessions"
    requirement: "USER-05"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs#ABlockedAccountLosesItsSessionAtTheNextRefresh"
        status: pass
    human_judgment: false
  - id: D3
    description: "A reset or invite link of an account that is later Manager-locked or deleted reads as the same invalid-link 404, and a reset never lifts a Manager lock, deactivation or delete (D-17)"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/PasswordResetTests.cs#ALinkIssuedBeforeAManagerLockOrDeleteReadsAsInvalidAndLiftsNothing"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/InactiveAccountTests.cs#ABlockedInvitedAccountsLinkIsTheSameInvalidInvite404"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs#ClearingTheLockoutNeverLiftsAManagerLockADeactivationOrADelete"
        status: pass
    human_judgment: false
  - id: D4
    description: "Forgot-password for a Manager-locked account sends nothing, answers the neutral 202 and audits manager-locked (D-41 Q5)"
    requirement: "USER-03"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/ForgotPasswordHandlerTests.cs#AManagerLockedAccountGetsNothingAndAnAuditEntryWithItsReason"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/PasswordResetTests.cs#ForgotPasswordForAManagerLockedAccountIsTheNeutral202SendsNothingAndIsAudited"
        status: pass
    human_judgment: false
  - id: D5
    description: "Testing-only POST /api/testing/staff accepts state manager-locked (Debug builds only) and e2e StaffState lists it"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Testing/TestingFixturesEndpointTests.cs#ManagerLockedStateCreatesAnAccountWithTheLockSetThatCannotSignIn"
        status: pass
      - kind: integration
        ref: "tests/Csps.ArchitectureTests ReleaseHasNoEmailSinkTests"
        status: pass
    human_judgment: false

duration: 16min
completed: 2026-10-17
status: complete
---

# Phase 5 Plan 10: IsBlocked on Every Auth Path Summary

**The IsBlocked rule from 05-05 now guards the code step, resend, refresh, must-change step, reset and invite links, so a Manager lock or soft delete shuts a person out everywhere a deactivation did; forgot-password stays neutral for a locked account, and a reset never lifts a Manager lock.**

## Performance

- **Duration:** about 16 min
- **Started:** 2026-10-17T22:06:20-05:00
- **Completed:** 2026-10-17T22:22:00-05:00
- **Tasks:** 3 (a tracer and two auto tasks, all TDD)
- **Files modified:** 16 (no files created; 325 lines added, 30 removed)

## Accomplishments

- VerifyCodeHandler, ResendCodeHandler, RefreshHandler and PendingPasswordChangeLookup read `IsBlocked` instead of `IsActive`; the `LockoutEnd` checks stay, so a failed-password lockout is still a temporary refusal. A refresh for a blocked account revokes the session (reason AccountInactive) and records one `auth.session-revoked`.
- ResetLinkLookup and InviteLinkLookup require `!IsBlocked`, so a link issued before a Manager lock or delete reads as the same invalid-link 404 and nothing is saved.
- ForgotPasswordHandler: a Manager-locked account queues nothing, takes the same neutral 202 under the same response floor and records `auth.password-reset-requested` with detail `manager-locked`; a deleted account is answered like an unknown address. The deactivated notice is unchanged.
- ResetPasswordHandler carries a one-line D-17 comment; a new infrastructure test pins that `ClearLockoutAsync` leaves IsActive, ManagerLockedAtUtc and DeletedAtUtc alone.
- Testing fixture: `manager-locked` is an allowed state (controller message, `TestingAccountActivation.ManagerLockAsync` using the injected `TimeProvider`, e2e `StaffState`). It stays inside `#if CSPS_TESTING`.

## Task Commits

1. **Task 1 (tracer): blocked after sign-in**
   - RED `f8affe9` test(05-10): blocked accounts are refused after sign-in (RED)
   - GREEN `406ffb9` feat(05-10): code step, refresh and must-change honour the Manager lock and delete (D-16)
2. **Task 2: link flows and forgot-password**
   - RED `7bb4111` test(05-10): link flows and resets respect the Manager lock (RED)
   - GREEN `598a805` feat(05-10): forgot, reset and invite links honour the Manager lock and delete (D-17, D-41 Q5)
3. **Task 3: Testing fixture state**
   - RED `cb7b6b6` test(05-10): manager-locked Testing fixture (RED)
   - GREEN `f7ef678` feat(05-10): Testing fixture state manager-locked

**Plan metadata:** the docs(05-10) commit that carries this file, STATE.md, ROADMAP.md and REQUIREMENTS.md.

## TDD Gate Compliance

RED and GREEN commits exist for all three tasks, in order; no REFACTOR commit was needed.

- **Task 1 RED (`f8affe9`):** the three-state theories failed for manager-locked and deleted (8 failures: refresh answered 200 instead of 401, verify and resend and set-new-password did not answer auth.ticket-expired); the deactivated rows passed, as intended. Failure was on the planned status assertion, not a compile or fixture fault.
- **Task 2 RED (`7bb4111`):** 3 forgot-password unit cases failed (manager-locked, manager-locked-deactivated, deleted), and 5 integration cases failed (reset link after lock, after delete, forgot-password for a locked account, invite for locked and deleted). The deactivated invite row passed. `UserAccountsTests.ClearingTheLockoutNeverLiftsAManagerLockADeactivationOrADelete` passed already: it is a regression pin for the D-17 prohibition, not a RED driver.
- **Task 3 RED (`cb7b6b6`):** the 201 expectation failed (400 returned) and the allowed-states message did not list manager-locked.
- **Machine validation:** the runner (xunit v3 on Microsoft Testing Platform) emits no format `gsd_run check tdd-red-evidence` supports, so `RED_EVIDENCE_OK` could not be produced; the semantic assessment above comes from the real run output and nothing was fabricated.

## Decisions Made

- A deleted account asking for a reset is treated as an unknown address (audit `unknown-account`, no target, no email). Sending the deactivated notice to a deleted person would say something that is no longer true, and the plan fixed only the manager-locked branch.
- The Manager-lock branch sits before the deactivated notice, so a locked and deactivated account also sends nothing; this matches the sign-in detail order (deleted, manager-locked, deactivated).
- ForgotPasswordHandler still reads `IsActive` and `EmailConfirmed` on purpose: they choose between link, notice and unknown, they are not the "may sign in" decision. The remaining `IsActive` hits under `src/Csps.Application/Auth` are session checks and these branches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Deleted accounts in forgot-password**
- **Found during:** Task 2
- **Issue:** The plan branches only on IsManagerLocked. A soft-deleted account that is still marked active would have been sent a live reset link email (unusable, but a leak of "this address exists" and a wasted link).
- **Fix:** `account.IsDeleted` joins the unknown-address branch; unit case `deleted` added.
- **Files modified:** src/Csps.Application/Auth/ForgotPasswordHandler.cs, tests/Csps.Application.UnitTests/Auth/ForgotPasswordHandlerTests.cs
- **Verification:** ForgotPasswordHandlerTests pass.
- **Committed in:** 7bb4111 (test), 598a805 (fix)

**2. [Rule 3 - Blocking] TestingAccountActivation needed a TimeProvider**
- **Found during:** Task 3
- **Issue:** The plan says ManagerLockAsync stamps from "the injected TimeProvider", but the class took only UserManager.
- **Fix:** Added a `TimeProvider` constructor parameter; it is registered by the host and the class is already scoped in `IdentityRegistration`.
- **Files modified:** src/Csps.Infrastructure/Identity/TestingAccountActivation.cs
- **Verification:** TestingFixturesEndpointTests 13/13, ReleaseHasNoEmailSinkTests 2/2.
- **Committed in:** f7ef678

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** Both are small and inside the plan's files; no scope creep. `UserAccountsTests.cs` (Infrastructure integration) was touched for the D-17 pin and is not in the plan's file list.

## Issues Encountered

- The first RED run of the infrastructure pin hit the banned `DateTimeOffset.UtcNow` analyzer (RS0030); switched to `TimeProvider.System.GetUtcNow()` before the commit.
- A broad `grep -r` over `web/` (node_modules) timed out once; replaced by targeted searches.

## Verification Results

- `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- Server integration 709/709 (includes the Auth namespace 191/191), Application unit 381/381, Architecture 217/217, Infrastructure `UserAccountsTests` 23/23.
- `prettier --check` and `eslint` on `web/e2e/testing-api.ts`: clean.
- Acceptance greps: IsBlocked in each of VerifyCode, ResendCode, Refresh, PendingPasswordChange, ResetLink and InviteLink lookups; IsManagerLocked in ForgotPasswordHandler; manager-locked in InactiveAccountTests, TestingFixturesController and testing-api.ts.
- gitleaks on every staged diff: no leaks.

## User Setup Required

None. No migration, package or configuration change.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or file access; the Testing state is compiled out of Release (ReleaseHasNoEmailSinkTests green).

## Self-Check: PASSED

- Modified files exist; no files were created apart from this summary.
- Commits `f8affe9`, `406ffb9`, `7bb4111`, `598a805`, `cb7b6b6`, `f7ef678` are ancestors of HEAD.

## Next Phase Readiness

- Later roster plans can lock or delete a user and rely on every auth path refusing them; their own tests should reuse `InactiveAccountTests.ApplyBlockAsync`'s three-state pattern.
- E2E specs can call `createStaff(request, role, 'manager-locked')` to show the Locked status.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-17*
