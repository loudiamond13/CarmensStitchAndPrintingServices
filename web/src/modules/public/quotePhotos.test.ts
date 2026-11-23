import { describe, expect, it, vi } from 'vitest';
import { checkQuotePhotos, QUOTE_PHOTO_RULES, type QuotePhotoRules } from '@/modules/public/quotePhotos';

// The browser mirror of the server's photo rules for the quote form (OR-3, INQ-02, D-01, D-02, D-06, CWE-434): the type is read
// from the file's first bytes, the size and the count come from the rules, and the words are the server's own.

const MB = 1_048_576;
const LIMIT = 10 * MB;

function withHead(name: string, head: readonly number[], size = 64, type = 'image/jpeg'): File {
  const bytes = new Uint8Array(Math.max(size, head.length));
  bytes.set(head);
  return new File([bytes], name, { type });
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50];
const HEIC = [
  0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63, 0, 0, 0, 0, 0x6d, 0x69, 0x66, 0x31, 0x68, 0x65, 0x69,
  0x63,
];

function png(name: string, size = 64): File {
  return withHead(name, PNG, size, 'image/png');
}

function text(name: string): File {
  return new File(['this is not a photo'], name, { type: 'image/jpeg' });
}

describe('checkQuotePhotos: the photo type is read from the first bytes (D-01, CWE-434)', () => {
  it.each([
    ['JPEG', JPEG],
    ['PNG', PNG],
    ['WebP', WEBP],
    ['HEIC', HEIC],
  ])('takes a %s photo whatever its name says', async (_label, head) => {
    const file = withHead('photo.bin', head, 64, 'application/octet-stream');

    const result = await checkQuotePhotos([file], 0, QUOTE_PHOTO_RULES);

    expect(result.accepted).toEqual([file]);
    expect(result.refusals).toEqual([]);
    expect(result.countLine).toBeNull();
  });

  it('refuses a text file named photo.jpg, even with an image MIME type', async () => {
    const result = await checkQuotePhotos([text('photo.jpg')], 0, QUOTE_PHOTO_RULES);

    expect(result.accepted).toEqual([]);
    expect(result.refusals).toEqual([
      "photo.jpg isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.",
    ]);
  });

  it('refuses a photo whose type the rules do not list', async () => {
    const rules: QuotePhotoRules = { ...QUOTE_PHOTO_RULES, types: ['jpeg', 'png'] };

    const result = await checkQuotePhotos([withHead('shot.webp', WEBP)], 0, rules);

    expect(result.refusals).toEqual([
      "shot.webp isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.",
    ]);
  });

  it('shows a cleaned name: no folders, and "This file" when there is none', async () => {
    const result = await checkQuotePhotos([text('C:\\Temp\\notes.jpg'), text('')], 0, QUOTE_PHOTO_RULES);

    expect(result.refusals).toEqual([
      "notes.jpg isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.",
      "This file isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.",
    ]);
  });
});

describe('checkQuotePhotos: the size limit (D-02, boundary)', () => {
  it('takes a file of exactly 10,485,760 bytes', async () => {
    const file = png('exact.png', LIMIT);

    const result = await checkQuotePhotos([file], 0, QUOTE_PHOTO_RULES);

    expect(result.accepted).toEqual([file]);
    expect(result.refusals).toEqual([]);
  });

  it('refuses a file one byte over, in the server words', async () => {
    const result = await checkQuotePhotos([png('big.png', LIMIT + 1)], 0, QUOTE_PHOTO_RULES);

    expect(result.accepted).toEqual([]);
    expect(result.refusals).toEqual(['big.png is over 10 MB. Send a smaller photo, or send it on Messenger.']);
  });

  it('writes the limit from the rules, so the copy follows the server number', async () => {
    const rules: QuotePhotoRules = { ...QUOTE_PHOTO_RULES, maxBytes: 5 * MB };

    const result = await checkQuotePhotos([png('mid.png', 5 * MB + 1)], 0, rules);

    expect(result.refusals).toEqual(['mid.png is over 5 MB. Send a smaller photo, or send it on Messenger.']);
  });

  it('checks the type before the size', async () => {
    const result = await checkQuotePhotos([withHead('huge.txt', [0x68, 0x69], LIMIT + 1)], 0, QUOTE_PHOTO_RULES);

    expect(result.refusals).toEqual([
      "huge.txt isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.",
    ]);
  });
});

