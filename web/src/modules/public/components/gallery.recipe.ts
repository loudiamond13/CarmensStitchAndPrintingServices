// The Gallery looks (UI-SPEC G1, App. E.3; App. C `.s-pill`, `.s-masonry`, `.s-mtile`, `.s-tile-cap`) as complete Tailwind
// tokens (D-33): no CSS file, no @apply. `pg-phone:` is App. C's 767px container rule and `pg-lt-xl:` its 1279px rule. The
// sticky bar and its row come from products.recipe.ts (`.s-anchors`, `.s-anchors-in`). Every string is a class list that
// the class gate compiles.
import { tw } from '@/ui/tw';

/** `.s-pill`: a 44px pill button (OQ-3 A) that never wraps its words. */
export const galleryPillClasses = tw(
  'relative inline-flex min-h-11 flex-none cursor-pointer items-center gap-[6px] rounded-sm border px-4 text-14 whitespace-nowrap no-underline',
);

/** An unselected pill. */
export const galleryPillOffClasses = tw(
  'border-line bg-surface font-semibold text-ink-muted hover:border-line-strong hover:text-ink',
);

/** `.s-pill.is-on`: the selected pill is maroon and bold (D-03), so orange is never the only cue. */
export const galleryPillOnClasses = tw('border-primary bg-primary font-bold text-on-primary');

/** `.s-pill-count`: the number, at full opacity (P2 D-02 FYI-01). */
export const galleryPillCountClasses = tw('tabular-nums');

/** The column under the bar: 32px above the tiles, 96px below (48px on phones). */
export const galleryBodyClasses = tw('mx-auto max-w-(--container-max) px-6 pt-8 pb-24 pg-phone:px-4 pg-phone:pb-12');

// The columns fill top to bottom, so the DOM order is the gallery order and focus runs down each column. The container
// variants are stacked so each width has one rule: four columns above 1279px, three from 768px to 1279px, two on phones.
/** `.s-masonry`: four columns, three up to 1279px, two on phones (gap 12px). */
export const masonryClasses = tw('columns-4 gap-x-4 pg-phone:columns-2 pg-phone:gap-x-3 pg-md-up:pg-lt-xl:columns-3');

/** `.s-mtile`: a zoom-in button, clipped to its radius, that never splits across two columns. */
export const tileClasses = tw(
  'group relative mb-4 block w-full cursor-zoom-in break-inside-avoid overflow-hidden rounded-md border-0 bg-surface-2 p-0 text-left text-ink pg-phone:mb-3',
);

/** The drawn jersey's box: the dot grid on the placeholder ground; the sizer gives it its height. */
export const tileArtClasses = tw(
  'relative bg-surface-2 bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px]',
);

/** The hidden svg whose viewBox gives the drawn tile its height at the box's full width. */
export const tileSizerClasses = tw('block h-auto w-full');

/** `.s-tile-kit`: the drawing centered in its box. */
export const tileKitClasses = tw('absolute inset-0 grid place-items-center');

/** `.s-tile-kit svg`: the jersey is 64% of the box wide. */
export const tileJerseyClasses = tw('h-auto w-[64%]');

// D-31 (OQ-2 A): the words sit on a solid blush band (92%), and the fade runs only above it, so the text always passes contrast.
/** `.s-tile-cap`: the caption band at the foot of the tile; it grows with a long name. */
export const tileCaptionClasses = tw(
  'absolute inset-x-0 bottom-0 flex flex-col gap-[2px] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-4 pt-0 pb-4 transition-[padding] duration-200 group-hover:pb-5 before:absolute before:inset-x-0 before:bottom-full before:h-6 before:bg-[linear-gradient(transparent,color-mix(in_srgb,var(--bg)_92%,transparent))] before:content-[""] motion-reduce:transition-none',
);

/** `.s-tile-cap strong`: the team in display caps, 16px on phones; long names wrap. */
export const tileTeamClasses = tw(
  'font-display text-20 leading-[1.1] font-bold wrap-anywhere text-ink uppercase pg-phone:text-16',
);

/** A centered row of one button, 32px under what is above it. */
export const galleryActionRowClasses = tw('mt-8 flex justify-center');

/** Show More Photos is a button: the `.s-a-secondary` look on a transparent ground. */
export const showMoreClasses = tw('cursor-pointer bg-transparent');

/** The column that holds the error or the empty state: 24px above, 48px below. */
export const galleryStateClasses = tw('mx-auto max-w-(--container-max) px-6 pt-8 pb-12 pg-phone:px-4');

/** A skeleton pill: one of the 44px pill frames, never shrinking. */
export const pillSkeletonClasses = tw('flex-none');

/** A skeleton tile: a clipped, rounded frame that stays in its column like a real tile. */
export const tileSkeletonClasses = tw('mb-4 break-inside-avoid overflow-hidden rounded-md pg-phone:mb-3');

/** The skeleton tiles' ratios in turn: 4 / 5, 1 / 1, 3 / 4 and 4 / 3 (UI-SPEC G1 States). */
export const tileSkeletonRatios = [tw('aspect-4/5'), tw('aspect-square'), tw('aspect-3/4'), tw('aspect-4/3')] as const;

/** `.s-tile-cap span`: the line and pieces. */
export const tileMetaClasses = tw('text-12 leading-4 font-semibold text-ink-muted');
