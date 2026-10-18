// U4 LockUserDialog (UI-SPEC "U4 Deactivate, Activate, Lock and Delete"; D-16, USER-05; plan 05-30). The confirm behind U3's
// Lock button: a thin wrapper over SignOutDialog, so "Keep Unlocked" has the focus on open, the primary button is not the
// danger look, and the ConfirmDialog failure rule applies (the dialog stays open with the alert line, and the last-active-
// Manager guard has its own words). The caller owns the request and passes it as onConfirm.
import { SignOutDialog } from '@/modules/admin/components/SignOutDialog';
import type { UserListItem } from '@/modules/admin/services/usersService';
import { describeUserGuard } from '@/modules/admin/usersGuards';
import { USERS_COPY } from '@/modules/admin/usersCopy';

export interface LockUserDialogProps {
  /** False plays the close animation and then renders nothing (D-39). Default true. */
  open?: boolean;
  user: Pick<UserListItem, 'firstName' | 'lastName'>;
  /** Locks the person; return the promise of the outcome so the dialog can follow it. */
  onConfirm: () => unknown;
  onCancel: () => void;
}

export function LockUserDialog({ open = true, user, onConfirm, onCancel }: LockUserDialogProps) {
  const copy = USERS_COPY.lock;
  return (
    <SignOutDialog
      open={open}
      title={copy.title(`${user.firstName} ${user.lastName}`.trim())}
      message={copy.body}
      keepLabel={copy.keep}
      confirmLabel={copy.confirm}
      pendingLabel={copy.pending}
      confirmIcon="lock"
      describeFailure={describeUserGuard}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
