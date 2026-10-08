// api.ts is the single endpoint module (WEB-04): typed calls over the one HTTP client, generated types (D-16).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFakeFetch, type Plan } from '@/test/fakeFetch';
import { createHttpClient } from '@/lib/http/httpClient';
import { api, createApi, HttpError, isHttpError, type Api, type SiteSettings } from './api';

const settings: SiteSettings = {
  businessName: "Carmen's Stitch & Printing Services",
  timeZoneId: 'Asia/Manila',
  currencyCode: 'PHP',
  locale: 'en-PH',
  contactEmail: 'hello@example.ph',
  contactPhone: '+63 912 345 6789',
  addressLine: 'Quezon City, Metro Manila',
  facebookUrl: 'https://www.facebook.com/example',
  rowVersion: 'AAAAAAAAB9E=',
};

const notFound: Plan = {
  status: 404,
  headers: { 'Content-Type': 'application/problem+json' },
  body: { title: 'Not found', status: 404, traceId: '00-abc-01' },
};

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => expect.fail('expected the call to reject'),
    (error: unknown) => error,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api.site.settings (WEB-04)', () => {
  it('calls GET /api/v1/site-settings once and resolves the typed body', async () => {
    const fake = createFakeFetch([{ body: settings }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const result: SiteSettings = await createApi(client).site.settings(new AbortController().signal);

    expect(result).toEqual(settings);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/site-settings');
    expect(fake.calls[0]?.body).toBeNull();
  });

  it("passes the caller's signal, so cancelling rejects with kind aborted", async () => {
    const fake = createFakeFetch([{ hang: true }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });
    const controller = new AbortController();

    const pending = rejection(createApi(client).site.settings(controller.signal));
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(1);
    });
    controller.abort();
    const error = await pending;

    expect(isHttpError(error)).toBe(true);
    expect(error).toMatchObject({ kind: 'aborted' });
  });

  it('a ProblemDetails failure rejects with the re-exported HttpError', async () => {
    const fake = createFakeFetch([notFound]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const error = await rejection(createApi(client).site.settings());

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ kind: 'http', status: 404, traceId: '00-abc-01' });
  });

  it('the shared api instance calls the same-origin /api/v1 base through the global fetch', async () => {
    const fake = createFakeFetch([{ body: settings }]);
    vi.stubGlobal('fetch', fake.fetch);

    await expect(api.site.settings()).resolves.toEqual(settings);

    expect(fake.calls.map((call) => call.url)).toEqual(['/api/v1/site-settings']);
    expect(fake.calls[0]?.init.credentials).toBe('same-origin');
  });
});

describe('api groups', () => {
  it('declares every area group, and only site holds a call in Phase 2', () => {
    const fake = createFakeFetch([]);
    const built: Api = createApi(createHttpClient({ fetch: fake.fetch }));

    expect(Object.keys(built).sort()).toEqual(
      ['analytics', 'auth', 'expenses', 'inquiries', 'orders', 'profile', 'site', 'users'].sort(),
    );
    expect(Object.keys(built.site)).toEqual(['settings']);
    for (const group of ['auth', 'orders', 'expenses', 'users', 'analytics', 'profile', 'inquiries'] as const) {
      expect(Object.keys(built[group])).toEqual([]);
    }
    expect(Object.keys(api).sort()).toEqual(Object.keys(built).sort());
    expect(fake.calls).toHaveLength(0);
  });
});
