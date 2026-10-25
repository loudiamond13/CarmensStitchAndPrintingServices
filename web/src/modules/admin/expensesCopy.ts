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
  /**
   * Inline errors (UI-SPEC Validation): under the From and To inputs, and under the form's fields, where the words are the
   * server's own (ExpenseRules.cs).
   */
  errors: {
    notReal: 'Enter a real date.',
    rangeOrder: 'The start date must be on or before the end date.',
    dateRequired: 'Enter the date.',
    categoryRequired: 'Choose a category.',
    descriptionRequired: 'Add a short description so others know what this was for.',
    amountTooSmall: 'Enter an amount greater than ₱0.00.',
    paidByRequired: 'Choose who paid.',
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
    /** The foot of the Top category card when the month has no expenses. */
    noExpenses: 'No expenses this month',
    /** The failure banner reads "Couldn't load this month's totals." over the shared reassurance line. */
    errorThings: "this month's totals",
  },
  // SPEC-GAP: the caption under the table.
  caption: 'The total covers every page of this list for the filters above. Deleted expenses never count.',
  /** The Add Expense button and modal (E2, App. E.11; plan 06-12). */
  add: {
    open: 'Add Expense',
    title: 'Add Expense',
    description: 'A general business cost, not tied to any order.',
    save: 'Save Expense',
    saving: 'Saving',
    cancel: 'Cancel',
    toast: {
      title: 'Expense added',
      /** "₱640.00 · Supplies" */
      message: (amount: string, category: string): string => `${amount} · ${category}`,
      // SPEC-GAP: said when the new expense does not match the current search, category or dates.
      outsideFilters: " It's outside the current filters, so it isn't listed.",
    },
  },
  /** The fields of the expense form (E2). The labels, hints and placeholders are App. E.11 or SPEC-GAP wording the owner reviews. */
  form: {
    date: { label: 'Date', hint: "Up to 30 days ahead is fine for a cost you'll pay soon." },
    category: {
      label: 'Category',
      // SPEC-GAP: the picker's placeholder; nothing is preselected (OQ-9).
      placeholder: 'Choose a category',
      // SPEC-GAP: the picker could not read the category list.
      loadFailed: "Couldn't load the categories. Close this form and try again.",
    },
    description: { label: 'Description', placeholder: 'e.g. Meralco bill for October' },
    amount: { label: 'Amount' },
    // SPEC-GAP: Paid by is the staff picker Phase 7 reuses (CEXP-05, D-18, D-32).
    paidBy: {
      label: 'Paid by',
      hint: 'The staff member whose money paid for this.',
      loading: 'Loading staff…',
      loadFailed: "Couldn't load the staff list. Close this form and try again.",
      /** "Carmen Reyes (you)" */
      you: (name: string): string => `${name} (you)`,
    },
    // SPEC-DEVIATION: D-19 the notes field is new to App. E.11.
    notes: { label: 'Notes', hint: "Optional. Shown only here. Search doesn't look in notes." },
    // SPEC-GAP: Recorded by in Add comes from App. E.11, a read-only dashed control that shows the signed-in user.
    recordedBy: { label: 'Recorded by' },
  },
} as const;
