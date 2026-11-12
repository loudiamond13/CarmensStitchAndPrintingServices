---
phase: 11-public-site-content-management
plan: 19
subsystem: api
tags: [aspnetcore, ef-core, product-line-photos, cloudinary, named-sizes, stray-sweep, image-inventory, og-image, audit, site-content-lock, openapi]
created: 2026-11-12T09:55:00-06:00
updated: 2026-11-12T09:55:00-06:00

requires:
  - phase: 11-17
    provides: product line routes, the delete rule, the site-content lock on line writes, ProductLineListRow and ProductLineDetailRow
  - phase: 11-15
    provides: ProductLinePhoto and its table, the public lines read and its cache
  - phase: 09
    provides: the upload pipeline (ImageInspection, ImageMetadataStripper, IImageStorage, the removal queue), the ImageUpload rate limit, the named sizes and the setup command
provides:
  - "POST and DELETE /api/v1/product-lines/{lineId}/photos/{slot} (slots main, back, fabric): Manager only, multipart, Phase 9 checks, random ids under {root}/content/lines/{lineId}/, rate limited, Idempotency-Key"
  - "PublicIds.ContentFolder and NewContent; ImageNamedSizes with 21 new named sizes (34 in All); IImageDelivery.ForLinePhoto (card, large, small candidates and a 44 px thumb) and ForShare (1200 x 630)"
  - "Photo addresses in the public lines read, the Manager's list (mainPhotoThumb) and the Manager's detail (photos); the first shown line's main photo as the Products og:image with twitter:card"
  - "StraySweepJob content pass with its own saved place; ImageInventory names line photos; the delete of a line takes the site-content lock"
  - "AuditActions.ProductLinePhotoChanged (product-line.photo-changed); AuditActions.All is 114; ImageDeletionReason.PhotoReplaced"
affects: [11-20, 11-21, 11-22, 11-26, 11-34, 11-37]

actuals:
  tokens: 31900
  tasks: 3
  commits: 7
plan_head_before: 66b6be125bd6666bfbaa8f86e54d4538c9e07e57
plan_head_after: 6f1157938d0e9b89c3a4301d14c5e8780a5dbf2d

tech-stack:
  added: []
  patterns:
    - "Content photos live under {root}/content/{area}/{ownerId}/ with 128-bit random ids; the sweep lists orders and content as two passes with their own cursors and one shared cap"
    - "A photo replace updates the row in place (the unique slot index stays satisfied) and hands back the old id, which the handler queues in the same transaction"
    - "Photo writes and the line delete take the same site-content lock, so a race ends as 422 or 404, never a database error"
    - "The Products page head gets its picture from the cached lines snapshot (ShareImageUrl), so one cache clear covers the lines, the page head and the picture"

key-files:
  created:
    - src/Csps.Application/Content/UploadProductLinePhotoRequest.cs
    - src/Csps.Application/Content/UploadProductLinePhotoHandler.cs
    - src/Csps.Application/Content/RemoveProductLinePhotoHandler.cs
    - src/Csps.Application/Content/ProductLinePhotoMapper.cs
    - src/Csps.Application/Content/ProductLinePhotoSlots.cs
    - src/Csps.Server/Controllers/ProductLinePhotosController.cs
    - tests/Csps.Server.IntegrationTests/Content/ProductLinePhotoEndpointTests.cs
    - tests/Csps.Application.UnitTests/Content/UploadProductLinePhotoHandlerTests.cs
    - tests/Csps.Application.UnitTests/Content/ProductLinePhotoHandlerTests.cs
    - tests/Csps.Domain.UnitTests/Content/ProductLinePhotoTests.cs
  modified:
    - src/Csps.Domain/Content/ProductLinePhoto.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Images/PublicIds.cs
    - src/Csps.Application/Images/ImageSource.cs
    - src/Csps.Application/Ports/IImageDelivery.cs
    - src/Csps.Application/Ports/IImageDeletionQueue.cs
    - src/Csps.Application/Ports/IProductLines.cs
    - src/Csps.Application/Content/ProductLineDtos.cs
    - src/Csps.Application/Content/PublicProductLinesDto.cs
    - src/Csps.Application/Content/ProductLineAuditDetail.cs
    - src/Csps.Application/Content/SiteContentErrors.cs
    - src/Csps.Application/Content/DeleteProductLineHandler.cs
    - src/Csps.Application/Maintenance/StraySweepJob.cs
    - src/Csps.Infrastructure/Images/ImageNamedSizes.cs
    - src/Csps.Infrastructure/Images/ImageCandidates.cs
    - src/Csps.Infrastructure/Images/CloudinaryImageDelivery.cs
    - src/Csps.Infrastructure/Images/TestingImageDelivery.cs
    - src/Csps.Infrastructure/Images/ImageInventory.cs
    - src/Csps.Infrastructure/Images/CloudinarySetupCommand.cs
    - src/Csps.Infrastructure/Content/PublicContentReader.cs
    - src/Csps.Infrastructure/Content/ProductLines.cs
    - src/Csps.Server/Endpoints/PublicHeadWriter.cs
    - src/Csps.Server/Endpoints/ShellPage.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/site-content.md
    - docs/operations/cloudinary-setup.md

