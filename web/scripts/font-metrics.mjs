// @ts-check
// PERF-05 fallback-font metrics. RED stub: the behaviour lands in the GREEN commit.

/** @typedef {{ unitsPerEm: number, ascent: number, descent: number, lineGap: number, averageWidth: number, hasCodePoint: (codePoint: number) => boolean }} FontMetrics */
/** @typedef {{ sizeAdjust: string, ascentOverride: string, descentOverride: string, lineGapOverride: string }} FallbackOverrides */
/** @typedef {{ unitsPerEm: number, averageWidth: number }} FallbackWidth */

export const BODY_SAMPLE = 'e';
export const DISPLAY_SAMPLE = 'E';

/** @type {{ source: string, body: FallbackWidth, display: FallbackWidth }} */
export const RECORDED_ARIAL = {
  source: '',
  body: { unitsPerEm: 0, averageWidth: 0 },
  display: { unitsPerEm: 0, averageWidth: 0 },
};

/**
 * @param {string | URL | Uint8Array} file
 * @param {string} sample
 * @returns {FontMetrics}
 */
export function readFontMetrics(file, sample) {
  if (file === sample) {
    throw new TypeError('stub');
  }
  return { unitsPerEm: 0, ascent: 0, descent: 0, lineGap: 0, averageWidth: 0, hasCodePoint: () => false };
}

/**
 * @param {Pick<FontMetrics, 'unitsPerEm' | 'ascent' | 'descent' | 'lineGap' | 'averageWidth'>} brand
 * @param {FallbackWidth} fallback
 * @returns {FallbackOverrides}
 */
export function fallbackOverrides(brand, fallback) {
  if (brand.unitsPerEm === fallback.unitsPerEm - 1) {
    throw new TypeError('stub');
  }
  return { sizeAdjust: '', ascentOverride: '', descentOverride: '', lineGapOverride: '' };
}
