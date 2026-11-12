// The public route shape (root > PublicLayout > page), for the layout and boundary tests. The page is the 404 page, which
// every path reaches through the splat; the boundaries are the real ones.
import type { RouteObject } from 'react-router';
import { RootErrorBoundary, RouteErrorBoundary } from '@/core/routes/ErrorBoundary';
import { lazyRoute } from '@/core/routes/lazyRoute';
import { ShellFallback } from '@/core/routes/ShellFallback';

export const publicLayoutRoutes: RouteObject[] = [
  {
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
              Component: (await import('@/modules/public/pages/NotFoundPage')).NotFoundPage,
            })),
          },
        ],
      },
    ],
  },
];
