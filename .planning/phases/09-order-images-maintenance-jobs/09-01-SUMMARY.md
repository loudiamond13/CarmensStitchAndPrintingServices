---
phase: 09-order-images-maintenance-jobs
plan: 01
subsystem: api
tags: [order-images, multipart-upload, image-storage-port, jpeg-sniffing, ef-core, openapi]

requires:
  - phase: 07-orders-api
    provides: OrderChildWrite flow, Order aggregate, idempotency gate, authorization matrix
provides:
  - OrderImage child entity, OrderImageRules (5-photo limit), Order.AddImage and Order.CheckCanAddImage
  - IImageStorage port with an in-memory TestingImageStorage and an UnconfiguredImageStorage (503)
  - ImageSniffer (JPEG by first bytes), PublicIds (128-bit random ids), ImageErrors, ImageUploadSettings
  - UploadOrderImageHandler and POST /api/v1/orders/{orderId}/images (multipart, held in memory)
  - ErrorKind.Unavailable (503) with its own message and code kept
  - AddOrderImages migration (OrderImages table, slot and position checks, no trigger)
  - order-image.added audit action, matrix row, OpenAPI snapshot and generated web types
affects: [09-05, 09-07, 09-09, 09-10, 09-19, 09-27]

created: "2026-11-03T07:20:00-05:00"
updated: "2026-11-03T07:20:00-05:00"

actuals:
  tokens: 57000
  tasks: 2
  commits: 3

plan_head_before: 9cae86342a74f62d2e3881a388a0c20537adb5b7
plan_head_after: beca43338a4d4242f4a6e5a66915055056f06285
commits: 3

tech-stack:
  added: []
  patterns:
    - "Image storage behind a port; Testing gets an in-memory store (Debug builds only), every other host gets an unconfigured store that answers 503"
    - "Photo limit guarded by CHECK ranges plus a unique (OrderId, Slot) index, no trigger (OR-7)"
    - "A use-case 503 keeps its plain message and code through HttpContext.Items marker CspsProblemDetails.AuthoredErrorItem"

key-files:
  created:
    - src/Csps.Domain/Orders/OrderImage.cs
    - src/Csps.Domain/Orders/OrderImageRules.cs
    - src/Csps.Application/Ports/IImageStorage.cs
    - src/Csps.Application/Images/ImageSniffer.cs
    - src/Csps.Application/Images/PublicIds.cs
    - src/Csps.Application/Images/ImageErrors.cs
    - src/Csps.Application/Images/ImageFacts.cs
    - src/Csps.Application/Images/ImageKind.cs
    - src/Csps.Application/Images/ImageUploadSettings.cs
    - src/Csps.Application/Orders/UploadOrderImageHandler.cs
    - src/Csps.Application/Orders/UploadOrderImageRequest.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderImageConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261103121717_AddOrderImages.cs
    - src/Csps.Infrastructure/Images/ImagesRegistration.cs
    - src/Csps.Infrastructure/Images/TestingImageStorage.cs
    - src/Csps.Infrastructure/Images/UnconfiguredImageStorage.cs
    - src/Csps.Server/Controllers/OrderImagesController.cs
    - tests/Csps.Testing/Images/SyntheticImages.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs
    - tests/Csps.Domain.UnitTests/Orders/OrderImageTests.cs
    - tests/Csps.Application.UnitTests/Images/PublicIdsTests.cs
    - tests/Csps.Application.UnitTests/Images/ImageSnifferTests.cs
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Domain/Common/Error.cs
    - src/Csps.Domain/Common/ErrorKind.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Infrastructure/Orders/OrderStore.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs
    - src/Csps.Infrastructure/DependencyInjection.cs
    - src/Csps.Server/Http/ResultHttpExtensions.cs
    - src/Csps.Server/Http/CspsProblemDetails.cs
    - src/Csps.Server/Program.cs
    - src/Csps.Server/Composition/OpenApiRegistration.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "A use-case Unavailable error keeps its message and code in the 503 body; an unexpected fault still gets the fixed 'Something went wrong' text"
  - "No [Consumes] on the upload action: any [Consumes], even the one ASP.NET Core infers for IFormFile, turns a request with no content type into a 404 before authorization, so the matrix could not prove 401. The contract is still multipart/form-data through an OpenAPI operation transformer"
  - "The sniffer returns null for anything it cannot use (no exception); the handler maps null to images.type"
  - "A failed save after a successful upload leaves the file for the stray sweep; the queued compensation arrives with the deletion queue in a later plan"

