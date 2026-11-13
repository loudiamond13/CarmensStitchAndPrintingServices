---
phase: 11-public-site-content-management
plan: 30
subsystem: api
tags: [aspnetcore, ef-core, share-picture, link-preview, og-image, json-ld, cloudinary, stray-sweep, image-inventory, audit, openapi]
created: 2026-11-12T22:30:00-06:00
updated: 2026-11-12T22:30:00-06:00

requires:
  - phase: 11-19
    provides: the content folder rule (PublicIds.NewContent), ForShare, the 34 named sizes (csps_share_1200, csps_share_320, csps_share_640), the removal queue use, the Products og:image
  - phase: 11-26
    provides: the Gallery og:image and the public gallery projection
  - phase: 11-28
    provides: the gallery upload pattern, the content inventory with gallery uploads, AuditActions.All at 131
  - phase: 09
    provides: the upload pipeline (ImageInspection, ImageMetadataStripper, IImageStorage, the removal queue) and the ImageUpload rate limit
provides:
  - "POST and DELETE /api/v1/site-settings/share-picture: Manager only, multipart, Phase 9 checks, a new random id under {root}/content/share/ every time, the old file queued in the same save, rate limited, Idempotency-Key"
  - "AddSharePicture migration: five nullable SiteSettings columns (SharePicturePublicId, Width, Height, Bytes, Format), forward only"
  - "og:image (1200 x 630), width, height, alt and the large card on Home, Contact and the 404; Products and Gallery keep their own photo and fall back to the default; the LocalBusiness JSON-LD image"
  - "SiteSettingsDto.sharePicture (src320, src640, width, height or null); IImageDelivery.ForSharePreview"
  - "ImageInventory names the share picture id; the Testing seed leaves a demo share picture"
  - "AuditActions.SharePictureChanged (site-settings.share-picture-changed); AuditActions.All is 132"
affects: [11-34, 11-37, 11-38]

actuals:
  tokens: 61900
  tasks: 3
  commits: 6
plan_head_before: 862a92061bf87252a7f4cce275a270d961bda960
plan_head_after: eabbd3d8ae50c49deb643d840b62a74cd0c84590

tech-stack:
  added: []
  patterns:
    - "The default share picture lives on the SiteSettings row as five nullable columns, so no new table; every new picture gets a new random id, so a shared link never keeps an old picture from Facebook's cache"
    - "Pages with no picture of their own carry the default (ShellPage passes one site image to Home, Contact, the 404 and, as a fallback, Products and Gallery)"
    - "The 404 has no canonical address, so PublicHeadWriter writes only the picture tags and the card for it when a picture exists"
    - "A matrix row can name a second Manager status (ManagerAlso) for an answer that depends on data another row of the same run can change"

key-files:
  created:
    - src/Csps.Application/Content/UploadSharePictureHandler.cs
    - src/Csps.Application/Content/UploadSharePictureRequest.cs
    - src/Csps.Application/Content/RemoveSharePictureHandler.cs
    - src/Csps.Application/Content/SharePictureDtos.cs
    - src/Csps.Server/Controllers/SharePictureController.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261113025547_AddSharePicture.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261113025547_AddSharePicture.Designer.cs
    - tests/Csps.Server.IntegrationTests/Content/SharePictureEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Content/SharePictureRig.cs
    - tests/Csps.Application.UnitTests/Content/UploadSharePictureHandlerTests.cs
    - tests/Csps.Application.UnitTests/Content/RemoveSharePictureHandlerTests.cs
    - tests/Csps.Domain.UnitTests/Content/SiteSettingsSharePictureTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/SharePictureMigrationTests.cs
  modified:
    - src/Csps.Domain/Content/SiteSettings.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Content/SiteSettingsDto.cs
    - src/Csps.Application/Content/GetSiteSettingsHandler.cs
    - src/Csps.Application/Content/UpdateSiteSettingsHandler.cs
    - src/Csps.Application/Content/PublicSiteSnapshot.cs
    - src/Csps.Application/Content/SiteContentErrors.cs
    - src/Csps.Application/Content/SiteSettingsAuditDetail.cs
    - src/Csps.Application/Ports/ISiteContentStore.cs
    - src/Csps.Application/Ports/IImageDelivery.cs
    - src/Csps.Application/Ports/IImageInventory.cs
    - src/Csps.Application/Images/ImageSource.cs
    - src/Csps.Infrastructure/Content/PublicContentReader.cs
    - src/Csps.Infrastructure/Content/SiteContentStore.cs
    - src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs
    - src/Csps.Infrastructure/Images/ImageInventory.cs
    - src/Csps.Infrastructure/Images/CloudinaryImageDelivery.cs
    - src/Csps.Infrastructure/Images/TestingImageDelivery.cs
    - src/Csps.Infrastructure/Images/ImageNamedSizes.cs
    - src/Csps.Infrastructure/Persistence/Configurations/SiteSettingsConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Endpoints/PublicHeadWriter.cs
    - src/Csps.Server/Endpoints/ShellPage.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/site-content.md
    - docs/api/public-site.md

