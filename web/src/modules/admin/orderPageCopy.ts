// The words of the order page (UI-SPEC Copywriting Contract, O1; plan 08-10): one module, no wording in JSX. Later order page
// plans extend this object. Strings the spec names are verbatim. No long dash (OR-4).
import { formatCount } from '@/utils/format';

export const ORDER_PAGE_COPY = {
  /** The document title before the order number is known. */
  documentTitle: 'Order',
  /** The page states (UI-SPEC O1 Loading and error). */
  states: {
    /** The noun the loading announcements use: "Loading order…" and "Order loaded.". */
    things: 'order',
    loadFailed: "Couldn't load this order.",
    notFound: 'This order was not found or was deleted.',
    backToOrders: 'Back to Orders',
  },
  /** The header (`.s-ph`). */
  header: {
    back: 'Orders',
    editDetails: 'Edit Details',
    ordered: (date: string): string => `Ordered ${date}`,
    /** Joins the parts of the subline. */
    separator: ' · ',
  },
  /** The locked-order banner of a Completed or Cancelled order (D-15). */
  locked: {
    title: (status: 'completed' | 'cancelled'): string => `This order is ${status}.`,
    reopen: 'Reopen it to make changes.',
    refunds: 'Refunds can still be recorded on the Refunds tab.',
  },
  /** The Images card (D-27): Phase 9 replaces its body with the gallery. */
  images: {
    title: 'Images',
    hint: 'Mockups and reference photos.',
    soon: 'Image uploads are coming soon.',
  },
  /** The visually hidden heading of the totals panel, which the phone balance card scrolls to (D-33). */
  totals: 'Totals',
  /** The tab card: one label per tab, shown with its count. */
  tabs: {
    items: 'Items',
    payments: 'Payments',
    discounts: 'Discounts',
    expenses: 'Expenses',
    refunds: 'Refunds',
  },
  /** The Items tab. */
  items: {
    title: 'Order items',
    caption: 'Quantity × unit price. Changes update the total instantly.',
    things: 'items',
    columns: {
      product: 'Product',
      description: 'Description',
      size: 'Size',
      quantity: 'Qty',
      unitPrice: 'Unit price',
      lineTotal: 'Line total',
      actions: 'Actions',
    },
    /** The phone label of the footer's first cell. */
    footerLabel: 'Subtotal',
    subtotal: (pieces: number): string => `Items subtotal · ${formatCount(pieces)} pcs`,
  },
  /** The Payments tab (D-09, D-12). */
  payments: {
    title: 'Payments',
    things: 'payments',
    /** The caption's lead-in; the balance sentence follows it. */
    captionLead: 'Downpayments and settlements.',
    balanceDue: 'Balance due:',
    customerCredit: 'Customer credit:',
    settled: 'Nothing is owed on this order.',
    columns: {
      date: 'Date',
      method: 'Method',
      reference: 'Reference no.',
      notes: 'Notes',
      receivedBy: 'Received by',
      recordedBy: 'Recorded by',
      amount: 'Amount',
      actions: 'Actions',
    },
    footerLabel: 'Total paid',
    /** The phone label of the footer's amount cell. */
    footerAmountLabel: 'Total',
    empty: 'No payments recorded yet.',
  },
  /** The Discounts tab. */
  discounts: {
    title: 'Discounts',
    things: 'discounts',
    caption: 'Percentages apply to the items total.',
    columns: { reason: 'Reason', type: 'Type', value: 'Value', amount: 'Amount', actions: 'Actions' },
    percentage: 'Percentage',
    fixed: 'Fixed amount',
    footerLabel: 'Total discount',
    footerAmountLabel: 'Total',
    empty: 'No discounts yet.',
  },
  /** The Expenses tab (internal costs, D-12). */
  expenses: {
    title: 'Expenses',
    things: 'expenses',
    caption: 'Internal costs for this order. Not shown to the customer.',
    columns: {
      date: 'Date',
      category: 'Category',
      description: 'Description',
      paidBy: 'Paid by',
      recordedBy: 'Recorded by',
      amount: 'Amount',
      actions: 'Actions',
    },
    footerLabel: 'Order expenses',
    footerAmountLabel: 'Total',
    empty: 'No expenses recorded yet.',
  },
  /** The customer card (UI-SPEC O1 Side 2). */
  customer: {
    title: 'Customer',
    editDetails: 'Edit Details',
    name: 'Name',
    team: 'Team',
    contact: 'Contact',
    email: 'Email',
    address: 'Address',
  },
  /** The status history card (D-17, D-50). */
  history: {
    title: 'Status history',
    /** The row for the first status of an order. */
    createdAs: (status: string): string => `Created as ${status}`,
    move: (from: string, to: string): string => `${from} to ${to}`,
    /** Joins the name and the date. */
    separator: ' · ',
    showAll: (count: number): string => `Show All ${formatCount(count)}`,
    showFewer: 'Show Fewer',
  },
  /** The slim balance card of phones (D-33). */
  strip: {
    total: 'Total',
    balanceDue: 'Balance due',
    notCollected: 'Not collected',
    fullyPaid: 'Fully Paid',
    credit: (amount: string): string => `Credit ${amount}`,
    /** The button's name: the total, then the balance state, then what the button does. */
    nameDue: (total: string, due: string): string => `Total ${total}, balance due ${due}. Show totals.`,
    nameNotCollected: (total: string, unpaid: string): string =>
      `Total ${total}, not collected ${unpaid}. Show totals.`,
    namePaid: (total: string): string => `Total ${total}, fully paid. Show totals.`,
    nameCredit: (total: string, credit: string): string => `Total ${total}, customer credit ${credit}. Show totals.`,
  },
  /** The Refunds tab (D-10, D-12). */
  refunds: {
    title: 'Refunds',
    things: 'refunds',
    caption: 'Money handed back to the customer.',
    columns: {
      date: 'Date',
      reason: 'Reason',
      refundedBy: 'Refunded by',
      recordedBy: 'Recorded by',
      amount: 'Amount',
      actions: 'Actions',
    },
    footerLabel: 'Total refunded',
    footerAmountLabel: 'Total',
    empty: 'No refunds recorded yet.',
  },
} as const;
