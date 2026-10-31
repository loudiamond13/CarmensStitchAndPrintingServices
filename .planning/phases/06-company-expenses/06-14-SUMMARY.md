---
phase: 06-company-expenses
plan: 14
subsystem: web
tags: [react, react-hook-form, zod, tanstack-query, msw, playwright, a11y, or-3, or-4, sec-07]
created: "2026-10-25T14:50:00-05:00"
updated: "2026-10-25T14:50:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: GET and PUT /api/v1/company-expenses/{id} with the row version, canEdit and the ProblemDetails codes (plans 06-02, 06-03); the Add Expense modal, PaidBySelect, the picker mode of ExpenseCategorySelect, expenseFormSchema and the fixtures (plan 06-12); the Company Expenses page and KPI keys (plans 06-04, 06-09)
provides:
  - The Edit Expense mode of ExpenseModal: the expense read fresh on every open, the row version it opened with kept until its own save or Load Latest, RecordMeta (Recorded by, Last changed by), Save Changes
  - The 409 ConflictBanner with Load Latest, the 403 not-yours and 404 deleted banners, the load-failure ErrorState with Try Again, and the D-26 access note
  - A saved payer who is no longer active ("(inactive)" or "(former staff)") and a saved retired category that stay selectable in an edit
  - The View mode of ExpenseModal ("Expense details", read-only, Close only) and the Actions column (Edit or View by canEdit)
  - expensesService.get and update, useExpenseQuery, expenseDetailBackend and updateExpenseBackend fixtures, and the @expenses-edit e2e
affects: [06-15, 06-16, 06-18, 06-19]

actuals:
  tokens: 19900
  tasks: 3
  commits: 6
plan_head_before: d17c1d7ce648cb4a837d21df2309672bcdebba29
plan_head_after: f0a0f06d2cfbab9d3e7d62adad7ed2b56b4f6285

tech-stack:
  added: []
  patterns:
    - "The detail query has its own root (company-expense, id) with staleTime 0, gcTime 0 and no refetch on focus; the form trusts it only when isFetchedAfterMount and keeps the first answer's version in state, so a later refetch never changes what a save sends"
    - "One ExpenseForm serves add and edit; View is a separate small component, so the read-only look never carries form state"
    - "After a save the page asks the query cache (not the DOM) whether the row is still listed, then focuses the row's button or the table caption"
    - "A read-only modal body that can scroll on a phone is a named region with tabIndex 0 (axe scrollable-region-focusable)"

key-files:
  created:
    - web/src/modules/admin/hooks/useExpenseQuery.ts
  modified:
    - web/src/modules/admin/components/ExpenseModal.tsx
    - web/src/modules/admin/components/ExpenseModal.test.tsx
    - web/src/modules/admin/components/PaidBySelect.tsx
    - web/src/modules/admin/components/PaidBySelect.test.tsx
    - web/src/modules/admin/components/ExpenseCategorySelect.test.tsx
    - web/src/modules/admin/components/expenses.recipe.ts
    - web/src/modules/admin/expensesCopy.ts
    - web/src/modules/admin/expensesSchemas.test.ts
    - web/src/modules/admin/pages/ExpensesPage.tsx
    - web/src/modules/admin/pages/ExpensesPage.test.tsx
    - web/src/modules/admin/services/expensesService.ts
    - web/src/modules/admin/services/expensesService.test.ts
    - web/src/test/expenseFixtures.ts
    - web/e2e/expenses.spec.ts
    - docs/web/e2e.md

key-decisions:
  - "The detail query lives under its own key root, not under the list's, so a list invalidation after a save does not read the open expense again."
  - "Actions follow the server's canEdit alone (a Manager's rows all say true): Edit (pencil) when true, View (eye) when false. The browser never decides who may edit."
  - "Edit uses the same zod schema as Add: it already accepts any non-empty payer and category id (the server decides if they are active) and keeps the 30-day limit, so expensesSchemas.ts needed no change; the edit rules are pinned by new tests."
  - "A saved payer is added to the Paid by list only after the staff lookup has answered, so a failed lookup never labels an active person (inactive)."
  - "View has two buttons named Close (the dialog's header icon and the footer button the UI-SPEC asks for); focus starts on the footer one."

