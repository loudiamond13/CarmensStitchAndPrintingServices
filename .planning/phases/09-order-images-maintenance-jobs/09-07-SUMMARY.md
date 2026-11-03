---
phase: 09-order-images-maintenance-jobs
plan: 07
subsystem: api
tags: [images, cloudinary, delivery, srcset, openapi, options-validation]

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-01 (OrderImage, Order.Images, TestingImageStorage, upload endpoint)
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-02 (IImageDelivery, CloudinaryImageDelivery, CloudinarySettings and its Validator)
provides:
  - OrderImageResponse, ImageSourceResponse and OrderDetailResponse.Images in Position order (Application)
  - OrderReader builds the photo addresses at read time in the detail read and the deleted mode
  - ImageCandidates (shared candidate rules) and TestingImageDelivery (Testing builds only)
  - ImagesRegistration registers the delivery per environment and validates CloudinarySettings on start outside Testing
  - appsettings Cloudinary:RootFolder csps (base) and csps-dev (Development)
  - OpenAPI snapshot, generated web types, and web fixtures orderImage(n, overrides) and images [] in buildOrderDetail
affects: [09-08, 09-09, 09-13, 09-16]

created: "2026-11-03T10:20:00-06:00"
updated: "2026-11-03T10:20:00-06:00"

actuals:
  tokens: 15700
  tasks: 2
  commits: 4

plan_head_before: a342722968588192db3a6e01ca4a846d3998d264
plan_head_after: 9e519671939776e47e313eae62bd9ed3740617d6
commits: 4

tech-stack:
  added: []
  patterns:
    - "A delivery supplies only the address of one named size; ImageCandidates decides which sizes a slot offers and their true widths, so Cloudinary and Testing cannot drift apart"
    - "Environment guard through IValidateOptions plus ValidateOnStart, as for email: a wrong folder stops the host before it serves"

key-files:
  created:
    - src/Csps.Infrastructure/Images/ImageCandidates.cs
    - src/Csps.Infrastructure/Images/TestingImageDelivery.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderImageDeliveryTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Images/ImagesRegistrationTests.cs
  modified:
    - src/Csps.Application/Orders/OrderDetailResponse.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - src/Csps.Infrastructure/Images/CloudinaryImageDelivery.cs
    - src/Csps.Infrastructure/Images/ImagesRegistration.cs
    - src/Csps.Server/appsettings.json
    - src/Csps.Server/appsettings.Development.json
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/test/orderFixtures.ts

key-decisions:
  - "ImageSourceResponse is its own record (as the plan names it) although it matches Application's ImageSource; the JSON is the same, and the API contract stays separate from the delivery port"
  - "TestingImageDelivery turns a public id into the last segment after the final slash and does no shape check, because Testing public ids (csps-test/...) are not the Cloudinary shape"
  - "Photos are read ordered by Position then Slot so the answer is stable even if two rows ever shared a position"

patterns-established:
  - "Adding a list to OrderDetailResponse costs one more statement in the detail read; the command-count test now says 9"

requirements-completed: []

status: complete
duration: 40min
completed: 2026-11-03
---

# Phase 9 Plan 07: Photos come back in the order answer with ready, sized addresses Summary

**Every order answer (read, every write, upload and deleted-order read) now lists its photos in Position order, each with thumb, viewer and full-size addresses built at read time by IImageDelivery; Testing gets same-origin addresses, other hosts get Cloudinary with the root-folder guard checked at start.**

## Performance

- **Duration:** about 40 min (09:35 to 10:14, -06:00), plus about 10 min for the full server run
- **Tasks:** 2 (Task 1 tracer, Task 2 auto), 4 commits

## Accomplishments

