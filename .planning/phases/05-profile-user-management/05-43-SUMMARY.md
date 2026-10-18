---
phase: 05-profile-user-management
plan: 43
subsystem: auth
tags: [review-carry-over, in-02, in-04, audit, refactor, tdd, user-06, user-07]
created: "2026-10-18T13:12:00-05:00"
updated: "2026-10-18T13:12:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-34 (IN-01, IN-03, IN-05, IN-06 closed; AuditKey.Of from 05-38)"
provides:
  - "AuditActions holds a const for every audit detail word and builds SignInFailureReasons, LockoutDetails, SessionsRevokedDetails and the new ResetRequestDetails from them (IN-02)"
  - "The eight Key(Guid) copies in the auth handlers and BootstrapManagerHandler are gone; all use AuditKey.Of (IN-02)"
  - "PasswordRules.NewPasswordRequired is the one empty-password message, backed by PasswordPolicy.NewPasswordRequiredMessage (IN-02)"
  - "AccountLinkLookup serves invite and reset links with a per-purpose account rule (IN-02)"
  - "ListQueryRules messages are built from ListQueryLimits with the invariant culture (IN-04)"
affects: [05-37]

actuals:
  tokens: 14500
  tasks: 2
  commits: 5
plan_head_before: e17149b6a8eee9f7cf736a3f74ef9743a144832c
plan_head_after: e7df2a3e0b82a09f7e02f2e2e3453d9196c38fb8

tech-stack:
  added: []
  patterns:
    - "Audit detail words are AuditActions.Detail* constants; lists are built from them"
    - "Reflection-based guard tests keep copies from coming back (Key helper, validator message)"

key-files:
  created:
    - src/Csps.Application/Auth/AccountLinkLookup.cs
    - tests/Csps.Application.UnitTests/Common/AuditKeyTests.cs
    - tests/Csps.Application.UnitTests/Auth/AccountLinkLookupTests.cs
  modified:
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Domain/Identity/PasswordPolicy.cs
    - src/Csps.Application/Auth/PasswordRules.cs
    - src/Csps.Application/Common/ListQueryRules.cs
  deleted:
    - src/Csps.Application/Auth/InviteLinkLookup.cs
    - src/Csps.Application/Auth/ResetLinkLookup.cs

key-decisions:
  - "Detail constants are named AuditActions.Detail<Word>; a word shared by two lists (unknown-account, manager-locked, deactivated) has one constant"
  - "PasswordPolicy.NewPasswordRequiredMessage lives in the Domain (layering) and PasswordRules.NewPasswordRequired re-exposes it for the validators"
  - "InviteLinkLookup and ResetLinkLookup are deleted, not kept as wrappers: no caller needed the old names"

requirements-completed: [USER-06, USER-07]

coverage:
  - id: D1
    description: "Audit detail words are AuditActions constants and the lists are built from them; the eight handlers write constants and use AuditKey.Of"
    requirement: "USER-06"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs#EveryDetailWordHasAConstant"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Common/AuditKeyTests.cs#NoTypeKeepsItsOwnGuidKeyHelper"
        status: pass
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests (1035 passed, stored entries unchanged)"
        status: pass
    human_judgment: false
  - id: D2
    description: "One empty-password message and one link lookup shared by invite and reset flows"
    requirement: "USER-07"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/PasswordRulesTests.cs#TheEmptyPasswordMessageIsDeclaredOnceAndMatchesThePolicy"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Auth/AccountLinkLookupTests.cs#OneLookupServesBothLinkPurposes"
        status: pass
    human_judgment: false
  - id: D3
    description: "List page-size and search messages follow ListQueryLimits"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Common/ListQueryRulesTests.cs#MessagesReadInPlainEnglishWithTheCurrentCaps"
        status: pass
    human_judgment: false

duration: 25min
completed: 2026-10-18
---

# Phase 5 Plan 43: Audit words, keys, link lookup and list messages Summary

**IN-02 and IN-04 closed with no behaviour change: audit detail words are `AuditActions.Detail*` constants, one `AuditKey.Of`, one `AccountLinkLookup`, one empty-password message and list messages built from the caps.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-10-18T12:47:00-05:00 (approximate)
- **Completed:** 2026-10-18T13:12:00-05:00
- **Tasks:** 2
- **Files modified:** 30 (including tests)

