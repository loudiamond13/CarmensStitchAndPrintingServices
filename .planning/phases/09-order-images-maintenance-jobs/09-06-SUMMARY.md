---
phase: 09-order-images-maintenance-jobs
plan: 06
subsystem: api
tags: [maintenance, jobs, secret-key, idempotency-purge, fixed-time-compare]

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-01 (phase tracer; Application, Infrastructure and Server layout for Phase 9)
provides:
  - IMaintenanceJob, MaintenanceJobReport, MaintenanceLine, MaintenanceRunResponse, MaintenanceBudget (Application)
  - RunMaintenanceHandler (jobs by Order then Name; ok means no failed line; more means any job has work left)
  - PurgeExpiredRecordsJob (Order 10) and AddCspsMaintenance (Infrastructure)
  - POST /api/v1/maintenance/run behind X-Maintenance-Key, RequireMaintenanceKey, MaintenanceKey (Server)
affects: [09-07, 09-08, 09-11, 09-12, 09-14]

created: "2026-11-03T09:40:00-06:00"
updated: "2026-11-03T09:40:00-06:00"

actuals:
  tokens: 21000
  tasks: 2
  commits: 3

plan_head_before: 1be7162eeb65ccb270d21dc8cdd6f11214d62e24
plan_head_after: 114f1d0b383073469df5303899cfa3876a0e2843
commits: 3

tech-stack:
  added: []
  patterns:
    - "A job is one IMaintenanceJob registered as scoped; the runner orders by Order then Name, so later phases only register a job"
    - "Machine-call key check copies ProbeKey: SHA-256 of both values, CryptographicOperations.FixedTimeEquals, closed when the key is unset or under 32 characters"

key-files:
  created:
    - src/Csps.Application/Maintenance/IMaintenanceJob.cs
    - src/Csps.Application/Maintenance/MaintenanceRunResponse.cs
    - src/Csps.Application/Maintenance/MaintenanceBudget.cs
    - src/Csps.Application/Maintenance/RunMaintenanceHandler.cs
    - src/Csps.Infrastructure/Maintenance/PurgeExpiredRecordsJob.cs
    - src/Csps.Infrastructure/Maintenance/MaintenanceRegistration.cs
    - src/Csps.Server/Controllers/MaintenanceController.cs
    - src/Csps.Server/Security/MaintenanceKey.cs
    - src/Csps.Server/Security/RequireMaintenanceKeyAttribute.cs
    - src/Csps.Server/Composition/MaintenanceApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Maintenance/MaintenanceEndpointTests.cs
    - tests/Csps.Application.UnitTests/Maintenance/RunMaintenanceHandlerTests.cs
    - tests/Csps.Application.UnitTests/Maintenance/MaintenanceBudgetTests.cs
  modified:
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Composition/ApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Idempotency/IdempotencyAllowList.cs

key-decisions:
  - "A refused call (missing, wrong, short or unset key) always answers 401 with the one message 'The maintenance key is missing or wrong.' and code maintenance.key, so the answer reveals nothing about the host"
  - "The 'Expired request keys removed' count adds expired idempotency records and expired claim rows into one number"
  - "The runner returns Result<MaintenanceRunResponse> so plan 09-11 can add a 409 for a taken lease without changing the signature"

requirements-completed: [JOB-01]

status: complete
duration: 35min
completed: 2026-11-03
---

# Phase 9 Plan 06: A keyed maintenance call runs the jobs and purges expired request keys Summary

**`POST /api/v1/maintenance/run` runs every registered job in order for a caller that sends the secret `X-Maintenance-Key`, answers counts only, and already removes expired request keys and claims; any other caller gets a 401 and nothing runs.**

## Performance

- **Duration:** about 35 min (08:58 to 09:34, -06:00), plus a 9.5 min full server run
- **Tasks:** 2 (Task 1 tracer, Task 2 auto), 3 commits

## Accomplishments

