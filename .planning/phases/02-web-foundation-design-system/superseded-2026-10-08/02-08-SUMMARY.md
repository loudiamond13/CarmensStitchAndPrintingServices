---
phase: 02-web-foundation-design-system
plan: 08
subsystem: web
tags: [nuqs, react-router, tanstack-query, url-state, debounce, prefetch, vitest]
created: "2026-10-08T01:32:00-05:00"
updated: "2026-10-08T01:32:00-05:00"

requires:
  - phase: 02-web-foundation-design-system
    provides: "Plan 01: nuqs 2.10.1, @tanstack/react-query 5.103.2 and react-router 8.4.0 installed and approved"
  - phase: 02-web-foundation-design-system
    provides: "Plan 02: npm run verify, the ESLint bans on the deprecated nuqs adapters, the startTransition option and shallow: false, the console guard"
provides:
  - "web/src/lib/url-state/parsers.ts: parseAsPage, pageSizeParser, PAGE_SIZES, literalParser, parseAsSearch, normalizeSearch, SEARCH_MAX_LENGTH, parseAsBusinessDate, RANGE_PRESETS, parseAsRangePreset, resolveRangePreset, businessToday"
  - "web/src/lib/url-state/createListParams.ts: createListParams(parsers, { urlKeys }) -> useXxxListParams() returning [values, { setPage, setPageSize, setFilter, setSearch, setSort, setTab, setView, clampPage, reset }]; SEARCH_DEBOUNCE_MS"
  - "web/src/lib/url-state/defaultOptions.ts: URL_STATE_DEFAULTS and orderSearchParams"
  - "web/src/lib/url-state/UrlStateLayout.tsx: default-export NuqsAdapter (react-router/v8) around <Outlet/>, for a lazy pathless layout route"
  - "web/src/lib/query/: createQueryClient, QUERY_DEFAULTS, keys (list, detail, site.settings), useListQuery, useDebouncedValue, prefetchOnIntent"
affects: [02-13, 02-15, 05, 06, 08, 10, 11, 12, 13]

actuals:
  tokens: 15676       # chars/4 over git diff e1d48e9..7d1a879 (62704 chars)
  tasks: 3
  commits: 6
plan_head_before: e1d48e96ce0b061d9175dff55b5bffc1a520b244
plan_head_after: 7d1a8799f35b9bce19b2a81f4d09a4d007a24b01

tech-stack:
  added: []
  patterns:
    - "One list hook per list: createListParams(parsers) over two nuqs useQueryStates reads (typed values + raw strings); a single useEffect rewrites invalid, default or non-canonical keys with one replace"
    - "History rule in one place: setPage pushes; every other setter replaces and writes page: null in the same setParams call"
    - "NuqsAdapter processUrlSearchParams = orderSearchParams, so every URL nuqs writes has the keys in one fixed order"
    - "Query keys come from keys.list(area, params) with parsed, defaulted values; useListQuery passes the AbortSignal and keeps the previous page as placeholder data"
    - "Intent prefetch is plain onPointerEnter/onFocus handlers over queryClient.query, never RR <Link prefetch>"

key-files:
  created:
    - web/src/lib/url-state/parsers.ts
    - web/src/lib/url-state/parsers.test.ts
    - web/src/lib/url-state/defaultOptions.ts
    - web/src/lib/url-state/defaultOptions.test.ts
    - web/src/lib/url-state/createListParams.ts
    - web/src/lib/url-state/createListParams.test.tsx
    - web/src/lib/url-state/UrlStateLayout.tsx
    - web/src/lib/url-state/UrlStateLayout.test.tsx
    - web/src/lib/query/queryClient.ts
    - web/src/lib/query/queryClient.test.ts
    - web/src/lib/query/keys.ts
    - web/src/lib/query/useListQuery.ts
    - web/src/lib/query/useListQuery.test.tsx
    - web/src/lib/query/useDebouncedValue.ts
    - web/src/lib/query/useDebouncedValue.test.tsx
    - web/src/lib/query/prefetchOnIntent.ts
    - web/src/lib/query/prefetchOnIntent.test.tsx
  modified: []

