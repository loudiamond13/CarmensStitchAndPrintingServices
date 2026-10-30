// The words of the payment window and the Payments tab actions (UI-SPEC O2 Payment, Validation rows for payments, Child row delete,
// D-09, D-11, D-29, D-48, D-54a; plan 08-16): one module, no wording in JSX. The error lines are the server's own words
// (OrderRules.cs). Strings the spec names are verbatim; new ones are SPEC-GAP for the owner's review. No long dash (OR-4).
import { formatPeso } from '@/utils/csps';

export const ORDER_PAYMENT_COPY = {
  add: 'Add Payment',
  addTitle: 'Add Payment',
  editTitle: 'Edit Payment',
  save: 'Save Payment',
  date: 'Date',
  amount: 'Amount',
  /** The helper under Amount: the most that can be paid, from the server's figures (a preview). */
  balanceDue: (amount: string): string => `Balance due: ${formatPeso(amount)}`,
  reference: 'Reference no.',
  referencePlaceholder: 'GCash / Maya / bank ref.',
  notes: 'Notes',
  receivedBy: 'Received by',
  /** SPEC-GAP: the line under Received by (D-09, D-11). */
  receivedByHint: 'The staff member who took the money.',
  /** The row action names and the delete question (D-54a). */
  editAction: (amount: string, date: string): string => `Edit payment of ${formatPeso(amount)}, ${date}`,
  deleteAction: (amount: string, date: string): string => `Delete payment of ${formatPeso(amount)}, ${date}`,
  deleteTitle: (amount: string): string => `Delete payment of ${formatPeso(amount)}?`,
  deleteConfirm: 'Delete Payment',
  /** The words the delete dialog shows when the payment is already gone. */
  deleteGone: 'This payment was removed.',
  errors: {
    dateRequired: 'Enter the payment date.',
    dateInvalid: 'Enter a real date.',
    dateInFuture: "The payment date can't be in the future.",
    amountRequired: 'Enter the amount.',
    amountOutOfRange: 'Enter an amount from ₱0.01 to ₱1,000,000.00.',
    moneyDecimals: 'Use at most 2 decimal places.',
    /** The most that may be paid; the server answers the same words (OrderRules.PaymentAboveBalance). */
    overBalance: (allowed: string): string => `This is more than the balance. Enter ${formatPeso(allowed)} or less.`,
    nothingOwed: 'Nothing is owed on this order.',
    methodRequired: 'Choose a payment method.',
    referenceTooLong: 'Keep the reference to 100 characters or fewer.',
    notesTooLong: 'Keep notes to 500 characters or fewer.',
    receivedByRequired: 'Choose who received the money.',
    /** The server's 422 for a payment change that would leave the payments below the refunds (OrderRules.PaymentBelowRefundsMessage). */
    belowRefunds: 'The refunds would be more than the payments. Lower or remove a refund first.',
  },
} as const;
