// The Company Expenses list's URL state (WEB-10, D-23, T-06-17, T-06-23; plans 06-04, 06-07): page, size, the search, one
// category and the date pair through the one shared list-state factory. Defaults stay out of the URL; an invalid value falls
// back and is removed with one replace. A filter, search or size change replaces the entry and resets the page; a page change
// pushes. from and to are read only as a pair: with neither, the server's default window applies (never worked out from the
// device clock); a lone date, an invalid date or from after to drops both with one replace.
import { useEffect } from 'react';
import { createListParams } from '@/lib/url-state/createListParams';
import { guidParser, pageParser, pageSizeParser, parseAsBusinessDate, searchParser } from '@/lib/url-state/parsers';

const useListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  category: guidParser,
  from: parseAsBusinessDate,
  to: parseAsBusinessDate,
});

/** A pair that cannot be a range: one date without the other, or the start after the end (YYYY-MM-DD sorts as text). */
function isBrokenPair(from: string | null, to: string | null): boolean {
  if (from === null && to === null) return false;
  return from === null || to === null || from > to;
}

export function useExpensesListParams() {
  const [values, set] = useListParams();
  const broken = isBrokenPair(values.from, values.to);
  const { setFilters } = set;

  useEffect(() => {
    if (broken) {
      setFilters({ from: null, to: null });
    }
  }, [broken, setFilters]);

  // Until the replace lands, a broken pair counts as no dates, so no request is sent with half a range.
  const effective = broken ? { ...values, from: null, to: null } : values;
  return [effective, set] as const;
}
