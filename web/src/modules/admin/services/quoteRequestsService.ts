// Staff inbox and request calls (INQ-05, D-14, D-15, D-18, OR-5). Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type QuoteRequestListResponse = Schemas['QuoteRequestListResponse'];
export type QuoteRequestListItem = Schemas['QuoteRequestListItem'];
export type QuoteRequestCounts = Schemas['QuoteRequestCountsResponse'];
export type NewQuoteCountResponse = Schemas['NewQuoteCountResponse'];
export type QuoteRequestDetailResponse = Schemas['QuoteRequestDetailResponse'];
export type QuoteRequestPhoto = Schemas['QuoteRequestPhotoResponse'];
export type QuoteRequestStatusChange = Schemas['QuoteRequestStatusChangeResponse'];
export type QuoteRequestStatusChanged = Schemas['QuoteRequestStatusChangedResponse'];
export type QuoteRequestNote = Schemas['QuoteRequestNoteResponse'];
export type QuoteRequestNoteAdded = Schemas['QuoteRequestNoteAddedResponse'];

/** The status groups of the inbox pills; `open` is New, Contacted and Quoted (D-18). */
export const QUOTE_STATUS_FILTERS = ['open', 'converted', 'closed', 'spam', 'all'] as const;
export type QuoteStatusFilter = (typeof QUOTE_STATUS_FILTERS)[number];

export interface QuoteRequestsListQuery {
  status: QuoteStatusFilter;
  q: string | null;
  page: number;
  size: number;
}

export interface QuoteRequestsService {
  /** `GET /api/v1/quote-requests`: one page of a status group, newest first, with the pill counts. */
  list(query: QuoteRequestsListQuery, signal?: AbortSignal): Promise<QuoteRequestListResponse>;
  /** `GET /api/v1/quote-requests/new-count`: how many requests are at status New, the same for every staff member (D-14). */
  newCount(signal?: AbortSignal): Promise<NewQuoteCountResponse>;
  /** `GET /api/v1/quote-requests/{id}`: one request in full, with its photo addresses, history and version (D-13, D-36). */
  get(id: string, signal?: AbortSignal): Promise<QuoteRequestDetailResponse>;
  /**
   * `POST /api/v1/quote-requests/{id}/status` with the row version the page holds (D-15). The answer is only the new status and
   * version; the page reads the request again for its history. `409 quote-requests.conflict` when someone else changed it.
   */
  changeStatus(
    id: string,
    status: string,
    version: string,
    idempotencyKey: string,
    signal?: AbortSignal,
  ): Promise<QuoteRequestStatusChanged>;
  /**
   * `POST /api/v1/quote-requests/{id}/notes` (D-17). The answer is only the note id, its time and the new version; the page reads
   * the request again for the note.
   */
  addNote(id: string, text: string, idempotencyKey: string, signal?: AbortSignal): Promise<QuoteRequestNoteAdded>;
}

export function createQuoteRequestsService(client: HttpClient): QuoteRequestsService {
  return {
    list: (query, signal) =>
      client.get<QuoteRequestListResponse>('/quote-requests', {
        params: { status: query.status, q: query.q, page: query.page, size: query.size },
        signal,
      }),
    newCount: (signal) => client.get<NewQuoteCountResponse>('/quote-requests/new-count', { signal }),
    get: (id, signal) =>
      client.get<QuoteRequestDetailResponse>(`/quote-requests/${encodeURIComponent(id)}`, { signal }),
    changeStatus: (id, status, version, idempotencyKey, signal) =>
      client.post<QuoteRequestStatusChanged>(
        `/quote-requests/${encodeURIComponent(id)}/status`,
        { status, version },
        { idempotencyKey, signal },
      ),
    addNote: (id, text, idempotencyKey, signal) =>
      client.post<QuoteRequestNoteAdded>(
        `/quote-requests/${encodeURIComponent(id)}/notes`,
        { text },
        { idempotencyKey, signal },
      ),
  };
}

export const quoteRequestsService: QuoteRequestsService = createQuoteRequestsService(apiClient);
