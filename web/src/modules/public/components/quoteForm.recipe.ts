// The looks of the quote form's reference photo picker (UI-SPEC Q2) as complete Tailwind tokens (D-33). The drop zone, the touch
// buttons and the pick-error box come from media.recipe; only the picked-photo rows are new. Every string is a class list that
// the class gate compiles.
import { tw } from '@/ui/tw';

/** The picker: the label row, the pick errors, the add area, the list and the count line, 8px apart. */
export const photoPickerClasses = tw('flex flex-col gap-2');

/** The label row: "Reference photos" then the muted "(optional)". */
export const photoLabelRowClasses = tw('flex flex-wrap items-baseline gap-x-1');

/** `.csp-label`: the 14px semi-bold ink label. */
export const photoLabelClasses = tw('text-14 leading-5 font-semibold text-ink');

/** The muted "(optional)", weight 400. */
export const photoOptionalClasses = tw('text-14 leading-5 font-normal text-ink-muted');

/** The picked photos, one row each, 8px apart. */
export const photoRowsClasses = tw('m-0 flex list-none flex-col gap-2 p-0');

/** One picked photo: the preview, the name and size, then Remove. */
export const photoRowClasses = tw('flex min-w-0 items-center gap-3 rounded-md border border-line bg-surface p-2');

/** The 64px preview box; the Skeleton and the no-preview icon fill it. */
export const photoThumbClasses = tw('relative size-16 shrink-0 overflow-hidden rounded-sm bg-surface-2');

/** The `data:` preview fills the box. */
export const photoThumbImageClasses = tw('block size-16 object-cover');

/** The image icon shown when the browser cannot draw the photo. */
export const photoNoPreviewClasses = tw('flex size-full items-center justify-center text-ink-muted');

/** The name over the size. */
export const photoInfoClasses = tw('flex min-w-0 flex-1 flex-col');

/** The file name: Label, a long name wraps anywhere. */
export const photoNameClasses = tw('text-14 leading-5 font-semibold wrap-anywhere text-ink');

/** The size: Small, muted. */
export const photoSizeClasses = tw('text-14 leading-5 text-ink-muted');

/** "{2} of 5 photos": Small, muted. */
export const photoCountClasses = tw('m-0 text-14 leading-5 text-ink-muted');

/** `.s-formgrid`: two columns with 16px between and 20px rows; one column at 767px and below. */
export const quoteFormGridClasses = tw('grid grid-cols-2 gap-x-4 gap-y-5 pg-phone:grid-cols-1');

/** The footer row: the privacy notice and Send Inquiry, wrapping on a narrow screen. */
export const quoteFormFooterClasses = tw('flex flex-wrap items-center justify-between gap-4');

/** The status lines under the footer row: one shows at a time. */
export const quoteFormStatusClasses = tw('flex flex-col gap-3');

/** The send-failed box text: Small, ink. */
export const quoteFormStatusTextClasses = tw('m-0 text-14 leading-5 text-ink');

/** The card shown while the form piece loads: the form card's look and its height, so nothing shifts when the form appears (D-35). */
export const quoteFormPlaceholderClasses = tw(
  'flex min-h-[330px] flex-col gap-6 rounded-lg border border-line bg-surface p-8 pg-phone:min-h-[320px] pg-phone:rounded-md pg-phone:p-5',
);
