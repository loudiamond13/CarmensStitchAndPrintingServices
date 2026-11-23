// SPEC-GAP: quote requests inbox looks (UI-SPEC R1) as complete Tailwind tokens (D-33). Every string here is a class list.
import clsx from 'clsx';
import { hitAreaClasses } from '@/components/actions';
import { tw } from '@/ui/tw';

/** The Received cell: the date over the Small muted time. */
export const quoteReceivedClasses = tw('flex flex-col');

/** The time under the date. */
export const quoteReceivedTimeClasses = tw('text-[14px] leading-5 text-ink-muted');

/** The Name cell: the name link over the team. */
export const quoteWhoClasses = tw('flex min-w-0 flex-col items-start');

/** The name link to the request: Label (14px, 600), the one way into the request. */
export const quoteNameLinkClasses = clsx(
  tw('text-14 leading-5 font-semibold wrap-anywhere text-ink underline-offset-2 hover:underline'),
  hitAreaClasses,
);

/** The team under the name: Small muted. */
export const quoteTeamClasses = tw('text-[14px] leading-5 wrap-anywhere text-ink-muted');

/** The Photos cell: an optional warning icon before the count. */
export const quotePhotosClasses = tw('inline-flex items-center gap-1');

/** The warning icon of a request with missing photos. */
export const quotePhotosWarningClasses = tw('inline-flex text-warning');
