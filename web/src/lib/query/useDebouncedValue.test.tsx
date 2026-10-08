import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryClient } from './queryClient';
import { useDebouncedValue } from './useDebouncedValue';
import { useListQuery } from './useListQuery';

// Debounce cases run on fake timers and fire one input event per character: user-event never resolves on fake
// timers (L-24), so it is not used here.
const SEARCH_DELAY_MS = 300;

type SearchFetcher = (params: { q: string }, signal: AbortSignal) => Promise<string[]>;

function SearchBox({ delayMs }: { delayMs?: number }) {
  const [q, setQ] = useState('');
  const settled = useDebouncedValue(q, delayMs ?? SEARCH_DELAY_MS);
  return (
    <>
      <label>
        Search
        <input
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
          }}
        />
      </label>
      <output aria-label="Settled search">{settled}</output>
    </>
  );
}

function SearchList({ fetcher }: { fetcher: SearchFetcher }) {
  const [q, setQ] = useState('');
  const settled = useDebouncedValue(q, SEARCH_DELAY_MS);
  const { data } = useListQuery({ key: 'products', params: { q: settled }, fetcher });
  return (
    <>
      <label>
        Search
        <input
          value={q}
          onChange={(event) => {
            setQ(event.target.value);
          }}
        />
      </label>
      <output aria-label="Rows">{data?.join(', ')}</output>
    </>
  );
}

function withClient(client: QueryClient, node: ReactNode) {
  return <QueryClientProvider client={client}>{node}</QueryClientProvider>;
}

async function wait(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

/** Lets the settled search start its query, then lets the query's own 0 ms notify timer deliver the rows. */
async function settleSearch(): Promise<void> {
  await wait(SEARCH_DELAY_MS);
  await wait(0);
}

/** Types `text` after what the box already holds, one input event per character, `gapMs` apart. */
async function typeEach(text: string, gapMs: number): Promise<void> {
  const input = screen.getByRole<HTMLInputElement>('textbox', { name: 'Search' });
  for (const character of text) {
    fireEvent.change(input, { target: { value: input.value + character } });
    await wait(gapMs);
  }
}

function settledText(): string | null {
  return screen.getByRole('status', { name: 'Settled search' }).textContent;
}

describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('settles 300 ms after the last change, never on an intermediate keystroke', async () => {
    render(<SearchBox />);
    await typeEach('jer', 100);
    expect(settledText()).toBe('');

    await wait(199);
    expect(settledText()).toBe('');

    await wait(1);
    expect(settledText()).toBe('jer');
  });

  it('restarts the 300 ms wait when the value changes within it', async () => {
    render(<SearchBox />);
    await typeEach('j', 0);
    await wait(250);
    await typeEach('e', 0);
    await wait(250);
    expect(settledText()).toBe('');

    await wait(50);
    expect(settledText()).toBe('je');
  });

  it('uses the given delay', async () => {
    render(<SearchBox delayMs={50} />);
    await typeEach('j', 49);
    expect(settledText()).toBe('');

    await wait(1);
    expect(settledText()).toBe('j');
  });

  it('clears its pending timer on unmount', async () => {
    const { unmount } = render(<SearchBox />);
    await typeEach('j', 0);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keys the list query on the settled value, so typing "jersey" fetches once for it', async () => {
    const client = createQueryClient();
    const fetcher = vi.fn<SearchFetcher>((params) => Promise.resolve([`rows for "${params.q}"`]));
    render(withClient(client, <SearchList fetcher={fetcher} />));
    await wait(0);

    await typeEach('jersey', 50);
    await settleSearch();

    expect(fetcher.mock.calls.map(([params]) => params.q)).toEqual(['', 'jersey']);
    expect(screen.getByRole('status', { name: 'Rows' })).toHaveTextContent('rows for "jersey"');
  });

  it('aborts the superseded "jer" request when the search settles on "jersey"', async () => {
    const client = createQueryClient();
    const signals = new Map<string, AbortSignal>();
    const fetcher = vi.fn<SearchFetcher>((params, signal) => {
      signals.set(params.q, signal);
      return params.q === 'jer' ? new Promise<string[]>(() => undefined) : Promise.resolve([`rows for "${params.q}"`]);
    });
    render(withClient(client, <SearchList fetcher={fetcher} />));
    await wait(0);

    await typeEach('jer', 100);
    await settleSearch();
    expect(signals.get('jer')?.aborted).toBe(false);

    await typeEach('sey', 100);
    await settleSearch();

    expect(fetcher.mock.calls.map(([params]) => params.q)).toEqual(['', 'jer', 'jersey']);
    expect(signals.get('jer')?.aborted).toBe(true);
    expect(signals.get('jersey')?.aborted).toBe(false);
    expect(screen.getByRole('status', { name: 'Rows' })).toHaveTextContent('rows for "jersey"');
  });
});
