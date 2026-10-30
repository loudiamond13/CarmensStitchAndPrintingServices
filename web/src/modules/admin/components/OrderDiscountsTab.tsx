// The Discounts tab of the order page (ORD-07; UI-SPEC O1 Tab card; plan 08-12): a heading and caption over a ResponsiveTable of
// the discounts (reason, type badge, value, negative amount) with a Total discount footer from the server's figure. A row's amount
// is csps.ts `discountAmount` over the server's subtotal, the same preview the windows use, so the rows add up to the footer.
// The Add, Edit and Delete windows join in plan 08-15 and render nothing while `readOnly` (the deleted view, D-24).
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { Badge } from '@/components/status';
import { OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import { orderCellStrongClasses, orderTabBodyClasses } from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { discountAmount, formatPeso, negateMoney } from '@/utils/csps';

type OrderDiscount = OrderDetailResponse['discounts'][number];

const COPY = ORDER_PAGE_COPY.discounts;

const isPercentage = (discount: OrderDiscount): boolean => discount.kind === 'percentage';

/** "5%" or the peso value; a percentage reads the number as sent ("7.5%"). */
function valueText(discount: OrderDiscount): string {
  return isPercentage(discount) ? `${String(Number(discount.value))}%` : formatPeso(discount.value);
}

export interface OrderDiscountsTabProps {
  order: OrderDetailResponse;
  /** The deleted view: no Add, Edit or Delete control (D-24). */
  readOnly?: boolean | undefined;
}

export function OrderDiscountsTab({ order }: OrderDiscountsTabProps) {
  const subtotal = Number(order.totals.subtotal);
  const columns: readonly ResponsiveTableColumn<OrderDiscount>[] = [
    {
      key: 'reason',
      header: COPY.columns.reason,
      lead: true,
      cell: (discount) => <strong className={orderCellStrongClasses}>{discount.reason}</strong>,
    },
    {
      key: 'type',
      header: COPY.columns.type,
      cell: (discount) => <Badge tone="neutral">{isPercentage(discount) ? COPY.percentage : COPY.fixed}</Badge>,
    },
    { key: 'value', header: COPY.columns.value, money: true, cell: valueText },
    {
      key: 'amount',
      header: COPY.columns.amount,
      money: true,
      cell: (discount) =>
        formatPeso(
          negateMoney(
            discountAmount(
              { type: isPercentage(discount) ? 'percentage' : 'fixed', value: Number(discount.value) },
              subtotal,
            ),
          ),
        ),
    },
  ];
  return (
    <>
      <OrderTabHead title={COPY.title} caption={COPY.caption} />
      <div className={orderTabBodyClasses}>
        {order.discounts.length === 0 ? (
          <OrderTabEmpty>{COPY.empty}</OrderTabEmpty>
        ) : (
          <ResponsiveTable
            caption={COPY.title}
            columns={columns}
            rows={order.discounts}
            rowKey={(discount) => discount.id}
            things={COPY.things}
            footer={{ reason: COPY.footerLabel, amount: formatPeso(negateMoney(order.totals.discount)) }}
            footerLayout={{
              reason: { span: columns.length - 1 },
              amount: { label: COPY.footerAmountLabel },
            }}
          />
        )}
      </div>
    </>
  );
}
