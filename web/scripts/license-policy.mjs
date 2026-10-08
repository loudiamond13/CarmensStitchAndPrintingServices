// @ts-check
// Placeholder (RED): the npm license policy is not implemented yet.

/**
 * @param {readonly unknown[]} packages
 * @param {unknown} policy
 * @returns {{ problems: string[], guessed: string[] }}
 */
export function evaluateTree(packages, policy) {
  void packages;
  void policy;
  return { problems: [], guessed: [] };
}

/**
 * @param {unknown} entries
 * @param {readonly string[]} allowed
 * @param {readonly unknown[]} packages
 * @returns {string[]}
 */
export function validateNpmExceptions(entries, allowed, packages) {
  void entries;
  void allowed;
  void packages;
  return [];
}

/**
 * @param {unknown} lock
 * @param {ReadonlyMap<string, string>} direct
 * @returns {Map<string, string[]>}
 */
export function attributeScopes(lock, direct) {
  void lock;
  void direct;
  return new Map();
}

/**
 * @param {unknown} registry
 * @param {string} manifest
 * @returns {Map<string, string>}
 */
export function registryScopes(registry, manifest) {
  void registry;
  void manifest;
  return new Map();
}
