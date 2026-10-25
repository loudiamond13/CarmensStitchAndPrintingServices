// The Company Expenses looks (App. E.11: the lead date cell, the Paid by and Recorded by cells and the `.s-cap` caption;
// plan 06-04) as complete Tailwind tokens (D-33). Every string here is a class list (the class gate compiles each one).
import { tw } from '@/ui/tw';

/** The lead cell: the bold date with "Upcoming" 4px under it; beside it on phones (UI-SPEC E1). */
export const expensesDateCellClasses = tw(
  'flex flex-col items-start gap-1 pg-phone:flex-row pg-phone:flex-wrap pg-phone:items-center pg-phone:gap-2',
);

/** The date: the Label look (14px, 600, 20px), App. E.11's `<strong>`. */
export const expensesDateClasses = tw('text-[14px] leading-5 font-semibold text-ink');

/** Paid by and Recorded by: Avatar 24, then the name, 8px apart. */
export const expensesActorClasses = tw('flex items-center gap-2 pg-phone:justify-end');

/** The decorative avatar keeps its 24px beside a wrapping name. */
export const expensesAvatarClasses = tw('flex-none');

/** A description or a name that may be longer than its column: it wraps anywhere instead of widening the table. */
export const expensesWrapClasses = tw('min-w-0 wrap-anywhere');

/** `.s-cap`: the 12px muted caption under the table. */
export const expensesCaptionClasses = tw('text-[12px] leading-4 text-ink-muted');
