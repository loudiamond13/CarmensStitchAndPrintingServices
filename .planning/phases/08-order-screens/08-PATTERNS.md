---
phase: "08"
slug: "order-screens"
created: "2026-10-29T15:40:00-05:00"
updated: "2026-10-29T15:40:00-05:00"
---

# Phase 8: Order Screens - Pattern Map

*Created: 2026-10-29T15:40:00-05:00 · Updated: 2026-10-29T15:40:00-05:00*

**Mapped:** 2026-10-29
**Files analyzed:** 62 (new and changed, grouped below)
**Analogs found:** 58 / 62

Templates: the Phase 6 company-expenses slice for the web, the Phase 7 orders API for the backend. Every path below is tracked source (no mirrors).

## File Classification

### Backend (one serial plan; it also rewrites `tools/openapi-gen/openapi.v1.json` and `web/src/types/api.generated.ts`)

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `src/Csps.Application/Orders/OrderListResponse.cs` (add `Pieces` on entry; `AllCount`, `ActiveCount`, `Today` on response) | model (DTO) | request-response | `src/Csps.Application/Expenses/CompanyExpenseListResponse.cs` | exact |
| `src/Csps.Application/Orders/OrderDetailResponse.cs` (D-44 item attribution; D-59 `Today`) | model (DTO) | request-response | same file, `OrderDiscountResponse` (RecordedBy..LastChangedAt) | exact |
| `src/Csps.Application/Ports/IOrderReader.cs` (`OrderListRow.Pieces`, `OrderListPage` counts, new `GetDeletedDetailAsync`) | port | CRUD read | same file, `ListDeletedAsync` / `GetDetailAsync` | exact |
| `src/Csps.Application/Orders/ListOrdersHandler.cs` (pass pieces, counts, today) | service (handler) | request-response | `src/Csps.Application/Expenses/ListCompanyExpensesHandler.cs` lines 43, 77 | exact |
| `src/Csps.Application/Orders/GetOrderHandler.cs` (today) | service (handler) | request-response | same, plus `ListCompanyExpensesHandler` calendar use | exact |
| `src/Csps.Application/Orders/GetDeletedOrderHandler.cs` (new, D-24) | service (handler) | request-response | `src/Csps.Application/Orders/GetOrderHandler.cs` | exact |
| `src/Csps.Infrastructure/Orders/OrderReader.cs` (piece count, counts command, item joins, deleted read) | repository | CRUD read | same file, lines 22-55, 113-164, 194-260 | exact |
| `src/Csps.Server/Controllers/OrdersController.cs` (new `GET deleted/{id:guid}`) | controller | request-response | same file, `ListDeletedOrders` lines 202-219 | exact |
| `src/Csps.Server/Controllers/TestingOrdersController.cs` (D-62 refunds) | controller (Debug Testing only) | request-response | same file, `Expenses` path lines 64, 97, 137-143, 173, 188-193 | exact |
| `tests/Csps.Server.IntegrationTests/Authorization/AuthorizationMatrix.cs` (row for D-24) | test | n/a | line 246 restore row | exact |
| `tests/Csps.Infrastructure.IntegrationTests/Orders/OrderReaderQueryCountTests.cs`, `tests/Csps.Server.IntegrationTests/Orders/OrderListQueryCountTests.cs` (2 to 3, D-60) | test | n/a | same files (lines 45, 61) | exact |
| `tests/Csps.Server.IntegrationTests/Orders/ListOrdersEndpointTests.cs`, `OrderAttributionTests.cs`, `OrderDeletionTests.cs` (extend) | test | n/a | same files | exact |
| `docs/api/orders.md`, `docs/operations/list-performance.md` | docs | n/a | same files | exact |

### Web: shared changes

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `web/src/utils/csps.ts` (Delivered, `CascadeCounts.refunds`) | utility | transform | same file lines 101-136 | exact |
| `web/src/components/status/tones.ts` (`delivered: 'accent'`) | config | n/a | same file lines 14-21 | exact |
| `web/src/components/money/OrderTotals.tsx` | component | display | same file | exact (change) |
| `web/src/components/data/OrderCard.tsx` | component | display | same file | exact (change) |
| `web/src/components/overlays/ConfirmDialog.tsx` (`cancelLabel`, `confirmIcon`) | component | event | same file lines 170-173 | exact (change) |
| `web/src/components/choice/Tabs.tsx` (keep-in-view) | component | event | same file | exact (change) |
| `web/src/modules/admin/components/PaidBySelect.tsx` (`label`, `name`, `hint` props) | component | request-response | same file | exact (change) |
| `web/src/modules/admin/routes.tsx` (orders routes, `/admin` to orders, drop dev `orders`) | route | n/a | same file lines 90-100, 122-124, 141-157, 201 | exact |

### Web: new module files (`web/src/modules/admin/`)

