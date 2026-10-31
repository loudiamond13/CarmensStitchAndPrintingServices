import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { order0148, ORDER_VERSION, orderId } from '@/test/orderFixtures';
import { createOrderItemsService } from './orderItemsService';

// The item calls (ORD-05, OR-5): typed, over the one HTTP client. Add sends the version and a key, edit the version, delete neither.

const ORDER_ID = orderId(148);
const ITEM_ID = '00000000-0000-4000-9100-000000000001';
const ITEMS_PATH = `/api/v1/orders/${ORDER_ID}/items`;
const BODY = {
  productTypeId: '01a17fce-7800-7f5d-bc6c-5d14ceeca0c6',
  description: 'Jersey top',
  sizeVariant: 'S-XL',
  quantity: 12,
  unitPrice: 650,
  version: ORDER_VERSION,
};

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return {
    fake,
    service: createOrderItemsService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })),
  };
}

describe('orderItemsService.add', () => {
  it('calls POST /orders/{id}/items with the body, the version and one Idempotency-Key, and resolves the order', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.add(ORDER_ID, BODY, 'key-1')).resolves.toEqual(order0148);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe(ITEMS_PATH);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(BODY);
  });
});

describe('orderItemsService.update', () => {
  it('calls PUT /orders/{id}/items/{itemId} with the version and no Idempotency-Key', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.update(ORDER_ID, ITEM_ID, BODY)).resolves.toEqual(order0148);

    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`${ITEMS_PATH}/${ITEM_ID}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(BODY);
  });
});

describe('orderItemsService.remove', () => {
  it('calls DELETE /orders/{id}/items/{itemId} with no body, no version and no Idempotency-Key, and resolves the order', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.remove(ORDER_ID, ITEM_ID)).resolves.toEqual(order0148);

    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`${ITEMS_PATH}/${ITEM_ID}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(fake.calls[0]?.body ?? null).toBeNull();
  });

  it('rejects with kind aborted when the caller cancels', async () => {
    const { service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.remove(ORDER_ID, ITEM_ID, controller.signal).then(
      () => 'resolved',
      (error: unknown) => error,
    );
    controller.abort();

    expect(await pending).toMatchObject({ kind: 'aborted' });
  });
});
