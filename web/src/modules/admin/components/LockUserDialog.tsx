// U4 LockUserDialog (plan 05-30): stub for the RED commit.
import type { UserListItem } from '@/modules/admin/services/usersService';

export interface LockUserDialogProps {
  open?: boolean;
  user: Pick<UserListItem, 'firstName' | 'lastName'>;
  onConfirm: () => unknown;
  onCancel: () => void;
}

export function LockUserDialog(props: LockUserDialogProps) {
  void props;
  return null;
}
