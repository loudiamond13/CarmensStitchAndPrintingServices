// The money screens' looks as complete Tailwind tokens (D-33; plan 10-13): the dashboard strip (D-46) and the My Money balance
// card (D-39). Every string here is a class list. No new token: spacing, radius, colour and type come from the theme.
import clsx from 'clsx';
import { hitAreaClasses } from '@/components/actions';
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

/* ───────────── Ledger card (D-41) ───────────── */

/** The Ledger card: the surface card with `min-width: 0`, so a long note never widens the page. */
export const ledgerCardClasses = clsx(cardClasses, tw('min-w-0'));

/** The Show deleted row above the table (Manager only): 16px under the head, aligned with the card padding. */
export const ledgerToolsClasses = tw('px-5 pt-4');

/** The result bar inside the card, aligned with the card padding. */
export const ledgerBarClasses = tw('px-5 pt-4 pb-3');

/** The pagination row under the table, set off by a line. */
export const ledgerPagerClasses = tw('border-t border-line px-5 py-4');

/** A row's Details cell: the title over its sub line, 2px apart; the cell shrinks and wraps instead of widening the table. */
export const ledgerDetailsClasses = tw('flex min-w-0 flex-col gap-0.5');

/** A row title: Label 14/600, with the Deleted badge after it. Long names wrap anywhere. */
export const ledgerTitleClasses = tw(
  'flex min-w-0 flex-wrap items-center gap-x-2 text-[14px] leading-5 font-semibold wrap-anywhere',
);

/** A row sub line: Small 14/400, muted. Long notes and descriptions wrap anywhere. */
export const ledgerSubClasses = tw('min-w-0 text-[14px] leading-5 font-normal wrap-anywhere text-ink-muted');

/** The order number in a sub line: the accent link, underlined so it reads as a link inside muted text. */
export const ledgerOrderLinkClasses = clsx(tw('text-accent-ink underline underline-offset-2'), hitAreaClasses);

/** A deleted transfer's amount: muted and struck through. The Deleted badge, not the strike, carries the meaning. */
export const ledgerStruckClasses = tw('text-ink-muted line-through');

/** "Not counted" in the Balance column of a deleted transfer: Small, muted. */
export const ledgerNotCountedClasses = tw('text-[14px] leading-5 text-ink-muted');

/* ───────────── Tabs and All Staff (D-42 to D-45; plan 10-19) ───────────── */

/** One tab's content on My Money: the cards 24px apart (20px on phones), as the page spaces them without tabs. */
export const moneyPanelClasses = tw('flex min-w-0 flex-col gap-6 pg-phone:gap-5');

/** The All Staff card: the surface card with `min-width: 0`, so a long name never widens the page. */
export const staffCardClasses = clsx(cardClasses, tw('min-w-0'));

/** The Person cell: the 24px avatar and the name side by side; the name may wrap. */
export const staffPersonClasses = tw('flex min-w-0 items-center gap-2');

/** The person's name and the muted " (you)": one wrapping text run. */
export const staffNameClasses = tw('min-w-0 wrap-anywhere');

/** The name link: the accent link colour, 600, with a 44px tap area. */
export const staffPersonLinkClasses = clsx(tw('font-semibold text-accent-ink hover:underline'), hitAreaClasses);

/** " (you)" after the signed-in Manager's own name. */
export const staffYouClasses = tw('text-ink-muted');

/** A balance of exactly ₱0.00: dimmed by colour only, as the balance card does (D-39). */
export const staffZeroClasses = tw('text-ink-subtle');

/** One person's page (M2): the back link row above the title, kept clear of it. */
export const personBackRowClasses = tw('flex');

/** The name, the role badge and the standing badge in one wrapping row, 8px apart (the badges sit outside the h1). */
export const personTitleRowClasses = tw('flex min-w-0 flex-wrap items-center gap-2');

/** The name wraps anywhere, so a very long name is never cut off. */
export const personNameClasses = tw('min-w-0 wrap-anywhere');

/** The not-found message and its way back, 16px apart. */
export const personNotFoundClasses = tw('flex flex-col items-start gap-4');

/** The Actions cell's pinned buttons. */
export const staffActionsClasses = tw('inline-flex items-center justify-end gap-2');

/* ───────────── Delete and remove confirms (D-24, D-33; plan 10-20) ───────────── */

/** The resulting-balance warning block under the Delete Transfer message: the warning-soft ground, an alert icon and the line. */
export const transferWarningClasses = tw(
  'mt-3 flex items-start gap-2 rounded-sm bg-warning-soft p-3 text-[14px] leading-5 font-semibold text-ink',
);

/** The alert icon in front of the warning line, in the warning colour. */
export const transferWarningIconClasses = tw('mt-0.5 shrink-0 text-warning');

/** "Couldn't check the new balances": Small, muted, under the message. */
export const transferCheckFailedClasses = tw('mt-3 block text-[14px] leading-5 text-ink-muted');

/** The details box of the permanent-remove confirm (D-24): the danger-soft ground, a 1px danger border, radius 8, 16px padding. */
export const removeDetailsClasses = tw('mt-3 flex flex-col gap-1 rounded-sm border border-danger bg-danger-soft p-4');

/** The record line of the details box: Label 14/600 in the ink colour. Long names wrap anywhere. */
export const removeRecordClasses = tw('text-[14px] leading-5 font-semibold wrap-anywhere text-ink');

/** The Small lines of the details box: 14/400, muted. Long names wrap anywhere. */
export const removeNoteClasses = tw('text-[14px] leading-5 font-normal wrap-anywhere text-ink-muted');

/* ───────────── Deleted transfers on the Transfers tab (D-30, D-31; plan 10-20) ───────────── */

/** The date and the Deleted badge side by side; they wrap on a narrow cell. */
export const transferDateCellClasses = tw('flex flex-wrap items-center gap-x-2 gap-y-1');

/** The note over the "Deleted by" line, 2px apart; both wrap anywhere. */
export const transferNoteCellClasses = tw('flex min-w-0 flex-col gap-0.5');
