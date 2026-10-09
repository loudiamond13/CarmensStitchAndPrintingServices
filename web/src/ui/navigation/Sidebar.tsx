// Sidebar (App. D.3 "Navigation", CSPS-UI-SPEC.md §6.6), converted to utilities (D-33) with App. D.3's props API,
// markup and copy: the lockup and the collapse toggle, the "Admin" navigation (ADMIN_NAV, the Users section for a
// manager only, with its "Manager" tag), then the user chip and Logout. App. D.3's `.is-on` / `.is-collapsed` class
// hooks are gone: the current item is read from `aria-current="page"` and the collapsed layout is a class map (UI-SPEC
// rule 6). Owner rulings applied:
//   - D-03 the current item is bold (700) as its second cue, besides the primary fill and the accent marker;
//   - D-31 D-BL-02 the "Manager" tag is hidden on the current row and shown at full opacity elsewhere (D-02 FYI-01);
//   - D-27 Logout is a <button type="button"> with the nav-item look (see below).
// The Sidebar renders its own Logo, Avatar and Icons, so it passes them their sidebar context (UI-SPEC rule 7a). The
// tablet icon rail (App. C `.s-admin-side`) is a context look: inside the admin shell's side column the recipes' rail
// variants apply from 768 to 1023px (plan 02-31).
import clsx from 'clsx';
import { useState } from 'react';
import type { Role } from '@/lib/csps';
import { UiLink } from '@/ui/actions';
import { Icon, Logo, type IconName } from '@/ui/brand';
import { Avatar } from '@/ui/status';
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

export type AdminSection = 'dashboard' | 'orders' | 'expenses' | 'users' | 'profile';

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

export interface SidebarProps {
  /** The current section (`aria-current="page"`). */
  active?: AdminSection | undefined;
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
}

export function Sidebar({
  active = 'dashboard',
  role = 'admin',
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onNavigate,
  onLogout,
  user,
}: SidebarProps) {
  const [collapsedState, setCollapsedState] = useState(defaultCollapsed);
  const collapsed = collapsedProp ?? collapsedState;
  const layout = collapsed ? 'collapsed' : 'expanded';
  const labelClasses = collapsed ? navLabelHiddenClasses : navLabelRailClasses;
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
          className={sidebarToggleClasses}
          onClick={() => {
            setCollapsedState(!collapsed);
          }}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <Icon name={collapsed ? 'panel-left-open' : 'panel-left-close'} size={18} />
        </button>
      </div>
      <nav className={sidebarNavClasses} aria-label="Admin">
        {ADMIN_NAV.filter((item) => item.manager !== true || role === 'manager').map((item) => (
          <UiLink
            key={item.id}
            to={item.to}
            onClick={() => onNavigate?.(item.id)}
            className={navItemClasses({ collapsed })}
            aria-current={active === item.id ? 'page' : undefined}
            title={collapsed ? item.label : undefined}
          >
            <Icon name={item.icon} size={20} className={navIconClasses} />
            <span className={labelClasses}>{item.label}</span>
            {item.manager === true && !collapsed && <span className={navTagClasses}>Manager</span>}
          </UiLink>
        ))}
      </nav>
      <div className={sidebarFootClasses}>
        {user !== undefined && !collapsed && (
          <div className={sidebarUserClasses}>
            <Avatar name={user.name} size={32} context="sidebar" />
            <div>
              <strong className={sidebarUserNameClasses}>{user.name}</strong>
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
          title={collapsed ? 'Logout' : undefined}
        >
          <Icon name="log-out" size={20} />
          <span className={labelClasses}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
