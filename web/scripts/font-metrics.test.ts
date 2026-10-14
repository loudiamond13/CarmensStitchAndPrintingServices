// @vitest-environment node
// PERF-05 metric-matched fallbacks (research Pattern 14, Pitfall 17). The metric reader works on the installed brand
// woff2 files, the override formula is right, and the values committed in src/ui/base.css are the ones the brand
// fonts and the recorded Arial metrics produce, to within 0.01 percentage points. Arial is a system font, so its side
// comes from the constants recorded in font-metrics.mjs: this test never reads a system font and runs the same on
// Windows and ubuntu.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BODY_SAMPLE, DISPLAY_SAMPLE, RECORDED_ARIAL, fallbackOverrides, readFontMetrics } from './font-metrics.mjs';

const fonts = new URL('../node_modules/', import.meta.url);
const archivoLatin = new URL('@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2', fonts);
const archivoLatinExt = new URL('@fontsource-variable/archivo/files/archivo-latin-ext-wght-normal.woff2', fonts);
const barlowLatin = new URL('@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2', fonts);
const barlowLatinExt = new URL('@fontsource/barlow-condensed/files/barlow-condensed-latin-ext-700-normal.woff2', fonts);
const baseCss = readFileSync(new URL('../src/ui/base.css', import.meta.url), 'utf8');
const appCss = readFileSync(new URL('../src/ui/app.css', import.meta.url), 'utf8');

const PESO = 0x20b1;

/** The descriptors of the @font-face block in base.css for one family (quotes normalised to double). */
function fontFace(family: string): Map<string, string> {
  const body = [...baseCss.matchAll(/@font-face\s*\{([^}]*)\}/g)]
    .map((match) => (match[1] ?? '').replaceAll("'", '"'))
    .find((block) => block.includes(`font-family: "${family}";`));
  const descriptors = new Map<string, string>();
  for (const declaration of (body ?? '').split(';')) {
    const colon = declaration.indexOf(':');
    if (colon > 0) {
      descriptors.set(declaration.slice(0, colon).trim(), declaration.slice(colon + 1).trim());
    }
  }
  return descriptors;
}

/** A percentage descriptor as a number of percentage points, or NaN when it is missing. */
function percentOf(face: Map<string, string>, descriptor: string): number {
  const match = /^(-?[\d.]+)%$/.exec(face.get(descriptor) ?? '');
  return match === null ? Number.NaN : Number(match[1]);
}

/** Whether a CSS unicode-range value covers a code point. */
function covers(range: string, codePoint: number): boolean {
  return range.split(',').some((part) => {
    const [start = '', end = start] = part.trim().replace(/^U\+/i, '').split('-');
    return codePoint >= parseInt(start, 16) && codePoint <= parseInt(end, 16);
  });
}

/** A custom property declared in base.css, quotes normalised to double. */
function token(name: string): string {
  return (new RegExp(`${name}:\\s*([^;]+);`).exec(baseCss)?.[1] ?? '').replaceAll("'", '"').trim();
}

describe('readFontMetrics', () => {
  it('reads unitsPerEm and the vertical metrics from the Archivo Variable latin woff2', () => {
    const archivo = readFontMetrics(archivoLatin, BODY_SAMPLE);
    expect([archivo.unitsPerEm, archivo.ascent, archivo.descent, archivo.lineGap]).toEqual([1000, 878, -210, 0]);
  });

  it('reads unitsPerEm and the vertical metrics from the Barlow Condensed 700 latin woff2', () => {
    const barlow = readFontMetrics(barlowLatin, DISPLAY_SAMPLE);
    expect([barlow.unitsPerEm, barlow.ascent, barlow.descent, barlow.lineGap]).toEqual([1000, 1000, -200, 0]);
  });

  it('measures a letter-frequency weighted average advance width', () => {
    expect(readFontMetrics(archivoLatin, BODY_SAMPLE).averageWidth).toBeCloseTo(448.798, 3);
    expect(readFontMetrics(barlowLatin, DISPLAY_SAMPLE).averageWidth).toBeCloseTo(410.0229, 3);
  });

  it('accepts a path string and raw bytes as well as a URL', () => {
    const fromUrl = readFontMetrics(archivoLatin, BODY_SAMPLE);
    const fromBytes = readFontMetrics(readFileSync(archivoLatin), BODY_SAMPLE);
    const fromPath = readFontMetrics(fileURLToPath(archivoLatin), BODY_SAMPLE);
    expect(fromBytes.averageWidth).toBe(fromUrl.averageWidth);
    expect(fromPath.averageWidth).toBe(fromUrl.averageWidth);
  });

  it('reads the character map: Barlow Condensed has no ₱ in any subset, Archivo latin-ext has it (Pitfall 17)', () => {
    expect(readFontMetrics(barlowLatin, DISPLAY_SAMPLE).hasCodePoint(0x41)).toBe(true);
    expect(readFontMetrics(barlowLatin, DISPLAY_SAMPLE).hasCodePoint(PESO)).toBe(false);
    expect(readFontMetrics(barlowLatinExt, DISPLAY_SAMPLE).hasCodePoint(PESO)).toBe(false);
    expect(readFontMetrics(archivoLatinExt, '₱').hasCodePoint(PESO)).toBe(true);
  });

  it('rejects bytes that are neither WOFF2 nor TrueType/OpenType', () => {
    expect(() => readFontMetrics(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), BODY_SAMPLE)).toThrow(
      /not a valid font/i,
    );
    expect(() => readFontMetrics(new Uint8Array([1, 2]), BODY_SAMPLE)).toThrow(/not a valid font/i);
  });
});