| File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `services/ordersService.ts` | service | request-response | `services/expensesService.ts` | exact |
| `services/productTypesService.ts`, `paymentMethodsService.ts`, `orderExpenseCategoriesService.ts` | service | CRUD | `services/expenseCategoriesService.ts` | exact |
| `hooks/useOrdersListParams.ts` | hook | URL state | `hooks/useExpensesListParams.ts` | exact |
| `hooks/useDeletedOrdersListParams.ts` | hook | URL state | `hooks/useDeletedExpensesListParams.ts` | exact |
| `hooks/useOrderTab.ts`, `hooks/useSettingsTab.ts` | hook | URL state | `hooks/useProfileTab.ts` | exact |
| `hooks/useOrdersView.ts` (ORD-10) | hook | URL + localStorage | `hooks/useProfileTab.ts` + RESEARCH Pattern 3 | partial |
| `hooks/useOrdersQuery.ts`, `useDeletedOrdersQuery.ts` | hook | request-response | `hooks/useExpensesQuery.ts`, `useDeletedExpensesQuery.ts` | exact |
| `hooks/useOrderQuery.ts`, `useDeletedOrderQuery.ts` | hook | request-response | `hooks/useExpenseQuery.ts` (but keep cache, see note) | role-match |
| `hooks/useOrderAction.ts` | hook | event (idempotent POST) | `hooks/useExpenseAction.ts` | exact |
| `hooks/useRefreshOrders.ts` | hook | cache invalidation | `hooks/useRefreshExpenses.ts` | exact |
| `hooks/useProductTypesQuery.ts`, `usePaymentMethodsQuery.ts`, `useOrderExpenseCategoriesQuery.ts` | hook | request-response | `hooks/useExpenseCategoriesQuery.ts` | exact |
| `ordersCopy.ts`, `orderListsCopy.ts` (+ `settingsCopy.ts` additions) | config (copy) | n/a | `expensesCopy.ts`, `settingsCopy.ts` | exact |
| `ordersSchemas.ts`, `orderListSchemas.ts` (+ tests) | utility (zod) | validation | `expensesSchemas.ts`, `categorySchemas.ts` | exact |
| `components/OrderItemModal.tsx`, `OrderPaymentModal.tsx`, `OrderDiscountModal.tsx`, `OrderExpenseModal.tsx`, `OrderRefundModal.tsx` | component (form modal) | request-response | `components/ExpenseModal.tsx` | exact |
| `components/ListEntrySelect.tsx` | component | request-response | `components/ExpenseCategorySelect.tsx` | exact |
| `components/ListSettingsSection.tsx` | component | CRUD | `pages/SettingsPage.tsx` lines 80-175, 360-420 + `components/CategoryModal.tsx` | exact |
| `components/OrderStatusMenu.tsx` | component | event | `@/components` `UserMenu` (APG menu button) | role-match |
| `components/ReopenOrderModal.tsx` | component | event | `components/ExpenseModal.tsx` (Modal + useSubmission) | role-match |
| `components/DueFlag.tsx` | component | transform | none in repo; RESEARCH Pattern 5 | no analog |
| `components/OrderLockedBanner.tsx`, `OrderNoticeBanner.tsx`, `OrderBalanceStrip.tsx`, `OrderCustomerCard.tsx`, `OrderStatusHistory.tsx` | component | display | `components/ExpenseKpiRow.tsx`, `@/components` `ErrorState` layout | partial |
| `components/OrderItemsEditor.tsx` | component | form (field array) | none (first `useFieldArray`) | no analog |
| `components/orders.recipe.ts` | config (classes) | n/a | `components/expenses.recipe.ts` | exact |
| `pages/OrdersPage.tsx` | page | request-response | `pages/ExpensesPage.tsx` | exact |
| `pages/OrderPage.tsx` | page | request-response | `pages/ExpensesPage.tsx` + `pages/ProfilePage.tsx` (tabs) | role-match |
| `pages/OrderFormPage.tsx` (create + edit details, guard) | page (form) | request-response | `components/ExpenseModal.tsx` (form logic) | role-match |
| `pages/DeletedOrdersPage.tsx` | page | CRUD | `pages/DeletedExpensesPage.tsx` | exact |
| `pages/DeletedOrderPage.tsx` | page | request-response | `pages/DeletedExpensesPage.tsx` + `OrderPage` read-only | role-match |
| `pages/SettingsPage.tsx` (tabs) | page | CRUD | same file + `useProfileTab` | exact |

### Web: tests and e2e

| File | Role | Closest Analog | Match |
|---|---|---|---|
| `web/src/test/orderFixtures.ts` | test fixture | `web/src/test/expenseFixtures.ts` | exact |
| `web/e2e/testing-api.ts` (`createOrder`) | e2e helper | `createExpense` lines 117-126 | exact |
| `web/e2e/admin.spec.ts`, `shell.spec.ts`, `sweep.ts`, `src/modules/admin/routes.test.tsx` (stop using `/admin/orders` as the dev preview; `/admin` now lands on orders) | test | same files | exact |
| `*.test.tsx` beside each new hook, component and page | test | the matching expense test (`ExpenseModal.test.tsx`, `ExpensesPage.test.tsx`, `DeletedExpensesPage.test.tsx`, `useExpensesListParams.test.tsx`, `useProfileTab.test.tsx`) | exact |

