// The admin section of a path (plan 02-31): the shell marks it current in the sidebar and the tab bar, and the preview
// page takes its label and icon from it. Paths come from ADMIN_NAV (App. D.3), so the shell and the nav never disagree.
import type { Role } from '@/utils/csps';
import { ADMIN_NAV, type AdminNavItem } from '@/components/navigation';

/** The nav item whose path is `pathname` (one trailing slash or more allowed), or undefined for any other path. */
export function adminNavItemForPath(pathname: string): AdminNavItem | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return ADMIN_NAV.find((item) => item.to === path);
}

/** The signed-in user of the dev shell: Carmen Reyes, Manager (CSPS-UI-SPEC §12.1). Phase 4 replaces it with the session. */
export interface DevUser {
  readonly name: string;
  readonly role: Role;
}

export const DEV_USER: DevUser = { name: 'Carmen Reyes', role: 'manager' };