patterns-established:
  - "Tests that need a signed-in Admin call clearSession then acceptSession with role 'Admin'; the session lowercases it, so code compares with 'admin'"
  - "expenseDetailBackend lets the KPI route through (returns undefined for id 'kpis') because both share the company-expenses prefix"

requirements-completed: [CEXP-02, CEXP-04, CEXP-05]

coverage:
  - id: D1
    description: "A Manager presses Edit on a row, the modal reads the expense fresh (Loading expense… then Expense loaded., focus on Date), Save Changes sends PUT with the version it opened with, the list and KPIs read again, the toast reads Expense updated, and focus returns to the row's Edit button or the table caption (CEXP-02)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ExpenseModal.test.tsx (E2 edit mode)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (Edit Expense)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-edit (a Manager edits an amount from the row; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A stale save keeps every typed value and shows the ConflictBanner with focus on Load Latest; Load Latest replaces the values and the version, removes the banner, focuses Date and announces it; a 403 and a 404 show their banner, disable Save and keep the typed values; a load failure offers Try Again (SEC-07, D-26, 05 D-20)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ExpenseModal.test.tsx (E2 edit conflicts)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-edit (two pages editing the same expense; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A saved payer who is no longer active stays selected as (inactive) or (former staff), a saved retired category stays listed as (retired), and an Admin who did not record the expense sees the D-26 note when moving Paid by away from themselves (OQ-7, D-11, D-26)"
    requirement: CEXP-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/PaidBySelect.test.tsx (the saved payer of an edit)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/ExpenseModal.test.tsx (E2 edit saved inactive payer and retired category; E2 edit access note)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Recorded by shows the original recorder and Last changed by shows the editor or Not set, with deleted people kept by name and (former staff) (CEXP-04)"
    requirement: CEXP-04
    verification:
      - kind: unit
        ref: "web/src/modules/admin/components/ExpenseModal.test.tsx (E2 edit mode, E2 view mode)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-edit (Last changed by names the Manager after a save)"
        status: pass
    human_judgment: false
  - id: D5
    description: "An Admin sees View (eye) on rows they may not edit and Edit on their own, never a delete; View opens Expense details read-only with Notes (or Not set), RecordMeta and Close only, focus on Close (OQ-8, D-25, D-26)"
    requirement: CEXP-05
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (View Expense for an Admin)"
        status: pass
      - kind: unit
        ref: "web/src/modules/admin/components/ExpenseModal.test.tsx (E2 view mode)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-edit (an Admin sees View on a coworker's row; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The Edit and View modals look right in both themes and fit a 320 px phone"
    verification:
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-edit (320 px: no sideways scroll, Save Changes and Cancel in view, Recorded by visible, axe)"
        status: pass
    human_judgment: true
    rationale: "The visual look of the E2 modal is part of the owner's UI-SPEC Visual Review (plan 06-19); the e2e proves fit and accessibility only"

duration: 43min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 14: Edit and View Expense Summary

**Staff edit an expense from its row with conflict protection (the form keeps the row version it opened with, a 409 keeps every typed value and offers Load Latest, a 403 and a 404 explain themselves), and Admins read the expenses they cannot edit in a read-only Expense details modal.**

## Performance

- **Duration:** 43 min
- **Started:** 2026-10-25T19:06:34Z
- **Completed:** 2026-10-25T19:49:20Z
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD)
- **Files changed:** 16 (1 created)

## Accomplishments

