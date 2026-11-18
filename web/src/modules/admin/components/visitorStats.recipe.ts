// The Visitor Stats page's looks as complete Tailwind tokens (UI-SPEC V1; SPEC-GAP: V1). Every string here is a class list.
import { tw } from '@/ui/tw';

/**
 * The KPI row: the dashboard KPI grid with three cards across, two then one up to 1023px, one column at 767px and below. On
 * phones a 12px gap, 16px card padding and no icon tile, as the dashboard row.
 */
export const visitorKpiRowClasses = tw(
  'grid grid-cols-[repeat(3,minmax(0,1fr))] gap-4 pg-phone:grid-cols-[minmax(0,1fr)] pg-phone:gap-3 pg-phone:*:p-4 pg-tablet:grid-cols-[repeat(2,minmax(0,1fr))] pg-phone:[&_[data-kpi-icon]]:hidden pg-xs:[&_[data-kpi-value=normal]]:text-[24px]',
);
