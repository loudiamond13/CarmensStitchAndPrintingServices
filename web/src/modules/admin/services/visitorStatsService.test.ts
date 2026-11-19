import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { createVisitorStatsService, VisitorStatsContractError, type VisitorStatsResponse } from './visitorStatsService';

// The visitor stats call (ANL-08, D-57, D-70): Manager only, one GET, every count from the server. The browser keeps the page
// view total, the trend and the top pages.

const answer: VisitorStatsResponse = {
  range: 'last-30-days',
  from: '2026-10-17',
  to: '2026-11-15',
  pageViews: 4567,
  bucket: 'day',
  trend: [{ start: '2026-10-17', pageViews: 3 }],
  topPages: [{ name: 'gallery', count: 412, share: 100 }],
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

  it('maps the answer to page views, the trend and the top pages', async () => {
    const { service } = serviceWith([{ body: { ...answer, pageViews: '4567' } }]);

    const stats = await service.get({ range: 'last-30-days', from: null, to: null });

    expect(Object.keys(stats).sort().join(',')).toBe('bucket,from,pageViews,range,to,topPages,trend');
    expect(stats).toEqual({
      range: 'last-30-days',
      from: '2026-10-17',
      to: '2026-11-15',
      pageViews: 4567,
      bucket: 'day',
      trend: [{ start: '2026-10-17', pageViews: 3 }],
      topPages: [{ name: 'gallery', count: 412, share: 100 }],
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

  it('narrows each trend bucket to its start and a plain page view count', async () => {
    const { service } = serviceWith([
      {
        body: {
          ...answer,
          bucket: 'month',
          trend: [
            { start: '2025-09-01', pageViews: '40' },
            { start: '2025-10-01', pageViews: 12 },
          ],
        },
      },
    ]);

    const stats = await service.get({ range: 'custom', from: '2025-09-01', to: '2025-10-31' });

    expect(stats.bucket).toBe('month');
    expect(stats.trend).toEqual([
      { start: '2025-09-01', pageViews: 40 },
      { start: '2025-10-01', pageViews: 12 },
    ]);
  });

  it.each([
    ['a bucket size it does not know', { bucket: 'week' }],
    ['no page view total', { pageViews: undefined }],
    ['a page view total that is not a number', { pageViews: 'many' }],
    ['a trend bucket with no page view count', { trend: [{ start: '2026-10-17' }] }],
    ['a trend count that is not a number', { trend: [{ start: '2026-10-17', pageViews: 'lots' }] }],
    ['a page count that is not a number', { topPages: [{ name: 'home', count: 'lots', share: 100 }] }],
    ['a share that is not a number', { topPages: [{ name: 'home', count: 1, share: 'all' }] }],
  ])('refuses an answer with %s', async (_, change) => {
    const { service } = serviceWith([{ body: { ...answer, ...change } }]);

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

describe('visitorStatsService.exportCsv', () => {
  const csv = 'Date,Page,Page views\r\n2026-11-13,Home,7\r\n2026-11-15,Gallery,5\r\n';
  const disposition = (name: string) => `attachment; filename="${name}"`;
  const csvAnswer = {
    body: csv,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': disposition('visitor-stats-2026-11-13-to-2026-11-15.csv'),
    },
  };

  it('asks GET /api/v1/visitor-stats/export for text/csv with the range and keeps the server file name', async () => {
    const { fake, service } = serviceWith([csvAnswer]);

    const file = await service.exportCsv({ range: 'custom', from: '2026-11-13', to: '2026-11-15' });

    expect(file).toEqual({ text: csv, fileName: 'visitor-stats-2026-11-13-to-2026-11-15.csv' });
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/visitor-stats/export');
    expect(Object.fromEntries(url.searchParams)).toEqual({ range: 'custom', from: '2026-11-13', to: '2026-11-15' });
    expect(fake.calls[0]?.headers.get('Accept')).toBe('text/csv');
  });

  it('names a preset file with the dates the server used, which the page cannot know', async () => {
    const { service } = serviceWith([
      {
        body: csv,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': disposition('visitor-stats-2026-10-17-to-2026-11-15.csv'),
        },
      },
    ]);

    const file = await service.exportCsv({ range: 'last-30-days', from: null, to: null });

    expect(file.fileName).toBe('visitor-stats-2026-10-17-to-2026-11-15.csv');
  });

  it('sends a preset by name only', async () => {
    const { fake, service } = serviceWith([csvAnswer]);

    await service.exportCsv({ range: 'last-7-days', from: null, to: null });

    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(Object.fromEntries(url.searchParams)).toEqual({ range: 'last-7-days' });
  });

  it('accepts the header alone, which is a range with no views', async () => {
    const { service } = serviceWith([{ ...csvAnswer, body: 'Date,Page,Page views\r\n' }]);

    const file = await service.exportCsv({ range: 'last-30-days', from: null, to: null });

    expect(file.text).toBe('Date,Page,Page views\r\n');
  });

  it('drops a byte-order mark the transport kept', async () => {
    const { service } = serviceWith([{ ...csvAnswer, body: `﻿${csv}` }]);

    const file = await service.exportCsv({ range: 'last-30-days', from: null, to: null });

    expect(file.text).toBe(csv);
  });

  it.each([
    ['the old four-column header', 'Date,Unique visitors,Visits,Page views\r\n2026-11-15,1,2,3\r\n'],
    ['another header', 'Day,Views\r\n2026-11-15,3\r\n'],
    ['a row that does not start with a date', 'Date,Page,Page views\r\nyesterday,Home,1\r\n'],
    ['a row with a text count', 'Date,Page,Page views\r\n2026-11-15,Home,many\r\n'],
  ])('refuses %s, so the page shows the failure', async (_case, text) => {
    const { service } = serviceWith([{ ...csvAnswer, body: text }]);

    await expect(service.exportCsv({ range: 'last-30-days', from: null, to: null })).rejects.toBeInstanceOf(
      VisitorStatsContractError,
    );
  });

  it.each([
    ['no file name header', undefined],
    ['a file name that is not the server pattern', disposition('../evil.csv')],
    ['a file name with a bad date', disposition('visitor-stats-2026-13-01-to-2026-11-15.csv')],
  ])('refuses a file with %s', async (_case, header) => {
    const headers: Record<string, string> = { 'Content-Type': 'text/csv' };
    if (header !== undefined) headers['Content-Disposition'] = header;
    const { service } = serviceWith([{ body: csv, headers }]);

    await expect(service.exportCsv({ range: 'last-30-days', from: null, to: null })).rejects.toBeInstanceOf(
      VisitorStatsContractError,
    );
  });
});