key-decisions:
  - "createListParams reads the list twice through nuqs useQueryStates (typed parsers + parseAsString). nuqs echoes this hook's own typed writes to the raw read through its shared key emitter, so normalization acts only on raw values that are strings; everything it writes is canonical, so it runs at most once per invalid input"
  - "Normalization removes invalid values and values equal to their default (?page=1 never stays), and rewrites a valid but non-canonical value (an untrimmed or over-long search), all in one replace"
  - "URL key order is page, size, q, then the other keys by name (code-unit order), applied by orderSearchParams as NuqsAdapter processUrlSearchParams. An adapter-level hook cannot see one list's declaration order, so the plan's 'declared filter keys' order became name order; equal values still always give one query string"
  - "nuqs shallow writes go straight to window.history and do not update React Router's location: useLocation().search is stale after a list-state change until the next router navigation or popstate. List screens must read list state only through their list hook"
  - "Intent prefetch calls queryClient.query(options).catch(noop): TanStack Query 5.103.2 deprecates prefetchQuery (its source is fetchQuery().then(noop).catch(noop); query is the same fetch-if-stale call) and the zero-warning lint (@typescript-eslint/no-deprecated) rejects it"
  - "createListParams refuses, at creation, any URL key that would name personal data or a secret (email, phone, mobile, name, first/last/full/customer name, address, token, access/refresh token, password, secret, otp, code), compared lower-case with non-letters removed (CWE-598)"
  - "Range presets are today, last-7-days, last-30-days, this-month, last-month and this-year; 'last N days' includes today (last-30-days on 2026-10-07 is 2026-09-08..2026-10-07)"
  - "Assumption A9 confirmed: React Compiler lint (react-hooks 7) is clean on every new hook; no 'use no memo' was needed"

patterns-established:
  - "List screen recipe: const useXListParams = createListParams({ page: parseAsPage, pageSize: pageSizeParser, search: parseAsSearch, status: literalParser([...], 'all') }); const [params, set] = useXListParams(); const q = useDebouncedValue(params.search); useListQuery({ area: 'x', params: { ...params, search: q }, queryFn: api.x.list })"
  - "A view mode that falls back to localStorage (ORD-10) uses parseAsStringLiteral(['grid','table']) with no default"
  - "Hook tests use withNuqsTestingAdapter({ searchParams, onUrlUpdate, hasMemory: true, defaultOptions: URL_STATE_DEFAULTS, processUrlSearchParams: orderSearchParams }) and assert history plus queryString; layout tests use createBrowserRouter and assert window.location"

requirements-completed: [WEB-08, WEB-10]

