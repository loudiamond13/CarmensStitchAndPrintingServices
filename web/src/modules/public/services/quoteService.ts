// The quote request calls (INQ-01, INQ-03): the form ticket and the create. Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

export type QuoteFormTicket = components['schemas']['QuoteFormTicketResponse'];
export type CreateQuoteBody = components['schemas']['CreateQuoteRequestRequest'];
export type CreateQuoteAnswer = components['schemas']['CreateQuoteRequestResponse'];

/** A photo may take a while on a slow mobile connection: the same 120 s as the order photo upload (plan 13-12). */
const UPLOAD_TIMEOUT_MS = 120_000;

export interface QuoteService {
  /** `GET /api/v1/public/quote-requests/ticket`. */
  getTicket(signal?: AbortSignal): Promise<QuoteFormTicket>;
  /** `POST /api/v1/public/quote-requests` with one Idempotency-Key per filled form. */
  create(body: CreateQuoteBody, idempotencyKey: string, signal?: AbortSignal): Promise<CreateQuoteAnswer>;
  /**
   * `POST /api/v1/public/quote-requests/{id}/photos/{slot}`: one photo as a multipart form (part `file`), with the upload key the create
   * call declared in `X-Upload-Key`. The answer is 200 with no body. The client never retries a keyed form upload; the caller resends
   * with the same Idempotency-Key.
   */
  uploadPhoto(
    id: string,
    slot: number,
    file: Blob,
    fileName: string,
    uploadKey: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<void>;
}

export function createQuoteService(client: HttpClient): QuoteService {
  return {
    getTicket: (signal) => client.get<QuoteFormTicket>('/public/quote-requests/ticket', { signal }),
    create: (body, idempotencyKey, signal) =>
      client.post<CreateQuoteAnswer>('/public/quote-requests', body, { idempotencyKey, signal }),
    uploadPhoto: (id, slot, file, fileName, uploadKey, idempotencyKey, signal) => {
      const form = new FormData();
      form.append('file', file, fileName);
      return client.post<undefined>(`/public/quote-requests/${encodeURIComponent(id)}/photos/${String(slot)}`, form, {
        idempotencyKey,
        signal,
        headers: { 'X-Upload-Key': uploadKey },
        timeoutMs: UPLOAD_TIMEOUT_MS,
        allowEmptyBody: true,
      });
    },
  };
}

export const quoteService: QuoteService = createQuoteService(apiClient);