key-decisions:
  - "No navigation was added to ProductLine: the photo rows are read and written through the IProductLines port (FindPhotoAsync, AddPhoto, RemovePhoto), and ProductLinePhoto.Replace puts a new file in an existing row. The Restrict key and the unique slot index would make removing from a collection, or delete-then-insert, fragile, and no model change means no migration"
  - "The public Main photo uses the product large candidates (400 to 1280, width limited) and Back and Fabric the 1:1 candidates; Home's 4:5 card candidates are in LinePhotoUrls.Card for plan 11-21. The Manager's screens use Card for main and Small for the others"
  - "The delete of a product line now takes the site-content lock (the plan note from 11-17 OI-4): without it, taking the lock in the photo writes cannot serialize against the delete"
  - "twitter:card is written on every public page with a canonical address: summary_large_image with a picture, summary without (UI-SPEC row). Only the Products page has a picture so far"
  - "A photo whose delivery gives no address (no cloud name set) is null in the public read, so the page draws the placeholder, never a broken picture"

patterns-established:
  - "Content folder rule: new random public ids for public content go through PublicIds.NewContent(root, area, ownerId); later plans use areas gallery and share"
  - "StraySweepJob passes: add a folder by calling SweepFolderAsync with its own cursor name"

requirements-completed: [CONT-02, PUB-04, PUB-02]

