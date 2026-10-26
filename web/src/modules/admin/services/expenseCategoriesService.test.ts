import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { categoryDetail, categoryItem, EXPENSE_CATEGORIES } from '@/test/expenseFixtures';
import { createFakeFetch } from '@/test/fakeFetch';
import { createExpenseCategoriesService } from './expenseCategoriesService';

// The expense category calls (D-11, D-15; plan 06-07): typed, over the one HTTP client. Both roles may list.

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return {
    fake,
    service: createExpenseCategoriesService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })),
  };
}

describe('expenseCategoriesService.list', () => {
  it('calls GET /api/v1/expense-categories and resolves the typed array in the server order', async () => {
    const { fake, service } = serviceWith([{ body: EXPENSE_CATEGORIES }]);

    await expect(service.list()).resolves.toEqual(EXPENSE_CATEGORIES);

    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/expense-categories');
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

describe('expenseCategoriesService.create', () => {
  const body = { name: 'Packaging', tone: 'info' };

  it('calls POST /api/v1/expense-categories with the body and the Idempotency-Key and resolves the new category', async () => {
    const saved = categoryItem('8f1a0c6e-1d54-4c0e-9d77-3a5b7c9d1e21', 'Packaging', 'info');
    const { fake, service } = serviceWith([{ status: 201, body: saved }]);

    await expect(service.create(body, 'key-1')).resolves.toEqual(saved);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/expense-categories');
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });
});

describe('expenseCategoriesService.get', () => {
  it('calls GET /api/v1/expense-categories/{id} and resolves the typed detail with its row version', async () => {
    const detail = categoryDetail();
    const { fake, service } = serviceWith([{ body: detail }]);

    await expect(service.get(detail.id)).resolves.toEqual(detail);

    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe(`/api/v1/expense-categories/${detail.id}`);
  });
});

describe('expenseCategoriesService.update', () => {
  it('calls PUT /api/v1/expense-categories/{id} with the body and its version, and sends no Idempotency-Key', async () => {
    const detail = categoryDetail({ name: 'Rent and utilities' });
    const { fake, service } = serviceWith([{ body: detail }]);
    const body = { name: 'Rent and utilities', tone: 'accent', version: 'AAAAAAAAB9E=' };

    await expect(service.update(detail.id, body)).resolves.toEqual(detail);

    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`/api/v1/expense-categories/${detail.id}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });
});

describe('expenseCategoriesService.retire and reactivate', () => {
  it.each([
    ['retire', 'retire'],
    ['reactivate', 'reactivate'],
  ] as const)(
    '%s calls POST /api/v1/expense-categories/{id}/%s with the Idempotency-Key and no body',
    async (method, path) => {
      const { fake, service } = serviceWith([{ status: 204 }]);
      const id = '6869715c-a01f-4053-87d8-8fd39feebebc';

      await expect(service[method](id, 'key-1')).resolves.toBeUndefined();

      expect(fake.calls[0]?.method).toBe('POST');
      expect(fake.calls[0]?.url).toBe(`/api/v1/expense-categories/${id}/${path}`);
      expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
      expect(fake.calls[0]?.body ?? null).toBeNull();
    },
  );
});

describe('expenseCategoriesService.remove', () => {
  it('calls DELETE /api/v1/expense-categories/{id} with no body, no Idempotency-Key and no version', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);
    const id = '6869715c-a01f-4053-87d8-8fd39feebebc';

    await expect(service.remove(id)).resolves.toBeUndefined();

    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`/api/v1/expense-categories/${id}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(fake.calls[0]?.body ?? null).toBeNull();
  });
});
