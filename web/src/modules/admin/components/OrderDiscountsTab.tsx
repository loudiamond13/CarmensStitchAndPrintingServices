// The Discounts tab of the order page (ORD-07; UI-SPEC O1 Tab card; D-15, D-54a; plans 08-12, 08-17): a heading and caption over a
// ResponsiveTable of the discounts (reason, type badge, value, negative amount) with a Total discount footer from the server's figure.
// A row's amount is csps.ts `discountAmount` over the server's subtotal, the same preview the windows use, so the rows add up to the
// footer. On an active order the head has Add Discount; a locked order, and the deleted view (`readOnly`), show the table alone (D-15, D-24).
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/actions';
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { Badge } from '@/components/status';
import { OrderDiscountModal } from '@/modules/admin/components/OrderDiscountModal';
import { OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import { orderCellStrongClasses, orderTabBodyClasses } from '@/modules/admin/components/orderPage.recipe';
import { ORDER_DISCOUNT_COPY } from '@/modules/admin/orderDiscountCopy';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { canEditOrder } from '@/modules/admin/orderRules';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { discountAmount, formatPeso, negateMoney } from '@/utils/csps';

type OrderDiscount = OrderDetailResponse['discounts'][number];

const COPY = ORDER_PAGE_COPY.discounts;
const DISCOUNT = ORDER_DISCOUNT_COPY;

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

/** The columns every view shows; an editable view adds the actions column after them. */
function dataColumns(subtotal: number): readonly ResponsiveTableColumn<OrderDiscount>[] {
  return [
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
}

interface DiscountsViewProps {
  order: OrderDetailResponse;
  columns: readonly ResponsiveTableColumn<OrderDiscount>[];
  /** The Add Discount button. */
  action?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** What follows the table: the windows. */
  children?: ReactNode;
}

/** The head and the table. Windows render after it, never inside the table frame (a fixed layer cannot live there). */
function DiscountsView({ order, columns, action, headingRef, children }: DiscountsViewProps) {
  return (
    <>
      <OrderTabHead title={COPY.title} caption={COPY.caption} action={action} headingRef={headingRef} />
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
        {children}
      </div>
    </>
  );
}

/** An active order: Add Discount in the head. */
function EditableDiscounts({ order }: { order: OrderDetailResponse }) {
  // The window mounts on its first open and stays so its close can animate; each new open starts clean (OrderDiscountModal).
  const [addUsed, setAddUsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
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
    <DiscountsView
      order={order}
      columns={dataColumns(Number(order.totals.subtotal))}
      action={
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
          {DISCOUNT.add}
        </Button>
      }
    >
      {addUsed && (
        <OrderDiscountModal
          mode="add"
          order={order}
          open={addOpen}
          onClose={() => {
            returnFocus.current = () => {
              addRef.current?.focus();
            };
            setAddOpen(false);
          }}
        />
      )}
    </DiscountsView>
  );
}

export function OrderDiscountsTab({ order, readOnly }: OrderDiscountsTabProps) {
  if (readOnly === true || !canEditOrder(order)) {
    return <DiscountsView order={order} columns={dataColumns(Number(order.totals.subtotal))} />;
  }
  return <EditableDiscounts order={order} />;
}
