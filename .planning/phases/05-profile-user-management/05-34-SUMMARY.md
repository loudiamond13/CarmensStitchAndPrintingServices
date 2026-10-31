---
phase: 05-profile-user-management
plan: 34
subsystem: auth
tags: [review-carry-over, in-01, in-03, in-05, in-06, tdd, breach-check, tostring, user-06, user-07]
created: "2026-10-18T11:44:00-05:00"
updated: "2026-10-18T11:44:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-29 (last Phase 5 backend change before the Phase 4 review carry-overs run)"
provides:
  - "Invite acceptance and password reset run the link lookup and the breach check before the database transaction (IN-05)"
  - "IUserAccounts.IsLockedOutAsync removed (IN-03)"
  - "UserAccount and every AuthEmail print their type name only (IN-06)"
  - "PasswordRules awaits with ConfigureAwait(false) (IN-01)"
affects: [05-37, 05-43]

actuals:
  tokens: 9000
  tasks: 2
  commits: 4
plan_head_before: 9cfbc3c4d3eb200aa8d0344c676d63097815e222
plan_head_after: ae285194209f5f09f14346bfc03e6ab0817567d9

tech-stack:
  added: []
  patterns:
    - "Lookup and outbound HTTP check first, then the transaction re-reads the row; its row version guards a link spent meanwhile; ConflictRetry repeats only the transaction"
    - "A sealed ToString on the abstract AuthEmail record stops derived records generating a printing ToString"

key-files:
  created: []
  modified:
    - src/Csps.Application/Auth/AcceptInviteHandler.cs
    - src/Csps.Application/Auth/ResetPasswordHandler.cs
    - src/Csps.Application/Auth/PasswordRules.cs
    - src/Csps.Application/Auth/SignInHandler.cs
    - src/Csps.Application/Auth/UserAccount.cs
    - src/Csps.Application/Email/AuthEmail.cs
    - src/Csps.Application/Ports/IUserAccounts.cs
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - docs/api/auth.md
    - tests/Csps.Application.UnitTests/Auth/AcceptInviteHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/ResetPasswordHandlerTests.cs
    - tests/Csps.Application.UnitTests/Auth/AuthTestDoubles.cs
    - tests/Csps.Application.UnitTests/Email/AuthEmailTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs

key-decisions:
  - "The breach verdict is computed once outside the transaction and reused by ConflictRetry's second pass, so a retry never repeats the HTTP call"
  - "ToString is sealed on the abstract AuthEmail and the five per-record overrides were removed; GetType().Name gives the same text"
  - "The fake unit of work gained an InTransaction flag so tests can prove which calls happen outside a transaction"

requirements-completed: [USER-06, USER-07]

coverage:
  - id: D1
    description: "A reset or invite acceptance runs the link lookup and breach check before the transaction, then re-reads the link inside it (IN-05)"
    requirement: USER-07
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/ResetPasswordHandlerTests.cs#TheBreachCheckRunsAfterTheLookupAndBeforeTheTransactionThenTheLinkIsReadAgainInside"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/AcceptInviteHandlerTests.cs#TheBreachCheckRunsAfterTheLookupAndBeforeTheTransactionThenTheInviteIsReadAgainInside"
        status: pass
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class *PasswordResetTests"
        status: pass
    human_judgment: false
  - id: D2
    description: "A link spent during the breach check answers the invalid-link result, and a conflict retry does not call the breach service again"
    requirement: USER-07
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/ResetPasswordHandlerTests.cs#ALinkSpentDuringTheBreachCheckIsTheInvalidAnswerAndChangesNothingMore"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/AcceptInviteHandlerTests.cs#ARetryAfterALostRaceDoesNotCallTheBreachServiceAgain"
        status: pass
    human_judgment: false
  - id: D3
    description: "UserAccount and every AuthEmail print only their type name (IN-06)"
    requirement: USER-06
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Email/AuthEmailTests.cs#EveryAuthEmailPrintsOnlyItsTypeNameNeverAnAddressOrName"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Email/AuthEmailTests.cs#AnAccountPrintsOnlyItsTypeNameNeverAnAddressOrName"
        status: pass
    human_judgment: false
  - id: D4
    description: "Dead IsLockedOutAsync removed, ConfigureAwait added, RecheckBreachAsync saves on both branches, PasswordChanged summary reworded (IN-01, IN-03, IN-06)"
    verification:
      - kind: other
        ref: "dotnet test --solution Csps.slnx (3235 tests, 0 failed) and tools/scripts/Invoke-CoverageGate.ps1 (passed)"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-18
