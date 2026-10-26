---
phase: 06-company-expenses
plan: 12
subsystem: web
tags: [react, react-hook-form, zod, tanstack-query, msw, playwright, a11y, or-3, or-4]
created: "2026-10-25T12:50:00-05:00"
updated: "2026-10-25T12:50:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: POST /api/v1/company-expenses, GET /api/v1/staff and the category list with the generated types (plans 06-01, 06-02); the Company Expenses page, KPI row, fixtures and e2e helpers (plans 06-04, 06-07, 06-09)
provides:
  - The Add Expense modal (ExpenseModal, add mode) with Date, Category, Description, Amount, Paid by, Notes and the read-only Recorded by
  - PaidBySelect (the staff picker Phase 7 reuses) and the picker mode of ExpenseCategorySelect
  - expenseFormSchema(today): every server rule checked in the browser with the server's own words
  - staffService, useStaffLookupQuery, expensesService.create (one Idempotency-Key per submission)
  - Add Expense in the page header and in the first-use empty state, the "Expense added" toast and its outside-the-filters note
  - expensesDeletedKey, latestExpenseDate, createExpenseBackend, staffBackend and expenseDetail fixtures, and the @expenses-add e2e
affects: [06-13, 06-14, 06-15, 06-16, 06-18, 07]

actuals:
  tokens: 20200
  tasks: 3
  commits: 6
plan_head_before: 43e713ea03cc1ec5e83dfb9d67f464136d9d48df
plan_head_after: 75f65056e447a8dc7bf71d0f5368f242f6f0a518

tech-stack:
  added: []
  patterns:
    - "The form lives in a part that is mounted again on every open (key), so a close discards typed values and a reopen starts from the server's today and the signed-in payer"
    - "The schema is a function of the server's business today; the date limit is counted from that string, never from the device clock"
    - "The amount stays text through the schema (moneyInputError rules plus centavos for the sign and the cap) and becomes a number only in the request builder"
    - "A save invalidates expensesKey, expenseKpisKey and expensesDeletedKey; if the trigger left the page with the list, the header button takes focus"

key-files:
  created:
    - web/src/modules/admin/components/ExpenseModal.tsx
    - web/src/modules/admin/components/ExpenseModal.test.tsx
    - web/src/modules/admin/components/PaidBySelect.tsx
    - web/src/modules/admin/components/PaidBySelect.test.tsx
    - web/src/modules/admin/services/staffService.ts
    - web/src/modules/admin/services/staffService.test.ts
    - web/src/modules/admin/hooks/useStaffLookupQuery.ts
  modified:
    - web/src/modules/admin/components/ExpenseCategorySelect.tsx
    - web/src/modules/admin/components/ExpenseCategorySelect.test.tsx
    - web/src/modules/admin/components/expenses.recipe.ts
    - web/src/modules/admin/expensesCopy.ts
    - web/src/modules/admin/expensesSchemas.ts
    - web/src/modules/admin/expensesSchemas.test.ts
    - web/src/modules/admin/hooks/useExpensesQuery.ts
    - web/src/modules/admin/pages/ExpensesPage.tsx
    - web/src/modules/admin/pages/ExpensesPage.test.tsx
    - web/src/modules/admin/services/expensesService.ts
    - web/src/modules/admin/services/expensesService.test.ts
    - web/src/test/expenseFixtures.ts
    - web/e2e/expenses.spec.ts
    - docs/web/e2e.md

key-decisions:
  - "Add Expense stays aria-disabled until the page knows the server's business today (from the list, else from the month figures); the modal is never given a device-clock date."
  - "Paid by lists the signed-in user first as '{First Last} (you)' only when the staff lookup holds them, then the others in the lookup's order; nobody outside the lookup is offered. A failed lookup disables the field and says so; the default payer (the signed-in user) is still checked by the server."
  - "The outside-the-filters check is a browser-side wording aid: search over description, payer and recorder names (case-insensitive), the chosen category id, and the date against the URL range, else the window the server used."
  - "Enter in Description saves through the form owner of the footer button; user-event does not follow the form attribute, so that case is proved in the real-browser e2e, not in jsdom."

patterns-established:
  - "expensesBackend does not answer the staff route; a test that opens the modal calls staffBackend (and createExpenseBackend to save)"
  - "Server field errors for the expense form are keyed date, categoryId, description, amount, paidByUserId, notes and focus goes to the first in that order"

