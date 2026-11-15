---
phase: 11-public-site-content-management
plan: 26
subsystem: public-gallery-server
tags: [gallery, privacy, recent-work, public-api, projection, hybridcache, og-image, testing-seed]
created: 2026-11-12T17:20:00-06:00
updated: 2026-11-12T18:00:00-06:00

requires:
  - phase: 11-public-site-content-management
    provides: "11-23 GalleryEntries, order public settings, OrderPublicFiling; 11-21 Home read with the recentWork and heroTag stubs; 11-15 and 11-17 product lines and the hasGalleryItems and shownGalleryCount fields; 11-19 named image sizes and ForShare"
provides:
  - "GET /api/v1/public/gallery (anonymous, strong ETag, no-cache, 304, 600 reads a minute): items in gallery order, pills, total"
  - "PublicGalleryProjection: the one privacy-safe projection of public orders and uploads, used by the gallery, Home and the line flags"
  - "Home recentWork (six newest shown orders by shown date) and heroTag (the newest), with 4:5 strip photo addresses"
  - "hasGalleryItems on the public product lines read and shownGalleryCount on the Manager's list, from the same projection"
  - "IImageDelivery.ForGallery (masonry, viewer, thumb) and ForStrip (4:5 strip)"
  - "/gallery page og:image at the 1200 x 630 share size (cover of the top public item)"
  - "Testing seed: five demo gallery orders (four shown, one with the OK but not shown)"
  - "PublicPrivacyTests: the customer-data backstop over every public route and every page shell"
affects: [11-27, 11-28, 11-29, 11-30, 11-31, 11-37]

actuals:
  tokens: 34070
  tasks: 3
  commits: 8

# commits is the measured git rev-list count from plan_head_before to plan_head_after (six plan commits for the three tasks plus a
# RED and a GREEN for the deadlock fix, no merges in between). actuals.tokens is chars/4 over the added lines of the realized diff
# (136,292 characters, which includes about 28 KB of regenerated OpenAPI snapshot and web types). The SUMMARY commit comes after
# plan_head_after.
plan_head_before: 2930cf3e060ed8baa463e99c3884015c53ea7317
plan_head_after: b3fe6049

tech-stack:
  added: []
  patterns:
    - "One projection with an explicit column list feeds every public read, so no public answer decides on its own what is public"
    - "The public read decides visibility itself (consent, shown date, status, soft-delete filter, shown line, photo) and never trusts the gallery entry alone"
    - "Share picture of a listing page comes from the cached snapshot (ShareImageUrl), not from the JSON the page reads"

key-files:
  created:
    - src/Csps.Application/Content/PublicGalleryDto.cs
    - src/Csps.Application/Content/GetPublicGalleryHandler.cs
    - src/Csps.Infrastructure/Content/PublicGalleryProjection.cs
    - tests/Csps.Testing/GallerySeeding.cs
    - tests/Csps.Server.IntegrationTests/Content/PublicGalleryRig.cs
    - tests/Csps.Server.IntegrationTests/Content/PublicGalleryEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Content/PublicGalleryLineFlagsTests.cs
    - tests/Csps.Server.IntegrationTests/Content/PublicPrivacyTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Content/PublicGalleryProjectionTests.cs
    - tests/Csps.Application.UnitTests/Content/GetPublicGalleryHandlerTests.cs
  modified:
    - src/Csps.Application/Images/ImageSource.cs
    - src/Csps.Application/Ports/IImageDelivery.cs
    - src/Csps.Application/Ports/IPublicContentReader.cs
    - src/Csps.Application/Ports/IProductLines.cs
    - src/Csps.Application/Content/ProductLineDtos.cs
    - src/Csps.Application/Content/PublicHomeDto.cs
    - src/Csps.Infrastructure/Content/PublicContentReader.cs
    - src/Csps.Infrastructure/Content/ProductLines.cs
    - src/Csps.Infrastructure/Content/TestingSiteContentSeeder.cs
    - src/Csps.Infrastructure/Images/CloudinaryImageDelivery.cs
    - src/Csps.Infrastructure/Images/TestingImageDelivery.cs
    - src/Csps.Infrastructure/Images/ImageCandidates.cs
    - src/Csps.Server/Controllers/PublicSiteController.cs
    - src/Csps.Server/Endpoints/ShellPage.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/public-site.md
    - docs/web/e2e.md

