import { describe, expect, it } from 'vitest';
import { createQueryClient, QUERY_DEFAULTS } from './queryClient';

describe('QUERY_DEFAULTS', () => {
  it('pins the WEB-08 values exactly', () => {
    expect(QUERY_DEFAULTS).toEqual({
      queries: {
        staleTime: 30_000,
        gcTime: 300_000,
        retry: false,
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: false,
      },
    });
  });

  it('never retries in Query, because the HTTP client owns retries (Pitfall 16)', () => {
    expect(QUERY_DEFAULTS.queries.retry).toBe(false);
    expect(QUERY_DEFAULTS.mutations.retry).toBe(false);
  });
});

describe('createQueryClient', () => {
  it('carries the shared defaults', () => {
    const defaults = createQueryClient().getDefaultOptions();
    expect(defaults.queries).toEqual(QUERY_DEFAULTS.queries);
    expect(defaults.mutations).toEqual(QUERY_DEFAULTS.mutations);
  });

  it('gives every call its own client and cache', () => {
    const first = createQueryClient();
    const second = createQueryClient();
    expect(first).not.toBe(second);
    expect(first.getQueryCache()).not.toBe(second.getQueryCache());
  });
});