coverage:
  - id: D1
    description: "A Manager uploads a photo into the main, back or fabric slot of a line; it is stored under csps/content/lines/{lineId}/ with a random id (never orders), and the public product lines read shows its src, srcSet, width and height with a new ETag; an Admin gets 403"
    requirement: "CONT-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/ProductLinePhotoEndpointTests.cs#AManagerUploadsAMainPhotoUnderTheContentFolderAndThePublicDataShowsItWithANewETag, AnAdminGets403AndNothingIsStored; AuthorizationMatrixTests rows for POST and DELETE photos"
        status: pass
    human_judgment: false
  - id: D2
    description: "A replace keeps one row and queues the old file once in the same save; a removal answers 204, queues its file and the public read shows null; an empty slot, an unknown slot word and a missing line are 404; each change writes product-line.photo-changed with key, title, slot and change and never an address"
    requirement: "CONT-02"
    verification:
      - kind: integration
        ref: "ProductLinePhotoEndpointTests#ReplacingAPhotoKeepsOneRowQueuesTheOldFileOnceAndWritesTheAuditEntryWithoutTheAddress, RemovingTheMainPhotoAnswers204QueuesTheFileAuditsItAndThePublicReadShowsNull, RemovingFromAnEmptySlotAnUnknownSlotOrAMissingLineAnswers404AndWritesNothing"
        status: pass
      - kind: unit
        ref: "UploadProductLinePhotoHandlerTests, ProductLinePhotoHandlerTests, ProductLinePhotoTests, AuditActionsTests (count 114)"
        status: pass
    human_judgment: false
  - id: D3
    description: "An SVG, a file over 10 MB and an over-limit image are refused with the Phase 9 messages and nothing is stored; no session, storage not set up and a failed save after storing give the existing answers and queue the new file as UploadUndone"
    requirement: "CONT-02"
    verification:
      - kind: integration
        ref: "ProductLinePhotoEndpointTests#AnSvgNamedAsAJpegIsRefusedByItsBytesWithTheP9MessageAndNothingIsStored, AFileOneByteOverTenMegabytesIsRefusedWithTheP9MessageAndNothingIsStored, APhotoWithTooManyPixelsIsRefusedWithTheP9MessageAndNothingIsStored"
        status: pass
      - kind: unit
        ref: "UploadProductLinePhotoHandlerTests#NoUsableSessionGivesTheSessionErrorAndTouchesNothing, StorageThatIsNotSetUpGivesTheNotConfiguredError, ASaveThatThrowsAfterTheFileWasStoredQueuesTheNewFileAsUploadUndoneAndLetsTheErrorThrough"
        status: pass
    human_judgment: false
  - id: D4
    description: "A line with a photo cannot be deleted (422 product-lines.in-use); an upload racing the delete of the same line ends as 200 and 422 or as 404 and 204, never a 500, because both take the site-content lock"
    requirement: "CONT-02"
    verification:
      - kind: integration
        ref: "ProductLinePhotoEndpointTests#ALineWithAPhotoCannotBeDeletedAndAnUploadRacingTheDeleteNeverAnswers500 (6 rounds, 4 of 4 repeated runs green)"
        status: pass
      - kind: unit
        ref: "ProductLinePhotoHandlerTests#DeletingALineTakesTheSiteContentLockBeforeItLooksAtWhatIsFiledUnderIt"
        status: pass
    human_judgment: false
  - id: D5
    description: "The Products page head carries og:image at the csps_share_1200 address of the first shown line's main photo, og:image:width 1200, og:image:height 630, og:image:alt the business name and twitter:card summary_large_image; with no such photo the picture tags are left out and twitter:card is summary; an upload and a removal clear the cached head"
    requirement: "PUB-04"
    verification:
      - kind: integration
        ref: "ShellHeadTests#TheProductsPageUsesTheFirstActiveLinesMainPhotoAsItsLinkPreviewPicture, WithNoMainPhotoOnTheFirstActiveLineTheProductsPageHasNoPreviewPictureAndTheSmallCard, OnlyTheProductsPageCarriesALinkPreviewPictureAndEveryOtherPageHasTheSmallCard; ProductLinePhotoEndpointTests#AnUploadAndARemovalClearTheCachedProductsHeadSoTheLinkPreviewFollowsAtOnce"
        status: pass
    human_judgment: false
  - id: D6
    description: "The 21 new named sizes are listed once in ImageNamedSizes.All (34), the setup command creates only the missing ones and changes none of the 13 old; the real Cloudinary account is not touched"
    requirement: "PUB-02"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/ImageNamedSizesTests.cs; CloudinarySetupCommandTests#WithTheThirteenOldSizesPresentOnlyTheTwentyOneNewOnesAreCreatedAndNoOldOneIsChanged (class 18 of 18)"
        status: pass
    human_judgment: true
    rationale: "The owner runs the setup command against the live account after the Phase 11 deploy (go-live checklist). Only the stub run is proven here, by design (D-44)."
  - id: D7
    description: "The stray sweep lists the content folder after the orders folder with the trailing slash rule, keeps files a line photo names and queues old unnamed ones; the inventory names line photos; the orders pass is unchanged"
    requirement: "PUB-02"
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Maintenance/StraySweepJobTests.cs (35 of 35)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/ImageInventoryTests.cs#AProductLinePhotoIsKnownAndNamedByAPhotoAndTheOrderPhotosStillAre"
        status: pass
    human_judgment: false
  - id: D8
    description: "MUST NOT store a content photo under the orders folder or reuse a public id, and MUST NOT write a photo address into the audit log or the logs"
    requirement: "CONT-02"
    verification:
      - kind: integration
        ref: "ProductLinePhotoEndpointTests (id shape regex, ShouldNotContain on the audit detail)"
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition as a judgment item (privacy, unverified). The tests prove the stored id shape, the folder, and that the audit detail holds no id; that no log line ever holds an address is a reviewer call, because the handlers write no log line of their own."
  - id: D9
    description: "Domain coverage 100 percent line and branch, Application above its floor, full Server and Infrastructure runs green"
    verification:
      - kind: other
        ref: "powershell tools/scripts/Invoke-CoverageGate.ps1; full Server run 2573 of 2573; full Infrastructure run 1142 of 1143 (1 skipped)"
        status: pass
    human_judgment: false

