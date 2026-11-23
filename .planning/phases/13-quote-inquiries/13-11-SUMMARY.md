---
phase: 13-quote-inquiries
plan: 11
subsystem: quote-requests-staff-api
status: complete
tags: [quote-requests, staff-inbox, list, search, paging, new-count, ef-core, tdd]
created: "2026-11-23T01:30:00-06:00"
updated: "2026-11-23T01:30:00-06:00"

requires:
  - phase: 13-quote-inquiries
    provides: "QuoteRequest aggregate, QuoteRequests and QuoteRequestPhotos tables, the public create call (plans 13-01 to 13-07)"
provides:
  - "GET /api/v1/quote-requests (ListQuoteRequests): Staff, status group, q, page, size, newest first, server-made pill counts"
  - "GET /api/v1/quote-requests/new-count (GetNewQuoteCount): Staff, one shared number"
  - "IQuoteRequestReader and QuoteRequestReader (list, pill counts, New count)"
  - "ListQuoteRequestsRequest and validator, QuoteRequestSearchText.PhoneDigits, ListQuoteRequestsHandler, GetNewQuoteCountHandler"
  - "Authorization matrix rows for both reads"
affects: [13-15, 13-16, 13-17, 13-19]

actuals:
  tokens: 15000
  tasks: 3
  commits: 6
plan_head_before: 9f2e47349aff04ad0cd9111f9d9cacdd0d89f6a8
plan_head_after: 6df266d0b7e76c378ffaee5b04c590eeff07f477

tech-stack:
  added: []
  patterns:
    - "Inbox list: three SQL commands (count, page, one grouped pill count), every sort ends on the id"
    - "Phone search on E.164 digits with LINQ Contains; name and team through the shared LikePattern helper"

key-files:
  created:
    - src/Csps.Server/Controllers/QuoteRequestsController.cs
    - src/Csps.Application/Ports/IQuoteRequestReader.cs
    - src/Csps.Application/QuoteRequests/ListQuoteRequestsRequest.cs
    - src/Csps.Application/QuoteRequests/ListQuoteRequestsRequestValidator.cs
    - src/Csps.Application/QuoteRequests/ListQuoteRequestsHandler.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestListResponse.cs
    - src/Csps.Application/QuoteRequests/QuoteRequestSearchText.cs
    - src/Csps.Application/QuoteRequests/GetNewQuoteCountHandler.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestReader.cs
    - tests/Csps.Application.UnitTests/QuoteRequests/ListQuoteRequestsRequestValidatorTests.cs
    - tests/Csps.Server.IntegrationTests/QuoteRequests/ListQuoteRequestsTests.cs
  modified:
    - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
    - src/Csps.Infrastructure/QuoteRequests/QuoteRequestsRegistration.cs
    - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
    - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
    - tools/openapi-gen/openapi.v1.json
    - web/src/types/api.generated.ts
    - docs/api/quote-requests.md

key-decisions:
  - "Page size is a four-value allow-list (10, 20, 50, 100) named size, as the plan says, not the 1 to 100 rule the orders list uses"
  - "A bad list query is 400 quote-requests.list-invalid, not the form's quote-requests.validation, because its text is about the form"
  - "A search of fewer than 3 digits is no phone search, so one digit never matches every number"
  - "Name and team search use the shared LikePattern helper (wildcards typed by staff are plain text); the phone uses LINQ Contains on digits only"

requirements-completed: [INQ-05]
---

# Phase 13 Plan 11: Staff can list quote requests by status and search them Summary

**Staff of either role can list quote requests by status group with search and paging, get server-made pill counts, and read one shared New count for the badge.**

## What was built

- `GET /api/v1/quote-requests`: status `open` (default), `converted`, `closed`, `spam` or `all`; `q`; `page`; `size`. Newest received first, id descending breaks ties. Each row has the fields in the plan and no email or message. The answer carries `total`, `page`, `size` and `counts { open, converted, closed, spam, all }` over the whole table.
- `GET /api/v1/quote-requests/new-count`: `{ count }` of requests at status New, the same for every staff member.
- The OpenAPI snapshot, the web types and `docs/api/quote-requests.md` are updated. `npm --prefix tools/openapi-gen run check` passes.

## TDD record

