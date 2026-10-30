// The Orders list's URL state (WEB-10, T-08-08, T-08-16, T-08-17; plans 08-06, 08-09): page, size, the search and the filters
// through the one shared list-state factory. Defaults stay out of the URL; an invalid value (a size outside 10, 20, 50 and 100,
// a status or sort that is not offered, a product that is not an id) falls back and is removed with one replace. A search,
// filter, sort or size change replaces the entry and resets the page; a page change pushes. No key can hold a customer's name,
// phone, email or address: only the free-text search `q` may (createListParams refuses such key names). The view joins in plan 08-11.
//
// Order date: `dates` is 30d, 90d, month or custom, and none means Any date (D-42). A preset is stored by name and worked out
// from the server's business today on every visit (D-59), never from the device clock. `from` and `to` belong to `custom` and
// are read only as a pair: a custom range with a missing, invalid or reversed date drops dates, from and to with one replace,
// and a from or to beside a preset or no range is dropped too.
import { parseAsStringLiteral } from 'nuqs';
import { useEffect } from 'react';
import { createListParams } from '@/lib/url-state/createListParams';
import {
  guidParser,
  isCalendarDate,
  literalParser,
  pageParser,
  pageSizeParser,
  parseAsBusinessDate,
  resolveRangePreset,
  searchParser,
} from '@/lib/url-state/parsers';

// prettier-ignore
export const ORDER_STATUS_FILTERS = ['active', 'all', 'pending', 'mockup', 'production', 'ready', 'delivered', 'completed', 'cancelled'] as const;
export const ORDER_SORTS = ['due', 'newest', 'balance', 'total'] as const;
export const ORDER_DATE_RANGES = ['30d', '90d', 'month', 'custom'] as const;

export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];
export type OrderSort = (typeof ORDER_SORTS)[number];
export type OrderDateRange = (typeof ORDER_DATE_RANGES)[number];

const useListParams = createListParams({
  page: pageParser,
  size: pageSizeParser,
  q: searchParser,
  status: literalParser(ORDER_STATUS_FILTERS, 'active'),
  dates: parseAsStringLiteral(ORDER_DATE_RANGES),
  from: parseAsBusinessDate,
  to: parseAsBusinessDate,
  productType: guidParser,
  hasBalance: parseAsStringLiteral(['true']),
  sort: literalParser(ORDER_SORTS, 'due'),
});

/** A pair that cannot be a range: one date without the other, or the start after the end (YYYY-MM-DD sorts as text). */
function isBrokenPair(from: string | null, to: string | null): boolean {
  return from === null || to === null || from > to;
}

/** The calendar day `days` before a valid `YYYY-MM-DD` day. Calendar arithmetic only: no zone, so no day can shift. */
function daysBefore(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10);
}

/**
 * The business dates an order date choice covers, or null when there is no range to send: Any date, a custom range that is
 * missing a date, or a preset while the business today is not known yet. A preset resolves against the server's today with the
 * same day rules as the shared Last 30 days and This month presets; Last 90 days counts 89 days back, today included.
 */
export function resolveOrderDateRange(
  dates: OrderDateRange | null,
  from: string | null,
  to: string | null,
  today: string | null,
): { from: string; to: string } | null {
  if (dates === null) return null;
  if (dates === 'custom') return from !== null && to !== null ? { from, to } : null;
  if (today === null || !isCalendarDate(today)) return null;
  switch (dates) {
    case '30d':
      return resolveRangePreset('last-30-days', today);
    case '90d':
      return { from: daysBefore(today, 89), to: today };
    case 'month':
      return resolveRangePreset('this-month', today);
  }
}

export function useOrdersListParams() {
  const [values, set] = useListParams();
  const brokenCustom = values.dates === 'custom' && isBrokenPair(values.from, values.to);
  const strayDates = values.dates !== 'custom' && (values.from !== null || values.to !== null);
  const { setFilters } = set;

  useEffect(() => {
    if (brokenCustom) {
      setFilters({ dates: null, from: null, to: null });
    } else if (strayDates) {
      setFilters({ from: null, to: null });
    }
  }, [brokenCustom, strayDates, setFilters]);

  // Until the replace lands, a broken range counts as Any date, so no request is sent with half a range.
  if (brokenCustom) return [{ ...values, dates: null, from: null, to: null }, set] as const;
  if (strayDates) return [{ ...values, from: null, to: null }, set] as const;
  return [values, set] as const;
}
