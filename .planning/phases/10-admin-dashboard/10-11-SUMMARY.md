---
phase: 10-admin-dashboard
plan: 11
subsystem: ui
tags: [react, dashboard, chart, tanstack-query, nuqs, url-state, vitest, tdd]
created: "2026-11-07T09:40:00-06:00"
updated: "2026-11-07T09:40:00-06:00"

requires:
  - phase: 10-admin-dashboard
    provides: IncomeExpenseChart with showProfit and labels (10-04), GET /dashboard/chart (10-06), dashboardService, dashboardKey, DashboardPage and the .s-dash row (10-07, 10-09)
provides:
  - "dashboardService.chart(months, signal) for GET /api/v1/dashboard/chart?months="
  - "useDashboardChartQuery(months) and dashboardChartKey(months): ['dashboard', 'chart', months], staleTime 0, refetchOnMount always, keeps the last months while another range loads"
  - "useDashboardRange(): the range URL parameter (6m default stays out of the URL, 12m written with replace), DASHBOARD_RANGES and RANGE_MONTHS"
  - "IncomeExpenseCard: the Income vs. expenses card with the Range switch, the D-50 and D-104 chart words, the loading, empty and error states and the dimmed refetch"
  - "useRefreshOrders and useRefreshExpenses also invalidate the dashboard root key (D-13); useRefreshCategories gets it through useRefreshExpenses"
  - "dashboardBackend() now also answers the chart; dashboardChartBackend(), dashboardChartFixture(), dashboardChartEmptyFixture() in the test fixtures"
affects: [10-13 money strip (adds its keys to the same refresh hooks, plan 10-15), 10-21 dashboard sweep and screenshot review, P10-BL-04, P10-BL-05]

actuals:
  tokens: 11800
  tasks: 3
  commits: 7

plan_head_before: 06efa0dca651f10b91282554ef4289e5a803e507
plan_head_after: ca1ae7060ec0fc6c9e78f166e122beeb58038a37

tech-stack:
  added: []
  patterns:
    - "A card that owns its own query (the chart) keeps the page's other cards alive when it fails; the cards fed by the summary share one query"
    - "A refetch with kept data is dimmed by colour only (data-refetching on the body, bg-surface-2), after 200 ms, as the list tables are (D-02: no opacity on text)"
    - "Month names and labels come from the server's yyyy-MM keys; a key that is not yyyy-MM gets no group and no month is made up"

key-files:
  created:
    - web/src/modules/admin/components/IncomeExpenseCard.tsx
    - web/src/modules/admin/components/IncomeExpenseCard.test.tsx
    - web/src/modules/admin/hooks/useDashboardRange.ts
    - web/src/modules/admin/hooks/useDashboardRange.test.tsx
    - web/src/modules/admin/hooks/useDashboardChartQuery.ts
    - web/src/modules/admin/hooks/useRefreshOrders.test.tsx
    - web/src/modules/admin/hooks/useRefreshExpenses.test.tsx
  modified:
    - web/src/modules/admin/services/dashboardService.ts
    - web/src/modules/admin/services/dashboardService.test.ts
    - web/src/modules/admin/pages/DashboardPage.tsx
    - web/src/modules/admin/pages/DashboardPage.test.tsx
    - web/src/modules/admin/dashboardCopy.ts
    - web/src/modules/admin/hooks/useRefreshOrders.ts
    - web/src/modules/admin/hooks/useRefreshExpenses.ts
    - web/src/test/dashboardFixtures.ts
    - web/src/modules/admin/components/dashboard.recipe.ts
    - web/src/modules/admin/components/dashboard.recipe.node.test.ts

key-decisions:
  - "The sub line, the empty message and the months asked for follow the range in the URL, not the response, so a switch changes them at once while the old months stay on screen"
  - "A refetching chart is dimmed by colour only (--surface-2 on the body), not by opacity, to follow the D-02 rule the list tables already follow"
  - "A failed read of the chart replaces the chart with its own alert (the 10-07 and 10-09 pattern); what a failed background refresh should look like stays parked as P10-BL-04"

patterns-established:
  - "dashboardBackend(summary, chart) answers both dashboard reads, so no page test reaches an unhandled request"

requirements-completed: [DASH-03, DASH-06]

