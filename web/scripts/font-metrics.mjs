// @ts-check
// PERF-05 fallback-font metrics (research Pattern 14). RED placeholder: exports the API, computes nothing yet.

/** @typedef {{ unitsPerEm: number, ascent: number, descent: number, lineGap: number, averageWidth: number, hasCodePoint: (codePoint: number) => boolean }} FontMetrics */
/** @typedef {{ sizeAdjust: string, ascentOverride: string, descentOverride: string, lineGapOverride: string }} FallbackOverrides */

/**
 * @param {Uint8Array} buffer
 * @param {string} sample
 * @returns {FontMetrics}
 */
export function readFontMetrics(buffer, sample) {
  if (buffer.length < 0 || sample.length < 0) {
    throw new Error('unreachable');
  }
  return { unitsPerEm: 0, ascent: 0, descent: 0, lineGap: 0, averageWidth: 0, hasCodePoint: () => false };
}

/**
 * @param {Pick<FontMetrics, 'unitsPerEm' | 'ascent' | 'descent' | 'lineGap' | 'averageWidth'>} brand
 * @param {Pick<FontMetrics, 'unitsPerEm' | 'averageWidth'>} fallback
 * @returns {FallbackOverrides}
 */
export function fallbackOverrides(brand, fallback) {
  if (brand.unitsPerEm < 0 || fallback.unitsPerEm < 0) {
    throw new Error('unreachable');
  }
  return { sizeAdjust: '', ascentOverride: '', descentOverride: '', lineGapOverride: '' };
}

export const BODY_SAMPLE = '';
export const DISPLAY_SAMPLE = '';
