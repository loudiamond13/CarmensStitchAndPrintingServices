// The words of the discount window and the Discounts tab actions (UI-SPEC O2 Discount, Validation rows for discounts, Child row delete,
// D-15, D-54a; plan 08-17): one module, no wording in JSX. The error lines are the server's own words (OrderRules.cs). Strings the spec
// names are verbatim; new ones are SPEC-GAP for the owner's review. No long dash (OR-4).
import { formatPeso } from '@/utils/csps';

export const ORDER_DISCOUNT_COPY = {
  add: 'Add Discount',
  addTitle: 'Add Discount',
  editTitle: 'Edit Discount',
  save: 'Save Discount',
  reason: 'Reason',
  reasonPlaceholder: 'e.g. Barangay league discount',
  type: 'Type',
  fixedOption: 'Fixed ₱',
  percentOption: 'Percent %',
  value: 'Value',
  /** The helper under Value: what the discount comes to on the server's items total (a preview). */
  computedAmount: (amount: string): string => `Computed amount: ${formatPeso(amount)}`,
  /** The row action names and the delete question (D-54a). */
  editAction: (reason: string): string => `Edit discount, ${reason}`,
  deleteAction: (reason: string): string => `Delete discount, ${reason}`,
  deleteTitle: (reason: string): string => `Delete discount "${reason}"?`,
  deleteConfirm: 'Delete Discount',
  /** The words the delete dialog shows when the discount is already gone. */
  deleteGone: 'This discount was removed.',
  errors: {
    kindInvalid: 'Choose fixed or percentage.',
    valueRequired: 'Enter a discount value.',
    fixedOutOfRange: 'Enter a discount from ₱0.01 to ₱1,000,000.00.',
    percentOutOfRange: 'Enter a percentage above 0 and up to 100.',
    moneyDecimals: 'Use at most 2 decimal places.',
    reasonRequired: 'Enter a reason for the discount.',
    reasonTooLong: 'Keep the reason to 100 characters or fewer.',
    /** The server's 422 for discounts above the items total (OrderRules.DiscountAboveSubtotalMessage). */
    aboveSubtotal: 'The discounts would be more than the items total. Lower or remove a discount first.',
  },
} as const;
