// The root route's HydrateFallback (research Pitfall 10): while the first route chunks load, the visitor sees the empty
// Blush page root, the same background the page then paints on, so nothing flashes or shifts. Giving the root route a
// HydrateFallback also keeps React Router's "No HydrateFallback element provided" warning out of the console.
import { pageRootClasses } from '@/ui/layout/layout.recipe';

export function ShellFallback() {
  return <div data-theme="light" className={pageRootClasses} />;
}
