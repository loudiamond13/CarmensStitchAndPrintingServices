---
phase: 08-order-screens
plan: 11
subsystem: ui
tags: [react, nuqs, localstorage, tanstack-query, msw, vitest, playwright, orders, table, view-switch, tdd, a11y]
created: "2026-10-30T00:05:00-05:00"
updated: "2026-10-30T00:05:00-05:00"

requires:
  - phase: 08-order-screens
    provides: "08-06 OrdersPage, useOrdersListParams, useOrdersQuery, orderFixtures; 08-09 toolbar, filters, chips, No matches and Clear Filters; 08-05 DueFlag"
provides:
  - "useOrdersListParams key `view` (grid or table, no default) and `setView`, which writes the view with a replace and keeps the page"
  - "ORDERS_VIEW_KEY ('csps-orders-view'), resolveView(urlView, stored) and useOrdersView(values, set) returning { view, setView }"
  - "OrdersTable: the L1 table view on the shared ResponsiveTable, nine columns, four Balance states, View and Edit Details row actions"
  - "OrdersToolbar: the icon-only View switch (Grid view, Table view) pushed right"
  - "web/e2e/orders-view.spec.ts (@orders-view)"
affects: [08-12, 08-24, order-page, deleted-orders]

actuals:
  tokens: 15300
  tasks: 3
  commits: 5
plan_head_before: 8973ee6753a755ca54b570989a365a34307ae6b6
plan_head_after: 80dcdeb654bf58fcc24b025a305a16c80da5afed

tech-stack:
  added: []
  patterns:
    - "A view choice resolves in one pure function (URL, then stored, then grid); the stored text is only compared with the two views and never handed to the URL parser"
    - "The stored choice is read once when the page opens (a lazy state), so another tab's choice shows at the next visit only; every storage call is wrapped in try/catch"
    - "A single key written outside the shared list setters (useQueryState) when it must not reset the page"
    - "A table page passes its list states (skeleton, error, empty, No matches, refetch) to ResponsiveTable instead of drawing its own"

key-files:
  created:
    - web/src/modules/admin/hooks/useOrdersView.ts
    - web/src/modules/admin/hooks/useOrdersView.test.tsx
    - web/src/modules/admin/components/OrdersTable.tsx
    - web/src/modules/admin/components/OrdersTable.test.tsx
    - web/e2e/orders-view.spec.ts
  modified:
    - web/src/modules/admin/hooks/useOrdersListParams.ts
    - web/src/modules/admin/hooks/useOrdersListParams.test.tsx
    - web/src/modules/admin/components/OrdersToolbar.tsx
    - web/src/modules/admin/components/OrdersToolbar.test.tsx
    - web/src/modules/admin/components/orders.recipe.ts
    - web/src/modules/admin/pages/OrdersPage.tsx
    - web/src/modules/admin/pages/OrdersPage.test.tsx
    - web/src/modules/admin/ordersCopy.ts

key-decisions:
  - "The View switch keeps the current page (RESEARCH A4); a filter change still goes back to page 1. Logged for the owner in deferred-items.md"
  - "useOrdersView takes the list values and setters instead of no arguments, so the page runs useOrdersListParams (and its URL clean-up effects) once"
  - "setView does nothing when the view already shown is pressed (no URL write, no storage write)"
  - "After the toggle the in-memory stored choice follows it, so Back to a URL with no view shows the choice made in this tab; other tabs are read at the next mount only"
  - "The order number link is a UiLink whose plain click goes through onOpen, so the D-51 back state travels with it; modified clicks keep the link's own behaviour"
  - "The Balance rule (credit, Fully Paid, Not collected, else due) is repeated in OrdersTable from the card's OrderTotals, to avoid exporting a private function from the shared money component"

patterns-established:
  - "Table list pages feed ResponsiveTable the page's states: pending, refetching, failed, filtered, search, filterSummary and onClearFilters"
  - "Row actions named by their order with a matching title, as the card buttons are"

