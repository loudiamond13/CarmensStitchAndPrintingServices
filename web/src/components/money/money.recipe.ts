// The money display looks (App. B `/* ── Cards, money ── */` and `/* totals */`, CSPS-UI-SPEC.md §6.4) as complete
// Tailwind tokens (D-33). Every string in this file is a class list (the class gate reads them all). Axes set disjoint
// properties: a base never sets a property that its size, tone or variant map also sets.
import clsx from 'clsx';
import { tw } from '@/ui/tw';

export type MoneySize = 'sm' | 'md' | 'lg';
export type MoneyTone = 'success' | 'warning' | 'danger' | 'muted';
export type TotalsVariant = 'card' | 'panel';
export type BalanceState = 'due' | 'paid' | 'credit' | 'neutral';
export type DeltaDirection = 'up' | 'down';

/** `.csp-card`: the `--surface` card with a 1px `--line` border, radius 12 and `--shadow-1`. */
export const cardClasses = tw('rounded-md border border-line bg-surface [box-shadow:var(--shadow-1)]');

/** `.csp-overline` without its colour: 11px/16px 700, .12em tracking, upper case. */
const overlineType = tw('text-[11px] leading-4 font-bold tracking-[.12em] uppercase');

/** `.csp-overline`: the label type in `--ink-muted`. */
export const overlineClasses = clsx(overlineType, tw('text-ink-muted'));

/* ───────────── Money ───────────── */

/** `.csp-money`: tabular figures on one line. Its 600 weight sits in the size map, because `-lg` sets 700. */
export const moneyClasses = tw('whitespace-nowrap tabular-nums');

/** `.csp-money-<size>`: `-sm` 14px, `-md` adds nothing, `-lg` the 40px display figure (700, line height 1). */
export const moneySizeClasses = {
  sm: tw('text-[14px] font-semibold'),
  md: tw('font-semibold'),
  lg: tw('font-display text-[40px] leading-[1] font-bold'),
} as const satisfies Record<MoneySize, string>;

/** `.csp-money.tone-<tone>`: the figure's colour, one complete literal per tone. */
export const moneyToneClasses = {
  success: tw('text-success'),
  warning: tw('text-warning'),
  danger: tw('text-danger'),
  muted: tw('text-ink-muted'),
} as const satisfies Record<MoneyTone, string>;

/* ───────────── KpiCard ───────────── */

/** `.csp-card.csp-kpi`: a 20px-padded column with 12px gaps, its own inline-size container (the value reads `cqi`). */
export const kpiClasses = clsx(cardClasses, tw('@container flex min-w-0 flex-col gap-3 p-5'));

/** `.csp-kpi-head`: the overline label and the icon tile, spread apart. */
export const kpiHeadClasses = tw('flex items-center justify-between gap-2');

/** `.csp-kpi-icon`: the 32px `--accent-soft` tile, radius 8, holding the 18px icon in `--accent-ink`. */
export const kpiIconClasses = tw('grid size-8 place-items-center rounded-sm bg-accent-soft text-accent-ink');

/** `.csp-kpi-value`: the display figure, 700 at `clamp(26px, 15cqi, 40px)`, line height 1, tabular, one line. */
export const kpiValueClasses = tw(
  'font-display text-[length:clamp(26px,15cqi,40px)] leading-[1] font-bold tracking-[-.005em] whitespace-nowrap tabular-nums',
);

/**
 * The same figure when the formatted money has 15 characters or more (₱100,000,000.00 and up): a smaller clamp keeps
 * ₱999,999,999.99 inside the card at 320 px, where the usual clamp ran 4 px past the value box (plan 06-18). Shorter figures
 * keep the usual clamp above, so the approved look does not change.
 */
export const kpiLongValueClasses = tw(
  'font-display text-[length:clamp(22px,13.5cqi,40px)] leading-[1] font-bold tracking-[-.005em] whitespace-nowrap tabular-nums',
);

/**
 * The same figure when the value is text (a category name, UI-SPEC "Long KPI value"): it wraps at word boundaries and
 * never truncates, so a 40-character name stays inside the card. Numbers and counts keep the one-line look above.
 */
export const kpiTextValueClasses = tw(
  'font-display text-[length:clamp(26px,15cqi,40px)] leading-[1] font-bold tracking-[-.005em] wrap-break-word tabular-nums',
);

/**
 * D-39 (owner, 2026-10-08): a zero figure is dimmed by colour only, in `--ink-subtle` (the D-02 `.is-zero` treatment;
 * 5.78:1 light / 6.19:1 dark on the card's `--surface`). No opacity. App. B/D.3 have no KpiCard zero state; the
 * reference side gets the same colour from the rulings layer (`.csp-kpi-value[data-zero]`).
 */
export const kpiZeroValueClasses = tw('text-ink-subtle');

/** `.csp-kpi-foot`: the delta chip and the hint, 12px/16px `--ink-muted`. */
export const kpiFootClasses = tw('flex items-center gap-2 text-[12px] leading-4 text-ink-muted');

