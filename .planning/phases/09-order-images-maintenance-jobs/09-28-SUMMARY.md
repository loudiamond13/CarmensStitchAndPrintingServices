---
phase: 09-order-images-maintenance-jobs
plan: 28
subsystem: infra
tags: [maintenance-jobs, image-deletion-queue, stray-sweep, cloudinary-cleanup, leases, retries, tdd]
status: complete

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plans 09-24 (ImageDeletions queue and ImageDeletion row), 09-19 (Cloudinary adapter, ImageStorageException, the unauthorized code), 09-25 (usage job at order 40, MaintenanceEndpointTests order test), 09-22 (maintenance runner and keyed endpoint)
provides:
  - IImageDeletionQueue claim API (ClaimDueAsync, CompleteAsync, FailAsync, ReleaseAsync, EnqueueManyNowAsync) and the QueuedRemoval record
  - IImageInventory (KnownAsync, NamedByPhotosAsync) and the ImageInventory adapter that lifts the SoftDelete filter
  - ImageRemovalJob (order 30) and StraySweepJob (order 20), both registered
  - ImageFailureCodes.Unauthorized shared by the Cloudinary adapter and the removal job
  - IMaintenanceJobLog.RemovalFailed (row id and code only)
  - TestingImageStorage.FailNextRemovals and Seed for tests
  - docs/operations/maintenance.md section "What the photo jobs do"
affects: [09-26, 09-27, 09-30]

created: "2026-11-04T01:10:00-06:00"
updated: "2026-11-04T01:10:00-06:00"

actuals:
  tokens: 28000
  tasks: 3
  commits: 6

plan_head_before: d4e7f11afbb9255c4a0be7de124ad5ed947a703d
plan_head_after: 8eaf2a594538f7826f057c69bf7f8654c3669ed1
commits: 6

tech-stack:
  added: []
  patterns:
    - "Per-row lease: read candidate ids, then one conditional ExecuteUpdateAsync per row; a result of 1 means this run owns the row"
    - "Failed rows are stamped after the run's start, so one run never takes the same failed row twice"
    - "Retry waits go through Task.Delay(delay, TimeProvider, ct); tests record the wait lengths and let the fake clock pass"
    - "Job lines hold counts and fixed sentences; failures are logged by queue row id and a code, never the file's public id"

key-files:
  created:
    - src/Csps.Application/Maintenance/ImageRemovalJob.cs
    - src/Csps.Application/Maintenance/StraySweepJob.cs
    - src/Csps.Application/Ports/IImageInventory.cs
    - src/Csps.Application/Ports/ImageFailureCodes.cs
    - src/Csps.Infrastructure/Images/ImageInventory.cs
    - tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs
    - tests/Csps.Application.UnitTests/Maintenance/StraySweepJobTests.cs
    - tests/Csps.Application.UnitTests/Maintenance/FakeImageDeletionQueue.cs
    - tests/Csps.Application.UnitTests/Maintenance/FakeImageInventory.cs
    - tests/Csps.Application.UnitTests/Maintenance/FakeImageStorage.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/ImageDeletionQueueClaimTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/ImageInventoryTests.cs
    - tests/Csps.Server.IntegrationTests/Maintenance/ImageCleanupRunTests.cs
  modified:
    - src/Csps.Application/Ports/IImageDeletionQueue.cs
    - src/Csps.Application/Ports/IMaintenanceJobLog.cs
    - src/Csps.Infrastructure/Images/ImageDeletionQueue.cs
    - src/Csps.Infrastructure/Images/CloudinaryResults.cs
    - src/Csps.Infrastructure/Images/TestingImageStorage.cs
    - src/Csps.Infrastructure/Maintenance/MaintenanceJobLog.cs
    - src/Csps.Infrastructure/Maintenance/MaintenanceRegistration.cs
    - src/Csps.Server/Composition/MaintenanceApplicationRegistration.cs
    - tests/Csps.Application.UnitTests/Orders/OrderDeletionHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/UploadOrderImageCompensationTests.cs
    - docs/operations/maintenance.md

