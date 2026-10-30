// O1 Order page, /admin/orders/:id (ORD-07, ORD-12, ORD-19; plans 08-10, 08-12). The header, the phone balance card, the Images card
// (coming soon, D-27), the tab card (Items, Payments, Discounts, Expenses, and Refunds when it applies) and the side with the totals
// panel, the customer card and the status history. Every figure is the server's answer: Subtotal to Balance, and the internal Order
// Expenses and Estimated Profit, which only this staff page and the deleted view show (ORD-19, D-06, D-08). The tab is the URL
// `tab` parameter. The first load shows skeletons, a failed load an ErrorState with Try Again, and a missing or deleted order a
// message with Back to Orders. The back link returns to the list view the user left, when the navigation state holds a same-app
// Orders address (D-51).
import { useEffect } from 'react';
import { useLocation, useParams } from 'react-router';
import { ButtonLink } from '@/components/actions';
import { Icon } from '@/components/brand';
import { getTabPanelProps, Tabs, type TabItem } from '@/components/choice';
import { Skeleton } from '@/components/feedback';
import { pageHeadTitleClasses, srOnlyClasses } from '@/components/layout/layout.recipe';
import { SkeletonTable } from '@/components/lists';
import { OrderTotals } from '@/components/money';
import { ErrorState, LoadingRegion, SkeletonCard, SkeletonText, STATES_COPY } from '@/components/states';
import { isHttpError } from '@/core/api/errors';
import { OrderHeader } from '@/modules/admin/components/OrderHeader';
import { OrderBalanceStrip } from '@/modules/admin/components/OrderBalanceStrip';
import { OrderCustomerCard } from '@/modules/admin/components/OrderCustomerCard';
import { OrderDiscountsTab } from '@/modules/admin/components/OrderDiscountsTab';
import { OrderExpensesTab } from '@/modules/admin/components/OrderExpensesTab';
import { OrderItemsTab } from '@/modules/admin/components/OrderItemsTab';
import { OrderPaymentsTab } from '@/modules/admin/components/OrderPaymentsTab';
import { OrderRefundsTab } from '@/modules/admin/components/OrderRefundsTab';
import { OrderStatusHistory } from '@/modules/admin/components/OrderStatusHistory';
import {
  orderCardClasses,
  orderCardHeadClasses,
  orderCardHintClasses,
  orderCardTitleClasses,
  orderDetailClasses,
  orderImagesBodyClasses,
  orderImageTileClasses,
  orderMainClasses,
  orderPageClasses,
  orderSideClasses,
  orderStateActionClasses,
  orderTabsRowClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { safeReturnUrl } from '@/modules/admin/guard';
import { useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { useOrderTab, type OrderTab } from '@/modules/admin/hooks/useOrderTab';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { showRefundsTab } from '@/modules/admin/orderRules';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { OrderStatus } from '@/utils/csps';

const COPY = ORDER_PAGE_COPY;
const ID_BASE = 'order';
const ORDERS_PATH = '/admin/orders';
/** The id of the Totals heading: the phone balance card scrolls to it and focuses it (D-33). */
const TOTALS_ID = 'order-totals';
/** The tabs every order draws; Refunds joins them when `showRefundsTab` says so (D-13). */
const BASE_TABS = ['items', 'payments', 'discounts', 'expenses'] as const satisfies readonly OrderTab[];

/** The Items table's shape while it loads. */
const SKELETON_COLUMNS = [
  { key: 'product', header: COPY.items.columns.product, lead: true },
  { key: 'description', header: COPY.items.columns.description },
  { key: 'size', header: COPY.items.columns.size },
  { key: 'quantity', header: COPY.items.columns.quantity, money: true },
  { key: 'unitPrice', header: COPY.items.columns.unitPrice, money: true },
  { key: 'lineTotal', header: COPY.items.columns.lineTotal, money: true },
] as const;

/**
 * Where Back goes: the list address the card link sent in the navigation state, when it is a literal Orders path (D-51). Anything
 * else, a foreign host, a protocol-relative address, another admin page or a value that is not text, goes to the Orders list
 * (CWE-601, T-08-18). `safeReturnUrl` keeps only admin paths; the prefix check then keeps only Orders ones.
 */
function backTarget(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state) || typeof state.from !== 'string') {
    return ORDERS_PATH;
  }
  const from = safeReturnUrl(state.from);
  const path = from.split(/[?#]/)[0] ?? '';
  return path === ORDERS_PATH || path.startsWith(`${ORDERS_PATH}/`) ? from : ORDERS_PATH;
}

function tabItems(order: OrderDetailResponse, refundsShown: boolean): readonly TabItem<OrderTab>[] {
  return [
    { id: 'items', label: COPY.tabs.items, count: order.items.length },
    { id: 'payments', label: COPY.tabs.payments, count: order.payments.length },
    { id: 'discounts', label: COPY.tabs.discounts, count: order.discounts.length },
    { id: 'expenses', label: COPY.tabs.expenses, count: order.expenses.length },
    ...(refundsShown ? [{ id: 'refunds', label: COPY.tabs.refunds, count: order.refunds.length } as const] : []),
  ];
}

/** The body of one tab panel. */
function TabBody({ tab, order }: { tab: OrderTab; order: OrderDetailResponse }) {
  switch (tab) {
    case 'items':
      return <OrderItemsTab order={order} />;
    case 'payments':
      return <OrderPaymentsTab order={order} />;
    case 'discounts':
      return <OrderDiscountsTab order={order} />;
    case 'expenses':
      return <OrderExpensesTab order={order} />;
    case 'refunds':
      return <OrderRefundsTab order={order} />;
  }
}

function ImagesCard() {
  return (
    <section className={orderCardClasses} aria-labelledby="order-images">
      <div className={orderCardHeadClasses}>
        <div>
          <h2 id="order-images" className={orderCardTitleClasses}>
            {COPY.images.title}
          </h2>
          <p className={orderCardHintClasses}>{COPY.images.hint}</p>
        </div>
      </div>
      <div className={orderImagesBodyClasses}>
        <span className={orderImageTileClasses}>
          <Icon name="image" size={24} />
        </span>
        <p>{COPY.images.soon}</p>
      </div>
    </section>
  );
}

/** The first-load placeholder: the header lines, the tab table and the totals card, in the places the real ones land. */
function OrderSkeleton() {
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

interface OrderBodyProps {
  order: OrderDetailResponse;
  backTo: string;
}

/** The loaded page: the header, then the Images card and the tab card beside the totals panel. */
function OrderBody({ order, backTo }: OrderBodyProps) {
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
  return (
    <>
      <OrderHeader order={order} backTo={backTo} />
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
              {COPY.totals}
            </h2>
            <OrderTotals variant="panel" totals={order.totals} status={order.status as OrderStatus} />
          </section>
          <OrderCustomerCard order={order} />
          <OrderStatusHistory history={order.statusHistory} />
        </div>
      </div>
    </>
  );
}

export default function OrderPage() {
  const { id = '' } = useParams();
  const location = useLocation();
  const query = useOrderQuery(id);

  const order = query.data;
  const number = order?.number;
  useEffect(() => {
    document.title = `${number ?? COPY.documentTitle}${ADMIN_COPY.titleSuffix}`;
  }, [number]);

  // A failed refetch behind an order already on screen keeps the order; the states below are for a page with no order yet.
  const failed = query.isError && order === undefined;
  const notFound = failed && isHttpError(query.error) && query.error.status === 404;
  return (
    <div className={orderPageClasses}>
      {notFound && (
        <>
          <ErrorState title={COPY.states.notFound} />
          <div className={orderStateActionClasses}>
            <ButtonLink variant="secondary" to={ORDERS_PATH}>
              {COPY.states.backToOrders}
            </ButtonLink>
          </div>
        </>
      )}
      {failed && !notFound && (
        <ErrorState
          title={COPY.states.loadFailed}
          message={STATES_COPY.error.loadFailedBody}
          error={query.error}
          onRetry={() => {
            void query.refetch();
          }}
        />
      )}
      <LoadingRegion loading={query.isPending} things={COPY.states.things} failed={failed} className={orderPageClasses}>
        {query.isPending && <OrderSkeleton />}
        {order !== undefined && <OrderBody order={order} backTo={backTarget(location.state)} />}
      </LoadingRegion>
    </div>
  );
}
