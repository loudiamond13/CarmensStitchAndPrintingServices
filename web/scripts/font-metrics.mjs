// @ts-check
// PERF-05 fallback-font metrics (research Pattern 14). A one-off, local-only script (not run in CI):
//   node web/scripts/font-metrics.mjs
// It reads the installed brand woff2 files and the local Windows Arial (Arial Narrow when installed) and prints the
// size-adjust / ascent-override / descent-override / line-gap-override values for the two fallback faces in
// src/styles/overrides.css. Paste the printed values there; scripts/font-metrics.test.ts checks them against the
// brand fonts on every run.
//
// Method (the one capsize and fontaine use):
//   size-adjust      = (brand average width / brand unitsPerEm) / (fallback average width / fallback unitsPerEm)
//   ascent-override  = brand ascent  / (brand unitsPerEm * size-adjust), and the same for descent and line gap,
// because size-adjust also scales the override descriptors (CSS Fonts 5). Average widths are weighted by English
// letter frequency: lowercase for the body face, uppercase for the display face (spec headlines are UPPERCASE).
// Vertical metrics are the hhea values, or the OS/2 typo values when the font sets USE_TYPO_METRICS.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { brotliDecompressSync } from 'node:zlib';

/** @typedef {{ unitsPerEm: number, ascent: number, descent: number, lineGap: number, averageWidth: number, hasCodePoint: (codePoint: number) => boolean }} FontMetrics */
/** @typedef {{ sizeAdjust: string, ascentOverride: string, descentOverride: string, lineGapOverride: string }} FallbackOverrides */

// English letter frequencies (per cent), with the space as the most frequent character in running text.
const FREQUENCIES = /** @type {const} */ ({
  ' ': 18.3,
  e: 10.2,
  t: 7.5,
  a: 6.7,
  o: 6.2,
  i: 5.8,
  n: 5.7,
  s: 5.3,
  h: 5.0,
  r: 5.0,
  d: 3.5,
  l: 3.3,
  c: 2.3,
  u: 2.3,
  m: 2.0,
  w: 1.9,
  f: 1.8,
  g: 1.6,
  y: 1.6,
  p: 1.5,
  b: 1.2,
  v: 0.8,
  k: 0.6,
  j: 0.1,
  x: 0.1,
  q: 0.1,
  z: 0.1,
});

/** Weighted sample for body text: lowercase running text. Each character appears in proportion to its frequency. */
export const BODY_SAMPLE = Object.entries(FREQUENCIES)
  .map(([char, weight]) => char.repeat(Math.round(weight * 10)))
  .join('');

/** Weighted sample for display text: the same frequencies, uppercase. */
export const DISPLAY_SAMPLE = BODY_SAMPLE.toUpperCase();

// WOFF2 known-table tags, in the order of the WOFF2 specification (table 1). Only the lengths matter for offsets;
// the tags name the tables this script reads.
// prettier-ignore
const WOFF2_TAGS = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ',
  'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS',
  'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc',
  'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop',
  'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill',
];

/** @typedef {{ data: DataView, transformed: boolean }} Table */

/**
 * @param {Uint8Array} bytes
 * @returns {DataView}
 */
function viewOf(bytes) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

/**
 * @param {DataView} view
 * @param {number} offset
 * @returns {string}
 */
function tagAt(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3),
  );
}

/**
 * The WOFF2 table directory and decompressed table data (single fonts only, no collections).
 * @param {Uint8Array} bytes
 * @returns {Map<string, Table>}
 */
function readWoff2Tables(bytes) {
  const view = viewOf(bytes);
  const numTables = view.getUint16(12);
  const totalCompressedSize = view.getUint32(20);
  let offset = 48;
  const readBase128 = () => {
    let result = 0;
    for (let i = 0; i < 5; i += 1) {
      const byte = view.getUint8(offset);
      offset += 1;
      result = result * 128 + (byte & 0x7f);
      if ((byte & 0x80) === 0) {
        return result;
      }
    }
    throw new Error('Not a valid font: bad UIntBase128 in the WOFF2 directory.');
  };
  /** @type {{ tag: string, length: number, transformed: boolean }[]} */
  const entries = [];
  for (let i = 0; i < numTables; i += 1) {
    const flags = view.getUint8(offset);
    offset += 1;
    const tagIndex = flags & 0x3f;
    let tag = WOFF2_TAGS[tagIndex] ?? '';
    if (tagIndex === 63) {
      tag = tagAt(view, offset);
      offset += 4;
    }
    const version = (flags >> 6) & 0x03;
    const origLength = readBase128();
    const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
    const length = transformed ? readBase128() : origLength;
    entries.push({ tag, length, transformed });
  }
  const stream = brotliDecompressSync(bytes.subarray(offset, offset + totalCompressedSize));
  /** @type {Map<string, Table>} */
  const tables = new Map();
  let position = 0;
  for (const entry of entries) {
    tables.set(entry.tag, {
      data: viewOf(stream.subarray(position, position + entry.length)),
      transformed: entry.transformed,
    });
    position += entry.length;
  }
  if (position !== stream.byteLength) {
    throw new Error(`Not a valid font: WOFF2 table lengths (${String(position)}) do not fill the stream.`);
  }
  return tables;
}

