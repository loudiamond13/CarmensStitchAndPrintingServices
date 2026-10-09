// @ts-check
// `npm run review` (D-23, plan 02-36): RED stub. The exports exist so the tests load and fail on their assertions.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {'light' | 'dark'} Theme
 * @typedef {{ readonly path: string, readonly title: string, readonly h1: string, readonly themes: readonly Theme[] }} ReviewTarget
 * @typedef {{ readonly path: string, readonly title: string, readonly h1: string, readonly theme: Theme, readonly width: number, readonly file: string }} Shot
 * @typedef {{ readonly kind: 'refuse', readonly name: 'output-not-ignored' | 'port-busy', readonly message: string, readonly exitCode: 1 }} RefuseStep
 * @typedef {{ readonly kind: 'run', readonly name: 'preflight' | 'seed' | 'build', readonly command: string, readonly args: readonly string[], readonly cwd: string }} RunStep
 * @typedef {{ readonly kind: 'host', readonly name: 'host', readonly command: string, readonly args: readonly string[], readonly cwd: string, readonly env: Readonly<Record<string, string>>, readonly healthUrl: string }} HostStep
 * @typedef {{ readonly kind: 'capture', readonly name: 'capture', readonly origin: string, readonly shots: readonly Shot[] }} CaptureStep
 * @typedef {{ readonly kind: 'report', readonly name: 'report', readonly file: string }} ReportStep
 * @typedef {RefuseStep | RunStep | HostStep | CaptureStep | ReportStep} Step
 */

export const REVIEW_WIDTHS = Object.freeze(/** @type {number[]} */ ([]));
export const REVIEW_TARGETS = Object.freeze(/** @type {ReviewTarget[]} */ ([]));
export const OUTPUT_DIR = fileURLToPath(new URL('../../artifacts/owner-review', import.meta.url));
export const E2E_DIST = path.join(fileURLToPath(new URL('..', import.meta.url)), '.e2e-dist');
export const OUTPUT_NOT_IGNORED_MESSAGE = '';

/** @returns {Shot[]} */
export function planShots() {
  return [];
}

/**
 * @param {{ outputIgnored: boolean, portBusy?: boolean, preflightAvailable?: boolean, bundleMtime?: number | null, newestSourceMtime?: number }} options
 * @returns {readonly Step[]}
 */
export function planReview(options) {
  return options.outputIgnored ? [] : [];
}

/**
 * @param {string} file
 * @returns {string}
 */
export function assertWritable(file) {
  return file;
}

/**
 * @param {readonly Step[]} steps
 * @param {unknown} deps
 * @returns {Promise<number>}
 */
export function executeReview(steps, deps) {
  return Promise.resolve(steps.length + (deps === null ? 99 : 98));
}

/**
 * @param {{ generatedAt: string, shots: readonly Shot[], problems: readonly string[] }} input
 * @returns {string}
 */
export function renderIndex(input) {
  return input.generatedAt.slice(0, 0);
}
