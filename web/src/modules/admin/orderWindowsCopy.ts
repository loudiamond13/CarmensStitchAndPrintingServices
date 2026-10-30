// The words of the order windows (UI-SPEC O2, Child row delete, Toasts, Discard changes guard; plan 08-14): one module, no wording in JSX.
// The shared window words come first; the item words follow, and the payment, discount, expense and refund plans add theirs. Strings
// the spec names are verbatim; new ones are SPEC-GAP for the owner's review. No long dash (OR-4).
import { formatCount } from '@/utils/format';

/** The things an order window saves, as the toast titles name them. */
export type OrderThing = 'item' | 'payment' | 'discount' | 'expense' | 'refund';

/** What happened to it. */
export type OrderVerb = 'added' | 'updated' | 'deleted';

const THING_TITLES: Readonly<Record<OrderThing, string>> = {
  item: 'Item',
  payment: 'Payment',
  discount: 'Discount',
  expense: 'Expense',
  refund: 'Refund',
};

export const ORDER_WINDOWS_COPY = {
  /** The window description under the title: "{ORD-2026-0148} · {team or customer}". */
  description: (number: string, who: string): string => `${number} · ${who}`,
  cancel: 'Cancel',
  /** The save button's words while the request runs. */
  saving: 'Saving',
  /** The "Discard changes?" dialog over a dirty window (D-58). */
  discard: {
    title: 'Discard changes?',
    message: "What you typed in this window hasn't been saved. If you close it now, it's lost.",
    keep: 'Keep Editing',
    discard: 'Discard Changes',
  },
  /** The polite line after Load Latest on an edit window. */
  latestLoaded: 'Latest version loaded. Make your changes again.',
  /** The banner of a window whose record is gone (404). */
  removed: (thing: OrderThing): { title: string; body: string } => ({
    title: `This ${thing} was removed.`,
    body: 'Close this and check the order.',
  }),
  /** The banner of a window whose order is gone (404 orders.not-found). */
  orderRemoved: { title: 'This order was removed.', body: 'Close this and check the order.' },
  /** The toast: the title names the thing, the message names the new balance (D-05). */
  toast: {
    title: (thing: OrderThing, verb: OrderVerb): string => `${THING_TITLES[thing]} ${verb}`,
    balance: (amount: string): string => `Balance now ${amount}.`,
    fullyPaid: 'Order is now fully paid.',
    credit: (amount: string): string => `Customer credit now ${amount}.`,
    expenses: (amount: string): string => `Order expenses now ${amount}.`,
  },
  /** The child row delete dialog (UI-SPEC Child row delete). */
  remove: {
    message: (number: string): string => `This removes it from ${number} and updates the totals right away.`,
    pending: 'Deleting',
    cancel: 'Cancel',
  },
  /** The Items tab. */
  item: {
    add: 'Add Item',
    addTitle: 'Add Item',
    editTitle: 'Edit Item',
    save: 'Save Item',
    productType: 'Product type',
    sizeVariant: 'Size / variant',
    sizeVariantPlaceholder: 'e.g. S-XL',
    description: 'Description',
    descriptionPlaceholder: 'e.g. Jersey top, sublimated',
    quantity: 'Quantity',
    unitPrice: 'Unit price',
    lineTotal: (amount: string): string => `Line total: ${amount}`,
    /** The row action names (D-54a). */
    editAction: (n: number, description: string): string => `Edit item ${formatCount(n)}, ${description}`,
    deleteAction: (n: number, description: string): string => `Delete item ${formatCount(n)}, ${description}`,
    deleteTitle: (description: string): string => `Delete item "${description}"?`,
    deleteConfirm: 'Delete Item',
    /** The note that stands in for Delete when one item is left (D-48). */
    lastItemNote: "An order needs at least one item, so the last one can't be deleted.",
    /** The words the load failure line of a delete uses when the item is already gone. */
    deleteGone: 'This item was removed.',
  },
} as const;
