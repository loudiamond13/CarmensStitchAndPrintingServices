// @ts-check
// npm license policy (D-00 free only, D-18 allow-list and font rule, D-26 dev/build exceptions).
// Pure functions only: the gate (license-gate.mjs) and the notices writer (third-party-notices.mjs) do the I/O.

/**
 * One installed npm package, as license-checker-rseidelsohn reports it.
 * @typedef {{ name: string, version: string, licenses?: string | string[] | undefined, repository?: string | undefined }} NpmPackage
 */

/**
 * A license-level exception for one tree (npmLicenseExceptions in docs/license-exceptions.json).
 * @typedef {{ license: string }} LicenseException
 */

/**
 * The rules for one tree. The production tree passes no exceptions; the dev/build tree passes npmLicenseExceptions.
 * @typedef {{ allowed: readonly string[], exceptions: readonly LicenseException[] }} TreePolicy
 */

/** @typedef {{ problems: string[], guessed: string[] }} TreeResult */

/** The SPDX license that only the self-hosted web fonts may use (D-18). */
export const FONT_LICENSE = 'OFL-1.1';

/** Package-name prefixes of the self-hosted web fonts (D-18). */
export const FONT_PREFIXES = ['@fontsource/', '@fontsource-variable/'];

/** The two root manifests; they are the project itself, not dependencies. */
export const ROOT_PACKAGES = new Set(['csps-web', 'csps-openapi-gen']);

/** Scopes an npm license exception may name. The production (shipped) tree never has exceptions (D-26). */
const EXCEPTION_SCOPES = new Set(['build', 'test', 'tool']);

const GUESSED_MARK = '*';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LICENSE_ID = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;

/**
 * Splits an SPDX expression into tokens; returns undefined for any character SPDX does not use.
 * @param {string} expression
 * @returns {string[] | undefined}
 */
function tokenize(expression) {
  /** @type {string[]} */
  const tokens = [];
  for (const part of expression.replaceAll('(', ' ( ').replaceAll(')', ' ) ').split(/\s+/)) {
    if (part.length === 0) {
      continue;
    }
    if (part !== '(' && part !== ')' && !LICENSE_ID.test(part)) {
      return undefined;
    }
    tokens.push(part);
  }
  return tokens;
}

/**
 * Recursive-descent SPDX evaluation: or := and ('OR' and)*, and := atom ('AND' atom)*,
 * atom := '(' or ')' | id ['WITH' exception]. A WITH exception is judged by its base license.
 * Throws on a malformed expression.
 * @param {string[]} tokens
 * @param {ReadonlySet<string>} allowed
 * @returns {boolean}
 */
function evaluate(tokens, allowed) {
  let position = 0;
  const peek = () => tokens[position]?.toUpperCase();
  const take = () => {
    const token = tokens[position];
    if (token === undefined) {
      throw new Error('unexpected end');
    }
    position += 1;
    return token;
  };
  const isOperator = (/** @type {string} */ token) => ['AND', 'OR', 'WITH'].includes(token.toUpperCase());

  /** @returns {boolean} */
  function atom() {
    const token = take();
    if (token === '(') {
      const value = or();
      if (take() !== ')') {
        throw new Error('missing )');
      }
      return value;
    }
    if (token === ')' || isOperator(token)) {
      throw new Error(`unexpected ${token}`);
    }
    if (peek() === 'WITH') {
      take();
      const exception = take();
      if (exception === '(' || exception === ')' || isOperator(exception)) {
        throw new Error('WITH needs an exception id');
      }
    }
    return allowed.has(token);
  }

  /** @returns {boolean} */
  function and() {
    let value = atom();
    while (peek() === 'AND') {
      take();
      value = atom() && value;
    }
    return value;
  }

  /** @returns {boolean} */
  function or() {
    let value = and();
    while (peek() === 'OR') {
      take();
      value = and() || value;
    }
    return value;
  }

  const result = or();
  if (position !== tokens.length) {
    throw new Error('trailing tokens');
  }
  return result;
}

/**
 * @param {string | readonly string[] | undefined} expression
 * @returns {string[]}
 */
function asList(expression) {
  if (expression === undefined) {
    return [];
  }
  return typeof expression === 'string' ? [expression] : [...expression];
}

/**
 * @param {string} expression
 * @returns {string}
 */
function withoutGuessMark(expression) {
  const trimmed = expression.trim();
  return trimmed.endsWith(GUESSED_MARK) ? trimmed.slice(0, -GUESSED_MARK.length) : trimmed;
}

/**
 * True when the SPDX expression is satisfied by the allowed licenses: OR needs any side, AND needs every side, WITH is
 * judged by its base license. A list (the legacy `licenses` array) needs every entry. license-checker's trailing `*`
 * (a guessed license) is ignored here and reported by evaluateTree. Malformed, empty, UNKNOWN and UNLICENSED never pass.
 * @param {string | readonly string[] | undefined} expression
 * @param {ReadonlySet<string>} allowed
 * @returns {boolean}
 */
export function isAllowed(expression, allowed) {
  const list = asList(expression);
  if (list.length === 0) {
    return false;
  }
  return list.every((item) => {
    const tokens = tokenize(withoutGuessMark(item));
    if (tokens === undefined || tokens.length === 0) {
      return false;
    }
    try {
      return evaluate(tokens, allowed);
    } catch {
      return false;
    }
  });
}

/**
 * True when license-checker guessed the license (it marks a guess with a trailing `*`).
 * @param {string | readonly string[] | undefined} expression
 * @returns {boolean}
 */
export function isGuessed(expression) {
  return asList(expression).some((item) => item.trim().endsWith(GUESSED_MARK));
}

/**
 * @param {string | readonly string[] | undefined} licenses
 * @returns {string}
 */