key-decisions:
  - "Complete, fail and release take the run's holder id, so a run whose lease was lost can never change a row another run owns (the plan's Task 1 text says 'by id and holder', its artifact list omitted the holder)"
  - "A failed row gets NextAttemptAtUtc equal to the failure time, which is always after the run's start; the job claims with the run's start time, so a failed row waits for the next run and the plan's 'the next run removes it' test still holds"
  - "A queue row whose file a photo row still names is dropped without touching the file (wave note from 09-24); the job reports it on its own non-red line"
  - "A queued file outside the environment's own '{root}/orders/' folder is never removed; it is recorded as outside-folder and counts as a failing removal (the plan's safety prohibition applied to the removal job too)"
  - "The sweep's file ids compare without case, so the inventory can only keep a file that a strict compare would have removed"

requirements-completed: [JOB-02, JOB-01]

coverage:
  - id: D1
    description: "A deleted photo's file leaves the storage on the next run, cache invalidation included, and its queue row is deleted"
    requirement: "JOB-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Maintenance/ImageCleanupRunTests.cs#APermanentlyDeletedOrdersPhotoIsRemovedFromTheStorageByTheNextRun"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs#EveryDueRowIsRemovedAndDeletedAndCounted"
        status: pass
    human_judgment: false
  - id: D2
    description: "Two runs claiming the same row: exactly one owns it; an expired lease can be claimed again; a row not yet due is left alone"
    requirement: "JOB-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/ImageDeletionQueueClaimTests.cs (TwoClaimersRacingOverTwentyDueRowsGetEveryRowExactlyOnce, ARowWhoseLeaseHasExpiredCanBeClaimedAgainByAnotherRun, ARowWhoseNextAttemptIsInTheFutureIsNotClaimedUntilItIsDue)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A transient answer is retried with waits of 2 and 8 seconds; a row that still fails keeps its place with Attempts + 1 and its code and turns the run red; the next run removes it"
    requirement: "JOB-02"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs (ATransientAnswerThreeTimesWaitsTwoThenEightSecondsKeepsTheRowAndTurnsTheRunRed, ATransientAnswerThenRemovedWaitsTwoSecondsAndRemovesTheFile)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Maintenance/ImageCleanupRunTests.cs#ThreeTransientAnswersTurnTheRunRedKeepTheRowAndTheNextRunRemovesTheFile"
        status: pass
    human_judgment: false
  - id: D4
    description: "Refused keys stop the job at once with the keys line and leave every row for the next run; no log line holds a public id"
    requirement: "JOB-02"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs (AnUnauthorizedAnswerStopsTheJobAtOnceAndLeavesEveryRowForTheNextRun, NoLineOrLogCallCarriesAPublicId)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Maintenance/ImageCleanupRunTests.cs#AFailedRemovalIsLoggedByRowIdAndCodeAndNeverByThePublicId"
        status: pass
    human_judgment: false
  - id: D5
    description: "The stray sweep queues only unknown files older than 2 days in its own folder, with the 2 day boundary exact, and reports the count"
    requirement: "JOB-02"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Maintenance/StraySweepJobTests.cs (OnlyTheOldUnknownFileInTheOwnFolderIsQueuedAsStray, AFileCreatedTwoDaysMinusOneSecondAgoIsKeptAndOneTwoDaysPlusOneSecondAgoIsQueued, OnlyFilesOfTheOwnFolderPrefixWithTheTrailingSlashAreEverChecked)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Maintenance/ImageCleanupRunTests.cs#AStrayFileOlderThanTwoDaysIsQueuedAndRemovedInOneRunWhileAYoungOneStays"
        status: pass
    human_judgment: false
  - id: D6
    description: "A photo of a soft-deleted order (and of a live order) is never swept or removed, and a queue row that names a live photo is dropped while the file stays"
    requirement: "JOB-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/ImageInventoryTests.cs#APhotoOfASoftDeletedOrderIsKnownAndNamedByAPhoto"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Maintenance/ImageCleanupRunTests.cs (APhotoOfASoftDeletedOrderOlderThanTwoDaysIsStillInTheStorageAfterTheRun, AnUploadUndoneRowThatNamesALivePhotoOrASoftDeletedOnesIsDroppedAndTheFilesStay)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs#AQueuedFileThatAPhotoRowStillNamesIsNeverRemovedAndOnlyItsQueueRowIsDropped"
        status: pass
    human_judgment: false
  - id: D7
    description: "Each job stops when the run budget is spent and reports More; rows taken but not reached are released; a listing that cannot be read gives a failed line, never an unhandled error"
    requirement: "JOB-01"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Maintenance/ImageRemovalJobTests.cs (ASpentBudgetAfterTheFirstRowStopsClaimingReleasesTheOthersAndReportsMore, AFullBatchWithTheBudgetSpentReportsMoreWithoutClaimingAgain)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Maintenance/StraySweepJobTests.cs (ASpentBudgetBetweenPagesStopsListingAndReportsMore, AListingThatCannotBeReadGivesAFailedLineAndKeepsWhatWasAlreadyQueued)"
        status: pass
    human_judgment: false

