---
created: 2026-10-08T13:35:00-05:00
updated: 2026-10-26T16:18:49-05:00
---

# List state in the URL, and the list query

This page explains how a list screen keeps its view in the URL and loads its rows (requirements WEB-10 and WEB-08). It is written for every phase that builds a list: orders, payments, expenses, users, the audit log, the gallery and the dashboard.

The short version:

- **One hook per list.** Define the list's URL parameters once with `createListParams`. The screen reads and writes them only through the hook that returns. Never copy them into `useState` or form state.
- **The URL is untrusted input.** Every parameter goes through an allow-list parser. A bad value falls back to its default, and the URL is cleaned up once.
- **The parsed values are the only input of the query.** `useListQuery` keys on them. They go through `useSettledListParams(values, 300)` first, so the typed search is debounced and the page reset waits with it.

The code is in `web/src/lib/url-state/` (URL state) and `web/src/lib/query/` (TanStack Query).

## 1. Where `UrlStateLayout` sits

`UrlStateLayout` (the default export of `web/src/lib/url-state/UrlStateLayout.tsx`) is the one nuqs adapter. It renders `NuqsAdapter` from `nuqs/adapters/react-router/v8` around `<Outlet />` with the shared options.

Mount it as a **lazy, pathless layout route**:

- above the admin routes, and
- above every public route that keeps URL state (today only the Gallery, GAL-01).

```ts
{
  lazy: async () => ({ Component: (await import('@/lib/url-state/UrlStateLayout')).default }),
  children: [/* admin routes */],
}
```

Because it is lazy, public pages without URL state never download nuqs. Never put the adapter around `RouterProvider`; it must sit inside the router. If that nesting ever fails, the fallback is the root route's `<Outlet />`.

The shared options (`URL_STATE_DEFAULTS` in `defaultOptions.ts`) are `{ shallow: true, clearOnDefault: true, scroll: false }`:

