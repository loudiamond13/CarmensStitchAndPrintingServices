// L1 Orders, /admin/orders (ORD-01, ORD-11, ORD-12, ORD-19; plans 08-06 and later). The grid view: one OrderCard per row of the
// page, with the server's figures as they come, the list-wide counts in the subline (D-41) and the due flag worked out from the
// response's own business today (D-59), never the device clock. A card link carries the current list search in the navigation
// state, so the order page can offer a way back to this view (D-51). Page and rows per page live in the URL. The first load shows
// four skeleton cards, a failed load an ErrorState with Try Again, a refetch keeps the cards and dims them after 200 ms, and a
// shop with no active orders sees the first-use EmptyState.
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ButtonLink } from '@/components/actions';
import { OrderCard, type OrderCardOrder } from '@/components/data';
import { EmptyState } from '@/components/feedback';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
  srOnlyClasses,
} from '@/components/layout/layout.recipe';
import { Pagination } from '@/components/lists';
import { ErrorState, LoadingRegion, SkeletonCard, SkeletonText, useDelayedFlag } from '@/components/states';
import { useSettledListParams } from '@/lib/query/useSettledListParams';
import { DueFlag } from '@/modules/admin/components/DueFlag';
import { ordersGridClasses, ordersSublineSkeletonClasses } from '@/modules/admin/components/orders.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useOrdersListParams } from '@/modules/admin/hooks/useOrdersListParams';
import { useOrdersQuery } from '@/modules/admin/hooks/useOrdersQuery';
import { ORDERS_COPY } from '@/modules/admin/ordersCopy';
import type { OrderListEntry } from '@/modules/admin/services/ordersService';
import type { OrderStatus } from '@/utils/csps';

const COPY = ORDERS_COPY.list;
/** The results heading Pagination moves focus to (it needs tabIndex -1). */
const HEADING_ID = 'orders-results';
/** The wait before a refetch dims the cards (UI-SPEC "refetch"). */
const REFETCH_MARK_DELAY_MS = 200;
/** Cards on the first-load skeleton. */
const SKELETON_CARDS = [0, 1, 2, 3] as const;

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
  const [values, set] = useOrdersListParams();
  const settled = useSettledListParams(values, 300);
  const query = useOrdersQuery({ page: settled.page, pageSize: settled.size });

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const data = query.data;
  const hasRows = data !== undefined && data.items.length > 0;
  const pageCount = Math.ceil(toNumber(data?.total ?? 0) / values.size);

  // A page past the last one (a stale link, or rows deleted meanwhile) becomes the last page, once fresh data says so.
  const { clampPage } = set;
  const fresh = query.isSuccess && !query.isPlaceholderData;
  useEffect(() => {
    if (fresh) {
      clampPage(pageCount);
    }
  }, [fresh, pageCount, clampPage]);

  const firstLoad = query.isPending && !hasRows;
  const refetching = useDelayedFlag(query.isPlaceholderData && query.isFetching && hasRows, REFETCH_MARK_DELAY_MS);
  const empty = query.isSuccess && !hasRows;

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
          {data !== undefined && (
            <p className={pageSublineClasses}>{COPY.subline(toNumber(data.allOrders), toNumber(data.activeOrders))}</p>
          )}
          {firstLoad && (
            <div className={ordersSublineSkeletonClasses}>
              <SkeletonText lines={1} />
            </div>
          )}
        </div>
        <div>
          <ButtonLink variant="primary" icon="plus" to="/admin/orders/new">
            {COPY.newOrder}
          </ButtonLink>
        </div>
      </div>
      <h2 id={HEADING_ID} tabIndex={-1} className={srOnlyClasses}>
        {COPY.results}
      </h2>
      {query.isError && (
        <ErrorState
          things={COPY.things}
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
      <LoadingRegion loading={firstLoad || refetching} things={COPY.things} failed={query.isError}>
        {firstLoad && (
          <div className={ordersGridClasses}>
            {SKELETON_CARDS.map((key) => (
              <SkeletonCard key={key} />
            ))}
          </div>
        )}
        {empty && (
          <EmptyState
            icon="clipboard-list"
            title={COPY.empty.title}
            message={COPY.empty.message}
            action={
              <ButtonLink variant="primary" icon="plus" to="/admin/orders/new">
                {COPY.newOrder}
              </ButtonLink>
            }
          />
        )}
        {hasRows && (
          <div className={ordersGridClasses} data-refetching={refetching ? 'true' : undefined}>
            {data.items.map((entry) => (
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
        )}
      </LoadingRegion>
      <Pagination
        page={values.page}
        pageCount={pageCount}
        onPageChange={set.setPage}
        focusTargetId={HEADING_ID}
        pageSize={values.size}
        onPageSizeChange={set.setPageSize}
      />
    </>
  );
}
