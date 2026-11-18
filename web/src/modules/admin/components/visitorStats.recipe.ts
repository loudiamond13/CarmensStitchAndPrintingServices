// The Visitor Stats page's looks as complete Tailwind tokens (UI-SPEC V1; SPEC-GAP: V1). Every string here is a class list.
import { tw } from '@/ui/tw';

/**
 * The toolbar in the head's action area: the Date range select and, for a custom range, From and To. Up to 1023px it takes
 * the full width under the title; on phones each control is its own full-width row (UI-SPEC overflow row, 320px).
 */
export const visitorStatsToolbarClasses = tw(
  'flex flex-wrap items-start gap-3 pg-phone:flex-col pg-phone:items-stretch pg-phone:*:w-full pg-lt-lg:w-full',
);

/**
 * The figures under the toolbar. While a new range loads, the last figures stay, dimmed by colour only (D-02: no opacity on
 * text), under the region's aria-busy.
 */
export const visitorStatsBodyClasses = tw('[&[aria-busy=true]_[data-kpi-value]]:text-ink-subtle');

/**
 * The KPI row: the dashboard KPI grid with three cards across, two then one up to 1023px, one column at 767px and below. On
 * phones a 12px gap, 16px card padding and no icon tile, as the dashboard row.
 */
export const visitorKpiRowClasses = tw(
  'grid grid-cols-[repeat(3,minmax(0,1fr))] gap-4 pg-phone:grid-cols-[minmax(0,1fr)] pg-phone:gap-3 pg-phone:*:p-4 pg-tablet:grid-cols-[repeat(2,minmax(0,1fr))] pg-phone:[&_[data-kpi-icon]]:hidden pg-xs:[&_[data-kpi-value=normal]]:text-[24px]',
);
