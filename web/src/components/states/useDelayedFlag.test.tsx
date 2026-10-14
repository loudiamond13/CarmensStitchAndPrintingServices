import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDelayedFlag } from '@/components/states';

// useDelayedFlag (SPEC-GAP, plan 02-28; UI-SPEC UI Considerations "loading on page, filter, search or sort change";
// WEB-08). The refetch dim appears only when the previous rows have been showing for more than 200 ms, so a fast
// fetch never flickers. Fake timers here (L-24); no user-event or axe in this file.

async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('useDelayedFlag', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays false while the flag is false', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDelayedFlag(false, 200));
    await advance(1000);
    expect(result.current).toBe(false);
  });

  it('turns true only after the flag has been true for 200 ms', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDelayedFlag(true, 200));
    expect(result.current).toBe(false);
    await advance(199);
    expect(result.current).toBe(false);
    await advance(1);
    expect(result.current).toBe(true);
  });

  it('resets at once when the flag turns false, and waits the full delay again next time', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ flag }: { flag: boolean }) => useDelayedFlag(flag, 200), {
      initialProps: { flag: true },
    });
    await advance(200);
    expect(result.current).toBe(true);
    rerender({ flag: false });
    expect(result.current).toBe(false);
    rerender({ flag: true });
    expect(result.current).toBe(false);
    await advance(150);
    expect(result.current).toBe(false);
    await advance(50);
    expect(result.current).toBe(true);
  });

  it('never turns true for a flag that turns false before the delay', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ flag }: { flag: boolean }) => useDelayedFlag(flag, 200), {
      initialProps: { flag: true },
    });
    await advance(150);
    rerender({ flag: false });
    await advance(500);
    expect(result.current).toBe(false);
  });

  it('stays true while the flag stays true, across re-renders', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ flag }: { flag: boolean }) => useDelayedFlag(flag, 200), {
      initialProps: { flag: true },
    });
    await advance(200);
    rerender({ flag: true });
    await advance(1000);
    expect(result.current).toBe(true);
  });

  it('honours another delay', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDelayedFlag(true, 50));
    await advance(49);
    expect(result.current).toBe(false);
    await advance(1);
    expect(result.current).toBe(true);
  });
});
