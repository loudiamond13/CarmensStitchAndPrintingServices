---
phase: "09"
slug: "order-images-maintenance-jobs"
status: draft
nyquist_compliant: true
wave_0_complete: false
created: "2026-10-31T10:10:00-05:00"
updated: "2026-11-04T09:45:00-06:00"
---

# Phase 9: Validation Strategy

> Per-phase validation contract for feedback sampling during execution. The full requirement-to-test map is in `09-RESEARCH.md` under "Validation Architecture".

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | .NET: xunit.v3 on Microsoft.Testing.Platform, Shouldly, NSubstitute, FakeTimeProvider. Web: Vitest + RTL + MSW 3; Playwright + axe |
| **Config file** | `global.json`, `web/vitest.config.ts`, `web/playwright.config.ts` |
| **Quick run command** | `dotnet test --project tests/<Project> --filter-class "*<Class>"` or `npm --prefix web run test -- --run <path>` |
| **Full suite command** | preflight (`powershell -NoProfile -ExecutionPolicy Bypass -File C:\Work\dev-tools\preflight.ps1 -Ports 5180,5115,7028,5199`), then `dotnet test --solution Csps.slnx` (with `CSPS_TEST_SQL=localdb` set in that process only), `npm --prefix web run verify`, `npm --prefix web run e2e` |
| **Estimated runtime** | quick: about 30 seconds; full: about 15 minutes |

---

## Sampling Rate

- **After every task commit:** run the quick command for the class or file the task touches.
- **After every plan wave:** run the full .NET suite after preflight, plus `npm --prefix web run verify`.
- **Before `/gsd-verify-work`:** full suite, coverage gate, e2e and the manual phone and HEIC checks must be green.
- **Max feedback latency:** 60 seconds for quick runs.

---

## Per-Task Verification Map

