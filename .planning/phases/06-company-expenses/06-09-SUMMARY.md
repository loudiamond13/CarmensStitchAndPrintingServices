---
phase: 06-company-expenses
plan: 09
subsystem: web
tags: [react, kpi, tanstack-query, msw, playwright, a11y, or-4]
created: "2026-10-25T11:25:00-05:00"
updated: "2026-10-25T11:25:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: GET /api/v1/company-expenses/kpis and the generated CompanyExpenseKpisResponse (plan 06-05); the Company Expenses page, expensesService, EXPENSES_COPY, expenseFixtures and the e2e spec (plans 06-04, 06-07)
provides:
  - The E1 KPI row (This month, Last month, Top category) between the page header and the toolbar, from the server only
  - expensesService.kpis, useExpenseKpisQuery (key 'company-expense-kpis', exported as expenseKpisKey) and ExpenseKpiRow
  - formatMonthShort in utils/format (server month field to 'Nov', never the device clock)
  - KpiCard empty prop (EmptyValue in the dimmed zero look) and wrapping text values
  - kpisBackend and expenseKpis fixtures; the @expenses-kpis e2e
affects: [06-10, 06-12, 06-13, 06-14, 06-18]

actuals:
  tokens: 11300
  tasks: 2
  commits: 4
plan_head_before: 46b1ced6cee3b5c7d3ce5f848e98c31bc67ae8c0
plan_head_after: 3ceeb9306b0ecb156153f339ab594f179036940b

tech-stack:
  added: []
  patterns:
    - "The KPI row has its own query with no list params in the key, so a search, filter or page change never reads it again"
    - "Until the KPI answer arrives the card labels carry no month ('This month'); the month is added only from the server's month field"
    - "expensesBackend also answers the KPI route; a test that cares calls kpisBackend after it"
    - "Every expense mutation (plans 06-12 to 06-16) must invalidate expenseKpisKey as well as expensesKey"

key-files:
  created:
    - web/src/modules/admin/hooks/useExpenseKpisQuery.ts
    - web/src/modules/admin/components/ExpenseKpiRow.tsx
  modified:
    - web/src/components/money/KpiCard.tsx
    - web/src/components/money/money.recipe.ts
    - web/src/components/money/money.test.tsx
    - web/src/utils/format.ts
    - web/src/utils/format.test.ts
    - web/src/modules/admin/services/expensesService.ts
    - web/src/modules/admin/services/expensesService.test.ts
    - web/src/modules/admin/pages/ExpensesPage.tsx
    - web/src/modules/admin/pages/ExpensesPage.test.tsx
    - web/src/modules/admin/components/expenses.recipe.ts
    - web/src/modules/admin/expensesCopy.ts
    - web/src/test/expenseFixtures.ts
    - web/e2e/expenses.spec.ts
    - docs/web/e2e.md

key-decisions:
  - "The row is its own component (ExpenseKpiRow) so ExpensesPage stays readable; the page only places it above the toolbar."
  - "The failure banner reuses ErrorState with things=\"this month's totals\", which gives exactly \"Couldn't load this month's totals.\" over the shared reassurance line, with align start."
  - "A text KPI value (the category name) uses a new kpiTextValueClasses (wrap-break-word, no nowrap) so a 40-character name wraps inside the card as the UI-SPEC \"Long KPI value\" paragraph requires. Numbers and counts keep the one-line look."
  - "The e2e list helpers now match the list route by pathname, because the KPI route sits under the same prefix and the page reads both."

requirements-completed: [CEXP-03]

coverage:
  - id: D1
    description: "Staff see This month, Last month and Top category above the toolbar, with the server's month names, totals, entry count, top category and share; the browser never sums, counts or rounds them (CEXP-03, D-24)"
    requirement: CEXP-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (month KPIs)"
        status: pass
      - kind: unit
        ref: "web/src/utils/format.test.ts (formatMonthShort), web/src/modules/admin/services/expensesService.test.ts (kpis)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-kpis (5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The KPI row ignores the list filters: a list filter change does not read the KPIs again, and the request carries no parameters"
    requirement: CEXP-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (does not read the KPIs again when a list filter changes; reads the KPIs once, with no parameters)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A month with no expenses shows an empty Top category (EmptyValue, hidden icon plus 'Not set') with 'No expenses this month'; a ₱0.00 total is dimmed by colour; KpiCard empty defaults to false so existing cards and parity are unchanged"
    requirement: CEXP-03
    verification:
      - kind: unit
        ref: "web/src/components/money/money.test.tsx (KpiCard empty and text values), web/src/modules/admin/pages/ExpensesPage.test.tsx (month KPI states)"
        status: pass
      - kind: e2e
        ref: "npm --prefix web run parity -- --grep money --project chromium (10 passed)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Each card shows its skeleton while the KPIs load; a KPI failure replaces the row with the banner and Try Again, which reads only the KPIs, while the list still loads on its own"
    requirement: CEXP-03
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (shows each card as a busy skeleton; replaces the row with Couldn't load this month's totals; Try Again reads only the KPIs again)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The KPI row looks right in both themes at 390, 820 and 1440 px, and a 40-character category name wraps inside an equal-height card"
    verification:
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-kpis (320 px: no sideways scroll, axe)"
        status: pass
    human_judgment: true
    rationale: "The visual look is part of the owner's UI-SPEC Visual Review of E1 (plan 06-19); the long-name backstop is plan 06-18"

