// The photo rules of the quote form (OR-3, INQ-02, D-01, D-02): the browser checks every rule the server checks before anything is
// sent. The defaults are the server's limits (ImageUploadLimits); the server repeats every check.
import type { ImageKind } from '@/utils/images';

/** The photo limits the picker applies. */
export interface QuotePhotoRules {
  /** The most photos one request can take. */
  maxPhotos: number;
  /** The largest file, in bytes. */
  maxBytes: number;
  /** The photo types taken, read from the file's first bytes. */
  types: readonly ImageKind[];
}

export const QUOTE_PHOTO_RULES: QuotePhotoRules = {
  maxPhotos: 5,
  maxBytes: 10_485_760,
  types: ['jpeg', 'png', 'webp', 'heic'],
};

export interface QuotePhotoCheck {
  accepted: File[];
  refusals: string[];
  countLine: string | null;
}

// RED stub (plan 13-02): replaced by the real check in the next commit.
export function checkQuotePhotos(
  _picked: readonly File[],
  _existingCount: number,
  _rules: QuotePhotoRules = QUOTE_PHOTO_RULES,
): Promise<QuotePhotoCheck> {
  return Promise.resolve({ accepted: [], refusals: [], countLine: null });
}
