---
phase: 06-company-expenses
plan: 07
subsystem: web
tags: [react, list, filters, url-state, nuqs, zod, msw, playwright, a11y]
created: "2026-10-25T10:15:00-05:00"
updated: "2026-10-25T10:15:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: the Company Expenses page, useExpensesListParams (page, size), expensesService.list with q, category, from and to, expenseFixtures and the @expenses-list e2e (plan 06-04); GET /api/v1/expense-categories (plan 06-01)
provides:
  - Search, Category, From and To in the Company Expenses toolbar, all in the URL, with Search, Category and Dates chips
  - guidParser in lib/url-state/parsers and the date pair rule in useExpensesListParams
  - expenseCategoriesService (list), useExpenseCategoriesQuery (key 'expense-categories') and ExpenseCategorySelect (filter mode)
  - expensesSchemas.ts with the date range schema (OR-3) and expenseRangeErrors
  - No matches with Clear Filters (keeps Rows per page) and the @expenses-filters e2e
affects: [06-09, 06-12, 06-14, 06-16, 06-18]

actuals:
  tokens: 19300
  tasks: 3
  commits: 6
plan_head_before: 94ed15aef137baf3be706093f7ba3d7317a87bb9
plan_head_after: 057fe5435ca260ee4afabbc724b2da16bee92bba

tech-stack:
  added: []
  patterns:
    - "A list whose URL holds a date pair wraps its createListParams hook: a broken pair (one date, an invalid date, from after to) reads as no dates at once and is removed with one replace"
    - "The date inputs show the range in use: the URL pair, else the window the server resolved; they write the URL only when the draft is a valid pair"
    - "A category id the loaded list does not hold falls back to All categories with one replace; while the list loads the chip reads Loading categories"
    - "expensesBackend in the fixtures also answers the category list; a test that cares calls categoriesBackend after it"

key-files:
  created:
    - web/src/modules/admin/services/expenseCategoriesService.ts
    - web/src/modules/admin/services/expenseCategoriesService.test.ts
    - web/src/modules/admin/hooks/useExpenseCategoriesQuery.ts
    - web/src/modules/admin/components/ExpenseCategorySelect.tsx
    - web/src/modules/admin/components/ExpenseCategorySelect.test.tsx
    - web/src/modules/admin/components/ExpensesDateRange.tsx
    - web/src/modules/admin/expensesSchemas.ts
    - web/src/modules/admin/expensesSchemas.test.ts
  modified:
    - web/src/lib/url-state/parsers.ts
    - web/src/lib/url-state/parsers.test.ts
    - web/src/modules/admin/hooks/useExpensesListParams.ts
    - web/src/modules/admin/hooks/useExpensesListParams.test.tsx
    - web/src/modules/admin/pages/ExpensesPage.tsx
    - web/src/modules/admin/pages/ExpensesPage.test.tsx
    - web/src/modules/admin/expensesCopy.ts
    - web/src/test/expenseFixtures.ts
    - web/e2e/expenses.spec.ts
    - docs/web/e2e.md

key-decisions:
  - "The pair rule lives in a thin wrapper around createListParams, not in the shared factory: the shared factory stays generic, and the wrapper hands back null dates at once so no request is sent with half a range."
  - "Editing only From (or only To) while the default window is shown applies at once as a custom range, because the other input holds the server's window date and the pair is then valid. A half-filled range arises only when a date is cleared or invalid."
  - "An empty date counts as not real: it shows 'Enter a real date.' (the UI-SPEC gives no separate required message for E1)."
  - "ExpenseCategorySelect types its props as mode 'filter' only. Picker mode and its props arrive with plan 06-12, which will widen the type, so no unbuilt branch sits in the file."

patterns-established:
  - "Date inputs that follow the URL or the server window use the 'seen' adjustment during render (as AuditCustomRange does), so Back, a cleared chip and the window arriving all refresh the inputs"

requirements-completed: [CEXP-01]

