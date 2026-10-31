// The Reopen Order window (ORD-07, D-15, D-16, D-57; UI-SPEC O1 ReopenOrderModal; plan 08-19). A Completed or Cancelled order goes back to
// an active status that staff pick from a radio group of the five. It starts on the status the order was in before the end state
// (the `from` of the newest history row that ended in the current state), else Pending. The move acts on the latest state: an
// Idempotency-Key and no version (05 D-21). A refusal shows the server's sentence in the window, which stays open.
import clsx from 'clsx';
import { useMemo, useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/actions';
import { Icon } from '@/components/brand';
import { RadioGroup } from '@/components/entry';
import { useToast } from '@/components/feedback';
import { messageClasses } from '@/components/forms';
import { Modal } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
import { OrderStatusDot } from '@/modules/admin/components/OrderStatusDot';
import { orderReopenMessageClasses, orderStatusRadioLabelClasses } from '@/modules/admin/components/orderPage.recipe';
import { useApplyOrder, useRefetchOrder } from '@/modules/admin/hooks/useApplyOrder';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { orderStatusLabel } from '@/modules/admin/orderStatus';
import { ordersService, type OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { ACTIVE_STATUSES, type OrderStatus } from '@/utils/csps';
import { describeHttpError, errorLine } from '@/utils/describeHttpError';

const COPY = ORDER_PAGE_COPY.reopen;
const NOT_FOUND = ORDER_PAGE_COPY.status.notFound;

/** The active status among a history `from`, else null. */
function activeStatus(key: string | null): OrderStatus | null {
  return ACTIVE_STATUSES.find((status) => status === key) ?? null;
}

/**
 * The status the window starts on (D-16): the `from` of the newest history row that ended in the order's current status, when
 * that is an active one; otherwise Pending. The history is oldest first, as the server sends it.
 */
export function reopenDefault(order: Pick<OrderDetailResponse, 'status' | 'statusHistory'>): OrderStatus {
  const ending = order.statusHistory.findLast((change) => change.to === order.status);
  return activeStatus(ending?.from ?? null) ?? 'pending';
}

export interface ReopenOrderModalProps {
  order: OrderDetailResponse;
  open: boolean;
  /** The window is dismissed (Cancel, Esc, the scrim, the close button) or a reopen has finished. */
  onClose: () => void;
  /** The order was reopened and the page already has the answer; called before `onClose`. */
  onReopened?: ((answer: OrderDetailResponse) => void) | undefined;
}

export function ReopenOrderModal({ order, open, onClose, onReopened }: ReopenOrderModalProps) {
  const [chosen, setChosen] = useState<OrderStatus>(() => reopenDefault(order));
  const [wasOpen, setWasOpen] = useState(open);
  const [failure, setFailure] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const toast = useToast();
  const applyOrder = useApplyOrder();
  const refetchOrder = useRefetchOrder();

  // Each open starts on the default with no old refusal: adjusted while rendering, no effect needed.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setChosen(reopenDefault(order));
      setFailure(null);
    }
  }

  // The checked radio takes the focus on open, so the arrow keys start from the choice.
  const initialFocus = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current(): HTMLElement | null {
        return bodyRef.current?.querySelector<HTMLElement>('input[type="radio"]:checked') ?? null;
      },
    }),
    [],
  );

  const reopen = useOrderAction<{ readonly id: string; readonly status: OrderStatus }>(
    (key, target) => ordersService.changeStatus(order.id, target.status, key),
    (answer) => {
      applyOrder(answer);
      toast.show({
        tone: 'success',
        title: COPY.toast.title,
        message: COPY.toast.message(answer.number, orderStatusLabel(answer.status)),
      });
      onReopened?.(answer);
      onClose();
    },
    (error) => {
      if (isHttpError(error) && error.kind === 'http') {
        if (error.status === 422 || error.status === 404) {
          // The page is out of date as well as refused: read the order again.
          void refetchOrder(order.id);
        }
        if (error.status === 422 && error.problem?.detail !== undefined) {
          setFailure(error.problem.detail);
          return;
        }
        if (error.status === 404) {
          setFailure(NOT_FOUND);
          return;
        }
      }
      const copy = describeHttpError(error);
      if (copy !== null) {
        setFailure(errorLine(copy));
      }
    },
  );

  const submit = (): void => {
    setFailure(null);
    void reopen.submit({ id: `${order.id}:${chosen}`, status: chosen });
  };

  return (
    <Modal
      open={open}
      title={COPY.title(order.number)}
      description={COPY.description}
      onClose={onClose}
      loading={reopen.pending}
      initialFocus={initialFocus}
      footer={
        <>
          <Button variant="secondary" aria-disabled={reopen.pending} onClick={onClose}>
            {COPY.cancel}
          </Button>
          <Button variant="primary" icon="lock-open" pending={reopen.pending} onClick={submit}>
            {reopen.pending ? COPY.pending : COPY.confirm}
          </Button>
        </>
      }
    >
      <div ref={bodyRef}>
        <RadioGroup<OrderStatus>
          legend={COPY.legend}
          name="reopen-status"
          value={chosen}
          onChange={setChosen}
          options={ACTIVE_STATUSES.map((status) => ({
            value: status,
            label: (
              <span className={orderStatusRadioLabelClasses}>
                <OrderStatusDot status={status} />
                {orderStatusLabel(status)}
              </span>
            ),
          }))}
        />
        {failure !== null && (
          <p className={clsx(messageClasses({ error: true }), orderReopenMessageClasses)} role="alert">
            <Icon name="triangle-alert" size={14} />
            {failure}
          </p>
        )}
      </div>
    </Modal>
  );
}
