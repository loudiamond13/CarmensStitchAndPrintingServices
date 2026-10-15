// The admin layout (UI-SPEC Layout Contract "Admin layout", spec §8.1, App. E.6 shell; WEB-05, A11Y-01, A11Y-02).
// It ships in every build behind sign-in (plan 04-25); the dev routes mount it too, with a placeholder user. The page root (the `.s-page` look, `data-theme`)
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
// The signed-in user comes from the route's loader data (the session user, or Carmen Reyes on the dev routes). Logout (in
// the Sidebar, the drawer and the Topbar's user menu) signs out and goes to /admin/login; when the server call fails the
// person stays signed in on the page and a danger toast says so.
// Theme (D-13): read once in a lazy useState initializer (no inline script), Blush when nothing valid is saved, written
// on every toggle; a storage that throws leaves the toggle working in memory (theme.ts).
// While a page chunk loads, `main` is busy and shows a skeleton page head (Skeleton 40% × 34, then 60% × 14) in the
// page head's place (UI-SPEC UI Considerations: loading, route chunks).
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Outlet, useLoaderData, useLocation, useNavigate, useNavigation } from 'react-router';
import { SkipLink } from '@/components/entry';
import { Skeleton, ToastProvider, useToast } from '@/components/feedback';
import { pageRootClasses } from '@/components/layout/layout.recipe';
import { MobileNavDrawer, Sidebar, Topbar, type AdminSection } from '@/components/navigation';
import {
  adminBodyClasses,
  adminClasses,
  adminMainClasses,
  adminSideClasses,
  skeletonHeadClasses,
} from '@/modules/admin/components/admin.recipe';
import { SignOutOthersDialog } from '@/modules/admin/components/SignOutOthersDialog';
import { ADMIN_COPY } from '@/modules/admin/copy';
import { adminNavItemForPath, isShellUser, type ShellUser } from '@/modules/admin/sections';
import { useClearCacheOnSignOut } from '@/modules/admin/hooks/useClearCacheOnSignOut';
import { usePostSignInToast } from '@/modules/admin/hooks/usePostSignInToast';
import { useSessionCapWarning } from '@/modules/admin/hooks/useSessionCapWarning';
import { refreshAfterSignedOutOthers } from '@/modules/admin/hooks/useSessionsQuery';
import { setNavigator, signOut } from '@/modules/admin/services/session';
import { TabBar } from '@/modules/admin/components/TabBar';
import { readTheme, writeTheme, type Theme } from '@/modules/admin/theme';

/** The signed-in devices page (D-43); the user menu links to it. */
const SESSIONS_PATH = '/admin/sessions';

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
  /** Who is signed in: shown in the Sidebar chip and the Topbar's user menu. */
  user: ShellUser;
  theme: Theme;
  onToggleTheme?: (() => void) | undefined;
  onLogout?: (() => void) | undefined;
  /** "Signed-in Devices" in the Topbar's user menu goes here. */
  devicesPath?: string | undefined;
  /** "Sign Out Other Devices" in the Topbar's user menu. */
  onSignOutOthers?: (() => void) | undefined;
  /** A route chunk is loading: `main` is busy. */
  loading?: boolean | undefined;
  children?: ReactNode;
}

/**
 * The App. E.6 frame: the side column with the Sidebar, then the Topbar, `main` and the tab bar in the main column; then
 * the phone navigation drawer, which the frame owns (its state, and `inert` on the frame while it is open).
 */
export function AdminFrame({
  section,
  user,
  theme,
  onToggleTheme,
  onLogout,
  devicesPath,
  onSignOutOthers,
  loading = false,
  children,
}: AdminFrameProps) {
  const [navOpen, setNavOpen] = useState(false);
  const drawerId = useId();
  return (
    <>
      <div className={adminClasses} inert={navOpen}>
        <div data-ui="s-admin-side" className={adminSideClasses}>
          <Sidebar active={section ?? null} role={user.role} user={user} onLogout={onLogout} />
        </div>
        <div data-ui="s-admin-main" className={adminMainClasses}>
          <Topbar
            user={user}
            role={user.role}
            theme={theme}
            onToggleTheme={onToggleTheme}
            onLogout={onLogout}
            devicesPath={devicesPath}
            onSignOutOthers={onSignOutOthers}
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
        <Sidebar active={section ?? null} role={user.role} user={user} onLogout={onLogout} />
      </MobileNavDrawer>
    </>
  );
}

/** The frame for the current path. Logout leaves for /admin/login once the server ended the session; if not, a toast says so. */
function AdminShell({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const loading = useNavigation().state === 'loading';
  const [signOutOthersOpen, setSignOutOthersOpen] = useState(false);
  const queryClient = useQueryClient();
  const toast = useToast();
  const failureToast = useRef<number | null>(null);
  useSessionCapWarning();
  usePostSignInToast();
  useClearCacheOnSignOut();
  const user: unknown = useLoaderData();
  // The session module navigates (a session that ended in this or another tab) without importing the router.
  useEffect(() => {
    setNavigator((to) => {
      void navigate(to);
    });
  }, [navigate]);
  if (!isShellUser(user)) {
    throw new Error('The admin layout route has no signed-in user.');
  }
  return (
    <>
      <AdminFrame
        section={adminNavItemForPath(pathname)?.id}
        user={user}
        theme={theme}
        onToggleTheme={onToggleTheme}
        onLogout={() => {
          if (failureToast.current !== null) {
            toast.dismiss(failureToast.current);
            failureToast.current = null;
          }
          void signOut().then((ended) => {
            if (ended) {
              void navigate('/admin/login');
            } else {
              failureToast.current = toast.show({
                tone: 'danger',
                title: ADMIN_COPY.signOutFailed.title,
                message: ADMIN_COPY.signOutFailed.message,
              });
            }
          });
        }}
        devicesPath={SESSIONS_PATH}
        onSignOutOthers={() => {
          setSignOutOthersOpen(true);
        }}
        loading={loading}
      >
        <Outlet />
      </AdminFrame>
      {/* The menu puts focus on its button before this opens, so the dialog's focus trap returns there on close. */}
      {signOutOthersOpen && (
        <SignOutOthersDialog
          onSignedOut={() => {
            refreshAfterSignedOutOthers(queryClient);
          }}
          onClose={() => {
            setSignOutOthersOpen(false);
          }}
        />
      )}
    </>
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
