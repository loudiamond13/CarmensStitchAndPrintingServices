---
phase: 01-hosting-verification-backend-foundation
plan: 03
subsystem: api
tags: [health-checks, timeprovider, timezone, business-calendar, efcore10, localdb, xunit-v3, faketimeprovider]

# Dependency graph
requires:
  - phase: 01-02
    provides: "ISiteSettingsReader (HybridCache), TimeZoneResolver + ZoneSource, CspsDatabase fixture, CspsApiFactory.ForDatabase, AddInfrastructure"
provides:
  - "Domain: BusinessClock(Zone, Source, UtcNow) with LocalNow, Today, Year, MonthOf, UtcRange, MonthUtcRange, YearUtcRange (DST gap and ambiguous midnight handled)"
  - "Application: IBusinessCalendar.GetClockAsync(CancellationToken)"
  - "Infrastructure: BusinessCalendar (TimeProvider + cached SiteSettings zone), DatabaseHealthCheck ('database'), TimeZoneHealthCheck ('time-zone'), both with a 3 s timeout; TryAddSingleton(TimeProvider.System); AddLogging"
  - "Server: MinimalHealthWriter sends no body for HEAD"
  - "/health end to end: self, database, time-zone; 200 Healthy/Degraded, 503 Unhealthy; Cache-Control: no-store on every response"
affects: [01-04, 01-06, 01-11, 01-13, orders, dashboard, expenses, SEC-03]

# Actuals (#2632)
actuals:
  tokens: 8311    # chars/4 over the 12 changed files (33,246 chars)
  tasks: 3
  commits: 7
plan_head_before: cb1843a45f1d1643e54c8e9a98a46ac2eba7101c
plan_head_after: 586a23d372e96d2f34cea472ef5f727b45b026e3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Business time: IBusinessCalendar.GetClockAsync -> BusinessClock; ranges are [StartUtc, EndUtcExclusive) built from local midnights"
    - "Every database-backed health check carries the shared 3 s HealthCheckTimeout (checks run in parallel)"
    - "Tests swap the clock by registering a FakeTimeProvider before AddInfrastructure (TryAddSingleton keeps it)"
    - "Health tests assert exact bodies plus a property-name whitelist (status, checks, name) via HealthBody"

key-files:
  created:
    - src/Csps.Domain/Time/BusinessClock.cs
    - src/Csps.Application/Ports/IBusinessCalendar.cs
    - src/Csps.Infrastructure/Time/BusinessCalendar.cs
    - src/Csps.Infrastructure/Health/DatabaseHealthCheck.cs
    - src/Csps.Infrastructure/Health/TimeZoneHealthCheck.cs
    - tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Time/BusinessCalendarTests.cs
    - tests/Csps.Server.IntegrationTests/Health/HealthEndpointFailureTests.cs
    - tests/Csps.Server.IntegrationTests/Health/HealthBody.cs
  modified:
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Http/MinimalHealthWriter.cs
    - tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs

key-decisions:
  - "The time-zone health check gets the same 3 s timeout as the database check: on a cold cache it reads SiteSettings, and SqlClient retries a failed login after 10 s, so without it /health took 10 s with the database unreachable"
  - "AddInfrastructure calls AddLogging (TryAdd only) so the health service validates on a plain ServiceCollection (tools/ commands, integration tests)"
  - "BusinessClock.MonthOf is static (it does not depend on the zone); a local midnight in a DST gap starts the day at the first valid minute, and an ambiguous midnight starts it at the first occurrence"
  - "MinimalHealthWriter returns no body for HEAD but keeps the status, Content-Type and Cache-Control: no-store"

patterns-established:
  - "Health check names are public constants on DependencyInjection (DatabaseHealthCheckName, TimeZoneHealthCheckName)"
  - "Mutation record for tests that pass on arrival: temporarily break production code, show the failures, revert with git checkout -- <file>"

requirements-completed: [FND-06, FND-08]

