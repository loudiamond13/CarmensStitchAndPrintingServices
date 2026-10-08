// @ts-check
// Placeholder (RED): the notices writer is not implemented yet.

/**
 * @param {readonly unknown[]} packages
 * @returns {string}
 */
export function renderNotices(packages) {
  return packages.length > 0 ? '' : '';
}

/**
 * @param {string} committed
 * @param {string} expected
 * @returns {string | undefined}
 */
export function firstDifference(committed, expected) {
  return committed === expected ? undefined : undefined;
}
