// The Home page looks (UI-SPEC H1; App. C `.s-cut`, `.s-head`, `.s-cats`, `.s-why`, `.s-testis`, `.s-hero-art`) as complete
// Tailwind tokens (D-33): no CSS file, no @apply. `pg-phone:` is App. C's 767px container rule and `pg-lt-lg:` its 1023px
// rule. Every string is a class list that the class gate compiles.
import { tw } from '@/ui/tw';

/** `.s-wrap`: the 1200px column with 24px sides (16px on phones). */
export const homeWrapClasses = tw('mx-auto max-w-(--container-max) px-6 pg-phone:px-4');

/** `.s-sec`: a plain band, 96px above and below (48px on phones). */
export const secClasses = tw('relative py-24 pg-phone:py-12');

/**
 * `.s-cut`: the surface band with a slanted top and bottom edge. Its negative margins pull the neighbours under the slants;
 * on phones the angle is 32px and the padding 48px plus the angle.
 */
export const cutClasses = tw(
  'relative my-[calc(var(--cut-angle)*-1)] bg-surface py-[calc(var(--space-24)+var(--cut-angle))] [clip-path:polygon(0_var(--cut-angle),100%_0,100%_calc(100%_-_var(--cut-angle)),0_100%)] pg-phone:py-[calc(var(--space-12)+32px)] pg-phone:[--cut-angle:32px]',
);

/** `.s-cut.s-mesh`: the cut band with the dot grid over it. */
export const cutMeshClasses = tw(
  'bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px]',
);

/** `.s-head`: the eyebrow, the h2 and the lead, 12px apart, 48px above what follows (32px on phones). */
export const headClasses = tw('mb-12 flex flex-col gap-3 pg-phone:mb-8');

/** `.s-head-row`: a head and its link on one row that wraps, 48px above what follows (32px on phones). */
export const headRowClasses = tw('mb-12 flex flex-wrap items-end justify-between gap-6 pg-phone:mb-8');

/** `.s-head` inside a head row: no margin of its own. */
export const headInRowClasses = tw('flex flex-col gap-3');

/** `.s-h2`: display 800 at 48px (36px on phones), caps. */
export const h2Classes = tw('font-display text-48 leading-none font-heavy uppercase pg-phone:text-36');

/** `.s-h2 em`: the accent word, upright, in the accent ink. */
export const h2EmClasses = tw('text-accent-ink not-italic');

/**
 * `.s-cats`: three columns, 24px apart; two at 1023px and below. On phones the gap is 12px, the title 20px, the card text
 * is hidden and the card body takes 8px, 12px and 16px of padding (App. C `.s-cats .csp-cat-*`).
 */
export const catsClasses = tw(
  'grid grid-cols-[repeat(3,minmax(0,1fr))] gap-6 pg-phone:gap-3 pg-lt-lg:grid-cols-[repeat(2,minmax(0,1fr))] pg-phone:[&_a>div:last-child]:px-3 pg-phone:[&_a>div:last-child]:pt-2 pg-phone:[&_a>div:last-child]:pb-4 pg-phone:[&_h3]:text-20 pg-phone:[&_p]:hidden',
);

/** A skeleton card's body: the title, two text lines and the link, so the section keeps its height when the cards land. */
export const catSkeletonBodyClasses = tw(
  'grid h-[132px] content-start gap-2 px-5 pt-2 pb-5 pg-phone:h-[84px] pg-phone:px-3',
);

/** A skeleton card: the card's own frame around the 4:5 media. */
export const catSkeletonClasses = tw('overflow-hidden rounded-md border border-line bg-surface');

/** A skeleton card's media: the 4:5 box the photo or the placeholder fills, so the cards do not move when they land. */
export const catSkeletonMediaClasses = tw('aspect-4/5');

/** A skeleton card's text lines, 8px apart. */
export const skeletonLinesClasses = tw('grid gap-2');

/** A skeleton testimonial frame: the card's own look at about its height (stars, three lines of quote, the byline). */
export const testimonialSkeletonClasses = tw(
  'flex min-h-[232px] flex-col gap-4 rounded-md border border-line bg-surface p-6',
);

/* ───────────── hero drawing (App. C `.s-hero-art*`) ───────────── */

/** `.s-hero-art`: a square the drawing is stacked in. */
export const heroArtClasses = tw('relative aspect-square');

/** `.s-hero-num`: the outlined italic number at the top right, 260px (160px on phones). */
export const heroNumClasses = tw(
  'pointer-events-none absolute -top-[4%] -right-[2%] font-display text-260 leading-[.8] font-heavy text-transparent italic [-webkit-text-stroke:2px_var(--line)] pg-phone:text-160',
);

/** `.s-hero-slab2`: the sand slab behind. */
export const heroSlabBackClasses = tw(
  'absolute top-[22%] right-[22%] bottom-[10%] left-0 bg-sand [clip-path:polygon(0_12%,100%_0,100%_100%,0_100%)]',
);

