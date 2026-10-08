// @vitest-environment node
// PERF-05: the fallback-font metric reader works on the installed brand woff2 files, the override formula is right,
// and the values committed in overrides.css agree with the brand fonts' own vertical metrics. Arial is a local
// Windows font, so its side is checked through the formula, not by reading C:\Windows\Fonts here.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BODY_SAMPLE, DISPLAY_SAMPLE, fallbackOverrides, readFontMetrics } from './font-metrics.mjs';

const fonts = new URL('../node_modules/', import.meta.url);
const archivoLatin = new URL('@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2', fonts);
const archivoLatinExt = new URL('@fontsource-variable/archivo/files/archivo-latin-ext-wght-normal.woff2', fonts);
const barlowLatin = new URL('@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2', fonts);
const barlowLatinExt = new URL('@fontsource/barlow-condensed/files/barlow-condensed-latin-ext-700-normal.woff2', fonts);
const overridesCss = new URL('../src/styles/overrides.css', import.meta.url);

const PESO = 0x20b1;

function metrics(url: URL, sample: string): ReturnType<typeof readFontMetrics> {
  return readFontMetrics(readFileSync(url), sample);
}

/** The four descriptor values of one @font-face block in overrides.css, as fractions. */
function committedFace(family: string): Record<string, number> {
  const css = readFileSync(overridesCss, 'utf8');
  const block = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)]
    .map((match) => match[1] ?? '')
    .find((body) => new RegExp(`font-family:\\s*['"]${family}['"]`).test(body));
  const read = (descriptor: string): number => {
    const found = block === undefined ? null : new RegExp(`${descriptor}:\\s*([\\d.]+)%`).exec(block);
    return found === null ? Number.NaN : Number(found[1]) / 100;
  };
  return {
    sizeAdjust: read('size-adjust'),
    ascent: read('ascent-override'),
    descent: read('descent-override'),
    lineGap: read('line-gap-override'),
  };
}

describe('readFontMetrics', () => {
  it('reads the vertical metrics and a weighted average width from a WOFF2 file', () => {
    const archivo = metrics(archivoLatin, BODY_SAMPLE);
    expect(archivo.unitsPerEm).toBeGreaterThan(0);
    expect(archivo.ascent).toBeGreaterThan(0);
    expect(archivo.descent).toBeLessThan(0);
    expect(archivo.lineGap).toBeGreaterThanOrEqual(0);
    expect(archivo.averageWidth / archivo.unitsPerEm).toBeGreaterThan(0.3);
    expect(archivo.averageWidth / archivo.unitsPerEm).toBeLessThan(0.7);
  });

  it('reads the character map: Barlow Condensed has no ₱ in any subset, Archivo latin-ext has it (Pitfall 17)', () => {
    expect(metrics(barlowLatin, DISPLAY_SAMPLE).hasCodePoint(0x41)).toBe(true);
    expect(metrics(barlowLatin, DISPLAY_SAMPLE).hasCodePoint(PESO)).toBe(false);
    expect(metrics(barlowLatinExt, DISPLAY_SAMPLE).hasCodePoint(PESO)).toBe(false);
    expect(metrics(archivoLatinExt, '₱').hasCodePoint(PESO)).toBe(true);
  });

  it('measures the condensed display face narrower than the body face', () => {
    const archivo = metrics(archivoLatin, DISPLAY_SAMPLE);
    const barlow = metrics(barlowLatin, DISPLAY_SAMPLE);
    expect(barlow.averageWidth / barlow.unitsPerEm).toBeLessThan(archivo.averageWidth / archivo.unitsPerEm);
  });

  it('rejects a buffer that is neither WOFF2 nor TrueType', () => {
    expect(() => readFontMetrics(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), BODY_SAMPLE)).toThrow(/font/i);
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

describe('committed PERF-05 values in overrides.css', () => {
  it.each([
    ['Archivo Fallback', archivoLatin, BODY_SAMPLE],
    ['Barlow Condensed Fallback', barlowLatin, DISPLAY_SAMPLE],
  ])('%s reproduces the brand vertical metrics once size-adjust is applied', (family, url, sample) => {
    const brand = metrics(url, sample);
    const face = committedFace(family);
    expect(face.sizeAdjust).toBeGreaterThan(0.5);
    expect(face.sizeAdjust).toBeLessThan(1.5);
    expect((face.ascent ?? 0) * (face.sizeAdjust ?? 0)).toBeCloseTo(brand.ascent / brand.unitsPerEm, 3);
    expect((face.descent ?? 0) * (face.sizeAdjust ?? 0)).toBeCloseTo(-brand.descent / brand.unitsPerEm, 3);
    expect((face.lineGap ?? 0) * (face.sizeAdjust ?? 0)).toBeCloseTo(brand.lineGap / brand.unitsPerEm, 3);
  });
});
