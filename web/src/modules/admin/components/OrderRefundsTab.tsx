// The Refunds tab of the order page (ORD-07; UI-SPEC O1 Tab card; D-10, D-12, D-13; plan 08-12): money handed back to the
// customer, with who refunded and who recorded each refund, and a Total refunded footer from the server's figure. The page draws
// this tab only when `showRefundsTab` says so. The Add, Edit and Delete windows join in plan 08-18 and render nothing while
// `readOnly` (the deleted view, D-24).
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { OrderDateCell, OrderPersonCell, OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import { orderTabBodyClasses } from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso } from '@/utils/csps';

type OrderRefund = OrderDetailResponse['refunds'][number];

const COPY = ORDER_PAGE_COPY.refunds;

const COLUMNS: readonly ResponsiveTableColumn<OrderRefund>[] = [
  { key: 'date', header: COPY.columns.date, lead: true, cell: (refund) => <OrderDateCell date={refund.refundDate} /> },
  { key: 'reason', header: COPY.columns.reason, cell: (refund) => refund.reason },
  {
    key: 'refundedBy',
    header: COPY.columns.refundedBy,
    cell: (refund) => <OrderPersonCell person={refund.refundedBy} />,
  },
  {
    key: 'recordedBy',
    header: COPY.columns.recordedBy,
    cell: (refund) => <OrderPersonCell person={refund.recordedBy} />,
  },
  { key: 'amount', header: COPY.columns.amount, money: true, cell: (refund) => formatPeso(refund.amount) },
];

export interface OrderRefundsTabProps {
  order: OrderDetailResponse;
  /** The deleted view: no Add, Edit or Delete control (D-24). */
  readOnly?: boolean | undefined;
}

export function OrderRefundsTab({ order }: OrderRefundsTabProps) {
  return (
    <>
      <OrderTabHead title={COPY.title} caption={COPY.caption} />
      <div className={orderTabBodyClasses}>
        {order.refunds.length === 0 ? (
          <OrderTabEmpty>{COPY.empty}</OrderTabEmpty>
        ) : (
          <ResponsiveTable
            caption={COPY.title}
            columns={COLUMNS}
            rows={order.refunds}
            rowKey={(refund) => refund.id}
            things={COPY.things}
            footer={{ date: COPY.footerLabel, amount: formatPeso(order.totals.refunded) }}
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
