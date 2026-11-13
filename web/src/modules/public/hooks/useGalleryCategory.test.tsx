// useGalleryCategory (GAL-01, WEB-10, T-11-74, CWE-601): the Gallery's ?category= parameter. While the pill list loads the
// address is left alone; once it is loaded a value outside it is dropped with one replace; a change replaces the entry;
// All is the default and stays out of the address.
import { act, renderHook, waitFor } from '@testing-library/react';
import { NuqsTestingAdapter, type OnUrlUpdateFunction, type UrlUpdateEvent } from 'nuqs/adapters/testing';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { URL_STATE_DEFAULTS } from '@/lib/url-state/defaultOptions';
import { useGalleryCategory } from './useGalleryCategory';

const KEYS = ['basketball', 'volleyball', 'moto'] as const;

type UrlUpdateSpy = ReturnType<typeof vi.fn<OnUrlUpdateFunction>>;

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30));
}

function updates(onUrlUpdate: UrlUpdateSpy): { history: string; query: string }[] {
  return onUrlUpdate.mock.calls.map(([event]: [UrlUpdateEvent]) => ({
    history: event.options.history,
    query: event.queryString,
  }));
}

function run(searchParams: string, keys: readonly string[] | undefined) {
  const onUrlUpdate = vi.fn<OnUrlUpdateFunction>();
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NuqsTestingAdapter
        searchParams={searchParams}
        onUrlUpdate={onUrlUpdate}
        defaultOptions={URL_STATE_DEFAULTS}
        hasMemory
      >
        {children}
      </NuqsTestingAdapter>
    );
  }
  const view = renderHook(({ list }) => useGalleryCategory(list), {
    initialProps: { list: keys },
    wrapper: Wrapper,
  });
  return { ...view, onUrlUpdate };
}

describe('useGalleryCategory', () => {
  it('reads a value that is in the loaded list and writes nothing', async () => {
    const { result, onUrlUpdate } = run('?category=basketball', KEYS);

    expect(result.current[0]).toBe('basketball');
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('keeps the address while the list is still loading, and returns no category until it has loaded', async () => {
    const { result, onUrlUpdate } = run('?category=basketball', undefined);

    expect(result.current[0]).toBeNull();
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('keeps a value the list holds once the list arrives', async () => {
    const { result, rerender, onUrlUpdate } = run('?category=volleyball', undefined);

    rerender({ list: KEYS });

    expect(result.current[0]).toBe('volleyball');
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it('drops a value outside the loaded list with one replace and reads All', async () => {
    const { result, onUrlUpdate } = run('?category=bogus', KEYS);

    expect(result.current[0]).toBeNull();
    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('drops an unknown value once the list has loaded, not while it loads', async () => {
    const { rerender, onUrlUpdate } = run('?category=bogus', undefined);
    await settle();
    expect(onUrlUpdate).not.toHaveBeenCalled();

    rerender({ list: KEYS });

    await waitFor(() => {
      expect(onUrlUpdate).toHaveBeenCalled();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('never returns a value that looks like an address or a script', () => {
    const { result } = run('?category=%2F%2Fevil.example', KEYS);

    expect(result.current[0]).toBeNull();
  });

  it('writes a chosen category with replace', async () => {
    const { result, onUrlUpdate } = run('', KEYS);

    act(() => {
      result.current[1]('volleyball');
    });

    await waitFor(() => {
      expect(result.current[0]).toBe('volleyball');
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '?category=volleyball' }]);
  });

  it('All (null) removes the parameter', async () => {
    const { result, onUrlUpdate } = run('?category=moto', KEYS);

    act(() => {
      result.current[1](null);
    });

    await waitFor(() => {
      expect(result.current[0]).toBeNull();
    });
    await settle();
    expect(updates(onUrlUpdate)).toEqual([{ history: 'replace', query: '' }]);
  });

  it('ignores a choice that is not in the loaded list', async () => {
    const { result, onUrlUpdate } = run('', KEYS);

    act(() => {
      result.current[1]('bogus');
    });

    await settle();
    expect(result.current[0]).toBeNull();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});
