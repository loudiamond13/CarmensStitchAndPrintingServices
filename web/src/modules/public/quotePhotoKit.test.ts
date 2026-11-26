// The picker rules of the lazy photo piece (D-02, D-43): the ticket's limits, or the built-in ones when no ticket came.
import { describe, expect, it } from 'vitest';
import { pngFile } from '@/test/quotePhotoFixtures';
import { firstPick, pickerRules } from './quotePhotoKit';
import { QUOTE_PHOTO_RULES } from './quotePhotos';

describe('pickerRules', () => {
  it('uses every photo limit the ticket answer sent', () => {
    expect(pickerRules({ maxPhotos: 3, maxBytes: 2_000_000, maxPixels: 12_000_000 })).toEqual({
      ...QUOTE_PHOTO_RULES,
      maxPhotos: 3,
      maxBytes: 2_000_000,
      maxPixels: 12_000_000,
    });
  });

  it('falls back to the built-in rules without a ticket', () => {
    expect(pickerRules(undefined)).toBe(QUOTE_PHOTO_RULES);
  });
});

describe('firstPick (review W5 CR-01: the first pick is checked before the picker shows)', () => {
  it('keeps the photos, names a refused file, and takes a photo picked twice once', async () => {
    const logo = pngFile('logo.png');
    const notes = new File(['this is not a photo'], 'notes.jpg', { type: 'image/jpeg' });

    const pick = await firstPick([logo, notes, logo], undefined);

    expect(pick.rules).toBe(QUOTE_PHOTO_RULES);
    expect(pick.photos).toEqual([logo]);
    expect(pick.errors.refusals).toEqual([
      "notes.jpg isn't a photo we can take. Use JPG, PNG, WebP or HEIC, or send it on Messenger.",
    ]);
    expect(pick.errors.countLine).toBeNull();
  });

  it('counts past the ticket limit', async () => {
    const pick = await firstPick([pngFile('a.png', 70), pngFile('b.png', 71)], {
      maxPhotos: 1,
      maxBytes: 10_485_760,
      maxPixels: 25_000_000,
    });

    expect(pick.photos.map((file) => file.name)).toEqual(['a.png']);
    expect(pick.errors.countLine).toBe("You can send up to 1 photos. 1 of the photos you picked wasn't added.");
  });
});