describe('checkQuotePhotos: the count limit (D-02, D-06)', () => {
  it('takes a fifth photo', async () => {
    const files = [png('a.png'), png('b.png')];

    const result = await checkQuotePhotos(files, 3, QUOTE_PHOTO_RULES);

    expect(result.accepted).toEqual(files);
    expect(result.countLine).toBeNull();
  });

  it('with 4 already picked, takes 1 of 3 and says 2 were not added', async () => {
    const files = [png('a.png'), png('b.png'), png('c.png')];

    const result = await checkQuotePhotos(files, 4, QUOTE_PHOTO_RULES);

    expect(result.accepted).toEqual([files[0]]);
    expect(result.refusals).toEqual([]);
    expect(result.countLine).toBe("You can send up to 5 photos. 2 of the photos you picked weren't added.");
  });

  it('says it in the singular for one left out', async () => {
    const result = await checkQuotePhotos([png('a.png'), png('b.png')], 4, QUOTE_PHOTO_RULES);

    expect(result.accepted).toHaveLength(1);
    expect(result.countLine).toBe("You can send up to 5 photos. 1 of the photos you picked wasn't added.");
  });

  it('refuses everything with the count line when 5 are already picked', async () => {
    const result = await checkQuotePhotos([png('a.png')], 5, QUOTE_PHOTO_RULES);

    expect(result.accepted).toEqual([]);
    expect(result.countLine).toBe("You can send up to 5 photos. 1 of the photos you picked wasn't added.");
  });

  it('does not let a refused file use up a place, and still names it', async () => {
    const good = png('good.png');

    const result = await checkQuotePhotos([text('notes.jpg'), good], 4, QUOTE_PHOTO_RULES);

    expect(result.accepted).toEqual([good]);
    expect(result.refusals).toHaveLength(1);
    expect(result.countLine).toBeNull();
  });

  it('follows the count from the rules', async () => {
    const rules: QuotePhotoRules = { ...QUOTE_PHOTO_RULES, maxPhotos: 2 };

    const result = await checkQuotePhotos([png('a.png'), png('b.png'), png('c.png')], 0, rules);

    expect(result.accepted).toHaveLength(2);
    expect(result.countLine).toBe("You can send up to 2 photos. 1 of the photos you picked wasn't added.");
  });
});

describe('checkQuotePhotos: a file that cannot be read', () => {
  it('is refused with the unreadable words and the rest of the pick goes on', async () => {
    const broken = png('broken.png');
    vi.spyOn(broken, 'slice').mockReturnValue({
      arrayBuffer: () => Promise.reject(new Error('no access')),
    } as unknown as Blob);
    const good = png('good.png');

    const result = await checkQuotePhotos([broken, good], 0, QUOTE_PHOTO_RULES);

    expect(result.accepted).toEqual([good]);
    expect(result.refusals).toEqual(["broken.png couldn't be read. Try another photo."]);
  });
});

describe('checkQuotePhotos: the pixel limit from the ticket (D-02, OR-3)', () => {
  /** Image parts that read the real first bytes and decode to the given size. */
  function sized(width: number, height: number, close = vi.fn()) {
    return {
      readHead: async (file: Blob) => new Uint8Array(await file.slice(0, 32).arrayBuffer()),
      decode: () => Promise.resolve({ width, height, close }),
    };
  }

  it('refuses a photo over the pixel limit in the server words and closes what it decoded', async () => {
    const close = vi.fn();

    const result = await checkQuotePhotos([png('huge.png')], 0, QUOTE_PHOTO_RULES, sized(6000, 5000, close));

    expect(result.accepted).toEqual([]);
    expect(result.refusals).toEqual(['huge.png is too big. Photos can be at most 25 megapixels.']);
    expect(close).toHaveBeenCalledOnce();
  });

  it('takes a photo exactly at the limit', async () => {
    const edge = png('edge.png');

    const result = await checkQuotePhotos([edge], 0, QUOTE_PHOTO_RULES, sized(5000, 5000));

    expect(result.accepted).toEqual([edge]);
    expect(result.refusals).toEqual([]);
  });

  it('follows the pixel limit from the rules', async () => {
    const rules: QuotePhotoRules = { ...QUOTE_PHOTO_RULES, maxPixels: 12_000_000 };

    const result = await checkQuotePhotos([png('big.png')], 0, rules, sized(4000, 3001));

    expect(result.refusals).toEqual(['big.png is too big. Photos can be at most 12 megapixels.']);
  });

  it('leaves a photo the browser cannot decode (HEIC in most browsers) to the server', async () => {
    const heic = withHead('IMG_0001.heic', HEIC, 64, 'image/heic');
    const parts = { ...sized(0, 0), decode: () => Promise.reject(new Error('cannot decode')) };

    const result = await checkQuotePhotos([heic], 0, QUOTE_PHOTO_RULES, parts);

    expect(result.accepted).toEqual([heic]);
  });

  it('does not decode a photo that is left out by the count', async () => {
    const decode = vi.fn(() => Promise.resolve({ width: 10, height: 10, close: vi.fn() }));
    const rules: QuotePhotoRules = { ...QUOTE_PHOTO_RULES, maxPhotos: 1 };

    await checkQuotePhotos([png('a.png'), png('b.png')], 0, rules, { ...sized(10, 10), decode });

    expect(decode).toHaveBeenCalledOnce();
  });

  it('uses the server pixel limit by default', () => {
    expect(QUOTE_PHOTO_RULES.maxPixels).toBe(25_000_000);
  });
});
