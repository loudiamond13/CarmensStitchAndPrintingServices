// The consent service (ANL-07, OR-5): one typed POST over the shared client.
import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { isHttpError } from '@/core/api/errors';
import { createFakeFetch } from '@/test/fakeFetch';
import { demoDecision } from '@/test/consentFixtures';
import { createConsentService } from './consentService';

const body = { policyVersion: '0.1', stats: true, map: false, source: 'bar' } as const;

describe('consentService.record', () => {
  it('calls POST /api/v1/analytics/consent once with the body and resolves the typed answer', async () => {
    const fake = createFakeFetch([{ body: demoDecision }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const answer = await createConsentService(client).record(body);

    expect(answer).toEqual(demoDecision);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/analytics/consent');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(body);
  });

  it('rejects with an HttpError that carries the 409 code when the policy changed', async () => {
    const fake = createFakeFetch([
      {
        status: 409,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { title: 'The cookie policy changed.', status: 409, code: 'consent.policy-changed' },
      },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, retry: { max: 0 } });

    const error = await createConsentService(client)
      .record(body)
      .then(
        () => undefined,
        (failure: unknown) => failure,
      );

    expect(isHttpError(error) && error.status === 409 && error.code === 'consent.policy-changed').toBe(true);
  });
});

describe('consentService.clear', () => {
  it('calls POST /api/v1/analytics/clear once with no body and resolves the typed answer', async () => {
    const fake = createFakeFetch([{ body: { ...demoDecision, stats: false, map: false } }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const answer = await createConsentService(client).clear();

    expect(answer).toEqual({ ...demoDecision, stats: false, map: false });
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/analytics/clear');
    expect(fake.calls[0]?.body).toBeNull();
  });

  it('rejects with an HttpError that carries the 429 status when the clear limit is hit', async () => {
    const fake = createFakeFetch([
      {
        status: 429,
        headers: { 'Content-Type': 'application/problem+json', 'Retry-After': '30' },
        body: { title: 'Too many tries. Wait a minute and try again.', status: 429, code: 'rate-limited' },
      },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, retry: { max: 0 } });

    const error = await createConsentService(client)
      .clear()
      .then(
        () => undefined,
        (failure: unknown) => failure,
      );

    expect(isHttpError(error) && error.status === 429).toBe(true);
  });
});
