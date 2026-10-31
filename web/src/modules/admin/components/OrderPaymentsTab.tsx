// The Payments tab of the order page (ORD-07; UI-SPEC O1 Tab card; D-09, D-12, D-48, D-54a; plans 08-12, 08-16): a heading and a caption
// that names the server's balance due, customer credit or "Nothing is owed", over a ResponsiveTable of the payments with both people
// on each row and a Total paid footer. Every figure is the server's. Rows keep the server's order. On an active order the head has
// Add Payment while money is owed (D-48) and each row has Edit and Delete; a locked order, and the deleted view (`readOnly`), show the
// table alone (D-15, D-24).
import { useEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { Button } from '@/components/actions';
import { useToast } from '@/components/feedback';
import { ResponsiveTable, RowAction, RowActions, type ResponsiveTableColumn } from '@/components/lists';
import { ConfirmDialog } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
import { CategoryBadge } from '@/modules/admin/components/CategoryBadge';
import { OrderPaymentModal } from '@/modules/admin/components/OrderPaymentModal';
import { OrderDateCell, OrderPersonCell, OrderTabEmpty, OrderTabHead } from '@/modules/admin/components/OrderTabParts';
import {
  orderCaptionFigureClasses,
  orderTabBodyClasses,
  orderTabularClasses,
} from '@/modules/admin/components/orderPage.recipe';
import { useApplyOrder, useRefetchOrder } from '@/modules/admin/hooks/useApplyOrder';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { orderSavedMessage } from '@/modules/admin/hooks/useOrderChildSave';
import { useReadOrderNow } from '@/modules/admin/hooks/useOrderWindowFigures';
import { useRowFocus } from '@/modules/admin/hooks/useRowFocus';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { ORDER_PAYMENT_COPY } from '@/modules/admin/orderPaymentCopy';
import { wouldLeavePaymentsBelowRefunds } from '@/modules/admin/orderPaymentSchemas';
import { canAddPayment, canEditOrder } from '@/modules/admin/orderRules';
import { ORDER_WINDOWS_COPY } from '@/modules/admin/orderWindowsCopy';
import { orderPaymentsService } from '@/modules/admin/services/orderPaymentsService';
import type { OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso, isPositiveMoney } from '@/utils/csps';
import type { ErrorCopy } from '@/utils/describeHttpError';
import { formatCalendarDate } from '@/utils/format';

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

/** The focus registry key of a row's Delete button (the Edit button is registered under the plain id). */
const deleteKey = (id: string): string => `delete:${id}`;

/** The row's date as the row action names print it ("Oct 3, 2026"). */
const dateOf = (payment: OrderPayment): string => formatCalendarDate(payment.paymentDate) ?? payment.paymentDate;

/** Raised before any request when taking the payment away would leave the payments below the refunds. */
class PaymentBelowRefundsError extends Error {}

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

/** The dialog's own failure line: the server's sentence for a refusal, and "removed" for a payment that is already gone. */
function describeDeleteFailure(error: unknown): ErrorCopy | string | undefined {
  if (error instanceof PaymentBelowRefundsError) {
    return PAYMENT.errors.belowRefunds;
  }
  if (!isHttpError(error) || error.kind !== 'http') {
    return undefined;
  }
  if (error.status === 422) {
    return error.problem?.detail;
  }
  return error.status === 404 ? PAYMENT.deleteGone : undefined;
}

/** An active order: Add Payment while money is owed, and each row's Edit and Delete. */
function EditablePayments({ order }: { order: OrderDetailResponse }) {
  // A window mounts on its first open and stays so its close can animate; each new open starts clean (OrderPaymentModal).
  const [addUsed, setAddUsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<{ paymentId: string; open: boolean } | null>(null);
  // The payment the Delete dialog is open for, or was last open for (kept while it animates out).
  const [deleting, setDeleting] = useState<{ payment: OrderPayment; open: boolean } | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const rowFocus = useRowFocus();
  const toast = useToast();
  const applyOrder = useApplyOrder();
  const refetchOrder = useRefetchOrder();
  const readOrderNow = useReadOrderNow();
  // Where focus goes once a window has closed. Safari does not focus a button on a click, so the window's own return to its
  // trigger has nothing to go back to; the trigger is named here instead.
  const returnFocus = useRef<(() => void) | null>(null);
  // The saved answer left nothing owed, so the Add button is going away and the heading takes the cursor instead.
  const settledByAdd = useRef(false);
  // Once the answer no longer holds the deleted row, focus goes to the next row's Edit, else the previous one, else the heading.
  const afterRemoval = useRef<{ removedId: string; focusId: string | null } | null>(null);

  useEffect(() => {
    const go = returnFocus.current;
    if (go !== null && !addOpen && editing?.open !== true && deleting?.open !== true) {
      returnFocus.current = null;
      go();
    }
    const wanted = afterRemoval.current;
    if (wanted !== null && !order.payments.some((payment) => payment.id === wanted.removedId)) {
      afterRemoval.current = null;
      if (wanted.focusId === null || !rowFocus.focusRow(wanted.focusId)) {
        headingRef.current?.focus();
      }
    }
  });

  const closeDelete = (): void => {
    setDeleting((current) => (current === null ? null : { ...current, open: false }));
  };

  const removal = useOrderAction<OrderPayment>(
    (_key, payment) => orderPaymentsService.remove(order.id, payment.id),
    (answer, payment) => {
      const index = order.payments.findIndex((candidate) => candidate.id === payment.id);
      afterRemoval.current = {
        removedId: payment.id,
        focusId: order.payments[index + 1]?.id ?? order.payments[index - 1]?.id ?? null,
      };
      closeDelete();
      toast.show({ tone: 'success', ...orderSavedMessage(answer, 'payment', 'deleted') });
      applyOrder(answer);
    },
    (error) => {
      // The page is out of date as well as refused (the payment is gone, or the refunds now need it): read the order again.
      if (isHttpError(error) && (error.status === 404 || error.status === 422)) {
        void refetchOrder(order.id);
      }
    },
  );

  // A preview from the server's paid and refunded figures: when the held ones refuse, the order is read once more first (D-95). The server still checks.
  const confirmDelete = async (payment: OrderPayment): Promise<unknown> => {
    if (wouldLeavePaymentsBelowRefunds(order, payment)) {
      const fresh = await readOrderNow(order.id);
      const current = fresh?.payments.find((candidate) => candidate.id === payment.id);
      if (fresh === null || (current !== undefined && wouldLeavePaymentsBelowRefunds(fresh, current))) {
        throw new PaymentBelowRefundsError(PAYMENT.errors.belowRefunds);
      }
    }
    return removal.submit(payment);
  };

  const columns: readonly ResponsiveTableColumn<OrderPayment>[] = [
    ...COLUMNS,
    {
      key: 'actions',
      header: COPY.columns.actions,
      actions: true,
      cell: (payment) => {
        const editName = PAYMENT.editAction(payment.amount, dateOf(payment));
        const deleteName = PAYMENT.deleteAction(payment.amount, dateOf(payment));
        return (
          <RowActions>
            <RowAction
              icon="pencil"
              label={editName}
              title={editName}
              ref={(button) => {
                rowFocus.register(payment.id, button);
              }}
              onClick={() => {
                setEditing({ paymentId: payment.id, open: true });
              }}
            />
            <RowAction
              icon="trash-2"
              label={deleteName}
              title={deleteName}
              danger
              ref={(button) => {
                rowFocus.register(deleteKey(payment.id), button);
              }}
              onClick={() => {
                setDeleting({ payment, open: true });
              }}
            />
          </RowActions>
        );
      },
    },
  ];

  return (
    <PaymentsView
      order={order}
      columns={columns}
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
          onSaved={(saved) => {
            settledByAdd.current = !canAddPayment(saved);
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
        <OrderPaymentModal
          mode="edit"
          order={order}
          paymentId={editing.paymentId}
          open={editing.open}
          onClose={() => {
            const paymentId = editing.paymentId;
            returnFocus.current = () => {
              if (!rowFocus.focusRow(paymentId)) {
                headingRef.current?.focus();
              }
            };
            setEditing({ paymentId, open: false });
          }}
        />
      )}
      {deleting !== null && (
        <ConfirmDialog
          open={deleting.open}
          title={PAYMENT.deleteTitle(deleting.payment.amount)}
          message={ORDER_WINDOWS_COPY.remove.message(order.number)}
          confirmLabel={PAYMENT.deleteConfirm}
          pendingLabel={ORDER_WINDOWS_COPY.remove.pending}
          cancelLabel={ORDER_WINDOWS_COPY.remove.cancel}
          describeFailure={describeDeleteFailure}
          onConfirm={() => confirmDelete(deleting.payment)}
          onCancel={() => {
            const paymentId = deleting.payment.id;
            returnFocus.current = () => {
              if (!rowFocus.focusRow(deleteKey(paymentId))) {
                headingRef.current?.focus();
              }
            };
            closeDelete();
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
