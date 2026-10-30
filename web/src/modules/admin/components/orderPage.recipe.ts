// The order page looks (App. C `.s-detail*`, `.s-tabcard`, `.s-tabbar-h`, `.s-ph-actions` and their `@container pg` rules; UI-SPEC O1;
// plan 08-10) as complete Tailwind tokens (D-33). Every string here is a class list. No new token: spacing, radius, colour and type
// come from the theme.
import clsx from 'clsx';
import { cardClasses, overlineClasses } from '@/components/money';
import { tw } from '@/ui/tw';

/** The page column: header, then the detail grid, 24px apart (20px on phones). */
export const orderPageClasses = tw('flex w-full flex-col gap-6 pg-phone:gap-5');

/** The h1 and the status badge in one wrapping row, 12px apart. */
export const orderTitleRowClasses = tw('flex flex-wrap items-center gap-3');

/** `.s-ph-title h1` on the order page: the accent ink with a wide tracking, the number may break anywhere on a narrow phone. */
export const orderNumberClasses = tw(
  'font-display text-[34px] leading-[1.05] font-bold tracking-[.02em] wrap-anywhere text-accent-ink focus:[outline:none] pg-phone:text-[30px] pg-tablet:text-[30px]',
);

/** The team name in the subline: ink, where the rest of the line is muted. */
export const orderSublineStrongClasses = tw('font-semibold text-ink');

/** `.s-ph-actions`: the header buttons in a row 8px apart; on phones they take the full width and share it. */
export const orderActionsClasses = tw('flex flex-wrap items-center gap-2 pg-phone:w-full pg-phone:*:flex-1');

/** The back link row above the title, kept clear of it. */
export const orderBackRowClasses = tw('flex');

/**
 * `.s-detail`: the main column and a 360px side (320px up to 1279px), 24px apart; one column up to 1023px, where the side moves above
 * the main column as a two-column grid (the totals left, the customer right). The container variants are emitted widest first, so
 * the one-column rule is important or the 1279px rule would win on a tablet.
 */
export const orderDetailClasses = tw(
  'grid grid-cols-[minmax(0,1fr)_360px] items-start gap-6 pg-lt-lg:grid-cols-[minmax(0,1fr)]! pg-lt-xl:grid-cols-[minmax(0,1fr)_320px]',
);

/** `.s-detail-main`: the Images card and the tab card, 24px apart. */
export const orderMainClasses = tw('flex min-w-0 flex-col gap-6');

/**
 * `.s-detail-side`: sticky at the top bar plus 24px on desktop. On a tablet it moves above the main column as a two-column grid
 * (the totals left, the customer card right; the history card spans both, see orderHistoryCardClasses). On a phone it is static and
 * follows the main column, so the phone order is header, balance card, images, tabs, totals, customer, history.
 */
export const orderSideClasses = tw(
  'sticky top-[calc(var(--topbar-height)+24px)] flex min-w-0 flex-col gap-4 pg-tablet:order-first pg-tablet:grid pg-tablet:grid-cols-2 pg-tablet:items-start pg-lt-lg:static',
);

/** `.s-card`: the card look; `min-width: 0` lets a long value shrink instead of widening the grid. */
export const orderCardClasses = clsx(cardClasses, tw('min-w-0'));

/** `.s-card-h`: the title block on a hairline; wraps when an action sits beside it. */
export const orderCardHeadClasses = tw(
  'flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4',
);

/** `.s-card-h h2`: display 700, 22px. */
export const orderCardTitleClasses = tw('font-display text-[22px] leading-[1.1] font-bold');

/** `.s-card-h p`: 13px muted. */
export const orderCardHintClasses = tw('text-[13px] text-ink-muted');

/** The Images card body: the icon tile and its line, centred. */
export const orderImagesBodyClasses = tw(
  'flex flex-col items-center gap-3 px-4 py-10 text-center text-[14px] leading-5 text-ink-muted',
);

/** The 56px tile behind the image icon. */
export const orderImageTileClasses = tw('grid size-14 place-items-center rounded-md bg-surface-2 text-ink-muted');

/** `.s-tabcard .csp-tabs`: the tab strip is inset 12px from the card edge. */
export const orderTabsRowClasses = tw('px-3');

