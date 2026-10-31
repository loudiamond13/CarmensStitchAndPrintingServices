import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { order0148, ORDER_VERSION, orderId } from '@/test/orderFixtures';
import { createOrderExpensesService } from './orderExpensesService';

// The order expense calls (ORD-07, OR-5): typed, over the one HTTP client. Add sends the version and a key, edit the version, delete neither.

const ORDER_ID = orderId(148);
const EXPENSE_ID = '00000000-0000-4000-9300-000000000001';
const EXPENSES_PATH = `/api/v1/orders/${ORDER_ID}/expenses`;
const BODY = {
  expenseDate: '2026-10-08',
  orderExpenseCategoryId: '9c4e1d20-5b66-4c2e-a8b1-6d1e3f7a0001',
  description: 'Dri-fit mesh, 45 yds',
  amount: 3825,
  paidByUserId: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
  version: ORDER_VERSION,
};

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return {
    fake,
    service: createOrderExpensesService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })),
  };
}

describe('orderExpensesService.add', () => {
  it('calls POST /orders/{id}/expenses with the body, the version and one Idempotency-Key, and resolves the order', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.add(ORDER_ID, BODY, 'key-1')).resolves.toEqual(order0148);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe(EXPENSES_PATH);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(BODY);
  });
});

describe('orderExpensesService.update', () => {
  it('calls PUT /orders/{id}/expenses/{expenseId} with the version and no Idempotency-Key', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.update(ORDER_ID, EXPENSE_ID, BODY)).resolves.toEqual(order0148);

    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`${EXPENSES_PATH}/${EXPENSE_ID}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(BODY);
  });
});

describe('orderExpensesService.remove', () => {
  it('calls DELETE /orders/{id}/expenses/{expenseId} with no body, no version and no Idempotency-Key, and resolves the order', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.remove(ORDER_ID, EXPENSE_ID)).resolves.toEqual(order0148);

    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`${EXPENSES_PATH}/${EXPENSE_ID}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(fake.calls[0]?.body ?? null).toBeNull();
  });

  it('rejects with kind aborted when the caller cancels', async () => {
    const { service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.remove(ORDER_ID, EXPENSE_ID, controller.signal).then(
      () => 'resolved',
      (error: unknown) => error,
    );
    controller.abort();

    expect(await pending).toMatchObject({ kind: 'aborted' });
  });
});