## Pattern Assignments

### Backend

#### `OrderListResponse.cs` (DTO). D-40, D-41, D-59

**Analog:** `src/Csps.Application/Expenses/CompanyExpenseListResponse.cs` lines 24-41. Copy the XML `<param>` style and put `Today` last:

```csharp
/// <param name="Today">The business today, so the browser never reads the device clock for it.</param>
public sealed record CompanyExpenseListResponse(
    IReadOnlyList<CompanyExpenseListItem> Items, int Total, int Page, int PageSize,
    decimal PeriodTotal, DateOnly From, DateOnly To, DateOnly Today);
```

Today's order record (line 43) is `OrderListResponse(IReadOnlyList<OrderListEntry> Items, int Total, int Page, int PageSize)`. Add the two list-wide counts and `DateOnly Today`. Add `int Pieces` to `OrderListEntry` (lines 19-35) with a `<param>` line. The planner fixes final names (for example `AllOrders`, `ActiveOrders`).

#### `OrderDetailResponse.cs` (DTO). D-44, D-59

**Analog:** the discount record in the same file (params at lines 22-30): `RecordedBy` (ActorRef?, "null reads as System"), `RecordedAt`, `LastChangedBy` ("null until an edit"), `LastChangedAt`. Append the same four to `OrderItemResponse` (line 20). Add `DateOnly Today` to `OrderDetailResponse` (lines 174-198). A deleted-read response either reuses this record plus `DeletedAt`/`DeletedBy`, or is a new `DeletedOrderDetailResponse` wrapping it (planner fixes; RESEARCH A5).

#### `ListOrdersHandler.cs` and `GetOrderHandler.cs` (handlers). D-59

**Analog for today:** `ListCompanyExpensesHandler.cs` line 43 and 77:

```csharp
var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
...
return Result.Success(new CompanyExpenseListResponse(items, page.Total, request.Page, request.PageSize, page.PeriodTotal, from, to, clock.Today));
```

**Warning:** `ListOrdersHandler` (lines 9-13) says it uses `TimeProvider` "and not the business calendar, so the list stays at two SQL commands". `BusinessCalendar` (`src/Csps.Infrastructure/Time/BusinessCalendar.cs` lines 6-18) reads `ISiteSettingsReader`, which is cached, so a warm cache adds no command, but a cold cache may. The D-60 query-count tests must warm the settings cache first (or count only reader commands, as `OrderReaderQueryCountTests` does at the reader level). Update the handler's summary comment. The `now` passed to `reader.ListAsync` can come from `clock` too.

Keep the handler shape (lines 24-73): session check, validate, map row to entry, `Result.Success`. Add `row.Pieces` to the `new OrderListEntry(...)` map at lines 55-71.

#### `GetDeletedOrderHandler.cs` (new). D-24

**Analog:** `GetOrderHandler.cs` (whole file, 24 lines):

```csharp
public sealed class GetOrderHandler(IOrderReader reader, IRequestContext requestContext)
{
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var view = await reader.GetDetailAsync(id, cancellationToken).ConfigureAwait(false);
        return view is null ? Result.Failure<OrderDetailResponse>(OrderErrors.NotFound) : Result.Success(view);
    }
}
```

Same shape, calling a new `reader.GetDeletedDetailAsync`. A live or unknown id is `OrderErrors.NotFound`. Register it where the other order handlers are registered (find with `grep -rn "GetOrderHandler" src/Csps.Server src/Csps.Application`).

#### `OrderReader.cs` (repository). D-40, D-41, D-44, D-24

**List (lines 22-55).** Command 1 is `matches.CountAsync`, command 2 is the page `Select`. Add inside the page `Select` (stays in command 2, no N+1):

```csharp
// D-40: the piece count, summed in the page command.
context.Set<OrderItem>().Where(item => item.OrderId == order.Id).Sum(item => item.Quantity)
```

Note the comment at line 97: "No IgnoreQueryFilters here: EF applies it to the whole query". The same applies to this subquery. Add command 3 (D-60) over `context.Orders.AsNoTracking()` without `Filter(...)`: one `GroupBy(_ => 1).Select(g => new { All = g.Count(), Active = g.Count(o => o.Status <= OrderStatus.Delivered) })` or equivalent LINQ (RESEARCH A1; prove with the count test). Check the enum order before relying on `<=`; an explicit list of the five active statuses is safer. Update the line 29 comment to "Command 3".

**Item attribution (lines 223-237).** Copy the discount join pattern at lines 239-257:

