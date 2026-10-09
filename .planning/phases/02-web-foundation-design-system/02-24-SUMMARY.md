---
phase: 02-web-foundation-design-system
plan: 24
subsystem: ui
tags: [order-card, data-table, income-expense-chart, svg, tip-x, col-w, parity, tailwind, wcag, tdd, web-02, d-09, d-33, a11y-01]
created: "2026-10-08T20:56:00-05:00"
updated: "2026-10-08T20:56:00-05:00"

requires:
  - phase: 02-web-foundation-design-system (plan 02-17)
    provides: "Button (ghost / ghost-danger sm, icon-only with aria-label) for the OrderCard actions"
  - phase: 02-web-foundation-design-system (plan 02-18)
    provides: "MediaPlaceholder (--ratio) and Icon for the OrderCard cover, dates and count chip"
  - phase: 02-web-foundation-design-system (plan 02-19)
    provides: "StatusBadge (className passthrough for the cover ring)"
  - phase: 02-web-foundation-design-system (plan 02-21)
    provides: "Skeleton (--sk-w/--sk-h) for the DataTable loading rows"
  - phase: 02-web-foundation-design-system (plan 02-23)
    provides: "OrderTotals variant=card, cardClasses, ORDER_0148 / ORDER_0151 seed data"
provides:
  - "web/src/ui/data: OrderCard (with an optional server `totals` prop), DataTable (align class map, --col-w, focusable scroll region), IncomeExpenseChart (hand-rolled SVG, --tip-x tooltip, keyboard-reachable months) exported from @/ui/data with OrderCardProps, DataTableColumn, DataTableProps, ChartDatum, IncomeExpenseChartProps, CellAlign"
  - "data.recipe.ts: the App. B order card, table and chart looks as complete utility literals"
  - "web/src/dev/scenarios/groups/data.ts: 9 parity scenarios (3 OrderCard, 4 DataTable, 2 chart); CARD_0148, CARD_0151, ORDER_0153, TABLE_ROWS, CHART_6_MONTHS, CHART_12_MONTHS exported"
  - "KeyboardScrollTable wrapper pair (web/src/dev/previews + web/visual/reference/fragments), documented in docs/web/parity.md §5"
  - "Parity harness determinism: rest cases scrolled into view before FREEZE/REPAINT; Chromium launched with --disable-partial-raster"
affects: [02-29, 02-30, 02-31, 02-34, phase-08-order-screens, dashboard, parity]

actuals:
  tokens: 21378    # chars/4 over the realized diff (85,510 chars, 14 files)
  tasks: 2
  commits: 4
plan_head_before: f0b65dc45e6d1cec706b21c2f58c85f2d6ef7968
plan_head_after: 936cac7a0a91ec0329f8849b6a6d4c0a177a9e25

tech-stack:
  added: []
  patterns:
    - "A scrolling region that holds no focusable element is itself a named focusable region (role=region, tabIndex 0, named by the caption)"
    - "SVG data marks reachable by keyboard: the drawing is a named role=group, each datum a focusable role=img named with its figures; the tooltip follows focus as well as hover and Escape dismisses it"
    - "Parity rest rows scroll the case into view before the repaint, and Chromium runs without partial raster, so corner anti-aliasing at the viewport edge cannot keep an earlier frame"

key-files:
  created:
    - web/src/ui/data/data.recipe.ts
    - web/src/ui/data/OrderCard.tsx
    - web/src/ui/data/DataTable.tsx
    - web/src/ui/data/IncomeExpenseChart.tsx
    - web/src/ui/data/data.test.tsx
    - web/src/ui/data/IncomeExpenseChart.test.tsx
    - web/src/ui/data/index.ts
    - web/src/dev/scenarios/groups/data.ts
    - web/src/dev/previews/KeyboardScrollTable.tsx
    - web/visual/reference/fragments/KeyboardScrollTable.tsx
  modified:
    - web/visual/parity.spec.ts
    - web/visual/playwright.visual.config.ts
    - docs/web/parity.md
    - .planning/phases/02-web-foundation-design-system/deferred-items.md

