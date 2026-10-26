// The Company Expenses looks (App. E.11: the lead date cell, the Paid by and Recorded by cells and the `.s-cap` caption;
// plan 06-04) as complete Tailwind tokens (D-33). Every string here is a class list (the class gate compiles each one).
import { tw } from '@/ui/tw';

/** `.s-g3`: the KPI row, three columns with a 24px gap; two on tablets and one on phones (App. C, UI-SPEC E1). */
export const expensesKpiRowClasses = tw(
  'grid grid-cols-[repeat(3,minmax(0,1fr))] gap-6 pg-phone:grid-cols-[minmax(0,1fr)] pg-tablet:grid-cols-[repeat(2,minmax(0,1fr))]',
);

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

/**
 * A category name up to 40 characters long wraps inside the badge instead of widening its cell: the badge grows in height
 * past its one-line 24px (UI-SPEC UI Considerations, long-text). The important marks beat the badge recipe's own height
 * and no-wrap utilities, which cannot be told apart by order.
 */
export const categoryBadgeClasses = tw('h-auto! min-h-6 max-w-full py-0.5 text-left wrap-anywhere whitespace-normal!');

/** E2 `.csp-form-grid`: two columns, 16px by 20px apart; one column on phones. */
export const expensesFormGridClasses = tw('grid grid-cols-2 gap-x-4 gap-y-5 pg-phone:grid-cols-1');

/** A field that takes the whole row of the form grid. */
export const expensesFullRowClasses = tw('col-span-2 pg-phone:col-span-1');

/** The modal body: a column of blocks 20px apart. */
export const expensesModalBodyClasses = tw('flex flex-col gap-5');

/** App. E.11 read-only control: a dashed `--line-strong` box on `--surface-2` with the avatar and the muted name. */
export const expensesReadOnlyClasses = tw(
  'flex min-h-11 items-center gap-2 rounded-md border-2 border-dashed border-line-strong bg-surface-2 px-3 text-ink-muted',
);

/** The label and its read-only control in one column 6px apart, as Field stacks its label and box. */
export const expensesReadOnlyFieldClasses = tw('flex min-w-0 flex-col gap-1.5');

/** A field with a note under it: the two in one column 8px apart. */
export const expensesFieldStackClasses = tw('flex min-w-0 flex-col gap-2');

/** View mode: a value in the 14px body text, wrapping anywhere so a long description never widens the dialog. */
export const expensesViewValueClasses = tw('min-w-0 text-[14px] leading-5 wrap-anywhere text-ink');

/** View mode: notes keep the line breaks the person typed. */
export const expensesViewNotesClasses = tw('whitespace-pre-line');

/** The h1 and its "Manager only" badge in one wrapping row, 10px apart (as the Users header). */
export const expensesTitleRowClasses = tw('flex flex-wrap items-center gap-2.5');

/** `.s-ph-actions`: the header buttons in a row 8px apart; on phones they take the full width, each growing equally (App. C). */
export const expensesHeadActionsClasses = tw('flex flex-wrap items-center gap-2 pg-phone:w-full pg-phone:*:flex-1');

/** The back link above the Deleted Expenses header, 16px clear of it. */
export const expensesBackRowClasses = tw('mb-4 flex');

/**
 * The From and To fields of the toolbar: wide enough for the date box and the date written out beside it. Each width sits
 * after the plain toolbar width in the CSS, so it wins (expenses.recipe.node.test.ts).
 * SPEC-DEVIATION: D-61 on phones each date field takes its own row (UI-SPEC: toolbar fields wrap two per row).
 */
export const expensesDateFieldClasses = tw(
  'in-data-[ui=s-toolbar]:flex-[0_1_232px] pg-phone:in-data-[ui=s-toolbar]:basis-full pg-tablet:in-data-[ui=s-toolbar]:flex-[1_1_232px]',
);
