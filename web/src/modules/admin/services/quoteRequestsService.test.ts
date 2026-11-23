import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { quoteRequestItem, quoteRequestList } from '@/test/quoteRequestFixtures';
import { createQuoteRequestsService } from './quoteRequestsService';

// The staff inbox calls (INQ-05, D-14, D-18): typed, over the one HTTP client.

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createQuoteRequestsService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

describe('quoteRequestsService.list', () => {
  it('calls GET /api/v1/quote-requests with status, q, page and size and resolves the typed page', async () => {
    const list = quoteRequestList([quoteRequestItem()]);
    const { fake, service } = serviceWith([{ body: list }]);

    await expect(service.list({ status: 'spam', q: 'juan', page: 2, size: 50 })).resolves.toEqual(list);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/quote-requests');
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'spam', q: 'juan', page: '2', size: '50' });
  });

  it('leaves q out when there is no search', async () => {
    const { fake, service } = serviceWith([{ body: quoteRequestList([]) }]);

    await service.list({ status: 'open', q: null, page: 1, size: 20 });

    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(Object.fromEntries(url.searchParams)).toEqual({ status: 'open', page: '1', size: '20' });
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.list({ status: 'open', q: null, page: 1, size: 20 }, controller.signal).then(
      () => 'resolved',
      (error: unknown) => error,
    );
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(1);
    });
    controller.abort();

    expect(await pending).toMatchObject({ kind: 'aborted' });
  });
});

describe('quoteRequestsService.newCount', () => {
  it('calls GET /api/v1/quote-requests/new-count and resolves the count', async () => {
    const { fake, service } = serviceWith([{ body: { count: 3 } }]);

    await expect(service.newCount()).resolves.toEqual({ count: 3 });

    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/quote-requests/new-count');
  });
});
