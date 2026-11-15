// The public-site looks (UI-SPEC Design System "Styling"; App. C `.s-*` rules) as complete Tailwind tokens (D-33): no CSS
// file, no @apply. The public pages are Blush only (D-14). `pg-phone:` is App. C's 767px container rule and `pg-lt-lg:` its
// 1023px rule. Every string is a class list that the class gate compiles.
import { tw } from '@/ui/tw';

/** `.s-pagehead.s-mesh`: top padding 64px (32px on phones); the bottom padding is one of the two below. */
export const pageHeadClasses = tw(
  'relative overflow-hidden bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px] pt-16 pg-phone:pt-8',
);

/** `.s-pagehead` bottom padding: 48px plus the cut angle (32px on phones). */
export const pageHeadBottomClasses = tw(
  'pb-[calc(var(--space-12)+var(--cut-angle))] pg-phone:pb-[calc(var(--space-8)+var(--cut-angle))]',
);

/** The page head with `padding-bottom: 48px` (App. E.3, E.4, and the 404 page): 48px at every width. */
export const pageHeadFlatBottomClasses = tw('pb-12');

/** The `.s-wrap` column of a page head: 20px between the parts. */
export const pageHeadWrapClasses = tw('mx-auto flex max-w-(--container-max) flex-col gap-[20px] px-6 pg-phone:px-4');

/** `.s-crumbs`: the breadcrumb row, 13px muted, 16px below. */
export const crumbsClasses = tw('mb-4 flex gap-2 text-13 text-ink-subtle');

/** `.s-crumbs a`: no underline. */
export const crumbLinkClasses = tw('no-underline');

/** `.s-eyebrow`: the display caps line with the skewed accent dash before it. */
export const eyebrowClasses = tw(
  'inline-flex items-center gap-2 font-display text-14 leading-[1.15] font-bold tracking-[.16em] text-accent-ink uppercase before:h-[3px] before:w-[24px] before:[transform:skewX(-18deg)] before:bg-accent-line',
);

/** `.s-pagehead .s-h1`: 80px (52px on phones); it outranks the 76px tablet `.s-h1` rule, so it stays 80px down to phones. */
export const pageH1Classes = tw(
  'font-display text-80 leading-[.88] font-heavy tracking-[-.01em] uppercase italic pg-phone:text-52',
);

/** `.s-h1 em` and `.s-pagehead .s-h1 em`: the accent word. */
export const h1EmClasses = tw('text-accent-ink italic');

/** `.s-h1`: the hero heading, 96px, 76px up to 1023px and 56px on phones. */
export const heroH1Classes = tw(
  'font-display text-96 leading-[.88] font-heavy tracking-[-.01em] uppercase italic pg-phone:text-56 pg-lt-lg:text-76',
);

/** `.s-lead`: 18/28 muted, at most 560px wide; 16/24 on phones. */
export const leadClasses = tw(
  'max-w-[560px] text-18 leading-[28px] text-ink-muted pg-phone:text-16 pg-phone:leading-[24px]',
);

/** `.s-btnrow`: the buttons in a wrapping row. */
export const btnRowClasses = tw('flex flex-wrap items-center gap-3');

/** `.s-a-primary`: the maroon fill. */
export const aBtnPrimaryClasses = tw(
  'inline-flex h-[52px] items-center justify-center gap-2 rounded-sm border border-primary bg-primary px-6 text-16 font-button whitespace-nowrap text-on-primary no-underline transition-[background-color,transform,box-shadow] duration-150 ease-[ease] hover:bg-primary-hover hover:[box-shadow:0_6px_20px_-10px_var(--primary)]',
);

/** `.s-a-secondary`: the outline. */
export const aBtnSecondaryClasses = tw(
  'inline-flex h-[52px] items-center justify-center gap-2 rounded-sm border border-line-strong px-6 text-16 font-button whitespace-nowrap text-ink no-underline transition-[background-color,transform,box-shadow] duration-150 ease-[ease] hover:bg-surface-2',
);

// SPEC-GAP: the approved dark button hovers to #000. The class gate bans colour literals, so --ink stands in for it.
/** `.s-cut-accent .s-a-dark`: the light button on the orange call-to-action band. */
export const aBtnDarkClasses = tw(
  'inline-flex h-[52px] items-center justify-center gap-2 rounded-sm border border-on-accent bg-on-accent px-6 text-16 font-button whitespace-nowrap text-accent no-underline transition-[background-color,transform,box-shadow] duration-150 ease-[ease] hover:border-ink hover:bg-ink',
);

/** `.s-cut-accent .s-a-ghost`: the outline button on the orange band. */
export const aBtnGhostClasses = tw(
  'inline-flex h-[52px] items-center justify-center gap-2 rounded-sm border border-on-accent px-6 text-16 font-button whitespace-nowrap text-on-accent no-underline transition-[background-color,transform,box-shadow] duration-150 ease-[ease]',
);

/** `.s-link`: the accent text link with an underline on hover. */
export const linkClasses = tw(
  'inline-flex items-center gap-[6px] font-button text-accent-ink no-underline hover:underline hover:underline-offset-4',
);

/** `.s-hero.s-mesh`: 64px above, 96px plus the cut angle below; 32px above and 64px plus 32px below on phones. */
export const heroClasses = tw(
  'relative overflow-hidden bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px] pt-16 pb-[calc(var(--space-24)+var(--cut-angle))] pg-phone:pt-8 pg-phone:pb-[calc(var(--space-16)+32px)]',
);

/** `.s-wrap.s-hero-grid`: 1.1fr to .9fr with 48px between; one column up to 1023px, 32px between on phones. */
export const heroGridClasses = tw(
  'mx-auto grid max-w-(--container-max) grid-cols-[1.1fr_.9fr] items-center gap-12 px-6 pg-phone:gap-8 pg-phone:px-4 pg-lt-lg:grid-cols-[minmax(0,1fr)]',
);

/** `.s-hero-copy`: the text column, 24px between the parts. */
export const heroCopyClasses = tw('relative z-1 flex flex-col gap-6');

/** `.s-chips`: the chip row. */
export const chipsClasses = tw('flex flex-wrap gap-2');

/** `.s-chip`: a 32px bordered chip with its accent icon. */
export const chipClasses = tw(
  'inline-flex h-8 items-center gap-[6px] rounded-xs border border-line bg-surface px-3 text-13 font-semibold text-ink-muted',
);

/** `.s-chip .csp-icon`: the chip icon takes the accent ink. */
export const chipIconClasses = tw('text-accent-ink');