- `shallow: true` is the nuqs default. Never set `shallow: false` (nuqs bug #1563). ESLint rejects it.
- `clearOnDefault: true` keeps default values out of the URL.
- `scroll: false` means a URL change never scrolls the page.

Never pass the nuqs `startTransition` option (nuqs bug #1567). ESLint rejects it too.

The adapter also orders the query string through `orderSearchParams`: `page`, `size`, `q`, then every other key by name (code-unit order). So the same view always gives the same URL, whatever order a link arrived in.

## 2. Defining a list's parameters

Call `createListParams` once, at module level, and export the hook it returns:

```ts
import { createListParams } from '@/lib/url-state/createListParams';
import {
  dateRangeParsers,
  literalParser,
  pageParser,
  pageSizeParser,
  searchParser,
} from '@/lib/url-state/parsers';

export const useOrdersListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  status: literalParser(['active-recent', 'all', 'ready', 'done'], 'active-recent'),
  sort: literalParser(['due', 'newest', 'balance', 'total'], 'due'),
  ...dateRangeParsers(['last-30-days', 'this-month'], 'last-30-days'),
});
```

The state keys are the URL keys. `page`, `size` and `q` are shared by every list. A list that has no paging or search simply leaves them out.

The hook returns `[values, setters]`. `values` holds the parsed, defaulted values: always typed, never a raw string.

### The parsers

| Parser | Accepts | Anything else becomes |
|--------|---------|-----------------------|
| `pageParser` | A plain whole number of 1 or more (`2`, `15`) | Page 1 (`0`, `-3`, `2.5`, `1e3`, ` 2` are all rejected) |
| `pageSizeParser` | One of `PAGE_SIZES`: 10, 20, 50, 100 | 20. The server still caps the size at 100 (SEC-03). |
| `searchParser` | Any text. It is trimmed and cut to 100 UTF-16 code units, the same unit as the input's `maxLength` and .NET `string.Length`. The cut never splits an emoji. | No search (`q` removed) when the text is empty or only spaces |
| `literalParser(values, default)` | One of the listed strings, exact case | The default. Use it for status, sort, tab and view. |
| `parseAsBusinessDate` | A real calendar date written `YYYY-MM-DD` (`2024-02-29` yes, `2026-02-29` no) | No date |
| `dateRangeParsers(presets, default)` | `range` (a preset name or `custom`), `from`, `to` | The default preset |

A parameter without a default (for example the Orders `view`, ORD-10) is `null` when the URL has no valid value. Use `parseAsStringLiteral` from `nuqs` directly for that case.

### Cleaning up a bad URL

When the screen opens on a URL with an invalid value (`?page=0&size=9999&status=bogus`), every bad value falls back to its default. The URL is then rewritten **once**, with `replace`, to the canonical form (in this example, an empty query string). A value equal to its default is removed the same way, and an untrimmed search is rewritten trimmed. Opening an already-canonical URL changes nothing.

## 3. Changing the view: push or replace

| Setter | History | Page |
|--------|---------|------|
| `setPage(n)` | **push**: adds a history entry, so Back returns to the previous page | n (anything below 1 or not a whole number means 1) |
| `setPageSize(size)` | replace | reset to 1 in the same update |
| `setSearch(text)` | replace, after 300 ms without typing; the list hook times the wait itself, so the search and the page reset land in one update (D-68) | reset to 1 in the same update |
| `setSearch(text, { immediate: true })` (Enter) | replace at once, and cancels a pending write | reset to 1 |
| `setFilter(key, value)` (filter, sort, tab, view) | replace | reset to 1 in the same update |
| `setFilters({ ... })` (several values together) | replace | reset to 1 in the same update |
| `clampPage(totalPages)` | replace | a page past the last page becomes the last page; 0 pages means page 1 |
| `reset()` | replace | every key of the list removed |

Setting a value to `null` or to its default removes it from the URL. Two setters called in the same event make one URL update (nuqs batches them).

**While a search waits** (the 300 ms after the last keystroke):

- The screen already shows the typed search and page 1; only the URL write waits.
- Enter (`{ immediate: true }`) writes at once.
- Any other change (a filter, the page size, the page) writes the waiting search in the same update, with that change's own history mode.
- `reset()` and leaving the list drop the waiting search, so nothing is written later.

Call `clampPage(totalPages)` once the server has said how many pages there are. When there are no rows at all, show the EmptyState component; do not change the page further.

### Never move the URL with `<Navigate>`

Never render `<Navigate>` to set or change query parameters (nuqs bug #1245). To send the user to another view, redirect from the route's `loader` with `redirect()`.

A URL parameter never reaches an `href`, `navigate()` or a redirect without going through its parser first (CWE-601).

## 4. Privacy rules

The owner chose to keep search text in the URL so that a shared link reopens the same view. In return:

- **Tokens, codes and secrets never go in a URL.**
- **Personal data never gets its own parameter.** No `email=`, `phone=` or `name=`. Personal data may appear only inside the free-text `q`.
- `createListParams` enforces this when the list is defined: a key such as `email`, `customerEmail`, `phone`, `mobile`, `name`, `address`, `token`, `access-token`, `password`, `secret`, `otp` or `code` throws a `TypeError` straight away. Use an id instead (for example the audit log's actor filter holds the user id, never an email, AUDIT-02). Ordinary keys such as `orderCode` are allowed.
- Analytics, Core Web Vitals and error reports send the path without the query string (ANL-05). The server logs the path without the query string (FND-07). The `Referrer-Policy` header keeps the query from other sites (SEC-01). The server rejects search text over 100 characters (SEC-03).

## 5. Date rules

- Date filters are plain `YYYY-MM-DD` strings in business time (Asia/Manila). Use `parseAsBusinessDate`. Never use the nuqs `parseAsIsoDate`: it goes through UTC and can shift the day. ESLint rejects the import.
- A preset range (Last 30 days, This month, and so on) is stored **by its name** (`range=last-30-days`). It is worked out again against the business "today" on every visit, so a bookmark always means "the last 30 days from now".
- Only a custom range stores `from` and `to` (`range=custom&from=2026-09-01&to=2026-09-30`).
- Write a range with `setFilters(dateRangeValues(choice))`. For a preset that removes `from` and `to`; for `custom` it stores them.
- Read a range with `resolveDateRange(values, today)`, where `today` comes from `businessToday(now)` and `now` comes from the clock the screen owns. Nothing is ever defaulted from `new Date()`. A custom range with its dates the wrong way round is swapped.

```ts
const [values, { setFilters }] = useExpensesListParams();
const range = resolveDateRange(values, businessToday(clock.now()));
// The toolbar's "This month" button:
setFilters(dateRangeValues({ range: 'this-month' }));
```

## 6. Loading the rows: the list query (WEB-08)

Query defaults (`QUERY_DEFAULTS` in `web/src/lib/query/queryClient.ts`, plan 02-39):

- data stays fresh for 30 seconds and is kept for 5 minutes;
- Query never retries, because the HTTP client already retries (capped);
- data is refetched when the window regains focus.

The app creates one client with `createQueryClient()`. Every test creates its own. One query may override a default (for example `staleTime: 0` on a money detail) without changing the shared ones.

Feed the hook's values into `useListQuery`:

```tsx
const [values] = useOrdersListParams();
const params = useSettledListParams(values, 300);
const orders = useListQuery({
  key: 'orders',
  params,
  fetcher: (params, signal) => api.listOrders(params, signal),
});
```

- The query key is `listKey('orders', params)`, which is `['orders', 'list', params]`. It holds only parsed, defaulted values, never a raw string or `location.search`. A hostile URL therefore never becomes a query key or a request.
- **The debounce rule:** the search box writes the URL after 300 ms (`setSearch`), and the query key uses `useSettledListParams(values, 300)` (`web/src/lib/query/useSettledListParams.ts`, plan 02-30), never the immediate values. While the typed search has not settled (it uses `useDebouncedValue` inside), the query keeps the values it last ran with; then it runs once for the settled text. Typing "jersey" sends one request, not six. Debouncing only `q` (the earlier advice) is not enough: `setSearch` resets the page at once, so the key changed twice and an extra, unfiltered page-1 request went out at the first keystroke (found by `web/src/components/lists/listState.integration.test.tsx`). A page, filter or size change still reaches the query at once.
- Always pass `signal` on to `api.ts`. The query aborts a request that is no longer needed (the screen closed, or the search changed while it was loading).
- While the next page loads, the previous page's rows stay on screen (`isPlaceholderData` is true).
- `api.ts` turns the params into the request (WEB-04). A query parameter named `code` is rejected there; rename it (for example `orderCode`).

## 7. Intent prefetch

`prefetchOnIntent(queryClient, options)` (in `web/src/lib/query/prefetchOnIntent.ts`) returns `onPointerEnter`, `onPointerLeave`, `onFocus` and `onBlur` handlers for a link or row. When a mouse pointer rests on it, or keyboard focus stays on it, for 100 ms (`INTENT_DELAY_MS`), the target screen's query starts, so the data is ready when the user opens it. Leaving first cancels it. A touch pointer is ignored. It uses `queryClient.query(...)`, never the deprecated `prefetchQuery`.

## 8. Testing a list

- Test a list hook with the nuqs testing adapter (`NuqsTestingAdapter` or `withNuqsTestingAdapter` from `nuqs/adapters/testing`) and an `onUrlUpdate` spy. Pass `defaultOptions={URL_STATE_DEFAULTS}` and `processUrlSearchParams={orderSearchParams}` to get the app's options.
- In a real router, nuqs writes the browser history directly, so React Router's `useLocation().search` does not change after a nuqs write (L-16). Assert `window.location.search` with `createBrowserRouter`, and read list state only through the hook.
- user-event and axe hang on fake timers. Use real timers, except for debounce tests, which fire one input event per character with `fireEvent` on fake timers.
- Every list screen adds a Playwright test: list, open a row, Back, and the filters and rows are restored.
- nuqs patches `window.history` once, on its first mount, and marks it as patched. A test that spies on `history.replaceState` or `pushState` before that first mount loses the patch when the spy is restored, and later tests in the file read stale list state. Mount the list once in a `beforeAll` first (as `listState.integration.test.tsx` does).
- The list toolkit (`@/components/lists`, plan 02-30) wires straight to the hook: `SearchBox onSearch={setters.setSearch}`, each filter `Select` and `FilterChip onClear` to `setFilter`, `Pagination onPageChange={setters.setPage}` and `onPageSizeChange={setters.setPageSize}`.
