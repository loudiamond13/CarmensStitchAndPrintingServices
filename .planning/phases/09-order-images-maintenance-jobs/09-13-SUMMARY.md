---
phase: 09-order-images-maintenance-jobs
plan: 13
subsystem: api
tags: [images, orders-list, cover, performance, openapi, query-shape]

requires:
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-07 (IImageDelivery.ForCover, TestingImageDelivery, photos in the order answer)
  - phase: 09-order-images-maintenance-jobs
    provides: plan 09-09 (photo rules, fake photo routes and upload contract)
provides:
  - OrderListEntry.ImageCount and OrderListEntry.Cover (OrderCoverResponse with Card, Table, Width, Height) in GET /api/v1/orders
  - OrderListRow.ImageCount, CoverPublicId, CoverWidth, CoverHeight and the cover projection in the page command
  - A page query that cuts the page ids first, so the list is faster than before with photos present
  - Web fixture orderListCover(n, overrides) and listEntryOf with imageCount and cover
affects: [09-14, 09-15, 09-18]

created: "2026-11-03T18:45:00-06:00"
updated: "2026-11-03T18:45:00-06:00"

actuals:
  tokens: 11000
  tasks: 2
  commits: 4

plan_head_before: f27ee1493070e68ed51238211092f8ae5f4e9fd9
plan_head_after: 2fa75614c783719626b0174207e63c57f99da2fb
commits: 4

tech-stack:
  added: []
  patterns:
    - "A list page is cut in an inner query on the ids (Id IN (page)), then the page rows are projected and sorted again, so per-row subqueries run for the page only"

key-files:
  created: []
  modified:
    - src/Csps.Application/Orders/OrderListResponse.cs
    - src/Csps.Application/Ports/IOrderReader.cs
    - src/Csps.Application/Orders/ListOrdersHandler.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - tests/Csps.Application.UnitTests/Orders/ListOrdersHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderListQueryCountTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderTimingData.cs
    - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs
    - docs/api/orders.md
    - docs/operations/list-performance.md
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/test/orderFixtures.ts
    - web/src/test/orderListFixtures.ts

key-decisions:
  - "The cover is the photo with the lowest Position, ties broken by Slot, so a list row always has one cover even if two photos briefly share a position"
  - "The page command first picks the page ids in an inner query and then reads those rows. The first version (subqueries in the same select as the paging) made the far page 10 times slower"
  - "OrderCoverResponse reuses ImageSourceResponse from the order answer, so the list and the detail share one address shape"

patterns-established:
  - "Per-row subqueries in a paged EF query belong in an outer query over `Id IN (page ids)`, not next to Skip/Take"

requirements-completed: []

status: complete
duration: 100min
completed: 2026-11-03
---

# Phase 9 Plan 13: The orders list shows each order's cover and photo count in the same 3 commands Summary

**Every row of `GET /api/v1/orders` now carries `imageCount` and a `cover` (card and table addresses plus width and height, or null), still in 3 SQL commands, and the page query was reshaped so the list is faster than before even with photos.**

## Performance

- **Duration:** about 100 min (17:10 to 18:45, -06:00), most of it five-minute timing runs and a side-by-side query test.
- **Tasks:** 2 (Task 1 tracer, Task 2 auto), 4 commits.

## Accomplishments

- `OrderListEntry` has `ImageCount` and `Cover`. `Cover` is `OrderCoverResponse(Card, Table, Width, Height)`, or null when the order has no photo. The handler builds it per row through `IImageDelivery.ForCover` and never calls the delivery for a row without a cover.
- `OrderReader.ListAsync` reads the count and the Position 0 photo (public id, width, height) as subqueries in the page command. There is no schema change, no migration and no SQL text. `IX_OrderImages_OrderId_Position` from plan 09-01 serves them.
- The page command now picks the page ids in an inner query and reads only those rows (see Deviations 1). The three-command shape is unchanged.
- `docs/api/orders.md` documents `imageCount` and `cover` (staff only, built at read time, card and table slot sizes). `docs/operations/list-performance.md` records the new p95 with the date.
- The OpenAPI snapshot, the generated web types and the web list fixtures carry the new fields. `orderListCover(n, overrides)` is in `web/src/test/orderListFixtures.ts` as the plan names it. `listEntryOf` in `orderFixtures.ts` derives `imageCount` and `cover` from the order's photos.
- Query count tests (reader and endpoint) now seed photos (a quarter of the orders have two, a quarter of the rest one, and so on) and still assert exactly 3 commands at page sizes 1, 20 and 100. The timing data gives a third of its 14,608 orders one or two photos.

