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
  /** A row's actions are named for their category, with a matching title. */
  rowActions: {
    edit: (name: string): string => `Edit ${name}`,
    retire: (name: string): string => `Retire ${name}`,
    useAgain: (name: string): string => `Use ${name} again`,
    remove: (name: string): string => `Delete ${name}`,
  },
  /** Retire and Use again act at once (OQ-4, OQ-5): the toast states the effect, a failure is a danger toast that stays. */
  retire: {
    toast: {
      title: 'Category retired',
      message: (name: string): string => `${name} no longer shows in the Add Expense form. Past expenses keep it.`,
    },
    failed: (name: string): string => `Couldn't retire ${name}`,
  },
  reactivate: {
    toast: {
      title: 'Category back in use',
      message: (name: string): string => `${name} shows in the Add Expense form again.`,
    },
    failed: (name: string): string => `Couldn't bring back ${name}`,
  },
  /** Delete a never-used category (D-10, D-30): the plain ConfirmDialog, Cancel focused. */
  remove: {
    title: (name: string): string => `Delete the ${name} category?`,
    message: "No expense has ever used it, so it can be deleted. This can't be undone.",
    confirm: 'Delete Category',
    pending: 'Deleting',
    toast: { title: 'Category deleted', message: (name: string): string => name },
    /** The server refuses when an expense started using the category meanwhile; the dialog stays open with this line. */
    inUse: {
      title: (name: string): string => `${name} is now used by an expense, so it can't be deleted.`,
      body: 'Retire it instead to hide it from the Add Expense form.',
    },
  },
  /** Inline errors (UI-SPEC Validation), with the server's own words. */
  errors: {
    nameRequired: 'Enter a category name.',
    nameTooLong: 'Keep the name to 40 characters or fewer.',
    toneRequired: 'Choose a badge color.',
  },
  /** The Category modal (S2). */
  modal: {
    add: {
      title: 'Add Category',
      description: 'Staff pick from this list when they record a company expense.',
      save: 'Save Category',
      saving: 'Saving',
      cancel: 'Cancel',
      toast: { title: 'Category added', message: (name: string): string => `${name} is ready to use.` },
    },
    edit: {
      title: 'Edit Category',
      description: 'A new name shows on every expense in this category, past ones too.',
      save: 'Save Changes',
      saving: 'Saving',
      cancel: 'Cancel',
      /** The loading region reads "Loading category…" and then "Category loaded.". */
      things: 'category',
      /** The load-failure banner reads "Couldn't load this category." */
      loadFailedThing: 'this category',
      toast: { title: 'Category updated', message: (name: string): string => name },
      // The polite line after Load Latest (the banner itself is the shared ConflictBanner, 05 D-20).
      latestLoaded: 'Latest version loaded. Make your changes again.',
    },
    name: {
      label: 'Name',
      /** Others keeps its name so it always sorts last (OQ-6). */
      othersHint: "The Others name can't change, so it always sorts last.",
    },
    color: {
      legend: 'Badge color',
      /** The preview badge's text while the name is empty. */
      sample: 'Sample',
    },
  },
} as const;