Task 1 (tracer), the open list newest first:
- RED `c7758af8`: 4 integration tests and 3 matrix cases failed with 404 where 200 was expected (target tests ran and failed on the status assertion). Semantic assessment: valid RED, the route did not exist. One first run failed in the seed (a landline number is not a valid quote number); fixed in the test and re-run before the commit.
- GREEN `137a0607`: 593 of 593 passed in the filtered run (list tests, matrix, snapshot). The tracer was re-run end to end after the snapshot refresh before Task 2 started.

Task 2, groups, search, counts and paging:
- RED `aaa46275`: 18 unit tests and 14 integration tests failed on their assertions. The request, validator and phone digits helper were compile-only stubs, so nothing failed on a missing type. Semantic assessment: valid RED, the stub validator accepted everything and the stub digits helper returned null.
- GREEN `ee3bed2f`: unit 41 of 41; integration 608 of 608 on the re-run (see Flakes).

Task 3, the New count:
- RED `26dedde1`: 2 new tests and 3 matrix cases failed with 404 where 200 was expected.
- GREEN `6df266d0`: integration 613 of 613 (list tests, matrix, snapshot). `dotnet build Csps.slnx -warnaserror`: 0 warnings, 0 errors. Architecture tests 290 of 290. Application unit tests 3372 of 3372.

No REFACTOR commit was needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The FluentValidation `Transform` call could not feed `SearchText()`**
- **Found during:** Task 2 GREEN
- **Issue:** `Transform(...)` returns a builder type the shared `SearchText()` rule does not accept.
- **Fix:** `RuleFor(request => request.Q == null ? null : request.Q.Trim()).SearchText().OverridePropertyName("Q")`, so the 100-character cap counts the trimmed text and keeps the shared message and the `Q` field name.
- **Files modified:** `ListQuoteRequestsRequestValidator.cs`
- **Commit:** ee3bed2f

**2. [Rule 3 - Blocking] CA1826 on `request.Photos.Count()`**
- **Fix:** use the `Count` property for the declared photo count; EF translates it.
- **Commit:** 137a0607

**3. [Plan shape] Task 1 stayed minimal**
- The plan lists the validator and request in Task 2, so Task 1 used a fixed open group, page 1 and size 20. Task 2 replaced that with the real query.

## Known Stubs

| File | Line | Reason |
|------|------|--------|
| `src/Csps.Infrastructure/QuoteRequests/QuoteRequestReader.cs` | the `false` argument of `QuoteRequestListRow` | `photosRemoved` is always `false`. The `PhotosRemovedAtUtc` column arrives with plan 13-16 (Spam removes photos), and nothing removes photos before that, so `false` is true today. 13-16 must read the column here, or the inbox "Removed" mark never shows. |

## Owner items

- **Hand-off to 13-16 (needed, not an owner decision):** wire `photosRemoved` in `QuoteRequestReader.ListAsync` to `PhotosRemovedAtUtc != null` when 13-16 adds the column. The 13-16 plan text lists the detail read only, so it may miss this.
- **Wording to confirm:** the 400 for a bad list query uses code `quote-requests.list-invalid` and the text "Check the status, search and page settings." The field messages reuse the shared ones ("Choose a status.", "Use 100 characters or fewer.", "Use a page from 1 to 100000.") plus the new "Use a page size of 10, 20, 50 or 100."
- **Behavior to confirm:** a search with fewer than 3 digits does not search phone numbers. This keeps one typed digit from matching every number. The plan said "at least 3 digits remain" and I applied the same floor to the search itself.
- **Not done:** no `gsd windows append` entry was made for the stub (the ledger command is not available in this run).

## Flakes

- `AuthorizationMatrixTests.ParallelCallersEachGetTheirOwnStatus` failed once with a 500 from the Testing site-content call (`POST /api/testing/site-content`), unrelated to quote requests. It passed on the immediate re-run and in two later runs. Other agents were using the same LocalDB at the time. Recorded, not fixed (outside this plan).

## Threat Flags

None. The two new endpoints sit behind `Policies.Staff` with matrix rows for anonymous 401 (T-13-33). The search cap, the size allow-list and the indexed sort cover T-13-34. No package was added.

## Self-Check: PASSED

- Files exist: the 11 created files listed above.
- Commits exist: c7758af8, 137a0607, aaa46275, ee3bed2f, 26dedde1, 6df266d0.
