// @ts-check
// PERF-02 Lighthouse thresholds. Not implemented yet (TDD RED stub).

export const THRESHOLDS = Object.freeze({
  minCategoryScore: 0,
  /** @type {readonly string[]} */
  categories: Object.freeze([]),
  /** @type {readonly { readonly id: string, readonly label: string, readonly below: number, readonly unit: string }[]} */
  metrics: Object.freeze([]),
});

/**
 * @param {unknown} _report
 * @returns {{ passed: boolean, failures: string[], lines: string[] }}
 */
export function assertReport(_report) {
  return { passed: true, failures: [], lines: [] };
}
