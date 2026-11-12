---
phase: 11-public-site-content-management
plan: 23
subsystem: orders-public-website
tags: [orders, consent, gallery, privacy, audit, ef-migration, authorization]
created: 2026-11-12T14:30:00-06:00
updated: 2026-11-12T14:30:00-06:00

requires:
  - phase: 11-public-site-content-management
    provides: "11-15 product lines and ProductTypes.ProductLineId, 11-07 IPublicContentRecord and the invalidation interceptor, 11-21 audit count 120"
provides:
  - "PUT /api/v1/orders/{orderId}/public for Admin and Manager: the customer's recorded OK, show and take off, line choice, name shown"
  - "publicWebsite block in every order detail answer"
  - "GalleryEntry and the GalleryEntries table (one manual order for shown orders and, later, uploads)"
  - "OrderPublicFiling: pieces and the auto line"
  - "Five audit codes (catalog 125)"
affects: [11-26, 11-27, 11-28, 11-37]

actuals:
  tokens: 86200
  tasks: 2
  commits: 5

plan_head_before: 5ab9eb50ddfe92da4a3d734afb56329742d3ea73
plan_head_after: 664b0547293e9f482fd8d2883a4a502f39a8a6db

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
  modified:
    - src/Csps.Domain/Orders/Order.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Orders/OrderDetailResponse.cs
    - src/Csps.Application/Orders/OrderAuditDetail.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - src/Csps.Infrastructure/Content/ProductLines.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md

key-decisions:
  - "Name shown is required only when the order is being shown (an order with no team may record the OK first); open for the owner, see Open items"
  - "A Cancelled order refuses every public settings save, including removing the OK; open for the owner, see Open items"
  - "Orders that chose a line (and upload entries) count as gallery items in ProductLines.GetUsageAsync, so a line they use answers 422 product-lines.in-use instead of a database error"
  - "GalleryEntry order entries hold only the order id; the upload fields stay null (CK_GalleryEntries_Kind), and an upload must have a photo id, team and line and no order"

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
    description: "Cancel, delete, restore, permanent delete and every write to a shown order clear the public cache at once; the window's line options (Task 3)"
    requirement: PUB-03
    verification: []
    human_judgment: true
    rationale: "Task 3 did not run: its precondition (an owner ruling on restoring a deleted order) is not in 11-CONTEXT.md. See Open items."

duration: 100min
completed: 2026-11-12
status: halted
---

# Phase 11 Plan 23: Staff record the customer's OK and show an order on the website, safely Summary

**Admin and Manager can record the customer's OK and show or take off an order (Completed included) through PUT /api/v1/orders/{id}/public; the OK's who and when come only from the token and the clock, a shown order joins the gallery at the top, every change is audited without customer data, and the plan stops before Task 3 because the restore-of-a-deleted-order ruling is missing.**

## Status: halted at Task 3 (owner decision needed)

Tasks 1 and 2 are done and committed. Task 3 carries a `<precondition>`: 11-CONTEXT.md must record an owner ruling on restoring a deleted order. D-120 to D-124 and earlier hold none (searched "restor" in 11-CONTEXT.md: no match). The rule for an unmet precondition is to stop before writing code and return a `checkpoint:decision`. Nothing of Task 3 was started or partly committed.

## Open items (owner)

### O-1 (blocks Task 3): what does restoring a deleted order do to the website?

Context: D-15 says deleting an order takes it off the website at once. No ruling says what a Manager's restore does.

