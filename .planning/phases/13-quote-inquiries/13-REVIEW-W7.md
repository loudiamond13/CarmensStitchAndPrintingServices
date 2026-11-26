---
phase: 13-quote-inquiries
created: 2026-11-23T13:55:00-06:00
updated: 2026-11-23T13:55:00-06:00
reviewed: 2026-11-23T13:55:00-06:00
depth: standard
wave: 7
plans: [13-16, 13-17]
files_reviewed: 58
files_reviewed_list:
  - docs/api/quote-requests.md
  - src/Csps.Application/Ports/IQuoteRequestReader.cs
  - src/Csps.Application/Ports/IQuoteRequestStore.cs
  - src/Csps.Application/QuoteRequests/ChangeQuoteRequestStatusHandler.cs
  - src/Csps.Application/QuoteRequests/ChangeQuoteRequestStatusRequest.cs
  - src/Csps.Application/QuoteRequests/ChangeQuoteRequestStatusRequestValidator.cs
  - src/Csps.Application/QuoteRequests/GetQuoteRequestHandler.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestAuditDetail.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestDetailResponse.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
  - src/Csps.Domain/Auditing/AuditActions.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequest.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestStatusChange.cs
  - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestStatusChangeConfiguration.cs
  - src/Csps.Infrastructure/Persistence/CspsDbContext.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261123184951_AddQuoteRequestStatusChanges.Designer.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261123184951_AddQuoteRequestStatusChanges.cs
  - src/Csps.Infrastructure/Persistence/Migrations/CspsDbContextModelSnapshot.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestReader.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
  - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
  - src/Csps.Server/Controllers/QuoteRequestsController.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/ChangeQuoteRequestStatusHandlerTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/GetQuoteRequestHandlerTests.cs
  - tests/Csps.Domain.UnitTests/Auditing/AuditActionsTests.cs
  - tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs
  - tests/Csps.Infrastructure.IntegrationTests/Maintenance/QuoteRequestRetentionJobTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/GetQuoteRequestTests.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestStaffRig.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteRequestStatusTests.cs
  - web/e2e/quote-nav.spec.ts
  - web/src/components/index.test.ts
  - web/src/components/navigation/MobileNavDrawer.test.tsx
  - web/src/components/navigation/Sidebar.test.tsx
  - web/src/components/navigation/Sidebar.tsx
  - web/src/components/navigation/index.ts
  - web/src/components/navigation/navItem.recipe.ts
  - web/src/layouts/AdminLayout.test.tsx
  - web/src/layouts/AdminLayout.tsx
  - web/src/modules/admin/auditCopy.test.ts
  - web/src/modules/admin/auditCopy.ts
  - web/src/modules/admin/components/QuoteRequestsStrip.test.tsx
  - web/src/modules/admin/components/QuoteRequestsStrip.tsx
  - web/src/modules/admin/components/TabBar.test.tsx
  - web/src/modules/admin/components/TabBar.tsx
  - web/src/modules/admin/components/admin.recipe.ts
  - web/src/modules/admin/dashboardCopy.ts
  - web/src/modules/admin/hooks/useNewQuoteCountQuery.test.tsx
  - web/src/modules/admin/hooks/useNewQuoteCountQuery.ts
  - web/src/modules/admin/pages/DashboardPage.test.tsx
  - web/src/modules/admin/pages/DashboardPage.tsx
  - web/src/modules/admin/sections.test.ts
  - web/src/modules/admin/sections.ts
  - web/src/test/quoteRequestFixtures.ts
  - web/src/test/setup.ts
findings:
  critical: 0
  warning: 1
  info: 2
  total: 3
status: issues_found
---

# Phase 13, Wave 7: Code Review Report

*Created: 2026-11-23T13:55:00-06:00 · Updated: 2026-11-23T13:55:00-06:00*

**Reviewed:** 2026-11-23
**Depth:** standard
**Files Reviewed:** 58
**Status:** issues_found

## Summary

This review covers plan 13-16 (open one quote request, change its status, Spam removes the photos) and plan 13-17 (the New count on the nav item, the fifth phone tab and the dashboard strip). The diff is `f3aaeb4e..e9c3cb8f`. The generated `openapi.v1.json` and `api.generated.ts` were left out. Test files were read only for reliability and gaps. No tests, dev servers or e2e runs were started. Each finding below was traced in the code. The TanStack Query claim was checked against the installed `@tanstack/query-core` 5.103.2.

The owner items in the two SUMMARYs are not raised again. That includes the upload race in the 13-16 Threat Flags (owner item 7), the missing-name removal on Spam, the arrival row, the history order, the same-status 400, the audit "What changed" line, the 99+ name, polling after a failure, the 61px tabs and the exact strip figure.

