// L1 Orders, /admin/orders (ORD-01, ORD-11, ORD-12, ORD-19; plan 08-06). The grid view: one OrderCard per row of the page, with
// the server's figures as they come, the list-wide counts in the subline (D-41) and the due flag worked out from the response's
// own business today (D-59), never the device clock. A card link carries the current list search in the navigation state, so
// the order page can offer a way back to this view (D-51).
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ButtonLink } from '@/components/actions';
import { OrderCard, type OrderCardOrder } from '@/components/data';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
  srOnlyClasses,
} from '@/components/layout/layout.recipe';
import { DueFlag } from '@/modules/admin/components/DueFlag';
import { ordersGridClasses } from '@/modules/admin/components/orders.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useOrdersQuery } from '@/modules/admin/hooks/useOrdersQuery';
import { ORDERS_COPY } from '@/modules/admin/ordersCopy';
import type { OrderListEntry } from '@/modules/admin/services/ordersService';
import type { OrderStatus } from '@/utils/csps';

const COPY = ORDERS_COPY.list;

/** The generated type allows a number or text for a number; the server sends a number. */
function toNumber(value: number | string): number {
  return Number(value);
}

/**
 * A list row as the card takes it. The server sends one of the seven status keys; a key the types do not know is shown as
 * plain text by the badge, so the row is never dropped.
 */
function toCardOrder(entry: OrderListEntry): OrderCardOrder {
  return { ...entry, status: entry.status as OrderStatus };
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = useOrdersQuery({ page: 1, pageSize: 20 });

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const data = query.data;
  // The card links remember this list view for the order page's back link (D-51).
  const from = `${location.pathname}${location.search}`;
  const open = (path: string): void => {
    void navigate(path, { state: { from } });
  };

  return (
    <>
      <div className={pageHeadClasses}>
        <div className={pageHeadTitleClasses}>
          <h1 tabIndex={-1} className={pageTitleClasses}>
            {COPY.title}
          </h1>
          <p className={pageSublineClasses}>
            {data !== undefined && COPY.subline(toNumber(data.allOrders), toNumber(data.activeOrders))}
          </p>
        </div>
        <div>
          <ButtonLink variant="primary" icon="plus" to="/admin/orders/new">
            {COPY.newOrder}
          </ButtonLink>
        </div>
      </div>
      <h2 className={srOnlyClasses}>{COPY.results}</h2>
      <div className={ordersGridClasses}>
        {data?.items.map((entry) => (
          <OrderCard
            key={entry.id}
            order={toCardOrder(entry)}
            due={<DueFlag dueDate={entry.dueDate} status={entry.status} today={data.today} />}
            onView={() => {
              open(`/admin/orders/${entry.id}`);
            }}
            onEdit={() => {
              open(`/admin/orders/${entry.id}/edit`);
            }}
          />
        ))}
      </div>
    </>
  );
}
