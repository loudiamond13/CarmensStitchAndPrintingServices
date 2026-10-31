// The words of the order list pickers, filters and Settings tabs (UI-SPEC Copywriting Contract; plans 08-04 and 08-08): one module, no
// wording in JSX. Strings the spec names are verbatim; the rest are SPEC-GAP wording the owner reviews. No long dash (OR-4).
// SPEC-GAP (plan 08-08): the Settings first-column headings and the "order expense categories" plural are not in the spec.
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { COMPANY_SETTINGS_WORDS, SETTINGS_COPY, type ListSettingsWords } from '@/modules/admin/settingsCopy';

/** What differs between the order lists on their Settings tab; the parts every list says alike come from the Phase 6 words. */
interface OrderListSettingsParts {
  /** "Product Types": the card heading. */
  heading: string;
  /** "Product type": the first column and the toast titles. */
  noun: string;
  /** "product type": inside a sentence. */
  nounInline: string;
  /** The plural noun of the list, for its loading and failure lines. */
  things: string;
  tableCaption: string;
  countColumn: string;
  hint: string;
  add: string;
  caption: string;
  /** "Product Type": after "Add" and "Edit" in the modal titles. */
  modalTitle: string;
  save: string;
  addDescription: string;
  editDescription: string;
  retired: { title: string; message: (name: string) => string };
  backInUse: { title: string; message: (name: string) => string };
  nameRequired: string;
  remove: { question: (name: string) => string; message: string; confirm: string };
  inUse: { title: (name: string) => string; body: string };
}

function settingsWords(parts: OrderListSettingsParts): ListSettingsWords {
  return {
    card: { title: parts.heading, hint: parts.hint, add: parts.add },
    tableCaption: parts.tableCaption,
    things: parts.things,
    columns: {
      name: parts.noun,
      status: SETTINGS_COPY.columns.status,
      count: parts.countColumn,
      actions: SETTINGS_COPY.columns.actions,
    },
    status: SETTINGS_COPY.status,
    othersSubline: SETTINGS_COPY.othersSubline,
    caption: parts.caption,
    rowActions: SETTINGS_COPY.rowActions,
    retire: { toast: parts.retired, failed: SETTINGS_COPY.retire.failed },
    reactivate: { toast: parts.backInUse, failed: SETTINGS_COPY.reactivate.failed },
    remove: {
      title: parts.remove.question,
      message: parts.remove.message,
      confirm: parts.remove.confirm,
      pending: SETTINGS_COPY.remove.pending,
      toast: { title: `${parts.noun} deleted`, message: (name: string): string => name },
      inUse: parts.inUse,
    },
    errors: {
      nameRequired: parts.nameRequired,
      nameTooLong: SETTINGS_COPY.errors.nameTooLong,
      toneRequired: SETTINGS_COPY.errors.toneRequired,
    },
    modal: {
      add: {
        title: `Add ${parts.modalTitle}`,
        description: parts.addDescription,
        save: parts.save,
        saving: SETTINGS_COPY.modal.add.saving,
        cancel: SETTINGS_COPY.modal.add.cancel,
        toast: { title: `${parts.noun} added`, message: SETTINGS_COPY.modal.add.toast.message },
      },
      edit: {
        title: `Edit ${parts.modalTitle}`,
        description: parts.editDescription,
        save: SETTINGS_COPY.modal.edit.save,
        saving: SETTINGS_COPY.modal.edit.saving,
        cancel: SETTINGS_COPY.modal.edit.cancel,
        things: parts.nounInline,
        loadFailedThing: `this ${parts.nounInline}`,
        toast: { title: `${parts.noun} updated`, message: (name: string): string => name },
        latestLoaded: SETTINGS_COPY.modal.edit.latestLoaded,
      },
      name: SETTINGS_COPY.modal.name,
      color: SETTINGS_COPY.modal.color,
    },
  };
}

