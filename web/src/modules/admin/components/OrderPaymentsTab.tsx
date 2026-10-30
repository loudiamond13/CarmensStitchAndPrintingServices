// The Payments tab of the order page (ORD-07; UI-SPEC O1 Tab card; D-09, D-12; plan 08-12): a heading and a caption that names
// the server's balance due, customer credit or "Nothing is owed", over a ResponsiveTable of the payments with both people on each
// row and a Total paid footer. Every figure is the server's. Rows keep the server's order. On an active order the head has Add
// Payment while money is owed (D-48); a locked order, and the deleted view (`readOnly`), show the table alone (D-15, D-24).
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/actions';
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { OrderPaymentModal } from '@/modules/admin/components/OrderPaymentModal';
import { OrderDateCell, OrderPersonCell, OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import {
  orderCaptionFigureClasses,
  orderTabBodyClasses,
  orderTabularClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { ORDER_PAYMENT_COPY } from '@/modules/admin/orderPaymentCopy';
import { canAddPayment, canEditOrder } from '@/modules/admin/orderRules';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso, isPositiveMoney } from '@/utils/csps';

type OrderPayment = OrderDetailResponse['payments'][number];

const COPY = ORDER_PAGE_COPY.payments;
const PAYMENT = ORDER_PAYMENT_COPY;

const COLUMNS: readonly ResponsiveTableColumn<OrderPayment>[] = [
  {
    key: 'date',
    header: COPY.columns.date,
    lead: true,
    cell: (payment) => <OrderDateCell date={payment.paymentDate} />,
  },
  { key: 'method', header: COPY.columns.method, cell: (payment) => <CategoryBadge category={payment.method} /> },
  {
    key: 'reference',
    header: COPY.columns.reference,
    cell: (payment) =>
      payment.reference === null || payment.reference === '' ? null : (
        <span className={orderTabularClasses}>{payment.reference}</span>
      ),
  },
  { key: 'notes', header: COPY.columns.notes, muted: true, cell: (payment) => payment.notes },
  {
    key: 'receivedBy',
    header: COPY.columns.receivedBy,
    cell: (payment) => <OrderPersonCell person={payment.receivedBy} />,
  },
  {
    key: 'recordedBy',
    header: COPY.columns.recordedBy,
    cell: (payment) => <OrderPersonCell person={payment.recordedBy} />,
  },
  { key: 'amount', header: COPY.columns.amount, money: true, cell: (payment) => formatPeso(payment.amount) },
];

export interface OrderPaymentsTabProps {
  order: OrderDetailResponse;
  /** The deleted view: no Add, Edit or Delete control (D-24). */
  readOnly?: boolean | undefined;
}

/** The caption's second part, from the server's figures: credit first, then balance due, else nothing owed. */
function balanceSentence(order: OrderDetailResponse) {
  const { balance, customerCredit } = order.totals;
  if (isPositiveMoney(customerCredit)) {
    return (
      <>
        {COPY.customerCredit} <strong className={orderCaptionFigureClasses}>{formatPeso(customerCredit)}</strong>
      </>
    );
  }
  if (isPositiveMoney(balance)) {
    return (
      <>
        {COPY.balanceDue} <strong className={orderCaptionFigureClasses}>{formatPeso(balance)}</strong>
      </>
    );
  }
  return COPY.settled;
}

interface PaymentsViewProps {
  order: OrderDetailResponse;
  columns: readonly ResponsiveTableColumn<OrderPayment>[];
  /** The Add Payment button. */
  action?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** What follows the table: the windows. */
  children?: ReactNode;
}

/** The head and the table. Windows render after it, never inside the table frame (a fixed layer cannot live there). */
function PaymentsView({ order, columns, action, headingRef, children }: PaymentsViewProps) {
  return (
    <>
      <OrderTabHead
        title={COPY.title}
        caption={
          <>
            {COPY.captionLead} {balanceSentence(order)}
          </>
        }
        action={action}
        headingRef={headingRef}
      />
      <div className={orderTabBodyClasses}>
        {order.payments.length === 0 ? (
          <OrderTabEmpty>{COPY.empty}</OrderTabEmpty>
        ) : (
          <ResponsiveTable
            caption={COPY.title}
            columns={columns}
            rows={order.payments}
            rowKey={(payment) => payment.id}
            things={COPY.things}
            footer={{ date: COPY.footerLabel, amount: formatPeso(order.totals.paid) }}
            footerLayout={{
              date: { span: columns.length - 1 },
              amount: { label: COPY.footerAmountLabel },
            }}
          />
        )}
        {children}
      </div>
    </>
  );
}

/** An active order: Add Payment while money is owed. */
function EditablePayments({ order }: { order: OrderDetailResponse }) {
  // A window mounts on its first open and stays so its close can animate; each new open starts clean (OrderPaymentModal).
  const [addUsed, setAddUsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Where focus goes once a window has closed. Safari does not focus a button on a click, so the window's own return to its
  // trigger has nothing to go back to; the trigger is named here instead.
  const returnFocus = useRef<(() => void) | null>(null);

  useEffect(() => {
    const go = returnFocus.current;
    if (go !== null && !addOpen) {
      returnFocus.current = null;
      go();
    }
  });

  return (
    <PaymentsView
      order={order}
      columns={COLUMNS}
      headingRef={headingRef}
      action={
        canAddPayment(order) ? (
          <Button
            variant="primary"
            size="sm"
            icon="plus"
            ref={addRef}
            onClick={() => {
              setAddUsed(true);
              setAddOpen(true);
            }}
          >
            {PAYMENT.add}
          </Button>
        ) : undefined
      }
    >
      {addUsed && (
        <OrderPaymentModal
          mode="add"
          order={order}
          open={addOpen}
          onClose={() => {
            // The answer may have settled the order, which takes the button away: the heading takes the cursor then.
            returnFocus.current = () => {
              if (addRef.current === null) {
                headingRef.current?.focus();
              } else {
                addRef.current.focus();
              }
            };
            setAddOpen(false);
          }}
        />
      )}
    </PaymentsView>
  );
}

export function OrderPaymentsTab({ order, readOnly }: OrderPaymentsTabProps) {
  if (readOnly === true || !canEditOrder(order)) {
    return <PaymentsView order={order} columns={COLUMNS} />;
  }
  return <EditablePayments order={order} />;
}