coverage:
  - id: D1
    description: "The Income vs. expenses card shows the title and the sub 'Last 6 months' or 'Last 12 months', the server's months oldest first with short month names and 'Oct 2026' labels taken from the month keys, and the profit the server sent"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/IncomeExpenseCard.test.tsx#the months (DASH-03, D-36)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/DashboardPage.test.tsx#the Income vs. expenses card on the page (DASH-03, plan 10-11)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The legend reads 'Income (payments minus refunds)', 'Expenses (company + orders)' and 'Profit (income minus expenses)', and the tooltip reads Income, Expenses and Profit (D-50, D-104)"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/IncomeExpenseCard.test.tsx#the head and the legend (DASH-03, D-50)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 6M and 12M switch (group Range) lives in the URL as range=12m: 6m stays out, a change replaces, an unknown value falls back with one replace, focus stays on the segment"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useDashboardRange.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/IncomeExpenseCard.test.tsx#the range switch (DASH-03, WEB-10)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Chart first load shows a 220 px skeleton in 'Loading the chart…'; a range switch keeps the last months, dimmed after 200 ms; all-zero months show 'No money in or out yet' with the range switch; a failure shows 'Couldn't load the chart.' with Try Again while the other cards keep their own states"
    requirement: DASH-06
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/IncomeExpenseCard.test.tsx#the card states (DASH-06)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/DashboardPage.test.tsx#keeps the KPI row, the status card and Recent orders when the chart fails (DASH-06)"
        status: pass
    human_judgment: false
  - id: D5
    description: "After an order, item, payment, refund, discount, order expense or company expense write the dashboard summary and every chart range are read again (D-13)"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useRefreshOrders.test.tsx and useRefreshExpenses.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "The chart looks right at 320 to 1920 px in Blush and Espresso with 12 months (every other month label, the current month labelled, readable text) and in the dimmed state"
    requirement: DASH-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/dashboard.recipe.node.test.ts#dims a refetching chart by colour only"
        status: pass
    human_judgment: true
    rationale: "jsdom draws no layout and has no ResizeObserver. The plan's own manual row (VALIDATION) and the owner's screenshot review judge the real look at 320 and 375 px"

duration: 31 min
completed: 2026-11-07
status: complete
---

# Phase 10 Plan 11: Staff see income, expenses and profit for 6 or 12 months on the dashboard

*Created: 2026-11-07T09:40:00-06:00 · Updated: 2026-11-07T09:40:00-06:00*

**The dashboard now draws the server's six or twelve months of income, expenses and profit with the owner's D-50 and D-104 words, a 6M and 12M switch kept in the URL, its own loading, empty and error states, and every order and expense write reads the dashboard again.**

## Performance

- **Duration:** about 31 min
- **Started:** 2026-11-07T15:07:42Z
- **Completed:** about 2026-11-07T15:40Z
- **Tasks:** 3 (Task 1 was a tracer)
- **Files:** 17 touched by the task commits (7 created, 10 modified); 7 task commits plus this SUMMARY commit

## Accomplishments

- **Chart card (Task 1, tracer).** `dashboardService.chart(months, signal)` reads `GET /dashboard/chart?months=` (the number goes out as text, `months=6` or `months=12`). `IncomeExpenseCard` maps each server month to a `ChartDatum`: the short month and the `Oct 2026` label come from the month key, the three figures through `Number()`, and the profit is the server's. It passes `showProfit` and the labels from `dashboardCopy.ts`: legend `Income (payments minus refunds)`, `Expenses (company + orders)`, `Profit (income minus expenses)`, tooltip `Income`, `Expenses`, `Profit` (D-104 `profitTip`). The card is the first child of the `.s-dash` row and the 10-09 SPEC-GAP marker is gone. The tracer `<verify>` is automated only, so it was re-run end to end (43 tests pass) and expansion went ahead: `Tracer verified end-to-end, expanding`.
- **Range and states (Task 2).** `useDashboardRange()` is `createListParams({ range: literalParser(['6m', '12m'], '6m') })`: 6m stays out of the URL, a switch writes with replace, an unknown value falls back and is removed with one replace. The card owns a `SegmentedControl` named Range (`6M`, `12M`). The sub line, the empty message and the month count follow the URL range. The first load shows a 220 px `Skeleton` in `LoadingRegion` "Loading the chart…". A switch keeps the last months (`keepPreviousData`) and marks the body `data-refetching` after 200 ms (`useDelayedFlag`), dimmed by colour only. All-zero months show `EmptyState` "No money in or out yet" with the range switch kept. A failure shows `ErrorState` "Couldn't load the chart." with Try Again in the card only.
- **Freshness (Task 3).** `useRefreshOrders` and `useRefreshExpenses` also invalidate `dashboardKey`, which reaches the summary and every chart range. `useRefreshCategories` gets it through `useRefreshExpenses`. Two tests mount the real summary and chart queries and show that one refresh makes both read again.

