import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { STAFF } from '@/test/expenseFixtures';
import { createFakeFetch } from '@/test/fakeFetch';
import { createStaffService } from './staffService';

// The staff lookup call (CEXP-05, D-32): typed, over the one HTTP client.

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('staffService.list', () => {
  it('calls GET /api/v1/staff with no parameters and resolves the typed people', async () => {
    const fake = createFakeFetch([{ body: STAFF }]);
    const service = createStaffService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    await expect(service.list()).resolves.toEqual(STAFF);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/staff');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const fake = createFakeFetch([{ hang: true }]);
    const service = createStaffService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));
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
