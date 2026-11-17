// The dev-only route table (D-20, D-42). The router imports this module only where the compile-time `__DEV_ROUTES__`
// switch is true (development and the e2e and budget builds) and loads it on the first navigation under /dev.
//   - /dev/components is the Component Showcase inside the AdminLayout with a placeholder user (Pitfall 11).
//   - /dev/public is the real PublicLayout around a column of fields for the e2e focus checks.
// It holds no /admin entry, so no build shows a fake signed-in user at the dashboard (T-10-10). Nothing here ships.
// The loaders carry `@__PURE__` marks like the admin table's, so an unused table drops out whole.
import type { LoaderFunction, RouteObject } from 'react-router';
import { AdminRootErrorBoundary, AdminRouteErrorBoundary } from '@/core/routes/ErrorBoundary';
import { lazyRoute } from '@/core/routes/lazyRoute';

/** The placeholder user of the dev routes, loaded on demand so no admin navigation code joins the public entry. */
const devUser: LoaderFunction = async () => (await import('@/modules/admin/sections')).DEV_USER;

const publicLayout = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/layouts/PublicLayout')).PublicLayout,
}));

const publicCheckPage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/public/pages/PublicLayoutCheckPage')).PublicLayoutCheckPage,
}));

const adminLayout = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/layouts/AdminLayout')).default,
}));

const showcasePage = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/modules/admin/pages/ComponentShowcasePage')).ComponentShowcaseRoute,
}));

export const devRoutes: RouteObject[] = [
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
