// Sidebar (App. D.3 "Navigation", CSPS-UI-SPEC.md §6.6), converted to utilities (D-33) with App. D.3's props API,
// markup and copy: the lockup and the collapse toggle, the "Admin" navigation (ADMIN_NAV, the Users section for a
// manager only, with its "Manager" tag), then the user chip and Logout. App. D.3's `.is-on` / `.is-collapsed` class
// hooks are gone: the current item is read from `aria-current="page"` and the collapsed layout is a class map (UI-SPEC
// rule 6). Owner rulings applied:
//   - D-03 the current item is bold (700) as its second cue, besides the primary fill and the accent marker;
//   - D-31 D-BL-02 the "Manager" tag is hidden on the current row and shown at full opacity elsewhere (D-02 FYI-01);
//   - D-27 Logout is a <button type="button"> with the nav-item look (see below).
// SPEC-DEVIATION: A11Y-01 (plan 02-31) every nav item and Logout is named by `aria-labelledby` pointing at its own
// label (and, on a Users row that is not current, its "Manager" tag): the same names as the visible text gives, but kept
// on the admin shell's tablet rail, where App. C hides the labels (`display: none`) and the approved links lose their
// names (axe link-name). Attributes only; nothing visible changes.
// The Sidebar renders its own Logo, Avatar and Icons, so it passes them their sidebar context (UI-SPEC rule 7a). The
// tablet icon rail (App. C `.s-admin-side`) is a context look: inside the admin shell's side column the recipes' rail
// variants apply from 768 to 1023px (plan 02-31).
import clsx from 'clsx';
import { useId, useState } from 'react';
import type { Role } from '@/utils/csps';
import { targetAreaClasses, UiLink } from '@/components/actions';
import { Icon, Logo, type IconName } from '@/components/brand';
import { Avatar } from '@/components/status';
import {
  navTagClasses,
  sidebarClasses,
  sidebarFootClasses,
  sidebarNavClasses,
  sidebarToggleClasses,
  sidebarTopClasses,
  sidebarTopLayoutClasses,
  sidebarUserClasses,
  sidebarUserNameClasses,
  sidebarUserTextClasses,
  sidebarUserRoleClasses,
  sidebarWidthClasses,
} from './navigation.recipe';
import {
  navButtonClasses,
  navIconClasses,
  navItemClasses,
  navLabelHiddenClasses,
  navLabelRailClasses,
} from './navItem.recipe';

// SPEC-DEVIATION: OQ-2 (contract default) 'audit' joins the sections for the Manager-only Audit Log item (USER-08).
export type AdminSection = 'dashboard' | 'orders' | 'expenses' | 'users' | 'audit' | 'profile';

/** One admin section: its id, label, 20px icon, path, and whether only a manager sees it. */
export interface AdminNavItem {
  id: AdminSection;
  label: string;
  icon: IconName;
  to: string;
  manager?: boolean;
}

/** The admin sections in order (App. D.3 ADMIN_NAV, spec §6.6). */
export const ADMIN_NAV: readonly AdminNavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'layout-dashboard', to: '/admin' },
  { id: 'orders', label: 'Orders', icon: 'clipboard-list', to: '/admin/orders' },
  { id: 'expenses', label: 'Company Expenses', icon: 'receipt', to: '/admin/expenses' },
  { id: 'users', label: 'Users', icon: 'users', to: '/admin/users', manager: true },
  { id: 'profile', label: 'My Profile', icon: 'user-round', to: '/admin/profile' },
];

/**
 * SPEC-DEVIATION: OQ-2 the Audit Log item (USER-08): Manager only, after Users. It is not in ADMIN_NAV (App. D.3's five
 * items stay as they are); the Sidebar adds it with `withAuditLog`.
 */
export const AUDIT_NAV_ITEM: AdminNavItem = {
  id: 'audit',
  label: 'Audit Log',
  icon: 'history',
  to: '/admin/audit-log',
  manager: true,
};

