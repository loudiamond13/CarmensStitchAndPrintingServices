// The shop closures service (WEB-04, CONT-04): typed calls over the one HTTP client, generated types (D-16).
import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { demoClosures } from '@/test/siteContentFixtures';
import { createShopClosuresService, type ShopClosureRequest } from './shopClosuresService';

const closure = demoClosures[0];
if (closure === undefined) {
  throw new Error('The demo closures are empty.');
}

const request: ShopClosureRequest = { firstDay: '2026-12-25', lastDay: null, note: 'Christmas', version: null };

function clientFor(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createShopClosuresService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

describe('shopClosuresService.list', () => {
  it('calls GET /api/v1/shop-closures once and resolves the typed list', async () => {
    const { fake, service } = clientFor([{ body: demoClosures }]);

    const result = await service.list(new AbortController().signal);

    expect(result).toEqual(demoClosures);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/shop-closures');
  });
});

describe('shopClosuresService.create (CONT-04, SEC-06)', () => {
  it('calls POST /api/v1/shop-closures with the body and the one Idempotency-Key of the submission', async () => {
    const { fake, service } = clientFor([{ status: 201, body: closure }]);

    const result = await service.create(request, 'key-1');

    expect(result).toEqual(closure);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/shop-closures');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(request);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
  });

  it('a 400 rejects with the field errors the server sent', async () => {
    const { service } = clientFor([
      {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { title: 'x', status: 400, errors: { firstDay: ["There's already a closure on Dec 25, 2026."] } },
      },
    ]);

    const error = await service.create(request, 'key-1').then(
      () => expect.fail('expected the call to reject'),
      (rejected: unknown) => rejected,
    );

    expect(error).toMatchObject({
      status: 400,
      fieldErrors: { firstDay: ["There's already a closure on Dec 25, 2026."] },
    });
  });
});

describe('shopClosuresService.update (CONT-04, SEC-07)', () => {
  it('calls PUT /api/v1/shop-closures/{id} with the version and no Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ body: closure }]);
    const edit = { ...request, version: closure.version };

    const result = await service.update(closure.id, edit);

    expect(result).toEqual(closure);
    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`/api/v1/shop-closures/${closure.id}`);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(edit);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('a stale save rejects with a 409 HttpError carrying the edit.stale code', async () => {
    const { service } = clientFor([
      {
        status: 409,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { title: 'x', status: 409, code: 'edit.stale' },
      },
    ]);

    const error = await service.update(closure.id, request).then(
      () => expect.fail('expected the call to reject'),
      (rejected: unknown) => rejected,
    );

    expect(error).toMatchObject({ kind: 'http', status: 409, code: 'edit.stale' });
  });
});

describe('shopClosuresService.remove (CONT-04)', () => {
  it('calls DELETE /api/v1/shop-closures/{id} with no body and no Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ status: 204 }]);

    await service.remove(closure.id);

    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`/api/v1/shop-closures/${closure.id}`);
    expect(fake.calls[0]?.body).toBeNull();
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('a closure that is already gone rejects with a 404 HttpError', async () => {
    const { service } = clientFor([
      {
        status: 404,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { title: 'x', status: 404, code: 'shop-closures.not-found' },
      },
    ]);

    const error = await service.remove(closure.id).then(
      () => expect.fail('expected the call to reject'),
      (rejected: unknown) => rejected,
    );

    expect(error).toMatchObject({ kind: 'http', status: 404, code: 'shop-closures.not-found' });
  });
});
