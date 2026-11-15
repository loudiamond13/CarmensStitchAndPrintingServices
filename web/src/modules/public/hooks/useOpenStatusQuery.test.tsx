// useOpenStatusQuery (PUB-05, D-22): the server's open status, read again every five minutes while the page is visible and
// once when the tab comes back. The browser never decides open or closed.
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw';
import {
  openStatusAt0900,
  openStatusAt1800,
  openStatusFailureHandler,
  type OpenStatusFixture,
} from '@/test/publicFixtures';
import { OPEN_STATUS_REFRESH_MS, useOpenStatusQuery } from './useOpenStatusQuery';

/** Counts the reads and answers each with the next fixture (the last one repeats). */
function countReads(answers: readonly OpenStatusFixture[]) {
  const state = { reads: 0 };
  server.use(
    http.get('*/api/v1/public/open-status', () => {
      const answer = answers[Math.min(state.reads, answers.length - 1)];
      state.reads += 1;
      return HttpResponse.json(answer);
    }),
  );
  return state;
}

/**
 * Catches the hook's five-minute timer and lets a test fire it by hand. Any other timer (the test library's own polling)
 * runs for real, so waiting for an answer still works.
 */
function catchRefreshTimer() {
  const realSet = globalThis.setInterval.bind(globalThis);
  const realClear = globalThis.clearInterval.bind(globalThis);
  const caught = new Map<number, () => void>();
  let next = 1_000_000;
  vi.spyOn(globalThis, 'setInterval').mockImplementation(((handler: () => void, delay?: number) => {
    if (delay !== OPEN_STATUS_REFRESH_MS) {
      return realSet(handler, delay);
    }
    next += 1;
    caught.set(next, handler);
    return next;
  }) as unknown as typeof setInterval);
  vi.spyOn(globalThis, 'clearInterval').mockImplementation(((id?: number) => {
    if (id !== undefined && caught.delete(id)) {
      return;
    }
    realClear(id);
  }) as typeof clearInterval);
  return {
    running: () => caught.size,
    fire: () => {
      act(() => {
        for (const handler of caught.values()) {
          handler();
        }
      });
    },
  };
}

function setVisibility(value: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
}

afterEach(() => {
  vi.restoreAllMocks();
  setVisibility('visible');
});

describe('useOpenStatusQuery', () => {
  it('loads GET /api/v1/public/open-status and shares the answer', async () => {
    const state = countReads([openStatusAt0900]);

    const { result } = renderHook(() => useOpenStatusQuery());

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: openStatusAt0900 });
    });
    expect(state.reads).toBe(1);
  });

  it('reads again at each five-minute tick while the page is visible', async () => {
    const timer = catchRefreshTimer();
    const state = countReads([openStatusAt0900, openStatusAt1800]);
    const { result } = renderHook(() => useOpenStatusQuery());
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    expect(timer.running()).toBe(1);

    timer.fire();

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: openStatusAt1800 });
    });
    expect(state.reads).toBe(2);
  });

  it('does not read at a tick while the page is hidden', async () => {
    const timer = catchRefreshTimer();
    const state = countReads([openStatusAt0900]);
    const { result } = renderHook(() => useOpenStatusQuery());
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    setVisibility('hidden');

    timer.fire();
    timer.fire();

    expect(state.reads).toBe(1);
  });

  it('reads once more when the page becomes visible again, and not when it is hidden', async () => {
    catchRefreshTimer();
    const state = countReads([openStatusAt0900, openStatusAt1800]);
    const { result } = renderHook(() => useOpenStatusQuery());
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    setVisibility('hidden');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(state.reads).toBe(1);

    setVisibility('visible');
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: openStatusAt1800 });
    });
    expect(state.reads).toBe(2);
  });

  it('a failed read is an error, and the next tick tries again', async () => {
    const timer = catchRefreshTimer();
    server.use(openStatusFailureHandler(404));
    const { result } = renderHook(() => useOpenStatusQuery());
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    countReads([openStatusAt0900]);

    timer.fire();

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
  });

  it('stops the timer and the listener when the page goes away', async () => {
    const timer = catchRefreshTimer();
    const state = countReads([openStatusAt0900]);
    const { result, unmount } = renderHook(() => useOpenStatusQuery());
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    unmount();

    expect(timer.running()).toBe(0);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(state.reads).toBe(1);
  });
});