/** `.csp-delta`: the 700 trend chip, its 14px icon 4px before the percentage. */
export const deltaClasses = tw('inline-flex items-center gap-1 font-bold');

/** `.csp-delta.is-up` / `.is-down`: green up, red down. */
export const deltaToneClasses = {
  up: tw('text-success'),
  down: tw('text-danger'),
} as const satisfies Record<DeltaDirection, string>;

/* ───────────── OrderTotals ───────────── */

/** `.csp-totals` + `.csp-totals-<variant>`: a 12px-gap column; the panel adds the 20px-padded `--surface` box. */
export const totalsClasses = {
  card: tw('flex flex-col gap-3'),
  panel: tw('flex flex-col gap-3 rounded-md border border-line bg-surface p-5'),
} as const satisfies Record<TotalsVariant, string>;

/** `.csp-totals-rows`: the figure list, no margin, 6px between rows (`.csp-totals-card` tightens it to 2px). */
export const totalsRowsClasses = {
  card: tw('m-0 flex flex-col gap-0.5'),
  panel: tw('m-0 flex flex-col gap-1.5'),
} as const satisfies Record<TotalsVariant, string>;

/** `.csp-totals-internal`: the panel's expenses and profit list, below a 2px dashed `--line` rule with 12px above. */
export const totalsInternalClasses = tw('border-t-2 border-dashed border-line pt-3');

/** `.csp-totals-row`: label and figure spread apart, 14px/20px (`.csp-totals-card` 13px). */
export const totalsRowClasses = {
  card: tw('flex justify-between gap-3 text-[13px] leading-5'),
  panel: tw('flex justify-between gap-3 text-[14px] leading-5'),
} as const satisfies Record<TotalsVariant, string>;

/** `.csp-totals-row dt`, and `.is-strong dt` (600 in `--ink`). */
export const totalsTermClasses = {
  normal: tw('text-ink-muted'),
  strong: tw('font-semibold text-ink'),
} as const;

/** `.csp-totals-row dd`: no margin, tabular, 600. */
export const totalsFigureClasses = tw('m-0 font-semibold tabular-nums');

/** `.csp-totals-row .is-neg`: a negative profit in `--danger`. */
export const totalsNegativeClasses = tw('text-danger');

/** `.csp-balance` padding: 12px by 16px, and 16px all round inside the panel. */
export const balanceClasses = {
  card: tw('flex items-center justify-between gap-3 rounded-sm px-4 py-3'),
  panel: tw('flex items-center justify-between gap-3 rounded-sm p-4'),
} as const satisfies Record<TotalsVariant, string>;

/**
 * `.csp-balance.is-due` / `.is-paid`: the warning-soft or success-soft ground. SPEC-DEVIATION: D-02, D-04, D-45: a
 * customer credit sits on the info-soft ground (the order page) and the card's credit and a Cancelled order's Not
 * collected block on the neutral `--surface-2` ground.
 */
export const balanceToneClasses = {
  due: tw('bg-warning-soft'),
  paid: tw('bg-success-soft'),
  credit: tw('bg-info-soft'),
  neutral: tw('bg-surface-2'),
} as const satisfies Record<BalanceState, string>;

/** `.csp-balance.is-due .csp-overline` / `.is-paid .csp-overline`: the overline in the state's colour. */
export const balanceOverlineClasses = {
  due: clsx(overlineType, tw('text-warning')),
  paid: clsx(overlineType, tw('text-success')),
  credit: clsx(overlineType, tw('text-info')),
  neutral: clsx(overlineType, tw('text-ink-muted')),
} as const satisfies Record<BalanceState, string>;

/** The customer credit block holds a line and a button under the overline and figure, so it wraps (D-02, D-19). */
export const balanceWrapClasses = tw('flex-wrap');

/** The credit block's line "Paid over the total. Record a refund to clear it.": 12px/16px, on its own row. */
export const balanceLineClasses = tw('m-0 basis-full text-[12px] leading-4 text-ink');

/** `.csp-balance-value`: the big balance figure in `--ink`, 28px (`.csp-totals-panel` 40px), line height 1. */
export const balanceValueClasses = {
  card: tw('font-display text-[28px] leading-[1] font-bold text-ink tabular-nums'),
  panel: tw('font-display text-[40px] leading-[1] font-bold text-ink tabular-nums'),
} as const satisfies Record<TotalsVariant, string>;

/** `.csp-balance-paid`: the green "Fully Paid" with its check icon, display 22px, upper case, .02em tracking. */
export const balancePaidClasses = tw(
  'inline-flex items-center gap-1.5 font-display text-[22px] leading-[1] font-bold tracking-[.02em] text-success uppercase',
);

/**
 * `.csp-totals-note`: 12px/16px `--ink-subtle`. Its own `margin: 2px 0 0` never applies in the approved design: App. C
 * `.s-page p { margin: 0 }` is more specific and comes later, and OrderTotals always sits inside the page root, so the
 * computed margin is 0 (as plans 02-21 and 02-22 found for the other component paragraphs).
 */
export const totalsNoteClasses = tw('m-0 text-[12px] leading-4 text-ink-subtle');
