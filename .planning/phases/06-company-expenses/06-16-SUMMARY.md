---
phase: 06-company-expenses
plan: 16
subsystem: web
tags: [react, tanstack-query, msw, playwright, a11y, soft-delete, confirm-dialog, or-3, or-4]
created: "2026-10-25T16:45:00-05:00"
updated: "2026-10-25T16:45:00-05:00"

requires:
  - phase: 06-company-expenses
    provides: DELETE /{id}, POST /{id}/restore, DELETE /{id}/permanent and GET /deleted with the Manager policy (plan 06-10); the Company Expenses page with its row actions, RowWiring and useRowFocus registry (plans 06-04, 06-14); the shared ConfirmDialog, useSubmission and the expense fixtures
provides:
  - Manager-only Delete (trash-2) and Delete permanently (eraser) row actions on the expenses list, each behind a plain ConfirmDialog with the exact D-05 copy
  - The Deleted Expenses page at /admin/expenses/deleted (Manager only, lazy chunk, Admin redirected to /admin/expenses by the route loader) with Restore (no confirmation) and Delete permanently
  - expensesService.remove, listDeleted, restore and purge; useExpenseAction; useDeletedExpensesListParams and useDeletedExpensesQuery; useRefreshExpenses; PurgeExpenseDialog; ExpenseActorCell
  - requireManagerLoader with an optional fallback path; Deleted Expenses marks Company Expenses current
  - The five new icons (settings, rotate-ccw, archive, archive-restore, eraser; 68 in all)
  - The @expenses-delete e2e in all five projects
affects: [06-18, 06-19]

actuals:
  tokens: 28340
  tasks: 3
  commits: 6
plan_head_before: 8676ed7106003338a74fa72ebfa73bab9df642c4
plan_head_after: 5864293b75f50806aa923dbcf6e0ebecadb046f3

tech-stack:
  added: []
  patterns:
    - "useExpenseAction<T extends { id }> is useUserAction for expenses: the Idempotency-Key identity carries a generation that moves on only after the lists have read again, so a retry keeps its key and the next action gets a new one"
    - "Every expense change refreshes through one hook, useRefreshExpenses (KPIs, deleted list, expense list), so a page cannot forget one of the three"
    - "A row leaving a list sets a one-shot afterRemoval ref (removed id plus the neighbour to focus); an effect that runs after each render moves focus once the cache no longer holds the row, else to the h1"
    - "A 404 on a delete is handled inside the confirm handler: it closes the dialog, refreshes, shows the info toast and resolves normally, so ConfirmDialog does not treat it as a failure"
    - "A section can own child pages: sections.ts maps /admin/expenses/deleted to the Company Expenses item, so the sidebar and tab bar need no change"

key-files:
  created:
    - web/src/modules/admin/pages/DeletedExpensesPage.tsx
    - web/src/modules/admin/pages/DeletedExpensesPage.test.tsx
    - web/src/modules/admin/hooks/useExpenseAction.ts
    - web/src/modules/admin/hooks/useDeletedExpensesListParams.ts
    - web/src/modules/admin/hooks/useDeletedExpensesListParams.test.tsx
    - web/src/modules/admin/hooks/useDeletedExpensesQuery.ts
    - web/src/modules/admin/hooks/useRefreshExpenses.ts
    - web/src/modules/admin/components/PurgeExpenseDialog.tsx
    - web/src/modules/admin/components/ExpenseActorCell.tsx
  modified:
    - web/src/modules/admin/pages/ExpensesPage.tsx
    - web/src/modules/admin/pages/ExpensesPage.test.tsx
    - web/src/modules/admin/services/expensesService.ts
    - web/src/modules/admin/services/expensesService.test.ts
    - web/src/modules/admin/expensesCopy.ts
    - web/src/modules/admin/components/expenses.recipe.ts
    - web/src/modules/admin/routes.tsx
    - web/src/modules/admin/routes.test.tsx
    - web/src/modules/admin/guard.ts
    - web/src/modules/admin/guard.test.ts
    - web/src/modules/admin/sections.ts
    - web/src/modules/admin/sections.test.ts
    - web/src/components/brand/icons.ts
    - web/src/components/brand/Icon.test.tsx
    - web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
    - web/src/test/expenseFixtures.ts
    - web/e2e/expenses.spec.ts
    - docs/web/e2e.md

