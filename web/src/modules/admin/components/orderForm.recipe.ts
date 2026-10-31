// The order form looks (App. C `.s-form-layout`, `.s-form-col`, `.s-items*`, `.s-item*`, `.s-savebar` and their `@container pg` rules;
// UI-SPEC F1; plan 08-13) as complete Tailwind tokens (D-33). Every string here is a class list; widths are classes, never inline
// styles (strict CSP). No new token: spacing, radius, colour and type come from the theme.
//
// Cascade note: the page-container variants are emitted in the order app.css declares them (phone, tablet, up to 1023px, up to 1279px),
// so rules that must not fight use `pg-tablet:` and `pg-phone:`, which never overlap. The item grid reads the Items card width instead.
import clsx from 'clsx';
import { cardClasses } from '@/components/money';
import { tw } from '@/ui/tw';

/**
 * The page column. The data attribute lets the scroll padding below name this page only: a focused field is never hidden under the
 * sticky save bar (WCAG 2.4.11, D-54d). The root already pads for the top bar; the bottom padding is the save bar (76px) plus the
 * 24px gap, and on phones also the 71px tab bar and the save bar's second row. The selector names the attribute, so it outranks
 * the admin frame's own phone padding.
 */
export const orderFormPageClasses = tw(
  'flex w-full flex-col gap-6 pg-phone:gap-5 [:root:has(&[data-savebar])]:scroll-pb-[calc(76px+var(--space-6))] vp-lt-md:[:root:has(&[data-savebar])]:scroll-pb-[calc(71px+112px+var(--space-6)+env(safe-area-inset-bottom))]',
);

/** `.s-form-layout`: the main column and a 320px aside; one column up to 1023px, the aside after the main column. */
export const orderFormLayoutClasses = tw(
  'grid grid-cols-[minmax(0,1fr)_320px] items-start gap-6 pg-lt-lg:grid-cols-[minmax(0,1fr)]',
);

/** `.s-form-col`: the cards of the main column, 24px apart (20px on phones). */
export const orderFormColClasses = tw('flex min-w-0 flex-col gap-6 pg-phone:gap-5');

/** The aside: sticky under the top bar on desktop, then static in the one-column layout. */
export const orderFormAsideClasses = tw(
  'sticky top-[calc(var(--topbar-height)+24px)] flex min-w-0 flex-col gap-4 pg-lt-lg:static',
);

/** `.s-card`: the card look. */
export const orderFormCardClasses = clsx(cardClasses, tw('min-w-0'));

/** `.s-card-h`: the title block on a hairline; wraps when an action sits beside it. */
export const orderFormCardHeadClasses = tw(
  'flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4',
);

/** `.s-card-h h2`: display 700, 22px. */
export const orderFormCardTitleClasses = tw('font-display text-[22px] leading-[1.1] font-bold');

/** `.s-card-h p`: 13px muted. */
export const orderFormCardHintClasses = tw('text-[13px] text-ink-muted');

/** A card body of fields: two columns, one on phones, 20px padding. */
export const orderFormGridClasses = tw('grid grid-cols-2 items-start gap-4 p-5 pg-phone:grid-cols-1');

/** A field that takes the full row. */
export const orderFormFullClasses = tw('col-span-2 pg-phone:col-span-1');

/** The empty cell that keeps Notes on its own row. */
export const orderFormSpacerClasses = tw('pg-phone:hidden');

/** The banner above the first card (409 orders.busy, or a 400 no field shows). */
export const orderFormBannerClasses = tw('flex flex-col');

// ── The item grid ──
// SPEC-DEVIATION: the grid follows the width of the Items card, not the page. At the page widths the spec names (1024 to 1440), the
// card sits beside the 320px aside and the 248px sidebar, so it is only 580 to 780px wide, too narrow for seven columns: the
// description column shrank to nothing and the size box covered it (axe target-size, caught in e2e). The Items card is its own
// container: under 560px each row is the 4-column phone layout, from 560px the 6-column tablet layout, and from 900px the
// 7-column row with the header above it.

/** The Items card is a container named items; the row variants below read its width. */
export const orderItemsCardClasses = clsx(cardClasses, tw('@container/items min-w-0'));

/** `.s-items`: the rows in a column. */
export const orderItemsClasses = tw('flex flex-col');

const ITEM_COLUMNS = tw(
  'grid-cols-4 it-md:grid-cols-6 it-lg:grid-cols-[180px_minmax(0,1.6fr)_96px_76px_120px_112px_44px]',
);

/** `.s-item-head`: the column headers, shown from 900px of card width only. */
export const orderItemHeadClasses = clsx(
  ITEM_COLUMNS,
  tw('hidden gap-3 px-5 pb-2 text-[11px] leading-4 font-bold tracking-[.1em] text-ink-muted uppercase it-lg:grid'),
);

/**
 * `.s-item`: one row. From 900px of card width its labels are hidden (the header names the columns) and its controls are 40px;
 * below it the labels show as small capitals above each control. On phones the controls are 44px tall (D-54b). The row is marked
 * `data-ui="s-item"`, which gives the 40px boxes and the 14px text.
 */
