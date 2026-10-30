// The Orders list toolbar (ORD-02, D-55, WEB-10; plan 08-09). The controls read and write the URL only through the list's hook
// (values and setters come in as props), so the page and the query see one source.
import { FilterBar, SearchBox } from '@/components/lists';
import type { useOrdersListParams } from '@/modules/admin/hooks/useOrdersListParams';
import { ORDERS_COPY } from '@/modules/admin/ordersCopy';

const COPY = ORDERS_COPY.list;

export interface OrdersToolbarProps {
  values: ReturnType<typeof useOrdersListParams>[0];
  set: ReturnType<typeof useOrdersListParams>[1];
}

export function OrdersToolbar({ values, set }: OrdersToolbarProps) {
  return (
    <FilterBar>
      <SearchBox
        value={values.q}
        label={COPY.search.label}
        placeholder={COPY.search.placeholder}
        onSearch={set.setSearch}
      />
    </FilterBar>
  );
}
