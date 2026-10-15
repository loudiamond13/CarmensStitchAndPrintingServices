// The admin route trees (research Pattern 1 and 14b; UI-SPEC Layout Contract "Admin layout"; D-20 reversed in Phase 4).
//   - `adminRoutes` ships in every build, behind the session guard. The `/admin` layout route's loader is the guard
//     (requireSessionLoader): it boots the session from the refresh cookie once, or redirects to /admin/login with a safe
//     return path. If the layout itself fails, AdminRootErrorBoundary shows the admin error screen in a page root of its
//     own.
//   - Below it, the lazy pathless UrlStateLayout (the one NuqsAdapter around `<Outlet/>`, WEB-10), so the admin lists of
//     later phases keep their state in the URL. Its AdminRouteErrorBoundary shows the admin error screen inside the
//     shell's `main` when a page crashes or a page chunk fails to load.
//   - Until the dashboard exists (Phase 10) the index goes to Signed-in devices (D-43), and the sections whose screens
//     come in Phases 5-9 show the page-not-found screen inside the shell.
//   - `devRoutes` exists only where router.tsx adds it (`__DEV_ROUTES__`): the unguarded section previews and the D-22
//     Component Showcase, inside the same AdminLayout with a placeholder user (Pitfall 11). Nothing there ships.
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

const urlStateLayout = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/lib/url-state/UrlStateLayout')).default,
}));

/** requireSessionLoader, loaded with the admin chunks so the public entry never carries the session code (PERF-01). */
const requireSession: LoaderFunction = async (args) =>
  (await import('@/modules/admin/guard')).requireSessionLoader(args);

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
          { path: 'orders', lazy: notFoundPage },
          { path: 'expenses', lazy: notFoundPage },
          { path: 'users', lazy: notFoundPage },
          { path: 'profile', lazy: notFoundPage },
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
          { path: 'expenses', lazy: previewPage },
          { path: 'users', lazy: previewPage },
          { path: 'profile', lazy: previewPage },
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
        lazy: /* @__PURE__ */ lazyRoute(async () => ({
          Component: (await import('@/dev/ComponentShowcase')).default,
        })),
      },
    ],
  },
];