export const orderItemRowClasses = clsx(
  ITEM_COLUMNS,
  tw(
    'grid items-start gap-3 border-t border-line px-5 py-3 pg-phone:p-4 it-lt-lg:gap-y-2 pg-phone:[&_input]:h-11 [&_label]:sr-only it-lt-lg:[&_label]:not-sr-only it-lt-lg:[&_label]:text-[11px] it-lt-lg:[&_label]:leading-4 it-lt-lg:[&_label]:font-bold it-lt-lg:[&_label]:tracking-[.1em] it-lt-lg:[&_label]:text-ink-muted it-lt-lg:[&_label]:uppercase pg-phone:[&_select]:h-11',
  ),
);

/** Product type: three of four columns on a phone, five of six next to the remove button, one column in the 7-column row. */
export const orderItemTypeCellClasses = tw('col-span-3 min-w-0 it-md:col-span-5 it-lg:col-span-1');

/** Description: the full row below 900px. */
export const orderItemDescriptionCellClasses = tw('col-span-4 min-w-0 it-md:col-span-6 it-lg:col-span-1');

/** Size / variant: two columns below 900px. */
export const orderItemSizeCellClasses = tw('col-span-2 min-w-0 it-lg:col-span-1');

/** Qty: two columns on a phone, one from 560px; the number sits at the right. */
export const orderItemQuantityCellClasses = tw('col-span-2 min-w-0 it-md:col-span-1 [&_input]:text-right');

/** Unit price: two columns below 900px. */
export const orderItemPriceCellClasses = tw('col-span-2 min-w-0 it-lg:col-span-1');

/** The line total preview: bold, tabular, right-aligned, level with the 40px (44px on phones) controls. */
export const orderItemTotalCellClasses = tw('col-span-2 flex min-w-0 flex-col items-end it-md:col-span-1');

/** The line total's own label: read aloud always, drawn below 900px only (it is not a form control). */
export const orderItemTotalLabelClasses = tw(
  'sr-only text-[11px] leading-4 font-bold tracking-[.1em] text-ink-muted uppercase it-lt-lg:not-sr-only',
);

/** The figure, level with the controls beside it. */
export const orderItemTotalFigureClasses = tw('flex h-10 items-center text-right font-bold tabular-nums pg-phone:h-11');

/** The remove button: top right of the row below 900px. */
export const orderItemRemoveCellClasses = tw(
  'col-start-4 row-start-1 flex h-10 items-center justify-self-end pg-phone:h-11 it-md:col-start-6 it-lg:col-auto it-lg:row-auto',
);

/** A right-aligned column header (Qty, Unit price, Line total). */
export const orderItemHeadRightClasses = tw('text-right');

/** `.s-items-foot`: the dashed rule, the piece count on the left and the subtotal preview on the right. */
export const orderItemsFootClasses = tw(
  'flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-line px-5 py-4',
);

/** The subtotal block of the footer: the overline over the display figure. */
export const orderItemsSubtotalClasses = tw('flex flex-col items-end');

/** `.csp-overline`: 11px capitals. */
export const orderFormOverlineClasses = tw('text-[11px] leading-4 font-bold tracking-[.12em] text-ink-muted uppercase');

/** The footer figure: display 24, tabular. */
export const orderItemsSubtotalFigureClasses = tw('font-display text-[24px] leading-[1.1] font-bold tabular-nums');

/** The footer's piece count line. */
export const orderItemsCountClasses = tw('text-[14px] leading-5 text-ink-muted');

/** The limit note under the grid when the order has 100 rows. */
export const orderItemsLimitClasses = tw('px-5 pb-4');

// ── The summary aside ──

/** The aside's total block: the warning-soft ground (`.csp-balance.is-due`). */
export const orderAsideTotalClasses = tw('flex flex-col gap-1 rounded-sm bg-warning-soft p-4');

/** The total block's overline, in the warning colour. */
export const orderAsideTotalOverlineClasses = tw(
  'text-[11px] leading-4 font-bold tracking-[.12em] text-warning uppercase',
);

/** The total figure: display 28. */
export const orderAsideTotalFigureClasses = tw('font-display text-[28px] leading-[1] font-bold tabular-nums');

/** The aside card's body: the meta list, the total and the note, 16px apart. */
export const orderAsideBodyClasses = tw('flex flex-col gap-4 p-5');

// ── The save bar ──

/**
 * `.s-savebar`: sticky at the bottom of the main column on the surface at 92% over a 10px blur, a top hairline. On phones it sits
 * above the tab bar (71px plus the device's safe area), the caption takes the full width and the buttons share the row.
 */
export const orderSaveBarClasses = tw(
  'sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-8 py-4 [backdrop-filter:blur(10px)] pg-phone:bottom-[calc(71px+env(safe-area-inset-bottom))] pg-phone:px-4',
);

/** `.s-cap`: the caption pushes the buttons to the right; full width on a phone. */
export const orderSaveBarCaptionClasses = tw(
  'mr-auto text-[14px] leading-5 text-ink-muted pg-phone:mr-0 pg-phone:w-full',
);

/** The save bar's buttons share the phone row. */
export const orderSaveBarButtonClasses = tw('pg-phone:flex-1');
