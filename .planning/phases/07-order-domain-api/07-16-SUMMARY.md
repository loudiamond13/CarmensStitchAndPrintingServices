---
phase: 07-order-domain-api
plan: 16
subsystem: api
tags: [orders, list, search, filter, sort, paging, indexes, performance, openapi]
created: "2026-10-28T18:30:00-05:00"
updated: "2026-10-28T19:20:00-05:00"

requires:
  - phase: 07-order-domain-api
    provides: "07-05 the stored order totals and StatusChangedAtUtc, 07-15 the SoftDelete filters and the deleted list, the Phase 6 list pattern (LikePattern, ListQueryRules, the timing rig)"
provides:
  - "GET /api/v1/orders (Staff, both roles): { items, total, page, pageSize }; each item has id, number, customerName, teamName, orderDate, dueDate, status, statusChangedAt and the stored subtotal, discount, total, paid, refunded, balance, customerCredit, fullyPaid; the ORD-2026-0148 row reads 22,450.00 / 1,122.50 / 21,327.50 / 12,000.00 / 9,327.50"
  - "Query: q (up to 100 characters, LIKE-escaped, matches number, customer, team, contact number), status (active default, all, or one of the seven keys), from and to (order date), productType (id), hasBalance, sort (due default, newest, balance, total, Id last), page 1 to 100000, pageSize 1 to 100 (20)"
  - "400 field errors in plain English for an unknown status, sort or product type, a bad date, to before from, page or pageSize out of range, q over 100 characters"
  - "Deleted orders never listed or counted; the list runs exactly two SQL commands at any page size, filter or sort"
  - "Migration AddOrderListIndexes: IX_Orders_List_Due, IX_Orders_Status_StatusChangedAtUtc, IX_Orders_OrderDate, IX_Orders_CreatedAtUtc, IX_Orders_Balance, IX_Orders_Total (all live-only) and IX_OrderItems_ProductTypeId_OrderId"
  - "OrderRules.RecentEndStateDays; IOrderReader.ListAsync with OrderListQuery, OrderListScope, OrderListSort, OrderListRow, OrderListPage; ListOrdersRequest(+Validator), ListOrdersHandler, OrderListResponse and OrderListEntry"
  - "List section of docs/api/orders.md; orders section of docs/operations/list-performance.md; refreshed OpenAPI contract and generated types"
affects: [07-17, 07-18, 07-19, 07-20, 08]

actuals:
  tokens: 27800
  tasks: 3
  commits: 6
plan_head_before: 9221bcc32a2147e23d652bc2ac061b4844414629
plan_head_after: fbdc3aac71678dc62a1191b4cb7604c07698b5c0

tech-stack:
  added: []
  patterns:
    - "The order list builds one filtered IQueryable and runs it twice, the count and the page, so any filter or sort is still two commands"
    - "The handler takes the clock from TimeProvider, not from the business calendar, because the calendar reads site settings and would add a third command"
    - "The product type filter is a lookup on OrderItems with the SoftDelete filter lifted, because the outer query already hides deleted orders"

key-files:
  created:
    - src/Csps.Application/Orders/ListOrdersRequest.cs
    - src/Csps.Application/Orders/ListOrdersRequestValidator.cs
    - src/Csps.Application/Orders/ListOrdersHandler.cs
    - src/Csps.Application/Orders/OrderListResponse.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028225721_AddOrderListIndexes.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261028225721_AddOrderListIndexes.Designer.cs
    - tests/Csps.Application.UnitTests/Orders/ListOrdersRequestValidatorTests.cs
    - tests/Csps.Application.UnitTests/Orders/ListOrdersHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderListQueryCountTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderTimingData.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderTimingCollection.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderListTimingTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderListIndexesMigrationTests.cs
  modified:
    - src/Csps.Domain/Orders/OrderRules.cs
    - src/Csps.Application/Ports/IOrderReader.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Configurations/OrderItemConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Server/Controllers/OrdersController.cs
    - src/Csps.Server/Composition/OrdersApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Orders/OrderFixtures.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Infrastructure.IntegrationTests/Persistence/OrdersMigrationTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/orders.md
    - docs/operations/list-performance.md

key-decisions:
  - "newest sorts by order date (latest first), then by when it was recorded (latest first), then by id. Recorded time alone would make every imported order tie, because the import stamps them all at once."
  - "The list reads the clock from TimeProvider, not the business calendar, so it stays at exactly two SQL commands."
  - "ORD-01 and ORD-02 are not marked complete: the plan's scope note keeps them mapped to Phase 8, where the screen makes them true end to end. ORD-20 is blocked by the shared-ID gate until 07-20 finishes."
  - "The wire row is named OrderListEntry, because OrderListItem already names the product type list entry and would clash in the OpenAPI schema."

