---
phase: 08-order-screens
plan: 09
subsystem: ui
tags: [react, tanstack-query, nuqs, zod, msw, vitest, playwright, orders, search, filters, url-state, tdd, a11y]
created: "2026-10-29T22:55:00-05:00"
updated: "2026-10-29T22:55:00-05:00"

requires:
  - phase: 08-order-screens
    provides: "08-04 ListEntrySelect (filter mode) and useProductTypesQuery; 08-06 OrdersPage, useOrdersListParams (page, size), useOrdersQuery, ordersService, orderFixtures and createOrder"
provides:
  - "useOrdersListParams keys q, status, dates, from, to, productType, hasBalance and sort; ORDER_STATUS_FILTERS, ORDER_SORTS, ORDER_DATE_RANGES; resolveOrderDateRange(dates, from, to, today)"
  - "useBusinessToday(enabled?) and useBusinessTodayState(enabled?): the server's business today from any cached order answer, else one GET /orders?page=1&pageSize=1"
  - "OrdersToolbar: Search, Status, Order date (with a custom From/To row), Product type, Only orders with a balance, Sort by"
  - "orderDateRangeSchema and orderRangeErrors in ordersSchemas.ts"
  - "OrdersPage: result bar with chips (Search, Status, Dates, Product, Has a balance), No matches with Clear Filters, a list request that waits for the business today when a preset is chosen"
  - "AdminFrame onSearch: Enter in the topbar search opens /admin/orders?q={text} (D-53)"
  - "FilterChip with no value and a clearName; useListQuery enabled option; a default /product-types handler in useOrderHandlers"
  - "web/e2e/orders-filters.spec.ts (@orders-filters)"
affects: [08-10, 08-11, 08-24, order-page, order-form, deleted-orders]

actuals:
  tokens: 26500
  tasks: 3
  commits: 7
plan_head_before: 6b8cc4a0832a638ddb35f6ca99f6a688b3c0af1e
plan_head_after: 703b8501f280fcdf08b4ef093af2e35a199b888a

tech-stack:
  added: []
  patterns:
    - "A wrapper hook around the shared list-state hook drops a broken or stray date range with one replace and shows it as Any date until the replace lands"
    - "A date preset is stored by name (30d, 90d, month) and worked out from the server's business today on every visit; the list query is held back (enabled false) until that date is known"
    - "A React store over the TanStack query cache defers its announcements with notifyManager.batchCalls, because the cache announces new queries during render"
    - "A custom range is typed in local state and written to the URL only when the zod schema passes"

key-files:
  created:
    - web/src/modules/admin/hooks/useBusinessToday.ts
    - web/src/modules/admin/hooks/useBusinessToday.test.tsx
    - web/src/modules/admin/ordersSchemas.ts
    - web/src/modules/admin/ordersSchemas.test.ts
    - web/src/modules/admin/components/OrdersToolbar.tsx
    - web/src/modules/admin/components/OrdersToolbar.test.tsx
    - web/e2e/orders-filters.spec.ts
  modified:
    - web/src/modules/admin/hooks/useOrdersListParams.ts
    - web/src/modules/admin/hooks/useOrdersListParams.test.tsx
    - web/src/modules/admin/hooks/useOrdersQuery.ts
    - web/src/modules/admin/pages/OrdersPage.tsx
    - web/src/modules/admin/pages/OrdersPage.test.tsx
    - web/src/modules/admin/ordersCopy.ts
    - web/src/modules/admin/components/orders.recipe.ts
    - web/src/layouts/AdminLayout.tsx
    - web/src/layouts/AdminLayout.test.tsx
    - web/src/components/lists/FilterBar.tsx
    - web/src/components/lists/FilterBar.test.tsx
    - web/src/lib/query/useListQuery.ts
    - web/src/lib/query/useListQuery.test.tsx
    - web/src/test/orderFixtures.ts

key-decisions:
  - "status and sort are always sent to the API, even at their defaults, so each request names what it asks for and does not lean on server defaults"
  - "A from or to beside no range, or beside a preset, is dropped with one replace; only a custom range owns them"
  - "The reversed-range message (The end date can't be before the start date.) sits under To, because it is about the end date"
  - "Choosing Custom range... is local state; the URL gets dates=custom only with a valid pair, so the list keeps the last applied range meanwhile"
  - "Last 90 days counts 89 days back from today (today included), the same rule as the shared Last 30 days preset"
  - "FilterChip gets an optional value and clearName so Has a balance reads as a flag and clears as Clear balance filter"
  - "useListQuery gets an enabled option so the Orders list can wait for the business today"
  - "useOrderHandlers answers /product-types by default, because the Orders page now reads the list"

