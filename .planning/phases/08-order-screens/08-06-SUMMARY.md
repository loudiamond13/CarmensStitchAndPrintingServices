---
phase: 08-order-screens
plan: 06
subsystem: ui
tags: [react, tanstack-query, nuqs, msw, vitest, playwright, orders, order-list, due-flag, tdd, a11y]
created: "2026-10-29T19:22:00-05:00"
updated: "2026-10-29T19:22:00-05:00"

requires:
  - phase: 08-order-screens
    provides: "08-01 list rows with pieces, allOrders, activeOrders and today; 08-02 OrderCard and OrderTotals; 08-05 DueFlag, ordersCopy.ts and orders.recipe.ts"
provides:
  - "/admin/orders is the real Orders page (grid of OrderCards from GET /api/v1/orders); /admin redirects to it (D-61)"
  - "ordersService: list, get, create (Idempotency-Key), updateDetails (version), changeStatus (key, no version), remove (neither)"
  - "ordersKey, useOrdersQuery(params), useOrdersListParams() with page and size"
  - "OrdersPage (L1) default export, ORDERS_COPY.list, ordersGridClasses"
  - "web/src/test/orderFixtures.ts: typed order fixtures and useOrderHandlers (recording MSW handlers for every order route)"
  - "createOrder and OrderSeedInput in web/e2e/testing-api.ts, and the @orders-list e2e"
affects: [08-07, 08-09, 08-10, 08-11, 08-13, 08-14, 08-24, order-page, order-form, deleted-orders]

actuals:
  tokens: 26000
  tasks: 3
  commits: 6
plan_head_before: 4673b8100366252d8b2e07ad84ea3474749f637f
plan_head_after: 72adf525ade5addd1c295e088f6203677ca2f447

tech-stack:
  added: []
  patterns:
    - "Fixtures are full API answers (detail) with a listEntryOf() that derives the list row, so list and detail never disagree"
    - "useOrderHandlers answers and records every order route; a test passes only the answer it cares about"
    - "A responsive grid built from pg-* variants uses important modifiers on the narrower rules, because Tailwind emits the wider lt-xl rule last; a node test reads the generated CSS"
    - "A page-level refetch dim is a data attribute on the grid plus a descendant rule, colour only"

key-files:
  created:
    - web/src/modules/admin/services/ordersService.ts
    - web/src/modules/admin/services/ordersService.test.ts
    - web/src/modules/admin/hooks/useOrdersQuery.ts
    - web/src/modules/admin/hooks/useOrdersListParams.ts
    - web/src/modules/admin/hooks/useOrdersListParams.test.tsx
    - web/src/modules/admin/pages/OrdersPage.tsx
    - web/src/modules/admin/pages/OrdersPage.test.tsx
    - web/src/modules/admin/components/orders.recipe.node.test.ts
    - web/src/test/orderFixtures.ts
    - web/e2e/orders-list.spec.ts
  modified:
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/modules/admin/ordersCopy.ts
    - web/src/modules/admin/components/orders.recipe.ts
    - web/src/components/states/Skeletons.tsx
    - web/src/components/states/index.ts
    - web/src/components/states/loading.test.tsx
    - web/src/layouts/AdminLayout.test.tsx
    - web/e2e/testing-api.ts
    - web/e2e/admin.spec.ts
    - web/e2e/admin-keyboard.spec.ts
    - web/e2e/shell.spec.ts
    - web/e2e/sweep.ts

key-decisions:
  - "Fixtures are OrderDetailResponse answers; the list row is derived with listEntryOf(), pieces being the sum of item quantities"
  - "The grid's 3 columns use pg-lt-xl and the 2 and 1 column rules are important (pg-tablet, pg-phone), because the wider rule is emitted last and would win on a phone"
  - "SkeletonText takes lines (1 to 3, default 3) so the subline can wait as one line without a new component"
  - "The e2e opens /admin/orders directly: the e2e bundle keeps /admin as the Dashboard dev preview, so the D-61 redirect is proved in routes.test.tsx"
  - "/admin/orders leaves ADMIN_PAGES in sweep.ts: the sweeps open pages unsigned, and plan 08-24 adds the order pages with a sign-in step"