/**
 * @param {Uint8Array} bytes
 * @returns {Map<string, Table>}
 */
function readSfntTables(bytes) {
  const view = viewOf(bytes);
  const numTables = view.getUint16(4);
  /** @type {Map<string, Table>} */
  const tables = new Map();
  for (let i = 0; i < numTables; i += 1) {
    const record = 12 + i * 16;
    const start = view.getUint32(record + 8);
    tables.set(tagAt(view, record), {
      data: viewOf(bytes.subarray(start, start + view.getUint32(record + 12))),
      transformed: false,
    });
  }
  return tables;
}

/**
 * @param {Map<string, Table>} tables
 * @param {string} tag
 * @returns {Table}
 */
function table(tables, tag) {
  const found = tables.get(tag);
  if (found === undefined) {
    throw new Error(`Not a valid font: the ${tag} table is missing.`);
  }
  return found;
}

/**
 * Maps code points to glyph ids from a cmap format 4 or format 12 subtable (Windows Unicode preferred).
 * @param {DataView} cmap
 * @returns {(codePoint: number) => number}
 */
function readCmap(cmap) {
  const count = cmap.getUint16(2);
  /** @type {{ format: number, offset: number, rank: number } | null} */
  let best = null;
  for (let i = 0; i < count; i += 1) {
    const platform = cmap.getUint16(4 + i * 8);
    const encoding = cmap.getUint16(6 + i * 8);
    const offset = cmap.getUint32(8 + i * 8);
    const format = cmap.getUint16(offset);
    const rank =
      platform === 3 && encoding === 10 && format === 12
        ? 3
        : platform === 0 && format === 12
          ? 2
          : format === 4
            ? 1
            : 0;
    if (rank > 0 && (best === null || rank > best.rank)) {
      best = { format, offset, rank };
    }
  }
  if (best === null) {
    throw new Error('Not a valid font: no Unicode cmap subtable.');
  }
  const { format, offset } = best;
  if (format === 12) {
    const groups = cmap.getUint32(offset + 12);
    return (codePoint) => {
      for (let g = 0; g < groups; g += 1) {
        const group = offset + 16 + g * 12;
        const start = cmap.getUint32(group);
        if (codePoint >= start && codePoint <= cmap.getUint32(group + 4)) {
          return cmap.getUint32(group + 8) + (codePoint - start);
        }
      }
      return 0;
    };
  }
  const segments = cmap.getUint16(offset + 6) / 2;
  const ends = offset + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const rangeOffsets = deltas + segments * 2;
  return (codePoint) => {
    for (let s = 0; s < segments; s += 1) {
      if (codePoint > cmap.getUint16(ends + s * 2)) {
        continue;
      }
      const start = cmap.getUint16(starts + s * 2);
      if (codePoint < start) {
        return 0;
      }
      const delta = cmap.getInt16(deltas + s * 2);
      const rangeOffset = cmap.getUint16(rangeOffsets + s * 2);
      if (rangeOffset === 0) {
        return (codePoint + delta) & 0xffff;
      }
      const glyph = cmap.getUint16(rangeOffsets + s * 2 + rangeOffset + (codePoint - start) * 2);
      return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
    }
    return 0;
  };
}

/**
 * Reads the metrics the fallback overrides need from a WOFF2 or TrueType/OpenType font file.
 * @param {Uint8Array} buffer
 * @param {string} sample weighted text whose average advance width is measured
 * @returns {FontMetrics}
 */
