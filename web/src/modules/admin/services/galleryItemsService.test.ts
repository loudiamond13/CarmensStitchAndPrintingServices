// The gallery items service (WEB-04, GAL-03): typed calls over the one HTTP client, generated types (D-16).
import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { demoGalleryItems, GALLERY_IDS } from '@/test/siteContentFixtures';
import { createGalleryItemsService, type GalleryUploadRequest } from './galleryItemsService';

const [upload] = demoGalleryItems();
if (upload === undefined) {
  throw new Error('The demo gallery items are empty.');
}

const request: GalleryUploadRequest = {
  teamName: upload.name,
  productLineId: upload.lineId,
  pieces: 12,
  note: 'Dri-fit mesh, V-neck',
  isShown: true,
  version: upload.version,
};

function clientFor(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createGalleryItemsService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
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

describe('galleryItemsService.list', () => {
  it('reads one page with GET /api/v1/gallery-items and the page and size, with no line when none is chosen', async () => {
    const { fake, service } = clientFor([{ body: { rows: [upload], total: 1, page: 2, size: 50 } }]);

    const result = await service.list({ line: null, page: 2, pageSize: 50 });

    expect(result.total).toBe(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/gallery-items?page=2&pageSize=50');
  });

  it('sends the line when one is chosen', async () => {
    const { fake, service } = clientFor([{ body: { rows: [], total: 0, page: 1, size: 20 } }]);

    await service.list({ line: GALLERY_IDS.newUpload, page: 1, pageSize: 20 });

    expect(fake.calls[0]?.url).toBe(`/api/v1/gallery-items?line=${GALLERY_IDS.newUpload}&page=1&pageSize=20`);
  });
});

describe('galleryItemsService.create (GAL-03, SEC-06)', () => {
  it('sends POST /api/v1/gallery-items as a multipart form with the file and every field, and the one Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ status: 201, body: upload }]);

    const result = await service.create(
      {
        file: new Blob(['jpeg'], { type: 'image/jpeg' }),
        fileName: 'riders.jpg',
        teamName: 'Sample Barangay Riders',
        productLineId: GALLERY_IDS.newUpload,
        pieces: 12,
        note: 'Dri-fit mesh, V-neck',
        isShown: true,
      },
      'key-1',
    );

    expect(result).toEqual(upload);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/gallery-items');
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
    const form = fake.calls[0]?.body;
    expect(form).toBeInstanceOf(FormData);
    expect((form as FormData).get('teamName')).toBe('Sample Barangay Riders');
    expect((form as FormData).get('productLineId')).toBe(GALLERY_IDS.newUpload);
    expect((form as FormData).get('pieces')).toBe('12');
    expect((form as FormData).get('note')).toBe('Dri-fit mesh, V-neck');
    expect((form as FormData).get('isShown')).toBe('true');
    expect(((form as FormData).get('file') as File).name).toBe('riders.jpg');
  });

  it('leaves the pieces part out when there are none, and sends isShown false as text', async () => {
    const { fake, service } = clientFor([{ status: 201, body: upload }]);

    await service.create(
      {
        file: new Blob(['jpeg'], { type: 'image/jpeg' }),
        fileName: 'riders.jpg',
        teamName: 'Sample Barangay Riders',
        productLineId: GALLERY_IDS.newUpload,
        pieces: null,
        note: '',
        isShown: false,
      },
      'key-2',
    );

    const form = fake.calls[0]?.body as FormData;
    expect(form.has('pieces')).toBe(false);
    expect(form.get('isShown')).toBe('false');
  });

  it('a 400 rejects with the field errors the server sent', async () => {
    const { service } = clientFor([problem(400, { errors: { teamName: ['Enter the team or name.'] } })]);

    expect(
      await rejection(
        service.create(
          {
            file: new Blob(['x']),
            fileName: 'a.jpg',
            teamName: '',
            productLineId: '',
            pieces: null,
            note: '',
            isShown: true,
          },
          'key-3',
        ),
      ),
    ).toMatchObject({ status: 400, fieldErrors: { teamName: ['Enter the team or name.'] } });
  });
});

describe('galleryItemsService.update (GAL-03, SEC-07)', () => {
  it('calls PUT /api/v1/gallery-items/{id} with the body and the version, and no Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ body: upload }]);

    await service.update(upload.id, request);

    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`/api/v1/gallery-items/${upload.id}`);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(request);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('a stale version rejects with 409 and its machine code', async () => {
    const { service } = clientFor([problem(409, { code: 'edit.stale' })]);

    expect(await rejection(service.update(upload.id, request))).toMatchObject({ status: 409, code: 'edit.stale' });
  });
});

describe('galleryItemsService.replacePhoto', () => {
  it('calls POST /api/v1/gallery-items/{id}/photo with the file in the form and one Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ body: upload }]);

    await service.replacePhoto(upload.id, new Blob(['jpeg'], { type: 'image/jpeg' }), 'new.jpg', 'key-4');

    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe(`/api/v1/gallery-items/${upload.id}/photo`);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-4');
    expect(((fake.calls[0]?.body as FormData).get('file') as File).name).toBe('new.jpg');
  });
});

describe('galleryItemsService.move, hide, show and remove', () => {
  it('moves with the direction and no line when the list is not filtered', async () => {
    const { fake, service } = clientFor([{ status: 204 }]);

    await service.move(upload.id, 'down', null, 'key-5');

    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe(`/api/v1/gallery-items/${upload.id}/move`);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ direction: 'down' });
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-5');
  });

  it('moves with the line when the list is filtered to one', async () => {
    const { fake, service } = clientFor([{ status: 204 }]);

    await service.move(upload.id, 'up', GALLERY_IDS.ballers, 'key-6');

    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ direction: 'up', lineId: GALLERY_IDS.ballers });
  });

  it('hides and shows with POST, each with its Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ status: 204 }, { status: 204 }]);

    await service.hide(upload.id, 'key-7');
    await service.show(upload.id, 'key-8');

    expect(fake.calls.map((call) => `${String(call.method)} ${String(call.url)}`)).toEqual([
      `POST /api/v1/gallery-items/${upload.id}/hide`,
      `POST /api/v1/gallery-items/${upload.id}/show`,
    ]);
    expect(fake.calls.map((call) => call.headers.get('Idempotency-Key'))).toEqual(['key-7', 'key-8']);
  });

  it('deletes with DELETE and no Idempotency-Key, and a 404 rejects', async () => {
    const { fake, service } = clientFor([{ status: 204 }, problem(404, { code: 'gallery-items.not-found' })]);

    await service.remove(upload.id);
    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`/api/v1/gallery-items/${upload.id}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(await rejection(service.remove(upload.id))).toMatchObject({ status: 404 });
  });
});
