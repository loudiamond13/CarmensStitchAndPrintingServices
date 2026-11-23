// The photo rules of the quote form (OR-3, INQ-02, D-01, D-02): the browser checks every rule the server checks before anything is
// sent. The defaults are the server's limits (ImageUploadLimits); the server repeats every check.
import { PUBLIC_COPY } from '@/modules/public/copy';
import {
  cleanFileName,
  defaultBrowserImageParts,
  sizeText,
  sniffImageType,
  type BrowserImageParts,
  type DecodedBitmap,
  type ImageKind,
} from '@/utils/images';

/** The photo limits the picker applies. */
export interface QuotePhotoRules {
  /** The most photos one request can take. */
  maxPhotos: number;
  /** The largest file, in bytes. */
  maxBytes: number;
  /** The most pixels (width times height) a photo may have. */
  maxPixels: number;
  /** The photo types taken, read from the file's first bytes. */
  types: readonly ImageKind[];
}

export const QUOTE_PHOTO_RULES: QuotePhotoRules = {
  maxPhotos: 5,
  maxBytes: 10_485_760,
  maxPixels: 25_000_000,
  types: ['jpeg', 'png', 'webp', 'heic'],
};

const PIXELS_PER_MEGAPIXEL = 1_000_000;

/** The parts of the browser the check uses: the first bytes and a decode for the pixel size. */
export type QuotePhotoReader = Pick<BrowserImageParts, 'readHead' | 'decode'>;

/** True when the photo is over the pixel limit. A photo the browser cannot decode (HEIC in most browsers) is left to the server. */
async function overPixels(file: File, maxPixels: number, reader: QuotePhotoReader): Promise<boolean> {
  let bitmap: DecodedBitmap;
  try {
    bitmap = await reader.decode(file);
  } catch {
    return false;
  }
  try {
    return bitmap.width * bitmap.height > maxPixels;
  } finally {
    bitmap.close();
  }
}

/** What a pick came to: the files to add, one line per refused file, and the count line when files were left out. */
export interface QuotePhotoCheck {
  accepted: File[];
  refusals: string[];
  countLine: string | null;
}

const COPY = PUBLIC_COPY.contact.photos;

/**
 * Checks a pick against the rules before anything is sent. The type is read from the file's first bytes, never its name or MIME
 * header (CWE-434). A refused file names itself and does not use up a place; a valid file past the count limit is only counted.
 */
export async function checkQuotePhotos(
  picked: readonly File[],
  existingCount: number,
  rules: QuotePhotoRules = QUOTE_PHOTO_RULES,
  reader: QuotePhotoReader = defaultBrowserImageParts,
): Promise<QuotePhotoCheck> {
  const accepted: File[] = [];
  const refusals: string[] = [];
  let leftOut = 0;
  for (const file of picked) {
    const name = cleanFileName(file.name);
    let kind: ImageKind | null;
    try {
      kind = sniffImageType(await reader.readHead(file));
    } catch {
      refusals.push(COPY.refused.unreadable(name));
      continue;
    }
    if (kind === null || !rules.types.includes(kind)) {
      refusals.push(COPY.refused.type(name));
    } else if (file.size > rules.maxBytes) {
      refusals.push(COPY.refused.size(name, sizeText(rules.maxBytes)));
    } else if (existingCount + accepted.length >= rules.maxPhotos) {
      leftOut += 1;
    } else if (await overPixels(file, rules.maxPixels, reader)) {
      refusals.push(COPY.refused.pixels(name, rules.maxPixels / PIXELS_PER_MEGAPIXEL));
    } else {
      accepted.push(file);
    }
  }
  return { accepted, refusals, countLine: leftOut === 0 ? null : COPY.leftOut(rules.maxPhotos, leftOut) };
}
