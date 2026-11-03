// Prepares a picked photo in the browser before upload (IMG-05, D-18): check the type by its bytes, turn it upright,
// shrink it to a 2000 px long side when larger, make a small data: preview. Memory only; nothing is stored.

export type ImageKind = 'jpeg' | 'png' | 'webp' | 'heic';

export interface PrepareRules {
  maxBytes: number;
  maxPixels: number;
  maxSide: number;
}

export interface DecodedBitmap {
  width: number;
  height: number;
  close(): void;
}

export interface BrowserImageParts {
  readHead(file: Blob): Promise<Uint8Array>;
  decode(file: Blob): Promise<DecodedBitmap>;
  encode(bitmap: DecodedBitmap, width: number, height: number, type: string, quality: number): Promise<Blob | null>;
  preview(bitmap: DecodedBitmap, width: number, height: number): string | null;
}

export type PrepareResult =
  | {
      ok: true;
      file: Blob;
      name: string;
      type: string;
      width: number | null;
      height: number | null;
      preview: string | null;
      previewUnavailable: boolean;
    }
  | { ok: false; reason: 'type' | 'size' | 'pixels' | 'unreadable' };

export const MAX_LONG_SIDE = 2000;

export const PREVIEW_LONG_SIDE = 176;
const JPEG_QUALITY = 0.85;

/** The photo type from its first bytes, or null when it is not one the server accepts. */
export function sniffImageType(head: Uint8Array): ImageKind | null {
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'jpeg';
  return null;
}

/** The size after shrinking to a long side of `maxLongSide`, keeping proportions. Smaller photos are not touched. */
export function planDownscale(
  width: number,
  height: number,
  maxLongSide = MAX_LONG_SIDE,
): { width: number; height: number; scaled: boolean } {
  const longSide = Math.max(width, height);
  if (longSide <= maxLongSide) return { width, height, scaled: false };
  const ratio = maxLongSide / longSide;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
    scaled: true,
  };
}

/** Decodes with the EXIF orientation applied, so a phone photo is upright. */
export function decodeUpright(file: Blob): Promise<ImageBitmap> {
  return createImageBitmap(file, { imageOrientation: 'from-image' });
}

const MIME_OF_KIND: Record<ImageKind, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

function withExtension(name: string, extension: string): string {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}.${extension}`;
}

/** Checks, rights, shrinks and previews one picked file. Keeps no state, so calls may overlap. */
export async function prepareImage(file: File, _rules: PrepareRules, parts: BrowserImageParts): Promise<PrepareResult> {
  const kind = sniffImageType(await parts.readHead(file));
  if (kind === null) return { ok: false, reason: 'type' };

  let bitmap: DecodedBitmap;
  try {
    bitmap = await parts.decode(file);
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  try {
    const { width, height } = bitmap;
    const plan = planDownscale(width, height);
    const small = planDownscale(width, height, PREVIEW_LONG_SIDE);
    const preview = parts.preview(bitmap, small.width, small.height);

    if (!plan.scaled) {
      return {
        ok: true,
        file,
        name: file.name,
        type: MIME_OF_KIND[kind],
        width,
        height,
        preview,
        previewUnavailable: preview === null,
      };
    }

    const blob = await parts.encode(bitmap, plan.width, plan.height, 'image/jpeg', JPEG_QUALITY);
    if (blob === null) return { ok: false, reason: 'unreadable' };
    return {
      ok: true,
      file: blob,
      name: withExtension(file.name, 'jpg'),
      type: blob.type,
      width: plan.width,
      height: plan.height,
      preview,
      previewUnavailable: preview === null,
    };
  } finally {
    bitmap.close();
  }
}
