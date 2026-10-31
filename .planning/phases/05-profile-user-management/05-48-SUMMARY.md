---
phase: 05-profile-user-management
plan: 48
subsystem: auth
tags: [gap-closure, wr-05, wr-08, wr-14, d-18, bootstrap-manager, tdd, tracer, shared-machine]
created: "2026-10-19T03:20:00-05:00"
updated: "2026-10-19T03:20:00-05:00"
status: complete

requires:
  - phase: 05-profile-user-management
    provides: "05-VERIFICATION.md gap 4 (WR-05 with WR-14, partial); review warning WR-08; CountActiveManagersAsync (D-18)"
provides:
  - "AnyActiveManagerAsync (the bootstrap-manager gate) shares the one D-18 active-Manager rule with CountActiveManagersAsync and ManagerGuard (T-05-116)"
  - "bootstrap-manager recovers a roster whose only Manager is Manager-locked, deleted or deactivated (exit 0, one queued invite); an active Manager still refuses with exit 2"
  - "UserAccountsTests pin Manager-locked and deleted Managers as not active and a failed-password lockout as still active (WR-14)"
  - "No bootstrap command test can reach the shared LocalDB instance with a BetsLLC name (T-05-117, WR-08)"
affects: [05-VERIFICATION gap 4]

actuals:
  tokens: 4500
  tasks: 2
  commits: 5
plan_head_before: eddbbea08951d654b7d0e0d4d7949b0f73ed0cf8
plan_head_after: cc6bb26979491e7dddc5ee688ee70b9c18aa02a3

tech-stack:
  added: []
  patterns:
    - "One SQL-side active-Manager count backs every caller; the gate no longer loads Managers into memory"
    - "Safety tests keep the protected database name but aim at a host that cannot resolve"

key-files:
  created: []
  modified:
    - src/Csps.Infrastructure/Identity/UserAccounts.cs
    - src/Csps.Application/Ports/IUserAccounts.cs
    - tests/Csps.Infrastructure.IntegrationTests/Seeding/BootstrapManagerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs
    - docs/operations/bootstrap-manager.md

key-decisions:
  - "SoftDeleteAsync is unchanged: the optional WR-05 idea of clearing IsActive on delete would alter roster status data, and the shared rule already excludes deleted rows"

requirements-completed: [USER-04]

coverage:
  - id: D1
    description: "With the only Manager locked, deleted or deactivated, the bootstrap command exits 0 and creates a new Manager with one queued invite; with an active Manager it still exits 2"
    requirement: "USER-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/BootstrapManagerTests.cs#ARunCreatesANewManagerWhenTheOnlyManagerCannotAct"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/BootstrapManagerTests.cs#ARunOnAnEmptyDatabaseCreatesTheFirstManagerWithOneQueuedInviteAndASecondRunIsRefused"
        status: pass
    human_judgment: false
  - id: D2
    description: "UserAccounts counts a Manager-locked or deleted Manager as not active and a failed-password lockout as active, for both AnyActiveManagerAsync and CountActiveManagersAsync"
    requirement: "USER-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs#ManagerLockedManagerDoesNotCount"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs#DeletedManagerDoesNotCount"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Identity/UserAccountsTests.cs#AFailedPasswordLockoutStillCounts"
        status: pass
    human_judgment: false
  - id: D3
    description: "The two command-level BetsLLC refusal tests use an unreachable host with the protected name, so no test hands a connectable shared-instance BetsLLC string to the command"
    requirement: "USER-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/BootstrapManagerTests.cs#ABetsDatabaseIsRefusedWithoutOpeningAConnection"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Seeding/BootstrapManagerTests.cs#APromptedConnectionIsUsedWhenTheVariableIsNotSet"
        status: pass
    human_judgment: false
  - id: D4
    description: "The runbook names what an active Manager means for the exit-2 refusal and states the locked or deleted recovery path"
    requirement: "USER-04"
    verification: []
    human_judgment: true
    rationale: "Prose accuracy of an operator runbook is a reader judgment, not asserted by a test"
---

# Phase 5 Plan 48: Bootstrap Gate Uses the One Active-Manager Rule Summary

The bootstrap-manager gate now counts a Manager as active only when active, not Manager-locked and not deleted (D-18), so a roster left with a locked or deleted Manager can be recovered, and the bootstrap tests can no longer reach TheBETSLLC's database.

## Performance

- **Duration:** about 10 min (started 2026-10-19T08:07Z, ended 2026-10-19T08:18Z)
- **Tasks:** 2 (tracer + auto, both TDD)
- **Files modified:** 5

