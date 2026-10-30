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
} as const;