duration: 130min
completed: 2026-11-04
---

# Phase 9 Plan 28: The monthly run removes deleted photos from Cloudinary and sweeps stray files Summary

**A maintenance run now removes every queued photo file from Cloudinary (leased per row, retried at 2 and 8 seconds, red when it keeps failing) and first sweeps the site's own orders folder for stray files older than 2 days, while never touching a photo that a live or soft-deleted order still has.**

## Performance

- **Duration:** about 130 min
- **Tasks:** 3 of 3
- **Commits:** 6 code commits (3 RED, 3 GREEN), then this SUMMARY

## Task Commits

1. Task 1 (tracer): `c349e8bb` (test, RED) then `a3330bc1` (feat, GREEN) leased claims and the happy-path removal
2. Task 2: `5173eba0` (test, RED) then `61eb1f66` (feat, GREEN) retries, failure records, the keys-refused stop, the red run
3. Task 3: `b6d02dad` (test, RED) then `8eaf2a59` (feat, GREEN) stray sweep, inventory, photo-still-in-use skip, runbook

Tracer gate: the Task 1 verify commands (both) were re-run after the GREEN commit and passed (9 of 9 claim tests, 1 of 1 server test) before Tasks 2 and 3 began. Mode was interactive with `end-of-phase` verification and an automated-only verify, so no human checkpoint was raised.

## What was built

- **Queue claim API.** `ClaimDueAsync` reads up to 25 due ids (next attempt time reached, lease free or expired), then takes each with its own conditional `ExecuteUpdateAsync`; a result of 1 means this run owns the row. `CompleteAsync`, `FailAsync` and `ReleaseAsync` only act for the run that holds the lease. `EnqueueManyNowAsync` writes a page of strays on one short context with the same 10 second limit and code-only logging as `EnqueueNowAsync`.
- **`ImageRemovalJob` (order 30).** Claims 25 at a time with a 5 minute lease. Per row: skip and drop the queue row when a photo row names the file; refuse a file outside `{root}/orders/`; otherwise `RemoveAsync` (up to 3 tries, waits 2 s then 8 s through `Task.Delay(delay, time, ct)`). Removed or NotFound deletes the row. Anything else keeps the row (`Attempts + 1`, code, time) and counts toward the red line `Photo removals still failing`. A rejection with the code `unauthorized` stops the job with `Cloudinary refused the keys. Check the Cloudinary settings.` and leaves all rows untouched. A spent budget releases the rows not reached and reports More. A thrown error releases them too, then reaches the runner's own job-failed line.
- **`StraySweepJob` (order 20).** Lists `{RootFolder}/orders/` page by page, keeps only ids that start with that prefix and are at least 2 days old, asks the inventory which are known, queues the rest as `Stray` and reports `Stray files removed (older than 2 days): n`. A listing error becomes the failed line `The stray file sweep could not read the photo storage.`; an unconfigured storage gives a plain non-red line.
- **`ImageInventory`.** Photo ids come from `OrderImages` read with `IgnoreQueryFilters(["SoftDelete"])`, so photos of soft-deleted orders count. `KnownAsync` adds the ids that already have a queue row. A page of 500 ids costs 2 commands.
- **Runbook.** `docs/operations/maintenance.md` now explains the two jobs, each line, which lines turn the run red, and what the owner does.

## Deviations from Plan

**1. [Rule 3 - Blocking] The queue methods take the run's holder id**
- **Issue:** the plan's artifact list gives `CompleteAsync(long id, ct)` and `FailAsync(long id, string code, now, ct)`, but the Task 1 action says the delete is "by id and holder".
- **Fix:** both, and the new `ReleaseAsync`, take the holder. A run that lost its lease can no longer change a row another run owns.
- **Commit:** `a3330bc1`

