// The words of the order list pickers and filters (UI-SPEC Copywriting Contract; plan 08-04): one module, no wording in JSX.
// Strings the spec names are verbatim; the rest are SPEC-GAP wording the owner reviews. No long dash (OR-4).
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';

export const ORDER_LISTS_COPY = {
  /** A retired entry stays listed where a record already uses it, or in a filter (D-11, D-32). */
  retired: (name: string): string => `${name} (retired)`,
  'product-types': {
    label: 'Product type',
    all: 'All products',
    placeholder: 'Choose a product type',
    loading: 'Loading product types…',
    loadFailed: "Couldn't load the product types. Close this form and try again.",
  },
  // SPEC-GAP: the payment method list has no filter in the spec; "All methods" is the same shape as the others.
  'payment-methods': {
    label: 'Method',
    all: 'All methods',
    placeholder: 'Choose a method',
    loading: 'Loading methods…',
    loadFailed: "Couldn't load the payment methods. Close this form and try again.",
  },
  'order-expense-categories': {
    label: 'Category',
    all: 'All categories',
    placeholder: 'Choose a category',
    loading: 'Loading categories…',
    loadFailed: "Couldn't load the categories. Close this form and try again.",
  },
  // The company expense categories keep their Phase 6 words.
  'expense-categories': {
    label: EXPENSES_COPY.category.label,
    all: EXPENSES_COPY.category.all,
    placeholder: EXPENSES_COPY.form.category.placeholder,
    loading: EXPENSES_COPY.category.loading,
    loadFailed: EXPENSES_COPY.form.category.loadFailed,
  },
} as const;