patterns-established:
  - "Page-level No matches: EmptyState with the search icon and the shared list copy, a secondary Clear Filters that clears q and every filter in one tick and keeps sort, size and view"
  - "Toolbar controls take values and setters as props from the list hook, so the page and the query see one source"

requirements-completed: [ORD-02]

coverage:
  - id: D1
    description: "Staff search orders by number, customer, team or phone; q is trimmed, cut to 100, written to the URL after 300 ms with one replace, sent to the API unchanged (Pena with a tilde round-trips), and shown as a Search chip with Clear search filter"
    requirement: ORD-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#search (ORD-02, D-55, WEB-10)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrdersListParams.test.tsx#useOrdersListParams reading"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-filters.spec.ts#@orders-filters search by team, narrow by status, balance, sort and dates, Back restores the view, Clear Filters resets it"
        status: pass
    human_judgment: false
  - id: D2
    description: "Enter in the topbar search opens /admin/orders?q={text} with every other filter at its default; an empty or blank search does nothing (D-53)"
    requirement: ORD-02
    verification:
      - kind: unit
        ref: "web/src/layouts/AdminLayout.test.tsx#AdminLayout topbar search (ORD-02, D-53)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Status (default Active + recent), balance box, product type and the four sorts live in the URL, reset the page with one replace, reach the API and show a chip when not at their default; an unknown product id falls back with one replace"
    requirement: ORD-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrdersToolbar.test.tsx#a filter change replaces the entry and resets the page (ORD-02, EDGE adjacency)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#status, sort and balance reach the API (ORD-02, D-43)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#product type (ORD-02, T-08-16)"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-filters.spec.ts#@orders-filters search by team, narrow by status, balance, sort and dates, Back restores the view, Clear Filters resets it"
        status: pass
    human_judgment: false
  - id: D4
    description: "Last 30 days, Last 90 days and This month are worked out from the server's business today (never the device clock), the same at 23:30 and 00:30 Manila time, and the list waits for that date before it asks for rows"
    requirement: ORD-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#order date presets use the server business today (D-59, ORD-02)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useBusinessToday.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrdersListParams.test.tsx#resolveOrderDateRange (D-59, ORD-02)"
        status: pass
    human_judgment: false
  - id: D5
    description: "A custom range applies only when both dates are real and From is not after To (From equal To is one day); inline errors show and the last applied range stays; a broken pair in the URL is dropped with one replace"
    requirement: ORD-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/ordersSchemas.test.ts"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrdersToolbar.test.tsx#the custom range (ORD-02, UIC-45, OR-3)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#a custom order date range (ORD-02, UIC-45)"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-filters.spec.ts#@orders-filters search by team, narrow by status, balance, sort and dates, Back restores the view, Clear Filters resets it"
        status: pass
    human_judgment: false
  - id: D6
    description: "A filtered search with no rows shows No matches with the search and filter words and Clear Filters, which clears q and every filter in one replace and keeps sort, size and view; the default view with nothing in it keeps the first-use message; a filter change keeps the rows and dims them after 200 ms"
    requirement: ORD-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#no matches and Clear Filters (UIC-2, ORD-02)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#a filter change keeps the rows and goes back to page 1 (ORD-02, UIC-13, EDGE adjacency)"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-filters.spec.ts#@orders-filters search by team, narrow by status, balance, sort and dates, Back restores the view, Clear Filters resets it"
        status: pass
    human_judgment: false
  - id: D7
    description: "No URL key can hold a customer name, phone, email or address other than the free-text q"
    requirement: ORD-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrdersListParams.test.tsx#holds no key that could carry a customer name, phone, email or address (T-08-17)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The toolbar reads well at 390, 820 and 1440 px in Blush and Espresso (the custom range row, the balance box and its 44px tap area, the chips wrapping)"
    verification:
      - kind: e2e
        ref: "web/e2e/orders-filters.spec.ts#@orders-filters (axe on the toolbar with chips, custom range and No matches)"
        status: pass
    human_judgment: true
    rationale: "Axe and the behaviour are proved in all five browser projects; how the toolbar looks at the three widths and in both themes is the owner's screenshot review (UI-SPEC Visual Review)"

duration: 47min
completed: 2026-10-29
status: complete
---

# Phase 08 Plan 09: Search, filter and sort orders Summary

