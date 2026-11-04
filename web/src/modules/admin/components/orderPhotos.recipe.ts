// The looks of the order Images card (UI-SPEC P1 and P3; plan 09-16) as complete Tailwind tokens (D-33). No new token: spacing,
// radius, colour and type come from the theme. The card frame reuses the order page recipe.
import { tw } from '@/ui/tw';

/** The card body: the banner, the pick errors, the add area and the list, 16px apart. */
export const orderPhotosBodyClasses = tw('flex flex-col gap-4 p-5');

/** The status line at the right of the card head: Small, muted, an icon then the words. */
export const orderPhotosStatusClasses = tw('flex items-center gap-2 text-[14px] leading-5 text-ink-muted');

/** The spinner of the status line; it stands still under reduced motion. */
export const orderPhotosSpinnerClasses = tw('animate-csp-spin motion-reduce:animate-none');

/** The partial-failure banner: `--warning-soft` ground, a `--warning` icon, a Label line then a Small line. */
export const orderPhotosBannerClasses = tw('flex items-start gap-3 rounded-sm bg-warning-soft px-4 py-3');

/** The banner icon, level with the first line. */
export const orderPhotosBannerIconClasses = tw('flex h-5 shrink-0 items-center text-warning');

/** The banner text block. */
export const orderPhotosBannerTextClasses = tw('flex min-w-0 flex-col gap-1');

/** The banner's first line: Label. */
export const orderPhotosBannerTitleClasses = tw('m-0 text-[14px] leading-5 font-semibold text-ink');

/** The banner's second line: Small. */
export const orderPhotosBannerBodyClasses = tw('m-0 text-[14px] leading-5 text-ink-muted');
