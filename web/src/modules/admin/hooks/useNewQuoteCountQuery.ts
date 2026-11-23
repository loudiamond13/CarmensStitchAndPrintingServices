// Stub for the RED run.
export const NEW_QUOTE_COUNT_KEY = ['quote-requests', 'new-count'] as const;
export const NEW_QUOTE_COUNT_REFRESH_MS = 60_000;

export interface NewQuoteCountQuery {
  readonly data: number | undefined;
  readonly isError: boolean;
  readonly isFetching: boolean;
  readonly refetch: () => unknown;
}

export function useNewQuoteCountQuery(_options: { enabled?: boolean } = {}): NewQuoteCountQuery {
  return { data: undefined, isError: false, isFetching: false, refetch: () => undefined };
}

export function shownNewQuoteCount(_query: Pick<NewQuoteCountQuery, 'data' | 'isError'>): number | undefined {
  return undefined;
}
