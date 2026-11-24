---
created: 2026-11-23T18:50:48-06:00
updated: 2026-11-23T18:50:48-06:00
phase: 13-quote-inquiries
plan: 20
subsystem: quote-requests-staff-api
tags: [quote-requests, orders, conversion, prefill, row-lock, unique-index, image-removal, audit, ef-core, tdd]
status: complete

requires:
  - phase: 13-quote-inquiries
    provides: "13-16 the detail read, the status history with its OrderId column and the Converted lock on status moves; 13-18 notes, the Manager delete (refuses Converted) and AuditActions at 136; W7 the one-snapshot detail read"
provides:
  - "GET /api/v1/quote-requests/{id}/order-prefill (GetQuoteRequestOrderPrefill, Staff): customerName, teamName, contactNumber (display form), email, notes (the message), receivedOn (business day), productTypeId"
  - "CreateOrderRequest.QuoteRequestId (optional, last): the order save locks the request before the number, turns it Converted, links it and records quote-request.converted"
  - "404 quote-requests.not-found and 409 quote-requests.already-converted (extensions orderId, orderNumber) on POST /api/v1/orders"
  - "QuoteRequests.OrderId: nullable, FK to Orders with NO ACTION, filtered unique index IX_QuoteRequests_OrderId; migration 20261124001102_AddQuoteRequestOrderLink (additive only)"
  - "QuoteRequest.MarkConverted(orderId, by, at); QuoteRequestStatusChange carries the order on the conversion row"
  - "OrderDetailResponse.QuoteRequestId (also inside the deleted-order detail); QuoteRequestDetailResponse.OrderId and OrderNumber"
  - "The permanent order delete removes the linked request with its photo places, notes and history and queues its stored photos as OrderDeleted (D-22)"
  - "AuditActions.QuoteRequestConverted = quote-request.converted (catalog 137), web label 'Quote request turned into an order'"
  - "Error.Conflict(code, message, extensions); IQuoteRequestStore.LockForConversionAsync, FindConversionAsync, FindByOrderAsync; IQuoteRequestReader.GetOrderPrefillAsync"
affects: [13-22, 13-24, 13-25]

actuals:
  tokens: 65400
  tasks: 3
  commits: 6
plan_head_before: 2074c0222f92f5d0f86bcdfa8f767f166b524830
plan_head_after: f46d5cb65de721a1c6af5460182a1c5f4bd781f4

tech-stack:
  added: []
  patterns:
    - "Conversion lock: one conditional ExecuteUpdate (id matches and status is not Converted) inside the order transaction, taken last before the number so no failure after it leaves the row changed; zero rows means read the state and answer 404 or 409"
    - "Two-way link read without extra commands: the order header query carries a reverse-lookup subquery, the request header query joins the order with the soft-delete filter lifted"
    - "A child aggregate that lives as long as its parent: the parent's permanent delete finds it, queues its files and removes it first in the same save"

key-files:
  created:
    - src/Csps.Application/QuoteRequests/GetOrderPrefillHandler.cs
    - src/Csps.Application/QuoteRequests/OrderPrefillResponse.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261124001102_AddQuoteRequestOrderLink.cs
    - src/Csps.Infrastructure/Persistence/Migrations/20261124001102_AddQuoteRequestOrderLink.Designer.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/GetOrderPrefillHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteConversionTests.cs
    - tests/Csps.Server.IntegrationTests/Orders/PermanentlyDeleteOrderTests.cs
  modified:
    - src/Csps.Domain/QuoteRequests/QuoteRequest.cs
    - src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs
    - src/Csps.Domain/QuoteRequests/QuoteRequestStatusChange.cs
    - src/Csps.Domain/Common/Error.cs
    - src/Csps.Domain/Auditing/AuditActions.cs
    - src/Csps.Application/Orders/CreateOrderRequest.cs
    - src/Csps.Application/Orders/CreateOrderHandler.cs
    - src/Csps.Application/Orders/OrderDetailResponse.cs
    - src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs
    - src/Csps.Application/Ports/IQuoteRequestStore.cs
    - src/Csps.Application/Ports/IQuoteRequestReader.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestAuditDetail.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestDetailResponse.cs
    - src/Csps.Application/QuoteRequests/GetQuoteRequestHandler.cs
    - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestConfiguration.cs
    - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestReader.cs
    - src/Csps.Infrastructure/Orders/OrderReader.cs
    - src/Csps.Server/Controllers/QuoteRequestsController.cs
    - src/Csps.Server/Controllers/OrdersController.cs
    - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
    - tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs
    - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
    - tests/Csps.Domain.UnitTests/Common/ErrorTests.cs
    - tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs
    - tests/Csps.Application.UnitTests/Orders/OrderDeletionHandlerTests.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/GetQuoteRequestHandlerTests.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tests/Csps.Server.IntegrationTests/Http/OpenApiOrderWriteContractTests.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - web/src/modules/admin/auditCopy.ts
    - web/src/modules/admin/auditCopy.test.ts
    - web/src/test/quoteRequestFixtures.ts
    - docs/api/quote-requests.md
    - docs/api/orders.md

