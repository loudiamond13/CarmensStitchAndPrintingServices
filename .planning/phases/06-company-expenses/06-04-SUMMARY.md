---
phase: 06-company-expenses
plan: 04
subsystem: web
tags: [react, list, paging, url-state, msw, playwright, badge-tones, a11y]
created: "2026-10-25T09:05:00-05:00"
updated: "2026-10-25T09:05:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: GET /api/v1/company-expenses with items, total, periodTotal, from, to, today and canEdit, the generated types, createExpense for e2e (plan 06-03)
provides:
  - /admin/expenses is the real Company Expenses page for both roles (the dev preview and the placeholder are gone)
  - expensesService.list, useExpensesListParams (page, size), useExpensesQuery and EXPENSES_COPY
  - A footer that shows the server's count, window and period total, and an Upcoming badge judged by the server's today
  - CATEGORY_TONES, CATEGORY_TONE_LABEL, isCategoryTone and CategoryBadge (the stored-tone model of D-08 and D-13)
  - ResponsiveTable footerLayout (a spanning footer cell, its own phone label) and emptyTitle
  - web/src/test/expenseFixtures.ts (list builders, an MSW handler, long-text fixtures) and the @expenses-list e2e
affects: [06-05, 06-06, 06-07, 06-08, 06-09, 06-12, 06-14, 06-16, 06-18]

actuals:
  tokens: 23600
  tasks: 2
  commits: 5
plan_head_before: 73967b78140bd297acda37fd226b8f65a4fab837
plan_head_after: ef64962747c10f0acfdda9dcbaa188b7d7de5932

tech-stack:
  added: []
  patterns:
    - "A list page keys its query on useSettledListParams and shows only server figures: count, period total, window and the business today all come from the answer"
    - "A ResponsiveTable footer cell may span columns and carry its own phone label (footerLayout)"
    - "E2E specs on the shared CSPS_E2E database judge every row against the response it was drawn from, never by page position, because earlier runs keep their rows"
    - "A stored badge tone is read through isCategoryTone; anything else renders neutral"

key-files:
  created:
    - web/src/modules/admin/services/expensesService.ts
    - web/src/modules/admin/services/expensesService.test.ts
    - web/src/modules/admin/hooks/useExpensesListParams.ts
    - web/src/modules/admin/hooks/useExpensesListParams.test.tsx
    - web/src/modules/admin/hooks/useExpensesQuery.ts
    - web/src/modules/admin/expensesCopy.ts
    - web/src/modules/admin/pages/ExpensesPage.tsx
    - web/src/modules/admin/pages/ExpensesPage.test.tsx
    - web/src/modules/admin/components/CategoryBadge.tsx
    - web/src/modules/admin/components/CategoryBadge.test.tsx
    - web/src/modules/admin/components/expenses.recipe.ts
    - web/src/test/expenseFixtures.ts
    - web/e2e/expenses.spec.ts
  modified:
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/components/lists/ResponsiveTable.tsx
    - web/src/components/lists/ResponsiveTable.test.tsx
    - web/src/components/lists/index.ts
    - web/src/components/status/tones.ts
    - web/src/components/status/index.ts
    - web/src/components/status/status.test.tsx
    - web/src/components/index.ts
    - web/src/components/index.test.ts
    - web/src/utils/csps.ts
    - web/src/dev/scenarios/groups/status.ts
    - web/src/layouts/AdminLayout.test.tsx
    - web/e2e/admin.spec.ts
    - web/e2e/sweep.ts
    - docs/web/e2e.md

key-decisions:
  - "ResponsiveTable gets two additive props instead of a local table: footerLayout (a footer cell can span columns and have its own phone label) and emptyTitle. The UI-SPEC footer spans Date to Description and reads Total on phones; the shared table had one footer cell per column."
  - "The Upcoming badge was built in Task 1, not Task 2, because the Task 1 e2e verify asserts it. Task 2's Upcoming tests are therefore characterization tests."
  - "CategoryBadge lets a long name wrap by passing important utilities (h-auto!, whitespace-normal!) through Badge's className, because Badge is one line and 24px tall. The UI-SPEC says the badge wraps or grows without overflowing its cell."
  - "No avatar is drawn for a System recorder: a letter in a circle would read as a person."

