// The New quote request count (D-14, INQ-05; UI-SPEC R4): one shared query for the nav item, the Quotes tab and the dashboard
// strip. It reads with the admin shell, every 60 seconds while the page is visible and each time the window regains focus. A
// status change, delete or conversion invalidates `['quote-requests']`, which reaches this key and the inbox lists.
import { useQuery } from '@tanstack/react-query';
import { quoteRequestsService } from '@/modules/admin/services/quoteRequestsService';

export const NEW_QUOTE_COUNT_KEY = ['quote-requests', 'new-count'] as const;

/** How often the count reads again. */
export const NEW_QUOTE_COUNT_REFRESH_MS = 60_000;

/** What a count view reads of the query, so a test or the showcase can hand it plain values. */
export interface NewQuoteCountQuery {
  readonly data: number | undefined;
  readonly isError: boolean;
  /** True while a read runs. */
  readonly isFetching: boolean;
  /** When the last read failed and the last read succeeded (0 for never). They stay put while a read runs. */
  readonly errorUpdatedAt: number;
  readonly dataUpdatedAt: number;
  readonly refetch: () => unknown;
}

/** The server's count as a whole number; anything else fails the read, so no made-up number is shown. */
function toCount(value: number | string): number {
  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('The New quote request count is not a whole number.');
  }
  return count;
}

/** `enabled` false asks nothing (a dev page with no one signed in). */
export function useNewQuoteCountQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: NEW_QUOTE_COUNT_KEY,
    queryFn: async ({ signal }) => toCount((await quoteRequestsService.newCount(signal)).count),
    enabled,
    refetchInterval: NEW_QUOTE_COUNT_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
  });
}

/** The count to show: none while unread or after a failed read, never the last good number. */
export function shownNewQuoteCount(query: Pick<NewQuoteCountQuery, 'data' | 'isError'>): number | undefined {
  return query.isError ? undefined : query.data;
}