patterns-established:
  - "Pattern: a Server query-count test runs every filter and sort at page sizes 1, 20 and 100 and asserts exactly 2 commands"
  - "Pattern: a throwaway five-year order data set built through the domain and EF batches, shared by any later order timing test"

requirements-completed: []

coverage:
  - id: S1
    description: "ORD-01, ORD-20: staff list orders by due date; the full ORD-2026-0148 row carries the stored 22,450.00 / 1,122.50 / 21,327.50 / 12,000.00 / 9,327.50 (balance 9,327.50); a soft-deleted order is absent and not counted; an anonymous caller gets 401"
    requirement: ORD-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs#StaffListOrdersByDueDateWithTheStoredTotalsAndADeletedOrderIsAbsent"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs#AnAnonymousCallerIsRefused"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization (matrix row GET /api/v1/orders)"
        status: pass
    human_judgment: false
  - id: S2
    description: "ORD-02, T-07-46: search by customer, team, contact number and order number; a typed %, _ or [ stays literal; blank search is no search; a deleted order is not found"
    requirement: ORD-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs#SearchFindsTheCustomerTeamAndContactNumberAndKeepsTypedWildcardsLiteral"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs#SearchFindsAnOrderByItsNumberOrByTheYearPartOfEveryNumber"
        status: pass
    human_judgment: false
  - id: S3
    description: "ORD-02: active keeps Completed and Cancelled orders changed 29 days ago and drops those changed 31 and 45 days ago; all keeps everything; one status keeps only that status; order date range with edges included; product type keeps an order once however many matching items it has; hasBalance=true drops orders that owe nothing"
    requirement: ORD-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs (Active, FromAndTo, ProductType, HasBalance cases)"
        status: pass
    human_judgment: false
  - id: S4
    description: "ORD-02: due sort soonest first with no-due-date last, newest by order date, balance and total largest first and different from each other; ties broken by id so pages never overlap; page 2 of size 1 is the second row with the total unchanged"
    requirement: ORD-02
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs (sort and paging cases)"
        status: pass
    human_judgment: false
  - id: S5
    description: "WEB-10, SEC-03, T-07-47: an unknown status, sort or product type, a bad date, to before from, page 0 or 100001, pageSize 0 or 101 and a 101 character search are 400 with the plain-English field error; 100 characters is accepted"
    requirement: ORD-02
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/ListOrdersRequestValidatorTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs#BadInputIs400WithAPlainEnglishFieldError"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/ListOrdersHandlerTests.cs"
        status: pass
    human_judgment: false
  - id: S6
    description: "PERF-04: the list runs exactly two SQL commands at page size 1, 20 and 100 with no filter and with each filter and sort, an empty result included, at the reader and through the endpoint"
    requirement: ORD-01
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderListQueryCountTests.cs"
        status: pass
    human_judgment: false
  - id: S7
    description: "PERF-04: on 14,608 fake orders (8 a day for 1,826 days) every case of the order list has a p95 under 300 ms; the final standalone run reads default 11.1, name search 98.1, product type 19.1, has balance 7.7, far page 24.8, newest 5.7, balance sort 5.8, total sort 5.1 ms"
    requirement: ORD-01
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/OrderListTimingTests.cs#TheListAnswersUnder300MsAtP95OnFiveYearsOfOrders"
        status: pass
    human_judgment: false
  - id: S8
    description: "The index set exists with live-only filters, the right keys and directions, and the due index covers every list column"
    requirement: ORD-01
    verification:
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/OrderListIndexesMigrationTests.cs"
        status: pass
      - kind: integration
        ref: "tests/Csps.Infrastructure.IntegrationTests/Persistence/MigrationScriptTests.cs (no pending model changes)"
        status: pass
    human_judgment: false
  - id: S9
    description: "The list section of docs/api/orders.md and the orders section of docs/operations/list-performance.md read clearly to a person, and the new wording 'Choose a sort order.' is the owner's to approve"
    requirement: ORD-02
    verification: []
    human_judgment: true
    rationale: "Wording is the owner's call; no test judges prose."

duration: 40 min
completed: 2026-10-28
status: complete
---

# Phase 7 Plan 16: Order list, search, filters, sort and paging Summary

**Staff can list orders at `GET /api/v1/orders` with search, status, date, product type and balance filters, four sorts and paging, read straight from the stored totals in exactly two SQL commands, with seven new indexes and a p95 under 100 ms (limit 300 ms) in every case on about five years of fake orders.**

