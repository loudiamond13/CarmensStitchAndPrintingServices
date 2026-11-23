import { focusManager, QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from '@/lib/query/queryClient';
import {
  NEW_QUOTE_COUNT_KEY,
  NEW_QUOTE_COUNT_REFRESH_MS,
  shownNewQuoteCount,
  useNewQuoteCountQuery,
} from '@/modules/admin/hooks/useNewQuoteCountQuery';
import { server } from '@/test/msw';
import { quoteProblem } from '@/test/quoteRequestFixtures';

// The shared New count (D-14, INQ-05; UI-SPEC R4): read from the server, again on focus and every 60 seconds while visible.

let queryClient: QueryClient;

beforeEach(() => {
  queryClient = createQueryClient();
});

afterEach(() => {
  queryClient.clear();
  focusManager.setFocused(undefined);
  vi.useRealTimers();
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

/** Answers GET /quote-requests/new-count with each result in turn (the last one repeats) and counts the reads. */
function countBackend(...results: (number | string | Response)[]): { reads: number } {
  const backend = { reads: 0 };
  server.use(
    http.get('*/api/v1/quote-requests/new-count', () => {
      const result = results[Math.min(backend.reads, results.length - 1)];
      backend.reads += 1;
      return result instanceof Response ? result : HttpResponse.json({ count: result ?? 0 });
    }),
  );
  return backend;
}

describe('useNewQuoteCountQuery', () => {
  it('is keyed under the quote-requests root, so one invalidation reaches the list and the count', () => {
    expect(NEW_QUOTE_COUNT_KEY).toEqual(['quote-requests', 'new-count']);
  });

  it('reads GET /quote-requests/new-count and gives the count as a number', async () => {
    countBackend('3');
    const { result } = renderHook(() => useNewQuoteCountQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBe(3);
    });
    expect(shownNewQuoteCount(result.current)).toBe(3);
  });

  it('gives no count when the read fails, never a made-up number', async () => {
    countBackend(quoteProblem(500));
    const { result } = renderHook(() => useNewQuoteCountQuery(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(shownNewQuoteCount(result.current)).toBeUndefined();
  });

  it('drops the last good count when a later read fails (no stale number)', async () => {
    countBackend(2, quoteProblem(500));
    const { result } = renderHook(() => useNewQuoteCountQuery(), { wrapper });
    // Read as the shell reads it (data and isError), so the hook re-renders on either change.
    await waitFor(() => {
      expect(shownNewQuoteCount(result.current)).toBe(2);
    });

    await act(async () => {
      await result.current.refetch();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBe(2);
    expect(shownNewQuoteCount(result.current)).toBeUndefined();
  });

  it('asks nothing while it is not enabled (a dev page with no session)', async () => {
    const backend = countBackend(4);
    const { result } = renderHook(() => useNewQuoteCountQuery({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(backend.reads).toBe(0);
    expect(shownNewQuoteCount(result.current)).toBeUndefined();
  });

  it('reads again every 60 seconds and when the window regains focus', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const backend = countBackend(1, 2, 3);
    const { result } = renderHook(() => useNewQuoteCountQuery(), { wrapper });
    await waitFor(() => {
      expect(result.current.data).toBe(1);
    });

    expect(NEW_QUOTE_COUNT_REFRESH_MS).toBe(60_000);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(NEW_QUOTE_COUNT_REFRESH_MS);
    });
    await waitFor(() => {
      expect(result.current.data).toBe(2);
    });

    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => {
      expect(result.current.data).toBe(3);
    });
    expect(backend.reads).toBe(3);
  });

  it('keeps reading after a failed read, so the chip comes back when the server answers', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    countBackend(quoteProblem(500), 5);
    const { result } = renderHook(() => useNewQuoteCountQuery(), { wrapper });
    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(NEW_QUOTE_COUNT_REFRESH_MS);
    });

    await waitFor(() => {
      expect(shownNewQuoteCount(result.current)).toBe(5);
    });
  });
});
