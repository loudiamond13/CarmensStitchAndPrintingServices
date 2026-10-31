// O1 Order page, /admin/orders/:id (ORD-07, ORD-12, ORD-19; plans 08-10, 08-12). The header, the phone balance card, the Images card
// (coming soon, D-27), the tab card (Items, Payments, Discounts, Expenses, and Refunds when it applies) and the side with the totals
// panel, the customer card and the status history. Every figure is the server's answer: Subtotal to Balance, and the internal Order
// Expenses and Estimated Profit, which only this staff page and the deleted view show (ORD-19, D-06, D-08). The tab is the URL
// `tab` parameter. The first load shows skeletons, a failed load an ErrorState with Try Again, and a missing or deleted order a
// message with Back to Orders. The back link returns to the list view the user left, when the navigation state holds a same-app
// Orders address (D-51).
import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { Button, ButtonLink } from '@/components/actions';
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
import { OrderLockedBanner } from '@/modules/admin/components/OrderLockedBanner';
import { OrderPaymentsTab } from '@/modules/admin/components/OrderPaymentsTab';
import { OrderRefundModal } from '@/modules/admin/components/OrderRefundModal';
import { OrderRefundsTab } from '@/modules/admin/components/OrderRefundsTab';
import { OrderStatusHistory } from '@/modules/admin/components/OrderStatusHistory';
import { ReopenOrderModal } from '@/modules/admin/components/ReopenOrderModal';
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
import { useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { useOrderTab, type OrderTab } from '@/modules/admin/hooks/useOrderTab';
import { backTarget, ORDERS_PATH } from '@/modules/admin/orderNavigation';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { canAddRefund, isLocked, showRefundsTab } from '@/modules/admin/orderRules';
import { CHANGE_STATUS_ID, RECORD_REFUND_ID, REOPEN_ORDER_ID } from '@/modules/admin/orderStatus';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { isPositiveMoney, type OrderStatus } from '@/utils/csps';
import { centavosToMoneyText } from '@/utils/format';

const COPY = ORDER_PAGE_COPY;
const ID_BASE = 'order';
/** The id of the Totals heading: the phone balance card scrolls to it and focuses it (D-33). */
const TOTALS_ID = 'order-totals';
/** The amount Record Refund fills in: the customer credit as money text, else nothing (D-19). */
function creditPrefill(order: OrderDetailResponse): string | undefined {
  return isPositiveMoney(order.totals.customerCredit)
    ? centavosToMoneyText(Math.round(Number(order.totals.customerCredit) * 100))
    : undefined;
}

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
  const locked = isLocked(order);
  // Where focus goes once the order has changed state: Reopen Order after a complete or cancel, Change Status after a reopen.
  // The button is not on the page until the answer has rendered, so the wish is kept and carried out after that render.
  const focusWish = useRef<'reopen' | 'status' | null>(null);
  const [reopenOpen, setReopenOpen] = useState(false);
  // Record Refund opens the refund window with the credit filled in (D-19). The window mounts on its first open and stays so its
  // close can animate; each new open starts clean. After it closes, focus goes to the Totals heading when the refund was saved
  // (the button may be gone), else back to Record Refund.
  const [refundUsed, setRefundUsed] = useState(false);
  const [refundOpen, setRefundOpen] = useState(false);
  const refundFocus = useRef<'record' | 'totals' | null>(null);
  useEffect(() => {
    const wish = focusWish.current;
    if ((wish === 'reopen' && locked) || (wish === 'status' && !locked)) {
      focusWish.current = null;
      document.getElementById(wish === 'reopen' ? REOPEN_ORDER_ID : CHANGE_STATUS_ID)?.focus();
    }
    const refundWish = refundFocus.current;
    if (refundWish !== null && !refundOpen) {
      refundFocus.current = null;
      const target = refundWish === 'record' ? document.getElementById(RECORD_REFUND_ID) : null;
      (target ?? document.getElementById(TOTALS_ID))?.focus();
    }
  });
  return (
    <>
      <OrderHeader
        order={order}
        backTo={backTo}
        onStatusMoved={(answer) => {
          if (isLocked(answer)) {
            focusWish.current = 'reopen';
          }
        }}
      />
      {locked && (
        <OrderLockedBanner status={order.status === 'completed' ? 'completed' : 'cancelled'}>
          <Button
            variant="secondary"
            size="sm"
            icon="lock-open"
            id={REOPEN_ORDER_ID}
            onClick={() => {
              setReopenOpen(true);
            }}
          >
            {COPY.locked.reopenOrder}
          </Button>
        </OrderLockedBanner>
      )}
      <ReopenOrderModal
        order={order}
        open={reopenOpen}
        onReopened={() => {
          focusWish.current = 'status';
        }}
        onClose={() => {
          setReopenOpen(false);
          // A dismissed window leaves the order locked: focus goes back to the button that opened it (a reopen set its own wish).
          focusWish.current ??= 'reopen';
        }}
      />
      {refundUsed && (
        <OrderRefundModal
          mode="add"
          order={order}
          prefillAmount={creditPrefill(order)}
          open={refundOpen}
          onSaved={() => {
            refundFocus.current = 'totals';
          }}
          onClose={() => {
            setRefundOpen(false);
            refundFocus.current ??= 'record';
          }}
        />
      )}
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
            <OrderTotals
              variant="panel"
              totals={order.totals}
              status={order.status as OrderStatus}
              recordRefundId={RECORD_REFUND_ID}
              onRecordRefund={
                canAddRefund(order)
                  ? () => {
                      setRefundUsed(true);
                      setRefundOpen(true);
                    }
                  : undefined
              }
            />
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