## Task Commits

1. **Task 1 RED:** `7a56df03` (test; 4 endpoint tests failed on the missing `imageCount`/`cover` members, 46 others passed; the 2 new handler tests did not compile against the old constructor)
2. **Task 1 GREEN:** `3bd1567a` (feat; response, port, handler, reader, docs, snapshot, types, fixtures)
3. **Task 2 RED:** `3996b9fe` (test; photos in the count seeds and the timing data; the timing test failed with the Task 1 query, see below)
4. **Task 2 GREEN:** `2fa75614` (perf; page ids first, docs with the p95 numbers)

## TDD Gate Compliance

- RED `7a56df03`: `ListOrdersEndpointTests` ended `total: 50, failed: 4, succeeded: 46` (`KeyNotFoundException` on `imageCount` and `cover`).
- GREEN `3bd1567a`: `ListOrdersEndpointTests` + `OpenApiSnapshotTests` ended `total: 60, failed: 0`. `ListOrdersHandlerTests` ended `total: 17, failed: 0`.
- Task 2 RED: the count tests passed at once with photos present (the Task 1 projection already stays in one command), so they are characterization tests. The real RED for Task 2 was the timing gate: with the Task 1 query, `OrderListTimingTests` failed alone twice: `far page, size 100: p50 726.5 ms, p95 1408.0 ms` (data without photos) and `p50 1165.8 ms, p95 2341.6 ms` (data with photos, paging cut before the projection, a busy machine).
- Task 2 GREEN `2fa75614`: `OrderListTimingTests` alone ended `total: 1, failed: 0, succeeded: 1`.

## Checks I saw

