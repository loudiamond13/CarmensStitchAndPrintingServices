// The Products page looks (UI-SPEC P1; App. C `.s-prod*`, `.s-custom*`, `.s-price`, `.s-tile-kit`) as complete Tailwind
// tokens (D-33): no CSS file, no @apply. `pg-phone:` is App. C's 767px container rule and `pg-lt-lg:` its 1023px rule.
// Every string is a class list that the class gate compiles.
import { tw } from '@/ui/tw';

/** `.s-wrap`: the 1200px column with 24px sides (16px on phones). */
export const prodWrapClasses = tw('mx-auto max-w-(--container-max) px-6 pg-phone:px-4');

// SPEC-GAP: UI-SPEC P1 gives the article a scroll-margin-top of header + pill bar + 16px and the page a top scroll padding of
// header + 1px + 24px + the pill bar. Browsers add the two when they scroll to an address, which would stop an article
// about 300px down the screen. The page padding already keeps everything clear of both sticky bars, so the article adds
// only its own 16px.
/** `.s-prod`: media and copy side by side (1.1fr to .9fr), one column up to 1023px, dashed rule below. */
export const articleClasses = tw(
  'grid scroll-mt-4 grid-cols-[1.1fr_.9fr] items-start gap-12 border-b-2 border-dashed border-line py-16 pg-phone:gap-6 pg-phone:py-12 pg-lt-lg:grid-cols-[minmax(0,1fr)]',
);

/** `.s-prod.is-flip .s-prod-media`: the media on the right, back to the left in one column. */
export const flipMediaClasses = tw('order-2 pg-lt-lg:order-0');

/** `.s-prod-media`: the 5:4 grid, a 2fr to 1fr pair of columns; on phones the large cell spans the top and the two small cells sit below. */
export const mediaGridClasses = tw(
  'grid aspect-5/4 grid-cols-[2fr_1fr] grid-rows-[1fr_1fr] gap-3 pg-phone:aspect-auto pg-phone:grid-cols-[1fr_1fr] pg-phone:grid-rows-[auto_auto]',
);

/** `.s-prod-media > div`: a rounded, clipped cell. */
export const mediaCellClasses = tw('relative overflow-hidden rounded-md');

/** `.s-prod-media > div:first-child`: the large cell spans both rows (4:3 across on phones). */
export const mediaLargeCellClasses = tw('row-span-2 pg-phone:col-span-2 pg-phone:row-auto pg-phone:aspect-4/3');

/** The two small cells are squares on phones. */
export const mediaSmallCellClasses = tw('pg-phone:aspect-square');

/** What fills a cell: the photo, the placeholder or the drawn jersey fit the cell's own box. */
export const mediaFillClasses = tw('absolute inset-0');

/** The large cell's ground when the jersey is drawn: the mesh on the placeholder color. */
export const mediaGroundClasses = tw(
  'absolute inset-0 bg-surface-2 bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px]',
);

/** `.s-tile-kit`: the drawing centered in the cell. */
export const jerseyKitClasses = tw('absolute inset-0 grid place-items-center');

/** `.s-prod-media .s-tile-kit svg`: the jersey is 70% of the cell wide. */
export const jerseySvgClasses = tw('h-auto w-[70%]');

/** `.s-prod-copy`: the texts, 20px apart; long words wrap. */
export const copyClasses = tw('flex min-w-0 flex-col gap-5 wrap-anywhere');

/** `.s-prod-no`: the italic display number in the accent ink. */
export const numberClasses = tw('font-display text-20 font-heavy tracking-[.04em] text-accent-ink italic');

/** `.s-h2`: display 800 at 48px (36px on phones), caps. */
export const articleTitleClasses = tw('font-display text-48 leading-none font-heavy uppercase pg-phone:text-36');

/** The "What you can customize" eyebrow with its 8px top margin. */
export const customizeEyebrowClasses = tw('mt-2');