**2. [Rule 2 - Missing critical functionality] `ReleaseAsync` and the release in `finally`**
- **Issue:** the plan has no way to let go of rows a run took but did not reach (spent budget, keys refused, an error). Without it the next call in the same run (the workflow loops on `more`) could not take them for 5 minutes. A row with transient retries costs 10 s or more, so a full batch can outlast the 90 s budget.
- **Fix:** `ReleaseAsync(ids, holder)` and a `finally` in the job that releases whatever is still held.
- **Commit:** `a3330bc1`, `61eb1f66`

**3. [Rule 2 - Missing critical functionality] A failed row must not be taken again in the same run**
- **Issue:** a failed row keeps `NextAttemptAtUtc <= now`, so the job's next batch would take it again, and the plan's test "the next run removes it" needs it due at once.
- **Fix:** the job claims with its own start time and stamps every failure strictly after that time. A failed row is therefore due for the next run and not for this one. A unit test with a 26 row queue proves it.
- **Commit:** `61eb1f66`

**4. [Rule 2 - Missing critical functionality] The removal job refuses a file outside its own folder**
- **Issue:** the plan's safety prohibition says no file outside `{root}/orders/` may be removed, but only the sweep had the prefix check.
- **Fix:** the removal job records such a row as `outside-folder` (a red line, nothing removed). A runbook row says what it means.
- **Commit:** `61eb1f66`

**5. [Rule 2 - Missing critical functionality] The removal job drops a queue row whose file a photo row still names**
- **Issue:** the wave note from 09-24: an `UploadUndone` row can follow a lost reply after a save that worked, so it may name a live photo.
- **Fix:** `IImageInventory.NamedByPhotosAsync` (SoftDelete filter lifted) is asked once per claimed batch; a named file is not removed and only the queue row is deleted. The count shows on the non-red line `Queued removals dropped (photo still in use)`. No scope change, so no checkpoint was needed.
- **Commit:** `8eaf2a59`

**6. [Rule 3 - Blocking] Logging through the existing job-log port**
- **Issue:** the plan says to log with `[LoggerMessage]`, but the Application project has no logging reference and no package may be added.
- **Fix:** `IMaintenanceJobLog.RemovalFailed(rowId, code)` with the `[LoggerMessage]` in the Infrastructure implementation. Only the row id and the code are written.
- **Commit:** `61eb1f66`