key-decisions:
  - "The conversion lock is taken inside the order transaction after the public website block and right before the number, so a refused request takes no number and no failure after the lock leaves the request's row changed"
  - "Converting is allowed from every status but Converted, Spam and Closed included (the plan's lock rule: status not Converted)"
  - "The suggested product type is the first active type of the line by name (ordinal, ignoring case, then id), the order the product type list shows; ProductType has no sort column"
  - "receivedOn is the business day in the shop's time zone"
  - "The 409 carries orderId and orderNumber as ProblemDetails extensions; with no order link it is the same 409 with no extensions"
  - "OrderDetailResponse.QuoteRequestId has a default of null, so it is optional in the generated types and no order fixture outside quoteRequestFixtures.ts had to change; the server always sends it"
  - "The deleted-order detail carries the link inside order.quoteRequestId, not as a second member"
  - "The permanent order delete also records quote-request.deleted (status=converted;photos=n) for the request it removes"

requirements-completed: [INQ-06, INQ-07]

coverage:
  - id: D1
    description: "Staff of either role read the New Order prefill: display phone that passes the order number rule, message as notes, business day received, first active product type of the chosen line or null for Custom design and Not sure yet; unknown is 404, anonymous 401"
    requirement: INQ-06
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/QuoteRequests/GetOrderPrefillHandlerTests.cs (9 tests)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteConversionTests.cs#ThePrefillHasTheDisplayPhoneTheMessageTheReceivedDayAndTheFirstActiveTypeOfTheLine, CustomDesignOrNotSureSuggestsNoProductType, AManagerReadsThePrefillAndAnUnknownRequestIs404"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs (prefill row 401/404/404)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Saving an order with quoteRequestId converts the request, stores the order id, adds a Converted history row with the order, records quote-request.converted and drops the New count, all in the order transaction; an unknown request is 404 and saves no order"
    requirement: INQ-06
    verification:
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs (conversion cases)"
        status: pass
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteConversionTests.cs#SavingTheOrderWithTheRequestConvertsLinksRecordsAndLeavesTheNewCount, AnUnknownRequestIs404AndSavesNoOrder"
        status: pass
    human_judgment: false
  - id: D3
    description: "One request makes one order: two saves at once give one 201 and one 409 quote-requests.already-converted naming the first order, no second number is taken, a later save is the same 409, and the unique index refuses a second request row with the same order"
    requirement: INQ-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteConversionTests.cs#TwoSavesAtOnceMakeOneOrderAndTheOtherIs409WithTheFirstOrder, ASaveAfterTheConversionIs409WithTheFirstOrderAndSavesNothing, ASecondRequestRowWithTheSameOrderFailsOnTheUniqueIndex"
        status: pass
    human_judgment: false
  - id: D4
    description: "The order detail and the deleted-order detail carry quoteRequestId; the request detail carries orderId and orderNumber, also after the order is soft-deleted"
    requirement: INQ-06
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteConversionTests.cs#TheOrderAndTheRequestPointAtEachOtherAndADeletedOrderKeepsTheLink"
        status: pass
    human_judgment: false
  - id: D5
    description: "A permanent order delete removes the converted request with its photo places, notes and history, queues its stored photos as OrderDeleted and records quote-request.deleted; a soft delete and restore keep the link; an order with no request is deleted as before"
    requirement: INQ-07
    verification:
      - kind: integration
        ref: "tests/Csps.Server.IntegrationTests/Orders/PermanentlyDeleteOrderTests.cs (3 tests)"
        status: pass
      - kind: unit
        ref: "tests/Csps.Application.UnitTests/Orders/OrderDeletionHandlerTests.cs (3 new cases)"
        status: pass
    human_judgment: false

duration: about 61 min
completed: 2026-11-23
---

# Phase 13 Plan 20: Staff turn a quote request into a prefilled order, and the two stay linked Summary