duration: 56 min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 19: Line photos on the server Summary

**A Manager puts a real photo into the main, back or fabric slot of a product line (checked, stripped, stored under a random id in `content/lines/`), visitors and the Manager's screens get delivery-built addresses, the Products link preview uses the main photo at 1200 x 630, and the 21 new Cloudinary sizes, the stray sweep and the inventory are ready for the content folder.**

## Performance

- **Duration:** 56 min
- **Started:** 2026-11-12T08:55:54-06:00
- **Completed:** 2026-11-12T09:52:00-06:00 (approximate)
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 53 (10 created, 43 modified; the contract files included). The token figure (chars/4 of the added lines in `src`, `tests` and `docs`) is about 31,900, far under the plan's estimate of 140,000.

## Accomplishments

- **Routes.** `POST` and `DELETE /api/v1/product-lines/{lineId}/photos/{slot}` (slot `main`, `back` or `fabric`, any other word 404). Manager only, class policy. The upload copies the order upload's step order (session, storage set up, file sent, then the line exists, then the Phase 9 checks and the metadata strip, then storage, then one transaction under the site-content lock) and its attributes (`ImageUpload` rate limit, the request size limit, the form limits, in-memory buffer). The matrix and the rate limit list have rows for both routes.
- **Content folder.** `PublicIds.NewContent(root, "lines", lineId)` gives `{root}/content/lines/{lineId}/{26 base32 characters}` (128 random bits). Never under `orders/`.
- **Replace and remove.** A replace updates the row in place and queues the old file (`ImageDeletionReason.PhotoReplaced`, new, value 5) in the same transaction; a removal deletes the row and queues its file (`PhotoDeleted`). Each writes `product-line.photo-changed`: `key=basketball;title=Basketball Jerseys;slot=back;change=added|replaced|removed`. A failed save after the file reached storage queues it as `UploadUndone` on its own context, like the order upload.
- **Named sizes (D-44).** 21 new names, all in `ImageNamedSizes.All` (34 now) and so created by the existing setup command, which creates only missing ones:
  - category cards 4:5: `csps_cat_320`, `csps_cat_480`, `csps_cat_640`, `csps_cat_800`, `csps_cat_960`
  - strip tiles 4:5: `csps_strip_240`, `csps_strip_480`, `csps_strip_720`, `csps_strip_1060`
  - width limited: `csps_w_280`, `csps_w_400`, `csps_w_560`, `csps_w_640`, `csps_w_800`, `csps_w_1280`
  - product small 1:1: `csps_sq_200`, `csps_sq_400`, `csps_sq_720`
  - link preview: `csps_share_1200` (1200 x 630, JPEG), `csps_share_320`, `csps_share_640` (1.91:1, WebP)