```csharp
join recorderUser in context.Users on discount.CreatedById equals (Guid?)recorderUser.Id into recorders
from recorder in recorders.DefaultIfEmpty()
join changerUser in context.Users on discount.UpdatedById equals (Guid?)changerUser.Id into changers
from changer in changers.DefaultIfEmpty()
```

then the anonymous select of `RecorderFirst/Last/Former`, `ChangerId/First/Last/Former`, and map to `ActorRef` in memory as the discount mapping does (line 407 onward). No migration: `OrderItem` already has `CreatedById`, `CreatedAtUtc`, `UpdatedById`, `UpdatedAtUtc`.

**Deleted read.** Copy the filter lift from `ListDeletedAsync` line 116:

```csharp
var matches = context.Orders.IgnoreQueryFilters([SoftDeleteFilter]).AsNoTracking().Where(order => order.DeletedAtUtc != null);
```

and the deleter join at lines 123-124 and 159-161. Make `ReadDetailOnceAsync` take a "deleted" flag (or a shared private method) so every child query (items, discounts, payments, refunds, expenses, status history) also calls `IgnoreQueryFilters([SoftDeleteFilter])` (RESEARCH Pitfall 12). Reuse the version re-check loop of `GetDetailAsync` (lines 166-192) with the same filter lift on its version read.

#### `OrdersController.cs` (controller). D-24

**Analog:** `ListDeletedOrders` (lines 202-219):

```csharp
[HttpGet("deleted")]
[Authorize(Policy = Policies.Manager)]
[EndpointName("ListDeletedOrders")]
[ProducesResponseType<DeletedOrderListResponse>(StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status400BadRequest)]
[ProducesResponseType(StatusCodes.Status401Unauthorized)]
[ProducesResponseType(StatusCodes.Status403Forbidden)]
public async Task<IResult> ListDeletedOrders(...)
{
    var result = await listDeleted.HandleAsync(new ListDeletedOrdersRequest(page, pageSize), cancellationToken).ConfigureAwait(false);
    return result.ToHttpResult(HttpContext, static orders => TypedResults.Ok(orders));
}
```

New action `[HttpGet("deleted/{id:guid}")]`, `[EndpointName("GetDeletedOrder")]`, 200/401/403/404, body like `Get` (lines 106-110). Add the handler to the primary constructor (line 27) and a `<param>` line (lines 13-21). Write the XML summary in the same plain style (it feeds the OpenAPI docs).

#### `TestingOrdersController.cs` (Debug Testing only). D-62

Domain support exists: `OrderImportSnapshot.Refunds` (`src/Csps.Domain/Orders/OrderImportSnapshot.cs` line 28) and `NewOrderRefund(DateOnly RefundDate, decimal Amount, string Reason, Guid RefundedByUserId)` (`OrderInputs.cs` line 50). Copy the expenses path exactly:
- add `IReadOnlyList<...RefundRequest>? Refunds = null` to `TestingOrderRequest` (line 50-64) with a `<param>` line. There is no `OrderRefundRequest` in `CreateOrderRequest.cs`; add a small testing-only record in this file or reuse the `AddOrderRefundRequest` fields.
- `RejectNullMembers(broken, OrderRules.RefundsField or a literal, request.Refunds);` (beside line 97)
- the per-index date check loop (copy lines 137-143) with `refunds[{index}].refundDate`
- `Refunds = [.. (request.Refunds ?? []).Select(ToRefund)],` in `ToSnapshot` (beside line 173)
- `private static NewOrderRefund ToRefund(...)` copied from `ToExpense` (lines 188-193).
The file stays inside its `#if` (ends with `#endif`); matrix row line 68 stays 400.

#### `AuthorizationMatrix.cs` (test)

**Analog:** line 246:

```csharp
new("POST", "/api/v1/orders/{id:guid}/restore", "/api/v1/orders/6d2a8c15-3b94-4e07-a1f6-0c9e5b7d4a38/restore", Anonymous: 401, Admin: 403, Manager: 404),
```

Add `new("GET", "/api/v1/orders/deleted/{id:guid}", "/api/v1/orders/deleted/<fresh random guid>", Anonymous: 401, Admin: 403, Manager: 404)` with a one-line comment, near line 244.

#### Query-count tests. D-60

`OrderReaderQueryCountTests.cs` lines 45 and 61: `counter.Count.ShouldBe(2, ...)` becomes 3 in the same plan as the reader change, plus `OrderListQueryCountTests.cs` and `docs/operations/list-performance.md`. Cite D-60 in the test comment. Run `OrderListTimingTests` alone after.

#### Contract regeneration (RESEARCH Pattern 1)

Snapshot test fails, rewrite with `CSPS_WRITE_OPENAPI_SNAPSHOT=1` set in that one process only, regenerate with `npm --prefix tools/openapi-gen run generate`, then `check` and `npm --prefix web run typecheck`. Commit DTOs, `openapi.v1.json` and `api.generated.ts` together. Never hand-edit them.

### Web: services