- **Edit from the row (tracer):** the Actions column gives a Manager `Edit {desc}, {date}` on every row (pencil, matching title). The modal reads the expense through `useExpenseQuery` (no cache lifetime, no refetch on focus, trusted only when fetched after mount), shows "Loading expense…" then "Expense loaded.", focuses Date, and `Save Changes` sends PUT with the version it opened with and no Idempotency-Key. A refetch never changes that version. A save closes the modal, reads the lists, KPIs and deleted list again, toasts "Expense updated" / "₱700.00 · Supplies", and returns focus to the row's button (or the table caption when the row left the view).
- **Safe editing (SEC-07, D-26, 05 D-20):** a 409 `edit.stale` keeps the typed values and shows the shared ConflictBanner with focus on Load Latest; Load Latest reads the expense again, replaces values and version, removes the banner, focuses Date and says "Latest version loaded. Make your changes again." A 403 `company-expenses.not-yours` shows "You can't edit this expense.", a 404 shows "This expense was deleted." (also when the detail is already gone on open), both with Save `aria-disabled` and typed values kept. A failed read shows "Couldn't load this expense." with Try Again. Server field errors on edit land under their fields.
- **Saved inactive values (OQ-7, D-11, D-26):** `PaidBySelect` keeps a saved payer the staff lookup no longer holds as "{name} (inactive)" or "{name} (former staff)"; the category picker keeps a saved retired category as "{name} (retired)". An Admin who did not record the expense and moves Paid by away from themselves sees the D-26 note, which goes when they change it back.
- **View (OQ-8, D-25):** an Admin sees the eye `View {desc}, {date}` on rows the server marks `canEdit: false` and the pencil on their own; View opens "Expense details" with Date, CategoryBadge, a wrapping description, Money, Paid by with Avatar, Notes (or Not set), RecordMeta and a Close button only, with focus on Close.

## Task Commits

1. **Task 1: Tracer, edit an expense from its row (CEXP-02)**
   - RED `6797a42` (test)
   - GREEN `8f3712e` (feat)
2. **Task 2: Conflicts, lost rights and deletions while editing (SEC-07, D-26)**
   - RED `43b4f74` (test)
   - GREEN `4d5e4d0` (feat)
3. **Task 3: View mode, Admin row actions and the edit e2e (OQ-8)**
   - RED `d0ef719` (test)
   - GREEN `f0a0f06` (feat)

**Plan metadata:** the `docs(06-14)` commits that follow this file.

### TDD gate compliance

RED then GREEN commit pairs exist for all three tasks; no REFACTOR commits were needed. The `gsd_run check tdd-red-evidence` classifier reads JUnit from the MTP runner and does not apply to Vitest or Playwright, so the evidence is the quoted run with the semantic assessment.

- **Task 1 RED:** `14 failed`: `TypeError: service.get is not a function`, `TypeError: service.update is not a function`, `Unable to find an accessible element with the role "button" and name "Edit Shop rent for October, Oct 6, 2026"`, `Unable to find an accessible element with the role "dialog" and name "Edit Expense"`, `Unable to find an accessible element with the role "term"`, the seven-header assertion (`expected [ 'Date', 'Category', …(4) ] to deeply equal [ 'Date', 'Category', …(5) ]`) and `expected [] to deeply equal [ Array(1) ]` (no detail read). Semantic assessment: every failure names the planned missing behavior; none is a load or syntax fault.
- **Task 2 RED:** `11 failed | 77 passed`: the 409, 403, 404, load-failure and D-26 cases failed on the missing text (`Unable to find an element with the text: This was changed by someone else.`, `You can't edit this expense.`, `This expense was deleted.`, `Couldn't load this expense.`, the access note), the two saved-payer cases on `expected 'Carmen Reyes (you)' to be 'Old Helper (inactive)'`, and the two PaidBySelect cases on the missing option. The server-field-error, 500 alert, retired-category, negative-note and schema cases passed at once because earlier plans already behave that way; they are kept as characterization tests. Semantic assessment: every failure is the planned missing rule.
- **Task 3 RED:** `9 failed | 110 passed`: seven view-mode cases (no "Expense details" dialog; the add form rendered instead) and two page cases (no View button). The `@expenses-edit` e2e was written in this RED commit and run after GREEN, as in plan 06-12: it passed 20 of 20 (19 on the first run; see Deviations).

