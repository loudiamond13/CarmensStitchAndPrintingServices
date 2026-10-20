// The admin section of a path (plan 02-31): the shell marks it current in the sidebar and the tab bar, and the preview
// page takes its label and icon from it. Paths come from ADMIN_NAV (App. D.3) and the Audit Log item (OQ-2), so the shell and the nav never disagree.
import type { Role } from '@/utils/csps';
import { ADMIN_NAV, AUDIT_NAV_ITEM, type AdminNavItem } from '@/components/navigation';

/** The nav item whose path is `pathname` (one trailing slash or more allowed), or undefined for any other path. */
export function adminNavItemForPath(pathname: string): AdminNavItem | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return [...ADMIN_NAV, AUDIT_NAV_ITEM].find((item) => item.to === path);
}

/** Who the shell shows: a name and a role. The guarded routes give the session user, the dev routes give DEV_USER. */
export interface ShellUser {
  readonly name: string;
  readonly role: Role;
}

/** The placeholder user of the dev routes: Carmen Reyes, Manager (CSPS-UI-SPEC §12.1). */
export const DEV_USER: ShellUser = { name: 'Carmen Reyes', role: 'manager' };

/** True for what an admin layout loader returns. */
export function isShellUser(value: unknown): value is ShellUser {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'role' in value &&
    (value.role === 'admin' || value.role === 'manager')
  );
}
