import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { order0148, ORDER_VERSION, orderId, PRODUCT_LINE_OPTIONS } from '@/test/orderFixtures';
import { createPublicWebsiteService } from './publicWebsiteService';

// The Public Website calls (GAL-03, CONT-03, OR-5): typed, over the one HTTP client. The save sends the order version and no key.

const ORDER_ID = orderId(148);
const BODY = {
  customerConsent: true,
  showOnWebsite: true,
  productLineId: '8c1f4a20-0000-4000-8000-000000000001',
  publicName: null,
  version: ORDER_VERSION,
};

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return {
    fake,
    service: createPublicWebsiteService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })),
  };
}

describe('publicWebsiteService.save', () => {
  it('calls PUT /orders/{id}/public with the body and the version, no Idempotency-Key, and resolves the order', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.save(ORDER_ID, BODY)).resolves.toEqual(order0148);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`/api/v1/orders/${ORDER_ID}/public`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(BODY);
  });
});

describe('publicWebsiteService.lineOptions', () => {
  it('calls GET /product-lines/options and resolves the active lines', async () => {
    const { fake, service } = serviceWith([{ body: PRODUCT_LINE_OPTIONS }]);

    await expect(service.lineOptions()).resolves.toEqual(PRODUCT_LINE_OPTIONS);

    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/product-lines/options');
  });
});
