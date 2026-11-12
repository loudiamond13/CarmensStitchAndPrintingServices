// The product lines service (WEB-04, CONT-02): typed calls over the one HTTP client, generated types (D-16).
import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { demoLineDetail, lineListItem } from '@/test/siteContentFixtures';
import { createProductLinesService, type ProductLineRequest } from './productLinesService';

const line = demoLineDetail('polo');
const row = lineListItem(line);

const request: ProductLineRequest = {
  title: 'Polo Shirts',
  shortName: 'Polo',
  number: '',
  cardText: 'Card',
  description: 'Description',
  fabricText: 'Fabric',
  collarText: 'Collar',
  cutText: 'Cut',
  namesText: 'Names',
  logosText: 'Logos',
  startsAtPrice: 450,
  minimumQuantity: null,
  isActive: null,
  productTypeIds: null,
  version: line.version,
};

function clientFor(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createProductLinesService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
}

const problem = (status: number, extra: Record<string, unknown> = {}) => ({
  status,
  headers: { 'Content-Type': 'application/problem+json' },
  body: { title: 'x', status, ...extra },
});

async function rejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    () => expect.fail('expected the call to reject'),
    (rejected: unknown) => rejected,
  );
}

describe('productLinesService.list and get', () => {
  it('lists with GET /api/v1/product-lines once', async () => {
    const { fake, service } = clientFor([{ body: [row] }]);

    const result = await service.list(new AbortController().signal);

    expect(result).toEqual([row]);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/product-lines');
  });

  it('reads one line with GET /api/v1/product-lines/{id}', async () => {
    const { fake, service } = clientFor([{ body: line }]);

    const result = await service.get(line.id);

    expect(result).toEqual(line);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe(`/api/v1/product-lines/${line.id}`);
  });

  it('a line that is gone rejects with a 404 HttpError', async () => {
    const { service } = clientFor([problem(404, { code: 'product-lines.not-found' })]);

    expect(await rejection(service.get(line.id))).toMatchObject({ kind: 'http', status: 404 });
  });
});

describe('productLinesService.create (CONT-02, SEC-06)', () => {
  it('calls POST /api/v1/product-lines with the body and the one Idempotency-Key of the submission', async () => {
    const { fake, service } = clientFor([{ status: 201, body: line }]);

    const result = await service.create(request, 'key-1');

    expect(result).toEqual(line);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/product-lines');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(request);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
  });

  it('a 400 rejects with the field errors the server sent, a duplicate short name under shortName', async () => {
    const { service } = clientFor([
      problem(400, { errors: { shortName: ['Another product line already uses this short name.'] } }),
    ]);

    expect(await rejection(service.create(request, 'key-1'))).toMatchObject({
      status: 400,
      fieldErrors: { shortName: ['Another product line already uses this short name.'] },
    });
  });
});

describe('productLinesService.update (CONT-02, SEC-07)', () => {
  it('calls PUT /api/v1/product-lines/{id} with the version and no Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ body: line }]);

    const result = await service.update(line.id, request);

    expect(result).toEqual(line);
    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`/api/v1/product-lines/${line.id}`);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(request);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('a stale save rejects with a 409 HttpError carrying the edit.stale code', async () => {
    const { service } = clientFor([problem(409, { code: 'edit.stale' })]);

    expect(await rejection(service.update(line.id, request))).toMatchObject({
      kind: 'http',
      status: 409,
      code: 'edit.stale',
    });
  });
});

describe('productLinesService.move, hide, show (immediate actions)', () => {
  it('moves with POST {id}/move, the direction in the body and one Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ status: 204 }]);

    await service.move(line.id, 'up', 'key-2');

    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe(`/api/v1/product-lines/${line.id}/move`);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ direction: 'up' });
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-2');
  });

  it('hides and shows with POST {id}/hide and {id}/show, each with its Idempotency-Key and no body', async () => {
    const { fake, service } = clientFor([{ status: 204 }, { status: 204 }]);

    await service.hide(line.id, 'key-3');
    await service.show(line.id, 'key-4');

    expect(fake.calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `POST /api/v1/product-lines/${line.id}/hide`,
      `POST /api/v1/product-lines/${line.id}/show`,
    ]);
    expect(fake.calls.map((call) => call.headers.get('Idempotency-Key'))).toEqual(['key-3', 'key-4']);
    expect(fake.calls[0]?.body).toBeNull();
  });
});

describe('productLinesService.remove (CONT-02, D-08)', () => {
  it('calls DELETE /api/v1/product-lines/{id} with no body and no Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ status: 204 }]);

    await service.remove(line.id);

    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`/api/v1/product-lines/${line.id}`);
    expect(fake.calls[0]?.body).toBeNull();
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('a line in use rejects with a 422 HttpError carrying the product-lines.in-use code', async () => {
    const { service } = clientFor([problem(422, { code: 'product-lines.in-use' })]);

    expect(await rejection(service.remove(line.id))).toMatchObject({
      kind: 'http',
      status: 422,
      code: 'product-lines.in-use',
    });
  });
});

describe('productLinesService.uploadPhoto (CONT-02, D-02)', () => {
  it('posts a multipart form with the file part to /product-lines/{id}/photos/{slot} under the given key', async () => {
    const photo = { slot: 'main', src: '/a', srcSet: '/a 1w', width: 1600, height: 2000 };
    const { fake, service } = clientFor([{ body: photo }]);
    const file = new Blob(['jpeg bytes'], { type: 'image/jpeg' });

    await expect(service.uploadPhoto(line.id, 'main', file, 'front.jpg', 'key-9')).resolves.toEqual(photo);

    const call = fake.calls[0];
    expect(call?.method).toBe('POST');
    expect(call?.url).toBe(`/api/v1/product-lines/${line.id}/photos/main`);
    expect(call?.headers.get('Idempotency-Key')).toBe('key-9');
    expect(call?.body).toBeInstanceOf(FormData);
    const part = (call?.body as FormData).get('file');
    expect(part).toBeInstanceOf(Blob);
    expect((part as File).name).toBe('front.jpg');
  });

  it('a refused photo rejects with the 400 HttpError and its code', async () => {
    const { service } = clientFor([problem(400, { code: 'images.type' })]);

    expect(await rejection(service.uploadPhoto(line.id, 'back', new Blob(['x']), 'a.svg', 'key-1'))).toMatchObject({
      kind: 'http',
      status: 400,
      code: 'images.type',
    });
  });
});

describe('productLinesService.removePhoto (CONT-02, D-02)', () => {
  it('calls DELETE /product-lines/{id}/photos/{slot} with no body and no Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ status: 204 }]);

    await service.removePhoto(line.id, 'fabric');

    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`/api/v1/product-lines/${line.id}/photos/fabric`);
    expect(fake.calls[0]?.body).toBeNull();
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('an empty slot rejects with a 404 HttpError', async () => {
    const { service } = clientFor([problem(404, { code: 'product-lines.photo-not-found' })]);

    expect(await rejection(service.removePhoto(line.id, 'main'))).toMatchObject({ kind: 'http', status: 404 });
  });
});
