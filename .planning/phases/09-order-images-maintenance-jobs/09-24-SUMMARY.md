---
phase: 09-order-images-maintenance-jobs
plan: 24
subsystem: infra
tags: [image-deletion-queue, cloudinary-cleanup, ef-migration, transactional-enqueue, compensation, tdd]
status: complete

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plans 09-19 (the real Cloudinary storage and ImagesRegistration), 09-15 (metadata strip step in the upload handler), 09-01 (TestingImageStorage.HoldUploads, upload step order)
provides:
  - IImageDeletionQueue (Enqueue in the unit of work, EnqueueNowAsync on its own context) and ImageDeletionReason (PhotoDeleted 1, OrderDeleted 2, UploadUndone 3, Stray 4)
  - ImageDeletion row, ImageDeletionConfiguration and the AddImageDeletions migration (table ImageDeletions)
  - ImageDeletionQueue adapter, registered for every environment in ImagesRegistration
  - PermanentlyDeleteOrderHandler queues one OrderDeleted row per photo in the same save
  - UploadOrderImageHandler queues UploadUndone when the photo row cannot be saved after the file reached storage
affects: [09-26, 09-28, 09-30]

created: "2026-11-03T23:59:15-06:00"
updated: "2026-11-03T23:59:15-06:00"

actuals:
  tokens: 21000
  tasks: 2
  commits: 4

plan_head_before: a3353bef5650ff3ccaec8787096c37cce5dd52ff
plan_head_after: f8e615b7c40c154a16e01552f0868ae56c6618ce
commits: 4

tech-stack:
  added: []
  patterns:
    - "A queue row added to the request's context joins the one SaveChanges; a rollback or ChangeTracker.Clear drops it"
    - "Compensation on a separate short context with a token that cannot be cancelled and a 10 second limit"
    - "Failure logged by code only (image-queue-failed), never the file id"

key-files:
  created:
    - src/Csps.Application/Ports/IImageDeletionQueue.cs
    - src/Csps.Infrastructure/Images/ImageDeletion.cs
    - src/Csps.Infrastructure/Images/ImageDeletionQueue.cs
    - src/Csps.Infrastructure/Persistence/Configurations/ImageDeletionConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261104051745_AddImageDeletions.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261104051745_AddImageDeletions.Designer.cs
    - tests/Csps.Application.UnitTests/Orders/UploadOrderImageCompensationTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/ImageDeletionQueueTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/ImageDeletionsMigrationTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderImageDeletionQueueTests.cs
  modified:
    - src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs
    - src/Csps.Application/Orders/UploadOrderImageHandler.cs
    - src/Csps.Infrastructure/Images/ImagesRegistration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - tests/Csps.Application.UnitTests/Orders/OrderDeletionHandlerTests.cs

key-decisions:
  - "The migration got the name 20261104051745_AddImageDeletions (the plan's 20261101000002 was only a placeholder; EF stamps the real time and it sorts after AddOrderImages)"
  - "EnqueueNowAsync logs the failure code and rethrows; the upload handler swallows that error so the original answer is never replaced"
  - "The compensation runs on any failure result or exception after storage, including a cancelled request, with CancellationToken.None"

requirements-completed: [JOB-02, IMG-01]