*Created: 2026-11-23T18:50:48-06:00 · Updated: 2026-11-23T18:50:48-06:00*

**Staff read a New Order prefill for a quote request, and saving the order with `quoteRequestId` turns the request Converted and links the two in the same transaction. A row lock, the 409 that names the first order and a filtered unique index keep one request to one order. Both detail answers point at each other. A permanent order delete takes the request and its photos with it.**

## Performance

- **Duration:** about 61 min
- **Started:** 2026-11-23T17:50:20-06:00
- **Completed:** 2026-11-23T18:50:48-06:00
- **Tasks:** 3 (one tracer, two TDD)
- **Files:** 45 changed (7 new source and test files, 2 generated migration files)

## What was built

- **Prefill.** `GET /api/v1/quote-requests/{id}/order-prefill` (`GetQuoteRequestOrderPrefill`, Staff). It answers:
  - `quoteRequestId`, `customerName`, `teamName` and `email`;
  - `contactNumber` in its display form (`0917 123 4567`), which passes `OrderRules.IsValidContactNumber`;
  - `notes`, which is the visitor's message;
  - `receivedOn`, the business day the request arrived;
  - `productTypeId`, the first active type filed under the chosen line, or `null` for Custom design, Not sure yet or no choice.

  It is a `GET`, so the repeat-press guard stores nothing. A Converted request still answers.
- **Conversion.** `CreateOrderRequest` gains the optional `Guid? QuoteRequestId` as its last member, so existing callers do not change. Inside the existing order transaction, after the public website block and before the number:
  - `LockForConversionAsync` runs one conditional `ExecuteUpdate`: the id matches and the status is not Converted.
  - Then: load, `MarkConverted` (Converted, the order id, a history row that names the order, a new edit version), and the audit entry `quote-request.converted` with `order=<id>`. Then the normal save.
  - The order math and every order rule are unchanged.
- **One request, one order (D-23).** When the lock matches nothing, `FindConversionAsync` reads the request:
  - missing: `404 quote-requests.not-found`;
  - present: `409 quote-requests.already-converted`, "This quote request was already turned into an order.", with `orderId` and `orderNumber` extensions. The number is read with the soft-delete filter lifted.

  No order is saved and no number is taken. The idempotency gate does not keep a 409, so that path rolls back. `Error.Conflict` gained an overload with extra members. `QuoteRequests.OrderId` has a NO ACTION foreign key to Orders and the filtered unique index `IX_QuoteRequests_OrderId`. Migration `20261124001102_AddQuoteRequestOrderLink` adds one nullable column, one index and one foreign key. No trigger, no JSON, no inline SQL, and the compat level is unchanged.
- **Link both ways (D-21).**
  - `OrderDetailResponse.QuoteRequestId` comes from a reverse-lookup subquery in the order header query. The deleted-order detail carries it inside `order`.
  - `QuoteRequestDetailResponse` gains `orderId` and `orderNumber`, joined in the first command of the W7 snapshot loop. An unchanged read is still 5 commands, so `QuoteRequestReaderDetailSnapshotTests` needed no change, and it passes.
  - Photos stay on the request.
- **Permanent delete (D-22).** `PermanentlyDeleteOrderHandler` finds the request made from the order (`FindByOrderAsync`, tracked with its photo places), all in the same save:
  - queues each stored photo with `ImageDeletionReason.OrderDeleted`;
  - records `quote-request.deleted` with `status=converted;photos=<n>`;
  - removes the request before the order. Notes and history go by cascade.

  Before this, the same delete answered 500 because the link blocked it. A soft delete keeps the request and its link, and a restore shows it again. The Manager delete still refuses a Converted request, and a status move on a Converted request is still refused.
- **Audit catalog** is now 137, with the web label "Quote request turned into an order" under Orders.
- **Contract.** `CreateOrder` now declares a 404. Its OpenAPI text names `quoteRequestId` and the new answers, and the permanent-delete text says the request goes with the order. The OpenAPI snapshot and `web/src/types/api.generated.ts` were refreshed three times. `quoteRequestDetail()` defaults `orderId` and `orderNumber` to `null`.
- **Docs.** `docs/api/quote-requests.md` covers the prefill, the save, the 404 and 409, the link and retention. `docs/api/orders.md` covers the form field, the order member, the new answers and the delete rule.

## Task Commits

