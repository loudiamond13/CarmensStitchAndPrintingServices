// The words of the order expense window and the Expenses tab actions (UI-SPEC O2 Expense, Validation rows for expenses, Child row delete,
// D-12, D-30, D-54a; plan 08-18): one module, no wording in JSX. The error lines are the server's own words (ExpenseRules.cs,
// OrderRules.cs). Strings the spec names are verbatim; new ones are SPEC-GAP for the owner's review. No long dash (OR-4).
import { formatPeso } from '@/utils/csps';

export const ORDER_EXPENSE_COPY = {
  add: 'Add Expense',
  addTitle: 'Add Expense',
  editTitle: 'Edit Expense',
  save: 'Save Expense',
  date: 'Date',
  dateHint: "Up to 30 days ahead is fine for a cost you'll pay soon.",
  description: 'Description',
  descriptionPlaceholder: 'e.g. Dri-fit mesh, 45 yds',
  amount: 'Amount',
  /** The row action names and the delete question (D-54a). */
  editAction: (amount: number | string, date: string): string => `Edit expense of ${formatPeso(amount)}, ${date}`,
  deleteAction: (amount: number | string, date: string): string => `Delete expense of ${formatPeso(amount)}, ${date}`,
  deleteTitle: (amount: number | string): string => `Delete expense of ${formatPeso(amount)}?`,
  deleteConfirm: 'Delete Expense',
  /** The words the delete dialog shows when the expense is already gone. */
  deleteGone: 'This expense was removed.',
  errors: {
    dateRequired: 'Enter the date.',
    dateInvalid: 'Enter a real date.',
    /** "Choose a date up to 30 days from today, Nov 28, 2026 at the latest." */
    dateTooFar: (latest: string): string => `Choose a date up to 30 days from today, ${latest} at the latest.`,
    categoryRequired: 'Choose a category.',
    descriptionTooLong: 'Keep the description to 200 characters or fewer.',
    amountTooSmall: 'Enter an amount greater than ₱0.00.',
    amountTooLarge: 'Enter an amount of ₱1,000,000.00 or less.',
    moneyDecimals: 'Use at most 2 decimal places.',
    paidByRequired: 'Choose who paid.',
  },
} as const;