## Task Commits

1. **Task 1: six months with the owner's labels (tracer)** - `77403a5a` (test), `cd22c9de` (feat)
2. **Task 2: range switch and card states** - `90e51d12` (test), `1e4a076f` (feat)
3. **Task 3: order and expense writes refresh the dashboard** - `44140605` (test), `f3dbc93f` (feat)
4. **Refactor: simpler month key handling** - `ca1ae706` (refactor)

**Plan metadata:** the SUMMARY commit that follows this file. `commits: 7` was measured with `git rev-list --count 06efa0dc..HEAD` before it.

## TDD Gate Compliance

`gsd_run check tdd-red-evidence` was not run: Vitest's default reporter is not a format that classifier reads, so each RED was inspected by hand (as in plans 10-02 to 10-09). The RED commits carry stubs that render an empty element or return a fixed value, so every failure is an assertion about missing content, not a load or import fault.

**Cycle 1, Task 1**

- RED `77403a5a`: `npm run test -- --run src/modules/admin/components/IncomeExpenseCard.test.tsx src/modules/admin/services/dashboardService.test.ts src/modules/admin/pages/DashboardPage.test.tsx` gave `Tests 16 failed | 27 passed (43)`. Failures: `Unable to find role="heading" and name "Income vs. expenses"`, `Unable to find an element with the text: Income (payments minus refunds)`, `Unable to find role="img" and name "Oct 2026: income ₱126,450.00, expenses ₱58,320.00, profit ₱68,130.00"`, and for the service `expected '' to be '?months=6'`, `expected [] to have a length of 1`.
- Semantic assessment: the target tests ran and failed on the planned content and the planned request; the 27 passing tests are the unchanged page and summary tests. No setup fault.
- GREEN `cd22c9de`: same command, `Test Files 3 passed (3)`, `Tests 43 passed (43)`.

**Cycle 2, Task 2**

- RED `90e51d12`: `Tests 26 failed | 42 passed (68)` over `useDashboardRange.test.tsx`, `IncomeExpenseCard.test.tsx`, `DashboardPage.test.tsx`: no radiogroup named Range, no "No money in or out yet", no "Couldn't load the chart.", `Loading the chart…` missing, and the hook stub never changed the range or the URL.
- Semantic assessment: real failures on the planned assertions.
- GREEN `1e4a076f`: `Test Files 3 passed (3)`, `Tests 68 passed (68)`, twice in a row. Two RED tests were amended in GREEN (Deviation 4 and 5). The recipe CSS test and the class gate pass.

**Cycle 3, Task 3**

- RED `44140605`: `Tests 5 failed | 10 passed (15)`: `["dashboard","summary"]: expected false to be true` (not invalidated) and `expected [ …(1) ] to have a length of 2 but got 1` (no second read).
- Semantic assessment: real failures on the planned invalidation.
- GREEN `f3dbc93f`: `Test Files 3 passed (3)`, `Tests 15 passed (15)` with `useApplyOrder.test.tsx`.
- REFACTOR `ca1ae706`: the label year is `item.month.slice(0, 4)` and the month regex has no unused group. The card and page tests pass after it (`Tests 55 passed (55)`).

## Files Created/Modified

See the `key-files` block. Every string is in `web/src/modules/admin/dashboardCopy.ts` (`chart` group). The one new look is `chartBodyClasses` in `dashboard.recipe.ts`.

## Decisions Made