function licenseText(licenses) {
  const list = asList(licenses);
  return list.length === 0 ? '(none)' : list.join(' AND ');
}

/**
 * @param {string} name
 * @returns {boolean}
 */
function isFont(name) {
  return FONT_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Compares two versions segment by segment, numerically where both segments are numbers.
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareVersions(left, right) {
  const a = left.split(/[.+-]/);
  const b = right.split(/[.+-]/);
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const x = a[index] ?? '';
    const y = b[index] ?? '';
    const difference = /^\d+$/.test(x) && /^\d+$/.test(y) ? Number(x) - Number(y) : compareText(x, y);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
}

/**
 * Ordinal string comparison (no locale), so the output is the same on every machine.
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
function compareText(left, right) {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
}

/**
 * @param {NpmPackage} left
 * @param {NpmPackage} right
 * @returns {number}
 */
function comparePackages(left, right) {
  return compareText(left.name, right.name) || compareVersions(left.version, right.version);
}

/**
 * @param {readonly NpmPackage[]} packages
 * @returns {NpmPackage[]}
 */
function dependenciesOnly(packages) {
  return packages.filter((item) => !ROOT_PACKAGES.has(item.name)).sort(comparePackages);
}

/**
 * Checks one tree: every package needs an allowed license, OFL-1.1 counts only for the @fontsource packages, and the
 * tree's exception licenses count for every package. An exception that no package needs (the tree would still pass
 * without it) is reported as stale, so the list cannot grow silently. Root packages are skipped. Problems are sorted by
 * package, stale exceptions last.
 * @param {readonly NpmPackage[]} packages
 * @param {TreePolicy} policy
 * @returns {TreeResult}
 */
export function evaluateTree(packages, policy) {
  const exceptionLicenses = policy.exceptions.map((item) => item.license);
  const base = [...policy.allowed];
  /**
   * @param {NpmPackage} item
   * @param {readonly string[]} extra
   */
  const passes = (item, extra) =>
    isAllowed(item.licenses, new Set([...base, ...extra, ...(isFont(item.name) ? [FONT_LICENSE] : [])]));

  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const guessed = [];
  /** @type {Set<string>} */
  const needed = new Set();
  for (const item of dependenciesOnly(packages)) {
    const label = `${item.name}@${item.version}`;
    if (!passes(item, exceptionLicenses)) {
      problems.push(`${label}: license '${licenseText(item.licenses)}' is not allowed in this tree.`);
      continue;
    }
    if (isGuessed(item.licenses)) {
      guessed.push(`${label} (${licenseText(item.licenses)})`);
    }
    for (const license of exceptionLicenses) {
      if (
        !passes(
          item,
          exceptionLicenses.filter((other) => other !== license),
        )
      ) {
        needed.add(license);
      }
    }
  }

  for (const license of exceptionLicenses) {
    if (!needed.has(license)) {
      problems.push(
        `stale exception: no package needs '${license}'; remove it from npmLicenseExceptions (owner approval is per license).`,
      );
    }
  }
  return { problems, guessed };
}

/**
 * One line per package for THIRD-PARTY-NOTICES.txt: `name@version | license | repository`, sorted by name then
 * version, root packages skipped. No dates, so the file changes only when the package graph changes.
 * @param {readonly NpmPackage[]} packages
 * @returns {string[]}
 */
export function formatNotices(packages) {
  return dependenciesOnly(packages).map(
    (item) =>
      `${item.name}@${item.version} | ${licenseText(item.licenses)} | ${item.repository ?? '(no repository listed)'}`,
  );
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} value
 * @returns {value is unknown[]}
 */
function isNonEmptyList(value) {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Checks the npmLicenseExceptions entries: each needs a license, dev/build scopes, example packages, what pulls them
 * in, a plain-words reason and the owner's approval date and name. A license may appear once and must not already be
 * on the allow-list.
 * @param {unknown} entries
 * @param {readonly string[]} [allowed]
 * @returns {string[]}
 */
export function validateNpmExceptions(entries, allowed = []) {
  if (!Array.isArray(entries)) {
    return ['npmLicenseExceptions must be a list.'];
  }
  /** @type {string[]} */
  const problems = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const entry of /** @type {unknown[]} */ (entries)) {
    const record = /** @type {Record<string, unknown>} */ (typeof entry === 'object' && entry !== null ? entry : {});
    const license = isText(record.license) ? record.license : '(no license)';
    const label = `npmLicenseExceptions '${license}'`;
    if (seen.has(license)) {
      problems.push(`${label} is listed twice.`);
      continue;
    }
    seen.add(license);
    if (allowed.includes(license)) {
      problems.push(`${label} is already on the allow-list.`);
    }
    if (!isText(record.license)) {
      problems.push(`${label}: license is missing or empty.`);
    }
    const scopes = record.scopes;
    if (!isNonEmptyList(scopes) || !scopes.every((scope) => typeof scope === 'string' && EXCEPTION_SCOPES.has(scope))) {
      problems.push(`${label}: scopes must list only build, test or tool (the production tree has no exceptions).`);
    }
    const examples = record.examplePackages;
    if (!isNonEmptyList(examples) || !examples.every(isText)) {
      problems.push(`${label}: examplePackages must list at least one package.`);
    }
    for (const field of ['pulledInBy', 'reason']) {
      if (!isText(record[field])) {
        problems.push(`${label}: ${field} is missing or empty.`);
      }
    }
    const approved = record.approved;
    if (!isText(approved) || !DATE_PATTERN.test(approved)) {
      problems.push(`${label}: approved must be a yyyy-mm-dd date.`);
    }
    if (!isText(record.approvedBy)) {
      problems.push(`${label}: approvedBy is missing or empty.`);
    }
  }
  return problems;
}
