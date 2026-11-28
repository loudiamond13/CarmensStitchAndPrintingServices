// Follows the device's reduced-motion setting and tells whether the browser has View Transitions (PERF-07, 14 D-33).
// One module-level store holds a single `change` listener on the media query for every subscriber, so a change of the
// device setting reaches every link at once. It reads false where there is no matchMedia (jsdom, old browsers).
import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

const subscribers = new Set<() => void>();
let list: MediaQueryList | null = null;

function notify(): void {
  for (const onChange of subscribers) {
    onChange();
  }
}

function subscribe(onChange: () => void): () => void {
  if (subscribers.size === 0 && typeof window.matchMedia === 'function') {
    list = window.matchMedia(QUERY);
    list.addEventListener('change', notify);
  }
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
    if (subscribers.size === 0 && list !== null) {
      list.removeEventListener('change', notify);
      list = null;
    }
  };
}

function getSnapshot(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(QUERY).matches;
}

/** True when the device asks for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/**
 * True in a Chromium-engine browser that has `document.startViewTransition`. `navigator.userAgentData` exists only there,
 * so Safari, iPhone and Firefox get no page fade (14 D-48: WebKit stalls a page change under a fade).
 */
export function canStartViewTransition(): boolean {
  return typeof document.startViewTransition === 'function' && 'userAgentData' in navigator;
}