- **Delivery.** `IImageDelivery.ForLinePhoto` returns the card, large and small candidate lists and the 44 px thumb (no candidate is wider than the photo); `ForShare` returns the one 1200 x 630 address. The Testing delivery uses the same sizes on `/api/testing/images/...`.
- **Reads.** The public lines read fills `photos.main` (large candidates), `photos.back` and `photos.fabric` (small candidates) for shown lines, and feeds the lines' last-change time. The Manager's list fills `mainPhotoThumb`; the Manager's detail has a new `photos` object for plan 11-22.
- **Link preview.** The Products head carries `og:image`, `og:image:width` 1200, `og:image:height` 630, `og:image:alt` (the business name) and `twitter:card`; without a main photo on the first shown line the picture tags are left out. An upload and a removal clear the cached head.
- **Sweep and inventory (P-9).** `StraySweepJob` lists `{root}/orders/` then `{root}/content/` (trailing slash rule, own saved place `stray-sweep-content`, one cap of 50 and one budget). `ImageInventory` names line photos in the same command as order photos, so content files are kept and stray ones are queued.
- **Race (11-17 OI-4, the MUST).** Photo writes and the delete of a line take the same site-content lock. The race test ran 6 rounds per run and never answered 500.
- **Docs.** `docs/api/site-content.md` has a Product line photos section; `docs/operations/cloudinary-setup.md` has the owner's one-time Phase 11 sizes step (run the setup command once after the Phase 11 deploy, expect `13 exist, 21 missing` then `34 exist`).

## Task Commits

