// Inert placeholder (plan 02-04 RED): the real flat config lands in the GREEN commit.

/** @type {unknown[]} */
export const syntaxBans = [];

/** @type {import('eslint').Linter.Config[]} */
export const architectureRules = [];

/**
 * @param {import('eslint').Linter.Config} config
 * @returns {import('eslint').Linter.Config}
 */
export function escalate(config) {
  return config;
}

/** @type {import('eslint').Linter.Config[]} */
export default [];
