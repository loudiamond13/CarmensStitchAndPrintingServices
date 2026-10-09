// @ts-check
// `npm run lighthouse` (PERF-02). Not implemented yet (TDD RED stub).

export const SERVER_PROJECT = '';
export const WWWROOT = '';
export const HEALTH_URL = '';
export const LIGHTHOUSE_URL = '';
export const REPORT_PATH = '';

/**
 * @param {{ portBusy: boolean, preflightAvailable?: boolean, chromePath?: string }} _options
 * @returns {readonly any[]}
 */
export function planSteps(_options) {
  return [];
}

/**
 * @param {readonly any[]} _steps
 * @param {any} _deps
 * @returns {Promise<number>}
 */
export function executeSteps(_steps, _deps) {
  return Promise.resolve(0);
}
