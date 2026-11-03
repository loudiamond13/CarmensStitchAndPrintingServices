---
phase: 09-order-images-maintenance-jobs
plan: 12
subsystem: maintenance
tags: [rate-limit, secrets, logging, runbook]
requires: [09-06]
provides:
  - "RateLimitPolicies.Maintenance (maintenance-run), rule section RateLimits:Maintenance, default 12 per 10 minutes per address"
  - "MaintenanceKey as an exact masked log property name"
  - "docs/operations/maintenance.md runbook"
affects: [09-10, 09-11]
key-files:
  created:
    - tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceKeyTests.cs
    - tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceKeySafetyTests.cs
    - docs/operations/maintenance.md
  modified:
    - src/Csps.Server/Security/RateLimitSettings.cs
    - src/Csps.Server/Security/RateLimitingRegistration.cs
    - src/Csps.Server/Controllers/MaintenanceController.cs
    - src/Csps.Server/Logging/SensitiveDataMasking.cs
    - tests/Csps.Server.IntegrationTests/Logging/SensitiveDataMaskingTests.cs
    - tests/Csps.Server.IntegrationTests/RateLimiting/RateLimitTests.cs
status: complete
commits: 5
plan_head_before: a1d18a3d28a836800e1be90444bb3df42b877a05
plan_head_after: 90a84ec2
actuals:
  tasks: 3
  commits: 5
created: 2026-11-03T12:40:00-06:00
updated: 2026-11-03T12:40:00-06:00
---

# Phase 9 Plan 12: Maintenance key throttle, log masking and runbook Summary

*Created: 2026-11-03T12:40:00-06:00 · Updated: 2026-11-03T12:40:00-06:00*

Per-address sliding-window throttle (12 calls per 10 minutes) on the maintenance run, edge tests for the key, proof that the key never reaches a log or reply, and the owner runbook `docs/operations/maintenance.md`.

## Commits

| Hash | Message |
|---|---|
| 007c9919 | test(09-12): the 13th maintenance call from one address must answer 429 (RED) |
| 1164ebfb | feat(09-12): throttle the maintenance run to 12 calls per 10 minutes per address (GREEN) |
| bede86e3 | test(09-12): pin the key comparison edges and keep the key out of logs and replies |
| 1328db15 | feat(09-12): name the maintenance key as a masked log property |
| 90a84ec2 | docs(09-12): add the maintenance runbook with the key, its rotation and the answers |

## What was done

- **Task 1 (tracer):** `RateLimitPolicies.Maintenance = "maintenance-run"`, a `MaintenanceRateLimit` helper (section `RateLimits:Maintenance`, default 12 per 10 minutes, validation that names the setting and never a value), registered through the existing `AddPolicy`, and `[EnableRateLimiting]` on the run action (plus a 429 response type). Wrong-key calls count against the same limit, so guessing is throttled. A second address still runs.
- **Task 2:** `MaintenanceKeyTests` pins every comparison edge. `MaintenanceKeySafetyTests` proves no log event holds the key after a keyed run, and a wrong-key 401 neither echoes the sent value in the body or headers nor logs it. `SensitiveDataMaskingTests` gains `MaintenanceKey` name cases and a destructured-object case. `MaintenanceKey` is now an exact name in `SensitiveDataMasking`.
- **Task 3:** runbook covering the run order, endpoint and header, how to make a key, where it lives (`Maintenance__Key`, user-secrets `Maintenance:Key`, `MAINTENANCE_KEY`), rotation, 401/409/429, the 90-second budget and `more`, and the counts-only rule. No key value or key-like example.

## Checks seen

- RED: `dotnet test ... --filter-class "*MaintenanceKeySafetyTests"` failed 2 of 2 (13th call answered 401/200, not 429).
- GREEN, tasks 1: `--filter-class "*MaintenanceKeySafetyTests" --filter-class "*RateLimitTests"`: total 28, failed 0, succeeded 28. Earlier wider run with RateLimitPartitionTests and MaintenanceEndpointTests: total 47, failed 0.
- Task 2: `--filter-class "*MaintenanceKeyTests" --filter-class "*MaintenanceKeySafetyTests" --filter-class "*SensitiveDataMaskingTests"`: total 67, failed 0, succeeded 67 (run before and after the masking entry).
- `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- `gitleaks protect --staged --no-banner` before every commit: no leaks found.
- Runbook grep: `Maintenance__Key` 2 matches, `MAINTENANCE_KEY` 2 matches, no em or en dash.
- Not run: the full server integration suite (the plan's closing verification). Only the named classes plus RateLimitPartitionTests and MaintenanceEndpointTests ran; RateLimitTests and SensitiveDataMaskingTests, the two classes the plan names for regression, passed in full.

## Deviations from Plan

**1. [Process] The Task 2 tests passed on first run, so there is no separate RED for them.** `MaintenanceKey.Matches` already handled every edge (plan 09-06), and the `Key` suffix rule already masked `MaintenanceKey`. They are characterization tests; the exact-name entry in `SensitiveDataMasking` was added as the explicit change the plan asks for. No MaintenanceKey code change was needed.

**2. [Rule 3 - Blocking] `RateLimitTests.LimitedEndpoints` gained a row** (`POST /api/v1/maintenance/run`, 12) because its test `EveryRateLimitedEndpointIsInTheList` fails for any rate-limited endpoint missing from the list. Commit 1164ebfb.

**3. Preflight not run.** The sandbox refused to launch PowerShell, so `preflight.ps1` could not run. These tests use only the in-memory test server and `CSPS_Test_<guid>` LocalDB databases; no dev server, Playwright run or fixed port was used. No background process was left running.

**4. Plan commit ledger file** (task_commit_protocol 0c) could not be written (the sandbox refused the git-dir command). `commits` was measured directly: `git log --oneline a1d18a3d..HEAD` shows 5.

## Known Stubs

None.

## Threat Flags

None. T-09-76 and T-09-77 mitigations are in place and tested.

## Owner backlog items (for the orchestrator to copy into STATE.md)

- [ ] Plan 09-12 runbook says the monthly workflow (D-21) "is added by a later plan". When that workflow is created, check that it sends the key from the `MAINTENANCE_KEY` secret in the `X-Maintenance-Key` header, and that the owner has set `MAINTENANCE_KEY` (GitHub) and `Maintenance__Key` (host app-pool variable) to the same value of at least 32 characters. Only the owner can do this.
- [ ] Plan 09-12 runbook describes a 409 as "another run is already going". That behavior comes from plan 09-11 (the lease). After 09-11 merges, re-read the 409 row of `docs/operations/maintenance.md` against what 09-11 actually returns.
- [ ] The runbook's job table lists orders 20, 30 and 40 as "a later plan". When plans 09-10 and later land, update that table to the real jobs (docs only).

## Self-Check: PASSED

- Files found: MaintenanceKeyTests.cs, MaintenanceKeySafetyTests.cs, docs/operations/maintenance.md, RateLimitSettings.cs, RateLimitingRegistration.cs, MaintenanceController.cs, SensitiveDataMasking.cs.
- Commits 007c9919, 1164ebfb, bede86e3, 1328db15, 90a84ec2 are ancestors of HEAD; base a1d18a3d is an ancestor of HEAD.
