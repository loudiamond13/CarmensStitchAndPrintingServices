---
phase: 06-company-expenses
baseline: 06-UI-SPEC.md, with owner rulings D-54 to D-59
overall: 20/24
status: provisional
created: 2026-10-26T05:56:00-05:00
updated: 2026-10-26T05:56:00-05:00
---

# Phase 6 UI review

## Scope and limits

- Baseline: `06-UI-SPEC.md`. The owner confirmed every OQ default (D-54) and approved all wording as built (D-55).
- Screenshots: the owner-review set in `artifacts/owner-review/phase6-review/` (local only). The auditor opened 4 of 102: E1 Manager list light 1440, E1 Manager list dark 390, S1 categories light 820, E2 edit conflict dark 390. No server was started.
- Code read: the 12 Phase 6 files under `web/src/modules/admin/` listed below.
- The dash check (OR-4) was not repeated here. `no-long-dash.node.test.ts` enforces it.
- Scores are provisional because only 4 screenshots were viewed.

## Scores

| Pillar | Score | Key finding |
|---|---|---|
| Copywriting | 3/4 | Copy matches the contract and the owner approved it. Counts lack a thousands separator. |
| Visuals | 3/4 | Clear focal point and hierarchy. S1 row action icons do not line up. |
| Color | 3/4 | Tones follow the contract. Accent use is correct in the shots seen. |
| Typography | 4/4 | No raw size or weight classes in the phase files; recipes only. |
| Spacing | 4/4 | No arbitrary values, inline styles or hard-coded colors in the phase files. |
| Experience Design | 3/4 | State coverage is strong. Required markers and the date input format fall short. |

**Overall: 20/24.** No blocker. Five warnings.

## Findings

| ID | Pillar | Finding | Evidence | Suggested fix |
|---|---|---|---|---|
| UI-06-01 | Experience Design | Category and Paid by have no required asterisk in the Expense modal, while Date, Description and Amount do. | Confirmed in code: `components/forms/Select.tsx` renders the label without the " *" mark that `Field` adds; `ExpenseCategorySelect` and `PaidBySelect` pass `required`. Screenshot `e2-edit-conflict-dark-390`. | Give `Select` the same aria-hidden " *" mark as `Field` when `required` is set. This touches every Select in the app. |
| UI-06-02 | Experience Design, Copywriting | The From and To filters and the modal Date show the browser's numeric date (`09/26/2026`), while the table and chips show "Sep 26, 2026". | Native date input; the format follows the browser locale. | Record a deviation for the native control, or show the formatted date next to it. |
| UI-06-03 | Visuals | On S1 at 820 px the row action icons do not line up: Edit and Retire shift left on rows that also have Delete, and the last icon sits close to the card edge. | Screenshot `s1-categories-light-820`. | Give the actions cell a fixed three-slot width. |
| UI-06-04 | Copywriting | Counts have no thousands separator: "1687 entries so far" (KPI card) and "1235" (Settings Expenses column). Money has one. | Confirmed in code: `ExpenseKpiRow.tsx:46`, `SettingsPage.tsx:114` use the bare number. | Format counts with the en-PH number format. |
| UI-06-05 | Visuals | On E1 at 1440 px the Search label sits about 2 px lower than the Category, From and To labels. | Screenshot `e1-manager-list-light-1440`. | Align the toolbar label baselines. |

Minor notes:
- The header comments in `ExpensesPage.tsx`, `SettingsPage.tsx` and `ExpenseModal.tsx` run several lines; OR-2 asks for minimal comments.
- The review data is crowded with test fixtures (for example "Abaca 05defb83"). A data issue, not a UI defect.

## What holds up

- E1: the Manager sees "Deleted Expenses" and one primary "Add Expense"; the Upcoming badge, "(former staff)" and the three Manager row icons are correct; the footer reads "13 expenses · Sep 26, 2026 to Nov 25, 2026" with the total and caption; at 390 px the table becomes stacked cards with the label "Total"; no horizontal scroll in the shots seen.
- S1: the "Manager only" badge and the Manager nav tag show; retired rows use the surface-2 shade; Others shows "Always listed last" with Edit only; Delete appears only on rows with no expenses.
- E2: the stale-save banner copy and "Load Latest" are correct; on a phone the modal is a bottom sheet with the footer buttons reachable.
- Code: every row action has a `title` and a per-row name; copy lives in `expensesCopy.ts` and `settingsCopy.ts`.

## Files audited

Under `web/src/modules/admin/`: `pages/ExpensesPage.tsx`, `pages/DeletedExpensesPage.tsx`, `pages/SettingsPage.tsx`, `components/ExpenseModal.tsx`, `components/CategoryModal.tsx`, `components/CategoryBadge.tsx`, `components/ExpenseKpiRow.tsx`, `components/PurgeExpenseDialog.tsx`, `components/ExpenseActorCell.tsx`, `components/ExpensesDateRange.tsx`, `components/PaidBySelect.tsx`, `components/ExpenseCategorySelect.tsx`.

## Outcomes

Owner ruling D-60 (2026-10-26): fix all five warnings and trim the long header comments before Phase 6 closes. For UI-06-02, show the friendly date beside the native date box. Each finding's final outcome (fixed, with commit) is added when the quick task lands.
