---
phase: 11-public-site-content-management
plan: 23
subsystem: orders-public-website
tags: [orders, consent, gallery, privacy, audit, ef-migration, authorization]
created: 2026-11-12T14:30:00-06:00
updated: 2026-11-12T15:40:00-06:00

requires:
  - phase: 11-public-site-content-management
    provides: "11-15 product lines and ProductTypes.ProductLineId, 11-07 IPublicContentRecord and the invalidation interceptor, 11-21 audit count 120"
provides:
  - "PUT /api/v1/orders/{orderId}/public for Admin and Manager: the customer's recorded OK, show and take off, line choice, name shown"
  - "publicWebsite block in every order detail answer"
  - "GalleryEntry and the GalleryEntries table (one manual order for shown orders and, later, uploads)"
  - "OrderPublicFiling: pieces and the auto line"
  - "Five audit codes (catalog 125)"
  - "Cancel takes a shown order off the website (entry removed, order.taken-off-website written); every write to a shown order clears the public cache"
  - "GET /api/v1/product-lines/options for Admin and Manager"
affects: [11-26, 11-27, 11-28, 11-37]

actuals:
  tokens: 101500
  tasks: 3
  commits: 24

# commits is the measured git rev-list count from plan_head_before to plan_head_after. It includes 16 commits that other wave-10
# plans merged onto this branch in between. The plan's own commits up to plan_head_after are 8: 7 test, feature and refactor
# commits and the first SUMMARY. The final SUMMARY commit comes after plan_head_after.
plan_head_before: 5ab9eb50ddfe92da4a3d734afb56329742d3ea73
plan_head_after: b19cce8aafe47f3f55326d1416a944016b11dcae

tech-stack:
  added: []
  patterns:
    - "Public settings skip the Completed edit lock but refuse Cancelled; consent stamps come from the token and the clock only"
    - "One site-content lock transaction for a write that files a record under a product line, so a line delete is decided before or after it"
    - "Forward-only migration (Down throws NotSupportedException)"

key-files:
  created:
    - src/Csps.Domain/Orders/OrderPublicSettings.cs
    - src/Csps.Domain/Orders/OrderPublicFiling.cs
    - src/Csps.Domain/Content/GalleryEntry.cs
    - src/Csps.Application/Ports/IGalleryEntries.cs
    - src/Csps.Application/Orders/SetOrderPublicSettingsRequest.cs
    - src/Csps.Application/Orders/SetOrderPublicSettingsRequestValidator.cs
    - src/Csps.Application/Orders/SetOrderPublicSettingsHandler.cs
    - src/Csps.Infrastructure/Content/GalleryEntries.cs
    - src/Csps.Infrastructure/Persistence/Configurations/GalleryEntryConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261112192017_AddOrderPublicSettings.cs
    - src/Csps.Server/Controllers/OrderPublicSettingsController.cs
    - src/Csps.Server/Controllers/ProductLineOptionsController.cs
    - src/Csps.Application/Content/ListProductLineOptionsHandler.cs
    - src/Csps.Application/Content/ProductLineOptionDto.cs
    - tests/Csps.Server.IntegrationTests/Content/ProductLineOptionsEndpointTests.cs
    - tests/Csps.Application.UnitTests/Content/ListProductLineOptionsHandlerTests.cs
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Orders/OrderDetailResponse.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Application/Orders/ChangeOrderStatusHandler.cs
    - src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - src/Csps.Infrastructure/Content/ProductLines.cs
    - src/Csps.Infrastructure/Content/PublicContentInvalidationInterceptor.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs
    - src/Csps.Server/Composition/ContentApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md
    - docs/api/site-content.md

key-decisions:
  - "Name shown is required only when the order is being shown (an order with no team may record the OK first); open for the owner, see Open items"
  - "A Cancelled order refuses every public settings save, including removing the OK; open for the owner, see Open items"
  - "Orders that chose a line (and upload entries) count as gallery items in ProductLines.GetUsageAsync, so a line they use answers 422 product-lines.in-use instead of a database error"
  - "GalleryEntry order entries hold only the order id; the upload fields stay null (CK_GalleryEntries_Kind), and an upload must have a photo id, team and line and no order"
  - "Delete (soft) changes no stored website setting and keeps the gallery entry; the order leaves the public site by the cache clear and, for the public read 11-26 builds, by the Orders soft-delete filter. Restore keeps the settings as they were (today's behaviour, owner ruling P11-BL-29 pending)"
  - "The line options route has its own controller, because ProductLinesController is Manager only at class level and a method-level Staff policy would be ANDed with it"