#### `services/ordersService.ts`

**Analog:** `services/expensesService.ts` (whole file, 119 lines).

Header and types (lines 1-17):

```typescript
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];
export type ExpenseListResponse = Schemas['CompanyExpenseListResponse'];
```

Interface with one JSDoc per call naming the route, the key rule and the failure codes (lines 37-84). Path helper and factory (lines 86-119):

```typescript
const expensePath = (id: string): string => `/company-expenses/${encodeURIComponent(id)}`;

export function createExpensesService(client: HttpClient): ExpensesService {
  return {
    list: (query, signal) => client.get<ExpenseListResponse>('/company-expenses', { params: { ... }, signal }),
    create: (body, idempotencyKey, signal) => client.post<ExpenseDetailResponse>('/company-expenses', body, { idempotencyKey, signal }),
    update: (id, body, signal) => client.put<ExpenseDetailResponse>(expensePath(id), body, { signal }),
    remove: (id, signal) => client.delete(expensePath(id), { signal }),
    restore: (id, idempotencyKey, signal) => client.post(`${expensePath(id)}/restore`, undefined, { idempotencyKey, signal }),
    purge: (id, signal) => client.delete(`${expensePath(id)}/permanent`, { signal }),
  };
}
export const expensesService: ExpensesService = createExpensesService(apiClient);
```

Order specifics (RESEARCH Code Examples): child DELETEs answer the whole order, so `client.delete<OrderDetailResponse>(...)`; purge sends `params: { confirm }`; status sends `{ status }` with an `Idempotency-Key` and no version; add calls send a key and `version`; edits send `version` only. Add `getDeleted(id)` for `/orders/deleted/{id}`. Test file copies `expensesService.test.ts`.

#### `productTypesService.ts`, `paymentMethodsService.ts`, `orderExpenseCategoriesService.ts`

**Analog:** `services/expenseCategoriesService.ts` (lines 1-65): `list`, `create(key)`, `get`, `update(version)`, `retire(key)`, `reactivate(key)`, `remove`. Paths `/product-types`, `/payment-methods`, `/order-expense-categories`. Count field is `useCount` here, `expenseCount` for expense categories (RESEARCH). One service per resource (OR-5).

### Web: hooks

#### `hooks/useOrdersListParams.ts`

**Analog:** `hooks/useExpensesListParams.ts` (lines 1-39). Copy the broken-pair guard verbatim:

```typescript
function isBrokenPair(from: string | null, to: string | null): boolean {
  if (from === null && to === null) return false;
  return from === null || to === null || from > to;
}

export function useExpensesListParams() {
  const [values, set] = useListParams();
  const broken = isBrokenPair(values.from, values.to);
  const { setFilters } = set;
  useEffect(() => { if (broken) { setFilters({ from: null, to: null }); } }, [broken, setFilters]);
  const effective = broken ? { ...values, from: null, to: null } : values;
  return [effective, set] as const;
}
```

Param set from RESEARCH Pattern 2 (`status` default `active`, `sort` default `due`, `dates` with no default, `view` with no default). Under `dates=custom` a broken pair also drops `dates`. Keys must not look like personal data (`createListParams` FORBIDDEN_NAMES).

#### `hooks/useOrderTab.ts`, `hooks/useSettingsTab.ts`

**Analog:** `hooks/useProfileTab.ts` (lines 1-20):

```typescript
export const PROFILE_TABS = ['details', 'security', 'appearance'] as const;
const useProfileParams = createListParams({ tab: literalParser(PROFILE_TABS, 'details') });

export function useProfileTab() {
  const [{ tab }, { setFilter }] = useProfileParams();
  return { tab, setTab: (next: ProfileTab): void => { setFilter('tab', next); } };
}
```

Order tabs: `items` (default), `payments`, `discounts`, `expenses`, `refunds`. Settings tabs: `product-types` (default), `payment-methods`, `order-expense-categories`, `expense-categories`. `refunds` when hidden is replaced by the default with one replace (page-level effect, like the unknown category effect in `ExpensesPage.tsx` lines 272-284).

#### `hooks/useOrdersView.ts` (ORD-10)

No exact analog. Use RESEARCH Pattern 3 (`resolveView` pure function, `csps-orders-view`, try/catch around `localStorage`). The view param lives in `useOrdersListParams`. `setFilter` resets the page (createListParams), so add a view setter that keeps it if the planner keeps RESEARCH A4.

#### `hooks/useOrdersQuery.ts`, `hooks/useDeletedOrdersQuery.ts`

**Analog:** `hooks/useExpensesQuery.ts` and `useDeletedExpensesQuery.ts`:

```typescript
export const expensesKey = ['company-expenses'] as const;
export function useExpensesQuery(params: ExpensesListQuery) {
  return useListQuery({ key: expensesKey[0], params, fetcher: (query, signal) => expensesService.list(query, signal) });
}
```

Keys `['orders']` and `['orders-deleted']`.

