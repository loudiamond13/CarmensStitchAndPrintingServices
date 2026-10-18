// U4 DeactivateUserDialog (UI-SPEC "U4 Deactivate, Activate, Lock and Delete"; OQ-3; plan 05-28).
import type { UserListItem } from '@/modules/admin/services/usersService';

export interface DeactivateUserDialogProps {
  /** False plays the close animation and then renders nothing (D-39). Default true. */
  open?: boolean;
  user: Pick<UserListItem, 'firstName' | 'lastName'>;
  onConfirm: () => unknown;
  onCancel: () => void;
}

export function DeactivateUserDialog(props: DeactivateUserDialogProps) {
  void props;
  return null;
}
