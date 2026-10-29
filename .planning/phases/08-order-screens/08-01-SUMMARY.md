---
phase: 08-order-screens
plan: 01
subsystem: api
tags: [orders, order-list, openapi, ef-core, query-count, attribution, business-calendar]
created: "2026-10-29T16:50:00-05:00"
updated: "2026-10-29T16:50:00-05:00"

requires:
  - phase: 07-order-api
    provides: order list and detail endpoints, OrderReader, order item and discount attribution columns
provides:
  - "GET /api/v1/orders rows carry pieces; the page carries allOrders, activeOrders and today"
  - "Every order answer carries today; every item carries recordedBy, recordedAt, lastChangedBy, lastChangedAt"
  - "Order list runs 3 fixed SQL commands (D-60)"
  - "Regenerated openapi.v1.json and web/src/types/api.generated.ts"
affects: [08-02, 08-03, 08-04, 08-05, 08-06, 08-07, order-screens-web]

actuals:
  tokens: 17400
  tasks: 2
  commits: 4
plan_head_before: 0b00414cd938da7dedd1b485bc332d63d7812f41
plan_head_after: c64c318565e179fd53e93ab583b9d9e30ea8ac6b

tech-stack:
  added: []
  patterns:
    - "List-wide counts in one GroupBy-on-constant LINQ command, independent of every filter"
    - "Business today stamped by the reader after the read loop (`view with { Today }`), so no handler changes"
    - "Shared FixedBusinessCalendar in Csps.Testing for reader tests"

key-files:
  created:
    - tests/Csps.Testing/FixedBusinessCalendar.cs
  modified:
    - src/Csps.Application/Orders/OrderListResponse.cs
    - src/Csps.Application/Orders/OrderDetailResponse.cs
    - src/Csps.Application/Orders/ListOrdersHandler.cs
    - src/Csps.Application/Ports/IOrderReader.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - tests/Csps.Application.UnitTests/Orders/ListOrdersHandlerTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderDetailSnapshotTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderDeletedListTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderListQueryCountTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderAttributionTests.cs
    - docs/api/orders.md
    - docs/operations/list-performance.md
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts

key-decisions:
  - "ListOrdersHandler takes IBusinessCalendar instead of TimeProvider and reads the clock once (recent window and today)"
  - "OrderReader stamps Today after the detail read loop, so the row-version retry never repeats the calendar read"
  - "List-wide counts use one GroupBy-on-constant query with an explicit list of the five active statuses, not enum order"

patterns-established:
  - "Contract change flow: DTO + tests, snapshot rewrite in one process, generate, check, typecheck, commit together"

requirements-completed: [ORD-01, ORD-07, ORD-11]

coverage:
  - id: D1
    description: "List rows carry pieces, the sum of item quantities (25 + 15 reads 40)"
    requirement: ORD-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs#EachRowCarriesItsPiecesAsTheSumOfItsItemQuantities"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs#EveryRowCarriesItsPiecesAndTheListWideCountsIgnoreEveryFilter"
        status: pass
    human_judgment: false
  - id: D2
    description: "allOrders and activeOrders ignore every filter and never count a deleted order"
    requirement: ORD-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs#TheListWideCountsIgnoreTheFiltersAndNeverCountADeletedOrder"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs#TheListWideCountsLeaveOutDeletedOrdersAndTheEndStatuses"
        status: pass
    human_judgment: false
  - id: D3
    description: "The order list runs exactly 3 SQL commands at page sizes 1, 20 and 100 under every filter and sort, and p95 stays under 300 ms"
    requirement: ORD-01
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs#EveryFilterAndSortRunsExactlyThreeCommandsAtEveryPageSize"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderListQueryCountTests.cs#ThePageSizeAndTheFilterDoNotChangeTheNumberOfSqlCommands"
        status: pass
      - kind: integration
        ref: "dotnet test --project tests/Csps.Server.IntegrationTests --filter-class *OrderListTimingTests --output Detailed"
        status: pass
    human_judgment: false
  - id: D4
    description: "List and detail answers carry the business today from the calendar, not the UTC date"
    requirement: ORD-11
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/ListOrdersHandlerTests.cs#TheListCarriesTheListWideCountsAndTheBusinessTodayNotTheUtcDate"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderAttributionTests.cs#AnItemSaysWhoRecordedItAndWhoLastChangedItAndEveryAnswerCarriesTheBusinessToday"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderDetailSnapshotTests.cs#TheDetailCarriesTheBusinessTodayAndEachItemSaysWhoRecordedIt"
        status: pass
    human_judgment: false
  - id: D5
    description: "Every item shows who recorded and last changed it; forged body values are ignored"
    requirement: ORD-07
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderAttributionTests.cs#ForgedItemAttributionInTheRequestBodyIsIgnored"
        status: pass
    human_judgment: false
  - id: D6
    description: "openapi.v1.json and api.generated.ts regenerated by the tools and in step"
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Http/OpenApiSnapshotTests.cs#CommittedSnapshotMatchesTheLiveDocument"
        status: pass
      - kind: other
        ref: "npm --prefix tools/openapi-gen run check"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-10-29
