// Staff inbox calls (INQ-05, D-14, D-18, OR-5). Types come from the generated OpenAPI types.
import { apiClient, type HttpClient } from '@/core/api/apiClient';
import type { components } from '@/types/api.generated';

type Schemas = components['schemas'];

export type QuoteRequestListResponse = Schemas['QuoteRequestListResponse'];
export type QuoteRequestListItem = Schemas['QuoteRequestListItem'];
export type QuoteRequestCounts = Schemas['QuoteRequestCountsResponse'];
export type NewQuoteCountResponse = Schemas['NewQuoteCountResponse'];

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
  list(query: QuoteRequestsListQuery, signal?: AbortSignal): Promise<QuoteRequestListResponse>;
  newCount(signal?: AbortSignal): Promise<NewQuoteCountResponse>;
}

export function createQuoteRequestsService(_client: HttpClient): QuoteRequestsService {
  return {
    list: () => Promise.reject(new Error('not built')),
    newCount: () => Promise.reject(new Error('not built')),
  };
}

export const quoteRequestsService: QuoteRequestsService = createQuoteRequestsService(apiClient);
