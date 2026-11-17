// The app's data router (WEB-05, D-19, research Pattern 2): React Router 8 `createBrowserRouter` from `react-router`,
// rendered by `RouterProvider` from `react-router/dom` in main.tsx.
//   - The root route shows the minimal page root while the first route chunks load (its hydrate fallback, research
//     Pitfall 10) and catches what no inner boundary does (RootErrorBoundary).
//   - Pages are lazy route modules, so each lands in its own chunk. Every public path renders inside PublicLayout (header,
//     one main, footer): the four pages, the four legal pages, and NotFoundPage for any other path (PUB-01). A crash or a chunk that fails to
//     load in a page falls to RouteErrorBoundary inside the layout's main; a failure of the layout itself falls to
//     RootErrorBoundary, which brings its own page root and main. The Gallery route alone sits under the lazy UrlStateLayout
//     (the one NuqsAdapter, WEB-10), so no other public page loads nuqs.
//   - The admin branch (./admin/routes.tsx) ships in every build, behind sign-in (plan 04-25, D-20 reversed): its layout
//     route's loader boots the session or redirects to /admin/login. The dev-only branch (`devRoutes`: the unguarded
//     previews and the /dev showcase) exists only where the compile-time `__DEV_ROUTES__` switch is true:
//     development and the e2e and budget builds. The production build gets a literal false, so that branch and the
//     modules only it uses drop out of it. It comes first, so where both define a path the preview wins (Pitfall 11).
//   - Both branches sit under one lazy pathless route, QueryRoot, which provides the TanStack Query client. The library
//     loads with the admin chunks, so the public entry carries neither it nor any admin page code (PERF-02).
import { createBrowserRouter, type RouteObject } from 'react-router';
import { adminRoutes, devRoutes } from '@/modules/admin/routes';
import { RootErrorBoundary, RouteErrorBoundary } from './ErrorBoundary';
import { lazyRoute } from './lazyRoute';
import { ShellFallback } from './ShellFallback';

export { lazyRoute } from './lazyRoute';
export type { RouteModule } from './lazyRoute';

/** The pathless route that gives the admin and dev branches their query client; its chunk loads only for them. */
export const queryBranch = (children: RouteObject[]): RouteObject => ({
  lazy: lazyRoute(async () => ({ Component: (await import('./QueryRoot')).QueryRoot })),
  children,
});

const publicLayout = /* @__PURE__ */ lazyRoute(async () => ({
  Component: (await import('@/layouts/PublicLayout')).PublicLayout,
}));

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
        lazy: lazyRoute(async () => ({
          Component: (await import('@/modules/public/pages/PrivacyPolicyPage')).PrivacyPolicyPage,
        })),
      },
      {
        path: 'cookies',
        ErrorBoundary: RouteErrorBoundary,
        lazy: lazyRoute(async () => ({
          Component: (await import('@/modules/public/pages/CookiePolicyPage')).CookiePolicyPage,
        })),
      },
      {
        path: 'terms',
        ErrorBoundary: RouteErrorBoundary,
        lazy: lazyRoute(async () => ({
          Component: (await import('@/modules/public/pages/TermsPage')).TermsPage,
        })),
      },
      {
        path: 'accessibility',
        ErrorBoundary: RouteErrorBoundary,
        lazy: lazyRoute(async () => ({
          Component: (await import('@/modules/public/pages/AccessibilityPage')).AccessibilityPage,
        })),
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
      // Dev-only previews first (see the header), then the guarded admin routes every build has.
      queryBranch([...(__DEV_ROUTES__ ? devRoutes : []), ...adminRoutes]),
    ],
  },
];

export const router = createBrowserRouter(routes);