key-decisions:
  - "The cache cap is NOT changed: MaximumCachePayloadBytes stays 64 * 1024 (65,536). A 300 item gallery with 600 photos is far larger than that (the test asserts the JSON is over 64 KB) and the second read still runs zero database commands and returns the same cached object"
  - "The /gallery og:image is the cover photo of the item at the top of the gallery, not the item with the newest photo by date. New items join at the top, so it is the newest unless a Manager moved something up. Open for the owner, see Open items"
  - "ProductLineListRow keeps GalleryItemCount for the delete guard (filed entries and order line choices, shown or not) and gets a separate ShownGalleryCount (public items), so Delete is never offered for a line the server would refuse to delete"
  - "An order whose name shown and team are both blank is left out of the public read, because a tile with no name cannot be drawn"
  - "The public item DTO carries the gallery entry id and the line's placeholder art as a camelCase string, like every other public DTO"

patterns-established:
  - "Public projections select by column name and a grep criterion keeps customer field names out of the projection file"
  - "Direct upload rows in tests are built by GallerySeeding.AddUploadAsync through the entity's private constructor until 11-28 adds GalleryEntry.CreateUpload"

requirements-completed: [GAL-01, CONT-03, PUB-02, PUB-04]
requirements-partial: []

coverage:
  - id: D1
    description: "A shown order is one public gallery item with its line, pieces and all photos (cover first), with pills and a total, a strong ETag and 304"
    requirement: GAL-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicGalleryEndpointTests.cs#AShownOrderIsOneItemWithItsLinePiecesPhotosAndPillAndTheAnswerHasAnETagThatEarnsA304"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs#GET /api/v1/public/gallery"
        status: pass
    human_judgment: false
  - id: D2
    description: "Only consented, shown, not cancelled, not deleted, filed-under-a-shown-line, photographed orders (and shown uploads on shown lines) are public"
    requirement: GAL-01
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Content/PublicGalleryProjectionTests.cs"
        status: pass
    human_judgment: false
  - id: D3
    description: "No customer name, phone, email, address, price, note, item description or photo description appears in any public route or page shell"
    requirement: GAL-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicPrivacyTests.cs#EveryPublicRouteHoldsNoCustomerValueNoPriceAndNoPhotoDescriptionEvenWhileItShowsTheOrder"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicPrivacyTests.cs#EveryShellHoldsNoCustomerValueNoPriceAndNoPhotoDescriptionInItsHeadOrItsBootData"
        status: pass
      - kind: other
        ref: "grep -v '^\\s*//' src/Csps.Infrastructure/Content/PublicGalleryProjection.cs | grep -c 'CustomerName|ContactNumber|.Email|.Notes|Description' == 0"
        status: pass
    human_judgment: false
  - id: D4
    description: "A 300 item gallery snapshot stays cached: the second read runs no database command, with the cache cap unchanged"
    requirement: PUB-02
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Content/PublicContentReaderTests.cs#TheSecondGalleryReadOfThreeHundredShownItemsRunsNoDatabaseCommand"
        status: pass
    human_judgment: false
  - id: D5
    description: "Showing, a photo add on a shown order, taking off, a cover change and a line hide each give a new gallery and Home ETag"
    requirement: CONT-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs#ShowingAPhotoAddOnAShownOrderTakingItOffAndALineHideEachGiveANewGalleryETagOnTheNextRead"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs#ShowingACoverChangeTakingOffShowingAgainAndALineHideEachGiveANewHomeETagOnTheNextRead"
        status: pass
    human_judgment: false
  - id: D6
    description: "Home recentWork is the six newest shown orders by shown date (uploads never) and heroTag the newest, with strip photo addresses; none gives [] and null"
    requirement: CONT-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicHomeEndpointTests.cs#SevenShownOrdersGiveTheSixNewestAsRecentWorkNewestFirstWithStripPhotosAndNoUploadAndTheHeroTagIsTheNewest"
        status: pass
    human_judgment: false
  - id: D7
    description: "hasGalleryItems, the Manager's shownGalleryCount and the delete guard follow the gallery entries"
    requirement: CONT-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicGalleryLineFlagsTests.cs"
        status: pass
    human_judgment: false
  - id: D8
    description: "The /gallery page's og:image is the cover of the top public item at the share size, with width, height and alt; no public photo leaves the tags out"
    requirement: PUB-04
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/ShellHeadTests.cs#TheGalleryPageUsesTheCoverOfTheTopPublicItemAsItsLinkPreviewPicture"
        status: pass
    human_judgment: true
    rationale: "The tests pin the top-of-gallery reading of 'the newest public photo'. Whether the owner wants the top item or the item with the newest photo is a wording call, parked below as O-1."
  - id: D10
    description: "A public gallery read that loses a deadlock to a staff write is read again (up to three tries), so a visitor never meets a 500 for it"
    requirement: GAL-01
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Content/PublicGalleryProjectionTests.cs#ADeadlockVictimOnTheFirstReadIsReadAgainAndTheSecondAttemptAnswers"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Content/PublicGalleryProjectionTests.cs#ADeadlockVictimOnEveryOneOfThreeAttemptsSurfacesTheThirdFailure"
        status: pass
    human_judgment: false
  - id: D9
    description: "POST /api/testing/site-content leaves four demo shown orders and one that has the OK but is not shown"
    requirement: GAL-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Testing/TestingSiteContentTests.cs#APostLeavesTheFourDemoShownOrdersAndTheOneNotShownEvenWhenRunTwiceAndTheGalleryListsTheFour"
        status: pass
    human_judgment: false

