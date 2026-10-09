// The app's data router (WEB-05, D-19, research Pattern 2): React Router 8 `createBrowserRouter` from `react-router`,
// rendered by `RouterProvider` from `react-router/dom` in main.tsx.
//   - The root route provides the query client (Root), shows the minimal page root while the first route chunks load
//     (its hydrate fallback, research Pitfall 10) and catches what no inner boundary does (RootErrorBoundary).
//   - The public layout and its pages are lazy route modules, so each lands in its own chunk. The layout's children
//     carry RouteErrorBoundary, so a page that crashes or whose chunk fails to load shows the error screen inside main.
//   - Phase 2 has one public page: every non-API path renders PublicPlaceholderPage (D-21). Plan 02-31 adds the admin
//     branch behind the compile-time `__DEV_ROUTES__` switch; without it, `/admin/*` also renders the placeholder,
//     which is what production builds do (D-20).
import type { ComponentType } from 'react';
import { createBrowserRouter, type RouteObject } from 'react-router';
import { RootErrorBoundary, RouteErrorBoundary } from './ErrorBoundary';
import { Root } from './Root';
import { ShellFallback } from './ShellFallback';

/** What a lazy route module gives the router. */
export interface RouteModule {
  Component: ComponentType;
}

/**
 * A lazy route loader whose failed chunk load (a network error, or a deploy that replaced the chunk) turns into a render
 * error of that route, so the nearest ErrorBoundary shows the error screen. React Router 8 keeps a route whose `lazy`
 * rejected marked as still loading, and then renders nothing below the root, not even the layout (plan 02-29).
 */
export function lazyRoute(load: () => Promise<RouteModule>): () => Promise<RouteModule> {
  return async () => {
    try {
      return await load();
    } catch (error: unknown) {
      return {
        Component: function FailedRouteModule(): never {
          throw error;
        },
      };
    }
  };
}

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
    ],
  },
];

export const router = createBrowserRouter(routes);
