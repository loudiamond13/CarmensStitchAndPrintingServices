---
phase: 06-company-expenses
part: C (web client)
created: 2026-10-25T00:00:00-05:00
updated: 2026-10-25T00:00:00-05:00
reviewed: 2026-10-25T00:00:00Z
depth: standard
files_reviewed: 58
files_reviewed_list:
  - web/src/components/brand/icons.ts
  - web/src/components/index.ts
  - web/src/components/lists/ResponsiveTable.tsx
  - web/src/components/lists/index.ts
  - web/src/components/money/KpiCard.tsx
  - web/src/components/money/money.recipe.ts
  - web/src/components/navigation/Sidebar.tsx
  - web/src/components/navigation/index.ts
  - web/src/components/status/index.ts
  - web/src/components/status/tones.ts
  - web/src/dev/scenarios/groups/status.ts
  - web/src/lib/url-state/parsers.ts
  - web/src/modules/admin/auditCopy.ts
  - web/src/modules/admin/categorySchemas.ts
  - web/src/modules/admin/components/AuditDetail.tsx
  - web/src/modules/admin/components/CategoryBadge.tsx
  - web/src/modules/admin/components/CategoryModal.tsx
  - web/src/modules/admin/components/ExpenseActorCell.tsx
  - web/src/modules/admin/components/ExpenseCategorySelect.tsx
  - web/src/modules/admin/components/ExpenseKpiRow.tsx
  - web/src/modules/admin/components/ExpenseModal.tsx
  - web/src/modules/admin/components/ExpensesDateRange.tsx
  - web/src/modules/admin/components/PaidBySelect.tsx
  - web/src/modules/admin/components/PurgeExpenseDialog.tsx
  - web/src/modules/admin/components/audit.recipe.ts
  - web/src/modules/admin/components/expenses.recipe.ts
  - web/src/modules/admin/components/settings.recipe.ts
  - web/src/modules/admin/components/showcase/Phase5Demos.tsx
  - web/src/modules/admin/components/showcase/Phase6Demos.tsx
  - web/src/modules/admin/components/showcase/ShowcaseDemos.tsx
  - web/src/modules/admin/components/showcase/showcaseCopy.ts
  - web/src/modules/admin/components/showcase/showcaseSections.ts
  - web/src/modules/admin/expensesCopy.ts
  - web/src/modules/admin/expensesSchemas.ts
  - web/src/modules/admin/guard.ts
  - web/src/modules/admin/hooks/useDeletedExpensesListParams.ts
  - web/src/modules/admin/hooks/useDeletedExpensesQuery.ts
  - web/src/modules/admin/hooks/useExpenseAction.ts
  - web/src/modules/admin/hooks/useExpenseCategoriesQuery.ts
  - web/src/modules/admin/hooks/useExpenseCategoryQuery.ts
  - web/src/modules/admin/hooks/useExpenseKpisQuery.ts
  - web/src/modules/admin/hooks/useExpenseQuery.ts
  - web/src/modules/admin/hooks/useExpensesListParams.ts
  - web/src/modules/admin/hooks/useExpensesQuery.ts
  - web/src/modules/admin/hooks/useRefreshCategories.ts
  - web/src/modules/admin/hooks/useRefreshExpenses.ts
  - web/src/modules/admin/hooks/useStaffLookupQuery.ts
  - web/src/modules/admin/pages/DeletedExpensesPage.tsx
  - web/src/modules/admin/pages/ExpensesPage.tsx
  - web/src/modules/admin/pages/SettingsPage.tsx
  - web/src/modules/admin/routes.tsx
  - web/src/modules/admin/sections.ts
  - web/src/modules/admin/services/expenseCategoriesService.ts
  - web/src/modules/admin/services/expensesService.ts
  - web/src/modules/admin/services/staffService.ts
  - web/src/modules/admin/settingsCopy.ts
  - web/src/utils/csps.ts
  - web/src/utils/format.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 6 Part C: Code Review Report (web client)

**Reviewed:** 2026-10-25
**Depth:** standard
**Files Reviewed:** 58
**Status:** issues_found

## Summary

I reviewed the Phase 6 web client: the Company Expenses list, the Deleted Expenses page, the Settings page, the expense and category modals, the hooks, the services, the zod schemas and the copy. I checked the code against the server rules in `ExpenseRules.cs`, `ExpenseFieldsValidator.cs`, `ListCompanyExpensesRequestValidator.cs` and `ExpenseCategoryFieldsValidator.cs`.

