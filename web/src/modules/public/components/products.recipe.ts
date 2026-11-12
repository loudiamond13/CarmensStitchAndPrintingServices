// The Products page looks (UI-SPEC P1; App. C `.s-prod*`, `.s-custom*`, `.s-price`, `.s-tile-kit`) as complete Tailwind
// tokens (D-33): no CSS file, no @apply. `pg-phone:` is App. C's 767px container rule and `pg-lt-lg:` its 1023px rule.
// Every string is a class list that the class gate compiles.
import { tw } from '@/ui/tw';

/** `.s-wrap`: the 1200px column with 24px sides (16px on phones). */
export const prodWrapClasses = tw('mx-auto max-w-(--container-max) px-6 pg-phone:px-4');

/** `.s-prod`: media and copy side by side (1.1fr to .9fr), one column up to 1023px, dashed rule below. */
export const articleClasses = tw(
  'grid grid-cols-[1.1fr_.9fr] items-start gap-12 border-b-2 border-dashed border-line py-16 pg-phone:gap-6 pg-phone:py-12 pg-lt-lg:grid-cols-[minmax(0,1fr)]',
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
export const numberClasses = tw('font-display text-[20px] font-heavy tracking-[.04em] text-accent-ink italic');

/** `.s-h2`: display 800 at 48px (36px on phones), caps. */
export const articleTitleClasses = tw(
  'font-display text-[48px] leading-none font-heavy uppercase pg-phone:text-[36px]',
);

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
export const customTitleClasses = tw('flex items-center gap-2 text-[14px] leading-5 font-bold');

/** `.s-custom-item h4 .csp-icon`. */
export const customIconClasses = tw('text-accent-ink');

/** `.s-custom-item p`. */
export const customTextClasses = tw('text-[13px] leading-[18px] text-ink-muted');

/** `.s-price`: the price line, baseline aligned, wrapping on a narrow screen. */
export const priceClasses = tw('flex flex-wrap items-baseline gap-2 pt-2');

/** `.s-price strong`: the display 700 28px figure. */
export const priceStrongClasses = tw('font-display text-[28px] font-bold');

/** `.s-muted.s-small`. */
export const priceMutedClasses = tw('text-[14px] leading-5 text-ink-muted');