coverage:
  - id: D1
    description: "GET /health on a migrated CSPS_Test database returns 200 with self, database and time-zone all Healthy, in that order, anonymously, with Cache-Control: no-store and only status/name keys"
    requirement: FND-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs#ReturnsHealthyWithAllChecks, IsNotCacheable, ExposesNoInternals"
        status: pass
    human_judgment: false
  - id: D2
    description: "/health failure modes: unreachable DB -> 503 exact minimal body in about 3 s; missing SiteSettings row -> 503 time-zone Unhealthy; unknown stored zone -> 200 Degraded; Accept text/html -> JSON; HEAD -> same status, no-store, empty body; no exception/SQL/connection-string/timing/version text"
    requirement: FND-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Health/HealthEndpointFailureTests.cs (5 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "BusinessClock Manila day, month and year boundaries (D-03 calendar year), MonthOf incl. leap year, exclusive end, reversed range rejected, DST gap and ambiguous midnight; Domain 100% line and branch coverage"
    requirement: FND-08
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs (9 tests)"
        status: pass
      - kind: other
        ref: "coverlet.MTP cobertura over [Csps.Domain]*: lines 88/88, branches 14/14 (temporary reference, reverted)"
        status: pass
    human_judgment: false
  - id: D4
    description: "IBusinessCalendar reads the stored zone from the migrated SiteSettings row and now from the registered TimeProvider (FakeTimeProvider at 2026-10-06T16:00Z -> Today 2026-10-07, Source Stored)"
    requirement: FND-08
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Time/BusinessCalendarTests.cs#UsesStoredZoneAndFakeClock"
        status: pass
    human_judgment: false
  - id: D5
    description: "No production code reads DateTime.Now/UtcNow/Today or DateTimeOffset.Now/UtcNow (RS0030); build has 0 warnings"
    requirement: FND-08
    verification:
      - kind: other
        ref: "dotnet build Csps.slnx -tl:off (0 Warning(s), 0 Error(s)); grep over src finds no banned clock API"
        status: pass
    human_judgment: false

# Metrics
duration: 13min
completed: 2026-10-07
status: complete
---

# Phase 1 Plan 03: Business Calendar and /health Summary

**`GET /health` now reports `self`, `database` and `time-zone` end to end. The zone comes from the migrated SiteSettings row, through the cached port, into `IBusinessCalendar` and the TimeZoneResolver chain. A pure `BusinessClock` gives Manila day, month and calendar-year boundaries as UTC ranges with an exclusive end, and every failure mode of /health stays minimal, uncacheable and bounded at about 3 s.**

## Performance

- **Duration:** 13 min
- **Started:** 2026-10-07T14:21:05Z
- **Completed:** 2026-10-07T14:34:25Z
- **Tasks:** 3 (Task 1 tracer, then Tasks 2 and 3)
- **Files modified:** 12 (9 created, 3 modified)

## Accomplishments

- The walking skeleton is complete. HTTP goes to the Server, then the Infrastructure health checks, then the cached SiteSettings read from the migrated database, then zone resolution, and /health reports all of it. `Program.cs` was not edited.
- `BusinessClock` (Domain, pure) adds `LocalNow`, `Today`, `Year`, `MonthOf`, `UtcRange`, `MonthUtcRange` and `YearUtcRange`. In a DST zone a Manager might store later, a midnight that falls in a gap starts the day at the first valid minute, and a midnight that happens twice starts it at the first occurrence. Domain coverage is 88/88 lines and 14/14 branches.
- `IBusinessCalendar` reads `TimeProvider` and the cached `ISiteSettingsReader`. `TimeProvider.System` is registered with `TryAddSingleton`, so tests swap in `FakeTimeProvider`.
- /health maps Healthy and Degraded to 200 and Unhealthy to 503. Every response, including HEAD, carries `Cache-Control: no-store`. The body never holds anything beyond `status` and name/status pairs.

## Task Commits

1. **Task 1: Tracer, /health reports database and the SiteSettings time zone through IBusinessCalendar**
   - RED: `4078bdd` (test)
   - GREEN: `f7b8dba` (feat)
   - Fix found in Task 2: `3b08b73` (fix, AddLogging in AddInfrastructure)
2. **Task 2: BusinessClock day, month and year boundaries in Manila**
   - RED: `585063d` (test)
   - GREEN: `e173303` (feat)
3. **Task 3: /health failure modes stay minimal and uncacheable**
   - RED: `f13a98d` (test)
   - GREEN: `586a23d` (feat)

**Plan metadata:** recorded in the docs commit for this SUMMARY.

## TDD Evidence

Each RED run was a target-only run with `--report-xunit-junit`, validated by `gsd check tdd-red-evidence`. Every one returned `RED_EVIDENCE_OK` (reason `target_test_failed`).

- **Task 1 RED:** the target was `ReturnsHealthyWithAllChecks`, which failed (exit 2) on the body assertion: expected three checks but got `{"status":"Healthy","checks":[{"name":"self","status":"Healthy"}]}`.
- **Task 1 GREEN:** HealthEndpointTests passed 3/3, ArchitectureTests 59/59, build had 0 warnings, and format exited 0.
- **Task 1 tracer gate:** auto mode was on and the task had no `gate` attribute (row 2). The tracer verify was re-run and passed 3/3 before Tasks 2 and 3 started.
- **Task 2 RED:** naive stubs went in: UTC year, UTC midnights, `MonthOf` returning `(day, day)`, and no range check. Of 9 tests, 8 failed. `TodayAtManilaMidnightBoundary` passed because Task 1 had already implemented `Today`. Two records were validated. `MonthStartsAtLocalMidnight` failed because the stub returned the UTC midnight of the given day. `SkipsInvalidLocalMidnightInDstZone` failed with `startUtc should be 11/1/2026 3:00:00 AM +00:00 but was ...`. `BusinessCalendarTests` covers Task 1's calendar, so it was not a RED target. It first failed on a DI validation error, which was a real regression (Deviation 1), and passed once that was fixed.
- **Task 2 GREEN:** BusinessClockTests passed 9/9, BusinessCalendarTests 1/1, and Domain 20/20 with 88/88 lines and 14/14 branches.
- **Task 3 RED:** the target was `HeadRequestCarriesNoStore`, which failed with `ReadBodyAsync(response) should be empty but was ...`: the writer sent the JSON body for HEAD. The other four tests passed on arrival, so a **mutation record** proves they discriminate. With the writer temporarily also writing `description` (`entry.Description ?? entry.Exception?.Message`), 7 of 8 health tests failed. The unreachable-database body leaked `"An exception has been raised that is likely due to a transient failure..."`. The mutation was reverted with `git checkout -- src/Csps.Server/Http/MinimalHealthWriter.cs`.
- **Task 3 GREEN:** HealthEndpointFailureTests passed 5/5 on two runs. The unreachable case took 3.0 s; before Deviation 2 it took 10.05 s.
- **REFACTOR:** none needed.

## Plan Verification

- Preflight was clean before the first test run and again before the full run: ports 5180/5115/7028/5199 free, and no dev/test processes from TheBETSLLC.
- `dotnet build Csps.slnx -tl:off`: 0 warnings, 0 errors (RS0030 clean).
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- `dotnet test --project tests/Csps.Server.IntegrationTests`: 8/8.
- `dotnet test --solution Csps.slnx`: **126/126 passed**. That is Domain 20, Infrastructure integration 39, Server integration 8 and Architecture 59.
- After the run, `(localdb)\CSPS` holds only `CSPS_Dev`, so no test databases were left behind.
- `src/Csps.Server/Program.cs` is unchanged since `cb1843a`.

## Files Created/Modified

- `src/Csps.Domain/Time/BusinessClock.cs`: pure business-time record with day, month and year math, including the DST gap and ambiguous-midnight rules.
- `src/Csps.Application/Ports/IBusinessCalendar.cs`: the port, `GetClockAsync(CancellationToken)`.
- `src/Csps.Infrastructure/Time/BusinessCalendar.cs`: TimeProvider plus the cached SiteSettings zone, resolved through `TimeZoneResolver.Resolve`. The clock itself is never cached.
- `src/Csps.Infrastructure/Health/DatabaseHealthCheck.cs`: `CanConnectAsync`. Healthy or Unhealthy, with no description.
- `src/Csps.Infrastructure/Health/TimeZoneHealthCheck.cs`: Stored gives Healthy, any fallback gives Degraded. A missing row surfaces as Unhealthy through the health service.
- `src/Csps.Infrastructure/DependencyInjection.cs`: `TryAddSingleton(TimeProvider.System)`, the scoped calendar, `AddLogging`, and the `database` and `time-zone` checks with the shared 3 s `HealthCheckTimeout`. Check names are public constants.
- `src/Csps.Server/Http/MinimalHealthWriter.cs`: returns after setting the headers when the request is HEAD.
- `tests/Csps.Server.IntegrationTests/Health/HealthEndpointTests.cs`: now runs against a `CspsDatabase` class fixture through `CspsApiFactory.ForDatabase` and checks the exact three-check body.
- `tests/Csps.Server.IntegrationTests/Health/HealthBody.cs`: property-name whitelist and a status parser.
- `tests/Csps.Server.IntegrationTests/Health/HealthEndpointFailureTests.cs`: the 5 failure-mode tests.
- `tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs`: 9 boundary tests, including a custom zone whose DST starts and ends at midnight.
- `tests/Csps.Infrastructure.IntegrationTests/Time/BusinessCalendarTests.cs`: FakeTimeProvider plus the stored zone, through `AddInfrastructure`.

## Decisions Made

- **Time-zone check timeout:** both database-backed checks share one 3 s `HealthCheckTimeout`. Without it the time-zone check, reading SiteSettings on a cold cache, waits for SqlClient's 10 s retry after the transient login error 4060. The checks run in parallel, so /health took as long as that read. The plan suggested `Connect Timeout=3` in the test factory, but that would have hidden the real production latency, contradicting T-01-11.
- **AddLogging in AddInfrastructure:** the health service needs `ILogger<>`. `AddLogging` only TryAdds, so the web host is unaffected, and plain `ServiceCollection` composition (tests, the future `tools/` seed command) validates.
- **`MonthOf` is static:** it does not depend on the zone. `DateTime.DaysInMonth` avoids an `AddMonths` overflow in December 9999.
- **Ambiguous midnight:** the day starts at the first occurrence, the larger UTC offset from `GetAmbiguousTimeOffsets`, so no hour of the day falls into the previous one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Registering the health checks broke AddInfrastructure on a plain ServiceCollection**
- **Found during:** Task 2 (first BusinessCalendarTests run)
- **Issue:** `AddHealthChecks` registers `DefaultHealthCheckService`, which needs `ILogger<>`. `SiteSettingsReaderTests` (5 tests) and the new `BusinessCalendarTests` build a `ServiceCollection` with `ValidateOnBuild` and failed with "Unable to resolve service for type ILogger`1[DefaultHealthCheckService]". Task 1's verify ran only the Server tests, so this was missed.
- **Fix:** `services.AddLogging()` in `AddInfrastructure`.
- **Files modified:** src/Csps.Infrastructure/DependencyInjection.cs
- **Verification:** Infrastructure integration 39/39, Server integration 3/3.
- **Committed in:** `3b08b73`

**2. [Rule 2 - Missing critical] /health latency was unbounded when the database was unreachable**
- **Found during:** Task 3 (GREEN run of `DatabaseUnreachableReturns503Minimal`, 10.05 s)
- **Issue:** only the database check had the 3 s timeout. On a cold cache the time-zone check reads SiteSettings, and SqlClient retries the failed login after 10 s. That broke T-01-11's "3 s timeout bounds worst-case latency" (CWE-400).
- **Fix:** the same 3 s timeout on the time-zone check. The test now asserts the request takes under 8 s; it measured 3.0 s on two runs.
- **Files modified:** src/Csps.Infrastructure/DependencyInjection.cs, tests/Csps.Server.IntegrationTests/Health/HealthEndpointFailureTests.cs
- **Verification:** HealthEndpointFailureTests 5/5 (3.03 s for the unreachable case); full solution 126/126.
- **Committed in:** `586a23d`

**3. [Rule 2 - Missing critical] Ambiguous local midnight handled, with a 9th BusinessClock test**
- **Found during:** Task 2
- **Issue:** the plan covered only the DST gap. For a midnight that happens twice, `ConvertTimeToUtc` assumes standard time, which starts the day an hour late and puts that hour's records in the previous day.
- **Fix:** use the larger ambiguous offset, which is the first occurrence. Added `AmbiguousLocalMidnightStartsAtFirstOccurrence`.
- **Files modified:** src/Csps.Domain/Time/BusinessClock.cs, tests/Csps.Domain.UnitTests/Time/BusinessClockTests.cs
- **Committed in:** `585063d` (test), `e173303` (implementation)

**4. [Rule 3 - Blocking] `CspsApiFactory.ForDatabase` instead of `new CspsApiFactory(connectionString)`**
- **Found during:** Task 1
- **Issue:** plan 01-02 made the `(string)` constructor protected (xUnit1056).
- **Fix:** `CspsApiFactory.ForDatabase(database.ConnectionString)`, one factory per test.
- **Committed in:** `4078bdd`

**5. [Rule 2 - Missing critical] Stronger leak assertions and a HealthBody helper (not in the plan's file list)**
- **Found during:** Task 1 and Task 3
- **Issue:** the previous `ExposesNoInternals` only denied some key names.
- **Fix:** `HealthBody` whitelists the property names (`status`, `checks`, `name`). The failure tests also check the raw body for `Data Source` and `CSPS_Test_`, in addition to the plan's list.
- **Committed in:** `4078bdd`, `f13a98d`

---

**Total deviations:** 5 auto-fixed (1 bug, 3 missing-critical, 1 blocking).
**Impact on plan:** all are small and keep the plan's intent. The only production behavior beyond the plan is the time-zone check timeout and `AddLogging`, and both make claims the plan already made actually hold.

## Issues Encountered

- `sed` could not edit the csproj for the temporary coverage reference (backslash paths), so the Edit tool was used. The reference and its lock-file change were reverted with `git checkout --` on those two files only.
- During the unreachable-database test, the health service logs the SqlException and the timeout at error level to the test console. That is server-side logging, never part of the response.

## Flagged Assumptions (carried from the plan)

- **FND-06:** /health stays unthrottled until SEC-03 rate limiting in Phase 4. Worst-case latency is now actually bounded at about 3 s, as measured.
- **FND-08:** Asia/Manila is fixed at +08:00 with no DST. A DST zone stored later is handled by the gap and ambiguous-midnight rules, both tested with a custom zone.

## User Setup Required

None.

## Next Phase Readiness

- Later "today", month KPI and order-number-year code should call `IBusinessCalendar.GetClockAsync` and query with `[StartUtc, EndUtcExclusive)` from `UtcRange`, `MonthUtcRange` or `YearUtcRange`.
- Plan 06 (same wave, owns `Program.cs`) can rely on the report order self, database, time-zone, because the Server registers `self` before calling `AddInfrastructure`.
- A future zone edit must call `ISiteSettingsCache.InvalidateAsync`. The calendar never caches the clock.

## Self-Check: PASSED

- All 9 created and 3 modified files exist on disk.
- Commits `4078bdd`, `f7b8dba`, `3b08b73`, `585063d`, `e173303`, `f13a98d` and `586a23d` are on `gsd/phase-1-hosting-verification-backend-foundation`. Each task has a `test(01-03)` RED commit before its `feat(01-03)` GREEN commit.
- All acceptance criteria for Tasks 1–3 were re-run and pass. Plan verification: build 0 warnings, format exit 0, `dotnet test --solution` 126/126, no leftover `CSPS_Test_` databases.

---
*Phase: 01-hosting-verification-backend-foundation*
*Completed: 2026-10-07*
