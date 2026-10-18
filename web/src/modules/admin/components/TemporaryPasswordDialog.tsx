// U5 TemporaryPasswordDialog (plan 05-30): stub for the RED commit.
import type { UserListItem } from '@/modules/admin/services/usersService';

export interface TemporaryPasswordDialogProps {
  open?: boolean;
  user: Pick<UserListItem, 'firstName' | 'lastName'>;
  onSet: (temporaryPassword: string, idempotencyKey: string) => Promise<unknown>;
  onClose: () => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function TemporaryPasswordDialog(_props: TemporaryPasswordDialogProps) {
  return null;
}
