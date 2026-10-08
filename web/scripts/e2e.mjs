// @ts-check
// `npm run e2e`: inert placeholder (plan 02-09 RED). The real script replaces it in the GREEN step.
import { fileURLToPath } from 'node:url';

export const PREFLIGHT_SCRIPT = '';
export const PORT_BUSY_MESSAGE = '';
export const WEB_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));
export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const LOCK_PATH = '';
export const LOCK_TIMEOUT_MS = 0;

/**
 * @typedef {{ readonly kind: 'run', readonly name: string, readonly command: string, readonly args: readonly string[], readonly cwd: string }} RunStep
 * @typedef {{ readonly kind: 'refuse', readonly name: string, readonly message: string, readonly exitCode: number }} RefuseStep
 * @typedef {RunStep | RefuseStep} Step
 */

/**
 * @param {{ portBusy: boolean, extraArgs?: readonly string[], preflightAvailable?: boolean }} _options
 * @returns {readonly Step[]}
 */
export function planSteps(_options) {
  return [];
}

/**
 * @param {readonly Step[]} _steps
 * @param {unknown} _spawn
 * @returns {number}
 */
export function executeSteps(_steps, _spawn) {
  return 0;
}

/**
 * @param {string} _file
 * @param {{ timeoutMs?: number, pollMs?: number, now?: () => number, sleep?: (ms: number) => Promise<void>, onWait?: () => void }} [_options]
 * @returns {Promise<(() => void) | null>}
 */
export function acquireLock(_file, _options) {
  return Promise.resolve(() => undefined);
}

/**
 * @param {string} _file
 * @returns {string}
 */
export function lockTimeoutMessage(_file) {
  return '';
}
