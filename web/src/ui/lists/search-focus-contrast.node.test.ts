// @vitest-environment node
// D-41 R2-03 (owner, 2026-10-13): the list SearchBox shows its own, subtler focus ring: on `:focus-within` its 1px
// border turns `--focus` (no outer ring, no change in size). A focus indicator that is a colour change of the border
// must reach 3:1 against the colours next to it (WCAG 1.4.11 Non-text Contrast, and 2.4.7 Focus Visible): the box's own
// fill `--surface-2` inside, the toolbar card `--surface` outside, and the page `--bg`, in Blush and in Espresso. This
// reads the shipped token values from web/src/styles/base.css, so a later palette change that breaks the ring fails
// here. A node test, because it reads the stylesheet with node:fs.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const baseCss = readFileSync(new URL('../../styles/base.css', import.meta.url), 'utf8');

/** The declarations of the first block whose selector list starts with this text. */
function block(selectorStart: string): string {
  const at = baseCss.indexOf(selectorStart);
  if (at < 0) {
    throw new Error(`base.css has no block for ${selectorStart}`);
  }
  const open = baseCss.indexOf('{', at);
  return baseCss.slice(open + 1, baseCss.indexOf('}', open));
}

const THEMES = {
  Blush: block(':root,\n[data-theme="light"]'),
  Espresso: block('[data-theme="dark"] {'),
} as const;

/** A `#rrggbb` token from a theme block. */
function token(theme: keyof typeof THEMES, name: string): string {
  const value = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6});`).exec(THEMES[theme])?.[1];
  if (value === undefined) {
    throw new Error(`${theme} has no #rrggbb ${name}`);
  }
  return value;
}

/** WCAG 2.x relative luminance of an sRGB `#rrggbb` colour. */
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255);
  const [r = 0, g = 0, b = 0] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio of two colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05);
}

describe('list SearchBox focus border (D-41 R2-03, WCAG 1.4.11)', () => {
  it('reads the colour checker the WCAG way (black on white is 21:1, a colour on itself 1:1)', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrast('#f1e1d7', '#f1e1d7')).toBe(1);
  });

  it.each([
    ['Blush', '--surface-2', 9.01],
    ['Blush', '--surface', 9.88],
    ['Blush', '--bg', 8.95],
    ['Espresso', '--surface-2', 6.8],
    ['Espresso', '--surface', 7.49],
    ['Espresso', '--bg', 7.99],
  ] as const)('%s: --focus is at least 3:1 against %s (about %s:1)', (theme, neighbour, about) => {
    const ratio = contrast(token(theme, '--focus'), token(theme, neighbour));

    expect(ratio).toBeGreaterThanOrEqual(3);
    expect(ratio).toBeCloseTo(about, 1);
  });
});