---

# Phase 5 Plan 34: Phase 4 review carry-overs in the auth handlers Summary

**Reset and invite acceptance now check the password against the breach service before any database transaction opens, the dead `IsLockedOutAsync` port member is gone, and accounts and emails never print an address or name.**

## Performance

- **Duration:** 25 min
- **Started:** 2026-10-18T11:20:00-05:00
- **Completed:** 2026-10-18T11:44:00-05:00
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments

- IN-05: `AcceptInviteHandler` and `ResetPasswordHandler` look the link up and run `PasswordRules.CheckAsync` first, then open the transaction and read the link again. A slow or down breach service no longer holds a transaction or pooled connection, and the conflict retry reuses the verdict instead of calling HIBP again.
- IN-03: `IsLockedOutAsync` removed from `IUserAccounts` and `UserAccounts`; the six Infrastructure integration test uses read `LockoutEnd` through `FindByIdAsync`. The two transaction lambdas in `SignInHandler` return a constant, and `RecheckBreachAsync` saves on both branches.
- IN-06: `UserAccount` and the abstract `AuthEmail` print their type name; the `PasswordChanged` summary (code and `docs/api/auth.md`) now names the must-change step and the profile change.
- IN-01: `PasswordRules.CheckAsync` awaits with `ConfigureAwait(false)`.

## Review note outcomes (for 05-37)

| Note | Outcome |
|------|---------|
| IN-01 | Fixed: `ConfigureAwait(false)` on the breach call in `PasswordRules.CheckAsync`. |
| IN-03 | Fixed: `IsLockedOutAsync` removed from the port and implementation; discarded lambda results are the constant `true`; `RecheckBreachAsync` calls `SaveChangesAsync` on both branches. |
| IN-05 | Fixed test-first: in `AcceptInviteHandler.cs` `CheckAsync(` is on line 68 and `InTransactionAsync(` on line 86; in `ResetPasswordHandler.cs` they are on lines 74 and 88. |
| IN-06 | Fixed: `ToString` returns the type name on `UserAccount` and (sealed) on `AuthEmail`; the `PasswordChanged` summary is reworded. |

IN-02 and IN-04 are in 05-43.

## TDD Gate Compliance

- **RED 1** (`b608275`): six new cases in `AcceptInviteHandlerTests` and `ResetPasswordHandlerTests`. Two ordering cases failed on the `["lookup:outside","breach:outside","lookup:inside"]` assertion (observed `["lookup:inside","breach:inside"]`); two spent-during-check cases failed because the old order threw "The token cannot be used" instead of returning the invalid answer; two retry cases failed on `Received(1)` of the breach call. Semantic assessment: each named target executed and failed on the planned behavior, no setup or compile faults. The `gsd_run check tdd-red-evidence` classifier was not run because it has no adapter for the xunit MTP report format; evidence is the console output of `dotnet test`.
- **GREEN 1** (`8b9b8ff`): handlers reordered. The whole Application suite (871), `PasswordResetTests` (20) and `InviteTests` (16) pass.
- **RED 2** (`00d2b71`): `EveryAuthEmailPrintsOnlyItsTypeNameNeverAnAddressOrName` and `AnAccountPrintsOnlyItsTypeNameNeverAnAddressOrName` failed on the generated record text.
- **GREEN 2** (`ae28519`): ToString overrides plus the dead-member and constant changes. No separate refactor commit; the IN-03 and IN-01 changes are behaviour-preserving and went into the GREEN commit as the plan specified.

