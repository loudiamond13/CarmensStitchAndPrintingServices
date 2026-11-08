// The money screens' looks as complete Tailwind tokens (D-33; plan 10-13): the dashboard strip (D-46) and the My Money balance
// card (D-39). Every string here is a class list. No new token: spacing, radius, colour and type come from the theme.
import clsx from 'clsx';
import { cardClasses } from '@/components/money';
import { pageSublineClasses } from '@/components/layout/layout.recipe';
import { tw } from '@/ui/tw';

/**
 * `.s-money-strip` (D-46): a `.s-card` row, 16px padding and gap, at least 64px tall. It wraps, so on phones the actions drop to their
 * own row under the label and the figure.
 */
export const moneyStripClasses = clsx(cardClasses, tw('flex min-h-16 min-w-0 flex-wrap items-center gap-4 p-4'));

/** The 32px wallet tile in the KpiCard tile look (`--accent-soft`, radius 8). It is hidden on phones, as the KPI icons are. */
export const moneyStripTileClasses = tw(
  'grid size-8 shrink-0 place-items-center rounded-sm bg-accent-soft text-accent-ink pg-phone:hidden',
);

/** The label over the figure; it takes the room the actions leave. */
export const moneyStripBodyClasses = tw('flex min-w-0 flex-1 flex-col gap-1');

/** The strip's label: 14px, 600. */
export const moneyStripLabelClasses = tw('text-[14px] leading-5 font-semibold text-ink-muted');

/**
 * The strip's figure: display 24px, 700, one line. The Money component has no 24px size, so the strip sets the figure itself from
 * formatPeso. The tone sets only the colour: plain ink, danger below zero (D-21), or the zero dim (D-39).
 */
export const moneyStripFigureClasses = tw(
  'font-display text-[24px] leading-none font-bold whitespace-nowrap tabular-nums',
);

/** The figure colours, one per tone. */
export const moneyStripToneClasses = {
  plain: tw('text-ink'),
  danger: tw('text-danger'),
  zero: tw('text-ink-subtle'),
} as const;

/** The failure line and its Try Again in the figure slot. */
export const moneyStripFailedClasses = tw('flex flex-wrap items-center gap-x-2');

/** The failure line: Small (14px), in the danger colour. */
export const moneyStripFailedTextClasses = tw('text-[14px] leading-5 text-danger');

/** The buttons: pushed right; on phones they take the next row and share it equally. */
export const moneyStripActionsClasses = tw(
  'ml-auto flex flex-wrap items-center gap-2 pg-phone:ml-0 pg-phone:w-full pg-phone:*:flex-1',
);

/** The reason a Transfer button cannot be used (D-14): Small (14px), muted. On the strip it takes its own row under the content. */
export const transferReasonClasses = tw(
  'm-0 w-full text-right text-[14px] leading-5 text-ink-muted pg-phone:text-left',
);

/** My Money's header actions: the Transfer button over its reason, aligned right; on phones both take the row. */
export const moneyHeadActionsClasses = tw('flex flex-col items-end gap-1 pg-phone:w-full pg-phone:items-stretch');

/** The reason under the My Money header button. */
export const moneyHeadReasonClasses = tw('m-0 text-right text-[14px] leading-5 text-ink-muted pg-phone:text-left');

/** `.s-card` for the My Money balance card: full width, `min-width: 0` so a long figure never widens the page. */
export const moneyCardClasses = clsx(cardClasses, tw('min-w-0'));

/**
 * `.s-card-b`: the card body, content left aligned, 20px padding, 8px between the overline, the figure and the line. It is the inline-size
 * container the long-figure clamp below measures, as the KPI card is for its value.
 */
export const moneyCardBodyClasses = tw('@container flex flex-col items-start gap-2 p-5');

/**
 * The large figure when the formatted money has 15 characters or more (₱100,000,000.00 and up): the usual 40px is clamped to the card width
 * so it stays inside the card at 320px, as the KPI cards do (plan 06-18). It is important because Money sets its own 40px. Shorter figures
 * keep the large size.
 */
export const moneyCardLongFigureClasses = tw('text-[length:clamp(22px,13.5cqi,40px)]!');

/** The zero dim of the large figure (D-39): colour only, as the KPI cards dim a zero. */
export const moneyCardZeroClasses = tw('text-ink-subtle');

/** The line that says what the figure is made of: Small (14px), muted. */
export const moneyCardExplanationClasses = pageSublineClasses;

/** The failure banner inside the card body. */
export const moneyCardStateClasses = tw('w-full');