key-decisions:
  - "OrderCard keeps the approved no-team look: the customer is the title and the customer line stays empty. The plan text asked for \"Walk-in customer\" there, but App. D.3 and the approved grid (App. E.7) show no such text on the card (spec §8.3 uses it only in table rows); adding it would change the approved text (D-08), so it was not added"
  - "OrderCard takes an optional `totals` prop (the server's figures, D-09) passed to OrderTotals; without it the card shows App. D.3's orderTotals(order) preview"
  - "OrderCard dates go through format.ts formatCalendarDate (date-only, no zone shift); same text as csps.ts formatDate"
  - "DataTable's frame is a focusable region named by its caption (SPEC-DEVIATION A11Y-01, axe scrollable-region-focusable, WCAG 2.1.1); attributes only. The frozen reference frame gets the same attributes through the KeyboardScrollTable wrapper pair"
  - "IncomeExpenseChart's drawing is a named role=group (App. D.3: role=img) so its month groups can be focusable images named \"{label}: income ₱…, expenses ₱…\"; ChartDatum gains an optional `label` (e.g. \"Oct 2026\"); focus shows the tooltip, blur and Escape hide it (WCAG 2.1.1, 1.4.13)"
  - "The 12-month chart scenario uses six demo months (Nov 2025–Apr 2026, chosen below ₱145,900 so the axis stays ₱200k) before the spec §12.4 six; the spec gives only six months"
  - "Parity harness: rest cases are scrolled into view before FREEZE/REPAINT, and the Chromium project runs with --disable-partial-raster; both fix a run-to-run corner anti-aliasing race at the viewport's right edge without any tolerance or normalization"

patterns-established:
  - "Screens show an order card with `<OrderCard order={o} totals={serverTotals} onView onEdit onDelete />`; the dashboard chart with `<IncomeExpenseChart data={months} />` where each datum carries `label` (\"Oct 2026\")"
  - "DataTable is kept for the .csp-table look only; list screens use ResponsiveTable (02-30)"

requirements-completed: [WEB-02]

