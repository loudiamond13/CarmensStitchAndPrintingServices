import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import type { components } from '@/types/api.generated';
import { createProductTypesService } from './productTypesService';

// The product type calls (plan 08-04, T-08-06): typed, over the one HTTP client.

type Item = components['schemas']['OrderListItem'];
type Detail = components['schemas']['OrderListEntryDetailResponse'];

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return {
    fake,
    service: createProductTypesService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })),
  };
}

const ID = '3b0a4a6e-5d7c-4c31-9a58-2f6f6f0c1a11';
const ITEMS: Item[] = [
  { id: ID, name: 'Basketball Jersey', tone: 'accent', status: 'active', isOthers: false, useCount: 12 },
  { id: '8c1a2d3e-4f50-4a61-8b72-93a4b5c6d7e8', name: 'Polo Shirt', tone: 'info', status: 'retired', isOthers: false, useCount: '3' },
];
const DETAIL: Detail = {
  id: ID,
  name: 'Hoodie',
  tone: 'info',
  status: 'active',
  isOthers: false,
  useCount: 0,
  recordedBy: null,
  recordedAt: '2026-10-28T14:00:00+00:00',
  lastChangedBy: null,
  lastChangedAt: null,
  version: 'AAAAAAAAH6Q=',
};

describe('productTypesService.list', () => {
  it('calls GET /api/v1/product-types and resolves the typed array in the server order', async () => {
    const { fake, service } = serviceWith([{ body: ITEMS }]);

    await expect(service.list()).resolves.toEqual(ITEMS);

    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/product-types');
    expect(url.search).toBe('');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.list(controller.signal).then(
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

describe('productTypesService.create', () => {
  it('calls POST /api/v1/product-types with the body and the Idempotency-Key and resolves the new entry', async () => {
    const { fake, service } = serviceWith([{ status: 201, body: DETAIL }]);
    const body = { name: 'Hoodie', tone: 'info', version: null };

    await expect(service.create(body, 'key-1')).resolves.toEqual(DETAIL);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/product-types');
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });
});

describe('productTypesService.get', () => {
  it('calls GET /api/v1/product-types/{id} and resolves the typed detail with its row version', async () => {
    const { fake, service } = serviceWith([{ body: DETAIL }]);

    await expect(service.get(ID)).resolves.toEqual(DETAIL);

    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe(`/api/v1/product-types/${ID}`);
  });
});

describe('productTypesService.update', () => {
  it('calls PUT /api/v1/product-types/{id} with the body and its version, and sends no Idempotency-Key', async () => {
    const { fake, service } = serviceWith([{ body: DETAIL }]);
    const body = { name: 'Hoodie', tone: 'accent', version: 'AAAAAAAAH6Q=' };

    await expect(service.update(ID, body)).resolves.toEqual(DETAIL);

    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`/api/v1/product-types/${ID}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });
});

describe('productTypesService.retire and reactivate', () => {
  it.each([
    ['retire', 'retire'],
    ['reactivate', 'reactivate'],
  ] as const)(
    '%s calls POST /api/v1/product-types/{id}/%s with the Idempotency-Key and no body',
    async (method, path) => {
      const { fake, service } = serviceWith([{ status: 204 }]);

      await expect(service[method](ID, 'key-1')).resolves.toBeUndefined();

      expect(fake.calls[0]?.method).toBe('POST');
      expect(fake.calls[0]?.url).toBe(`/api/v1/product-types/${ID}/${path}`);
      expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
      expect(fake.calls[0]?.body ?? null).toBeNull();
    },
  );
});

describe('productTypesService.remove', () => {
  it('calls DELETE /api/v1/product-types/{id} with no body, no Idempotency-Key and no version', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await expect(service.remove(ID)).resolves.toBeUndefined();

    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`/api/v1/product-types/${ID}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(fake.calls[0]?.body ?? null).toBeNull();
  });
});
