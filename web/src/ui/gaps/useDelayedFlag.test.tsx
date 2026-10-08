// WEB-08 (02-UI-SPEC UI Considerations "loading on page, filter, search or sort change"): the refetch mark appears
// only when the placeholder data has been showing for more than 200 ms, so a fast fetch never flickers.
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDelayedFlag } from './useDelayedFlag';

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

  it('flips to true only after the flag has been true for the delay', async () => {
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

  it('never fires for a flag that turns false before the delay', async () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ flag }: { flag: boolean }) => useDelayedFlag(flag, 200), {
      initialProps: { flag: true },
    });
    await advance(150);
    rerender({ flag: false });
    await advance(500);
    expect(result.current).toBe(false);
  });
});
