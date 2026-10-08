// @ts-check
// `npm run parity` (WEB-02, D-33). RED placeholder: the plan is empty and nothing runs yet.
import { fileURLToPath } from 'node:url';

export const PREFLIGHT_SCRIPT = '';
export const WEB_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));
export const REPO_ROOT = '';
export const PARITY_LOCK_PATH = '';

/**
 * @typedef {{ readonly name: 'preflight' | 'extract' | 'build' | 'playwright', readonly command: string, readonly args: readonly string[], readonly cwd: string }} Step
 * @typedef {(command: string, args: readonly string[], options: { cwd: string, stdio: 'inherit' }) => { status: number | null }} Spawner
 */

/**
 * @param {{ extraArgs?: readonly string[], preflightAvailable?: boolean }} options
 * @returns {readonly Step[]}
 */
export function planSteps(options) {
  return options.extraArgs === undefined ? [] : [];
}

/**
 * @param {readonly Step[]} steps
 * @param {Spawner} [spawn]
 * @returns {number}
 */
export function executeSteps(steps, spawn) {
  return steps.length === 0 || spawn === undefined ? 0 : 0;
}
