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
  topPages: [{ name: 'gallery', count: 412, share: 100 }],
  referrers: [],
  devices: [],
  browsers: [],
  speed: { lcp: null, cls: null, inp: null, pageViews: 0, available: true },
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
      topPages: [{ name: 'gallery', count: 412, share: 100 }],
      referrers: [],
      devices: [],
      browsers: [],
      speed: { lcp: null, cls: null, inp: null, pageViews: 0, available: true },
    });
  });

  it('narrows page speed to plain numbers and keeps a measure with no sample as null', async () => {
    const { service } = serviceWith([
      {
        body: {
          ...answer,
          speed: {
            lcp: { p75: '2400.000', rating: 'good', samples: 412 },
            cls: null,
            inp: { p75: 320, rating: 'needs-work', samples: '9' },
            pageViews: '412',
            available: true,
          },
        },
      },
    ]);

    const stats = await service.get({ range: 'last-30-days', from: null, to: null });

    expect(stats.speed.lcp?.p75).toBe(2400);
    expect(stats.speed).toEqual({
      lcp: { p75: 2400, rating: 'good', samples: 412 },
      cls: null,
      inp: { p75: 320, rating: 'needs-work', samples: 9 },
      pageViews: 412,
      available: true,
    });
  });

  it('narrows each ranked row to plain numbers and keeps the order and shares the server sent', async () => {
    const { service } = serviceWith([
      {
        body: {
          ...answer,
          topPages: [
            { name: 'gallery', count: '412', share: 38 },
            { name: 'home', count: 300, share: '62' },
          ],
        },
      },
    ]);

    const stats = await service.get({ range: 'last-30-days', from: null, to: null });

    expect(stats.topPages).toEqual([
      { name: 'gallery', count: 412, share: 38 },
      { name: 'home', count: 300, share: 62 },
    ]);
  });

  it('narrows the source, device and browser lists the same way', async () => {
    const { service } = serviceWith([
      {
        body: {
          ...answer,
          referrers: [{ name: 'Facebook', count: '5', share: 100 }],
          devices: [{ name: 'Phone', count: 5, share: '100' }],
          browsers: [{ name: 'Other', count: 5, share: 100 }],
        },
      },
    ]);

    const stats = await service.get({ range: 'last-30-days', from: null, to: null });

    expect([stats.referrers, stats.devices, stats.browsers]).toEqual([
      [{ name: 'Facebook', count: 5, share: 100 }],
      [{ name: 'Phone', count: 5, share: 100 }],
      [{ name: 'Other', count: 5, share: 100 }],
    ]);
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
    ['a page count that is not a number', { topPages: [{ name: 'home', count: 'lots', share: 100 }] }],
    ['a share that is not a number', { topPages: [{ name: 'home', count: 1, share: 'all' }] }],
    ['a source count that is not a number', { referrers: [{ name: 'Direct', count: 'lots', share: 100 }] }],
    ['a device share that is not a number', { devices: [{ name: 'Phone', count: 1, share: 'all' }] }],
    ['a browser count that is not a number', { browsers: [{ name: 'Chrome', count: 'lots', share: 100 }] }],
    [
      'a speed rating it does not know',
      { speed: { ...answer.speed, lcp: { p75: 2400, rating: 'great', samples: 1 } } },
    ],
    [
      'a speed figure that is not a number',
      { speed: { ...answer.speed, cls: { p75: 'fast', rating: 'good', samples: 1 } } },
    ],
    ['a speed page view count that is not a number', { speed: { ...answer.speed, pageViews: 'many' } }],
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
