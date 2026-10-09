// SPEC-GAP: user menu
// RED stub (plan 02-32): the props API only; the menu itself comes with the implementation.
import type { Role } from '@/lib/csps';

export interface UserMenuProps {
  user: { name: string };
  role: Role;
  onLogout?: (() => void) | undefined;
}

export function UserMenu(_props: UserMenuProps) {
  return null;
}
