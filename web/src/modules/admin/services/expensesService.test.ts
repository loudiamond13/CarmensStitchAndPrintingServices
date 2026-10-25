import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { expenseItem, expenseKpis, expenseList } from '@/test/expenseFixtures';
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
