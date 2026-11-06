import { describe, expect, it } from 'vitest';
import { ORDER_PHOTOS_COPY } from '@/modules/admin/orderPhotosCopy';
import {
  buildPickSchema,
  cleanFileName,
  descriptionSchema,
  pickFailureMessage,
  toImageRules,
  type ImageRules,
} from '@/modules/admin/orderPhotosSchemas';
import { IMAGE_RULES } from '@/test/orderFixtures';

// The browser mirror of the upload endpoint's rules (OR-3, IMG-02): the numbers come from the server's rules, the words are the
// server's own, and the counts read in the singular where they should (UIC-36).

const RULES: ImageRules = toImageRules(IMAGE_RULES);

function facts(
  overrides: Partial<{ name: string; type: string; bytes: number; width: number | null; height: number | null }>,
) {
  return { name: 'front.jpg', type: 'image/jpeg', bytes: 1_000_000, width: 2000, height: 1333, ...overrides };
}

describe('toImageRules', () => {
  it('turns numbers sent as text into numbers', () => {
    expect(
      toImageRules({
        maxPerOrder: '5',
        maxBytes: '10485760',
        maxPixels: '25000000',
        maxSide: '10000',
        types: ['jpeg'],
        descriptionMaxLength: '200',
      }),
    ).toEqual({
      maxPerOrder: 5,
      maxBytes: 10_485_760,
      maxPixels: 25_000_000,
      maxSide: 10_000,
      types: ['jpeg'],
      descriptionMaxLength: 200,
    });
  });
});

describe('cleanFileName (the server cleans the name the same way)', () => {
  it.each([
    ['C:\\Users\\Staff\\front.jpg', 'front.jpg'],
    ['/photos/back.png', 'back.png'],
    ['  side\u0007.jpg  ', 'side.jpg'],
    ['', 'This file'],
    ['a'.repeat(100), 'a'.repeat(80)],
  ])('%j becomes %j', (name, expected) => {
    expect(cleanFileName(name)).toBe(expected);
  });
});

describe('pickFailureMessage (the server wording, IMG-02)', () => {
  it('says a file is not a photo we can use', () => {
    expect(pickFailureMessage('type', 'logo.svg', RULES)).toBe(
      "logo.svg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.",
    );
  });

  it('names the size limit from the rules in whole MB, then KB, then bytes', () => {
    expect(pickFailureMessage('size', 'big.jpg', RULES)).toBe('big.jpg is over 10 MB. Choose a smaller photo.');
    expect(pickFailureMessage('size', 'big.jpg', { ...RULES, maxBytes: 5 * 1_048_576 })).toBe(
      'big.jpg is over 5 MB. Choose a smaller photo.',
    );
    expect(pickFailureMessage('size', 'big.jpg', { ...RULES, maxBytes: 524_288 })).toBe(
      'big.jpg is over 512 KB. Choose a smaller photo.',
    );
    expect(pickFailureMessage('size', 'big.jpg', { ...RULES, maxBytes: 500 })).toBe(
      'big.jpg is over 500 bytes. Choose a smaller photo.',
    );
  });

  it('names the pixel limit in megapixels', () => {
    expect(pickFailureMessage('pixels', 'huge.jpg', RULES)).toBe(
      'huge.jpg is too big. Photos can be at most 25 megapixels.',
    );
  });

  it('says a file could not be read', () => {
    expect(pickFailureMessage('unreadable', 'broken.jpg', RULES)).toBe(
      "broken.jpg couldn't be read. Try another photo.",
    );
  });

  it('cleans the name it shows', () => {
    expect(pickFailureMessage('type', 'C:\\Temp\\logo.svg', RULES)).toBe(
      "logo.svg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.",
    );
  });
});

describe('buildPickSchema', () => {
  const schema = buildPickSchema(RULES);

  function message(input: ReturnType<typeof facts>): string | null {
    const verdict = schema.safeParse(input);
    return verdict.success ? null : (verdict.error.issues[0]?.message ?? null);
  }

  it('accepts a photo inside every limit', () => {
    expect(message(facts({}))).toBeNull();
  });

  it('accepts a photo whose pixels the browser could not read (HEIC), when it is not too large', () => {
    expect(message(facts({ type: 'image/heic', width: null, height: null }))).toBeNull();
  });

  it('refuses a type the server does not list', () => {
    expect(message(facts({ type: 'image/gif', name: 'move.gif' }))).toBe(pickFailureMessage('type', 'move.gif', RULES));
    expect(message(facts({ type: 'image/png' }))).toBeNull();
  });

  it('refuses a file over the byte limit, at the limit itself it passes', () => {
    expect(message(facts({ bytes: RULES.maxBytes }))).toBeNull();
    expect(message(facts({ bytes: RULES.maxBytes + 1 }))).toBe(pickFailureMessage('size', 'front.jpg', RULES));
  });

  it('refuses too many pixels, and a side that is too long', () => {
    expect(message(facts({ width: 6000, height: 5000 }))).toBe(pickFailureMessage('pixels', 'front.jpg', RULES));
    expect(message(facts({ width: 10_001, height: 100 }))).toBe(pickFailureMessage('pixels', 'front.jpg', RULES));
    expect(message(facts({ width: 5000, height: 5000 }))).toBeNull();
  });

  it('follows the rules it is given, not fixed numbers', () => {
    const strict = buildPickSchema({ ...RULES, maxBytes: 1000, types: ['png'] });

    expect(strict.safeParse(facts({ bytes: 2000, type: 'image/png' })).success).toBe(false);
    expect(strict.safeParse(facts({ bytes: 500, type: 'image/jpeg' })).success).toBe(false);
    expect(strict.safeParse(facts({ bytes: 500, type: 'image/png' })).success).toBe(true);
  });
});

describe('descriptionSchema', () => {
  it('allows the limit after trimming and refuses one more with the server message', () => {
    const schema = descriptionSchema(RULES);

    expect(schema.safeParse(`  ${'a'.repeat(200)}  `).success).toBe(true);
    const verdict = schema.safeParse('a'.repeat(201));
    expect(verdict.success).toBe(false);
    expect(verdict.error?.issues[0]?.message).toBe('Keep the description to 200 characters or fewer.');
  });

  it('counts UTF-16 code units like the server, so an emoji costs two', () => {
    const schema = descriptionSchema({ ...RULES, descriptionMaxLength: 4 });

    expect(schema.safeParse('😀😀').success).toBe(true);
    expect(schema.safeParse('😀😀😀').success).toBe(false);
  });
});

describe('counts read in the singular where they should (UIC-36)', () => {
  const COPY = ORDER_PHOTOS_COPY;

  it('reads the batch toast', () => {
    expect(COPY.toasts.added.message(1, 'ORD-2026-0148')).toBe('1 photo added to ORD-2026-0148.');
    expect(COPY.toasts.added.message(4, 'ORD-2026-0148')).toBe('4 photos added to ORD-2026-0148.');
  });

  it('reads the partial-failure banner', () => {
    expect(COPY.banner.title(1, 3)).toBe("1 of 3 photos didn't upload.");
    expect(COPY.banner.title(2, 2)).toBe("2 of 2 photos didn't upload.");
    expect(COPY.banner.title(1, 1)).toBe("1 of 1 photo didn't upload.");
  });

  it('reads the leave guard', () => {
    expect(COPY.leave.message(1)).toBe("1 photo hasn't uploaded yet. If you leave now, it's lost.");
    expect(COPY.leave.message(3)).toBe("3 photos haven't uploaded yet. If you leave now, they're lost.");
  });
});
