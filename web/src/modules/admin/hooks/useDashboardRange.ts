// The dashboard chart range in the URL `range` parameter (DASH-03, WEB-10, T-10-21). 6 months is the default and stays out of the URL;
// a change replaces the history entry; a value that is not on the allow-list reads as 6m and is removed with one replace.
import { createListParams } from '@/lib/url-state/createListParams';
import { literalParser } from '@/lib/url-state/parsers';

export const DASHBOARD_RANGES = ['6m', '12m'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

/** The month count each range asks the chart endpoint for. */
export const RANGE_MONTHS = { '6m': 6, '12m': 12 } as const satisfies Record<DashboardRange, number>;

const useRangeParams = createListParams({ range: literalParser(DASHBOARD_RANGES, '6m') });

export function useDashboardRange() {
  const [{ range }, { setFilter }] = useRangeParams();
  return {
    range,
    months: RANGE_MONTHS[range],
    setRange: (next: DashboardRange): void => {
      setFilter('range', next);
    },
  };
}