These parts held up when traced:

- **Query keys.** `expensesKey` (`company-expenses`) and `expensesDeletedKey` (`company-expenses-deleted`) are separate first segments. A prefix invalidation of one never hits the other. Both match the `[resource, 'list', params]` keys that `listKey` builds. The detail keys have their own roots and `gcTime: 0`.
- **Row version.** `ExpenseModal` and `CategoryModal` send the version of the record they opened with (`opened.version`). A refetch never replaces it. Only Load Latest replaces it, and only after the new data has arrived.
- **Idempotency.** The POSTs carry one key per submission through `useSubmission`. PUT and DELETE correctly send none.
- **Schema mirroring.** The zod schemas mirror the server rules: the 200, 1000 and 40 limits counted after the trim, the amount range and scale, the 30-day date limit counted from the server's `today`, and the date pair rules.
- **Money.** No total is computed in the browser. The totals, KPIs and period total are the server's numbers.
- **Conventions and unsafe HTML.** No em or en dash appears in any reviewed file (OR-4). No `fetch` or `apiClient` sits outside `services/` (OR-5). There is no `dangerouslySetInnerHTML` or `innerHTML`, and all user text renders as text nodes.
- **Accessibility.** The aria-disabled Save button swallows implicit Enter submission as well as clicks, because `Button.handleClick` calls `preventDefault`.

No Critical issues. There are 3 Warnings and 3 Info items. All of them are verified against the code.

## Warnings

### C-WR-01: Expense changes never refresh the category list, so Settings shows a stale usage count and a wrong Delete offer

**File:** `web/src/modules/admin/hooks/useRefreshExpenses.ts:7-14` (also `web/src/modules/admin/pages/ExpensesPage.tsx:343-345` and `:360-362`)
**Issue:** `ExpenseCategoryListItem.expenseCount` is the number of expenses using the category (soft-deleted ones included). `SettingsPage` shows it in the Expenses column (`SettingsPage.tsx:114`) and uses it to decide whether Delete is offered (`SettingsPage.tsx:155`). The shared QueryClient default is `staleTime: 30_000`, so `['expense-categories']` is not re-read on mount for 30 seconds.

Add expense and Delete permanently both change `expenseCount`. Neither invalidates `expenseCategoriesKey`:
- `useRefreshExpenses` (used by delete, restore and purge) invalidates only the KPIs, the deleted list and the lists.
- `ExpensesPage.saved` and `ExpensesPage.updated` invalidate only the same three keys.

Example: a Manager adds a category, records an expense in it, and opens Settings within 30 seconds. The row still shows 0 expenses and offers Delete. The server's 422 `expense-categories.in-use` path catches the click, but the count and button are wrong until the staleness window passes. After a purge, the count stays too high and Delete stays hidden.
**Fix:** Add the category key to the one shared refresh, and make the two page handlers use it. Invalidating an inactive query only marks it stale, so there is no extra request while Settings is closed.
```ts
// useRefreshExpenses.ts
import { expenseCategoriesKey } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
...
Promise.all([
  queryClient.invalidateQueries({ queryKey: expenseKpisKey }),
  queryClient.invalidateQueries({ queryKey: expensesDeletedKey }),
  queryClient.invalidateQueries({ queryKey: expensesKey }),
  queryClient.invalidateQueries({ queryKey: expenseCategoriesKey }),
]);
```
`useRefreshCategories` already awaits `useRefreshExpenses` plus the category key. It would then invalidate the category key twice. Drop its own `expenseCategoriesKey` line, or accept the duplicate.

### C-WR-02: A 404 on Add Expense is swallowed with no message

**File:** `web/src/modules/admin/components/ExpenseModal.tsx:250-253` (rendered only at `:523`)
**Issue:** `showFailure` treats every 404 as "this expense was deleted" and calls `setDeleted(true)`. In Edit mode, `gone` drives the "This expense was deleted" banner (`:523`). In Add mode the form is rendered bare (`:571`), so nothing reads `deleted`.

The POST can answer 404 (`CreateCompanyExpenseHandler` returns `ExpenseErrors.NotFound` when it cannot read the new row back; a missing route or proxy also gives 404). The user then gets no alert line, no toast and no focus change. The Save button just returns to normal and the typed values stay, so the person cannot tell whether the expense was saved.
**Fix:** Handle the 404 branch only in Edit mode, and let Add fall through to the generic line:
```ts
if (isEdit && isHttpError(error) && error.status === 404) {
  setDeleted(true);
  return;
}
```
The same guard fits the 403 `not-yours` branch above it, which is also Edit-only.