coverage:
  - id: D1
    description: "OrderCard (cover placeholder, StatusBadge with the ring, image-count chip, order number in --accent-ink, piece count, team or customer title, customer line, dates with the overdue colour, the card totals, View / Edit / Delete) equal to the approved design for ORD-2026-0148, ORD-2026-0151 and the no-team ORD-2026-0153 in both themes at 390 and 1440 (and on hover for 0148) in Chromium, Firefox and WebKit; axe clean"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/data/data.test.tsx (OrderCard, 15 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @data (24 passed: chromium 8, firefox 8, webkit 8)"
        status: pass
    human_judgment: false
  - id: D2
    description: "DataTable (.csp-table look, align class map, widths only through --col-w, 4 skeleton rows while loading, error and empty rows, last-row cells without a rule, hovered row on --surface-2, focusable named scroll region) equal to the approved table in both themes at 390 and 1440 in three engines; axe clean"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/data/data.test.tsx (DataTable, 12 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @data"
        status: pass
    human_judgment: false
  - id: D3
    description: "IncomeExpenseChart (hand-rolled SVG, income/expense bars in --chart-income/--chart-expense, ₱0/₱100k/₱200k ticks, legend, tooltip positioned only through --tip-x; every month group focusable and named with the month and both peso figures) equal to the approved chart at rest for 6 and 12 months in both themes at 390 and 1440 in three engines; axe clean at rest and with the tooltip open"
    requirement: "WEB-02"
    verification:
      - kind: unit
        ref: "web/src/ui/data/IncomeExpenseChart.test.tsx (20 tests)"
        status: pass
      - kind: automated_ui
        ref: "npm --prefix web run parity -- --grep @data"
        status: pass
      - kind: other
        ref: "npm --prefix web run verify (exit 0)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Screen-reader reading of the chart month groups and the table scroll region (NVDA/VoiceOver), and whether the keyboard focus ring on an SVG month group is clear enough"
    verification: []
    human_judgment: true
    rationale: "jsdom and axe check roles and names, not what a real screen reader announces or how an SVG focus ring looks; A11Y-05 covers the manual passes"

duration: 49min
completed: 2026-10-08
status: complete
---

# Phase 2 Plan 24: OrderCard, DataTable and IncomeExpenseChart Summary

**OrderCard, DataTable and the IncomeExpenseChart are converted to utilities and proven equal to the approved design in Chromium, Firefox and WebKit, in both themes at 390 and 1440. The order card shows the spec §12.2 seed orders (ORD-2026-0148 balance due ₱9,327.50, ORD-2026-0151 Fully Paid, the no-team ORD-2026-0153 overdue). The table sizes columns only through `--col-w`, and its sideways-scrolling frame can now be reached by keyboard. The chart is hand-rolled SVG with the spec §12.4 data, its tooltip is positioned only through `--tip-x`, and every month can be reached by keyboard and is named with both peso figures.**

## Performance

- **Duration:** 49 min
- **Started:** 2026-10-09T01:05:50Z
- **Completed:** 2026-10-09T01:55:14Z
- **Tasks:** 2 of 2
- **Files:** 14 (10 created, 4 modified)

## Accomplishments

- **OrderCard.** It keeps the App. D.3 markup and copy:
  - the 16:10 cover button "View order {number}" with the image or the placeholder, the StatusBadge with its 1px `--line` ring, and the image count;
  - the order number and "{n} pcs", the team (or the customer) and the customer line, the calendar and "Due {date}" lines (overdue in `--danger`), and the compact OrderTotals;
  - View, Edit and the icon-only Delete pushed right.
  - The card lifts on hover, with `--shadow-2` and the `--line-strong` border. An optional `totals` prop passes the server's figures (D-09).
- **DataTable.**
  - The `.csp-table` frame and table, a visually hidden caption and the header in the 12px upper-case look.
  - `align` is a class map, and widths go only through `--col-w`.
  - It has four skeleton rows while loading, plus the error row and the empty row. Money cells use formatPeso in the tabular look. The last row's cells drop their rule, and a hovered row turns `--surface-2`.
- **IncomeExpenseChart.**
  - The App. D.3 geometry: a 640-wide view box, bars at most 18 wide with 4px rounded tops, three gridlines with "₱0 / ₱100k / ₱200k" and the legend.
  - The tooltip (month, income, expenses, net) is placed through `--tip-x`.
  - Every month group takes focus and is named "Oct 2026: income ₱126,450.00, expenses ₱58,320.00". Focus shows the tooltip, and blur and Escape hide it.
- **Scenarios (data group, 9 cases, both themes, 390 and 1440).**
  - `order-card-0148` (rest and hover), `order-card-0151` and `order-card-walk-in`.
  - `data-table-orders` (rest and first-row hover), `data-table-loading`, `data-table-empty` and `data-table-error`.
  - `chart-6-months` and `chart-12-months`.

## Task Commits

1. **Task 1 (tracer): the ORD-2026-0148 order card matches the approved design, then the DataTable.**
   - RED `a7865e9`: 21 of 28 failed against inert stubs (`RED_EVIDENCE_OK`, `src/ui/data/data.test.tsx`).
   - GREEN `0702c0d`: 29 of 29 passed.
     - The first Chromium run failed axe (scrollable-region-focusable) at 390 on both pages, so I made deviation 1.
     - It also showed right-edge corner pixels, which led to deviation 3.
     - After the fixes, Chromium `@data` passed 8 of 8.
   - A throw-away mutation proved the comparison is live: the order number tracking was set to .05em and the table to 13px. Every affected case reported style, box and pixel differences. The mutation was reverted.
   - Tracer gate (interactive, end-of-phase, automated-only verify): I re-ran both verify commands after the commit before expanding (29 of 29, then Chromium 8 of 8).
2. **Task 2: IncomeExpenseChart with a custom-property tooltip and keyboard-reachable bars.**
   - RED `08b03c1`: 18 of 20 failed against an inert stub (`RED_EVIDENCE_OK`, `src/ui/data/IncomeExpenseChart.test.tsx`).
   - GREEN `936cac7`: 51 of 51 passed in `src/ui/data`.
     - Chromium `@data` passed 8 of 8.
     - The first three-engine run passed 23 of 24. The one failure was the corner race again under parallel load (deviation 4).
     - After the fix, the three-engine run passed **24 of 24**. `verify` exited 0.

**Plan metadata:** recorded in the docs(02-24) commit that adds this SUMMARY.

## Files Created/Modified

- `web/src/ui/data/data.recipe.ts`: the App. B `/* order card */`, `/* table */` and `/* chart */` looks
- `web/src/ui/data/OrderCard.tsx`, `DataTable.tsx`, `IncomeExpenseChart.tsx`: the converted components
- `web/src/ui/data/data.test.tsx` (31 tests) and `IncomeExpenseChart.test.tsx` (20 tests)
- `web/src/ui/data/index.ts`: the barrel
- `web/src/dev/scenarios/groups/data.ts`: 9 parity scenarios and the seed data
- `web/src/dev/previews/KeyboardScrollTable.tsx` and `web/visual/reference/fragments/KeyboardScrollTable.tsx`: the wrapper pair
- `web/visual/parity.spec.ts`: rest cases are scrolled into view before FREEZE and the repaint
- `web/visual/playwright.visual.config.ts`: Chromium runs with `--disable-partial-raster`
- `docs/web/parity.md`: §5 (the wrapper pair) and §7 (the scroll-first step and the Chromium flag)
- `.planning/phases/02-web-foundation-design-system/deferred-items.md`: an update on the forms flake

## Decisions Made

See `key-decisions` in the frontmatter. Later plans need these most:

- **Dashboard (layout plans, DASH-03).** Pass each month a `label` ("Oct 2026"), so the keyboard name says which year. The 6M | 12M SegmentedControl only changes `data`.
- **Phase 8 (order screens).** Pass the server's `totals` to OrderCard once the list returns them (D-09).
- **02-30 (ResponsiveTable).** The `.s-rt-wrap` frame scrolls sideways on tablets, so it needs the same focusable-region treatment, or it will fail axe `scrollable-region-focusable` exactly as DataTable did.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The table frame could not be scrolled by keyboard**
- **Found during:** Task 1 (first Chromium parity run, axe at 390 px)
- **Issue:** At 390 px the table is wider than its frame, which scrolls sideways. The frame holds nothing focusable, so axe reports `scrollable-region-focusable` (WCAG 2.1.1) on both the frozen reference and the implementation.
- **Fix:** DataTable's frame is `role="region"`, `tabIndex={0}`, named by the caption (SPEC-DEVIATION A11Y-01). It changes attributes only and is invisible at rest. An `eslint-disable-next-line jsx-a11y-x/no-noninteractive-tabindex` with its reason is recorded, because the rule does not know this WCAG technique. The new `KeyboardScrollTable` wrapper pair gives the frozen reference frame the same attributes after mount, following the DefinedTotalsNote precedent. Attributes are not compared, and no look changed.
- **Files modified:** `DataTable.tsx`, `data.ts`, the two `KeyboardScrollTable.tsx` files, `docs/web/parity.md`
- **Committed in:** `0702c0d`

**2. [Rule 2 - Missing critical] Chart months need a role that allows focus, and a way to dismiss the tooltip**
- **Found during:** Task 2 (design)
- **Issue:** App. D.3's drawing is one `role="img"`. An image's children are hidden from assistive technology, so focusable month groups inside it would be invalid. The hover tooltip also had no way to dismiss it (WCAG 1.4.13).
- **Fix:** The drawing is a named `role="group"`, and each month is a focusable `role="img"` named with its figures. Escape hides the tooltip. `ChartDatum.label` is an added optional prop. It changes attributes and handlers only. Marked `SPEC-DEVIATION: A11Y-01`.
- **Committed in:** `936cac7`

**3. [Rule 3 - Blocking] The parity harness had a corner anti-aliasing race at the viewport's right edge (sequential case)**
- **Found during:** Task 1 (Chromium runs)
- **Issue:** `data-table-error`, `order-card-walk-in` and others failed their pixel step by 2 to 21 pixels, all at x 388–389 (rounded corners on the right edge of the 390 px viewport). Computed styles, boxes and compositing layers were identical (checked through CDP). Out of the harness, the same capture differed on **either** side from run to run, and the reference also differed from itself. That makes it a harness race, not a component difference. The screenshot scrolled each case into view after REPAINT.
- **Fix:** In rest rows, the case is scrolled into view on both sides before FREEZE and REPAINT. In a sequential reproduction, differing runs went from 4 of 5 to 0 of 8.
- **Files modified:** `web/visual/parity.spec.ts`, `docs/web/parity.md`
- **Committed in:** `0702c0d`

**4. [Rule 3 - Blocking] The same race under parallel load**
- **Found during:** Task 2 (first three-engine run: 23 of 24; `--repeat-each 5` on the 390 rest rows: 5 of 10 failed)
- **Issue:** Under the suite's parallel load the corner race came back. Partial raster redraws only the changed part of a tile, so a corner could keep an earlier frame's anti-aliasing.
- **Fix:** The Chromium project launches with `--disable-partial-raster`. Under parallel load, reproductions went from 3 of 20 differing to 25 of 25 equal. In the harness, the 390 rest rows then passed 10 of 10, `@data` with `--repeat-each 3` passed 24 of 24, and the full Chromium regression passed 109 of 109. Both sides run in the same browser, and no tolerance or normalization was added.
- **Files modified:** `web/visual/playwright.visual.config.ts`, `docs/web/parity.md`, `deferred-items.md` (the 02-23 forms flake looks like the same race; left open until later regressions confirm it)
- **Committed in:** `936cac7`

### Plan-text adjustments

- **No "Walk-in customer" on the card.** The plan's truth and test text ask for it, but App. D.3's OrderCard and the approved Orders grid (App. E.7) render a no-team order with the customer as the title and an empty customer line. Spec §8.3 uses "Walk-in customer" only in the table's sub line (ResponsiveTable, 02-30). Showing it on the card would change the approved text, which needs an owner decision (D-08). So the card renders the approved look, which is proven equal (`order-card-walk-in`). The test asserts the approved behaviour. **The owner may still rule on adding the text to the card.**
- **Extra cases.** `data-table-empty` and `data-table-error` cover the remaining DataTable states. `order-card-0148` and `data-table-orders` also run on hover, so the card lift and the row highlight are proven in three engines.
- **Twelve-month data.** Spec §12.4 lists only six months. The six earlier months are demo values, documented in `data.ts`.

---

**Total deviations:** 4 auto-fixed (2 Rule 2, 2 Rule 3), plus 3 documented plan-text adjustments.
**Impact on plan:** Unit tests and the three-engine parity run prove every must-have truth, except the "Walk-in customer" wording on the card (see above). No look, element or text changed beyond the intentional-differences list. The A11Y-01 fixes are attributes and handlers only. The harness fixes make captures deterministic and change no compared value.

## Issues Encountered

- **No React Compiler cache branch for the tick list.** `IncomeExpenseChart.tsx` line 114 holds one compiler memo branch that no test reaches (branch coverage 97.67% for the file, 99.25% for `src/ui/data`). Global thresholds pass, as 02-20 recorded for similar branches.

## TDD Gate Compliance

- Task 1: RED `a7865e9` comes before GREEN `0702c0d` (`RED_EVIDENCE_OK`, `src/ui/data/data.test.tsx`).
- Task 2: RED `08b03c1` comes before GREEN `936cac7` (`RED_EVIDENCE_OK`, `src/ui/data/IncomeExpenseChart.test.tsx`).
- Some tests passed at RED, because the scenario data was committed with the stubs and an empty stub has nothing for axe to report. These are the scenario-declaration tests, the axe tests and the "no tooltip at rest" test. They pin that data.
- No REFACTOR commit was needed.

## Package Approval Gate (conditional checkpoint)

It did not fire. No package was installed, upgraded or re-resolved, because the chart is hand-rolled SVG. `package.json` and `package-lock.json` are unchanged.

## Look Gate (D-08 conditional checkpoint)

It did not fire. Parity found no look difference in the components. Every pixel difference was the harness race (deviations 3 and 4). "Walk-in customer" on the card would have been a text change, so it was not made (see Plan-text adjustments).

## Threat Flags

None.
- **T-02-56** is mitigated. Customer, team and chart text are rendered as React text nodes only. There is no HTML sink, and class names are never built from data.
- **T-02-SC:** no installs.

No endpoint, auth path or file access was added.

## Verification

- `npm --prefix web run test -- --run src/ui/data`: 2 files, 51 of 51 passed. `src/ui/data` is at 99.63% statements, 99.25% branches, 100% functions and 100% lines.
- Preflight before every parity run showed all four ports free and no other project's processes. Then:
  - `npm --prefix web run parity -- --grep @data --project chromium`: 8 passed (and 24 of 24 with `--repeat-each 3`).
  - `npm --prefix web run parity -- --grep @data`: **24 passed** (Chromium 8, Firefox 8, WebKit 8) in 2.5 min.
  - Regression: `--grep "@parity|@reference|@selftest" --project chromium` passed **109 of 109** in 5.8 min, including the self-test.
- `npm --prefix web run verify` exited 0. It ran typecheck (3 programs), lint, format, 69 files with 1800 tests, coverage at 99.16 / 98.26 / 100 / 99.93, the build, the license gate and notices.
- Acceptance greps:
  - `--col-w` in DataTable.tsx: 2 (at least 1 required).
  - `--tip-x` in IncomeExpenseChart.tsx: 3 (at least 1 required).

## User Setup Required

None. No external service configuration is required.

## Next Phase Readiness

- **Imports.** `OrderCard`, `DataTable` and `IncomeExpenseChart` come from `@/ui/data`. 02-34's barrel check finds them under their App. D.3 names.
- **Owner question (optional).** Should a no-team order card say "Walk-in customer" on its customer line? Today it matches the approved design (empty line).
- **Phase 14 (A11Y-05).** Confirm with NVDA and VoiceOver how the chart month groups and the table scroll region are read (coverage D4).

---
*Phase: 02-web-foundation-design-system*
*Completed: 2026-10-08*

## Self-Check: PASSED

- All 10 created files and the 4 modified files exist on disk.
- Commits `a7865e9`, `0702c0d`, `08b03c1` and `936cac7` are on `gsd/phase-2-web-foundation-design-system`.
