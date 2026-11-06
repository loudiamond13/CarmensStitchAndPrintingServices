---
phase: 09-order-images-maintenance-jobs
plan: 05
subsystem: api
tags: [order-images, upload-limits, image-inspection, schema-guard, no-disk, race]

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-01 upload tracer (ImageSniffer, ImageErrors, UploadOrderImageHandler, OrderImages table, TestingImageStorage)
provides:
  - ImageInspection.Check (type, bytes, 64-bit pixels and long side on the upright size)
  - ImageErrors.TooLarge and ImageErrors.TooBig with codes images.too-large and images.too-big
  - MultipartBodies and MultipartPart test helper (multipart body with a chosen boundary)
  - Endpoint refusal and race tests, OrderImageSchemaTests, ImageInspectionTests, UploadNoDiskTests
affects: [09-14, 09-06, 09-07]

created: "2026-11-03T09:05:00-06:00"
updated: "2026-11-03T09:05:00-06:00"

actuals:
  tokens: 11700
  tasks: 2
  commits: 3

plan_head_before: b923b06dacac8187e0eca5a25334182b8681f3fe
plan_head_after: 78e0b3c40a1aa7d183edb1e51b8b1b0eaecb62ed
commits: 3

tech-stack:
  added: []
  patterns:
    - "Limits reach the handler as the plain ImageUploadSettings object, registered from IOptions in ImagesRegistration (Application has no Options package)"
    - "Schema guard tests write rows through a tiny EF context mapped to OrderImages, so the domain cannot hide a bad row and no SQL text is needed"

key-files:
  created:
    - src/Csps.Application/Images/ImageInspection.cs
    - tests/Csps.Testing/MultipartBodies.cs
    - tests/Csps.Application.UnitTests/Images/ImageInspectionTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderImageSchemaTests.cs
    - tests/Csps.ArchitectureTests/UploadNoDiskTests.cs
  modified:
    - src/Csps.Application/Images/ImageErrors.cs
    - src/Csps.Application/Orders/UploadOrderImageHandler.cs
    - src/Csps.Infrastructure/Images/ImagesRegistration.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs

key-decisions:
  - "The byte-limit message is built from the configured MaxBytes: at the default it reads '{file name} is over 10 MB. Choose a smaller photo.', a lower setting shows KB or bytes"
  - "The pixel and side message stays the fixed D-34 text 'Photos can be at most 25 megapixels.'"

requirements-completed: []
requirements-advanced: [ORD-04, IMG-01, IMG-02]

status: complete
duration: 35min
completed: 2026-11-03
---

# Phase 9 Plan 05: The photo limit, the closed-order lock and the size rules hold at the endpoint Summary

**Every refusal an upload owes now happens before storage: a sixth photo, a closed, deleted or unknown order, a file over the byte limit, a photo over 25 megapixels or 10,000 px, a long description and a missing file. The database refuses a sixth row without a trigger, two racing uploads leave exactly 5 rows, and uploads are pinned to memory only.**

## Performance

- **Duration:** about 35 min (08:28 to 09:05, -06:00)
- **Tasks:** 2 (Task 1 tracer, Task 2 auto), 3 commits

## Accomplishments

- `ImageInspection.Check` runs the first-bytes sniff, then bytes against `MaxBytes`, then 64-bit pixels against `MaxPixels` and the long side against `MaxSide`, all on the upright size (Exif orientations 5 to 8 swap width and height). The handler calls it after the pre-check and before `UploadAsync`.
- The endpoint now proves, with `TestingImageStorage` recording no upload, that every refusal stays out of storage.
- The database guard is checked row by row, and `UploadNoDiskTests` pins the no-disk rule in source and in the action's attribute.

## Task Commits

1. **Task 1: refusals at the endpoint** - `692bd53e` (test, RED: 4 failing) then `26afeb6e` (feat, GREEN)
2. **Task 2: boundaries, schema guard, no-disk** - `78e0b3c4` (test)

## TDD Gate Compliance

- **RED (`692bd53e`):** 20 endpoint tests, 4 failed for the intended reason (behavior not built): `AFileOneByteOverTheLimitAnswers400NamingTheFileAndIsNotSentToStorage` and the three `APhotoWithTooManyPixelsOrTooLongASideAnswers400AndIsNotSentToStorage` cases, each `response.StatusCode should be BadRequest but was OK`. The other 16 (sixth photo, Completed, deleted and unknown orders, description, no file, race) already passed because plan 09-01 built the pre-check; they now pin that behavior.
- **GREEN (`26afeb6e`):** `total: 20  failed: 0  succeeded: 20`.
- **Task 2:** the code it tests was built in Task 1, so its tests passed on first run and there is no RED commit for it. To show they can fail I broke the code twice and restored it: changing `>` to `>=` on the pixel check failed 4 `ImageInspectionTests` cases, and removing the `(long)` cast failed `ThePixelCountIsWorkedOutIn64BitArithmetic`. The source was restored with `git checkout` of that one file.
- **Tracer gate:** after Task 1, the verify command was re-run end to end before Task 2 and passed (20 of 20).

## Check results (seen in this session, `CSPS_TEST_SQL=localdb`)

