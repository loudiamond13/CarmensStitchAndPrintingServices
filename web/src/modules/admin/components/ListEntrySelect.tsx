// SPEC-GAP: ListEntrySelect (UI-SPEC "Component Inventory" → ListEntrySelect; D-32, UIC-15, UIC-44; plan 08-04). One Select for any
// order list, fed by the list in the server's order (this component never sorts).
//   - Filter mode lists every entry, a retired one as "{name} (retired)", under the list's "All ..." placeholder; while the list
//     loads it is disabled and reads "Loading ...".
//   - Picker mode lists only active entries under the list's "Choose a ..." placeholder, with nothing chosen. An edit passes the
//     record's own entry id as `savedEntry`, so a retired one stays listed as "{name} (retired)" and can be left alone.
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { Select } from '@/components/forms';
import { useExpenseCategoriesQuery } from '@/modules/admin/hooks/useExpenseCategoriesQuery';
import { useOrderExpenseCategoriesQuery } from '@/modules/admin/hooks/useOrderExpenseCategoriesQuery';
import { usePaymentMethodsQuery } from '@/modules/admin/hooks/usePaymentMethodsQuery';
import { useProductTypesQuery } from '@/modules/admin/hooks/useProductTypesQuery';
import { ORDER_LISTS_COPY } from '@/modules/admin/orderListsCopy';

export type ListKey = 'product-types' | 'payment-methods' | 'order-expense-categories' | 'expense-categories';

interface EntryLike {
  id: string;
  name: string;
  status: string;
}

interface ListConfig {
  useEntries: () => UseQueryResult<readonly EntryLike[]>;
  copy: { label: string; all: string; placeholder: string; loading: string; loadFailed: string };
  /** The form field name of a picker. */
  fieldName: string;
}

const LISTS: Record<ListKey, ListConfig> = {
  'product-types': {
    useEntries: useProductTypesQuery,
    copy: ORDER_LISTS_COPY['product-types'],
    fieldName: 'productTypeId',
  },
  'payment-methods': {
    useEntries: usePaymentMethodsQuery,
    copy: ORDER_LISTS_COPY['payment-methods'],
    fieldName: 'paymentMethodId',
  },
  'order-expense-categories': {
    useEntries: useOrderExpenseCategoriesQuery,
    copy: ORDER_LISTS_COPY['order-expense-categories'],
    fieldName: 'categoryId',
  },
  'expense-categories': {
    useEntries: useExpenseCategoriesQuery,
    copy: ORDER_LISTS_COPY['expense-categories'],
    fieldName: 'categoryId',
  },
};

interface FieldProps {
  list: ListKey;
  /** Replaces the list's own label. */
  label?: string | undefined;
  /** Replaces the list's own field name (a picker). */
  name?: string | undefined;
  hint?: ReactNode;
}

interface FilterProps extends FieldProps {
  mode: 'filter';
  /** The chosen entry id, or null for the "All ..." choice. */
  value: string | null;
  onChange: (entryId: string | null) => void;
}

interface PickerProps extends FieldProps {
  mode: 'picker';
  /** The chosen entry id, or '' for none. */
  value: string;
  onChange: (entryId: string) => void;
  /** The entry the record already has (an edit); it stays listed even when retired. */
  savedEntry?: string | null | undefined;
  /** A validation or server message. */
  error?: string | undefined;
}

export type ListEntrySelectProps = FilterProps | PickerProps;

export function ListEntrySelect(props: ListEntrySelectProps) {
  return props.mode === 'picker' ? <EntryPicker {...props} /> : <EntryFilter {...props} />;
}

function optionOf(entry: EntryLike): { value: string; label: string } {
  return { value: entry.id, label: entry.status === 'retired' ? ORDER_LISTS_COPY.retired(entry.name) : entry.name };
}

function EntryFilter({ list, label, hint, value, onChange }: FilterProps) {
  const config = LISTS[list];
  const entries = config.useEntries();
  const loading = entries.isPending;
  const options = (entries.data ?? []).map(optionOf);

  return (
    <Select
      label={label ?? config.copy.label}
      hint={hint}
      placeholder={loading ? config.copy.loading : config.copy.all}
      disabled={loading}
      options={options}
      value={value ?? ''}
      onChange={(event) => {
        onChange(event.target.value === '' ? null : event.target.value);
      }}
    />
  );
}

function EntryPicker({ list, label, name, hint, value, onChange, savedEntry, error }: PickerProps) {
  const config = LISTS[list];
  const entries = config.useEntries();
  const loading = entries.isPending;
  const failed = entries.isError;
  const options = (entries.data ?? [])
    .filter((entry) => entry.status !== 'retired' || entry.id === savedEntry)
    .map(optionOf);

  return (
    <Select
      label={label ?? config.copy.label}
      name={name ?? config.fieldName}
      hint={hint}
      required
      placeholder={loading ? config.copy.loading : config.copy.placeholder}
      disabled={loading || failed}
      options={options}
      value={value}
      onChange={(event) => {
        onChange(event.target.value);
      }}
      error={error ?? (failed ? config.copy.loadFailed : '')}
    />
  );
}
