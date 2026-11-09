// The Recent orders card (DASH-05, DASH-06, D-38, 08 D-36 to D-38; UI-SPEC D1 "Recent orders card"): the summary's six newest
// created orders, each opened from its number or its eye link. Due and Balance read exactly as on the Orders list (the stacked
// DueFlag counted from the summary's business date, and the shared balance cell). Every figure and date is the server's.
// If the summary fails the card shows its own alert and keeps no old rows.
import { UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { CustomerCell, ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { Money } from '@/components/money';
import { ErrorState } from '@/components/states';
import { StatusBadge, isOrderStatus } from '@/components/status';
import {
  dashboardAllOrdersClasses,
  dashboardCardClasses,
  dashboardCardHeadClasses,
  dashboardCardStateClasses,
  dashboardCardSubClasses,
  dashboardCardTitleClasses,
} from '@/modules/admin/components/dashboard.recipe';
import { DueFlag } from '@/modules/admin/components/DueFlag';
import { OrderBalanceCell } from '@/modules/admin/components/OrderBalanceCell';
import { ordersNumberLinkClasses } from '@/modules/admin/components/orders.recipe';
import { DASHBOARD_COPY } from '@/modules/admin/dashboardCopy';
import type { DashboardCardQuery } from '@/modules/admin/hooks/useDashboardSummaryQuery';
import type { DashboardRecentOrder } from '@/modules/admin/services/dashboardService';

const COPY = DASHBOARD_COPY.recent;

/** The rows the first load stands in for: the summary always lists six (D-38). */
const SKELETON_ROWS = 6;

function columnsFor(today: string): readonly ResponsiveTableColumn<DashboardRecentOrder>[] {
  return [
    {
      key: 'order',
      header: COPY.columns.order,
      lead: true,
      cell: (entry) => (
        <UiLink to={`/admin/orders/${entry.id}`} className={ordersNumberLinkClasses}>
          {entry.number}
        </UiLink>
      ),
    },
    {
      key: 'customer',
      header: COPY.columns.customer,
      label: COPY.customerLabel,
      // CustomerCell writes the team over the customer, or the customer over "Walk-in customer" (App. E.6).
      cell: (entry) => <CustomerCell team={entry.teamName} customer={entry.customerName} />,
    },
    {
      key: 'status',
      header: COPY.columns.status,
      // A status the page does not know is shown as the server sent it, as text (never markup).
      cell: (entry) => (isOrderStatus(entry.status) ? <StatusBadge status={entry.status} /> : entry.status),
    },
    {
      key: 'due',
      header: COPY.columns.due,
      cell: (entry) => <DueFlag dueDate={entry.dueDate} status={entry.status} today={today} layout="stacked" />,
    },
    {
      key: 'total',
      header: COPY.columns.total,
      money: true,
      cell: (entry) => <Money amount={entry.total} />,
    },
    {
      key: 'balance',
      header: COPY.columns.balance,
      money: true,
      cell: (entry) => <OrderBalanceCell entry={entry} />,
    },
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (entry) => {
        const view = COPY.view(entry.number);
        return (
          <RowActions>
            <RowAction icon="eye" label={view} title={view} to={`/admin/orders/${entry.id}`} />
          </RowActions>
        );
      },
    },
  ];
}

export interface RecentOrdersCardProps {
  query: DashboardCardQuery;
}

export function RecentOrdersCard({ query }: RecentOrdersCardProps) {
  const summary = query.data;

  return (
    <section className={dashboardCardClasses}>
      <div className={dashboardCardHeadClasses}>
        <div>
          <h2 className={dashboardCardTitleClasses}>{COPY.title}</h2>
          <p className={dashboardCardSubClasses}>{COPY.sub}</p>
        </div>
        <UiLink to="/admin/orders" className={dashboardAllOrdersClasses}>
          {COPY.allOrders}
          <Icon name="arrow-right" size={16} />
        </UiLink>
      </div>
      {query.isError ? (
        <div className={dashboardCardStateClasses}>
          <ErrorState
            things={COPY.things}
            align="start"
            error={query.error}
            onRetry={() => {
              void query.refetch();
            }}
          />
        </div>
      ) : (
        <ResponsiveTable<DashboardRecentOrder>
          caption={COPY.title}
          columns={columnsFor(summary?.today ?? '')}
          rows={summary?.recentOrders}
          rowKey={(entry) => entry.id}
          things={COPY.things}
          pending={summary === undefined}
          emptyIcon="clipboard-list"
          emptyTitle={COPY.emptyTitle}
          emptyMessage={COPY.emptyMessage}
          emptyLevel={3}
          embedded
          skeletonRows={SKELETON_ROWS}
        />
      )}
    </section>
  );
}