## Verification evidence

- Task 1 verify (also the tracer gate re-run): `Test Files 3 passed (3)` / `Tests 104 passed (104)`; then `src/modules/admin src/test`: `Test Files 71 passed (71)` / `Tests 1641 passed (1641)`.
- Task 2 verify: `Test Files 4 passed (4)` / `Tests 88 passed (88)`; wider run `src/modules/admin src/test src/components`: `Test Files 124 passed (124)` / `Tests 3021 passed (3021)`.
- Task 3 verify: `Test Files 2 passed (2)` / `Tests 119 passed (119)`; `ExpenseModal.test.tsx` alone `Tests 47 passed (47)` after the region case was added.
- E2E: the first `--grep @expenses-edit` run gave `19 passed (2.6m)` and one failure (iphone, axe `scrollable-region-focusable` on the View modal); after the fix `npm --prefix web run e2e -- --grep "@expenses"` gave `45 passed (6.0m)` (all expense specs, 5 projects, 20 of them `@expenses-edit`).
- Plan verification: `npm --prefix web run verify` exited 0: typecheck (three programs), `eslint . --max-warnings 0`, `prettier --check .`, `Test Files 196 passed (196)` / `Tests 5721 passed (5721)` with `Statements : 96.24%` and `Branches : 91.47%`, both builds with the bundle budgets, `License gate passed.` and `THIRD-PARTY-NOTICES.txt is up to date (28 packages).`
- Acceptance: `isFetchedAfterMount` in ExpenseModal.tsx 1; `Expense updated` in expensesCopy.ts 1; `SPEC-DEVIATION: CEXP-04` in ExpenseModal.tsx 1; `Latest version loaded. Make your changes again.` in expensesCopy.ts 1; `After you save, you can't edit this expense any more.` in expensesCopy.ts 1; `(former staff)` or `(inactive)` lines in expensesCopy.ts 2; `Expense details` in expensesCopy.ts 1; `@expenses-edit` in docs/web/e2e.md 1.
- Shared machine: the preflight showed ports 5180, 5115, 7028 and 5199 free and no other project's test process before each e2e and verify run; no BetsLLC database or port was touched; no background shell was left running.

## Decisions Made

- The detail query has its own key root so a list invalidation does not re-read the open expense; the form keeps the version of the first answer in state.
- Actions follow `canEdit` only; the browser never decides who may edit (T-06-45). The server's 403 stays the authority and its banner is tested.
- Edit reuses `expenseFormSchema`: it already accepts any non-empty payer and category id and keeps the 30-day limit, so the "edit schema" is pinned by tests and needed no code change.
- A saved payer joins the Paid by list only after the staff lookup has answered, so a failed lookup never calls an active person "(inactive)".
- View keeps the UI-SPEC's footer "Close" even though the dialog's header icon button is also named "Close".

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The focus-after-save check read the DOM too early**
- **Found during:** Task 1 (the "row left the page" case)
- **Issue:** `invalidateQueries(...).then(...)` resolves before React redraws the table, so `focusRow` still found the old button, then the row vanished and focus fell to the body.
- **Fix:** the page asks the query cache (`getQueriesData` for the active list) whether the saved row is still listed, then focuses the row's button or the table caption (`captionId`).
- **Files modified:** web/src/modules/admin/pages/ExpensesPage.tsx
- **Verification:** the "moves focus to the table caption" case and the "returns focus to that row's Edit button" case.
- **Committed in:** 8f3712e