patterns-established:
  - "OrdersPage composes useOrdersListParams, useSettledListParams, useOrdersQuery, clampPage, LoadingRegion, ErrorState, EmptyState and Pagination, as ExpensesPage does"
  - "Card navigation sends { state: { from: pathname + search } } for the order page back link (D-51)"

requirements-completed: [ORD-01, ORD-11, ORD-12, ORD-19]

coverage:
  - id: D1
    description: "/admin redirects to /admin/orders (D-61) and /admin/orders is the guarded real page in the production and dev trees; the dev preview no longer shadows it"
    requirement: ORD-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/routes.test.tsx#opening /admin with a session goes to Orders (D-61) until the dashboard exists"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/routes.test.tsx#with the dev routes added, /admin/orders is still the guarded real page: no preview shadows it (Pitfall 1)"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-list.spec.ts#@orders-list a Manager opens Orders and sees a seeded order as a card with its number, pieces and Total"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each card shows the server's Total, balance state (Balance due, Fully Paid, Credit), pieces and a due flag counted from the response's today; the subline reads the list-wide counts"
    requirement: ORD-12
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#the cards (ORD-01, ORD-12, D-04, D-40)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#shows the Orders heading, the title and the subline from the list-wide counts"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-list.spec.ts#@orders-list a Manager opens Orders and sees a seeded order as a card with its number, pieces and Total"
        status: pass
    human_judgment: false
  - id: D3
    description: "Nothing on the list shows Order Expenses, Estimated Profit, a status change or a Delete (ORD-19, D-06, D-20, D-22)"
    requirement: ORD-19
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#what the list never shows (ORD-19, D-06, D-20, D-22)"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-list.spec.ts#@orders-list a Manager opens Orders and sees a seeded order as a card with its number, pieces and Total"
        status: pass
    human_judgment: false
  - id: D4
    description: "ordersService has one tested call for list, get, create, edit details, status and delete, with the key and version rules of the API"
    requirement: ORD-11
    verification:
      - kind: unit
        ref: "web/src/modules/admin/services/ordersService.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Paging, rows per page (10, 20, 50, 100), URL fall-back for a bad size or page, a page past the last becoming the last, first-load skeletons, load error with Try Again, No active orders, refetch dim"
    requirement: ORD-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrdersListParams.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#paging and rows per page (ORD-01, EDGE ORD-01 boundary)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#the list states (UIC-1, UIC-12, UIC-18)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Card links carry the current list search in navigation state for the order page back link (D-51)"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#New Order and the card links (D-51)"
        status: pass
    human_judgment: false
  - id: D7
    description: "The grid reads well at 390, 820 and 1440 px in Blush and Espresso (4, 3, 2 and 1 columns, the dim while a page loads, the empty and error states)"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/orders.recipe.node.test.ts"
        status: pass
    human_judgment: true
    rationale: "The CSS cascade and the data attributes are proved; how the cards look at the three widths and in both themes is the owner's screenshot review (UI-SPEC Visual Review)"

duration: 76min
completed: 2026-10-29
status: complete
---

# Phase 08 Plan 06: The Orders list shows real orders Summary

**`/admin/orders` is now a real page: a paged grid of order cards from `GET /api/v1/orders` with server-only figures, the list-wide counts in the subline, due flags counted from the response's own business date, and every list state; `/admin` lands on it, and the order fixtures, `ordersService` and the e2e seed helper are in place for the rest of the phase.**

## Performance

- **Duration:** 76 min
- **Started:** 2026-10-29T18:04:00-05:00
- **Completed:** 2026-10-29T19:20:00-05:00
- **Tasks:** 3
- **Files modified:** 23 (10 created, 13 changed)

## Accomplishments