#### `hooks/useOrderQuery.ts`, `hooks/useDeletedOrderQuery.ts`

**Analog:** `hooks/useExpenseQuery.ts` (lines 1-21) for the shape and own root key (`['order', id]`). **Difference:** the order page is long-lived and writes `setQueryData(orderKey(id), response)` after every save (RESEARCH Pattern 4), so do not copy `gcTime: 0`. Keep `refetchOnWindowFocus` default or off by planner choice; windows never read `version` from this query (they keep `opened`).

#### `hooks/useOrderAction.ts`

**Analog:** `hooks/useExpenseAction.ts` (lines 1-22), copied as is with an order type:

```typescript
export function useExpenseAction<TExpense extends { readonly id: string }>(
  send: (key: string, expense: TExpense) => Promise<void>,
  onSuccess: (expense: TExpense) => Promise<unknown>,
): SubmissionState<TExpense, void> {
  const generation = useRef(0);
  return useSubmission(send, {
    identity: (expense) => `${expense.id}:${String(generation.current)}`,
    onSuccess: (_result, expense) => { void onSuccess(expense).then(() => { generation.current += 1; }); },
  });
}
```

For status moves the result is `OrderDetailResponse`, so generalize the result type (`useSubmission<T, R>`).

#### `hooks/useRefreshOrders.ts`

**Analog:** `hooks/useRefreshExpenses.ts` (lines 1-19): `Promise.all` of `invalidateQueries` for `['orders']`, `['orders-deleted']` and the three list-entry keys (their `useCount` decides Settings Delete).

#### `hooks/useProductTypesQuery.ts` and siblings

**Analog:** `hooks/useExpenseCategoriesQuery.ts` (13 lines). Export a key constant per list.

### Web: forms and windows

#### `components/Order{Item,Payment,Discount,Expense,Refund}Modal.tsx`

**Analog:** `components/ExpenseModal.tsx`. Copy these parts:
- **Imports** (lines 4-52): `zodResolver`, `useForm`/`Controller`/`useWatch`, `@/components/*` area imports, `isHttpError`, `serverFieldMessage`, `useSubmission`, `PaidBySelect`, copy and schema imports, `describeHttpError`/`errorLine`.
- **Opened snapshot** (lines 176-182): the window keeps the order it opened with; the save sends `opened.version` (Pitfall 10).

```typescript
const [opened, setOpened] = useState<ExpenseDetailResponse | null>(null);
const fresh = isEdit && query.isSuccess && query.isFetchedAfterMount ? query.data : null;
if (opened === null && fresh !== null) { setOpened(fresh); }
```

  For orders, `opened` is the order passed in when the window opens (no extra fetch needed, since the page already holds the full order).
- **Form setup** (lines 193-206): `zodResolver(schema(today, stored))`, `mode: 'onBlur'`, `paidByUserId: user?.id ?? ''` default (D-11).
- **Failure mapping** (lines 239-272): 409 `edit.stale` to the ConflictBanner count; 400 to `serverFieldMessage` per field in `FIELD_ORDER`, focus the first; else one line. Add 422 for `orders.locked`, `orders.payment-below-refunds` and the refund caps (server text in a banner, then refetch).
- **Submission** (lines 274-291): `useSubmission(send, { onSuccess: (saved) => { onSaved(saved); onClose(); }, onFailure: showFailure })`. `onSaved` receives the whole order, which the page writes with `setQueryData`.
- **RecordMeta** (lines 491-497) in edit mode, with the D-44 item fields for the item window.
- D-58 dirty check: route `Modal onClose` through `formState.isDirty`, open `ConfirmDialog` with `cancelLabel` "Keep Editing" (needs the new ConfirmDialog prop).

`PaidBySelect` use (around line 438) with the new props: `label` "Received by"/"Paid by"/"Refunded by", `name` `receivedByUserId`/`paidByUserId`/`refundedByUserId`, and a matching `hint`.

#### `components/PaidBySelect.tsx` (change)

Today `label={COPY.label}`, `name="paidByUserId"`, `hint={COPY.hint}` are fixed (lines 49-60). Add optional `label`, `name`, `hint` props defaulting to those values so `PaidBySelect.test.tsx` and Phase 6 stay green.

#### `components/ListEntrySelect.tsx`

**Analog:** `components/ExpenseCategorySelect.tsx` (87 lines; modes `picker` and `filter`, "(retired)" label for the saved entry). Parameterize by a list config (query hook, copy). Keep `ExpenseCategorySelect` as a thin wrapper so its test passes.

#### `ordersSchemas.ts`, `orderListSchemas.ts`

**Analog:** `expensesSchemas.ts` lines 1-40:

```typescript
import { z } from 'zod';
import { moneyInputError } from '@/components/entry';
import { isCalendarDate } from '@/lib/url-state/parsers';
import { formatCalendarDate, isMoneyText, moneyTextToCentavos } from '@/utils/format';
import { EXPENSES_COPY } from './expensesCopy';

// The strict CSP has no 'unsafe-eval': every schema runs in its plain (non-generated) mode (see profileSchemas.ts).
z.config({ jitless: true });
```