**Staff can find an order: search by number, customer, team or phone (page and topbar), filter by status, order date (presets from the server's business today, or a checked custom range), product type and balance, sort four ways, see a chip for each non-default filter, and get No matches with Clear Filters, all kept in the URL.**

## Performance

- **Duration:** 47 min
- **Started:** 2026-10-29T22:08:33-05:00
- **Completed:** 2026-10-29T22:55:00-05:00
- **Tasks:** 3
- **Files modified:** 21 (7 created, 14 changed)

## Accomplishments

- Tracer: typing in Search writes `?q=` after 300 ms with one replace, the API receives the same text, a Search chip appears with "Clear search filter", and Enter in the topbar search opens `/admin/orders?q=` with the other filters at their defaults. The tracer's `<verify>` is automated only, so it was re-run and passed before the filters were built (`Tracer verified end-to-end, expanding`).
- `useOrdersListParams` now holds `q`, `status` (default Active + recent), `dates` (no default, so Any date), `from`, `to`, `productType`, `hasBalance` and `sort` (default due). Bad values fall back with one replace. A broken custom pair (a missing, invalid or reversed date) drops `dates`, `from` and `to` in one replace and counts as Any date at once.
- Last 30 days, Last 90 days and This month come from `useBusinessToday` (a cached order answer, else one small list call), never the device clock. The Orders list request waits for that date. At 23:30 and 00:30 Manila time the same range is sent.
- `OrdersToolbar` in the UI-SPEC order: Search, Status, Order date (with a From/To row for Custom range), Product type (`ListEntrySelect` filter mode), Only orders with a balance, Sort by. The custom range is checked by `orderDateRangeSchema` and written to the URL only when valid.
- Result bar "Showing n orders, sorted by ..." with chips for Search, Status, Dates, Product and Has a balance, each with its "Clear ... filter" button.
- No matches with Clear Filters (search icon, the search and filter words); the default view with nothing in it keeps "No active orders".
- `@orders-filters` e2e in all five projects: 12 seeded orders for one team; search, Next page and Back, Status, balance, Newest first, Last 30 days, open an order and Back, a custom range, No matches and Clear Filters.

## Task Commits

1. **Task 1: Search finds an order from the page and from the topbar (tracer)** - RED `6335c685` (test), GREEN `1f131330` (feat)
2. **Task 2: Status, order date, product type, balance and sort filters** - RED `749d8918` (test), GREEN `73da15e3` (feat)
3. **Task 3: No matches, Clear Filters, and the find journey** - RED `ecc8cfcb` (test), GREEN `ef2ef94f` (feat), e2e `703b8501` (test)

**Plan metadata:** the docs commits that hold this file and the state updates.

## TDD Gate Compliance

Each task has a `test(08-09)` commit before its `feat(08-09)` commit. Evidence came from the Vitest output; `gsd_run check tdd-red-evidence` was not run because this plan is `type: execute` and Vitest's report here is not in a format that classifier reads (the same as plans 08-04 and 08-06).

- **RED 1** (26 failed, 98 passed over 4 files): `searchbox "Search"` not found in the toolbar and the page (the toolbar skeleton rendered nothing), `expected { page: 1, size: 20 } to deeply equal { ..., q: null }` for the hook, `expected '/admin' to be '/admin/orders'` for the topbar. Semantic assessment: valid RED, each failure is the planned behaviour missing; the axe test failed on `axe needs rendered content` because the skeleton was empty.
- **RED 2** (115 failed, 79 passed over 7 files): missing Status, Order date, Sort by, Product type and balance controls, `expected null to deeply equal { from, to }` for `resolveOrderDateRange`, `expected null to be '2026-10-29'` for `useBusinessToday`, no `Has a balance` chip, requests without `status` and `sort`. Valid RED: stubs returned nothing and nothing was a setup or import fault.
- **RED 3** (5 failed, 64 passed): `Unable to find role="heading" and name "No matches"` for the four No matches tests and the axe test. Valid RED.
- **GREEN** commits `1f131330`, `73da15e3` and `ef2ef94f` each turned their RED tests green. Test edits after RED were test-only corrections (see Deviations: the sort cycle test, a lint rule on a helper name, a pagination control that is hidden with one page).
- No REFACTOR commit.

## Files Created/Modified

- `web/src/modules/admin/hooks/useOrdersListParams.ts` - the URL keys, the allow lists, the broken-range guard, `resolveOrderDateRange`.
- `web/src/modules/admin/hooks/useBusinessToday.ts` - the business today from the cache, else one call.
- `web/src/modules/admin/components/OrdersToolbar.tsx` - the controls and the custom range row.
- `web/src/modules/admin/ordersSchemas.ts` - the custom range zod schema and `orderRangeErrors`.
- `web/src/modules/admin/pages/OrdersPage.tsx` - toolbar, result bar and chips, No matches, the wait for today.
- `web/src/modules/admin/hooks/useOrdersQuery.ts`, `web/src/lib/query/useListQuery.ts` - an `enabled` option.
- `web/src/modules/admin/ordersCopy.ts`, `web/src/modules/admin/components/orders.recipe.ts` - words and two class strings.
- `web/src/layouts/AdminLayout.tsx` - `onSearch` on `AdminFrame`, wired to Topbar and the router.
- `web/src/components/lists/FilterBar.tsx` - `FilterChip` takes no value and a `clearName`.
- `web/src/test/orderFixtures.ts` - a default `/product-types` answer in `useOrderHandlers`.
- `web/e2e/orders-filters.spec.ts` - `@orders-filters`.
- Tests: `useOrdersListParams.test.tsx`, `useBusinessToday.test.tsx`, `OrdersToolbar.test.tsx`, `ordersSchemas.test.ts`, `OrdersPage.test.tsx`, `AdminLayout.test.tsx`, `FilterBar.test.tsx`, `useListQuery.test.tsx`.

## Decisions Made

- `status` and `sort` are always sent, even at their defaults, so a request does not rely on server defaults (the plan truth "each sort option sends its API key (due, ...)"). Five existing request expectations in `OrdersPage.test.tsx` were updated to include them.
- A `from` or `to` beside a preset or no range is dropped with one replace, since only a custom range owns them.
- The reversed-range message sits under To (the Phase 6 range puts its message under From), because the sentence is about the end date.
- Last 90 days is 89 days back with today included, the same rule as the shared Last 30 days.
- The Product chip reads "Loading..." until the types arrive, and is left out when the id is unknown (the fallback replace removes it).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `useListQuery` needed an `enabled` option**
- **Found during:** Task 2
- **Issue:** The plan says the list query waits until `useBusinessToday` has a value when a preset is set, but the shared `useListQuery` had no way to hold a request back.
- **Fix:** An optional `enabled` (default true), with a test, passed through `useOrdersQuery(params, { enabled })`.
- **Files modified:** `web/src/lib/query/useListQuery.ts`, `useListQuery.test.tsx`, `web/src/modules/admin/hooks/useOrdersQuery.ts`
- **Committed in:** `749d8918` (test), `73da15e3` (code)

**2. [Rule 3 - Blocking] `FilterChip` could not show "Has a balance" or clear as "balance"**
- **Found during:** Task 2
- **Issue:** The UI-SPEC chip reads "Has a balance" and its button is "Clear balance filter"; the shared chip always printed "{label}: {value}" and named the button after the label.
- **Fix:** `value` and `clearName` are optional; a chip with no value shows only its label. Existing chips are unchanged. A test was added in `FilterBar.test.tsx`.
- **Files modified:** `web/src/components/lists/FilterBar.tsx`, `FilterBar.test.tsx`
- **Committed in:** `749d8918`, `73da15e3`

**3. [Rule 1 - Bug] `useBusinessToday` set React state during another component's render**
- **Found during:** Task 2 (the first page test failed with "Cannot update a component while rendering a different component")
- **Issue:** The TanStack query cache announces a new query synchronously while React renders, and a `useSyncExternalStore` over the cache re-rendered from inside that announcement.
- **Fix:** The subscription goes through `notifyManager.batchCalls`, as TanStack's own hooks do. The hook test waits for the later update.
- **Files modified:** `web/src/modules/admin/hooks/useBusinessToday.ts`, `useBusinessToday.test.tsx`
- **Committed in:** `73da15e3`

**4. [Rule 3 - Blocking] The Orders page now reads `/product-types`**
- **Found during:** Task 2 (six `routes.test.tsx` cases failed on an unhandled request)
- **Issue:** The toolbar's Product type filter calls the list, so every test that renders the real Orders page needed a handler.
- **Fix:** `useOrderHandlers` answers `/product-types` by default (the shared product type fixture); a later `server.use` still overrides it.
- **Files modified:** `web/src/test/orderFixtures.ts`
- **Committed in:** `73da15e3`

**5. [Rule 1 - Bug] Test corrections after a wrong expectation**
- **Found during:** Tasks 2 and 3
- **Issue:** (a) Choosing "Due date (soonest)" again shows the first answer from the cache, so no new request is sent; the test had expected one. (b) A helper named `use...` was compiled as a hook by the React Compiler in tests ("Invalid hook call"). (c) Rows per page is not shown with one page. (d) A text match on "Sort" also matched the Sort by label.
- **Fix:** The sort test checks the three non-default sorts, then the default through the URL and the select. The helper became a plain resolver function. The rows-per-page check was dropped (the URL and request already prove size 50). The chip match is "Sort:".
- **Files modified:** `web/src/modules/admin/pages/OrdersPage.test.tsx`
- **Committed in:** `73da15e3`, `ef2ef94f`

**6. [Rule 1 - Bug] The new e2e read the URL before the iphone project had written it**
- **Found during:** Task 3 (first e2e run: iphone failed once, four others passed)
- **Issue:** The URL is written a moment after the screen changes on that project.
- **Fix:** Three URL reads right after a screen change poll instead of reading once.
- **Files modified:** `web/e2e/orders-filters.spec.ts`
- **Committed in:** `703b8501`

---

**Total deviations:** 6 auto-fixed (3 blocking, 3 bug)
**Impact on plan:** All needed to make the plan's behaviour work or keep the existing suites green. The two shared-component changes are small, optional props with tests. No scope creep.

## Issues Encountered

- The No matches message uses the shared curly quotes around the search ("zzz"); the plan prose showed straight quotes. Logged for the owner in `deferred-items.md`, with the other new wording.
- One heredoc with an unbalanced apostrophe made the shell tool fail; the long test blocks were written through the file tool instead. One Python edit script wrote CRLF line endings on Windows and was converted back to LF before the first commit.

## Verification

- `npm --prefix web run test -- --run src/modules/admin/hooks/useOrdersListParams.test.tsx src/modules/admin/components/OrdersToolbar.test.tsx src/modules/admin/pages/OrdersPage.test.tsx src/layouts/AdminLayout.test.tsx` (the Task 1 verify): all passed in the Task 1 GREEN run (124 tests).
- Full web suite at the end: `Test Files 218 passed (218)`, `Tests 6511 passed (6511)`.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output. `npm --prefix web run typecheck`: exit 0. `npm --prefix web run format:check`: all files use Prettier style.
- `npm --prefix web run e2e -- --grep @orders-filters`: 5 passed (chromium, firefox, webkit, pixel, iphone); with `@orders-list` together: 15 passed.
- Acceptance greps: `onSearch` in `AdminLayout.tsx` count 4; the D-55 placeholder is on one line of `ordersCopy.ts`; `new Date()` absent from `useBusinessToday.ts` and `useOrdersListParams.ts`; the nine-status list appears once on one line of `useOrdersListParams.ts` (a `prettier-ignore` keeps it on one line); `OrdersPage.test.tsx` has tests named "No matches" and "Clear Filters".
- gitleaks on every staged change: no leaks found. Fixture names are made up; the e2e uses the fixed seed ids already in the repo; no emails, local paths or real data.
- Preflight run before the full test run and before the e2e: all four ports free, no other project's processes.

## Known Stubs

None. The red-step skeletons (`OrdersToolbar`, `ordersSchemas`, `useBusinessToday`, the exports in `useOrdersListParams`) were replaced in their GREEN commits.

## Threat Flags

None. T-08-16 (crafted URL values) is mitigated by the allow-list parsers, the GUID shape for `productType`, the 100-character cap on `q` and one-replace fallbacks, proved in `useOrdersListParams.test.tsx` and the page tests. T-08-17 (personal data in URL keys) by the key list test and `createListParams` refusing such names at definition time; only `q` can hold a name or phone, and nothing is written to localStorage. T-08-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 08-11 adds `view` and the table to `useOrdersListParams` and `OrdersPage`; the toolbar has no view switch yet.
- Plan 08-10 should key the order page query as `['order', id]` so `useBusinessToday` can read its `today` without a request (see `deferred-items.md`).
- Plan 08-24 owns the sweeps and the owner review list; the toolbar look at 390, 820 and 1440 px in both themes is for the owner's screenshot review.
- The new wording (No matches line, Product chip loading word) is listed in `deferred-items.md` for the owner.

---
*Phase: 08-order-screens*
*Completed: 2026-10-29*

## Self-Check: PASSED

- FOUND: web/src/modules/admin/hooks/useBusinessToday.ts, web/src/modules/admin/hooks/useBusinessToday.test.tsx, web/src/modules/admin/ordersSchemas.ts, web/src/modules/admin/ordersSchemas.test.ts, web/src/modules/admin/components/OrdersToolbar.tsx, web/src/modules/admin/components/OrdersToolbar.test.tsx, web/e2e/orders-filters.spec.ts
- FOUND commits: 6335c685, 1f131330, 749d8918, 73da15e3, ecc8cfcb, ef2ef94f, 703b8501