- Tracer: a signed-in Manager opens `/admin/orders` and sees a seeded order as a card with its number, pieces and Total. The `@orders-list` e2e proves it in all five browser projects. Tracer feedback gate: the `<verify>` is automated only, so it was re-run and passed (`⚡ Tracer verified end-to-end — expanding`).
- `/admin` redirects to `/admin/orders` (D-61); the dev preview of `/admin/orders` is gone, so it no longer shadows the real route in dev and e2e builds.
- `OrdersPage`: header with the "{n} orders · {active} active" subline (a one-line skeleton while it loads), a primary New Order link, a hidden "Results" heading, the card grid, and Pagination with Rows per page 10, 20, 50, 100. Card View and Edit Details navigate with `state.from` set to the current list URL (D-51).
- States: 4 skeleton cards in a "Loading orders…" region, "Couldn't load orders." with Try Again, "No active orders" with the D-55 words and New Order, and a refetch that keeps the cards and dims them by colour after 200 ms.
- `ordersService`: list, get, create, updateDetails, changeStatus, remove, each with a doc line naming the key or version rule and the failure codes.
- `orderFixtures.ts` and `createOrder` for every later order plan.

## Task Commits

1. **Task 1: /admin lands on Orders and shows seeded orders as cards (tracer)** - RED `6e34bf08` (test), GREEN `202e74e8` (feat)
2. **Task 2: The order-level calls** - RED `246791c1` (test), GREEN `f44a0d1d` (feat)
3. **Task 3: Paging, rows per page and every list state** - RED `fb678076` (test), GREEN `72adf525` (feat)

**Plan metadata:** the docs commit that holds this file.

## TDD Gate Compliance

Each task has a `test(08-06)` commit before its `feat(08-06)` commit. Evidence came from the Vitest output; `gsd_run check tdd-red-evidence` was not run because this plan is `type: execute` and Vitest here does not write the TAP report that classifier reads.

- **RED 1** (25 failed, 28 passed over 3 files): `OrdersPage.test.tsx` 15 of 16 failed on "Unable to find an element with the text: 148 orders · 37 active" (the stub rendered nothing; the 16th is a fixtures self-check). `routes.test.tsx` 7 failed on `expected '/admin/sessions' to be '/admin/orders'` and a missing `Orders` heading. `ordersService.test.ts` 3 failed because the stub sent no filters (`expected { page: '2' } to deeply equal { q: 'ballers', …(8) }`). Semantic assessment: valid RED, each failure is the planned behaviour missing, not an import or setup fault.
- **RED 2** (7 failed): `promise rejected "Error: not implemented" instead of resolving` for get, create, updateDetails, changeStatus and remove, and the two abort cases. Valid RED over stub methods.
- **RED 3** (11 failed in `OrdersPage.test.tsx`, 11 in the hook test, 1 in `loading.test.tsx`): no "Loading orders…", no "Couldn't load orders.", no "No active orders", no "Next page" button, no "Rows per page" select, `expected { page: '1', pageSize: '20' } to deeply equal { page: '1', pageSize: '50' }`, `expected [] to include 'replace:?page=3'`, and the hook stub (page only) gave `size` undefined. `reads 1 order · 1 active` already passed because the subline words were written in Task 1; it pins that rule. Valid RED.
- **GREEN** commits `202e74e8`, `f44a0d1d`, `72adf525` each turned their RED tests green with no test edits.
- No REFACTOR commit.

## Files Created/Modified

- `web/src/modules/admin/pages/OrdersPage.tsx` - L1 page, default export.
- `web/src/modules/admin/services/ordersService.ts` - the six order-level calls and their types.
- `web/src/modules/admin/hooks/useOrdersQuery.ts`, `useOrdersListParams.ts` - the list query and the page and size URL state.
- `web/src/modules/admin/routes.tsx` - lazy `orders` route, `/admin` redirect, dev preview removed, unused not-found loader removed.
- `web/src/modules/admin/ordersCopy.ts`, `components/orders.recipe.ts` - list words, grid and subline-skeleton classes.
- `web/src/components/states/Skeletons.tsx` - `SkeletonText` takes `lines`.
- `web/src/test/orderFixtures.ts` - ORD-2026-0148, 0151, 0153, a credit order, a cancelled order with refunds, a no-due-date order, completed and delivered orders; `buildOrderDetail`, `buildOrderListEntry`, `buildOrderList`, `listEntryOf`, `standardOrderList`, `orderProblem`, `useOrderHandlers`.
- `web/e2e/testing-api.ts`, `orders-list.spec.ts` - `createOrder`, `OrderSeedInput`, `BASKETBALL_JERSEY_ID` and the `@orders-list` journey.
- Tests: `OrdersPage.test.tsx`, `ordersService.test.ts`, `useOrdersListParams.test.tsx`, `orders.recipe.node.test.ts`, `routes.test.tsx`, `loading.test.tsx`, `AdminLayout.test.tsx`.

