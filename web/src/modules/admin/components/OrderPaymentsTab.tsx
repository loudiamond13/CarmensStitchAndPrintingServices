// The Payments tab of the order page (ORD-07; UI-SPEC O1 Tab card; D-09, D-12; plan 08-12): a heading and a caption that names
// the server's balance due, customer credit or "Nothing is owed", over a ResponsiveTable of the payments with both people on each
// row and a Total paid footer. Every figure is the server's. Rows keep the server's order. The Add, Edit and Delete windows join
// in plan 08-16 and render nothing while `readOnly` (the deleted view, D-24).
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { OrderDateCell, OrderPersonCell, OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import {
  orderCaptionFigureClasses,
  orderTabBodyClasses,
  orderTabularClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso, isPositiveMoney } from '@/utils/csps';

type OrderPayment = OrderDetailResponse['payments'][number];

const COPY = ORDER_PAGE_COPY.payments;

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

export function OrderPaymentsTab({ order }: OrderPaymentsTabProps) {
  return (
    <>
      <OrderTabHead
        title={COPY.title}
        caption={
          <>
            {COPY.captionLead} {balanceSentence(order)}
          </>
        }
      />
      <div className={orderTabBodyClasses}>
        {order.payments.length === 0 ? (
          <OrderTabEmpty>{COPY.empty}</OrderTabEmpty>
        ) : (
          <ResponsiveTable
            caption={COPY.title}
            columns={COLUMNS}
            rows={order.payments}
            rowKey={(payment) => payment.id}
            things={COPY.things}
            footer={{ date: COPY.footerLabel, amount: formatPeso(order.totals.paid) }}
            footerLayout={{
              date: { span: COLUMNS.length - 1 },
              amount: { label: COPY.footerAmountLabel },
            }}
          />
        )}
      </div>
    </>
  );
}
