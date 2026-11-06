// The `sizes` strings of the image slots (UI-SPEC "Image Delivery", IMG-04). The server builds every address and srcset
// (the client never assembles a Cloudinary address); these strings only tell the browser how wide a slot shows.

/**
 * The Orders list grid card cover, inside the card's 1px border: 1 / 2 / 3 / 4 columns 20px apart, inside the body padding, the
 * body at most 1440px. The
 * widths are for the 72px collapsed sidebar (always the rail on tablets), the widest a card can be, so a cover is never soft;
 * with the 248px sidebar open the card is 44 to 59px narrower.
 */
export const CARD_SIZES =
  '(max-width: 767px) calc(100vw - 34px), (max-width: 1023px) calc(50vw - 72px), (max-width: 1279px) calc(33.3333vw - 60.6667px), min(327px, calc(25vw - 51px))';

/** The photo viewer stage: the viewport minus the nav columns, up to 956px. */
export const VIEWER_SIZES = '(max-width: 639px) calc(100vw - 32px), min(956px, calc(100vw - 176px))';

/** One srcset candidate: its address and descriptor (`w` is a width in pixels, `x` a pixel density). */
export interface SrcSetCandidate {
  url: string;
  kind: 'w' | 'x';
  value: number;
}

// An address is a run without spaces (it may hold commas, as Cloudinary transformations do), then its descriptor.
const CANDIDATE = /(\S+)\s+(\d+(?:\.\d+)?)([wx])\s*(?:,|$)/g;

/**
 * The candidate a browser picks from a srcset: the smallest one that covers `slotWidth` x `devicePixelRatio` pixels (`w`)
 * or the screen density (`x`), else the largest. It lets a test check IMG-04 without a browser.
 */
export function pickCandidate(srcSet: string, slotWidth: number, devicePixelRatio: number): SrcSetCandidate {
  const candidates = [...srcSet.matchAll(CANDIDATE)].map((match): SrcSetCandidate => ({
    url: match[1] ?? '',
    value: Number(match[2]),
    kind: match[3] === 'w' ? 'w' : 'x',
  }));
  const first = candidates[0];
  if (first === undefined) throw new Error('The srcset has no candidate.');
  if (candidates.some((candidate) => candidate.kind !== first.kind)) {
    throw new Error('The srcset mixes w and x descriptors.');
  }
  const needed = first.kind === 'w' ? slotWidth * devicePixelRatio : devicePixelRatio;
  const ascending = [...candidates].sort((a, b) => a.value - b.value);
  return ascending.find((candidate) => candidate.value >= needed) ?? ascending[ascending.length - 1] ?? first;
}