duration: 100min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 26: Visitors see real shown orders in the Gallery data and Recent work, with no customer details Summary

**GET /api/v1/public/gallery lists every consented, shown, live, photographed order and shown upload from one explicit-column projection; Home's Recent work and hero tag, the line gallery flags and counts, and the Gallery link preview all come from the same projection, and a test walks every public route and page shell with an order full of private values to prove none of them ever leaves the server.**

## Status: complete

All three tasks are done and committed. One wording item is open for the owner (O-1, the Gallery share picture). Nothing blocked.

## Open items (owner)

### O-1: which photo is the Gallery's link preview picture?

The plan says `/gallery`'s `og:image` is "the newest public photo". I built it as the cover photo of the item at the **top of the gallery**. New items join at the top, so it is the newest shown item until a Manager moves an item up or down. Reading "newest" as "the item or photo with the newest date" would need a date rule for uploads and a choice between the shown date and the photo's own date.

- **A (built, recommended):** top of the gallery. What a visitor sees first is what a shared link shows. One rule, no date maths.
- **B:** newest by date. Stable when a Manager reorders, but a Manager who moves a favourite to the top would see a different picture in the shared link.

A ruling of B changes only `PublicContentReader.ShareImageOf` and the test `TheGalleryPageUsesTheCoverOfTheTopPublicItemAsItsLinkPreviewPicture`.

### O-2 (information): the demo orders show in the admin Orders list

`POST /api/testing/site-content` now also writes five orders `DEMO-GALLERY-1` to `DEMO-GALLERY-5` (the plan asks for this). They appear in the admin Orders list of the E2E database after any spec that calls `seedDemoSiteContent`. I could not run Playwright (the brief forbids starting servers), so I did not run the order specs. A spec that counts every order in an unfiltered list must count its own orders only. `docs/web/e2e.md` says so.

## Accomplishments

