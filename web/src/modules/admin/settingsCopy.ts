// The words of Settings and the expense category list (UI-SPEC Copywriting Contract, S1 and S2; plan 06-17): one module, no wording
// in JSX. Every string is SPEC-GAP wording the owner reviews (05 D-48). No long dash (OR-4).
export const SETTINGS_COPY = {
  /** The document title is "{title} · CSPS Admin". */
  documentTitle: 'Settings',
  title: 'Settings',
  badge: 'Manager only',
  subline: 'Lists and options the whole team uses.',
  /** The Expense Categories card (D-14: Phase 11 may add more cards below it). */
  card: {
    title: 'Expense Categories',
    hint: 'Staff pick one of these when they record a company expense.',
    add: 'Add Category',
  },
  /** The table's name for assistive technology, and the plural noun of the list ("Loading categories…"). */
  tableCaption: 'Expense categories',
  thing: 'category',
  things: 'categories',
  columns: { category: 'Category', status: 'Status', expenses: 'Expenses', actions: 'Actions' },
  status: { active: 'Active', retired: 'Retired' },
  /** The small line under Others: it always sorts last (D-15, OQ-6). */
  othersSubline: 'Always listed last',
  /** The line under the table that explains retire versus delete. */
  caption:
    'Retired categories are hidden from the Add Expense form, but past expenses keep them and the list filter still shows them. A category no expense has ever used, deleted ones included, can be deleted.',
} as const;
