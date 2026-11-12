// The Site Content looks (UI-SPEC S0 and S1; plan 11-12) as complete Tailwind tokens (D-33). The cards themselves reuse the My Profile
// card recipes (`.s-card`, `.s-card-h`, `.s-card-b`); only what those do not give is here. No new token.
import { tw } from '@/ui/tw';

/** The cards of one tab: a column, 24px apart (S1 "24px between cards"). */
export const siteContentStackClasses = tw('flex min-w-0 flex-col gap-6');

/** The Undo Changes and Save buttons at the end of a tab's panel: a wrapping row on the right, 12px apart. */
export const siteContentActionsClasses = tw('flex flex-wrap items-center justify-end gap-3');