/** `.s-hero-slab`: the orange slab. */
export const heroSlabClasses = tw(
  'absolute top-[8%] right-0 bottom-0 left-[14%] bg-accent [clip-path:polygon(0_18%,100%_0,100%_82%,0_100%)]',
);

// SPEC-GAP: App. C writes the shadow as rgba(0,0,0,.55); the class gate bans colour literals, so --ink at 55% stands in.
/** `.s-hero-jersey`: the maroon jersey with its drop shadow. */
export const heroJerseyClasses = tw(
  'absolute top-[6%] left-[10%] h-[90%] w-[82%] [filter:drop-shadow(0_30px_40px_color-mix(in_srgb,var(--ink)_55%,transparent))]',
);

/* ───────────── Why CSPS (App. C `.s-why*`) ───────────── */

// The container variants are stacked so each width has one rule: five columns above 1279px, three from 768px to 1279px,
// one on phones (the variants are declared phone first, so a plain 1279px rule would also win on phones).
/** `.s-why`: five columns, three up to 1279px, one on phones. */
export const whyGridClasses = tw(
  'grid grid-cols-[repeat(5,minmax(0,1fr))] gap-4 pg-phone:grid-cols-[minmax(0,1fr)] pg-phone:gap-3 pg-md-up:pg-lt-xl:grid-cols-[repeat(3,minmax(0,1fr))]',
);

/** `.s-why-item`: a bordered card; on phones a row with a smaller padding. */
export const whyItemClasses = tw(
  'relative flex flex-col gap-3 rounded-md border border-line bg-surface px-5 py-6 pg-phone:flex-row pg-phone:items-start pg-phone:p-4',
);

/** `.s-why-icon`: the 48px tile tilted 6 degrees (44px on phones). */
export const whyIconClasses = tw(
  'grid size-12 [transform:rotate(-6deg)] place-items-center rounded-sm bg-accent-soft text-accent-ink pg-phone:size-11 pg-phone:flex-none',
);

/** The item's text block: the title over the text; a column of its own on phones (App. C `.s-why-item > div`). */
export const whyTextClasses = tw('pg-phone:flex pg-phone:flex-col pg-phone:gap-1');

/** `.s-why-item h3`. */
export const whyTitleClasses = tw('font-display text-22 leading-[1.1] font-bold uppercase');

/** `.s-why-item p`. */
export const whyBodyClasses = tw('text-14 leading-5 text-ink-muted');

/* ───────────── testimonials (App. C `.s-testis`) ───────────── */

/** `.s-sec` with no top padding: the testimonial band. */
export const testimonialSectionClasses = tw('relative pb-24 pg-phone:pb-12');

// SPEC-DEVIATION: A11Y-SCROLL. The phone carousel is a focusable region (the markup is in TestimonialRow), so the focus
// ring is the page's own :focus-visible ring.
/** `.s-testis`: three columns, two from 768px to 1023px, and on phones one row of 86% cards that scrolls and snaps inside itself. */
export const testisClasses = tw(
  'grid grid-cols-[repeat(3,minmax(0,1fr))] gap-6 pg-phone:snap-x pg-phone:snap-mandatory pg-phone:[scrollbar-width:none] pg-phone:auto-cols-[86%] pg-phone:grid-flow-col pg-phone:grid-cols-none pg-phone:gap-3 pg-phone:overflow-x-auto pg-phone:*:snap-start pg-tablet:grid-cols-[repeat(2,minmax(0,1fr))]',
);

/* ───────────── final call to action (App. C `.s-cut-accent`) ───────────── */

/** `.s-cut.s-cut-accent`: the orange band with a slanted top edge only and no bottom margin. */
export const ctaClasses = tw(
  'relative mt-[calc(var(--cut-angle)*-1)] mb-0 bg-accent py-[calc(var(--space-24)+var(--cut-angle))] text-on-accent [clip-path:polygon(0_var(--cut-angle),100%_0,100%_100%,0_100%)] pg-phone:py-[calc(var(--space-12)+32px)] pg-phone:[--cut-angle:32px]',
);

/** The band's column: the text on the left, the buttons on the right, wrapping, bottom aligned. */
export const ctaWrapClasses = tw(
  'mx-auto flex max-w-(--container-max) flex-wrap items-end justify-between gap-8 px-6 pg-phone:px-4',
);

/** The band's text block: at most 640px wide. */
export const ctaTextClasses = tw('flex max-w-[640px] flex-col gap-4');

/** The band's `.s-h2` at 64px with a .95 line height. */
export const ctaHeadingClasses = tw('font-display text-64 leading-[.95] font-heavy wrap-anywhere uppercase');

/** `.s-cut-accent .s-lead`: the lead in the on-accent ink at 80%. */
export const ctaLeadClasses = tw(
  'max-w-[560px] text-18 leading-[28px] text-[color-mix(in_srgb,var(--on-accent)_80%,transparent)] pg-phone:text-16 pg-phone:leading-6',
);