duration: 28min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 09: Month KPI row Summary

**The Company Expenses page shows This month, Last month and Top category above the toolbar from the server's Manila-month figures only (month names from the server's month fields), with the OR-4 empty Top category, a dimmed zero total, skeletons, and a KPI failure banner whose Try Again reads only the KPIs.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-10-25T15:53:13Z
- **Completed:** 2026-10-25T16:21:00Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files changed:** 16 (2 created)

## Accomplishments

- **KPI row (tracer):** `ExpenseKpiRow` renders three `KpiCard`s from `GET /company-expenses/kpis`: "This month · {Nov}" with the total and "{n} entries so far" / "1 entry so far" / "No entries yet", "Last month · {Oct}" with "Full month", and "Top category · {Nov}" with the name and "{₱500.00} · {71}% of this month". The grid is `.s-g3`: three columns, two on tablet, one on phones.
- **Server months only:** `formatMonthShort('2026-11-01')` gives "Nov" through a UTC formatter and a real-date check (null for an invalid string). A November fixture on an October device date proves the label is the server's. The KPI query key has no list params, so no filter change reads it again.
- **Empty, zero, loading, error:** `KpiCard` gained `empty` (EmptyValue in the dimmed zero look, `value` ignored). A null top category shows it with "No expenses this month". A ₱0.00 total is dimmed by the existing D-39 rule. While loading each card is a busy skeleton with the base label. A failure shows `ErrorState` (align start) "Couldn't load this month's totals." with Try Again, and the list loads on its own.
- **Long names:** a text KPI value now wraps at word boundaries (`kpiTextValueClasses`), as the UI-SPEC "Long KPI value" paragraph requires.

## Task Commits

1. **Task 1: Tracer, the KPI row from the server (CEXP-03, D-24)**
   - RED `a997c61` (test)
   - GREEN `6c3b2c6` (feat)
2. **Task 2: Empty month, zero total, loading and KPI failure (OR-4, D-39)**
   - RED `90f5c51` (test)
   - GREEN `3ceeb93` (feat)

**Plan metadata:** the `docs(06-09)` commit that follows this file.

### TDD gate compliance

RED then GREEN commit pairs exist for both tasks. No REFACTOR commits were needed. The `gsd_run check tdd-red-evidence` classifier reads JUnit from the MTP runner and does not apply to Vitest or Playwright, so the evidence is the quoted run with the semantic assessment.

- **Task 1 RED:** `22 failed | 197 passed (219)` across the three files. The failures were exactly the planned targets: every `formatMonthShort` case (`formatMonthShort is not a function`), both `expensesService.kpis` cases (`service.kpis is not a function`), and the seven `month KPIs` page cases (`Unable to find an element with the text: This month · Nov`). Semantic assessment: each target ran and failed on the missing code, not on setup; the 197 existing tests still passed with the new default KPI route in the fixtures.
- **Task 2 RED:** `7 failed | 104 passed (111)`. Failures: `expected 'Supplies' to be 'Not set'` and `expected '₱12,345.00' to be 'Not set'` (empty ignored), the missing `kpiTextValueClasses` (`Cannot read properties of undefined (reading 'split')`), and four page cases (`Unable to find ... Top category · Oct`, `... This month`, `... Couldn't load this month's totals.` twice). The "dims a ₱0.00 month total" test and the two "unchanged when not empty" and axe tests passed at once because the D-39 rule and the default already exist; they are kept as characterization tests. Semantic assessment: every failure names the planned missing behavior.

## Verification evidence

- Task 1 verify: `npm run test -- --run src/utils/format.test.ts src/modules/admin/services/expensesService.test.ts src/modules/admin/pages/ExpensesPage.test.tsx` gave `Test Files 3 passed (3) / Tests 219 passed (219)`. `npm --prefix web run e2e -- --grep @expenses-kpis` gave `5 passed (37.7s)`. The 06-04 and 06-07 specs still pass with the KPI row and the pathname-matching helpers: `--grep "@expenses-list|@expenses-filters"` gave `15 passed (1.3m)`.
- Task 2 verify: `src/components/money/money.test.tsx` plus `ExpensesPage.test.tsx` gave `Test Files 2 passed (2) / Tests 111 passed (111)`.
- Plan verification: `npm --prefix web run verify` exited 0: typecheck (three programs), `eslint . --max-warnings 0`, `prettier --check .`, `Test Files 193 passed (193) / Tests 5612 passed (5612)` with the coverage gates, both builds with the bundle budgets, `License gate passed.` and `THIRD-PARTY-NOTICES.txt is up to date (28 packages).`
- Parity (KpiCard changed): `npm --prefix web run parity -- --grep money --project chromium` gave `10 passed (16.7s)`. After the last code commit, `--grep "@expenses-kpis|@expenses-list"` gave `15 passed (1.3m)`.
- Acceptance: `formatMonthShort` in format.ts 1, "entries so far" in expensesCopy.ts 1, `@expenses-kpis` in docs/web/e2e.md 1, `SPEC-GAP: KpiCard empty` in KpiCard.tsx 1, "No expenses this month" in expensesCopy.ts 1.
- Tracer gate (end-of-phase mode, automated-only verify): the Task 1 verify was re-run after the GREEN commit and passed, so expansion went ahead.