key-decisions:
  - "Delete, Delete permanently and Restore act on the latest state: no row version is sent, and the DELETE calls send no Idempotency-Key (a DELETE repeats safely); only Restore (a POST) sends one."
  - "The permanent-delete warning is one shared component (PurgeExpenseDialog) used by the list and the Deleted Expenses page, so the copy, the 404 rule and the failure line cannot drift apart."
  - "The 'Already deleted' info toast serves both deletes on a 404; Restore has no such case in the contract, so a failed Restore (any status) is the persistent danger toast with the mapper line."
  - "Admins get no Deleted Expenses link, no delete action of either kind and, from the loader, a redirect to /admin/expenses; the browser decides nothing about rights beyond the role in the session, and the server's 403 stays the authority (a 403 on the deleted page shows the P2 access banner)."

patterns-established:
  - "Page header buttons sit in a .s-ph-actions container (expensesHeadActionsClasses): 8px apart, full width on phones with each growing equally"
  - "E2E: when a client-side link changes the address before the next page mounts, wait for the new page's own h1 before filling a search box both pages share"

requirements-completed: [CEXP-02]

coverage:
  - id: D1
    description: "A Manager deletes an expense from its row after one plain confirmation: the dialog names it with the amount, Cancel has focus, the row and its amount leave the list and the total, focus moves to the next row's first action (else the previous, else the h1), the lists, KPIs and deleted list read again and the toast says where to restore it (D-01, D-02, D-05)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (Delete Expense)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-delete (a Manager deletes, restores and permanently deletes expenses; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A failed delete keeps the dialog open with the mapper line and focus on the confirm button; a 404 closes it, refreshes and shows the 'Already deleted' info toast"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (Delete Expense; Delete permanently from the list) and DeletedExpensesPage.test.tsx (Delete permanently from the deleted list)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A Manager opens Deleted Expenses from the header link; the page lists deleted expenses most recently deleted first with the delete time, Deleted by, search and category in the URL, and every state (loading, error with Try Again, nothing deleted, no matches, 403 banner); an Admin never sees the link and is redirected from the route (D-03, D-07, OQ-2)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedExpensesPage.test.tsx; routes.test.tsx (Deleted Expenses for Managers); guard.test.ts; sections.test.ts; useDeletedExpensesListParams.test.tsx"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-delete (an Admin sees no delete action and is sent back; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Restore acts at once: the POST carries an Idempotency-Key that a retry reuses and the next action replaces, the row leaves, focus moves to the next Restore (else the previous, else the h1), the expense counts in totals again; a failure is a persistent danger toast with the mapper line (OQ-5)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/DeletedExpensesPage.test.tsx (Restore)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-delete (Restore counts it again; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Delete permanently (eraser) from either list shows the can't-be-undone warning, removes the expense for good and follows the same focus, refresh and toast rules (D-04, D-05, OQ-1)"
    requirement: CEXP-02
    verification:
      - kind: unit
        ref: "web/src/modules/admin/pages/ExpensesPage.test.tsx (Delete permanently from the list); DeletedExpensesPage.test.tsx (Delete permanently from the deleted list); expensesService.test.ts (purge)"
        status: pass
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-delete (permanent delete from the list and from Deleted Expenses; 5 of 5 projects)"
        status: pass
    human_judgment: false
  - id: D6
    description: "The five new icons are named lucide-react imports and the icon tests and showcase grid count 68 (OQ-12)"
    verification:
      - kind: unit
        ref: "web/src/components/brand/Icon.test.tsx; web/src/modules/admin/pages/ComponentShowcasePage.test.tsx (shows all 68 icons)"
        status: pass
    human_judgment: false
  - id: D7
    description: "Both confirmations fit a 320 px phone with Cancel and the confirm button in view and nothing scrolling sideways; the look of the eraser and trash icons, the Deleted Expenses page and the dialogs in both themes"
    verification:
      - kind: e2e
        ref: "web/e2e/expenses.spec.ts @expenses-delete (both confirmations fit a 320 px phone; 5 of 5 projects)"
        status: pass
    human_judgment: true
    rationale: "The visual look of E1's third icon, E4 and the E3 dialogs is part of the owner's UI-SPEC Visual Review (plan 06-19); the e2e proves fit and accessibility only"

duration: 61min
completed: 2026-10-25
status: complete
---

# Phase 6 Plan 16: Delete, Restore and Permanent Delete Summary

**Managers delete an expense from its row behind a plain confirmation, find it on a new Manager-only Deleted Expenses page and restore it in one press, or delete it for good from either list behind a can't-be-undone warning; Admins never see any of it.**

## Performance

