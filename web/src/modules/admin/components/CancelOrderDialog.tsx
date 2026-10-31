// The Cancel Order confirm (ORD-07, D-18, D-54c, D-57; UI-SPEC O1 and "Destructive actions"; plan 08-19). It explains the money before
// the order locks: payments stay as collected cash, and a refund is something staff record themselves on the Refunds tab. Cancelling
// records no refund and prefills none. "Keep Order" is focused first, so Enter never cancels by accident; the order can be reopened.
// The move acts on the latest state: an Idempotency-Key and no version (05 D-21).
import { useToast } from '@/components/feedback';
import { ConfirmDialog } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
import { useApplyOrder, useRefetchOrder } from '@/modules/admin/hooks/useApplyOrder';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { ordersService, type OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { formatPeso, isPositiveMoney } from '@/utils/csps';
import type { ErrorCopy } from '@/utils/describeHttpError';

const COPY = ORDER_PAGE_COPY.status;

export interface CancelOrderDialogProps {
  order: OrderDetailResponse;
  open: boolean;
  /** Keep Order, Esc or the scrim, and a finished cancel. */
  onClose: () => void;
  /** The order was cancelled and the page already has the answer. */
  onCancelled?: ((answer: OrderDetailResponse) => void) | undefined;
}

/** What the confirm says about the money, from the server's paid figure, then that the order can be reopened. */
function cancelMessage(order: OrderDetailResponse): string {
  const money = isPositiveMoney(order.totals.paid)
    ? COPY.cancel.paid(formatPeso(order.totals.paid))
    : COPY.cancel.unpaid;
  return `${money} ${COPY.cancel.reopenLater}`;
}

/** The dialog's own failure line: the server's sentence for a refusal, and "not found" for an order that is gone. */
function describeCancelFailure(error: unknown): ErrorCopy | string | undefined {
  if (!isHttpError(error) || error.kind !== 'http') {
    return undefined;
  }
  if (error.status === 422) {
    return error.problem?.detail;
  }
  return error.status === 404 ? COPY.notFound : undefined;
}

export function CancelOrderDialog({ order, open, onClose, onCancelled }: CancelOrderDialogProps) {
  const toast = useToast();
  const applyOrder = useApplyOrder();
  const refetchOrder = useRefetchOrder();

  const cancel = useOrderAction<{ readonly id: string }>(
    (key) => ordersService.changeStatus(order.id, 'cancelled', key),
    (answer) => {
      applyOrder(answer);
      toast.show({
        tone: 'success',
        title: COPY.cancelled.title,
        message: COPY.cancelled.message(answer.number),
      });
      onCancelled?.(answer);
      onClose();
    },
    (error) => {
      // The page is out of date as well as refused: read the order again.
      if (isHttpError(error) && (error.status === 404 || error.status === 422)) {
        void refetchOrder(order.id);
      }
    },
  );

  return (
    <ConfirmDialog
      open={open}
      title={COPY.cancel.title(order.number)}
      message={cancelMessage(order)}
      cancelLabel={COPY.cancel.keep}
      confirmLabel={COPY.cancel.confirm}
      confirmIcon="x"
      pendingLabel={COPY.cancel.pending}
      describeFailure={describeCancelFailure}
      onConfirm={() => cancel.submit({ id: order.id })}
      onCancel={onClose}
    />
  );
}