Filled from the plans and their summaries (plan 09-30). A task is `green` when its plan has a summary. Each row maps a task to a requirement and its automated command, using the test classes named in `09-RESEARCH.md` (Validation Architecture).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 1 | 1 | ORD-04, IMG-01, IMG-02, IMG-03 | T-09-01, T-09-02, T-09-04, T-09-SC | A JPEG posted to an order is stored through the port and saved as a photo row; an unconfigured host answers 503 without breaking. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImagesEndpointTests" (+1 more)` | yes | green |
| 09-01-02 | 1 | 1 | ORD-04, IMG-01, IMG-02, IMG-03 | T-09-01, T-09-02, T-09-04, T-09-SC | No order can hold a sixth photo or take one while closed, ids are random, and the upload is published in the contract with every caller checked. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderImageTests" (+4 more)` | yes | green |
| 09-02-01 | 2 | 1 | IMG-03, IMG-04 | T-09-06, T-09-07, T-09-SC | A stored photo has a thumb address that strict mode will serve. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinaryImageDeliveryTests"` | yes | green |
| 09-02-02 | 2 | 1 | IMG-03, IMG-04 | T-09-06, T-09-07, T-09-SC | No slot can load a file larger than it shows. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinaryImageDeliveryTests" --filter-class "*ImageNamedSizesTests"` | yes | green |
| 09-02-03 | 2 | 1 | IMG-03, IMG-04 | T-09-06, T-09-07, T-09-SC | A development host can never point at the live photo folder, and live can never point anywhere else. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinarySettingsTests" (+1 more)` | yes | green |
| 09-03-01 | 3 | 1 | IMG-05, IMG-02 | T-09-09, T-09-10, T-09-SC | A big phone photo is shrunk before upload; a small one goes as it is. | web unit | `npm --prefix web run test -- --run src/utils/images.test.ts` | yes | green |
| 09-03-02 | 3 | 1 | IMG-05, IMG-02 | T-09-09, T-09-10, T-09-SC | Only photos the server will accept leave the browser, already the right size. | web unit | `npm --prefix web run test -- --run src/utils/images.test.ts (+2 more)` | yes | green |
| 09-04-01 | 4 | 1 | ORD-04, IMG-04 | T-09-11, T-09-12, T-09-SC | A photo opens in a dialog, steps on and closes, reporting which photo was last shown. | web unit | `npm --prefix web run test -- --run src/components/media/PhotoViewer.test.tsx src/components/states/LazyImage.test.tsx src/components/index.test.ts` | yes | green |
| 09-04-02 | 4 | 1 | ORD-04, IMG-04 | T-09-11, T-09-12, T-09-SC | The viewer works by keyboard and touch on every width, and survives failed images and changed photo lists. | web unit | `npm --prefix web run test -- --run src/components/media/PhotoViewer.test.tsx` | yes | green |
| 09-04-03 | 4 | 1 | ORD-04, IMG-04 | T-09-11, T-09-12, T-09-SC | "Take Photo" has its camera icon from the package already installed. | web unit | `npm --prefix web run test -- --run src/components/brand/Icon.test.tsx (+2 more)` | yes | green |
| 09-05-01 | 5 | 2 | ORD-04, IMG-01, IMG-02 | T-09-03, T-09-05, T-09-SC | No refused upload ever reaches storage, and no order can hold a sixth photo even under a race. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImagesEndpointTests"` | yes | green |
| 09-05-02 | 5 | 2 | ORD-04, IMG-01, IMG-02 | T-09-03, T-09-05, T-09-SC | Every size edge is exact, the database itself refuses a sixth photo, and uploads provably never touch disk. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageInspectionTests" (+3 more)` | yes | green |
| 09-06-01 | 6 | 2 | JOB-01 | T-09-16, T-09-18, T-09-SC | A keyed call purges expired request keys and answers counts; every other caller gets 401. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MaintenanceEndpointTests"` | yes | green |
| 09-06-02 | 6 | 2 | JOB-01 | T-09-16, T-09-18, T-09-SC | The run endpoint is covered by every discovery gate and stays out of the published contract. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MaintenanceEndpointTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*IdempotencyCoverageTests" --filter-class "*OpenApiSnapshotTests" (+1 more)` | yes | green |
| 09-07-01 | 7 | 2 | IMG-04, ORD-04, IMG-03 | T-09-21, T-09-22, T-09-SC | Staff answers list every photo in order with ready addresses for every slot. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImageDeliveryTests" --filter-class "*OrderImagesEndpointTests" (+1 more)` | yes | green |
| 09-07-02 | 7 | 2 | IMG-04, ORD-04, IMG-03 | T-09-21, T-09-22, T-09-SC | Each host knows its own photo folder, and the web types describe every photo field. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*ImagesRegistrationTests" (+4 more)` | yes | green |
| 09-08-01 | 8 | 2 | ORD-04, IMG-05 | T-09-24, T-09-25, T-09-SC | Staff on a computer or a phone can pick photos and see each photo with visible, named controls. | web unit | `npm --prefix web run test -- --run src/components/media/ImageUploader.test.tsx src/components/media/PhotoTile.test.tsx src/components/index.test.ts` | yes | green |
| 09-08-02 | 8 | 2 | ORD-04, IMG-05 | T-09-24, T-09-25, T-09-SC | Every tile state, mode and limit behaves predictably from the keyboard, the mouse and touch. | web unit | `npm --prefix web run test -- --run src/components/media/ImageUploader.test.tsx src/components/media/PhotoTile.test.tsx` | yes | green |
| 09-08-03 | 8 | 2 | ORD-04, IMG-05 | T-09-24, T-09-25, T-09-SC | The showcase and the accessibility check describe the photo list staff will actually use. | web unit | `npm --prefix web run test -- --run src/dev (+2 more)` | yes | green |
| 09-09-01 | 9 | 3 | ORD-04, IMG-01, IMG-02 | T-09-36, T-09-79, T-09-SC | The browser has one server source for every photo rule. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImageRulesEndpointTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*OpenApiSnapshotTests" (+1 more)` | yes | green |
| 09-09-02 | 9 | 3 | ORD-04, IMG-01, IMG-02 | T-09-36, T-09-79, T-09-SC | Tests and Playwright can show and fail photos without any call to Cloudinary. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*TestingImagesEndpointTests" --filter-class "*AuthorizationMatrixTests"` | yes | green |
| 09-09-03 | 9 | 3 | ORD-04, IMG-01, IMG-02 | T-09-36, T-09-79, T-09-SC | Any client, including the future Android app, can upload photos from the docs alone, and the lock rule is pinned in the contract. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OpenApiOrderWriteContractTests" (+1 more)` | yes | green |
| 09-10-01 | 10 | 3 | IMG-02 | T-09-13, T-09-14, T-09-15, T-09-SC | PNG mockups upload with their real size. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageSnifferTests" (+1 more)` | yes | green |
| 09-10-02 | 10 | 3 | IMG-02 | T-09-13, T-09-14, T-09-15, T-09-SC | Every phone and computer photo type staff use is recognized with its upright size. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageSnifferTests" --filter-class "*ImageInspectionTests" (+1 more)` | yes | green |
| 09-10-03 | 10 | 3 | IMG-02 | T-09-13, T-09-14, T-09-15, T-09-SC | No crafted file can crash or stall the upload check. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageSnifferTests" (+1 more)` | yes | green |
| 09-11-01 | 11 | 3 | JOB-01 | T-09-17, T-09-19, T-09-SC | Runs never overlap, and a lease left by a crashed run expires on its own. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*MaintenanceRunLockTests" (+1 more)` | yes | green |
| 09-11-02 | 11 | 3 | JOB-01 | T-09-17, T-09-19, T-09-SC | A failing job shows as a red line while the rest still run, and big purges finish over several calls. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*RunMaintenanceHandlerTests" (+3 more)` | yes | green |
| 09-12-01 | 12 | 3 | JOB-01 | T-09-76, T-09-77, T-09-SC | Guessing the key from one address is throttled. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MaintenanceKeySafetyTests" --filter-class "*RateLimitTests"` | yes | green |
| 09-12-02 | 12 | 3 | JOB-01 | T-09-76, T-09-77, T-09-SC | Only an exact, long-enough key matches, and the key is never written down by the server. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*MaintenanceKeyTests" --filter-class "*MaintenanceKeySafetyTests" --filter-class "*SensitiveDataMaskingTests"` | yes | green |
| 09-12-03 | 12 | 3 | JOB-01 | T-09-76, T-09-77, T-09-SC | The owner can make, place and rotate the key and read a run's answer. | docs check | `grep -c "Maintenance__Key" docs/operations/maintenance.md (+1 more)` | yes | green |
| 09-13-01 | 13 | 4 | ORD-04, IMG-04 | T-09-23, T-09-78, T-09-SC | The list shows each order's cover and count. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ListOrdersEndpointTests" --filter-class "*OpenApiSnapshotTests" (+3 more)` | yes | green |
| 09-13-02 | 13 | 4 | ORD-04, IMG-04 | T-09-23, T-09-78, T-09-SC | The list shows covers without extra queries or slower pages. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderListQueryCountTests" (+3 more)` | yes | green |
| 09-14-01 | 14 | 4 | IMG-02, IMG-01, ORD-04 | T-09-26, T-09-27, T-09-28, T-09-29, ... | A full-size phone photo reaches the server while every other route keeps its 1 MiB limit. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImageUploadLimitsTests" --filter-class "*RequestBodyLimitTests" --filter-class "*WebConfigTests"` | yes | green |
| 09-14-02 | 14 | 4 | IMG-02, IMG-01, ORD-04 | T-09-26, T-09-27, T-09-28, T-09-29, ... | A retried upload is never stored twice and never refused for a new boundary. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*IdempotencyMultipartTests" --filter-class "*IdempotencyTests" (+1 more)` | yes | green |
| 09-14-03 | 14 | 4 | IMG-02, IMG-01, ORD-04 | T-09-26, T-09-27, T-09-28, T-09-29, ... | Many or repeated uploads cannot exhaust the small app pool. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ImageUploadRateLimitTests" --filter-class "*RateLimitTests" --filter-class "*RateLimitPartitionTests" (+1 more)` | yes | green |
| 09-15-01 | 15 | 4 | IMG-03, IMG-02 | T-09-31, T-09-32, T-09-33, T-09-SC | The most common upload, a phone JPEG, reaches storage without location or camera data. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageMetadataStripperTests" (+1 more)` | yes | green |
| 09-15-02 | 15 | 4 | IMG-03, IMG-02 | T-09-31, T-09-32, T-09-33, T-09-SC | Mockups and WebP photos are stored clean. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageMetadataStripperTests" (+1 more)` | yes | green |
| 09-15-03 | 15 | 4 | IMG-03, IMG-02 | T-09-31, T-09-32, T-09-33, T-09-SC | Every allowed photo type is cleaned before storage, or refused when it cannot be cleaned. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageMetadataStripperTests" --filter-class "*ImageSnifferTests" (+2 more)` | yes | green |
| 09-16-01 | 16 | 4 | ORD-04, IMG-05, IMG-01, IMG-02 | T-09-34, T-09-35, T-09-37, T-09-SC | Staff add a photo on the order page and see it saved with a thumb from the server. | web unit | `npm --prefix web run test -- --run src/modules/admin/services/orderPhotosService.test.ts src/modules/admin/hooks/usePhotoUploadQueue.test.tsx src/modules/admin/components/OrderPhotosCard.test.tsx src/modules/admin/pages/OrderPage.test.tsx (+1 more)` | yes | green |
| 09-16-02 | 16 | 4 | ORD-04, IMG-05, IMG-01, IMG-02 | T-09-34, T-09-35, T-09-37, T-09-SC | A batch of photos uploads with clear progress, and anything the server would refuse is stopped in the browser. | web unit | `npm --prefix web run test -- --run src/modules/admin/hooks/usePhotoUploadQueue.test.tsx src/modules/admin/orderPhotosSchemas.test.ts src/modules/admin/components/OrderPhotosCard.test.tsx (+1 more)` | yes | green |
| 09-16-03 | 16 | 4 | ORD-04, IMG-05, IMG-01, IMG-02 | T-09-34, T-09-35, T-09-37, T-09-SC | Failed photos never vanish silently, never upload twice, and staff are warned before they would lose them. | web unit | `npm --prefix web run test -- --run src/modules/admin/hooks/usePhotoUploadQueue.test.tsx src/modules/admin/components/OrderPhotosCard.test.tsx src/modules/admin/pages/OrderPage.test.tsx (+2 more)` | yes | green |
| 09-17-01 | 17 | 4 | JOB-01 | T-09-39, T-09-40, T-09-41, T-09-SC | Dead sessions no longer pile up between runs. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*PurgeExpiredRecordsJobTests"` | yes | green |
| 09-17-02 | 17 | 4 | JOB-01 | T-09-39, T-09-40, T-09-41, T-09-SC | Every expired kind of record is removed safely once a month. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*PurgeExpiredRecordsJobTests" (+1 more)` | yes | green |
| 09-18-01 | 18 | 5 | ORD-04, IMG-04 | T-09-SC | Staff recognize orders by their cover photo on the list. | web unit | `npm --prefix web run test -- --run src/components/data/data.test.tsx src/modules/admin/components/OrdersTable.test.tsx src/modules/admin/components/showcase (+1 more)` | yes | green |
| 09-18-02 | 18 | 5 | ORD-04, IMG-04 | T-09-SC | The list and viewer never download more pixels than they can show. | web unit | `npm --prefix web run test -- --run src/modules/admin/imageSlots.test.ts (+1 more)` | yes | green |
| 09-19-01 | 19 | 5 | IMG-01, IMG-03 | T-09-42, T-09-43, T-09-44, T-09-45, ... | With the owner's keys present, photos go to Cloudinary as private, signed assets that can never overwrite another. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinaryImageStorageTests" --filter-class "*ImagesRegistrationTests" (+1 more)` | yes | green |
| 09-19-02 | 19 | 5 | IMG-01, IMG-03 | T-09-42, T-09-43, T-09-44, T-09-45, ... | The jobs can remove, list and measure photos through one tested adapter. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinaryImageStorageTests"` | yes | green |
| 09-19-03 | 19 | 5 | IMG-01, IMG-03 | T-09-42, T-09-43, T-09-44, T-09-45, ... | The Cloudinary secret stays on the server, and the owner has a plain guide to setting it. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ImageSecretExposureTests" --filter-class "*SensitiveDataMaskingTests" (+2 more)` | yes | green |
| 09-20-01 | 20 | 5 | ORD-04 | T-09-47, T-09-48, T-09-49, T-09-SC | Staff (or any API client) can choose the cover by moving a photo to the front. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImageArrangeEndpointTests" --filter-class "*AuthorizationMatrixTests" (+1 more)` | yes | green |
| 09-20-02 | 20 | 5 | ORD-04 | T-09-47, T-09-48, T-09-49, T-09-SC | Reordering is exact, safe under races, and refused on closed orders. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderImageTests" (+2 more)` | yes | green |
| 09-20-03 | 20 | 5 | ORD-04 | T-09-47, T-09-48, T-09-49, T-09-SC | Photos carry an optional description whose default always matches their place. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImageArrangeEndpointTests" --filter-class "*AuthorizationMatrixTests" --filter-class "*OpenApiSnapshotTests" --filter-class "*OpenApiOrderWriteContractTests" (+2 more)` | yes | green |
| 09-21-01 | 21 | 5 | ORD-04, IMG-05 | T-09-50, T-09-51, T-09-SC | New orders can be created with their photos in one go. | web unit | `npm --prefix web run test -- --run src/modules/admin/components/OrderPhotoPicker.test.tsx src/modules/admin/pages/OrderFormPage.test.tsx (+1 more)` | yes | green |
| 09-21-02 | 21 | 5 | ORD-04, IMG-05 | T-09-50, T-09-51, T-09-SC | Staff can put the drafts in the right order and choose the cover before saving. | web unit | `npm --prefix web run test -- --run src/modules/admin/components/OrderPhotoPicker.test.tsx src/modules/admin/pages/OrderFormPage.test.tsx` | yes | green |
| 09-21-03 | 21 | 5 | ORD-04, IMG-05 | T-09-50, T-09-51, T-09-SC | Draft photos can carry a description that uploads with them. | web unit | `npm --prefix web run test -- --run src/modules/admin/components/PhotoDescriptionModal.test.tsx src/modules/admin/components/OrderPhotoPicker.test.tsx (+2 more)` | yes | green |
| 09-22-01 | 22 | 5 | JOB-01, JOB-02 | T-09-54, T-09-55, T-09-56, T-09-57, ... | The owner can press Run now and read plain counts in the run summary. | web unit | `npm --prefix web run test -- --run scripts/maintenance.test.ts` | yes | green |
| 09-22-02 | 22 | 5 | JOB-01, JOB-02 | T-09-54, T-09-55, T-09-56, T-09-57, ... | A run never hangs, never leaks, and tells the owner plainly when something went wrong. | web unit | `npm --prefix web run test -- --run scripts/maintenance.test.ts` | yes | green |
| 09-22-03 | 22 | 5 | JOB-01, JOB-02 | T-09-54, T-09-55, T-09-56, T-09-57, ... | The scheduled run is pinned by tests and cannot quietly gain more secrets or permissions. | architecture | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*CiWorkflowTests" --filter-class "*MaintenanceWorkflowTests"` | yes | green |
| 09-23-01 | 23 | 6 | ORD-04, IMG-04 | T-09-52, T-09-53, T-09-SC | Staff can look at every photo large and land back where they were. | web unit | `npm --prefix web run test -- --run src/modules/admin/components/OrderPhotosCard.test.tsx (+1 more)` | yes | green |
| 09-23-02 | 23 | 6 | ORD-04, IMG-04 | T-09-52, T-09-53, T-09-SC | Photos stay visible on closed and deleted orders and cannot be changed there. | web unit | `npm --prefix web run test -- --run src/modules/admin/components/OrderPhotosCard.test.tsx src/modules/admin/pages/DeletedOrderPage.test.tsx (+1 more)` | yes | green |
| 09-24-01 | 24 | 6 | JOB-02, IMG-01 | T-09-59, T-09-60, T-09-62, T-09-SC | Only a permanent delete schedules an order's photo files for removal, and only if the delete itself is saved. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImageDeletionQueueTests" --filter-class "*OrderDeletionTests" (+1 more)` | yes | green |
| 09-24-02 | 24 | 6 | JOB-02, IMG-01 | T-09-59, T-09-60, T-09-62, T-09-SC | No uploaded file is left behind without a record, even when its save fails. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*ImageDeletionQueueTests" --filter-class "*ImageDeletionsMigrationTests" --filter-class "*TriggerInventoryTests" --filter-class "*MigrationScriptTests" (+2 more)` | yes | green |
| 09-25-01 | 25 | 6 | IMG-04, JOB-01, JOB-02 | T-09-65, T-09-66, T-09-67, T-09-SC | The owner can create the allowed sizes with one safe, repeatable command. | integration | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*CloudinarySetupCommandTests" (+1 more)` | yes | green |
| 09-25-02 | 25 | 6 | IMG-04, JOB-01, JOB-02 | T-09-65, T-09-66, T-09-67, T-09-SC | The owner learns from a red run, not from a broken upload, when the free plan is nearly full. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*CloudinaryUsageJobTests" (+1 more)` | yes | green |
| 09-25-03 | 25 | 6 | IMG-04, JOB-01, JOB-02 | T-09-65, T-09-66, T-09-67, T-09-SC | The owner has an exact, safe order for the one-time Cloudinary setup. | docs check | `grep -n -e "--check" -e "strict" docs/operations/cloudinary-setup.md` | yes | green |
| 09-26-01 | 26 | 7 | ORD-04, JOB-02 | T-09-61, T-09-80, T-09-SC | Deleting a photo removes it from the order at once and reliably schedules its file for removal. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*OrderImageDeletionQueueTests" --filter-class "*AuthorizationMatrixTests" (+1 more)` | yes | green |
| 09-26-02 | 26 | 7 | ORD-04, JOB-02 | T-09-61, T-09-80, T-09-SC | Photo positions can never break, and any client can delete a photo from the docs alone. | unit | `dotnet test --project tests/Csps.Domain.UnitTests --filter-class "*OrderImageTests" (+3 more)` | yes | green |
| 09-27-01 | 27 | 7 | ORD-04 | T-09-63, T-09-64, T-09-SC | Staff can reorder photos from the keyboard and hear the result. | web unit | `npm --prefix web run test -- --run src/modules/admin/services/orderPhotosService.test.ts src/modules/admin/components/OrderPhotosCard.test.tsx (+1 more)` | yes | green |
| 09-27-02 | 27 | 7 | ORD-04 | T-09-63, T-09-64, T-09-SC | Choosing the cover and rearranging are safe even when someone else changes the order at the same time. | web unit | `npm --prefix web run test -- --run src/modules/admin/components/OrderPhotosCard.test.tsx (+1 more)` | yes | green |
| 09-27-03 | 27 | 7 | ORD-04 | T-09-63, T-09-64, T-09-SC | Staff can describe photos for screen readers and see every photo change in the Audit Log. | web unit | `npm --prefix web run test -- --run src/modules/admin/components/PhotoDescriptionModal.test.tsx src/modules/admin/components/OrderPhotosCard.test.tsx src/modules/admin/services/orderPhotosService.test.ts src/modules/admin/auditCopy.test.ts (+2 more)` | yes | green |
| 09-28-01 | 28 | 7 | JOB-02, JOB-01 | T-09-68, T-09-69, T-09-70, T-09-71, ... | Deleted photos really leave Cloudinary on the next run, cache included. | integration | `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*ImageCleanupRunTests" (+1 more)` | yes | green |
| 09-28-02 | 28 | 7 | JOB-02, JOB-01 | T-09-68, T-09-69, T-09-70, T-09-71, ... | A removal that keeps failing is never lost and always reaches the owner as a red run. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*ImageRemovalJobTests" (+1 more)` | yes | green |
| 09-28-03 | 28 | 7 | JOB-02, JOB-01 | T-09-68, T-09-69, T-09-70, T-09-71, ... | Storage is reconciled monthly without ever touching a photo that still belongs to an order. | unit | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*StraySweepJobTests" --filter-class "*ImageRemovalJobTests" (+2 more)` | yes | green |
| 09-29-01 | 29 | 8 | ORD-04, JOB-02 | T-09-72, T-09-73, T-09-SC | Staff can remove a wrong photo safely and keep working where they were. | web unit | `npm --prefix web run test -- --run src/modules/admin/services/orderPhotosService.test.ts src/modules/admin/components/OrderPhotosCard.test.tsx (+1 more)` | yes | green |
| 09-29-02 | 29 | 8 | ORD-04, JOB-02 | T-09-72, T-09-73, T-09-SC | A Manager sees exactly how many photos a permanent delete will remove. | web unit | `npm --prefix web run test -- --run src/modules/admin/components/PurgeOrderDialog.test.tsx (+1 more)` | yes | green |
| 09-30-01 | 30 | 9 | ORD-04, IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, JOB-01, JOB-02 | T-09-74, T-09-75, T-09-SC | The phone path and every screen are proven accessible and CSP-clean end to end. | e2e | `npm --prefix web run e2e -- --grep @order-photos-a11y` | yes | green |
| 09-30-02 | 30 | 9 | ORD-04, IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, JOB-01, JOB-02 | T-09-74, T-09-75, T-09-SC | Every automated gate is green and the owner has the review pack. | web unit | `npm --prefix web run test -- --run src/modules/admin/components/showcase scripts/owner-review.test.ts (+4 more)` | yes | green |
| 09-30-03 | 30 | 9 | ORD-04, IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, JOB-01, JOB-02 | T-09-74, T-09-75, T-09-SC |  | manual (owner checkpoint) | `owner checkpoint (see Manual-Only Verifications)` | yes | pending |
| 09-31-01 | 31 | 1 | CUT-01, JOB-01 | T-09-81, T-09-82 | One parameterised BACKUP statement in one allowed file; the probe answers facts only (D-40, D-42) | integration, unit, architecture | `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*SqlServerBackupStatementTests"`; `dotnet test --project tests/Csps.HostProbe.Tests --filter-class "*BackupCheckTests"`; `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*NoInlineSqlTests"` | no, the task creates them (NoInlineSqlTests exists) | pending |
| 09-31-02 | 31 | 1 | CUT-01 | T-09-83, T-09-84 | Owner adds db_backupoperator and runs the probe from the PC; a blocked host stops the work (D-42, D-44, D-45) | manual (owner checkpoint) | `dotnet build tools/Csps.HostProbe --configuration Release` | yes | pending |
| 09-31-03 | 31 | 1 | CUT-01 | T-09-83 | Probe facts recorded without paths or names; the cutover runbook lists the three roles, or Task 1 is reverted (D-44) | architecture | `dotnet test --project tests/Csps.ArchitectureTests --filter-class "*HostingRecordTests" --filter-class "*CutoverRunbookTests" --filter-class "*NoInlineSqlTests"` | yes | pending |
| 09-32-01 | 32 | 8 | JOB-01, CUT-01 | T-09-86, T-09-87 | Backup first in the run (Order 5); counts-only lines; red when not set up; off on Development and test hosts (D-39, D-47) | unit, integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*DatabaseBackupJobTests"`; `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DatabaseBackupStoreTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DatabaseBackupRunTests"` | no, the task creates them | pending |
| 09-32-02 | 32 | 8 | JOB-01, CUT-01 | T-09-85, T-09-88, T-09-89, T-09-91 | 20-day gap; one try a day through the `database-backup-attempt` claim (one write call per run, failure stays red); no line on repeat calls after a fresh backup; keep own newest 3; never touch foreign files; red on any failure while other jobs run (D-41, D-43, D-46, D-47) | unit, integration | `dotnet test --project tests/Csps.Application.UnitTests --filter-class "*DatabaseBackupJobTests"`; `dotnet test --project tests/Csps.Infrastructure.IntegrationTests --filter-class "*DatabaseBackupStoreTests" --filter-class "*BackupAttemptLockTests"`; `dotnet test --project tests/Csps.Server.IntegrationTests --filter-class "*DatabaseBackupRunTests"` | created in 09-32-01, except BackupAttemptLockTests (this task) | pending |
| 09-32-03 | 32 | 8 | CUT-01 | T-09-87 | Runbook backup and restore sections, no path or name; UI-SPEC run-summary row | docs check | `grep -c "Maintenance__Backup__SqlServerFolder" docs/operations/maintenance.md` | yes | pending |

*Status: pending, green, red, flaky*

---

## Wave 0 Requirements

- [ ] Synthetic image fixtures built in test code, never real photos (public repo): JPEG with fake GPS at 0N 0E and Orientation 6, JPEG with XMP and trailing MPF bytes, PNG with `tEXt`/`eXIf`, WebP with `EXIF`/`XMP ` chunks, an ISOBMFF HEIC shell with an `Exif` item and `ispe`, an AVIF shell, an SVG renamed `.jpg`, truncated and looping files.
- [ ] `TestingImageStorage` and `TestingImageDelivery` (memory store, same-origin URLs) so tests and Playwright never call Cloudinary.
- [ ] A multipart request helper for integration tests (chosen boundary).
- [ ] A large JPEG generated in the browser by canvas at Playwright test time.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Camera capture on a real Android phone and iPhone | IMG-05 | Needs a device camera; `Permissions-Policy: camera=()` behavior with `capture` is assumed | Open an order on each phone, tap "Take Photo", take a photo, confirm it uploads and shows |
| Real HEIC upload | IMG-02, IMG-03 | Test fixtures are synthetic shells | Upload one real iPhone HEIC; confirm it shows and the delivered file has no GPS |
| Live "Run now" of the maintenance workflow | JOB-01, JOB-02 | Needs the host key and GitHub secret | Trigger `workflow_dispatch`, confirm a green run with a counts-only summary |
| Backup probe from the owner's PC (plan 09-31) | CUT-01 | Needs the site's connection string and the host's db folder, which only the owner holds (D-44, D-45) | Follow 09-31 Task 2: tick db_backupoperator, run `POST /probe/backup` on port 5116, check and delete the file in the file manager, paste the facts |
| First real backup after the deploy (plan 09-32) | JOB-01, CUT-01 | Needs the host's db folder settings and the live site; proves the web app's own folder access (D-45) | Set `Maintenance__Backup__SqlServerFolder` and `Maintenance__Backup__AppFolder`, press Run now, confirm "Database backups written: 1" and a green run |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (the owner checkpoints 09-30-03 and 09-31-02 are listed under Manual-Only Verifications)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
