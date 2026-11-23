// The quote request calls (INQ-01, INQ-03): the form ticket and the create. Types come from the generated OpenAPI types.
import type { HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type QuoteFormTicket = components['schemas']['QuoteFormTicketResponse'];
export type CreateQuoteBody = components['schemas']['CreateQuoteRequestRequest'];
export type CreateQuoteAnswer = components['schemas']['CreateQuoteRequestResponse'];

export interface QuoteService {
  /** `GET /api/v1/public/quote-requests/ticket`. */
  getTicket(signal?: AbortSignal): Promise<QuoteFormTicket>;
  /** `POST /api/v1/public/quote-requests` with one Idempotency-Key per filled form. */
  create(body: CreateQuoteBody, idempotencyKey: string, signal?: AbortSignal): Promise<CreateQuoteAnswer>;
}

export function createQuoteService(_client: HttpClient): QuoteService {
  return {
    getTicket: () => Promise.reject(new Error('not implemented')),
    create: () => Promise.reject(new Error('not implemented')),
  };
}
