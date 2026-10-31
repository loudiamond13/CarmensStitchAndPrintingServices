// PurgeOrderDialog (ORD-06, 07 D-28, D-24, D-57; plan 08-20): the warning before a Manager removes an order and everything inside it
// for good. It first reads the deleted order (GET /orders/deleted/{id}) for its counts, shows the cascade sentence and the six tiles,
// and keeps the confirm disabled until the exact order number is typed (the dialog trims it). Shared by the Deleted Orders list and
// the read-only deleted order view.
//   - While the counts load the box shows a skeleton and the confirm stays disabled. If they cannot be read the dialog says so and
//     the confirm stays off. A 404 on that read, or on the delete, means someone else got there first: the dialog closes, the lists
//     read again and the info toast says so.
//   - The DELETE sends `confirm=` with the order number and no Idempotency-Key. The server checks it again: a 400 shows its line here.
//   - On success the screen hears about it first (`onDone`, to choose where focus goes or to leave the page), then the dialog closes,
//     the toast shows and the order lists and the deleted list read again.
import { useEffect, useRef } from 'react';
import { useToast } from '@/components/feedback';
import { ConfirmDialog } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
import { DELETED_ORDERS_COPY } from '@/modules/admin/deletedOrdersCopy';
import { useDeletedOrderCountsQuery } from '@/modules/admin/hooks/useDeletedOrderQuery';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { useRefreshOrders } from '@/modules/admin/hooks/useRefreshOrders';
import { deletedOrdersService } from '@/modules/admin/services/deletedOrdersService';
import type { CascadeCounts } from '@/utils/csps';

const COPY = DELETED_ORDERS_COPY;

export interface PurgeOrderDialogProps {
  orderId: string;
  number: string;
  team: string | null;
  customer: string;
  open: boolean;
  onClose: () => void;
  /** The order is gone (deleted by this press, or already gone): the screen decides where focus goes or leaves the page. */
  onDone: (outcome: 'purged' | 'gone') => void;
}

/** The tiles: the count of each kind of row the deleted order holds. Images join in Phase 9, so they are 0 for now. */
function countsOf(order: {
  items: readonly unknown[];
  payments: readonly unknown[];
  discounts: readonly unknown[];
  expenses: readonly unknown[];
  refunds: readonly unknown[];
}): CascadeCounts {
  return {
    items: order.items.length,
    payments: order.payments.length,
    discounts: order.discounts.length,
    expenses: order.expenses.length,
    refunds: order.refunds.length,
    images: 0,
  };
}

/** A 400 on `confirm` has fixed words; anything else is left to the shared mapper. */
function describeFailure(error: unknown): string | undefined {
  return isHttpError(error) && error.status === 400 ? COPY.purge.wrongNumber : undefined;
}

export function PurgeOrderDialog({ orderId, number, team, customer, open, onClose, onDone }: PurgeOrderDialogProps) {
  const toast = useToast();
  const refreshAll = useRefreshOrders();
  const counts = useDeletedOrderCountsQuery(orderId, open);
  const goneHandled = useRef(false);

  const showGone = () => {
    onDone('gone');
    onClose();
    toast.show({ tone: 'info', title: COPY.alreadyGone.title, message: COPY.alreadyGone.message });
    void refreshAll();
  };

  // The counts read answered 404: the order was restored or removed meanwhile.
  const readGone = isHttpError(counts.error) && counts.error.status === 404;
  useEffect(() => {
    if (!open) {
      goneHandled.current = false;
    } else if (readGone && !goneHandled.current) {
      goneHandled.current = true;
      showGone();
    }
  });

  const purge = useOrderAction(
    (_key, target: { readonly id: string }) => deletedOrdersService.purge(target.id, number),
    () => {
      onDone('purged');
      onClose();
      toast.show({ title: COPY.purge.toast.title, message: COPY.purge.toast.message(number) });
      return refreshAll();
    },
  );

  const confirm = async () => {
    const outcome = await purge.submit({ id: orderId });
    if (!outcome.ok && isHttpError(outcome.error) && outcome.error.status === 404) {
      showGone();
      return undefined;
    }
    return outcome;
  };

  const readFailed = counts.isError && !readGone;
  const message = (
    <>
      {COPY.purge.message(team, customer)}
      {readFailed && (
        <>
          {' '}
          <strong>{COPY.purge.countsFailed}</strong>
        </>
      )}
    </>
  );

  return (
    <ConfirmDialog
      open={open}
      title={COPY.purge.title(number)}
      message={message}
      counts={counts.data === undefined ? undefined : countsOf(counts.data.order)}
      countsLoading={counts.isPending}
      countsLoadingLabel={COPY.purge.countsLoading}
      confirmDisabled={readFailed}
      confirmText={number}
      confirmLabel={COPY.purge.confirm}
      pendingLabel={COPY.purge.pending}
      onConfirm={confirm}
      onCancel={onClose}
      describeFailure={describeFailure}
    />
  );
}
