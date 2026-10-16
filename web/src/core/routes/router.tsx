// The app's data router (WEB-05, D-19, research Pattern 2): React Router 8 `createBrowserRouter` from `react-router`,
// rendered by `RouterProvider` from `react-router/dom` in main.tsx.
//   - The root route shows the minimal page root while the first route chunks load (its hydrate fallback, research
//     Pitfall 10) and catches what no inner boundary does (RootErrorBoundary).
//   - Pages are lazy route modules, so each lands in its own chunk. The holding page has no layout around it, so a
//     crash or a chunk that fails to load falls to RootErrorBoundary, which brings its own page root and main.
//   - Phase 3: every non-admin path renders the D-17 HoldingPage; PublicLayout returns with Phase 11.
//   - The admin branch (./admin/routes.tsx) ships in every build, behind sign-in (plan 04-25, D-20 reversed): its layout
//     route's loader boots the session or redirects to /admin/login. The dev-only branch (`devRoutes`: the unguarded
//     section previews and the /dev showcase) exists only where the compile-time `__DEV_ROUTES__` switch is true:
//     development and the e2e and budget builds. The production build gets a literal false, so that branch and the
//     modules only it uses drop out of it. It comes first, so where both define a path the preview wins (Pitfall 11).
//   - Both branches sit under one lazy pathless route, QueryRoot, which provides the TanStack Query client. The library
//     loads with the admin chunks, so the public entry carries neither it nor any admin page code (PERF-02).
import { createBrowserRouter, type RouteObject } from 'react-router';
import { adminRoutes, devRoutes } from '@/modules/admin/routes';
import { RootErrorBoundary } from './ErrorBoundary';
import { lazyRoute } from './lazyRoute';
import { ShellFallback } from './ShellFallback';

export { lazyRoute } from './lazyRoute';
export type { RouteModule } from './lazyRoute';

/** The pathless route that gives the admin and dev branches their query client; its chunk loads only for them. */
export const queryBranch = (children: RouteObject[]): RouteObject => ({
  lazy: lazyRoute(async () => ({ Component: (await import('./QueryRoot')).QueryRoot })),
  children,
});

export const routes: RouteObject[] = [
  {
    HydrateFallback: ShellFallback,
    ErrorBoundary: RootErrorBoundary,
    children: [
      {
        path: '*',
        lazy: lazyRoute(async () => ({
          Component: (await import('@/modules/public/pages/HoldingPage')).HoldingPage,
        })),
      },
      // Dev-only previews first (see the header), then the guarded admin routes every build has.
      queryBranch([...(__DEV_ROUTES__ ? devRoutes : []), ...adminRoutes]),
    ],
  },
];

export const router = createBrowserRouter(routes);
