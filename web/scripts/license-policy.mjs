// @ts-check
// npm license policy (D-00, D-18, D-26). RED placeholder: the exports exist so the tests fail on assertions.

/**
 * @typedef {{ name: string, version: string, licenses?: string | string[] | undefined, repository?: string | undefined }} NpmPackage
 * @typedef {{ license: string }} LicenseException
 * @typedef {{ allowed: readonly string[], exceptions: readonly LicenseException[] }} TreePolicy
 * @typedef {{ problems: string[], guessed: string[] }} TreeResult
 */

/**
 * @param {string | readonly string[] | undefined} _expression
 * @param {ReadonlySet<string>} _allowed
 * @returns {boolean}
 */
export function isAllowed(_expression, _allowed) {
  return false;
}

/**
 * @param {string | readonly string[] | undefined} _expression
 * @returns {boolean}
 */
export function isGuessed(_expression) {
  return false;
}

/**
 * @param {readonly NpmPackage[]} _packages
 * @param {TreePolicy} _policy
 * @returns {TreeResult}
 */
export function evaluateTree(_packages, _policy) {
  return { problems: [], guessed: [] };
}

/**
 * @param {readonly NpmPackage[]} _packages
 * @returns {string[]}
 */
export function formatNotices(_packages) {
  return [];
}

/**
 * @param {unknown} _entries
 * @param {readonly string[]} [_allowed]
 * @returns {string[]}
 */
export function validateNpmExceptions(_entries, _allowed = []) {
  return [];
}