coverage:
  - id: D1
    description: "Allow-list parsers: strict base-10 page and page size, literal values, search trimmed and capped at 100 UTF-16 code units with no lone surrogate, calendar-checked YYYY-MM-DD business dates, range presets resolved against an injected business today, businessToday in Asia/Manila"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/lib/url-state/parsers.test.ts (70 cases incl. '0','-1','1.5','2.5','1e3',' 2','0x10' rejected; 9999 and '20.0' rejected; 100 kept, 101 cut, emoji straddle dropped; 2026-02-30 rejected; last-30-days 2026-09-08..2026-10-07; businessToday(2026-10-05T16:30Z) = 2026-10-06)"
        status: pass
    human_judgment: false
  - id: D2
    description: "An invalid list URL (?size=9999&page=0&status=bogus, ?from=2026-02-30, ?q=spaces, ?page=1 defaults) parses to defaults and is rewritten once with replace; no query string writes nothing; a re-render with the normalized URL writes nothing more"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/lib/url-state/createListParams.test.tsx#createListParams: normalize once (16 cases)"
        status: pass
    human_judgment: false
  - id: D3
    description: "History and page reset: setPage pushes; setFilter, setPageSize, setSearch, setSort, setTab, setView replace and drop the page in one update; clampPage replaces a page past the last page; reset clears; keys serialize in one fixed order"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/lib/url-state/createListParams.test.tsx#createListParams: history and page reset (17 cases); web/src/lib/url-state/defaultOptions.test.ts (5 cases)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Search writes the URL after 300 ms of quiet (one update for 'jer' then 'jersey'), at once with { immediate: true }, and removes blank search"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/lib/url-state/createListParams.test.tsx#createListParams: search (4 cases, fake timers)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Personal-data and secret URL keys are refused when a list hook is created (CWE-598 prohibition)"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/lib/url-state/createListParams.test.tsx#createListParams: privacy (CWE-598) (12 cases)"
        status: pass
    human_judgment: false
  - id: D6
    description: "UrlStateLayout (NuqsAdapter from nuqs/adapters/react-router/v8 around Outlet) as a pathless layout route: setPage(2) pushes ?page=2, Back restores page 1, shared defaults and key order apply, a router navigation is read, an invalid link is normalized without a new history entry, no markup of its own"
    requirement: WEB-10
    verification:
      - kind: unit
        ref: "web/src/lib/url-state/UrlStateLayout.test.tsx (6 cases); grep -c 'nuqs/adapters/react-router/v8' UrlStateLayout.tsx = 1"
        status: pass
    human_judgment: false
  - id: D7
    description: "Query defaults (staleTime 30 s, gcTime 5 min, retry false for queries and mutations, refetchOnWindowFocus) and query keys; useListQuery keys on parsed values, passes the AbortSignal, keeps the previous page as placeholder data, aborts a superseded search key, honours enabled"
    requirement: WEB-08
    verification:
      - kind: unit
        ref: "web/src/lib/query/queryClient.test.ts (3); web/src/lib/query/useListQuery.test.tsx (7 incl. keys)"
        status: pass
    human_judgment: false
  - id: D8
    description: "useDebouncedValue(q, 300) returns only the settled value; prefetchOnIntent's pointerenter/focus handlers prefetch the target, swallow errors and add no markup"
    requirement: WEB-08
    verification:
      - kind: unit
        ref: "web/src/lib/query/useDebouncedValue.test.tsx (3); web/src/lib/query/prefetchOnIntent.test.tsx (4)"
        status: pass
    human_judgment: false
  - id: D9
    description: "Whole web gate still green with the new code at 100% coverage"
    verification:
      - kind: other
        ref: "npm --prefix web run verify (exit 0; 26 files, 687 tests; all files 99.79/99.07/100/100; src/lib/url-state and src/lib/query 100% in filtered runs)"
        status: pass
      - kind: other
        ref: "CSPS_TEST_SQL=localdb dotnet test --solution Csps.slnx (837 passed, 0 warnings)"
        status: pass
    human_judgment: false
  - id: D10
    description: "WEB-08 flagged assumption: the shared defaults (staleTime 30 s, gcTime 5 min, refetchOnWindowFocus true, retry false) fit every list; later phases may override one query"
    requirement: WEB-08
    verification: []
    human_judgment: true
    rationale: "The plan's Edge Coverage table flags this as an unresolved assumption to review manually; no test can show the defaults suit every future screen"

duration: 22min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 08: URL List State and Query Conventions Summary

**Every later list screen now gets one typed nuqs hook (`createListParams`) that validates each URL key against an allow-list, cleans an invalid link with one replace, pushes page changes and replaces everything else with a page reset, plus the TanStack Query defaults, keys, a keep-previous cancellable list query, a 300 ms debounced key and intent prefetch.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-08T06:07:36Z
- **Completed:** 2026-10-08T06:30:33Z
- **Tasks:** 3 (one tracer, two expansion)
- **Files modified:** 17 (all created)

## Accomplishments

