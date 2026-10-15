---
phase: 04-identity-authentication
plan: 06
subsystem: auth
tags: [sessions, refresh-tokens, rotation, reuse-detection, device-label, domain, auth-05, auth-06, d-03, d-05, d-32, d-43]
status: complete
created: "2026-10-14T20:45:00-05:00"
updated: "2026-10-14T20:45:00-05:00"

requires: ["04-01"]
provides:
  - "SessionSettings (+Default): 90 d persistent, 12 h browser session, 30 s refresh grace, 5 grace siblings"
  - "UserSession: Start, Rotate, Revoke, IsActive, CookieExpiresAt, SelectOthersToRevoke, DeviceLabelMaxLength (60)"
  - "RefreshToken (Id, SessionId, ParentId, TokenHash, IssuedAt, ConsumedAt, RevokedAt), SessionRevocationReason, RotationOutcome, RotationResult"
  - "DeviceSummary.Describe and DeviceDescription(Label, IsKnown)"
affects: [04-11, 04-12, 04-15, 04-16, 04-25, EF configuration of the session tables]

requirements-completed: []

actuals:
  tokens: 8400
  tasks: 3
  commits: 6
plan_head_before: 78e39f148e6143376adfaa9f4e2ab1c2876e073e
plan_head_after: d8fe5d947ed000c93fb8df291d7129066c87516c

tech-stack:
  added: []
  patterns:
    - "Session aggregate takes the presented token and the related tokens the store loaded, so the rules stay pure functions of now"
    - "Device label built from fixed words on top of UserAgentFamily, so its length is bounded by construction"

key-files:
  created:
    - src/Csps.Domain/Identity/SessionSettings.cs
    - src/Csps.Domain/Identity/SessionOutcomes.cs
    - src/Csps.Domain/Identity/RefreshToken.cs
    - src/Csps.Domain/Identity/UserSession.cs
    - src/Csps.Domain/Identity/DeviceSummary.cs
    - tests/Csps.Domain.UnitTests/Identity/UserSessionTests.cs
    - tests/Csps.Domain.UnitTests/Identity/DeviceSummaryTests.cs
  modified: []

key-decisions:
  - "Rotate checks, in order: session ended (revoked or now >= AbsoluteExpiresAt), revoked token (reuse), consumed token (grace sibling or reuse), live token (rotate)"
  - "A parent counts as over the sibling cap when it has more than MaxGraceSiblings children, the original rotation child included, so the 5th grace sibling works and the 6th is reuse"
  - "Revoke keeps the first reason and time on the session but still ends any open tokens it is handed; reuse detection goes through Revoke"
  - "Rotate throws ArgumentException for a token from another session, so a foreign token can never reach the rules"
  - "DeviceSummary has no 60 character cut: every label is browser plus device words from fixed lists (30 characters at most), so the cap would be dead code"
---

# Phase 4 Plan 6: Session Rotation Rules and Device Label Summary

The refresh-family rules R1 to R5 are now a pure Domain aggregate with the owner's lifetimes, a 30 second grace window for concurrent tabs and lost responses, and reuse detection that revokes the whole session. A regex-free `DeviceSummary` gives the code email (D-32) and the devices page (D-43) one coarse label such as "Chrome on Android".

## What was built

