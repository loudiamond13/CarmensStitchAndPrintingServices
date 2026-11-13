// The site settings service (WEB-04): typed calls over the one HTTP client, generated types (D-16).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDeferred, createFakeFetch, type Plan } from '@/test/fakeFetch';
import { createHttpClient } from '@/core/api/apiClient';
import { HttpError, isHttpError } from '@/core/api/errors';
import {
  createSiteSettingsService,
  siteSettingsService,
  type SiteSettings,
  type UpdateSiteSettingsRequest,
} from './siteSettingsService';

const settings: SiteSettings = {
  businessName: "Carmen's Stitch & Printing Services",
  tagline: 'Sample tagline',
  aboutText: null,
  turnaroundLine: null,
  street: '12 Sample St., Poblacion',
  townOrCity: 'Sample City',
  province: 'Sample Province',
  postalCode: '1000',
  directionsUrl: 'https://maps.app.goo.gl/abc123',
  mapEmbedUrl: null,
  messengerUrl: 'https://m.me/cspsdemo',
  facebookUrl: 'https://www.facebook.com/example',
  instagramUrl: null,
  tiktokUrl: null,
  contactEmail: 'hello@example.ph',
  phones: [{ number: '0917 123 4567', label: 'Globe', isMain: true }],
  timeZoneId: 'Asia/Manila',
  currencyCode: 'PHP',
  locale: 'en-PH',
  version: 'AAAAAAAAB9E=',
  updatedByName: null,
  updatedAtUtc: null,
  sharePicture: null,
};

const notFound: Plan = {
  status: 404,
  headers: { 'Content-Type': 'application/problem+json' },
  body: { title: 'Not found', status: 404, traceId: '00-abc-01' },
};

const unauthorized: Plan = {
  status: 401,
  headers: { 'Content-Type': 'application/problem+json' },
  body: { title: 'Sign in again', status: 401 },
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

describe('siteSettingsService.get (WEB-04)', () => {
  it('calls GET /api/v1/site-settings once and resolves the typed body', async () => {
    const fake = createFakeFetch([{ body: settings }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const result: SiteSettings = await createSiteSettingsService(client).get(new AbortController().signal);

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

    const pending = rejection(createSiteSettingsService(client).get(controller.signal));
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(1);
    });
    controller.abort();
    const error = await pending;

    expect(isHttpError(error)).toBe(true);
    expect(error).toMatchObject({ kind: 'aborted' });
  });

  it('a ProblemDetails failure rejects with an HttpError', async () => {
    const fake = createFakeFetch([notFound]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const error = await rejection(createSiteSettingsService(client).get());

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ kind: 'http', status: 404, traceId: '00-abc-01' });
  });

  it('the shared service calls the same-origin /api/v1 base through the global fetch', async () => {
    const fake = createFakeFetch([{ body: settings }]);
    vi.stubGlobal('fetch', fake.fetch);

    await expect(siteSettingsService.get()).resolves.toEqual(settings);

    expect(fake.calls.map((call) => call.url)).toEqual(['/api/v1/site-settings']);
    expect(fake.calls[0]?.init.credentials).toBe('same-origin');
  });
});

const saveRequest: UpdateSiteSettingsRequest = {
  version: settings.version,
  businessName: 'Sample Shop',
  tagline: 'A new tagline',
  aboutText: null,
  turnaroundLine: null,
  street: '12 Sample St., Poblacion',
  townOrCity: 'Sample City',
  province: 'Sample Province',
  postalCode: '1000',
  directionsUrl: null,
  mapEmbedUrl: null,
  messengerUrl: null,
  facebookUrl: null,
  instagramUrl: null,
  tiktokUrl: null,
  contactEmail: null,
  phones: [{ number: '0917 123 4567', label: null, isMain: true }],
};

describe('siteSettingsService.update (CONT-01, SEC-07)', () => {
  it('calls PUT /api/v1/site-settings with the body, no Idempotency-Key, and resolves the saved settings', async () => {
    const saved: SiteSettings = { ...settings, tagline: 'A new tagline', version: 'AAAAAAAAB9I=' };
    const fake = createFakeFetch([{ body: saved }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const result = await createSiteSettingsService(client).update(saveRequest);

    expect(result).toEqual(saved);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe('/api/v1/site-settings');
    const sent: unknown = JSON.parse(String(fake.calls[0]?.body));
    expect(sent).toEqual(saveRequest);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('a stale save rejects with a 409 HttpError carrying the edit.stale code', async () => {
    const fake = createFakeFetch([
      {
        status: 409,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { title: 'x', status: 409, code: 'edit.stale' },
      },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const error = await rejection(createSiteSettingsService(client).update(saveRequest));

    expect(error).toMatchObject({ kind: 'http', status: 409, code: 'edit.stale' });
  });

  it('a 400 rejects with the field errors the server sent', async () => {
    const fake = createFakeFetch([
      {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { title: 'x', status: 400, errors: { tagline: ['Enter a tagline.'] } },
      },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const error = await rejection(createSiteSettingsService(client).update(saveRequest));

    expect(error).toMatchObject({ status: 400, fieldErrors: { tagline: ['Enter a tagline.'] } });
  });
});

describe('one shared client (WEB-04 concurrency edge)', () => {
  it('three concurrent 401s through one client cause one refresh and three retries', async () => {
    const gate = createDeferred<undefined>();
    const refresh = vi.fn(async () => {
      await gate.promise;
    });
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([
      unauthorized,
      unauthorized,
      unauthorized,
      { body: settings },
      { body: settings },
      { body: settings },
    ]);
    const built = createSiteSettingsService(
      createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, refresh, onUnauthorized }),
    );

    const results = Promise.all([built.get(), built.get(), built.get()]);
    await vi.waitFor(() => {
      expect(refresh).toHaveBeenCalledTimes(1);
    });
    expect(fake.calls).toHaveLength(3);
    gate.resolve(undefined);

    await expect(results).resolves.toEqual([settings, settings, settings]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fake.calls).toHaveLength(6);
    expect(fake.calls.map((call) => call.url)).toEqual(Array<string>(6).fill('/api/v1/site-settings'));
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('a failed refresh rejects all three calls with a 401 and signs out once', async () => {
    const refresh = vi.fn(() => Promise.reject(new Error('session over')));
    const onUnauthorized = vi.fn();
    const fake = createFakeFetch([unauthorized, unauthorized, unauthorized]);
    const built = createSiteSettingsService(
      createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, refresh, onUnauthorized }),
    );

    const errors = await Promise.all([rejection(built.get()), rejection(built.get()), rejection(built.get())]);

    for (const error of errors) {
      expect(error).toBeInstanceOf(HttpError);
      expect(error).toMatchObject({ status: 401 });
    }
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fake.calls).toHaveLength(3);
  });
});