- **The sub, the empty message and the month count follow the URL range.** Choosing 12M changes "Last 6 months" to "Last 12 months" at once, while the six old months stay on screen until the twelve arrive (the plan's behavior line).
- **Dim by colour, not opacity.** UI-SPEC D3 says "dimmed after 200ms (P2 refetch rule)". The P2 rule (D-02) forbids an opacity below 1 on text-bearing elements and dims by `--surface-2`. The chart body takes `data-[refetching=true]:bg-surface-2`. A CSS test pins it and pins that the recipe has no opacity token.
- **A failed chart read replaces the chart with the alert.** This is the 10-07 and 10-09 pattern. What a failed background refresh should look like is still the owner's call (P10-BL-04); no test pins "old months beside an alert" either way beyond the 12M failure test, which shows the alert and a working switch.
- **No client month repair.** A server month whose key is not `yyyy-MM` gets no group, and a missing month is not filled in (the plan's prohibition). The server always sends exactly 6 or 12.
- **`range` is a filter key without a page.** The factory's `setFilter` replaces the history entry and has no page to reset here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `dashboardBackend` had to answer the chart**
- **Found during:** Task 1
- **Issue:** The test server errors on any unhandled request (`onUnhandledFrame: 'error'`). Once the page asks for the chart, every existing page test that only answered the summary would fail.
- **Fix:** `dashboardBackend(summary, chart?)` also registers the chart handler (by default the fixture for the `months` asked) and returns `chartCalls`. `dashboardChartBackend()` answers only the chart. New `dashboardChartFixture`, `dashboardChartEmptyFixture` and `chartMonthKeys`. These are in `web/src/test/dashboardFixtures.ts`, which the plan lists.
- **Committed in:** `77403a5a`

**2. [Rule 3 - Blocking] `dashboard.recipe.ts` and its CSS test**
- **Found during:** Task 2 (the orchestrator note anticipated this)
- **Issue:** The colour-only dim needs a body class with a `data-refetching` rule. `dashboard.recipe.ts` and `dashboard.recipe.node.test.ts` are not in the plan's file list.
- **Fix:** One recipe, `chartBodyClasses` (`p-5 data-[refetching=true]:bg-surface-2`), and one test in the existing node test that checks the generated CSS and that no recipe token uses opacity. The class gate passes.
- **Committed in:** `1e4a076f`

**3. [Rule 3 - Blocking] The page tests need the nuqs adapter**
- **Found during:** Task 1
- **Issue:** `DashboardRoute` now reads `range` through nuqs, so its tests need `NuqsTestingAdapter`.
- **Fix:** `renderPage(search = '')` in `DashboardPage.test.tsx` wraps the route in the adapter, the way `ExpensesPage.test.tsx` does.
- **Committed in:** `77403a5a`

**4. [Test amendment in GREEN] Failing-retry assertions printed React props**
- **Found during:** Task 2 GREEN
- **Issue:** Inside `waitFor`, `expect(arrayOfElements).toHaveLength(12)` and `expect(element).toHaveAttribute(...)` fail while the value is still old, and chai then inspects the DOM nodes and reads React's `props.key`. React logged "`key` is not a prop", and the console guard failed the test. The product code was fine.
- **Fix:** Those assertions compare plain values (`.length`, `getAttribute(...)`). The behavior under test did not change.
- **Committed in:** `1e4a076f`

**5. [Test amendment in GREEN] Query order in the URL**
- **Found during:** Task 2 GREEN
- **Issue:** My RED test expected `?tab=money&range=12m`. The shared `orderSearchParams` sorts keys, so the URL is `?range=12m&tab=money`.
- **Fix:** The expectation follows the shared ordering.
- **Committed in:** `1e4a076f`

---

**Total deviations:** 5 (3 blocking, 2 test amendments).
**Impact on plan:** None changes the behavior the plan defined. Deviations 1 to 3 touch files outside the plan's list, all test support or one recipe.

## Issues Encountered

- **Slow wide runs.** The wide run (`src/modules/admin`, `src/components/data`, the class gate and the two layout tests) and the full lint took several minutes each while the other executor ran. Both finished green.
- **node_modules.** A Windows junction to the main checkout's `web/node_modules` was made with Node's `fs.symlinkSync(..., 'junction')`. It is git-ignored, was never committed, and is removed (only the link) before returning.
- **Shell.** Compound commands that mix `cd` with git, and heredocs after `cd`, were refused, so they were split or written with the file tools.
- **Flakes:** none seen in this plan's tests (the card and page files passed on every re-run).

## Known Stubs

None. The RED stubs (`IncomeExpenseCard`, `useDashboardRange`, `dashboardService.chart`) were replaced in GREEN. `grep STUB web/src` finds nothing.

## Threat Flags

None beyond the plan's threat model.

- T-10-21 mitigated: `range` goes through `literalParser(['6m', '12m'], '6m')`; any other text reads as 6m and is removed with one replace (7 cases in `useDashboardRange.test.tsx`); the service sends only `6` or `12`, and the server re-checks it (plan 10-06).
- T-10-22 mitigated: the order and expense refresh hooks invalidate the dashboard root key; the chart query uses staleTime 0 and refetchOnMount always.
- T-10-SC: no package was added or bumped.

## User Setup Required

None - no external service configuration required.

## Open questions for the owner

None blocking.
1. **P10-BL-04 (already parked).** A failed read of the chart shows its alert and no old months. If the owner prefers the old months with a small stale note, the change is in one place in `IncomeExpenseCard`.
2. **P10-BL-06 (already parked).** The 320 px KPI layout was not touched.
3. **E2E and the screenshot review.** The chart now loads on the real `/admin` page. See "Not run".

## Verification Results

All from this worktree, final code unless noted.

- `npm --prefix web run typecheck`: exit 0, no output (run after Task 3; the refactor was re-checked with `tsc -p tsconfig.app.json`, no output).
- `npm --prefix web run lint` (`eslint . --max-warnings 0`): exit 0, no output. `prettier --check` on `src/modules/admin` and `src/test`: all formatted.
- Plan verify commands: Task 1 `Tests 43 passed (43)`; Task 2 `Tests 68 passed (68)` (twice); Task 3 `Tests 15 passed (15)`; `src/test/no-long-dash.node.test.ts` passed; `src/test/source-layout.node.test.ts` and `scripts/tailwind-classes.test.ts` passed (65 tests with the no-long-dash file).
- Wide run: `src/modules/admin src/components/data scripts/tailwind-classes.test.ts src/test/no-long-dash.node.test.ts src/test/source-layout.node.test.ts`: `Test Files 158 passed (158)`, `Tests 3726 passed (3726)` (before the refactor; the card and page files were re-run after it: `Tests 55 passed (55)`).
- Axe: zero violations in jsdom for the card drawn, loading, empty and failed, and on the page (existing page tests).
- Coverage of the new files (v8, this plan's tests only): `IncomeExpenseCard.tsx` lines 94.4%, `useDashboardRange.ts` lines 100%, `useDashboardChartQuery.ts`, `useRefreshOrders.ts`, `useRefreshExpenses.ts` and `dashboardService.ts` are fully covered (the report leaves fully covered files out); the six files together: lines 97.0%, functions 100%, branches 86.1%. Branch figures are lower (card 84.9%, range hook 71%) because v8 counts the React Compiler's generated cache checks; the suite-wide gate is the orchestrator's.
- gitleaks (`gitleaks protect --staged --no-banner`) ran before each of the 7 commits: no leaks found. Fixtures use made-up figures only.
- Acceptance greps: `Income (payments minus refunds)` 1, `showProfit` in the card 1, `/dashboard/chart` in the service 2 (comment and call), `literalParser` in the range hook 2, `No money in or out yet` in the copy 2, a test named "falls back" 1, `dashboardKey` in `useRefreshOrders.ts` 2 and in `useRefreshExpenses.ts` 2.
- **Not run:** Playwright (`@dashboard` and the other e2e specs). The e2e script resets `CSPS_E2E` and uses port 5199 and a per-worktree lock, and another executor was running at the same time, so two resets could collide. The orchestrator's gate should run `@dashboard` on all projects. Review WR-03 (wave 4) warns that a chart request still in flight when a spec calls `page.goto` can raise the WebKit "access control checks" page error (parked P10-BL-05): if a WebKit failure says that, it is that item; the guard was not weakened. The visual review (VALIDATION manual row: 12 months at 320 and 375 px, every other month label, current month labelled) is still open.

## Next Phase Readiness

Plan 10-13 (money strip) goes between the header and the KPI row. Plan 10-15 adds the money keys to the same two refresh hooks, next to `dashboardKey`. Plan 10-21 owns the signed-in dashboard sweep and the screenshot review, which should include the chart at 6M and 12M, the dimmed state, and the empty and error states.

## Self-Check: PASSED

- FOUND: all 7 files in `key-files.created` exist on disk.
- FOUND: commits `77403a5a`, `cd22c9de`, `90e51d12`, `1e4a076f`, `44140605`, `f3dbc93f`, `ca1ae706` on this branch; `git rev-list --count 06efa0dc..HEAD` = 7 before this SUMMARY commit.
- STATE.md and ROADMAP.md were not modified (`git status` shows only this file before the SUMMARY commit).

---
*Phase: 10-admin-dashboard*
*Completed: 2026-11-07*
