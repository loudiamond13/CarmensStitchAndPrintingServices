import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { keys } from './keys';
import { prefetchOnIntent } from './prefetchOnIntent';
import { createQueryClient } from './queryClient';

function orderOptions() {
  return { queryKey: keys.detail('orders', 42), queryFn: () => Promise.resolve({ id: 42 }) };
}

describe('prefetchOnIntent', () => {
  // queryClient.query is TanStack 5.103's replacement for the deprecated prefetchQuery (same fetch-if-stale call);
  // the handlers swallow its errors exactly as prefetchQuery did.
  it('prefetches the target query on pointer enter and on focus', () => {
    const client = createQueryClient();
    const prefetch = vi.spyOn(client, 'query').mockResolvedValue(undefined);
    const options = orderOptions();
    const handlers = prefetchOnIntent(client, options);

    handlers.onPointerEnter();
    expect(prefetch).toHaveBeenCalledTimes(1);
    expect(prefetch).toHaveBeenLastCalledWith(options);

    handlers.onFocus();
    expect(prefetch).toHaveBeenCalledTimes(2);
    expect(prefetch).toHaveBeenLastCalledWith(options);
  });

  it('fills the cache, so opening the target needs no new request while it is fresh', async () => {
    const client = createQueryClient();
    const queryFn = vi.fn(() => Promise.resolve({ id: 42 }));
    const handlers = prefetchOnIntent(client, { queryKey: keys.detail('orders', 42), queryFn });

    handlers.onPointerEnter();
    await vi.waitFor(() => {
      expect(client.getQueryData(keys.detail('orders', 42))).toEqual({ id: 42 });
    });
    handlers.onFocus();
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('adds only the two event handlers: the element keeps its markup', () => {
    const client = createQueryClient();
    const prefetch = vi.spyOn(client, 'query').mockResolvedValue(undefined);
    const handlers = prefetchOnIntent(client, orderOptions());
    expect(Object.keys(handlers).sort()).toEqual(['onFocus', 'onPointerEnter']);

    const { container } = render(
      <a href="/admin/orders/42" {...handlers}>
        Order 42
      </a>,
    );
    expect(container.innerHTML).toBe('<a href="/admin/orders/42">Order 42</a>');

    fireEvent.pointerEnter(screen.getByRole('link', { name: 'Order 42' }));
    fireEvent.focus(screen.getByRole('link', { name: 'Order 42' }));
    expect(prefetch).toHaveBeenCalledTimes(2);
  });

  it('swallows a failed prefetch: the error stays in the cache for the real screen to show', async () => {
    const client = createQueryClient();
    const failure = new Error('offline');
    const handlers = prefetchOnIntent(client, {
      queryKey: keys.detail('orders', 7),
      queryFn: () => Promise.reject(failure),
    });

    expect(() => {
      handlers.onFocus();
    }).not.toThrow();
    await vi.waitFor(() => {
      expect(client.getQueryState(keys.detail('orders', 7))?.error).toBe(failure);
    });
  });
});
