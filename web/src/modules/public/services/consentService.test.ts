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
    expect(fake.calls[0]?.body).toEqual(body);
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
