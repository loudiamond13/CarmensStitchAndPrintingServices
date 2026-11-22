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
 * The figures under the toolbar, 24px apart. While a new range loads, the last figures stay, dimmed by colour only (D-02: no
 * opacity on text), under the region's aria-busy: the KPI figures take `--ink-subtle` and the chart body `--surface-2`.
 */
export const visitorStatsBodyClasses = tw(
  'flex flex-col gap-6 [&[aria-busy=true]_[data-kpi-value]]:text-ink-subtle [&[aria-busy=true]_[data-trend-body]]:bg-surface-2',
);

/**
 * The KPI row: one column holding the one Page views card. On phones 16px card padding and no icon tile, as the dashboard row.
 */
export const visitorKpiRowClasses = tw(
  'grid grid-cols-[minmax(0,1fr)] pg-phone:*:p-4 pg-phone:[&_[data-kpi-icon]]:hidden pg-xs:[&_[data-kpi-value=normal]]:text-24',
);

/** StatBarList: the `ol`, rows 16px apart, inside the card padding. */
export const statBarListClasses = tw('m-0 flex list-none flex-col gap-4 p-0');

/** A StatBarList row: the name and figure, then the bar 8px under them. */
export const statBarRowClasses = tw('flex flex-col gap-2');

/** The name and the figure on one line; a long name takes the full width and the figure moves to its own line. */
export const statBarHeadClasses = tw('flex flex-wrap items-baseline justify-between gap-x-3');

/** The name: Label 14/600; a long host wraps anywhere (UI-SPEC long-text row). */
export const statBarNameClasses = tw('min-w-0 text-14 leading-5 font-semibold wrap-anywhere');

/** The figure "412 · 38%": Small 14/400 muted, never split across lines. */
export const statBarFigureClasses = tw('text-14 leading-5 whitespace-nowrap text-ink-muted tabular-nums');

/** The bar fill, as wide as the server's share through `--bar-w` (set through the React style object, strict CSP). */
export const statBarFillClasses = tw('block h-full w-(--bar-w) rounded-xs bg-chart-views');

/** The line a list with no rows shows: Small muted. */
export const statBarEmptyClasses = tw('m-0 text-14 leading-5 text-ink-muted');

/** The body of a list card. */
export const statListBodyClasses = tw('p-5');
