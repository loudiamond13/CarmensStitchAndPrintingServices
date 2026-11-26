---
phase: 13-quote-inquiries
created: 2026-11-23T19:02:55-06:00
updated: 2026-11-23T19:02:55-06:00
reviewed: 2026-11-23T19:02:55-06:00
depth: standard
wave: 9
plans: [13-20, 13-21]
files_reviewed: 52
files_reviewed_list:
  - docs/api/orders.md
  - docs/api/quote-requests.md
  - src/Csps.Application/Orders/CreateOrderHandler.cs
  - src/Csps.Application/Orders/CreateOrderRequest.cs
  - src/Csps.Application/Orders/OrderDetailResponse.cs
  - src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs
  - src/Csps.Application/Ports/IQuoteRequestReader.cs
  - src/Csps.Application/Ports/IQuoteRequestStore.cs
  - src/Csps.Application/QuoteRequests/GetOrderPrefillHandler.cs
  - src/Csps.Application/QuoteRequests/GetQuoteRequestHandler.cs
  - src/Csps.Application/QuoteRequests/OrderPrefillResponse.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestAuditDetail.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestDetailResponse.cs
  - src/Csps.Application/QuoteRequests/QuoteRequestErrors.cs
  - src/Csps.Domain/Auditing/AuditActions.cs
  - src/Csps.Domain/Common/Error.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequest.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestRules.cs
  - src/Csps.Domain/QuoteRequests/QuoteRequestStatusChange.cs
  - src/Csps.Infrastructure/Orders/OrderReader.cs
  - src/Csps.Infrastructure/Persistence/Configurations/QuoteRequestConfiguration.cs
  - src/Csps.Infrastructure/Persistence/Migrations/20261124001102_AddQuoteRequestOrderLink.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestReader.cs
  - src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs
  - src/Csps.Server/Composition/QuoteRequestsApplicationRegistration.cs
  - src/Csps.Server/Controllers/OrdersController.cs
  - src/Csps.Server/Controllers/QuoteRequestsController.cs
  - tests/Csps.Application.UnitTests/Orders/CreateOrderHandlerTests.cs
  - tests/Csps.Application.UnitTests/Orders/OrderDeletionHandlerTests.cs
  - tests/Csps.Application.UnitTests/QuoteRequests/GetOrderPrefillHandlerTests.cs
  - tests/Csps.Domain.UnitTests/QuoteRequests/QuoteRequestTests.cs
  - tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs
  - tests/Csps.Server.IntegrationTests/Http/OpenApiOrderWriteContractTests.cs
  - tests/Csps.Server.IntegrationTests/Orders/PermanentlyDeleteOrderTests.cs
  - tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteConversionTests.cs
  - web/e2e/quote-request.spec.ts
  - web/src/modules/admin/auditCopy.ts
  - web/src/modules/admin/components/QuoteNotesCard.test.tsx
  - web/src/modules/admin/components/QuoteNotesCard.tsx
  - web/src/modules/admin/components/quoteRequests.recipe.ts
  - web/src/modules/admin/pages/QuoteRequestPage.test.tsx
  - web/src/modules/admin/pages/QuoteRequestPage.tsx
  - web/src/modules/admin/pages/QuoteRequestsPage.test.tsx
  - web/src/modules/admin/pages/QuoteRequestsPage.tsx
  - web/src/modules/admin/quoteRequestNavigation.ts
  - web/src/modules/admin/quoteRequestsCopy.ts
  - web/src/modules/admin/quoteRequestsSchemas.test.ts
  - web/src/modules/admin/quoteRequestsSchemas.ts
  - web/src/modules/admin/services/quoteRequestsService.test.ts
  - web/src/modules/admin/services/quoteRequestsService.ts
  - web/src/test/quoteRequestFixtures.ts
  - web/src/types/api.generated.ts
findings:
  critical: 0
  warning: 3
  info: 7
  total: 10
status: issues_found
---

# Phase 13, Wave 9: Code Review Report

