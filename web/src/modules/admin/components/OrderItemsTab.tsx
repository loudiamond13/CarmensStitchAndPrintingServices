// The Items tab of the order page (ORD-07; UI-SPEC O1 Tab card; plan 08-10): a heading and caption over a ResponsiveTable of the
// order's items with a footer of the items subtotal. Every figure is the server's: the line totals as stored, the subtotal from the
// order's totals. Only the piece count is added up here, and it is a count, not money. Row actions join in plan 08-14.
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { formatPeso } from '@/utils/csps';
import { formatCount } from '@/utils/format';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import {
  orderTabBodyClasses,
  orderTabCaptionClasses,
  orderTabHeadClasses,
  orderTabTitleClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';

type OrderItem = OrderDetailResponse['items'][number];

const COPY = ORDER_PAGE_COPY.items;

const COLUMNS: readonly ResponsiveTableColumn<OrderItem>[] = [
  {
    key: 'product',
    header: COPY.columns.product,
    lead: true,
    cell: (item) => <CategoryBadge category={item.productType} />,
  },
  { key: 'description', header: COPY.columns.description, cell: (item) => item.description },
  { key: 'size', header: COPY.columns.size, muted: true, cell: (item) => item.sizeVariant },
  { key: 'quantity', header: COPY.columns.quantity, money: true, cell: (item) => formatCount(Number(item.quantity)) },
  { key: 'unitPrice', header: COPY.columns.unitPrice, money: true, cell: (item) => formatPeso(item.unitPrice) },
  { key: 'lineTotal', header: COPY.columns.lineTotal, money: true, cell: (item) => formatPeso(item.lineTotal) },
];

export interface OrderItemsTabProps {
  order: OrderDetailResponse;
  /** The deleted view: no Add, Edit or Delete control (D-24). The windows of plan 08-14 hide their controls on it. */
  readOnly?: boolean | undefined;
}

export function OrderItemsTab({ order }: OrderItemsTabProps) {
  const pieces = order.items.reduce((sum, item) => sum + Number(item.quantity), 0);
  return (
    <>
      <div className={orderTabHeadClasses}>
        <div>
          <h3 className={orderTabTitleClasses}>{COPY.title}</h3>
          <p className={orderTabCaptionClasses}>{COPY.caption}</p>
        </div>
      </div>
      <div className={orderTabBodyClasses}>
        <ResponsiveTable
          caption={COPY.title}
          columns={COLUMNS}
          rows={order.items}
          rowKey={(item) => item.id}
          things={COPY.things}
          footer={{ product: COPY.subtotal(pieces), lineTotal: formatPeso(order.totals.subtotal) }}
          footerLayout={{ product: { span: 5, label: COPY.footerLabel } }}
        />
      </div>
    </>
  );
}