Checked and found sound:

- **Authorization (CWE-862, CWE-639):**
  - The controller carries `Policies.Staff`, and both new actions inherit it. Default-deny stays.
  - Both new matrix rows give anonymous 401. The read row gives 404 for both roles, and the status row gives 400 because there is no body.
  - D-13 lets both roles see every request, so an id in the path is not an IDOR.
  - Answers are `NoStore`.
- **Status rules (D-15):**
  - The validator allows only the five keys staff may set. The domain refuses Converted as a target and locks a Converted request, so there are two guards.
  - Who and when come from `requestContext.UserId` and `IBusinessCalendar`, never from the body. No `DateTime.Now`.
  - A same-status move is refused before any history row is added.
- **Row version and transaction:**
  - `RowVersion` is `IsRowVersion()`. The handler compares the client's version in memory (409) and the save compares it again in its `WHERE` clause. A lost race becomes `ConcurrencyConflictException` and then the same 409.
  - The history row, the queued files, the photo deletes, `PhotosRemovedAtUtc` and the audit entry all go in one `SaveChangesAsync` inside `InTransactionAsync`. Under the idempotency gate's outer transaction, the attempt runs in a savepoint.
  - `Enqueue` (not `EnqueueNowAsync`) is used, so a failed save queues nothing.
  - The photo fill is a conditional `ExecuteUpdate` on the photo rows only, so a photo arriving never makes a staff member's version stale.
- **Spam and data loss (D-04, D-22):**
  - `FindAsync` includes the photos, so `RemovePhotos` sees every place.
  - Clearing `_photos` deletes the rows through the required cascade relationship.
  - The queue row starts with `NextAttemptAtUtc = now`, so the daily run (D-34) removes the files within a day.
  - Converted is locked, so a converted request's photos can never be removed by a Spam move.
  - An upload after the move finds no place or a Spam request, and `UploadQuotePhotoHandler` queues its file.
- **Migration:**
  - Additive only: one nullable column, one table, three indexes and two `BETWEEN 1 AND 6` checks that match `QuoteRequestStatus`.
  - The history cascades from `QuoteRequests`, so the 6-month purge takes it along. The user and order links are NO ACTION.
  - No trigger, no JSON column and no inline SQL. It works on an empty database.
  - Plan 13-20 already deletes the linked request with a permanently deleted order (D-22), so the NO ACTION `OrderId` link will not block that delete.
- **Privacy (CWE-532, CWE-200):**
  - The audit detail is `status=from>to` only.
  - Nothing new is logged.
  - The answer has no `publicId` member, and every photo address is built on the server by `IImageDelivery.ForPhoto`.
- **Nav and tab names (WCAG 2.5.3, 4.1.2):**
  - A counted item or tab is named by one visually hidden span ("Quote Requests, 3 new", "Quotes, 3 new"), which begins with the visible label.
  - The chip and the dot are `aria-hidden`, so the count is never read twice.
  - At 0 there is no chip, no dot and no hidden text.
  - The collapsed and rail labels stay referenced by `aria-labelledby`, so they still name the link.
  - Tabs are about 61px wide and 50px tall at 320px, so they meet the 44px target.
- **Query and cache:**
  - One key, `['quote-requests', 'new-count']`, is shared by the shell, the tab and the strip, under the inbox root `['quote-requests']`.
  - `retry` is off in the client, so the HTTP client's capped retries are the only ones.
  - The shell asks only while a session user exists, so the dev routes never trigger a 401 sign-out.
  - `shownNewQuoteCount` never shows a stale number.
- **Project rules:**
  - No em or en dash was added in `web/src`, `web/e2e`, the server code or the docs.
  - The calls stay in `modules/admin/services`.
  - Every `Result` failure goes through `ToHttpResult` to ProblemDetails.
  - Test data uses made-up names and numbers.

There is no blocker. The one warning is the dashboard strip: after a failed first read, the strip still blinks its alert and drops focus, which the 13-17 deviation 7 meant to prevent.

## Warnings

### WR-01: After a failed first read, each re-read removes the strip's alert and Try Again, so it is read out again and keyboard focus is lost

**File:** `web/src/modules/admin/components/QuoteRequestsStrip.tsx:38, 41-60, 72`, `web/src/modules/admin/hooks/useNewQuoteCountQuery.ts:31-40`, `web/src/modules/admin/components/QuoteRequestsStrip.test.tsx:123-129`