- Task 1 verify: `ListOrdersEndpointTests` + `OpenApiSnapshotTests` `total: 60, failed: 0`. `ListOrdersHandlerTests` `total: 17, failed: 0`. `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." `npm --prefix web run typecheck`: no output, exit 0. The snapshot refresh used `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command (that run reported `failed: 1`, as the write run does), then the plain run printed `total: 10, failed: 0`.
- Task 2 verify, run after the final query change: `OrderListQueryCountTests` + `ListOrdersEndpointTests` `total: 59, failed: 0`. `OrderReaderQueryCountTests` `total: 41, failed: 0`. `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- `OrderListTimingTests` alone, final run (2026-11-03, `total: 1, failed: 0, succeeded: 1`), p50 / p95 in ms: default list 31.5 / 49.4, customer-name search 125.2 / 186.2, product type filter 44.2 / 69.8, has balance 17.3 / 22.6, far page size 100 69.6 / 96.1, newest sort 47.1 / 71.5, balance sort 37.0 / 51.2, total sort 28.7 / 43.0. All under 300 ms. The limit and the command count were not loosened.
- Regression: `Csps.ArchitectureTests` `total: 263, failed: 0`. `Csps.Application.UnitTests` `total: 2055, failed: 0`. `Csps.Infrastructure.IntegrationTests` (whole project) `total: 932, failed: 0, succeeded: 931, skipped: 1` (the skip was there before). `Csps.Server.IntegrationTests` without the timing classes `total: 1948, failed: 0`.
- Web: `vitest run` of `OrdersTable.test.tsx`, `OrdersPage.test.tsx` and `src/components/data`: `Test Files 5 passed, Tests 200 passed`. `eslint` and `prettier --check` clean on the two fixture files.
- Acceptance: `grep -c imageCount web/src/types/api.generated.ts` >= 1; `grep -c ForCover src/Csps.Application/Orders/ListOrdersHandler.cs` >= 1; `ShouldBe(3` is still in `OrderReaderQueryCountTests.cs`; `list-performance.md` keeps its `created` value.
- `gitleaks protect --staged --no-banner` before each commit: "no leaks found".

## Decisions Made

- Cover tie-break by Slot (see key-decisions). Position is not unique, by design, so a plain `Position == 0` could return two rows.
- The cover and the count are plain scalar subqueries (four of them) rather than one OUTER APPLY, because they translate to ordinary SQL with no EF surprises and cost nothing once the page is cut first.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, performance] The first cover query made the list slow**
- **Found during:** Task 2 (timing gate)
- **Issue:** with the cover and count as subqueries next to Skip/Take, SQL Server worked out every subquery for each matching order before cutting the page. The far page at size 100 read p95 1408 ms. A throwaway side-by-side test on the same data (deleted, not committed) read p50 at the far page: old query 92 to 128 ms, first cover query 566 to 696 ms, and the query with a page-id cut 34 to 37 ms.
- **Fix:** `OrderReader.ListAsync` cuts the page ids in an inner query (`Sort(...).Skip().Take().Select(Id)`), then reads those rows with the subqueries and sorts them again on the same keys. Still LINQ only and 3 commands.
- **Files modified:** `src/Csps.Infrastructure/Orders/OrderReader.cs`
- **Commit:** `2fa75614`

**2. [Rule 2 - Missing coverage] The timing data had no photos**
- **Found during:** Task 2
- **Issue:** T-09-23 says the cover join must not slow the list, but the timing data had no photos, so it would never have exercised the cover path.
- **Fix:** `OrderTimingData` adds one photo to a third of the orders and two to every sixth, chosen from the order number so the seeded random sequence (and every other case) is unchanged. The file was not in the plan's file list.
- **Commit:** `3996b9fe`

**3. [Rule 3 - Blocking] Fixture file and callers**
- **Issue:** the plan names `web/src/test/orderListFixtures.ts` for the list fixtures, but the order list rows are built by `listEntryOf` in `web/src/test/orderFixtures.ts` (the first file holds the Settings lists). The generated type made `imageCount` and `cover` required, so `listEntryOf` failed the typecheck.
- **Fix:** `orderListCover` lives in `orderListFixtures.ts` as the plan says (plan 09-18 relies on that name), and `orderFixtures.ts` imports it for `listEntryOf`.
- **Commit:** `3bd1567a`

**4. [Rule 1 - Test callers] Signature changes**
- `ListOrdersHandler` gained `IImageDelivery` and `OrderListRow`/`OrderListEntry` gained fields. `ListOrdersHandlerTests` was the only caller and was updated in the RED commit.

**Total deviations:** 4. **Impact:** one real performance fix; no change to the planned behavior.

## Owner backlog items (for the orchestrator to copy into STATE.md)

- [ ] Info only, no decision needed: the customer-name search is the list case that moves most with machine load (a scan of the text columns, about 120 ms for one scan here, run twice per request: count and page). Two runs on a busy machine read p95 168 and 316 ms (the second over the limit) while a side-by-side test showed the old and new query equal. It passed at p95 186.2 ms on a quieter run. If it fails again in CI or on a loaded machine, re-run it alone first. If it keeps failing, a search change (for example a prefix search or a search index) is an owner decision, as `docs/operations/list-performance.md` already says.

## Requirements

ORD-04 and IMG-04 are shared by many Phase 9 plans. As in plans 09-01 to 09-12, this plan does not tick them in REQUIREMENTS.md; they close when the phase is verified.

## Known risks and notes

- A host with no Cloudinary cloud name that holds rows with photos would throw when the list is read (`ForCover` needs the cloud name). This is the same note as plan 09-07 and cannot happen on a real host, because uploads answer 503 without keys.
- The side-by-side query test was a throwaway file and was deleted before commit. The numbers above are its only record.

## Known Stubs

None.

## Threat Flags

None. Cover addresses appear only in the Staff-only list (T-09-78, the authorization matrix already covers `GET /api/v1/orders`), the list stays at 3 commands and under 300 ms (T-09-23), and no package was added or bumped (T-09-SC; `npm ci` in `tools/openapi-gen` and `web` only installed from the lock files).

## Issues Encountered

- Machine load from the other Phase 9 executors made the first two timing runs unreliable; the third and fourth runs and the side-by-side test settled it.
- `ExpenseListTimingTests` was not run (not touched by this plan).

## Next Phase Readiness

Plans 09-14 and later can read `imageCount` and `cover` from the list and use `orderListCover(n)` and `listEntryOf` in web tests. Plan 09-18 can use `orderListCover` for its candidate-width check.

## Self-Check: PASSED

- Files: the 15 files in `key-files` exist; `ScratchShapeTests.cs` is not in the tree.
- Commits: `7a56df03`, `3bd1567a`, `3996b9fe` and `2fa75614` are ancestors of HEAD.