- The job contract and runner. `IMaintenanceJob` has `Order`, `Name` and `RunAsync(MaintenanceBudget, ct)`. `RunMaintenanceHandler` runs jobs by `Order`, then by `Name`, whatever their registration order. The run is `ok` when no line failed and `more` when any job reports work left. `MaintenanceBudget` is a 90 second deadline read from `TimeProvider`.
- `PurgeExpiredRecordsJob` (Order 10) deletes `IdempotencyRecords` with `ExpiresAt <= now` and `DatabaseLocks` claims with `ExpiresAtUtc <= now` through `ExecuteDeleteAsync` and reports "Expired request keys removed". A database failure is logged with a source-generated log method and becomes a failed line, never an exception text in the answer.
- The key check. `MaintenanceKey.Matches` hashes both values with SHA-256 and compares with `CryptographicOperations.FixedTimeEquals`; it is false when the configured key is unset or under 32 characters. `RequireMaintenanceKey` writes the 401 ProblemDetails with code `maintenance.key` before the action runs.
- The endpoint is `[AllowAnonymous]`, `[RequireMaintenanceKey]`, `[IdempotencyExempt]` with a written reason, `[ApiExplorerSettings(IgnoreApi = true)]` and not cached. The OpenAPI snapshot is unchanged.
- Every discovery gate knows the endpoint: a matrix row (401 for anonymous, Admin and Manager), the anonymous allow-list entry and the idempotency allow-list entry.

## Task Commits

1. **Task 1 (tracer) and the gate entries of Task 2, RED:** `551a8968` (test; 7 failing: 6 endpoint tests plus the idempotency coverage gate, and the 3 matrix cases for the new row)
2. **Task 1 GREEN:** `75586723` (feat; contract, runner, job, key, filter, controller, registration)
3. **Task 2 ordering and runner tests:** `114f1d0b` (test)

## TDD Gate Compliance

- RED `551a8968`: `dotnet test` on `MaintenanceEndpointTests`, `AuthorizationMatrixTests` and `IdempotencyCoverageTests` ended with `failed: 12` (the keyed call and the five refusals met 404, the matrix row met 404 for all three callers, and the coverage gate reported the allow-list entries matched no endpoint).
- GREEN `75586723`: the same classes plus `OpenApiSnapshotTests` ended with `total: 378, failed: 0, succeeded: 378`.
- The ordering test in `114f1d0b` passed on its first run, because the runner was built with the ordering. To prove it can fail, I removed the `OrderBy`/`ThenBy` in the handler for one run: `JobsRunByOrderWhateverTheirRegistrationOrder` failed (`failed: 1, succeeded: 6`). I restored the handler (no diff against `75586723`) and the class passed again.

## Checks I saw

- Task 1 and Task 2 verify set (`MaintenanceEndpointTests`, `AuthorizationMatrixTests`, `IdempotencyCoverageTests`, `OpenApiSnapshotTests`): `total: 379, failed: 0, succeeded: 379`.
- `dotnet format Csps.slnx --verify-no-changes`: no output, exit 0.
- `Csps.ArchitectureTests`: `total: 263, failed: 0`. `Csps.Application.UnitTests`: `total: 1971, failed: 0` before the new tests; the new `Maintenance` namespace alone: `total: 10, failed: 0`.
- Acceptance criteria: `grep -c "IgnoreApi = true"` on the controller prints 1; `grep -c FixedTimeEquals` on `MaintenanceKey.cs` prints 1; `grep -c "maintenance/run"` on `AuthorizationMatrix.cs` prints 2; `git diff --stat -- tools/openapi-gen/openapi.v1.json` prints nothing.
- Full `Csps.Server.IntegrationTests` run after preflight: `total: 1889, failed: 2, succeeded: 1887`, duration 9m 28s. The two failures were `OrderListTimingTests.TheListAnswersUnder300MsAtP95OnFiveYearsOfOrders` and `ExpenseListTimingTests.TheListAndTheKpisAnswerUnder300MsAtP95OnFiveYearsOfData`, both already recorded in `deferred-items.md`. Re-run alone, each passed (`total: 1, failed: 0`). They are recorded as load-sensitive flakes, not hidden. No regression in `AuthorizationMatrixTests`, `IdempotencyCoverageTests` or `OpenApiSnapshotTests`.
- `gitleaks protect --staged --no-banner` before each commit: "no leaks found". The test key is 40 repeated letters built in the test; no key text is in any file.

