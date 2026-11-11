import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import {
  dashboardChartFixture,
  dashboardNovemberSummary,
  dashboardRecentOrders,
  dashboardSummaryFixture,
} from '@/test/dashboardFixtures';
import { createFakeFetch } from '@/test/fakeFetch';
import { createDashboardService, DashboardContractError, parseDashboardSummary } from './dashboardService';

// The dashboard call (DASH-01): typed, over the one HTTP client.

afterEach(() => {
  vi.unstubAllGlobals();
});

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createDashboardService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

describe('dashboardService.summary', () => {
  it('calls GET /api/v1/dashboard/summary with no parameters and resolves the typed summary', async () => {
    const summary = dashboardSummaryFixture();
    const { fake, service } = serviceWith([{ body: summary }]);

    await expect(service.summary()).resolves.toEqual(summary);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/dashboard/summary');
    expect(url.search).toBe('');
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.summary(controller.signal).then(
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

describe('dashboardService.chart (DASH-03)', () => {
  it('calls GET /api/v1/dashboard/chart?months=12 and resolves the typed months', async () => {
    const chart = dashboardChartFixture(12);
    const { fake, service } = serviceWith([{ body: chart }]);

    await expect(service.chart(12)).resolves.toEqual(chart);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    const url = new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid');
    expect(url.pathname).toBe('/api/v1/dashboard/chart');
    expect(url.search).toBe('?months=12');
  });

  it('asks for 6 months with months=6', async () => {
    const { fake, service } = serviceWith([{ body: dashboardChartFixture(6) }]);

    await service.chart(6);

    expect(new URL(fake.calls[0]?.url ?? '', 'https://csps.invalid').search).toBe('?months=6');
  });

  it.each([0, 5, 7, 24, 6.5, Number.NaN])('refuses %s months and sends no request', async (months) => {
    const { fake, service } = serviceWith([{ body: dashboardChartFixture(6) }]);

    await expect(service.chart(months as never)).rejects.toBeInstanceOf(RangeError);

    expect(fake.calls).toHaveLength(0);
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const { fake, service } = serviceWith([{ hang: true }]);
    const controller = new AbortController();

    const pending = service.chart(6, controller.signal).then(
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

describe('parseDashboardSummary (WR-02)', () => {
  it('returns every figure, count and percent as a plain number and keeps the rest as sent', () => {
    const summary = parseDashboardSummary(
      dashboardNovemberSummary({
        orders: { active: '18', dueThisWeek: 5, overdue: '2', receivables: '84300.50' },
        collected: { thisMonth: '126450.00', comparison: 112900, changePercent: '12', comparisonThrough: '2026-10-04' },
        expenses: { thisMonth: 58320, count: '23', topCategory: 'Rent' },
      }),
    );

    expect(summary.orders).toEqual({ active: 18, dueThisWeek: 5, overdue: 2, receivables: 84300.5 });
    expect(summary.collected).toEqual({
      thisMonth: 126450,
      comparison: 112900,
      changePercent: 12,
      comparisonThrough: '2026-10-04',
    });
    expect(summary.expenses).toEqual({ thisMonth: 58320, count: 23, topCategory: 'Rent' });
    expect(summary.statuses.map((entry) => entry.count)).toEqual([4, 2, 7, 3, 2, 11]);
    expect(summary.today).toBe('2026-11-04');
    expect(summary.firstName).toBe('Carmen');
  });

  it('keeps a missing percent as null', () => {
    const summary = parseDashboardSummary(
      dashboardSummaryFixture({
        collected: { thisMonth: 0, comparison: 0, changePercent: null, comparisonThrough: '2026-09-06' },
      }),
    );

    expect(summary.collected.changePercent).toBeNull();
  });

  it('returns the total, balance and credit of each recent order as numbers', () => {
    const [first] = parseDashboardSummary(
      dashboardSummaryFixture({
        recentOrders: dashboardRecentOrders().map((entry) => ({ ...entry, total: '1250.50' })),
      }),
    ).recentOrders;

    expect(first?.total).toBe(1250.5);
    expect(typeof first?.balance).toBe('number');
    expect(typeof first?.customerCredit).toBe('number');
  });

  it.each([
    ['receivables', dashboardSummaryFixture({ orders: { active: 1, dueThisWeek: 0, overdue: 0, receivables: 'abc' } })],
    ['active orders', dashboardSummaryFixture({ orders: { active: '', dueThisWeek: 0, overdue: 0, receivables: 0 } })],
    [
      'collected',
      dashboardSummaryFixture({
        collected: { thisMonth: '12,450.00', comparison: 0, changePercent: null, comparisonThrough: '2026-09-06' },
      }),
    ],
    [
      'percent',
      dashboardSummaryFixture({
        collected: { thisMonth: 0, comparison: 0, changePercent: 'up', comparisonThrough: '2026-09-06' },
      }),
    ],
    ['expenses count', dashboardSummaryFixture({ expenses: { thisMonth: 0, count: 'many', topCategory: null } })],
    ['status count', dashboardSummaryFixture({ statuses: [{ status: 'pending', count: 'x' }] })],
    [
      'recent order total',
      dashboardSummaryFixture({ recentOrders: dashboardRecentOrders().map((entry) => ({ ...entry, total: 'n/a' })) }),
    ],
    [
      'recent order balance',
      dashboardSummaryFixture({ recentOrders: dashboardRecentOrders().map((entry) => ({ ...entry, balance: '' })) }),
    ],
  ])('refuses the whole answer when the %s is not a finite figure', (_name, response) => {
    expect(() => parseDashboardSummary(response)).toThrow(DashboardContractError);
    expect(() => parseDashboardSummary(response)).toThrow('is not a finite number.');
  });
});
