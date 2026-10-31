import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { order0148, standardOrderList } from '@/test/orderFixtures';
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

const ORDER_ID = order0148.id;
const ORDER_PATH = `/api/v1/orders/${ORDER_ID}`;

describe('ordersService.get', () => {
  it('calls GET /api/v1/orders/{id} with the id encoded and resolves the typed order with its row version', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }, { body: order0148 }]);

    await expect(service.get(ORDER_ID)).resolves.toEqual(order0148);
    await service.get('a/b c');

    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe(ORDER_PATH);
    expect(fake.calls[1]?.url).toBe('/api/v1/orders/a%2Fb%20c');
  });
});

describe('ordersService.create', () => {
  const body = {
    customerName: 'Juan Dela Cruz',
    teamName: null,
    contactNumber: '0917 123 4567',
    email: null,
    address: null,
    orderDate: '2026-09-28',
    dueDate: '2026-10-14',
    status: 'pending',
    notes: null,
    items: [
      {
        productTypeId: '01a17fce-7800-7f5d-bc6c-5d14ceeca0c6',
        description: 'Jersey top',
        sizeVariant: null,
        quantity: 15,
        unitPrice: 650,
      },
    ],
  };

  it('calls POST /api/v1/orders with the body and the Idempotency-Key and resolves the saved order', async () => {
    const { fake, service } = serviceWith([{ status: 201, body: order0148 }]);

    await expect(service.create(body, 'key-1')).resolves.toEqual(order0148);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/orders');
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });
});

describe('ordersService.updateDetails', () => {
  const body = {
    customerName: 'Juan Dela Cruz',
    teamName: 'Brgy. San Roque Ballers',
    contactNumber: '0917 123 4567',
    email: null,
    address: null,
    orderDate: '2026-09-28',
    dueDate: '2026-10-15',
    notes: null,
    version: 'AAAAAAAAB9E=',
  };

  it('calls PUT /api/v1/orders/{id} with the version in the body and sends no Idempotency-Key', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.updateDetails(ORDER_ID, body)).resolves.toEqual(order0148);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(ORDER_PATH);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });
});

describe('ordersService.changeStatus', () => {
  it('calls POST /api/v1/orders/{id}/status with only the status and the Idempotency-Key, and no version', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.changeStatus(ORDER_ID, 'ready', 'key-2')).resolves.toEqual(order0148);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe(`${ORDER_PATH}/status`);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-2');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ status: 'ready' });
  });
});

describe('ordersService.remove', () => {
  it('calls DELETE /api/v1/orders/{id} with no body, no Idempotency-Key and no version', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await expect(service.remove(ORDER_ID)).resolves.toBeUndefined();

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(ORDER_PATH);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(fake.calls[0]?.body ?? null).toBeNull();
  });
});

describe('the order-level calls pass the caller signal', () => {
  it.each([
    ['get', (service: ReturnType<typeof createOrdersService>, signal: AbortSignal) => service.get(ORDER_ID, signal)],
    [
      'remove',
      (service: ReturnType<typeof createOrdersService>, signal: AbortSignal) => service.remove(ORDER_ID, signal),
    ],
  ])('%s rejects with kind aborted when cancelled', async (_name, call) => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = call(service, controller.signal).then(
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
