// SPEC-GAP: ExpenseCategorySelect (UI-SPEC "Component Inventory" → ExpenseCategorySelect; D-11, D-15; plans 06-07, 06-12). A Select
// fed by the category list in the server's order (A to Z, Others last); this component never sorts.
//   - Filter mode lists every category, a retired one as "{name} (retired)", under the placeholder "All categories"; while the list
//     loads it is disabled and reads "Loading categories…".
//   - Picker mode (the expense form) lists only active categories under "Choose a category", with nothing chosen (OQ-9). An edit
//     passes the saved category's id so a retired one stays listed as "{name} (retired)" and can be left alone (D-11).
import { Select } from '@/components/forms';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { useExpenseCategoriesQuery } from '@/modules/admin/hooks/useExpenseCategoriesQuery';

const COPY = EXPENSES_COPY.category;
const FORM_COPY = EXPENSES_COPY.form.category;

interface FilterProps {
  mode: 'filter';
  /** The chosen category id, or null for All categories. */
  value: string | null;
  /** The id of the category chosen, or null for All categories. */
  onChange: (categoryId: string | null) => void;
}

interface PickerProps {
  mode: 'picker';
  /** The chosen category id, or '' for none. */
  value: string;
  onChange: (categoryId: string) => void;
  /** The category the expense already has (an edit); it stays listed even when retired. */
  savedCategoryId?: string | null | undefined;
  /** A validation or server message. */
  error?: string | undefined;
}

export type ExpenseCategorySelectProps = FilterProps | PickerProps;

export function ExpenseCategorySelect(props: ExpenseCategorySelectProps) {
  return props.mode === 'picker' ? <CategoryPicker {...props} /> : <CategoryFilter {...props} />;
}

function CategoryFilter({ value, onChange }: FilterProps) {
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

function CategoryPicker({ value, onChange, savedCategoryId, error }: PickerProps) {
  const categories = useExpenseCategoriesQuery();
  const loading = categories.isPending;
  const failed = categories.isError;
  const options = (categories.data ?? [])
    .filter((category) => category.status !== 'retired' || category.id === savedCategoryId)
    .map((category) => ({
      value: category.id,
      label: category.status === 'retired' ? COPY.retired(category.name) : category.name,
    }));

  return (
    <Select
      label={COPY.label}
      name="categoryId"
      required
      placeholder={loading ? COPY.loading : FORM_COPY.placeholder}
      disabled={loading || failed}
      options={options}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      error={error ?? (failed ? FORM_COPY.loadFailed : '')}
    />
  );
}