describe('fallbackOverrides', () => {
  it('scales the fallback to the brand width and divides the brand metrics by that scale', () => {
    const result = fallbackOverrides(
      { unitsPerEm: 1000, ascent: 900, descent: -250, lineGap: 0, averageWidth: 500 },
      { unitsPerEm: 2048, averageWidth: 1280 },
    );
    expect(result).toEqual({
      sizeAdjust: '80.00%',
      ascentOverride: '112.50%',
      descentOverride: '31.25%',
      lineGapOverride: '0.00%',
    });
  });
});

describe('RECORDED_ARIAL', () => {
  it('records Arial at 2048 units per em, with its source, for the body and display samples', () => {
    expect(RECORDED_ARIAL.source).toMatch(/arial\.ttf/i);
    expect(RECORDED_ARIAL.body.unitsPerEm).toBe(2048);
    expect(RECORDED_ARIAL.display.unitsPerEm).toBe(2048);
    // Uppercase letters are wider than lowercase ones in Arial.
    expect(RECORDED_ARIAL.display.averageWidth).toBeGreaterThan(RECORDED_ARIAL.body.averageWidth);
  });
});

describe('committed PERF-05 fallback faces in base.css', () => {
  const faces = [
    { family: 'Archivo Fallback', brand: archivoLatin, sample: BODY_SAMPLE, arial: RECORDED_ARIAL.body },
    { family: 'Barlow Condensed Fallback', brand: barlowLatin, sample: DISPLAY_SAMPLE, arial: RECORDED_ARIAL.display },
  ] as const;

  it.each(faces)('$family matches the recomputed overrides to within 0.01 percentage points', (face) => {
    const expected = fallbackOverrides(readFontMetrics(face.brand, face.sample), face.arial);
    const committed = fontFace(face.family);
    const pairs = [
      ['size-adjust', expected.sizeAdjust],
      ['ascent-override', expected.ascentOverride],
      ['descent-override', expected.descentOverride],
      ['line-gap-override', expected.lineGapOverride],
    ] as const;
    for (const [descriptor, value] of pairs) {
      const drift = Math.abs(percentOf(committed, descriptor) - Number.parseFloat(value));
      expect(
        drift,
        `${face.family} ${descriptor}: committed ${String(committed.get(descriptor))}, measured ${value}`,
      ).toBeLessThanOrEqual(0.01 + 1e-9);
    }
  });

  it('carries the exact UI-SPEC values', () => {
    const archivo = fontFace('Archivo Fallback');
    const barlow = fontFace('Barlow Condensed Fallback');
    expect(Object.fromEntries(archivo)).toEqual({
      'font-family': '"Archivo Fallback"',
      src: 'local("Arial")',
      'size-adjust': '101.85%',
      'ascent-override': '86.21%',
      'descent-override': '20.62%',
      'line-gap-override': '0%',
    });
    expect(Object.fromEntries(barlow)).toEqual({
      'font-family': '"Barlow Condensed Fallback"',
      src: 'local("Arial Narrow"), local("Arial")',
      'unicode-range': 'U+0000-20B0, U+20B2-10FFFF',
      'size-adjust': '68.92%',
      'ascent-override': '145.1%',
      'descent-override': '29.02%',
      'line-gap-override': '0%',
    });
  });

  it('keeps ₱ (U+20B1) out of the Barlow fallback, so it falls through to Archivo Variable (Pitfall 17)', () => {
    const range = fontFace('Barlow Condensed Fallback').get('unicode-range') ?? '';
    expect(covers(range, PESO)).toBe(false);
    expect(covers(range, 0x20b0)).toBe(true);
    expect(covers(range, 0x20b2)).toBe(true);
    expect(covers(range, 0x41)).toBe(true);
  });

  it('puts each fallback face right after its brand family in the font-stack tokens', () => {
    expect(token('--font-display')).toBe(
      '"Barlow Condensed", "Barlow Condensed Fallback", "Archivo Variable", "Arial Narrow", sans-serif',
    );
    expect(token('--font-sans')).toBe(
      '"Archivo Variable", "Archivo Fallback", system-ui, -apple-system, "Segoe UI", sans-serif',
    );
  });

  it('has the font-sans and font-display utilities read the tokens, so the fallbacks apply everywhere', () => {
    expect(appCss).toMatch(/--font-sans:\s*var\(--font-sans\);/);
    expect(appCss).toMatch(/--font-display:\s*var\(--font-display\);/);
  });
});