*Created: 2026-11-23T19:02:55-06:00 · Updated: 2026-11-23T19:02:55-06:00*

**Reviewed:** 2026-11-23
**Depth:** standard
**Files Reviewed:** 52
**Status:** issues_found

## Summary

This review covers plan 13-20 (the server side of Turn into Order) and plan 13-21 (the web Notes card and the Manager's Delete Request). The diff is `2074c022..bb77439c`.

- Read only, not reviewed line by line: the generated files (`openapi.v1.json`, the migration Designer, the model snapshot). `api.generated.ts` was checked only for the new members.
- Test files were read for reliability and gaps only.
- No tests, dev servers or e2e runs were started. Only small read-only greps were run.
- Owner items already listed in the two SUMMARYs are not raised again. That covers: Spam and Closed can be converted (13-20 item 4), the name order of the suggested type (item 5), where the lock sits (item 6), the 24-hour stored order answer (item 1), any 404 counted as deleted (13-21 item 1), and the hint not linked to the box (13-21 item 6).

Checked and found sound:

- **The conversion lock (T-13-59, CWE-362):**
  - `LockForConversionAsync` is one conditional `ExecuteUpdate` (the id matches and the status is not Converted). It runs inside the order transaction, after the public website block and before `numbers.NextAsync`.
  - A second save waits on the row's exclusive lock. When the first commits, the second matches nothing and reads the state: missing is a 404, Converted is a 409 with `orderId` and `orderNumber`.
  - If the first save rolls back (number busy, deadlock), the second still matches and converts. That is the right result.
  - The request is loaded after the lock in the same transaction, so its row version is the new one. `MarkConverted` then fails only if the status is already Converted, which the lock rules out.
- **No order and no number on 404 or 409:**
  - The idempotency gate keeps a 404 and commits the outer transaction. On that path the lock matched nothing and the number was not taken. The only thing written before it is the site-content lock row's `TakenAtUtc`, which does no harm.
  - `OrderPublicWebsiteWriter.ApplyAsync` changes only the order, which is not added yet. So no stray tracked row is saved with the stored 404.
  - The gate does not keep a 409 and rolls it back.
- **Races with other writers:**
  - Status change, note add and Manager delete all save with the row version, and the lock moves it. Each then either loses with a 409 or reads Converted and refuses with a 400. The Manager delete checks Converted before the version, so it gives 400 there. The retention job excludes Converted twice (select and delete), and a race makes its batch roll back.
  - No lock cycle was found. The conversion takes the site-content lock, then the request row, then the number. No other writer takes the request row and then one of the others.
- **Status rules:** Converted is reached only through `MarkConverted`. The status-move validator, the domain and the delete all refuse Converted. Nothing else in `src` or `tools` sets Converted, so every Converted request has an order link.
- **Audit and history (CWE-532):** `quote-request.converted` holds `order=<id>` only. The delete entry holds `status=converted;photos=<n>`. The history row holds the from and to statuses, who, when and the order id. None of them holds a name, phone, email or message.
- **Permanent order delete (D-22):**
  - In one save: the order's photos and the request's stored photos are queued with `Enqueue` (never inline). The audit entry is recorded, then the request and the order are removed with tracked removes.
  - EF deletes the request before the order, because the link is in the model. Notes and history go by the database cascade.
  - The history table's NO ACTION link to Orders does not block this. Its rows go with the request first.
  - A soft delete does not touch the request. `FindByOrderAsync` uses `SingleOrDefault`, and the unique index makes that safe.
- **Migration:** additive only. It adds one nullable column, a unique index filtered to `IS NOT NULL` and a NO ACTION foreign key. No trigger, no JSON column, no inline SQL, no compat-level change.
- **Prefill:**
  - `receivedOn` converts the UTC time to the shop's time zone from `IBusinessCalendar`, then takes the date.
  - The phone is the display form. The quote limits are defined from the order limits (`MessageMaxLength = OrderRules.NotesMaxLength` and so on), so the prefilled values always fit the order rules.
- **Authorization (T-13-60):** the prefill is under the controller's `Policies.Staff`, and the matrix has its row (401/404/404). Order create is Staff. Both roles can open every request, so the conversion lets nobody reach a request they could not already open.
- **Web 13-21:**
  - Calls stay in `modules/admin/services`. No em or en dash is in any added line of `web/src`, `web/e2e`, `src` or `docs`.
  - The note text is React text with `pre-wrap` (CWE-79 safe).
  - The note schema trims, then checks 1 to 1,000, in the server's words. The form sends the trimmed text.
  - `useSubmission` keeps the key after a 409 and makes a new one after a stored 400 or 404.
  - After the slim note answer, the version is set at once and `['quote-requests']` is invalidated. An older detail read still in flight is cancelled by that invalidation, so it cannot bring back the old version.
  - Delete Request shows for a Manager only, matching the server's Manager policy. It is `aria-disabled` and described by the reason on Converted, and `Button` ignores a press while `aria-disabled`.
  - The confirm keeps Cancel focused first and shows the server's sentence on a 400. On a 409 it closes first and then raises the banner (the W8 WR-02 pattern).
  - After a delete: the detail read is cancelled, the lists and New count are invalidated, the detail is removed on unmount, the inbox replaces the entry and the inbox h1 takes focus. The h1 is always rendered, so the focus target exists.

There is no blocker. There are three warnings. Two are about cached data that stays out of date after a refusal or a delete. One is a test that cannot catch the "no number on 404" rule if it breaks.

## Warnings

### WR-01: A permanent order delete now removes a quote request, but the web does not refresh any quote request data

**File:** `web/src/modules/admin/hooks/useRefreshOrders.ts:18-27`, `web/src/modules/admin/components/PurgeOrderDialog.tsx:82-89`, `src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs:88-99`

**Issue:**
- Since D-22, `DELETE /orders/{id}/permanent` also deletes the request the order was made from.
- After a purge, `PurgeOrderDialog` calls `useRefreshOrders()`. Its `REFRESHED_KEYS` list holds the order, dashboard and money roots, but not `['quote-requests']`.
- So the inbox's Converted pill and any cached detail still show the deleted visitor's name, phone and message until the next 60-second poll or the next mount. Opening that row then gives "Quote request not found".
- A delete for good is how the shop honours a removal request for a converted lead. Leaving the person's details on screen after it reads as "not deleted".
- This plan changed the server but not its web counterpart. 13-22 covers the order create, not the purge.

**Fix:**
```ts
// useRefreshOrders.ts: a purge can remove the quote request the order came from (13 D-22).
import { quoteRequestsKey } from '@/modules/admin/hooks/useQuoteRequestsQuery';
const REFRESHED_KEYS = [ordersKey, ordersDeletedKey, /* ... */, moneyTransfersKey, quoteRequestsKey];
```
- If refreshing the inbox on every order write is too broad, call `invalidateQueries({ queryKey: quoteRequestsKey })` only in the purge success path. With D-21 the purge answer could also name the removed request id, so its detail can be removed from the cache.
- Add a `PurgeOrderDialog` test: after a purge, `['quote-requests']` queries are stale.

### WR-02: When Delete Request answers 400 "can't be deleted", the page keeps showing the old status and its actions

**File:** `web/src/modules/admin/pages/QuoteRequestPage.tsx:93-100, 158-171`

**Issue:**
- The server checks Converted before it compares the version (`DeleteQuoteRequestHandler`). So if someone turns the request into an order while a Manager has the page open, Delete Request answers `400 quote-requests.converted-locked`, not 409. No ConflictBanner shows.
- `refusal` puts "A request that became an order can't be deleted." in the confirm. Nothing reads the request again.
- After Cancel, the page still shows the old badge (for example Quoted), an active Delete Request and Change Status. Change Status then answers 400 "can't change status", and the Notes card works on a request the page labels wrongly.
- With 13-22 adding Turn into Order, this race becomes ordinary: one staff member converts while the Manager has the request open.

**Fix:**
```tsx
// In confirm(), before returning the failure:
if (isStatus(error, 400) && isHttpError(error) && error.code === 'quote-requests.converted-locked') {
  void queryClient.invalidateQueries({ queryKey: quoteRequestKey(id), exact: true });
}
return { ok: false, error };
```
- Do the same in `QuoteStatusMenu` for its own `converted-locked` 400, if it does not already.
- Add a page test: Delete Request answers 400 converted-locked. Expect the server's sentence in the confirm. After Cancel, expect the Converted badge and the button `aria-disabled` once the read lands.

### WR-03: No test checks that an unknown request takes no order number, and the 409 check cannot catch it

**File:** `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteConversionTests.cs:111-121, 142-144`

**Issue:**
- The plan says a 404 or 409 saves no order and takes no order number. The code meets it: the lock runs before `numbers.NextAsync`.
- `TwoSavesAtOnceMakeOneOrderAndTheOtherIs409WithTheFirstOrder` checks the number through the next order (`ORD-YYYY-0002`). But a 409 is never stored, and the gate rolls the whole transaction back. A number taken before the lock would be rolled back too, so this check passes even if the order is wrong.
- Only the 404 path commits, because the gate stores a 404. So only the 404 test can catch a number taken too early. `AnUnknownRequestIs404AndSavesNoOrder` checks only that there are no orders.
- If a later edit moves the lock after `numbers.NextAsync`, every test stays green and each unknown id burns a number.

**Fix:**
```csharp
// AnUnknownRequestIs404AndSavesNoOrder: after the 404, the next order still gets the first number.
var today = await OrderFixtures.TodayAsync((CspsApiFactory)rig.Factory);
var next = await OrderFixtures.CreateAsync(rig.Client, rig.Admin.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
next.GetProperty("number").GetString().ShouldBe($"ORD-{today.Year}-0001");
```
- Run it red once with the lock moved after the number, then put the lock back.

## Info

### IN-01: The parallel test may not overlap, and the unique index is described as the wrong backstop

**File:** `tests/Csps.Server.IntegrationTests/QuoteRequests/QuoteConversionTests.cs:124-145`, `docs/api/quote-requests.md` ("Two saves at the same moment..."), `13-20-PLAN.md` must_haves

**Issue:**
- `Task.WhenAll` of two HTTP posts does not make the two transactions overlap. If they run one after the other, the second gets the same 409. So the test passes with or without the lock and proves only the sequential case.
- The plan truth calls `IX_QuoteRequests_OrderId` "the backstop for one request, one order". That index stops two requests from pointing at one order. It cannot stop one request from making two orders, because a request has only one `OrderId` column. The real backstop without the lock is the request's row version: the second save would fail with a concurrency conflict and answer `409 orders.busy`, not `already-converted`. The configuration comment ("keeps one order to one request") says it correctly. The plan and the summary do not.

**Fix:** For a test that proves the lock, hold the first save's transaction open (a test hook in the number allocator, or a second context that takes the row's update lock) and check that the second request waits and then gets `already-converted`. Correct the wording in the docs and the summary.