export function readFontMetrics(buffer, sample) {
  if (buffer.byteLength < 12) {
    throw new Error('Not a valid font: the file is too short.');
  }
  const signature = tagAt(viewOf(buffer), 0);
  /** @type {Map<string, Table>} */
  let tables;
  if (signature === 'wOF2') {
    tables = readWoff2Tables(buffer);
  } else if (signature === '\u0000\u0001\u0000\u0000' || signature === 'OTTO' || signature === 'true') {
    tables = readSfntTables(buffer);
  } else {
    throw new Error('Not a valid font: expected a WOFF2 or TrueType/OpenType file.');
  }
  const unitsPerEm = table(tables, 'head').data.getUint16(18);
  const hhea = table(tables, 'hhea').data;
  const os2 = table(tables, 'OS/2').data;
  const useTypoMetrics = (os2.getUint16(62) & 0x80) !== 0;
  const ascent = useTypoMetrics ? os2.getInt16(68) : hhea.getInt16(4);
  const descent = useTypoMetrics ? os2.getInt16(70) : hhea.getInt16(6);
  const lineGap = useTypoMetrics ? os2.getInt16(72) : hhea.getInt16(8);
  const numberOfHMetrics = hhea.getUint16(34);
  const hmtx = table(tables, 'hmtx');
  // A transformed WOFF2 hmtx starts with a flags byte, then the advance widths (uint16 each); a plain hmtx holds
  // (advance, left side bearing) pairs.
  const advance = (/** @type {number} */ glyph) => {
    const index = Math.min(glyph, numberOfHMetrics - 1);
    return hmtx.transformed ? hmtx.data.getUint16(1 + index * 2) : hmtx.data.getUint16(index * 4);
  };
  const glyphOf = readCmap(table(tables, 'cmap').data);
  let total = 0;
  let counted = 0;
  for (const char of sample) {
    const glyph = glyphOf(char.codePointAt(0) ?? 0);
    if (glyph !== 0) {
      total += advance(glyph);
      counted += 1;
    }
  }
  return {
    unitsPerEm,
    ascent,
    descent,
    lineGap,
    averageWidth: counted === 0 ? 0 : total / counted,
    hasCodePoint: (codePoint) => glyphOf(codePoint) !== 0,
  };
}

/**
 * @param {number} fraction
 * @returns {string}
 */
function percent(fraction) {
  return `${(fraction * 100).toFixed(2)}%`;
}

/**
 * The @font-face descriptors that make a local fallback take the brand font's width and line box.
 * @param {Pick<FontMetrics, 'unitsPerEm' | 'ascent' | 'descent' | 'lineGap' | 'averageWidth'>} brand
 * @param {Pick<FontMetrics, 'unitsPerEm' | 'averageWidth'>} fallback
 * @returns {FallbackOverrides}
 */
export function fallbackOverrides(brand, fallback) {
  const sizeAdjust = brand.averageWidth / brand.unitsPerEm / (fallback.averageWidth / fallback.unitsPerEm);
  const scaled = (/** @type {number} */ units) => percent(units / (brand.unitsPerEm * sizeAdjust));
  return {
    sizeAdjust: percent(sizeAdjust),
    ascentOverride: scaled(brand.ascent),
    descentOverride: scaled(Math.abs(brand.descent)),
    lineGapOverride: scaled(brand.lineGap),
  };
}

function main() {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const modules = resolve(webRoot, 'node_modules');
  const fontsDir = 'C:\\Windows\\Fonts';
  const arial = resolve(fontsDir, 'arial.ttf');
  const arialNarrow = resolve(fontsDir, 'ARIALN.TTF');
  if (!existsSync(arial)) {
    throw new Error(`Arial not found at ${arial}. Run this script on Windows.`);
  }
  const displayFallback = existsSync(arialNarrow) ? arialNarrow : arial;
  const faces = [
    {
      family: 'Archivo Fallback',
      brand: resolve(modules, '@fontsource-variable/archivo/files/archivo-latin-wght-normal.woff2'),
      fallback: arial,
      sample: BODY_SAMPLE,
    },
    {
      family: 'Barlow Condensed Fallback',
      brand: resolve(modules, '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2'),
      fallback: displayFallback,
      sample: DISPLAY_SAMPLE,
    },
  ];
  for (const face of faces) {
    const brand = readFontMetrics(readFileSync(face.brand), face.sample);
    const fallback = readFontMetrics(readFileSync(face.fallback), face.sample);
    const result = fallbackOverrides(brand, fallback);
    console.log(`${face.family} (measured against ${face.fallback})`);
    console.log(`  size-adjust: ${result.sizeAdjust};`);
    console.log(`  ascent-override: ${result.ascentOverride};`);
    console.log(`  descent-override: ${result.descentOverride};`);
    console.log(`  line-gap-override: ${result.lineGapOverride};`);
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
