import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { EXPENSE_CATEGORIES } from '@/test/expenseFixtures';
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
