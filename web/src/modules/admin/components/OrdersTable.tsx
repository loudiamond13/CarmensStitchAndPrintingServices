// The table view of the Orders list (L1, ORD-01, ORD-10, ORD-12, D-04, D-22, D-45; plan 08-11), on the shared ResponsiveTable. It
// owns the columns and the cells; the list states (first-load skeleton, load error, empty, No matches, dimming while the next
// page loads) come from ResponsiveTable, fed by the page. Every figure is the server's, as sent (D-09): no sum here. The table
// carries Total, Paid and Balance only: no discount figure (D-04), no expenses or profit (D-06) and no delete (D-22).
import { UiLink } from '@/components/actions';
import { Icon, MediaPlaceholder } from '@/components/brand';
import {
  CustomerCell,
  ResponsiveTable,
  RowAction,
  RowActions,
  type ResponsiveTableColumn,
  type ResponsiveTableProps,
} from '@/components/lists';
import { Money } from '@/components/money';
import { Badge, StatusBadge, isOrderStatus } from '@/components/status';
import { DueFlag } from '@/modules/admin/components/DueFlag';
import {
  ordersBalanceFigureClasses,
  ordersBalanceStackClasses,
  ordersFullyPaidClasses,
  ordersNotCollectedClasses,
  ordersNumberLinkClasses,
  ordersOrderCellClasses,
  ordersThumbClasses,
} from '@/modules/admin/components/orders.recipe';
import { ORDERS_COPY } from '@/modules/admin/ordersCopy';
import type { OrderListEntry } from '@/modules/admin/services/ordersService';
import { formatPeso, isPositiveMoney, negateMoney } from '@/utils/csps';
import { formatCalendarDate } from '@/utils/format';

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
  /** The server's business date, for the due flags (D-59). */
  today: string;
  /** Opens the order. The page adds the navigation state that the order page's back link reads (D-51). */
  onOpen: (entry: OrderListEntry) => void;
  /** Opens Edit Details of the order. */
  onEdit: (entry: OrderListEntry) => void;
}

/** A plain left click opens the order through `onOpen`; a modified click or a middle click keeps the link's own behaviour. */
function isPlainClick(event: {
  button: number;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

/** The balance block's state, first match wins (D-02, ORD-12, D-45): the same rule as the card's OrderTotals. */
function balanceKind(entry: OrderListEntry): 'credit' | 'paid' | 'notCollected' | 'due' {
  if (isPositiveMoney(entry.customerCredit)) return 'credit';
  if (entry.fullyPaid) return 'paid';
  if (entry.status === 'cancelled' && isPositiveMoney(entry.balance)) return 'notCollected';
  return 'due';
}

function BalanceCell({ entry }: { entry: OrderListEntry }) {
  switch (balanceKind(entry)) {
    case 'credit':
      return <Badge tone="info">{COPY.table.credit(formatPeso(entry.customerCredit))}</Badge>;
    case 'paid':
      return (
        <span className={ordersFullyPaidClasses}>
          <Icon name="circle-check" size={18} />
          {COPY.table.fullyPaid}
        </span>
      );
    case 'notCollected':
      return (
        <span className={ordersBalanceStackClasses}>
          <span className={ordersBalanceFigureClasses.muted}>{formatPeso(entry.balance)}</span>
          <span className={ordersNotCollectedClasses}>{COPY.table.notCollected}</span>
        </span>
      );
    case 'due':
      return <span className={ordersBalanceFigureClasses.due}>{formatPeso(entry.balance)}</span>;
  }
}

interface Wiring {
  today: string;
  onOpen: (entry: OrderListEntry) => void;
  onEdit: (entry: OrderListEntry) => void;
}

function columnsFor({ today, onOpen, onEdit }: Wiring): readonly ResponsiveTableColumn<OrderListEntry>[] {
  const heads = COPY.table.columns;
  return [
    {
      key: 'order',
      header: heads.order,
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
      header: heads.customer,
      cell: (entry) => <CustomerCell team={entry.teamName} customer={entry.customerName} />,
    },
    {
      key: 'status',
      header: heads.status,
      cell: (entry) => (isOrderStatus(entry.status) ? <StatusBadge status={entry.status} /> : entry.status),
    },
    {
      key: 'ordered',
      header: heads.ordered,
      muted: true,
      cell: (entry) => formatCalendarDate(entry.orderDate),
    },
    {
      key: 'due',
      header: heads.due,
      cell: (entry) => <DueFlag dueDate={entry.dueDate} status={entry.status} today={today} layout="stacked" />,
    },
    {
      key: 'total',
      header: heads.total,
      money: true,
      cell: (entry) => <Money amount={Number(entry.total)} />,
    },
    {
      key: 'paid',
      header: heads.paid,
      money: true,
      muted: true,
      // Nothing paid is the empty value, never a zero (UIC-7).
      cell: (entry) => (isPositiveMoney(entry.paid) ? formatPeso(negateMoney(entry.paid)) : null),
    },
    {
      key: 'balance',
      header: heads.balance,
      money: true,
      cell: (entry) => <BalanceCell entry={entry} />,
    },
    {
      key: 'actions',
      header: heads.actions,
      actions: true,
      cell: (entry) => {
        const view = COPY.table.view(entry.number);
        const edit = COPY.table.edit(entry.number);
        // A Completed or Cancelled order is not edited here (D-15, D-46).
        const locked = entry.status === 'completed' || entry.status === 'cancelled';
        return (
          <RowActions>
            <RowAction
              icon="eye"
              label={view}
              title={view}
              onClick={() => {
                onOpen(entry);
              }}
            />
            {!locked && (
              <RowAction
                icon="pencil"
                label={edit}
                title={edit}
                onClick={() => {
                  onEdit(entry);
                }}
              />
            )}
          </RowActions>
        );
      },
    },
  ];
}

export function OrdersTable({ today, onOpen, onEdit, ...table }: OrdersTableProps) {
  return (
    <ResponsiveTable<OrderListEntry>
      {...table}
      caption={COPY.table.caption}
      columns={columnsFor({ today, onOpen, onEdit })}
      rowKey={(entry) => entry.id}
      things={COPY.things}
    />
  );
}
