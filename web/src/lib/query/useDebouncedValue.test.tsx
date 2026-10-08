import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the latest value only after 300 ms of quiet and never an intermediate one', () => {
    const seen: string[] = [];
    const { result, rerender } = renderHook(
      ({ value }: { value: string }) => {
        const debounced = useDebouncedValue(value);
        seen.push(debounced);
        return debounced;
      },
      { initialProps: { value: 'j' } },
    );
    expect(result.current).toBe('j');

    rerender({ value: 'je' });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: 'jersey' });
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe('j');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('jersey');
    expect(new Set(seen)).toEqual(new Set(['j', 'jersey']));
  });

  it('uses the given delay', () => {
    const { result, rerender } = renderHook(({ value }: { value: number }) => useDebouncedValue(value, 50), {
      initialProps: { value: 1 },
    });
    rerender({ value: 2 });
    act(() => {
      vi.advanceTimersByTime(49);
    });
    expect(result.current).toBe(1);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(2);
  });

  it('clears its timer on unmount', () => {
    const { rerender, unmount } = renderHook(({ value }: { value: string }) => useDebouncedValue(value), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'b' });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