key-decisions:
  - "The picture lives on the SiteSettings row (five nullable columns), as the plan says, so there is no new table. The cost: a picture change moves the row's version, so the Business Info screen must read the settings again after a picture change (owner item OI-1)"
  - "Every upload stores under a new random id, in {root}/content/share/00000000-0000-0000-0000-000000000001/; SiteSettings.SingletonGuid is the fixed folder owner id because the settings key is a number"
  - "The migration's Down throws NotSupportedException (forward only), like the other Phase 11 migrations and P11-BL-01, instead of dropping the five columns"
  - "The 404 head carries og:image and the large card when a default picture is set, and nothing else of the Open Graph block (it has no canonical address); with no picture it stays as it was"
  - "The upload and the remove take the site-content lock and run under ConflictRetry, so two picture writes or a picture write and another content write end one after the other"

requirements-completed: [PUB-04, CONT-01]

coverage:
  - id: D1
    description: "A Manager uploads a JPEG to POST /api/v1/site-settings/share-picture; it is stored under a new random id in csps/content/share/ (never the orders folder), the answer holds the 320 and 640 preview addresses and the stored size; an Admin gets 403"
    requirement: "CONT-01"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/SharePictureEndpointTests.cs#AManagerUploadsAJpegUnderTheShareFolderAndTheAnswerHoldsTheTwoPreviewAddresses, AnAdminGets403AndNothingIsStored; AuthorizationMatrixTests rows for POST and DELETE; RateLimitTests row"
        status: pass
    human_judgment: false
  - id: D2
    description: "Home, Contact and the 404 carry the default picture as og:image at 1200 x 630 with width, height, alt (the business name) and twitter:card summary_large_image; Products and Gallery keep their own photo and fall back to the default; with no picture the og:image tags are left out and twitter:card is summary"
    requirement: "PUB-04"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs#HomeContactAndTheNotFoundShellCarryTheDefaultSharePictureAsTheirLinkPreviewPicture, ProductsAndGalleryFallBackToTheDefaultSharePictureWhenTheyHaveNoPhotoOfTheirOwn, ProductsKeepsItsOwnLinePhotoOverTheDefaultSharePicture, GalleryKeepsTheCoverOfItsTopItemOverTheDefaultSharePicture; SharePictureEndpointTests#RemovingAnswers204QueuesTheFileAuditsItAndTheNextHomeHasNoPictureAndTheSmallCard"
        status: pass
    human_judgment: false
  - id: D3
    description: "The LocalBusiness JSON-LD image is the default picture's 1200 x 630 address on every public page and is absent with no picture"
    requirement: "PUB-04"
    verification:
      - kind: integration
        ref: "ShellHeadTests#TheJsonLdImageIsTheDefaultSharePictureAndIsAbsentWithNone"
        status: pass
    human_judgment: false
  - id: D4
    description: "A replace stores a new id different from the old one and queues the old file in the same save; a removal answers 204, queues its file and a second removal is 404; each change writes site-settings.share-picture-changed (change=added, replaced or removed) with no address; a failed save after the file reached storage queues the new file as UploadUndone"
    requirement: "CONT-01"
    verification:
      - kind: integration
        ref: "SharePictureEndpointTests#EveryNewPictureGetsANewIdTheOldFileIsQueuedOnceAndEachChangeIsAuditedWithoutTheAddress, RemovingAnswers204QueuesTheFileAuditsItAndTheNextHomeHasNoPictureAndTheSmallCard"
        status: pass
      - kind: unit
        ref: "UploadSharePictureHandlerTests (12), RemoveSharePictureHandlerTests (4), SiteSettingsSharePictureTests (7), AuditActionsTests (count 132)"
        status: pass
    human_judgment: false
  - id: D5
    description: "An SVG named as a JPEG, a file one byte over 10 MB and a photo over 25 megapixels are refused with the Phase 9 messages and nothing is stored"
    requirement: "CONT-01"
    verification:
      - kind: integration
        ref: "SharePictureEndpointTests#AnSvgNamedAsAJpegIsRefusedByItsBytesWithTheP9MessageAndNothingIsStored, AFileOneByteOverTenMegabytesIsRefusedWithTheP9MessageAndNothingIsStored, APhotoWithTooManyPixelsIsRefusedWithTheP9MessageAndNothingIsStored"
        status: pass
    human_judgment: false
  - id: D6
    description: "GET /api/v1/site-settings returns sharePicture with the 320 and 640 preview addresses and the stored size after an upload (Admin may read it), and null after a removal"
    requirement: "CONT-01"
    verification:
      - kind: integration
        ref: "SharePictureEndpointTests#TheStaffSettingsReadHoldsThePreviewAddressesAndTheStoredSizeAfterAnUploadAndNullAfterARemove; SiteSettingsEndpointTests (property list); OpenApiSnapshotTests"
        status: pass
      - kind: unit
        ref: "GetSiteSettingsHandlerTests#ASharePictureBecomesThePreviewAddressesAndTheStoredSize"
        status: pass
    human_judgment: false
  - id: D7
    description: "The image inventory names the share picture id, so the stray sweep and the removal job keep the file"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Images/ImageInventoryTests.cs#TheShareFileOfTheSettingsRowIsKnownAndNamedByAPhotoSoTheSweepKeepsIt"
        status: pass
    human_judgment: false
  - id: D8
    description: "The AddSharePicture migration adds only five nullable columns, the seed row holds nulls, nothing is dropped or deleted, the idempotent script runs twice, and undoing the migration is refused"
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/SharePictureMigrationTests.cs (3 of 3); TriggerInventoryTests; MigrationScriptTests; MigrationTests"
        status: pass
    human_judgment: false
  - id: D9
    description: "POST /api/testing/site-content leaves a demo 1200 x 630 share picture in place, and the Home head carries it"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Testing/TestingSiteContentTests.cs#APostLeavesADemoSharePictureInPlaceAndTheHomeHeadCarriesIt"
        status: pass
    human_judgment: false
  - id: D10
    description: "MUST NOT reuse a public id for a new share picture, so a shared link never keeps showing an old picture from Facebook's cache"
    requirement: "PUB-04"
    verification:
      - kind: integration
        ref: "SharePictureEndpointTests#EveryNewPictureGetsANewIdTheOldFileIsQueuedOnceAndEachChangeIsAuditedWithoutTheAddress (two uploads, two different ids)"
        status: pass
    human_judgment: true
    rationale: "The plan marks this prohibition as a judgment item. The tests prove each upload gets a different 128-bit random id. That Facebook then shows the new picture is checked by the owner with the Sharing Debugger after the live deploy (plan 11-38)."
  - id: D11
    description: "The 34 Cloudinary named sizes (the share sizes included) exist in the live account"
    verification: []
    human_judgment: true
    rationale: "The owner runs the existing Cloudinary setup command once after the Phase 11 deploy (D-44, go-live checklist). This plan adds no size and did not touch the live account."
  - id: D12
    description: "Domain coverage 100 percent line and branch, Application above its floor, format clean, web typecheck, lint and format clean, full Server, Infrastructure and Architecture runs"
    verification:
      - kind: other
        ref: "tools/scripts/Invoke-CoverageGate.ps1; dotnet format Csps.slnx --verify-no-changes; npm --prefix web run typecheck, lint, format:check; full Server run 2763 of 2764 (one timing test under load, passes alone); full Infrastructure 1181 of 1182 (1 skipped); Architecture 290 of 290"
        status: pass
    human_judgment: false