/** `.s-tabbar-h`: the panel title block and its action, wrapping, on 16px by 20px padding. */
export const orderTabHeadClasses = tw('flex flex-wrap items-center justify-between gap-3 px-5 py-4');

/** `.s-tabbar-h h3`: display 700, 20px. */
export const orderTabTitleClasses = tw('font-display text-[20px] leading-[1.1] font-bold');

/** The caption under a panel title: 13px muted. */
export const orderTabCaptionClasses = tw('text-[13px] leading-5 text-ink-muted');

/** The table inside a tab panel, kept clear of the card edge by the panel padding. */
export const orderTabBodyClasses = tw('px-5 pb-5 pg-phone:px-4');

/** The note under a tab table (the last item cannot be deleted, D-48), 16px clear of it. */
export const orderTabNoteClasses = tw('mt-4');

/** The bold name cell of a table (a date, a reason). */
export const orderCellStrongClasses = tw('font-semibold');

/** The amount inside a caption, bold. */
export const orderCaptionFigureClasses = tw('font-bold text-ink');

/** A tabular cell: reference numbers line up. */
export const orderTabularClasses = tw('tabular-nums');

/** `.s-inline-empty`: the empty line of a tab, centred. */
export const orderInlineEmptyClasses = tw(
  'flex flex-col items-center gap-3 px-4 py-12 text-center text-[14px] text-ink-muted',
);

/** The Back to Orders button under the not-found message. */
export const orderStateActionClasses = tw('flex');

/** The status history card spans both columns of the tablet side grid. */
export const orderHistoryCardClasses = clsx(orderCardClasses, tw('pg-tablet:col-span-2'));

/** The title of a side card with an icon or a link beside it. */
export const orderCardTitleRowClasses = tw('flex items-center gap-2');

/** `.s-meta`: label and value on one grid, the value end-aligned and free to wrap anywhere. */
export const orderMetaClasses = tw('m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[14px] leading-5');

/** `.s-meta dt`: the icon and the label, muted. */
export const orderMetaTermClasses = tw('flex items-center gap-1.5 text-ink-muted');

/** `.s-meta dd`: the value, 600, end-aligned. */
export const orderMetaValueClasses = tw('m-0 min-w-0 text-right font-semibold wrap-anywhere');

/** The notes keep the line breaks the person typed. */
export const orderNotesClasses = tw('whitespace-pre-line');

/** A side card body: padded, its parts 16px apart. */
export const orderCardBodyClasses = tw('flex flex-col gap-4 p-5');

/** The status history list: no bullets, rows 12px apart. */
export const orderHistoryListClasses = tw('m-0 flex list-none flex-col gap-3 p-0');

/** A history row title: 14px, 600. */
export const orderHistoryTitleClasses = tw('block text-[14px] leading-5 font-semibold text-ink');

/** A history row line: 12px muted. */
export const orderHistorySubClasses = tw('block text-[12px] leading-4 text-ink-muted');

/** The Show All button sits at the start of the card foot. */
export const orderHistoryMoreClasses = tw('flex');

/**
 * The slim balance card (D-33): a full-width button under the header, shown on phones only. `hidden` removes it from view and from
 * the accessibility tree above 767px; the page container turns it into a flex row at 767px and below.
 */
export const orderBalanceStripClasses = tw(
  'hidden min-h-14 w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 text-left [box-shadow:var(--shadow-1)] pg-phone:flex',
);

/** One side of the strip: an overline over a figure. */
export const orderStripColumnClasses = tw('flex min-w-0 flex-col gap-0.5');

/** The right side: the balance column and the chevron. */
export const orderStripEndClasses = tw('flex items-center gap-2 text-ink-muted');

/** The balance column is end-aligned. */
export const orderStripBalanceClasses = tw('flex min-w-0 flex-col items-end gap-0.5');

/** The strip's overline per state (the label type in the state's colour). */
export const orderStripOverlineClasses = {
  neutral: overlineClasses,
  due: tw('text-[11px] leading-4 font-bold tracking-[.12em] text-warning uppercase'),
  paid: tw('text-[11px] leading-4 font-bold tracking-[.12em] text-success uppercase'),
  credit: tw('text-[11px] leading-4 font-bold tracking-[.12em] text-info uppercase'),
} as const;

