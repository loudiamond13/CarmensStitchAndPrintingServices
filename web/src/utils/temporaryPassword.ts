// The readable temporary password of Add User (C-4, 04 D-21, D-14; plan 05-22): two words from the list below, a hyphen
// and four digits, like Tela-Sukat-7381. It is a suggestion the Manager may edit; the server only applies the basic rule
// and the person must replace it at first sign-in. Only crypto.getRandomValues is used (no weaker source), and every
// index is drawn by rejection sampling, so no word or digit is likelier than another (T-05-64). 40 words squared times
// 10,000 digit groups is 16 million values.

/** Fills the buffer with random 32-bit numbers, as crypto.getRandomValues does. */
export type RandomFill = (buffer: Uint32Array<ArrayBuffer>) => unknown;

/** Short, plain-letter sewing words in Tagalog and English: easy to read out and to type, none that offend. */
export const TEMPORARY_PASSWORD_WORDS: readonly string[] = [
  'Tela',
  'Sukat',
  'Tahi',
  'Sinulid',
  'Karayom',
  'Butones',
  'Gunting',
  'Burda',
  'Hilo',
  'Sinag',
  'Kulay',
  'Bulak',
  'Lana',
  'Seda',
  'Damit',
  'Alampay',
  'Kamiseta',
  'Sinturon',
  'Thread',
  'Needle',
  'Button',
  'Fabric',
  'Thimble',
  'Stitch',
  'Pattern',
  'Seam',
  'Cotton',
  'Satin',
  'Denim',
  'Linen',
  'Ribbon',
  'Bobbin',
  'Yarn',
  'Collar',
  'Sleeve',
  'Pocket',
  'Tassel',
  'Fringe',
  'Velvet',
  'Zipper',
];

const TWO_POW_32 = 0x1_0000_0000;
const DIGIT_GROUP = 10_000;

const browserFill: RandomFill = (buffer) => globalThis.crypto.getRandomValues(buffer);

/** An unbiased whole number from 0 up to but not including `count`: numbers from the uneven tail of the range are thrown away. */
function randomBelow(count: number, fill: RandomFill): number {
  const limit = TWO_POW_32 - (TWO_POW_32 % count);
  const buffer = new Uint32Array(new ArrayBuffer(4));
  for (;;) {
    fill(buffer);
    const drawn = buffer[0] ?? 0;
    if (drawn < limit) {
      return drawn % count;
    }
  }
}

function pick(fill: RandomFill): string {
  return TEMPORARY_PASSWORD_WORDS[randomBelow(TEMPORARY_PASSWORD_WORDS.length, fill)] ?? '';
}

function make(fill: RandomFill): string {
  const first = pick(fill);
  const second = pick(fill);
  const digits = String(randomBelow(DIGIT_GROUP, fill)).padStart(4, '0');
  return `${first}-${second}-${digits}`;
}

/**
 * A fresh Word-Word-NNNN value that passes the basic password rule. With `previous` it is never that value, so New
 * Suggestion always changes the field. `fill` is the random source; tests pass their own.
 */
export function newTemporaryPassword(previous?: string, fill: RandomFill = browserFill): string {
  let value = make(fill);
  while (value === previous) {
    value = make(fill);
  }
  return value;
}
