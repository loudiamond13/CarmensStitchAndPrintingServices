// The app's data router (WEB-05, D-19, research Pattern 2): React Router 8 `createBrowserRouter` from `react-router`,
// rendered by `RouterProvider` from `react-router/dom` in main.tsx.
//   - The root route provides the query client (Root), shows the minimal page root while the first route chunks load
//     (HydrateFallback, research Pitfall 10) and catches what no inner boundary does (RootErrorBoundary).
//   - The public layout and its pages are lazy route modules, so each lands in its own chunk.
//   - Phase 2 has one public page: every non-API path renders PublicPlaceholderPage (D-21). Plan 02-31 adds the admin
//     branch behind the compile-time `__DEV_ROUTES__` switch; without it, `/admin/*` also renders the placeholder,
//     which is what production builds do (D-20).
import { createBrowserRouter, type RouteObject } from 'react-router';
import { Root } from './Root';
import { ShellFallback } from './ShellFallback';

export const routes: RouteObject[] = [
  {
    Component: Root,
    HydrateFallback: ShellFallback,
    children: [
      {
        lazy: async () => ({ Component: (await import('./public/PublicLayout')).PublicLayout }),
        children: [
          {
            path: '*',
            lazy: async () => ({ Component: (await import('./public/PublicPlaceholderPage')).PublicPlaceholderPage }),
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
