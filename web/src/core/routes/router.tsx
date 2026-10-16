// The app's data router (WEB-05, D-19, research Pattern 2): React Router 8 `createBrowserRouter` from `react-router`,
// rendered by `RouterProvider` from `react-router/dom` in main.tsx.
//   - The root route provides the query client (Root), shows the minimal page root while the first route chunks load
//     (its hydrate fallback, research Pitfall 10) and catches what no inner boundary does (RootErrorBoundary).
//   - The public layout and its pages are lazy route modules, so each lands in its own chunk. The layout's children
//     carry RouteErrorBoundary, so a page that crashes or whose chunk fails to load shows the error screen inside main.
//   - Phase 2 has one public page: every non-API path renders PublicPlaceholderPage (D-21).
//   - The admin branch (./admin/routes.tsx) ships in every build, behind sign-in (plan 04-25, D-20 reversed): its layout
//     route's loader boots the session or redirects to /admin/login. The dev-only branch (`devRoutes`: the unguarded
//     section previews and the /dev showcase) exists only where the compile-time `__DEV_ROUTES__` switch is true:
//     development and the e2e and budget builds. The production build gets a literal false, so that branch and the
//     modules only it uses drop out of it. It comes first, so where both define a path the preview wins (Pitfall 11).
import { createBrowserRouter, type RouteObject } from 'react-router';
import { adminRoutes, devRoutes } from '@/modules/admin/routes';
import { RootErrorBoundary, RouteErrorBoundary } from './ErrorBoundary';
import { lazyRoute } from './lazyRoute';
import { Root } from './Root';
import { ShellFallback } from './ShellFallback';

export { lazyRoute } from './lazyRoute';
export type { RouteModule } from './lazyRoute';

export const routes: RouteObject[] = [
  {
    Component: Root,
    HydrateFallback: ShellFallback,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        lazy: lazyRoute(async () => ({ Component: (await import('@/layouts/PublicLayout')).PublicLayout })),
        children: [
          {
            path: '*',
            ErrorBoundary: RouteErrorBoundary,
            lazy: lazyRoute(async () => ({
              Component: (await import('@/modules/public/pages/PublicPlaceholderPage')).PublicPlaceholderPage,
            })),
          },
        ],
      },
      // Dev-only previews first (see the header), then the guarded admin routes every build has.
      ...(__DEV_ROUTES__ ? devRoutes : []),
      ...adminRoutes,
    ],
  },
];

export const router = createBrowserRouter(routes);