## Decisions Made

- A refused call answers one fixed message for a missing, wrong, short and unset key (the plan's wording), so nothing about the host leaks.
- The purge line adds expired records and expired claims into one number, because both are "request keys" to the owner reading the run summary.
- The handler returns `Result<MaintenanceRunResponse>` although this plan never fails it, so plan 09-11 can map a taken lease to 409 without changing the signature.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The anonymous allow-list also needed the new endpoint**
- **Found during:** Task 1 (RED)
- **Issue:** `AuthorizationMatrix.cs` has a second list, `AnonymousAllowList`, that every anonymous endpoint must be in. The plan named only the matrix row and the idempotency allow-list entry. Without the entry the authorization coverage test fails on the new endpoint.
- **Fix:** Added `"POST /api/v1/maintenance/run"` to `AnonymousAllowList` in the same file the plan already lists.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`
- **Commit:** `551a8968`

**2. [Rule 2 - Missing critical] Unit tests for the runner and the budget**
- **Found during:** Task 2
- **Issue:** The plan lists endpoint tests only, but Application must keep 95% coverage and `RunMaintenanceHandler` and `MaintenanceBudget` hold the ok, more, ordering and deadline rules.
- **Fix:** Added `RunMaintenanceHandlerTests` (order then name, failed line, more, no jobs, one shared budget) and `MaintenanceBudgetTests` in `Csps.Application.UnitTests`.
- **Files modified:** `tests/Csps.Application.UnitTests/Maintenance/*`
- **Commit:** `114f1d0b`

**3. [Plan ordering] The matrix row and allow-list entries went into the Task 1 RED commit**
- **Issue:** Once the controller exists, the discovery gates fail unless the row and entries are already there. Keeping them for a later commit would leave a failing GREEN commit.
- **Fix:** They were added with the Task 1 RED tests, so one RED commit fails on both the endpoint and the gates, and one GREEN commit passes all of them. Task 2's ordering tests came last (see TDD Gate Compliance for the mutation check).

**Total deviations:** 3 (1 blocking fix, 1 added tests, 1 commit-order choice). **Impact:** none on behavior; scope stays inside JOB-01.

## Known risks left on purpose (planned later)

- The endpoint has no rate limit yet. Guessing the key is not throttled until plan 09-12 (T-09-16 names that plan). The 32 character minimum and the fixed-time compare are in place now.
- No database lease or failure isolation yet: two simultaneous runs both purge (harmless), and a thrown non-database error in a job would answer a generic 500. Plan 09-11 adds the lease, isolation and the budget use.
- The key is not in any `appsettings` file by design. A host without `Maintenance:Key` leaves the endpoint closed (401).

## Known Stubs

None.

## Threat Flags

None. The new anonymous endpoint is the one the plan's threat model names (T-09-16, T-09-18, T-09-20).

## Issues Encountered

Two known timing tests failed in the full run and passed alone (see Checks I saw). Nothing else.

## Next Phase Readiness

Plans 09-07 and later can register a job with one `AddScoped<IMaintenanceJob, ...>` line in `MaintenanceRegistration`. Plan 09-11 adds the lease and budget use, and plan 09-12 adds the rate limit, log masking and runbook.

## Self-Check: PASSED

- Files: all 13 created and 4 modified files above exist on disk.
- Commits: `551a8968`, `75586723` and `114f1d0b` are ancestors of HEAD.
