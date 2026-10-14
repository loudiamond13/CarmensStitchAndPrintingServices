// The dev-only admin route tree (D-20, research Pattern 1; UI-SPEC Layout Contract "Admin layout"). router.tsx adds it
// only where `__DEV_ROUTES__` is true (development, e2e and budget builds), so a production build has no admin module.
//   - `/admin` is the lazy AdminLayout. If that layout itself fails, AdminRootErrorBoundary shows the admin error
//     screen in a page root of its own.
//   - Below it, the lazy pathless UrlStateLayout (the one NuqsAdapter around `<Outlet/>`, WEB-10, plan 02-11), so the
//     admin lists of later phases keep their state in the URL. Its AdminRouteErrorBoundary shows the admin error screen
//     inside the shell's `main` when a page crashes or a page chunk fails to load.
//   - The five sections (ADMIN_NAV) each render the AdminPreviewPage for their path.
//   - `/dev/components` is the D-22 Component Showcase (src/dev, plan 02-34) inside the same AdminLayout, so the theme
//     toggle applies; no sidebar item is current there. It has the same two error boundaries.
// Every lazy loader goes through lazyRoute() (plan 02-29). The loaders are created at module load, so they carry
// `@__PURE__` marks: an unused tree is then dropped whole, and its dynamic imports never become chunks.
import type { RouteObject } from 'react-router';
import { AdminRootErrorBoundary, AdminRouteErrorBoundary } from '../ErrorBoundary';
import { lazyRoute } from '../lazyRoute';

const previewPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('./AdminPreviewPage')).AdminPreviewRoute,
}));

const adminLayout = /* @__PURE__ */ lazyRoute(async () => ({ Component: (await import('./AdminLayout')).default }));

export const adminRoutes: RouteObject[] = [
  {
    path: 'admin',
    ErrorBoundary: AdminRootErrorBoundary,
    lazy: adminLayout,
    children: [
      {
        ErrorBoundary: AdminRouteErrorBoundary,
        lazy: /* @__PURE__ */ lazyRoute(async () => ({
          Component: (await import('@/lib/url-state/UrlStateLayout')).default,
        })),
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
