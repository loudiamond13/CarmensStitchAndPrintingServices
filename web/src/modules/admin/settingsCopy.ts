// The words of Settings and the expense category list (UI-SPEC Copywriting Contract, S1 and S2; plan 06-17): one module, no wording
// in JSX. Every string is SPEC-GAP wording the owner reviews (05 D-48). No long dash (OR-4).
/** What one Settings list card says (S1, S2): every list has its own words for the same parts. */
export interface ListSettingsWords {
  card: { title: string; hint: string; add: string };
  tableCaption: string;
  /** The plural noun of the list ("Loading product types…", "Couldn't load product types."). */
  things: string;
  columns: { name: string; status: string; count: string; actions: string };
  status: { active: string; retired: string };
  othersSubline: string;
  caption: string;
  rowActions: {
    edit: (name: string) => string;
    retire: (name: string) => string;
    useAgain: (name: string) => string;
    remove: (name: string) => string;
  };
  retire: { toast: { title: string; message: (name: string) => string }; failed: (name: string) => string };
  reactivate: { toast: { title: string; message: (name: string) => string }; failed: (name: string) => string };
  remove: {
    title: (name: string) => string;
    message: string;
    confirm: string;
    pending: string;
    toast: { title: string; message: (name: string) => string };
    inUse: { title: (name: string) => string; body: string };
  };
  errors: { nameRequired: string; nameTooLong: string; toneRequired: string };
  modal: {
    add: {
      title: string;
      description: string;
      save: string;
      saving: string;
      cancel: string;
      toast: { title: string; message: (name: string) => string };
    };
    edit: {
      title: string;
      description: string;
      save: string;
      saving: string;
      cancel: string;
      things: string;
      loadFailedThing: string;
      toast: { title: string; message: (name: string) => string };
      latestLoaded: string;
    };
    name: { label: string; othersHint: string };
    color: { legend: string; sample: string };
  };
}

export const SETTINGS_COPY = {
  /** The document title is "{title} · CSPS Admin". */
  documentTitle: 'Settings',
  title: 'Settings',
  badge: 'Manager only',
  subline: 'Lists and options the whole team uses.',
  /** The tab labels (D-31): the order lists first, then the company expense categories. */
  tabs: {
    'product-types': 'Product Types',
    'payment-methods': 'Payment Methods',
    'order-expense-categories': 'Order Expense Categories',
    'expense-categories': 'Company Expense Categories',
  },
  /** The Company Expense Categories card (D-14: Phase 11 may add more cards below it; D-55 renamed it). */
  card: {
    title: 'Company Expense Categories',
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

/** The company expense category card says what Phase 6 said, under the list-neutral column names. */
export const COMPANY_SETTINGS_WORDS: ListSettingsWords = {
  ...SETTINGS_COPY,
  columns: {
    name: SETTINGS_COPY.columns.category,
    status: SETTINGS_COPY.columns.status,
    count: SETTINGS_COPY.columns.expenses,
    actions: SETTINGS_COPY.columns.actions,
  },
};
