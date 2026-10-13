// @ts-check
// Spec appendix extraction for the look-equality proof (D-33, WEB-02, threat T-02-36). The parity reference app (plan
// 02-13) is built from the approved design exactly as CSPS-UI-SPEC.md states it: App. A, A.2, A.3, B and C (the CSS)
// and App. D.1, D.3, D.4 and D.5 (the frozen components). This script copies the first fenced block under each of those
// headings, byte for byte after CRLF -> LF, into the git-ignored web/visual/.reference-src/.
//
// spec-appendix.sha256 pins two SHA-256 values of the nine blocks in APPENDIX_FILES order: line 1 the blocks
// concatenated (the owner-reviewed pin of 02-38), line 2 `framed <hash>`, each block after its file name and byte length,
// so content moved from one appendix to the next is caught too (TOOL-WR-03). Both must match. When the
// owner edits an appendix, the hash changes and this script exits 1 without writing anything, so the yardstick never
// moves silently. After reviewing the edit, re-pin by hand:
//
//   node web/visual/reference/extract-spec.mjs --repin
//
// `--repin` is a deliberate manual step. No script or CI job may pass it.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** The approved spec, resolved from the repository root relative to this file (never the working directory). */
export const SPEC_PATH = path.resolve(here, '../../../CSPS-UI-SPEC.md');
/** The generated, git-ignored frozen copy. */
export const OUTPUT_DIR = path.resolve(here, '../.reference-src');
/** The committed pin. */
export const PIN_PATH = path.join(here, 'spec-appendix.sha256');

/**
 * Appendix heading (the whole line) -> output path under .reference-src. The order is the hash order.
 * @type {Readonly<Record<string, string>>}
 */
export const APPENDIX_FILES = Object.freeze({
  '## Appendix A — src/styles/tokens.css': 'styles/tokens.css',
  '## Appendix A.2 — src/styles/globals.css': 'styles/globals.css',
  '## Appendix A.3 — src/styles/compat.css': 'styles/compat.css',
  '## Appendix B — src/styles/components.css': 'styles/components.css',
  '## Appendix C — src/styles/screens.css': 'styles/screens.css',
  '## Appendix D.1 — src/lib/csps.ts': 'lib/csps.ts',
  '## Appendix D.3 — src/ui/index.tsx': 'ui/index.tsx',
  '## Appendix D.4 — src/ui/mark.ts': 'ui/mark.ts',
  '## Appendix D.5 — src/ui/icons.ts': 'ui/icons.ts',
});

const FENCE = '```';

/**
 * The text of the first fenced block after `start`, as LF lines joined with a trailing newline. Throws when a heading
 * (a line starting with `#`) or the end comes before an opening fence, or when the block is never closed.
 * @param {readonly string[]} lines
 * @param {number} start index of the heading line
 * @param {string} heading
 * @returns {string}
 */
function firstBlockAfter(lines, start, heading) {
  let open = -1;
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (line.startsWith(FENCE)) {
      open = i;
      break;
    }
    if (line.startsWith('#')) {
      break;
    }
  }
  if (open === -1) {
    throw new Error(`CSPS-UI-SPEC.md: no fenced code block under "${heading}" before the next heading.`);
  }
  const close = lines.indexOf(FENCE, open + 1);
  if (close === -1) {
    throw new Error(`CSPS-UI-SPEC.md: the code block under "${heading}" is never closed.`);
  }
  return lines
    .slice(open + 1, close)
    .map((line) => `${line}\n`)
    .join('');
}

/**
 * Extracts the nine appendix blocks from the spec text. Line endings are normalized to LF first, so a CRLF checkout
 * extracts the same bytes. Returns output path -> block text, in APPENDIX_FILES order.
 * @param {string} specText
 * @returns {Map<string, string>}
 */
export function extractAppendices(specText) {
  const lines = specText.replace(/\r\n/g, '\n').split('\n');
  /** @type {Map<string, string>} */
  const blocks = new Map();
  for (const [heading, file] of Object.entries(APPENDIX_FILES)) {
    const at = lines.indexOf(heading);
    if (at === -1) {
      throw new Error(`CSPS-UI-SPEC.md: the heading "${heading}" was not found.`);
    }
    if (lines.includes(heading, at + 1)) {
      throw new Error(`CSPS-UI-SPEC.md: the heading "${heading}" appears more than once.`);
    }
    blocks.set(file, firstBlockAfter(lines, at, heading));
  }
  return blocks;
}

