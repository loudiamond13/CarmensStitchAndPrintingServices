// The words of Company Expenses (UI-SPEC Copywriting Contract, E1; plan 06-04): one module, no wording in JSX. App. E.11
// strings are verbatim except where OQ-13 amends them; the rest are SPEC-GAP wording the owner reviews. No long dash (OR-4).
export const EXPENSES_COPY = {
  /** The document title is "{title} · CSPS Admin". */
  documentTitle: 'Company Expenses',
  title: 'Company Expenses',
  // SPEC-DEVIATION: OQ-13 the subline names the order-expense split in plain words (§8.8 had a dash).
  subline:
    'General business costs like rent, bills, payroll and supplies. Costs for a specific order go inside that order.',
  /** The table's name for assistive technology, and the plural and singular nouns of the list. */
  tableCaption: 'Company expenses',
  thing: 'expense',
  things: 'expenses',
  /** The result bar reads "Showing 12 expenses · newest first". */
  orderNote: 'newest first',
  // SPEC-GAP: the badge under the date of an expense that is still ahead (D-23).
  upcoming: 'Upcoming',
  /** The toolbar's search (App. E.11): it matches the description and the Recorded by and Paid by names. */
  search: { label: 'Search', placeholder: 'Description or staff name' },
  columns: {
    date: 'Date',
    category: 'Category',
    description: 'Description',
    amount: 'Amount',
    paidBy: 'Paid by',
    recordedBy: 'Recorded by',
  },
  footer: {
    /** The phone label of the period total (OQ-13: it covers every page, so "Total shown" would mislead). */
    totalLabel: 'Total',
    /** "45 expenses · Sep 25, 2026 to Nov 24, 2026" */
    summary: (count: number, thing: string, things: string, from: string, to: string): string =>
      `${String(count)} ${count === 1 ? thing : things} · ${from} to ${to}`,
  },
  // SPEC-DEVIATION: OQ-13 the first-use message names the window the server used. Its Add Expense action arrives with plan 06-12.
  empty: {
    title: 'No expenses recorded',
    message: (from: string, to: string): string =>
      `Nothing is recorded from ${from} to ${to}. Log rent, bills, payroll and supplies here to see monthly totals and where the money goes.`,
  },
  // SPEC-GAP: the caption under the table.
  caption: 'The total covers every page of this list for the filters above. Deleted expenses never count.',
} as const;