- `parsers.ts`: strict parsers for page (`^[1-9][0-9]*$`, safe integer), page size (10/20/50/100, default 20), literals, search (trim, blank = none, 100 UTF-16 units, no lone surrogate, stable on re-parse), `YYYY-MM-DD` business dates that stay strings, range presets, and `businessToday(now, zone)`.
- `createListParams`: one hook per list that holds no copy of the state. Normalization runs at most once. `setPage` pushes. `setPageSize`, `setFilter`, `setSearch` (debounced 300 ms, immediate on Enter), `setSort`, `setTab` and `setView` replace and reset the page in the same update. It also has `clampPage` and `reset`, and refuses PII or secret URL keys.
- `UrlStateLayout`: the one `NuqsAdapter` (react-router/v8) around `<Outlet/>` with `{ shallow: true, clearOnDefault: true, scroll: false }` and fixed key order. It is a default export, ready for plan 15's lazy pathless route.
- `lib/query`: `createQueryClient` / `QUERY_DEFAULTS` (Query never retries), `keys`, `useListQuery`, `useDebouncedValue` and `prefetchOnIntent`.

## Task Commits

1. **Task 1 (tracer): normalize an invalid list URL once and drive a typed, cancellable list query**
   - `f6b7325` test: tracer tests and inert placeholders (RED)
   - `aadb191` feat: normalize-once hook, first-cut parsers, keys, query client, useListQuery (GREEN)
   - The tracer gate re-ran its `<verify>` plus the full lint. Both passed, so the tracer was verified end to end before expansion.
2. **Task 2: full parser set, push/replace setters with page reset, search debounce, clampPage, UrlStateLayout**
   - `e8a91e7` test: parser, setter, debounce, order, privacy and layout tests (RED)
   - `a8d2033` feat: full parsers, setters, PII guard, orderSearchParams, UrlStateLayout (GREEN)
3. **Task 3: query defaults, debounced key, keep-previous pagination, intent prefetch**
   - `0c3aee0` test: debounce and prefetch tests, plus query-default and keep-previous/abort tests (RED)
   - `7d1a879` feat: useDebouncedValue and prefetchOnIntent (GREEN)

**Plan metadata:** the docs commit that follows this summary.

No REFACTOR commit was needed.

## TDD Gate Compliance (RED evidence)

| Task | RED run | Failing target (assertion) | Checker |
|------|---------|----------------------------|---------|
| 1 | `vitest run createListParams.test.tsx useListQuery.test.tsx` exit 1, 2 of 2 failed, both AssertionError | `falls back to defaults for ?size=9999&page=0&status=bogus…`: `expected { page: +0, pageSize: 9999, … } to deeply equal { page, pageSize, … }`. The placeholder used plain `parseAsInteger` and never normalized. `keys the query on the parsed values…`: `expected [ [ 'demo' ] ] to deeply equal [ [ 'demo', 'list', … ] ]`. | RED_EVIDENCE_OK (`p08/t1-red-a.json`, `p08/t1-red-b.json`) |
| 2 | `vitest run src/lib/url-state` exit 1, 81 of 124 failed (80 AssertionError, 1 getByText not found) | `pushes a page change`: `expected 1 to be 2` (the setters were inert). `rejects "1.5"`: `expected 1 to be null`. `trims the text`: `expected '  jersey  ' to be 'jersey'`. businessToday: `expected '2026-10-05' to be '2026-10-06'`. Layout: `Unable to find … Page 2, status all`. | RED_EVIDENCE_OK (`p08/t2-red-parsers.json`, `t2-red-hook.json`, `t2-red-layout.json`) |
| 3 | `vitest run src/lib/query` exit 1, 7 of 16 failed, all AssertionError | `returns the latest value only after 300 ms…`: `expected 'jersey' to be 'j'`. `prefetches the target query…`: `expected "query" to be called 1 times, but got 0 times`. | RED_EVIDENCE_OK (`p08/t3-red-debounce.json`, `t3-red-prefetch.json`) |

