// The words of the order screens (UI-SPEC Copywriting Contract; plan 08-05): one module, no wording in JSX. Later order plans
// extend this object. Strings the spec names are verbatim. No long dash (OR-4).
import { formatCount } from '@/utils/format';

export const ORDERS_COPY = {
  /** The Orders list (L1, plan 08-06). */
  list: {
    documentTitle: 'Orders',
    title: 'Orders',
    /** D-41: every non-deleted order and the active ones, from the list response (en-PH thousands, "1 order"). */
    subline: (all: number, active: number): string =>
      `${formatCount(all)} ${all === 1 ? 'order' : 'orders'} · ${formatCount(active)} active`,
    newOrder: 'New Order',
    /** The visually hidden heading above the results (D-54e). */
    results: 'Results',
    /** The singular and plural noun of the list, for the loading words, the load error and the result bar. */
    thing: 'order',
    things: 'orders',
    /** The toolbar (D-55). */
    search: { label: 'Search', placeholder: 'Order no., customer, team or phone' },
    /** The result bar's " · sorted by {word}" for each sort. */
    sortedBy: { due: 'due date', newest: 'newest first', balance: 'balance', total: 'total' },
    /** The chip names; each clear button reads "Clear {name} filter" (D-54f). */
    chips: { search: 'Search', status: 'Status', dates: 'Dates', product: 'Product' },
    /** Status: the default choice and "All statuses"; the seven statuses use the shared status words. */
    status: { label: 'Status', active: 'Active + recent', all: 'All statuses' },
    /** Order date (D-42: starts at Any date). The custom range inputs apply once both dates are real (UIC-45). */
    dates: {
      label: 'Order date',
      any: 'Any date',
      presets: { '30d': 'Last 30 days', '90d': 'Last 90 days', month: 'This month' },
      custom: 'Custom range…',
      from: 'From',
      to: 'To',
      /** The Dates chip for a custom range: "Oct 1, 2026 to Oct 31, 2026". */
      range: (from: string, to: string): string => `${from} to ${to}`,
      errors: { notReal: 'Enter a real date.', rangeOrder: "The end date can't be before the start date." },
    },
    /** "Only orders with a balance" (D-43) and its chip, which reads without a colon and clears as "balance". */
    balance: { label: 'Only orders with a balance', chip: 'Has a balance', clearName: 'balance' },
    /**
     * The words after "No orders with" in the No matches message (UIC-2): "status Delivered and a balance". The search has its
     * own wording in the shared list copy.
     */
    noMatches: {
      status: (label: string): string => `status ${label}`,
      dates: (value: string): string => `dates ${value}`,
      product: (name: string): string => `product ${name}`,
      balance: 'a balance',
      /** "a", "a and b", "a, b and c". */
      join: (parts: readonly string[]): string =>
        parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1] ?? ''}`,
    },
    /** While the product types load, the Product chip reads this. */
    productLoading: 'Loading…',
    sort: {
      label: 'Sort by',
      due: 'Due date (soonest)',
      newest: 'Newest first',
      balance: 'Balance (highest)',
      total: 'Total (highest)',
    },
    /** The first-use state: the default view has no rows (D-55). */
    empty: {
      title: 'No active orders',
      message:
        'Orders in progress, and orders finished or cancelled in the last 30 days, show here. Older orders are under All statuses.',
    },
  },
  /** The due date and its flag (D-36 to D-38). The empty value is the EmptyValue icon, not text. */
  due: {
    label: 'Due',
    date: (date: string): string => `Due ${date}`,
    daysLeft: (n: number): string => `${formatCount(n)} days left`,
    tomorrow: 'Due tomorrow',
    today: 'Due today',
    overdue: (n: number): string => (n === 1 ? 'Overdue by 1 day' : `Overdue by ${formatCount(n)} days`),
    /** Joins the date and the flag on one line. */
    separator: ' · ',
  },
} as const;
