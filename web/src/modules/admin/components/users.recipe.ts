// The Users roster looks (App. E.12: the h1 with its badge, the cells' wrapping and the `.s-cap` caption; plan 05-20) as
// complete Tailwind tokens (D-33). Every string here is a class list (the class gate compiles each one).
import { tw } from '@/ui/tw';

/** The h1 and its "Manager only" badge in one wrapping row, 10px apart (App. E.12). */
export const usersTitleRowClasses = tw('flex flex-wrap items-center gap-2.5');

/** A name or an email that may be longer than its column: it wraps anywhere instead of widening the table. */
export const usersWrapClasses = tw('wrap-anywhere');

/** The Status cell: the status badge, then the invitation badge, 8px apart. */
export const usersStatusClasses = tw('flex flex-wrap items-center gap-2');

/** `.s-cap`: the 12px muted caption under the table. */
export const usersCaptionClasses = tw('text-[12px] leading-4 text-ink-muted');

/** U2 `.csp-form-grid`: First name and Last name in two columns, 16px by 20px apart; one column on phones. */
export const usersFormGridClasses = tw('grid grid-cols-2 gap-x-4 gap-y-5 pg-phone:grid-cols-1');

/** The Add User panel body: a column of blocks 20px apart. */
export const usersPanelBodyClasses = tw('flex flex-col gap-5');

/** The Role block: its label, the segmented control and the hint, 8px apart. */
export const usersRoleBlockClasses = tw('flex flex-col items-start gap-2');

/** CopyField: the read-only field and its button side by side, the button below the field on phones; 16px apart. */
export const usersCopyRowClasses = tw('flex items-end gap-4 pg-phone:flex-col pg-phone:items-stretch');

/** CopyField: the field takes the width the button leaves. */
export const usersCopyFieldClasses = tw('min-w-0 flex-1 pg-phone:flex-none');

/** CopyField: the row, its failure message and its live status in one column 8px apart. */
export const usersCopyStackClasses = tw('flex flex-col gap-2');

/** The New Suggestion button row under the temporary password field. */
export const usersSuggestionClasses = tw('flex items-start');

/** U3: the email-change choice and its message in one column 8px apart. */
export const usersChoiceClasses = tw('flex flex-col gap-2');

/** U3 Account access: a hairline above, 24px of padding, then the heading, the hint and the buttons 16px apart. */
export const usersAccessClasses = tw('flex flex-col gap-4 border-t border-line pt-6');

/** U3 Account access heading: the Label look (14px, 600, 20px). */
export const usersAccessHeadingClasses = tw('text-[14px] leading-5 font-semibold text-ink');

/** U3 Account access: the buttons side by side, one under the other on phones. */
export const usersAccessButtonsClasses = tw('flex flex-wrap gap-3 pg-phone:flex-col');

/** U3 Account access: each button takes the full width on phones. */
export const usersAccessButtonClasses = tw('pg-phone:w-full');

/** U3: a note and the ghost button that goes with it (Cancel Email Change), one column 8px apart. */
export const usersPendingClasses = tw('flex flex-col items-start gap-2');
