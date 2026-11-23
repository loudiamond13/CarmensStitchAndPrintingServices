// Everything the form needs once a visitor adds photos, as one lazy piece (D-43): the picker, its checks, the names and the uploads.
import type { QuotePhotoLimits } from './hooks/useQuoteTicket';
import { QUOTE_PHOTO_RULES, type QuotePhotoRules } from './quotePhotos';

export { QuoteMissingPhotos } from './components/QuoteMissingPhotos';
export { QuotePhotoPicker } from './components/QuotePhotoPicker';
export { sendWithPhotos, type HeldUploadKey } from './quotePhotoUpload';

/** The picker's rules: the server's limits from the ticket answer, or the built-in ones when no ticket came. */
export function pickerRules(limits: QuotePhotoLimits | undefined): QuotePhotoRules {
  return limits === undefined
    ? QUOTE_PHOTO_RULES
    : { ...QUOTE_PHOTO_RULES, maxPhotos: limits.maxPhotos, maxBytes: limits.maxBytes, maxPixels: limits.maxPixels };
}
