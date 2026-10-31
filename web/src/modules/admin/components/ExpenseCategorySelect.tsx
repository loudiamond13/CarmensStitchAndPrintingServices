// SPEC-GAP: ExpenseCategorySelect (UI-SPEC "Component Inventory" → ExpenseCategorySelect; D-11, D-15; plans 06-07, 06-12, 08-04).
// The company expense category Select, now a thin wrapper over ListEntrySelect. The props and the words are Phase 6's.
import { ListEntrySelect } from '@/modules/admin/components/ListEntrySelect';

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
  if (props.mode === 'picker') {
    const { savedCategoryId, ...rest } = props;
    return <ListEntrySelect list="expense-categories" {...rest} savedEntry={savedCategoryId} />;
  }
  return <ListEntrySelect list="expense-categories" {...props} />;
}
