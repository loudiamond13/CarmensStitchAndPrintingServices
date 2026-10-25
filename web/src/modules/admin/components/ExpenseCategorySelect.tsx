// SPEC-GAP: ExpenseCategorySelect (UI-SPEC "Component Inventory" → ExpenseCategorySelect; D-11, D-15; plan 06-07). A Select fed
// by the category list in the server's order (A to Z, Others last); this component never sorts. Filter mode lists every
// category, a retired one as "{name} (retired)", under the placeholder "All categories"; while the list loads it is disabled
// and reads "Loading categories…". Picker mode (active categories, a required choice) arrives with plan 06-12.
import { Select } from '@/components/forms';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { useExpenseCategoriesQuery } from '@/modules/admin/hooks/useExpenseCategoriesQuery';

const COPY = EXPENSES_COPY.category;

export interface ExpenseCategorySelectProps {
  mode: 'filter';
  /** The chosen category id, or null for All categories. */
  value: string | null;
  /** The id of the category chosen, or null for All categories. */
  onChange: (categoryId: string | null) => void;
}

export function ExpenseCategorySelect({ value, onChange }: ExpenseCategorySelectProps) {
  const categories = useExpenseCategoriesQuery();
  const loading = categories.isPending;
  const options = (categories.data ?? []).map((category) => ({
    value: category.id,
    label: category.status === 'retired' ? COPY.retired(category.name) : category.name,
  }));

  return (
    <Select
      label={COPY.label}
      placeholder={loading ? COPY.loading : COPY.all}
      disabled={loading}
      options={options}
      value={value ?? ''}
      onChange={(event) => {
        onChange(event.target.value === '' ? null : event.target.value);
      }}
    />
  );
}
