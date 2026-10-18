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