## Accomplishments

- **IN-02 (audit words and keys):** 20 `Detail*` constants on `AuditActions`; the three existing lists and a new `ResetRequestDetails` list are built from them. `SignInHandler`, `ForgotPasswordHandler`, `ResetPasswordHandler`, `SetNewPasswordHandler`, `VerifyCodeHandler`, `AcceptInviteHandler` and `BootstrapManagerHandler` write the constants. All eight handlers (those plus `RefreshHandler`) drop their `Key(Guid)` copy for `AuditKey.Of`. `git grep "private static string Key(Guid" -- src/Csps.Application` now reports nothing.
- **IN-02 (message and lookup):** `PasswordRules.NewPasswordRequired` (backed by `PasswordPolicy.NewPasswordRequiredMessage`) replaces three validator constants and the policy literal. `AccountLinkLookup.FindAsync(token, purpose, ...)` replaces `InviteLinkLookup` and `ResetLinkLookup`; the reset purpose additionally needs a confirmed email. `IsWellFormed` moved with it.
- **IN-04:** `ListQueryRules` builds "Use a page size from 1 to 100." and "Use 100 characters or fewer." from `ListQueryLimits` with `CultureInfo.InvariantCulture`.
- Stored audit entries read exactly as before: the full Server integration suite (1035 tests) is unchanged and green. Whole solution: 3250 tests, 0 failed. Build: 0 warnings. Coverage gate: Domain 100%, Application 99.7% line.

## IN-02 and IN-04 outcome (for 05-37 / 04-REVIEW-DISPOSITION.md)

| Note | Outcome |
|------|---------|
| IN-02 detail literals | Fixed in the eight plan handlers; constants and lists in `AuditActions` |
| IN-02 `Key(Guid)` copies | Fixed: 8 copies removed (the review said 7; `BootstrapManagerHandler` made 8). The Infrastructure `UserAccounts.Key` is a separate private helper outside this plan's scope |
| IN-02 `NewPasswordRequired` x4 | Fixed: one definition (Domain constant, Application re-export) |
| IN-02 link lookups | Fixed: `AccountLinkLookup` |
| IN-04 | Fixed: messages built from `ListQueryLimits` |

## Task Commits

1. **Task 1 (tracer): audit words and keys from one source** - RED `e78ba84` (test), GREEN `b78684c` (refactor)
2. **Task 2: one link lookup, one empty-password message, list messages**
   - RED `07c3e77` (test)
   - GREEN `6ba90ce` (refactor, IN-02)
   - `e7df2a3` (refactor, IN-04; see TDD note)

**Plan metadata:** the `docs(05-43)` commit that follows this file.

## TDD Notes

- **RED evidence:** every RED test failed at runtime on its target assertion before any implementation (`EveryDetailWordHasAConstant`, `EveryDetailListIsBuiltFromItsConstants`, `NoTypeKeepsItsOwnGuidKeyHelper` with 8 offenders, `TheEmptyPasswordMessageIsDeclaredOnceAndMatchesThePolicy`, `NoValidatorKeepsItsOwnCopyOfTheEmptyPasswordMessage`, `OneLookupServesBothLinkPurposes`). The tests use reflection so the failure is an assertion, not a compile error. Semantic assessment: each failed for the planned reason. The `gsd_run check tdd-red-evidence` classifier has no adapter for the xunit v3 / MTP console report, so no machine-validated record exists; the evidence is the runner output above.
- **IN-04 has no runtime RED.** The caps are compile-time constants equal to the old literals, so no test can fail before the change. The test now builds its expectations from `ListQueryLimits` (so a cap change moves code and test together) and pins the current wording. This is a characterization test written with the refactor, not a RED commit.

## Files Created/Modified