Tracer gate: the Task 1 verification was re-run end to end after the GREEN commit (all three automated commands passed) before Task 2 started.

## Task Commits

1. **Task 1: Breach check before the transaction (IN-05)** - `b608275` (test, RED), `8b9b8ff` (fix)
2. **Task 2: Dead members, safe ToString, accurate summaries (IN-01, IN-03, IN-06)** - `00d2b71` (test, RED), `ae28519` (fix)

**Plan metadata:** recorded in the following docs commit.

## Files Created/Modified

- `src/Csps.Application/Auth/AcceptInviteHandler.cs`, `ResetPasswordHandler.cs` - lookup and breach check in `ProcessAsync`, transaction in `AttemptAsync`
- `src/Csps.Application/Auth/PasswordRules.cs` - `ConfigureAwait(false)`
- `src/Csps.Application/Auth/SignInHandler.cs` - constant lambda results, save on both recheck branches
- `src/Csps.Application/Auth/UserAccount.cs`, `src/Csps.Application/Email/AuthEmail.cs` - type-name `ToString`
- `src/Csps.Application/Ports/IUserAccounts.cs`, `src/Csps.Infrastructure/Identity/UserAccounts.cs` - `IsLockedOutAsync` removed
- `src/Csps.Domain/Auditing/AuditActions.cs`, `docs/api/auth.md` - `PasswordChanged` wording
- Tests: handler ordering, spent-link and retry cases; `FakeUnitOfWork.InTransaction`; ToString cases; Infrastructure lockout checks via `LockoutEnd`

## Decisions Made

- The verdict is computed once and passed into the retry, so a conflict retry never repeats the HTTP call.
- `AuthEmail.ToString` is sealed (C# stops derived records generating their own `ToString`); the five per-record overrides were removed as redundant.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Updated the Infrastructure integration tests that called the removed port member**
- **Found during:** Task 2
- **Issue:** `tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs` called `IUserAccounts.IsLockedOutAsync` six times; removing the member would not compile. The file is not in the plan's `files_modified`.
- **Fix:** Added a private `IsLockedAsync` helper that reads `LockoutEnd` from `FindByIdAsync` and compares it with the clock; the same assertions remain.
- **Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs`
- **Verification:** full solution test run passed.
- **Committed in:** `ae28519`

**2. [Rule 2 - Missing consistency] Updated `docs/api/auth.md`**
- **Found during:** Task 2
- **Issue:** The API doc repeated the old wrong `auth.password-changed` description.
- **Fix:** Same wording as the code summary; `updated:` timestamp bumped.
- **Files modified:** `docs/api/auth.md`
- **Committed in:** `ae28519`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 consistency)
**Impact on plan:** Both follow directly from the planned changes. No scope creep.

## Issues Encountered

- The acceptance check `git grep -c "IsLockedOutAsync" -- src` still reports `src/Csps.Infrastructure/Identity/UserAccounts.cs`: the two remaining hits are calls to ASP.NET Identity's own `UserManager.IsLockedOutAsync`, not our port member, which is gone.
- `web/src/modules/admin/pages/ResetPasswordPage.test.tsx` still shows a line-ending-only modification from an earlier plan; left alone as instructed.

## Known Stubs

None.

## Threat Flags

None. T-05-94 (connection held during a slow breach call) and T-05-95 (personal data in `ToString`) are mitigated and covered by the tests above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for the next plan. 05-37 can copy the IN-01, IN-03, IN-05 and IN-06 outcomes above into `04-REVIEW-DISPOSITION.md`; 05-43 carries IN-02 and IN-04.

## Self-Check: PASSED

- Files touched exist; commits `b608275`, `8b9b8ff`, `00d2b71`, `ae28519` are ancestors of HEAD.
- `dotnet test --solution Csps.slnx`: 3235 total, 0 failed, 1 skipped (pre-existing). Build: 0 warnings, 0 errors.
- Coverage gate passed: Csps.Domain 100% line and branch, Csps.Application 99.7% line.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*
