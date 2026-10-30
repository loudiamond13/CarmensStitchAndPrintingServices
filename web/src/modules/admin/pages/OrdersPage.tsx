// L1 Orders, /admin/orders (ORD-01, ORD-11, ORD-12, ORD-19; plans 08-06 and later). The grid view: one OrderCard per row of the
// page, with the server's figures as they come, the list-wide counts in the subline (D-41) and the due flag worked out from the
// response's own business today (D-59), never the device clock. A card link carries the current list search in the navigation
// state, so the order page can offer a way back to this view (D-51). Page and rows per page live in the URL. The first load shows
// four skeleton cards, a failed load an ErrorState with Try Again, a refetch keeps the cards and dims them after 200 ms, and a
// shop with no active orders sees the first-use EmptyState. The toolbar holds the search and the filters (ORD-02, plan 08-09): each
// one is in the URL, sent to the API, and shown as a chip when it is not at its default. A date preset waits for the server's
// business today (D-59) before the list is asked for. The View switch (ORD-10, plan 08-11) shows the same rows as cards or as
// a table; the view is never sent to the API.
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { Button, ButtonLink } from '@/components/actions';
import { OrderCard, type OrderCardOrder } from '@/components/data';
import { EmptyState } from '@/components/feedback';
import {
  pageHeadClasses,
  pageHeadTitleClasses,
  pageSublineClasses,
  pageTitleClasses,
  srOnlyClasses,
} from '@/components/layout/layout.recipe';
import { FilterChip, LISTS_COPY, Pagination, ResultBar } from '@/components/lists';
import { ErrorState, LoadingRegion, SkeletonCard, SkeletonText, useDelayedFlag } from '@/components/states';
import { useSettledListParams } from '@/lib/query/useSettledListParams';
import { DueFlag } from '@/modules/admin/components/DueFlag';
import { OrdersTable } from '@/modules/admin/components/OrdersTable';
import { OrdersToolbar } from '@/modules/admin/components/OrdersToolbar';
import { ordersGridClasses, ordersSublineSkeletonClasses } from '@/modules/admin/components/orders.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { useBusinessTodayState } from '@/modules/admin/hooks/useBusinessToday';
import {
  resolveOrderDateRange,
  useOrdersListParams,
  type OrderStatusFilter,
} from '@/modules/admin/hooks/useOrdersListParams';
import { useOrdersQuery } from '@/modules/admin/hooks/useOrdersQuery';
import { useOrdersView } from '@/modules/admin/hooks/useOrdersView';
import { useProductTypesQuery } from '@/modules/admin/hooks/useProductTypesQuery';
import { ORDERS_COPY } from '@/modules/admin/ordersCopy';
import { ORDER_LISTS_COPY } from '@/modules/admin/orderListsCopy';
import type { OrderListEntry } from '@/modules/admin/services/ordersService';
import { ORDER_STATUSES, type OrderStatus } from '@/utils/csps';
import { formatCalendarDate } from '@/utils/format';

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
/** The words for a status choice: the two special choices, or the shared status word. */
function statusLabel(status: OrderStatusFilter): string {
  if (status === 'active') return COPY.status.active;
  return status === 'all' ? COPY.status.all : ORDER_STATUSES[status];
}

function toCardOrder(entry: OrderListEntry): OrderCardOrder {
  return { ...entry, status: entry.status as OrderStatus };
}

