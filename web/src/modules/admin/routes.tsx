// The admin route trees (research Pattern 1 and 14b; UI-SPEC Layout Contract "Admin layout"; D-20 reversed in Phase 4).
//   - `adminRoutes` ships in every build, behind the session guard. The `/admin` layout route's loader is the guard
//     (requireSessionLoader): it boots the session from the refresh cookie once, or redirects to /admin/login with a safe
//     return path. If the layout itself fails, AdminRootErrorBoundary shows the admin error screen in a page root of its
//     own.
//   - Below it, the lazy pathless UrlStateLayout (the one NuqsAdapter around `<Outlet/>`, WEB-10), so the admin lists of
//     later phases keep their state in the URL. Its AdminRouteErrorBoundary shows the admin error screen inside the
//     shell's `main` when a page crashes or a page chunk fails to load.
//   - Until the dashboard exists (Phase 10) the index goes to Signed-in devices (D-43), and the sections whose screens
//     come in Phases 7-9 show the page-not-found screen inside the shell.
//   - The sign-in screens (`admin/login`, `admin/login/verify`, `admin/forgot-password`, `admin/reset-password`, `admin/accept-invite`, the email-change confirm screen and `admin/login/new-password`) sit in a pathless
//     AuthLayout branch beside the guarded layout, never under it; each route's loader sends a live session to /admin.
//   - `/admin/components` is the Component Showcase for Managers (D-30..D-33), a lazy chunk of its own.
//   - `devRoutes` exists only where router.tsx adds it (`__DEV_ROUTES__`): the unguarded section previews and the same
//     Component Showcase at /dev/components, inside the same AdminLayout with a placeholder user (Pitfall 11). Nothing
//     there ships.
// Every lazy loader goes through lazyRoute() (plan 02-29). The loaders are created at module load, so they carry
// `@__PURE__` marks: an unused tree is then dropped whole, and its dynamic imports never become chunks.
import { redirect, type LoaderFunction, type RouteObject } from 'react-router';
import { AdminRootErrorBoundary, AdminRouteErrorBoundary } from '@/core/routes/ErrorBoundary';
import { lazyRoute } from '@/core/routes/lazyRoute';

/** The placeholder user of the dev routes, loaded on demand so no admin navigation code joins the public entry. */
const devUser: LoaderFunction = async () => (await import('@/modules/admin/sections')).DEV_USER;

const previewPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/AdminPreviewPage')).AdminPreviewRoute,
}));

const notFoundPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/AdminNotFoundPage')).AdminNotFoundPage,
}));

const adminLayout = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/layouts/AdminLayout')).default,
}));

const authLayout = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/layouts/AuthLayout')).default,
}));

const signInPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/SignInPage')).SignInRoute,
}));

const verifyCodePage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/VerifyCodePage')).VerifyCodeRoute,
}));

const newPasswordPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/NewPasswordPage')).NewPasswordRoute,
}));

const forgotPasswordPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/ForgotPasswordPage')).ForgotPasswordRoute,
}));

const resetPasswordPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/ResetPasswordPage')).ResetPasswordRoute,
}));

const acceptInvitePage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/AcceptInvitePage')).AcceptInviteRoute,
}));

const confirmEmailPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/ConfirmEmailPage')).ConfirmEmailRoute,
}));

const sessionsPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/SessionsPage')).SessionsRoute,
}));

const profilePage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/ProfilePage')).ProfileRoute,
}));

const usersPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/UsersPage')).UsersRoute,
}));

const expensesPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/ExpensesPage')).ExpensesRoute,
}));

const auditLogPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/AuditLogPage')).AuditLogRoute,
}));

const showcasePage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/ComponentShowcasePage')).ComponentShowcaseRoute,
}));

const urlStateLayout = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/lib/url-state/UrlStateLayout')).default,
}));

/** requireSessionLoader, loaded with the admin chunks so the public entry never carries the session code (PERF-01). */
const requireSession: LoaderFunction = async (args) =>
  (await import('@/modules/admin/guard')).requireSessionLoader(args);

/** requireManagerLoader (USER-08), loaded with the admin chunks as above. */
const requireManager: LoaderFunction = async (args) =>
  (await import('@/modules/admin/guard')).requireManagerLoader(args);

/** redirectIfSignedInLoader, loaded with the admin chunks as above. */
const redirectIfSignedIn: LoaderFunction = async (args) =>
  (await import('@/modules/admin/guard')).redirectIfSignedInLoader(args);

export const adminRoutes: RouteObject[] = [
  {
    path: 'admin',
    ErrorBoundary: AdminRootErrorBoundary,
    lazy: adminLayout,
    loader: requireSession,
    children: [
      {
        ErrorBoundary: AdminRouteErrorBoundary,
        lazy: urlStateLayout,
        children: [
          {
            index: true,
            element: null,
            loader: () => {
              // eslint-disable-next-line @typescript-eslint/only-throw-error -- React Router's redirect() is thrown by design.
              throw redirect('/admin/sessions');
            },
          },
          { path: 'sessions', lazy: sessionsPage },
          { path: 'orders', lazy: notFoundPage },
          { path: 'expenses', lazy: expensesPage },
          { path: 'users', loader: requireManager, lazy: usersPage },
          { path: 'audit-log', loader: requireManager, lazy: auditLogPage },
          // D-30, D-31: the living style guide, for Managers only and in no navigation (the page is a lazy chunk, D-33).
          { path: 'components', loader: requireManager, lazy: showcasePage },
          { path: 'profile', lazy: profilePage },
        ],
      },
    ],
  },
  // The sign-in screens: in the auth layout, outside the guard (a guarded splat would redirect them to themselves).
  {
    ErrorBoundary: AdminRootErrorBoundary,
    lazy: authLayout,
    children: [
      {
        ErrorBoundary: AdminRouteErrorBoundary,
        children: [
          { path: 'admin/login', loader: redirectIfSignedIn, lazy: signInPage },
          { path: 'admin/login/verify', loader: redirectIfSignedIn, lazy: verifyCodePage },
          { path: 'admin/login/new-password', loader: redirectIfSignedIn, lazy: newPasswordPage },
          { path: 'admin/forgot-password', loader: redirectIfSignedIn, lazy: forgotPasswordPage },
          // No sign-in check: a reset link works signed in or not.
          { path: 'admin/reset-password', lazy: resetPasswordPage },
          // No sign-in check: an invite link works signed in or not.
          { path: 'admin/accept-invite', lazy: acceptInvitePage },
          // No sign-in check: an email change link works signed in or not.
          { path: 'admin/confirm-email', lazy: confirmEmailPage },
        ],
      },
    ],
  },
];

export const devRoutes: RouteObject[] = [
  {
    path: 'admin',
    ErrorBoundary: AdminRootErrorBoundary,
    lazy: adminLayout,
    loader: devUser,
    children: [
      {
        ErrorBoundary: AdminRouteErrorBoundary,
        lazy: urlStateLayout,
        children: [
          { index: true, lazy: previewPage },
          { path: 'orders', lazy: previewPage },
        ],
      },
    ],
  },
  {
    path: 'dev',
    ErrorBoundary: AdminRootErrorBoundary,
    lazy: adminLayout,
    loader: devUser,
    children: [
      {
        path: 'components',
        ErrorBoundary: AdminRouteErrorBoundary,
        lazy: showcasePage,
      },
    ],
  },
];