requirements-completed: [ORD-01, ORD-10, ORD-12]

coverage:
  - id: D1
    description: "Staff switch Orders between Grid and Table with an icon-only View switch named Grid view and Table view; the grid is shown by default"
    requirement: ORD-10
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrdersToolbar.test.tsx#the View switch (ORD-10, plan 08-11)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#the view switch (ORD-10, UIC-30; plan 08-11)"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-view.spec.ts#@orders-view the Table choice survives a reload, and a shared Grid link leaves the stored choice alone"
        status: pass
    human_judgment: false
  - id: D2
    description: "The view shown is the URL's when valid, else the stored choice when valid, else grid; the view parser has no default; a bad URL value is removed with one replace"
    requirement: ORD-10
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrdersView.test.tsx#resolveView (ORD-10)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrdersView.test.tsx#useOrdersView reading (ORD-10)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrdersListParams.test.tsx#the view key (ORD-10, plan 08-11)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Only the toggle writes the URL (replace, page kept) and localStorage; a ?view=table visit never writes the storage; pressing the view already shown writes nothing"
    requirement: ORD-10
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrdersView.test.tsx#useOrdersView writing (ORD-10, EDGE idempotency)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#Table view switches with one replace, keeps page 2 and remembers the choice"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-view.spec.ts#@orders-view the Table choice survives a reload, and a shared Grid link leaves the stored choice alone"
        status: pass
    human_judgment: false
  - id: D4
    description: "A storage read or write that throws (private mode) falls back to grid / keeps the URL switch with no console error; a choice stored in another tab is read at the next mount only"
    requirement: ORD-10
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrdersView.test.tsx#useOrdersView when the storage throws (private mode, EDGE concurrency)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useOrdersView.test.tsx#reads a choice stored by another tab at the next mount only"
        status: pass
    human_judgment: false
  - id: D5
    description: "The table shows Order (placeholder thumbnail and number link), Customer, Status, Ordered, Due (stacked flag), Total, Paid, Balance and row actions; no Discount column, no expenses or profit, no Delete"
    requirement: ORD-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrdersTable.test.tsx#the columns (UI-SPEC \"Table view\")"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrdersTable.test.tsx#what the table never shows (D-04, D-06, UIC-30)"
        status: pass
      - kind: e2e
        ref: "web/e2e/orders-view.spec.ts#@orders-view the Table choice survives a reload, and a shared Grid link leaves the stored choice alone"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Balance cell shows the due figure, Fully Paid with a check (ORD-2026-0151), a Credit badge, or Not collected under a muted figure on a Cancelled order; an unpaid order's Paid cell shows the empty value"
    requirement: ORD-12
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrdersTable.test.tsx#the Balance cell (ORD-12, D-04, D-45)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrdersTable.test.tsx#an unpaid order (UIC-7)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Row actions View and Edit Details are named by their order with matching titles; Edit is absent on Completed and Cancelled; a plain number click carries the list address in the back state"
    requirement: ORD-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/OrdersTable.test.tsx#the row actions (D-22, D-46, D-57)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#the table view states and links (ORD-01, D-51, UIC-1, UIC-2; plan 08-11)"
        status: pass
    human_judgment: false
  - id: D8
    description: "Table view list states: skeleton table of 4 rows under Loading orders, load error with Try Again, No active orders, No matches with Clear Filters keeping the view"
    requirement: ORD-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/OrdersPage.test.tsx#the table view states and links (ORD-01, D-51, UIC-1, UIC-2; plan 08-11)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/OrdersTable.test.tsx#the table states"
        status: pass
    human_judgment: false
  - id: D9
    description: "The table scrolls inside its frame at 820 px and becomes row cards at 390 px with no sideways page scroll and no axe violations, in five browser projects"
    requirement: ORD-01
    verification:
      - kind: e2e
        ref: "web/e2e/orders-view.spec.ts#@orders-view the table scrolls inside its frame on a tablet and becomes row cards on a phone"
        status: pass
    human_judgment: false
  - id: D10
    description: "How the table reads in Blush and Espresso at 390, 820 and 1440 px (the Order cell, the Balance states, the Due stack)"
    verification:
      - kind: e2e
        ref: "web/e2e/orders-view.spec.ts#@orders-view (axe including colour contrast, widths 820 and 390)"
        status: pass
    human_judgment: true
    rationale: "Axe and the layout rules are proved in all five browser projects; how the table looks in both themes is the owner's screenshot review (UI-SPEC Visual Review)"

