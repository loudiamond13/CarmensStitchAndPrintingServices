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
