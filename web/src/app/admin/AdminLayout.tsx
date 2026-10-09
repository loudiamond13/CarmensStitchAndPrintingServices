// The admin layout (UI-SPEC Layout Contract "Admin layout", spec §8.1, App. E.6 shell; WEB-05, A11Y-01, A11Y-02).
// Dev builds only (D-20): the router mounts it under `__DEV_ROUTES__`. The page root (the `.s-page` look, `data-theme`)
// holds, in keyboard order, the skip link and the App. E.6 frame (AdminFrame):
//   - the side column (`data-ui="s-admin-side"`) with the Sidebar: 248px, a 72px icon rail from 768 to 1023px (the
//     rail looks are `pg-tablet:in-data-[ui=s-admin-side]:` variants in the navigation recipes), hidden on phones;
//   - the main column (`data-ui="s-admin-main"`): the sticky Topbar, `main#main` in the `.s-body` look, and the phone
//     tab bar.
// After the frame comes the phone navigation drawer (SPEC-GAP MobileNavDrawer, plan 02-32): the Topbar's "Open
// navigation" button opens it (`aria-expanded`, `aria-controls`), it holds a second Sidebar for the same section, and
// while it is open the frame behind it is `inert`, so neither the keyboard nor assistive technology reaches the page
// under the scrim.
// The toast layer sits inside the page root after the frame (ToastProvider, plan 02-21), so toasts take the theme.
// The dev user is Carmen Reyes (Manager); Logout (in the Sidebar, the drawer and the Topbar's user menu, plan 02-32)
// shows the "Not available yet" info toast until Phase 4.
// Theme (D-13): read once in a lazy useState initializer (no inline script), Blush when nothing valid is saved, written
// on every toggle; a storage that throws leaves the toggle working in memory (theme.ts).
// While a page chunk loads, `main` is busy and shows a skeleton page head (Skeleton 40% × 34, then 60% × 14) in the
// page head's place (UI-SPEC UI Considerations: loading, route chunks).
import { useId, useState, type ReactNode } from 'react';
import { Outlet, useLocation, useNavigation } from 'react-router';
import { SkipLink } from '@/ui/entry';
import { Skeleton, ToastProvider, useToast } from '@/ui/feedback';
import { pageRootClasses } from '@/ui/layout/layout.recipe';
import { MobileNavDrawer, Sidebar, Topbar, type AdminSection } from '@/ui/navigation';
import {
  adminBodyClasses,
  adminClasses,
  adminMainClasses,
  adminSideClasses,
  skeletonHeadClasses,
} from './admin.recipe';
import { ADMIN_COPY } from './copy';
import { adminNavItemForPath, DEV_USER } from './sections';
import { TabBar } from './TabBar';
import { readTheme, writeTheme, type Theme } from './theme';

/** The skeleton page head shown while a page chunk loads. */
function SkeletonPageHead() {
  return (
    <div className={skeletonHeadClasses}>
      <Skeleton width="40%" height={34} />
      <Skeleton width="60%" height={14} />
    </div>
  );
}

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

/**
 * The App. E.6 frame: the side column with the Sidebar, then the Topbar, `main` and the tab bar in the main column; then
 * the phone navigation drawer, which the frame owns (its state, and `inert` on the frame while it is open).
 */
export function AdminFrame({ section, theme, onToggleTheme, onLogout, loading = false, children }: AdminFrameProps) {
  const [navOpen, setNavOpen] = useState(false);
  const drawerId = useId();
  return (
    <>
      <div className={adminClasses} inert={navOpen}>
        <div data-ui="s-admin-side" className={adminSideClasses}>
          <Sidebar active={section ?? null} role={DEV_USER.role} user={DEV_USER} onLogout={onLogout} />
        </div>
        <div data-ui="s-admin-main" className={adminMainClasses}>
          <Topbar
            user={DEV_USER}
            role={DEV_USER.role}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onLogout={onLogout}
            onMenu={() => {
              setNavOpen(true);
            }}
            menuExpanded={navOpen}
            menuControls={drawerId}
          />
          <main id="main" tabIndex={-1} aria-busy={loading ? true : undefined} className={adminBodyClasses}>
            {loading ? <SkeletonPageHead /> : children}
          </main>
          <TabBar active={section} />
        </div>
      </div>
      <MobileNavDrawer
        id={drawerId}
        open={navOpen}
        onClose={() => {
          setNavOpen(false);
        }}
      >
        <Sidebar active={section ?? null} role={DEV_USER.role} user={DEV_USER} onLogout={onLogout} />
      </MobileNavDrawer>
    </>
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
  const [theme, setTheme] = useState<Theme>(readTheme);
  return (
    <div data-theme={theme} className={pageRootClasses}>
      <ToastProvider>
        <SkipLink />
        <AdminShell
          theme={theme}
          onToggleTheme={() => {
            const next = theme === 'light' ? 'dark' : 'light';
            setTheme(next);
            writeTheme(next);
          }}
        />
      </ToastProvider>
    </div>
  );
}