## Decisions Made

- Fixtures are full order answers, with `listEntryOf()` deriving the list row, so the list and the detail cannot disagree on a figure.
- The grid's three-column rule uses `pg-lt-xl`, and the two- and one-column rules are `!important` on the non-overlapping `pg-tablet` and `pg-phone` variants. Tailwind emits the variants phone, tablet, up to 1023, up to 1279, so the widest rule would otherwise win on a phone. `orders.recipe.node.test.ts` reads the generated CSS to pin this.
- `SkeletonText` got a `lines` prop instead of a new component, so the subline waits as the UI-SPEC's one `SkeletonText` line.
- Unknown order status keys are passed to the card as plain text (the badge already handles it) rather than dropping the row.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `/admin/orders` stays out of `ADMIN_PAGES` in `sweep.ts`**
- **Found during:** Task 1
- **Issue:** The plan said to keep `/admin/orders` in `sweep.ts` with h1 "Orders". The shared sweeps (`@responsive`, `@a11y-rulings`, `@fonts`, `@keyboard`) open each page unsigned. With the dev preview gone, an unsigned visit lands on the sign-in screen, so every one of those cases would fail.
- **Fix:** Removed the entry and said why in the file comment, as for `/admin/expenses`. Plan 08-24 adds the order pages with a sign-in step.
- **Files modified:** `web/e2e/sweep.ts`
- **Committed in:** `6e34bf08`

**2. [Rule 1 - Bug] Other specs and tests used the removed `/admin/orders` preview**
- **Found during:** Tasks 1 and 3 (the full Vitest run and a read of the e2e files)
- **Issue:** `admin-keyboard.spec.ts` followed the drawer's Orders link from the unsigned Dashboard preview, which is now guarded; `AdminLayout.test.tsx` rendered `/admin/orders` as a short dev page in 25 tests (it failed in the full run).
- **Fix:** The keyboard spec signs in a Manager first, then opens the preview and follows the link. The layout test builds its own copy of the dev routes with an Orders preview. `admin.spec.ts` drops its Orders case and `shell.spec.ts` uses `/admin` as the short page.
- **Files modified:** `web/e2e/admin-keyboard.spec.ts`, `web/e2e/admin.spec.ts`, `web/e2e/shell.spec.ts`, `web/src/layouts/AdminLayout.test.tsx`
- **Verification:** `@admin|@shell` e2e 207 passed (3 flakes, see below); `AdminLayout.test.tsx` 61 passed.
- **Committed in:** `6e34bf08`, `72adf525`

**3. [Rule 3 - Blocking] Unused `notFoundPage` loader removed from `routes.tsx`**
- **Found during:** Task 1
- **Issue:** The `orders` placeholder was the only user of the in-shell not-found loader; leaving the constant fails lint (`no-unused-vars`). `AdminNotFoundPage.tsx` now has no route.
- **Fix:** Removed the constant. The page file stays. Logged in `deferred-items.md` for a decision.
- **Files modified:** `web/src/modules/admin/routes.tsx`
- **Committed in:** `202e74e8`

**4. [Rule 1 - Bug] The `@orders-list` e2e cannot test the D-61 redirect**
- **Found during:** Task 1 (first e2e run: 5 timeouts)
- **Issue:** The e2e bundle keeps the dev routes, so `/admin` is the Dashboard preview and never redirects.
- **Fix:** The e2e opens `/admin/orders` directly; the redirect is proved in `routes.test.tsx`.
- **Files modified:** `web/e2e/orders-list.spec.ts`
- **Committed in:** `202e74e8`

**5. [Rule 2 - Missing critical] CSS cascade test for the grid**
- **Found during:** Task 1
- **Issue:** With plain `pg-lt-xl`, `pg-lt-lg` and `pg-phone` classes the 3-column rule is emitted last and beats the narrower ones; jsdom evaluates no container query, so no component test could catch it.
- **Fix:** Important modifiers on the tablet and phone rules, plus `orders.recipe.node.test.ts` (4 tests) over the generated CSS, including the refetch dim.
- **Files modified:** `web/src/modules/admin/components/orders.recipe.ts`, `orders.recipe.node.test.ts`
- **Committed in:** `202e74e8`, `72adf525`

