import { describe, expect, it, vi } from 'vitest';
import {
  planDownscale,
  prepareImage,
  sniffImageType,
  type BrowserImageParts,
  type DecodedBitmap,
  type PrepareRules,
} from '@/utils/images';

// prepareImage over fake browser parts (IMG-05, D-18). The bytes are synthetic; no real photo is used.

const RULES: PrepareRules = { maxBytes: 10 * 1024 * 1024, maxPixels: 25_000_000, maxSide: 12_000 };

function head(...bytes: number[]): Uint8Array {
  const out = new Uint8Array(32);
  out.set(bytes);
  return out;
}

const JPEG_HEAD = head(0xff, 0xd8, 0xff, 0xe0);

function fileOf(name: string, size = 1024, type = 'image/jpeg'): File {
  return new File([new Uint8Array(size)], name, { type });
}

interface Fake {
  parts: BrowserImageParts;
  bitmap: DecodedBitmap;
  close: ReturnType<typeof vi.fn>;
  encode: ReturnType<typeof vi.fn>;
}

function fakeParts(opts: { head: Uint8Array; width: number; height: number; encoded?: Blob | null }): Fake {
  const close = vi.fn();
  const bitmap: DecodedBitmap = { width: opts.width, height: opts.height, close };
  const encode = vi.fn((_b: DecodedBitmap, _w: number, _h: number, type: string) =>
    Promise.resolve(opts.encoded === undefined ? new Blob([new Uint8Array(500)], { type }) : opts.encoded),
  );
  const parts: BrowserImageParts = {
    readHead: () => Promise.resolve(opts.head),
    decode: () => Promise.resolve(bitmap),
    encode,
    preview: () => 'data:image/jpeg;base64,AAAA',
  };
  return { parts, bitmap, close, encode };
}

describe('sniffImageType', () => {
  it('accepts a JPEG signature', () => {
    expect(sniffImageType(JPEG_HEAD)).toBe('jpeg');
  });
});

describe('planDownscale', () => {
  it('shrinks a 4000 x 3000 photo to a 2000 px long side keeping its proportions', () => {
    expect(planDownscale(4000, 3000)).toEqual({ width: 2000, height: 1500, scaled: true });
  });

  it('leaves a photo within 2000 px as it is', () => {
    expect(planDownscale(1800, 1200)).toEqual({ width: 1800, height: 1200, scaled: false });
  });
});

describe('prepareImage', () => {
  it('turns a 4000 x 3000 JPEG into a 2000 x 1500 JPEG at quality 0.85 with a preview', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, width: 4000, height: 3000 });
    const result = await prepareImage(fileOf('IMG_0001.jpg'), RULES, fake.parts);

    expect(result).toMatchObject({
      ok: true,
      name: 'IMG_0001.jpg',
      type: 'image/jpeg',
      width: 2000,
      height: 1500,
      preview: 'data:image/jpeg;base64,AAAA',
      previewUnavailable: false,
    });
    expect(fake.encode).toHaveBeenCalledWith(fake.bitmap, 2000, 1500, 'image/jpeg', 0.85);
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('returns a 1800 x 1200 JPEG as the same File object with a preview', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, width: 1800, height: 1200 });
    const file = fileOf('small.jpg');
    const result = await prepareImage(file, RULES, fake.parts);

    expect(result).toMatchObject({ ok: true, width: 1800, height: 1200, previewUnavailable: false });
    expect(result.ok && result.file).toBe(file);
    expect(result.ok && result.preview).toBe('data:image/jpeg;base64,AAAA');
    expect(fake.encode).not.toHaveBeenCalled();
    expect(fake.close).toHaveBeenCalledTimes(1);
  });
});