- **A (recommended):** deleting also turns "Show on the website" off (the customer's OK stays), so a restore never puts the order back by itself. This is the same as cancelling (D-41). Reason: nothing goes public without a deliberate step, and the Data Privacy Act reasoning behind D-11 points the same way.
- **B:** a restore brings the order back on the website exactly as it was.

When the owner rules, record it as a dated D-number in 11-CONTEXT.md, then run the continuation of this plan (Task 3 only).

### O-2 (interpretation, does not block): name shown on an order with no team

The plan says the name is "required when the order has no team". I made it required only when the order is being shown, so staff can record the customer's OK on a team-less order first and add the name at show time. The other reading is "always required". Say if you want that. The web form (11-27) and its zod rule should follow whichever is chosen.

### O-3 (interpretation, does not block): a Cancelled order and the customer's OK

The plan says `SetPublicSettings` "refuses Cancelled". I refuse every public settings save on a Cancelled order, including removing the customer's OK. The UI offers no Edit there (UI-SPEC O1). Recommendation: allow removing the OK on a Cancelled order (a customer can change their mind), and keep refusing to show. That is a small change in `Order.SetPublicSettings`; say if you want it.

## What is left in Task 3 (for the continuation agent)

All of it, because none was written. In the plan's own words:

1. In `Order.ChangeStatus`, a move to Cancelled clears `ShownOnWebsiteSinceUtc` (D-41) and the handler removes the gallery entry and writes `order.taken-off-website`; a reopen leaves it off.
2. Apply the O-1 ruling in `Order.SoftDelete` and `Restore` and in `DeleteOrderHandler` and `RestoreOrderHandler`.
3. `PublicContentInvalidationInterceptor`: also mark when an `Order` entry's current or original `ShownOnWebsiteSinceUtc` is set (order saves do not otherwise clear the cache; only the gallery entry add and remove do today). `PermanentlyDeleteOrderHandler` must call `IPublicContentCache` after commit itself.
4. `ListProductLineOptionsHandler` and `GET /api/v1/product-lines/options` (Staff policy, endpoint name `ListProductLineOptions`), matrix row 401/200/200.
5. `PublicCacheInvalidationTests` matrix (the twelve writes), then docs/api/orders.md (cancel, delete and the options route).

## Performance

- **Duration:** about 100 min
- **Started:** 2026-11-12T19:09Z (approximate; not recorded at the start)
- **Completed:** 2026-11-12T20:40Z
- **Tasks:** 2 of 3
- **Files:** 51 changed (6,775 insertions, 10 deletions; 3,535 of those lines are the migration designer file, 140 the snapshot and 140 the migration)

## Accomplishments

- `PUT /api/v1/orders/{orderId}/public` under `Policies.Staff`; anonymous 401; matrix row 401/400/400 holds.
- Domain: `Order.SetPublicSettings` (skips the Completed lock, refuses Cancelled), `OrderPublicSettings` with the exact UI-SPEC messages, `OrderPublicFiling.Pieces` and `AutoLine`, `GalleryEntry.ForOrder`.
- The order detail answers `publicWebsite { customerConsent, consentRecordedAtUtc, consentRecordedByName, shownOnWebsite, shownSinceUtc, productLineId, productLineTitle, autoProductLineId, publicName, pieces, hasPhoto, canShow }`.
- Five audit codes: `order.public-consent-recorded`, `order.public-consent-removed`, `order.shown-on-website`, `order.taken-off-website`, `order.public-details-changed`. `AuditActions.All` is 125.
- Migration `20261112192017_AddOrderPublicSettings` (forward only).
- OpenAPI snapshot and generated web types refreshed (additive only).

## Task Commits

1. **Task 1 (tracer): the OK, show, detail and gallery entry**
   - RED `c478f6e7` (test): 5 endpoint tests plus the matrix row
   - GREEN `622a4d8a` (feat)
2. **Task 2: every rule, the auto line and the audit entries**
   - RED `8387b6ed` (test)
   - GREEN `7c72a48d` (feat)
   - REFACTOR `664b0547` (refactor, coverage)
3. **Task 3:** not started (precondition unmet).

**Plan metadata:** the SUMMARY commit follows this file.

## TDD Gate Compliance

RED and GREEN commits exist in order for Tasks 1 and 2. `gsd_run check tdd-red-evidence` takes a JSON record of a TAP, JUnit, swift-testing or unittest report; this repository's runner (xunit.v3 on Microsoft Testing Platform) writes none of those formats here, so the classifier was not run. Each RED was instead inspected by hand against the real console output (kept in the session scratchpad):

- **Task 1 RED** (`*OrderPublicSettingsEndpointTests`, 5 of 5 failed). Semantic assessment: each failed on the planned assertion. The PUT answered `404` where `200` or `401` was expected (the route did not exist), and the fresh-order test failed with `KeyNotFoundException` reading `publicWebsite` from the detail. None was a compile, load or fixture fault.
- **Task 2 RED** (Domain: 13 of 140 failed; Server: 5 of 14 failed). Semantic assessment: the Domain failures were the missing refusals (show without OK, Cancelled, name rules, no line, all-fields-together) and the catalog count and codes (120 instead of 125). The Server failures were `200` where `400` or `422` was expected, the audit list holding only `order.created` and `order.status-changed`, and a line delete answering `500` where `422` was expected (the foreign key from Orders to ProductLines had no guard). 
- **Not a RED, stated plainly:** `OrderPublicFilingTests` (8) and the migration tests (8) passed on their first run, because the filing function and the migration were built in Task 1 where the tracer needed them. They are regression tests for Task 1 code, written in Task 2 as the plan lists them. One migration test had a bug of mine (it forbade every `INSERT INTO`, which the migration history row needs) and was fixed before the RED commit.
- The handler unit tests (`SetOrderPublicSettingsHandlerTests`, 17) were written after the handler, for the Application coverage gate.

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

**Total deviations:** 3 (1 bug, 2 blocking). **Impact on plan:** none on scope; the bug fix is needed for correctness of the new foreign keys.

## Known flakes (recorded, not hidden)

- `OrderListTimingTests.TheListAnswersUnder300MsAtP95OnFiveYearsOfOrders` failed once in the first full Server run while `dotnet format` and a vitest run were using the machine at the same time. Run alone it passed (1 of 1). It is load sensitive.
- `OrderImagesEndpointTests.TwoUploadsTogetherForTheLastFreeSlotLeaveExactlyFivePhotos` failed once in the second full Server run: one of the two concurrent uploads answered 500 where 409 or 422 was expected. It passed in the first full run, and the whole `OrderImagesEndpointTests` class passed 3 times in a row on its own afterwards (20 of 20 each time). Nothing in this plan touches the upload path, but I could not prove the race is older than this plan: the plan's changes to Orders (new nullable columns and two foreign keys) are the only change in that table's locking. If it shows again in a gate, check it first on a checkout from before this plan.

## Authentication Gates

None.

## Issues Encountered

- The first full Server run took about 25 minutes; runs after the last commit were done with nothing else running.
- No stub was left in the code written here. Known Stubs: none.

## Threat Flags

None new. T-11-57 and T-11-58 are covered by tests (show needs the recorded OK; client-sent consent fields are ignored). T-11-59 holds (Staff policy, anonymous 401). T-11-60 (stale public data after cancel or delete) is Task 3 and is still open.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 11-26 can read `GalleryEntries` joined to `Orders`, `OrderPublicFiling` and `Order.PublicProductLineId`. The `Kind` column is the text `Order` or `Upload`.
- 11-27 can use the `publicWebsite` block. The line options route (`GET /api/v1/product-lines/options`) is Task 3 and does not exist yet.
- 11-28 owns `GalleryEntry.CreateUpload`; the entity already has its columns. The upload CHECK needs a photo id, a team and a line and no order.
- 11-37: label the five codes. Details: `number=ORD-...` for the four flag codes; `number=ORD-...;fields=line,name` for details-changed.
- The orchestrator should hold the dependents of this plan (it is `status: halted`) until O-1 is answered and the Task 3 continuation runs.

## Self-Check

PASSED for Tasks 1 and 2. All 16 key files above exist on disk. All five commits (`c478f6e7`, `622a4d8a`, `8387b6ed`, `7c72a48d`, `664b0547`) are ancestors of HEAD. The working tree held nothing uncommitted except this file. Task 3 is not done by design (see Open items), so the plan as a whole is `halted`, not complete.

---
*Phase: 11-public-site-content-management*
*Completed: 2026-11-12 (Tasks 1 and 2; Task 3 waits on O-1)*