Copy the range schema (lines 20-29) for the custom date range. Messages mirror `OrderRules.cs` word for word (OR-3). `orderListSchemas.ts` copies `categorySchemas.ts`.

#### `pages/OrderFormPage.tsx` (F1 create, F2 edit details)

Form logic from `ExpenseModal.tsx` (above). Create uses one `Idempotency-Key` per submission through `useSubmission`; edit sends `version`. Unsaved-changes guard: RESEARCH Pattern 7 (`useBlocker`, `useBeforeUnload` from `react-router`, a `leaving` ref set before `navigate`). Tests must use `createMemoryRouter`, as `routes.test.tsx` does. Item grid (`OrderItemsEditor`) uses `useFieldArray`; no analog in the repo.

### Web: pages

#### `pages/OrdersPage.tsx` (L1)

**Analog:** `pages/ExpensesPage.tsx` `ExpensesRoute` (lines 218-597). Copy:
- **Params and query** (lines 241-250): `useExpensesListParams()`, `useSettledListParams(values, 300)`, query from settled values.
- **Clamp page** (lines 262-270):

```typescript
const { clampPage } = set;
const fresh = query.isSuccess && !query.isPlaceholderData;
useEffect(() => { if (fresh) { clampPage(pageCount); } }, [fresh, pageCount, clampPage]);
```

- **Unknown id falls back** (lines 272-284) for `productType`.
- **Server today** (line 308): `const today = data?.today ?? null;` (D-59). Never `new Date()`.
- **Header with Manager link** (lines 428-447): `isManager && <ButtonLink variant="secondary" to="/admin/expenses/deleted">`, then the primary action. For orders the primary is a `ButtonLink` to `/admin/orders/new`.
- **FilterBar, ResultBar with FilterChip per non-default filter, ResponsiveTable, Pagination** (lines 502-595). The grid view renders `OrderCard`s in the same results region.
- **Document title** (lines 252-254): `document.title = \`${COPY.documentTitle}${ADMIN_COPY.titleSuffix}\``.

No delete on rows (D-22). Pass list state in `Link` state for the D-51 back link, read back through `safeReturnUrl` (`modules/admin/guard.ts` line 25) plus a `/admin/orders` prefix check.

#### `pages/OrderPage.tsx` (O1)

List and query parts as above; tabs from `useOrderTab` and `Tabs`/`getTabPanelProps` from `@/components` (see `ProfilePage.tsx` for a tabbed admin page). Single-click actions (status, delete) through `useOrderAction`; soft delete through `ConfirmDialog` like the delete confirm in `ExpensesPage.tsx` lines 474-484, with `cascadeSentence` counts. Every write: `queryClient.setQueryData(orderKey(id), order)` then `refreshOrders()`.

#### `pages/DeletedOrdersPage.tsx` (X1) and `pages/DeletedOrderPage.tsx` (X2)

**Analog:** `pages/DeletedExpensesPage.tsx`. Restore (lines 204-246):

```typescript
const restoration = useExpenseAction<DeletedExpenseListItem>(
  (key, expense) => expensesService.restore(expense.id, key),
  ... toast, return refreshAll()
);
```

Row actions named by row (lines 111-133). Purge copies `PurgeExpenseDialog.tsx` (lines 34-73), including the 404 "already gone" branch, but adds the type-to-confirm order number and the counts (07 D-28). Paging only, no search (D-52): params copy `useDeletedExpensesListParams` without `q` and `category`.

#### `pages/SettingsPage.tsx` (tabs)

Keep the existing category section (lines 80-175 columns and actions, 237-290 retire, reactivate and delete through action hooks, 360-420 the card and `CategoryModal`). Extract it into `components/ListSettingsSection.tsx` parameterized by list config, then render one per `useSettingsTab` tab. `toNumber` (line 52) handles `number | string` counts (RESEARCH Pitfall 8).

#### `routes.tsx`

Copy the lazy loader pattern (lines 90-100) and the Manager redirect loader (lines 122-124):

```typescript
const requireManagerOrExpenses: LoaderFunction = async (args) =>
  (await import('@/modules/admin/guard')).requireManagerLoader(args, '/admin/expenses');
```

as `requireManagerOrOrders` with `/admin/orders`. Replace `{ path: 'orders', lazy: notFoundPage }` (line 150) with `orders`, `orders/new`, `orders/deleted` (loader), `orders/deleted/:id` (loader), `orders/:id`, `orders/:id/edit`. Change line 146 to `throw redirect('/admin/orders');` (D-61) and update the header comment at lines 9-10. Remove `{ path: 'orders', lazy: previewPage }` from `devRoutes` (line 201), then fix `routes.test.tsx` (lines 117, 157, 400, 497), `e2e/admin.spec.ts`, `e2e/shell.spec.ts`, `e2e/sweep.ts`.

