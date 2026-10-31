// The Refunds tab of the order page (ORD-07, ORD-18; UI-SPEC O1 Tab card; D-10, D-12, D-13, D-54a; plans 08-12, 08-21): money handed back
// to the customer, with who refunded and who recorded each refund, and a Total refunded footer from the server's figure. The page draws
// this tab only when `showRefundsTab` says so. The head has Add Refund while the cap is above 0.00 (a Cancelled order, or a customer
// credit), and the caption then names the cap. Each row has Edit and Delete on a Cancelled or open order, even when the cap is 0.00. A
// Completed order, and the deleted view (`readOnly`, D-24), show the table alone.
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { ConfirmDialog } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
import { OrderRefundModal } from '@/modules/admin/components/OrderRefundModal';
import { OrderDateCell, OrderPersonCell, OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import { orderCaptionFigureClasses, orderTabBodyClasses } from '@/modules/admin/components/orderPage.recipe';
import { useApplyOrder, useRefetchOrder } from '@/modules/admin/hooks/useApplyOrder';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { orderSavedMessage } from '@/modules/admin/hooks/useOrderChildSave';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { ORDER_REFUND_COPY } from '@/modules/admin/orderRefundCopy';
import { canAddRefund, canChangeRefund, refundCap } from '@/modules/admin/orderRules';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { orderRefundsService } from '@/modules/admin/services/orderRefundsService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso } from '@/utils/csps';
import type { ErrorCopy } from '@/utils/describeHttpError';
import { formatCalendarDate } from '@/utils/format';

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

/** The focus registry key of a row's Delete button (the Edit button is registered under the plain id). */
const deleteKey = (id: string): string => `delete:${id}`;

/** The row's date as the row action names print it ("Oct 5, 2026"). */
const dateOf = (refund: OrderRefund): string => formatCalendarDate(refund.refundDate) ?? refund.refundDate;

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

/** The dialog's own failure line: the server's sentence for a refusal, and "removed" for a refund that is already gone. */
function describeDeleteFailure(error: unknown): ErrorCopy | string | undefined {
  if (!isHttpError(error) || error.kind !== 'http') {
    return undefined;
  }
  if (error.status === 422) {
    return error.problem?.detail;
  }
  return error.status === 404 ? REFUND.deleteGone : undefined;
}

/** A Cancelled or open order: Add Refund while the cap is above 0.00, and each row's Edit and Delete. */
function EditableRefunds({ order }: { order: OrderDetailResponse }) {
  // A window mounts on its first open and stays so its close can animate; each new open starts clean (OrderRefundModal).
  const [addUsed, setAddUsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<{ refundId: string; open: boolean } | null>(null);
  // The refund the Delete dialog is open for, or was last open for (kept while it animates out).
  const [deleting, setDeleting] = useState<{ refund: OrderRefund; open: boolean } | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rowFocus = useRowFocus();
  const toast = useToast();
  const applyOrder = useApplyOrder();
  const refetchOrder = useRefetchOrder();
  // Where focus goes once a window has closed. Safari does not focus a button on a click, so the window's own return to its
  // trigger has nothing to go back to; the trigger is named here instead.
  const returnFocus = useRef<(() => void) | null>(null);
  // The saved answer left nothing to refund, so the Add button is going away and the heading takes the cursor instead.
  const settledByAdd = useRef(false);
  // Once the answer no longer holds the deleted row, focus goes to the next row's Edit, else the previous one, else the heading.
  const afterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);
  const addShown = canAddRefund(order);

  useEffect(() => {
    const go = returnFocus.current;
    if (go !== null && !addOpen && editing?.open !== true && deleting?.open !== true) {
      returnFocus.current = null;
      go();
    }
    const wanted = afterRemoval.current;
    if (wanted !== null && !order.refunds.some((refund) => refund.id === wanted.removedId)) {
      afterRemoval.current = null;
      if (wanted.focusId === null || !rowFocus.focusRow(wanted.focusId)) {
        headingRef.current?.focus();
      }
    }
  });

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  const removal = useOrderAction<OrderRefund>(
    (_key, refund) => orderRefundsService.remove(order.id, refund.id),
    (answer, refund) => {
      const index = order.refunds.findIndex((candidate) => candidate.id === refund.id);
      afterRemoval.current = {
        removedId: refund.id,
        focusId: order.refunds[index + 1]?.id ?? order.refunds[index - 1]?.id ?? null,
      };
      closeDelete();
      toast.show({ tone: 'success', ...orderSavedMessage(answer, 'refund', 'deleted') });
      applyOrder(answer);
    },
    (error) => {
      // The page is out of date as well as refused (the refund is gone, or the order is locked now): read the order again.
      if (isHttpError(error) && (error.status === 404 || error.status === 422)) {
        void refetchOrder(order.id);
      }
    },
  );

  const columns: readonly ResponsiveTableColumn<OrderRefund>[] = [
    ...COLUMNS,
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (refund) => {
        const editName = REFUND.editAction(refund.amount, dateOf(refund));
        const deleteName = REFUND.deleteAction(refund.amount, dateOf(refund));
        return (
          <RowActions>
            <RowAction
              icon="pencil"
              label={editName}
              title={editName}
              ref={(button) => {
                rowFocus.register(refund.id, button);
              }}
              onClick={() => {
                setEditing({ refundId: refund.id, open: true });
              }}
            />
            <RowAction
              icon="trash-2"
              label={deleteName}
              title={deleteName}
              danger
              ref={(button) => {
                rowFocus.register(deleteKey(refund.id), button);
              }}
              onClick={() => {
                setDeleting({ refund, open: true });
              }}
            />
          </RowActions>
        );
      },
    },
  ];

  return (
    <RefundsView
      order={order}
      columns={columns}
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
      {editing !== null && (
        <OrderRefundModal
          mode="edit"
          order={order}
          refundId={editing.refundId}
          open={editing.open}
          onClose={() => {
            const refundId = editing.refundId;
            returnFocus.current = () => {
              if (!rowFocus.focusRow(refundId)) {
                headingRef.current?.focus();
              }
            };
            setEditing({ refundId, open: false });
          }}
        />
      )}
      {deleting !== null && (
        <ConfirmDialog
          open={deleting.open}
          title={REFUND.deleteTitle(deleting.refund.amount)}
          message={ORDER_WINDOWS_COPY.remove.message(order.number)}
          confirmLabel={REFUND.deleteConfirm}
          pendingLabel={ORDER_WINDOWS_COPY.remove.pending}
          cancelLabel={ORDER_WINDOWS_COPY.remove.cancel}
          describeFailure={describeDeleteFailure}
          onConfirm={() => removal.submit(deleting.refund)}
          onCancel={() => {
            const refundId = deleting.refund.id;
            returnFocus.current = () => {
              if (!rowFocus.focusRow(deleteKey(refundId))) {
                headingRef.current?.focus();
              }
            };
            closeDelete();
          }}
        />
      )}
    </RefundsView>
  );
}

export function OrderRefundsTab({ order, readOnly }: OrderRefundsTabProps) {
  if (readOnly === true || !canChangeRefund(order)) {
    return <RefundsView order={order} columns={COLUMNS} showCap={false} />;
  }
  return <EditableRefunds order={order} />;
}
