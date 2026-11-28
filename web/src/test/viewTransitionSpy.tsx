// Test helpers for the page fade (PERF-07). A test file mocks `react-router` with `withTransitionAttribute`, so each rendered
// Link shows the viewTransition prop it got as `data-view-transition="true|false"`, and calls `allowViewTransitions()` to
// stand in for a browser that has the API and a device that allows motion. `forgetViewTransitions()` undoes the API stand-in.
import type { ComponentProps } from 'react';
import { vi } from 'vitest';

type ReactRouter = typeof import('react-router');

/** react-router with Link wrapped to mark its anchor with the viewTransition value it received. */
export function withTransitionAttribute(actual: ReactRouter): ReactRouter {
  return {
    ...actual,
    Link: (props: ComponentProps<ReactRouter['Link']>) => (
      <actual.Link {...props} data-view-transition={String(props.viewTransition ?? false)} />
    ),
  };
}

/** A browser with document.startViewTransition and a device that does not ask for reduced motion. */
export function allowViewTransitions(): void {
  Object.defineProperty(document, 'startViewTransition', { configurable: true, value: vi.fn() });
  vi.spyOn(window, 'matchMedia').mockImplementation(
    (query) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }) as never,
  );
}

export function forgetViewTransitions(): void {
  Reflect.deleteProperty(document, 'startViewTransition');
}

/** The viewTransition values of the given anchors, as the wrapped Link marked them. */
export function transitionOf(links: readonly HTMLElement[]): (string | null)[] {
  return links.map((link) => link.getAttribute('data-view-transition'));
}
