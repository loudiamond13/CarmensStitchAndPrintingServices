// The marketing looks (App. B `/* ── Marketing ── */`, CSPS-UI-SPEC.md §6.7) as complete Tailwind tokens (D-33). Every
// string in this file is a class list (the class gate reads them all). The public site is Blush only (D-14).
//
// App. C's `.s-page h1…h4, p { margin: 0 }` beats the App. B margins of `.csp-step-title` (0 0 8px); the approved page
// therefore shows no margin there, and none is written here. Order-sensitive transforms are arbitrary `[transform:…]`
// properties (research Pitfall 25): `scale-*` / `translate-*` set the individual properties, which apply in a fixed
// order and would not reproduce `scale(1.04) translateY(-52%)`.
import { tw } from '@/ui/tw';

/* ───────────── CategoryCard ───────────── */

/**
 * `.csp-cat`: the whole card is a link on `--surface` with a 1px `--line` border, clipped, in `--ink` with no
 * underline. On hover it lifts 4px, takes the `--accent-line` border and `--shadow-2` (all over .25s ease). `group/cat`
 * lets the photo, the number and the arrow follow the card's hover.
 */
export const categoryCardClasses = tw(
  'group/cat relative flex flex-col overflow-hidden rounded-md border border-line bg-surface text-ink no-underline transition-[transform,border-color,box-shadow] duration-250 ease-[ease] hover:[transform:translateY(-4px)] hover:border-accent-line hover:[box-shadow:var(--shadow-2)]',
);

/** `.csp-cat-media`: the media clipped to a slanted bottom edge (100% → 88% on the right). */
export const categoryMediaClasses = tw('overflow-hidden [clip-path:polygon(0_0,100%_0,100%_88%,0_100%)]');

/**
 * `.csp-cat-media img`: the 4:5 photo, covering, with App. B's hover transform (`scale(1.04) translateY(-52%)`, the
 * same as the number's) over .4s ease.
 */
export const categoryImageClasses = tw(
  'block aspect-[4/5] w-full object-cover transition-[transform] duration-[.4s] ease-[ease] group-hover/cat:[transform:scale(1.04)_translateY(-52%)]',
);

/**
 * `.csp-cat:hover .csp-media-ph-num`: while the card is hovered, the placeholder's outlined number (its only child
 * here: the chip is off, `label={false}`, App. B `.csp-cat-media .csp-media-ph-label { display: none }`) grows 4% and
 * rises to -52%. The number keeps its own `transition: transform .4s ease` (brand.recipe.ts).
 */
export const categoryPlaceholderClasses = tw('group-hover/cat:*:[transform:scale(1.04)_translateY(-52%)]');

/** `.csp-cat-body`: the text column, 8px above, 20px at the sides and below, 8px between lines. */
export const categoryBodyClasses = tw('flex flex-col gap-2 px-5 pt-2 pb-5');

/** `.csp-cat-title`: display 800 28px, line height 1, upper case. */
export const categoryTitleClasses = tw('font-display text-[28px] leading-[1] font-heavy uppercase');

/** `.csp-cat-desc`: 14px/20px `--ink-muted`. */
export const categoryDescriptionClasses = tw('text-[14px] leading-5 text-ink-muted');

/** `.csp-cat-link`: "Customize" and its arrow, 4px apart, 650 14px `--accent-ink`, 8px above. */
export const categoryLinkClasses = tw('mt-2 inline-flex items-center gap-1 text-[14px] font-button text-accent-ink');

/** `.csp-cat-link .csp-icon`: the arrow nudges 2px up and right while the card is hovered (.2s ease). */
export const categoryLinkIconClasses = tw(
  'transition-[transform] duration-200 ease-[ease] group-hover/cat:[transform:translate(2px,-2px)]',
);

/* ───────────── ProcessSteps ───────────── */

/** `.csp-steps`: the ordered list as a grid, 16px apart: 1 column, 2 from 640px, 4 from 1024px. */
export const stepsClasses = tw(
  'm-0 grid list-none grid-cols-[1fr] gap-4 p-0 [counter-reset:s] sm:grid-cols-[repeat(2,1fr)] lg:grid-cols-[repeat(4,1fr)]',
);

/**
 * `.csp-step` and `.csp-step::after`: a clipped `--surface` card (1px `--line`, 24px top and 20px side and bottom
 * padding) with a stitched 2px `--line-strong` rule along its top edge, 20px in from each side.
 */
export const stepClasses = tw(
  "relative overflow-hidden rounded-md border border-line bg-surface px-5 pt-6 pb-5 after:absolute after:top-0 after:right-5 after:left-5 after:h-0.5 after:bg-[image:repeating-linear-gradient(90deg,var(--line-strong)_0_8px,transparent_8px_14px)] after:content-['']",
);

/** `.csp-step-no`: the italic display 800 56px numeral ("01") in `--accent-ink`, line height .9, 12px above the title. */
export const stepNumberClasses = tw(
  'mb-3 block font-display text-[56px] leading-[.9] font-heavy text-accent-ink italic',
);

/** `.csp-step-icon`: the bare icon in `--ink-muted`, 20px from the right and 24px from the top. */
export const stepIconClasses = tw('absolute top-6 right-5 text-ink-muted');

/** `.csp-step-title`: display 700 22px, line height 1.1, upper case. */
export const stepTitleClasses = tw('font-display text-[22px] leading-[1.1] font-bold uppercase');

/** `.csp-step-desc`: 14px/20px `--ink-muted`. */
export const stepDescriptionClasses = tw('text-[14px] leading-5 text-ink-muted');

/* ───────────── TestimonialCard ───────────── */

/** `.csp-testi`: the figure as a `--surface` card (1px `--line`, 24px padding), 16px between its parts. */
export const testimonialClasses = tw('m-0 flex flex-col gap-4 rounded-md border border-line bg-surface p-6');

/** `.csp-testi-stars`: five 16px stars, 2px apart; the empty ones in `--line-strong`. */
export const starsClasses = tw('flex gap-0.5 text-line-strong');

/** `.csp-testi-stars .on`: a filled star, stroke and fill in `--accent-ink`. */
export const starOnClasses = tw('fill-accent-ink text-accent-ink');

/** `.csp-testi-quote` with its curly quote marks before and after. */
export const quoteClasses = tw("m-0 text-[17px] leading-[26px] before:content-['“'] after:content-['”']");

/** `.csp-testi-by`: the avatar, name and team, 12px apart, 16px below a 2px dashed `--line` rule. */
export const bylineClasses = tw('flex items-center gap-3 border-t-2 border-dashed border-line pt-4');

/** `.csp-testi-by strong`: the name, 14px/20px on its own line. */
export const bylineNameClasses = tw('block text-[14px] leading-5');

/** `.csp-testi-by span span`: the team, 12px/16px `--ink-muted`. */
export const bylineTeamClasses = tw('text-[12px] leading-4 text-ink-muted');
