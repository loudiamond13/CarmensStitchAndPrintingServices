// The app's data router (WEB-05, D-19, research Pattern 2): React Router 8 `createBrowserRouter` from `react-router`,
// rendered by `RouterProvider` from `react-router/dom` in main.tsx.
//   - The root route shows the minimal page root while the first route chunks load (its hydrate fallback, research
//     Pitfall 10) and catches what no inner boundary does (RootErrorBoundary).
//   - Pages are lazy route modules, so each lands in its own chunk. Every public path renders inside PublicLayout (header,
//     one main, footer): the four pages, the three legal pages, and NotFoundPage for any other path (PUB-01). A crash or a chunk that fails to
//     load in a page falls to RouteErrorBoundary inside the layout's main; a failure of the layout itself falls to
//     RootErrorBoundary, which brings its own page root and main. The Gallery route alone sits under the lazy UrlStateLayout
//     (the one NuqsAdapter, WEB-10), so no other public page loads nuqs.
//   - The admin table (modules/admin/routes.tsx, behind sign-in, plan 04-25, D-20 reversed) and the dev-only table
//     (modules/admin/devRoutes.tsx: the unguarded previews and the /dev showcase) load on the first navigation under
//     /admin or /dev (D-42), through `patchRoutesOnNavigation`, so the public entry holds neither route list. The dev
//     table exists only where the compile-time `__DEV_ROUTES__` switch is true: development and the e2e and budget
//     builds. The production build gets a literal false, so that table and the modules only it uses drop out of it.
//   - Both tables patch into one lazy pathless route, QueryRoot, which provides the TanStack Query client. The library
//     loads with the admin chunks, so the public entry carries neither it nor any admin page code (PERF-02).
import { createBrowserRouter, type PatchRoutesOnNavigationFunction, type RouteObject } from 'react-router';
import type { LegalPageKey } from '@/modules/public/legalPages';
import { AdminRootErrorBoundary, RootErrorBoundary, RouteErrorBoundary } from './ErrorBoundary';
import { lazyRoute } from './lazyRoute';
import { ShellFallback } from './ShellFallback';
import { guardViewTransitions } from './viewTransitionGuard';

export { lazyRoute } from './lazyRoute';
export type { RouteModule } from './lazyRoute';

/** The id of the pathless route that gives the admin and dev tables their query client; discovery patches into it. */
export const QUERY_ROUTE_ID = 'query';

/** The pathless route that gives the admin and dev branches their query client; its chunk loads only for them. */
export const queryBranch = (children: RouteObject[]): RouteObject => ({
  lazy: lazyRoute(async () => ({ Component: (await import('./QueryRoot')).QueryRoot })),
  children,
});

const publicLayout = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/layouts/PublicLayout')).PublicLayout,
}));

/** One import for the three legal routes keeps the entry chunk small (PERF-01); legalLoaders.ts holds the page imports. */
const legalPage = (key: LegalPageKey) =>
  lazyRoute(async () => ({ Component: await (await import('@/modules/public/legalLoaders')).loadLegalPage(key) }));

const urlStateLayout = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/lib/url-state/UrlStateLayout')).default,
}));

/** The public pages inside PublicLayout (UI-SPEC Layout Contract, Routes), each a lazy chunk with the in-layout error screen. */
export const publicRoutes: RouteObject[] = [
  {
    lazy: publicLayout,
    children: [
      {
        index: true,
        ErrorBoundary: RouteErrorBoundary,
        lazy: lazyRoute(async () => ({ Component: (await import('@/modules/public/pages/HomePage')).HomePage })),
      },
      {
        path: 'products',
        ErrorBoundary: RouteErrorBoundary,
        lazy: lazyRoute(async () => ({
          Component: (await import('@/modules/public/pages/ProductsPage')).ProductsPage,
        })),
      },
      {
        lazy: urlStateLayout,
        ErrorBoundary: RouteErrorBoundary,
        children: [
          {
            path: 'gallery',
            ErrorBoundary: RouteErrorBoundary,
            lazy: lazyRoute(async () => ({
              Component: (await import('@/modules/public/pages/GalleryPage')).GalleryPage,
            })),
          },
        ],
      },
      {
        path: 'contact',
        ErrorBoundary: RouteErrorBoundary,
        lazy: lazyRoute(async () => ({
          Component: (await import('@/modules/public/pages/ContactPage')).ContactPage,
        })),
      },
      {
        path: 'privacy',
        ErrorBoundary: RouteErrorBoundary,
        lazy: legalPage('privacy'),
      },
      {
        path: 'terms',
        ErrorBoundary: RouteErrorBoundary,
        lazy: legalPage('terms'),
      },
      {
        path: 'accessibility',
        ErrorBoundary: RouteErrorBoundary,
        lazy: legalPage('accessibility'),
      },
      {
        path: '*',
        ErrorBoundary: RouteErrorBoundary,
        lazy: lazyRoute(async () => ({
          Component: (await import('@/modules/public/pages/NotFoundPage')).NotFoundPage,
        })),
      },
    ],
  },
];

export const routes: RouteObject[] = [
  {
    HydrateFallback: ShellFallback,
    ErrorBoundary: RootErrorBoundary,
    children: [
      ...publicRoutes,
      // Empty until discovery patches the admin or dev table in (see the header).
      { id: QUERY_ROUTE_ID, ...queryBranch([]) },
    ],
  },
];

/** A route table the router loads on the first navigation whose first path segment is `segment` (D-42). */
export interface RouteTable {
  readonly segment: string;
  readonly load: () => Promise<RouteObject[]>;
}

/** Stands in for a table whose chunk failed to load (a stale tab after a deploy): the admin error screen, as lazyRoute gives. */
function failedTable(segment: string, error: unknown): RouteObject {
  return {
    path: `${segment}/*`,
    ErrorBoundary: AdminRootErrorBoundary,
    Component: function FailedRouteTable(): never {
      throw error;
    },
  };
}

/**
 * Loads a table on the first navigation under its segment and patches it into the query route (D-42). A path under no
 * segment, or one whose matches already sit in the query route (the table is loaded), loads nothing.
 */
export function routeDiscovery(tables: readonly RouteTable[]): PatchRoutesOnNavigationFunction {
  return async ({ path, matches, patch }) => {
    const segment = path
      .split('/')
      .find((part) => part !== '')
      ?.toLowerCase();
    const table = tables.find((candidate) => candidate.segment === segment);
    if (table === undefined || matches.some((match) => match.route.id === QUERY_ROUTE_ID)) {
      return;
    }
    let children: RouteObject[];
    try {
      children = await table.load();
    } catch (error: unknown) {
      patch(null, [failedTable(table.segment, error)]);
      return;
    }
    patch(QUERY_ROUTE_ID, children);
  };
}

/** The app's tables: the admin routes in every build, the dev previews only where `__DEV_ROUTES__` is true (D-20). */
export const discoverRoutes: PatchRoutesOnNavigationFunction = /* @__PURE__ */ routeDiscovery([
  { segment: 'admin', load: async () => (await import('@/modules/admin/routes')).adminRoutes },
  ...(__DEV_ROUTES__
    ? [{ segment: 'dev', load: async () => (await import('@/modules/admin/devRoutes')).devRoutes }]
    : []),
]);

export const router = createBrowserRouter(routes, { patchRoutesOnNavigation: discoverRoutes });
guardViewTransitions(router);