The 9 tests that passed in the Task 3 RED run cover the query defaults and useListQuery's keep-previous and abort behaviour. The plan placed that code in the Task 1 tracer, so those Task 3 tests characterize existing code. The evidence files are in the session scratchpad under `p08/`: `t1..t3-red.{xml,log,json}`, `verify.log`, `dotnet-test.log` and `license.log`.

## Files Created/Modified

- `web/src/lib/url-state/parsers.ts`: every allow-list parser, `normalizeSearch`, range presets, `resolveRangePreset` and `businessToday`.
- `web/src/lib/url-state/createListParams.ts`: the list-hook factory, `ListParser`, `ListParserMap`, `ListParamsOptions`, `ListParamsSetters`, `SEARCH_DEBOUNCE_MS` and the PII URL-key guard.
- `web/src/lib/url-state/defaultOptions.ts`: `URL_STATE_DEFAULTS` and `orderSearchParams`.
- `web/src/lib/url-state/UrlStateLayout.tsx`: the default-export adapter layout.
- `web/src/lib/query/queryClient.ts`: `QUERY_DEFAULTS` and `createQueryClient`.
- `web/src/lib/query/keys.ts`: `keys.list`, `keys.detail` and `keys.site.settings`.
- `web/src/lib/query/useListQuery.ts`: the keep-previous list query that passes the signal on.
- `web/src/lib/query/useDebouncedValue.ts`: the debounced value hook.
- `web/src/lib/query/prefetchOnIntent.ts`: the intent handlers, `IntentHandlers` and `PrefetchOptions`.
- The tests: `parsers.test.ts` (70), `createListParams.test.tsx` (50), `UrlStateLayout.test.tsx` (6), `defaultOptions.test.ts` (5), `queryClient.test.ts` (3), `useListQuery.test.tsx` (7), `useDebouncedValue.test.tsx` (3) and `prefetchOnIntent.test.tsx` (4).

## Decisions Made

See `key-decisions` in the frontmatter. The two that matter most for later phases:

