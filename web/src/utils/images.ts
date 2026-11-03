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

export function sniffImageType(_head: Uint8Array): ImageKind | null {
  return null;
}

export function planDownscale(
  width: number,
  height: number,
  _maxLongSide = MAX_LONG_SIDE,
): { width: number; height: number; scaled: boolean } {
  return { width, height, scaled: false };
}

export function prepareImage(_file: File, _rules: PrepareRules, _parts?: BrowserImageParts): Promise<PrepareResult> {
  return Promise.resolve({ ok: false, reason: 'unreadable' });
}
