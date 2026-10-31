---
phase: 05-profile-user-management
plan: 04
subsystem: testing
tags: [sql-server, triggers, schema-test, xunit, flaky-test, email-outbox, tdd]

requires:
  - phase: 01-foundation
    provides: TR_AuditLog_AppendOnly (D-32), CspsDatabase fixture, MigrationScriptTests pattern
  - phase: 04-identity-authentication
    provides: ResendCodeEndpointTests, AuthClient, SteppedClock, the outbox dispatcher
provides:
  - TriggerInventoryTests (sys.triggers lists only TR_AuditLog_AppendOnly; the idempotent production script holds one CREATE TRIGGER)
  - A resend-cap test that no longer depends on a 5 s sink wait, plus a slow-mail fact that proves it
  - Phase 4 deferred item closed
affects: [05-05 migration, 05-21 last-Manager guard (application code, never a trigger), every later migration]

actuals:
  tokens: 2600
  tasks: 2
  commits: 3
plan_head_before: 6a312968e9b3fd5a435e33eafd74549abcf0460d
plan_head_after: 8294272f92fa9fafbd5da941796dfb57b6d1c034

tech-stack:
  added: []
  patterns:
    - "Schema guard test: query sys.triggers on a migrated CSPS_Test database and regex-scan the idempotent script"
    - "Slow delivery simulated by wrapping IEmailTransport in the test host, so a timing weakness is reproduced deterministically"

key-files:
  created:
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs
  modified:
    - tests/Csps.Server.IntegrationTests/Auth/ResendCodeEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Auth/AuthClient.cs
    - .planning/phases/04-identity-authentication/deferred-items.md

key-decisions:
  - "The shared sink wait (AuthClient.Patience) goes from 5 s to 30 s: it returns the moment the mail is there, so passing tests are no slower and the limit only matters on a loaded machine"
  - "The cap proof moved into one helper used by the original fact and a slow-mail fact; no assertion was changed or removed"

requirements-completed: [USER-04]

coverage:
  - id: D1
    description: "A database migrated to the latest migration has exactly one trigger, TR_AuditLog_AppendOnly"
    requirement: "USER-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs#TheOnlyTriggerIsTheAuditLogAppendOnlyGuard"
        status: pass
    human_judgment: false
  - id: D2
    description: "The idempotent production script contains exactly one CREATE TRIGGER, the audit one"
    requirement: "USER-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs#TheProductionScriptCreatesOnlyTheAuditTrigger"
        status: pass
    human_judgment: false
  - id: D3
    description: "The sixth-code-in-an-hour proof passes reliably, including when mail leaves slowly, with the cap assertions intact"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/ResendCodeEndpointTests.cs#TheSixthCodeInAnHourIsRefusedWithNoWaitTime"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Auth/ResendCodeEndpointTests.cs#TheSixthCodeIsStillRefusedWhenMailLeavesSlowly"
        status: pass
    human_judgment: false

duration: 25 min
completed: 2026-10-17
status: complete
created: "2026-10-17T20:20:00-05:00"
updated: "2026-10-17T20:20:00-05:00"
---

# Phase 5 Plan 04: Trigger inventory and resend-cap flake Summary

**A schema test that fails on any database or script trigger other than TR_AuditLog_AppendOnly (OR-7, D-06), and a resend-cap test fixed by lengthening the shared sink wait from 5 s to 30 s, with the cap proof unchanged.**

## Accomplishments

- `TriggerInventoryTests.TheOnlyTriggerIsTheAuditLogAppendOnlyGuard`: on a freshly migrated `CSPS_Test_<guid>` database, `sys.triggers` must equal `[AuditEntryConfiguration.TriggerName]`. Any other trigger fails with its name in the message. `sys.server_triggers` is never queried (shared instance).
- `TriggerInventoryTests.TheProductionScriptCreatesOnlyTheAuditTrigger`: the idempotent script from no migration to the latest holds exactly one match of `CREATE\s+(OR\s+ALTER\s+)?TRIGGER`, and it names the audit trigger. A later migration cannot add a trigger unnoticed.
- The Phase 4 carry-over flake is fixed at its cause and closed in `04-identity-authentication/deferred-items.md`.

## TDD record

### Task 1 (tracer): trigger inventory

- **RED:** both facts were run against deliberately broken inputs, never committed. For the first, the scratch run added `dbo.Scratch` and `TR_Scratch` to the migrated database; the test failed on the planned assertion (`names` expected `["TR_AuditLog_AppendOnly"]` but was `["TR_AuditLog_AppendOnly", "TR_Scratch"]`). For the second, an extra `CREATE TRIGGER dbo.TR_Extra` was appended to the script string; it failed with `statements.Count` expected 1, was 2. Semantic assessment: both targets executed and failed on the planned assertion for the intended reason (not a build, fixture or zero-test failure).
- **GREEN:** nothing to implement. The schema already complies; the committed real file passes (2 of 2).
- **REFACTOR:** none.
- Commit `2e205b7 test(05-04): only the audit append-only trigger may exist (D-06)`. The tracer verify is automated-only, so it was re-run end to end before moving on.