patterns-established:
  - "Pre-check the order (exists, open, room, description) before any bytes reach storage"
  - "Public id = {root}/orders/{orderId}/{26 base32 chars from 16 RandomNumberGenerator bytes}"

requirements-completed: []
requirements-advanced: [ORD-04, IMG-01, IMG-02, IMG-03]

coverage:
  - id: D1
    description: "A JPEG posted to an order is stored through the port and saved as a photo row at Slot 0 and Position 0 with its size, bytes and format, audited as order-image.added"
    requirement: "ORD-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs#AManagerUploadsAJpegAndTheOrderIsAnsweredWithOnePhotoSavedAtSlotZero"
        status: pass
    human_judgment: false
  - id: D2
    description: "A file that is not a JPEG by its first bytes is refused with the type message and never reaches storage"
    requirement: "IMG-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs#ASvgNamedAsAJpegIsRefusedByItsBytesAndNothingIsSentToStorage"
        status: pass
    human_judgment: false
  - id: D3
    description: "An order holds at most 5 photos, takes none while Completed or Cancelled, and keeps a clean description"
    requirement: "ORD-04"
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderImageTests.cs"
        status: pass
    human_judgment: false
  - id: D4
    description: "Public ids carry 128 random bits and never the file name"
    requirement: "IMG-03"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Images/PublicIdsTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "A host with no image storage starts, /health stays 200, and the upload answers 503 'Photo uploads aren't set up yet.'"
    requirement: "IMG-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs#AHostWithNoImageStorageStartsAnswersTheUploadWith503AndKeepsTheHealthCheckGreen"
        status: pass
    human_judgment: false
  - id: D6
    description: "The upload is in the authorization matrix (anonymous 401, Admin 400, Manager 400), the OpenAPI snapshot and the generated web types"
    requirement: "ORD-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrixTests.cs, tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false

duration: 195min
completed: 2026-11-03
status: complete
---

# Phase 9 Plan 01: Upload one photo to an order through the API Summary

**Staff can POST one JPEG to an order and it is sniffed by its first bytes, stored through an image-storage port under a random 128-bit id, saved as a slot-guarded OrderImages row under the order's lock, audited, and answered as the whole order; with no storage set up the host still starts and the upload answers 503.**

## Performance

- **Duration:** about 195 min
- **Started:** 2026-11-03T05:50:00-05:00
- **Completed:** 2026-11-03T07:20:00-05:00
- **Tasks:** 2
- **Files modified:** 46 (3 commits)

## Accomplishments

- The phase tracer works end to end on the server: Domain child, EF table with the 5-photo guard, port, handler, controller, error mapping, matrix row, contract.
- A refused upload never reaches storage: the order is pre-checked (exists, open, room, description) and the bytes are sniffed before `UploadAsync`.
- No trigger anywhere: the guard is `Slot` tinyint `CHECK 0 to 4` with a unique `(OrderId, Slot)` index, and `Position` `CHECK 0 to 4` and not unique.

## Task Commits

1. **Task 1: Upload one JPEG to an order and see the photo saved** - `36ed21b0` (test, RED) then `6d687263` (feat, GREEN)
2. **Task 2: Domain rules, random ids and the contract gates** - `beca4333` (feat)

**Plan metadata:** added by the final docs commit (SUMMARY, STATE, ROADMAP).

## TDD Gate Compliance

