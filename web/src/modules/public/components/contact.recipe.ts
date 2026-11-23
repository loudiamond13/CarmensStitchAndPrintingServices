// The Contact page looks (UI-SPEC C1; App. C `.s-contact`, `.s-formcard`, `.s-side`, `.s-bigbtn*`, `.s-infocard`, `.s-map*`,
// `.s-mbar`) as complete Tailwind tokens (D-33): no CSS file, no @apply. `pg-phone:` is App. C's 767px container rule and
// `pg-lt-lg:` its 1023px rule. Every string is a class list that the class gate compiles.
import { tw } from '@/ui/tw';

/** `.s-sec` with the 24px top padding App. E.4 gives it: 96px below, 48px on phones. */
export const contactSectionClasses = tw('relative pt-6 pb-24 pg-phone:pb-12');

/** `.s-wrap.s-contact`: 1.35fr to .9fr with 32px between; one column up to 1023px. */
export const contactGridClasses = tw(
  'mx-auto grid max-w-(--container-max) grid-cols-[1.35fr_.9fr] items-start gap-8 px-6 pg-phone:px-4 pg-lt-lg:grid-cols-[minmax(0,1fr)]',
);

/** `.s-formcard`: padding 32, radius 18; 20 and 12 on phones. */
export const formCardClasses = tw(
  'flex flex-col gap-6 rounded-lg border border-line bg-surface p-8 pg-phone:rounded-md pg-phone:p-5',
);

/** The card's head: the title over the intro, 6px apart. */
export const cardHeadClasses = tw('flex flex-col gap-[6px]');

/** `.s-title`: display 700 at 32px. */
export const cardTitleClasses = tw('font-display text-32 leading-[1.05] font-bold');

/** `.s-small.s-muted`. */
export const smallMutedClasses = tw('text-14 leading-5 text-ink-muted');

/** `.csp-label`: the 14px semi-bold ink label. */
export const labelClasses = tw('text-14 leading-5 font-semibold text-ink');

/** The two big buttons, 16px apart. */
export const bigButtonsClasses = tw('flex flex-col gap-4');

/** `.s-side`: the aside, 16px between the cards. */
export const sideClasses = tw('flex min-w-0 flex-col gap-4');

// SPEC-DEVIATION: D-02 App. C `.s-bigbtn span` dims the note to opacity .8. D-02 allows no text below full opacity, so the
// note keeps full opacity and its muted ink on the light button; on the orange button it is the same ink as the title.
/** `.s-bigbtn`: the white card button; it lifts 2px on hover, and not under reduced motion. */
export const bigButtonClasses = tw(
  'flex items-center gap-4 rounded-md border border-line bg-surface p-5 text-ink no-underline [transition:transform_.2s_ease,border-color_.2s_ease] hover:-translate-y-0.5 hover:border-accent-line motion-reduce:transition-none motion-reduce:hover:translate-y-0',
);

/** `.s-bigbtn.is-primary`: the orange button. */
export const bigButtonPrimaryClasses = tw('border-accent-line bg-accent text-on-accent');

/** `.s-bigbtn-ic`: the 52px icon tile. */
export const bigButtonTileClasses = tw(
  'grid size-13 flex-none place-items-center rounded-sm bg-surface-2 text-accent-ink',
);

/** `.s-bigbtn.is-primary .s-bigbtn-ic`: the dark tile on the orange button. */
export const bigButtonTilePrimaryClasses = tw('bg-on-accent text-accent');

/** `.s-bigbtn strong`: the display 24px caps line. */
export const bigButtonTitleClasses = tw('block font-display text-24 leading-[1.05] font-heavy uppercase');

/** `.s-bigbtn span` (the note), 13px. */
export const bigButtonNoteClasses = tw('block text-13 leading-[18px]');

/** The note on the light button: `.s-muted`. */
export const bigButtonNoteMutedClasses = tw('text-ink-muted');

/** `.s-go`: the arrow, pushed to the right edge. */
export const bigButtonGoClasses = tw('ml-auto flex-none');

/** `.s-go.s-muted`: the arrow on the light button. */
export const bigButtonGoMutedClasses = tw('text-ink-muted');

/** `.s-infocard`: the white 12px-radius card with 20px padding, 12px between its parts. */
export const infoCardClasses = tw('flex flex-col gap-3 rounded-md border border-line bg-surface p-5');

/** The info card title: display 700 at 20px, caps (App. E.4's `h3` look on an `h2`, A11Y-H). */
export const infoTitleClasses = tw('font-display text-20 font-bold uppercase');

/** A phone row: the link, then its label and badge. */
export const phoneRowClasses = tw('flex flex-wrap items-center gap-x-3 gap-y-1');

