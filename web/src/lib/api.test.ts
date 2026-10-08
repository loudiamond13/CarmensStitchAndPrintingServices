// api.ts is the one endpoint module (WEB-04). These tests drive it through the real HTTP client with a fake fetch.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from './http/httpClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { api, createApi, HttpError, isHttpError, type HttpErrorKind, type SiteSettings } from './api';

const settings: SiteSettings = {
  businessName: "Carmen's Stitch & Printing Services",
  timeZoneId: 'Asia/Manila',
  currencyCode: 'PHP',
  locale: 'en-PH',
  contactEmail: 'hello@example.test',
  contactPhone: '+63 900 000 0000',
  addressLine: 'Somewhere, Philippines',
  facebookUrl: 'https://www.facebook.com/example',
  rowVersion: 'AAAAAAAAB9E=',
};

async function rejection(promise: Promise<unknown>): Promise<HttpError> {
  try {
    await promise;
  } catch (error) {
    if (isHttpError(error)) {
      return error;
    }
    expect.fail(`expected an HttpError, got ${String(error)}`);
  }
  return expect.fail('expected the promise to reject');
}

describe('createApi: site.settings (GET /api/v1/site-settings)', () => {
  it('sends one GET to /api/v1/site-settings and resolves to the typed settings', async () => {
    const fake = createFakeFetch([{ status: 200, body: settings }]);
    const client = createApi(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    const result = await client.site.settings();

    expect(result).toEqual(settings);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/site-settings');
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('passes the caller signal through, so aborting rejects with kind aborted', async () => {
    const fake = createFakeFetch([{ hang: true }]);
    const client = createApi(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));
    const controller = new AbortController();

    const pending = client.site.settings(controller.signal);
    controller.abort();

    const error = await rejection(pending);
    const kind: HttpErrorKind = error.kind;
    expect(kind).toBe('aborted');
  });

  it('keeps two concurrent calls independent: aborting one leaves the other to resolve', async () => {
    const fake = createFakeFetch([{ hang: true }, { status: 200, body: settings }]);
    const client = createApi(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));
    const first = new AbortController();
    const second = new AbortController();

    const aborted = client.site.settings(first.signal);
    const resolved = client.site.settings(second.signal);
    // Both requests are in flight (the first one hangs) before the first is aborted.
    await vi.waitFor(() => {
      expect(fake.calls).toHaveLength(2);
    });
    first.abort();

    const [abortedOutcome, resolvedOutcome] = await Promise.allSettled([aborted, resolved]);
    expect(abortedOutcome.status).toBe('rejected');
    const reason: unknown = abortedOutcome.status === 'rejected' ? abortedOutcome.reason : undefined;
    expect(isHttpError(reason) ? reason.kind : 'not an HttpError').toBe('aborted');
    expect(resolvedOutcome).toEqual({ status: 'fulfilled', value: settings });
    expect(second.signal.aborted).toBe(false);
    expect(fake.calls).toHaveLength(2);
  });

  it('rejects with the HttpError api.ts re-exports, carrying the ProblemDetails', async () => {
    const fake = createFakeFetch([
      {
        status: 403,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { status: 403, title: 'You do not have access.', traceId: '00-abc-def-01' },
      },
    ]);
    const client = createApi(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch }));

    const error = await rejection(client.site.settings());

    expect(error).toBeInstanceOf(HttpError);
    expect(error.status).toBe(403);
    expect(error.traceId).toBe('00-abc-def-01');
  });
});

describe('api (the default instance)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls the same-origin /api/v1 base through the global fetch', async () => {
    const fake = createFakeFetch([{ status: 200, body: settings }]);
    vi.stubGlobal('fetch', fake.fetch);

    await expect(api.site.settings()).resolves.toEqual(settings);
    expect(fake.calls.map((call) => `${call.method} ${call.url}`)).toEqual(['GET /api/v1/site-settings']);
    expect(fake.calls[0]?.init.credentials).toBe('same-origin');
  });
});