### IN-02: The create contract text leaves out the already-converted 409, and the docs say the lock is taken "first"

**File:** `src/Csps.Server/Controllers/OrdersController.cs:82`, `src/Csps.Application/Orders/CreateOrderHandler.cs:44`, `docs/api/quote-requests.md` ("The save")

**Issue:**
- The `<returns>` of `OrdersController.Create` lists 404 and `409 orders.busy`, but not `409 quote-requests.already-converted`. That text is the OpenAPI description the Android client will read. The handler's `<returns>` lists neither the 404 nor the new 409.
- `docs/api/quote-requests.md` says "The request is locked first, before the order number is taken". The code locks it after the public website block (13-20 item 6, A).

**Fix:** Add "or 409 `quote-requests.already-converted` (with `orderId` and `orderNumber`) when the quote request already became an order" to both `<returns>`. Change "locked first" to "locked just before the order number is taken". Refresh the OpenAPI snapshot.

### IN-03: The suggested type can be the catch-all Others type, which the product type list shows last

**File:** `src/Csps.Application/QuoteRequests/GetOrderPrefillHandler.cs:37-43`, `src/Csps.Application/OrderLists/ListOrderListHandler.cs:20-22`

**Issue:**
- The product type list sorts the Others entry last (`OrderBy(view => view.IsOthers ? 1 : 0)`), then by name.
- The prefill sorts by name only. `ProductType.LinkToLine` does not stop Others from being filed under a line. If it is, the prefill suggests "Others" ahead of a type like "Polo Shirt".
- The docs promise "in the order the product type list shows".

