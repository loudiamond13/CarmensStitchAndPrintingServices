// The dashboard's looks as complete Tailwind tokens (D-33; plans 10-07 and 10-09). Every string here is a class list.
import clsx from 'clsx';
import { hitAreaClasses } from '@/components/actions';
import { loginLinkClasses } from '@/components/layout/layout.recipe';
import { cardClasses } from '@/components/money';
import { tw } from '@/ui/tw';

/** `.s-ph-actions`: the header buttons in a row 8px apart; on phones they take the full width, each growing equally (App. C). */
export const dashboardHeadActionsClasses = tw('flex flex-wrap items-center gap-2 pg-phone:w-full pg-phone:*:flex-1');

/** The h1 wraps anywhere, so a very long first name is never cut off. */
export const dashboardTitleClasses = tw('wrap-anywhere');

/**
 * `.s-kpis`: four columns, 2 x 2 up to 1023px; on phones a 12px gap, 16px card padding and no icon tile, and at 420px and below
 * the figure is 24px (App. C; UI-SPEC typography "stat / KPI value"). The long-figure clamp keeps its smaller size.
 */
export const dashboardKpiRowClasses = tw(
  'grid grid-cols-[repeat(4,minmax(0,1fr))] gap-4 pg-phone:gap-3 pg-phone:*:p-4 pg-lt-lg:grid-cols-[repeat(2,minmax(0,1fr))] pg-phone:[&_[data-kpi-icon]]:hidden pg-xs:[&_[data-kpi-value=normal]]:text-[24px]',
);

/** `.s-dash`: the chart card and the status card side by side (2fr 1fr), one column up to 1023px. */
export const dashboardRowClasses = tw(
  'grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] items-start gap-6 pg-lt-lg:grid-cols-[minmax(0,1fr)]',
);

/** `.s-card`: the surface card every dashboard block sits in. */
export const dashboardCardClasses = clsx(cardClasses, tw('min-w-0'));

/** `.s-card-h`: the head with the title and its sub line, and the card's own link on the right. */
export const dashboardCardHeadClasses = tw(
  'flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4',
);

/** `.s-card-h h2`: display 22 / 700. */
export const dashboardCardTitleClasses = tw('font-display text-[22px] leading-[1.1] font-bold');

/** `.s-card-h p`: 13px muted. */
export const dashboardCardSubClasses = tw('text-[13px] text-ink-muted');

/** The room around a loading or failure line shown in place of a card's content. */
export const dashboardCardStateClasses = tw('p-5');

/**
 * The chart's body. A refetching chart (the other range is loading) is dimmed by colour only, to `--surface-2`, as the list tables are
 * (UI-SPEC refetch row, D-02: no text-bearing element takes an opacity below 1).
 */
export const chartBodyClasses = tw('p-5 data-[refetching=true]:bg-surface-2');

/** `.s-status-list`: the rows 12px apart, 16px under the head. */
export const statusListClasses = tw('m-0 flex list-none flex-col gap-3 px-5 pt-4 pb-5');

/**
 * `.s-status-row`: badge 128px, the bar, the count (116px, bar, 28px on phones). The count column may grow past its 32px so a
 * four-digit count is not cut off.
 */
export const statusRowClasses = tw(
  'grid grid-cols-[128px_minmax(0,1fr)_minmax(32px,auto)] items-center gap-3 pg-phone:grid-cols-[116px_minmax(0,1fr)_minmax(28px,auto)]',
);

/** `.s-status-bar`: the 8px `--surface-2` track. */
export const statusTrackClasses = tw('h-2 overflow-hidden rounded-xs bg-surface-2');

/**
 * `.s-status-bar span`: the fill, as wide as `--bar-w` (set through the React style object, strict CSP). The colour is the
 * status colour; Delivered takes the accent (UI-SPEC Color).
 */
export const statusFillClasses = {
  pending: tw('block h-full w-(--bar-w) rounded-xs bg-(--status-pending)'),
  mockup: tw('block h-full w-(--bar-w) rounded-xs bg-(--status-mockup)'),
  production: tw('block h-full w-(--bar-w) rounded-xs bg-(--status-production)'),
  ready: tw('block h-full w-(--bar-w) rounded-xs bg-(--status-ready)'),
  delivered: tw('block h-full w-(--bar-w) rounded-xs bg-accent'),
  completed: tw('block h-full w-(--bar-w) rounded-xs bg-(--status-completed)'),
} as const;

/** `.s-status-row strong`: the count, display 20, end-aligned. */
export const statusCountClasses = tw('text-right font-display text-[20px] font-bold tabular-nums');

/** `.s-status-total`: the footer with a dashed top rule. */
export const statusTotalClasses = tw(
  'flex justify-between gap-3 border-t-2 border-dashed border-line px-5 py-3 text-[13px] text-ink-muted',
);

/** The footer's figure in the full ink. */
export const statusTotalFigureClasses = tw('text-ink');

/** "All orders" in the Recent orders head: the accent link at 14px (`.s-link.s-small`) with a 44px tap area. */
export const dashboardAllOrdersClasses = clsx(loginLinkClasses, hitAreaClasses);
