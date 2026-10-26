// SPEC-GAP: PurgeExpenseDialog (UI-SPEC E3 "Delete permanently"; D-04, D-05, D-06, OQ-1; plan 06-16). The warning before a Manager
// removes an expense for good, shared by the list and the Deleted Expenses page: the plain ConfirmDialog (Cancel focused, no
// type-to-confirm) that says it cannot be undone and what the audit log keeps.
//   - A failure stays in the dialog as the mapper line with focus on the confirm button.
//   - A 404 means someone else got there first: the dialog closes, the lists read again and the info toast says so.
//   - On success the page hears about it first (`onRemoved`, to choose where focus goes), then the dialog closes, the toast shows
//     and the lists, month figures and deleted list read again.
import { useToast } from '@/components/feedback';
import { ConfirmDialog } from '@/components/overlays';
import { isHttpError } from '@/core/api/errors';
import { EXPENSES_COPY } from '@/modules/admin/expensesCopy';
import { useExpenseAction } from '@/modules/admin/hooks/useExpenseAction';
import { useRefreshExpenses } from '@/modules/admin/hooks/useRefreshExpenses';
import { expensesService } from '@/modules/admin/services/expensesService';
import { formatPeso } from '@/utils/csps';

const COPY = EXPENSES_COPY.purge;

/** What the warning needs to name an expense: both list items carry these. */
export interface PurgeTarget {
  readonly id: string;
  readonly description: string;
  readonly amount: number | string;
}

export interface PurgeExpenseDialogProps {
  expense: PurgeTarget;
  open: boolean;
  onClose: () => void;
  /** The expense is gone (deleted by this press, or already gone): the page decides where focus goes. */
  onRemoved: (expense: PurgeTarget) => void;
}

export function PurgeExpenseDialog({ expense, open, onClose, onRemoved }: PurgeExpenseDialogProps) {
  const toast = useToast();
  const refreshAll = useRefreshExpenses();
  const purge = useExpenseAction<PurgeTarget>(
    (_key, target) => expensesService.purge(target.id),
    (target) => {
      onRemoved(target);
      onClose();
      toast.show({ title: COPY.toast.title, message: COPY.toast.message(target.description) });
      return refreshAll();
    },
  );

  const confirm = async () => {
    const outcome = await purge.submit(expense);
    if (!outcome.ok && isHttpError(outcome.error) && outcome.error.status === 404) {
      onRemoved(expense);
      onClose();
      toast.show({
        tone: 'info',
        title: EXPENSES_COPY.alreadyGone.title,
        message: EXPENSES_COPY.alreadyGone.message,
      });
      void refreshAll();
      return undefined;
    }
    return outcome;
  };

  return (
    <ConfirmDialog
      open={open}
      title={COPY.title(expense.description, formatPeso(expense.amount))}
      message={COPY.message}
      confirmLabel={COPY.confirm}
      pendingLabel={COPY.pending}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
