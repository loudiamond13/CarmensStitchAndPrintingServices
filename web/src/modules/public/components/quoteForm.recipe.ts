// The looks of the quote form (UI-SPEC Q1, Q2 and Q3) as complete Tailwind tokens (D-33): the grid, the footer row, the status lines and
// the placeholder card, then the reference photo picker's rows. The drop zone, the touch buttons and the pick-error box come from
// media.recipe. Every string is a class list that the class gate compiles.
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

/**
 * The card shown while the form piece loads: the form card's look and its height, so nothing shifts when the form appears (D-35).
 * Measured with the text form: 696px at 1440px wide, and 1036px at 320px wide (one column; a wider phone is a little shorter, so 1000px).
 */
export const quoteFormPlaceholderClasses = tw(
  'flex min-h-[696px] flex-col gap-6 rounded-lg border border-line bg-surface p-8 pg-phone:min-h-[1000px] pg-phone:rounded-md pg-phone:p-5',
);

/** The Message box spans both columns (one at 767px and below) and grows with the text up to 12 lines, then scrolls inside. */
export const quoteFormMessageClasses = tw(
  'col-span-2 pg-phone:col-span-1 [&_textarea]:field-sizing-content [&_textarea]:max-h-78',
);

/** The privacy notice (D-27): Small, muted, at most 340px wide. */
export const quoteFormNoticeClasses = tw('m-0 max-w-[340px] text-14 leading-5 text-ink-muted');

/** Send Inquiry takes the full width under the notice at 420px and below. */
export const quoteFormSendClasses = tw('pg-xs:w-full');

/** The photo area spans both columns (one at 767px and below). */
export const quotePhotoSlotClasses = tw('col-span-2 pg-phone:col-span-1');

// The send status boxes carry their own classes, so the form's piece does not load the picker's whole media.recipe (budget, D-43).
/** The send-failed box: a light red ground with the icon and the text side by side. */
export const quoteFormAlertClasses = tw('flex items-start gap-2 rounded-sm bg-danger-soft px-4 py-2');

/** The icon of the send-failed box, level with the first line. */
export const quoteFormAlertIconClasses = tw('flex h-5 shrink-0 items-center text-danger');

/** The text of the send-failed box. */
export const quoteFormAlertBodyClasses = tw('flex min-w-0 flex-1 flex-col gap-2');
