// The app's data router (WEB-05, D-19, research Pattern 2): React Router 8 `createBrowserRouter` from `react-router`,
// rendered by `RouterProvider` from `react-router/dom` in main.tsx.
//   - The root route provides the query client (Root), shows the minimal page root while the first route chunks load
//     (its hydrate fallback, research Pitfall 10) and catches what no inner boundary does (RootErrorBoundary).
//   - The public layout and its pages are lazy route modules, so each lands in its own chunk. The layout's children
//     carry RouteErrorBoundary, so a page that crashes or whose chunk fails to load shows the error screen inside main.
//   - Phase 2 has one public page: every non-API path renders PublicPlaceholderPage (D-21).
//   - The admin branch (plan 02-31, ./admin/routes.tsx) exists only where the compile-time `__DEV_ROUTES__` switch is
//     true: development and the e2e and budget builds. D-20: the production build gets a literal false, so the branch
//     and every admin module drop out of it, nothing unprotected is deployed before Phase 4 adds sign-in, and
//     `/admin/*` there falls through to the public placeholder.
import { createBrowserRouter, type RouteObject } from 'react-router';
import { adminRoutes } from './admin/routes';
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
        lazy: lazyRoute(async () => ({ Component: (await import('./public/PublicLayout')).PublicLayout })),
        children: [
          {
            path: '*',
            ErrorBoundary: RouteErrorBoundary,
            lazy: lazyRoute(async () => ({
              Component: (await import('./public/PublicPlaceholderPage')).PublicPlaceholderPage,
            })),
          },
        ],
      },
      // D-20: dev-only admin routes; a production build has none (see the header).
      ...(__DEV_ROUTES__ ? adminRoutes : []),
    ],
  },
];

export const router = createBrowserRouter(routes);
