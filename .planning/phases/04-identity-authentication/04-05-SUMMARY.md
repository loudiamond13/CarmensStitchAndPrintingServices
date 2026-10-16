---
phase: 04-identity-authentication
plan: 05
subsystem: auth
tags: [two-factor, domain, state-machine, fixed-time-compare, auth-02, auth-03, auth-04, d-10, d-13, d-39]
status: complete
created: "2026-10-14T20:37:00-05:00"
updated: "2026-10-14T20:37:00-05:00"

requires: ["04-01"]
provides:
  - "Csps.Domain.Identity.TokenHash: HashLength, Compute (SHA-256 of UTF-8), Equal (length check then CryptographicOperations.FixedTimeEquals)"
  - "SixDigitCode: Length, IsWellFormed, Format (D6, invariant culture)"
  - "TwoFactorSettings (+Default): 15 min code, 5 tries, 60 s cooldown, 5 sends/h, 10 failures/h, 30 min challenge"
  - "TwoFactorChallenge: Start, IssueCode, CheckResend, Verify, FailedAttemptsSince, RequirePasswordChange, CanSetNewPassword, Complete, Invalidate"
  - "TwoFactorCode, TwoFactorChallengeStatus, TwoFactorVerifyOutcome, TwoFactorVerifyResult, ResendDecisionKind, ResendDecision, TwoFactorLimits.AccountCapReached, PasswordChangeReason {Temporary=1, Breach=2}"
affects: [04-11, 04-12, 04-14, EF configuration of the challenge tables]

requirements-completed: []

actuals:
  tokens: 9600
  tasks: 3
  commits: 6
plan_head_before: 2c71922575738636fca7eb039a4e21084c9bd6ce
plan_head_after: a09d0fa8bfd9c6a5937e5d751a5261aac4a36865

tech-stack:
  added: []
  patterns:
    - "Aggregate with private setters, a private EF binding constructor and methods that take now from the caller"
    - "Secrets arrive as ReadOnlySpan<byte>, so null never reaches a rule and the length guard is one branch"

key-files:
  created:
    - src/Csps.Domain/Identity/TokenHash.cs
    - src/Csps.Domain/Identity/SixDigitCode.cs
    - src/Csps.Domain/Identity/PasswordChangeReason.cs
    - src/Csps.Domain/Identity/TwoFactorSettings.cs
    - src/Csps.Domain/Identity/TwoFactorChallenge.cs
    - src/Csps.Domain/Identity/TwoFactorCode.cs
    - src/Csps.Domain/Identity/TwoFactorOutcomes.cs
    - tests/Csps.Domain.UnitTests/Identity/TokenHashTests.cs
    - tests/Csps.Domain.UnitTests/Identity/SixDigitCodeTests.cs
    - tests/Csps.Domain.UnitTests/Identity/TwoFactorChallengeTests.cs
  modified: []

key-decisions:
  - "Verify order: closed or no code or consumed code is ChallengeClosed; then expiry (now >= ExpiresAt, no attempt counted); then exhausted (no comparison made); then the fixed-time compare"
  - "RequirePasswordChange and Complete-from-Pending need an accepted code, so a challenge cannot skip the code step"
  - "Invalidate only acts on Pending or AwaitingNewPassword; a Completed or Invalidated challenge is left as it is"
  - "Complete and RequirePasswordChange do not re-check expiry; handlers use CanSetNewPassword for the new-password step"
---

# Phase 4 Plan 5: Emailed Code State Machine Summary

The emailed sign-in code rules (AUTH-02, AUTH-03, AUTH-04) are now pure Domain functions of `now`, with the owner's limits as defaults and every branch covered. Codes and tickets are only ever compared as 32-byte values through `CryptographicOperations.FixedTimeEquals`.

## What was built

- `TokenHash` and `SixDigitCode`: SHA-256 hashing with a fixed-time compare, and the six-digit code check and formatter (leading zeros kept, ASCII digits only, invariant culture).
- `TwoFactorChallenge` with `TwoFactorCode` children: a 30-minute pending sign-in that issues codes, supersedes the older code on each resend, counts wrong tries (5 per code), expires a code at `now >= ExpiresAt` (14:59 accepted, 15:00 expired) and closes the whole challenge at 30:00.
- `CheckResend`: the hourly cap (5 codes, so the 6th is refused) is checked before the 60 s cooldown, so the cap answer never carries a wait time; the wait is rounded up to whole seconds and is never 0.
- `TwoFactorLimits.AccountCapReached`: false at 9 wrong codes, true at 10.
- The D-13 hand-off: after an accepted code the challenge can move to awaiting a new password (Temporary or Breach) and then complete; `CanSetNewPassword` is false at or after the expiry.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 | Tracer: one code, one use, with hashed tickets and six-digit codes | cfbec42 (RED), 60f3a04 |
| 2 | Wrong, exhausted, expired and superseded codes at the exact boundaries | e344df4 (RED), 4b9b9c2 |
| 3 | Resend cooldown and caps, account cap, must-change hand-off | 450d304 (RED), a09d0fa |

## RED / GREEN evidence

- Task 1 RED: the test project failed to build (`TwoFactorChallenge`, `TwoFactorSettings` and the other types missing). GREEN: 8 challenge, 16 six-digit and 4 token-hash tests passed.
- Task 2 RED: build errors for the missing `Invalidate` and `FailedAttemptsSince`. GREEN: 18 challenge tests passed.
- Task 3 RED: build errors for the missing `CheckResend`, `ResendDecisionKind`, `RequirePasswordChange`, `CanSetNewPassword`, `Complete` and `TwoFactorLimits`. GREEN: the full Domain suite passed (523 tests, 0 failed).

## Verification

- `dotnet test --project tests/Csps.Domain.UnitTests`: 523 passed. Build: 0 warnings, 0 errors.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): Csps.Domain 100% line (601/601) and 100% branch (254/254), PASS. Csps.Application 100% line (38/38), PASS.
- Acceptance greps: `FixedTimeEquals` once in TokenHash.cs, `TokenHash.Equal` in TwoFactorChallenge.cs, `"D6"` once in SixDigitCode.cs, `Temporary = 1` and `Breach = 2`, `AccountCapReached` in TwoFactorOutcomes.cs.

## Deviations from Plan

None - plan executed exactly as written. `TwoFactorLimits` lives in `TwoFactorOutcomes.cs`, which the plan's acceptance criteria allow. The ticket hash and code MAC parameters are `ReadOnlySpan<byte>` (callers pass `byte[]` unchanged), which keeps null out of the rules.

## Known Stubs

None.

## Threat Flags

None. No endpoint, auth path or schema was added; the entities are persisted by a later plan.

## Notes for later plans

- Handlers (04-11, 04-12, 04-14) must supply the window counts: codes issued in the last hour for `CheckResend`, and the sum of `FailedAttemptsSince` across the account's challenges for `TwoFactorLimits.AccountCapReached`.
- Code generation uses `RandomNumberGenerator` in 04-11; this plan only formats and compares.
- EF mapping must use field access for the private `_codes` list and bind the private constructors.

## Self-Check: PASSED

All ten created files exist, and the six commits (cfbec42, 60f3a04, e344df4, 4b9b9c2, 450d304, a09d0fa) are ancestors of HEAD.
