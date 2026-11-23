// One page of the Quote Requests inbox. Keyed on the parsed, defaulted list params (WEB-08), cancellable, and keeping the
// previous page's rows on screen while the next one loads. It reads again every 60 seconds while the page is visible and
// each time the window regains focus (UI-SPEC R1 "Refresh").
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { listKey } from '@/lib/query/keys';
import { quoteRequestsService, type QuoteRequestsListQuery } from '@/modules/admin/services/quoteRequestsService';

/** The root of every inbox query, `['quote-requests', 'list', params]` below it. */
export const quoteRequestsKey = ['quote-requests'] as const;

/** How often the open inbox reads again. */
export const QUOTE_REQUESTS_REFRESH_MS = 60_000;

export function useQuoteRequestsQuery(params: QuoteRequestsListQuery) {
  return useQuery({
    queryKey: listKey('quote-requests', params),
    queryFn: ({ signal }) => quoteRequestsService.list(params, signal),
    placeholderData: keepPreviousData,
    refetchInterval: QUOTE_REQUESTS_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
  });
}
