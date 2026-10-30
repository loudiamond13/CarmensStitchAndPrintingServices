// The Refunds tab of the order page (ORD-07, ORD-18; UI-SPEC O1 Tab card; D-10, D-12, D-13; plans 08-12, 08-21): money handed back to
// the customer, with who refunded and who recorded each refund, and a Total refunded footer from the server's figure. The page draws
// this tab only when `showRefundsTab` says so. The head has Add Refund while the cap is above 0.00 (a Cancelled order, or a customer
// credit), and the caption then names the cap. `readOnly` (the deleted view, D-24) shows the table alone.
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/actions';
import { ResponsiveTable, type ResponsiveTableColumn } from '@/components/lists';
import { OrderRefundModal } from '@/modules/admin/components/OrderRefundModal';
import { OrderDateCell, OrderPersonCell, OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import { orderCaptionFigureClasses, orderTabBodyClasses } from '@/modules/admin/components/orderPage.recipe';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { ORDER_REFUND_COPY } from '@/modules/admin/orderRefundCopy';
import { canAddRefund, refundCap } from '@/modules/admin/orderRules';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso } from '@/utils/csps';

type OrderRefund = OrderDetailResponse['refunds'][number];

const COPY = ORDER_PAGE_COPY.refunds;
const REFUND = ORDER_REFUND_COPY;

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

interface RefundsViewProps {
  order: OrderDetailResponse;
  columns: readonly ResponsiveTableColumn<OrderRefund>[];
  /** True when Add Refund shows, so the caption names the cap. */
  showCap: boolean;
  /** The Add Refund button. */
  action?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement> | undefined;
  /** What follows the table: the windows. */
  children?: ReactNode;
}

/** The head and the table. Windows render after it, never inside the table frame (a fixed layer cannot live there). */
function RefundsView({ order, columns, showCap, action, headingRef, children }: RefundsViewProps) {
  return (
    <>
      <OrderTabHead
        title={COPY.title}
        caption={
          showCap ? (
            <>
              {COPY.caption} {REFUND.canRefundLead}{' '}
              <strong className={orderCaptionFigureClasses}>{formatPeso(refundCap(order))}</strong>
              {REFUND.canRefundTail}
            </>
          ) : (
            COPY.caption
          )
        }
        action={action}
        headingRef={headingRef}
      />
      <div className={orderTabBodyClasses}>
        {order.refunds.length === 0 ? (
          <OrderTabEmpty>{COPY.empty}</OrderTabEmpty>
        ) : (
          <ResponsiveTable
            caption={COPY.title}
            columns={columns}
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
        {children}
      </div>
    </>
  );
}

/** An order that can still be refunded: Add Refund while the cap is above 0.00. */
function EditableRefunds({ order }: { order: OrderDetailResponse }) {
  // The window mounts on its first open and stays so its close can animate; each new open starts clean (OrderRefundModal).
  const [addUsed, setAddUsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const addRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The saved answer left nothing to refund, so the Add button is going away and the heading takes the cursor instead.
  const settledByAdd = useRef(false);
  const returnFocus = useRef<(() => void) | null>(null);
  const addShown = canAddRefund(order);

  // Once the window has closed, focus goes back to Add Refund by name: Safari does not focus a button on a click.
  useEffect(() => {
    const go = returnFocus.current;
    if (go !== null && !addOpen) {
      returnFocus.current = null;
      go();
    }
  });

  return (
    <RefundsView
      order={order}
      columns={COLUMNS}
      showCap={addShown}
      headingRef={headingRef}
      action={
        addShown ? (
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
            {REFUND.add}
          </Button>
        ) : undefined
      }
    >
      {addUsed && (
        <OrderRefundModal
          mode="add"
          order={order}
          open={addOpen}
          onSaved={(saved) => {
            settledByAdd.current = !canAddRefund(saved);
          }}
          onClose={() => {
            returnFocus.current = () => {
              const settled = settledByAdd.current;
              settledByAdd.current = false;
              if (settled || addRef.current === null) {
                headingRef.current?.focus();
              } else {
                addRef.current.focus();
              }
            };
            setAddOpen(false);
          }}
        />
      )}
    </RefundsView>
  );
}

export function OrderRefundsTab({ order, readOnly }: OrderRefundsTabProps) {
  if (readOnly === true || order.status === 'completed') {
    return <RefundsView order={order} columns={COLUMNS} showCap={false} />;
  }
  return <EditableRefunds order={order} />;
}