## Accomplishments

- **WR-05:** `UserAccounts.AnyActiveManagerAsync` now returns `CountActiveManagersAsync(null, ...) > 0`. The roster guard, ManagerGuard and the bootstrap gate share one definition, and the in-memory `GetUsersInRoleAsync` load is gone. The `IUserAccounts` doc comment says "active as in D-18".
- **Recovery path proven at command level:** a new theory runs the real command on a fresh `CspsDatabase`, makes the first Manager locked, deleted or deactivated using fixed instants, and runs it again: exit 0, the new address named, two users, the new one holds the Manager role with one queued invite and the outbox grows to two. The existing active-Manager refusal (exit 2) test still passes.
- **WR-14:** `ManagerLockedManagerDoesNotCount`, `DeletedManagerDoesNotCount` and `AFailedPasswordLockoutStillCounts` pin the rule through both `AnyActiveManagerAsync` and `CountActiveManagersAsync`.
- **WR-08:** `ABetsDatabaseIsRefusedWithoutOpeningAConnection` and `APromptedConnectionIsUsedWhenTheVariableIsNotSet` use `UnreachableBetsConnection` (`db.invalid.example`, `BetsLLC_Dev`, 1-second connect timeout). A guard regression now fails with a connection error. The pure guard theory rows never connect and are unchanged.
- **Runbook:** the exit-2 row defines an active Manager, and a sentence under the table states that a locked or deleted only-Manager lets the command run (the recovery path).

## TDD Gate Compliance

- **RED** `200264f test(05-48): bootstrap refuses when the only Manager is locked or deleted (RED, WR-05)`. Run of `*BootstrapManagerTests`: 57 total, 2 failed, 55 passed. Semantic assessment: the `locked` and `deleted` cases failed on the planned assertion (`recovery.ExitCode` expected 0, was 2, "Refused: An active Manager already exists"); `deactivated` passed as the plan predicted. Not a load, fixture or zero-test failure. Evidence was read from the real run output; the `gsd_run check tdd-red-evidence` classifier does not support xunit MTP console reports, so no record file was submitted.
- **GREEN** `ff44362 fix(05-48): one definition of an active Manager for the bootstrap gate (WR-05)`. Same class: 57 passed.
- **Characterization commits** `f8758a3` (WR-14 cases, pass immediately after GREEN as the plan specified) and `7742bcf` (WR-08, behavior-preserving). No REFACTOR commit was needed.

## Task Commits

1. **Task 1 (tracer):** `200264f` (RED), `ff44362` (GREEN)
2. **Task 2:** `f8758a3` (UserAccountsTests), `7742bcf` (unreachable host), `cc6bb26` (runbook)

The tracer gate was verified end to end before expansion (`*BootstrapManagerTests` 57 of 57 pass), and the expansion task then built on it.

## Verification

- `CSPS_TEST_SQL=localdb dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*BootstrapManagerTests"`: 57 passed.
- `... --filter-class "*UserAccountsTests"`: 29 passed.
- Whole `Csps.Infrastructure.IntegrationTests` project: 510 total, 509 passed, 1 skipped (pre-existing), 0 failed, no warnings.
- Acceptance greps: `CountActiveManagersAsync(null` in UserAccounts.cs is 1; `UnreachableBetsConnection` lines 3; `db.invalid.example` 1; `MSSQLLocalDB;Database=BetsLLC` 1 (the pure guard theory row only); `ManagerLockedManagerDoesNotCount|DeletedManagerDoesNotCount` lines 2.
- Preflight run before each DB-backed run: ports free, no other project's test processes. `CSPS_TEST_SQL` was set only on each test command. No `BetsLLC_*` database was touched and the bootstrap command was never run by hand.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. The first preflight invocation with a backslash path under Git Bash failed on path handling and was rerun with forward slashes.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema change; T-05-116 and T-05-117 are mitigated as planned, and T-05-SC holds (no package, csproj or lock file changed).

## Next Phase Readiness

Gap 4 (WR-05, WR-14) and WR-08 are closed. Phase re-verification marks requirement status; REQUIREMENTS.md was not touched by this plan. No other gap plan's `files_modified` overlapped, and no failures were seen in classes owned by other plans.

## Self-Check: PASSED

- Files exist: all five modified files found.
- Commits `200264f`, `ff44362`, `f8758a3`, `7742bcf`, `cc6bb26` are ancestors of HEAD.