1. **Task 1 (tracer): prefill and conversion.** RED `c1f3ea8f` (test), GREEN `5c59514c` (feat).
2. **Task 2: one order per request and the two-way link.** RED `3fcca2d5` (test), GREEN `d6f99aae` (feat).
3. **Task 3: the permanent delete takes the request.** RED `faa01f87` (test), GREEN `f46d5cb6` (feat).

No REFACTOR commit was needed.

## TDD record

The RED outputs are xUnit MTP and vitest console text. `gsd_run check tdd-red-evidence` does not read that format, so I assessed each RED by hand from the real output.

**Task 1 (tracer)**
- RED `c1f3ea8f`:
  - Domain: 10 of 230 failed. `MarkConverted` from each of the five hand-set statuses: `result.IsSuccess should be True`. The second conversion. `Error.Conflict` extensions: "should be same as". The catalog count (`AuditActions.All.Count should be 137`), the catalog tail and the missing `QuoteRequestConverted` field.
  - Application: 12 of 69 failed. The prefill stub answered 404, so the success cases hit "A failed result has no value". The conversion cases: "A successful result has no error", and the order check found no lock call (`CallSequenceNotFoundException`).
  - Server: QuoteConversionTests failed 6 of 6. The prefill route answered 404. The request stayed `new` after the save. An unknown request id still saved the order. The write contract had no 404. Matrix: the anonymous row and the coverage test failed. The parallel matrix test failed too, because it calls every row.
  - Web: 3 of 101 failed (`expected 'quote-request.converted' to be 'Quote request turned into an order'`, and the length was 136, not 137).
  - Every failure was on the planned assertion.
- GREEN `5c59514c`:
  - server QuoteConversion, CreateOrderEndpoint, OpenApiOrderWriteContract, AuthorizationMatrix and OpenApiSnapshot: 683 of 683;
  - application: 69 of 69; domain: 2237 of 2237; web: 101 of 101;
  - infrastructure migration, trigger and reader snapshot: 212 of 212; architecture: 290 of 290;
  - `dotnet format`: exit 0.
- Tracer gate: the run is interactive, the mode is `end-of-phase` and the verify is automated only. Both Task 1 verify commands ran end to end and passed before Task 2 started.

**Task 2**
- RED `3fcca2d5`:
  - Application: 3 of 68 failed. The handler still answered 404 where a 409 was expected (2 cases). The detail mapped no order (1 case).
  - Server: 4 of 25 failed. Two saves at once gave 201 and 404, not 201 and 409. A save after the conversion was 404, not 409. `quoteRequestId` was null. The snapshot differed.
  - The unique-index case passed already, because Task 1 built the index. It is a regression guard, not RED evidence.
- GREEN `d6f99aae`:
  - server: 25 of 25; application QuoteRequest and Order classes: 1019 of 1019;
  - infrastructure reader snapshot, order reader and store: 62 of 62;
  - web typecheck: clean.

**Task 3**
- RED `faa01f87`:
  - Application: 2 of 27 failed (`FindByOrderAsync` was never called).
  - Server: a permanent delete of a converted order answered `500 "Something went wrong."` instead of 204. The soft-delete and no-request cases passed already; they are regression guards.
- GREEN `f46d5cb6`:
  - server PermanentlyDeleteOrder and QuoteConversion: 13 of 13;
  - infrastructure MigrationScript, TriggerInventory and QuoteRequestRetentionJob: 22 of 22;
  - `dotnet build Csps.slnx -warnaserror`: 0 warnings, 0 errors.

## Final verification (quoted)

- `dotnet build Csps.slnx -warnaserror`: "Build succeeded.", "0 Warning(s)", "0 Error(s)".
- `dotnet format Csps.slnx --verify-no-changes`: exit 0.
- Server, `--filter-namespace` Orders and QuoteRequests: total 529, failed 0.
- Server, AuthorizationMatrix, AuthorizationCoverage, IdempotencyCoverage, OpenApiSnapshot, OpenApiExposure, OpenApiOrderWriteContract and PermanentlyDeleteOrder: total 672, failed 0.
- Infrastructure, QuoteRequests, Maintenance and Orders namespaces: total 134, failed 0. MigrationScriptTests, TriggerInventoryTests and MigrationTests: total 209, failed 0.
- `dotnet test --project tests/Csps.Application.UnitTests`: total 3490, failed 0.
- `dotnet test --project tests/Csps.Domain.UnitTests`: total 2237, failed 0.
- `dotnet test --project tests/Csps.ArchitectureTests`: total 290, failed 0.
- `npm --prefix tools/openapi-gen run check`: "Generated API types match tools/openapi-gen/openapi.v1.json."
- `npm --prefix web run typecheck`: clean.
- Web vitest:
  - `auditCopy.test.ts` plus `src/test` (no-long-dash and source layout included): 20 files, 478 tests passed;
  - `AuditLogPage`: 69 of 69;
  - the quote inbox and strip: 51 of 51;
  - the detail card and services: 436 of 436.
