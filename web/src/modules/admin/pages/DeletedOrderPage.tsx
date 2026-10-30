// X2 Deleted order, read-only, /admin/orders/deleted/:id (ORD-06, ORD-07, D-24, D-57; plan 08-23). The order page's layout and data
// with every write removed: a header with no menu or actions, a banner saying who deleted the order and when, and the only two
// things a Manager can do, Restore Order and Delete Order Permanently. The tabs, the totals panel (Order Expenses and Estimated
// Profit included), the customer card and the status history all render `readOnly`; the totals panel gets no Record Refund.
//   - The order is the server's deleted read (`GET /orders/deleted/{id}`); the tab is the URL `tab` parameter, as on the order page.
//   - The route's loader sends an Admin to /admin/orders; the API answers 403 for a role lost mid-session and the page then shows
//     the access banner.
//   - Restore sends one POST with an Idempotency-Key, then goes to the live order with the toast. Delete Order Permanently opens
//     the counts dialog (type the order number), then goes back to Deleted Orders.
//   - A 404 (restored or deleted for good meanwhile) shows "This order isn't in Deleted Orders." with a way back.
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useEffect, useRef, useState, type Ref } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Button, ButtonLink, hitAreaClasses, UiLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { getTabPanelProps, Tabs, type TabItem } from '@/components/choice';
import { ActorName, RecordMeta, WALK_IN_CUSTOMER } from '@/components/data';
import { Skeleton, useToast } from '@/components/feedback';
import {
  loginBackClasses,
  pageHeadClasses,
  pageHeadTitleClasses,
  srOnlyClasses,
} from '@/components/layout/layout.recipe';
import { SkeletonTable } from '@/components/lists';
import { OrderTotals } from '@/components/money';
import { ErrorState, LoadingRegion, SkeletonCard, SkeletonText, STATES_COPY } from '@/components/states';
import { StatusBadge } from '@/components/status';
import { isHttpError } from '@/core/api/errors';
import { DueFlag } from '@/modules/admin/components/DueFlag';
import { OrderBalanceStrip } from '@/modules/admin/components/OrderBalanceStrip';
import { OrderCustomerCard } from '@/modules/admin/components/OrderCustomerCard';
import { OrderDiscountsTab } from '@/modules/admin/components/OrderDiscountsTab';
import { OrderExpensesTab } from '@/modules/admin/components/OrderExpensesTab';
import { OrderItemsTab } from '@/modules/admin/components/OrderItemsTab';
import { OrderNoticeBanner } from '@/modules/admin/components/OrderNoticeBanner';
import { OrderPaymentsTab } from '@/modules/admin/components/OrderPaymentsTab';
import { OrderRefundsTab } from '@/modules/admin/components/OrderRefundsTab';
import { OrderStatusHistory } from '@/modules/admin/components/OrderStatusHistory';
import { PurgeOrderDialog } from '@/modules/admin/components/PurgeOrderDialog';
import {
  orderBackRowClasses,
  orderCardClasses,
  orderCardHeadClasses,
  orderCardHintClasses,
  orderCardTitleClasses,
  orderDetailClasses,
  orderImagesBodyClasses,
  orderImageTileClasses,
  orderMainClasses,
  orderNumberClasses,
  orderPageClasses,
  orderSideClasses,
  orderStateActionClasses,
  orderSublineClasses,
  orderSublineStrongClasses,
  orderTabsRowClasses,
  orderTitleRowClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { DELETED_ORDERS_COPY } from '@/modules/admin/deletedOrdersCopy';
import { useDeletedOrderQuery } from '@/modules/admin/hooks/useDeletedOrderQuery';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { orderKey } from '@/modules/admin/hooks/useOrderQuery';
import { useOrderTab, type OrderTab } from '@/modules/admin/hooks/useOrderTab';
import { useRefreshOrders } from '@/modules/admin/hooks/useRefreshOrders';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { showRefundsTab } from '@/modules/admin/orderRules';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { DeletedOrderDetailResponse } from '@/modules/admin/services/deletedOrdersService';
import { deletedOrdersService } from '@/modules/admin/services/deletedOrdersService';
import type { OrderStatus } from '@/utils/csps';
import { describeHttpError, errorLine } from '@/utils/describeHttpError';
import { formatBusinessDateTime, formatCalendarDate } from '@/utils/format';

const COPY = DELETED_ORDERS_COPY.detail;
const PAGE = ORDER_PAGE_COPY;
const ID_BASE = 'order';
/** The id of the Totals heading: the phone balance card scrolls to it and focuses it (D-33). */
const TOTALS_ID = 'order-totals';
const LIST_PATH = '/admin/orders/deleted';

/** The tabs every order draws; Refunds joins them when `showRefundsTab` says so (D-13). */
const BASE_TABS = ['items', 'payments', 'discounts', 'expenses'] as const satisfies readonly OrderTab[];

/** The Items table's shape while it loads. */
const SKELETON_COLUMNS = [
  { key: 'product', header: PAGE.items.columns.product, lead: true },
  { key: 'description', header: PAGE.items.columns.description },
  { key: 'size', header: PAGE.items.columns.size },
  { key: 'quantity', header: PAGE.items.columns.quantity, money: true },
  { key: 'unitPrice', header: PAGE.items.columns.unitPrice, money: true },
  { key: 'lineTotal', header: PAGE.items.columns.lineTotal, money: true },
] as const;

function tabItems(order: OrderDetailResponse, refundsShown: boolean): readonly TabItem<OrderTab>[] {
  return [
    { id: 'items', label: PAGE.tabs.items, count: order.items.length },
    { id: 'payments', label: PAGE.tabs.payments, count: order.payments.length },
    { id: 'discounts', label: PAGE.tabs.discounts, count: order.discounts.length },
    { id: 'expenses', label: PAGE.tabs.expenses, count: order.expenses.length },
    ...(refundsShown ? [{ id: 'refunds', label: PAGE.tabs.refunds, count: order.refunds.length } as const] : []),
  ];
}

/** The body of one tab panel: every tab shows its table alone. */
function TabBody({ tab, order }: { tab: OrderTab; order: OrderDetailResponse }) {
  switch (tab) {
    case 'items':
      return <OrderItemsTab order={order} readOnly />;
    case 'payments':
      return <OrderPaymentsTab order={order} readOnly />;
    case 'discounts':
      return <OrderDiscountsTab order={order} readOnly />;
    case 'expenses':
      return <OrderExpensesTab order={order} readOnly />;
    case 'refunds':
      return <OrderRefundsTab order={order} readOnly />;
  }
}

function ImagesCard() {
  return (
    <section className={orderCardClasses} aria-labelledby="order-images">
      <div className={orderCardHeadClasses}>
        <div>
          <h2 id="order-images" className={orderCardTitleClasses}>
            {PAGE.images.title}
          </h2>
          <p className={orderCardHintClasses}>{PAGE.images.hint}</p>
        </div>
      </div>
      <div className={orderImagesBodyClasses}>
        <span className={orderImageTileClasses}>
          <Icon name="image" size={24} />
        </span>
        <p>{PAGE.images.soon}</p>
      </div>
    </section>
  );
}

/** The first-load placeholder: the header lines, the tab table and the totals card, in the places the real ones land. */
function DeletedOrderSkeleton() {
  return (
    <>
      <div className={pageHeadTitleClasses} aria-hidden="true">
        <Skeleton width={72} height={14} />
        <Skeleton width={240} height={34} />
        <SkeletonText lines={2} />
      </div>
      <div className={orderDetailClasses}>
        <div className={orderMainClasses}>
          <SkeletonTable columns={SKELETON_COLUMNS} />
        </div>
        <div className={orderSideClasses}>
          <SkeletonCard />
        </div>
      </div>
    </>
  );
}

/** The header without a menu or actions: the back link, the number with its status, the subline and who recorded and changed it. */
function DeletedOrderHeader({ order }: { order: OrderDetailResponse }) {
  const ordered = formatCalendarDate(order.orderDate) ?? order.orderDate;
  const hasTeam = order.teamName !== null && order.teamName !== '';
  return (
    <div className={pageHeadClasses}>
      <div className={pageHeadTitleClasses}>
        <div className={orderBackRowClasses}>
          <UiLink to={LIST_PATH} className={clsx(loginBackClasses, hitAreaClasses)}>
            <Icon name="chevron-left" size={16} />
            {COPY.back}
          </UiLink>
        </div>
        <div className={orderTitleRowClasses}>
          <h1 tabIndex={-1} className={orderNumberClasses}>
            {order.number}
          </h1>
          <StatusBadge status={order.status as OrderStatus} />
        </div>
        <p className={orderSublineClasses}>
          <strong className={orderSublineStrongClasses}>{hasTeam ? order.teamName : order.customerName}</strong>
          {PAGE.header.separator}
          {hasTeam ? order.customerName : WALK_IN_CUSTOMER}
          {PAGE.header.separator}
          {PAGE.header.ordered(ordered)}
          {PAGE.header.separator}
          <DueFlag dueDate={order.dueDate} status={order.status} today={order.today} />
        </p>
        <RecordMeta
          recordedBy={order.recordedBy}
          recordedAt={order.recordedAt}
          lastChangedBy={order.lastChangedBy}
          lastChangedAt={order.lastChangedAt}
        />
      </div>
    </div>
  );
}

interface DeletedOrderBodyProps {
  deleted: DeletedOrderDetailResponse;
  /** Restore Order was pressed: true while its request runs. */
  restoring: boolean;
  onRestore: () => void;
  onPurge: () => void;
  purgeRef: Ref<HTMLButtonElement>;
}

/** The loaded page: the header and banner, then the Images card and the tab card beside the totals panel. */
function DeletedOrderBody({ deleted, restoring, onRestore, onPurge, purgeRef }: DeletedOrderBodyProps) {
  const { order } = deleted;
  const { tab, setTab } = useOrderTab();
  const refundsShown = showRefundsTab(order);
  const shownTabs: readonly OrderTab[] = refundsShown ? [...BASE_TABS, 'refunds'] : BASE_TABS;
  // A tab the page does not draw (Refunds on an order that has none) becomes Items with one replace (UIC-46).
  const hiddenTab = tab === 'refunds' && !refundsShown;
  useEffect(() => {
    if (hiddenTab) {
      setTab('items');
    }
  }, [hiddenTab, setTab]);
  const active: OrderTab = hiddenTab ? 'items' : tab;
  const when = formatBusinessDateTime(deleted.deletedAt);
  return (
    <>
      <DeletedOrderHeader order={order} />
      <OrderNoticeBanner
        icon="archive"
        title={
          <>
            {COPY.banner.deletedOn(when)}
            {deleted.deletedBy !== null && (
              <>
                {COPY.banner.by}
                <ActorName actor={deleted.deletedBy} />
              </>
            )}
            {COPY.banner.end}
          </>
        }
        message={COPY.banner.message}
      >
        <Button variant="primary" icon="rotate-ccw" pending={restoring} onClick={onRestore}>
          {restoring ? COPY.banner.restoring : COPY.banner.restore}
        </Button>
        <Button ref={purgeRef} variant="ghost-danger" icon="eraser" onClick={onPurge}>
          {COPY.banner.purge}
        </Button>
      </OrderNoticeBanner>
      <OrderBalanceStrip totals={order.totals} status={order.status} />
      <div className={orderDetailClasses}>
        <div className={orderMainClasses}>
          <ImagesCard />
          <section className={orderCardClasses}>
            <div className={orderTabsRowClasses}>
              <Tabs idBase={ID_BASE} items={tabItems(order, refundsShown)} value={active} onChange={setTab} />
            </div>
            {shownTabs.map((shown) => (
              <div key={shown} {...getTabPanelProps(ID_BASE, shown)} hidden={active !== shown}>
                {active === shown && <TabBody tab={shown} order={order} />}
              </div>
            ))}
          </section>
        </div>
        <div className={orderSideClasses}>
          <section aria-labelledby={TOTALS_ID}>
            <h2 id={TOTALS_ID} tabIndex={-1} className={srOnlyClasses}>
              {PAGE.totals}
            </h2>
            <OrderTotals variant="panel" totals={order.totals} status={order.status as OrderStatus} />
          </section>
          <OrderCustomerCard order={order} readOnly />
          <OrderStatusHistory history={order.statusHistory} />
        </div>
      </div>
    </>
  );
}

export default function DeletedOrderPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();
  const refreshAll = useRefreshOrders();
  const query = useDeletedOrderQuery(id, true);
  const [purgeOpen, setPurgeOpen] = useState(false);
  const purgeRef = useRef<HTMLButtonElement>(null);
  // Safari does not focus a button on a click, so the dialog's own return to its trigger has nothing to go back to. Once the dialog
  // has closed, the button takes focus back here.
  const focusPurge = useRef(false);
  useEffect(() => {
    if (focusPurge.current && !purgeOpen) {
      focusPurge.current = false;
      purgeRef.current?.focus();
    }
  });

  const deleted = query.data;
  const number = deleted?.order.number;
  useEffect(() => {
    document.title = `${number === undefined ? COPY.documentTitle : COPY.titleOf(number)}${ADMIN_COPY.titleSuffix}`;
  }, [number]);

  const restoration = useOrderAction(
    (key, target: { readonly id: string; readonly number: string }) => deletedOrdersService.restore(target.id, key),
    (_result, target) => {
      // The live order page must read the order fresh, not what was cached before it was deleted.
      queryClient.removeQueries({ queryKey: orderKey(target.id) });
      toast.show({
        title: DELETED_ORDERS_COPY.restore.toast.title,
        message: DELETED_ORDERS_COPY.restore.toast.message(target.number),
      });
      void navigate(`/admin/orders/${target.id}`);
      return refreshAll();
    },
  );

  const restore = async (): Promise<void> => {
    if (deleted === undefined) {
      return;
    }
    const target = { id: deleted.order.id, number: deleted.order.number };
    const outcome = await restoration.submit(target);
    if (outcome.ok) {
      return;
    }
    // A 404 means the order left Deleted Orders meanwhile: read it again and the page says so.
    if (isHttpError(outcome.error) && outcome.error.status === 404) {
      void query.refetch();
      void refreshAll();
      return;
    }
    const copy = describeHttpError(outcome.error);
    if (copy !== null) {
      toast.show({
        tone: 'danger',
        title: DELETED_ORDERS_COPY.restore.failed(target.number),
        message: errorLine(copy),
      });
    }
  };

  // A failed refetch behind an order already on screen keeps the order; the states below are for a page with no order yet. A 404
  // always wins: the order is no longer in Deleted Orders, whatever was read before.
  const status = isHttpError(query.error) ? query.error.status : undefined;
  const notFound = status === 404;
  const forbidden = status === 403;
  const failed = query.isError && deleted === undefined && !notFound && !forbidden;
  const denied = forbidden ? describeHttpError(query.error) : null;
  return (
    <div className={orderPageClasses}>
      {notFound && (
        <>
          <ErrorState title={COPY.states.notFound} message={COPY.states.notFoundBody} />
          <div className={orderStateActionClasses}>
            <ButtonLink variant="secondary" to={LIST_PATH}>
              {COPY.states.backToList}
            </ButtonLink>
          </div>
        </>
      )}
      {denied !== null && <ErrorState title={denied.title} message={denied.body} error={query.error} />}
      {failed && (
        <ErrorState
          title={COPY.states.loadFailed}
          message={STATES_COPY.error.loadFailedBody}
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
      <LoadingRegion
        loading={query.isPending}
        things={COPY.things}
        failed={failed || notFound || forbidden}
        className={orderPageClasses}
      >
        {query.isPending && <DeletedOrderSkeleton />}
        {deleted !== undefined && !notFound && !forbidden && (
          <DeletedOrderBody
            deleted={deleted}
            restoring={restoration.pending}
            onRestore={() => {
              void restore();
            }}
            onPurge={() => {
              setPurgeOpen(true);
            }}
            purgeRef={purgeRef}
          />
        )}
      </LoadingRegion>
      {deleted !== undefined && !notFound && !forbidden && (
        <PurgeOrderDialog
          orderId={deleted.order.id}
          number={deleted.order.number}
          team={deleted.order.teamName}
          customer={deleted.order.customerName}
          open={purgeOpen}
          onClose={() => {
            setPurgeOpen(false);
            focusPurge.current = true;
          }}
          onDone={() => {
            void navigate(LIST_PATH);
          }}
        />
      )}
    </div>
  );
}