coverage:
  - id: D1
    description: "Staff search the expense list by description or staff name; the search is trimmed, capped at 100, written to the URL after 300 ms with one replace, and shown as a Search chip (CEXP-01, WEB-10)"
    requirement: CEXP-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/hooks/useExpensesListParams.test.tsx (useExpensesListParams search)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (search)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-filters (5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The Category filter lists every category in the server's order with retired ones as '(retired)', is disabled while loading, and falls back to All categories for an unknown id (D-11, D-15)"
    requirement: CEXP-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ExpenseCategorySelect.test.tsx, web/src/modules/admin/pages/ExpensesPage.test.tsx (category filter)"
        status: pass
      - kind: unit
        ref: "web/src/lib/url-state/parsers.test.ts (guidParser), web/src/modules/admin/services/expenseCategoriesService.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "From and To show the server's window and write nothing until a valid pair is typed; a half-filled, invalid or reversed range is not applied and shows its message; a broken pair in the URL is dropped with one replace; the device clock is never read (D-23, OR-3)"
    requirement: CEXP-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/expensesSchemas.test.ts, web/src/modules/admin/hooks/useExpensesListParams.test.tsx (dates), web/src/modules/admin/pages/ExpensesPage.test.tsx (date range)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-filters"
        status: pass
    human_judgment: false
  - id: D4
    description: "A filtered empty result shows No matches with Clear Filters, which clears Search, Category and Dates and keeps Rows per page; Back and a shared link reopen the same filtered view (WEB-10)"
    requirement: CEXP-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (no matches and Clear Filters)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-filters (search, page 2 and Back, category, range, leave and Back, Clear Filters; axe at each step; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The toolbar with four controls and three chips fits a 320 px phone and looks right in both themes"
    verification:
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-filters (pixel and iphone projects: functional and axe only)"
        status: pass
    human_judgment: true
    rationale: "The look at 320, 390, 820 and 1440 px in Blush and Espresso is part of the owner's UI-SPEC Visual Review of E1; the 320 px chip backstop is plan 06-18"

duration: 28min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 07: Company Expenses filters Summary

**Staff narrow the expense list by search, category (retired ones marked) and a custom date range that applies only when valid, all in the URL, so Back, refresh and a shared link reopen the same filtered view; Clear Filters empties them in one press and keeps Rows per page.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-10-25T14:46:53Z
- **Completed:** 2026-10-25T15:14:32Z
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD)
- **Files:** 18 changed (8 created)

## Accomplishments

- **Search (tracer):** the toolbar's Search ("Description or staff name", capped at 100) writes `q` after 300 ms with one replace, the query keys on the settled text, and a Search chip clears it.
- **Category:** `ExpenseCategorySelect` in filter mode lists every category from `GET /api/v1/expense-categories` in the server's order, retired ones as "{name} (retired)", disabled with "Loading categories…" while loading. `guidParser` keeps only dashed GUIDs. An id the loaded list does not hold falls back to All categories with one replace; while the list loads the chip reads "Category: Loading categories…" and nothing is rewritten.
- **Dates:** `ExpensesDateRange` shows the URL pair, else the server's window, and writes both dates only when the zod range schema passes ("Enter a real date.", "The start date must be on or before the end date."). Until then the list keeps the last applied range. `useExpensesListParams` reads `from` and `to` only as a pair: a lone date, an invalid date or from after to drops both with one replace (measured: one `onUrlUpdate`).
- **Chips and Clear Filters:** "Search: {q}", "Category: {name}", "Dates: {from} to {to}" (none for the default window). A filtered empty result is "No matches" naming the search and filters; Clear Filters clears Search, Category and Dates and keeps `size`.
- **Fixtures:** `expensesBackend` also answers the category list (ten seeded names and tones A to Z with Others last, plus one retired extra); `categoriesBackend` overrides it.

## Task Commits

1. **Task 1: Tracer, search in the URL (CEXP-01, WEB-10)**
   - RED `fc451da` (test)
   - GREEN `75a8b16` (feat)
2. **Task 2: Category and date filters (D-11, D-15, D-23, OR-3)**
   - RED `f8be1d8` (test)
   - GREEN `1395f31` (feat)
3. **Task 3: Clear Filters, no matches, Back restores the view (WEB-10)**
   - RED `2c72174` (test)
   - GREEN `057fe54` (feat)

**Plan metadata:** the `docs(06-07)` commit that follows this file.

### TDD gate compliance

RED then GREEN commit pairs exist for all three tasks. No REFACTOR commits were needed. The `gsd_run check tdd-red-evidence` classifier reads JUnit output of the MTP test runner and does not apply to Vitest or Playwright, so the evidence is the quoted run with the semantic assessment.

- **Task 1 RED:** 12 failed, 26 passed. The failing tests were the planned targets: `expected { page: 1, size: 20 } to deeply equal { page: 1, size: 20, q: null }`, the missing `q` behaviors in the hook, and `Unable to find ... searchbox "Search"` on the page. Semantic assessment: each target ran and failed on the missing search, not on setup.
- **Task 2 RED:** 44 failed plus three files that did not load (`Failed to resolve import "./expensesSchemas"`, `"./ExpenseCategorySelect"`, `"./expenseCategoriesService"`). Failures were `Cannot read properties of undefined (reading 'parse')` for the missing `guidParser`, the broken-pair and category assertions, and missing From, To and Category controls. Semantic assessment: all name the planned missing code.
- **Task 3 RED:** unit run `4 failed | 38 passed` (all four `Unable to find role="heading" and name "No matches"`; the dim test passed at once because 06-04 already wired the refetch dim, so it is a characterization test). E2E run on chromium: the whole flow (search, page 2 and Back, category, range, leave and Back, axe) ran green up to `expect(getByRole('heading', { name: 'No matches' })).toBeVisible()` failing with "element(s) not found". Semantic assessment: it failed on exactly the planned missing state.

## Verification evidence

- Task 1 verify: `npm --prefix web run test -- --run src/modules/admin/hooks/useExpensesListParams.test.tsx src/modules/admin/pages/ExpensesPage.test.tsx` gave `Test Files 2 passed (2) / Tests 38 passed (38)`.
- Task 2 verify (the six files): `Test Files 6 passed (6) / Tests 182 passed (182)`. `eslint --max-warnings 0` on `src/modules/admin src/lib/url-state src/test` printed nothing; `npm run typecheck` exited 0 (three programs).
- Task 3 verify: `ExpensesPage.test.tsx` gave `Test Files 1 passed (1) / Tests 42 passed (42)`. `npm --prefix web run e2e -- --grep @expenses-filters` gave `5 passed (39.5s)`. A second run `--grep "@expenses-list|@expenses-filters"` gave `15 passed (1.3m)` (the 06-04 specs still pass with the new toolbar, on the shared database).
- Plan verification: `npm --prefix web run verify` exited 0: `eslint . --max-warnings 0`, types, `Test Files 193 passed (193) / Tests 5579 passed (5579)` with the coverage gates, bundle budgets, `License gate passed.` and `THIRD-PARTY-NOTICES.txt is up to date (28 packages).` `npm --prefix web run format:check`: `All matched files use Prettier code style!`
- Acceptance: `grep -c guidParser parsers.ts` 1; `grep -c "jitless: true" expensesSchemas.ts` 1; `grep -c "(retired)" expensesCopy.ts` 1; `grep -c "Description or staff name" expensesCopy.ts` 1; `@expenses-filters` in the spec 2 and in docs 1; `grep -c searchParser useExpensesListParams.ts` was 2 in Task 1 (import line and use) and the hook now imports it once and uses it once, see plan wording notes.
- Tracer gate (end-of-phase mode, automated-only verify): the Task 1 verify was re-run after the GREEN commit and passed, so expansion went ahead.

## Decisions Made

- The pair rule is a wrapper hook, not a change to `createListParams`, so the 40+ users of the shared factory are untouched and its own tests need no change.
- With the default window shown, typing a valid date into only From (or only To) is a valid pair (the other input holds the server's window date), so it applies as a custom range. The "typing only From" behavior in the plan is tested by clearing To first, which is the real half-filled case.
- An empty date shows "Enter a real date." (UI-SPEC lists no separate required message for E1).
- `ExpenseCategorySelect`'s `mode` is typed as `'filter'` only for now; plan 06-12 widens it with the picker props.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] A test expected the wrong URL key order**
- **Found during:** Task 2 GREEN (`keeps the other filters when it drops a broken pair`)
- **Issue:** The test expected `?category=...&q=rent`; the shared `orderSearchParams` puts `q` first, so the URL is `?q=rent&category=...`. The behavior (one replace, broken pair dropped, other filters kept) was right.
- **Fix:** Corrected the expected string in the test.
- **Files modified:** web/src/modules/admin/hooks/useExpensesListParams.test.tsx
- **Commit:** 1395f31

**2. [Rule 1 - Bug] A no-matches test needed enough rows for Rows per page to show**
- **Found during:** Task 3 GREEN
- **Issue:** The Clear Filters test asserted the "Rows per page" select after clearing, but Pagination hides it for a 2-row list.
- **Fix:** The unfiltered fixture answers a total of 120 at size 50.
- **Files modified:** web/src/modules/admin/pages/ExpensesPage.test.tsx
- **Commit:** 057fe54

**3. [Rule 1 - Bug] The e2e Search locator matched two boxes**
- **Found during:** Task 3 RED (all five projects failed with a strict-mode violation: the admin top bar has its own "Search orders, customers, teams…" box named Search)
- **Fix:** The spec finds the list's box by its placeholder "Description or staff name" before the RED commit.
- **Files modified:** web/e2e/expenses.spec.ts
- **Commit:** 2c72174

### Plan wording notes

- The plan's files list has no component for the From and To inputs; they live in `web/src/modules/admin/components/ExpensesDateRange.tsx` (the Audit Log has its own `AuditCustomRange`), so the page file stays readable.
- Task 1's acceptance says `grep -c "searchParser"` on the hook is 1; the import and the use are two lines, so it is 2. The behavior it guards is in place.
- `Clear Filters` is exercised in the e2e by searching for a word that matches nothing, which is the only way to reach the button.

---

**Total deviations:** 3 auto-fixed (3 test-side bugs), 3 plan wording notes
**Impact on plan:** No scope change. No shared primitive changed.

## Issues Encountered

- The first `node -e` edit with backticks inside a double-quoted shell string expanded and wrote empty template strings into a test; the lines were fixed with the Edit tool before any run or commit.
- A stray command of mine tried to create and delete a scratch file outside the project; the safety check blocked the removal and nothing was created (checked: no such file exists).

## Known Stubs

None. Every control is wired to the URL and the server. The KPI row, Add Expense and the row actions are later plans and are not drawn.

## Threat Flags

None. T-06-23 (crafted URL params) is covered by the allow-list parsers (`guidParser`, `parseAsBusinessDate`, `searchParser`) and the pair rule, each tested to fall back with one replace; the values reach only query parameters and text nodes, never an href or redirect. T-06-24 is accepted as planned (analytics sends the path only).

## User Setup Required

None.

## Owner items

None new for the backlog. The chip wording "Category: Unknown category" (shown only when the category list fails to load and the URL holds an id) is a SPEC-GAP string for the owner's copy review; the existing "Phase 6 copy review (05 D-48)" item covers it.

## Next Phase Readiness

- Plan 06-12 adds picker mode to `ExpenseCategorySelect` (widen the `mode` type and props) and the Add Expense button; it can reuse `useExpenseCategoriesQuery` and `categoriesBackend`.
- Plan 06-09 (KPI row) sits above the toolbar and ignores these filters.
- Plan 06-16 (Deleted Expenses) reuses `guidParser`, `ExpenseCategorySelect` and the Search and Category chips.
- Plan 06-18 adds the 320 px chip backstop and the signed-in sweep.

## Self-Check: PASSED

All created files exist on disk; the six task commits (`fc451da`, `75a8b16`, `f8be1d8`, `1395f31`, `2c72174`, `057fe54`) are ancestors of HEAD; `npm --prefix web run verify` exited 0 and the e2e passed 5 of 5 and then 15 of 15.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
