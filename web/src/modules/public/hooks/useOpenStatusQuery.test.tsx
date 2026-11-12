// useOpenStatusQuery (PUB-05, D-22): the server's open status, read again every five minutes while the page is visible and
// once when the tab comes back. The browser never decides open or closed.
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { server } from '@/test/msw';
import { openStatusAt0900, openStatusAt1800, openStatusFailureHandler } from '@/test/publicFixtures';
import { useOpenStatusQuery } from './useOpenStatusQuery';

const FIVE_MINUTES = 5 * 60 * 1000;

/** Counts the reads and answers each with the next fixture (the last one repeats). */
function countReads(answers: readonly (typeof openStatusAt0900)[]) {
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

function setVisibility(value: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
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

  it('reads again after five minutes while the page is visible', async () => {
    const state = countReads([openStatusAt0900, openStatusAt1800]);
    const { result } = renderHook(() => useOpenStatusQuery());
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES);
    });

    await waitFor(() => {
      expect(result.current).toEqual({ status: 'success', data: openStatusAt1800 });
    });
    expect(state.reads).toBe(2);
  });

  it('does not read while the page is hidden', async () => {
    const state = countReads([openStatusAt0900]);
    const { result } = renderHook(() => useOpenStatusQuery());
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    setVisibility('hidden');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES * 3);
    });

    expect(state.reads).toBe(1);
  });

  it('reads once more when the page becomes visible again', async () => {
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

  it('a failed read is an error, and the next five-minute read tries again', async () => {
    server.use(openStatusFailureHandler(404));
    const { result } = renderHook(() => useOpenStatusQuery());
    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    countReads([openStatusAt0900]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES);
    });

    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
  });

  it('stops the timer when the page goes away', async () => {
    const state = countReads([openStatusAt0900]);
    const { result, unmount } = renderHook(() => useOpenStatusQuery());
    await waitFor(() => {
      expect(result.current.status).toBe('success');
    });
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FIVE_MINUTES * 2);
    });

    expect(state.reads).toBe(1);
  });
});
