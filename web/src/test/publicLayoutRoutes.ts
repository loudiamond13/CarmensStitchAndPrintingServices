// The Phase 11 public route shape (Root > PublicLayout > page), kept for the layout and boundary tests while the app's
// public route is the standalone D-17 HoldingPage. The page is the Phase 2 placeholder; the boundaries are the real ones.
import type { RouteObject } from 'react-router';
import { RootErrorBoundary, RouteErrorBoundary } from '@/core/routes/ErrorBoundary';
import { lazyRoute } from '@/core/routes/lazyRoute';
import { Root } from '@/core/routes/Root';
import { ShellFallback } from '@/core/routes/ShellFallback';

export const publicLayoutRoutes: RouteObject[] = [
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
    ],
  },
];