- `OrderDetailResponse.Images` holds `OrderImageResponse` rows: id, position, description, width, height, `thumb` and `viewer` (`src`, `srcSet`) and `fullSize`. An order with no photos answers `images: []`. No address is stored; `OrderReader` calls `ForPhoto` for each row.
- The same list comes back from `GET /api/v1/orders/{id}`, from the upload answer, and from the deleted-order read (the SoftDelete filter is lifted for the photo query as for the other children). Every other write answer goes through the same reader.
- `ImageCandidates` holds the candidate rules that used to live inside `CloudinaryImageDelivery` (09-02 tests stay green with no change). `TestingImageDelivery` (only in Debug builds, `#if CSPS_TESTING`) builds `/api/testing/images/{lastSegment}?size={name}` on it.
- `ImagesRegistration`: the Testing environment registers `TestingImageDelivery`; every other environment binds `CloudinarySettings` from the `Cloudinary` section, adds its `Validator` for the current environment name, `ValidateOnStart`, and registers `CloudinaryImageDelivery`.
- appsettings carry only `Cloudinary:RootFolder` (`csps`, and `csps-dev` in Development). No cloud name, key or secret is in any appsettings file (a test reads both files and checks).
- The OpenAPI snapshot, the generated web types (`OrderImageResponse`, `ImageSourceResponse`) and the web fixtures follow: `buildOrderDetail` has `images: []`, and the new `orderImage(n, overrides)` builder returns a complete photo. `deletedOrderFixtures.ts` needed no edit because its order comes from `buildOrderDetail`.

## Task Commits

1. **Task 1 RED:** `c7e6a23d` (test; 3 tests failed on the missing `images` property)
2. **Task 1 GREEN:** `f2c0091e` (feat; response, reader, candidates, delivery, registration, and the callers of the changed signatures)
3. **Task 2 RED:** `a3850ff2` (test; 2 of 6 failed because appsettings had no Cloudinary folder)
4. **Task 2 GREEN:** `9e519671` (feat; appsettings, snapshot, types, web fixtures)

## TDD Gate Compliance

- RED `c7e6a23d`: `OrderImageDeliveryTests` ended `total: 3, failed: 3, succeeded: 0` (`KeyNotFoundException`, no `images` property).
- GREEN `f2c0091e`: the same class plus `OrderImagesEndpointTests` ended `total: 23, failed: 0`.
- RED `a3850ff2`: `ImagesRegistrationTests` ended `total: 6, failed: 2, succeeded: 4`. The folder-guard and Testing tests already passed because plan 09-02 and task 1 hold that code; the two that failed are the ones that read the real appsettings.
- GREEN `9e519671`: `ImagesRegistrationTests` ended `total: 6, failed: 0`.

## Checks I saw