### Task 2: resend-cap flake

**Reproduction notes.** The original failure (one failure in a full 571-test run with other projects running before it) did not reproduce on this machine:

| Attempt | Result |
|---|---|
| Class alone, 10 runs in a row | 10 of 10 passed |
| Whole `Csps.Server.IntegrationTests` project, 3 runs (656 tests) | 3 of 3 passed (63 s to 71 s) |
| 36 parallel class runs, no extra load | 36 of 36 passed |
| 24 parallel class runs under 16 busy-loop processes | 23 passed; the 1 failure was a `CspsDatabase` fixture `Execution Timeout Expired` creating the database, not the target assertion (noise from the stress, not the flake) |

**Root cause (by reading the code, then proven deterministically).** The last assertion calls `AuthClient.WaitForEmailsAsync(client, email, count: 5)`, which polled the Testing sink for only 5 s of wall time. The dispatcher sends each outbox row after a commit signal or a 1 s sweep, and the cap itself counts issued codes in the database, not sent mail, so the 429 never depends on delivery. A loaded machine that delivers the fifth email more than 5 s late made the wait throw `TimeoutException`. Code-lifetime expiry was ruled out (15 min against 6 min of stepped clock).

**RED.** `TheSixthCodeIsStillRefusedWhenMailLeavesSlowly` wraps `IEmailTransport` so each send takes 1.3 s (five emails need over 6 s). It failed with `System.TimeoutException : The sink held fewer than 5 messages for the address within 00:00:05.` on the same line as the original assertion. Semantic assessment: the target ran and failed on the planned wait, which is the suspected cause. Commit `b5fd168 test(05-04): reproduce the resend cap flake`. The cap proof was moved into one helper (`AssertSixthCodeIsRefusedAsync`) used by both facts; the assertions are unchanged.

**GREEN.** `AuthClient.Patience` 5 s to 30 s (returns the moment the mail is there). Commit `8294272 fix(05-04): resend cap test waits for what it proves`.

**Verification after the fix.**

- `ResendCodeEndpointTests`: 10 consecutive runs, all green (6 tests each).
- Three consecutive full `dotnet test --project tests/Csps.Server.IntegrationTests` runs: 657 of 657, 657 of 657, 657 of 657 (64 s to 69 s).
- `dotnet test --project tests/Csps.Infrastructure.IntegrationTests`: 426 total, 425 passed, 1 skipped (pre-existing), 0 failed.
- `grep -c "auth.resend-cap"` and `grep -c "Retry-After"` in the test file are both at least 1; the 429, no-Retry-After, detail text and exactly-five assertions are all still there.

## Task Commits

1. Task 1 RED/enforcement: `2e205b7` test(05-04): only the audit append-only trigger may exist (D-06)
2. Task 2 RED: `b5fd168` test(05-04): reproduce the resend cap flake
3. Task 2 GREEN: `8294272` fix(05-04): resend cap test waits for what it proves

## Deviations from Plan

None - plan executed exactly as written. Notes that are not deviations:

- The plan's expected cause (sink read racing the dispatcher sweep, or `WaitForEmailsAsync` timing out) was confirmed as the second candidate. No production code changed.
- The fix touches the shared `Patience`, so every other test that waits for mail gets the same headroom. Passing tests are not slower.
- The new slow-mail fact adds about 8 s to the Server integration run.

## Issues Encountered

None. One scratch-only RED edit was broken by a shell quoting slip and redone before running; nothing from it was committed.

## Known Stubs

None.

## Threat Flags

None. Threat register: T-05-08 mitigated by the two facts; T-05-09 mitigated (cap, 429 code, no-Retry-After and exactly-five assertions kept); T-05-SC no installs.

## TDD Gate Compliance

RED (`test(05-04)`) commits precede the GREEN (`fix(05-04)`) commit for the flake. The trigger tracer has no GREEN because the schema already complies (stated in the plan). Plan type is `execute`, not `tdd`, so no `feat` commit is expected.

## Next Phase Readiness

Ready for 05-05. Its migration adds columns only (OR-7), so `TriggerInventoryTests` stays green in either order.

## Self-Check: PASSED

- FOUND: tests/Csps.Infrastructure.IntegrationTests/Persistence/TriggerInventoryTests.cs
- FOUND: tests/Csps.Server.IntegrationTests/Auth/ResendCodeEndpointTests.cs, AuthClient.cs, 04-identity-authentication/deferred-items.md (modified)
- FOUND commits: 2e205b7, b5fd168, 8294272 (all ancestors of HEAD)