**Fix:** Carry `IsOthers` in `QuoteLineProductType` and sort it last, as the list does, or skip it when another active type exists. Add a unit case.

### IN-04: A note made only of U+0085 passes the browser and fails on the server

**File:** `web/src/modules/admin/quoteRequestsSchemas.ts:14-16`, `src/Csps.Application/QuoteRequests/AddQuoteRequestNoteRequestValidator.cs:12-17`

**Issue:**
- .NET `Trim()` and `IsNullOrWhiteSpace` treat U+0085 (next line) as white space. JavaScript `trim()` does not.
- So a note of only U+0085 passes zod, and the server answers 400 "Write a note first.". The card shows that sentence under the box, so it is handled, but OR-3 says the browser covers every rule.
- The other way round (U+FEFF, which JavaScript trims and .NET keeps), the browser is stricter. That is fine.
- The W8 note asked for a U+FEFF test. None was added.

**Fix:** Trim U+0085 as well in the schema, for example `.transform((text) => text.replace(/^[\s\u0085]+|[\s\u0085]+$/g, ''))` before the length checks. Add tests for U+0085 only and U+FEFF only.

### IN-05: The upload race from W8 IN-01 now also applies to the permanent order delete (owner)

**File:** `src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs:89-98`, `src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs:156-175`

