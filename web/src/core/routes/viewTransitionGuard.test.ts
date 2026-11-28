import { afterEach, describe, expect, it, vi } from 'vitest';
import { guardViewTransitions } from './viewTransitionGuard';

// The guard keeps page fades to forward link clicks with motion allowed (PERF-07, 14 D-48): Back and Forward and reduced
// motion get an instant page change, and a skipped real transition raises no page error.

type Listener = (state: { historyAction: string }) => void;

/** A router whose single subscriber can be told a navigation of the given kind happened. */
function fakeRouter() {
  const listeners = new Set<Listener>();
  return {
    subscribe: (listener: Listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    navigate: (historyAction: string) => {
      for (const listener of listeners) {
        listener({ historyAction });
      }
    },
    listeners,
  };
}

function setup({ reduce = false, api = true } = {}) {
  const real = vi.fn((update?: () => unknown) => {
    const done = Promise.resolve().then(update);
    return { finished: done, ready: done, updateCallbackDone: done, skipTransition: vi.fn() };
  });
  const doc = (api ? { startViewTransition: real } : {}) as unknown as Document;
  const win = { matchMedia: (query: string) => ({ matches: reduce, media: query }) } as unknown as Window;
  const router = fakeRouter();
  guardViewTransitions(router, doc, win);
  return { real, doc, router };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('guardViewTransitions', () => {
  it('does nothing in a browser with no View Transitions API', () => {
    const { doc, router } = setup({ api: false });

    expect('startViewTransition' in doc).toBe(false);
    expect(router.listeners.size).toBe(0);
  });

  it('lets a forward click start a real transition when motion is allowed', async () => {
    const { real, doc, router } = setup();
    router.navigate('PUSH');
    const update = vi.fn<() => void>();

    const transition = doc.startViewTransition(update);
    await transition.finished;

    expect(real).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });

  it.each(['POP', 'PUSH'])(
    'makes a %s change instant under reduced motion: the update runs, no real transition',
    async (action) => {
      const { real, doc, router } = setup({ reduce: true });
      router.navigate(action);
      const update = vi.fn<() => void>();

      const transition = doc.startViewTransition(update);
      await transition.finished;

      expect(real).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledTimes(1);
    },
  );

  it('makes Back and Forward instant even when motion is allowed', async () => {
    const { real, doc, router } = setup();
    router.navigate('POP');
    const update = vi.fn<() => void>();

    const transition = doc.startViewTransition(update);
    await Promise.all([transition.finished, transition.ready, transition.updateCallbackDone]);

    expect(real).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledTimes(1);
    expect(() => {
      transition.skipTransition();
    }).not.toThrow();
  });

  it('goes back to real transitions after a forward click that follows a history move', () => {
    const { real, doc, router } = setup();
    router.navigate('POP');
    router.navigate('PUSH');

    doc.startViewTransition(vi.fn<() => void>());

    expect(real).toHaveBeenCalledTimes(1);
  });

  it('waits for an async update before the instant transition finishes', async () => {
    const { doc, router } = setup();
    router.navigate('POP');
    const steps: string[] = [];

    const transition = doc.startViewTransition(async () => {
      await Promise.resolve();
      steps.push('rendered');
    });
    await transition.finished;
    steps.push('finished');

    expect(steps).toEqual(['rendered', 'finished']);
  });

  it('swallows the rejection of ready when a real transition is skipped (no page error)', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    const { real, doc, router } = setup();
    real.mockImplementation(() => {
      const done = Promise.resolve();
      return {
        finished: done,
        ready: Promise.reject(new DOMException('Transition was skipped', 'AbortError')),
        updateCallbackDone: done,
        skipTransition: vi.fn(),
      };
    });
    router.navigate('PUSH');

    doc.startViewTransition(vi.fn<() => void>());
    await new Promise((resolve) => setTimeout(resolve, 20));
    process.off('unhandledRejection', unhandled);

    expect(unhandled).not.toHaveBeenCalled();
  });
});
