import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePagedList } from './usePagedList';

type Query = Parameters<typeof usePagedList>[0];

function query(overrides: Partial<Query> = {}): Query {
  return {
    data: { items: [1] },
    isFetching: false,
    isError: false,
    isSuccess: true,
    isPlaceholderData: false,
    ...overrides,
  };
}

function run(q: Query, total: number, size: 10 | 20 | 50 | 100 = 20, clamp: (count: number) => void = vi.fn()) {
  return renderHook(() => usePagedList(q, total, size, clamp)).result.current;
}

describe('usePagedList', () => {
  it('counts a row-less page of a list that has rows as past the end, for `items` and for `rows`', () => {
    expect(run(query({ data: { items: [] } }), 15).pastTheEnd).toBe(true);
    expect(run(query({ data: { rows: [] } }), 15).pastTheEnd).toBe(true);
  });

  it('does not count an empty list, or a page with rows, as past the end', () => {
    expect(run(query({ data: { items: [] } }), 0).pastTheEnd).toBe(false);
    expect(run(query({ data: { rows: [1] } }), 15).pastTheEnd).toBe(false);
    expect(run(query({ data: undefined, isSuccess: false }), 0).pastTheEnd).toBe(false);
  });

  it('is loading while the first answer or a retry is on its way, and while a page past the end waits for the last page', () => {
    expect(run(query({ data: undefined, isFetching: true, isSuccess: false }), 0).loading).toBe(true);
    expect(run(query({ isFetching: true, isError: true, isSuccess: false }), 15).loading).toBe(true);
    expect(run(query({ data: { items: [] } }), 15).loading).toBe(true);
    expect(run(query({ isFetching: true }), 15).loading).toBe(false);
    expect(run(query(), 15).loading).toBe(false);
  });

  it('has failed only once the query has stopped fetching', () => {
    expect(run(query({ isError: true, isSuccess: false }), 0).failed).toBe(true);
    expect(run(query({ isError: true, isFetching: true, isSuccess: false }), 0).failed).toBe(false);
  });

  it('works out the page count from the total and the size', () => {
    expect(run(query(), 45, 20).pageCount).toBe(3);
    expect(run(query(), 45, 50).pageCount).toBe(1);
    expect(run(query(), 0, 20).pageCount).toBe(0);
  });

  it('shows the pager for more rows than the smallest size, even when one page holds them all, and never past the end', () => {
    expect(run(query(), 10).showPager).toBe(false);
    expect(run(query(), 11, 50).showPager).toBe(true);
    expect(run(query(), 45, 20).showPager).toBe(true);
    expect(run(query({ data: { items: [] } }), 45, 20).showPager).toBe(false);
  });

  it('clamps with the page count once the answer is fresh, and not while a kept earlier page is on screen', () => {
    const fresh = vi.fn();
    run(query(), 25, 20, fresh);
    expect(fresh).toHaveBeenCalledWith(2);

    const kept = vi.fn();
    run(query({ isPlaceholderData: true }), 25, 20, kept);
    expect(kept).not.toHaveBeenCalled();

    const pending = vi.fn();
    run(query({ data: undefined, isSuccess: false }), 0, 20, pending);
    expect(pending).not.toHaveBeenCalled();
  });
});
