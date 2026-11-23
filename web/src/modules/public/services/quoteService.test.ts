// The quote request service (INQ-01, INQ-03): the form ticket read and the create over the shared client.
import { describe, expect, it } from 'vitest';
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