patterns-established:
  - "Interim guard on the line delete: the usage read counts order overrides, deleted orders included"

requirements-completed: []
requirements-partial: [GAL-03, CONT-03, PUB-03]

coverage:
  - id: D1
    description: "Admin and Manager record the customer's OK and show a Completed order; the detail answers publicWebsite and the gallery entry sits at the top"
    requirement: GAL-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs#AnAdminTicksTheOkAndShowsACompletedOrderAndTheDetailAndTheGalleryRecordIt"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs#AnOrderShownLaterJoinsTheGalleryAboveTheOneShownBefore"
        status: pass
    human_judgment: false
  - id: D2
    description: "Show needs the recorded OK; a Cancelled order is refused; the name and line rules; consent who and when are never taken from the client"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderPublicSettingsTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs#AConsentTimeAndPersonSentByTheClientAreIgnored"
        status: pass
    human_judgment: false
  - id: D3
    description: "Five audit codes name the order and never the customer"
    requirement: GAL-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs#EachChangeWritesItsAuditEntryNamingTheOrderAndNeverTheCustomer"
        status: pass
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs#TheOrderPublicWebsiteCodesAreInTheCatalog"
        status: pass
    human_judgment: false
  - id: D4
    description: "AddOrderPublicSettings migration: five nullable columns, GalleryEntries with CHECKs and a filtered unique index, no trigger, forward only"
    requirement: GAL-03
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderPublicSettingsMigrationTests.cs"
        status: pass
    human_judgment: false
  - id: D5
    description: "Cancelling a shown order takes it off the website, removes its gallery entry, keeps the OK and writes order.taken-off-website; a reopen does not put it back"
    requirement: GAL-03
    verification:
      - kind: unit
        ref: "tests/Csps.Domain.UnitTests/Orders/OrderPublicSettingsTests.cs#CancellingAShownOrderTurnsShowingOffAndKeepsTheOk"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/ChangeOrderStatusHandlerTests.cs#CancellingAShownOrderRemovesItsGalleryEntryAndRecordsTheTakenOffEntryAfterTheStatusEntryInOneSave"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs#CancellingAShownOrderTakesItOffTheWebsiteRemovesItsEntryKeepsTheOkAndAReopenDoesNotPutItBack"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every write to a shown order (settings, items, team name, photos, cover, cancel, delete, restore, permanent delete) clears the public cache; the same writes on a never-shown order do not"
    requirement: PUB-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs#EveryWriteToAShownOrderClearsThePublicCache"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/PublicCacheInvalidationTests.cs#TheSameWritesToAnOrderThatWasNeverShownDoNotClearThePublicCache"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderDeletionHandlerTests.cs#PermanentAShownOrderClearsThePublicCacheOnceAfterTheSave"
        status: pass
    human_judgment: false
  - id: D7
    description: "GET /api/v1/product-lines/options lists the active lines in display order for Admin and Manager; anonymous 401"
    requirement: CONT-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Content/ProductLineOptionsEndpointTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs#GET /api/v1/product-lines/options"
        status: pass
    human_judgment: false
  - id: D8
    description: "What a restore does to a deleted order's website settings (owner ruling P11-BL-29)"
    requirement: GAL-03
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderPublicSettingsEndpointTests.cs#DeletingAShownOrderChangesNoStoredSettingAndARestoreKeepsTheWebsiteSettingsAsTheyWereP11BL29"
        status: pass
    human_judgment: true
    rationale: "The test pins today's behaviour only. Whether a restore should put a shown order back on the website is the owner's call, parked as P11-BL-29."

duration: 100min
completed: 2026-11-12
status: complete
---

# Phase 11 Plan 23: Staff record the customer's OK and show an order on the website, safely Summary

**Admin and Manager can record the customer's OK and show or take off an order (Completed included) through PUT /api/v1/orders/{id}/public; the OK's who and when come only from the token and the clock, a shown order joins the gallery at the top, every change is audited without customer data, a cancel takes a shown order off the website at once, every write to a shown order clears the public cache, and the order window can list the product lines. One owner ruling is still open: what a restore of a deleted order does to the website (P11-BL-29).**

