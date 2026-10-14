import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSettledListParams, type ListValues } from './useSettledListParams';

// The params a list query keys on (WEB-08, WEB-10; plan 02-30): while a typed search settles, the query keeps the
// values it last ran with (the page reset included); every other change passes through at once.

const DELAY_MS = 300;

interface Values extends ListValues {
  page: number;
  q: string | null;
  status: string;
}

function renderSettled(initial: Values) {
  return renderHook(({ values }: { values: Values }) => useSettledListParams(values, DELAY_MS), {
    initialProps: { values: initial },
  });
}

async function wait(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useSettledListParams', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the values as they are when nothing is being typed', () => {
    const values: Values = { page: 2, q: null, status: 'all' };
    const { result } = renderSettled(values);
    expect(result.current).toBe(values);
  });

  it('holds the last values, page included, while a search is typed, then gives the settled search once', async () => {
    const { result, rerender } = renderSettled({ page: 2, q: null, status: 'all' });
    for (const q of ['j', 'je', 'jer', 'jersey']) {
      rerender({ values: { page: 1, q, status: 'all' } });
      expect(result.current).toEqual({ page: 2, q: null, status: 'all' });
      await wait(100);
    }
    await wait(DELAY_MS - 100 - 1);
    expect(result.current).toEqual({ page: 2, q: null, status: 'all' });
    await wait(1);
    expect(result.current).toEqual({ page: 1, q: 'jersey', status: 'all' });
  });

  it('passes a page, filter or size change through at once', () => {
    const { result, rerender } = renderSettled({ page: 1, q: 'jersey', status: 'all' });
    const next: Values = { page: 2, q: 'jersey', status: 'all' };
    rerender({ values: next });
    expect(result.current).toBe(next);
    const filtered: Values = { page: 1, q: 'jersey', status: 'ready' };
    rerender({ values: filtered });
    expect(result.current).toBe(filtered);
  });

  it('holds while a search is cleared, then gives the cleared values', async () => {
    const { result, rerender } = renderSettled({ page: 3, q: 'jersey', status: 'all' });
    rerender({ values: { page: 1, q: null, status: 'all' } });
    expect(result.current).toEqual({ page: 3, q: 'jersey', status: 'all' });
    await wait(DELAY_MS);
    expect(result.current).toEqual({ page: 1, q: null, status: 'all' });
  });

  it('treats a list without a search as always settled', () => {
    const { result, rerender } = renderHook(({ values }) => useSettledListParams(values, DELAY_MS), {
      initialProps: { values: { page: 1 } },
    });
    const next = { page: 4 };
    rerender({ values: next });
    expect(result.current).toBe(next);
  });

  it('keeps one snapshot for equal values with a new identity (no render loop)', () => {
    const { result, rerender } = renderSettled({ page: 1, q: null, status: 'all' });
    const copy: Values = { page: 1, q: null, status: 'all' };
    rerender({ values: copy });
    rerender({ values: { ...copy } });
    expect(result.current).toEqual(copy);
  });
});