export const ORDER_LISTS_COPY = {
  /** A retired entry stays listed where a record already uses it, or in a filter (D-11, D-32). */
  retired: (name: string): string => `${name} (retired)`,
  'product-types': {
    label: 'Product type',
    all: 'All products',
    placeholder: 'Choose a product type',
    loading: 'Loading product types…',
    loadFailed: "Couldn't load the product types. Close this form and try again.",
    settings: settingsWords({
      heading: 'Product Types',
      noun: 'Product type',
      nounInline: 'product type',
      things: 'product types',
      tableCaption: 'Product types',
      countColumn: 'Items',
      hint: 'Staff pick one of these for each order item.',
      add: 'Add Product Type',
      caption:
        'Retired product types are hidden from the item form, but past items keep them and the Orders filter still shows them. A product type no item has ever used, deleted orders included, can be deleted.',
      modalTitle: 'Product Type',
      save: 'Save Product Type',
      addDescription: 'Staff pick from this list for each order item.',
      editDescription: 'A new name shows on every item of this type, past ones too.',
      retired: {
        title: 'Product type retired',
        message: (name: string): string => `${name} no longer shows in the item form. Past items keep it.`,
      },
      backInUse: {
        title: 'Product type back in use',
        message: (name: string): string => `${name} shows in the item form again.`,
      },
      nameRequired: 'Enter a product type name.',
      remove: {
        question: (name: string): string => `Delete the ${name} product type?`,
        message: "No order item has ever used it, so it can be deleted. This can't be undone.",
        confirm: 'Delete Product Type',
      },
      inUse: {
        title: (name: string): string => `${name} is now used by an order item, so it can't be deleted.`,
        body: 'Retire it instead to hide it from the item form.',
      },
    }),
  },
  // SPEC-GAP: the payment method list has no filter in the spec; "All methods" is the same shape as the others.
  'payment-methods': {
    label: 'Method',
    all: 'All methods',
    placeholder: 'Choose a method',
    loading: 'Loading methods…',
    loadFailed: "Couldn't load the payment methods. Close this form and try again.",
    settings: settingsWords({
      heading: 'Payment Methods',
      noun: 'Payment method',
      nounInline: 'payment method',
      things: 'payment methods',
      tableCaption: 'Payment methods',
      countColumn: 'Payments',
      hint: 'Staff pick one of these when they record a payment.',
      add: 'Add Payment Method',
      caption:
        'Retired payment methods are hidden from the payment form, but past payments keep them. A payment method no payment has ever used, deleted orders included, can be deleted.',
      modalTitle: 'Payment Method',
      save: 'Save Payment Method',
      addDescription: 'Staff pick from this list when they record a payment.',
      editDescription: 'A new name shows on every payment with this method, past ones too.',
      retired: {
        title: 'Payment method retired',
        message: (name: string): string => `${name} no longer shows in the payment form. Past payments keep it.`,
      },
      backInUse: {
        title: 'Payment method back in use',
        message: (name: string): string => `${name} shows in the payment form again.`,
      },
      nameRequired: 'Enter a payment method name.',
      remove: {
        question: (name: string): string => `Delete the ${name} payment method?`,
        message: "No payment has ever used it, so it can be deleted. This can't be undone.",
        confirm: 'Delete Payment Method',
      },
      inUse: {
        title: (name: string): string => `${name} is now used by a payment, so it can't be deleted.`,
        body: 'Retire it instead to hide it from the payment form.',
      },
    }),
  },
  'order-expense-categories': {
    label: 'Category',
    all: 'All categories',
    placeholder: 'Choose a category',
    loading: 'Loading categories…',
    loadFailed: "Couldn't load the categories. Close this form and try again.",
    settings: settingsWords({
      heading: 'Order Expense Categories',
      noun: 'Category',
      nounInline: 'category',
      things: 'order expense categories',
      tableCaption: 'Order expense categories',
      countColumn: 'Expenses',
      hint: 'Staff pick one of these when they record a cost for an order.',
      add: 'Add Category',
      caption:
        'Retired categories are hidden from the order expense form, but past expenses keep them. A category no order expense has ever used, deleted orders included, can be deleted.',
      modalTitle: 'Category',
      save: 'Save Category',
      addDescription: 'Staff pick from this list when they record a cost for an order.',
      editDescription: 'A new name shows on every order expense in this category, past ones too.',
      retired: {
        title: 'Category retired',
        message: (name: string): string => `${name} no longer shows in the order expense form. Past expenses keep it.`,
      },
      backInUse: {
        title: 'Category back in use',
        message: (name: string): string => `${name} shows in the order expense form again.`,
      },
      nameRequired: 'Enter a category name.',
      remove: {
        question: (name: string): string => `Delete the ${name} category?`,
        message: "No order expense has ever used it, so it can be deleted. This can't be undone.",
        confirm: 'Delete Category',
      },
      inUse: {
        title: (name: string): string => `${name} is now used by an order expense, so it can't be deleted.`,
        body: 'Retire it instead to hide it from the order expense form.',
      },
    }),
  },
  // The company expense categories keep their Phase 6 words.
  'expense-categories': {
    label: EXPENSES_COPY.category.label,
    all: EXPENSES_COPY.category.all,
    placeholder: EXPENSES_COPY.form.category.placeholder,
    loading: EXPENSES_COPY.category.loading,
    loadFailed: EXPENSES_COPY.form.category.loadFailed,
    settings: COMPANY_SETTINGS_WORDS,
  },
} as const;