- **One projection.** `PublicGalleryProjection` selects only the D-13 fields by name (name shown, line, pieces, upload note, stored photo ids and sizes). It checks the customer's OK, the shown date, a status other than Cancelled, the soft-delete filter (through the join to `Orders`), a shown line (the staff choice, else the auto line) and at least one photo. Uploads need to be shown, have their photo and sit on a shown line. Items come in gallery order (entry position, then entry id).
- **Gallery read.** `GET /api/v1/public/gallery`: items, pills in line display order (only lines with at least one item, count equal to the items) and the total, with a strong ETag, `no-cache`, 304 and the public rate limit. Photos carry masonry, viewer and thumb addresses plus stored width and height. Cached under `csps:public:gallery:v1`.
- **Recent work and hero tag.** The six newest shown orders by shown date (not the gallery order, uploads never) with the cover photo at the 4:5 strip sizes, and the newest as the hero tag.
- **Line flags and counts.** `hasGalleryItems` on the public lines read, `shownGalleryCount` on the Manager's list. Delete stays refused (422 `product-lines.in-use`) for a line with a gallery entry or an order that chose it, and the list no longer offers Delete for such a line.
- **Link preview.** `/gallery` now carries `og:image` (1200 x 630), width, height, alt and `summary_large_image` when a public photo exists; none otherwise. A gallery read failure sends the page without the picture and is not cached.
- **Privacy backstop.** `PublicPrivacyTests` seeds an order with distinctive customer values, a price and a photo description, then reads the five public routes and the five shells (`/`, `/products`, `/gallery`, `/contact`, an unknown path) and fails if any private value appears.
- **Image delivery.** `ForGallery` (masonry 280/400/560/800, the viewer candidates, the 88 px thumb) and `ForStrip` (4:5 strip 240 to 1060), never wider than the photo.
- **Testing seed.** Four shown demo orders (basketball twice, volleyball, moto; one with four photos) and one with the OK that is not shown, all with `PRIVATE-DEMO` customer values.
- **Contract and docs.** OpenAPI snapshot and generated web types refreshed (additive: one route and four schemas, plus description changes). `docs/api/public-site.md` documents the gallery read, Recent work, the link preview and the privacy rule.

## Task Commits

1. **Task 1 (tracer): a shown order appears in the public gallery read**
   - RED `f492305b` (test)
   - GREEN `6bfefff7` (feat)
2. **Task 2: only consented, live, photographed work is public; no leak; cached**
   - RED `d5e7b668` (test)
   - GREEN `9f0e6725` (feat)
3. **Task 3: Recent work, hero tag, line flags and counts, Gallery link preview**
   - RED `68a08789` (test)
   - GREEN `c9868e9f` (feat)
   - No REFACTOR commits: nothing needed cleaning after GREEN.
4. **Fix found by the full Server run: a public read that loses a deadlock** (deviation 4)
   - RED `a6b3aa1d` (test)
   - GREEN `b3fe6049` (fix)

**Plan metadata:** the SUMMARY commit follows this file.

## TDD Gate Compliance

RED and GREEN commits exist in order for every task. `gsd_run check tdd-red-evidence` takes TAP, JUnit, swift-testing or unittest reports; this repository's runner (xunit.v3 on Microsoft Testing Platform) writes none of them, so the classifier was not run. Each RED was read by hand against the real console output.

- **Task 1 RED** (`*PublicGalleryEndpointTests`, the matrix and coverage classes): 7 failed. Both endpoint tests failed on `response.StatusCode` `OK` expected, `NotFound` found, after the order was created, photographed and shown through the real routes (the route did not exist). The matrix row tests failed with 404 and the coverage test with "matrix row matches no endpoint". None was a compile, load or setup fault. (An earlier first run did not compile because of a nullable warning in the test; it was fixed before the RED commit.)
- **Task 2 RED**: `APostLeavesTheFourDemoShownOrdersAndTheOneNotShown...` failed with `demo.Count` 5 expected and 0 found (the seed did not exist). **Not a RED, stated plainly:** the 13 projection tests, the 300 item cache test, the three privacy tests and the gallery ETag test passed on their first run. The projection and the reader were built in Task 1 where the tracer needed them, so these tests are regression and backstop tests written in Task 2 as the plan lists them. The 300 item test passed first time: the cap does not stop the cache (see Evidence).
- **Task 3 RED**: 8 failed on the planned assertions: Recent work `[]` where six tiles were expected, `hasGalleryItems` false where true, `shownGalleryCount` 0 where 2, `CanDelete` true where false (twice), `og:image` null where the cover address was expected (twice), and the Home ETag unchanged across five writes. **Not a RED:** `GetPublicGalleryHandlerTests` (the handler existed from Task 1) and the 422 delete answer (11-23 already guards it through `GetUsageAsync`).
- **Also not a RED:** four `CloudinaryImageDeliveryTests` for `ForGallery` and `ForStrip` were written together with the Task 1 GREEN code and passed at once.
- **Deadlock fix RED** (`*PublicGalleryProjectionTests`, 2 of 16 failed). Semantic assessment: the first test failed with SQL error 1205 reaching the caller, and the second with `failing.Thrown` 1 where 3 was expected (the read was never tried again). Both failed on the planned assertion. `AnOtherErrorIsNotReadAgain` passed at once, as a guard. The fix had been written before the RED run and was taken out again with `git checkout -- <file>` so the RED could be seen on the old code; then the RED was committed, the fix put back and committed.

