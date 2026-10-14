import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { listKey } from './keys';
import { INTENT_DELAY_MS, prefetchOnIntent } from './prefetchOnIntent';
import { createQueryClient } from './queryClient';

const orderKey = listKey('orders', { page: 2, pageSize: 20 });

function orderOptions() {
  return { queryKey: orderKey, queryFn: () => Promise.resolve({ rows: ['CSPS-0042'] }) };
}

function renderLink(handlers: ReturnType<typeof prefetchOnIntent>) {
  render(
    <a href="/admin/orders?page=2" {...handlers}>
      Next page
    </a>,
  );
  return screen.getByRole('link', { name: 'Next page' });
}

// The intent timer is asserted on fake timers with fireEvent only (never user-event, which hangs on fake timers,
// L-24), so a slow machine cannot turn a 50 ms hover into a 100 ms one.
describe('prefetchOnIntent intent timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits 100 ms of intent', () => {
    expect(INTENT_DELAY_MS).toBe(100);
  });

  it('prefetches once when focus is held for 100 ms', () => {
    const client = createQueryClient();
    const query = vi.spyOn(client, 'query').mockResolvedValue(undefined);
    const options = orderOptions();
    const link = renderLink(prefetchOnIntent(client, options));

    fireEvent.focus(link);
    vi.advanceTimersByTime(99);
    expect(query).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(options);
  });

  it('prefetches once when a mouse pointer rests on the link for 100 ms', () => {
    const client = createQueryClient();
    const query = vi.spyOn(client, 'query').mockResolvedValue(undefined);
    const link = renderLink(prefetchOnIntent(client, orderOptions()));

    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    vi.advanceTimersByTime(100);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('does not prefetch when the pointer leaves after 50 ms', () => {
    const client = createQueryClient();
    const query = vi.spyOn(client, 'query').mockResolvedValue(undefined);
    const link = renderLink(prefetchOnIntent(client, orderOptions()));

    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    vi.advanceTimersByTime(50);
    fireEvent.pointerLeave(link, { pointerType: 'mouse' });
    vi.advanceTimersByTime(500);

    expect(query).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not prefetch when focus leaves before 100 ms', () => {
    const client = createQueryClient();
    const query = vi.spyOn(client, 'query').mockResolvedValue(undefined);
    const link = renderLink(prefetchOnIntent(client, orderOptions()));

    fireEvent.focus(link);
    vi.advanceTimersByTime(99);
    fireEvent.blur(link);
    vi.advanceTimersByTime(500);

    expect(query).not.toHaveBeenCalled();
  });

  it('ignores a touch pointer, so a first tap on a phone never prefetches through pointerenter', () => {
    const client = createQueryClient();
    const query = vi.spyOn(client, 'query').mockResolvedValue(undefined);
    const link = renderLink(prefetchOnIntent(client, orderOptions()));

    fireEvent.pointerEnter(link, { pointerType: 'touch' });
    vi.advanceTimersByTime(500);

    expect(query).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('starts one timer per element: repeated intent events never queue a second prefetch', () => {
    const client = createQueryClient();
    const query = vi.spyOn(client, 'query').mockResolvedValue(undefined);
    const link = renderLink(prefetchOnIntent(client, orderOptions()));

    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    vi.advanceTimersByTime(60);
    fireEvent.focus(link);
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(500);

    expect(query).toHaveBeenCalledTimes(1);
  });

  it('cancels through handlers built on a later render for the same element', () => {
    const client = createQueryClient();
    const query = vi.spyOn(client, 'query').mockResolvedValue(undefined);
    const link = document.createElement('a');

    prefetchOnIntent(client, orderOptions()).onPointerEnter({ currentTarget: link, pointerType: 'mouse' });
    vi.advanceTimersByTime(50);
    prefetchOnIntent(client, orderOptions()).onPointerLeave({ currentTarget: link });
    vi.advanceTimersByTime(500);

    expect(query).not.toHaveBeenCalled();
  });

  it('adds only the four intent handlers: the link keeps its markup', () => {
    const client = createQueryClient();
    const handlers = prefetchOnIntent(client, orderOptions());
    expect(Object.keys(handlers).sort()).toEqual(['onBlur', 'onFocus', 'onPointerEnter', 'onPointerLeave']);

    const link = renderLink(handlers);
    expect(link.outerHTML).toBe('<a href="/admin/orders?page=2">Next page</a>');
  });

  it('never uses the deprecated prefetchQuery (L-15)', () => {
    const client = createQueryClient();
    vi.spyOn(client, 'query').mockResolvedValue(undefined);
    const prefetchQuery = vi.spyOn(client, 'prefetchQuery');
    const link = renderLink(prefetchOnIntent(client, orderOptions()));

    fireEvent.focus(link);
    vi.advanceTimersByTime(100);

    expect(prefetchQuery).not.toHaveBeenCalled();
  });
});

// Cache behaviour runs on real timers: the 100 ms intent wait is real here.
describe('prefetchOnIntent cache', () => {
  it('fills the cache, so a second intent while the data is fresh sends no new request', async () => {
    const client = createQueryClient();
    const queryFn = vi.fn(() => Promise.resolve({ rows: ['CSPS-0042'] }));
    const link = renderLink(prefetchOnIntent(client, { queryKey: orderKey, queryFn }));

    fireEvent.focus(link);
    await vi.waitFor(() => {
      expect(client.getQueryData(orderKey)).toEqual({ rows: ['CSPS-0042'] });
    });
    fireEvent.blur(link);

    fireEvent.focus(link);
    await new Promise((resolve) => setTimeout(resolve, INTENT_DELAY_MS + 50));
    expect(queryFn).toHaveBeenCalledTimes(1);
  });

  it('swallows a failed prefetch; the error stays in the cache for the real screen', async () => {
    const client = createQueryClient();
    const failure = new Error('offline');
    const queryKey = listKey('orders', { page: 3 });
    const link = renderLink(prefetchOnIntent(client, { queryKey, queryFn: () => Promise.reject(failure) }));

    expect(() => {
      fireEvent.focus(link);
    }).not.toThrow();
    await vi.waitFor(() => {
      expect(client.getQueryState(queryKey)?.error).toBe(failure);
    });
  });
});