- `SessionSettings` and `UserSession.Start`: a "Keep me signed in" session ends 90 days after sign-in and a browser session after 12 hours. The refresh cookie expires at the session end for the first and has no expiry for the second. The device label is cut to 60 characters, and a hash that is not 32 bytes is refused.
- `UserSession.Rotate`: a live token is used up and one child token is issued, and the fixed end never moves (R1, R5). Unused siblings issued more than 30 seconds earlier are revoked, while one exactly 30 seconds old is kept.
- Grace and reuse (R2, R3): a used token shown again within 30 seconds (inclusive) gets a sibling child. At 31 seconds, with a revoked token, or past 5 siblings for one parent, the whole session is revoked as `ReuseDetected` and its open tokens are revoked.
- Session end (R4): a refresh at exactly `AbsoluteExpiresAt` is refused as `SessionEnded` and one tick earlier succeeds. A revoked session refuses every token and keeps its first reason.
- `UserSession.SelectOthersToRevoke`: every active session except the caller's, including one created at the same instant. With no others it returns an empty list, which the caller treats as success (D-44).
- `DeviceSummary.Describe`: browser from `UserAgentFamily.Classify`, device from ordered checks (iPhone, iPad, Android, Chromebook, Windows, Mac, Linux). Bots, blanks and unknown agents give "Unknown browser" with `IsKnown` false. It never includes a version, model, IP or location.

## Tasks

| Task | Name | Commits |
|------|------|---------|
| 1 | Tracer: a session starts and one rotation hands back a child on the same fixed lifetime | 7026990 (RED), fff0096 |
| 2 | Grace siblings, stale-sibling clean-up and reuse detection | cc4eae4 (RED), af6f0f0 |
| 3 | Session end, revocation reasons, D-05 selection and the device label | fb0b768 (RED), d8fe5d9 |

## RED / GREEN evidence

- Task 1 RED: the test project failed to build (`UserSession`, `RefreshToken`, `SessionSettings` missing). GREEN: 9 session tests passed.
- Task 2 RED: build was fine against the Task 1 code, and 5 tests failed (grace sibling, 31 second reuse, sibling cap, stale clean-up, revoked token replay). GREEN: 16 session tests passed.
- Task 3 RED: build errors for the missing `DeviceSummary`, `IsActive`, `Revoke` and `SelectOthersToRevoke`. GREEN: the full Domain suite passed (570 tests, 0 failed).

## Verification

- `dotnet test --project tests/Csps.Domain.UnitTests`: 570 passed, 0 warnings, 0 errors.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): Csps.Domain 100% line (755/755) and 100% branch (354/354), PASS. Csps.Application 100% line (38/38), PASS.
- Acceptance greps: `DeviceLabelMaxLength` declared as 60, `UserAgentFamily.Classify` once and `Regex` zero times in `DeviceSummary.cs`, `SelectOthersToRevoke` once, `MaxGraceSiblings` and `ReuseDetected` present in `UserSession.cs`.

## Deviations from Plan

None - plan executed exactly as written, with these small choices inside the plan's latitude:

- Hash parameters are `ReadOnlySpan<byte>` (as in 04-05), so `byte[]` callers work unchanged and null never reaches a rule.
- The foreign-session token check in `Rotate` is an addition for safety; it has its own test.
- `DeviceSummary` does not cut at 60 characters because its labels cannot reach that length; a test asserts the bound instead.

## Known Stubs

None.

## Threat Flags

None. No endpoint, auth path or schema was added; the entities are persisted by a later plan. T-04-15, T-04-16 and T-04-17 are mitigated in the Domain: single-use tokens, reuse revokes the family, sibling cap 5, fixed lifetime, grace siblings and stale clean-up, and a regex-free bounded User-Agent scan.

## Notes for later plans

- The refresh handler (04-15) must load every token of the session as `related` and save the session, the consumed token, the new token and any revoked tokens in one unit of work, with a `RowVersion` conflict mapped to a retry or 409.
- AUTH-05 and AUTH-06 stay open: the cookie, the endpoints and the web single-flight are delivered by 04-15, 04-16 and 04-25. This plan delivers only their Domain rules.
- EF mapping must bind the private constructors of `UserSession` and `RefreshToken`.
- A sign-in with more than 60 characters of device label is cut silently; `DeviceSummary` labels never reach that.

## Self-Check: PASSED

All seven created files exist, and the six commits (7026990, fff0096, cc4eae4, af6f0f0, fb0b768, d8fe5d9) are ancestors of HEAD.
