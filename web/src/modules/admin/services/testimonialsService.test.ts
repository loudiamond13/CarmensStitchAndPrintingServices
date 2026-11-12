// The testimonials service (WEB-04, CONT-03): typed calls over the one HTTP client, generated types (D-16).
import { describe, expect, it } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { createFakeFetch } from '@/test/fakeFetch';
import { demoTestimonials } from '@/test/siteContentFixtures';
import { createTestimonialsService, type TestimonialRequest } from './testimonialsService';

const [juan] = demoTestimonials();
if (juan === undefined) {
  throw new Error('The demo testimonials are empty.');
}

const request: TestimonialRequest = {
  quote: juan.quote,
  name: juan.name,
  teamOrRole: juan.teamOrRole,
  stars: 5,
  isShown: true,
  version: juan.version,
};

function clientFor(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return { fake, service: createTestimonialsService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })) };
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

describe('testimonialsService.list', () => {
  it('lists with GET /api/v1/testimonials once', async () => {
    const { fake, service } = clientFor([{ body: demoTestimonials() }]);

    const result = await service.list();

    expect(result).toHaveLength(4);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/testimonials');
  });
});

describe('testimonialsService.create (CONT-03, SEC-06)', () => {
  it('calls POST /api/v1/testimonials with the body and the one Idempotency-Key of the submission', async () => {
    const { fake, service } = clientFor([{ status: 201, body: juan }]);

    const result = await service.create(request, 'key-1');

    expect(result).toEqual(juan);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/testimonials');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(request);
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-1');
  });

  it('a 400 rejects with the field errors the server sent', async () => {
    const { service } = clientFor([problem(400, { errors: { quote: ['Enter the quote.'] } })]);

    expect(await rejection(service.create(request, 'key-1'))).toMatchObject({
      status: 400,
      fieldErrors: { quote: ['Enter the quote.'] },
    });
  });
});

describe('testimonialsService.update (CONT-03, SEC-07)', () => {
  it('calls PUT /api/v1/testimonials/{id} with the version and no Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ body: juan }]);

    const result = await service.update(juan.id, request);

    expect(result).toEqual(juan);
    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`/api/v1/testimonials/${juan.id}`);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(request);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('a stale save rejects with a 409 HttpError carrying the edit.stale code', async () => {
    const { service } = clientFor([problem(409, { code: 'edit.stale' })]);

    expect(await rejection(service.update(juan.id, request))).toMatchObject({
      kind: 'http',
      status: 409,
      code: 'edit.stale',
    });
  });
});

describe('testimonialsService.move, hide, show and remove', () => {
  it('moves with POST {id}/move, the direction in the body and one Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ status: 204 }]);

    await service.move(juan.id, 'down', 'key-2');

    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe(`/api/v1/testimonials/${juan.id}/move`);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ direction: 'down' });
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-2');
  });

  it('hides and shows with POST {id}/hide and {id}/show, each with its Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ status: 204 }, { status: 204 }]);

    await service.hide(juan.id, 'key-3');
    await service.show(juan.id, 'key-4');

    expect(fake.calls.map((call) => call.method)).toEqual(['POST', 'POST']);
    expect(fake.calls.map((call) => call.url)).toEqual([
      `/api/v1/testimonials/${juan.id}/hide`,
      `/api/v1/testimonials/${juan.id}/show`,
    ]);
    expect(fake.calls.map((call) => call.headers.get('Idempotency-Key'))).toEqual(['key-3', 'key-4']);
  });

  it('deletes with DELETE {id}, no version and no Idempotency-Key', async () => {
    const { fake, service } = clientFor([{ status: 204 }]);

    await service.remove(juan.id);

    expect(fake.calls[0]?.method).toBe('DELETE');
    expect(fake.calls[0]?.url).toBe(`/api/v1/testimonials/${juan.id}`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
  });

  it('a testimonial that is gone rejects with a 404 HttpError', async () => {
    const { service } = clientFor([problem(404, { code: 'testimonials.not-found' })]);

    expect(await rejection(service.remove(juan.id))).toMatchObject({ kind: 'http', status: 404 });
  });
});