- **RED (`36ed21b0`):** the endpoint tests, `OrderImageTests`, `PublicIdsTests` and the audit catalog test were committed against compile shells only (an `AddImage` that always fails, empty `PublicIds`, an empty `TestingImageStorage`). Machine check of the RED evidence for two target tests returned `RED_EVIDENCE_OK` (JUnit XML from the xUnit runner):
  - `OrderImageTests.FivePhotosTakeSlotsZeroToFourAndPositionsZeroToFourAndLinkToTheOrder`: `added.IsSuccess should be True but was False`.
  - `OrderImagesEndpointTests.AManagerUploadsAJpegAndTheOrderIsAnsweredWithOnePhotoSavedAtSlotZero`: `response.StatusCode should be OK but was NotFound`.
  - Semantic assessment: both ran and failed on the planned assertion for the intended reason (behavior not built). One test, `AnUnknownOrderAnswers404AndNothingIsSentToStorage`, failed on a missing `code` member of the fallback 404 body (the route did not exist yet), which is an exception on the planned code assertion, not on the planned status.
  - The anonymous 401 test was left out of the endpoint class on purpose: the default-deny fallback already answers 401 for an unknown route, so it would have been green in RED. The matrix row covers it.
- **GREEN (`6d687263`):** all of the above pass; Task 1 verify commands re-run green (tracer check): 8 of 8 endpoint tests, 80 of 80 `AuditActionsTests`.
- **Task 2:** its RED was the two contract gates failing after the Task 1 commit (`AuthorizationMatrixTests.DiscoveredEndpointsAreFullyCovered`: "POST /api/v1/orders/{orderId:guid}/images: has no authorization-matrix row." and `OpenApiSnapshotTests.CommittedSnapshotMatchesTheLiveDocument`: "differs from the live /openapi/v1.json at $.paths['/api/v1/orders/{orderId}/images']"). There is no separate RED commit for Task 2 because the gate failure existed in the tree after the Task 1 commit. The plan is `type: execute`, so the plan-level gate rule does not apply.
- **REFACTOR:** none.

## Requirements

This plan is the server tracer only. ORD-04, IMG-01, IMG-02 and IMG-03 are advanced but not complete (PNG, WebP and HEIC, metadata stripping, size rules, reorder, cover, delete and the screens come in later plans), so `REQUIREMENTS.md` is left unchanged and the checkboxes stay open until those plans land.

## Check results (seen in this session, `CSPS_TEST_SQL=localdb`)

