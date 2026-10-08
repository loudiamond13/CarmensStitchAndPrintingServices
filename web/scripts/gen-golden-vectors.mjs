// @ts-check
// Golden-vector generator (WEB-07, D-09). Inert until implemented.

/**
 * @typedef {import('./golden-math.mjs').VectorInput & { id: string, category: string, note: string,
 *   expected: import('./golden-math.mjs').VectorExpected }} VectorCase
 */

export const VECTOR_FILE = new URL('../../tests/fixtures/order-math-golden-vectors.json', import.meta.url);

/** @type {readonly string[]} */
export const CATEGORIES = [];

/** @returns {VectorCase[]} */
export function buildCases() {
  return [];
}

/**
 * @param {VectorCase[]} cases
 * @returns {string}
 */
export function renderVectorFile(cases) {
  return String(cases.length);
}

/**
 * @param {string} actual
 * @param {string} expected
 * @returns {string | undefined}
 */
export function firstDifference(actual, expected) {
  return actual === expected ? undefined : 'different';
}
