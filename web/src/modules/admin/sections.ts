// The admin section of a path (plan 02-31): the shell marks it current in the sidebar and the tab bar, and the preview
// page takes its label and icon from it. Paths come from ADMIN_NAV (App. D.3), the Audit Log item (OQ-2), the Settings item (OQ-3) and the My Money item (D-39), so the shell and the nav never disagree.
import type { Role } from '@/utils/csps';
import {
  ADMIN_NAV,
  AUDIT_NAV_ITEM,
  MONEY_NAV_ITEM,
  SETTINGS_NAV_ITEM,
  type AdminNavItem,
} from '@/components/navigation';

/** A page that lives under a section's item: it marks that item current (Deleted Expenses sits under Company Expenses, Deleted Orders under Orders). */
const SECTION_CHILDREN: Readonly<Record<string, string>> = {
  '/admin/expenses/deleted': '/admin/expenses',
  '/admin/orders/deleted': '/admin/orders',
};

/**
 * Pages under a section whose address has a dynamic part: a path that starts with the key marks the item at the value. One person's money
 * (`/admin/money/staff/{id}`) sits under My Money (D-42). The id must be there, so the bare `/admin/money/staff` is no section.
 */
const SECTION_PREFIXES: readonly (readonly [prefix: string, section: string])[] = [
  ['/admin/money/staff/', '/admin/money'],
];

/** The nav item whose path is `pathname` (one trailing slash or more allowed), or undefined for any other path. */
export function adminNavItemForPath(pathname: string): AdminNavItem | undefined {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const prefixed = SECTION_PREFIXES.find(([prefix]) => path.startsWith(prefix))?.[1];
  const section = SECTION_CHILDREN[path] ?? prefixed ?? path;
  return [...ADMIN_NAV, MONEY_NAV_ITEM, AUDIT_NAV_ITEM, SETTINGS_NAV_ITEM].find((item) => item.to === section);
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
