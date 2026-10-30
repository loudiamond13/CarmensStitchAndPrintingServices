// The admin route trees (research Pattern 1 and 14b; UI-SPEC Layout Contract "Admin layout"; D-20 reversed in Phase 4).
//   - `adminRoutes` ships in every build, behind the session guard. The `/admin` layout route's loader is the guard
//     (requireSessionLoader): it boots the session from the refresh cookie once, or redirects to /admin/login with a safe
//     return path. If the layout itself fails, AdminRootErrorBoundary shows the admin error screen in a page root of its
//     own.
//   - Below it, the lazy pathless UrlStateLayout (the one NuqsAdapter around `<Outlet/>`, WEB-10), so the admin lists of
//     later phases keep their state in the URL. Its AdminRouteErrorBoundary shows the admin error screen inside the
//     shell's `main` when a page crashes or a page chunk fails to load.
//   - Until the dashboard exists (Phase 10) the index goes to Orders (D-61).
//   - The sign-in screens (`admin/login`, `admin/login/verify`, `admin/forgot-password`, `admin/reset-password`, `admin/accept-invite`, the email-change confirm screen and `admin/login/new-password`) sit in a pathless
//     AuthLayout branch beside the guarded layout, never under it; each route's loader sends a live session to /admin.
//   - An unknown `/admin/...` address is the splat route inside the shell (D-89), not the public holding page.
//   - `/admin/components` is the Component Showcase for Managers (D-30..D-33), a lazy chunk of its own.
//   - `devRoutes` exists only where router.tsx adds it (`__DEV_ROUTES__`): the unguarded section previews and the same
//     Component Showcase at /dev/components, inside the same AdminLayout with a placeholder user (Pitfall 11), and
//     /dev/public, the real PublicLayout around a column of fields for the e2e focus checks. Nothing there ships.
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

const publicLayout = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/layouts/PublicLayout')).PublicLayout,
}));

const publicCheckPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/public/pages/PublicLayoutCheckPage')).PublicLayoutCheckPage,
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

const ordersPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/OrdersPage')).default,
}));

const orderPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/OrderPage')).default,
}));

const deletedExpensesPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/DeletedExpensesPage')).DeletedExpensesRoute,
}));

const settingsPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/SettingsPage')).SettingsRoute,
}));

const auditLogPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/AuditLogPage')).AuditLogRoute,
}));

const showcasePage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/ComponentShowcasePage')).ComponentShowcaseRoute,
}));

const notFoundPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/AdminNotFoundPage')).AdminNotFoundPage,
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

/** requireManagerLoader for Deleted Expenses: an Admin goes back to the expenses list, not to /admin (D-07). */
const requireManagerOrExpenses: LoaderFunction = async (args) =>
  (await import('@/modules/admin/guard')).requireManagerLoader(args, '/admin/expenses');

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
              throw redirect('/admin/orders');
            },
          },
          { path: 'sessions', lazy: sessionsPage },
          { path: 'orders', lazy: ordersPage },
          // ORD-07: one order. The static segments added later (orders/new, orders/deleted) win over this dynamic one.
          { path: 'orders/:id', lazy: orderPage },
          { path: 'expenses', lazy: expensesPage },
          // D-03, D-07: a Manager-only page under Company Expenses; an Admin is sent back to the list by the loader.
          { path: 'expenses/deleted', loader: requireManagerOrExpenses, lazy: deletedExpensesPage },
          { path: 'users', loader: requireManager, lazy: usersPage },
          { path: 'audit-log', loader: requireManager, lazy: auditLogPage },
          // D-14: the Manager-only Settings page (expense categories); an Admin is sent to /admin by the loader.
          { path: 'settings', loader: requireManager, lazy: settingsPage },
          // D-30, D-31: the living style guide, for Managers only and in no navigation (the page is a lazy chunk, D-33).
          { path: 'components', loader: requireManager, lazy: showcasePage },
          { path: 'profile', lazy: profilePage },
          // D-89: any other /admin/... address shows the in-shell Page not found screen, behind the same sign-in guard.
          { path: '*', lazy: notFoundPage },
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
        children: [{ index: true, lazy: previewPage }],
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
  {
    path: 'dev/public',
    ErrorBoundary: AdminRootErrorBoundary,
    lazy: publicLayout,
    children: [{ index: true, lazy: publicCheckPage }],
  },
];
