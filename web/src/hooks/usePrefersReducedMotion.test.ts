import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canStartViewTransition, usePrefersReducedMotion } from './usePrefersReducedMotion';

// usePrefersReducedMotion follows the reduced-motion media query through one shared subscription (PERF-07);
// canStartViewTransition says whether the browser has the View Transitions API.

const original = Object.getOwnPropertyDescriptor(window, 'matchMedia');

interface FakeQuery {
  matches: boolean;
  listeners: Set<() => void>;
  add: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
}

/** Installs a fake matchMedia whose single query list can be flipped and told to fire `change`. */
function fakeMatchMedia(matches: boolean): { query: FakeQuery; flip: (next: boolean) => void } {
  const query: FakeQuery = {
    matches,
    listeners: new Set(),
    add: vi.fn((_type: string, listener: () => void) => query.listeners.add(listener)),
    remove: vi.fn((_type: string, listener: () => void) => query.listeners.delete(listener)),
  };
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (media: string) => ({
      get matches() {
        return query.matches;
      },
      media,
      addEventListener: query.add,
      removeEventListener: query.remove,
    }),
  });
  return {
    query,
    flip: (next) => {
      query.matches = next;
      for (const listener of [...query.listeners]) {
        listener();
      }
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  if (original !== undefined) {
    Object.defineProperty(window, 'matchMedia', original);
  }
  Reflect.deleteProperty(document, 'startViewTransition');
  Reflect.deleteProperty(navigator, 'userAgentData');
});

describe('usePrefersReducedMotion', () => {
  it('is false when the device allows motion', () => {
    fakeMatchMedia(false);

    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });

  it('is true when the device asks for reduced motion', () => {
    fakeMatchMedia(true);

    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(true);
  });

  it('is false when the browser has no matchMedia', () => {
    Reflect.deleteProperty(window, 'matchMedia');

    expect(renderHook(() => usePrefersReducedMotion()).result.current).toBe(false);
  });

  it('follows a change of the device setting without a reload', () => {
    const { flip } = fakeMatchMedia(false);
    const { result } = renderHook(() => usePrefersReducedMotion());
    expect(result.current).toBe(false);

    act(() => {
      flip(true);
    });
    expect(result.current).toBe(true);

    act(() => {
      flip(false);
    });
    expect(result.current).toBe(false);
  });

  it('shares one listener between hooks and removes it when the last one unmounts', () => {
    const { query } = fakeMatchMedia(false);
    const first = renderHook(() => usePrefersReducedMotion());
    const second = renderHook(() => usePrefersReducedMotion());

    expect(query.add).toHaveBeenCalledTimes(1);

    first.unmount();
    expect(query.remove).not.toHaveBeenCalled();
    second.unmount();
    expect(query.remove).toHaveBeenCalledTimes(1);
    expect(query.listeners.size).toBe(0);
  });
});

describe('canStartViewTransition', () => {
  it('is false when document.startViewTransition is not a function (jsdom, older browsers)', () => {
    expect(canStartViewTransition()).toBe(false);
  });

  it('is true when a Chromium-engine browser has document.startViewTransition', () => {
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: vi.fn() });
    Object.defineProperty(navigator, 'userAgentData', { configurable: true, value: {} });

    expect(canStartViewTransition()).toBe(true);
  });

  it('is false in a browser that has the API but is not Chromium-engine (Safari, iPhone; 14 D-48)', () => {
    Object.defineProperty(document, 'startViewTransition', { configurable: true, value: vi.fn() });

    expect(canStartViewTransition()).toBe(false);
  });
});