/**
 * Lowercase hex SHA-256 of the blocks concatenated in APPENDIX_FILES order (UTF-8).
 * @param {ReadonlyMap<string, string>} blocks
 * @returns {string}
 */
export function hashAppendices(blocks) {
  const hash = createHash('sha256');
  for (const file of Object.values(APPENDIX_FILES)) {
    hash.update(blocks.get(file) ?? '', 'utf8');
  }
  return hash.digest('hex');
}

/**
 * Lowercase hex SHA-256 of the blocks in APPENDIX_FILES order, each preceded by its file name and UTF-8 byte length
 * (`<file>\0<length>\0<text>`). Unlike hashAppendices, a line moved from the end of one appendix to the start of the
 * next changes it (TOOL-WR-03).
 * @param {ReadonlyMap<string, string>} blocks
 * @returns {string}
 */
export function framedHashAppendices(blocks) {
  const hash = createHash('sha256');
  for (const file of Object.values(APPENDIX_FILES)) {
    const text = blocks.get(file) ?? '';
    hash.update(`${file}\0${String(Buffer.byteLength(text, 'utf8'))}\0`, 'utf8');
    hash.update(text, 'utf8');
  }
  return hash.digest('hex');
}

/**
 * The pin file text: line 1 the owner-reviewed unframed hash, line 2 `framed <hash>`. Both must match.
 * @param {ReadonlyMap<string, string>} blocks
 * @returns {string}
 */
export function pinTextFor(blocks) {
  return `${hashAppendices(blocks)}\nframed ${framedHashAppendices(blocks)}\n`;
}

/**
 * The two pin lines on one line, for messages.
 * @param {string} pin
 * @returns {string}
 */
function oneLine(pin) {
  return pin.split('\n').join(' / ');
}

/**
 * @param {ReadonlyMap<string, string>} blocks
 * @param {string} pinText the contents of spec-appendix.sha256
 * @returns {{ matches: boolean, actual: string, pinned: string }}
 */
export function compareWithPin(blocks, pinText) {
  const actual = pinTextFor(blocks).trim();
  const pinned = pinText.replace(/\r\n/g, '\n').trim();
  return { matches: actual === pinned, actual, pinned };
}

/**
 * @param {string} outDir
 * @param {ReadonlyMap<string, string>} blocks
 */
function writeBlocks(outDir, blocks) {
  for (const [file, text] of blocks) {
    const target = path.join(outDir, file);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, text, 'utf8');
  }
}

/**
 * The command: extract, check the pin, then write. Returns the exit code: 0 done, 1 the appendices differ from the
 * pin (nothing written), 2 bad arguments.
 * @param {{ args: readonly string[], specPath: string, outDir: string, pinPath: string,
 *   report: (line: string) => void }} options
 * @returns {number}
 */
export function runExtract({ args, specPath, outDir, pinPath, report }) {
  const unknown = args.filter((arg) => arg !== '--repin');
  if (unknown.length > 0) {
    report(`extract-spec: unknown argument ${unknown.join(' ')}. The only option is --repin.`);
    return 2;
  }
  const blocks = extractAppendices(readFileSync(specPath, 'utf8'));
  if (args.includes('--repin')) {
    const pin = pinTextFor(blocks);
    writeFileSync(pinPath, pin, 'utf8');
    writeBlocks(outDir, blocks);
    report(
      `extract-spec: re-pinned the spec appendices to ${oneLine(pin.trim())}. Commit spec-appendix.sha256 with the spec edit.`,
    );
    return 0;
  }
  const result = compareWithPin(blocks, readFileSync(pinPath, 'utf8'));
  if (!result.matches) {
    report(
      'extract-spec: the approved appendices in CSPS-UI-SPEC.md have changed since they were pinned ' +
        `(pinned ${oneLine(result.pinned)}, now ${oneLine(result.actual)}). Nothing was written. Review the spec edit with the ` +
        'owner, then run `node web/visual/reference/extract-spec.mjs --repin` by hand and commit the new pin.',
    );
    return 1;
  }
  writeBlocks(outDir, blocks);
  report(`extract-spec: wrote ${String(blocks.size)} appendix files to ${outDir} (pin ${oneLine(result.actual)}).`);
  return 0;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = runExtract({
    args: process.argv.slice(2),
    specPath: SPEC_PATH,
    outDir: OUTPUT_DIR,
    pinPath: PIN_PATH,
    report: (line) => {
      process.stderr.write(`${line}\n`);
    },
  });
}
