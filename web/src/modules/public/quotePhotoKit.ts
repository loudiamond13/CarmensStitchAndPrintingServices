// Everything the form needs once a visitor adds photos, as one lazy piece (D-43): the picker, its checks, the names and the uploads.
import type { QuotePhotoLimits } from './hooks/useQuoteTicket';
import {
  checkQuotePhotos,
  QUOTE_PHOTO_RULES,
  sameFile,
  type QuotePhotoCheck,
  type QuotePhotoRules,
} from './quotePhotos';

export { QuoteMissingPhotos } from './components/QuoteMissingPhotos';
export { QuotePhotoPicker } from './components/QuotePhotoPicker';
export { sendWithPhotos, type HeldUploadKey } from './quotePhotoUpload';

/** The picker's rules: the server's limits from the ticket answer, or the built-in ones when no ticket came. */
export function pickerRules(limits: QuotePhotoLimits | undefined): QuotePhotoRules {
  return limits === undefined
    ? QUOTE_PHOTO_RULES
    : { ...QUOTE_PHOTO_RULES, maxPhotos: limits.maxPhotos, maxBytes: limits.maxBytes, maxPixels: limits.maxPixels };
}

/** The files chosen before the picker loaded, checked as its first pick: the rules, the photos to add and the refusals. */
export interface FirstPick {
  rules: QuotePhotoRules;
  photos: File[];
  errors: Omit<QuotePhotoCheck, 'accepted'>;
}

/** Checks the first pick before the picker shows, so the form can wait for it when Send is pressed (review W5 CR-01). */
export async function firstPick(files: readonly File[], limits: QuotePhotoLimits | undefined): Promise<FirstPick> {
  const rules = pickerRules(limits);
  const fresh = files.filter((file, index) => files.findIndex((other) => sameFile(other, file)) === index);
  const { accepted, refusals, countLine } = await checkQuotePhotos(fresh, 0, rules);
  return { rules, photos: accepted, errors: { refusals, countLine } };
}
