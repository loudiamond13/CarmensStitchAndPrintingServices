// One page of the Quote Requests inbox. Keyed on the parsed, defaulted list params (WEB-08), cancellable, and keeping the
// previous page's rows on screen while the next one loads.
import { useListQuery } from '@/lib/query/useListQuery';
import { quoteRequestsService, type QuoteRequestsListQuery } from '@/modules/admin/services/quoteRequestsService';

/** The root of every inbox query, `['quote-requests', 'list', params]` below it. */
export const quoteRequestsKey = ['quote-requests'] as const;

export function useQuoteRequestsQuery(params: QuoteRequestsListQuery) {
  return useListQuery({
    key: 'quote-requests',
    params,
    fetcher: (query, signal) => quoteRequestsService.list(query, signal),
  });
}