/** `.s-custom`: the cards in two columns (one on phones), 12px apart. */
export const customGridClasses = tw(
  'mt-2 grid grid-cols-[repeat(2,minmax(0,1fr))] gap-3 pg-phone:grid-cols-[minmax(0,1fr)]',
);

/** `.s-custom-item`: a bordered card; the wide one spans both columns. */
export const customCardClasses = tw('flex flex-col gap-1 rounded-sm border border-line bg-surface p-4');

/** `.s-custom-item.is-wide`. */
export const customCardWideClasses = tw('col-span-full');

/** `.s-custom-item h4`: the bold 14px title with its icon. */
export const customTitleClasses = tw('flex items-center gap-2 text-14 leading-5 font-bold');

/** `.s-custom-item h4 .csp-icon`. */
export const customIconClasses = tw('text-accent-ink');

/** `.s-custom-item p`. */
export const customTextClasses = tw('text-13 leading-[18px] text-ink-muted');

/** `.s-price`: the price line, baseline aligned, wrapping on a narrow screen. */
export const priceClasses = tw('flex flex-wrap items-baseline gap-2 pt-2');

/** `.s-price strong`: the display 700 28px figure. */
export const priceStrongClasses = tw('font-display text-28 font-bold');

/** `.s-muted.s-small`. */
export const priceMutedClasses = tw('text-14 leading-5 text-ink-muted');

/** `.s-anchors`: the bar sticks under the header (56px on phones) on a blurred page ground with a rule below. */
export const anchorsClasses = tw(
  'sticky top-(--header-height) z-5 border-b border-line bg-[color-mix(in_srgb,var(--bg)_90%,transparent)] backdrop-blur-[12px] pg-phone:top-14',
);

// SPEC-GAP: App. C `.s-anchors-in` sets its side padding to 0, so the first pill sat against the screen edge and 24px left of
// the page text. The pills keep the page's own side padding. The bar is 69px: 12px, the 44px pill, 12px and the 1px rule.
/** `.s-anchors-in`: the pills in one row that scrolls inside itself, with no scrollbar drawn. */
export const anchorsInClasses = tw(
  'mx-auto flex max-w-(--container-max) [scrollbar-width:none] gap-2 overflow-x-auto px-6 py-3 pg-phone:px-4',
);

/** `.s-pill`: a 44px pill link (OQ-3 A) that never wraps its title. */
export const pillClasses = tw(
  'inline-flex min-h-11 items-center gap-[6px] rounded-sm border border-line bg-surface px-4 text-14 font-semibold whitespace-nowrap text-ink-muted no-underline hover:border-line-strong hover:text-ink',
);

/** The column that holds the error or the empty state: 24px above, 48px below. */
export const stateWrapClasses = tw('mx-auto max-w-(--container-max) px-6 pt-6 pb-12 pg-phone:px-4');

/** A skeleton article's media: the 5:4 box the real grid fills, so the page does not shift when the photos land. */
export const skeletonMediaClasses = tw('aspect-5/4 overflow-hidden rounded-md');

/** A skeleton article's text lines, 8px apart. */
export const skeletonCopyClasses = tw('grid min-w-0 gap-2');

/** `.s-btnrow`: the article's buttons. */
export const articleButtonsClasses = tw('flex flex-wrap items-center gap-3');

/** `.s-sec`: the help card's band, 96px above and below (48px on phones). */
export const helpSectionClasses = tw('relative py-24 pg-phone:py-12');

/** The help `.s-card`: padding 40, radius 18, text on the left and buttons on the right. */
export const helpCardClasses = tw(
  'flex flex-wrap items-center justify-between gap-6 rounded-lg border border-line bg-surface p-10 [box-shadow:var(--shadow-1)]',
);

/** The help card's text block: the eyebrow over the title, at most 620px wide. */
export const helpTextClasses = tw('flex max-w-[620px] flex-col gap-2');

/** The help card's `.s-h2` at 40px. */
export const helpTitleClasses = tw('font-display text-40 leading-none font-heavy uppercase');
