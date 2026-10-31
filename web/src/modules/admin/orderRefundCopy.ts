// The words of the refund window and the Refunds tab actions (UI-SPEC O2 Refund, Validation rows for refunds, Child row delete,
// D-10, D-11, D-19, D-54a; plan 08-21): one module, no wording in JSX. The error lines are the server's own words (OrderRules.cs).
// Strings the spec names are verbatim; new ones are SPEC-GAP for the owner's review. No long dash (OR-4).
import { formatPeso } from '@/utils/csps';

const CAN_REFUND_LEAD = 'You can refund up to';
const CAN_REFUND_TAIL = '.';

export const ORDER_REFUND_COPY = {
  add: 'Add Refund',
  addTitle: 'Add Refund',
  editTitle: 'Edit Refund',
  save: 'Save Refund',
  date: 'Date',
  amount: 'Amount',
  reason: 'Reason',
  refundedBy: 'Refunded by',
  /** SPEC-GAP: the line under Refunded by (D-10, D-11). */
  refundedByHint: 'The staff member who handed the money back.',
  /** The helper under Amount, and the tab caption's second sentence: the most that can be refunded (a preview). */
  canRefundLead: CAN_REFUND_LEAD,
  canRefundTail: CAN_REFUND_TAIL,
  canRefund: (amount: string): string => `${CAN_REFUND_LEAD} ${formatPeso(amount)}${CAN_REFUND_TAIL}`,
  /** The row action names and the delete question (D-54a). */
  editAction: (amount: number | string, date: string): string => `Edit refund of ${formatPeso(amount)}, ${date}`,
  deleteAction: (amount: number | string, date: string): string => `Delete refund of ${formatPeso(amount)}, ${date}`,
  deleteTitle: (amount: number | string): string => `Delete refund of ${formatPeso(amount)}?`,
  deleteConfirm: 'Delete Refund',
  /** The words the delete dialog shows when the refund is already gone. */
  deleteGone: 'This refund was removed.',
  errors: {
    dateRequired: 'Enter the refund date.',
    dateInvalid: 'Enter a real date.',
    dateInFuture: "The refund date can't be in the future.",
    amountRequired: 'Enter the amount.',
    amountOutOfRange: 'Enter an amount from ₱0.01 to ₱1,000,000.00.',
    moneyDecimals: 'Use at most 2 decimal places.',
    /** The most that may be refunded on an order that is not cancelled (OrderRules.RefundAboveCredit). */
    overCredit: (allowed: string): string =>
      `This is more than the customer credit. Enter ${formatPeso(allowed)} or less.`,
    /** The most that may be refunded on a Cancelled order (OrderRules.RefundAboveKept). */
    overKept: (allowed: string): string =>
      `This is more than was paid and not yet refunded. Enter ${formatPeso(allowed)} or less.`,
    /** A Cancelled order with everything paid already handed back (OrderRules.NothingToRefund). */
    nothingToRefund: 'Everything that was paid has already been refunded.',
    reasonRequired: 'Add a short reason for the refund.',
    reasonTooLong: 'Keep the reason to 200 characters or fewer.',
    refundedByRequired: 'Choose who handed the money back.',
  },
} as const;
