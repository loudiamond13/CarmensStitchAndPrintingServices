// The public site service (PUB-02): one typed GET over the shared client.
import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { isHttpError } from '@/core/api/errors';
import { createFakeFetch } from '@/test/fakeFetch';
import { demoSite } from '@/test/publicFixtures';
import { createSiteService } from './siteService';

describe('siteService.getSite', () => {
  it('calls GET /api/v1/public/site once and resolves the typed body', async () => {
    const fake = createFakeFetch([{ body: demoSite }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const site = await createSiteService(client).getSite(new AbortController().signal);

    expect(site).toEqual(demoSite);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/public/site');
  });

  it('rejects with an HttpError when the read fails', async () => {
    const fake = createFakeFetch([
      { status: 500, headers: { 'Content-Type': 'application/problem+json' }, body: { title: 'Failed', status: 500 } },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, retry: { max: 0 } });

    const error = await createSiteService(client)
      .getSite()
      .then(
        () => undefined,
        (failure: unknown) => failure,
      );

    expect(isHttpError(error)).toBe(true);
  });
});