duration: 38min
completed: 2026-10-30
status: complete
---

# Phase 08 Plan 11: Orders as a table, and the view choice that sticks Summary

**Staff switch Orders between Grid and Table with an icon-only switch; the choice follows ORD-10 exactly (URL, then localStorage, then grid, and only the toggle writes), and the table shows Total, Paid and Balance with Fully Paid, Credit and Not collected states.**

## Performance

- **Duration:** 38 min
- **Started:** 2026-10-29T23:24:00-05:00
- **Completed:** 2026-10-30T00:05:00-05:00
- **Tasks:** 3
- **Files modified:** 13 (5 created, 8 changed)

## Accomplishments

- Tracer: `view` joined the Orders URL with no default, so a missing view stays missing and the page can fall back to the stored choice. `useOrdersView` resolves URL, then storage, then grid with the pure `resolveView`. The toggle alone writes the URL (replace, page kept) and localStorage. The tracer's `<verify>` is automated only, so it was re-run after the commit and passed before the table was built (`Tracer verified end-to-end, expanding`).
- The View switch (`layout-grid` "Grid view", `list` "Table view", icon only, with `aria-label` and `title`) sits in the toolbar's end slot, which is pushed right on desktop and a full-width row on phones.
- `OrdersTable` on the shared `ResponsiveTable`: Order (44 px placeholder thumbnail and number link), Customer, Status, Ordered, Due (stacked `DueFlag`), Total, Paid, Balance and the hidden-header Actions column. Balance shows the due figure, "Fully Paid" with `circle-check`, a "Credit ₱1,000.00" info badge, or a muted figure over "Not collected" on a Cancelled order. An unpaid order's Paid cell shows `EmptyValue`.
- Row actions "View order {number}" and "Edit details of order {number}" with matching titles; Edit is hidden on Completed and Cancelled; no Delete, no Discount column, no expenses or profit.
- In table view the page hands its states to `ResponsiveTable`: the skeleton table of 4 rows under "Loading orders…", the load error with Try Again, "No active orders", and "No matches" with Clear Filters (which keeps the view).
- `@orders-view` e2e in all five projects: choose Table, reload, still Table; the plain address takes the stored choice; `?view=grid` shows the grid and leaves storage at `table`; the grid button writes `grid` once and pressing it again changes nothing; at 820 px the table (1041 px wide) scrolls inside its 698 px frame; at 390 px the header row goes and each order is a card.

## Task Commits

1. **Task 1: The view switch shows the table and remembers the choice (tracer)** - RED `e3830011` (test), GREEN `3e8ee6f7` (feat)
2. **Task 2: The table shows every column with the right balance states** - RED `81848f0e` (test), GREEN `112838d2` (feat)
3. **Task 3: The view choice survives reloads and shared links in a real browser** - `80dcdeb6` (test)

**Plan metadata:** the docs commits that hold this file and the state updates.

## TDD Gate Compliance

Each of tasks 1 and 2 has a `test(08-11)` commit before its `feat(08-11)` commit. Evidence came from the Vitest output; `gsd_run check tdd-red-evidence` was not run because this plan is `type: execute` and Vitest's report here is not in a format that classifier reads (the same as plans 08-04, 08-06 and 08-09).