| Task | Phase | Commit | Message |
|---|---|---|---|
| 1 (tracer) | RED | `a36bb9ae` | test(11-19): add failing tests for a Manager's main line photo, the content folder and the Products link preview |
| 1 (tracer) | GREEN | `019f835d` | feat(11-19): a Manager adds a main photo to a product line and the Products link preview uses it |
| 2 | RED | `8492bd2c` | test(11-19): add failing tests for replacing and removing line photos, refused files, the audit entry and the delete race |
| 2 | GREEN | `e020edf7` | feat(11-19): replacing and removing a line photo queues the old file, every change is audited, and a delete cannot race an upload |
| 3 | RED | `6361aa34` | test(11-19): add failing tests for the content folder sweep, the inventory and the 34 named sizes |
| 3 | GREEN | `872e5094` | feat(11-19): the 21 new sizes join the setup command, and the stray sweep and inventory know the content folder |
| extra | test | `6f115793` | test(11-19): prove an upload and a removal clear the cached Products head |

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute`, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) is not required, and xunit v3 on Microsoft.Testing.Platform prints none of the formats it reads. The RED evidence is the real console output, read by hand. A RED commit precedes each GREEN commit.

- **Task 1 RED** (`a36bb9ae`): `ProductLinePhotoEndpointTests` and `ShellHeadTests` 5 of 43 failed on the planned assertions (404 where the route should answer; `og:image` and `twitter:card` null); the matrix run failed 7 of 495 (both new rows for the three callers, the parallel run and the discovery check). Semantic assessment: the target tests ran and failed because the routes and the head tags did not exist. The compile stubs were none: the tests are HTTP and DB level.
- **Task 1 GREEN** (`019f835d`): the same classes plus matrix, coverage and OpenAPI snapshot tests 549 of 549; `npm --prefix tools/openapi-gen run check` clean. The tracer's `<verify>` holds only `<automated>` commands, so they were re-run on the finished tree before expansion and passed: tracer verified end to end, expanding.
- **Task 2 RED** (`8492bd2c`): 3 of 9 endpoint tests failed (the replace queue, the removal's `Sequence contains no elements` for the missing audit and queue rows, and the race answering `(OK, InternalServerError)`); 1 of 7 unit tests (the replace queue); 2 of 100 Domain tests (the count 114 and the new code). Compile stubs: the `ImageDeletionReason.PhotoReplaced` member and the `AuditActions.ProductLinePhotoChanged` constant (not yet in `All`).
- **Task 2 GREEN** (`e020edf7`): 9 of 9 endpoint tests (3 more repeated runs, 3 of 3 green); unit 72 of 72 in the three handler classes; Domain 103 of 103.
- **Task 3 RED** (`6361aa34`): 7 of 35 StraySweepJob tests failed, 9 of 37 in the Infrastructure classes (the setup command at 34 sizes, `All`, the line photo in the inventory).
- **Task 3 GREEN** (`872e5094`): StraySweepJob 35 of 35; the three Infrastructure classes 37 of 37.
- **Weak spots, stated plainly:** many Task 2 tests (the refusals, the 404s) passed at the Task 2 RED because the tracer's handler already ran the Phase 9 steps. The handler unit tests (`UploadProductLinePhotoHandlerTests` extras, `ProductLinePhotoHandlerTests`) and `ProductLinePhotoTests` were written after the GREEN code to keep Domain at 100% and Application above its floor; the delete-lock unit tests were written with the change. The `ImageNamedSizes` collections themselves came in the tracer (the head needs the share size); `All` stayed at 13 until Task 3 so the setup command tests stayed green and went red only in the Task 3 RED.

## Verification evidence (real output)

All runs on LocalDB (`CSPS_TEST_SQL=localdb`) in this worktree.

- **Task 1 verify:** `ProductLinePhotoEndpointTests`, `ShellHeadTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests`, `OpenApiSnapshotTests`: `total: 549, failed: 0, succeeded: 549`. `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The snapshot change is additive only (`529 insertions(+)`, no deletion in the two contract files).
- **Task 2 verify:** `ProductLinePhotoEndpointTests` `total: 10, failed: 0` (9 at the time, 10 with the cache test); `UploadProductLinePhotoHandlerTests`, `ProductLinePhotoHandlerTests`, `ProductLineHandlerTests` `total: 72, failed: 0`; Domain `AuditActionsTests` and `ProductLinePhotoTests` `total: 103, failed: 0`.
- **Task 3 verify:** `StraySweepJobTests` `total: 35, failed: 0`; `ImageNamedSizesTests`, `CloudinarySetupCommandTests`, `ImageInventoryTests` `total: 37, failed: 0`; `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- **The setup-command test (quoted for the plan):** `CloudinarySetupCommandTests#WithTheThirteenOldSizesPresentOnlyTheTwentyOneNewOnesAreCreatedAndNoOldOneIsChanged`: `total: 1, failed: 0`; the class `total: 18, failed: 0`. It answers the list with the 13 old names, replies to 21 creates and 21 allow calls, and asserts exit 0, the line `13 exist, 21 created`, that the POST names are exactly the 21 new ones in order, that no non-GET request carries an old name, and that nothing is deleted.
- **Coverage gate** (`tools/scripts/Invoke-CoverageGate.ps1`): "Csps.Domain line 100% (3811/3811) branch 100% (1639/1639) PASS", "Csps.Application line 98% (10402/10612) PASS", "Coverage gate passed." (2833 unit tests passed.)
- **Full Server integration run on the final tree:** `total: 2573, failed: 0, succeeded: 2573`. **Full Infrastructure integration run:** `total: 1143, failed: 0, succeeded: 1142, skipped: 1` (the live HIBP test that was already skipped). Architecture tests `total: 290, failed: 0`. Domain `total: 1735, failed: 0`.
- **Acceptance greps:** `csps_share_1200` in `ImageNamedSizes.cs`: 1. `/content/` in `PublicIds.cs`: 1. `UploadProductLinePhoto` in the snapshot: 1. `ShouldBe(114)` in `AuditActionsTests.cs`: 1. `product-line.photo-changed` in `AuditActions.cs`: 1. `/content/` in `StraySweepJob.cs`: 2. `Phase 11` in `cloudinary-setup.md`: 4.
- gitleaks `protect --staged` ran before every commit (and the repository hook ran it again): no leaks. The staged diffs hold only fake values (`csps-test` ids, the seeded shop names, `images.example.test`) and no local path, real email, cloud name, host or customer data.

## Decisions Made

