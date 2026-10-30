// The words of the order page (UI-SPEC Copywriting Contract, O1; plan 08-10): one module, no wording in JSX. Later order page
// plans extend this object. Strings the spec names are verbatim. No long dash (OR-4).
import { formatCount } from '@/utils/format';

export const ORDER_PAGE_COPY = {
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
} as const;
