import { describe, expect, it } from 'vitest';
import { createQueryClient, QUERY_DEFAULTS } from './queryClient';

describe('createQueryClient', () => {
  it('sets the shared query and mutation defaults', () => {
    const defaults = createQueryClient().getDefaultOptions();
    expect(defaults.queries).toMatchObject({
      staleTime: 30_000,
      gcTime: 300_000,
      retry: false,
      refetchOnWindowFocus: true,
    });
    expect(defaults.mutations).toMatchObject({ retry: false });
  });

  it('never retries in Query, because the HTTP client owns retries (Pitfall 16)', () => {
    expect(QUERY_DEFAULTS.queries.retry).toBe(false);
    expect(QUERY_DEFAULTS.mutations.retry).toBe(false);
  });

  it('gives every call its own client and cache', () => {
    expect(createQueryClient()).not.toBe(createQueryClient());
  });
});
