import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { standardOrderList } from '@/test/orderFixtures';
import { createOrdersService } from './ordersService';

// The order-level calls (ORD-01, OR-5): typed, over the one HTTP client.

const list = standardOrderList();

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createOrdersService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

describe('ordersService.list', () => {
  it('calls GET /api/v1/orders with every filter, the sort, the page and the page size and resolves the typed page', async () => {
    const { fake, service } = serviceWith([{ body: list }]);

    await expect(
      service.list({
        q: 'ballers',
        status: 'production',
        from: '2026-10-01',
        to: '2026-10-31',
        productType: '01a17fce-7800-7f5d-bc6c-5d14ceeca0c6',
        hasBalance: true,
        sort: 'balance',
        page: 2,
        pageSize: 50,
      }),
    ).resolves.toEqual(list);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/orders');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'ballers',
      status: 'production',
      from: '2026-10-01',
      to: '2026-10-31',
      productType: '01a17fce-7800-7f5d-bc6c-5d14ceeca0c6',
      hasBalance: 'true',
      sort: 'balance',
      page: '2',
      pageSize: '50',
    });
  });

  it('leaves out every parameter that is not set', async () => {
    const { fake, service } = serviceWith([{ body: list }, { body: list }]);

    await service.list({ page: 1, pageSize: 20 });
    await service.list({ q: null, status: null, hasBalance: null, from: undefined, page: 3, pageSize: 10 });

    const first = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    const second = new URL(fake.calls[1]?.url ?? '', 'https://csps.invalid');
    expect(Object.fromEntries(first.searchParams)).toEqual({ page: '1', pageSize: '20' });
    expect(Object.fromEntries(second.searchParams)).toEqual({ page: '3', pageSize: '10' });
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.list({ page: 1, pageSize: 20 }, controller.signal).then(
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