export interface SidebarProps {
  /**
   * The current section (`aria-current="page"`); Dashboard when not given. SPEC-DEVIATION (A11Y-01, plan 02-34): null
   * marks no item current, for a page that is no section (the dev Component Showcase), so no link claims the page.
   */
  active?: AdminSection | null | undefined;
  /** The signed-in user's role: a manager also sees Users. Display only; the server enforces roles (SEC-02). */
  role?: Role | undefined;
  /** Controlled collapsed state; when given, the toggle no longer changes the layout. */
  collapsed?: boolean | undefined;
  /** The starting state when `collapsed` is not given. */
  defaultCollapsed?: boolean | undefined;
  onNavigate?: ((id: AdminSection) => void) | undefined;
  onLogout?: (() => void) | undefined;
  /** Shows the user chip (avatar, name, role) above Logout. */
  user?: { name: string } | undefined;
  /** Adds the Audit Log item after Users (a manager still needs the role to see it). The real admin shell sets it. */
  withAuditLog?: boolean | undefined;
}

export function Sidebar({
  active = 'dashboard',
  role = 'admin',
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onNavigate,
  onLogout,
  user,
  withAuditLog = false,
}: SidebarProps) {
  const [collapsedState, setCollapsedState] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? collapsedState;
  const layout = collapsed ? 'collapsed' : 'expanded';
  const labelClasses = collapsed ? navLabelHiddenClasses : navLabelRailClasses;
  const idBase = useId();
  const items = withAuditLog
    ? ADMIN_NAV.flatMap((item) => (item.id === 'users' ? [item, AUDIT_NAV_ITEM] : [item]))
    : ADMIN_NAV;
  return (
    <aside className={clsx(sidebarClasses, sidebarWidthClasses[layout])}>
      <div className={clsx(sidebarTopClasses, sidebarTopLayoutClasses[layout])}>
        {collapsed ? (
          <Logo size="sm" variant="mark" context="sidebar" />
        ) : (
          <Logo size="sm" tagline={false} context="sidebar" />
        )}
        <button
          type="button"
          className={clsx(sidebarToggleClasses, targetAreaClasses)}
          onClick={() => {
            setCollapsedState(!collapsed);
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          // SPEC-DEVIATION: D-41 R2-12 (owner, 2026-10-13) the toggle also states whether the sidebar is expanded
          // (the displayed state, controlled or not); its name still says what it will do. Nothing visible changes.
          aria-expanded={!collapsed}
        >
          <Icon name={collapsed ? 'panel-left-open' : 'panel-left-close'} size={18} />
        </button>
      </div>
      <nav className={sidebarNavClasses} aria-label="Admin">
        {items
          .filter((item) => item.manager !== true || role === 'manager')
          .map((item) => (
            <UiLink
              key={item.id}
              to={item.to}
              onClick={() => onNavigate?.(item.id)}
              className={navItemClasses({ collapsed })}
              aria-current={active === item.id ? 'page' : undefined}
              aria-labelledby={
                item.manager === true && !collapsed && active !== item.id
                  ? `${idBase}-${item.id} ${idBase}-${item.id}-tag`
                  : `${idBase}-${item.id}`
              }
              title={collapsed ? item.label : undefined}
            >
              <Icon name={item.icon} size={20} className={navIconClasses} />
              <span id={`${idBase}-${item.id}`} className={labelClasses}>
                {item.label}
              </span>
              {item.manager === true && !collapsed && (
                <span id={`${idBase}-${item.id}-tag`} className={navTagClasses}>
                  Manager
                </span>
              )}
            </UiLink>
          ))}
      </nav>
      <div className={sidebarFootClasses}>
        {user !== undefined && !collapsed && (
          <div className={sidebarUserClasses}>
            <Avatar name={user.name} size={32} context="sidebar" />
            <div className={sidebarUserTextClasses}>
              <strong className={sidebarUserNameClasses} title={user.name}>
                {user.name}
              </strong>
              <span className={sidebarUserRoleClasses}>{role === 'manager' ? 'Manager' : 'Admin'}</span>
            </div>
          </div>
        )}
        {/* SPEC-DEVIATION: D-27 (O-9) App. D.3's <a href="#"> that prevents its own navigation is a
            <button type="button"> with the same nav-item look (owner-confirmed identical, D-31); the tag difference is
            the registry's structural exception in web/visual/intentional-differences.ts. */}
        <button
          type="button"
          className={clsx(navItemClasses({ collapsed }), navButtonClasses)}
          onClick={() => onLogout?.()}
          aria-labelledby={`${idBase}-logout`}
          title={collapsed ? 'Logout' : undefined}
        >
          <Icon name="log-out" size={20} />
          <span id={`${idBase}-logout`} className={labelClasses}>
            Logout
          </span>
        </button>
      </div>
    </aside>
  );
}
