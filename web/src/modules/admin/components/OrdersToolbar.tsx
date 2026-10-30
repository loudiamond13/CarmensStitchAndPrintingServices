// The Orders list toolbar (ORD-02, D-42, D-43, D-55, WEB-10, OR-3; plan 08-09), in the UI-SPEC L1 order: Search, Status, Order
// date, Product type, the balance box and Sort by. The controls read and write the URL only through the list's hook (values and
// setters come in as props), so the page and the query see one source. A custom order date range is typed here and written to
// the URL only once both dates are real and From is not after To; until then the list keeps the last applied range.
import { useState } from 'react';
import { Checkbox } from '@/components/entry';
import { DateInput, Select, type SelectOption } from '@/components/forms';
import { FilterBar, SearchBox } from '@/components/lists';
import { ordersBalanceFilterClasses, ordersCustomRangeClasses } from '@/modules/admin/components/orders.recipe';
import { ListEntrySelect } from '@/modules/admin/components/ListEntrySelect';
import {
  ORDER_DATE_RANGES,
  ORDER_SORTS,
  ORDER_STATUS_FILTERS,
  type useOrdersListParams,
} from '@/modules/admin/hooks/useOrdersListParams';
import { ORDERS_COPY } from '@/modules/admin/ordersCopy';
import { orderRangeErrors } from '@/modules/admin/ordersSchemas';
import { ORDER_STATUSES } from '@/utils/csps';

const COPY = ORDERS_COPY.list;

const STATUS_OPTIONS: readonly SelectOption[] = ORDER_STATUS_FILTERS.map((status) => ({
  value: status,
  label: status === 'active' ? COPY.status.active : status === 'all' ? COPY.status.all : ORDER_STATUSES[status],
}));

const DATE_OPTIONS: readonly SelectOption[] = [
  { value: '30d', label: COPY.dates.presets['30d'] },
  { value: '90d', label: COPY.dates.presets['90d'] },
  { value: 'month', label: COPY.dates.presets.month },
  { value: 'custom', label: COPY.dates.custom },
];

const SORT_OPTIONS: readonly SelectOption[] = ORDER_SORTS.map((sort) => ({ value: sort, label: COPY.sort[sort] }));

/** The offered value that `text` names, or null: a select only ever reports a value it was given. */
function choice<const T extends string>(offered: readonly T[], text: string): T | null {
  return offered.find((value) => value === text) ?? null;
}

type Values = ReturnType<typeof useOrdersListParams>[0];
type Setters = ReturnType<typeof useOrdersListParams>[1];

export interface OrdersToolbarProps {
  values: Values;
  set: Setters;
}

export function OrdersToolbar({ values, set }: OrdersToolbarProps) {
  const [custom, setCustomOpen] = useCustomChoice(values);
  return (
    <FilterBar>
      <SearchBox
        value={values.q}
        label={COPY.search.label}
        placeholder={COPY.search.placeholder}
        onSearch={set.setSearch}
      />
      <Select
        label={COPY.status.label}
        options={STATUS_OPTIONS}
        value={values.status}
        onChange={(event) => {
          set.setFilter('status', choice(ORDER_STATUS_FILTERS, event.target.value));
        }}
      />
      <Select
        label={COPY.dates.label}
        placeholder={COPY.dates.any}
        options={DATE_OPTIONS}
        value={custom ? 'custom' : (values.dates ?? '')}
        onChange={(event) => {
          const dates = choice(ORDER_DATE_RANGES, event.target.value);
          if (dates === 'custom') {
            setCustomOpen(true);
            return;
          }
          setCustomOpen(false);
          set.setFilters({ dates, from: null, to: null });
        }}
      />
      <ListEntrySelect
        list="product-types"
        mode="filter"
        value={values.productType}
        onChange={(id) => {
          set.setFilter('productType', id);
        }}
      />
      <div className={ordersBalanceFilterClasses}>
        <Checkbox
          label={COPY.balance.label}
          checked={values.hasBalance === 'true'}
          onChange={(checked) => {
            set.setFilter('hasBalance', checked ? 'true' : null);
          }}
        />
      </div>
      <Select
        label={COPY.sort.label}
        options={SORT_OPTIONS}
        value={values.sort}
        onChange={(event) => {
          set.setFilter('sort', choice(ORDER_SORTS, event.target.value));
        }}
      />
      {custom && (
        <CustomRange
          from={values.dates === 'custom' ? (values.from ?? '') : ''}
          to={values.dates === 'custom' ? (values.to ?? '') : ''}
          onApply={(from, to) => {
            set.setFilters({ dates: 'custom', from, to });
          }}
        />
      )}
    </FilterBar>
  );
}

/**
 * Whether "Custom range…" has been chosen without a range in the URL yet. It is local: the URL gets `dates=custom` only with a
 * valid pair. Any change of the URL's range (a preset, a cleared chip, Back) closes it.
 */
function useCustomChoice(values: Values) {
  const [open, setOpen] = useState(false);
  const urlRange = `${values.dates ?? ''}|${values.from ?? ''}|${values.to ?? ''}`;
  const [seen, setSeen] = useState(urlRange);
  if (seen !== urlRange) {
    setSeen(urlRange);
    setOpen(false);
  }
  return [open || values.dates === 'custom', setOpen] as const;
}

interface CustomRangeProps {
  /** The range in use (YYYY-MM-DD), or '' when none has been applied. */
  from: string;
  to: string;
  /** Both dates are real and From is not after To. */
  onApply: (from: string, to: string) => void;
}

type Field = 'from' | 'to';

/**
 * From and To. The dates are held here while they are typed; the range is applied only once both are valid, and each message
 * comes from the zod schema. A message shows once a date has been touched, so the inputs never open with errors.
 */
function CustomRange({ from, to, onApply }: CustomRangeProps) {
  const [draft, setDraft] = useState({ from, to });
  const [touched, setTouched] = useState(false);
  // The range in use moved (Back, a cleared chip): the inputs follow it. Adjusted during render.
  const [seen, setSeen] = useState({ from, to });
  if (seen.from !== from || seen.to !== to) {
    setSeen({ from, to });
    setDraft({ from, to });
    setTouched(false);
  }

  const errors = orderRangeErrors(draft);

  const change = (field: Field, value: string): void => {
    const next = { ...draft, [field]: value };
    setDraft(next);
    setTouched(true);
    const nextErrors = orderRangeErrors(next);
    if (nextErrors.from === null && nextErrors.to === null) {
      onApply(next.from, next.to);
    }
  };

  return (
    <div className={ordersCustomRangeClasses}>
      <DateInput
        label={COPY.dates.from}
        value={draft.from}
        error={touched ? (errors.from ?? '') : ''}
        onChange={(value) => {
          change('from', value);
        }}
      />
      <DateInput
        label={COPY.dates.to}
        value={draft.to}
        error={touched ? (errors.to ?? '') : ''}
        onChange={(value) => {
          change('to', value);
        }}
      />
    </div>
  );
}