/** A strip figure: the display face, tabular, one line. */
export const orderStripFigureClasses = tw(
  'font-display text-[20px] leading-none font-bold whitespace-nowrap text-ink tabular-nums',
);

/** The green Fully Paid label with its check. */
export const orderStripPaidClasses = tw(
  'inline-flex items-center gap-1.5 font-display text-[18px] leading-none font-bold tracking-[.02em] text-success uppercase',
);

/** A `div` that groups a term and its value inside the `dl` without taking part in the grid. */
export const orderMetaRowClasses = tw('contents');

/**
 * The locked-order banner (`.s-banner` layout with the neutral `--surface-2` ground and a 1px `--line-strong` border; D-15): the
 * icon, the text and an action slot in one row. On phones the action wraps onto its own full-width row (D-57).
 */
export const orderLockedBannerClasses = tw(
  'flex items-center gap-3 rounded-sm border border-line-strong bg-surface-2 px-4 py-3 text-[14px] leading-5 text-ink pg-phone:flex-wrap',
);

/** The bold first line and the muted second (and third) line. */
export const orderLockedTextClasses = tw(
  'min-w-0 flex-1 wrap-anywhere [&_span]:block [&_span]:text-ink-muted [&_strong]:block',
);

/** The action beside the text; full width under it on phones. */
export const orderLockedActionClasses = tw('flex-none pg-phone:w-full pg-phone:[&>*]:w-full');

/** The Change Status button and its popover share one anchor. */
export const orderStatusMenuClasses = tw('relative inline-flex');

/**
 * The Change Status popover (`--surface-3`, like the user menu): under the button at its left edge; on phones it hangs from the
 * button's right edge and never grows past the viewport, so the page does not scroll sideways.
 */
export const orderStatusMenuPopoverClasses = tw(
  'absolute top-full left-0 z-(--z-header) mt-1 flex min-w-[240px] origin-top-left animate-csp-pop-in flex-col gap-0.5 rounded-md bg-surface-3 p-2 shadow-level-2 data-[state=closed]:pointer-events-none data-[state=closed]:animate-csp-pop-out motion-reduce:animate-none motion-reduce:data-[state=closed]:animate-none pg-phone:right-0 pg-phone:left-auto pg-phone:max-w-[calc(100vw-32px)] pg-phone:origin-top-right',
);

/** One menu item: at least 44px tall, a status dot or an icon, the label, and room for a reason line under it. */
export const orderStatusItemClasses = tw(
  'flex min-h-11 w-full cursor-pointer appearance-none items-center gap-3 rounded-sm border-0 bg-transparent px-3 py-1.5 text-start text-[14px] leading-5 font-semibold text-ink hover:bg-surface-2 focus-visible:bg-surface-2 aria-disabled:cursor-not-allowed aria-disabled:text-ink-muted',
);

/** The danger item (Cancel Order). */
export const orderStatusDangerItemClasses = tw('text-danger');

/** The label and an optional reason line, stacked. */
export const orderStatusItemTextClasses = tw('flex min-w-0 flex-col');

/** The reason under a disabled item: Small, muted, regular weight. */
export const orderStatusReasonClasses = tw('text-[14px] leading-5 font-normal text-ink-muted');

/** The hairline between the moves and the end states. */
export const orderStatusDividerClasses = tw('my-1 h-px bg-line');

/** The 7px status dot of a menu item, in the ink of that status's badge. */
export const orderStatusDotClasses = tw('size-[7px] flex-none rounded-pill bg-current');

/** The ink of each badge tone, for the dot. */
export const orderStatusDotToneClasses = {
  neutral: tw('text-ink-muted'),
  accent: tw('text-accent-ink'),
  success: tw('text-success'),
  warning: tw('text-warning'),
  info: tw('text-info'),
  mockup: tw('text-mockup'),
  danger: tw('text-danger'),
  solid: tw('text-accent'),
} as const;

/** The empty slot that keeps a dot item and an icon item aligned. */
export const orderStatusIconSlotClasses = tw('grid size-[18px] flex-none place-items-center');