| Check | Result |
|---|---|
| `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImagesEndpointTests"` | 8 of 8 passed (9 with the contract test added later) |
| `*OrderImagesEndpointTests`, `*ResultHttpExtensionsTests`, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests`, `*IdempotencyCoverageTests`, `*OpenApiSnapshotTests` together | `total: 408  failed: 0  succeeded: 408` |
| `tests/Csps.Domain.UnitTests` (whole project) | `total: 1202  failed: 0  succeeded: 1202` |
| `tests/Csps.Application.UnitTests` (whole project) | `total: 1943  failed: 0  succeeded: 1943` |
| `tests/Csps.ArchitectureTests` | `total: 242  failed: 0  succeeded: 242` |
| `tests/Csps.Infrastructure.IntegrationTests` | `total: 767  failed: 0  succeeded: 766` (one test not counted as passed, none failed; it was skipped by the suite itself) |
| `npm --prefix tools/openapi-gen run check` | `Generated API types match tools/openapi-gen/openapi.v1.json.` |
| `dotnet format Csps.slnx --verify-no-changes` | exit 0, no output |
| `dotnet build Csps.slnx` | `0 Warning(s)  0 Error(s)` |
| `npm run typecheck` in `web/` | exit 0 |
| `gitleaks protect --staged --no-banner` (each of 3 commits) | `no leaks found` |

Full Server.IntegrationTests run (9 min 41 s, before the final Program.cs fix): `total: 1867  failed: 6  succeeded: 1861`. Four failures were the new matrix row (fixed by the Program.cs change, all green afterwards, see Deviation 4). The other two are the timing tests, see "Deferred issues".

## Migration (`20261103121717_AddOrderImages`, generated by `dotnet ef migrations add AddOrderImages --project src/Csps.Infrastructure --startup-project src/Csps.Server`)

Read line by line. **Up** creates one new table and nothing else:

- `OrderImages`: `Id uniqueidentifier`, `OrderId uniqueidentifier`, `Slot tinyint`, `Position int`, `PublicId nvarchar(200)`, `Width int`, `Height int`, `Bytes int`, `Format varchar(8)`, `Description nvarchar(200) null`, `CreatedById`, `CreatedAtUtc datetimeoffset`, `UpdatedById`, `UpdatedAtUtc`.
- Constraints: `PK_OrderImages`, `CK_OrderImages_Position_Range` (`[Position] BETWEEN 0 AND 4`), `CK_OrderImages_Slot_Range` (`[Slot] BETWEEN 0 AND 4`), two user foreign keys with no action, `FK_OrderImages_Orders_OrderId` with cascade delete.
- Indexes: `IX_OrderImages_CreatedById`, `IX_OrderImages_UpdatedById`, `IX_OrderImages_OrderId_Position` (includes `PublicId`, `Width`, `Height`), `IX_OrderImages_OrderId_Slot` (unique), `IX_OrderImages_PublicId` (unique).

**Down** is `DropTable("OrderImages")`, the migration's own new table only. No trigger, no JSON column, no drop, rename or lossy change of existing data. The plan's file name `20261101000001_AddOrderImages` was a placeholder; the real name is above.

## Files Created/Modified

See `key-files` above. The Server surface is `OrderImagesController` (`POST api/v1/orders/{orderId:guid}/images`, endpoint name `UploadOrderImage`, `[RequestFormLimits]` with `MemoryBufferThreshold` above `MultipartBodyLengthLimit`, file copied into a `MemoryStream`, never a temp file).

## Decisions Made

- 503 for a missing storage keeps its own message and code (see Deviation 3).
- Two messages that the plan's truths do not give were written by me and are flagged for the owner: `images.file-missing` "Choose a photo to upload." and `images.storage-failed` "The photo couldn't be saved. Try again."
- `ImageFacts` keeps the stored size and the orientation and exposes `UprightWidth` and `UprightHeight`; the row stores the upright size.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Real migration file name**
- **Found during:** Task 1 (migration)
- **Issue:** the plan named `20261101000001_AddOrderImages`; dotnet-ef stamps the real time.
- **Fix:** kept the generated name `20261103121717_AddOrderImages` (it sorts after every existing migration).
- **Files modified:** the three migration files.

**2. [Rule 3 - Blocking] `OrderConfiguration.cs` edited (not in the file list)**
- **Issue:** the order-to-photos relationship (cascade, field access) belongs next to the other children.
- **Fix:** `HasMany(Images)` and `UsePropertyAccessMode(Field)`.
- **Files modified:** `src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs`.
- **Commit:** `6d687263`

**3. [Rule 1 - Bug] A 503 could not carry its own message and code**
- **Found during:** Task 1 (the 503 endpoint test)
- **Issue:** `CspsProblemDetails` and `CustomizeProblemDetails` replace the detail of every 5xx with "Something went wrong. Reference: ..." and drop the code, so the plan's "503 'Photo uploads aren't set up yet.'" and "its code and message" could not be met. An existing test (`ServiceUnavailableUsesItsOwnTitle`) requires that an unexpected 503 stays hidden.
- **Fix:** `ResultHttpExtensions` marks an `ErrorKind.Unavailable` answer with `HttpContext.Items[CspsProblemDetails.AuthoredErrorItem]`; `CspsProblemDetails.Build` and `Apply` keep the detail and code only when that marker is set. Two tests prove both sides.
- **Files modified:** `src/Csps.Server/Http/CspsProblemDetails.cs`, `src/Csps.Server/Http/ResultHttpExtensions.cs`, `tests/Csps.Server.IntegrationTests/Http/ResultHttpExtensionsTests.cs`.
- **Commits:** `6d687263`, `beca4333`

**4. [Rule 3 - Blocking] `[Consumes("multipart/form-data")]` could not stay on the action**
- **Found during:** Task 2 (authorization matrix)
- **Issue:** with `[Consumes]` (also with `IsOptional = true`, and with the one ASP.NET Core infers for `IFormFile`), a request with no content type matches no endpoint and gets a 404 from the `/api` fallback, for anonymous too. The matrix sends no body, so it could not show the required anonymous 401. Without `[Consumes]` the OpenAPI document said `application/x-www-form-urlencoded`, and with an explicit `[FromForm]` on the file it expanded `IFormFile` into an object.
- **Fix:** the `file` parameter has no explicit `[FromForm]` (so the document says `format: binary`); `Program.cs` sets `SuppressConsumesConstraintForFormFileParameters = true`; an OpenAPI operation transformer in `OpenApiRegistration` turns a form that carries a file into `multipart/form-data`. Result: anonymous 401, Admin 400, Manager 400 in the matrix, and the snapshot says multipart with a binary `file`. A test pins the contract.
- **Files modified:** `src/Csps.Server/Program.cs`, `src/Csps.Server/Composition/OpenApiRegistration.cs`, `src/Csps.Server/Controllers/OrderImagesController.cs`.
- **Commit:** `beca4333`

**5. [Rule 1 - Bug] An existing audit test pinned the end of the catalog**
- **Found during:** Task 1
- **Issue:** `ThePhaseSevenCodesComeAfterThePhaseSixCodesInThisOrder` used `Skip(49)` to the very end, so any new code broke it.
- **Fix:** `OrderImageAdded` goes at the end of `AuditActions.All` (a Phase 9 tail) and the test now reads `Skip(49).Take(43)` and checks the tail.
- **Files modified:** `tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs`.

**6. [Rule 2 - Missing critical] Extra unit tests for Application and Domain coverage**
- Added `ImageSnifferTests` (22 cases: orientation, big-endian Exif, damaged and truncated files, segment cap), `ImageErrorsTests`, `ImageUploadSettingsTests` and `ErrorTests.UnavailableSetsKindCodeAndMessage`, so the new Application code and the new Domain factory are covered and Domain stays at full branch coverage.

**7. Test placement.** `OrderImageTests` and `PublicIdsTests` are listed under Task 2 in the plan; they were written in Task 1's RED commit so the domain got a real RED. Task 2 then held the contract gates only.

### Auth gates

None.

## Deferred Issues

- **`ExpenseListTimingTests.TheListAndTheKpisAnswerUnder300MsAtP95OnFiveYearsOfData`** failed in the full run and alone (`five years, last page, size 100: p95 313.1 ms`, then `334.5 ms`, limit 300 ms). It reads company expenses and does not touch photos. On the commit before this plan (`9cae8634`, built in a throwaway checkout) the same test failed the same way (`p95 357.3 ms`), so it is not caused by this plan. `OrderListTimingTests` failed in the full run (machine under load) and passed when run alone. Both are logged in `deferred-items.md`.
- A photo file whose row save then fails (a lost race twice) stays in storage until the stray sweep (D-23); the queued compensation comes with the deletion queue in a later plan.
- Uploads over 1 MiB still get a 413 from `RequestBodyLimitMiddleware` and the idempotency middleware's 1 MiB hash cap until the plan that raises the limits for this route (the endpoint declares the 413 and carries `[RequestFormLimits]` already).
- The audit log screen does not yet have a label for `order-image.added` (web `auditCopy.ts`, plan 09-27); the `docs/api/orders.md` and `docs/operations/audit-log.md` entries come with plan 09-09.

## Known Stubs

- `src/Csps.Infrastructure/Images/UnconfiguredImageStorage.cs`: intentional; every non-Testing host answers 503 until plan 09-19 adds the Cloudinary storage.

## Threat Flags

None beyond the plan's threat model (T-09-01 sniffed bytes, T-09-02 write only through the route's order under its lock and the Staff policy, T-09-04 audit detail names the order number and position only and ids are random, T-09-SC no package added).

## Self-Check

## Self-Check: PASSED

All twelve key created files were found on disk, and the commits `36ed21b0`, `6d687263` and `beca4333` are ancestors of HEAD. Acceptance greps: `MaxImagesPerOrder = 5` found; `RequestFormLimits` count 1; `CK_OrderImages_Slot_Range` and `IX_OrderImages_OrderId_Slot` in the one migration file; `trigger` count 0 in it; `order-image.added`, `Photo uploads aren't set up yet.`, `This order already has 5 photos.`, `orders/{orderId}/images` (matrix comment) and `UploadOrderImage` (snapshot) all present.