/** The `tel:` link of a phone row: at least 44px tall. */
export const phoneLinkClasses = tw(
  'inline-flex min-h-11 items-center font-semibold text-ink no-underline hover:text-accent-ink',
);

/** The MapCard column: the map, the privacy line, and the label card once the map is live, 12px apart. */
export const mapCardClasses = tw('flex flex-col gap-3');

/** `.s-map`: 16:10, radius 12, a 1px line. The frame never changes size, so the page does not shift (CLS). */
export const mapBoxClasses = tw('relative aspect-[16/10] overflow-hidden rounded-md border border-line bg-surface-2');

/** `.s-map-roads.s-mesh`: the drawn roads fill the box. */
export const mapRoadsClasses = tw(
  'absolute inset-0 size-full bg-[image:radial-gradient(circle_at_1px_1px,color-mix(in_srgb,var(--ink)_9%,transparent)_1px,transparent_1.6px)] bg-size-[6px_6px]',
);

/** The two main roads of the drawn map: the Surface 3 tint. */
export const mapRoadMainClasses = tw('stroke-surface-3');

/** The side road of the drawn map: the Surface tint. */
export const mapRoadSideClasses = tw('stroke-surface');

/** The far road of the drawn map: the Neutral soft tint. */
export const mapRoadFarClasses = tw('stroke-neutral-soft');

/** The dashed centre line of the drawn map: the Nav tint. */
export const mapRoadDashClasses = tw('stroke-nav-bg');

/** `.s-map-pin`: the pin column, anchored by its tip. */
export const mapPinClasses = tw(
  'absolute top-[46%] left-1/2 flex [transform:translate(-50%,-100%)] flex-col items-center gap-1',
);

/** `.s-map-pin span`: the orange teardrop, turned so its tip points down. */
export const mapPinHeadClasses = tw(
  'grid size-11 [transform:rotate(-45deg)] place-items-center rounded-[50%_50%_50%_0] bg-accent text-on-accent [box-shadow:var(--shadow-2)] [&_svg]:[transform:rotate(45deg)]',
);

/** The iframe fills the 16:10 box. */
export const mapFrameClasses = tw('absolute inset-0 size-full border-0');

/** `.s-map-label`: the label card (static under a live map). It wraps its actions under the address at 420px and below. */
export const mapLabelClasses = tw(
  'flex items-center justify-between gap-3 rounded-sm bg-surface-3 p-3 text-13 leading-[18px] pg-xs:flex-wrap',
);

/** The label card laid over the drawn map: 12px in from the left, right and bottom. */
export const mapLabelOverlayClasses = tw('absolute right-3 bottom-3 left-3');

/** The label card's address block; it shrinks and wraps long addresses. */
export const mapLabelTextClasses = tw('min-w-0 wrap-anywhere');

/** The label card's actions: Show Map and Directions. */
export const mapActionsClasses = tw('flex flex-none flex-wrap items-center gap-3');

/** The Directions link: the `.s-link` look at least 44px tall. */
export const mapDirectionsClasses = tw(
  'inline-flex min-h-11 items-center gap-[6px] font-button text-accent-ink no-underline hover:underline hover:underline-offset-4',
);

/**
 * `.s-mbar`: the phone-only sticky bar. It is hidden above 767px and a grid at 767px and below; it is 77px tall plus the
 * device's safe area.
 */
// SPEC-DEVIATION: 11-UI-REVIEW fix 6: App. C pads the bottom 16px; the safe area is added, as on the admin tab bar.
export const barClasses = tw(
  'sticky bottom-0 z-30 hidden gap-2 border-t border-line bg-[color-mix(in_srgb,var(--bg)_92%,transparent)] px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] backdrop-blur-[12px] pg-phone:grid',
);

/** Two columns: Messenger and Call us side by side. */
export const barTwoClasses = tw('pg-phone:grid-cols-2');

/** One column: Call us fills the bar when there is no Messenger link. */
export const barOneClasses = tw('pg-phone:grid-cols-1');

// Both bar buttons share the 48px button shape; public-look.node.test.ts keeps the two in step.

/** `.s-a-primary` in the bar. */
export const barPrimaryClasses = tw(
  'inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-primary bg-primary px-3 text-16 font-button whitespace-nowrap text-on-primary no-underline hover:bg-primary-hover',
);

/** `.s-a-secondary` in the bar. */
export const barSecondaryClasses = tw(
  'inline-flex h-12 items-center justify-center gap-2 rounded-sm border border-line-strong px-3 text-16 font-button whitespace-nowrap text-ink no-underline hover:bg-surface-2',
);