- **RED 1** (37 failed, 134 passed over 3 files): `expected 'grid' to be 'table'` (the skeleton `useOrdersView` always said grid), `setView is not a function`, `Unable to find role="table" and name "Orders"`, `Unable to find ... radiogroup "View"`, `expected { ... } to deeply equal { ..., view: null }`. Valid RED: each failure is the planned behaviour missing.
- **RED 2** (16 failed, 93 passed over 2 files): the seven missing columns, the Balance states, the row actions and the back-link state were absent. A few tests of behaviour already built in Task 1 (the number link, the skeleton rows, no Delete, axe) passed at once, as they should.
- **GREEN** commits `3e8ee6f7` and `112838d2` turned their RED tests green. Edits to tests after RED were test-only corrections (see Deviations).
- Task 3 is an e2e spec written against the finished page (as the plan says); it failed first on its own measuring helper, not on the page, then passed.
- No REFACTOR commit.

## Files Created/Modified

- `web/src/modules/admin/hooks/useOrdersView.ts` - ORD-10: `ORDERS_VIEW_KEY`, `resolveView`, `useOrdersView`.
- `web/src/modules/admin/hooks/useOrdersListParams.ts` - the `view` key with no default and `setView`.
- `web/src/modules/admin/components/OrdersTable.tsx` - the columns, the Balance cell, the row actions.
- `web/src/modules/admin/components/OrdersToolbar.tsx` - the View switch in the toolbar's end slot.
- `web/src/modules/admin/pages/OrdersPage.tsx` - picks the grid or the table; the table gets the page's states.
- `web/src/modules/admin/components/orders.recipe.ts`, `web/src/modules/admin/ordersCopy.ts` - six class strings and the table words.
- `web/e2e/orders-view.spec.ts` - `@orders-view`.
- Tests: `useOrdersView.test.tsx`, `useOrdersListParams.test.tsx`, `OrdersTable.test.tsx`, `OrdersToolbar.test.tsx`, `OrdersPage.test.tsx`.

## Decisions Made

- The View switch keeps the current page (RESEARCH A4); a filter change still goes back to page 1.
- `useOrdersView(values, set)` takes the list values and setters, so `useOrdersListParams` and its URL clean-up effects run once per page.
- Pressing the view already shown writes nothing. After a toggle, the in-memory stored choice follows it, so a later URL with no view shows this tab's choice; other tabs are read at the next mount only.
- The order number link's plain click goes through `onOpen` so the D-51 back state travels with it; a modified click keeps the link's own behaviour.
- The Balance state rule is repeated in `OrdersTable` (four lines) rather than exported from the shared `OrderTotals`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The shared list setters reset the page, and the toggle must not**
- **Found during:** Task 1
- **Issue:** `createListParams`' `setFilter('view', ...)` replaces the entry and resets the page. The plan truth says the toggle keeps the current page (RESEARCH A4).
- **Fix:** `useOrdersListParams` writes `view` through its own `useQueryState('view', ...)` with a replace, and returns it as `setView` beside the shared setters. The shared `view` key in the list parsers still gives the read, the URL clean-up (a bad value is removed with one replace) and the key-name guard.
- **Files modified:** `web/src/modules/admin/hooks/useOrdersListParams.ts`
- **Committed in:** `3e8ee6f7`

**2. [Rule 1 - Bug] Test corrections after a wrong expectation**
- **Found during:** Tasks 1 and 2
- **Issue:** (a) A modified click was driven with `userEvent.keyboard('{Control>}')` then `userEvent.click`; the direct API gives each call its own keyboard state, so the Ctrl key was lost. (b) A back-link state expectation wrote the query as `?view=table&size=50`, but the page keeps the address as given. (c) One test clicked View then Edit in the same render, and the second click's `from` was the order address the first click had opened.
- **Fix:** `fireEvent.click` with `ctrlKey`, `metaKey`, `shiftKey` and `button: 1`; the input address was written as the URL carries it; the two clicks became two tests.
- **Files modified:** `OrdersTable.test.tsx`, `OrdersPage.test.tsx`
- **Committed in:** `112838d2`