- **Duration:** about 61 min
- **Started:** about 2026-10-25T20:42Z
- **Completed:** 2026-10-25T21:43Z
- **Tasks:** 3 (Task 1 tracer, Tasks 2 and 3 TDD), each a RED and GREEN commit pair
- **Files changed:** 27 (9 created)

## Accomplishments

- **Delete from the row (tracer, D-01, D-02, D-05):** a Manager's row shows Edit, then `Delete {desc}, {date}` (trash-2, ghost-danger hover, matching title). The ConfirmDialog is titled `Delete “{desc}” ({₱amount})?` (typographic quotes, wraps anywhere), says the expense will not count and can be restored from Deleted Expenses, has Cancel focused first and `Delete Expense` / `Deleting`. A confirm sends `DELETE /company-expenses/{id}` (no key, no version); the row and its amount leave the list and the period total, focus moves to the next row's first action (else the previous, else the h1), the expense list, KPIs and deleted list read again, and the toast reads `Expense deleted` / `{desc}. You can restore it from Deleted Expenses.` A 500 keeps the dialog open with the mapper line (role alert) and focus on the confirm button; a 404 closes it, refreshes and shows the `Already deleted` info toast.
- **Deleted Expenses (D-03, D-07, OQ-2, OQ-5):** `/admin/expenses/deleted` is a lazy admin chunk behind `requireManagerLoader(args, '/admin/expenses')`, so an Admin lands back on the list through `redirect()`; a Manager reaches it from the secondary `Deleted Expenses` link before Add Expense (the header buttons now sit in a `.s-ph-actions` container). The page has the back link, h1 with the `Manager only` badge, the subline, Search and Category in the URL (no dates), `Showing {n} deleted expense(s) · most recently deleted first`, and the table with Deleted (a `time` element in Manila time), Date, Category, Description, Amount, Paid by, Deleted by and the actions; no total row. Loading, error with Try Again, `No deleted expenses` (archive icon, no action), `No matches` with Clear Filters and the P2 403 banner are all covered. Company Expenses stays current in the sidebar and tab bar.
- **Restore (OQ-5):** one press, no confirmation. The POST carries an Idempotency-Key through `useExpenseAction`: a failed attempt retried keeps its key, the next action gets a new one. The row leaves, focus moves to the next Restore (else the previous, else the h1), and the toast reads `Expense restored` / `{desc} counts in totals again.` A failure is the persistent danger toast `Couldn't restore {desc}` with the mapper line.
- **Delete permanently (D-04, OQ-1):** the eraser `Delete {desc}, {date} permanently` on both lists opens the shared `PurgeExpenseDialog` (`Delete “{desc}” ({₱amount}) permanently?`, the can't-be-undone message that names what the audit log keeps, `Delete Permanently` / `Deleting`). Same focus, refresh, toast (`Expense permanently deleted` / `{desc}`), failure and 404 rules.
- **Icons (OQ-12):** `settings`, `rotate-ccw`, `archive`, `archive-restore` and `eraser` as named lucide-react imports; no dependency changed.
- **E2E:** `@expenses-delete` (3 tests x 5 projects): the Manager journey (delete, Deleted Expenses, Restore, permanent delete from each list, totals checked), the Admin checks, and both dialogs on a 320 px phone, with axe at each step.

## Task Commits

1. **Task 1: Tracer, a Manager deletes an expense from its row (D-01, D-02, D-05)**
   - RED `eea9604` (test)
   - GREEN `2c61aaa` (feat)
2. **Task 2: Deleted Expenses page and Restore (D-03, D-07, OQ-2, OQ-5)**
   - RED `67732b9` (test)
   - GREEN `54ef0ea` (feat)
3. **Task 3: Permanent delete from either list, the e2e (D-04, D-05, OQ-1)**
   - RED `f508174` (test)
   - GREEN `5864293` (feat)

**Plan metadata:** the `docs(06-16)` commits that follow this file.

### TDD gate compliance

RED then GREEN commit pairs exist for all three tasks; no REFACTOR commits. The `gsd_run check tdd-red-evidence` classifier reads JUnit from the MTP runner and does not apply to Vitest or Playwright, so the evidence is the quoted run with the semantic assessment, as in plans 06-12 and 06-14.

- **Task 1 RED:** `12 failed | 81 passed (93)`: `Unable to find an accessible element with the role "button" and name "Delete Shop rent for October, Oct 6, 2026"` (8 cases), `TypeError: service.remove is not a function`, `AssertionError: expected [ Array(1) ] to deeply equal [ …(2) ]` (the row's actions). Semantic assessment: every failure names the planned missing behavior; none is a load or syntax fault.
- **Task 2 RED:** `22 failed | 280 passed (302)`: the two new test files failed to load because their modules did not exist, the guard fallback, section mapping, route, service, header link, icon and 68-icon cases failed on the missing behavior (`service.listDeleted`, `service.restore`, no `Deleted Expenses` link, `expected [...] to equal [..., 'settings', ...]`). Semantic assessment: all planned.
- **Task 3 RED:** `15 failed | 116 passed (131)`: `service.purge is not a function`, the missing eraser buttons and permanent dialogs on both pages. The `@expenses-delete` e2e was written in this RED commit and run after GREEN, as in plans 06-12 and 06-14.

## Verification evidence

- Task 1 verify (also the tracer gate re-run): `Test Files  2 passed (2)` / `Tests  93 passed (93)`.
- Task 2 verify set: 329 of 332 passed on the first run; after three test-only fixes (searchbox role, avatar initials in a cell, a duplicate fixture description) `DeletedExpensesPage.test.tsx` gave `Tests  18 passed (18)`; the full suite then ran `Test Files  198 passed (198)` / `Tests  5800 passed (5800)`.
- Task 3 verify set: `Test Files  3 passed` for the service and both page files (`Tests  117 passed (117)` for the two pages); icons and showcase pass.
- E2E: the first `--grep @expenses-delete` run gave `11 passed` and 4 failures of the Manager journey (two races in the test, see Deviations); after the fix `15 passed (1.3m)`. A wider `--grep "@expenses|@audit"` run gave `85 passed (11.3m)` across all five projects, so the new header container and row actions broke no earlier expense or audit e2e.
- Plan verification: `npm --prefix web run verify` exited 0 twice (before the e2e fixes and on the final tree): typecheck (three programs), `eslint . --max-warnings 0`, `prettier --check .`, `Test Files  198 passed (198)` / `Tests  5814 passed (5814)` with `Statements   : 95.76%` and `Branches     : 90.81%`, both builds with the bundle budgets, `License gate passed.` and `THIRD-PARTY-NOTICES.txt is up to date (28 packages).`
- Acceptance: `You can restore it later from Deleted Expenses.` in expensesCopy.ts 1; `Already deleted` 1; `SPEC-DEVIATION: D-01` in ExpensesPage.tsx 1; `expenses/deleted` in routes.tsx 1; `SPEC-GAP: E4` in DeletedExpensesPage.tsx 1; `most recently deleted first` in expensesCopy.ts 1; `eraser|archive-restore|rotate-ccw` in icons.ts 4; `68` in ComponentShowcasePage.test.tsx 2; `@expenses-delete` in docs/web/e2e.md 1.
- Shared machine: the preflight showed ports 5180, 5115, 7028 and 5199 free and no other project's test process before every e2e and verify run; no BetsLLC database or port was touched; no background shell was left running.

## Decisions Made

- DELETE calls send no Idempotency-Key and no version; only Restore sends a key (see key-decisions).
- The permanent-delete dialog is one component for both pages.
- Admin protection is layered: the controls are not rendered, the route loader redirects, and the server's 403 shows the P2 access banner on the deleted page.
- The OQ-1, OQ-2, OQ-5 and OQ-12 defaults were built as the contract says (third eraser icon, separate page with a header link, Restore without a confirm, five icons added). The owner's formal rulings on them remain pending.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The new icons were needed one task early**
- **Found during:** Task 2
- **Issue:** the plan adds the five icons in Task 3, but the Deleted Expenses page needs `rotate-ccw` (Restore) and `archive` (empty state) in Task 2, and a TypeScript icon name that does not exist does not compile.
- **Fix:** all five icons, the icon tests and the showcase count of 68 moved into Task 2 (RED `67732b9`, GREEN `54ef0ea`); Task 3 then used the existing `eraser`.
- **Files modified:** web/src/components/brand/icons.ts, web/src/components/brand/Icon.test.tsx, web/src/modules/admin/pages/ComponentShowcasePage.test.tsx
- **Committed in:** 54ef0ea

**2. [Rule 1 - Bug] A service test asserted a wrong body value**
- **Found during:** Task 1 (GREEN)
- **Issue:** my RED test expected the recorded request body to be `undefined`; the HTTP client sends no body as `null`.
- **Fix:** the test reads `body ?? null` and expects `null` (the same for `restore` and `purge`).
- **Files modified:** web/src/modules/admin/services/expensesService.test.ts
- **Committed in:** 2c61aaa

**3. [Rule 1 - Bug] The Manager Edit test still said no row has a delete button**
- **Found during:** Task 1 (RED)
- **Issue:** the plan 06-14 test `gives a Manager an Edit button on every row` asserted `queryByRole('button', { name: /^Delete / })` is null, which was true only until this plan.
- **Fix:** that one line was removed; the new Delete tests own the Manager's delete actions, and the Admin tests keep asserting there is none.
- **Files modified:** web/src/modules/admin/pages/ExpensesPage.test.tsx
- **Committed in:** eea9604

**4. [Rule 1 - Bug] Two races in the first @expenses-delete e2e run**
- **Found during:** Task 3 (first e2e run, 4 of 15 failed)
- **Issue:** (a) after the Back link, the address changes before the list page mounts and both pages share the same search box, so `fill` hit the page that was leaving and the list showed 20 rows; (b) the earlier permanent delete's toast was still on screen, so the text matched two elements.
- **Fix:** wait for the new page's own h1 before filling (twice), and read the newest toast with `.last()`.
- **Files modified:** web/e2e/expenses.spec.ts
- **Verification:** `@expenses-delete` 15 of 15, then `@expenses|@audit` 85 of 85.
- **Committed in:** 5864293

### Plan wording notes

- Files not in the plan's list were added because the work needed them: `ExpenseActorCell.tsx` (the Paid by cell, now shared by both tables), `PurgeExpenseDialog.tsx` (the one permanent-delete warning), `useRefreshExpenses.ts` (the one refresh path) and three recipe tokens in `expenses.recipe.ts` (title row, header actions, back row). `web/src/modules/admin/hooks/useDeletedExpensesListParams.ts` and `useDeletedExpensesQuery.ts` were the plan's own.

---

**Total deviations:** 4 auto-fixed (3 bugs in tests, 1 blocking), 0 checkpoints.
**Impact on plan:** No scope change. The icon move only changed which task carried them; the other fixes were inside tests.

## Issues Encountered

- The `edit` helper scripts for multi-line replacements failed twice on shell escaping or on text that Prettier had reformatted; the changes were redone with the Edit tool and nothing was left half applied.
- The first full-suite shell heredoc with an apostrophe failed to parse before writing anything; large test blocks were written with the Write tool and appended.

## Known Stubs

None. Every control is wired to the server calls (`remove`, `restore`, `purge`, `listDeleted`).

## Threat Flags

None. T-06-51 (an Admin reaching the deleted page or delete actions) is mitigated three ways: the actions and link are not rendered for an Admin, the route loader redirects, and the 403 shows the access banner (all tested, plus the e2e). T-06-52 (accidental permanent loss) is mitigated: both deletes sit behind a ConfirmDialog with Cancel focused first and an explicit can't-be-undone message, and the soft delete is the default action. T-06-53 (replayed restore) is mitigated: one Idempotency-Key per attempt, reused on a retry and replaced for the next action (tested). T-06-SC: no package was installed.

## User Setup Required

None.

## Owner items

- New SPEC-GAP copy to review before release (05 D-48, already in the backlog): `Deleted Expenses` link, the whole Deleted Expenses page (back link, badge, subline, columns, empty message), `Expense restored` / `{desc} counts in totals again.`, `Couldn't restore {desc}`, `Expense permanently deleted`, `Already deleted` and the permanent-delete dialog wording. All come from the UI-SPEC Copywriting Contract; no wording was invented.
- OQ-1, OQ-2, OQ-5 and OQ-12 were built with their contract defaults while the owner is away; the rulings are still pending and no behavior was decided here.
- Worth a look in the visual review (plan 06-19): the third row icon (eraser) beside trash-2, the header with two buttons on a 320 px phone (they share the width), and the Deleted Expenses page with rows and empty.

## Next Phase Readiness

- Plan 06-18 (Settings) and later can reuse `useExpenseAction`, `PurgeExpenseDialog`'s shape for the category delete dialog, and `requireManagerLoader`'s fallback option.
- No blockers.

## Self-Check: PASSED

All created files exist on disk; the six task commits (`eea9604`, `2c61aaa`, `67732b9`, `54ef0ea`, `f508174`, `5864293`) are ancestors of HEAD; `npm --prefix web run verify` exited 0 on the final tree; `@expenses-delete` passed 15 of 15 and `@expenses|@audit` 85 of 85.

---
*Phase: 06-company-expenses*
*Completed: 2026-10-25*