- `src/Csps.Domain/Auditing/AuditActions.cs` - `Detail*` constants; lists built from them; `ResetRequestDetails`
- `src/Csps.Domain/Identity/PasswordPolicy.cs` - `NewPasswordRequiredMessage` constant
- `src/Csps.Application/Auth/PasswordRules.cs` - `NewPasswordRequired`
- `src/Csps.Application/Auth/AccountLinkLookup.cs` - the one link lookup (new)
- `src/Csps.Application/Auth/{SignIn,ForgotPassword,Refresh,SetNewPassword,VerifyCode,AcceptInvite,ResetPassword}Handler.cs`, `src/Csps.Application/Users/BootstrapManagerHandler.cs` - constants and `AuditKey.Of`
- `src/Csps.Application/Auth/{AcceptInvite,ResetPassword,SetNewPassword}RequestValidator.cs` - use `PasswordRules.NewPasswordRequired`
- `src/Csps.Application/Auth/{CheckInvite,CheckResetLink}Handler.cs`, `src/Csps.Application/Profile/{CheckEmailChange,ConfirmEmailChange}Handler.cs` - call `AccountLinkLookup`
- `src/Csps.Application/Common/ListQueryRules.cs` - messages from the caps
- Deleted: `InviteLinkLookup.cs`, `ResetLinkLookup.cs`
- Tests: `AuditActionsTests`, `AuditKeyTests` (new), `AccountLinkLookupTests` (new), `PasswordRulesTests`, `ListQueryRulesTests`, and one-line reference updates in `AcceptInviteHandlerTests`, `ResetPasswordHandlerTests`, `SetNewPasswordHandlerTests`

## Decisions Made

- Detail constants are `AuditActions.Detail<Word>`; a word used in two lists has one constant.
- The empty-password text stays in the Domain (Application cannot be referenced from there) and `PasswordRules` re-exposes it, as the plan allowed.
- The two old lookups were deleted rather than kept as wrappers; no caller needed them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three existing tests referenced the validators' removed constants**
- **Found during:** Task 2
- **Issue:** `AcceptInviteHandlerTests`, `ResetPasswordHandlerTests` and `SetNewPasswordHandlerTests` used `XRequestValidator.NewPasswordRequired`, which the plan removes ("one message"). The plan says existing tests pass unchanged.
- **Fix:** Changed only the constant reference to `PasswordRules.NewPasswordRequired`; assertions are identical.
- **Files modified:** the three test files above
- **Verification:** Application suite 880 passed
- **Committed in:** `6ba90ce`

**2. [Rule 3 - Blocking] Files outside `files_modified` changed**
- **Found during:** Task 2
- **Issue:** `PasswordPolicy.cs` (Domain constant, which the plan allows "if layering requires"), `CheckInviteHandler`, `CheckResetLinkHandler`, `CheckEmailChangeHandler`, `ConfirmEmailChangeHandler` (callers of the lookups) needed edits.
- **Fix:** Minimal call-site and constant edits; behaviour unchanged.
- **Committed in:** `6ba90ce`

---

**Total deviations:** 2 auto-fixed (both Rule 3). **Impact:** none on behaviour; scope stays within IN-02 and IN-04.

## Issues Encountered

None. Out of scope and left alone: the same detail words still appear as local constants or literals in handlers the plan did not list (`SignOutOthersHandler`, `ChangePasswordHandler`, `CurrentPasswordCheck`, the `Users/*` handlers' `AccountChangedDetail` and `TemporaryPasswordDetail`, `CreateUserHandler`, `ConfirmEmailChangeHandler`, `ResendEmailChangeHandler`). They still match the listed words, but they are not yet read from the new constants. Worth a follow-up so a typo there is also caught.

## Known Stubs

None.

## Threat Flags

None. T-05-106 is mitigated: `AuditActionsTests` checks every list word has a constant, and the integration suite proves the stored entries are unchanged.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for 05-37 to record the IN-02 and IN-04 outcomes above in `04-REVIEW-DISPOSITION.md`.

---
*Phase: 05-profile-user-management*
*Completed: 2026-10-18*

## Self-Check: PASSED

- Created files exist: `AccountLinkLookup.cs`, `AuditKeyTests.cs`, `AccountLinkLookupTests.cs`.
- Commits `e78ba84`, `b78684c`, `07c3e77`, `6ba90ce`, `e7df2a3` are ancestors of HEAD.
- Acceptance: no `private static string Key(Guid` in `src/Csps.Application`; `"Enter a new password."` appears 0 times in `src/Csps.Application`; `ListQueryRules.cs` references the limits 6 times.
