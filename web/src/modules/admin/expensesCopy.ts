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
  category: {
    label: 'Category',
    all: 'All categories',
    loading: 'Loading categories…',
    /** A retired category stays in the filter, marked (D-11). */
    retired: (name: string): string => `${name} (retired)`,
    // SPEC-GAP: the chip's value for an id the list could not name (the categories failed to load).
    unknown: 'Unknown category',
  },
  dates: {
    from: 'From',
    to: 'To',
    chip: 'Dates',
    /** The chip's value: "Oct 1, 2026 to Oct 31, 2026". */
    range: (from: string, to: string): string => `${from} to ${to}`,
  },
  /** What the no-matches message names after the search: "category Rent and dates Oct 1, 2026 to Oct 31, 2026". */
  filterSummary: (category: string | null, dates: string | null): string =>
    [category === null ? null : `category ${category}`, dates === null ? null : `dates ${dates}`]
      .filter((part): part is string => part !== null)
      .join(' and '),
  /** Under the From and To inputs (UI-SPEC Validation). */
  errors: {
    notReal: 'Enter a real date.',
    rangeOrder: 'The start date must be on or before the end date.',
  },
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
  /** The month KPI cards (App. E.11); the feet for one and for no entries are SPEC-GAP wording. The month is the server's. */
  kpis: {
    thisMonth: (month: string | null): string => (month === null ? 'This month' : `This month · ${month}`),
    lastMonth: (month: string | null): string => (month === null ? 'Last month' : `Last month · ${month}`),
    topCategory: (month: string | null): string => (month === null ? 'Top category' : `Top category · ${month}`),
    entries: (count: number): string =>
      count === 0 ? 'No entries yet' : count === 1 ? '1 entry so far' : `${String(count)} entries so far`,
    fullMonth: 'Full month',
    /** "₱18,000.00 · 47% of this month" */
    topFoot: (amount: string, percent: number): string => `${amount} · ${String(percent)}% of this month`,
  },
  // SPEC-GAP: the caption under the table.
  caption: 'The total covers every page of this list for the filters above. Deleted expenses never count.',
} as const;
