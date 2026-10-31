---
phase: 05-profile-user-management
plan: 45
subsystem: auth
tags: [gap-closure, wr-01, reset-links, tdd, tracer, security]
created: "2026-10-19T02:55:00-05:00"
updated: "2026-10-19T02:55:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-VERIFICATION.md gap 2 (WR-01, partial); IAccountTokens.LockAccountAsync and RevokeOpenAsync"
provides:
  - "A Manager temporary password ends every open password-reset link (T-05-109)"
  - "A profile password change takes the account lock and ends every open password-reset link (T-05-110)"
  - "A Manager at-once email move ends every open password-reset link sent to the old address (T-05-111)"
  - "docs/api/users.md states it on the three rows"
affects: [05-VERIFICATION gap 2]

actuals:
  tokens: 7700
  tasks: 3
  commits: 8
plan_head_before: d0ec7ed6674b4e6eee03cfa36cfbaf974aadbdbf
plan_head_after: 85f161f5b9cf8e25ef8d94ca9c1c705ea1738038

tech-stack:
  added: []
  patterns:
    - "Every take-back flow calls tokens.RevokeOpenAsync(id, PasswordReset, now) in its own transaction, after the per-account lock and after the Identity changes, before the session revocation"

key-files:
  created: []
  modified:
    - src/Csps.Application/Users/SetTemporaryPasswordHandler.cs
    - src/Csps.Application/Profile/ChangePasswordHandler.cs
    - src/Csps.Application/Users/UpdateUserHandler.cs
    - tests/Csps.Server.IntegrationTests/Users/TemporaryPasswordTests.cs
    - tests/Csps.Server.IntegrationTests/Profile/ChangePasswordTests.cs
    - tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs
    - tests/Csps.Application.UnitTests/Users/AccountAccessHandlerTests.cs
    - tests/Csps.Application.UnitTests/Profile/ChangePasswordHandlerTests.cs
    - tests/Csps.Application.UnitTests/Users/UpdateUserHandlerTests.cs
    - docs/api/users.md

key-decisions:
  - "ChangePasswordHandler takes the account lock as the first statement of its transaction body (new IAccountTokens dependency), so a forgot-password at the same moment is ordered before or after the change, never between"
  - "UpdateUserHandler revokes PasswordReset only on the MoveNow path for a person with a password; ConfirmByLink leaves reset links alone because the sign-in address has not changed yet, and an invited person has no password to reset"

requirements-completed: [PROF-03, USER-03, USER-07]

coverage:
  - id: D1
    description: "A reset link emailed before a Manager temporary password answers 404 auth.link-invalid on check and use, and the must-change flag stays Temporary"
    requirement: "USER-07"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/TemporaryPasswordTests.cs#AResetLinkEmailedBeforeATemporaryPasswordStopsWorkingAndTheMustChangeFlagStays"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/AccountAccessHandlerTests.cs#ATemporaryPasswordIsSavedClearsTheLockoutEndsEverySessionNotifiesAndIsAuditedWithFixedWords"
        status: pass
    human_judgment: false
  - id: D2
    description: "A reset link emailed before a profile password change answers 404; this device stays signed in"
    requirement: "PROF-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Profile/ChangePasswordTests.cs#AResetLinkEmailedBeforeThePasswordChangeStopsWorkingAndThisDeviceStaysSignedIn"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Profile/ChangePasswordHandlerTests.cs#AValidChangeDoesEveryEffectInOneTransactionAndKeepsThisDevice"
        status: pass
    human_judgment: false
  - id: D3
    description: "An at-once email move ends a reset link sent to the old address; confirm-by-link leaves it alone"
    requirement: "USER-03"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Users/ManagerEmailChangeTests.cs#OnlyAnAtOnceEmailMoveClosesAResetLinkSentToTheOldAddress"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Users/UpdateUserHandlerTests.cs#SaveAtOnceMovesTheEmailEndsEverySessionClosesOpenLinksAndNotifiesTheOldAddress"
        status: pass
    human_judgment: false
---

# Phase 5 Plan 45: Reset links end when an account is taken back Summary

**Each "take the account back" flow (Manager temporary password, own password change, at-once email move) now revokes every open password-reset link in the same transaction, after the per-account link lock (WR-01).**

## Performance

- **Duration:** about 20 min
- **Completed:** 2026-10-19
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files modified:** 10

## Accomplishments

