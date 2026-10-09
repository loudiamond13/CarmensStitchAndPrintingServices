// The admin layout (UI-SPEC Layout Contract "Admin layout", spec §8.1, App. E.6 shell; WEB-05, A11Y-01, A11Y-02).
// Dev builds only (D-20): the router mounts it under `__DEV_ROUTES__`. The page root (the `.s-page` look, `data-theme`)
// holds, in keyboard order, the skip link and the App. E.6 frame (AdminFrame):
//   - the side column (`data-ui="s-admin-side"`) with the Sidebar: 248px, a 72px icon rail from 768 to 1023px (the
//     rail looks are `pg-tablet:in-data-[ui=s-admin-side]:` variants in the navigation recipes), hidden on phones;
//   - the main column (`data-ui="s-admin-main"`): the sticky Topbar, `main#main` in the `.s-body` look, and the phone
//     tab bar.
// The toast layer sits inside the page root after the frame (ToastProvider, plan 02-21), so toasts take the theme.
// The dev user is Carmen Reyes (Manager); Logout shows the "Not available yet" info toast until Phase 4.
import { useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigation } from 'react-router';
import { SkipLink } from '@/ui/entry';
import { ToastProvider, useToast } from '@/ui/feedback';
import { pageRootClasses } from '@/ui/layout/layout.recipe';
import { Sidebar, Topbar, type AdminSection } from '@/ui/navigation';
import { adminBodyClasses, adminClasses, adminMainClasses, adminSideClasses } from './admin.recipe';
import { ADMIN_COPY } from './copy';
import { adminNavItemForPath, DEV_USER } from './sections';

export type Theme = 'light' | 'dark';

export interface AdminFrameProps {
  /** The current section (sidebar and tab bar); none for a path that is no section. */
  section: AdminSection | undefined;
  theme: Theme;
  onToggleTheme?: (() => void) | undefined;
  onLogout?: (() => void) | undefined;
  /** A route chunk is loading: `main` is busy. */
  loading?: boolean | undefined;
  children?: ReactNode;
}

/** The App. E.6 frame: the side column with the Sidebar, then the Topbar, `main` and the tab bar in the main column. */
export function AdminFrame({ section, theme, onToggleTheme, onLogout, loading = false, children }: AdminFrameProps) {
  return (
    <div className={adminClasses}>
      <div data-ui="s-admin-side" className={adminSideClasses}>
        <Sidebar active={section} role={DEV_USER.role} user={DEV_USER} onLogout={onLogout} />
      </div>
      <div data-ui="s-admin-main" className={adminMainClasses}>
        <Topbar user={DEV_USER} role={DEV_USER.role} theme={theme} onToggleTheme={onToggleTheme} />
        <main id="main" tabIndex={-1} aria-busy={loading ? true : undefined} className={adminBodyClasses}>
          {children}
        </main>
      </div>
    </div>
  );
}

/** The frame for the current path, inside the toast provider (Logout raises a toast). */
function AdminShell({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const toast = useToast();
  const { pathname } = useLocation();
  const loading = useNavigation().state === 'loading';
  return (
    <AdminFrame
      section={adminNavItemForPath(pathname)?.id}
      theme={theme}
      onToggleTheme={onToggleTheme}
      onLogout={() => {
        toast.show({ tone: 'info', title: ADMIN_COPY.logoutToast.title, message: ADMIN_COPY.logoutToast.message });
      }}
      loading={loading}
    >
      <Outlet />
    </AdminFrame>
  );
}

export default function AdminLayout() {
  const [theme, setTheme] = useState<Theme>('light');
  return (
    <div data-theme={theme} className={pageRootClasses}>
      <ToastProvider>
        <SkipLink />
        <AdminShell
          theme={theme}
          onToggleTheme={() => {
            setTheme(theme === 'light' ? 'dark' : 'light');
          }}
        />
      </ToastProvider>
    </div>
  );
}
