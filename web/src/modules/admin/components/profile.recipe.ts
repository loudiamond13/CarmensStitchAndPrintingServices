// The My Profile looks (App. C `.s-profile-head`, `.s-profile-stripe`, `.s-cards2`, `.s-card*`, `.s-formgrid`, `.s-stack`
// and their `@container pg` rules; App. E.13; plan 05-13) as complete Tailwind tokens (D-33). Every string here is a class
// list (the class gate compiles each one). No new token: spacing, radius, colour and type come from the theme.
import clsx from 'clsx';
import { cardClasses } from '@/components/money';
import { tw } from '@/ui/tw';

/** `main.s-body` at 1120px (spec §8.10): the column that holds the header card, the tabs and the card grid. */
export const profilePageClasses = tw('flex w-full max-w-[1120px] flex-col gap-6 pg-phone:gap-5');

/** `.s-card.s-profile-head`: a wrapping row, 20px apart, 24px inside, clipped so the stripe stays in the card. */
export const profileHeadClasses = clsx(
  cardClasses,
  tw('relative flex min-w-0 flex-wrap items-center gap-5 overflow-hidden p-6'),
);

/**
 * `.s-profile-stripe`: the accent slab on the right (320px; 220px on tablets, 140px on phones), clipped. App. C draws it at
 * 95% opacity; D-02 keeps opacity off every box, so the accent is mixed 95% into transparent, which looks the same.
 */
export const profileStripeClasses = tw(
  'absolute top-0 right-[-40px] bottom-0 w-[320px] bg-[color-mix(in_srgb,var(--accent)_95%,transparent)] [clip-path:polygon(30%_0,100%_0,100%_100%,0_100%)] after:absolute after:inset-0 after:bg-[image:repeating-linear-gradient(-72deg,transparent_0_22px,var(--on-accent)_22px_30px)] after:content-[""] after:[clip-path:polygon(40%_70%,100%_50%,100%_74%,30%_100%)] pg-phone:w-[140px] pg-tablet:w-[220px]',
);

/** The name and the email line, lifted above the stripe (App. E.13's `position: relative` column, 6px apart). */
export const profileIdentityClasses = tw('relative flex min-w-0 flex-col gap-1.5');

/** The row of the name and its role badge (App. E.13: wrapping, 10px apart). */
export const profileNameRowClasses = tw('flex flex-wrap items-center gap-2.5');

/** `.s-profile-head h1`: display 700, 34px. */
export const profileNameClasses = tw('font-display text-[34px] leading-[1.05] font-bold wrap-anywhere');

/** `.s-small.s-muted`: the 14px muted line "{email} · Member since {date}"; the email may wrap anywhere. */
export const profileMetaClasses = tw('text-[14px] leading-5 wrap-anywhere text-ink-muted');

/** `.s-cards2`: two columns of cards 24px apart, one column on tablets and phones. */
export const profileCardsClasses = tw('grid grid-cols-2 items-start gap-6 pg-lt-lg:grid-cols-1');

/** `.s-card`: the card look; `min-width: 0` lets a long value shrink instead of widening the grid. */
export const profileCardClasses = clsx(cardClasses, tw('min-w-0'));

/** `.s-card-h`: the title block on a hairline; wraps when an action sits beside it. */
export const profileCardHeadClasses = tw(
  'flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4',
);

/** `.s-card-h h2`: display 700, 22px. */
export const profileCardTitleClasses = tw('font-display text-[22px] leading-[1.1] font-bold');

/** `.s-card-h p`: 13px muted. */
export const profileCardHintClasses = tw('text-[13px] text-ink-muted');

/** `.s-card-b.s-stack`: the card body, a column of blocks 20px apart. */
export const profileCardBodyClasses = tw('flex flex-col gap-5 p-5');

/** `.s-card-foot`: the actions on the right over a hairline. */
export const profileCardFootClasses = tw('flex justify-end gap-3 border-t border-line px-5 py-4');

/** `.s-formgrid`: two columns, 20px by 16px apart; one column on phones. */
export const profileFormGridClasses = tw('grid grid-cols-2 gap-x-4 gap-y-5 pg-phone:grid-cols-1');

/** The current sign-in email on the Sign-in Email card: body text that may wrap anywhere. */
export const profileEmailClasses = tw('text-[15px] leading-6 font-semibold wrap-anywhere');

/** The pending-change note and the buttons under it: a column 12px apart, the buttons in a wrapping row. */
export const profileEmailPendingClasses = tw('flex flex-col gap-3');
export const profileEmailActionsClasses = tw('flex flex-wrap items-center gap-3');