## Status: complete, except the parked restore ruling

All three tasks are done and committed. Tasks 1 and 2 ran in the first run. Task 3 ran in a continuation run, with the restore question left unanswered: it is parked for the owner as P11-BL-29 in `.planning/phases/999.7-owner-items-parked-during-phase-11-execution/DECISIONS.md`. Task 3 built every part that rests on rulings already made (D-15, D-41, PUB-03) and did not decide or add any rule about restore.

## Open items (owner)

### O-1 (parked as P11-BL-29): what does restoring a deleted order do to the website?

Context: D-15 says deleting an order takes it off the website at once. No ruling says what a Manager's restore does. Today a delete changes no stored setting, so a restore brings a shown order back on the website exactly as it was.

- **A (recommended):** deleting also turns "Show on the website" off (the customer's OK stays), so a restore never puts the order back by itself. This is the same as cancelling (D-41). Reason: nothing goes public without a deliberate step, and the Data Privacy Act reasoning behind D-11 points the same way.
- **B:** a restore brings the order back on the website exactly as it was (today's behaviour).

What a ruling of A changes, so it is cheap to apply later: only the delete side. `Order.SoftDelete` (or `DeleteOrderHandler`) would also clear `ShownOnWebsiteSinceUtc` and remove the gallery entry, with an `order.taken-off-website` entry. Restore needs no change. Two tests would change with it: `DeletingAShownOrderChangesNoWebsiteSettingAndARestoreKeepsThemAsTheyWereP11BL29` (Domain) and `DeletingAShownOrderChangesNoStoredSettingAndARestoreKeepsTheWebsiteSettingsAsTheyWereP11BL29` (Server). A ruling of B needs no code change. Search the code and tests for `P11BL29` to find the pins.

### O-2 (parked as P11-BL-30, kept as built): name shown on an order with no team

The plan says the name is "required when the order has no team". I made it required only when the order is being shown, so staff can record the customer's OK on a team-less order first and add the name at show time. The other reading is "always required". Say if you want that. The web form (11-27) and its zod rule should follow whichever is chosen.

### O-3 (parked as P11-BL-31, kept as built): a Cancelled order and the customer's OK

The plan says `SetPublicSettings` "refuses Cancelled". I refuse every public settings save on a Cancelled order, including removing the customer's OK. The UI offers no Edit there (UI-SPEC O1). Recommendation: allow removing the OK on a Cancelled order (a customer can change their mind), and keep refusing to show. That is a small change in `Order.SetPublicSettings`; say if you want it.

## Task 3 (continuation run)

Built, from rulings already made:

1. **Cancel (D-41).** `Order.ChangeStatus` clears `ShownOnWebsiteSinceUtc` on a move to Cancelled and keeps the OK. `ChangeOrderStatusHandler` (new `IGalleryEntries` parameter) removes the gallery entry in the same save and adds `order.taken-off-website` after the `order.status-changed` entry. A reopen leaves the order off. A cancel of an order that was not shown touches no gallery entry and writes no extra audit entry.
2. **Delete (D-15).** Unchanged in code on purpose: a soft delete changes no stored setting and keeps the gallery entry, and the order leaves the public site through the cache clear below and, for the public read 11-26 builds, through the Orders soft-delete query filter (see "Next Phase Readiness"). **Restore is not touched** (P11-BL-29).
3. **Interceptor rule.** `PublicContentInvalidationInterceptor` also marks a pending clear when an `Order` entry is added, modified or deleted and its current or original `ShownOnWebsiteSinceUtc` is set. That one rule covers a public settings save, a status move, an item add, edit and delete, a team name change, a photo add, remove and cover change, delete, restore and permanent delete. An order that was never shown does not trigger it.
4. **Explicit clear after permanent delete.** `PermanentlyDeleteOrderHandler` (new `IPublicContentCache` parameter) clears the cache after the commit when the order was shown. It does nothing for an order that was never shown or when the delete was refused.
5. **Line options.** `ListProductLineOptionsHandler` and `GET /api/v1/product-lines/options` (`ListProductLineOptions`, Staff policy): `{ id, title, shortName }` for the active lines in display order. Matrix row 401 / 200 / 200.
6. **Contract and docs.** OpenAPI snapshot and generated web types refreshed (additive: one route, one schema). `docs/api/orders.md` has a new "When a shown order leaves the website" table and the line options route; `docs/api/site-content.md` lists the new route.

### Restore ruling applied

**None. Restore behaviour is exactly as it was before this run (a restored order keeps its stored website settings).** Test that pins today's behaviour so it is easy to find: `OrderPublicSettingsEndpointTests.DeletingAShownOrderChangesNoStoredSettingAndARestoreKeepsTheWebsiteSettingsAsTheyWereP11BL29` (Server) and `OrderPublicSettingsTests.DeletingAShownOrderChangesNoWebsiteSettingAndARestoreKeepsThemAsTheyWereP11BL29` (Domain). A ruling of A changes only the delete side (it would also clear the shown flag and remove the gallery entry) plus those two tests; see O-1.

## Performance

- **Duration:** about 100 min
- **Started:** 2026-11-12T19:09Z (approximate; not recorded at the start)
- **Completed:** 2026-11-12T20:40Z
- **Tasks:** 3 of 3 (Task 3 in a continuation run of about 45 min, 2026-11-12 from about 14:45 to 15:45 -06:00)
- **Files:** Tasks 1 and 2: 51 changed (6,775 insertions, 10 deletions; 3,535 of those lines are the migration designer file, 140 the snapshot and 140 the migration). Task 3: 20 changed (897 insertions, 21 deletions), including the two generated contract files.

## Accomplishments

- `PUT /api/v1/orders/{orderId}/public` under `Policies.Staff`; anonymous 401; matrix row 401/400/400 holds.
- Domain: `Order.SetPublicSettings` (skips the Completed lock, refuses Cancelled), `OrderPublicSettings` with the exact UI-SPEC messages, `OrderPublicFiling.Pieces` and `AutoLine`, `GalleryEntry.ForOrder`.
- The order detail answers `publicWebsite { customerConsent, consentRecordedAtUtc, consentRecordedByName, shownOnWebsite, shownSinceUtc, productLineId, productLineTitle, autoProductLineId, publicName, pieces, hasPhoto, canShow }`.
- Five audit codes: `order.public-consent-recorded`, `order.public-consent-removed`, `order.shown-on-website`, `order.taken-off-website`, `order.public-details-changed`. `AuditActions.All` is 125.
- Migration `20261112192017_AddOrderPublicSettings` (forward only).
- OpenAPI snapshot and generated web types refreshed (additive only).
- Task 3: cancel takes a shown order off the website; the public cache clears on every write to a shown order; `GET /api/v1/product-lines/options` for both roles (matrix row 401/200/200); the 13-step cache matrix test; docs.

## Task Commits

1. **Task 1 (tracer): the OK, show, detail and gallery entry**
   - RED `c478f6e7` (test): 5 endpoint tests plus the matrix row
   - GREEN `622a4d8a` (feat)
2. **Task 2: every rule, the auto line and the audit entries**
   - RED `8387b6ed` (test)
   - GREEN `7c72a48d` (feat)
   - REFACTOR `664b0547` (refactor, coverage)
3. **Task 3: cancel, delete and every write to a shown order take effect publicly at once, and the window gets its line options** (continuation run)
   - RED `18d80fb1` (test)
   - GREEN `b19cce8a` (feat)
   - No REFACTOR commit: the code needed no cleanup after GREEN.

**Plan metadata:** the SUMMARY commits follow this file (the first one `e5a430a4`, the final one with the Task 3 section).

## TDD Gate Compliance

RED and GREEN commits exist in order for Tasks 1, 2 and 3. `gsd_run check tdd-red-evidence` takes a JSON record of a TAP, JUnit, swift-testing or unittest report; this repository's runner (xunit.v3 on Microsoft Testing Platform) writes none of those formats here, so the classifier was not run. Each RED was instead inspected by hand against the real console output (kept in the session scratchpad):

- **Task 1 RED** (`*OrderPublicSettingsEndpointTests`, 5 of 5 failed). Semantic assessment: each failed on the planned assertion. The PUT answered `404` where `200` or `401` was expected (the route did not exist), and the fresh-order test failed with `KeyNotFoundException` reading `publicWebsite` from the detail. None was a compile, load or fixture fault.
- **Task 2 RED** (Domain: 13 of 140 failed; Server: 5 of 14 failed). Semantic assessment: the Domain failures were the missing refusals (show without OK, Cancelled, name rules, no line, all-fields-together) and the catalog count and codes (120 instead of 125). The Server failures were `200` where `400` or `422` was expected, the audit list holding only `order.created` and `order.status-changed`, and a line delete answering `500` where `422` was expected (the foreign key from Orders to ProductLines had no guard). 
- **Not a RED, stated plainly:** `OrderPublicFilingTests` (8) and the migration tests (8) passed on their first run, because the filing function and the migration were built in Task 1 where the tracer needed them. They are regression tests for Task 1 code, written in Task 2 as the plan lists them. One migration test had a bug of mine (it forbade every `INSERT INTO`, which the migration history row needs) and was fixed before the RED commit.
- The handler unit tests (`SetOrderPublicSettingsHandlerTests`, 17) were written after the handler, for the Application coverage gate.
- **Task 3 RED** (Domain: 2 of 27 failed; Server run of the Task 3 classes: 11 of 556 failed, then 5 of 14 in a re-run of the cache and options classes after one test fix). Semantic assessment: the Domain failures were `order.IsShownOnWebsite` still true after a cancel (and after cancel then reopen). The Server failures were the cancel test seeing `shownOnWebsite` still true, the shown-order cache test seeing 13 of 13 writes clear nothing (the rig itself was proven live: showing the order in setup made the counter move, asserted in the test), the options route answering `404` where `200` or `401` was expected, and the matrix rows and the endpoint coverage check failing because the matrix named a route that did not exist. One RED test had a bug of mine (it expected `200` from the hide route, which answers `204`); it was fixed before the RED commit and the re-run still failed on the planned assertion.
- **Not a RED, stated plainly (Task 3):** `CancellingAnOrderThatWasNeverShownKeepsItsOkAndStaysOff`, `DeletingAShownOrderChangesNoWebsiteSettingAndARestoreKeepsThemAsTheyWereP11BL29` (Domain), `DeletingAShownOrderChangesNoStoredSettingAndARestoreKeepsTheWebsiteSettingsAsTheyWereP11BL29`, `CancellingAnOrderThatWasNotShownWritesNoTakenOffEntry` and `TheSameWritesToAnOrderThatWasNeverShownDoNotClearThePublicCache` passed on their first run. They pin behaviour that already holds (today's delete and restore, the never-shown negatives). The handler unit tests (`ChangeOrderStatusHandlerTests` 4 new, `OrderDeletionHandlerTests` 3 new, `ListProductLineOptionsHandlerTests` 2) were written after the handlers, for the Application coverage gate, because a new constructor parameter breaks compilation of the existing tests.
- `gsd_run check tdd-red-evidence` was not run for Task 3, for the same reason as Tasks 1 and 2 (xunit.v3 on Microsoft Testing Platform writes none of the supported report formats).

## Migration (real name `20261112192017_AddOrderPublicSettings`)

Up (key statements; the full file is in the commit):

```
AddColumn Orders.PublicConsentAtUtc      datetimeoffset NULL
AddColumn Orders.PublicConsentById       uniqueidentifier NULL   (FK to AspNetUsers, no action)
AddColumn Orders.ShownOnWebsiteSinceUtc  datetimeoffset NULL
AddColumn Orders.PublicProductLineId     uniqueidentifier NULL   (FK to ProductLines, Restrict)
AddColumn Orders.PublicName              nvarchar(80) NULL
CreateTable GalleryEntries (Id, Kind varchar(10), OrderId NULL, Position, PublicId, Width, Height, Bytes, Format,
  TeamName, ProductLineId NULL, Pieces NULL, Note, IsShown, stamps, RowVersion)
  CK_GalleryEntries_Kind   ([Kind] = 'Order' AND [OrderId] IS NOT NULL) OR ([Kind] = 'Upload' AND [OrderId] IS NULL
                           AND [PublicId] IS NOT NULL AND [TeamName] IS NOT NULL AND [ProductLineId] IS NOT NULL)
  CK_GalleryEntries_Pieces [Pieces] IS NULL OR [Pieces] BETWEEN 1 AND 9999
  FK to Orders (Cascade), FK to ProductLines (Restrict)
Indexes: IX_Orders_PublicConsentById, IX_Orders_PublicProductLineId, IX_GalleryEntries_Position (Position, Id),
         IX_GalleryEntries_ProductLineId, UX_GalleryEntries_OrderId (unique, filtered OrderId IS NOT NULL)
```

No default sets consent or showing on any existing order, no drop, rename or type change, no trigger, no JSON column, no inserted row. Down:

```csharp
// Forward only. Undoing this migration would drop the customer consent record and the gallery entries.
// A drop is a one-way door: it needs the owner's approval and its own reviewed migration.
throw new NotSupportedException(
    "AddOrderPublicSettings is forward-only. Undoing it would delete the customer consent record and the gallery entries.");
```

The generated Down dropped columns and the table; it was replaced with the throw, as the 11-04 note (P11-BL-01 pattern) asks. This is parked for the owner with the earlier forward-only migrations.

## Evidence (real results)

- Task 1 verify, after GREEN: `*OrderPublicSettingsEndpointTests` + `*AuthorizationMatrixTests` + `*AuthorizationCoverageTests` + `*OpenApiSnapshotTests`: **538 passed, 0 failed**. `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- Task 2 verify, after GREEN: Domain `*OrderPublicSettingsTests` + `*OrderPublicFilingTests` + `*AuditActionsTests` inside the full Domain run **1801 passed**; Infrastructure `*OrderPublicSettingsMigrationTests` + `*TriggerInventoryTests` + `*MigrationScriptTests` **16 passed**; Server `*OrderPublicSettingsEndpointTests` **14 passed**.
- Acceptance greps: `ShouldBe(125)` in AuditActionsTests = 1; the Cancelled message in OrderPublicSettings.cs = 1; `Policies.Staff` in the controller = 1; `SetOrderPublicSettings` in the OpenAPI snapshot = 5; no `ConsentAt`/`ConsentBy` in the request file = 0.
- Coverage gate (`tools/scripts/Invoke-CoverageGate.ps1`): **Csps.Domain line 100% (4045/4045), branch 100% (1741/1741), PASS; Csps.Application line 98% (10780/10990), PASS.**
- `dotnet format Csps.slnx --verify-no-changes`: exit 0. `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- Application unit tests 2886 passed; Architecture tests 290 passed.
- Web: `npm --prefix web run typecheck` clean after the fixture change; eslint and prettier clean on the changed fixture; the OrderHeader, OrderTabs and DeletedOrderPage tests pass (62).
- Final full runs, after the last code commit (`664b0547`): Server integration **2652 total, 2651 passed, 1 failed** (the failure is the flake below); Infrastructure integration **1156 total, 1155 passed, 1 skipped (the live HIBP test), 0 failed**; Domain 1801 and Application 2886 passed in the coverage gate run.

### Task 3 evidence (after GREEN `b19cce8a`)

- Server classes `*PublicCacheInvalidationTests`, `*OrderPublicSettingsEndpointTests`, `*ProductLineOptionsEndpointTests`, `*AuthorizationMatrixTests`, `*AuthorizationCoverageTests`, `*OpenApiSnapshotTests`: **567 total, 566 passed, 1 failed**. The one failure was the OpenAPI snapshot, as expected for a new route. The snapshot was regenerated (`CSPS_WRITE_OPENAPI_SNAPSHOT=1`, one process only), then `npm --prefix tools/openapi-gen ci --ignore-scripts` and `npm --prefix tools/openapi-gen run generate`. `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The diff is additive (one path, one schema, one tag).
- The invalidation matrix: the 13 writes (the 12 the plan lists, plus a second photo add so a cover change has two photos) each clear the cache on a shown order, and none clears it on an order that was never shown. Both tests pass.
- Domain `*OrderPublicSettingsTests`: 27 passed. Application `*ChangeOrderStatusHandlerTests` + `*OrderDeletionHandlerTests` + `*ListProductLineOptionsHandlerTests`: 49 passed.
- Architecture tests (all): **290 passed, 0 failed** (includes `NoInlineSqlTests` and `LayerTests`). `dotnet format Csps.slnx --verify-no-changes`: exit 0. `dotnet build Csps.slnx`: 0 warnings, 0 errors.
- Coverage gate: **Csps.Domain line 100% (4049/4049), branch 100% (1743/1743), PASS; Csps.Application line 98% (10813/11023), PASS.** Domain 1809 and Application 2895 unit tests passed.
- Final full runs after GREEN: Server integration **2664 total, 2663 passed, 1 failed**: `OpeningHoursEndpointTests.StampFieldsSentByTheClientAreIgnoredAndTheServerStampsTheManagerAndTheClock`, the known order-dependent flake owned by 11-11 (see Known flakes). Infrastructure integration **1156 total, 1155 passed, 1 skipped (the live HIBP test), 0 failed**.
- Acceptance greps: `ShownOnWebsiteSinceUtc` in the interceptor = 1; `ListProductLineOptions` in the OpenAPI snapshot = 1.
- The web side was not run in this continuation: the only web change is the additive generated types file (one new schema and one new path), and the plan has no web task.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A line that an order or an upload is filed under could be deleted into a database error**
- **Found during:** Task 2 (the new `Orders.PublicProductLineId` and `GalleryEntries.ProductLineId` Restrict foreign keys)
- **Issue:** `ProductLines.GetUsageAsync` only counted photos and product types, so deleting such a line answered 500.
- **Fix:** it now counts the upload entries and the orders (deleted ones included) as gallery items, so the delete answers 422 `product-lines.in-use`. `SetOrderPublicSettingsHandler` takes the site-content lock first, as the line delete does. Test: `ALineAnOrderIsFiledUnderCannotBeDeletedUntilTheOrderLetsGo` (RED was a 500).
- **Files modified:** src/Csps.Infrastructure/Content/ProductLines.cs
- **Committed in:** `7c72a48d`
- **Note for 11-26:** `GalleryItemCount` in `GetUsageAsync` is already filled (uploads plus orders). `ListAsync`'s `GalleryItemCount` is still 0; 11-26 should fill it and not count orders twice.

**2. [Rule 3 - Blocking] Existing tests pinned the old shape and had to change**
- **Found during:** Task 1 (full Infrastructure and Server runs)
- **Issue:** four Infrastructure tests broke by design: `TestimonialsMigrationTests` generated its script to the latest migration (now scoped with `toMigration`), `OrderReaderDetailSnapshotTests` counted 9 commands (now 10, the lines read), `OrdersMigrationTests` counted three Orders foreign keys (now five) and `OrderListIndexesMigrationTests` listed the Orders indexes (two more). Twelve Application test files and the web `orderFixtures.ts` build an `OrderDetailResponse`, which gained `PublicWebsite`.
- **Fix:** updated each to the new shape. No behavior was weakened.
- **Committed in:** `622a4d8a`

**3. [Rule 3 - Blocking] A test file name would clash with 11-28**
- 11-28 lists `tests/Csps.Domain.UnitTests/Content/GalleryEntryTests.cs`. Mine is `GalleryEntryOrderTests.cs` so the two merge without an add/add conflict.

**4. [Rule 3 - Blocking] The line options route has its own controller**
- **Found during:** Task 3
- **Issue:** the plan puts the action in `ProductLinesController`, but that controller has `[Authorize(Policy = Policies.Manager)]` at class level. ASP.NET Core combines a class policy and an action policy with AND, so a `Staff` policy on the action would still refuse an Admin.
- **Fix:** `ProductLineOptionsController` at `api/v1/product-lines/options` with `Policies.Staff`, endpoint name `ListProductLineOptions` as the plan asks. The literal `options` segment wins over `{id:guid}`. The authorization-matrix row is 401 / 200 / 200 as planned, and the endpoint coverage test passes.
- **Files:** src/Csps.Server/Controllers/ProductLineOptionsController.cs (the plan listed ProductLinesController.cs, which is unchanged)
- **Committed in:** `b19cce8a`

**5. [Rule 3 - Blocking] Existing unit tests had to take the new constructor parameters**
- **Found during:** Task 3. `ChangeOrderStatusHandler` takes `IGalleryEntries` and `PermanentlyDeleteOrderHandler` takes `IPublicContentCache`, so `ChangeOrderStatusHandlerTests` and `OrderDeletionHandlerTests` build them with the new arguments. No existing assertion was weakened.
- **Committed in:** `b19cce8a`

**Total deviations:** 5 (1 bug, 4 blocking). **Impact on plan:** none on scope; the bug fix is needed for correctness of the new foreign keys.

## Known flakes (recorded, not hidden)

- `OrderListTimingTests.TheListAnswersUnder300MsAtP95OnFiveYearsOfOrders` failed once in the first full Server run while `dotnet format` and a vitest run were using the machine at the same time. Run alone it passed (1 of 1). It is load sensitive.
- `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` failed once in the second full Server run: one of the two concurrent uploads answered 500 where 409 or 422 was expected. It passed in the first full run, and the whole `OrderImagesEndpointTests` class passed 3 times in a row on its own afterwards (20 of 20 each time). Nothing in this plan touches the upload path, but I could not prove the race is older than this plan: the plan's changes to Orders (new nullable columns and two foreign keys) are the only change in that table's locking. If it shows again in a gate, check it first on a checkout from before this plan.

- `OpeningHoursEndpointTests.StampFieldsSentByTheClientAreIgnoredAndTheServerStampsTheManagerAndTheClock` failed in the full Server run after Task 3 and again when its whole class ran (1 of 9), and passed alone (1 of 1). This is the known order-dependent flake owned by 11-11 (an earlier test in the class leaves Tuesday open, so the closed-week setup stamps it). Nothing in this plan touches opening hours, so it was left alone as out of scope and is recorded here, not fixed.

## Authentication Gates

None.

## Issues Encountered

- The first full Server run took about 25 minutes; runs after the last commit were done with nothing else running.
- No stub was left in the code written here. Known Stubs: none.

## Threat Flags

None new. T-11-57 and T-11-58 are covered by tests (show needs the recorded OK; client-sent consent fields are ignored). T-11-59 holds (Staff policy, anonymous 401). T-11-60 (stale public data after cancel or delete) is now mitigated by Task 3: the interceptor rule for shown orders plus the explicit clear after a permanent delete, proved by the 13-write invalidation matrix. The restore side of T-11-60 depends on the parked ruling (P11-BL-29): today a restored order that was shown is public again at once, on the stored settings.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 11-26 can read `GalleryEntries` joined to `Orders`, `OrderPublicFiling` and `Order.PublicProductLineId`. The `Kind` column is the text `Order` or `Upload`.
- **11-26 (MUST):** a soft-deleted order keeps its stored `ShownOnWebsiteSinceUtc` and its `GalleryEntries` row (D-15 is met by the public read, not by clearing the flag). The public gallery read must go through the `Orders` soft-delete query filter (or filter `DeletedAtUtc == null` when it uses `IgnoreQueryFilters`), must require `ShownOnWebsiteSinceUtc != null`, and a Cancelled order always has it cleared. Add a test that a deleted shown order is absent from the public gallery and returns when restored (the restore half follows P11-BL-29).
- 11-27 can use the `publicWebsite` block and the line options route `GET /api/v1/product-lines/options` (Admin and Manager, `{ id, title, shortName }` for active lines only). An order already filed under a line that was hidden later still carries its `productLineId` and `productLineTitle` in the block; the window must show that current choice even when the options list lacks it.
- 11-37: also label `order.taken-off-website` when it follows `order.status-changed` (cancel): its detail is `number=ORD-...` like the other flag codes.
- 11-28 owns `GalleryEntry.CreateUpload`; the entity already has its columns. The upload CHECK needs a photo id, a team and a line and no order.
- 11-37: label the five codes. Details: `number=ORD-...` for the four flag codes; `number=ORD-...;fields=line,name` for details-changed.
- The plan is `status: complete`, so its dependents can run. Only P11-BL-29 (restore) is open; a ruling of A changes the delete side and the two `P11BL29` tests only (see O-1).

## Self-Check

PASSED. The key files listed above exist on disk (the 16 of Tasks 1 and 2 and the 5 new ones of Task 3 were checked). The commits `c478f6e7`, `622a4d8a`, `8387b6ed`, `7c72a48d`, `664b0547`, `e5a430a4`, `18d80fb1` and `b19cce8a` are all ancestors of HEAD. The working tree held nothing uncommitted except this file. STATE.md and ROADMAP.md were not touched. All three tasks are done; the one open owner item is the parked restore ruling (P11-BL-29), which the plan was told to leave as it is.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12 (Tasks 1 and 2 in the first run, Task 3 in the continuation run; restore ruling parked)*