---

**Total deviations:** 5 auto-fixed (2 blocking, 2 bug, 1 missing critical)
**Impact on plan:** All needed to keep the existing e2e and unit suites green or to make the grid correct. No scope creep.

## Issues Encountered

- **Flake, passes alone:** in the `@admin|@shell` run, `@shell sidebar and top bar stay pinned` failed 3 times (webkit 1440x900 and 390x844, iphone 1024x768): the heavy `/dev/components` page showed no `h1` inside 5 s with 4 workers. Re-run alone, 15 of 15 passed. Recorded in `deferred-items.md`; the spec was not changed.
- Two heredoc-written files lost a doubled backslash on this Windows shell (`\\${char}` became `\${char}`); found when a node test could not find its own selector, fixed by editing through a script file.
- Owner review scripts (`owner-review.mjs`, `design-side-by-side.mjs`) still open `/admin/orders` unsigned; left for plan 08-24 (see `deferred-items.md`).

## Verification

- `npm --prefix web run test -- --run src/modules/admin/pages/OrdersPage.test.tsx src/modules/admin/routes.test.tsx src/modules/admin/services/ordersService.test.ts`: all passed (28 + 34 + 10 tests).
- Full web suite: 212 files, 6258 tests; the only failures were the 25 `AdminLayout.test.tsx` cases, fixed afterwards (61 passed).
- `npm --prefix web run typecheck`: exit 0. `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output. `npm --prefix web run format:check`: all files use Prettier style.
- `npm --prefix web run e2e -- --grep "@orders-list"`: 10 passed (5 projects x 2 tests), run twice (before and after Task 3).
- `npm --prefix web run e2e -- --grep "@admin|@shell"`: 207 passed, 3 failed; the 3 re-run alone: 15 passed.
- Acceptance greps: `redirect('/admin/orders')` found once, `redirect('/admin/sessions')` count 0, `path: 'orders', lazy: previewPage` absent, `Order Expenses|Estimated Profit` count 0 in `OrdersPage.tsx`, `export async function createOrder` found, `new Date()` absent from `OrdersPage.tsx`.
- gitleaks on each staged change: no leaks found. Fixture names are made up; no real emails, ids or local paths.

## Known Stubs

None. The RED stubs (`OrdersPage`, `ordersService`, `useOrdersListParams`) were replaced in their GREEN commits.

## Threat Flags

None. T-08-08 (crafted page and size) is mitigated by the allow-list parsers and proved in `useOrdersListParams.test.tsx` and the page tests; T-08-09 (internal figures) by the "never renders Order Expenses or Estimated Profit" tests and the e2e; T-08-10 (route access) by the route sitting under the session loader (`routes.test.tsx`: no session lands on sign-in with the return path). T-08-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 08-07 onward can import `orderFixtures.ts` (`useOrderHandlers`, `order0148`, `buildOrderDetail`) and `createOrder` from the e2e helpers, and the `OrdersService` for the order page and form.
- Plan 08-09 adds the filters to `useOrdersListParams` and `OrdersPage` (the list query already takes `q`, `status`, `from`, `to`, `productType`, `hasBalance` and `sort`); 08-11 adds `view` and the table.
- Plan 08-24 should add the order pages to the sweeps with a sign-in step and update the owner review scripts (see `deferred-items.md`).
- The grid look at 390, 820 and 1440 px in both themes is for the owner's screenshot review.

---
*Phase: 08-order-screens*
*Completed: 2026-10-29*

## Self-Check: PASSED

- FOUND: web/src/modules/admin/pages/OrdersPage.tsx, web/src/modules/admin/services/ordersService.ts, web/src/modules/admin/hooks/useOrdersQuery.ts, web/src/modules/admin/hooks/useOrdersListParams.ts, web/src/test/orderFixtures.ts, web/e2e/orders-list.spec.ts, web/e2e/testing-api.ts, web/src/modules/admin/components/orders.recipe.node.test.ts
- FOUND commits: 6e34bf08, 202e74e8, 246791c1, f44a0d1d, fb678076, 72adf525
