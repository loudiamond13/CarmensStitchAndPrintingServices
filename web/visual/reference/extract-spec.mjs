// @ts-check
// RED stub (plan 02-38 Task 2): the appendix map and an extraction that finds nothing.

/** @type {Readonly<Record<string, string>>} */
export const APPENDIX_FILES = Object.freeze({});

/**
 * @param {string} specText
 * @returns {Map<string, string>}
 */
export function extractAppendices(specText) {
  void specText.length;
  return new Map();
}

/**
 * @param {ReadonlyMap<string, string>} blocks
 * @returns {string}
 */
export function hashAppendices(blocks) {
  void blocks.size;
  return '';
}

/**
 * @param {ReadonlyMap<string, string>} blocks
 * @param {string} pinText
 * @returns {{ matches: boolean, actual: string, pinned: string }}
 */
export function compareWithPin(blocks, pinText) {
  void blocks.size;
  return { matches: false, actual: '', pinned: pinText.trim() };
}

/**
 * @param {{ args: readonly string[], specPath: string, outDir: string, pinPath: string,
 *   report: (line: string) => void }} options
 * @returns {number}
 */
export function runExtract(options) {
  void options.args;
  return 1;
}