requirements-completed: [CEXP-02, CEXP-04, CEXP-05]

coverage:
  - id: D1
    description: "Staff add an expense from the page header or the first-use empty state: the centered modal (bottom sheet on phones) with Date (the server's today), Category (active only, nothing chosen), Description, Amount, Paid by (the signed-in user to start), Notes and Recorded by as read-only text; one POST with one Idempotency-Key (CEXP-02, CEXP-04, D-18)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ExpenseModal.test.tsx (E2 add mode, E2 close, reopen and keys)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (Add Expense, Add Expense from the empty list)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-add (5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Paid by offers only the people the staff lookup returns, the signed-in user first as '(you)'; loading and failure states; PaidBySelect is reusable (CEXP-05, D-32)"
    requirement: CEXP-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PaidBySelect.test.tsx"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/services/staffService.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every server rule is checked in the browser first with the server's exact messages (date, 30-day limit from the server today, category, description, amount > 0 and <= 1,000,000.00 with 2 decimals, payer, notes); no request goes out while a rule fails; server field errors land under their fields and win (OR-3, D-19..D-21)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/expensesSchemas.test.ts (expenseFormSchema)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/ExpenseModal.test.tsx (E2 checks before sending, E2 server answers)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-add (amount 0 and 1,000,000.01 refused, no POST)"
        status: pass
    human_judgment: false
  - id: D4
    description: "After a save the dialog closes, focus returns to Add Expense, the list, the KPIs and the deleted list are invalidated, and the toast reads 'Expense added' / '{amount} · {category}' with the outside-the-filters note when the new row does not match the search, category or dates"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (after a save closes the dialog; outside-filters cases)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-add (toast and the new row)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The modal looks right in both themes and fits a 320 px phone (bottom sheet, footer reachable, no sideways scroll)"
    verification:
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-add (320 px: no sideways scroll, Save Expense and Cancel in view, axe)"
        status: pass
    human_judgment: true
    rationale: "The visual look of the E2 modal is part of the owner's UI-SPEC Visual Review (plan 06-19); the e2e proves fit and accessibility only"

duration: 37min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 12: Add Expense Summary

**Any staff member adds a company expense from the page: an Add Expense modal with the staff and category pickers, every server rule checked in the browser first with the server's own words, one Idempotency-Key per submission, and a toast that says when the new row is outside the current filters.**

## Performance

- **Duration:** 37 min
- **Started:** 2026-10-25T17:08:00Z (approx.)
- **Completed:** 2026-10-25T17:46:00Z
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD)
- **Files changed:** 21 (7 created)

## Accomplishments

