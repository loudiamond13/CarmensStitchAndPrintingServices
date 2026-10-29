// The data-display looks (App. B `/* order card */`, `/* table */` and `/* chart */`, CSPS-UI-SPEC.md §6.4) as
// complete Tailwind tokens (D-33). Every string in this file is a class list (the class gate reads them all). Axes set
// disjoint properties: a base never sets a property that its state or alignment map also sets.
import clsx from 'clsx';
import { cardClasses } from '@/components/money';
import { tw } from '@/ui/tw';

export type CellAlign = 'left' | 'right' | 'center';

/* ───────────── OrderCard ───────────── */

/**
 * `.csp-card.csp-order-card`: the card as a clipped column. On hover it lifts 2px, takes `--shadow-2` and the
 * `--line-strong` border (all three over .2s ease). `group/card` lets the cover image follow the card's hover.
 */
export const orderCardClasses = clsx(
  cardClasses,
  tw(
    'group/card flex flex-col overflow-hidden transition-[transform,box-shadow,border-color] duration-200 ease-[ease] hover:[transform:translateY(-2px)] hover:border-line-strong hover:[box-shadow:var(--shadow-2)]',
  ),
);

/** `.csp-order-media`: the 16:10 cover button on `--surface-2`, clipped, with the pointer. */
export const orderMediaClasses = tw(
  'relative block aspect-[16/10] cursor-pointer overflow-hidden border-0 bg-surface-2 p-0',
);

/** `.csp-order-media img`: the cover fills the button and grows 3% while the card is hovered (.4s ease). */
export const orderImageClasses = tw(
  'block h-full w-full object-cover transition-[transform] duration-[.4s] ease-[ease] group-hover/card:[transform:scale(1.03)]',
);

/** `.csp-order-media .csp-media-ph`: the placeholder fills the button's height. */
export const orderPlaceholderClasses = tw('h-full');

/** `.csp-order-status`: the status badge's corner, 12px from the top left. */
export const orderStatusClasses = tw('absolute top-3 left-3');

/** `.csp-order-status .csp-badge`: the badge's 1px `--line` ring over the image. */
export const orderStatusBadgeClasses = tw('[box-shadow:0_0_0_1px_var(--line)]');

/** `.csp-order-count`: the image-count chip, 12px from the top right, 24px high on `--surface-3`. */
export const orderCountClasses = tw(
  'absolute top-3 right-3 inline-flex h-6 items-center gap-1 rounded-xs bg-surface-3 px-2 text-[12px] font-semibold text-ink',
);

/** `.csp-order-body`: the text column, 16px padded (12px at the bottom), 4px between lines, taking the spare height. */
export const orderBodyClasses = tw('flex flex-1 flex-col gap-1 px-4 pt-4 pb-3');

/** `.csp-order-head`: the order number and the piece count, spread apart on one baseline. */
export const orderHeadClasses = tw('flex items-baseline justify-between');

/** `.csp-order-no`: the order number, display 700 15px, .06em tracking, in `--accent-ink`. */
export const orderNumberClasses = tw('font-display text-[15px] font-bold tracking-[.06em] text-accent-ink');

/** `.csp-order-qty`: "{n} pcs", 12px 600 `--ink-muted`. */
export const orderQtyClasses = tw('text-[12px] font-semibold text-ink-muted');

/** `.csp-order-team`: the team (or customer) name, display 700 22px, line height 1.1. */
export const orderTeamClasses = tw('font-display text-[22px] leading-[1.1] font-bold');

/** `.csp-order-cust`: the customer line, 14px/20px `--ink-muted`, at least one line high even when empty. */
export const orderCustomerClasses = tw('min-h-5 text-[14px] leading-5 text-ink-muted');

/** `.csp-order-dates`: the order and due dates, 12px/16px `--ink-muted`, 4px above and 12px below. */
export const orderDatesClasses = tw('mt-1 mb-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] leading-4 text-ink-muted');

/** `.csp-order-dates span`: an icon and its date, 4px apart. */
export const orderDateClasses = tw('inline-flex items-center gap-1');

/** `.csp-order-actions`: the footer buttons, 2px apart, 8px by 12px padded, below a 1px `--line` rule. */
export const orderActionsClasses = tw('flex gap-0.5 border-t border-line px-3 py-2');

/* ───────────── DataTable ───────────── */

/** `.csp-table-wrap`: the bordered `--surface` frame, radius 12, scrolling sideways when the table is wider. */
export const tableWrapClasses = tw('overflow-x-auto rounded-md border border-line bg-surface');

/** `.csp-table`: full width, 14px/20px (preflight already collapses the borders). */
export const tableClasses = tw('w-full text-[14px] leading-5');

/** `.csp-table th`: the sticky 12px 700 upper-case `--ink-muted` header cell on `--surface`, one line. */
export const tableHeadCellClasses = tw(
  'sticky top-0 border-b border-line bg-surface px-4 py-3 text-[12px] font-bold tracking-[.06em] whitespace-nowrap text-ink-muted uppercase',
);

/** A header cell given a width: it reads `--col-w` (UI-SPEC "Inline style rule"). */
export const tableColumnWidthClasses = tw('w-(--col-w)');

