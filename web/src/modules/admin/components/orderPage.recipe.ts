// The order page looks (App. C `.s-detail*`, `.s-tabcard`, `.s-tabbar-h`, `.s-ph-actions` and their `@container pg` rules; UI-SPEC O1;
// plan 08-10) as complete Tailwind tokens (D-33). Every string here is a class list. No new token: spacing, radius, colour and type
// come from the theme.
import clsx from 'clsx';
import { cardClasses } from '@/components/money';
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

/** `.s-detail-side`: sticky at the top bar plus 24px on desktop; static and first on tablets and phones. */
export const orderSideClasses = tw(
  'sticky top-[calc(var(--topbar-height)+24px)] flex min-w-0 flex-col gap-4 pg-lt-lg:static pg-lt-lg:order-first',
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

/** The bold name cell of a table (the product type). */
export const orderCellStrongClasses = tw('font-semibold');
