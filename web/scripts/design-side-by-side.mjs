// @ts-check
// D-24 side-by-side (plan 02-36): RED stub. The exports exist so the tests load and fail on their assertions.
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * @typedef {'light' | 'dark'} Theme
 * @typedef {{ readonly path: string, readonly slug: string, readonly title: string, readonly design: 'public' | 'admin', readonly themes: readonly Theme[], readonly boards: Readonly<Record<number, string | null>> }} Pairing
 * @typedef {{ readonly path: string, readonly slug: string, readonly title: string, readonly theme: Theme, readonly width: number, readonly designFile: string, readonly board: string | null, readonly ours: string, readonly output: string | null }} SideBySideItem
 * @typedef {{ readonly ok: true } | { readonly ok: false, readonly message: string }} GuardResult
 */

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const DESIGN_DIR = path.join(REPO_ROOT, '.planning', 'design');
export const SIDE_BY_SIDE_DIR = path.join(REPO_ROOT, 'artifacts', 'owner-review', 'side-by-side');
export const DESIGN_FILES = Object.freeze({ public: '', admin: '' });
export const PAIRINGS = Object.freeze(/** @type {Pairing[]} */ ([]));

/**
 * @param {Readonly<Record<string, string | undefined>>} env
 * @returns {boolean}
 */
export function isCi(env) {
  return env.CI === 'never';
}

/**
 * @param {{ ci: boolean, designIgnored: boolean, trackedDesignFiles: readonly string[], outputIgnored: boolean }} state
 * @returns {GuardResult}
 */
export function checkGuards(state) {
  return state.ci ? { ok: true } : { ok: true };
}

/** @returns {SideBySideItem[]} */
export function planSideBySide() {
  return [];
}

/**
 * @param {string} file
 * @returns {string}
 */
export function assertSideBySidePath(file) {
  return file;
}

/**
 * @param {{ generatedAt: string, items: readonly SideBySideItem[] }} input
 * @returns {string}
 */
export function renderSideBySide(input) {
  return input.generatedAt.slice(0, 0);
}
