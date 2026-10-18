// U4 DeactivateUserDialog (UI-SPEC "U4 Deactivate, Activate, Lock and Delete"; OQ-3, USER-05; plan 05-28). The confirm behind the
// roster's Deactivate toggle: a thin wrapper over SignOutDialog, so "Keep Active" has the focus on open, the primary button is
// not the danger look, and the ConfirmDialog failure rule applies (the dialog stays open with the alert line, and the last-
// active-Manager guard has its own words). The caller owns the request and passes it as onConfirm.
import { SignOutDialog } from '@/modules/admin/components/SignOutDialog';
import type { UserListItem } from '@/modules/admin/services/usersService';
import { describeUserGuard } from '@/modules/admin/usersGuards';
import { USERS_COPY } from '@/modules/admin/usersCopy';

export interface DeactivateUserDialogProps {
  /** False plays the close animation and then renders nothing (D-39). Default true. */
  open?: boolean;
  user: Pick<UserListItem, 'firstName' | 'lastName'>;
  /** Deactivates the person; return the promise of the outcome so the dialog can follow it. */
  onConfirm: () => unknown;
  onCancel: () => void;
}

export function DeactivateUserDialog({ open = true, user, onConfirm, onCancel }: DeactivateUserDialogProps) {
  const copy = USERS_COPY.deactivate;
  return (
    // SPEC-DEVIATION: OQ-3 App. E.12 deactivates at once; the 36px row icons sit close together on phones, so a confirm
    // with "Keep Active" focused first stops a mistaken tap from signing a person out.
    <SignOutDialog
      open={open}
      title={copy.title(`${user.firstName} ${user.lastName}`.trim())}
      message={copy.body}
      keepLabel={copy.keep}
      confirmLabel={copy.confirm}
      pendingLabel={copy.pending}
      confirmIcon="user-x"
      describeFailure={describeUserGuard}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