- `prettier --check` and `eslint --max-warnings 0` on the touched web files: clean. ESLint only warns that the generated types file is on its ignore list.
- Acceptance greps:
  - `QuoteRequestId` in CreateOrderRequest.cs: 2;
  - `ShouldBe(137)` in AuditActionsTests.cs: 1;
  - `quote-requests.already-converted` in QuoteRequestErrors.cs: 1;
  - `QuoteRequestId` in OrderDetailResponse.cs: 2;
  - `QuoteRequest` in PermanentlyDeleteOrderHandler.cs: 3.
- The preflight ran before every LocalDB run, and ports 5180, 5115, 7028 and 5199 were free each time. Some runs listed the parallel 13-21 executor's own CSPS processes in its worktree (eslint, vitest and an `@quote` e2e on CSPS_E2E). No TheBETSLLC process appeared. My tests use their own `CSPS_Test_<guid>` databases, so they went ahead.
- gitleaks (the pre-commit hook and `gitleaks protect --staged`) found no leaks on all six commits. The test data uses made-up names and `example.test` or `example.com` addresses, and no local paths were staged.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] A 409 could not carry extra members**
- **Found during:** Task 1 RED (needed for the Task 2 409).
- **Issue:** `Error` carried extra members only for validation errors.
- **Fix:** `Error.Conflict(code, message, extensions)`, plus a domain test. The ProblemDetails mapping already copies any extensions.
- **Files:** `src/Csps.Domain/Common/Error.cs`, `tests/Csps.Domain.UnitTests/Common/ErrorTests.cs`. Commits `c1f3ea8f` and `5c59514c`.

**2. [Rule 1 - Bug] An acceptance grep could not see the code**
- **Found during:** final checks.
- **Issue:** the literal `quote-requests.already-converted` lives in `QuoteRequestRules`, and `QuoteRequestErrors` only references it, so the plan's grep found 0.
- **Fix:** the constant's doc comment names the code. Commit `f46d5cb6`.

### Plan notes

- **Files outside files_modified:**
  - domain: `QuoteRequestRules.cs` (the code and text), `QuoteRequestStatusChange.cs` (the order on the conversion row), and `Error.cs` with its test;
  - application: `IQuoteRequestReader.cs` (the prefill view and the order members of the detail view), `GetQuoteRequestHandler.cs` (maps them), `QuoteRequestAuditDetail.cs` (`Converted`);
  - server: `OrdersController.cs` (the create and permanent-delete contract text and the 404);
  - tests: the new `GetOrderPrefillHandlerTests.cs`, `GetQuoteRequestHandlerTests.cs` and `OrderDeletionHandlerTests.cs`;
  - web: `web/src/test/quoteRequestFixtures.ts`, as the orchestrator asked.
- **Not changed:** `DeletedOrderDetailResponse.cs`. It wraps `OrderDetailResponse`, so the link arrives as `order.quoteRequestId`.
- **New test file:** `tests/Csps.Server.IntegrationTests/Orders/PermanentlyDeleteOrderTests.cs`. The plan named this file, but it did not exist; the older permanent-delete tests live in `OrderDeletionTests.cs`.
- **Reader snapshot test:** the command count did not change, because the order number joins the first command. The test passes as it is.
- **Branch:** the plan text says `gsd/phase-13-quote-inquiries`. This ran on the orchestrator's worktree branch `worktree-agent-ab89ceda6d1b87730`, as instructed. No branch was created or switched.
- **Commit ledger:** the worktree guard refused the ledger command. I counted commits from the known base instead: `git rev-list --count 2074c022..HEAD` = 6 before this summary.
- **Actuals:** 65,400 tokens (chars/4) over the whole diff, of which about 22,900 is hand-written. The rest is the generated migration designer and model snapshot.
- **Packages:** `npm ci` ran in `web/` and `tools/openapi-gen/` of this worktree. That installs the locked packages only; nothing was added or changed.
- **MSBuild:** its build nodes (node reuse) may still be idle on the machine and close by themselves. I did not run `dotnet build-server shutdown`, because it could also stop nodes another session started.
- I did not touch STATE.md, ROADMAP.md or DECISIONS.md.

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug). **Impact on plan:** both were needed to meet the plan's contract and its checks. No scope creep.