- Task 1 verify: `OrderImageDeliveryTests` + `OrderImagesEndpointTests`: `total: 23, failed: 0, succeeded: 23`. `CloudinaryImageDeliveryTests`: `total: 38, failed: 0`.
- Task 2 verify: `ImagesRegistrationTests` `total: 6, failed: 0`. `OpenApiSnapshotTests`: first run failed with "differs from the live document at $.components.schemas.ImageSourceResponse", the one-process write run wrote the snapshot, and the next run printed `total: 10, failed: 0`. `npm --prefix tools/openapi-gen run generate` then `run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." `npm --prefix web run typecheck`: no output, exit 0.
- `dotnet format Csps.slnx --verify-no-changes`: no output, exit 0. `dotnet build Csps.slnx`: `0 Warning(s), 0 Error(s)`.
- `Csps.Application.UnitTests`: `total: 1981, failed: 0`. `Csps.ArchitectureTests`: `total: 263, failed: 0`. `Csps.Infrastructure.IntegrationTests` (whole project): `total: 918, failed: 0, succeeded: 917`.
- Web: `npx eslint src/test/orderFixtures.ts` and `npx prettier --check` clean; `vitest run src/modules/admin/pages src/utils`: `Test Files 29 passed, Tests 1497 passed`.
- Full `Csps.Server.IntegrationTests` after preflight: `total: 1892, failed: 3, succeeded: 1889`. Failures: `OtherEnvironmentsIgnoreTheSwitch` (mine, fixed, see Deviations; re-run `TestingConfigurationTests` `total: 4, failed: 0`), and the two known timing tests. Alone: `OrderListTimingTests` passed (`total: 1, failed: 0`); `ExpenseListTimingTests` failed again alone (`total: 1, failed: 1`), as already recorded in `deferred-items.md` (357 ms on the commit before Phase 9). It reads company expenses only and this plan does not touch it.
- Acceptance: `CSPS_TESTING` count in `TestingImageDelivery.cs` >= 1, `ForPhoto` in `OrderReader.cs` >= 1, `csps-dev` in `appsettings.Development.json` 1, no `CloudName`/`ApiKey`/`ApiSecret` in either appsettings file, `OrderImageResponse` in `api.generated.ts` >= 1.
- `gitleaks protect --staged --no-banner` before each commit: "no leaks found".

## Decisions Made

- `ImageSourceResponse` is a separate record from `ImageSource`, following the plan's artifact list.
- The Testing delivery keeps only the last segment of the public id, so the address cannot leak the folder path and matches `TestingImageStorage.TryGet(lastSegment)`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Callers of the changed signatures**
- **Found during:** Task 1 (build)
- **Issue:** `OrderDetailResponse` gained a positional `Images` parameter and `OrderReader` gained `IImageDelivery`. Ten Application unit-test builders and three Infrastructure reader test files no longer compiled.
- **Fix:** Added `[]` for images in the test builders, and passed `new TestingImageDelivery()` to the readers in the tests.
- **Files modified:** `tests/Csps.Application.UnitTests/Orders/*HandlerTests.cs` (10 files), `tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReader*Tests.cs` (3 files)
- **Commit:** `f2c0091e`

**2. [Rule 1 - Bug in test] The detail read command count**
- **Found during:** Task 1
- **Issue:** `OrderReaderDetailSnapshotTests` pinned 8 database commands for a detail read. The photo list is one more statement.
- **Fix:** The test now expects 9 with a comment naming the statements.
- **Commit:** `f2c0091e`

**3. [Rule 1 - Bug in test] A Staging host met the live folder**
- **Found during:** full server run after Task 2
- **Issue:** `TestingConfigurationTests.OtherEnvironmentsIgnoreTheSwitch` starts a Staging host. The base appsettings now say `csps`, and the guard (D-07) refuses the live folder outside Production, as designed.
- **Fix:** The test sets `Cloudinary:RootFolder` to `csps-dev`, as a real non-Production host must.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Testing/TestingConfigurationTests.cs`
- **Commit:** `9e519671`

**Total deviations:** 3 (all test-side). **Impact:** none on the planned behavior.

## Requirements

IMG-03, IMG-04 and ORD-04 are shared by many Phase 9 plans (upload screen, reorder, cover, delete, viewer). As in plans 09-01 to 09-05, this plan does not tick them in REQUIREMENTS.md; they close when the phase is verified. The `requirements mark-complete` verb was run once and then reverted for that reason.

## Known risks and notes

- The Testing addresses point at `/api/testing/images/{id}?size=...`, but no controller serves that route yet. This plan builds only the addresses (the plan names no endpoint). Browser tests that need the bytes will need a Testing-only controller, in a later plan. Until then the web fixtures only use the strings.
- A real host that is not Production or Development (for example a future staging host) must set `Cloudinary__RootFolder=csps-dev`, or it stops at start with "Cloudinary:RootFolder csps is the live folder". Parked in the Phase 9 backlog so the cutover and runbook plans carry it.
- A non-Testing host without `Cloudinary:CloudName` starts, but reading an order that has photos throws "Cloudinary:CloudName is not set". No photo can exist on such a host (uploads answer 503), so this only matters if photos are restored into a host with no keys.

## Known Stubs

None. `images: []` in the web fixtures is the true answer for an order without photos, and the `orderImage` builder is used by later plans (09-16).

## Threat Flags

None. Addresses appear only in the Staff-only detail, write and deleted-order answers (T-09-21), the folder guard runs at start (T-09-22), and no package was added (T-09-SC).

## Issues Encountered

`ExpenseListTimingTests` fails on this machine (known); everything else passed.

## Next Phase Readiness

Plan 09-13 can reuse `ImageCandidates.ForCover` through `IImageDelivery.ForCover` for the orders list. Plans 09-08, 09-09 and 09-16 can read `images` from the order answer and use `orderImage(n)` in web tests.

## Self-Check: PASSED

- Files: `ImageCandidates.cs`, `TestingImageDelivery.cs`, `OrderImageDeliveryTests.cs`, `ImagesRegistrationTests.cs` and the 9 modified files exist on disk.
- Commits: `c7e6a23d`, `f2c0091e`, `a3850ff2` and `9e519671` are ancestors of HEAD.
