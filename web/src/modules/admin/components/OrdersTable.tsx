// The table view of the Orders list (L1, ORD-01, ORD-10, ORD-12; plan 08-11), on the shared ResponsiveTable. It owns the columns
// and the cells; the list states (first-load skeleton, load error, empty, No matches, dimming while the next page loads) come
// from ResponsiveTable, fed by the page. Every figure is the server's, as sent (D-09).
import { MediaPlaceholder } from '@/components/brand';
import { UiLink } from '@/components/actions';
import {
  CustomerCell,
  ResponsiveTable,
  type ResponsiveTableColumn,
  type ResponsiveTableProps,
} from '@/components/lists';
import {
  ordersNumberLinkClasses,
  ordersOrderCellClasses,
  ordersThumbClasses,
} from '@/modules/admin/components/orders.recipe';
import { ORDERS_COPY } from '@/modules/admin/ordersCopy';
import type { OrderListEntry } from '@/modules/admin/services/ordersService';

const COPY = ORDERS_COPY.list;

export interface OrdersTableProps extends Pick<
  ResponsiveTableProps<OrderListEntry>,
  | 'rows'
  | 'pending'
  | 'refetching'
  | 'failed'
  | 'error'
  | 'onRetry'
  | 'filtered'
  | 'search'
  | 'filterSummary'
  | 'onClearFilters'
  | 'emptyIcon'
  | 'emptyTitle'
  | 'emptyMessage'
  | 'emptyAction'
> {
  /** Opens the order. The page adds the navigation state that the order page's back link reads (D-51). */
  onOpen: (entry: OrderListEntry) => void;
}

/** A plain left click opens the order through `onOpen`; a modified click or a middle click keeps the link's own behaviour. */
function isPlainClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

function columnsFor(onOpen: (entry: OrderListEntry) => void): readonly ResponsiveTableColumn<OrderListEntry>[] {
  return [
    {
      key: 'order',
      header: COPY.table.columns.order,
      lead: true,
      cell: (entry) => (
        <span className={ordersOrderCellClasses}>
          <span className={ordersThumbClasses} aria-hidden="true">
            <MediaPlaceholder label={false} ratio="1 / 1" />
          </span>
          <UiLink
            to={`/admin/orders/${entry.id}`}
            className={ordersNumberLinkClasses}
            onClick={(event) => {
              if (isPlainClick(event)) {
                event.preventDefault();
                onOpen(entry);
              }
            }}
          >
            {entry.number}
          </UiLink>
        </span>
      ),
    },
    {
      key: 'customer',
      header: COPY.table.columns.customer,
      cell: (entry) => <CustomerCell team={entry.teamName} customer={entry.customerName} />,
    },
  ];
}

export function OrdersTable({ onOpen, ...table }: OrdersTableProps) {
  return (
    <ResponsiveTable<OrderListEntry>
      {...table}
      caption={COPY.table.caption}
      columns={columnsFor(onOpen)}
      rowKey={(entry) => entry.id}
      things={COPY.things}
    />
  );
}
