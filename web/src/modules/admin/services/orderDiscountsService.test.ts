import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { order0148, ORDER_VERSION, orderId } from '@/test/orderFixtures';
import { createOrderDiscountsService } from './orderDiscountsService';

// The discount calls (ORD-07, OR-5): typed, over the one HTTP client. Add sends the version and a key, edit the version, delete neither.

const ORDER_ID = orderId(148);
const DISCOUNT_ID = '00000000-0000-4000-9400-000000000001';
const DISCOUNTS_PATH = `/api/v1/orders/${ORDER_ID}/discounts`;
const BODY = { kind: 'percentage', value: 5, reason: 'Barangay league discount', version: ORDER_VERSION };

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return {
    fake,
    service: createOrderDiscountsService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })),
  };
}

describe('orderDiscountsService.add', () => {
  it('calls POST /orders/{id}/discounts with the body, the version and one Idempotency-Key, and resolves the order', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.add(ORDER_ID, BODY, 'key-1')).resolves.toEqual(order0148);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe(DISCOUNTS_PATH);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(BODY);
  });
});

describe('orderDiscountsService.update', () => {
  it('calls PUT /orders/{id}/discounts/{discountId} with the version and no Idempotency-Key', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.update(ORDER_ID, DISCOUNT_ID, BODY)).resolves.toEqual(order0148);

    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`${DISCOUNTS_PATH}/${DISCOUNT_ID}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(BODY);
  });
});

describe('orderDiscountsService.remove', () => {
  it('calls DELETE /orders/{id}/discounts/{discountId} with no body, no version and no Idempotency-Key, and resolves the order', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.remove(ORDER_ID, DISCOUNT_ID)).resolves.toEqual(order0148);

    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`${DISCOUNTS_PATH}/${DISCOUNT_ID}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(fake.calls[0]?.body ?? null).toBeNull();
  });

  it('rejects with kind aborted when the caller cancels', async () => {
    const { service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.remove(ORDER_ID, DISCOUNT_ID, controller.signal).then(
      () => 'resolved',
      (error: unknown) => error,
    );
    controller.abort();

    expect(await pending).toMatchObject({ kind: 'aborted' });
  });
});