## Performance

- **Duration:** about 40 min
- **Tasks:** 3 of 3
- **Files changed:** 30 files, about 2,300 added lines (about 27,800 tokens of hand-written lines, chars/4, with the OpenAPI JSON, the generated types, the snapshot and the migration designer left out)

## Accomplishments

- Task 1 (tracer): `IOrderReader.ListAsync` (count, then page), `ListOrdersHandler`, the controller action with `[FromQuery]` binding, the matrix row (401, 200, 200) and a refreshed contract. Three orders came back in due date order with the 0148 row exact and a deleted fourth order absent.
- Task 2: the whole query. The validator now checks status, sort, product type, dates and their order; the reader filters by search (number, customer, team, contact number through `LikePattern`), status scope with the 30 day window from `OrderRules.RecentEndStateDays`, order date range, product type and balance, and sorts four ways, each ending on the id. The list section of `docs/api/orders.md` documents every parameter, default and error.
- Task 3: migration `AddOrderListIndexes` (indexes only), query-count tests at the reader and the endpoint, the five-year timing rig and the orders section of `docs/operations/list-performance.md`.

## TDD Gate Compliance

| Task | RED commit | GREEN commit |
|------|-----------|--------------|
| 1 | 2a8e4ea3 `test(07-16): list orders by due date (RED)` | 9c8967a6 `feat(07-16): list orders with stored totals (ORD-01)` |
| 2 | 1eb66a3f `test(07-16): order search, filters, sort and paging (RED)` | 08d17224 `feat(07-16): order search, filters, sort and paging (ORD-02)` |
| 3 | c3cd341d `test(07-16): order list query count and timing (RED)` | fbdc3aac `feat(07-16): order list indexes, two commands and the p95 proof (PERF-04)` |

