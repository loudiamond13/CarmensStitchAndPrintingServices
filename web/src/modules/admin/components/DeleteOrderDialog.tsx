// The Delete Order confirm (ORD-06, D-21, D-22, D-39, D-51, D-57; UI-SPEC O3; plan 08-22). A soft delete a Manager can undo: it names
// what gets hidden in words, from the arrays the page already holds, with Cancel focused first. There is nothing to type and no
// counts box. The DELETE acts on the latest state, so it sends no Idempotency-Key and no version. A finished delete returns to the
// list the person came from (else Orders) and toasts. A 404 means someone else deleted the order first: same way back, with an
// info toast.
import { useLocation, useNavigate } from 'react-router';
import { useToast } from '@/components/feedback';
import { ConfirmDialog } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
import { useOrderAction } from '@/modules/admin/hooks/useOrderAction';
import { useRefreshOrders } from '@/modules/admin/hooks/useRefreshOrders';
import { backTarget } from '@/modules/admin/orderNavigation';
import { ORDER_PAGE_COPY } from '@/modules/admin/orderPageCopy';
import { ordersService, type OrderDetailResponse } from '@/modules/admin/services/ordersService';
import { CASCADE_LABELS, type CascadeCounts } from '@/utils/csps';
import { formatCount } from '@/utils/format';

const COPY = ORDER_PAGE_COPY.remove;

/**
 * What a soft delete hides, in words (D-21): "Its 3 items, 2 payments, 1 discount and 4 expenses are hidden from every list and
 * total. A Manager can restore it." Zero counts are left out, the last two join with "and", and an order with no children at all
 * reads "It is hidden ...". Images are not part of the sentence.
 */
export function softDeleteSentence(counts: CascadeCounts): string {
  const kinds = CASCADE_LABELS.filter(([key]) => key !== 'images')
    .map(([key, one]) => [counts[key] ?? 0, one] as const)
    .filter(([n]) => n > 0);
  if (kinds.length === 0) {
    return `${COPY.leadNone} ${COPY.hidden} ${COPY.restore}`;
  }
  const parts = kinds.map(([n, one]) => `${formatCount(n)} ${n === 1 ? one : `${one}s`}`);
  // The last part is popped so the join can say "and" before it.
  const last = parts.pop() ?? '';
  const list = parts.length === 0 ? last : `${parts.join(', ')} and ${last}`;
  const single = kinds.length === 1 && kinds[0]?.[0] === 1;
  return `${COPY.lead} ${list} ${single ? COPY.verbOne : COPY.verbMany} ${COPY.hidden} ${COPY.restore}`;
}

export interface DeleteOrderDialogProps {
  order: OrderDetailResponse;
  open: boolean;
  /** Cancel, Esc or the scrim, and a finished delete. */
  onClose: () => void;
}

export function DeleteOrderDialog({ order, open, onClose }: DeleteOrderDialogProps) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const refreshAll = useRefreshOrders();

  const leave = () => {
    void navigate(backTarget(location.state));
    onClose();
  };

  const remove = useOrderAction(
    (_key, target: { readonly id: string }) => ordersService.remove(target.id),
    () => {
      leave();
      toast.show({ tone: 'success', title: COPY.toast.title(order.number), message: COPY.toast.message });
      return refreshAll();
    },
  );

  const confirm = async () => {
    const outcome = await remove.submit({ id: order.id });
    if (!outcome.ok && isHttpError(outcome.error) && outcome.error.status === 404) {
      leave();
      toast.show({ tone: 'info', title: COPY.alreadyDeleted.title, message: COPY.alreadyDeleted.message });
      void refreshAll();
      return undefined;
    }
    return outcome;
  };

  return (
    <ConfirmDialog
      open={open}
      title={COPY.title(order.number)}
      message={softDeleteSentence({
        items: order.items.length,
        payments: order.payments.length,
        discounts: order.discounts.length,
        expenses: order.expenses.length,
        refunds: order.refunds.length,
      })}
      cancelLabel={COPY.cancel}
      confirmLabel={COPY.confirm}
      confirmIcon="trash-2"
      pendingLabel={COPY.pending}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
