---
phase: 07-order-domain-api
plan: 06
subsystem: api
tags: [orders, order-number, concurrency, race-test, new-year, rollback, database-lock]
created: "2026-10-28T11:20:00-05:00"
updated: "2026-10-28T11:20:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-05 OrderNumberAllocator under DatabaseLocks.OrderNumbers, OrderNumberBusyException, OrderErrors.Busy, OrderFixtures"
provides:
  - "ConcurrentRequests.SendAllTogetherAsync: N senders held at one gate and released together (the two-sender method now delegates to it)"
  - "OrderNumberingTests: 20-way create race (10 rounds), Manila New Year boundary, order date vs save year, busy lock answered 409 orders.busy end to end"
  - "OrderNumberAllocatorTests: rollback leaves no gap, busy lock raises OrderNumberBusyException within the wait"
  - "OrderNumberAllocator internal constructor that takes the lock wait (public constructor and DI path keep DatabaseLocks.DefaultWait)"
affects: [07-07, 07-08, 07-09, 07-10, 07-11, 07-12]

actuals:
  tokens: 6200
  tasks: 2
  commits: 6
plan_head_before: 63201fa3e376410581f98a1728a5d9328e30a022
plan_head_after: 68ff80522619e82b384267178d7d834964f7b740

tech-stack:
  added: []
  patterns:
    - "Fixed-clock test host for a date in the future: a derived host with FakeTimeProvider plus a JwtBearer LifetimeValidator that reads the same clock, because the bearer check uses the wall clock and TokenValidationParameters.TimeProvider is internal"
    - "A test-only internal constructor for a lock wait, so a busy-lock proof takes one second instead of ten"

key-files:
  created:
    - tests/Csps.Server.IntegrationTests/Orders/OrderNumberingTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderNumberAllocatorTests.cs
  modified:
    - tests/Csps.Testing/ConcurrentRequests.cs
    - src/Csps.Infrastructure/Orders/OrderNumberAllocator.cs

key-decisions:
  - "The allocator needed no fix for the race, New Year or rollback: the 07-05 lock-then-read design already held. Those tests are characterization tests, and the race test was shown able to fail by removing the lock for one run (500s)."
  - "OrderNumberAllocator gets an internal constructor (context, lock wait) and a public one (context) that calls it with DatabaseLocks.DefaultWait. The service container only sees public constructors, so the registered path is unchanged."
  - "The race test resets the database each round (and signs in two fresh accounts), so every round also races the first insert of the year's counter row, not only the increments."
  - "A fifth proof was added beyond the plan: an end-to-end busy-lock test (lock held on a separate SQL connection, POST waits 10 s, answers 409 orders.busy, counter and Orders unchanged, next create gets the next number). It closes the 07-05 deferred item for T-07-16."

requirements-completed: [ORD-14, ORD-03]

coverage:
  - id: D1
    description: "20 creates sent at the same moment with distinct keys all answer 201 with exactly ORD-{year}-0001 to 0020, and the counter reads 20 (10 rounds)"
    requirement: ORD-14
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderNumberingTests.cs#TwentyCreatesAtTheSameMomentGetTwentyDistinctContiguousNumbersEveryRound"
        status: pass
    human_judgment: false
  - id: D2
    description: "The year follows the Manila calendar of the save: 15:59:59Z is ORD-2026, 16:00:00Z is ORD-2027-0001, an order dated 2026-12-30 saved on 2027-01-02 gets a 2027 number, and the two years' counters run apart"
    requirement: ORD-14
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderNumberingTests.cs#OneSecondBeforeManilaMidnightTheNumberIsStillInTheOldYear"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderNumberingTests.cs#AtManilaMidnightTheFirstCreateOfTheNewYearGetsOne"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderNumberingTests.cs#TheCountersOfTwoYearsRunSeparatelyAcrossTheMidnight"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderNumberingTests.cs#AnOrderDatedLastYearButSavedThisYearGetsThisYearsNumber"
        status: pass
    human_judgment: false
  - id: D3
    description: "A rolled-back create leaves no Orders row, no audit row and no counter change, and the next create gets the same number (atomic and gapless)"
    requirement: ORD-03
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderNumberAllocatorTests.cs#ARolledBackCreateLeavesNoOrderNoAuditEntryAndNoCounterChangeAndTheNextCreateGetsTheSameNumber"
        status: pass
    human_judgment: false
  - id: D4
    description: "A lock that cannot be taken within the wait raises OrderNumberBusyException (allocator, 1 s wait) and answers 409 orders.busy with nothing stored (HTTP, 10 s wait), never a 500"
    requirement: ORD-14
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderNumberAllocatorTests.cs#ALockHeldByAnotherTransactionGivesOrderNumberBusyWithinTheWaitAndLeavesTheCounterUnchanged"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderNumberingTests.cs#ACreateThatCannotTakeTheNumberLockInTimeAnswers409OrdersBusyAndTheNextCreateStillWorks"
        status: pass
    human_judgment: false

