---
phase: 09-order-images-maintenance-jobs
plan: 11
subsystem: api
tags: [maintenance, jobs, database-lease, failure-isolation, batched-purge]

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-06 (maintenance runner, PurgeExpiredRecordsJob, MaintenanceBudget)
provides:
  - IMaintenanceRunLock and MaintenanceRunLock (claim 'maintenance-run', 3 minutes)
  - IMaintenanceJobLog and MaintenanceJobLog (server-log record of a job that threw)
  - MaintenanceErrors (maintenance.running 409, maintenance.job-failed line)
  - MaintenanceLine.Code (optional machine code on a run line)
  - Runner lease, per-job isolation; purge in batches of 500 with a budget check
affects: [09-12, 09-14, 09-22, 09-32]

created: "2026-11-03T16:40:00-06:00"
updated: "2026-11-03T16:40:00-06:00"

actuals:
  tokens: 30000
  tasks: 2
  commits: 4

plan_head_before: a1d18a3d28a836800e1be90444bb3df42b877a05
plan_head_after: dfe4ce97ef45778b9f6e44ad943c60ef436d8d11
commits: 4

tech-stack:
  added: []
  patterns:
    - "A job that throws becomes MaintenanceErrors.JobFailed(job.Name): label is the job name, fixed text, Code maintenance.job-failed; the exception goes to IMaintenanceJobLog only"
    - "Later jobs attach their own code the same way: a MaintenanceLine with the Code argument set (09-32 uses maintenance.backup-failed)"
    - "Batched purge: DrainAsync deletes OrderBy().Take(500) until a short batch; a full batch with a spent budget ends the pass with More"

key-files:
  created:
    - src/Csps.Application/Maintenance/MaintenanceErrors.cs
    - src/Csps.Application/Ports/IMaintenanceRunLock.cs
    - src/Csps.Application/Ports/IMaintenanceJobLog.cs
    - src/Csps.Infrastructure/Maintenance/MaintenanceRunLock.cs
    - src/Csps.Infrastructure/Maintenance/MaintenanceJobLog.cs
    - tests/Csps.Infrastructure.IntegrationTests/Maintenance/MaintenanceRunLockTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Maintenance/PurgeExpiredRecordsJobTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Maintenance/MaintenanceJobLogTests.cs
  modified:
    - src/Csps.Application/Maintenance/MaintenanceRunResponse.cs
    - src/Csps.Application/Maintenance/RunMaintenanceHandler.cs
    - src/Csps.Infrastructure/Maintenance/MaintenanceRegistration.cs
    - src/Csps.Infrastructure/Maintenance/PurgeExpiredRecordsJob.cs
    - tests/Csps.Application.UnitTests/Maintenance/RunMaintenanceHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs

key-decisions:
  - "A failed line for a job that threw uses the job's fixed Name as its label and the text 'The job failed. Check the server log.'"
  - "MaintenanceLine gets an optional trailing Code argument (default null), so every existing call keeps compiling"
  - "A cancelled run is never turned into a failed line: the catch skips exceptions while the call's token is cancelled"

requirements-completed: [JOB-01]

status: complete
duration: about 50 min of work across a restart
completed: 2026-11-03
---

# Phase 9 Plan 11: One run at a time, failures isolated, long work split across calls Summary

**The maintenance run now takes a 3 minute database lease (a second call gets 409 `maintenance.running`), isolates each job so a throwing job becomes a `maintenance.job-failed` line while the rest still run, and the purge deletes 500 rows at a time and stops with `more` when the 90 second budget is spent.**

## Accomplishments

- Lease: `MaintenanceRunLock` inserts `DatabaseLock.Claim("maintenance-run", holder, now, 3 min)` on its own short context. On a duplicate it clears the claim with a conditional `ExecuteDeleteAsync` (name and `ExpiresAtUtc <= now`) and tries one more insert. Release deletes by name and holder. The handler takes it before any job and releases it in a `finally` with `CancellationToken.None`.
- Isolation: each job runs in its own try and catch. A throw adds `MaintenanceErrors.JobFailed(job.Name)` (Failed true, Code `maintenance.job-failed`, fixed text, no error text) and logs through `IMaintenanceJobLog`. `ok` is false, the next job still runs.
- Budget: `PurgeExpiredRecordsJob` drains records, then claims, in `ExecuteDeleteAsync` batches of 500 (`OrderBy` plus `Take`). After a full batch it checks `budget.IsSpent`; spent means the report says `more`. Nothing is kept in memory between calls: the next call resumes from what the rows show.
- Registered in `AddCspsMaintenance`: the lock and the job log, both scoped.

## Task Commits

1. **Task 1 RED:** `2ce09622` (test; lock tests, two-at-once race, lease cases, with compiling stubs that always grant the lease)
2. **Task 1 GREEN:** `cacb2ca6` (feat; lock adapter and handler lease)
3. **Task 2 RED:** `ba2ca2dd` (test; throwing job, job log, 500-row batches)
4. **Task 2 GREEN:** `dfe4ce97` (feat; per-job catch, job log, batched purge)

## TDD Gate Compliance

