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
/** Only protects the phone's memory (D-53): the server's pixel and side limits are checked on the shrunk photo. */
export const MAX_ORIGINAL_PIXELS = 100_000_000;
const ENCODE_QUALITY = 0.85;
const PREVIEW_QUALITY = 0.8;
const HEAD_BYTES = 32;

const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis']);
const HEIC_CONTAINER_BRANDS = new Set(['mif1', 'msf1']);

function matches(bytes: Uint8Array, offset: number, expected: readonly number[]): boolean {
  return bytes.length >= offset + expected.length && expected.every((value, i) => bytes[offset + i] === value);
}

function brandAt(bytes: Uint8Array, offset: number): string | null {
  return bytes.length < offset + 4 ? null : String.fromCharCode(...bytes.subarray(offset, offset + 4));
}

function sniffHeic(head: Uint8Array): boolean {
  if (!matches(head, 4, [0x66, 0x74, 0x79, 0x70])) return false;
  const boxSize = new DataView(head.buffer, head.byteOffset, head.byteLength).getUint32(0);
  if (boxSize > 1 && boxSize < 16) return false;
  const major = brandAt(head, 8);
  if (major === null) return false;
  if (HEIC_BRANDS.has(major)) return true;
  if (!HEIC_CONTAINER_BRANDS.has(major)) return false;
  const end = Math.min(head.length, HEAD_BYTES, boxSize > 1 ? boxSize : HEAD_BYTES);
  for (let offset = 16; offset + 4 <= end; offset += 4) {
    const brand = brandAt(head, offset);
    if (brand !== null && HEIC_BRANDS.has(brand)) return true;
  }
  return false;
}

/** The photo type from its first bytes, or null when it is not one the server accepts. */
export function sniffImageType(head: Uint8Array): ImageKind | null {
  if (matches(head, 0, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (matches(head, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (matches(head, 0, [0x52, 0x49, 0x46, 0x46]) && matches(head, 8, [0x57, 0x45, 0x42, 0x50])) return 'webp';
  if (sniffHeic(head)) return 'heic';
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

function drawn(bitmap: DecodedBitmap, width: number, height: number, whiteBackground: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) return null;
  context.imageSmoothingQuality = 'high';
  if (whiteBackground) {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
  }
  context.drawImage(bitmap, 0, 0, width, height);
  return canvas;
}

/** The real browser: a canvas for resizing and the preview. Data: URLs only, because the CSP has no blob:. */
export const defaultBrowserImageParts: BrowserImageParts = {
  readHead: async (file) => new Uint8Array(await file.slice(0, HEAD_BYTES).arrayBuffer()),
  decode: decodeUpright,
  encode: (bitmap, width, height, type, quality) => {
    const canvas = drawn(bitmap, width, height, type === 'image/jpeg');
    if (canvas === null) return Promise.resolve(null);
    return new Promise((resolve) => {
      canvas.toBlob(resolve, type, quality);
    });
  },
  preview: (bitmap, width, height) => {
    const url = drawn(bitmap, width, height, true)?.toDataURL('image/jpeg', PREVIEW_QUALITY);
    return url?.startsWith('data:image/') === true ? url : null;
  },
};

const MIME_OF_KIND: Record<ImageKind, string> = {
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
};

const EXTENSION_OF_MIME = new Map([
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);

function withExtension(name: string, extension: string): string {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}.${extension}`;
}

// JPEG for JPEG and HEIC, PNG stays PNG, WebP stays WebP only when the browser really made WebP. toBlob falls back to
// PNG for a type it cannot encode, so the produced type is always checked.
async function encodeSameFamily(
  parts: BrowserImageParts,
  bitmap: DecodedBitmap,
  size: { width: number; height: number },
  kind: ImageKind,
): Promise<{ blob: Blob; extension: string } | null> {
  const wanted = kind === 'png' ? 'image/png' : kind === 'webp' ? 'image/webp' : 'image/jpeg';
  let blob = await parts.encode(bitmap, size.width, size.height, wanted, ENCODE_QUALITY);
  if (kind === 'webp' && blob?.type !== 'image/webp') {
    blob = await parts.encode(bitmap, size.width, size.height, 'image/jpeg', ENCODE_QUALITY);
  }
  const extension = blob === null ? undefined : EXTENSION_OF_MIME.get(blob.type);
  return blob === null || extension === undefined ? null : { blob, extension };
}

function previewOf(parts: BrowserImageParts, bitmap: DecodedBitmap): string | null {
  const size = planDownscale(bitmap.width, bitmap.height, PREVIEW_LONG_SIDE);
  try {
    return parts.preview(bitmap, size.width, size.height);
  } catch {
    return null;
  }
}

/**
 * Checks, rights, shrinks and previews one picked file before any request (IMG-05, D-18; OR-3 mirror of the server's
 * type, size and pixel rules, with the pixel and side limits applied to the shrunk photo, D-53). Keeps no state, so
 * calls may overlap.
 */
export async function prepareImage(
  file: File,
  rules: PrepareRules,
  parts: BrowserImageParts = defaultBrowserImageParts,
): Promise<PrepareResult> {
  const kind = sniffImageType(await parts.readHead(file));
  if (kind === null) return { ok: false, reason: 'type' };

  let bitmap: DecodedBitmap;
  try {
    bitmap = await parts.decode(file);
  } catch {
    // Most desktop browsers cannot decode HEIC: send it as it is and let the server check its pixels.
    if (kind !== 'heic') return { ok: false, reason: 'unreadable' };
    if (file.size > rules.maxBytes) return { ok: false, reason: 'size' };
    return {
      ok: true,
      file,
      name: file.name,
      type: MIME_OF_KIND.heic,
      width: null,
      height: null,
      preview: null,
      previewUnavailable: true,
    };
  }

  try {
    const { width, height } = bitmap;
    if (!(width > 0 && height > 0)) return { ok: false, reason: 'unreadable' };
    if (width * height > MAX_ORIGINAL_PIXELS) return { ok: false, reason: 'pixels' };

    const plan = planDownscale(width, height);
    if (plan.width * plan.height > rules.maxPixels || Math.max(plan.width, plan.height) > rules.maxSide) {
      return { ok: false, reason: 'pixels' };
    }

    const preview = previewOf(parts, bitmap);
    if (!plan.scaled) {
      if (file.size > rules.maxBytes) return { ok: false, reason: 'size' };
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

    const encoded = await encodeSameFamily(parts, bitmap, plan, kind);
    if (encoded === null) return { ok: false, reason: 'unreadable' };
    const { blob, extension } = encoded;
    if (blob.size > rules.maxBytes) return { ok: false, reason: 'size' };
    return {
      ok: true,
      file: blob,
      name: withExtension(file.name, extension),
      type: blob.type,
      width: plan.width,
      height: plan.height,
      preview,
      previewUnavailable: preview === null,
    };
  } catch {
    return { ok: false, reason: 'unreadable' };
  } finally {
    bitmap.close();
  }
}