export default function OrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [values, set] = useOrdersListParams();
  const settled = useSettledListParams(values, 300);
  const { view, setView } = useOrdersView(values, set);

  // A date preset is worked out from the server's business today, never the device clock (D-59). Until it is known the list
  // is held back, so the first request already carries the range.
  const presetChosen = values.dates !== null && values.dates !== 'custom';
  const businessToday = useBusinessTodayState(presetChosen);
  const range = resolveOrderDateRange(settled.dates, settled.from, settled.to, businessToday.today);
  const waitingForToday = settled.dates !== null && settled.dates !== 'custom' && range === null;
  const query = useOrdersQuery(
    {
      page: settled.page,
      pageSize: settled.size,
      q: settled.q,
      status: settled.status,
      from: range?.from ?? null,
      to: range?.to ?? null,
      productType: settled.productType,
      hasBalance: settled.hasBalance === 'true' ? true : null,
      sort: settled.sort,
    },
    { enabled: !waitingForToday },
  );

  useEffect(() => {
    document.title = `${COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, []);

  const data = query.data;
  const hasRows = data !== undefined && data.items.length > 0;
  const total = toNumber(data?.total ?? 0);
  const pageCount = Math.ceil(total / values.size);

  // A page past the last one (a stale link, or rows deleted meanwhile) becomes the last page, once fresh data says so.
  const { clampPage } = set;
  const fresh = query.isSuccess && !query.isPlaceholderData;
  useEffect(() => {
    if (fresh) {
      clampPage(pageCount);
    }
  }, [fresh, pageCount, clampPage]);

  // A product type id the list does not hold (a stale or shared link) becomes All products, once the list has loaded.
  const { setFilter } = set;
  const productTypes = useProductTypesQuery();
  const knownTypes = productTypes.data;
  const chosenType =
    values.productType === null ? undefined : knownTypes?.find((type) => type.id.toLowerCase() === values.productType);
  const unknownType = knownTypes !== undefined && values.productType !== null && chosenType === undefined;
  useEffect(() => {
    if (unknownType) {
      setFilter('productType', null);
    }
  }, [unknownType, setFilter]);

  const todayFailed = waitingForToday && businessToday.isError;
  const failed = query.isError || todayFailed;
  const firstLoad = query.isPending && !hasRows && !todayFailed;
  const refetching = useDelayedFlag(query.isPlaceholderData && query.isFetching && hasRows, REFETCH_MARK_DELAY_MS);
  const empty = query.isSuccess && !hasRows;

  // The chips: a preset by its name, a custom range by its two dates; a product by its name (a retired one says so).
  let datesChip: string | null = null;
  if (values.dates === 'custom') {
    if (values.from !== null && values.to !== null) {
      datesChip = COPY.dates.range(
        formatCalendarDate(values.from) ?? values.from,
        formatCalendarDate(values.to) ?? values.to,
      );
    }
  } else if (values.dates !== null) {
    datesChip = COPY.dates.presets[values.dates];
  }
  let productChip: string | null = null;
  if (values.productType !== null && !unknownType) {
    productChip =
      chosenType === undefined
        ? COPY.productLoading
        : chosenType.status === 'retired'
          ? ORDER_LISTS_COPY.retired(chosenType.name)
          : chosenType.name;
  }

  // A search or filter that finds nothing is No matches; the default view with nothing in it is the first-use state.
  const statusWords = statusLabel(values.status);
  const filtered =
    values.q !== null ||
    values.status !== 'active' ||
    datesChip !== null ||
    productChip !== null ||
    values.hasBalance === 'true';
  const filterSummary = COPY.noMatches.join([
    COPY.noMatches.status(statusWords),
    ...(datesChip === null ? [] : [COPY.noMatches.dates(datesChip)]),
    ...(productChip === null ? [] : [COPY.noMatches.product(productChip)]),
    ...(values.hasBalance === 'true' ? [COPY.noMatches.balance] : []),
  ]);
  // Clear Filters leaves the sort, the rows per page and the view alone.
  const clearFilters = (): void => {
    set.setSearch('', { immediate: true });
    set.setFilters({ status: null, dates: null, from: null, to: null, productType: null, hasBalance: null });
  };

  const retry = (): void => {
    if (todayFailed) {
      businessToday.refetch();
    } else {
      void query.refetch();
    }
  };

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
      <OrdersToolbar values={values} set={set} view={view} onViewChange={setView} />
      <ResultBar count={total} thing={COPY.thing} things={COPY.things} sortLabel={COPY.sortedBy[values.sort]}>
        {values.q !== null && (
          <FilterChip
            label={COPY.chips.search}
            value={values.q}
            onClear={() => {
              set.setSearch('', { immediate: true });
            }}
          />
        )}
        {values.status !== 'active' && (
          <FilterChip
            label={COPY.chips.status}
            value={statusWords}
            onClear={() => {
              set.setFilter('status', null);
            }}
          />
        )}
        {datesChip !== null && (
          <FilterChip
            label={COPY.chips.dates}
            value={datesChip}
            onClear={() => {
              set.setFilters({ dates: null, from: null, to: null });
            }}
          />
        )}
        {productChip !== null && (
          <FilterChip
            label={COPY.chips.product}
            value={productChip}
            onClear={() => {
              set.setFilter('productType', null);
            }}
          />
        )}
        {values.hasBalance === 'true' && (
          <FilterChip
            label={COPY.balance.chip}
            clearName={COPY.balance.clearName}
            onClear={() => {
              set.setFilter('hasBalance', null);
            }}
          />
        )}
      </ResultBar>
      <h2 id={HEADING_ID} tabIndex={-1} className={srOnlyClasses}>
        {COPY.results}
      </h2>
      {view === 'table' ? (
        <OrdersTable
          rows={data?.items}
          pending={firstLoad}
          refetching={query.isPlaceholderData && query.isFetching}
          failed={failed}
          error={todayFailed ? businessToday.error : query.error}
          onRetry={retry}
          filtered={filtered}
          search={values.q}
          filterSummary={filterSummary}
          onClearFilters={clearFilters}
          emptyIcon="clipboard-list"
          emptyTitle={COPY.empty.title}
          emptyMessage={COPY.empty.message}
          emptyAction={
            <ButtonLink variant="primary" icon="plus" to="/admin/orders/new">
              {COPY.newOrder}
            </ButtonLink>
          }
          today={data?.today ?? ''}
          onOpen={(entry) => {
            open(`/admin/orders/${entry.id}`);
          }}
          onEdit={(entry) => {
            open(`/admin/orders/${entry.id}/edit`);
          }}
        />
      ) : (
        <>
          {failed && (
            <ErrorState things={COPY.things} error={todayFailed ? businessToday.error : query.error} onRetry={retry} />
          )}
          <LoadingRegion loading={firstLoad || refetching} things={COPY.things} failed={failed}>
            {firstLoad && (
              <div className={ordersGridClasses}>
                {SKELETON_CARDS.map((key) => (
                  <SkeletonCard key={key} />
                ))}
              </div>
            )}
            {empty && filtered && (
              <EmptyState
                icon="search"
                title={LISTS_COPY.noMatchesTitle}
                message={LISTS_COPY.noMatchesBody(COPY.things, values.q, filterSummary)}
                action={
                  <Button variant="secondary" onClick={clearFilters}>
                    {LISTS_COPY.clearFilters}
                  </Button>
                }
              />
            )}
            {empty && !filtered && (
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
        </>
      )}
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
