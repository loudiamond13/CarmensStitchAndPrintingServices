// The analytics service (ANL-05, ANL-06, OR-5): one typed POST over the shared client.
import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { isHttpError } from '@/core/api/errors';
import { createFakeFetch } from '@/test/fakeFetch';
import { createAnalyticsService } from './analyticsService';

describe('analyticsService.pageView', () => {
  it('calls POST /api/v1/analytics/page-views once with the path only, no idempotency key and no keepalive', async () => {
    const fake = createFakeFetch([{ status: 204 }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    await createAnalyticsService(client).pageView({ path: '/gallery' });

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/analytics/page-views');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ path: '/gallery' });
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(fake.calls[0]?.init).not.toHaveProperty('keepalive');
  });

  it('sends the anti-CSRF header the shared client carries', async () => {
    const fake = createFakeFetch([{ status: 204 }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, headers: { 'X-CSPS-CSRF': '1' } });

    await createAnalyticsService(client).pageView({ path: '/' });

    expect(fake.calls[0]?.headers.get('X-CSPS-CSRF')).toBe('1');
  });

  it('is not retried when the network fails, and rejects with the client error', async () => {
    const fake = createFakeFetch([{ networkError: true }, { status: 204 }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, sleep: () => Promise.resolve() });

    const error = await createAnalyticsService(client)
      .pageView({ path: '/' })
      .then(
        () => undefined,
        (failure: unknown) => failure,
      );

    expect(isHttpError(error)).toBe(true);
    expect(fake.calls).toHaveLength(1);
  });
});