/** `tbody tr`: `group/row`, so its cells follow the row's hover and last-child state. */
export const tableRowClasses = tw('group/row');

/**
 * `.csp-table td`: 12px by 16px, a 1px `--line` rule below, middle-aligned. `tbody tr:last-child td` drops the rule
 * and `tbody tr:hover td` takes `--surface-2`, through the row's `group/row`.
 */
export const tableCellClasses = tw(
  'border-b border-line px-4 py-3 align-middle group-last/row:border-b-0 group-hover/row:bg-surface-2',
);

/** `.csp-table td.is-num`: a money cell, tabular 600 on one line. */
export const tableNumberCellClasses = tw('font-semibold whitespace-nowrap tabular-nums');

/** The column `align` as a class map (UI-SPEC "Finite sets become class maps"); App. D.3 defaults to left. */
export const tableAlignClasses = {
  left: tw('text-left'),
  right: tw('text-right'),
  center: tw('text-center'),
} as const satisfies Record<CellAlign, string>;

/** `.csp-table-state`: the centred 32px-padded empty or error message in `--ink-muted`. */
export const tableStateClasses = tw('flex items-center justify-center gap-2 p-8');

/** `.csp-table-state` colour, and `.is-error` in `--danger`. */
export const tableStateToneClasses = {
  empty: tw('text-ink-muted'),
  error: tw('text-danger'),
} as const;

/* ───────────── IncomeExpenseChart ───────────── */

/** `.csp-chart`: the positioning frame of the tooltip (preflight already zeroes the figure's margin). */
export const chartClasses = tw('relative');

/** `.csp-chart svg`: the drawing scales to the frame's width and lets the tick labels overflow. */
export const chartSvgClasses = tw('block h-auto w-full overflow-visible');

/** `.csp-chart-legend`: the two swatches and their names, 12px/16px 600 `--ink-muted`, 12px above the drawing. */
export const chartLegendClasses = tw('mb-3 flex flex-wrap gap-4 text-[12px] leading-4 font-semibold text-ink-muted');

/** `.csp-chart-legend span, .csp-chart-tip span`: a swatch and its text, 6px apart. */
export const chartKeyClasses = tw('inline-flex items-center gap-1.5');

/** `.csp-chart i` with `.sw-income` / `.sw-expense`: the 10px swatch, radius 3, in the series colour. */
export const chartSwatchClasses = {
  income: tw('inline-block size-2.5 rounded-[3px] bg-chart-income'),
  expense: tw('inline-block size-2.5 rounded-[3px] bg-chart-expense'),
} as const;

/** `.csp-chart-income` / `.csp-chart-expense`: the bar fills. */
export const chartBarClasses = {
  income: tw('fill-chart-income'),
  expense: tw('fill-chart-expense'),
} as const;

/** `.csp-chart-grid`: a 1px `--line` gridline. */
export const chartGridClasses = tw('stroke-line stroke-1');

/** `.csp-chart-axis`: the 1px `--line-strong` base line. */
export const chartAxisClasses = tw('stroke-line-strong stroke-1');

/** `.csp-chart-tick`: the 11px tabular `--ink-muted` tick and month labels in the sans face. */
export const chartTickClasses = tw('fill-ink-muted font-sans text-[11px] tabular-nums');

/** `.csp-chart-hover`: the highlighted month column in `--surface-2`. */
export const chartHoverClasses = tw('fill-surface-2');

/**
 * `.csp-chart-tip`: the tooltip card 28px below the frame's top, centred on `--tip-x` (UI-SPEC "Inline style rule"),
 * `--surface-3` with a 1px `--line` border, radius 8 and `--shadow-2`, 12px/18px tabular text on one line per row. It
 * never takes the pointer.
 */
export const chartTipClasses = tw(
  'pointer-events-none absolute top-7 left-(--tip-x) flex [transform:translateX(-50%)] flex-col gap-0.5 rounded-sm border border-line bg-surface-3 px-3 py-2 text-[12px] leading-[18px] whitespace-nowrap tabular-nums [box-shadow:var(--shadow-2)]',
);

/** `.csp-chart-net`: the net line in `--ink-muted`. */
export const chartNetClasses = tw('text-ink-muted');

/* ───────────── ActorName and RecordMeta (SEC-08) ───────────── */

/** The deleted-actor suffix: muted, so the name stays the loud part (D-11, OQ-8). */
export const actorFormerClasses = tw('text-ink-muted');

/** RecordMeta `dl`: terms and values in two columns (max-content, then the rest), 8px by 16px apart; stacked on phones. */
export const recordMetaClasses = tw('grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 pg-phone:grid-cols-1');

/** One term and its value: they share the list's two columns; stacked on phones, 4px apart. */
export const recordMetaRowClasses = tw(
  'col-span-2 grid grid-cols-subgrid pg-phone:col-span-1 pg-phone:grid-cols-1 pg-phone:gap-y-1',
);

/** `dt`: the Label look (14px, 600) in `--ink-muted`. */
export const recordMetaTermClasses = tw('text-[14px] leading-5 font-semibold text-ink-muted');

/** `dd`: the Small look (14px, 400) in `--ink`; a long name wraps anywhere instead of widening the panel. */
export const recordMetaValueClasses = tw('text-[14px] leading-5 wrap-anywhere text-ink');