| Check | Result |
|---|---|
| `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImagesEndpointTests"` | `total: 20  failed: 0  succeeded: 20` |
| `*OrderImagesEndpointTests`, `*AuthorizationMatrixTests`, `*OpenApiSnapshotTests`, `*IdempotencyCoverageTests` together | `total: 389  failed: 0  succeeded: 389` |
| `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageInspectionTests"` | `total: 28  failed: 0  succeeded: 28` |
| `dotnet test --project tests/Csps.Application.UnitTests` (whole) | `total: 1971  failed: 0  succeeded: 1971` |
| `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*OrderImageSchemaTests" --filter-class "*TriggerInventoryTests" --filter-class "*MigrationScriptTests"` | `total: 15  failed: 0  succeeded: 15` |
| `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*UploadNoDiskTests"` | `total: 14  failed: 0  succeeded: 14` |
| `dotnet test --project tests/Csps.ArchitectureTests` (whole) | `total: 263  failed: 0  succeeded: 263` |
| `dotnet test --project tests/Csps.Domain.UnitTests` (whole) | `total: 1202  failed: 0  succeeded: 1202` |
| `dotnet build Csps.slnx --no-incremental` | `0 Warning(s)  0 Error(s)` |
| `dotnet format Csps.slnx --verify-no-changes` | exit 0, no output |
| `gitleaks protect --staged --no-banner` (each of 3 commits) | `no leaks found` |
| Acceptance greps | `Photos can be at most 25 megapixels.` in `ImageErrors.cs` (via `TooBigSuffix`); `ImageInspection.Check` in the handler; endpoint test `TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` asserts 5 rows; tests `ATruncatedJpeg...` and `AJpegWithASelfLoopingSegmentLength...` assert failure; `MemoryBufferThreshold` in `UploadNoDiskTests.cs` |

Application line and branch coverage was not measured with the coverage gate in this plan. `ImageInspection` and `ImageErrors` are fully exercised by the unit tests; the handler itself is covered by the endpoint tests only, as in plan 09-01.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A 12 MB file cannot reach the handler yet**
- **Found during:** Task 1 (planning the RED tests)
- **Issue:** the plan's behavior says a 12 MB JPEG answers 400 with the 10 MB message. `RequestBodyLimitMiddleware` and the idempotency middleware still cap every body at 1 MiB, so such a request gets 413 before the action runs. Plan 09-14 raises the limit for this route only (recorded in the 09-01 summary).
- **Fix:** the endpoint test lowers `Images:MaxBytes` for one test host (`UseSetting`) to the size of a tiny synthetic JPEG: exactly that size is accepted, one byte more answers 400 `images.too-large` and is not stored. The real 10 MB text and the exact 10,485,760 / 10,485,761 boundary are proven in `ImageInspectionTests` with in-memory files.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Orders/OrderImagesEndpointTests.cs`

**2. [Rule 3 - Blocking] The handler needed the limits (file not in the plan list)**
- **Issue:** `ImageInspection.Check` takes `ImageUploadSettings`, but the handler did not receive them, and Application has no Options package.
- **Fix:** the handler takes `ImageUploadSettings`; `ImagesRegistration` registers it as a singleton from the validated `IOptions<ImageUploadSettings>`. No package added.
- **Files modified:** `src/Csps.Application/Orders/UploadOrderImageHandler.cs`, `src/Csps.Infrastructure/Images/ImagesRegistration.cs`
- **Commit:** `26afeb6e`

**3. [Rule 2 - Missing critical] The byte message follows the configured limit**
- **Issue:** `Images:MaxBytes` can be lowered, and a fixed "10 MB" text would then be wrong.
- **Fix:** `ImageErrors.TooLarge(fileName, maxBytes)` writes MB, KB or bytes from the setting. At the default it is exactly "{file name} is over 10 MB. Choose a smaller photo." The pixel message is the fixed D-34 text. Flagged for the owner in case a fixed text is preferred.
- **Commit:** `26afeb6e`

**4. [Rule 3 - Blocking] `SyntheticImages` is not reachable from the Application unit tests**
- **Issue:** `Csps.Application.UnitTests` does not reference `Csps.Testing`, and adding a project reference for one helper is a structure change.
- **Fix:** `ImageInspectionTests` carries a small private JPEG builder (same shape as the one in `ImageSnifferTests`).

**5. Schema tests write through a small EF context.** `OrderImageSchemaTests` maps a private row class to `OrderImages` (EF only, no SQL text), and builds the parent order with the domain `Order.Create`. The older `OrderRefundsMigrationTests` use SQL text; this plan follows the plan text (LINQ and EF only).

**6. Race needed no new code.** The two-uploads test passed on first run with no change to `CspsUnitOfWork` or the handler: one answer is 200 and the other 409 or 422, and exactly 5 rows with slots 0 to 4 remain. The loser's file stays in storage until the stray sweep, the known item from plan 09-01.

### Auth gates

None.

## Deferred Issues

- A race loser's already-stored file stays until the stray sweep (D-23); the queued compensation comes with the deletion queue in a later plan (same item as plan 09-01).
- Real uploads over 1 MiB still answer 413 until plan 09-14.
- The two known timing flakes (`ExpenseListTimingTests`, `OrderListTimingTests`) are already in `deferred-items.md`; they were not run in this plan.

## Known Stubs

None added. (`UnconfiguredImageStorage` remains the intentional stub from plan 09-01.)

## Threat Flags

None. T-09-03 (disk spill) is mitigated and pinned by `UploadNoDiskTests`; T-09-05 (hostile JPEG) by the truncated, zero-length, one-length and 600-segment fixtures that all fail as results; T-09-SC: no package added or bumped.

## Self-Check: PASSED

Created files found on disk: `ImageInspection.cs`, `MultipartBodies.cs`, `ImageInspectionTests.cs`, `OrderImageSchemaTests.cs`, `UploadNoDiskTests.cs`. Commits `692bd53e`, `26afeb6e` and `78e0b3c4` are ancestors of HEAD.
