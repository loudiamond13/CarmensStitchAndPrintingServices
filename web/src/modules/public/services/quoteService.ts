// The quote request calls (INQ-01, INQ-03): the form ticket and the create. Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
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

export function createQuoteService(client: HttpClient): QuoteService {
  return {
    getTicket: (signal) => client.get<QuoteFormTicket>('/public/quote-requests/ticket', { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<CreateQuoteAnswer>('/public/quote-requests', body, { idempotencyKey, signal }),
  };
}

export const quoteService: QuoteService = createQuoteService(apiClient);