**Issue:**
- The strip shows its failure line only while `query.isError` is true, and the skeleton while `!isError && count === undefined`.
- When a query has no data, TanStack Query resets it to `status: 'pending'` and `error: null` at the start of every fetch (`fetchState` in `query.js` lines 486-495; the observer reads that status in `queryObserver.js` `createResult`). So if the first read failed, `isError` turns false for as long as any later read runs.
- The count keeps reading every 60 seconds and on every window focus after a failure (owner item 2). If the server or the phone's data stays down after a failed first read:
  - every minute the `role="alert"` line and Try Again unmount, the skeleton and `aria-busy` show, and `LoadingRegion` says "Loading the new quote requests…";
  - then the read fails and the alert mounts again, so it is read out again;
  - this is the W6 WR-01 problem, which 13-17 deviation 7 says it avoided.
- Pressing Try Again does the same. The button that has focus is removed at once, so focus falls to `<body>` (WCAG 2.4.3). Its `pending` state never shows in this case.
- The deviation 7 fix only works after a later failure, when data exists and the status stays `error` during the re-read.
- The unit test "keeps the same failure line while a read runs again" passes a hand-made `{ isError: true, isFetching: true }` with no data. The real query never gives that state, so the test does not catch the bug. The fed test clicks Try Again on a server that recovers, so it never sees the flip either.

**Fix:**
- Keep the failure sticky until a read succeeds. `errorUpdatedAt` is not reset by the fetch, so the strip can use it:
```ts
// useNewQuoteCountQuery.ts: add to NewQuoteCountQuery
readonly errorUpdatedAt: number;
readonly dataUpdatedAt: number;

// QuoteRequestsStrip.tsx
const failed = query.isError || (query.isFetching && query.errorUpdatedAt > query.dataUpdatedAt);
const loading = !failed && count === undefined;
// use `failed` in place of query.isError for the figure branch and LoadingRegion
```
- `shownNewQuoteCount` can stay as it is, because the nav shows nothing either way.
- Add a fed test with a backend that keeps failing:
  - let the first read fail and focus Try Again;
  - advance 60 seconds, or click Try Again;
  - expect the same alert element to stay mounted, focus to stay on Try Again, and the button to show busy;
  - expect no "Loading the new quote requests" status line.

## Info

### IN-01: The stored answer of a status change keeps the visitor's details and photo addresses for 24 hours, outside the purge and the coming Manager delete (owner)

**File:** `src/Csps.Server/Controllers/QuoteRequestsController.cs:113-119`, `src/Csps.Application/QuoteRequests/ChangeQuoteRequestStatusHandler.cs:103`, `src/Csps.Infrastructure/Idempotency/IdempotencyRecord.cs:19, 46, 85`

**Issue:**
- Every POST passes the idempotency gate. A 200 answer is stored as plain text in `IdempotencyRecords.ResponseBody` for 24 hours.
- The status change answers with the whole request: name, team, phone, email, message and every private photo address. The addresses do not expire while the file exists.
- D-16 (plan 13-21) lets a Manager delete a request for good, for example on a data-removal request under RA 10173. The 6-month purge also deletes requests. Neither can find these stored answers: they are keyed by route pattern and key, not by request id. So a copy of the visitor's details can outlive the delete by up to 24 hours.
- The order calls have the same pattern. Quote requests are the case where the owner has promised deletion for good.

**Fix:** Owner choice:
- A (smallest): the status call answers only `{ status, statusChangedAtUtc, version }`, and the 13-19 page reads the detail again (it already refreshes the detail query after a change).
- B: accept the 24-hour copy, and say so in the Privacy Policy text (D-28).

### IN-02: The detail read uses three separate commands, so a change between them can give a mixed answer

**File:** `src/Csps.Infrastructure/QuoteRequests/QuoteRequestReader.cs:59-137`

**Issue:**
- `GetDetailAsync` reads the request row, then the photo places, then the history, with no shared snapshot.
- Say a Spam move commits between the first and second reads. The answer then says status New, `photosRemovedAtUtc` null and the old version, but it has no photos and a newest history row of "to spam".
- The page then shows a New request whose photos are gone with no "removed" note.
- The next status change gets a 409, and a reload fixes the page. So nothing is lost, but the view is briefly wrong.

**Fix:** Optional:
- Run the three reads in one snapshot or repeatable-read transaction.
- Or read the photos and history first and the request row (with its version) last, so a stale view always ends with a stale version and a 409.

## Owner decisions

- **IN-01:** whether the status call should answer a slim body, or the 24-hour copy is accepted and stated in the Privacy Policy.
- **WR-01 and IN-02:** fixes with no change to the wording or behavior the owner has ruled on.

---

_Reviewed: 2026-11-23T13:55:00-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