patterns-established:
  - "Page past the last page is clamped once fresh data says so (as the Users roster does)"
  - "Avatar in a cell is wrapped in aria-hidden, so the name is announced once"

requirements-completed: [CEXP-01, CEXP-04, CEXP-05]

coverage:
  - id: D1
    description: "Both roles open /admin/expenses and see the server's rows with the bold date, category, description, amount, Paid by and Recorded by, paged 20 by default with Rows per page, in the URL (CEXP-01, D-25, WEB-10)"
    requirement: CEXP-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (the page, paging in the URL)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/hooks/useExpensesListParams.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/routes.test.tsx (Company Expenses for both roles; dev routes do not shadow it)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-list (10 of 10 in five projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "The footer and the result bar show the server's count, window and period total across every page; the browser adds and computes nothing (Core Value)"
    requirement: CEXP-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (footer shows the server's period total and window, 1 expense wording)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-list (footer equals periodTotal of the call it came from, on page 1 and page 2)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A row dated after the server's today shows the info Upcoming badge with the clock icon; the device clock is never read (D-23)"
    requirement: CEXP-01
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (how each row reads)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-list (every row's Upcoming equals date > the response's today)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Paid by and Recorded by show Avatar 24 and ActorName, with (former staff) for a deleted user and System for no recorder (CEXP-04, CEXP-05)"
    requirement: CEXP-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (how each row reads)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Categories render through CategoryBadge in the stored tone; an unknown tone is neutral; CATEGORY_TONES and CATEGORY_TONE_LABEL replace the fixed expense tone table, and the order expense categories are untouched (D-08, D-13, D-16)"
    requirement: CEXP-01
    verification:
      - kind: unit
        ref: "web/src/components/status/status.test.tsx, web/src/components/index.test.ts, web/src/modules/admin/components/CategoryBadge.test.tsx"
        status: pass
    human_judgment: false
  - id: D6
    description: "First load, load error with Try Again, and the empty default window each have their approved look, with no axe findings in each state"
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (the list states)"
        status: pass
    human_judgment: true
    rationale: "The look of the states was checked in component tests and axe only; the owner screenshot review of E1 (UI-SPEC Visual Review) is still to be done"

duration: 41min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 04: Company Expenses list Summary

**/admin/expenses is the real Company Expenses page for both roles: the server's rows newest first with the stored category tone, Upcoming by the server's today, Paid by and Recorded by with former staff kept by name, paging in the URL, and a footer that shows the server's count, window and period total over every page.**

## Performance

- **Duration:** 41 min
- **Started:** 2026-10-25T13:17:30Z
- **Completed:** 2026-10-25T13:58:33Z
- **Tasks:** 2 (Task 1 tracer, Task 2 TDD)
- **Files:** 29 changed (13 created)

## Accomplishments

- Both roles reach the real page. The placeholder route and the dev preview of `/admin/expenses` are gone, so the e2e bundle reaches the guarded page. The page asks the server for the page and size only; the window, the totals and "today" come back in the answer.
- The footer reads "{n} expenses · {from} to {to}" across Date, Category and Description, with the server's `periodTotal` in the Amount cell (phone label "Total") and the caption that says the total covers every page. Nothing in the browser adds amounts.
- Rows read at a glance: the bold en-PH date with an Upcoming badge (info tone, clock icon) when the date is after the server's today, the category in its stored tone, Avatar 24 with the name, " (former staff)" for a deleted user, and System when there is no recorder.
- The fixed expense tone table is replaced by `CATEGORY_TONES` (neutral, accent, info, mockup, warning, success), their words (Taupe, Orange, Blue, Plum, Amber, Green) and `isCategoryTone`. The unused expense category union, its list and the `CompanyExpense` interface are removed from `utils/csps.ts`. `OrderExpenseCategory` and `ORDER_EXPENSE_CATEGORIES` are untouched (D-16).
- States: a skeleton table announcing "Loading expenses…", "Couldn't load expenses." with Try Again that reads the list again, and "No expenses recorded" with the window dates when the default window is empty. The Add Expense action arrives with plan 06-12.
- `web/src/test/expenseFixtures.ts` gives later plans list builders, an MSW handler that records requests, and 200-character and 100-character fixtures.

## Task Commits

1. **Task 1: Tracer, a signed-in staff member opens Company Expenses and sees the server's rows, paged, with the period total (CEXP-01, D-25)**
   - RED `dd010ba` (test)
   - GREEN `6bbaee9` (feat)
   - E2E fix `e2c3c29` (fix, see Deviations)
2. **Task 2: Each row reads at a glance (D-08, D-13, D-16, D-23, CEXP-04, CEXP-05)**
   - RED `945c15f` (test)
   - GREEN `ef64962` (feat)

**Plan metadata:** the `docs(06-04)` commit that follows this file.

### TDD gate compliance

RED then GREEN commit pairs exist for both tasks (`test(06-04)` before `feat(06-04)`). No REFACTOR commits were needed. The formal `gsd_run check tdd-red-evidence` classifier reads JUnit output of the MTP test runner and does not apply to Vitest, so the evidence below is the quoted run with the semantic assessment.

- **Task 1 RED:** the three new test files failed to load (`Failed to resolve import "./expensesService"`, `"./useExpensesListParams"`, `"@/modules/admin/pages/ExpensesPage"`: the modules did not exist) and 3 of 24 route tests failed (`Unable to find role="heading" and name "Company Expenses"`, `Unable to find role="table" and name "Company expenses"`: the route showed the placeholder). Semantic assessment: the targets ran and failed on the planned missing page.
- **Task 2 RED:** 7 tests failed: `expected undefined to deeply equal [ 'neutral', 'accent', 'info', … ]` (CATEGORY_TONES in the barrel and in status.test, twice), `CATEGORY_TONES is not iterable`, the category tone test (`expected false to be true`: the cell showed a plain name), the former-staff and System row test (`expected 'PGPaolo Garcia'`: a test-side text mistake fixed before the RED commit's final form, see below), and `Unable to find role="heading" and name "No expenses recorded"`; `CategoryBadge.test.tsx` failed to load (`Failed to resolve import "./CategoryBadge"`). Semantic assessment: the failing targets name exactly the missing tones, badge and empty state. The Upcoming tests passed at once because Task 1 had to build the badge for its e2e (characterization).

## Verification evidence

- Task 1 verify: `npm --prefix web run test -- --run src/modules/admin/pages/ExpensesPage.test.tsx src/modules/admin/services/expensesService.test.ts src/modules/admin/hooks/useExpensesListParams.test.tsx src/modules/admin/routes.test.tsx` gave `Test Files 6 passed (6) / Tests 56 passed (56)` (with the no-long-dash and source-layout node tests). `npm --prefix web run e2e -- --grep @expenses-list` gave `10 passed (52.8s)`.
- Task 2 verify: the four files gave `Test Files 4 passed (4) / Tests 153 passed (153)`. `npm --prefix web run verify` gave exit 0: lint (`eslint . --max-warnings 0`), types, `Test Files 190 passed (190) / Tests 5515 passed (5515)`, the coverage gates, bundle budgets, `License gate passed.` and `THIRD-PARTY-NOTICES.txt is up to date (28 packages).`
- After the e2e fix: `npm --prefix web run e2e -- --grep @expenses-list` twice in a row on the shared database, `10 passed (50.2s)` and `10 passed (59.3s)`. An earlier run of `--grep "@expenses-list|@admin|@keyboard"` gave `101 passed` and the 4 failures that led to the fix (see Deviations).
- Acceptance greps: `ExpensesPage` in routes.tsx 1; no `path: 'expenses'` in `devRoutes` (the one entry is in `adminRoutes`); `@expenses-list` in the spec 2 and in docs 1; `periodTotal` in the page 1; `git grep -c EXPENSE_TONE -- web/src` prints nothing; `CATEGORY_TONES` in tones.ts 4; `ORDER_EXPENSE_CATEGORIES` in csps.ts 2; `SPEC-GAP: CategoryBadge` 1.
- Final `npm --prefix web run lint` and `format:check` clean; `typecheck` clean (three programs).

## Decisions Made

- `ResponsiveTable` got `footerLayout` and `emptyTitle` as additive, tested props. The UI-SPEC footer spans Date to Description and reads Total on phones, and the empty title is "No expenses recorded", neither of which the shared table could do. Every existing caller is unchanged.
- No avatar for a System recorder, so the letter does not suggest a person.
- The category badge wraps a long name by marking height and no-wrap utilities important through `className` (the UI-SPEC says the badge wraps or grows; `Badge` is one line, 24px). This is a small restyle of a shared primitive done in one wrapper, recorded here for the owner's screenshot review.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] ResponsiveTable could not draw the UI-SPEC footer or empty title**
- **Found during:** Task 1
- **Issue:** One footer cell per column, no colspan, one phone label per column; the first-use title was fixed to "No {things} yet".
- **Fix:** Added `footerLayout` (span, label) and `emptyTitle`, with two tests in `ResponsiveTable.test.tsx`; exported `FooterCellLayout`.
- **Files modified:** web/src/components/lists/ResponsiveTable.tsx, ResponsiveTable.test.tsx, index.ts
- **Commit:** 6bbaee9

**2. [Rule 1 - Bug] AdminLayout tests relied on the removed /admin/expenses preview**
- **Found during:** Task 2 (`npm run verify`: 5 failed in `src/layouts/AdminLayout.test.tsx`)
- **Issue:** The dev route tree no longer previews `/admin/expenses`, so the tests that rendered or navigated to it reached the guarded page.
- **Fix:** The section rows and navigation tests use Dashboard and Orders; the Expenses tab-bar "current" check renders `AdminFrame section="expenses"` directly, as the Profile one does.
- **Files modified:** web/src/layouts/AdminLayout.test.tsx
- **Commit:** ef64962

**3. [Rule 1 - Bug] The first @expenses-list e2e depended on a row being on page 1**
- **Found during:** Task 2 (second e2e run on the persistent CSPS_E2E database: 4 of 10 failed, `Locator: ... 'E2E past ...' Expected: 1 Received: 0`)
- **Issue:** Earlier runs keep their rows, so a row dated three days ago fell past the first 20.
- **Fix:** The Manager spec opens 100 a page and compares every row's Upcoming with its date and the response's `today`; it keeps the unique future row on page 1. Two further runs in a row passed.
- **Files modified:** web/e2e/expenses.spec.ts
- **Commit:** e2c3c29

### Plan wording notes

- The plan puts the Upcoming badge in Task 2 but the Task 1 e2e asserts it, so Task 1 builds it and Task 2's Upcoming tests are characterization tests.
- The plan lists no `expenses.recipe.ts`; the looks are class lists (class gate), so they live in one recipe file as `users.recipe.ts` does.
- A first draft of the row test compared the Paid by cell text with `'Paolo Garcia'`; the cell also holds the avatar initials, so it now uses `toContain`. This was corrected before the RED commit.

---

**Total deviations:** 3 auto-fixed (1 blocking, 2 bugs), 3 plan wording notes
**Impact on plan:** No scope change. One shared primitive gained two optional props.

## Issues Encountered

- `evaluateAll` with a string function returned `undefined` in the e2e; `allTextContents()` does the job with no page script.
- A shell heredoc with backticks in a node one-liner expanded a template string and wrote an empty message; it was fixed with the Edit tool before any run.

## Known Stubs

None. The page shows only server data. Its Add Expense, row actions, KPI row and filters are later plans (06-05, 06-07, 06-09, 06-12, 06-14, 06-16) and are not stubbed on screen.

## Threat Flags

None. T-06-16 (stored XSS) is covered by text-only rendering and a test that shows markup in a description, a name and a category name as typed; T-06-17 (crafted page or size) by the allow-list parsers and the replace tests; T-06-18 (preview shadowing the page) by removing the dev entry and the route test with the dev tree.

## User Setup Required

None.

## Owner items

None new. The UI-SPEC Visual Review (screenshots of E1 at 390, 820 and 1440 in both themes) is still the owner's, once the page has its filters and KPIs.

## Next Phase Readiness

- Plan 06-05 (KPIs endpoint) and 06-07 (filters UI) build on this page: `useExpensesListParams` takes q, category, from and to; `ExpensesListQuery` already carries them; `expensesKey` is the root for invalidation.
- Plan 06-12 adds the Add Expense button and the empty-state action; `ResponsiveTable` already takes `emptyAction`.
- Plan 06-18 adds the signed-in sweep of `/admin/expenses` to `sweep.ts` (a comment there says so).

## Self-Check: PASSED

All created files exist on disk; the five task commits (`dd010ba`, `6bbaee9`, `945c15f`, `e2c3c29`, `ef64962`) are ancestors of HEAD; `npm --prefix web run verify` exited 0 and the e2e passed 10 of 10 twice after the fix.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