- **Task 1 RED:** both cases failed on the missing route (the list answered 404 where 200 and 401 were expected). Valid assertion failure. `gsd_run check tdd-red-evidence` was not run (this runner's output is not TAP, JUnit or Surefire); the output was read by hand.
- **Task 2 RED:** 15 of 49 validator cases and 23 of 37 endpoint cases failed on missing rules and missing filters (for example "Old Completed Olga" listed when it should be dropped, and newest sort returning the oldest first). The cases that passed at once were the tie-break and paging cases and the 100 character search, because Task 1 already sorted by due date with the id last and paged.
- **Task 3 RED:** the 9 index cases failed on the missing indexes. The reader and endpoint query-count cases passed at once (35 and 9), because the reader was already two commands from Task 1. The timing test also passed before any index (p95 under 100 ms in every case, see the first set below), so the timing proof did not turn red. The indexes were added because the plan asks for an index behind every filter and sort, and the second set below shows they help (product type filter and the three sorts).
- REFACTOR: none needed.
- Tracer gate (Task 1): auto mode off and `human_verify_mode` end-of-phase with an automated-only `<verify>`, so the verify command was re-run after GREEN (`ListOrdersEndpointTests` 2 passed, `*Authorization*` 321 passed) before expansion. Tracer verified end-to-end, expanding.

## Verification Evidence

- `dotnet build -warnaserror` (whole solution): 0 warnings, 0 errors.
- Preflight before every integration or timing run: ports 5180, 5115, 7028, 5199 free, no dev or test processes.
- Timing report before the indexes (standalone run, p50 / p95 ms): default list 8.2 / 10.3, customer-name search 66.4 / 89.0, product type filter 33.0 / 35.2, has balance 6.5 / 7.4, far page size 100 24.5 p95 (22.9 p50), newest sort 17.9 / 19.9, balance sort 16.1 / 17.5, total sort 17.5 / 18.9.
- Timing report after the indexes (standalone run, `--output Detailed`, `*OrderListTimingTests`, 1 passed):
  - default list: p50 8.3 ms, p95 11.1 ms
  - customer-name search: p50 66.3 ms, p95 98.1 ms
  - product type filter: p50 17.6 ms, p95 19.1 ms
  - has balance: p50 6.5 ms, p95 7.7 ms
  - far page, size 100: p50 23.1 ms, p95 24.8 ms
  - newest sort: p50 4.2 ms, p95 5.7 ms
  - balance sort: p50 4.2 ms, p95 5.8 ms
  - total sort: p50 4.2 ms, p95 5.1 ms
- Full runs after the last commit: `Csps.Domain.UnitTests` 1142 passed; `Csps.Application.UnitTests` 1768 passed; `Csps.ArchitectureTests` 241 passed (includes the no-inline-SQL and trigger scans); `Csps.Infrastructure.IntegrationTests` 718 total, 717 passed, 1 skipped (the same skip as before); `Csps.Server.IntegrationTests` 1671 total, 1670 passed, 1 failed. The one failure is the known `ExpenseListTimingTests` (D-76): it failed in both full runs I made (five years, last page, size 100: p95 415.6 ms in the first, p95 over 300 ms again in the second) and I left it alone as instructed. The order timing test passed in the same full runs.
- `tools/scripts/Invoke-CoverageGate.ps1`: Csps.Domain line 100% (2310/2310), branch 100% (940/940); Csps.Application line 98% (6001/6120), branch 94.8% (not gated). "Coverage gate passed."
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json." The snapshot was refreshed with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` for one command only (that run fails by design once), then the snapshot test passed without it, then `npm --prefix tools/openapi-gen run generate`.
- `*MigrationScriptTests` 6 passed (no pending model changes); `*OrdersMigrationTests` 19 passed.
- Acceptance criteria: `ListOrders` in the controller 4 (at least 1); `.Sum(` in `OrderReader.cs` 0 (nothing); `LikePattern` in `OrderReader.cs` 5 (at least 1); `RecentEndStateDays` 1 + 1 = 2 (at least 2); `hasBalance` in `docs/api/orders.md` 2 (at least 1); `IX_Orders_List_Due` in `OrderConfiguration.cs` 1 (exactly 1); `CreateIndex` in the migration 7 (at least 6); `CreateTable|DropTable|DropColumn` 0; `order` in `list-performance.md` 19 (at least 1).
- gitleaks on each staged change: no leaks. Only fake values appear (`example.com` addresses, made-up names and numbers, no real customer data). No em or en dash in any changed source file or the added doc text. No package, trigger, SQL string or JSON column was added.

## Task Commits

1. **Task 1: tracer, list by due date with stored totals** - RED `2a8e4ea3`, GREEN `9c8967a6`
2. **Task 2: search, filters, sort and paging** - RED `1eb66a3f`, GREEN `08d17224`
3. **Task 3: indexes, two commands, p95 proof** - RED `c3cd341d`, GREEN `fbdc3aac`

## Decisions Made

See key-decisions above. The ones the owner should know about: how `newest` sorts, ORD-01 and ORD-02 staying unmarked, and the new wording below.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The wire row cannot be named `OrderListItem`**
- **Found during:** Task 1.
- **Issue:** The plan names the list row `OrderListItem`, but `Csps.Application.OrderLists.OrderListItem` already exists (the product type, payment method and category list entry). Two types with one name would clash in the OpenAPI schema and in the generated TypeScript.
- **Fix:** The row is `OrderListEntry`. The page is `OrderListResponse` as planned.
- **Files modified:** `src/Csps.Application/Orders/OrderListResponse.cs` and its users.
- **Commit:** 9c8967a6

**2. [Rule 1 - Bug] An existing test listed the exact index set of Orders**
- **Found during:** Task 3 GREEN, `OrdersMigrationTests.TheIndexSetIsInPlace`.
- **Issue:** It asserted that Orders had exactly four indexes and OrderItems exactly four, so the new indexes would fail it.
- **Fix:** It now asserts that those original indexes are still present; the full set is checked in the new `OrderListIndexesMigrationTests`.
- **Files modified:** `tests/Csps.Infrastructure.IntegrationTests/Persistence/OrdersMigrationTests.cs`
- **Commit:** fbdc3aac

**3. [Rule 2 - Missing critical functionality] The Application coverage gate counts unit tests only**
- **Found during:** Task 3, before the coverage run.
- **Issue:** The new handler was covered only by integration tests, which the gate does not count.
- **Fix:** `ListOrdersHandlerTests` (14 cases): no caller, bad query never reaches the reader, defaults, every part parsed, status scopes, balance flag, blank parts, row mapping. Application line coverage is 98%.
- **Files modified:** `tests/Csps.Application.UnitTests/Orders/ListOrdersHandlerTests.cs`
- **Commit:** fbdc3aac

### Plan notes (no behaviour change beyond what the plan states)

- **Migration name.** `dotnet ef` named it `20261028225721_AddOrderListIndexes`, not the `...000008` in the plan.
- **`newest` and `IX_Orders_OrderDate`.** The plan does not define `newest`. I made it latest order date, then latest recorded, then id, and gave `IX_Orders_OrderDate` the keys (order date descending, recorded descending, id) instead of the plan's (order date descending, id). `IX_Orders_CreatedAtUtc` is created as planned but no sort uses it today; it costs a little on every order save. Say if you want it dropped (a one-line migration change).
- **Request shape.** `Page` and `PageSize` are plain numbers with defaults (1 and 20), like the expense list, instead of nullable; `HasBalance` is `bool?`. A missing value takes the default either way.
- **Clock.** The handler uses `TimeProvider`, not `IBusinessCalendar`, to stay at two commands. The tests use the real clock and set `StatusChangedAtUtc` on rows 29, 31 and 45 days back instead of a `FakeTimeProvider`, which tests the same window without a second host.
- **Redundant index kept.** `IX_OrderItems_ProductTypeId` (from 07-05) is now covered by the new `IX_OrderItems_ProductTypeId_OrderId`. I did not drop it, because a drop is a one-way door for you to approve.
- **Extra timing cases.** Besides the five in the plan, the timing test also times the newest, balance and total sorts.
- **Files beyond the plan's list:** `tests/Csps.Application.UnitTests/Orders/ListOrdersHandlerTests.cs`, `tests/Csps.Infrastructure.IntegrationTests/Persistence/OrdersMigrationTests.cs` (edited).
- **New user-facing wording for you to review:** "Choose a sort order." (an unknown sort). Everything else reuses approved sentences: "Choose a status.", "Enter a real date.", "Choose a product type.", "Use a page from 1 to 100000.", "Use a page size from 1 to 100.", "Use 100 characters or fewer.", and the plan's "The end date can't be before the start date."

**Total deviations:** 3 auto-fixed (Rule 3, Rule 1, Rule 2), 7 plan notes. **Impact:** one sort definition and one unused index for the owner to rule on; no change to scope.

## Issues Encountered

- `ExpenseListTimingTests` failed in both full Server runs (machine speed, D-76). Not touched. The standalone order timing run and the order timing inside the full runs passed.
- The working tree stores files with CRLF; edits kept the line endings, and git only prints the usual LF to CRLF notice.
- The first OpenAPI snapshot run with the write flag fails by design; the second run, without the flag, passes.
- I ran two harmless empty commands by mistake (`cat > /dev/null` with the input closed, and a heredoc to a scratch file). Neither read the terminal or left anything running.

## Deferred Issues

**Owner ruling D-45 (2026-10-28):** keep `newest` as built, drop the two unused indexes, and "Choose a sort order." is approved. The index drop is queued in `deferred-items.md`.

- **For the owner, a ruling on `newest`:** latest order date first (what I built), or latest recorded first. My recommendation is the order date, because imported orders are all recorded at the same instant.
- **For the owner, `IX_Orders_CreatedAtUtc`:** keep (as planned, unused today) or drop it. My recommendation is drop it, unless a recorded-time sort is wanted.
- **For the owner, `IX_OrderItems_ProductTypeId`:** now redundant. Keep or drop it. My recommendation is keep, until a later cleanup.
- **Phase 8:** the order list screen makes ORD-01 and ORD-02 true end to end. ORD-01 also names a cover image thumbnail, which waits for the images phase.
- **The customer-name search** scans the text (it must look inside it), and was the slowest case at 98 ms p95 on 14,600 orders. It is the one to watch as data grows; the runbook says to tell the owner before changing how search works.
- **Open from D-39, still parked in the STATE.md owner backlog:** refunds on a soft-deleted order and money on hand. Nothing here touches it.
- The `ExpenseListTimingTests` machine-speed failure in `deferred-items.md` stands; owner ruling D-76.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-07-46 (search injection and wildcard abuse) is mitigated by LINQ only, `LikePattern` escaping, the literal `%`, `_` and `[` cases in the endpoint tests, and the architecture scan for inline SQL (241 passed). T-07-47 (huge or deep pages) is mitigated by pageSize at most 100, page at most 100000, q at most 100, the index set, and the two-command and p95 tests. T-07-48 (deleted orders leaking) is mitigated by the named SoftDelete filter and the endpoint test that checks list, count and search. No package was added.

## Authentication Gates

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

Ready for plan 07-17. The order list is a stable two-command read over the stored totals; the Phase 8 screen can build on its parameter names (`q`, `status`, `from`, `to`, `productType`, `hasBalance`, `sort`, `page`, `pageSize`). `OrderTimingData` can seed a five-year order set for any later order speed test.

## Self-Check: PASSED

All 15 files listed under key-files.created exist on disk, and all six task commits (2a8e4ea3, 9c8967a6, 1eb66a3f, 08d17224, c3cd341d, fbdc3aac) are ancestors of HEAD. The acceptance criteria above were re-run after the last commit.
