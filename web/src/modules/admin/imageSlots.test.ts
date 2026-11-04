import { describe, expect, it } from 'vitest';
import { CARD_SIZES, pickCandidate, VIEWER_SIZES } from '@/modules/admin/imageSlots';
import { orderImage } from '@/test/orderFixtures';
import { orderListCover } from '@/test/orderListFixtures';

// Nothing larger than its display size is loaded (IMG-04, UIC-49): the browser's choice from each slot's srcset and sizes.

const CARD_SRCSET = orderListCover(1).card.srcSet;
const TABLE_SRCSET = orderListCover(1).table.srcSet;
const TILE_SRCSET = orderImage(1).thumb.srcSet;
const VIEWER_SRCSET = orderImage(1).viewer.srcSet;

const VIEWPORTS = [390, 820, 1440] as const;
const DENSITIES = [1, 2] as const;

/** Splits a list at the commas outside brackets. */
function splitTopLevel(text: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (char === '(') depth += 1;
    else if (char === ')') depth -= 1;
    else if (char === ',' && depth === 0) {
      parts.push(text.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(text.slice(start).trim());
  return parts;
}

/** A CSS length from a sizes entry: px, calc(Nvw - Mpx) and min(a, b), the only forms the slots use. */
function lengthIn(expression: string, viewport: number): number {
  const text = expression.trim();
  const px = /^(\d+(?:\.\d+)?)px$/.exec(text);
  if (px?.[1] !== undefined) return Number(px[1]);
  const calc = /^calc\((\d+(?:\.\d+)?)vw - (\d+(?:\.\d+)?)px\)$/.exec(text);
  if (calc?.[1] !== undefined && calc[2] !== undefined) return (Number(calc[1]) / 100) * viewport - Number(calc[2]);
  const min = /^min\((.*)\)$/.exec(text);
  if (min?.[1] !== undefined) return Math.min(...splitTopLevel(min[1]).map((part) => lengthIn(part, viewport)));
  throw new Error(`Unsupported length: ${text}`);
}

/** The width a `sizes` string gives at a viewport: the first media condition that matches, else the last entry. */
function slotWidth(sizes: string, viewport: number): number {
  const entries = splitTopLevel(sizes);
  for (const entry of entries.slice(0, -1)) {
    const match = /^\(max-width: (\d+)px\)\s+(.*)$/.exec(entry);
    if (match?.[1] === undefined || match[2] === undefined) throw new Error(`Unsupported entry: ${entry}`);
    if (viewport <= Number(match[1])) return lengthIn(match[2], viewport);
  }
  return lengthIn(entries[entries.length - 1] ?? '', viewport);
}

/** The widest a slot ever shows, from a 320 px phone to a 1920 px desktop. */
function widestBox(sizes: string): number {
  let widest = 0;
  for (let viewport = 320; viewport <= 1920; viewport += 1) {
    widest = Math.max(widest, slotWidth(sizes, viewport));
  }
  return widest;
}

/** The widths a w-descriptor srcset offers. */
function widthsOf(srcSet: string): number[] {
  return [...srcSet.matchAll(/\s(\d+)w(?:,|$)/g)].map((match) => Number(match[1]));
}

describe('the sizes strings', () => {
  it('give the card the UI-SPEC boxes at 390, 820 and 1440 px wide', () => {
    expect(VIEWPORTS.map((viewport) => slotWidth(CARD_SIZES, viewport))).toEqual([358, 376, 330]);
  });

  it('give the viewer the UI-SPEC boxes at 390, 820 and 1440 px wide', () => {
    expect(VIEWPORTS.map((viewport) => slotWidth(VIEWER_SIZES, viewport))).toEqual([358, 644, 956]);
  });

  it('never name a Cloudinary address (the client assembles none)', () => {
    expect(`${CARD_SIZES}${VIEWER_SIZES}`).not.toMatch(/cloudinary|https?:/i);
  });
});

describe.each([
  ['card', CARD_SIZES, CARD_SRCSET],
  ['viewer', VIEWER_SIZES, VIEWER_SRCSET],
] as const)('the %s slot picks no more than it needs (UIC-49)', (_name, sizes, srcSet) => {
  it.each(VIEWPORTS)(
    'at %i px wide, the choice is the smallest candidate that covers the pixels, at 1x and 2x',
    (viewport) => {
      const box = slotWidth(sizes, viewport);
      const widths = widthsOf(srcSet);

      for (const density of DENSITIES) {
        const needed = box * density;
        const picked = pickCandidate(srcSet, box, density);
        const covering = widths.filter((width) => width >= needed);

        expect(picked.kind).toBe('w');
        expect(picked.value).toBe(covering.length > 0 ? Math.min(...covering) : Math.max(...widths));
      }
    },
  );

  it.each(VIEWPORTS)('at %i px wide, 1x loads no more than 2x the displayed box', (viewport) => {
    const box = slotWidth(sizes, viewport);

    expect(pickCandidate(srcSet, box, 1).value).toBeLessThanOrEqual(2 * box);
  });

  it.each(VIEWPORTS)('at %i px wide, 2x loads no more than 2x the pixels the screen can show', (viewport) => {
    const box = slotWidth(sizes, viewport);

    expect(pickCandidate(srcSet, box, 2).value).toBeLessThanOrEqual(2 * (2 * box));
  });

  it('offers no candidate wider than 2x the widest box the slot shows', () => {
    expect(Math.max(...widthsOf(srcSet))).toBeLessThanOrEqual(2 * widestBox(sizes));
  });
});

describe('the x-descriptor slots (table thumb 44 px, photo tile 88 px)', () => {
  it.each([
    ['table', TABLE_SRCSET],
    ['tile', TILE_SRCSET],
  ])('the %s thumb picks the 1x address at 1x and the 2x address at 2x', (_name, srcSet) => {
    const [first, second] = srcSet.split(/,\s+(?=\S+\s+\dx)/).map((candidate) => candidate.trim());

    expect(pickCandidate(srcSet, 44, 1).url).toBe(first?.replace(/\s+1x$/, ''));
    expect(pickCandidate(srcSet, 44, 1).kind).toBe('x');
    expect(pickCandidate(srcSet, 44, 2).url).toBe(second?.replace(/\s+2x$/, ''));
  });

  it('falls back to the largest density on a 3x screen', () => {
    expect(pickCandidate(TABLE_SRCSET, 44, 3).value).toBe(2);
  });
});

describe('pickCandidate', () => {
  it('keeps commas inside an address, as Cloudinary transformations have them', () => {
    const srcSet =
      'https://example.test/f_auto,q_auto,w_320/a.jpg 320w, https://example.test/f_auto,q_auto,w_640/a.jpg 640w';

    expect(pickCandidate(srcSet, 300, 1).url).toBe('https://example.test/f_auto,q_auto,w_320/a.jpg');
    expect(pickCandidate(srcSet, 300, 2).url).toBe('https://example.test/f_auto,q_auto,w_640/a.jpg');
  });

  it('takes the largest candidate when every candidate is too small', () => {
    expect(pickCandidate('/a 320w, /b 640w', 900, 2).url).toBe('/b');
  });

  it('takes an exact match, not the next candidate up', () => {
    expect(pickCandidate('/a 320w, /b 640w', 320, 1).url).toBe('/a');
  });

  it('does not depend on the order the candidates are listed in', () => {
    expect(pickCandidate('/b 640w, /a 320w', 300, 1).url).toBe('/a');
  });

  it('refuses an empty srcset', () => {
    expect(() => pickCandidate('', 300, 1)).toThrow();
  });

  it('refuses a srcset that mixes w and x descriptors', () => {
    expect(() => pickCandidate('/a 320w, /b 2x', 300, 1)).toThrow();
  });
});