**Issue:**
- `FillPhotoSlotAsync` accepts uploads for a Converted request, and it does not move the request's row version.
- If a visitor's late upload fills a place between `FindByOrderAsync` and the save, the tracked remove deletes the place row and its file is never queued. `StraySweepJob` finds it only after about 2 days.
- The docs say "each stored photo is queued for removal" with no exception. W8 IN-01 is still waiting for the owner, and the same choice now covers this path.

**Fix:** Include the D-22 path in the owner's W8 IN-01 choice: accept it and add one sentence to the docs and the Privacy Policy, or lock the request in the upload and in both deletes.

### IN-06: The conversion lock waits for the command timeout, not the lock wait the store is given

**File:** `src/Csps.Infrastructure/QuoteRequests/QuoteRequestStore.cs:34-52`

**Issue:**
- `DatabaseLocks.TakeAsync` sets the command timeout to the lock's `wait`. `LockForConversionAsync` does not, so a second save waits for the context's default command timeout (30 seconds unless set elsewhere).
- When that runs out, the answer is `409 orders.busy`, "another order is being numbered", which is not quite what happened.
- The store's `wait` parameter is unused on this path, so tests cannot shorten it.

**Fix:** Set and restore the command timeout around the update with `wait`, as `TakeAsync` does. Optionally map the timeout to a request-specific busy error.

### IN-07: A stray blank line

**File:** `src/Csps.Application/Orders/PermanentlyDeleteOrderHandler.cs:44-45`

**Issue:** Two blank lines follow the session check. `dotnet format` does not flag it because SA1507 is off.

**Fix:** Remove one blank line.

## Owner decisions

- **WR-01, WR-02, WR-03, IN-02, IN-04, IN-06 and IN-07** change no ruled wording or behavior. They are fixes.
- **IN-03:** a small rule choice. Recommended: sort Others last, as the list does.
- **IN-05:** part of the open W8 IN-01 choice (accept about 3 days of stray storage, or lock uploads against deletes).
- **IN-01:** wording and test strength only. No behavior change.

---

_Reviewed: 2026-11-23T19:02:55-06:00_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