### Web: tests

#### `web/src/test/orderFixtures.ts`

**Analog:** `web/src/test/expenseFixtures.ts` (lines 1-40): typed from `components['schemas']`, a fixed business today constant (`EXPENSE_TODAY = '2026-10-25'`), long-text constants, and MSW handlers through `server` from `@/test/msw` that record requests. Use clearly fake names only.

#### `web/e2e/testing-api.ts` (`createOrder`)

**Analog:** `createExpense` (lines 117-126):

```typescript
export async function createExpense(request: APIRequestContext, input: ExpenseSeedInput): Promise<string> {
  const response = await request.post('/api/testing/expenses', { data: input });
  expect(response.status(), 'POST /api/testing/expenses').toBe(201);
  const body: unknown = await response.json();
  if (!isRecord(body) || typeof body.id !== 'string') {
    throw new Error('POST /api/testing/expenses returned an unexpected body.');
  }
  return body.id;
}
```

`OrderSeedInput` mirrors `TestingOrderRequest`, including `refunds` (D-62).

## Shared Patterns

### Authorization (backend)
**Source:** `OrdersController.cs` line 24 (`[Authorize(Policy = Policies.Staff)]` on the class) and lines 202-203 (`[Authorize(Policy = Policies.Manager)]` per action).
**Apply to:** the D-24 action. Add its matrix row (`AuthorizationMatrix.cs` line 246 pattern).

### Result to HTTP (backend)
**Source:** `OrdersController.cs` lines 108-109: `result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));`
**Apply to:** every new or changed action.

### Business today (both tiers)
**Source:** `ListCompanyExpensesHandler.cs` line 43 (server) and `ExpensesPage.tsx` line 307-308 (client: "The server's business today, never the device clock").
**Apply to:** list and detail handlers; `DueFlag`, date presets, form defaults, future-date checks.

### Idempotent single-click actions (web)
**Source:** `hooks/useExpenseAction.ts`; `lib/forms/useSubmission.ts`.
**Apply to:** status, reopen, cancel, delete, restore, purge, list retire and reactivate. POSTs send a key; DELETEs send none.

### 409 and server field errors (web)
**Source:** `ExpenseModal.tsx` lines 239-272 and `ConflictBanner`.
**Apply to:** every window and the Edit Details form.

### Cache after writes (web)
**Source:** `useRefreshExpenses.ts`; RESEARCH Pattern 4.
**Apply to:** every order write: `setQueryData(['order', id], response)` then invalidate lists.

### Manager-only pages (web)
**Source:** `routes.tsx` lines 122-124, 153.
**Apply to:** `/admin/orders/deleted` and `/admin/orders/deleted/:id`.

### Copy and comments
Every string lives in `ordersCopy.ts` / `orderListsCopy.ts`, none in JSX. No em or en dash anywhere in `web/src` (OR-4, checked by `no-long-dash.node.test.ts`). Short file header comment saying what the file does, as each analog has. Files that differ from the design carry `// SPEC-GAP:` or `// SPEC-DEVIATION:` lines (see `PaidBySelect.tsx` line 1, `ExpenseModal.tsx` line 491).

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `components/DueFlag.tsx` | component | transform | No due-date logic exists yet. Use RESEARCH Pattern 5 and the UI-SPEC Due flag table. |
| `components/OrderItemsEditor.tsx` | component | form field array | First `useFieldArray` grid in the repo. Use UI-SPEC F1 card 4. |
| `hooks/useOrdersView.ts` | hook | URL + localStorage | No view toggle with storage yet. Use RESEARCH Pattern 3. |
| `pages/OrderFormPage.tsx` guard part | page | navigation block | No `useBlocker` use yet. Use RESEARCH Pattern 7. |

## Watch Items for the Planner

- `ListOrdersHandler` avoids the calendar to hold two commands. D-59 adds it back; make sure the D-60 "3 commands" test cannot see a settings read on a cold cache.
- The OpenAPI snapshot and generated types are shared hot files: all backend changes in one plan or strict serial waves. Other hot files: `routes.tsx`, `ordersCopy.ts`, `utils/csps.ts`, `components/index.test.ts`.
- `ConfirmDialog` needs `cancelLabel` and `confirmIcon` props before any "Keep Editing" or "Cancel Order" dialog.
- `fullyPaid` is true for a credit too. Completed needs `balance === 0` and no credit.

## Metadata

**Analog search scope:** `src/Csps.Application/{Orders,Expenses,Ports}`, `src/Csps.Infrastructure/{Orders,Time}`, `src/Csps.Server/Controllers`, `src/Csps.Domain/Orders`, `tests/*/Orders`, `tests/*/Authorization`, `web/src/modules/admin/**`, `web/src/test`, `web/e2e`
**Files scanned:** about 45
**Pattern extraction date:** 2026-10-29
