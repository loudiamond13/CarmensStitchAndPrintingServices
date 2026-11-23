// The picker rules of the lazy photo piece (D-02, D-43): the ticket's limits, or the built-in ones when no ticket came.
import { describe, expect, it } from 'vitest';
import { pickerRules } from './quotePhotoKit';
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
