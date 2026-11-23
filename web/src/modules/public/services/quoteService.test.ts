// The quote request service (INQ-01, INQ-03): the form ticket read and the create over the shared client.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createHttpClient } from '@/core/api/apiClient';
import { isHttpError } from '@/core/api/errors';
import { createFakeFetch } from '@/test/fakeFetch';
import { createQuoteService, type CreateQuoteBody } from './quoteService';

const TICKET_ANSWER = {
  ticket: 'ticket-1',
  photoRules: { maxPhotos: 5, maxBytes: 10_485_760, maxPixels: 25_000_000 },
  minimumSeconds: 3,
};

const BODY: CreateQuoteBody = {
  customerName: 'Juan Dela Cruz',
  teamName: '',
  contactNumber: '0917 123 4567',
  email: '',
  productChoice: '',
  productLineKey: '',
  quantity: '',
  message: '',
  subjectLine: '',
  ticket: 'ticket-1',
};

describe('quoteService.getTicket', () => {
  it('calls GET /api/v1/public/quote-requests/ticket once and resolves the typed body', async () => {
    const fake = createFakeFetch([{ body: TICKET_ANSWER }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const answer = await createQuoteService(client).getTicket(new AbortController().signal);

    expect(answer).toEqual(TICKET_ANSWER);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('GET');
    expect(fake.calls[0]?.url).toBe('/api/v1/public/quote-requests/ticket');
  });
});

describe('quoteService.create', () => {
  it('POSTs /api/v1/public/quote-requests with the body and the Idempotency-Key and resolves the typed answer', async () => {
    const answer = { id: '7b1d6c58-3c7e-4a0e-9f0b-2f3c5a1b9d10', photoSlots: [] };
    const fake = createFakeFetch([{ body: answer }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const result = await createQuoteService(client).create(BODY, 'key-quote-1');

    expect(result).toEqual(answer);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]?.method).toBe('POST');
    expect(fake.calls[0]?.url).toBe('/api/v1/public/quote-requests');
    expect(fake.calls[0]?.headers.get('Idempotency-Key')).toBe('key-quote-1');
    expect(JSON.parse(String(fake.calls[0]?.body))).toEqual(BODY);
  });

  it('rejects with an HttpError that carries the replacement ticket of an expired ticket (D-38)', async () => {
    const fake = createFakeFetch([
      {
        status: 400,
        headers: { 'Content-Type': 'application/problem+json' },
        body: {
          title: 'The form timed out. Please send it again.',
          status: 400,
          code: 'quote-requests.ticket-expired',
          errors: { ticket: ['The form timed out. Please send it again.'] },
          replacementTicket: 'ticket-2',
        },
      },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch, retry: { max: 0 } });

    const error = await createQuoteService(client)
      .create(BODY, 'key-quote-2')
      .then(
        () => undefined,
        (failure: unknown) => failure,
      );

    expect(isHttpError(error) && error.code).toBe('quote-requests.ticket-expired');
    expect(isHttpError(error) && error.problem?.replacementTicket).toBe('ticket-2');
  });
});

describe('quoteService.uploadPhoto (INQ-02)', () => {
  const ID = '7b1d6c58-3c7e-4a0e-9f0b-2f3c5a1b9d10';
  const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4]);

  afterEach(() => {
    vi.useRealTimers();
  });

  it('POSTs the file as the `file` part to its slot with the Idempotency-Key and the X-Upload-Key', async () => {
    const fake = createFakeFetch([{ status: 200 }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });
    const file = new File([BYTES], 'IMG_0001.png', { type: 'image/png' });

    await expect(
      createQuoteService(client).uploadPhoto(ID, 1, file, 'logo.png', 'upload-key-1', 'idem-photo-1'),
    ).resolves.toBeUndefined();

    expect(fake.calls).toHaveLength(1);
    const [call] = fake.calls;
    expect(call?.method).toBe('POST');
    expect(call?.url).toBe(`/api/v1/public/quote-requests/${ID}/photos/1`);
    expect(call?.headers.get('Idempotency-Key')).toBe('idem-photo-1');
    expect(call?.headers.get('X-Upload-Key')).toBe('upload-key-1');
    const part = (call?.body as FormData).get('file');
    expect(part).toBeInstanceOf(File);
    expect((part as File).name).toBe('logo.png');
    expect(new Uint8Array(await (part as File).arrayBuffer())).toEqual(BYTES);
  });

  it('waits up to 120 seconds for a slow connection, not the usual 30', async () => {
    vi.useFakeTimers();
    const fake = createFakeFetch([{ hang: true }]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });
    const settled = vi.fn();
    const upload = createQuoteService(client)
      .uploadPhoto(ID, 0, new File([BYTES], 'a.png'), 'a.png', 'k', 'i')
      .catch((error: unknown) => {
        settled(error);
      });

    await vi.advanceTimersByTimeAsync(100_000);
    expect(settled).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(21_000);
    await upload;

    expect(settled).toHaveBeenCalledOnce();
    expect(isHttpError(settled.mock.calls[0]?.[0]) && settled.mock.calls[0][0].kind).toBe('timeout');
  });

  it('rejects with the answer of a refused photo', async () => {
    const fake = createFakeFetch([
      {
        status: 422,
        headers: { 'Content-Type': 'application/problem+json' },
        body: { title: 'logo.png is too big.', status: 422, code: 'quote-requests.photo-refused' },
      },
    ]);
    const client = createHttpClient({ baseURL: '/api/v1', fetch: fake.fetch });

    const error = await createQuoteService(client)
      .uploadPhoto(ID, 0, new File([BYTES], 'a.png'), 'a.png', 'k', 'i')
      .then(
        () => undefined,
        (failure: unknown) => failure,
      );

    expect(isHttpError(error) && error.status).toBe(422);
    expect(isHttpError(error) && error.code).toBe('quote-requests.photo-refused');
  });
});