- RED `2ce09622`: `RunMaintenanceHandlerTests` `total: 7, failed: 3`; `MaintenanceRunLockTests` `total: 6, failed: 6`; `MaintenanceEndpointTests` `total: 10, succeeded: 8` (the race test and the live-lease test failed on their assertions, "No call was refused while the other held the lease." and a 200 instead of a 409). The expired-lease endpoint test passed in RED because the existing purge already removes expired claims; it stays as a guard.
- GREEN `cacb2ca6`: the same three classes `7/7`, `6/6`, `10/10` passed; the endpoint and lock classes were run twice more, both green. `AuthorizationMatrixTests`, `IdempotencyCoverageTests` and `OpenApiSnapshotTests`: `total: 381, failed: 0`.
- RED `ba2ca2dd`: `RunMaintenanceHandlerTests` `total: 12, failed: 3`. `MaintenanceJobLogTests` failed (nothing was logged). `PurgeExpiredRecordsJobTests` first ran `failed: 4`; one of those was a mistake in my own test data (the "live" claims had an expiry of exactly now, which counts as expired). I fixed the data and re-ran: `failed: 3` of 6, on the intended assertions (three batches expected, 500 removed with `more`, the next call finishes the 700).
- GREEN `dfe4ce97`: handler `12/12`, Infrastructure Purge + JobLog + Lock classes `13/13`, `NoInlineSqlTests` `31/31`, `MaintenanceEndpointTests` `10/10`.
- RED stubs: the RED commits needed code that compiles (a compile error is not a valid RED), so `2ce09622` carries stub versions of the lock, the job log and the handler that accept the new arguments and ignore them. Real code came in the GREEN commits.

## Checks I saw

- `dotnet build Csps.slnx`: `0 Warning(s)`, `0 Error(s)`.
- `dotnet format Csps.slnx --verify-no-changes`: no output.
- `Csps.ArchitectureTests`: `total: 263, failed: 0`. `Csps.Application.UnitTests` (all): `total: 1991, failed: 0`.
- Acceptance greps: `maintenance-run` count in `MaintenanceRunLock.cs` is 1; `FromSql|SqlQuery|ExecuteSql` count is 0 in `MaintenanceRunLock.cs` and in `PurgeExpiredRecordsJob.cs`.
- `gitleaks protect --staged --no-banner` before each of the four commits: "no leaks found".
- I did not run the full `Csps.Server.IntegrationTests` suite (about 10 minutes, and the parallel executors share the machine); I ran the maintenance, authorization matrix, idempotency coverage and OpenAPI snapshot classes. No timing flake showed up in what I ran.
- The preflight script could not be started: this agent's shell refused to launch PowerShell from a worktree. The tests I ran use the in-process test host and `CSPS_Test_<guid>` LocalDB databases only; I started no dev server, no port and no Playwright.

## Decisions Made

- The failed line's label is the job's fixed `Name` (jobs have no separate label) and its text is "The job failed. Check the server log." Both are fixed strings. The wording is mine; see the owner backlog below.
- The code rides on a new optional `MaintenanceLine.Code`. A line with no code serializes as `"code": null`.
- The lease catch lets `OperationCanceledException` through while the call's token is cancelled, so a cancelled run is not hidden as a job failure; the lease is still released.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Application has no logging reference, so the handler cannot own a `[LoggerMessage]` method**
- **Found during:** Task 2 planning
- **Issue:** The plan says the handler logs the job name through a `[LoggerMessage]` method. `Csps.Application` references no logging package, and adding a package is not allowed without the owner.
- **Fix:** New port `IMaintenanceJobLog` in Application; `MaintenanceJobLog` in Infrastructure holds the `[LoggerMessage]` method. The handler calls the port. No package added.
- **Files modified:** `src/Csps.Application/Ports/IMaintenanceJobLog.cs`, `src/Csps.Infrastructure/Maintenance/MaintenanceJobLog.cs`, `MaintenanceRegistration.cs`
- **Commits:** `2ce09622`, `dfe4ce97`

**2. [Rule 2 - Missing critical] A run line had no place for the code**
- **Issue:** The plan says a failed line carries `maintenance.job-failed`, but `MaintenanceLine` had no code field.
- **Fix:** Added optional `Code` as the last argument (default null). Existing constructions are unchanged.
- **Files modified:** `src/Csps.Application/Maintenance/MaintenanceRunResponse.cs`
- **Commit:** `2ce09622`

**3. [Plan scope] Extra tests beyond the plan's list**
- `MaintenanceJobLogTests` (the new class), and handler tests for cancellation, release after a throw, and the exact error text. Application coverage rules apply to the handler.

**Total deviations:** 3 (1 blocking, 1 missing field, 1 added tests). **Impact:** none on behavior the plan asked for; no schema change, no trigger, no package.

## Known Stubs

None.

## Threat Flags

None. T-09-17 (lease, 409, budget) and T-09-19 (only rows past their own expiry, boundary tests on both sides) are mitigated as planned.

## Known risks left on purpose

- A run that is cut off after the lease expiry (a job still working past 3 minutes) could overlap a new run. The budget is 90 seconds, so this needs a job that ignores the budget.
- The batched purge reports `more` after a full batch with a spent budget even when exactly 500 rows were all that was left. The next call then reports 0. That is harmless.
- The purge job's database-failure path (the existing `SqlErrors.IsDatabaseFailure` catch) has no new test here.

## Owner backlog items (for the orchestrator to copy into STATE.md)

- [ ] Wording check (low priority, no one is blocked): the failed line for a job that threw reads "The job failed. Check the server log." with the job's technical name (for example `purge-expired-records`) as its label, and the 409 reads "A maintenance run is already going. Try again in a few minutes." (the 409 text is the plan's own). The failed-line text and the label are my wording because the plan gave none. Tell me if you want different words or a friendlier label per job. It is one constant (`MaintenanceErrors.JobFailedText`).
- [ ] Preflight could not be run from this agent (the shell refused to start PowerShell in a worktree). Nothing here needed a port, but the orchestrator may want to run `preflight.ps1` before the next full server run.

## Self-Check: PASSED

- Files: all created and modified files above exist on disk (checked with `git status` clean after the GREEN commit and the file list in each commit).
- Commits: `2ce09622`, `cacb2ca6`, `ba2ca2dd` and `dfe4ce97` are ancestors of HEAD; `a1d18a3d` is an ancestor of HEAD.
