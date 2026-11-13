// The Recent work strip and the hero tag looks (UI-SPEC H1 items 1 and 5; App. C `.s-strip`, `.s-tile`, `.s-tile-cap`,
// `.s-hero-tag`) as complete Tailwind tokens (D-33): no CSS file, no @apply. They sit in their own file, because Home's own
// recipe file is read by the page's first download and these parts load after it (PERF-01). `pg-phone:` is App. C's 767px
// container rule. Every string is a class list that the class gate compiles.
import { tw } from '@/ui/tw';

/** `.s-strip`: one row of tiles at least 240px wide (72% on phones) that scrolls and snaps inside itself, with no scrollbar drawn. */
export const stripClasses = tw(
  'grid snap-x snap-mandatory [scrollbar-width:none] auto-cols-[minmax(240px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-2 pg-phone:auto-cols-[72%]',
);

// The photo scales 1.04 over .4s on hover, and not at all under reduced motion (UI-SPEC H1 item 5).
/** `.s-tile`: a 4:5 tile link, clipped to its radius. */
export const stripTileClasses = tw(
  'group relative block snap-start overflow-hidden rounded-md bg-surface-2 text-ink no-underline [&_img]:transition-transform [&_img]:duration-[400ms] hover:[&_img]:scale-[1.04] motion-reduce:[&_img]:transition-none motion-reduce:hover:[&_img]:scale-100',
);

/** The drawn jersey's box: 4:5 with the dot grid on the placeholder ground. */
export const stripArtClasses = tw(
  'relative aspect-4/5 bg-surface-2 bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px]',
);

/** `.s-tile-kit`: the drawing centered in its box. */
export const stripKitClasses = tw('absolute inset-0 grid place-items-center');

/** `.s-tile-kit svg`: the jersey is 64% of the box wide, and scales 1.04 on hover like a photo. */
export const stripJerseyClasses = tw(
  'h-auto w-[64%] transition-transform duration-[400ms] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100',
);

// D-31 (OQ-2 A): the words sit on a solid blush band (92%), and the fade runs only above it, so the text always passes contrast.
/** `.s-tile-cap`: the caption band at the foot of the tile; it grows with a long name. */
export const stripCaptionClasses = tw(
  'absolute inset-x-0 bottom-0 flex flex-col gap-[2px] bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-4 pb-4 before:absolute before:inset-x-0 before:bottom-full before:h-6 before:bg-[linear-gradient(transparent,color-mix(in_srgb,var(--bg)_92%,transparent))] before:content-[""]',
);

/** `.s-tile-cap strong`: the team in display caps; long names wrap. */
export const stripTeamClasses = tw(
  'font-display text-20 leading-[1.1] font-bold wrap-anywhere text-ink uppercase pg-phone:text-16',
);

/** `.s-tile-cap span`: the line and pieces. */
export const stripMetaClasses = tw('text-12 leading-4 font-semibold text-ink-muted');

/** A skeleton tile: a 4:5 frame in the strip's own columns. */
export const stripSkeletonClasses = tw('aspect-4/5 snap-start overflow-hidden rounded-md');

/** `.s-hero-tag`: the floating card at the bottom left of the hero drawing; long names wrap. */
export const heroTagClasses = tw(
  'absolute bottom-[6%] left-0 flex max-w-[80%] flex-col gap-[2px] rounded-md border border-line bg-surface-3 px-4 py-3 [box-shadow:var(--shadow-2)]',
);

/** `.s-hero-tag strong`: the name in display caps. */
export const heroTagNameClasses = tw('font-display text-20 leading-[1.1] font-bold wrap-anywhere uppercase');

/** `.s-cap`: the small muted lines above and below the name. */
export const heroTagCapClasses = tw('text-12 leading-4 text-ink-muted');
