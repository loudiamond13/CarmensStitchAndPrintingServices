---
phase: 09-order-images-maintenance-jobs
plan: 26
subsystem: api
tags: [order-images, photo-delete, image-deletion-queue, audit, openapi, tdd]
status: complete

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-24 (IImageDeletionQueue, ImageDeletionReason.PhotoDeleted), plan 09-20 (Order.MoveImage and the arrange actions, AuditActions at 96)
provides:
  - Order.RemoveImage(imageId, now) returning Result<OrderImage>
  - RemoveOrderImageHandler, DELETE /api/v1/orders/{orderId}/images/{imageId} (RemoveOrderImage)
  - AuditActions.OrderImageDeleted ("order-image.deleted"), catalog at 97
  - OrderAuditDetail.ImageDeleted
  - OpenAPI snapshot and web types with RemoveOrderImage
affects: [09-27, 09-28, 09-29, 09-30]

created: "2026-11-04T00:58:00-06:00"
updated: "2026-11-04T00:58:00-06:00"

actuals:
  tokens: 60000
  tasks: 2
  commits: 4

plan_head_before: d4e7f11afbb9255c4a0be7de124ad5ed947a703d
plan_head_after: 793a5c567d1d80e52ed1d6cf95f891b5166fd555
commits: 4

tech-stack:
  added: []
  patterns:
    - "A single-click child delete (no version) reuses ConflictRetry plus OrderChildWrite.AttemptAsync; the queue Enqueue sits inside the change lambda so it joins the one save"
    - "A deterministic xorshift number source in a test, because System.Random is banned in this repo"

key-files:
  created:
    - src/Csps.Application/Orders/RemoveOrderImageHandler.cs
    - tests/Csps.Application.UnitTests/Orders/RemoveOrderImageHandlerTests.cs
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Server/Controllers/OrderImagesController.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderImageTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderAuditDetailTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderImageDeletionQueueTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Http/OpenApiOrderWriteContractTests.cs
    - docs/api/order-images.md
    - docs/operations/audit-log.md
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "The audit detail of order-image.deleted is number plus the 1-based place the photo had before the delete (plan: order number and 1-based position only)"
  - "No version on the DELETE: it acts on the latest state like RemoveOrderItem, so a second delete of the same photo is 404 and queues one row only"
  - "Requirements ORD-04 and JOB-02 are not marked complete here: the web delete button (later plans) and the removal job (09-28) still finish them, so REQUIREMENTS.md is untouched"

requirements-completed: []

coverage:
  - id: D1
    description: "DELETE removes the photo, renumbers the rest, queues one PhotoDeleted row and writes one order-image.deleted entry in the same save; the storage is not called"
    requirement: "ORD-04, JOB-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageDeletionQueueTests.cs#DeletingTheCoverOfThreePhotosAnswers200RenumbersTheRestQueuesOneRowAndCallsTheStorageForNothing"
  - id: D2
    description: "A second delete of the same photo answers 404 and keeps one queue row and one audit entry"
    requirement: "ORD-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageDeletionQueueTests.cs#DeletingTheSamePhotoTwiceAnswers200Then404AndQueuesOneRow"
  - id: D3
    description: "A photo of another order answers 404 and nothing is queued (CWE-639)"
    requirement: "ORD-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageDeletionQueueTests.cs#APhotoOfAnotherOrderAnswers404AndQueuesNothing"
  - id: D4
    description: "A delete on a Completed order answers 422 orders.locked, keeps the photo and queues nothing; a Cancelled order is refused in the domain and the handler tests"
    requirement: "ORD-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImageDeletionQueueTests.cs#ADeleteOnACompletedOrderAnswers422LockedKeepsThePhotoAndQueuesNothing"
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/RemoveOrderImageHandlerTests.cs#ACancelledOrderIsA422LockedAndNothingIsQueuedOrSaved"
  - id: D5
    description: "Anonymous gets 401, Admin and Manager reach the action (matrix row)"
    requirement: "ORD-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs (DELETE /api/v1/orders/{orderId:guid}/images/{imageId:guid})"
  - id: D6
    description: "Any mix of up to 20 moves, removes and adds on 1 to 5 photos keeps places 0..n-1 and slots apart"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderImageTests.cs#EverySequenceOfThreeMovesAndRemovesAmongOneToFivePhotosKeepsThePlacesWhole"
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderImageTests.cs#TwoHundredSeededSequencesOfTwentyMovesRemovesAndAddsKeepThePlacesWholeAndTheSlotsApart"
  - id: D7
    description: "The contract is published: LockedWrites lists the DELETE, the snapshot and types carry RemoveOrderImage, the docs describe it"
    requirement: "ORD-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiOrderWriteContractTests.cs"
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
---

# Phase 9 Plan 26: Delete a photo, and its storage removal is queued in the same save Summary

*Created: 2026-11-04T00:58:00-06:00 · Updated: 2026-11-04T00:58:00-06:00*

**Staff can delete an order photo: it leaves the order at once, the rest renumber (the next photo becomes the cover), and its file is queued for removal in the same save without any storage call.**

## What was built

