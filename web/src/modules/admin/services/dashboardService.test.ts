import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { dashboardChartFixture, dashboardSummaryFixture } from '@/test/dashboardFixtures';
import { createFakeFetch } from '@/test/fakeFetch';
import { createDashboardService } from './dashboardService';

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
