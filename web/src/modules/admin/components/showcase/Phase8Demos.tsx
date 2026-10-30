// The Phase 8 demos of the Component Showcase (UI-SPEC Component Inventory "Component Showcase additions"; D-30 to D-33 of phase 5; plan
// 08-24): the order pieces on made-up people and values, in the "Orders" section. OrderTotals in its balance states, OrderCard in its
// states, the due flag, the Delivered badge, the Change Status menu with Mark Completed off, the locked and notice banners, and the
// soft delete and permanent delete dialogs. The pieces are the real shared parts wired to local state: nothing here reads or writes a
// record, so the demos are safe in the public chunk. The static cases sit in page-root frames; a live demo that opens a fixed layer
// sits in a frame that is no page root.
import clsx from 'clsx';
import { useId, useState } from 'react';
import {
  Button,
  ConfirmDialog,
  OrderCard,
  OrderTotals,
  StatusBadge,
  type OrderCardOrder,
  type OrderFigures,
  type OrderStatus,
} from '@/components';
import { Icon } from '@/components/brand';
import { DueFlag } from '@/modules/admin/components/DueFlag';
import { softDeleteSentence } from '@/modules/admin/components/DeleteOrderDialog';
import { OrderLockedBanner } from '@/modules/admin/components/OrderLockedBanner';
import { OrderNoticeBanner } from '@/modules/admin/components/OrderNoticeBanner';
import { OrderStatusDot } from '@/modules/admin/components/OrderStatusDot';
import {
  orderStatusDividerClasses,
  orderStatusIconSlotClasses,
  orderStatusItemClasses,
  orderStatusItemTextClasses,
  orderStatusReasonClasses,
  orderStatusDangerItemClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { DemoCase } from '@/modules/admin/components/showcase/Phase5Demos';
import {
  badgesRowClasses,
  bannersStackClasses,
  dueCaseClasses,
  dueListClasses,
  orderCardsGridClasses,
  orderTotalsGridClasses,
  staffStackClasses,
  statusMenuColumnClasses,
  statusMenuStaticClasses,
} from '@/modules/admin/components/showcase/showcase.recipe';
import { SHOWCASE_COPY } from '@/modules/admin/components/showcase/showcaseCopy';
import { DELETED_ORDERS_COPY } from '@/modules/admin/deletedOrdersCopy';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { orderStatusLabel, otherActiveStatuses } from '@/modules/admin/orderStatus';

const DEMO = SHOWCASE_COPY.orders;
const STATUS = ORDER_PAGE_COPY.status;
const REMOVE = ORDER_PAGE_COPY.remove;
const PURGE = DELETED_ORDERS_COPY.purge;
const BANNER = DELETED_ORDERS_COPY.detail.banner;

/** The demo's business today (spec section 12 dates). */
const TODAY = '2026-10-12';

/** Exactly 100 characters with no break, the name limit: the worst case for a card title. */
const LONG_NAME = `Bartholomew${'Wolfeschlegel'.repeat(7)}123456789`.slice(0, 100);

/** ORD-2026-0148: balance due. Spec section 12.2 figures. */
const FIGURES_DUE: OrderFigures = {
  subtotal: '22450.00',
  discount: '1122.50',
  total: '21327.50',
  paid: '12000.00',
  refunded: '0.00',
  balance: '9327.50',
  customerCredit: '0.00',
  fullyPaid: false,
  expenses: '6065.00',
  profit: '15262.50',
};

/** ORD-2026-0151: Fully Paid. */
const FIGURES_PAID: OrderFigures = {
  subtotal: '23000.00',
  discount: '500.00',
  total: '22500.00',
  paid: '22500.00',
  refunded: '0.00',
  balance: '0.00',
  customerCredit: '0.00',
  fullyPaid: true,
  expenses: '7000.00',
  profit: '15500.00',
};

/** A customer who paid over the total. */
const FIGURES_CREDIT: OrderFigures = {
  subtotal: '9360.00',
  discount: '0.00',
  total: '9360.00',
  paid: '10000.00',
  refunded: '0.00',
  balance: '0.00',
  customerCredit: '640.00',
  fullyPaid: true,
  expenses: '2000.00',
  profit: '7360.00',
};

/** A Cancelled order with money unpaid: Not collected, and the profit is the money kept less the expenses. */
const FIGURES_CANCELLED: OrderFigures = {
  subtotal: '9360.00',
  discount: '0.00',
  total: '9360.00',
  paid: '3000.00',
  refunded: '500.00',
  balance: '6860.00',
  customerCredit: '0.00',
  fullyPaid: false,
  expenses: '3000.00',
  profit: '-500.00',
};

/** The largest figures the rules allow. */
const FIGURES_HUGE: OrderFigures = {
  subtotal: '100000000.00',
  discount: '0.01',
  total: '99999999.99',
  paid: '1000000.00',
  refunded: '0.00',
  balance: '98999999.99',
  customerCredit: '0.00',
  fullyPaid: false,
  expenses: '1000000.00',
  profit: '98999999.99',
};

interface CardCase {
  readonly key: string;
  readonly order: OrderCardOrder;
}

function card(key: string, order: Partial<OrderCardOrder> & Pick<OrderCardOrder, 'number' | 'status'>): CardCase {
  return {
    key,
    order: {
      teamName: 'Brgy. San Roque Ballers',
      customerName: 'Juan Dela Cruz',
      orderDate: '2026-09-28',
      dueDate: '2026-10-14',
      pieces: 48,
      ...FIGURES_DUE,
      ...order,
    },
  };
}

/** The card states: balance due, Fully Paid, a credit, no team, Delivered, Completed (no Edit), Cancelled and 100-character names. */
const CARDS: readonly CardCase[] = [
  card('due', { number: 'ORD-2026-0148', status: 'production' }),
  card('paid', {
    number: 'ORD-2026-0151',
    status: 'ready',
    teamName: 'Tondo Riders MC',
    customerName: 'Mark Villanueva',
    dueDate: '2026-10-10',
    pieces: 20,
    ...FIGURES_PAID,
  }),
  card('credit', { number: 'ORD-2026-0152', status: 'ready', pieces: 12, ...FIGURES_CREDIT }),
  card('no-team', {
    number: 'ORD-2026-0153',
    status: 'mockup',
    teamName: null,
    customerName: 'Angelica Santos',
    dueDate: '2026-10-05',
    pieces: 12,
    subtotal: '9360.00',
    discount: '0.00',
    total: '9360.00',
    paid: '3000.00',
    balance: '6360.00',
  }),
  card('delivered', { number: 'ORD-2026-0154', status: 'delivered', dueDate: '2026-10-12' }),
  card('completed', { number: 'ORD-2026-0155', status: 'completed', ...FIGURES_PAID }),
  card('cancelled', { number: 'ORD-2026-0156', status: 'cancelled', ...FIGURES_CANCELLED }),
  card('long', {
    number: 'ORD-2026-0157',
    status: 'pending',
    teamName: LONG_NAME,
    customerName: LONG_NAME,
    pieces: 9902,
    ...FIGURES_HUGE,
  }),
];

/** The totals panels: one per balance state, then the Cancelled note and the largest figures. */
const TOTALS: readonly { readonly key: string; readonly status: OrderStatus; readonly figures: OrderFigures }[] = [
  { key: 'due', status: 'production', figures: FIGURES_DUE },
  { key: 'paid', status: 'ready', figures: FIGURES_PAID },
  { key: 'credit', status: 'ready', figures: FIGURES_CREDIT },
  { key: 'cancelled', status: 'cancelled', figures: FIGURES_CANCELLED },
  { key: 'huge', status: 'production', figures: FIGURES_HUGE },
];

const STATUSES: readonly OrderStatus[] = [
  'pending',
  'mockup',
  'production',
  'ready',
  'delivered',
  'completed',
  'cancelled',
];

/** The due flag in each of its states, on a made-up today. */
const DUE_CASES: readonly { readonly label: string; readonly status: string; readonly dueDate: string | null }[] = [
  { label: 'Two days out', status: 'production', dueDate: '2026-10-14' },
  { label: 'The next day', status: 'production', dueDate: '2026-10-13' },
  { label: 'The same day', status: 'ready', dueDate: '2026-10-12' },
  { label: 'Past its date', status: 'mockup', dueDate: '2026-10-05' },
  { label: 'Empty date', status: 'pending', dueDate: null },
  { label: 'Delivered, past its date', status: 'delivered', dueDate: '2026-10-05' },
];

function TotalsDemo() {
  return (
    <div className={orderTotalsGridClasses}>
      {TOTALS.map(({ key, status, figures }) => (
        <OrderTotals key={key} totals={figures} status={status} variant="panel" />
      ))}
    </div>
  );
}

function CardsDemo() {
  return (
    <div className={orderCardsGridClasses}>
      {CARDS.map(({ key, order }) => (
        <OrderCard
          key={key}
          order={order}
          due={<DueFlag dueDate={order.dueDate} status={order.status} today={TODAY} />}
          onView={() => undefined}
          onEdit={() => undefined}
        />
      ))}
    </div>
  );
}

function DueFlagsDemo() {
  return (
    <ul className={dueListClasses}>
      {DUE_CASES.map(({ label, status, dueDate }) => (
        <li key={label} className={dueCaseClasses}>
          <span>{label}</span>
          <DueFlag dueDate={dueDate} status={status} today={TODAY} />
        </li>
      ))}
      <li className={dueCaseClasses}>
        <span>Stacked (table cell)</span>
        <DueFlag dueDate="2026-10-05" status="mockup" today={TODAY} layout="stacked" />
      </li>
    </ul>
  );
}

function BadgesDemo() {
  return (
    <div className={badgesRowClasses}>
      {STATUSES.map((status) => (
        <StatusBadge key={status} status={status} />
      ))}
    </div>
  );
}

/** The Change Status menu drawn open on a Production order that owes money, so Mark Completed is off and says why. Nothing here sends a move. */
function StatusMenuDemo() {
  const buttonId = useId();
  return (
    <div className={statusMenuColumnClasses}>
      <Button id={buttonId} variant="secondary" size="sm" icon="chevron-down" aria-haspopup="menu" aria-expanded>
        {DEMO.changeStatus}
      </Button>
      <div role="menu" aria-labelledby={buttonId} data-state="open" className={statusMenuStaticClasses}>
        {otherActiveStatuses('production').map((status) => (
          <button key={status} type="button" role="menuitem" tabIndex={-1} className={orderStatusItemClasses}>
            <span className={orderStatusIconSlotClasses}>
              <OrderStatusDot status={status} />
            </span>
            <span>{STATUS.moveTo(orderStatusLabel(status))}</span>
          </button>
        ))}
        <div role="separator" className={orderStatusDividerClasses} />
        <button type="button" role="menuitem" tabIndex={-1} aria-disabled className={orderStatusItemClasses}>
          <span className={orderStatusIconSlotClasses}>
            <Icon name="circle-check" size={18} />
          </span>
          <span className={orderStatusItemTextClasses}>
            <span>{STATUS.markCompleted}</span>
            <span className={orderStatusReasonClasses}>{STATUS.completeReason}</span>
          </span>
        </button>
        <button
          type="button"
          role="menuitem"
          tabIndex={-1}
          className={clsx(orderStatusItemClasses, orderStatusDangerItemClasses)}
        >
          <span className={orderStatusIconSlotClasses}>
            <Icon name="x" size={18} />
          </span>
          <span>{STATUS.cancelOrder}</span>
        </button>
      </div>
    </div>
  );
}

function BannersDemo() {
  return (
    <div className={bannersStackClasses}>
      <OrderLockedBanner status="completed">
        <Button variant="secondary" icon="lock-open">
          {ORDER_PAGE_COPY.locked.reopenOrder}
        </Button>
      </OrderLockedBanner>
      <OrderLockedBanner status="cancelled">
        <Button variant="secondary" icon="lock-open">
          {ORDER_PAGE_COPY.locked.reopenOrder}
        </Button>
      </OrderLockedBanner>
      <OrderNoticeBanner
        icon="archive"
        title={`${BANNER.deletedOn('Oct 12, 2026, 9:30 AM')}${BANNER.by}Carmen Reyes${BANNER.end}`}
        message={BANNER.message}
      >
        <Button variant="primary" icon="rotate-ccw">
          {BANNER.restore}
        </Button>
        <Button variant="ghost-danger" icon="eraser">
          {BANNER.purge}
        </Button>
      </OrderNoticeBanner>
    </div>
  );
}

type DeleteKind = 'soft' | 'purge';

/** The soft delete and the permanent delete dialogs on a made-up order. Confirming only closes them. */
function DeleteDialogsDemo() {
  const [openKind, setOpenKind] = useState<DeleteKind | null>(null);
  const close = (): void => {
    setOpenKind(null);
  };
  const number = 'ORD-2026-0148';
  return (
    <>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          setOpenKind('soft');
        }}
      >
        {DEMO.openSoftDelete}
      </Button>
      <Button
        variant="danger"
        size="sm"
        onClick={() => {
          setOpenKind('purge');
        }}
      >
        {DEMO.openPurge}
      </Button>
      <ConfirmDialog
        open={openKind === 'soft'}
        title={REMOVE.title(number)}
        message={softDeleteSentence({ items: 5, payments: 2, discounts: 1, expenses: 3, refunds: 0 })}
        cancelLabel={REMOVE.cancel}
        confirmLabel={REMOVE.confirm}
        confirmIcon="trash-2"
        pendingLabel={REMOVE.pending}
        onConfirm={close}
        onCancel={close}
      />
      <ConfirmDialog
        open={openKind === 'purge'}
        title={PURGE.title(number)}
        message={PURGE.message('Brgy. San Roque Ballers', 'Juan Dela Cruz')}
        counts={{ items: 5, payments: 2, discounts: 1, expenses: 3, refunds: 1, images: 0 }}
        confirmText={number}
        confirmLabel={PURGE.confirm}
        pendingLabel={PURGE.pending}
        onConfirm={close}
        onCancel={close}
      />
    </>
  );
}

/** Every Phase 8 demo, one case under another. */
export function Phase8Demos() {
  return (
    <div className={staffStackClasses}>
      <DemoCase id="orders-totals-states">
        <TotalsDemo />
      </DemoCase>
      <DemoCase id="orders-card-states">
        <CardsDemo />
      </DemoCase>
      <DemoCase id="orders-due-flags">
        <DueFlagsDemo />
      </DemoCase>
      <DemoCase id="orders-status-badges">
        <BadgesDemo />
      </DemoCase>
      <DemoCase id="orders-status-menu">
        <StatusMenuDemo />
      </DemoCase>
      <DemoCase id="orders-banners">
        <BannersDemo />
      </DemoCase>
      <DemoCase id="orders-delete-dialogs" live>
        <DeleteDialogsDemo />
      </DemoCase>
    </div>
  );
}
