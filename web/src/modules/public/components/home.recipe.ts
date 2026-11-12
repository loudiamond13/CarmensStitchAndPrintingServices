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
export const h2Classes = tw('font-display text-[48px] leading-none font-heavy uppercase pg-phone:text-[36px]');

/** `.s-h2 em`: the accent word, upright, in the accent ink. */
export const h2EmClasses = tw('text-accent-ink not-italic');

/**
 * `.s-cats`: three columns, 24px apart; two at 1023px and below. On phones the gap is 12px, the title 20px, the card text
 * is hidden and the card body takes 8px, 12px and 16px of padding (App. C `.s-cats .csp-cat-*`).
 */
export const catsClasses = tw(
  'grid grid-cols-[repeat(3,minmax(0,1fr))] gap-6 pg-phone:gap-3 pg-lt-lg:grid-cols-[repeat(2,minmax(0,1fr))] pg-phone:[&_a>div:last-child]:px-3 pg-phone:[&_a>div:last-child]:pt-2 pg-phone:[&_a>div:last-child]:pb-4 pg-phone:[&_h3]:text-[20px] pg-phone:[&_p]:hidden',
);

/** A skeleton card's body: the title, two text lines and the link, so the section keeps its height when the cards land. */
export const catSkeletonBodyClasses = tw(
  'grid h-[132px] content-start gap-2 px-5 pt-2 pb-5 pg-phone:h-[84px] pg-phone:px-3',
);

/** A skeleton card: the card's own frame around the 4:5 media. */
export const catSkeletonClasses = tw('overflow-hidden rounded-md border border-line bg-surface');
