// RED stub (plan 02-26 Task 1): the converted Sidebar arrives in GREEN.
import type { IconName } from '@/ui/brand';
import type { Role } from '@/lib/csps';

export type AdminSection = 'dashboard' | 'orders' | 'expenses' | 'users' | 'profile';
export interface AdminNavItem {
  id: AdminSection;
  label: string;
  icon: IconName;
  to: string;
  manager?: boolean;
}
export const ADMIN_NAV: readonly AdminNavItem[] = [];
export interface SidebarProps {
  active?: AdminSection;
  role?: Role;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onNavigate?: (id: AdminSection) => void;
  onLogout?: () => void;
  user?: { name: string };
}
export function Sidebar(_props: SidebarProps) {
  return <aside data-stub="" />;
}
