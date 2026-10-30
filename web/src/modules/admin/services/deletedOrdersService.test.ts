import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { deletedOrderDetail, deletedOrderItem, deletedOrderList } from '@/test/deletedOrderFixtures';
import { createFakeFetch } from '@/test/fakeFetch';
import { createDeletedOrdersService } from './deletedOrdersService';

// The Manager's deleted-order calls (ORD-06, D-23, D-24, 07 D-28): typed, over the one HTTP client.

const ID = '00000000-0000-4000-8000-000000000148';

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createDeletedOrdersService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

describe('deletedOrdersService.list', () => {
  it('calls GET /api/v1/orders/deleted with page and pageSize only and resolves the typed page', async () => {
    const list = deletedOrderList([deletedOrderItem(ID)]);
    const { fake, service } = serviceWith([{ body: list }]);

    await expect(service.list({ page: 2, pageSize: 50 })).resolves.toEqual(list);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/orders/deleted');
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '2', pageSize: '50' });
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

describe('deletedOrdersService.get', () => {
  it('calls GET /api/v1/orders/deleted/{id} (D-24) and resolves the deleted order', async () => {
    const detail = deletedOrderDetail();
    const { fake, service } = serviceWith([{ body: detail }]);

    await expect(service.get(ID)).resolves.toEqual(detail);

    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe(`/api/v1/orders/deleted/${ID}`);
  });
});

describe('deletedOrdersService.restore', () => {
  it('calls POST /api/v1/orders/{id}/restore with the Idempotency-Key, no body and no confirm', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await expect(service.restore(ID, 'key-1')).resolves.toBeUndefined();

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe(`/api/v1/orders/${ID}/restore`);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(fake.calls[0]?.body ?? null).toBeNull();
  });
});

describe('deletedOrdersService.purge', () => {
  it('calls DELETE /api/v1/orders/{id}/permanent?confirm= with the typed number and no Idempotency-Key', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await expect(service.purge(ID, 'ORD-2026-0148')).resolves.toBeUndefined();

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('DELETE');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe(`/api/v1/orders/${ID}/permanent`);
    expect(Object.fromEntries(url.searchParams)).toEqual({ confirm: 'ORD-2026-0148' });
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(fake.calls[0]?.body ?? null).toBeNull();
  });
});