- `Order.RemoveImage` checks the lock first (`orders.locked`), finds the photo on this order only (`orders.image-not-found`), removes it, renumbers the places to 0..n-1 and moves the edit version.
- `RemoveOrderImageHandler` copies `RemoveOrderItemHandler` (no version, `ConflictRetry`, `OrderChildWrite.AttemptAsync`). Inside the change lambda it calls `deletionQueue.Enqueue(publicId, PhotoDeleted)` after `RemoveImage` succeeded, so the queue row, the audit row and the photo removal share the one `SaveChangesAsync`. Nothing calls Cloudinary.
- `DELETE /api/v1/orders/{orderId}/images/{imageId}` (`RemoveOrderImage`) under the Staff policy, with 200/401/404/409/422 declared. Audit action `order-image.deleted` (catalog now 97 entries), detail `number=<n>;position=<1-based>`.
- Contract: matrix row, `LockedWrites` row, snapshot and generated types refreshed with the one-process switch and `npm run generate`; `docs/api/order-images.md` and `docs/operations/audit-log.md` document the DELETE, the queue (file leaves storage on the next monthly run, D-21) and the 404.

## TDD record

- **RED 1** (`ced5754b`): five new `OrderImageDeletionQueueTests` cases, the matrix row and the audit catalog count (97). They failed on the planned assertions: the DELETE answered 404 instead of 200/401 (7 integration failures, 379 run), and `AuditActions.All.Count` was 96 instead of 97 (2 failures). The audit-order test used the literal `"order-image.deleted"` so the test project still compiled. Semantic assessment: each failure was the target assertion on the planned behavior, not a build, fixture or discovery fault. The `gsd_run check tdd-red-evidence` classifier has no adapter for the xunit v3 console report, so I inspected the output by hand.
- **GREEN 1** (`d8741c88`): domain method, audit action, detail, handler, action, registration. 379 of 379 integration tests and 83 of 83 audit tests passed.
- **RED 2** (`cd5fd2b8`): property checks, plus the `LockedWrites` row. The snapshot test was the RED (it failed because the committed snapshot did not yet carry the new route). The property and `RemoveImage` domain tests passed at once because `Order.RemoveImage` already renumbers; the plan marks the property check as a backstop. To prove they have teeth I removed the renumber loop temporarily: 4 tests failed (both property tests and two `RemoveImage` cases), then restored it. The `LockedWrites` row also passed at once because the controller summary already names `orders.locked`.
- **GREEN 2** (`793a5c56`): snapshot and types refreshed, docs, and Application unit tests for the handler and the detail.
- No REFACTOR commit was needed.

## Checks (all run in this worktree, CSPS_TEST_SQL=localdb)

- Domain unit tests: 1239 passed, 0 failed. Application unit tests: 2190 passed, 0 failed. Architecture tests: 276 passed.
- Server integration, the plan's classes plus the arrange and upload endpoint classes: 458 passed, 0 failed.
- `dotnet format Csps.slnx --verify-no-changes`: exit 0. `npm --prefix tools/openapi-gen run check`: types match. `npm --prefix tools/openapi-gen test`: 9 of 9 passed.
- Build is warning-as-error in the test projects; no warning or error appeared. I did not run the whole-solution build or the web tests: the worktree has no restore for tools and `web/node_modules`, and the generated type change only adds one operation.
- Ports 5180, 5115 and 7028 were free; 5199 showed only TIME_WAIT sockets, no listener.
- gitleaks ran on every commit: no leaks.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `System.Random` is banned by the repo analyzers (RS0030)**
- **Found during:** Task 2, the seeded property test.
- **Fix:** a tiny seeded xorshift source (`Seeded`) inside `OrderImageTests`, so a failing seed can be replayed. Not used for anything secret.
- **Files modified:** `tests/Csps.Domain.UnitTests/Orders/OrderImageTests.cs`
- **Commit:** cd5fd2b8

**2. [Rule 1 - Performance] first version of the three-step enumeration took 22 s**
- **Fix:** labels are built only on failure and the checks use plain comparisons instead of Shouldly per step; the test now runs in about 3.5 s.
- **Commit:** cd5fd2b8

### Added beyond the plan

- Application unit tests (`RemoveOrderImageHandlerTests`, `OrderAuditDetailTests.ImageDeleted`) to keep Application coverage at or above 95 percent, since the handler is otherwise reached only through the integration project.
- Two extra integration cases from the threat register: a photo of another order (T-09-61) and a delete without a token.
- `docs/operations/audit-log.md` row for `order-image.deleted` (the audit docs list every action).
- The seeded property test also mixes in adds, to check slot reuse.

## Threat model

T-09-61 (another order's photo): found only through the route's order; integration test and matrix row. T-09-80 (closed order): `EnsureEditable` first; 422 tests at domain, handler and endpoint level. T-09-SC: no package added or bumped (`npm ci --ignore-scripts` in `tools/openapi-gen` installed the locked lockfile only; `node_modules` is git-ignored).

## Known Stubs

None.

## Notes for the next plans

- `AuditActions.All` is now at 97. 09-27 and any later plan that adds audit actions must update `AuditActionsTests` (count at the first test, the order test that pins the Phase 7 tail).
- The photo file stays in storage until the removal job (09-28) runs; that job must still skip a queue row whose public id an `OrderImages` row names (09-24 note).
- The web delete button and its call to `DELETE .../images/{imageId}` belong to the web plans (`RemoveOrderImage` is already in `web/src/types/api.generated.ts`).
- Nothing in this plan touches the shared `OrderPhotosCard`.

## Self-Check: PASSED

- Files: `RemoveOrderImageHandler.cs`, `RemoveOrderImageHandlerTests.cs` and this SUMMARY exist; the other modified files are listed in git for the four commits.
- Commits ced5754b, d8741c88, cd5fd2b8 and 793a5c56 are in `git log` after the base d4e7f11a (4 commits counted).
- `grep deletionQueue.Enqueue` in the handler: 1 match. `order-image.deleted` in `AuditActions.cs`: 1 match. `RemoveOrderImage` in the OpenAPI snapshot: 1 match. `docs/api/order-images.md` keeps its created value and has a new updated value.
