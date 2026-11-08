// SPEC-GAP: DeleteTransferDialog (UI-SPEC T2; D-23, D-29, D-33, D-35, SEC-07, MONEY-06; plan 10-20). The simple confirm before a Manager
// deletes a transfer: it says what is deleted and what that does, with Cancel focused first and no reason to type (D-29). The DELETE
// sends the row's version as a query parameter (D-23). On success the dialog closes, the toast shows and the money answers are read
// again; the host hears about it first (`onDone`) so it can choose where focus goes. A transfer can be recorded again, so this is not
// final.
//   - Resulting-balance warning (D-33): the staff balances are read fresh when the dialog opens. If the receiver's balance minus the
//     amount is below ₱0.00, a labelled block says so. That subtraction is the one piece of arithmetic the browser does on these
//     screens: it is built only from server balances, says what will happen, and the server's figures win after the delete (T-10-44).
//     While the read runs the block is a skeleton and the confirm is off; if it fails the block says the delete still works.
//   - 409 (changed by someone else) keeps the dialog open with the alert line. 404 (already deleted) closes it with an info toast.
import { useState } from 'react';
import { Icon } from '@/components/brand';
import { ConfirmDialog } from '@/components/overlays';
import {
  transferCheckFailedClasses,
  transferWarningClasses,
  transferWarningIconClasses,
} from '@/modules/admin/components/money.recipe';
import { useStaffBalancesQuery } from '@/modules/admin/hooks/useStaffBalancesQuery';
import { useTransferDeletion } from '@/modules/admin/hooks/useTransferDeletion';
import { MONEY_COPY } from '@/modules/admin/moneyCopy';
import type { TransferTarget } from '@/modules/admin/services/moneyService';
import { formatPeso, isNegativeMoney, round2 } from '@/utils/csps';
import { isHttpError } from '@/core/api/errors';
import { formatCalendarDate } from '@/utils/format';

const COPY = MONEY_COPY.deleteTransfer;

export interface DeleteTransferDialogProps {
  transfer: TransferTarget;
  open: boolean;
  /** Cancel, Esc or the scrim, and a finished delete. */
  onClose: () => void;
  /** The transfer is gone from the counted list (deleted by this press, or already deleted): the host decides where focus goes. */
  onDone: (transfer: TransferTarget) => void;
}

/** The server's code for two saves that lost a race twice: nothing changed, so the same press can go again. */
const MONEY_BUSY = 'money-transfers.busy';

/**
 * The dialog's own failure line. A busy 409 shows the server's own busy line, as the Transfer window does (P10-BL-11); any other 409
 * is a stale version and has its approved words; anything else gets the mapper's line.
 */
function describeFailure(error: unknown): string | undefined {
  if (!isHttpError(error) || error.kind !== 'http' || error.status !== 409) return undefined;
  return error.code === MONEY_BUSY ? error.problem?.detail : COPY.stale;
}

export function DeleteTransferDialog({ transfer, open, onClose, onDone }: DeleteTransferDialogProps) {
  const { deleteTransfer } = useTransferDeletion();
  // The read is fresh on every open: `refetchOnMount: 'always'` reads again even when an older answer is cached, and until it arrives
  // the older answer is not trusted (the block shows the skeleton).
  const balances = useStaffBalancesQuery(open);
  // Only the read this open starts gates the confirm. A later read (the window gaining focus, a refresh after a 409) keeps the last
  // figures and leaves the focused button alone, so keyboard focus never drops out of the dialog (WCAG 2.4.3).
  const [answered, setAnswered] = useState(false);
  if (open && !balances.isFetching && !answered) setAnswered(true);
  if (!open && answered) setAnswered(false);
  const checking = balances.isFetching && !answered;
  const checkFailed = balances.isError && !balances.isFetching;

  // A receiver the list leaves out is a leaver at ₱0.00 (the list holds former staff only while their balance is not 0.00).
  const held = balances.data?.rows.find((row) => row.userId === transfer.to.id)?.balance ?? 0;
  const after = round2(held - transfer.amount);
  const warn = !checking && !checkFailed && balances.data !== undefined && isNegativeMoney(after);

  const confirm = async () => {
    const result = await deleteTransfer({ id: transfer.id, version: transfer.version });
    if (result.status === 'failed') return result.outcome;
    onDone(transfer);
    onClose();
    return undefined;
  };

  return (
    <ConfirmDialog
      open={open}
      title={COPY.title}
      message={
        <>
          {COPY.message(
            formatPeso(transfer.amount),
            transfer.from.name,
            transfer.to.name,
            formatCalendarDate(transfer.date) ?? transfer.date,
          )}
          {warn && (
            <span role="alert" className={transferWarningClasses}>
              <Icon name="triangle-alert" size={16} className={transferWarningIconClasses} />
              <span>{COPY.warning(transfer.to.name, formatPeso(after))}</span>
            </span>
          )}
          {checkFailed && (
            <span role="alert" className={transferCheckFailedClasses}>
              {COPY.checkFailed}
            </span>
          )}
        </>
      }
      countsLoading={checking}
      countsLoadingLabel={COPY.checking}
      cancelLabel={COPY.cancel}
      confirmLabel={COPY.confirm}
      confirmIcon="trash-2"
      pendingLabel={COPY.pending}
      describeFailure={describeFailure}
      onConfirm={confirm}
      onCancel={onClose}
    />
  );
}