## Decisions Made

- The row is a component of its own (`ExpenseKpiRow`); the page only places it.
- The failure banner reuses `ErrorState` with the `things` form, so the title is exactly the approved "Couldn't load this month's totals." and the body is the shared reassurance line.
- Text KPI values wrap (`kpiTextValueClasses`); numbers and counts keep the one-line look. No parity scenario carries a text value, and the money parity group still matches.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] A long Top category name would run past the card**
- **Found during:** Task 2 (reading `kpiValueClasses`, which is `whitespace-nowrap`)
- **Issue:** The UI-SPEC "Long KPI value" paragraph says a category name of up to 40 characters wraps at word boundaries and never truncates. The shared recipe forces one line, so "Government contributions" at 40 px would overflow the card and cause sideways scroll at 320 px. No plan owns the implementation (06-18 only checks it).
- **Fix:** Added `kpiTextValueClasses` (same look, `wrap-break-word` instead of `whitespace-nowrap`), used by `KpiCard` for string values that are not `empty`. Updated the existing "dims a text value" cases to expect the text recipe.
- **Files modified:** web/src/components/money/money.recipe.ts, web/src/components/money/KpiCard.tsx, web/src/components/money/money.test.tsx
- **Verification:** new unit tests; money parity group 10 passed; `verify` exit 0.
- **Committed in:** 3ceeb93

**2. [Rule 3 - Blocking] The e2e list helpers matched the KPI response too**
- **Found during:** Task 1 (planning the e2e): `openList` and `listAnswer` waited for any response whose URL contains `/api/v1/company-expenses`, which now also matches `/kpis`, so the 06-04 and 06-07 specs would have parsed the wrong body.
- **Fix:** Both helpers use `isListUrl` (pathname equals `/api/v1/company-expenses`).
- **Files modified:** web/e2e/expenses.spec.ts
- **Verification:** `@expenses-list` and `@expenses-filters` 15 of 15 pass.
- **Committed in:** a997c61

### Plan wording notes

- The plan's files list has no component file; the row lives in `web/src/modules/admin/components/ExpenseKpiRow.tsx` and the hook in `hooks/useExpenseKpisQuery.ts` (listed). `expenses.recipe.ts` gained `expensesKpiRowClasses` and `money.recipe.ts` gained `kpiTextValueClasses`; neither is in the plan's file list.
- `expensesBackend` in the fixtures now also answers the KPI route, like the category route, so the existing page tests need no change.

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 blocking)
**Impact on plan:** No scope change beyond the wrap class, which the UI-SPEC already required. No shared look changed for numbers, counts or the existing parity scenarios.

## Issues Encountered

- A first attempt to append tests with an inline Python script failed on shell quoting before writing anything (nothing changed); the edits were redone with the Edit tool.
- A scratch copy of the root-pin guard was first written under the system temp folder and moved to the session scratchpad straight away; no project file was touched.

## Known Stubs

None. Every figure on the three cards comes from the KPI response. The cards have no stub or placeholder data.

## Threat Flags

None. T-06-30 (browser-side recomputation drifting from the server) is mitigated: the row formats server values only and the unit and e2e tests compare the rendered text with the response. The category name is rendered as text. T-06-SC: no package was installed.

## User Setup Required

None.

## Owner items

None new for the backlog. The wrap of long category names is the Visual Review item already planned in 06-18 and 06-19.

## Next Phase Readiness

- Plans 06-12 to 06-16 (add, edit, delete, restore) must invalidate `expenseKpisKey` (exported from `useExpenseKpisQuery.ts`) together with `expensesKey` after every expense mutation, as the UI-SPEC Freshness row requires.
- Plan 06-18 can reuse `ExpenseKpiRow`, `expenseKpis` and `kpisBackend` for the Phase 6 showcase and the long-text backstop.
- No blockers.

## Self-Check: PASSED

All created files exist on disk (`ExpenseKpiRow.tsx`, `useExpenseKpisQuery.ts`); the four task commits (`a997c61`, `6c3b2c6`, `90f5c51`, `3ceeb93`) are ancestors of HEAD; `npm --prefix web run verify` exited 0 and the e2e passed 5 of 5 and 15 of 15.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
