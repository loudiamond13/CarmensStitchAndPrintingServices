// The public content service (PUB-02, CONT-02): typed GETs over the shared client for the product lines and the Home data.
import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { isHttpError } from '@/core/api/errors';
import { createFakeFetch } from '@/test/fakeFetch';
import { demoHome, demoLines } from '@/test/publicFixtures';
import { createContentService } from './contentService';

describe('contentService.getHome', () => {
  it('calls GET /api/v1/public/home once and resolves the typed body', async () => {
    const fake = createFakeFetch([{ body: demoHome }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const home = await createContentService(client).getHome(new AbortController().signal);

    expect(home).toEqual(demoHome);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/public/home');
  });

  it('rejects with an HttpError when the read fails', async () => {
    const fake = createFakeFetch([
      { status: 500, headers: { 'Content-Type': 'application/problem+json' }, body: { title: 'Failed', status: 500 } },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, retry: { max: 0 } });

    const error = await createContentService(client)
      .getHome()
      .then(
        () => undefined,
        (failure: unknown) => failure,
      );

    expect(isHttpError(error)).toBe(true);
  });
});

describe('contentService.getProductLines', () => {
  it('calls GET /api/v1/public/product-lines once and resolves the typed body', async () => {
    const fake = createFakeFetch([{ body: demoLines }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const lines = await createContentService(client).getProductLines(new AbortController().signal);

    expect(lines).toEqual(demoLines);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/public/product-lines');
  });

  it('rejects with an HttpError when the read fails', async () => {
    const fake = createFakeFetch([
      { status: 500, headers: { 'Content-Type': 'application/problem+json' }, body: { title: 'Failed', status: 500 } },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, retry: { max: 0 } });

    const error = await createContentService(client)
      .getProductLines()
      .then(
        () => undefined,
        (failure: unknown) => failure,
      );

    expect(isHttpError(error)).toBe(true);
  });
});
