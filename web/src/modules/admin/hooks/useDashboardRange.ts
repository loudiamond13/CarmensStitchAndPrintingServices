// STUB for the RED commit of plan 10-11 task 2: the real hook follows in the GREEN commit.
export const DASHBOARD_RANGES = ['6m', '12m'] as const;
export type DashboardRange = (typeof DASHBOARD_RANGES)[number];

export const RANGE_MONTHS: Record<DashboardRange, 6 | 12> = { '6m': 6, '12m': 12 };

export function useDashboardRange() {
  return {
    range: '6m' as DashboardRange,
    months: 6 as 6 | 12,
    setRange: (next: DashboardRange): void => {
      void next;
    },
  };
}
