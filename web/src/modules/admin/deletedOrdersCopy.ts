// The words of Deleted Orders and the permanent delete (UI-SPEC "X1 Deleted Orders" and Copywriting Contract; plan 08-20): one module,
// no wording in JSX. Strings the spec names are verbatim; the rest are SPEC-GAP wording the owner reviews. No long dash (OR-4).

export const DELETED_ORDERS_COPY = {
  documentTitle: 'Deleted Orders',
  title: 'Deleted Orders',
  badge: 'Manager only',
  back: 'Back to Orders',
  /** The Manager's secondary link in the Orders header. */
  link: 'Deleted Orders',
  subline:
    "Deleted orders don't count in lists, totals or balances. Restore one to count it again, or delete it permanently.",
  tableCaption: 'Deleted orders',
  thing: 'deleted order',
  things: 'deleted orders',
  orderNote: 'most recently deleted first',
  columns: {
    deleted: 'Deleted',
    order: 'Order',
    customer: 'Customer',
    status: 'Status',
    total: 'Total',
    paid: 'Paid',
    balance: 'Balance',
    deletedBy: 'Deleted by',
    actions: 'Actions',
  },
  empty: {
    title: 'No deleted orders',
    message: 'When someone deletes an order, it shows here until a Manager restores it or deletes it permanently.',
  },
  view: (number: string): string => `View deleted order ${number}`,
  /** Restore acts at once (D-23): no confirmation, and the toast states the effect. */
  restore: {
    label: (number: string): string => `Restore order ${number}`,
    toast: {
      title: 'Order restored',
      message: (number: string): string => `${number} counts in lists and totals again.`,
    },
    failed: (number: string): string => `Couldn't restore ${number}`,
  },
  /** Delete for good (07 D-28, D-57): the counts first, then the typed order number. */
  purge: {
    rowLabel: (number: string): string => `Delete order ${number} permanently`,
    title: (number: string): string => `Delete ${number} permanently?`,
    message: (team: string | null, customer: string): string =>
      `${team === null || team === '' ? customer : `${team} · ${customer}`}. The order and everything inside it are removed for good.`,
    confirm: 'Delete Order Permanently',
    pending: 'Deleting',
    toast: { title: 'Order permanently deleted', message: (number: string): string => number },
    /** The server's 400 on `confirm`, in plain words. */
    wrongNumber: 'Type the order number exactly to delete it for good.',
    /** SPEC-GAP: what a screen reader hears while the counts load. */
    countsLoading: 'Reading what this order holds',
    /** SPEC-GAP: the counts could not be read, so the confirm stays off. */
    countsFailed: "Couldn't read what this order holds. Close this and try again.",
  },
  /** A permanent delete that meets an order someone else removed first (404): the dialog closes and the list is read again. */
  alreadyGone: {
    title: 'Already gone',
    message: 'This order was already deleted for good. The list is up to date.',
  },
} as const;