status: complete
---

# Phase 08 Plan 01: Order list and detail contracts Summary

*Created: 2026-10-29T16:50:00-05:00 · Updated: 2026-10-29T16:50:00-05:00*

**Order list rows now carry `pieces`, the page carries filter-free `allOrders` and `activeOrders` in a fixed third SQL command, every order answer carries the business `today`, and every item carries recorder and last-changer attribution, with the OpenAPI snapshot and web types regenerated.**

## Performance

- **Duration:** about 35 min
- **Started:** 2026-10-29T21:12:00Z
- **Completed:** 2026-10-29T21:47:00Z
- **Tasks:** 2 (each as RED then GREEN, 4 task commits)
- **Files modified:** 26 (25 modified, 1 created)

## Accomplishments

- `pieces` per list row is a correlated sum inside the page command, so no row costs a query (D-40).
- `allOrders` and `activeOrders` come from one extra LINQ command (`GroupBy` on a constant with `Count`), ignore q, status, dates, product type and has-balance, and never count a soft-deleted order (D-41). The list now runs exactly 3 commands (D-60); both count tests assert 3.
- `today` (business date from `IBusinessCalendar`) is on the list page and on every order detail answer (D-59). The reader stamps it once after the read loop, so the create, edit, item, discount, payment, refund, expense and status answers all carry it with no handler change.
- Items now answer `recordedBy`, `recordedAt`, `lastChangedBy`, `lastChangedAt` through the same left joins the discount query uses (D-44). No migration: the columns already existed. A forged value in an item body is ignored (SEC-08).
- Snapshot rewritten by the test switch, types regenerated by `openapi-typescript`, `check` and web `typecheck` pass. Nothing was hand-edited.

## Task Commits

1. **Task 1 RED:** `38efdfa2` test(08-01): add failing tests for list pieces, list-wide counts and today
2. **Task 1 GREEN:** `35696510` feat(08-01): list rows carry pieces, list-wide counts and the business today
3. **Task 2 RED:** `22ab2061` test(08-01): add failing tests for item attribution and today on the order detail
4. **Task 2 GREEN:** `c64c3185` feat(08-01): order detail carries today and item attribution

**Plan metadata:** committed after this file (docs: complete plan).

## TDD notes

- **RED evidence:** the project runs xunit.v3 on Microsoft Testing Platform, whose console output is not one of the report formats `gsd_run check tdd-red-evidence` reads (TAP, JUnit XML, swift-testing, unittest), so the classifier was not run. I inspected each RED run by hand. Every target test executed and failed on its planned assertion:
  - Task 1: `ListOrdersHandlerTests.TheListCarriesTheListWideCountsAndTheBusinessTodayNotTheUtcDate` (Today was 1/1/0001, expected 10/28/2026); the three-command tests (expected 3, was 2); the pieces, counts and today endpoint tests; the stale OpenAPI snapshot.
  - Task 2: `OrderAttributionTests` (`recordedBy` was null, expected the caller); `OrderReaderDetailSnapshotTests` (item attribution and today missing).
- **Shape-only skeleton:** a compile error is not valid RED, so each RED commit carries only the new record members and placeholder values (0, null, default) so the tests compile and fail on assertions. The skeleton holds no behavior.
- **No RED for one test:** `ListOrdersEndpointTests.OrdersWithTheSameDueDateComeBackInIdOrder` passed at once, because every sort already ended on the id. It is kept as a regression guard for the plan's `[EDGE ORD-01 ordering]` truth. It compares against `OrderBy(order => order.Id)` run in SQL Server, so it uses SQL Server's GUID order and not .NET's.
- **REFACTOR:** none needed.

## Verification run (quoted)