**2. [Rule 2 - Missing critical] The View body could scroll on a phone with nothing a keyboard could focus**
- **Found during:** Task 3 (first `@expenses-edit` run, iphone project: axe `scrollable-region-focusable: .overflow-y-auto`)
- **Issue:** the read-only modal body scrolls on a small screen and holds no control, so a keyboard user could not scroll it (WCAG 2.1.1).
- **Fix:** the View body is a named region (`role="region"`, `aria-label="Expense details"`, `tabIndex={0}`), the same approach as ResponsiveTable's scrolling frame; one unit case pins it.
- **Files modified:** web/src/modules/admin/components/ExpenseModal.tsx, web/src/modules/admin/components/ExpenseModal.test.tsx
- **Verification:** `@expenses-edit` 20 of 20 and the full `@expenses` run 45 of 45.
- **Committed in:** f0a0f06

**3. [Rule 3 - Blocking] Fixture ids did not match the signed-in user**
- **Found during:** Task 1 (the save body carried the fixture CARMEN actor id, not the session user's id)
- **Issue:** `expenseDetail()` used the `CARMEN` actor, whose generated id differs from `ME_ID`, so the Paid by select showed the first option while the form held an id with no option.
- **Fix:** added `ME_ACTOR` (the session user) and made it the default payer and recorder of `expenseDetail()`.
- **Files modified:** web/src/test/expenseFixtures.ts
- **Verification:** the edit-mode cases and the earlier add and page cases still pass.
- **Committed in:** 8f3712e

### Plan wording notes

- The plan lists `expensesSchemas.ts` as modified, but the add schema already covers the edit rules, so only `expensesSchemas.test.ts` changed. `ExpenseCategorySelect.tsx` also needed no change: plan 06-12 had already built the `savedCategoryId` option; only its test grew.
- The `@expenses-edit` row in `docs/web/e2e.md` is the only change to that file besides its `updated` stamp.
- The existing page test for the column headers now expects seven headers (the visually hidden "Actions" is the seventh).

---

**Total deviations:** 3 auto-fixed (1 bug, 1 missing critical, 1 blocking), 0 checkpoints.
**Impact on plan:** No scope change. All three fixes were needed for the plan's own behavior (focus return, keyboard access, a consistent fixture).

## Issues Encountered

- Two shell heredocs failed on parsing before writing anything (nothing changed); the larger edits were written to the scratchpad with the Write tool and applied with short scripts.
- The first `ExpenseModal` patch script left a stray no-op line; it was removed before the run.
- The first `@expenses-edit` e2e run failed one iphone case on axe (deviation 2); no other flake was seen, and the final run passed every case.

## Known Stubs

None. Every field is wired to the detail answer, the staff and category lookups and the update call.

## Threat Flags

None. T-06-45 (Edit offered where not allowed) is mitigated: Edit shows only when the server says `canEdit`, and the 403 banner is tested. T-06-46 (stale overwrite) is mitigated: the opened version is sent, a 409 keeps the typed values and offers Load Latest, and the two-page e2e proves it. T-06-47 (notes shown to Admins) is accepted as planned: notes appear only inside the form and View, never in the list or search. T-06-SC: no package was installed.

## User Setup Required

None.

## Owner items

- New SPEC-GAP copy to review before release (05 D-48, already in the backlog): "View {desc}, {date}", "Expense details" and the D-26 note wording come from the UI-SPEC; no new wording was invented. No new backlog entry.
- Worth a look in the visual review (plan 06-19): the View modal has two buttons named "Close" (the header icon and the footer button the UI-SPEC asks for).

## Next Phase Readiness

- Plan 06-15 can open the same modal for its `@audit` e2e edits and invalidate `expensesKey`, `expenseKpisKey` and `expensesDeletedKey` the same way; the page already holds the row action wiring (`RowWiring`) where Delete and permanent delete will join Edit.
- Plans 06-16 and 06-18 can reuse `useExpenseQuery` and the row focus registry.
- No blockers.

## Self-Check: PASSED

All created files exist on disk; the six task commits (`6797a42`, `8f3712e`, `43b4f74`, `4d5e4d0`, `d0ef719`, `f0a0f06`) are ancestors of HEAD; `npm --prefix web run verify` exited 0; `@expenses` e2e passed 45 of 45.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
