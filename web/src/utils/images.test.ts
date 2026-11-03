import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultBrowserImageParts,
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
  out.set(bytes.slice(0, 32));
  return out;
}

const JPEG_HEAD = head(0xff, 0xd8, 0xff, 0xe0);
const PNG_HEAD = head(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const WEBP_HEAD = head(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50);

function ascii(text: string): number[] {
  return Array.from(text, (c) => c.charCodeAt(0));
}

/** An ISO box header: size, `ftyp`, major brand, minor version, then the compatible brands. */
function ftyp(major: string, ...compatible: string[]): Uint8Array {
  const size = 16 + compatible.length * 4;
  return head(0, 0, 0, size, ...ascii('ftyp'), ...ascii(major), 0, 0, 0, 0, ...compatible.flatMap(ascii));
}

function fileOf(name: string, size = 1024, type = 'image/jpeg'): File {
  return new File([new Uint8Array(size)], name, { type });
}

interface Fake {
  parts: BrowserImageParts;
  bitmap: DecodedBitmap;
  close: ReturnType<typeof vi.fn>;
  encode: ReturnType<typeof vi.fn>;
}

function fakeParts(opts: {
  head: Uint8Array;
  width?: number;
  height?: number;
  decodeFails?: boolean;
  encoded?: (type: string) => Blob | null;
  encodeThrows?: boolean;
  preview?: string | null;
}): Fake {
  const close = vi.fn();
  const bitmap: DecodedBitmap = { width: opts.width ?? 0, height: opts.height ?? 0, close };
  const encode = vi.fn((_b: DecodedBitmap, _w: number, _h: number, type: string) => {
    if (opts.encodeThrows === true) return Promise.reject(new Error('encode failed'));
    return Promise.resolve(opts.encoded === undefined ? new Blob([new Uint8Array(500)], { type }) : opts.encoded(type));
  });
  const parts: BrowserImageParts = {
    readHead: () => Promise.resolve(opts.head),
    decode: () => (opts.decodeFails === true ? Promise.reject(new Error('cannot decode')) : Promise.resolve(bitmap)),
    encode,
    preview: () => (opts.preview === undefined ? 'data:image/jpeg;base64,AAAA' : opts.preview),
  };
  return { parts, bitmap, close, encode };
}

describe('sniffImageType', () => {
  it('accepts a JPEG signature', () => {
    expect(sniffImageType(JPEG_HEAD)).toBe('jpeg');
  });

  it('accepts a PNG signature', () => {
    expect(sniffImageType(PNG_HEAD)).toBe('png');
  });

  it('accepts a WebP signature', () => {
    expect(sniffImageType(WEBP_HEAD)).toBe('webp');
  });

  it.each(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis'])('accepts a heic file with the %s brand', (brand) => {
    expect(sniffImageType(ftyp(brand))).toBe('heic');
  });

  it.each(['mif1', 'msf1'])('accepts a %s heic file when a compatible brand is a heic brand', (brand) => {
    expect(sniffImageType(ftyp(brand, 'mif1', 'heic'))).toBe('heic');
  });

  it('refuses an avif file', () => {
    expect(sniffImageType(ftyp('avif', 'mif1', 'miaf'))).toBeNull();
  });

  it('refuses a mif1 file whose compatible brands are avif only', () => {
    expect(sniffImageType(ftyp('mif1', 'avif', 'miaf'))).toBeNull();
  });

  it('refuses a heic brand that the box size cuts off', () => {
    const cut = ftyp('mif1', 'mif1', 'heic');
    cut[3] = 20;
    expect(sniffImageType(cut)).toBeNull();
  });

  it('refuses an svg file', () => {
    expect(sniffImageType(head(...ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>')))).toBeNull();
  });

  it('refuses a gif file', () => {
    expect(sniffImageType(head(...ascii('GIF89a')))).toBeNull();
  });

  it('refuses a bmp file', () => {
    expect(sniffImageType(head(...ascii('BM')))).toBeNull();
  });

  it('refuses a RIFF file that is not WebP', () => {
    expect(sniffImageType(head(...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WAVE')))).toBeNull();
  });

  it('refuses 32 zero bytes and a head that is too short', () => {
    expect(sniffImageType(new Uint8Array(32))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
    expect(sniffImageType(Uint8Array.of(0xff, 0xd8))).toBeNull();
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

  it('turns a 3000 x 4000 PNG into a 1500 x 2000 PNG', async () => {
    const fake = fakeParts({ head: PNG_HEAD, width: 3000, height: 4000 });
    const result = await prepareImage(fileOf('mockup.png', 1024, 'image/png'), RULES, fake.parts);

    expect(result).toMatchObject({ ok: true, name: 'mockup.png', type: 'image/png', width: 1500, height: 2000 });
    expect(fake.encode).toHaveBeenCalledWith(fake.bitmap, 1500, 2000, 'image/png', 0.85);
  });

  it('keeps a WebP as WebP when the browser produced WebP', async () => {
    const fake = fakeParts({ head: WEBP_HEAD, width: 4000, height: 3000 });
    const result = await prepareImage(fileOf('shot.webp', 1024, 'image/webp'), RULES, fake.parts);

    expect(result).toMatchObject({ ok: true, name: 'shot.webp', type: 'image/webp' });
    expect(fake.encode).toHaveBeenCalledTimes(1);
  });

  it('falls back to JPEG when the browser gave a PNG for a WebP request', async () => {
    const fake = fakeParts({
      head: WEBP_HEAD,
      width: 4000,
      height: 3000,
      encoded: (type) => new Blob([new Uint8Array(500)], { type: type === 'image/webp' ? 'image/png' : type }),
    });
    const result = await prepareImage(fileOf('shot.webp', 1024, 'image/webp'), RULES, fake.parts);

    expect(result).toMatchObject({ ok: true, name: 'shot.jpg', type: 'image/jpeg', width: 2000, height: 1500 });
    expect(fake.encode).toHaveBeenCalledTimes(2);
    expect(fake.encode).toHaveBeenLastCalledWith(fake.bitmap, 2000, 1500, 'image/jpeg', 0.85);
  });

  it('turns a big heic photo that decodes into a JPEG', async () => {
    const fake = fakeParts({ head: ftyp('heic'), width: 4032, height: 3024 });
    const result = await prepareImage(fileOf('IMG_0002.HEIC', 1024, 'image/heic'), RULES, fake.parts);

    expect(result).toMatchObject({ ok: true, name: 'IMG_0002.jpg', type: 'image/jpeg', width: 2000, height: 1500 });
  });

  it('judges a file by its bytes: a heic header in a file named photo.png is heic', async () => {
    const fake = fakeParts({ head: ftyp('heic'), width: 1000, height: 800 });
    const file = fileOf('photo.png', 1024, 'image/png');
    const result = await prepareImage(file, RULES, fake.parts);

    expect(result).toMatchObject({ ok: true, type: 'image/heic', name: 'photo.png' });
    expect(result.ok && result.file).toBe(file);
  });

  it('refuses an svg named photo.jpg without decoding it', async () => {
    const fake = fakeParts({ head: head(...ascii('<svg xmlns="http://www.w3.org/2000/svg"></svg>')) });
    const decode = vi.spyOn(fake.parts, 'decode');
    const result = await prepareImage(fileOf('photo.jpg'), RULES, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'type' });
    expect(decode).not.toHaveBeenCalled();
  });

  it('refuses an avif file named photo.heic', async () => {
    const fake = fakeParts({ head: ftyp('avif', 'mif1') });
    const result = await prepareImage(fileOf('photo.heic', 1024, 'image/heic'), RULES, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'type' });
  });

  it('sends a heic the browser cannot decode as it is, with no preview, when it is within the size', async () => {
    const fake = fakeParts({ head: ftyp('heic'), decodeFails: true });
    const file = fileOf('IMG_0003.heic', 2048, 'image/heic');
    const result = await prepareImage(file, RULES, fake.parts);

    expect(result).toEqual({
      ok: true,
      file,
      name: 'IMG_0003.heic',
      type: 'image/heic',
      width: null,
      height: null,
      preview: null,
      previewUnavailable: true,
    });
  });

  it('refuses a heic the browser cannot decode when it is over the size', async () => {
    const fake = fakeParts({ head: ftyp('heic'), decodeFails: true });
    const result = await prepareImage(fileOf('big.heic', 3000, 'image/heic'), { ...RULES, maxBytes: 2999 }, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'size' });
  });

  it('refuses a JPEG the browser cannot decode as unreadable', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, decodeFails: true });
    const result = await prepareImage(fileOf('broken.jpg'), RULES, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('refuses a decoded photo with no size as unreadable and closes it', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, width: 0, height: 0 });
    const result = await prepareImage(fileOf('empty.jpg'), RULES, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'unreadable' });
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('refuses a 6000 x 5000 photo over the pixel limit and closes the bitmap', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, width: 6000, height: 5000 });
    const result = await prepareImage(fileOf('huge.jpg'), RULES, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'pixels' });
    expect(fake.encode).not.toHaveBeenCalled();
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('refuses a photo with a side over the side limit', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, width: 9000, height: 1000 });
    const result = await prepareImage(fileOf('strip.jpg'), { ...RULES, maxSide: 8000 }, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'pixels' });
  });

  it('refuses an encoded photo over the size and closes the bitmap', async () => {
    const fake = fakeParts({
      head: JPEG_HEAD,
      width: 4000,
      height: 3000,
      encoded: (type) => new Blob([new Uint8Array(2000)], { type }),
    });
    const result = await prepareImage(fileOf('heavy.jpg'), { ...RULES, maxBytes: 1999 }, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'size' });
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('refuses a small photo that is over the size, as it is sent unchanged', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, width: 1000, height: 800 });
    const result = await prepareImage(fileOf('heavy.jpg', 3000), { ...RULES, maxBytes: 2999 }, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'size' });
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('refuses as unreadable when the encoder gives nothing, and closes the bitmap', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, width: 4000, height: 3000, encoded: () => null });
    const result = await prepareImage(fileOf('a.jpg'), RULES, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'unreadable' });
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('refuses as unreadable when the encoder gives a type the server does not take', async () => {
    const fake = fakeParts({
      head: JPEG_HEAD,
      width: 4000,
      height: 3000,
      encoded: () => new Blob([new Uint8Array(10)], { type: 'image/gif' }),
    });
    const result = await prepareImage(fileOf('a.jpg'), RULES, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('refuses as unreadable when the encoder throws, and closes the bitmap', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, width: 4000, height: 3000, encodeThrows: true });
    const result = await prepareImage(fileOf('a.jpg'), RULES, fake.parts);

    expect(result).toEqual({ ok: false, reason: 'unreadable' });
    expect(fake.close).toHaveBeenCalledTimes(1);
  });

  it('flags the preview as unavailable when the browser makes none', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, width: 1000, height: 800, preview: null });
    const result = await prepareImage(fileOf('a.jpg'), RULES, fake.parts);

    expect(result).toMatchObject({ ok: true, preview: null, previewUnavailable: true });
  });

  it('flags the preview as unavailable when making it throws', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, width: 1000, height: 800 });
    vi.spyOn(fake.parts, 'preview').mockImplementation(() => {
      throw new Error('no canvas');
    });
    const result = await prepareImage(fileOf('a.jpg'), RULES, fake.parts);

    expect(result).toMatchObject({ ok: true, preview: null, previewUnavailable: true });
  });

  it('asks for a preview with a 176 px long side', async () => {
    const fake = fakeParts({ head: JPEG_HEAD, width: 4000, height: 3000 });
    const preview = vi.spyOn(fake.parts, 'preview');
    await prepareImage(fileOf('a.jpg'), RULES, fake.parts);

    expect(preview).toHaveBeenCalledWith(fake.bitmap, 176, 132);
  });

  it('keeps no state: two calls at once give independent results', async () => {
    const big = fakeParts({ head: JPEG_HEAD, width: 4000, height: 3000 });
    const png = fakeParts({ head: PNG_HEAD, width: 800, height: 600 });
    const bad = fakeParts({ head: JPEG_HEAD, decodeFails: true });
    const [a, b, c] = await Promise.all([
      prepareImage(fileOf('big.jpg'), RULES, big.parts),
      prepareImage(fileOf('small.png', 1024, 'image/png'), RULES, png.parts),
      prepareImage(fileOf('bad.jpg'), RULES, bad.parts),
    ]);

    expect(a).toMatchObject({ ok: true, width: 2000, height: 1500, type: 'image/jpeg' });
    expect(b).toMatchObject({ ok: true, width: 800, height: 600, type: 'image/png' });
    expect(c).toEqual({ ok: false, reason: 'unreadable' });
  });

  it('writes nothing to browser storage', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    const fake = fakeParts({ head: JPEG_HEAD, width: 4000, height: 3000 });
    await prepareImage(fileOf('a.jpg'), RULES, fake.parts);

    expect(setItem).not.toHaveBeenCalled();
  });
});