## Not run here

- The full .NET Server and Infrastructure suites, the full web suite and the Playwright e2e. The orchestrator's gate covers them.

## Flakes

None. Every test passed on its first run in the targeted and grouped runs. The known `ParallelCallersEachGetTheirOwnStatus` flake did not show up. Its one RED failure came from the new matrix row before the route existed.

## Authentication Gates

None.

## Known Stubs

None. Every RED stub was replaced by its GREEN commit: the failing `MarkConverted`, the dropped extensions, the prefill handler that answered 404, the EF ignore of `OrderId`, `FindConversionAsync` and `FindByOrderAsync` answering null, and the handlers ignoring the store.

## Threat Flags

None beyond the plan.
- T-13-59: the conditional `ExecuteUpdate` lock in the order transaction and the filtered unique index; tested by the parallel test and the unique-index test.
- T-13-60: order create and the prefill are Staff, and the prefill has a matrix row. The request id is checked to exist (404).
- T-13-61: the request's stored photos are queued as OrderDeleted in the same save as the permanent delete.
- T-13-SC: no package was added or bumped.

## Owner items

Nothing blocks. You were away, so I made these choices; A is what I built.

1. **Privacy of the stored order answer (W7 IN-01, W8 WR-01).** This plan adds no quote request write answer: the prefill is a `GET`, and the conversion happens inside the order create.
   - The order create answers the full order, as the plan and 13-22 expect. That includes the customer name, phone, email and the notes copied from the message.
   - The idempotency gate keeps that answer for 24 hours, as it does for every order save.
   - New with D-22: a permanent order delete now also removes the request, but an order created less than 24 hours before still has its stored answer.
   - A (built): accept it, the same as every other order save.
   - B: when `quoteRequestId` is set, answer a slim `{ id, number, version }` instead. That breaks the order create contract that 13-22 uses, so it is not built.
2. **Optional `quoteRequestId` in the order types.**
   - A (built): the field has a default of `null`, so it is optional in `api.generated.ts`. No order fixture outside `quoteRequestFixtures.ts` had to change. The server always sends it.
   - B: make it required, and add `quoteRequestId: null` to `buildOrderDetail()` in `web/src/test/orderFixtures.ts`.
3. **Audit on a permanent delete.**
   - A (built): two entries, `order.permanently-deleted` and `quote-request.deleted` (`status=converted;photos=<n>`).
   - B: only the order entry, perhaps with `quoteRequest=<id>` in its detail.
4. **Which statuses can be converted.**
   - A (built): every status but Converted, Spam and Closed included.
   - B: refuse Spam, with a 400.
5. **Which product type is suggested.**
   - A (built): the first active type of the line by name, the order the product type list shows. There is no sort column, so "sort order" in the plan was read as the list order.
   - B: add a sort column. That is a schema change.
6. **Where the lock sits.**
   - A (built): last before the number, after the public website block.
   - B: first in the transaction. Then a refused public website block would still move the request's row version.
7. **Wording to confirm.** "This quote request was already turned into an order." (409; the 13-22 page shows its own box text) and the audit label "Quote request turned into an order".
8. **The deleted-order link.**
   - A (built): inside `order.quoteRequestId`.
   - B: also a top-level member.
9. **`receivedOn`.**
   - A (built): the business day in the shop's time zone.
   - B: the UTC time it arrived.
10. No package was added or changed.

## Next Phase Readiness

The server side of Turn into Order is ready for the web plan 13-22. It provides:
- `GET /quote-requests/{id}/order-prefill`;
- `quoteRequestId` on the order form and in the order answers;
- the 409 extensions `orderId` and `orderNumber`;
- `orderId` and `orderNumber` on the request detail.

## Self-Check: PASSED

- Files exist: `GetOrderPrefillHandler.cs`, `OrderPrefillResponse.cs`, `20261124001102_AddQuoteRequestOrderLink.cs` and its Designer file, `GetOrderPrefillHandlerTests.cs`, `QuoteConversionTests.cs`, `PermanentlyDeleteOrderTests.cs`.
- Commits reachable from HEAD: `c1f3ea8f`, `5c59514c`, `3fcca2d5`, `d6f99aae`, `faa01f87`, `f46d5cb6`.
- TDD gates: each task has a `test(13-20)` commit followed by a `feat(13-20)` commit that descends from it.

---
*Phase: 13-quote-inquiries*
*Completed: 2026-11-23*