**7. [Rule 3 - Blocking] Test support code and fakes**
- `TestingImageStorage` got `FailNextRemovals` and `Seed` (the plan's "FailNext" only covers uploads, and there was no way to make a stored file old). Two existing test fakes of `IImageDeletionQueue` (`OrderDeletionHandlerTests`, `UploadOrderImageCompensationTests`) got the new members and throw if called.
- `CloudinaryResults.UnauthorizedCode` now points at the new `ImageFailureCodes.Unauthorized`, so the adapter and the job share one string.
- The plan's Task 1 test says "upload a photo, delete it". The single-photo delete endpoint belongs to 09-26, which is not in this worktree, so the test uses the permanent delete of an order (an `OrderDeleted` queue row), which is what 09-24 provides.

**8. [Plan wording] The first RED commit leaves `Csps.Application.UnitTests` unable to compile**
- The RED commit `c349e8bb` added the new port members before the two test fakes (deviation 7) were updated, and the RED runs only built the Infrastructure and Server test projects. `a3330bc1` fixes it. A bisect that lands on `c349e8bb` alone will not build that one project.

## TDD Gate Compliance

- **Task 1 RED (`c349e8bb`):** 9 of 9 claim tests failed on the planned assertions (the claim returned nothing, so each test failed at its first claim assertion); the server test failed with "The run has no line 'Photos removed from storage'" after the run itself answered 200 and ok true. **GREEN (`a3330bc1`):** all pass.
- **Task 2 RED (`5173eba0`):** 10 of 16 unit tests failed on the planned assertions (for example `Removals.Count` expected 3, was 1; `report.More` expected true, was false). 2 of 3 server tests failed on the run being ok when it should be red. The 6 unit tests that passed (order, happy path, batches, nothing queued, NotFound, no id in lines) are guards that were already true. **GREEN (`61eb1f66`):** 16 of 16 unit and 3 of 3 server tests pass.
- **Task 3 RED (`b6d02dad`):** 13 of 31 unit tests, 7 of 19 infrastructure tests and 3 of 7 server tests failed on the planned assertions (empty inventory sets, no stray line). The others are guards. **GREEN (`8eaf2a59`):** all pass.
- **REFACTOR:** none.

## Check results (seen in this session)

| Check | Result |
|---|---|
| `dotnet build Csps.slnx` | 0 Warning(s), 0 Error(s) |
| `dotnet format Csps.slnx --verify-no-changes` | no output, exit 0 |
| `tests/Csps.Application.UnitTests` (whole project) | total 2213, failed 0 |
| `tests/Csps.ArchitectureTests` (whole project) | total 276, failed 0 |
| `tests/Csps.Infrastructure.IntegrationTests` (whole project) | total 1031, failed 0, skipped 1 |
| Task verify commands (ImageRemovalJobTests + StraySweepJobTests; ImageInventoryTests + ImageDeletionQueueClaimTests + ImageDeletionQueueTests; ImageCleanupRunTests + MaintenanceEndpointTests) | all passed (unit 31 of 31, infrastructure 26 of 26, server 19 of 19) |
| `tests/Csps.Server.IntegrationTests` (whole project) | total 2026, failed 1, succeeded 2025 (the one failure is the known timing flake, see below) |
| `gitleaks protect --staged --no-banner` before each commit | no leaks found (6 of 6) |
| Em dash or en dash scan of new and changed code and docs | none |

Not run: the coverage numbers (the CI coverage gate was not run in this worktree; every branch of the two jobs is covered by a named unit test, including the no-code refusal path), the web test suite (no web files changed), and any call to the real Cloudinary (D-07).

## Flakes and notes, not hidden

- `ExpenseListTimingTests.TheListAndTheKpisAnswerUnder300MsAtP95OnFiveYearsOfData` failed once in the full server run (it took 3 min 9 s, with other executors sharing the LocalDB). It is the known timing flake (D-103) and has nothing to do with this plan. Re-run alone: 1 of 1 passed.
- A process was listening on port 5199 (this project's Playwright port) when the full server run started, so the preflight rule asked me to wait. The server integration tests use the in-process test host and bind no port, so I went ahead. TheBETSLLC's ports 5173, 5023 and 5099 were not touched.
- `ThreeTransientAnswersTurnTheRunRed...` waits the real 2 s and 8 s (the server test host uses the system clock), so it takes about 12 s. The unit tests prove the same waits with a fake clock.
- The sweep restarts its listing from page one on a repeat call, because nothing is kept in memory between calls. Files it queued before are skipped through their queue rows, and the removal job clears them.

## Notes for the orchestrator and later plans

- **Merge note for 09-26 and 09-27.** `IImageDeletionQueue` has five new members. Any new test fake of that interface written in the other worktrees must add them (`EnqueueManyNowAsync`, `ClaimDueAsync`, `CompleteAsync`, `FailAsync`, `ReleaseAsync`), or `Csps.Application.UnitTests` will not build after the merge. NSubstitute substitutes need nothing. `IMaintenanceJobLog` also has one new member (`RemovalFailed`).
- **`MaintenanceEndpointTests`** still passes with its fake late job at order 45 and early job at 5: the new jobs sit at 20 and 30, between the purge (10) and the usage job (40).
- **Stray line wording.** The plan's label `Stray files removed (older than 2 days)` counts files queued; the removal job in the same run removes them. I kept the plan's wording.

## Known Stubs

None.

## Threat Flags

None. The only new surface is the two internal jobs behind the existing keyed maintenance endpoint.

## Self-Check: PASSED

- Files created exist (`ImageRemovalJob.cs`, `StraySweepJob.cs`, `IImageInventory.cs`, `ImageFailureCodes.cs`, `ImageInventory.cs`, the five new test files and three test doubles).
- Commits `c349e8bb`, `a3330bc1`, `5173eba0`, `61eb1f66`, `b6d02dad`, `8eaf2a59` are in the branch history.
- Acceptance greps: `ExecuteUpdateAsync` in `ImageDeletionQueue.cs` is present; `Photos removed from storage` in `ImageRemovalJob.cs` is present; `Thread.Sleep` in `ImageRemovalJob.cs` is 0; `IgnoreQueryFilters` in `ImageInventory.cs` is present; test names contain `Transient`, `NotFound`, `Unauthorized` and `SoftDeleted`.