- Application unit tests: 1897 passed. Domain: 1182 passed. Architecture: 242 passed.
- Infrastructure integration tests: 764 total, 763 passed, 1 skipped (existing skip, not from this plan).
- Server integration tests, full run after the last code change: 1840 passed, 0 failed, 0 skipped.
- `OrderListTimingTests` run alone (preflight first): default list p50 12.7 ms, p95 16.2 ms; customer-name search p95 99.8 ms; product type filter p95 27.3 ms; has balance p95 12.4 ms; far page size 100 p95 183.1 ms; newest sort p95 14.3 ms; balance sort p95 15.3 ms; total sort p95 16.1 ms. All under 300 ms. The 300 ms limit and the command count were not loosened to pass.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- `npm --prefix web run typecheck`: exit 0.
- `dotnet build Csps.slnx`: 0 warnings, 0 errors. `dotnet format Csps.slnx --verify-no-changes`: exit 0, no output.
- Acceptance greps: `ActiveOrders` and `int Pieces` present in `OrderListResponse.cs`; both count tests assert `ShouldBe(3` and none assert `ShouldBe(2,`; `activeOrders`, `pieces` in `api.generated.ts`; no `FromSql`, `SqlQuery` or `ExecuteSql` in `OrderReader.cs`; `list-performance.md` says 3 commands and still says 300 ms; `OrderItemResponse` has `RecordedBy` and `LastChangedAt`; `DateOnly Today` once in `OrderDetailResponse.cs`.
- gitleaks on every staged change: no leaks. No real names, emails, local paths or connection strings added.

## Decisions Made

- `ListOrdersHandler` now takes `IBusinessCalendar` in place of `TimeProvider`. The clock is read once and gives both the recent-window instant and `today`. The query is still checked first, so a bad query never reads the calendar.
- `OrderReader` stamps `Today` after the row-version retry loop, in one helper, so a retried read never repeats the calendar call and the 8-command detail count is unchanged for a fixed calendar.
- The count query lists the five active statuses by name rather than comparing enum values.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Eight handler test fixtures and one more needed the new `Today` argument**
- **Found during:** Task 2 RED (build failed with CS7036)
- **Issue:** `OrderDetailResponse` gained `Today`, and the `Detail()` helpers in eight Application unit test files (UpdateOrderDetails, OrderRefund, OrderPayment, OrderItem, OrderExpense, ChangeOrderStatus, OrderDiscount, CreateOrder) and `LegacyEditHandlerTests` build it by hand. None is listed in the plan's `files_modified`.
- **Fix:** passed `new DateOnly(2026, 10, 28)` (and item attribution in `LegacyEditHandlerTests`). Test-only, no behavior change.
- **Files modified:** the nine test files above.
- **Verification:** build clean; 1897 unit tests pass.
- **Committed in:** `22ab2061`.

**2. [Rule 3 - Blocking] Shared fake calendar for reader tests**
- **Found during:** Task 2 RED (`OrderReader` now needs an `IBusinessCalendar`)
- **Issue:** the plan said "pass the test calendar they already have, or the shared fake", but the infrastructure tests had none.
- **Fix:** added `tests/Csps.Testing/FixedBusinessCalendar.cs` (a fixed UTC+8 clock) and used it in the three `OrderReader*` test files.
- **Committed in:** `22ab2061`.

**3. [Rule 1 - Bug, in my own test] Reader test assumed the domain stamps item attribution**
- **Found during:** Task 2 GREEN
- **Issue:** `Order.Create` leaves `CreatedById` and `CreatedAtUtc` to the save interceptor, which the infrastructure seed does not run, so the first version of `TheDetailCarriesTheBusinessTodayAndEachItemSaysWhoRecordedIt` read null.
- **Fix:** the test sets those two columns on the seeded item with `ExecuteUpdate`, then asserts the read.
- **Committed in:** `c64c3185`.

---

**Total deviations:** 3 auto-fixed (2 blocking test-fixture changes, 1 test bug). **Impact on plan:** none on production behavior or scope. All changes are test support.

## Issues Encountered

- The first handler test I wrote overrode the reader stub after the harness had set one, so the captured "asked at" value was lost. Fixed by giving the harness a `Page` property. Test-only.
- `core.autocrlf` is on: several files show an LF-to-CRLF warning on `git add`. The index stores LF as before. No content effect.

## Authentication Gates

None.

## Known Stubs

None. The RED skeleton placeholders were replaced in the GREEN commits.

## Threat Flags

None. No new endpoint, auth path, file access or schema change. T-08-01 to T-08-03 are covered by the endpoint count test, the forged-body test and the count and timing tests.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The generated web types now carry `pieces`, `allOrders`, `activeOrders`, `today` and the item attribution, so plans 08-02 onward can read them. 08-07 is the only other plan allowed to rewrite the two contract files.
- Open point to note, not a blocker: the far-page size-100 case rose to p95 183 ms (limit 300 ms) with the piece sum in the page command. If later plans add more per-row sums, re-run `OrderListTimingTests` alone.

## Self-Check: PASSED

- Created and changed files exist on disk (checked below with `[ -f ]`).
- Commits `38efdfa2`, `35696510`, `22ab2061`, `c64c3185` are ancestors of HEAD.

---
*Phase: 08-order-screens*
*Completed: 2026-10-29*