duration: 1h 50m
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 30: The default share picture Summary

**A Manager sets one default link preview picture (checked, stripped, stored under a new random id every time) and every shared Home, Contact, 404, Products and Gallery link shows a real picture: the page heads carry og:image at 1200 x 630 with the large card, the JSON-LD carries it, the staff read returns its previews, and the stray sweep keeps its file.**

## Performance

- **Duration:** about 1 h 50 min (the first command was at about 20:40, the last verification run ended at 22:22; the start time was not recorded to the second)
- **Tasks:** 3 (1 tracer, 2 auto), all TDD
- **Files in the diff:** 53 (13 created, 40 modified, none deleted; the two contract files and the migration Designer file included). The token figure (chars/4 of the added lines in `src`, `tests` and `docs`) is about 61,900; the Designer snapshot is a large part of it. The plan estimated 110,000.

## Accomplishments

- **Routes.** `POST /api/v1/site-settings/share-picture` (multipart `file`, Manager only, `ImageUpload` rate limit, `Idempotency-Key`, same step order and messages as the line photo upload) answers `{ src320, src640, width, height }`. `DELETE` answers 204, or 404 `site-settings.share-picture-not-found` when none is set. An Admin gets 403, no token 401.
- **New id every time.** `PublicIds.NewContent(root, "share", SiteSettings.SingletonGuid)` gives `{root}/content/share/00000000-0000-0000-0000-000000000001/{26 base32}`. A replace queues the old file (`PhotoReplaced`) and a removal queues it (`PhotoDeleted`), both in the same transaction as the settings save. A failed save after the file reached storage queues the new file as `UploadUndone` on its own context.
- **Migration.** `AddSharePicture` adds only the five nullable columns (listed below). It holds no trigger and no drop. Its `Down` is forward only.
- **Page heads.** The site snapshot carries the default picture's 1200 x 630 address. Home, Contact and the 404 write `og:image`, `og:image:width` 1200, `og:image:height` 630, `og:image:alt` (the business name) and `twitter:card` `summary_large_image`. Products and Gallery keep their own photo and fall back to the default; with no picture at all the picture tags are left out and `twitter:card` is `summary`. The LocalBusiness JSON-LD `image` is the same address.
- **Staff read.** `SiteSettingsDto.sharePicture` has the 320 x 168 and 640 x 336 preview addresses and the stored size, or null.
- **Sweep and inventory.** `ImageInventory` names the share picture id, so the monthly stray sweep and the removal job keep the file.
- **Audit.** `site-settings.share-picture-changed` with `change=added|replaced|removed`, target `SiteSettings` id `1`, never an address. `AuditActions.All` is 132.
- **Demo seed.** `POST /api/testing/site-content` leaves a demo 1200 x 630 share picture in place (an id that points at no stored file, like the demo orders' photos).
- **Docs.** `docs/api/site-content.md` has the routes, the picture section and the audit entry; `docs/api/public-site.md` has the head rules and the JSON-LD `image`.

### The migration (real output of `dotnet ef migrations add AddSharePicture`)

`20261113025547_AddSharePicture`. Up:

```csharp
migrationBuilder.AddColumn<int>(name: "SharePictureBytes", table: "SiteSettings", type: "int", nullable: true);
migrationBuilder.AddColumn<string>(name: "SharePictureFormat", table: "SiteSettings", type: "varchar(8)", unicode: false, maxLength: 8, nullable: true);
migrationBuilder.AddColumn<int>(name: "SharePictureHeight", table: "SiteSettings", type: "int", nullable: true);
migrationBuilder.AddColumn<string>(name: "SharePicturePublicId", table: "SiteSettings", type: "nvarchar(200)", maxLength: 200, nullable: true);
migrationBuilder.AddColumn<int>(name: "SharePictureWidth", table: "SiteSettings", type: "int", nullable: true);
migrationBuilder.UpdateData(table: "SiteSettings", keyColumn: "Id", keyValue: 1,
    columns: new[] { "SharePictureBytes", "SharePictureFormat", "SharePictureHeight", "SharePicturePublicId", "SharePictureWidth" },
    values: new object[] { null, null, null, null, null });
```

The `UpdateData` is what EF writes for a seed (`HasData`) row when a nullable column is added: it sets only the five new columns to NULL on the seed row, and nothing else on that row changed, so the plan's stop rule did not trip. The generated `Down` was five `DropColumn` calls; it was replaced (the scaffold itself warned "may result in the loss of data"):

```csharp
protected override void Down(MigrationBuilder migrationBuilder)
{
    // Forward only. Undoing this migration would drop the stored link preview picture record.
    // A drop is a one-way door: it needs the owner's approval and its own reviewed migration.
    throw new NotSupportedException(
        "AddSharePicture is forward-only. Undoing it would delete the link preview picture record.");
}
```

### A real head (Home, after an upload, from a test run on the final tree)

```html
<title>CSPS · Custom Team Jerseys and Tailoring</title>
<meta name="description" content="Custom tailoring and full-sublimation printing for teams, leagues and riding groups.">
<link rel="canonical" href="https://localhost/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Carmen&#x27;s Stitch &amp; Printing Services">
<meta property="og:locale" content="en_PH">
<meta property="og:title" content="CSPS · Custom Team Jerseys and Tailoring">
<meta property="og:description" content="Custom tailoring and full-sublimation printing for teams, leagues and riding groups.">
<meta property="og:url" content="https://localhost/">
<meta property="og:image" content="https://localhost/api/testing/images/iz6rqyruzscbfppv5hkougcpte?size=csps_share_1200">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Carmen&#x27;s Stitch &amp; Printing Services">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"Carmen's Stitch & Printing Services","description":"Custom tailoring and full-sublimation printing for teams, leagues and riding groups.","url":"https://localhost","image":"https://localhost/api/testing/images/iz6rqyruzscbfppv5hkougcpte?size=csps_share_1200"}</script>
```

(The Testing environment's address is a path on this site; the live one is a Cloudinary address. The business name is the migrated default. The head is cut before the boot data block.)

## Task Commits

| Task | Phase | Commit | Message |
|---|---|---|---|
| 1 (tracer) | RED | `f5395242` | test(11-30): add failing tests for the default share picture upload and its og:image on Home, Contact and the 404 |
| 1 (tracer) | GREEN | `592c3322` | feat(11-30): a Manager uploads the default share picture and Home, Contact and the 404 carry it as og:image |
| 2 | RED | `3c013f1a` | test(11-30): add failing tests for removing the share picture, its audit entry, the Products and Gallery fallback and the JSON-LD image |
| 2 | GREEN | `218fdee3` | feat(11-30): replace and remove the share picture, audit each change, and let Products, Gallery and the JSON-LD use the default picture |
| 3 | RED | `e314c928` | test(11-30): add failing tests for the staff settings preview, the sweep keeping the share file and the demo share picture |
| 3 | GREEN | `eabbd3d8` | feat(11-30): the staff settings read shows the share picture previews, the sweep keeps its file and the demo seed sets one |

**Plan metadata:** the SUMMARY commit that follows this file (STATE.md and ROADMAP.md are left to the orchestrator).

## TDD Gate Compliance

The plan frontmatter is `type: execute` with TDD tasks, so the format-based RED classifier (`gsd_run check tdd-red-evidence`) is not required, and xunit v3 on Microsoft.Testing.Platform prints none of the formats it reads. The RED evidence is the real console output, read by hand. A RED commit precedes each GREEN commit.

- **Task 1 RED** (`f5395242`): the four target classes ran (609 tests) and 8 failed on the planned assertions: the upload answered a status other than 200 (the route did not exist; `AManagerUploadsAJpeg...`, `AnAdminGets403...`, the Home/Contact/404 head test), and the matrix had no endpoint for its new row (three rows and `DiscoveredEndpointsAreFullyCovered`, plus the parallel run). Semantic assessment: the target tests executed and failed for the intended reason. A first RED attempt failed in the rig's guarded clean-up SQL (SQL Server resolves column names inside an `IF` before running it); that was a fixture fault, not RED, and was fixed (the clean-up wraps the UPDATE in `EXEC`) before the RED commit.
- **Task 1 GREEN** (`592c3322`): the same classes plus `OpenApiSnapshotTests` and `RateLimitTests` 663 of 663; `npm --prefix tools/openapi-gen run check` clean. The tracer's `<verify>` holds only `<automated>` commands, so they were re-run on the finished tree before expansion and passed: tracer verified end to end, expanding.
- **Task 2 RED** (`3c013f1a`): Server 608 tests, 9 failed (DELETE and audit and fallback and JSON-LD behavior, the DELETE matrix rows for Anonymous and Admin, the matrix discovery and the parallel run); Domain `AuditActionsTests` 2 of 118 failed (the count 132 and the new code). **Weak spots, stated plainly:** the refusal tests, the Manager's DELETE matrix row (the missing route answers 404 by the API fallback, which the row also expects), the three migration tests and the unit tests of the upload handler passed at RED, because the tracer's handler and migration already did that work; the audit assertions of the handler are proved at RED only through the endpoint tests (adding the audit parameter to the handler constructor would not compile in a test written first).
- **Task 2 GREEN** (`218fdee3`): Server 675 of 675 in six classes; Infrastructure 176 of 176 (migration, trigger, script and migration classes); Domain 125 of 125; Application 16 of 16 (both new handler classes).
- **Task 3 RED** (`e314c928`): `ImageInventoryTests` 1 of 11 failed (the share id was not known); Server 2 of 19 failed (`sharePicture` missing from the staff read, the demo seed left no picture).
- **Task 3 GREEN** (`eabbd3d8`): Server 44 of 44 in five classes; `ImageInventoryTests` 11 of 11; handler tests 28 of 28.
- **Written with or after the code, to keep Domain at 100 percent:** `SiteSettingsSharePictureTests`, `RemoveSharePictureHandlerTests` and the null-guard tests in `GetSiteSettingsHandlerTests`.

## Verification evidence (real output)

All runs on LocalDB (`CSPS_TEST_SQL=localdb`) in this worktree.

- **Task 1 verify:** `SharePictureEndpointTests`, `ShellHeadTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests`, `OpenApiSnapshotTests`, `RateLimitTests`: `total: 663, failed: 0, succeeded: 663`. `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The contract change is additive only (no deleted line in the snapshot; one line of the generated types moved from `delete?: never` to the new operation).
- **Task 2 verify:** Server (`SharePictureEndpointTests`, `ShellHeadTests`, `AuthorizationMatrixTests`, `AuthorizationCoverageTests`, `OpenApiSnapshotTests`, `RateLimitTests`) `total: 675, failed: 0`; Application `UploadSharePictureHandlerTests` and `RemoveSharePictureHandlerTests` `total: 16, failed: 0`; Infrastructure (`SharePictureMigrationTests`, `TriggerInventoryTests`, `MigrationScriptTests`, `MigrationTests`) `total: 176, failed: 0`; Domain (`AuditActionsTests`, `SiteSettingsSharePictureTests`) `total: 125, failed: 0`.
- **Task 3 verify:** Server (`SharePictureEndpointTests`, `SiteSettingsEndpointTests`, `SiteSettingsWriteTests`, `OpenApiSnapshotTests`, `TestingSiteContentTests`) `total: 44, failed: 0`; Infrastructure `ImageInventoryTests` `total: 11, failed: 0`; `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- **Coverage gate** (`tools/scripts/Invoke-CoverageGate.ps1`): Domain 1850 of 1850 tests, "Csps.Domain line 100% (4202/4202) branch 100% (1789/1789) PASS"; Application 2997 of 2997 tests, "Csps.Application line 98% (11451/11676) PASS", branch 95.7%; "Coverage gate passed."
- **Full Server integration run on the final tree:** `total: 2764, failed: 1, succeeded: 2763`. The one failure is `OrderListTimingTests.TheListAnswersUnder300MsAtP95OnFiveYearsOfOrders`: "customer-name search p95 is too slow", 302.9 ms against a limit of 300 ms, while another project's end-to-end run was using the machine. Run alone it passed (`total: 1, succeeded: 1`). It is a timing test in code this plan did not touch. Recorded as a load flake.
- **Full Infrastructure run:** `total: 1182, failed: 0, succeeded: 1181, skipped: 1` (the live HIBP test that was already skipped). **Architecture tests:** `total: 290, failed: 0`.
- **Web:** `npm --prefix web run typecheck` clean, `npm --prefix web run lint` (`--max-warnings 0`) clean, `npm --prefix web run format:check` "All matched files use Prettier code style!", and vitest on the four files that read the settings (`siteSettingsService.test.ts`, `BusinessInfoTab.test.tsx`, `HoursTab.test.tsx`, `ProductLinePage.test.tsx`): 4 files, 128 tests passed. The generated types made `sharePicture` a required member of `SiteSettingsDto`, so two fixtures (`web/src/test/siteContentFixtures.ts` and `siteSettingsService.test.ts`) got `sharePicture: null`. No other web source changed.
- **Acceptance greps:** `SharePicturePublicId` in the migration: 2 lines. `UploadSharePicture` in the snapshot: 1. `ShouldBe(132)` in `AuditActionsTests.cs`: 1. `SharePicture` in `SiteSettingsDto.cs`: 3.
- gitleaks `protect --staged` ran before every commit (and the repository hook ran it again): no leaks. The staged diffs hold only fake values (`csps-test` ids, `images.example.test`) and no local path, real email, cloud name, host or customer data. No em or en dash was added.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The DELETE matrix row cannot hold one exact Manager status**
- **Found during:** Task 2 (matrix rows) against Task 3 (the demo seed)
- **Issue:** The plan gives the DELETE row `Manager: 404` and also says `POST /api/testing/site-content` leaves a demo share picture in place. The matrix runs that Testing row in the same database, once per caller and again in the parallel run, so a Manager's first DELETE would answer 204 (picture present) and later ones 404, in an order nothing controls.
- **Fix:** `MatrixRow` got an optional `ManagerAlso` status and an `Allows(caller, status)` check; the two matrix tests use it, with the old exact failure message. Only the DELETE share-picture row sets it (`Manager: 404, ManagerAlso: 204`). Anonymous and Admin stay exact.
- **Files modified:** `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs`, `AuthorizationMatrixTests.cs`
- **Committed in:** `3c013f1a`

**2. [Rule 1 - Existing tests that pinned the old behavior]**
- **Found during:** Task 2 and 3 runs
- **Issue:** `AuditActionsTests` pinned the exact order and count of the catalog (131); `SiteSettingsEndpointTests` pinned the exact list of settings properties; `UpdateSiteSettingsHandlerTests` and `GetSiteSettingsHandlerTests` built the handlers with their old constructors; two web fixtures built a `SiteSettingsDto` without the new required member.
- **Fix:** Updated each to the new truth (132 with the code last; `sharePicture` in the property list; the new `IImageDelivery` argument; `sharePicture: null` in the fixtures).
- **Committed in:** `3c013f1a`, `218fdee3` and `eabbd3d8`

**3. [Rule 1 - Plan wording not followed] `RemoveSharePicture()` takes no clock, and `SiteSettings.SingletonGuid` is new**
- **Issue:** The plan's interface note shows `SiteSettings.SingletonGuid` as if it existed (it did not: the settings key is the number 1), and the artifact list gives `SetSharePicture(...)` and `RemoveSharePicture()` with no clock.
- **Fix:** Added `SingletonGuid` (a fixed Guid for the folder name). `SetSharePicture(LinePhotoFile)` reuses the existing file-facts record of the line photos. Neither method takes a clock: the record stamp interceptor sets the settings row's last-changed time and person on every staff edit, so `UpdatedAtUtc` and the sitemap date still move.
- **Committed in:** `592c3322`

**4. [Rule 3 - Blocking] `IImageDelivery.ForSharePreview`**
- **Issue:** The plan needs the 320 and 640 preview addresses in the staff read but names no delivery method for them (`ForShare` is the 1200 one).
- **Fix:** Added `IImageDelivery.ForSharePreview(publicId)` returning `SharePreviewUrls(Src320, Src640)` and `ImageNamedSizes.SharePreviewOf(width)`, for both the Cloudinary and the Testing delivery. The two sizes already existed (plan 11-19), so the setup command and the 34 named sizes are unchanged.
- **Committed in:** `592c3322`

### Plan wording kept as written, with a note

- **The 404 and "twitter:card is summary".** The plan says with no picture the og:image tags are left out and `twitter:card` is `summary`. The 404 has no canonical address and has never carried any Open Graph or card tag, so with no picture it still carries none. With a picture it carries the picture tags and the large card, as the plan says.
- **The migration `Down`.** The plan says "Quote Up and Down". The orchestrator's note says follow the forward-only pattern of the other Phase 11 migrations, and the owner's rule is no schema drops without asking. Both are quoted above.

---

**Total deviations:** 4 (2 blocking, 2 existing-tests/wording). **Impact:** none on product behavior. One test-infrastructure change (the matrix row's second status) and a small constructor change in two handlers.

## Owner items (open, nothing blocks the plan; recommendation first)

**OI-1. A picture change moves the settings version.** The share picture is stored on the SiteSettings row, as the plan says, so every upload and removal changes the row's `version`. Plan 11-34's Business Info card must read the settings again after a picture change, or the next "Save Business Info" with the old version answers 409 `edit.stale`. Recommendation: keep, and have 11-34 refresh the settings query after both calls (the answers are small; the POST could also return the new version if you prefer, one field). Alternative: a separate table for the picture so it never touches the form's version. That is a new table, so it needs your approval first.

**OI-2. New words.** One admin-facing text is new: removing a picture when none is set says "There's no link preview picture to remove." (code `site-settings.share-picture-not-found`). It is rarely seen because the Remove button shows only with a picture. Recommendation: keep. Alternative: your own words (one constant, `SiteContentErrors.SharePictureNotFoundMessage`).

**OI-3. The 404 with no picture still has no card tag.** See the note above. Recommendation: keep, a 404 is not shared on purpose. Alternative: write `twitter:card` `summary` on the 404 too (one line in `PublicHeadWriter`).

**OI-4. Live steps for the owner.** (1) The Cloudinary setup command must have run once so `csps_share_1200`, `csps_share_320` and `csps_share_640` exist (already on the go-live list from plan 11-19; this plan adds no size). (2) After the live deploy, check a shared link in the Facebook Sharing Debugger (plan 11-38 lists it).

## Issues Encountered

- SQL Server resolves column names of an existing table inside `IF ... UPDATE` before running it, so the first guarded clean-up in the test rig failed with "Invalid column name" on a database without the columns. Fixed with `EXEC(N'...')`; after the migration existed the rig uses EF `ExecuteUpdateAsync`.
- The first unit test harness handed the same settings row to the retry pass, which made the lost-race tests queue two files. The real unit of work clears its tracker after a lost race, so the harness now loads a fresh row for every attempt.
- A full Server run takes about 22 minutes on this machine while another project's end-to-end run is active. The one timing failure is recorded above.
- Because `web/` and `tools/openapi-gen/` had no `node_modules` in this worktree, `npm ci --ignore-scripts` ran in both (lockfile versions only, nothing added).
- No shell of mine is left running.

## Known Stubs

None. The demo share picture id points at no stored file (like the demo orders' photos), by design, and exists only in the Testing seed. `.planning/WINDOWS.md` was not touched: parallel executors share it, and the orchestrator merges the ledger after the wave.

## Authentication Gates

None.

## Threat Flags

None beyond the plan's threat model. T-11-76 (Phase 9 `ImageInspection`, the metadata strip, request size limits, three refusal tests), T-11-77 (Manager policy, matrix rows for POST and DELETE, the rate limit list), T-11-78 (the og:image address comes from the delivery port and is attribute-encoded; the JSON-LD goes through the default JSON encoder; nothing comes from the request) and T-11-SC (no package added or bumped) are covered. No new endpoint is anonymous.

## User Setup Required

None for this plan beyond the owner's live steps in OI-4.

## Next Phase Readiness

- **11-34 (Business Info card):** `POST /api/v1/site-settings/share-picture` (multipart `file`, send an `Idempotency-Key`) answers `{ src320, src640, width, height }`; `DELETE` answers 204 (404 when none is set); `SiteSettingsDto.sharePicture` is the same object or null. **Refresh the settings after either call** (OI-1): the row's `version` moves. Send the file through `prepareImage` first; the server strips again.
- **11-37 (audit labels and link-preview e2e):** add the label for `site-settings.share-picture-changed` ("Link preview picture changed"), detail `change=added|replaced|removed`. `AuditActions.All` is 132 here (the code is last); recheck the count and the order test after merge. The web `auditCopy.test.ts` hand-lists the catalog. The Testing seed now leaves a demo share picture in place, so the link-preview spec can assert `og:image` on Home, Contact and the 404 after seeding; the picture address is a path on this site that answers 404 (the demo id points at no stored file), so specs that load it must declare it to the guard like the demo order photos.
- **11-38 (go-live):** the Sharing Debugger check on each public URL; the Cloudinary setup command (OI-4).
- **Contract hot spots after merge:** `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts` will conflict with the other plan of the wave: regenerate with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command, then `npm --prefix tools/openapi-gen run generate`. `AuditActions.All` and its count in `AuditActionsTests` (and the order-pinning test) will conflict too.
- **Public bundle:** untouched. The only web changes are the generated types and two test fixtures; no public page source changed.

## Self-Check: PASSED

- Files: the 13 files in `key-files.created` exist on disk (checked below).
- Commits `f5395242`, `592c3322`, `3c013f1a`, `218fdee3`, `e314c928` and `eabbd3d8` are ancestors of HEAD; each RED commit precedes its GREEN commit.
- The measured commit count is 6 (`git rev-list --count 862a92061bf87252a7f4cce275a270d961bda960..HEAD` before this SUMMARY commit), read against the base id kept in the per-plan ledger file, not written from memory.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*