coverage:
  - id: D1
    description: "A Manager's permanent delete adds one OrderDeleted row per photo in the same save; nothing is sent to the storage"
    requirement: "JOB-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageDeletionQueueTests.cs#APermanentDeleteOfAnOrderWithThreePhotosQueuesThreeRowsAndCallsTheStorageForNothing"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderDeletionHandlerTests.cs#PermanentEachPhotoIsQueuedForRemovalOnceWithTheOrderDeletedReasonBeforeTheRemove"
        status: pass
    human_judgment: false
  - id: D2
    description: "A soft delete and a restore add no row and keep every photo (D-20)"
    requirement: "JOB-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageDeletionQueueTests.cs#ASoftDeleteQueuesNothingAndKeepsThePhotos"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageDeletionQueueTests.cs#ARestoreQueuesNothingAndBringsEveryPhotoBack"
        status: pass
    human_judgment: false
  - id: D3
    description: "A rolled-back change keeps no queue row; EnqueueNowAsync keeps its row even when the request never saves or rolls back"
    requirement: "JOB-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/ImageDeletionQueueTests.cs (AnEnqueueInsideATransactionThatThrowsBeforeTheCommitLeavesNoRow, AnEnqueueNowSurvivesTheRollbackOfTheRequestsOwnTransaction)"
        status: pass
    human_judgment: false
  - id: D4
    description: "An upload whose photo row cannot be saved after the file reached storage leaves one UploadUndone row naming the uploaded id and no photo row"
    requirement: "IMG-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageDeletionQueueTests.cs#AnUploadFinishingAfterTheOrderWasCancelledAnswers422LeavesNoPhotoAndQueuesOneUploadUndoneRow"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/UploadOrderImageCompensationTests.cs (7 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The ImageDeletions table has the planned columns, identity key and both indexes (PublicId not unique), with no JSON column and no trigger"
    requirement: "JOB-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/ImageDeletionsMigrationTests.cs (5 tests)"
        status: pass
      - kind: integration
        ref: "TriggerInventoryTests and MigrationScriptTests (run in the Infrastructure project)"
        status: pass
    human_judgment: false

duration: 70min
completed: 2026-11-03
---

# Phase 9 Plan 24: A permanent order delete, or a failed upload save, queues the storage removal reliably Summary

**An `ImageDeletions` table and queue port now record every photo file that must leave Cloudinary: a Manager's permanent order delete writes one row per photo in the same save, and an upload whose photo row cannot be saved queues its own file on a separate short context, with nothing calling the storage inside a request.**

## Performance

- **Duration:** about 70 min
- **Tasks:** 2 of 2
- **Commits:** 4 code commits (2 RED, 2 GREEN), then this SUMMARY

## Task Commits

1. Task 1 (tracer): `00f76280` (test, RED) then `672a8a35` (feat, GREEN) permanent delete queues each photo
2. Task 2: `22242093` (test, RED) then `f8e615b7` (feat, GREEN) rollback tests and the UploadUndone compensation

## The migration (read and quoted)

Real name: `20261104051745_AddImageDeletions`. Additive only: one new table and two indexes.

```csharp
// Up
CreateTable("ImageDeletions", columns: Id bigint identity(1,1), PublicId nvarchar(200), DeliveryType varchar(16),
    Reason tinyint, EnqueuedAtUtc datetimeoffset, Attempts int, NextAttemptAtUtc datetimeoffset,
    LeaseUntilUtc datetimeoffset NULL, LeaseHolder uniqueidentifier NULL, LastFailureCode varchar(50) NULL,
    LastFailedAtUtc datetimeoffset NULL; primary key PK_ImageDeletions on Id)
CreateIndex("IX_ImageDeletions_NextAttemptAtUtc", NextAttemptAtUtc)
CreateIndex("IX_ImageDeletions_PublicId", PublicId)          // not unique
// Down
DropTable("ImageDeletions")
```

No JSON column, no trigger (OR-7), no foreign key, no drop or rename of anything existing. The `ImageDeletionsMigrationTests` read the real columns, key and indexes back from the database. Nothing migrates at startup.

## What was built

- **Port:** `Enqueue` adds the row to the request's context (no save). `EnqueueNowAsync` writes and saves on its own short context.
- **Permanent delete:** the loop sits between the audit record and `orders.Remove`. It runs after the 404 and confirm checks, so a refused delete queues nothing. A conflict retry clears the tracker (`CspsUnitOfWork`), so a retried attempt never doubles a row.
- **Soft delete and restore:** untouched, and proven to queue nothing.
- **Upload compensation:** the save step is now `SavePhotoAsync`. Any failure result or exception after a successful storage upload calls `EnqueueNowAsync(publicId, UploadUndone, CancellationToken.None)` before the original failure is returned or rethrown. A cancelled request still queues. A failed queue write is swallowed in the handler (the 2 day stray sweep is the backstop) and logged by the adapter as `image-queue-failed` with no file id.

## Deviations from Plan

**1. [Rule 3 - Blocking] Analyzer CA1711 on the port name**
- **Issue:** the build refuses a public type ending in `Queue`. The plan fixes the name `IImageDeletionQueue` and plans 09-26 and 09-28 depend on it.
- **Fix:** a `SuppressMessage` with a written reason on the interface instead of a rename.
- **Commit:** `00f76280`

**2. [Rule 2 - Missing critical functionality] Logging lives in the adapter, not the handler**
- **Issue:** the plan says the handler logs a failed compensation. The Application project has no logging reference, and adding one means a package, which I may not do.
- **Fix:** `ImageDeletionQueue.EnqueueNowAsync` logs the code and rethrows; the handler swallows the error. Same effect: a code in the log, never the id.
- **Commit:** `f8e615b7`

**3. [Rule 2 - Missing critical functionality] The compensation ignores request cancellation and has a time limit**
- **Issue:** a dropped request cancels the request token, which would stop the very write that protects the file.
- **Fix:** the handler passes `CancellationToken.None`; the adapter limits the write to 10 seconds.
- **Commit:** `f8e615b7`

**4. [Plan wording] The RED commits carry a compile shell**
- The first RED commit includes the table, model, migration, port and a do-nothing adapter, because the tests cannot compile or read the table without them. The behavior (the enqueue and the handler loop) arrived in GREEN. The second RED commit has the handler and adapter take their new constructor arguments and do nothing with them.

**5. [Rule 3 - Blocking] Worktree restore**
- A fresh worktree had no `obj` folders, so `dotnet restore Csps.slnx` ran once before the migration could be generated. No file under version control changed.

## TDD Gate Compliance

- **Task 1 RED (`00f76280`):** 2 of 5 server tests and 2 of 21 unit tests failed on the planned assertions (rows expected, none queued). The other 3 server tests and 19 unit tests are guards that were already true (soft delete, restore, refused delete); they stay as regression guards. **GREEN (`672a8a35`):** all pass.
- **Task 2 RED (`22242093`):** 4 of 7 unit tests, 4 of 12 infrastructure tests and 1 of 6 server tests failed. The server test failed at the final assertion (no UploadUndone row), after the 422 and "no photo row" checks passed, so the failure is the missing compensation and nothing earlier. **GREEN (`f8e615b7`):** all pass.
- **REFACTOR:** none.

## Check results (seen in this session)

| Check | Result |
|---|---|
| `dotnet build Csps.slnx` | 0 Warning(s), 0 Error(s) |
| `dotnet format Csps.slnx --verify-no-changes` | no output, exit 0 |
| `tests/Csps.Application.UnitTests` (whole project) | total 2165, failed 0 |
| `tests/Csps.ArchitectureTests` (whole project) | total 276, failed 0 |
| `tests/Csps.Infrastructure.IntegrationTests` (whole project, includes TriggerInventoryTests, MigrationScriptTests) | total 996, failed 0, skipped 1 |
| `tests/Csps.Server.IntegrationTests` (whole project) | total 2017, failed 2, succeeded 2015 (see flakes) |
| Plan verify commands for both tasks | passed (class filters run before the full runs) |
| `gitleaks protect --staged --no-banner` before each commit | no leaks found |
| Em dash or en dash scan of new and changed files | none |

Not run: coverage numbers (the CI coverage gate was not run in this worktree), the web test suite (no web files changed), and any call to the real Cloudinary (D-07).

## Flakes recorded, not hidden

- `ExpenseListTimingTests.TheListAndTheKpisAnswerUnder300MsAtP95OnFiveYearsOfData` failed in the full server run under load. It is the known timing flake (D-103); not related to this plan.
- `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` failed once in the full server run, while other executors were using the same LocalDB. Re-run alone: the whole class passed 20 of 20, and the single test passed 5 of 5 more times. It is a two-uploads-at-once race test (09-14 already noted a deadlock risk there). I did not prove it also flakes without this plan, so please watch it in the post-merge run.

## Notes for plans 09-26 and 09-28

- **Do not remove a queued file that a photo row still names.** An exception after the save may be a lost reply after a successful commit, so an `UploadUndone` row can name a file that an `OrderImages` row points to. The 09-28 removal job should skip a queue row whose public id still has an `OrderImages` row (soft-deleted orders included) and just delete the queue row. Plan 09-28 only checks this in the stray sweep today.
- `IImageDeletionQueue.Enqueue` (PhotoDeleted, 09-26) must be called inside the same `InTransactionAsync` as the photo delete.
- `ImageDeletion` is public in `Csps.Infrastructure.Images` with `Queue(...)`; leases and failure counts are set by 09-28 (the row has private setters now, so 09-28 will use `ExecuteUpdateAsync` as its plan says).

## Known Stubs

None.

## Threat Flags

None. The new table sits behind the existing server-only data path and is written only by handlers; nothing new is exposed over the network.

## Self-Check: PASSED

- Files created exist: the port, `ImageDeletion.cs`, `ImageDeletionQueue.cs`, `ImageDeletionConfiguration.cs`, both migration files and the four new test files.
- Commits `00f76280`, `672a8a35`, `22242093`, `f8e615b7` are in the branch history.
- `grep -c "OrderDeleted"` on the permanent delete handler is 1; `grep -c "UploadUndone"` on the upload handler is 2; `grep -c "EnqueueNowAsync"` on the adapter is 3; `grep -ci trigger` on the migration is 0.
