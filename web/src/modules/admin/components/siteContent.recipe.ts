// The Site Content looks (UI-SPEC S0 and S1; plan 11-12) as complete Tailwind tokens (D-33). The cards themselves reuse the My Profile
// card recipes (`.s-card`, `.s-card-h`, `.s-card-b`); only what those do not give is here. No new token.
import { tw } from '@/ui/tw';

/** The cards of one tab: a column, 24px apart (S1 "24px between cards"). */
export const siteContentStackClasses = tw('flex min-w-0 flex-col gap-6');

/** The Undo Changes and Save buttons at the end of a tab's panel: a wrapping row on the right, 12px apart. */
export const siteContentActionsClasses = tw('flex flex-wrap items-center justify-end gap-3');

/**
 * One phone row (D-23): Number, Label, the Main number radio and Remove on a line (`1fr 160px auto 44px`). On phones the two fields
 * stack and the radio and Remove share the last line.
 */
export const phoneRowClasses = tw(
  'grid grid-cols-[minmax(0,1fr)_160px_auto_44px] items-start gap-x-4 gap-y-3 pg-phone:grid-cols-[minmax(0,1fr)_44px]',
);

/** The Number and Label cells fill the phone row. */
export const phoneFieldCellClasses = tw('min-w-0 pg-phone:col-span-2');

/** The radio and Remove cells line up with the control of the fields beside them (the label above is 26px tall). */
export const phoneControlCellClasses = tw('flex items-center pt-[26px] pg-phone:pt-0');

/** The rows and the Add Number button under them: a column 16px apart. */
export const phoneListClasses = tw('flex flex-col gap-4');
