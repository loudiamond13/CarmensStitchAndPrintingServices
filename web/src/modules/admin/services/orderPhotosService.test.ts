import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { isHttpError } from '@/core/api/errors';
import { createFakeFetch } from '@/test/fakeFetch';
import { IMAGE_RULES, ORDER_VERSION, order0148, orderId } from '@/test/orderFixtures';
import { createOrderPhotosService } from './orderPhotosService';

// The photo calls (ORD-04, IMG-01, OR-5): the rules read and the multipart upload with one key per file.

const ORDER_ID = orderId(148);
const IMAGE_ID = '00000000-0000-4000-a000-000000000002';

function serviceWith(plans: Parameters<typeof createFakeFetch>[0]) {
  const fake = createFakeFetch(plans);
  return {
    fake,
    service: createOrderPhotosService(createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch })),
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('orderPhotosService.rules', () => {
  it('calls GET /orders/image-rules and resolves the rules', async () => {
    const { fake, service } = serviceWith([{ body: IMAGE_RULES }]);

    await expect(service.rules()).resolves.toEqual(IMAGE_RULES);

    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/orders/image-rules');
  });
});

describe('orderPhotosService.upload', () => {
  it('posts a multipart form with the file and the description to /orders/{id}/images under the given key', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);
    const file = new Blob(['jpeg bytes'], { type: 'image/jpeg' });

    await expect(service.upload(ORDER_ID, file, 'front.jpg', 'Front mockup', 'key-1')).resolves.toEqual(order0148);

    const call = fake.calls[0];
    expect(call?.method).toBe('POST');
    expect(call?.url).toBe(`/api/v1/orders/${ORDER_ID}/images`);
    expect(call?.headers.get('Idempotency-Key')).toBe('key-1');
    expect(call?.body).toBeInstanceOf(FormData);
    const form = call?.body as FormData;
    const part = form.get('file');
    expect(part).toBeInstanceOf(Blob);
    expect((part as File).name).toBe('front.jpg');
    expect(form.get('description')).toBe('Front mockup');
  });

  it('waits up to 120 seconds for the answer, not the 30 second default', async () => {
    vi.useFakeTimers();
    const { service } = serviceWith([{ hang: true }]);
    const settled = vi.fn<(error: unknown) => void>();

    const outcome = service.upload(ORDER_ID, new Blob(['x']), 'a.jpg', '', 'key-2').catch((error: unknown) => {
      settled(error);
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_001);
    await outcome;

    const error = settled.mock.calls[0]?.[0];
    expect(isHttpError(error) && error.kind).toBe('timeout');
  });
});

describe('orderPhotosService.move', () => {
  it('calls PUT /orders/{id}/images/{imageId}/position with the position and the order version, and no Idempotency-Key', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await expect(service.move(ORDER_ID, IMAGE_ID, 2, ORDER_VERSION)).resolves.toEqual(order0148);

    expect(fake.calls[0]?.method).toBe('PUT');
    expect(fake.calls[0]?.url).toBe(`/api/v1/orders/${ORDER_ID}/images/${IMAGE_ID}/position`);
    expect(fake.calls[0]?.headers.has('Idempotency-Key')).toBe(false);
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ position: 2, version: ORDER_VERSION });
  });

  it('sends position 0 for Make Cover', async () => {
    const { fake, service } = serviceWith([{ body: order0148 }]);

    await service.move(ORDER_ID, IMAGE_ID, 0, ORDER_VERSION);

    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual({ position: 0, version: ORDER_VERSION });
  });
});
