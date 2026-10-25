import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import {
  deletedExpenseItem,
  deletedExpenseList,
  expenseDetail,
  expenseItem,
  expenseKpis,
  expenseList,
} from '@/test/expenseFixtures';
import { createExpensesService } from './expensesService';

// The company expense calls (CEXP-01, D-25): typed, over the one HTTP client.

const list = expenseList([expenseItem('00000000-0000-4000-8000-000000000001')]);

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createExpensesService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

describe('expensesService.list', () => {
  it('calls GET /api/v1/company-expenses with q, category, from, to, page and pageSize and resolves the typed page', async () => {
    const { fake, service } = serviceWith([{ body: list }]);

    await expect(
      service.list({
        q: 'meralco',
        category: '6869715c-a01f-4053-87d8-8fd39feebebc',
        from: '2026-10-01',
        to: '2026-10-31',
        page: 2,
        pageSize: 50,
      }),
    ).resolves.toEqual(list);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/company-expenses');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'meralco',
      category: '6869715c-a01f-4053-87d8-8fd39feebebc',
      from: '2026-10-01',
      to: '2026-10-31',
      page: '2',
      pageSize: '50',
    });
  });

  it('leaves out every parameter that is not set', async () => {
    const { fake, service } = serviceWith([{ body: list }, { body: list }]);

    await service.list({ page: 1, pageSize: 20 });
    await service.list({ q: null, category: null, from: undefined, to: undefined, page: 3, pageSize: 10 });

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

describe('expensesService.kpis', () => {
  it('calls GET /api/v1/company-expenses/kpis with no parameters and resolves the typed figures', async () => {
    const kpis = expenseKpis();
    const { fake, service } = serviceWith([{ body: kpis }]);

    await expect(service.kpis()).resolves.toEqual(kpis);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/company-expenses/kpis');
    expect(url.search).toBe('');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.kpis(controller.signal).then(
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

describe('expensesService.create', () => {
  const body = {
    date: '2026-10-25',
    categoryId: '447ad32e-1433-4b70-8786-72e3dc3f9937',
    description: 'Thread and needles',
    amount: 640,
    paidByUserId: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
    notes: null,
  };

  it('calls POST /api/v1/company-expenses with the body and the Idempotency-Key and resolves the saved expense', async () => {
    const saved = expenseDetail();
    const { fake, service } = serviceWith([{ status: 201, body: saved }]);

    await expect(service.create(body, 'key-1')).resolves.toEqual(saved);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/company-expenses');
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });
});

describe('expensesService.get', () => {
  it('calls GET /api/v1/company-expenses/{id} and resolves the typed detail with its row version', async () => {
    const detail = expenseDetail({ id: '00000000-0000-4000-8000-0000000000e7' });
    const { fake, service } = serviceWith([{ body: detail }]);

    await expect(service.get('00000000-0000-4000-8000-0000000000e7')).resolves.toEqual(detail);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/company-expenses/00000000-0000-4000-8000-0000000000e7');
  });
});

describe('expensesService.update', () => {
  const body = {
    date: '2026-10-25',
    categoryId: '447ad32e-1433-4b70-8786-72e3dc3f9937',
    description: 'Thread and needles',
    amount: 700,
    paidByUserId: '5f0c4a1e-8c1d-4a52-9d0e-1a2b3c4d5e6f',
    notes: null,
    version: 'AAAAAAAAB9E=',
  };

  it('calls PUT /api/v1/company-expenses/{id} with the body and its version, and sends no Idempotency-Key', async () => {
    const saved = expenseDetail({ amount: 700, version: 'AAAAAAAAB9I=' });
    const { fake, service } = serviceWith([{ body: saved }]);

    await expect(service.update('00000000-0000-4000-8000-0000000000e1', body)).resolves.toEqual(saved);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe('/api/v1/company-expenses/00000000-0000-4000-8000-0000000000e1');
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });
});

describe('expensesService.remove', () => {
  it('calls DELETE /api/v1/company-expenses/{id} with no body, no Idempotency-Key and no version', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await expect(service.remove('00000000-0000-4000-8000-0000000000e1')).resolves.toBeUndefined();

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe('/api/v1/company-expenses/00000000-0000-4000-8000-0000000000e1');
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(fake.calls[0]?.body ?? null).toBeNull();
  });
});

describe('expensesService.listDeleted', () => {
  const deleted = deletedExpenseList([deletedExpenseItem('00000000-0000-4000-8000-000000000001')]);

  it('calls GET /api/v1/company-expenses/deleted with q, category, page and pageSize and resolves the typed page', async () => {
    const { fake, service } = serviceWith([{ body: deleted }]);

    await expect(
      service.listDeleted({ q: 'meralco', category: '6869715c-a01f-4053-87d8-8fd39feebebc', page: 2, pageSize: 50 }),
    ).resolves.toEqual(deleted);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/company-expenses/deleted');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'meralco',
      category: '6869715c-a01f-4053-87d8-8fd39feebebc',
      page: '2',
      pageSize: '50',
    });
  });

  it('leaves out every parameter that is not set and never sends dates', async () => {
    const { fake, service } = serviceWith([{ body: deleted }]);

    await service.listDeleted({ q: null, category: undefined, page: 1, pageSize: 20 });

    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(Object.fromEntries(url.searchParams)).toEqual({ page: '1', pageSize: '20' });
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.listDeleted({ page: 1, pageSize: 20 }, controller.signal).then(
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

describe('expensesService.restore', () => {
  it('calls POST /api/v1/company-expenses/{id}/restore with the Idempotency-Key and no body', async () => {
    const { fake, service } = serviceWith([{ status: 204 }]);

    await expect(service.restore('00000000-0000-4000-8000-0000000000e1', 'key-1')).resolves.toBeUndefined();

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/company-expenses/00000000-0000-4000-8000-0000000000e1/restore');
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(fake.calls[0]?.body ?? null).toBeNull();
  });
});