**3. [Rule 1 - Bug] The e2e frame measurement returned nothing**
- **Found during:** Task 3 (all five projects)
- **Issue:** A string passed to `Locator.evaluate` was not called with the element, so the measurement was `undefined`.
- **Fix:** A typed function with a small local element type (the e2e code has no DOM types), the same style as `focus.ts`.
- **Files modified:** `web/e2e/orders-view.spec.ts`
- **Committed in:** `80dcdeb6`

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bug)
**Impact on plan:** No change to the behaviour the plan asks for. The one design difference from the plan text is that `useOrdersView` takes the list values and setters (logged in `deferred-items.md`).

## Issues Encountered

- A first call of the preflight script with a `\` path through bash lost its backslashes; the forward-slash path works.
- The plan's `ORDERS_VIEW_KEY` read happens in a lazy `useState`, which the React Compiler lint accepts.

## Verification

- `npm --prefix web run test -- --run src/modules/admin/hooks/useOrdersView.test.tsx src/modules/admin/hooks/useOrdersListParams.test.tsx` (Task 1 verify): `Tests 94 passed (94)`.
- `npm --prefix web run test -- --run src/modules/admin/components/OrdersTable.test.tsx src/modules/admin/pages/OrdersPage.test.tsx` (Task 2 verify): `Tests 110 passed (110)`.
- Full web suite at the end: `Test Files 225 passed (225)`, `Tests 6668 passed (6668)`.
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output. `npm --prefix web run typecheck`: exit 0. `npm --prefix web run format:check`: all files use Prettier style.
- `npm --prefix web run e2e -- --grep @orders-view`: `10 passed` (2 tests in chromium, firefox, webkit, pixel, iphone). With `@orders-list` and `@orders-filters` together: `25 passed`.
- Acceptance greps: `grep -n "withDefault"` finds nothing in `useOrdersView.ts` or `useOrdersListParams.ts`; `grep -c "'csps-orders-view'" useOrdersView.ts` is 1; `grep -c "Discount" OrdersTable.tsx` is 0; `OrdersTable.test.tsx` has tests named with "Fully Paid" and "Not collected"; `grep -c "@orders-view" orders-view.spec.ts` is 2.
- Recipe, `no-long-dash.node.test.ts` and `source-layout.node.test.ts` pass.
- gitleaks on every staged change: no leaks found. Fixture names are made up; no emails, local paths or real data.
- Preflight run before the full test run and the e2e runs: all four ports free, no other project's processes.

## Known Stubs

None. The red-step skeleton `useOrdersView` was replaced in its GREEN commit.

## Threat Flags

None. T-08-21 (tampering through the URL or storage) is mitigated: only `grid` and `table` are accepted from either source (`resolveView` and the allow-list parser), the storage holds only the view choice and never order data, and the stored text is never given to the URL parser. T-08-SC: no package added or bumped.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 08-12 fills the tab panels and the rest of the order page; it does not touch the list.
- Plan 08-24 owns the sweeps and the owner review list; the table look at 390, 820 and 1440 px in both themes, and the page-keeping choice, are for the owner's review (see `deferred-items.md`).
- The deleted-orders list (plan 08-20) can reuse the `ResponsiveTable` wiring pattern used here.

---
*Phase: 08-order-screens*
*Completed: 2026-10-30*

## Self-Check: PASSED

- FOUND: web/src/modules/admin/hooks/useOrdersView.ts, web/src/modules/admin/hooks/useOrdersView.test.tsx, web/src/modules/admin/components/OrdersTable.tsx, web/src/modules/admin/components/OrdersTable.test.tsx, web/e2e/orders-view.spec.ts
- FOUND commits: e3830011, 3e8ee6f7, 81848f0e, 112838d2, 80dcdeb6