- WR-01 closed for all three flows. Before, an open 30-minute reset link (or the old mailbox) could set a new password after the take-back, and a reset also cleared the Manager's forced change.
- Tracer first: the temporary-password flow went RED in both the integration test and the unit test, then GREEN, and `⚡ Tracer verified end-to-end - expanding` before Tasks 2 and 3.
- `SetTemporaryPasswordHandler` calls `RevokeOpenAsync(id, PasswordReset, now)` for every person, after the invited-branch block and before the session revocation. The account lock was already its first statement.
- `ChangePasswordHandler` gained an `IAccountTokens` dependency (resolved from DI, no registration change). `ApplyAsync` takes `LockAccountAsync` first, keeps the Identity calls next (Pitfall 13), then revokes PasswordReset before the session revocation, email and audit rows. The breach lookup still runs before the transaction.
- `UpdateUserHandler.StartEmailAsync` revokes PasswordReset on the MoveNow path for a person with a password. `confirm` and the invited path do not (tests pin both).
- `docs/api/users.md`: "Any open reset link stops working." on the `POST /profile/password` and `POST /users/{id}/temporary-password` rows, and on the `PUT /users/{id}` row for `emailChange` `now` (said as "with `now`, not with `confirm`").

## Task Commits

1. **Task 1 RED:** `bd91b8f` test(05-45): an earlier reset link survives a temporary password (RED, WR-01)
2. **Task 1 GREEN:** `1a94b4b` fix(05-45): a temporary password ends open reset links (WR-01)
3. **Task 2 RED:** `a3b47e2` test(05-45): an earlier reset link survives a profile password change (RED, WR-01)
4. **Task 2 GREEN:** `5884f45` fix(05-45): a profile password change ends open reset links (WR-01)
5. **Task 3 RED:** `855858e` test(05-45): an earlier reset link survives an at-once email move (RED, WR-01)
6. **Task 3 GREEN:** `bd0c3e8` fix(05-45): an at-once email move ends open reset links (WR-01)
7. **Task 3 docs:** `d217d67` docs(05-45): reset links end when an account is taken back
8. **Task 3 docs follow-up:** `85f161f` docs(05-45): say which email choice ends reset links

## Characterization tests (passed at once)

- `ManagerEmailChangeTests.OnlyAnAtOnceEmailMoveClosesAResetLinkSentToTheOldAddress` with `confirm`: the link must still work, which already held; the `now` case was the RED one.
- In Task 2 the RED commit keeps the unit harness compiling: the `Tokens` substitute exists in the harness but is passed to the handler only in GREEN, so the RED fails at run time, not at compile time.

## Deviations from Plan

None - plan executed exactly as written. Two small notes, neither a deviation:

- The first docs commit gave the `PUT /users/{id}` row a lowercase "any open reset link" sentence; the acceptance grep (`Any open reset link stops working` at least 3) needs the capital form, so a second docs commit reworded it.
- The dispatch trailer asked for no particular model; commits carry the session's attribution line, `Claude Sonnet 5.5`.

## Verification

- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*TemporaryPasswordTests"`: 16 passed. `*ChangePasswordTests`: 29 passed. `*ManagerEmailChangeTests`: 29 passed.
- `dotnet test --project tests/Csps.Application.UnitTests --filter-class` for `*AccountAccessHandlerTests` (51), `*ChangePasswordHandlerTests` (33), `*UpdateUserHandlerTests` (51): all passed.
- `Invoke-CoverageGate.ps1`: Csps.Domain 100% line and branch; Csps.Application line 99.7% (2630/2637), branch 98%; PASS.
- Full `Csps.Server.IntegrationTests` run: 1039 passed, 0 failed, 0 skipped.
- Acceptance greps: `AccountTokenPurpose.PasswordReset` x1 in each of the three handlers, `LockAccountAsync` x1 in ChangePasswordHandler, `Any open reset link stops working` x3 in `docs/api/users.md`.
- Preflight before the DB-backed runs: ports 5180, 5115, 7028, 5199 free, no foreign dev processes. No package, project file or migration changes. No `BetsLLC_*` database touched.

## Known Stubs

None.

## Threat Flags

None. T-05-109, T-05-110 and T-05-111 are mitigated by the revokes and the tests above; T-05-SC has no installs to check.

## Self-Check: PASSED

- All ten modified files exist; the eight commits above are on `gsd/phase-05-profile-user-management`.
- No other gap plan's files were touched; `web/` files and `.planning/state.json` that showed as modified before the start were left alone.
