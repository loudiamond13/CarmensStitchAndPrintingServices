// The opening hours service (WEB-04, CONT-01): typed calls over the one HTTP client, generated types (D-16).
import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { demoOpeningHours } from '@/test/siteContentFixtures';
import { createOpeningHoursService, type UpdateOpeningHoursRequest } from './openingHoursService';

const saveRequest: UpdateOpeningHoursRequest = {
  version: demoOpeningHours.version,
  days: demoOpeningHours.days.map((day) => (day.day === 7 ? { day: 7, opensAt: '10:00', closesAt: '15:00' } : day)),
};

describe('openingHoursService.get', () => {
  it('calls GET /api/v1/opening-hours once and resolves the typed body', async () => {
    const fake = createFakeFetch([{ body: demoOpeningHours }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const result = await createOpeningHoursService(client).get(new AbortController().signal);

    expect(result).toEqual(demoOpeningHours);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/opening-hours');
  });
});

describe('openingHoursService.update (CONT-01, SEC-07)', () => {
  it('calls PUT /api/v1/opening-hours with the version and the seven days, no Idempotency-Key, and resolves the saved week', async () => {
    const saved = { ...demoOpeningHours, version: 'AAAAAAAAC10=' };
    const fake = createFakeFetch([{ body: saved }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const result = await createOpeningHoursService(client).update(saveRequest);

    expect(result).toEqual(saved);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe('/api/v1/opening-hours');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(saveRequest);
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

    const error = await createOpeningHoursService(client)
      .update(saveRequest)
      .then(
        () => expect.fail('expected the call to reject'),
        (rejected: unknown) => rejected,
      );

    expect(error).toMatchObject({ kind: 'http', status: 409, code: 'edit.stale' });
  });
});
