import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { createVisitorStatsService, VisitorStatsContractError, type VisitorStatsResponse } from './visitorStatsService';

// The visitor stats call (ANL-08, D-24, D-27, D-33): Manager only, one GET, every count from the server.

const answer: VisitorStatsResponse = {
  range: 'last-30-days',
  from: '2026-10-17',
  to: '2026-11-15',
  cutDate: '2025-10-15',
  totals: { uniqueVisitors: 1234, visits: 980, pageViews: 4567, countedFrom: null },
  bucket: 'day',
  trend: [{ start: '2026-10-17', pageViews: 3, uniqueVisitors: 2 }],
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createVisitorStatsService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

describe('visitorStatsService.get', () => {
  it('calls GET /api/v1/visitor-stats with the preset name and no dates', async () => {
    const { fake, service } = serviceWith([{ body: answer }]);

    await service.get({ range: 'last-30-days', from: null, to: null });

    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/visitor-stats');
    expect(Object.fromEntries(url.searchParams)).toEqual({ range: 'last-30-days' });
  });

  it('sends from and to with a custom range', async () => {
    const { fake, service } = serviceWith([{ body: answer }]);

    await service.get({ range: 'custom', from: '2026-01-05', to: '2026-02-04' });

    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(Object.fromEntries(url.searchParams)).toEqual({ range: 'custom', from: '2026-01-05', to: '2026-02-04' });
  });

  it('resolves the range and the three totals as plain numbers', async () => {
    const { service } = serviceWith([
      { body: { ...answer, totals: { uniqueVisitors: '1234', visits: 980, pageViews: '4567', countedFrom: null } } },
    ]);

    await expect(service.get({ range: 'last-30-days', from: null, to: null })).resolves.toEqual({
      range: 'last-30-days',
      from: '2026-10-17',
      to: '2026-11-15',
      cutDate: '2025-10-15',
      totals: { uniqueVisitors: 1234, visits: 980, pageViews: 4567, countedFrom: null },
      bucket: 'day',
      trend: [{ start: '2026-10-17', pageViews: 3, uniqueVisitors: 2 }],
    });
  });

  it('narrows each trend bucket to plain numbers and keeps a unique-visitor count the server does not have as null', async () => {
    const { service } = serviceWith([
      {
        body: {
          ...answer,
          bucket: 'month',
          trend: [
            { start: '2025-09-01', pageViews: '40', uniqueVisitors: null },
            { start: '2025-10-01', pageViews: 12, uniqueVisitors: '5' },
          ],
        },
      },
    ]);

    const stats = await service.get({ range: 'custom', from: '2025-09-01', to: '2025-10-31' });

    expect(stats.bucket).toBe('month');
    expect(stats.trend).toEqual([
      { start: '2025-09-01', pageViews: 40, uniqueVisitors: null },
      { start: '2025-10-01', pageViews: 12, uniqueVisitors: 5 },
    ]);
  });

  it.each([
    ['a bucket size it does not know', { bucket: 'week' }],
    ['a trend count that is not a number', { trend: [{ start: '2026-10-17', pageViews: 'lots', uniqueVisitors: 1 }] }],
  ])('refuses an answer with %s', async (_, change) => {
    const { service } = serviceWith([{ body: { ...answer, ...change } }]);

    await expect(service.get({ range: 'last-30-days', from: null, to: null })).rejects.toBeInstanceOf(
      VisitorStatsContractError,
    );
  });

  it('keeps a count the server says is not available as null, with the counted-from day', async () => {
    const { service } = serviceWith([
      { body: { ...answer, totals: { uniqueVisitors: null, visits: null, pageViews: 12, countedFrom: '2025-10-15' } } },
    ]);

    const stats = await service.get({ range: 'this-year', from: null, to: null });

    expect(stats.totals).toEqual({ uniqueVisitors: null, visits: null, pageViews: 12, countedFrom: '2025-10-15' });
  });

  it('refuses an answer whose count is not a number, so the page shows its failure', async () => {
    const { service } = serviceWith([
      { body: { ...answer, totals: { uniqueVisitors: 1, visits: 1, pageViews: 'many', countedFrom: null } } },
    ]);

    await expect(service.get({ range: 'last-30-days', from: null, to: null })).rejects.toBeInstanceOf(
      VisitorStatsContractError,
    );
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.get({ range: 'last-7-days', from: null, to: null }, controller.signal).then(
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