duration: 20 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 06: Order number race, New Year and rollback proof Summary

**Twenty creates at the same moment get twenty distinct, contiguous numbers (10 rounds); the number's year follows the Manila calendar of the save across New Year; a rolled-back create leaves no gap; and a busy lock is a 409, never a 500. The 07-05 allocator held on every point, so the only production change is a test seam for the lock wait.**

## Performance

- **Duration:** about 20 min
- **Started:** 2026-10-28T15:55Z
- **Completed:** 2026-10-28T16:15Z
- **Tasks:** 2 of 2
- **Files changed:** 4 (2 new test files, `ConcurrentRequests.cs`, `OrderNumberAllocator.cs`); about 6,200 tokens of diff (chars/4)

## Accomplishments

- Task 1 (tracer): `ConcurrentRequests.SendAllTogetherAsync` (N-way, disposes the finished responses if one sender throws) and the 20-way race. 10 rounds, each after a database reset, alternating Admin and Manager tokens with distinct keys: 20 x 201, the number set equals 0001 to 0020, each id reads back its number, the counter reads 20 and there are 20 orders.
- Task 2: New Year in Manila (15:59:59Z and 16:00:00Z, the two years' counters side by side, an order dated 2026-12-30 saved on 2027-01-02), the rollback-is-gapless proof, and the busy-lock proofs at allocator level and over HTTP.

## TDD Gate Compliance

| Step | Commit | Kind |
|------|--------|------|
| Task 1 test | 41ddf942 `test(07-06): twenty creates at once get contiguous numbers` | characterization (passed at once) |
| Task 2 New Year and rollback | 819c89e3 `test(07-06): New Year and rollback numbering` | characterization (passed at once) |
| Task 2 busy lock RED | 0ffc9075 `test(07-06): busy order number lock gives OrderNumberBusyException (RED)` | compile-time RED |
| Task 2 busy lock GREEN | 769f7d20 `fix(07-06): order number allocator takes the lock wait` | GREEN |
| Busy lock over HTTP | 70f043cb `test(07-06): a busy number lock answers 409 orders.busy end to end` | characterization (passed at once) |
| Tidy | 68ff8052 `test(07-06): write the clock instants as ISO text` | test-only |

- **Characterization tests, said plainly:** the 20-way race, the four New Year cases, the rollback case and the HTTP busy case all passed on their first run against the unchanged 07-05 allocator. They are regression proof for T-07-15 and T-07-16, not new red.
- **Proof the race test can fail:** for one run I removed the lock call from `OrderNumberAllocator`; the test failed in round 1 with 500s. The file was restored from a copy and `git status` showed it unchanged before the commit.
- **The one real RED:** the busy-lock allocator test needs a shorter wait than the 10 s default. It did not build (`OrderNumberAllocator` had no two-argument constructor), which is a compile-time RED. The GREEN adds the internal constructor.
- **Tracer gate (Task 1):** end-of-phase mode with an automated-only verify, so the verify command was re-run (passed) before expansion. Tracer verified end-to-end, expanding.
- `gsd_run check tdd-red-evidence` was not run (this runner's output is none of the formats it reads); the failing output was read by hand.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- Preflight run before the integration runs: all four ports free, no dev or test processes.
- `Csps.Server.IntegrationTests --filter-class "*OrderNumberingTests"`: 6 of 6 passed, run 10 consecutive times (the plan's verification), 6 of 6 each time. No flake seen.
- `Csps.Infrastructure.IntegrationTests --filter-class "*OrderNumberAllocatorTests"`: 2 of 2 passed.
- `Csps.ArchitectureTests --filter-class "*NoInlineSqlTests"`: 24 of 24 passed. Whole `Csps.ArchitectureTests`: 241 of 241 passed.
- Regression of the create path after the constructor change: `*CreateOrderEndpointTests` 31 of 31, `*OrderAttributionTests` 3 of 3.
- Acceptance criteria re-run: `SendAllTogetherAsync` in `ConcurrentRequests.cs` 2; `20` in `OrderNumberingTests.cs` at least 1; `2026-12-31T16:00:00` in `OrderNumberingTests.cs` 1; `OrderNumberBusyException` in `OrderNumberAllocatorTests.cs` 1.
- gitleaks on each staged change: no leaks. Only fake values (`example.com` addresses, a sample phone number). No en or em dash in the changed files.
- I did not re-run the whole Server and Infrastructure suites; the known `ExpenseListTimingTests` machine-speed failure (D-76) is unrelated and untouched.

## Deviations from Plan

### Auto-fixed Issues

None needed in production code. Test-harness notes (no behaviour change):

**1. [Rule 3 - Blocking] The test host rejected tokens issued by a December clock**
- **Found during:** Task 2 (New Year tests, first run: 4 x 401)
- **Issue:** the bearer check judges token lifetime by the wall clock, so a token issued at 2026-12-31 was "not yet valid" on 2026-10-28. `TokenValidationParameters.TimeProvider` is internal in IdentityModel 8.19.2, so it cannot be set.
- **Fix:** the test rig derives its host with a `PostConfigureAll<JwtBearerOptions>` that sets a `LifetimeValidator` reading the same `FakeTimeProvider`. Test code only; the real validation is unchanged.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Orders/OrderNumberingTests.cs`
- **Commit:** 819c89e3

### Plan notes

- The plan's busy-lock case lists only the allocator test. I also added the HTTP-level 409 test (about 10 s) because the SUMMARY of 07-05 deferred the end-to-end proof to this plan and T-07-16 is about creates turning into 500s.
- The HTTP busy test takes the lock with one SQL statement on a separate connection in the test (`UPDATE DatabaseLocks ...`), because `DatabaseLocks` is internal to Infrastructure and Server tests cannot see it. This is test code; the allocator itself stays on EF only (NoInlineSql passes).
- `OrderFixtures.cs` was not edited (07-07 rule); the rig has its own `TodayAsync`.

**Total deviations:** 1 auto-fixed (blocking test harness). **Impact:** none on scope.

## Issues Encountered

- First draft of the allocator test failed twice on bad test data (a contact number and due date are required; an audit correlation id must be 32 lowercase hex characters). Fixed in the test before the first commit.
- Nothing else. No flake in 10 consecutive runs of the numbering class.

## Deferred Issues

- `ExpenseListTimingTests` p95 about 350 ms against 300 ms on this machine (pre-existing, D-76, in `deferred-items.md`); left alone.

## Known Stubs

None.

## Threat Flags

None. T-07-15 is covered by the 20-way race (10 rounds), the New Year cases and the rollback test. T-07-16 is covered by the 1 s allocator test and the HTTP 409 test. T-07-SC: no installs.

## Authentication Gates

None.

## Next Phase Readiness

Ready for 07-07. `ConcurrentRequests.SendAllTogetherAsync` is available to every later race test (payments, status changes, deletes). The fixed-clock host pattern in `OrderNumberingTests.ClockRig` can be copied for other date-boundary tests; it is private to that file by design.

## Self-Check: PASSED

`OrderNumberingTests.cs` and `OrderNumberAllocatorTests.cs` exist; all six task commits (41ddf942, 819c89e3, 0ffc9075, 769f7d20, 70f043cb, 68ff8052) are ancestors of HEAD; the acceptance criteria were re-run after the last commit.