- **React Router does not see nuqs writes.** nuqs keeps `shallow: true` and writes `window.history` directly. A probe in this plan showed that `useLocation().search` stays at the old query after a write, in both a memory router and a browser router. The browser URL, refresh, bookmarks and Back are all correct. List screens must read list state only through their list hook.
- **Key order is page, size, q, then the other keys by name.** This order holds whatever order a link arrived in.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The UrlStateLayout test asserts the browser location, not the memory router's location**
- **Found during:** Task 2 (probe before writing the test)
- **Issue:** The plan asked for a `createMemoryRouter` test in which `setPage(2)` changes "the router location search". With `shallow: true` (mandatory, nuqs #1563), the react-router/v8 adapter only calls `history.pushState`. A memory router's location never changes, and neither does a browser router's internal location. A probe showed `loc: "?page=3"` and `window.location.search: "?page=2"` after the write.
- **Fix:** The test uses `createBrowserRouter` with `UrlStateLayout` as a pathless parent. It asserts `window.location.search`, the push (`history.length` + 1), Back restoring page 1, a router navigation being read, and normalization without a new entry.
- **Files modified:** web/src/lib/url-state/UrlStateLayout.test.tsx
- **Verification:** 6 layout tests pass, 3 consecutive runs.
- **Committed in:** e8a91e7, a8d2033

**2. [Rule 3 - Blocking] prefetchOnIntent calls `queryClient.query` instead of the deprecated `prefetchQuery`**
- **Found during:** Task 3 (RED lint)
- **Issue:** TanStack Query 5.103.2 marks `prefetchQuery` `@deprecated` ("Use queryClient.query(options) instead. You can swallow errors with `.catch(noop)`"). The zero-warning lint rule `@typescript-eslint/no-deprecated` fails on it.
- **Fix:** The handlers call `queryClient.query(options).catch(() => undefined)`. In the library source, `prefetchQuery` is `fetchQuery(options).then(noop).catch(noop)`, and `query` is the same fetch-if-stale call, so the behaviour is identical. A test proves a failed prefetch neither throws nor leaves an unhandled rejection, and that its error stays in the cache.
- **Files modified:** web/src/lib/query/prefetchOnIntent.ts, prefetchOnIntent.test.tsx
- **Verification:** 4 prefetch tests pass; lint clean.
- **Committed in:** 0c3aee0, 7d1a879

**3. [Rule 1 - Bug] Key order puts the other keys in name order, not declaration order**
- **Found during:** Task 2
- **Issue:** The plan said the keys follow "page, size, q, then the declared filter keys". nuqs writes with `URLSearchParams.set`, which keeps each key where it already was. So the order follows how the link arrived, which breaks the WEB-10 ordering edge. The only place to reorder is the adapter's `processUrlSearchParams`, and that is shared by every list, so it cannot see one hook's declaration order.
- **Fix:** `orderSearchParams` puts page, size and q first, then the remaining keys in code-unit order (a stable sort, so repeated keys keep their order). Equal values give one query string.
- **Files modified:** web/src/lib/url-state/defaultOptions.ts, UrlStateLayout.tsx, createListParams.test.tsx, defaultOptions.test.ts
- **Verification:** The ordering tests in the hook, layout and unit suites pass.
- **Committed in:** a8d2033

**4. [Rule 2 - Missing critical] Personal-data and secret URL keys are refused at hook creation**
- **Found during:** Task 2
- **Issue:** The plan's CWE-598 prohibition (no `email=` / `phone=` params, no tokens, codes or secrets in a URL) is marked `verification: test`, but no task had code a test could exercise.
- **Fix:** `createListParams` throws a `TypeError` when a list key would appear in the URL under a forbidden name, whether that is the key itself or its `urlKeys` mapping.
- **Files modified:** web/src/lib/url-state/createListParams.ts, createListParams.test.tsx
- **Verification:** 12 privacy cases pass.
- **Committed in:** e8a91e7, a8d2033

---

**Total deviations:** 4 auto-fixed (2 bugs, 1 blocking, 1 missing critical).
**Impact on plan:** All four were needed for correctness, zero warnings, or the plan's own prohibition. No scope creep, and no new packages.

## Issues Encountered

- The nuqs testing adapter echoes typed values into the raw `parseAsString` read; a probe showed `typeof raw.page === 'number'` after a write. Normalization therefore acts only on string raw values, which come from the URL and never from the hook's own canonical writes.
- The Vitest JUnit reporter writes `web/.vitest/junit/output.xml`. That folder is not git-ignored, so it was deleted after each RED run, and the tree is clean.
- `node web/scripts/license-gate.mjs` exits 1 on exactly the 5 expected D-BL-01 dev-tree packages. There are no new failures and no new exceptions.

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- Plan 13 (Pagination/FilterBar, WEB-06) can call `setPage`, `setFilter`, `setSearch(value, { immediate })` and `clampPage(totalPages)` directly. It should feed `useDebouncedValue(params.search)` into `useListQuery`.
- Plan 15 mounts `UrlStateLayout` lazily as the pathless layout above the admin routes (`lazy: () => import('./lib/url-state/UrlStateLayout')`). It should mind Pitfall 10's HydrateFallback warning for lazy initial routes.
- A later list screen with a date range stores a preset by name (`parseAsRangePreset([...])`). It resolves the range with `resolveRangePreset(name, businessToday(clock.now()))` and keeps custom `from` and `to` through `parseAsBusinessDate`.

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 17 key files exist on disk.
- Commits f6b7325, aadb191, e8a91e7, a8d2033, 0c3aee0 and 7d1a879 are present in `git log`.
- The acceptance checks pass: `grep -c "nuqs/adapters/react-router/v8" UrlStateLayout.tsx` = 1, and `grep -c "retry: false" queryClient.ts` = 2.
- The plan verification passes: `npm --prefix web run test -- --run src/lib/url-state src/lib/query` and `npm --prefix web run verify` both exit 0.
