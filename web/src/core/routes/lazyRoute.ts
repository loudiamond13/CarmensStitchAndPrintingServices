// The one way to give a route a lazy module (plan 02-29). Its own module, so the route trees in router.tsx and
// admin/routes.tsx both import it without importing each other.
import type { ComponentType } from 'react';

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
