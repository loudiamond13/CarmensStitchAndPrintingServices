---
phase: 13-quote-inquiries
plan: 03
subsystem: maintenance
tags: [github-actions, maintenance, cloudinary, tdd]
requires: []
provides:
  - daily maintenance schedule (cron 17 19 * * *)
  - CloudinaryUsageJob monthly pace via cursor cloudinary-usage-month
affects: [13-08, 13-16]
tech-stack:
  added: []
  patterns: [monthly pace kept in IMaintenanceCursors]
key-files:
  created: []
  modified:
    - .github/workflows/maintenance.yml
    - tests/Csps.ArchitectureTests/MaintenanceWorkflowTests.cs
    - src/Csps.Application/Maintenance/CloudinaryUsageJob.cs
    - tests/Csps.Application.UnitTests/Maintenance/CloudinaryUsageJobTests.cs
    - tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs
    - web/scripts/maintenance.mjs
    - docs/operations/maintenance.md
decisions:
  - "D-34 applied: the maintenance call is daily at 19:17 UTC; the usage check reports once per business month"
requirements-completed: [INQ-07]
status: complete
duration: 25m
completed: 2026-11-22
commits: 4
plan_head_before: 4007cc6132a44baa4997cc37433b37b24fb7695a
plan_head_after: 7c791265e2ea2ad2d24cbe20aa583e230255b182
actuals:
  tokens: 14000
  tasks: 2
  commits: 4
created: 2026-11-22T16:20:00-06:00
updated: 2026-11-22T16:20:00-06:00
---

# Phase 13 Plan 03: Daily cleanup run Summary

*Created: 2026-11-22T16:20:00-06:00 · Updated: 2026-11-22T16:20:00-06:00*

The maintenance workflow now runs every day at 19:17 UTC (03:17 Manila), and the Cloudinary usage check reports only on the first run of each business month.

## What changed

- `maintenance.yml`: cron `17 19 * * *`, job name `daily maintenance`, comments say daily. Permissions, concurrency and the main-only guard are untouched.
- `MaintenanceWorkflowTests.RunsDailyAndOnRunNowOnly` pins the new cron line. The job name and the runbook phrase checks now expect `daily maintenance` and `17 19 * * *`.
- `CloudinaryUsageJob` takes `IMaintenanceCursors` and `IBusinessCalendar`. It compares the business month (`yyyy-MM`, Manila) with the cursor `cloudinary-usage-month`. Equal means no lines and no storage call. The month is saved only after a successful read, so a failed read is tried again on the next daily run. The "not set up" line is unchanged and never moves the cursor.
- Docs: `maintenance.md` (schedule table, new "The usage check" section, 60-day inactivity advice kept), plus the CI guide, the Cloudinary and mail setup notes, and the `maintenance.mjs` header.

## TDD evidence

- Task 1 RED (`cad42270`): `MaintenanceWorkflowTests` total 23, failed 3 (cron line, job name, runbook phrase). GREEN (`866bcbd5`): total 23, failed 0. Whole architecture project: total 290, failed 0.
- Task 2 RED (`2f1067fd`): build errors CS1729 (no 5-argument constructor) and CS0117 (no `CursorName`). GREEN (`7c791265`): `CloudinaryUsageJobTests` total 25, failed 0; full Application unit tests total 3185, failed 0; `MaintenanceEndpointTests` total 14, failed 0 (`CSPS_TEST_SQL=localdb`, preflight clean); `dotnet build Csps.slnx -warnaserror` 0 warnings, 0 errors.
- Acceptance greps: `cron: "17 19 * * *"` count 1, old cron count 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Wording in files outside the plan list**
- **Found during:** Task 1
- **Issue:** `TheRunbooksDescribeTheWorkflow` also reads `docs/operations/ci.md` for the job name, so the guide had to say `daily maintenance` for the test to pass. Other docs and doc comments still said monthly.
- **Fix:** Reworded `ci.md`, `cloudinary-setup.md`, `mail-setup.md`, `maintenance.test.ts` header, and the doc comments in `StraySweepJob.cs`, `OrderImagesController.cs`, `ProductLinePhotosController.cs`, `SharePictureController.cs`. Wording only.
- **Commits:** 866bcbd5, 7c791265

**2. [Plan text] Branch and commit trailer**
- The plan's executor rules name branch `gsd/phase-13-quote-inquiries` and an Opus trailer. This run used the orchestrator's worktree branch and the trailer from the run's attribution instruction (`Co-Authored-By: Claude Sonnet 5.5`).

## Known Stubs

None.

## Threat Flags

None. T-13-07 is mitigated by the daily run and the pinned cron test.

## Notes for the owner

- The schedule takes effect only after the merge to `main`. Run now was not pressed and the live site was not called.
- A scheduled daily run does not count as repository activity for GitHub's 60-day pause rule. The runbook keeps that advice.

## Self-Check: PASSED

All four commits exist (`cad42270`, `866bcbd5`, `2f1067fd`, `7c791265`); modified files verified present.