See `key-decisions` above. In short: no navigation on `ProductLine`, so no model change and no migration; the main photo is the large candidates on the public page; the delete of a line takes the lock; `twitter:card` on every public page; a photo with no delivery address is `null`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The delete of a line did not take the site-content lock**
- **Found during:** Task 2 (the plan note from 11-17 OI-4, repeated in the brief as a MUST)
- **Issue:** Taking the lock in the photo writes cannot serialize against `DeleteProductLineHandler`, which did not take it. The race test answered `(OK, InternalServerError)` before the change.
- **Fix:** `DeleteProductLineHandler` takes the lock first in its transaction and answers busy when it cannot. Its constructor gained `ISiteContentLock`; the unit test harness was updated.
- **Files modified:** `src/Csps.Application/Content/DeleteProductLineHandler.cs`, `tests/Csps.Application.UnitTests/Content/ProductLineHandlerTests.cs` (constructor), `ProductLinePhotoHandlerTests.cs`
- **Committed in:** `8492bd2c` (RED), `e020edf7`

**2. [Rule 1 - Existing tests that pinned the old behavior]**
- **Found during:** Task 1 to 3 runs
- **Issue:** `AuditActionsTests` pinned the exact order and count of the catalog; `ProductLineHandlerTests` built the handlers with their old constructors; `ImageNamedSizesTests` and `CloudinarySetupCommandTests` pinned 13 sizes; the six `StraySweepJobTests` listing assertions counted every listing.
- **Fix:** Updated each to the new truth (114 and the code last; the new constructors; 34 sizes and `31 exist, 3 missing` and so on; the orders pass listings filtered by prefix). `FakeImageStorage` can script a page per folder.
- **Committed in:** the RED and GREEN commits of the task that caused each

**3. [Rule 1 - Plan wording not followed] `ProductLine.SetPhoto(slot, photo)` and `RemovePhoto(slot)`**
- **Issue:** The plan's artifact list puts both on the domain entity. `ProductLine` has no photo collection, and a Restrict key plus the unique slot index make removing from a collection or delete-then-insert fragile.
- **Fix:** The photo rows go through the port (`FindPhotoAsync`, `AddPhoto`, `RemovePhoto`), and `ProductLinePhoto.Replace(LinePhotoFile)` returns the old id. Same outcome, no model change.
- **Committed in:** `019f835d`

### Plan wording kept as written, with a note

- **Two names share a definition.** `csps_cat_480` and `csps_strip_480` are both `c_fill,g_auto,w_480,h_600/q_auto/f_webp`. Both names are created (a named size is a name, and the plan lists both); the plan's "listed exactly once" is read as once each, so the test asserts unique names, not unique definitions.
- **Added to the Manager's detail:** `photos` (the plan's artifact list does not name it, plan 11-22 reads "the detail DTO's photo fields"). Additive to the contract.

---

**Total deviations:** 3 (1 missing critical, 1 existing tests, 1 plan wording). **Impact:** none on the product behaviour beyond the lock on delete; one small constructor change and updated tests outside the plan's listed files.

## Owner items (open, nothing blocks the plan; recommendation first)

**OI-1. New words.** Two admin-facing texts are new: a 404 for an empty slot, an unknown slot word or a missing photo says "This product line has no photo there." (code `product-lines.photo-not-found`). The Manager screens (11-22) show their own words for removing, so this text is rarely seen. Recommendation: keep. Alternative: your own words (one constant, `SiteContentErrors.PhotoNotFoundMessage`).

**OI-2. `twitter:card` on every public page.** The UI-SPEC head table says `summary_large_image` with a picture and `summary` without. I wrote it on every public page with a canonical address (404 and admin pages have none). Before this plan no page had a `twitter:card`. Recommendation: keep, it is the UI-SPEC row. Alternative: only on Products until the other pictures exist (11-26 and 11-34 add them).

**OI-3. The Manager's list thumb is one 44 px address.** `mainPhotoThumb` stays a string (the contract from 11-17), so a high-density screen gets a soft 44 px picture. Recommendation: keep for now; if 11-20 wants a sharp 2x, change it to a source with `srcSet` (one DTO and one mapper line, a contract refresh).

**OI-4. The owner's live step.** The setup command must run against the live Cloudinary account after the Phase 11 deploy, before the first public photo is added (`docs/operations/cloudinary-setup.md`, "Phase 11 sizes"). Without the 21 sizes a public photo does not load under strict mode. This plan did not run it (D-44).