### C-WR-03: A 404 on Restore (Deleted page) or on Retire/Use again (Settings) leaves the stale row on screen

**File:** `web/src/modules/admin/pages/DeletedExpensesPage.tsx:229-237` and `web/src/modules/admin/pages/SettingsPage.tsx:265-271`
**Issue:** The Delete and Delete permanently flows treat a 404 as "someone else got there first": they close the dialog, toast "Already deleted" and re-read the lists (`ExpensesPage.tsx:396-406`, `PurgeExpenseDialog.tsx:38-51`, `SettingsPage.tsx:322-324`). The other single-click actions do not:
- `restore` on the Deleted page only shows a danger toast on any failure.
- `toggle` on Settings does the same.

If another Manager purges the expense (or deletes the category) first, Restore or Retire returns 404. The toast says "Couldn't restore X", but the row stays on screen and the list is not re-read. The next click gives the same 404 with a new key. The user has no way to tell the row is gone except by reloading.
**Fix:** In both handlers, re-read after a 404, the same way the dialogs do:
```ts
if (!outcome.ok) {
  if (isHttpError(outcome.error) && outcome.error.status === 404) {
    void refreshAll(); // Settings: void refresh();
  }
  ...toast
}
```

## Info

### C-IN-01: The shared URL parsers accept values the server rejects, so a hand-edited URL gives a 400 error state

**File:** `web/src/lib/url-state/parsers.ts:7-15` and `:243-253`; used by `useExpensesListParams.ts` and `useDeletedExpensesListParams.ts`
**Issue:**
- `pageParser` accepts any safe integer, but the server allows pages 1 to 100000 only (`ListUsersRequestValidator.MaxPage`, reused by the expense list validator). `/admin/expenses?page=100001` sends a request that is answered 400, and the table shows an error state. The page clamp (`clampPage`) runs only after a successful response, so the page does not heal. Retry resends the same request.
- `guidParser` accepts the all-zero GUID, which `ListCompanyExpensesRequestValidator.TryParseCategory` rejects. The unknown-category effect clears it, but only after the category list loads, and it flashes an error state first.

Neither is a security issue, since the server re-validates. This is an input-parsing gap on new list pages.
**Fix:** Cap the page parser at 100000 (or clamp it) and reject the empty GUID:
```ts
const MAX_PAGE = 100_000;
// parsePositiveInteger(...) ... number <= MAX_PAGE
// guidParser: GUID.test(value) && value !== '00000000-0000-0000-0000-000000000000'
```

### C-IN-02: The two list query keys exist as string literals in two files each, so the invalidation roots can drift apart silently

**File:** `web/src/modules/admin/hooks/useExpensesQuery.ts:11` and `:18`; `web/src/modules/admin/hooks/useDeletedExpensesQuery.ts:9`
**Issue:** `useExpensesQuery` passes the literal `'company-expenses'` to `useListQuery` while `expensesKey = ['company-expenses']` is declared separately. `useDeletedExpensesQuery` uses the literal `'company-expenses-deleted'`, while `expensesDeletedKey` is declared in a different file (`useExpensesQuery.ts`, after the hook). Today they agree. Renaming one side would break every post-mutation refresh with no type error and no failing build.
**Fix:** Derive each literal from its exported key (`key: expensesKey[0]`, and move `expensesDeletedKey` into `useDeletedExpensesQuery.ts` and use `expensesDeletedKey[0]`).

### C-IN-03: `ExpensesPage` repeats the three refresh calls instead of using `refreshAll`

**File:** `web/src/modules/admin/pages/ExpensesPage.tsx:343-345` and `:360-362`
**Issue:** `saved` and `updated` each call `invalidateQueries` three times by hand, while the page already holds `refreshAll = useRefreshExpenses()` (`:245`) for delete. This is how the delete path and the save path ended up with the same gap as C-WR-01: a fix in one place does not reach the other. It also needs the `expenseKpisKey`, `expensesDeletedKey` and `expensesKey` imports in the page.
**Fix:** Call `void refreshAll().then(...)` in both handlers (the `.then` focus logic stays). After this, the page needs no direct `queryClient.invalidateQueries`, but `updated` still uses `queryClient.getQueriesData`.

---

_Reviewed: 2026-10-25_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