describe('defaultBrowserImageParts', () => {
  const drawImage = vi.fn();
  const fillRect = vi.fn();
  const bitmap: DecodedBitmap = { width: 4000, height: 3000, close: vi.fn() };

  function stubCanvas(opts: { context?: boolean; blobType?: string | null; dataUrl?: string } = {}) {
    const context = { imageSmoothingQuality: 'low', fillStyle: '', fillRect, drawImage };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      (opts.context === false ? null : context) as never,
    );
    const toBlob = vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback, type) => {
      callback(opts.blobType === null ? null : new Blob([new Uint8Array(10)], { type: opts.blobType ?? type ?? '' }));
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(opts.dataUrl ?? 'data:image/jpeg;base64,QQ==');
    return { toBlob };
  }

  afterEach(() => {
    vi.unstubAllGlobals();
    drawImage.mockClear();
    fillRect.mockClear();
  });

  it('reads the first 32 bytes of the file', async () => {
    const bytes = new Uint8Array(100).fill(7);
    bytes.set([0xff, 0xd8, 0xff]);
    const head32 = await defaultBrowserImageParts.readHead(new File([bytes], 'a.jpg'));

    expect(head32).toHaveLength(32);
    expect([...head32.slice(0, 4)]).toEqual([0xff, 0xd8, 0xff, 7]);
  });

  it('decodes with the photo orientation applied', async () => {
    const decoded = { width: 1, height: 1, close: vi.fn() };
    const createImageBitmap = vi.fn().mockResolvedValue(decoded);
    vi.stubGlobal('createImageBitmap', createImageBitmap);
    const file = fileOf('a.jpg');

    await expect(defaultBrowserImageParts.decode(file)).resolves.toBe(decoded);
    expect(createImageBitmap).toHaveBeenCalledWith(file, { imageOrientation: 'from-image' });
  });

  it('draws the photo at the planned size with high smoothing and encodes it', async () => {
    const { toBlob } = stubCanvas();
    const blob = await defaultBrowserImageParts.encode(bitmap, 2000, 1500, 'image/jpeg', 0.85);

    expect(blob?.type).toBe('image/jpeg');
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 2000, 1500);
    expect(fillRect).toHaveBeenCalledWith(0, 0, 2000, 1500);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.85);
  });

  it('does not paint a white background under a PNG', async () => {
    stubCanvas();
    await defaultBrowserImageParts.encode(bitmap, 1500, 2000, 'image/png', 0.85);

    expect(fillRect).not.toHaveBeenCalled();
  });

  it('gives null when the canvas has no 2d context', async () => {
    stubCanvas({ context: false });

    await expect(defaultBrowserImageParts.encode(bitmap, 10, 10, 'image/jpeg', 0.85)).resolves.toBeNull();
    expect(defaultBrowserImageParts.preview(bitmap, 10, 10)).toBeNull();
  });

  it('gives null when the canvas cannot encode', async () => {
    stubCanvas({ blobType: null });

    await expect(defaultBrowserImageParts.encode(bitmap, 10, 10, 'image/jpeg', 0.85)).resolves.toBeNull();
  });

  it('makes a data: URL preview', () => {
    stubCanvas();

    expect(defaultBrowserImageParts.preview(bitmap, 176, 132)).toBe('data:image/jpeg;base64,QQ==');
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 176, 132);
  });

  it('gives no preview when the browser returns something that is not an image data: URL', () => {
    stubCanvas({ dataUrl: 'data:,' });

    expect(defaultBrowserImageParts.preview(bitmap, 176, 132)).toBeNull();
  });
});