**OI-5. Gallery plan reminder (11-26).** Gallery writes must take the site-content lock too, and fill `GalleryItemCount` in `ProductLines.ListAsync` and `GetUsageAsync` (still 0).

## Issues Encountered

- The Bash tool in this worktree refuses commands it judges too complex (a heredoc beside git or a long here-document of C# text), so several multi-line edits ran through short Python scripts written with the Write tool into the session scratchpad, and the rest through Edit.
- Full runs take several minutes (`dotnet format` over three minutes, the full Server run about ten); they ran in the background and the result was read from the output file. No flake appeared: the known `OpeningHoursEndpointTests` order flake and the `SessionStoreTests` load flake did not trigger in the full runs.

## Known Stubs

| File | What | Why it is intentional | Resolved by |
|---|---|---|---|
| `src/Csps.Infrastructure/Content/ProductLines.cs` (`ListAsync`, `GetUsageAsync`) | The gallery item count is 0 | The gallery does not exist yet | 11-26 |
| `src/Csps.Infrastructure/Content/PublicContentReader.cs` | `HasGalleryItems` is false | The gallery does not exist yet | 11-26 |

The 11-17 stub "`mainPhotoThumb` is always null" is resolved by this plan. `.planning/WINDOWS.md` was not touched: parallel executors share it, and the orchestrator merges the ledger after the wave.

## Authentication Gates

None.

## Threat Flags

None beyond the plan's threat model. T-11-46 (Phase 9 `ImageInspection`, the metadata strip, request size limits, refusal tests), T-11-47 (the existing `ImageUpload` rate limit and body limits on the new route; the rate limit test list has the route), T-11-48 (random 128-bit ids under `content/`, never logged or audited; public only for shown lines) and T-11-49 (the inventory names content photos, the trailing slash folder rule, the sweep tests) and T-11-SC (no package added or bumped) are covered. No new endpoint is anonymous.

## User Setup Required

One owner step after the Phase 11 deploy: run the existing setup command once so the 21 new named sizes exist in the live Cloudinary account. See `docs/operations/cloudinary-setup.md`, section "Phase 11 sizes". Not run here (D-44).

## Next Phase Readiness

- **11-20 / 11-22 (editor):** the detail DTO has `photos { main, back, fabric }` (each `{ slot, src, srcSet, width, height }` or `null`); the upload answers one `ProductLinePhotoDto`; the list has `mainPhotoThumb`. The editor must send `Idempotency-Key` and the multipart `file` part.
- **11-21 (Home):** `IImageDelivery.ForLinePhoto(...).Card` has the 4:5 category card candidates (`csps_cat_*`), `sizes` text is in the UI-SPEC.
- **11-26 / 11-34 (gallery, share picture):** `PublicIds.NewContent(root, "gallery", id)` and `"share"`; extend `ImageInventory.PhotoIdsAsync` with their tables (one more `Union`); `ForShare` and `ImageNamedSizes.SharePreviews` are ready; take the site-content lock on writes.
- **11-37 (audit labels):** `product-line.photo-changed`, detail `key=...;title=...;slot=main|back|fabric;change=added|replaced|removed`. `AuditActions.All` is 114 (the code is last). The web test lists the catalog by hand, so its count needs the new code.
- **Contract hot spots:** `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts` will conflict with the other wave plan; regenerate after merge with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command, then `npm --prefix tools/openapi-gen run generate`. `AuditActions.All` and its count in `AuditActionsTests` (and the order test) will conflict too: re-check the count after merge.
- **Public bundle:** untouched (no web source change; only the generated types file grew, additive).

## Self-Check: PASSED

- Files: the 10 created files in `key-files.created` exist on disk (10 of 10 checked).
- Commits `a36bb9ae`, `019f835d`, `8492bd2c`, `e020edf7`, `6361aa34`, `872e5094` and `6f115793` are ancestors of HEAD; each RED commit precedes its GREEN commit.
- The measured commit count is 7 (`git rev-list --count 66b6be12..HEAD` before this SUMMARY commit), read against the base id kept in the per-plan ledger file, not written from memory.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*