## Evidence (real results)

- Task 1 verify, after GREEN: `*PublicGalleryEndpointTests` + `*AuthorizationMatrixTests` + `*AuthorizationCoverageTests` + `*OpenApiSnapshotTests`: **541 passed, 0 failed**. `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." Acceptance: `GetPublicGallery` in the snapshot = 1; the projection grep for customer fields = 0.
- Task 2 verify: Infrastructure `*PublicGalleryProjectionTests` + `*PublicContentReaderTests`: **28 passed, 0 failed**. Server `*PublicPrivacyTests` + `*PublicCacheInvalidationTests` + `*TestingSiteContentTests`: **23 total, 22 passed and the one seed RED** at RED time; after GREEN `*TestingSiteContentTests` **9 of 9 passed**.
- **Cache cap note (acceptance for Task 2): the cap did not change.** `MaximumCachePayloadBytes` is still `64 * 1024`. The test with 300 shown orders and 600 photos asserts the gallery JSON is over 64 KB, and the second read still runs zero database commands and returns the same object. So the HybridCache cap did not stop an in-process entry here.
- Task 3 verify, after GREEN: Server `*PublicHomeEndpointTests` + `*ShellHeadTests` + `*ProductLineEndpointTests` + `*PublicProductLinesEndpointTests` + `*PublicGalleryLineFlagsTests` + `*PublicCacheInvalidationTests` + `*OpenApiSnapshotTests`: **115 passed, 0 failed** (the OpenAPI snapshot failed once for the changed descriptions, was regenerated, and passed). Architecture `*NoInlineSqlTests` + `*LayerTests`: **33 passed**. `dotnet format Csps.slnx --verify-no-changes`: exit 0 (run after each task). `grep -c "Take(6)"` in the reader = 1.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): **Csps.Domain line 100% (4049/4049), branch 100% (1743/1743), PASS; Csps.Application line 98% (10818/11037), PASS.** Application unit tests 2897 passed.
- Final full runs after the last code commit (`b3fe6049`): Server integration **2685 total, 2685 passed, 0 failed**; Infrastructure integration **1177 total, 1176 passed, 1 skipped (the live HIBP test), 0 failed**. Domain 1809 and Application 2897 unit tests passed in the coverage gate run (Application is unchanged since). `dotnet format Csps.slnx --verify-no-changes`: exit 0 after the last code change. Web: `npm --prefix web ci --ignore-scripts` then `npm --prefix web run typecheck`: exit 0 with no output (the only web change is the regenerated types file).
- First full Server run, before the deadlock fix (`c9868e9f`): **2685 total, 2683 passed, 2 failed.** `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` (a 500 on `GET /api/v1/public/product-lines` while the demo seed ran in the same burst) and `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` (the known upload race, owned by the debugging agent, not touched). The matrix test passed alone 3 of 3, so I reproduced it with a throwaway stress test (600 mixed calls, 16 at a time: seed POSTs against the four public reads): it met two 500s, both "Transaction was deadlocked ... chosen as the deadlock victim". After the fix the same stress passed 3 of 3 and the full run above was green, including both tests. The throwaway test was deleted and never committed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The test stub reader had to implement the new read**
- **Found during:** Task 1. `StubPublicContentReader` in `ShellTestFactory.cs` implements `IPublicContentReader`, which gained `GetGalleryAsync`. The stub gets a `Gallery`, `GalleryShareImageUrl` and `GalleryFailure` like its Home and lines parts.
- **Committed in:** `6bfefff7`

**2. [Rule 3 - Blocking] Existing tests pinned the old behaviour and were updated**
- **Found during:** Tasks 2 and 3.
- `TestingSiteContentTests.APostRemovesTheLinesWhoseShortNameStartsWithE2E...` expected no product type to be filed under a line after the seed. The seed now files the Basketball, Volleyball and Moto Riding Jersey types under their lines (the demo orders need an auto line), so it expects exactly those three, and still expects none under the removed E2E line. Committed in `9f0e6725`.
- `ShellHeadTests.OnlyTheProductsPageCarriesALinkPreviewPicture...` is renamed `WithNoPublicGalleryItemOnlyTheProductsPage...`: its claim holds only while the gallery has no public item. The new tests cover the gallery picture. Committed in `68a08789`.
- `ProductLineHandlerTests.TheListMapsEveryRow...` now builds the row with `ShownGalleryCount: 2` next to the filed count 3, so the two counts are told apart. Committed in `c9868e9f`.

**3. [Rule 1 - Bug avoided] The list's Delete button and the delete guard had to agree**
- **Found during:** Task 3. The plan fills `shownGalleryCount` with public items. The list also derived `CanDelete` from the same count, which would offer Delete for a line holding a hidden gallery entry or an order's line choice that the server refuses to delete (422). `ProductLineListRow` keeps `GalleryItemCount` (filed entries and orders that chose the line, deleted orders included, as `GetUsageAsync` counts them) and gets a separate trailing `ShownGalleryCount`. Tests: `ALineWithAGalleryEntryCannotBeDeleted...` and `ALineThatAnOrderWasFiledUnderByChoice...` (both were RED).
- **Committed in:** `c9868e9f`

### Plan files not changed, and why

- `DeleteProductLineHandler.cs`: no change needed. 11-23 already made `GetUsageAsync` count uploads and ordered line choices, so a line with a gallery entry already answers 422. The orchestrator note says 11-26 must not count them twice: `ListAsync` now uses the same two sources and nothing is counted in two places.
- `PublicHeadWriter.cs`: no change needed. It already writes the picture tags when it is given a `ShareImageUrl`; the Gallery page now supplies one from `ShellPage.cs`.
- `DependencyInjection.cs`: not changed, because the cap did not need to rise.
- `PublicProductLinesDto.cs`: not changed. `HasGalleryItems` was already in the DTO.

### Files added beyond the plan list

`tests/Csps.Testing/GallerySeeding.cs`, `PublicGalleryRig.cs`, `PublicGalleryLineFlagsTests.cs`, `GetPublicGalleryHandlerTests.cs`, `ImageSource.cs` (the new `GalleryPhotoUrls` record), `ImageCandidates.cs`, `ShellPage.cs`, `ShellTestFactory.cs`, `RateLimitTests.cs` (a row for the new route, as the orchestrator note asks), `CloudinaryImageDeliveryTests.cs`, `ContentApplicationRegistration.cs`, `docs/web/e2e.md`.

**4. [Rule 1 - Bug] The public gallery read could lose a deadlock to a staff write and answer 500**
- **Found during:** the first full Server run after Task 3 (see Evidence).
- **Issue:** the projection reads Orders, items, photos, gallery entries and lines in separate queries, the same tables a staff write (showing an order, a seed) changes. Under READ COMMITTED a reader can be picked as the deadlock victim, and a visitor then gets a 500 (the HybridCache loader throws). The Home and Products reads call the same projection.
- **Fix:** `PublicGalleryProjection.LoadAsync` reads again when the error is a deadlock victim (SQL error 1205 anywhere in the inner chain), up to three tries, then lets the error out. This is the same rule the staff ledger read uses. No isolation level or database option was changed. Tests: three in `PublicGalleryProjectionTests` (first try loses and the second answers; three losses surface the third; another error is not tried again).
- **Not done, and why:** the plain site, lines and photo queries of the other loaders have the same theoretical exposure to a writer, but the stress run showed no failure from them, so I left them alone. If one shows up, the same few lines fit there.
- **Committed in:** `a6b3aa1d` (RED), `b3fe6049` (GREEN)

**Total deviations:** 4 auto-fixed (2 blocking, 1 bug avoided, 1 bug fixed). **Impact on plan:** none on scope.

## Threat model

- **T-11-65 (customer data in public answers):** mitigated. One explicit projection; the grep criterion (0 matches); `PublicPrivacyTests` over five routes and five shells with a distinctive value for each customer field, the price, the item description and the photo description.
- **T-11-66 (unconsented or cancelled orders):** mitigated. One test for each filter: no OK, not shown, cancelled while flagged shown, soft-deleted (and back when restored), hidden effective line (and an override to a shown line), no photo, no line.
- **T-11-67 (large snapshot):** mitigated. The 300 item cached read test; the cap did not need to change.
- **T-11-SC:** no package was added or bumped.

## Threat Flags

None new. The one new public route is read only, anonymous and rate limited like its siblings, and returns the projection only.

## Known stubs

None. Tests that need a direct upload row build one through the entity's private constructor in `GallerySeeding.AddUploadAsync`; 11-28 owns `GalleryEntry.CreateUpload` and should switch the helper to it after the merge.

## Issues Encountered

- A parallel executor used the same scratchpad folder and one test output file name, so my first Task 1 verify output showed another plan's vitest lines. I moved my outputs to my own subfolder and re-ran: the numbers above are from the re-run.
- `git` commands with pipes or `&&` are refused inside the worktree sandbox, so each git call was run alone.
- I did not run the web lint, the vitest suite or the public bundle budget: the plan adds no web code, and the only web file that changed is the generated types file (additive). The typecheck above passed.

## Next Phase Readiness

- **11-27 / 11-28 / 11-29 / 11-31** can use the gallery contract as built: item `{ id, team, lineKey, lineShortName, pieces, note, placeholderArt, photos[{ src, srcSet, viewerSrc, viewerSrcSet, thumbSrc, width, height }] }`, `pills[{ key, shortName, count }]`, `total`. `PublicRecentWorkDto` kept the 11-21 shape (`team, lineKey, lineShortName, pieces, placeholderArt, photo`), so the 11-21 first guess held.
- **11-28:** `GalleryEntry.CreateUpload` is yours; the projection already reads upload entries (shown, photo id, size, team, line) and a test file proves it. Replace the reflection in `GallerySeeding.AddUploadAsync` with your factory.
- **11-29:** the Gallery page boot block stays `{ site }` only; fetch `GET /api/v1/public/gallery`. Lazy-load the page parts; this plan added no web code, so the public bundle numbers from the earlier waves are unchanged.
- **11-37:** no audit code was added; `AuditActions.All` is unchanged by this plan.
- **P11-BL-29 (restore):** the public read leaves a deleted order out by the soft-delete filter and brings it back on restore. The projection test sets and clears the delete mark directly, so it holds under either owner ruling.
- E2E specs: the demo orders (O-2) and the `PRIVATE-DEMO` marker are in `docs/web/e2e.md`.

## Self-Check

PASSED. The ten key files listed under key-files.created exist on disk. The eight commits `f492305b`, `6bfefff7`, `d5e7b668`, `9f0e6725`, `68a08789`, `c9868e9f`, `a6b3aa1d` and `b3fe6049` are all on HEAD (`git rev-list` from the base lists exactly these eight, linear history). The working tree held nothing uncommitted except this file. The throwaway stress test was deleted and was never committed. STATE.md and ROADMAP.md were not touched. `gitleaks protect --staged` found no leaks before each of the eight commits, and every customer value in the tests and the demo seed is made up (`PRIVATE-...`, `0917 999 000x`, `private...@csps.test`).

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12*
