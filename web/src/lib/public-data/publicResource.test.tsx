// The public data store (D-42): primed from the boot block, loaded once and shared, stale after staleMs, cleared by
// invalidate, and an error with a retry when a load fails.
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDeferred } from '@/test/fakeFetch';
import { putBootBlock, resetPublicData, demoSite } from '@/test/publicFixtures';
import type { ReactNode } from 'react';
import {
  createPublicResource,
  fixedAnswer,
  invalidatePublicContent,
  PublicDataScope,
  type PublicResourceState,
} from './publicResource';

const STALE_MS = 1000;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
});

afterEach(() => {
  vi.useRealTimers();
  resetPublicData();
});

function data<T>(state: PublicResourceState<T>): T | undefined {
  return state.status === 'success' ? state.data : undefined;
}

describe('createPublicResource', () => {
  it('a resource primed from the boot block is a success with no load call', () => {
    putBootBlock(demoSite);
    const load = vi.fn(() => Promise.resolve('loaded'));
    const resource = createPublicResource<unknown>({ key: 'site', load, staleMs: STALE_MS });

    const { result } = renderHook(() => resource.useResource());

    expect(result.current).toEqual({ status: 'success', data: demoSite });
    expect(load).not.toHaveBeenCalled();
  });

  it('a resource with no boot key ignores the boot block and loads', async () => {
    putBootBlock(demoSite);
    const load = vi.fn(() => Promise.resolve('loaded'));
    const resource = createPublicResource<string>({ load, staleMs: STALE_MS });

    const { result } = renderHook(() => resource.useResource());

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(data(result.current)).toBe('loaded');
    });
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('an unprimed resource loads once and shares the result between two hooks', async () => {
    const load = vi.fn(() => Promise.resolve('hello'));
    const resource = createPublicResource<string>({ key: 'site', load, staleMs: STALE_MS });

    const first = renderHook(() => resource.useResource());
    const second = renderHook(() => resource.useResource());

    expect(first.result.current.status).toBe('loading');
    await waitFor(() => {
      expect(data(first.result.current)).toBe('hello');
    });
    expect(data(second.result.current)).toBe('hello');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('reloads only after staleMs', async () => {
    let answer = 'one';
    const load = vi.fn(() => Promise.resolve(answer));
    const resource = createPublicResource<string>({ key: 'site', load, staleMs: STALE_MS });
    const first = renderHook(() => resource.useResource());
    await waitFor(() => {
      expect(data(first.result.current)).toBe('one');
    });
    first.unmount();

    answer = 'two';
    vi.setSystemTime(Date.now() + STALE_MS - 1);
    const early = renderHook(() => resource.useResource());
    expect(data(early.result.current)).toBe('one');
    expect(load).toHaveBeenCalledTimes(1);
    early.unmount();

    vi.setSystemTime(Date.now() + 2);
    const late = renderHook(() => resource.useResource());
    expect(data(late.result.current)).toBe('one');
    await waitFor(() => {
      expect(data(late.result.current)).toBe('two');
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('invalidate() reloads a mounted resource, and the next use of an unmounted one', async () => {
    let answer = 'one';
    const load = vi.fn(() => Promise.resolve(answer));
    const resource = createPublicResource<string>({ key: 'site', load, staleMs: STALE_MS });
    const mounted = renderHook(() => resource.useResource());
    await waitFor(() => {
      expect(data(mounted.result.current)).toBe('one');
    });

    answer = 'two';
    act(() => {
      resource.invalidate();
    });
    await waitFor(() => {
      expect(data(mounted.result.current)).toBe('two');
    });
    expect(load).toHaveBeenCalledTimes(2);

    mounted.unmount();
    answer = 'three';
    resource.invalidate();
    const next = renderHook(() => resource.useResource());
    await waitFor(() => {
      expect(data(next.result.current)).toBe('three');
    });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('invalidate() while a load is in flight loads again once it answers, and the old answer is not held as fresh', async () => {
    const pending = createDeferred<string>();
    let calls = 0;
    const load = vi.fn(() => {
      calls += 1;
      return calls === 1 ? pending.promise : Promise.resolve('new');
    });
    const resource = createPublicResource<string>({ load, staleMs: STALE_MS });
    const mounted = renderHook(() => resource.useResource());
    expect(load).toHaveBeenCalledTimes(1);

    act(() => {
      resource.invalidate();
    });
    await act(async () => {
      pending.resolve('old');
      await pending.promise;
    });

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(data(mounted.result.current)).toBe('new');
    });
  });

  it('invalidate() during a refresh of old data loads again once the refresh answers', async () => {
    const refresh = createDeferred<string>();
    let calls = 0;
    const load = vi.fn(() => {
      calls += 1;
      return calls === 2 ? refresh.promise : Promise.resolve(calls === 1 ? 'first' : 'last');
    });
    const resource = createPublicResource<string>({ load, staleMs: STALE_MS });
    const initial = renderHook(() => resource.useResource());
    await waitFor(() => {
      expect(data(initial.result.current)).toBe('first');
    });
    initial.unmount();
    vi.setSystemTime(Date.now() + STALE_MS);
    const mounted = renderHook(() => resource.useResource());
    expect(load).toHaveBeenCalledTimes(2);

    act(() => {
      resource.invalidate();
    });
    await act(async () => {
      refresh.resolve('stale');
      await refresh.promise;
    });

    await waitFor(() => {
      expect(data(mounted.result.current)).toBe('last');
    });
    expect(load).toHaveBeenCalledTimes(3);
  });

  it('invalidatePublicContent() makes every resource reload', async () => {
    const loadA = vi.fn(() => Promise.resolve('a'));
    const loadB = vi.fn(() => Promise.resolve('b'));
    const a = createPublicResource<string>({ key: 'site', load: loadA, staleMs: STALE_MS });
    const b = createPublicResource<string>({ key: 'home', load: loadB, staleMs: STALE_MS });
    const hookA = renderHook(() => a.useResource());
    const hookB = renderHook(() => b.useResource());
    await waitFor(() => {
      expect(data(hookA.result.current)).toBe('a');
      expect(data(hookB.result.current)).toBe('b');
    });

    act(() => {
      invalidatePublicContent();
    });

    await waitFor(() => {
      expect(loadA).toHaveBeenCalledTimes(2);
      expect(loadB).toHaveBeenCalledTimes(2);
    });
  });

  it('a failed load is an error with a retry that loads again', async () => {
    const load = vi.fn<() => Promise<string>>().mockRejectedValueOnce(new Error('down')).mockResolvedValue('back');
    const resource = createPublicResource<string>({ key: 'site', load, staleMs: STALE_MS });
    const { result } = renderHook(() => resource.useResource());

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });
    act(() => {
      if (result.current.status === 'error') {
        result.current.retry();
      }
    });

    expect(result.current.status).toBe('loading');
    await waitFor(() => {
      expect(data(result.current)).toBe('back');
    });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('keeps the old data when a refresh fails', async () => {
    const load = vi.fn<() => Promise<string>>().mockResolvedValueOnce('one').mockRejectedValue(new Error('down'));
    const resource = createPublicResource<string>({ key: 'site', load, staleMs: STALE_MS });
    const { result } = renderHook(() => resource.useResource());
    await waitFor(() => {
      expect(data(result.current)).toBe('one');
    });

    act(() => {
      resource.invalidate();
    });

    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(2);
    });
    expect(data(result.current)).toBe('one');
  });

  it('prime() sets a success without a load', () => {
    const load = vi.fn(() => Promise.resolve('loaded'));
    const resource = createPublicResource<string>({ key: 'site', load, staleMs: STALE_MS });
    resource.prime('given');

    const { result } = renderHook(() => resource.useResource());

    expect(data(result.current)).toBe('given');
    expect(load).not.toHaveBeenCalled();
  });

  it('cancels the load when the last hook unmounts', async () => {
    let signal: AbortSignal | undefined;
    const load = vi.fn((given: AbortSignal) => {
      signal = given;
      return new Promise<string>(() => undefined);
    });
    const resource = createPublicResource<string>({ key: 'site', load, staleMs: STALE_MS });
    const { unmount } = renderHook(() => resource.useResource());
    await waitFor(() => {
      expect(load).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(signal?.aborted).toBe(true);
  });
});

describe('PublicDataScope (the showcase and parity previews)', () => {
  it('shows the fixed answer inside the scope with no load, and leaves the shared store unloaded', async () => {
    const load = vi.fn(() => Promise.resolve('shared'));
    const resource = createPublicResource<string>({ load, staleMs: STALE_MS });
    const fixed = new Map([fixedAnswer(resource, 'fixed')]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PublicDataScope value={fixed}>{children}</PublicDataScope>
    );

    const inside = renderHook(() => resource.useResource(), { wrapper });
    expect(inside.result.current).toEqual({ status: 'success', data: 'fixed' });
    expect(load).not.toHaveBeenCalled();
    inside.unmount();

    const outside = renderHook(() => resource.useResource());
    expect(outside.result.current.status).toBe('loading');
    await waitFor(() => {
      expect(data(outside.result.current)).toBe('shared');
    });
  });

  it('loads as usual a resource the scope does not list', async () => {
    const listed = createPublicResource<string>({ load: () => Promise.resolve('listed'), staleMs: STALE_MS });
    const other = createPublicResource<string>({ load: () => Promise.resolve('other'), staleMs: STALE_MS });
    const fixed = new Map([fixedAnswer(listed, 'fixed')]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <PublicDataScope value={fixed}>{children}</PublicDataScope>
    );

    const { result } = renderHook(() => other.useResource(), { wrapper });

    await waitFor(() => {
      expect(data(result.current)).toBe('other');
    });
  });
});