- **Add modal (tracer):** `ExpenseModal` (add mode) opens from the header "Add Expense" with the server's business today in Date, no category chosen (OQ-9), the signed-in user as payer, Notes (1,000 characters) and Recorded by as a dashed read-only span control. `useSubmission` holds one in-flight request with one `Idempotency-Key`, reused on a retry of the same form. A save closes the modal, returns focus to the trigger, reads `company-expenses`, `company-expense-kpis` and `company-expenses-deleted` again and toasts "Expense added" / "₱640.00 · Supplies".
- **Pickers:** `PaidBySelect` (SPEC-GAP, reused by Phase 7) lists the signed-in user first as "Carmen Reyes (you)" then the lookup's people, and nobody else; "Loading staff…" while loading; the failure line under the field. `ExpenseCategorySelect` gained the picker mode (active only, "Choose a category", the saved retired category kept for 06-14).
- **Rules in the browser (OR-3):** `expenseFormSchema(today)` gives the server's exact messages for date (required, real, up to today + 30 counted from the server's today), category, description (trimmed, 200), amount (text rules: more than ₱0.00, at most ₱1,000,000.00, 2 decimals), payer and notes (trimmed, 1,000, empty becomes null). The amount becomes a number only in the request builder. Server 400 field errors show under their fields and focus goes to the first.
- **First-use and filters:** the empty state offers the same primary "Add Expense" (OQ-14 default A); the toast adds " It's outside the current filters, so it isn't listed." when the saved row does not match the search (description, payer or recorder), the category or the dates (URL range, else the server's window).

## Task Commits

1. **Task 1: Tracer, add an expense from the page (CEXP-02, D-18)**
   - RED `4fc6fac` (test)
   - GREEN `2c0b6d6` (feat)
2. **Task 2: Every rule checked in the browser (OR-3, D-19..D-21, D-32, D-11)**
   - RED `badbaf6` (test)
   - GREEN `26d1a99` (feat)
3. **Task 3: Empty-state add, outside-filters toast, phone fit (CEXP-02, OQ-14)**
   - RED `b80fe6e` (test)
   - GREEN `75f6505` (feat)

**Plan metadata:** the `docs(06-12)` commit that follows this file.

### TDD gate compliance

RED then GREEN commit pairs exist for all three tasks; no REFACTOR commits were needed. The `gsd_run check tdd-red-evidence` classifier reads JUnit from the MTP runner and does not apply to Vitest or Playwright, so the evidence is the quoted run with the semantic assessment.

- **Task 1 RED:** `7 failed | 67 passed (74)` and three files that could not load. Failures were the planned targets: `Failed to resolve import "./ExpenseModal"`, `"./PaidBySelect"`, `"./staffService"` (the three new modules), `service.create is not a function`, `Unable to find an accessible element with the role "button" and name "Add Expense"` (three page cases and the updated empty-state case), and the two picker cases (`expected [ Array(12) ] to deeply equal [ 'Choose a category', …]`, `Unable to find an element with the text: Choose a category.`). Semantic assessment: the missing-import files are load faults by the strict reading (the new modules do not exist yet, which is the planned state); the assertion failures name the planned missing behavior.
- **Task 2 RED:** `24 failed | 18 passed (42)`: 21 schema cases failed with `expenseFormSchema is not a function` (the Task 1 constant was not yet a function of today), and the three modal cases for the 30-day limit, an amount of 0 and the cap failed on missing messages. The other new modal cases (server answers, retry key, axe) passed at once because Task 1 already wired `useSubmission` and `serverFieldMessage`; they are kept as characterization tests. Semantic assessment: every failure names the planned missing rule.
- **Task 3 RED:** `8 failed` before the Enter case was moved to the e2e: six page cases failed on the missing empty-state action (`expected [ …(1) ] to have a length of 2 but got 1`) and the missing note (`Unable to find an element with the text: ₱640.00 · Supplies It's outside the current filters…`). The modal cases (reopen clean, Enter in Notes, no close while saving) passed at once because Tasks 1 and 2 already behave that way; they are kept as characterization tests. The e2e was written in this RED commit and passed 5 of 5 against the GREEN code.

## Verification evidence

- Task 1 verify (also the tracer gate re-run): `Test Files 6 passed (6) / Tests 87 passed (87)`.
- Task 2 verify: `src/modules/admin/expensesSchemas.test.ts` plus `ExpenseModal.test.tsx` passed (26 schema cases).
- Task 3 verify: `src/modules/admin` gave `Test Files 62 passed (62) / Tests 1437 passed (1437)`. `npm --prefix web run e2e -- --grep @expenses-add` gave `5 passed (1.5m)`; after the last commit `--grep "@expenses"` (list, filters, KPIs and add) gave `25 passed (3.1m)`.
- Plan verification: `npm --prefix web run verify` exited 0: typecheck (three programs), `eslint . --max-warnings 0`, `prettier --check .`, `Test Files 196 passed (196) / Tests 5678 passed (5678)` with `Statements : 96.29%` and `Branches : 91.53%`, both builds with the bundle budgets, `License gate passed.` and `THIRD-PARTY-NOTICES.txt is up to date (28 packages).`
- Acceptance: `SPEC-GAP: PaidBySelect` in PaidBySelect.tsx 1, `idempotencyKey` in expensesService.ts 3, `(you)` in expensesCopy.ts 2, `expenseFormSchema` in expensesSchemas.ts 3, `Enter an amount of ₱1,000,000.00 or less.` in expensesCopy.ts 1, `new Date()` in expensesSchemas.ts 0, `outside the current filters` in expensesCopy.ts 1, `@expenses-add` in docs/web/e2e.md 1.
- Shared machine: the preflight showed ports 5180, 5115, 7028 and 5199 free and no other project's test process before each e2e run; no BetsLLC database or port was touched.

## Decisions Made

- Add Expense is `aria-disabled` until the page has the server's business today (list, else the KPI answer), so the modal never starts from the device clock (D-20, D-23).
- Paid by shows the signed-in user as "(you)" only when the lookup holds them; the staff lookup stays the only source of choices (D-32).
- A failed staff lookup disables Paid by and says so, but does not block the save: the default payer is the signed-in user and the server's CanPay check is the authority (T-06-38).
- The note about filters is a wording aid that compares the saved row with the URL filters; the list itself is always the server's answer.
- Enter in Description is proved in the real-browser e2e, because user-event does not follow a button's `form` attribute in jsdom.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical] The category picker had no feedback when the category list failed to load**
- **Found during:** Task 1 (building the picker beside the staff failure line)
- **Issue:** A failed category list left a disabled, empty select with no message, so a person could not tell why they could not choose.
- **Fix:** The picker is disabled on a failure and shows "Couldn't load the categories. Close this form and try again.", the same pattern as the approved staff line. The wording is new SPEC-GAP copy for the owner's pre-release copy review (05 D-48).
- **Files modified:** web/src/modules/admin/components/ExpenseCategorySelect.tsx, web/src/modules/admin/expensesCopy.ts
- **Verification:** picker unit cases; page and modal suites.
- **Committed in:** 2c0b6d6

**2. [Rule 1 - Bug] My first schema file replaced the list's existing range schema**
- **Found during:** Task 1 (the diff stat showed deletions in `expensesSchemas.ts`)
- **Issue:** `expensesSchemas.ts` and `EXPENSES_COPY.errors` already existed from plan 06-07 (the From and To rules). A first write overwrote the schema file and duplicated the `errors` key.
- **Fix:** Restored the file from git and appended the form schema; merged the new messages into the one `errors` object.
- **Files modified:** web/src/modules/admin/expensesSchemas.ts, web/src/modules/admin/expensesCopy.ts
- **Verification:** the 06-07 range tests (5) still pass inside `expensesSchemas.test.ts`; `tsc` clean.
- **Committed in:** 2c0b6d6

### Plan wording notes

- The plan lists no recipe or query-key file; `expenses.recipe.ts` gained the form grid and read-only control looks, and `useExpensesQuery.ts` gained `expensesDeletedKey` for plan 06-15's deleted list (invalidated here as the plan requires).
- The Task 3 behavior "Enter in Description submits" is asserted in the `@expenses-add` e2e (the modal is saved with Enter) instead of a jsdom test; the unit case that tried it could not follow the footer button's `form` attribute.
- The Task 3 RED commit carried one lint finding in a test (`as HTMLElement`); it was fixed in the Task 3 GREEN commit.
- The Task 3 e2e names its Admin with a unique last name and finds the new row by searching that token, so it does not depend on the row's page position in the shared CSPS_E2E database.

---

**Total deviations:** 2 auto-fixed (1 missing critical, 1 bug), 0 checkpoints.
**Impact on plan:** No scope change. The extra category failure line is one string the owner reviews with the other new copy.

## Issues Encountered

- A first attempt to append test chunks with heredocs failed on shell parsing before writing anything (nothing changed); the chunks were written with the Write tool and appended.
- `npx vitest run --version` started a full run in the background by mistake; it wrote nothing and ended on its own.

## Known Stubs

None. Every field is wired to the form state, the staff and category lookups and the create call. No placeholder data reaches the screen.

## Threat Flags

None. T-06-37 (double click) is mitigated by `useSubmission`'s one in-flight request and one key, proved by the "Saving" and retry-key tests. T-06-38 (arbitrary payer) is mitigated: the picker lists only the lookup and the server stays the authority. T-06-39 (float rounding) is mitigated: the amount is text through the schema and `Number()` runs after the 2-decimal check only. T-06-SC: no package was installed.

## User Setup Required

None.

## Owner items

- New SPEC-GAP copy to review before release (05 D-48, already in the backlog): "Couldn't load the categories. Close this form and try again." and the outside-the-filters toast note. No new backlog entry.

## Next Phase Readiness

- Plan 06-14 can add the edit and view modes to `ExpenseModal` (the `mode` prop and the `savedCategoryId` picker prop are ready) and reuse `PaidBySelect` with the saved payer.
- Plans 06-15 and 06-16 can invalidate `expensesDeletedKey` (exported from `useExpensesQuery.ts`) with `expensesKey` and `expenseKpisKey`.
- Phase 7 can reuse `PaidBySelect` (ORD-22, ORD-23).
- No blockers.

## Self-Check: PASSED

All created files exist on disk; the six task commits (`4fc6fac`, `2c0b6d6`, `badbaf6`, `26d1a99`, `b80fe6e`, `75f6505`) are ancestors of HEAD; `npm --prefix web run verify` exited 0; `@expenses` e2e passed 25 of 25.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
