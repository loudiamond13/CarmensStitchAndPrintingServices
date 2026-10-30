// O1 Order page, /admin/orders/:id (ORD-07, ORD-12, ORD-19; plan 08-10). The header, the Images card (coming soon, D-27), the tab card
// with the Items tab, and the side with the totals panel. Every figure is the server's answer: Subtotal to Balance, and the
// internal Order Expenses and Estimated Profit, which only this staff page and the deleted view show (ORD-19, D-06, D-08). The tab
// is the URL `tab` parameter. The payment, discount and expense panels, the customer card and the status history are added by
// plan 08-12.
import { useParams } from 'react-router';
import { Icon } from '@/components/brand';
import { getTabPanelProps, Tabs, type TabItem } from '@/components/choice';
import { srOnlyClasses } from '@/components/layout/layout.recipe';
import { OrderTotals } from '@/components/money';
import { OrderHeader } from '@/modules/admin/components/OrderHeader';
import { OrderItemsTab } from '@/modules/admin/components/OrderItemsTab';
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
  orderTabsRowClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { useOrderQuery } from '@/modules/admin/hooks/useOrderQuery';
import { useOrderTab, type OrderTab } from '@/modules/admin/hooks/useOrderTab';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import type { OrderStatus } from '@/utils/csps';

const COPY = ORDER_PAGE_COPY;
const ID_BASE = 'order';
/** The id of the Totals heading: the phone balance card scrolls to it and focuses it (D-33). */
const TOTALS_ID = 'order-totals';
/** The tabs this plan draws; Refunds joins them with plan 08-12. */
const SHOWN_TABS = ['items', 'payments', 'discounts', 'expenses'] as const satisfies readonly OrderTab[];

function tabItems(order: OrderDetailResponse): readonly TabItem<OrderTab>[] {
  return [
    { id: 'items', label: COPY.tabs.items, count: order.items.length },
    { id: 'payments', label: COPY.tabs.payments, count: order.payments.length },
    { id: 'discounts', label: COPY.tabs.discounts, count: order.discounts.length },
    { id: 'expenses', label: COPY.tabs.expenses, count: order.expenses.length },
  ];
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

export default function OrderPage() {
  const { id = '' } = useParams();
  const query = useOrderQuery(id);
  const { tab, setTab } = useOrderTab();

  const order = query.data;
  if (order === undefined) {
    return null;
  }

  // A tab this page does not draw (Refunds, until plan 08-12) reads as Items.
  const active: OrderTab = SHOWN_TABS.some((shown) => shown === tab) ? tab : 'items';

  return (
    <div className={orderPageClasses}>
      <OrderHeader order={order} backTo="/admin/orders" />
      <div className={orderDetailClasses}>
        <div className={orderMainClasses}>
          <ImagesCard />
          <section className={orderCardClasses}>
            <div className={orderTabsRowClasses}>
              <Tabs idBase={ID_BASE} items={tabItems(order)} value={active} onChange={setTab} />
            </div>
            {SHOWN_TABS.map((shown) => (
              <div key={shown} {...getTabPanelProps(ID_BASE, shown)} hidden={active !== shown}>
                {active === shown && shown === 'items' && <OrderItemsTab order={order} />}
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
        </div>
      </div>
    </div>
  );
}
