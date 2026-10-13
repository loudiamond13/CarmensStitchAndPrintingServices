// @ts-check
// npm license policy (D-00 free only, D-18 allow-list and font rule, D-26 + addendum dev/build/tool exceptions).
// Pure functions only: license-gate.mjs and third-party-notices.mjs do the I/O (npm-tree.mjs reads node_modules).
//
// Two rules:
// 1. The production tree of web/ (what ships to the browser) may use only the allow-list (docs/allowed-licenses.json),
//    plus OFL-1.1 for the @fontsource fonts. No exception ever applies to it.
// 2. The dev/build/tool trees of web/ and tools/openapi-gen/ may also use the owner-approved license-level exceptions
//    (npmLicenseExceptions in docs/license-exceptions.json). An exception counts for a package only when at least one
//    of the reasons the package is installed (its scopes: build, test or tool, taken from the registry entry of each
//    direct dependency that pulls it in) is a scope the exception lists. An exception or a listed scope that no package
//    needs is stale and fails, so the list cannot grow silently.

/**
 * One installed npm package, as license-checker-rseidelsohn reports it, plus why it is installed.
 * @typedef {{
 *   name: string,
 *   version: string,
 *   licenses?: string | readonly string[] | undefined,
 *   repository?: string | undefined,
 *   scopes?: readonly string[] | undefined,
 * }} NpmPackage
 */

/**
 * A license-level exception (one npmLicenseExceptions entry, reduced to what the evaluation needs).
 * @typedef {{ license: string, scopes: readonly string[] }} LicenseException
 */

/**
 * The rules for one tree. The production tree passes no exceptions; the dev/build/tool trees pass npmLicenseExceptions.
 * `reviewedGuesses` lists the name@version of each package whose guessed license the owner reviewed
 * (docs/license-guesses.json); any other guessed license fails (TOOL-WR-02).
 * @typedef {{ allowed: readonly string[], exceptions: readonly LicenseException[], reviewedGuesses?: readonly string[] }} TreePolicy
 */

/** @typedef {{ problems: string[], guessed: string[] }} TreeResult */

/**
 * The parts of a package-lock.json (lockfileVersion 3) that scope attribution reads.
 * @typedef {{ name?: string, version?: string, dependencies?: Record<string, string>,
 *   devDependencies?: Record<string, string>, optionalDependencies?: Record<string, string>,
 *   peerDependencies?: Record<string, string> }} LockEntry
 * @typedef {{ packages?: Record<string, LockEntry> }} Lockfile
 */

/** The SPDX license that only the self-hosted web fonts may use (D-18). */
export const FONT_LICENSE = 'OFL-1.1';

/** Package-name prefixes of the self-hosted web fonts (D-18). */
export const FONT_PREFIXES = Object.freeze(['@fontsource/', '@fontsource-variable/']);

/** The two root manifests; they are the project itself, not dependencies. */
export const ROOT_PACKAGES = new Set(['csps-web', 'csps-openapi-gen']);

/** Scopes an npm license exception may name. The production (shipped) tree never has exceptions (D-26). */
export const EXCEPTION_SCOPES = Object.freeze(['build', 'test', 'tool']);

/**
 * SPDX exception ids a `WITH` clause may carry (TOOL-WR-01). An exception adds terms to its base license, and some
 * (the Commons Clause, a LicenseRef-* add-on) take freedoms away, so any other id fails, case-sensitively. LLVM-exception
 * only waives attribution for compiled output. A new id needs the owner's approval first (D-00 free only).
 * @type {ReadonlySet<string>}
 */
export const ALLOWED_WITH_EXCEPTIONS = new Set(['LLVM-exception']);

const GUESSED_MARK = '*';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LICENSE_ID = /^[A-Za-z0-9][A-Za-z0-9.+-]*$/;
const OPERATORS = new Set(['AND', 'OR', 'WITH']);
const NODE_MODULES = 'node_modules/';

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
 * atom := '(' or ')' | id ['WITH' exception]. A WITH atom passes only when its base license is allowed and its
 * exception id is in ALLOWED_WITH_EXCEPTIONS.
 * Throws on a malformed expression.
 * @param {readonly string[]} tokens
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
  const isPlain = (/** @type {string} */ token) =>
    token !== '(' && token !== ')' && !OPERATORS.has(token.toUpperCase());

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
    if (!isPlain(token)) {
      throw new Error(`unexpected ${token}`);
    }
    if (peek() === 'WITH') {
      take();
      const exception = take();
      if (!isPlain(exception)) {
        throw new Error('WITH needs an exception id');
      }
      return allowed.has(token) && ALLOWED_WITH_EXCEPTIONS.has(exception);
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
 * True when the SPDX expression is satisfied by the allowed licenses: OR needs any side, AND needs every side, WITH
 * needs an allowed base license and an approved exception id (ALLOWED_WITH_EXCEPTIONS). A list (the legacy `licenses` array) needs every entry. license-checker's trailing `*`
 * (a guessed license) is ignored here; evaluateTree fails a guess that no reviewed entry covers (TOOL-WR-02). Malformed, empty, UNKNOWN and UNLICENSED never pass.
 * @param {string | readonly string[] | undefined} expression
 * @param {ReadonlySet<string>} allowed
 * @returns {boolean}
 */
export function isAllowed(expression, allowed) {
  const list = asList(expression);
  return (
    list.length > 0 &&
    list.every((item) => {
      const tokens = tokenize(withoutGuessMark(item));
      if (tokens === undefined || tokens.length === 0) {
        return false;
      }
      try {
        return evaluate(tokens, allowed);
      } catch {
        return false;
      }
    })
  );
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
export function licenseText(licenses) {
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
 * Ordinal string comparison (no locale), so the output is the same on every machine.
 * @param {string} left
 * @param {string} right
 * @returns {number}
 */
export function compareText(left, right) {
  if (left === right) {
    return 0;
  }
  return left < right ? -1 : 1;
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
 * Sorts packages by name, then version, and drops the two root manifests.
 * @template {NpmPackage} T
 * @param {readonly T[]} packages
 * @returns {T[]}
 */
export function dependenciesOnly(packages) {
  return packages
    .filter((item) => !ROOT_PACKAGES.has(item.name))
    .sort((left, right) => compareText(left.name, right.name) || compareVersions(left.version, right.version));
}

/**
 * @param {readonly string[] | undefined} scopes
 * @returns {string}
 */
function scopeText(scopes) {
  return scopes === undefined || scopes.length === 0 ? '(no known scope)' : scopes.join(', ');
}

/**
 * The exception licenses one package may use: those with a listed scope the package is installed for.
 * @param {NpmPackage} item
 * @param {readonly LicenseException[]} exceptions
 * @returns {LicenseException[]}
 */
function inScope(item, exceptions) {
  const scopes = item.scopes ?? [];
  return exceptions.filter((exception) => exception.scopes.some((scope) => scopes.includes(scope)));
}

/**
 * True when the package's license expression passes with the allow-list, the given extra licenses and, for an
 * @fontsource package, OFL-1.1.
 * @param {NpmPackage} item
 * @param {readonly string[]} allowed
 * @param {readonly string[]} extra
 * @returns {boolean}
 */
function passes(item, allowed, extra) {
  return isAllowed(item.licenses, new Set([...allowed, ...extra, ...(isFont(item.name) ? [FONT_LICENSE] : [])]));
}

/**
 * Checks one tree: every package needs an allowed license, OFL-1.1 counts only for the @fontsource packages, and an
 * exception license counts only for a package installed for one of the exception's scopes. Root packages are skipped.
 * Problems are sorted by package. Staleness is checked by validateNpmExceptions.
 * @param {readonly NpmPackage[]} packages
 * @param {TreePolicy} policy
 * @returns {TreeResult}
 */
export function evaluateTree(packages, policy) {
  const everyException = policy.exceptions.map((item) => item.license);
  const reviewedGuesses = new Set(policy.reviewedGuesses ?? []);
  /** @type {string[]} */
  const problems = [];
  /** @type {string[]} */
  const guessed = [];
  for (const item of dependenciesOnly(packages)) {
    const label = `${item.name}@${item.version}`;
    const usable = inScope(item, policy.exceptions);
    if (
      passes(
        item,
        policy.allowed,
        usable.map((exception) => exception.license),
      )
    ) {
      if (!isGuessed(item.licenses)) {
        continue;
      }
      if (reviewedGuesses.has(label)) {
        guessed.push(`${label} (${licenseText(item.licenses)})`);
      } else {
        problems.push(
          `${label}: license-checker only guessed the license '${licenseText(item.licenses)}'; a guess passes only with an owner-reviewed entry in docs/license-guesses.json.`,
        );
      }
    } else if (passes(item, policy.allowed, everyException)) {
      const before = problems.length;
      for (const exception of policy.exceptions.filter((candidate) => !usable.includes(candidate))) {
        if (
          !passes(
            item,
            policy.allowed,
            everyException.filter((license) => license !== exception.license),
          )
        ) {
          problems.push(
            `${label}: license '${exception.license}' is approved only for ${scopeText(exception.scopes)}, ` +
              `but this package is needed for ${scopeText(item.scopes)}.`,
          );
        }
      }
      if (problems.length === before) {
        problems.push(
          `${label}: license '${licenseText(item.licenses)}' needs an exception that is not approved for ` +
            `${scopeText(item.scopes)}.`,
        );
      }
    } else {
      problems.push(`${label}: license '${licenseText(item.licenses)}' is not allowed in this tree.`);
    }
  }
  return { problems, guessed };
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * @param {unknown} entry
 * @returns {Record<string, unknown>}
 */
function asRecord(entry) {
  return /** @type {Record<string, unknown>} */ (typeof entry === 'object' && entry !== null ? entry : {});
}

/**
 * The name@version of every docs/license-guesses.json entry that names one (the evaluation's `reviewedGuesses`).
 * @param {unknown} entries
 * @returns {string[]}
 */
export function reviewedGuessIds(entries) {
  return Array.isArray(entries)
    ? /** @type {unknown[]} */ (entries).flatMap((entry) => {
        const name = asRecord(entry).package;
        return isText(name) ? [name] : [];
      })
    : [];
}

/**
 * Checks docs/license-guesses.json (TOOL-WR-02): a list of `{ package: 'name@version', license, checked, note }`, one
 * per package whose license license-checker only guessed and the owner read and confirmed. `license` must equal the
 * current guess (without the '*'), `checked` is the review date. An entry for a package that is not installed with a
 * guessed license is stale and fails, so the list cannot outlive the packages it covers.
 * @param {unknown} entries
 * @param {readonly NpmPackage[]} packages every installed package of every tree
 * @returns {string[]}
 */
export function validateLicenseGuesses(entries, packages) {
  if (!Array.isArray(entries)) {
    return ['docs/license-guesses.json must be a list.'];
  }
  /** @type {Map<string, string>} */
  const guesses = new Map();
  for (const item of packages) {
    if (isGuessed(item.licenses)) {
      guesses.set(`${item.name}@${item.version}`, asList(item.licenses).map(withoutGuessMark).join(' AND '));
    }
  }
  /** @type {string[]} */
  const problems = [];
  for (const entry of /** @type {unknown[]} */ (entries)) {
    const record = asRecord(entry);
    const name = isText(record.package) ? record.package : '(no package)';
    const label = `license guess '${name}'`;
    const before = problems.length;
    for (const field of ['package', 'license', 'note']) {
      if (!isText(record[field])) {
        problems.push(`${label}: ${field} is missing or empty.`);
      }
    }
    if (!isText(record.checked) || !DATE_PATTERN.test(record.checked)) {
      problems.push(`${label}: checked must be a yyyy-mm-dd date.`);
    }
    if (problems.length !== before) {
      continue;
    }
    const guess = guesses.get(name);
    if (guess === undefined) {
      problems.push(
        `${label} is stale: no installed package with that name and version has a guessed license; remove it.`,
      );
    } else if (guess !== record.license) {
      problems.push(`${label} records '${String(record.license)}', but license-checker now guesses '${guess}'.`);
    }
  }
  return problems;
}

/**
 * @param {unknown} value
 * @returns {value is unknown[]}
 */
function isNonEmptyList(value) {
  return Array.isArray(value) && value.length > 0;
}

/**
 * The scopes of the packages that need `exception` (they would fail without it), or undefined when none does.
 * @param {LicenseException} exception
 * @param {readonly LicenseException[]} exceptions
 * @param {readonly string[]} allowed
 * @param {readonly NpmPackage[]} packages
 * @returns {Set<string> | undefined}
 */
function scopesThatNeed(exception, exceptions, allowed, packages) {
  const others = exceptions.filter((item) => item !== exception).map((item) => item.license);
  const all = [...others, exception.license];
  /** @type {Set<string> | undefined} */
  let used;
  for (const item of dependenciesOnly(packages)) {
    if (passes(item, allowed, all) && !passes(item, allowed, others)) {
      used ??= new Set();
      for (const scope of item.scopes ?? []) {
        used.add(scope);
      }
    }
  }
  return used;
}

/**
 * Checks the npmLicenseExceptions entries: each needs a license, build/test/tool scopes, example packages, what pulls
 * them in, a plain-words reason and the owner's approval date and name. A license may appear once and must not already
 * be on the allow-list. Against the dev/build/tool `packages`, an exception that no package needs is stale, and so is a
 * listed scope that no package needing the license is installed for.
 * @param {unknown} entries
 * @param {readonly string[]} allowed
 * @param {readonly NpmPackage[]} packages
 * @returns {string[]}
 */
export function validateNpmExceptions(entries, allowed, packages) {
  if (!Array.isArray(entries)) {
    return ['npmLicenseExceptions must be a list.'];
  }
  /** @type {string[]} */
  const problems = [];
  /** @type {Set<string>} */
  const seen = new Set();
  /** @type {LicenseException[]} */
  const valid = [];
  for (const entry of /** @type {unknown[]} */ (entries)) {
    const record = /** @type {Record<string, unknown>} */ (typeof entry === 'object' && entry !== null ? entry : {});
    const license = isText(record.license) ? record.license : '(no license)';
    const label = `npmLicenseExceptions '${license}'`;
    if (seen.has(license)) {
      problems.push(`${label} is listed twice.`);
      continue;
    }
    seen.add(license);
    const before = problems.length;
    if (allowed.includes(license)) {
      problems.push(`${label} is already on the allow-list.`);
    }
    if (!isText(record.license)) {
      problems.push(`${label}: license is missing or empty.`);
    }
    const scopes = record.scopes;
    const scopesValid =
      isNonEmptyList(scopes) && scopes.every((scope) => typeof scope === 'string' && EXCEPTION_SCOPES.includes(scope));
    if (!scopesValid) {
      problems.push(`${label}: scopes must list only build, test or tool (the production tree has no exceptions).`);
    }
    const examples = record.examplePackages;
    if (!isNonEmptyList(examples) || !examples.every(isText)) {
      problems.push(`${label}: examplePackages must list at least one package.`);
    }
    for (const field of ['pulledInBy', 'reason', 'approvedBy']) {
      if (!isText(record[field])) {
        problems.push(`${label}: ${field} is missing or empty.`);
      }
    }
    const date = record.approved;
    if (!isText(date) || !DATE_PATTERN.test(date)) {
      problems.push(`${label}: approved must be a yyyy-mm-dd date.`);
    }
    if (problems.length === before) {
      valid.push({ license, scopes: /** @type {string[]} */ (scopes) });
    }
  }

  for (const exception of valid) {
    const used = scopesThatNeed(exception, valid, allowed, packages);
    if (used === undefined) {
      problems.push(
        `npmLicenseExceptions '${exception.license}' is stale: no package needs it; remove it (owner approval is per license).`,
      );
      continue;
    }
    for (const scope of exception.scopes.filter((item) => !used.has(item))) {
      problems.push(
        `npmLicenseExceptions '${exception.license}' scope '${scope}' is stale: no package that needs the license is used for ${scope}.`,
      );
    }
  }
  return problems;
}

/**
 * Finds the lockfile entry a dependency `name` of the package at `from` resolves to, the way Node does: the nearest
 * node_modules folder first, then each enclosing one up to the project root.
 * @param {Record<string, LockEntry>} entries
 * @param {string} from
 * @param {string} name
 * @returns {string | undefined}
 */
function resolveEntry(entries, from, name) {
  let base = from;
  for (;;) {
    const candidate = base === '' ? `${NODE_MODULES}${name}` : `${base}/${NODE_MODULES}${name}`;
    if (Object.hasOwn(entries, candidate)) {
      return candidate;
    }
    if (base === '') {
      return undefined;
    }
    const parent = base.lastIndexOf(`/${NODE_MODULES}`);
    base = parent === -1 ? '' : base.slice(0, parent);
  }
}

/**
 * The real package name of a lockfile entry: its `name` (set for an npm: alias) or the folder after node_modules/.
 * @param {string} key
 * @param {LockEntry} entry
 * @returns {string}
 */
function realName(key, entry) {
  return entry.name ?? key.slice(key.lastIndexOf(NODE_MODULES) + NODE_MODULES.length);
}

/**
 * Works out why each package in a package-lock.json is installed. Every direct dependency of the root gets its registry
 * scope from `direct` (keyed by the real package name, so an npm: alias resolves); each scope then flows to everything
 * that dependency pulls in (dependencies, optional and peer dependencies, resolved through nested node_modules folders).
 * Only installed entries count (`isInstalled`, by lockfile key): the lockfile also lists the optional packages of other
 * platforms, which never reach this machine. Returns `name@version` → sorted scopes. A package only reachable from an
 * unregistered direct dependency gets none.
 * @param {Lockfile} lock
 * @param {ReadonlyMap<string, string>} direct
 * @param {(key: string) => boolean} [isInstalled]
 * @returns {Map<string, string[]>}
 */
export function attributeScopes(lock, direct, isInstalled = () => true) {
  const entries = lock.packages ?? {};
  const root = entries[''] ?? {};
  /** @type {Map<string, Set<string>>} */
  const byKey = new Map();
  const rootNames = [root.dependencies, root.devDependencies, root.optionalDependencies].flatMap((group) =>
    Object.keys(group ?? {}),
  );
  for (const name of rootNames) {
    const start = resolveEntry(entries, '', name);
    const startEntry = start === undefined ? undefined : entries[start];
    const scope = startEntry === undefined || start === undefined ? undefined : direct.get(realName(start, startEntry));
    if (start === undefined || scope === undefined || !isInstalled(start)) {
      continue;
    }
    const queue = [start];
    while (queue.length > 0) {
      const key = /** @type {string} */ (queue.pop());
      const scopes = byKey.get(key) ?? new Set();
      if (scopes.has(scope)) {
        continue;
      }
      scopes.add(scope);
      byKey.set(key, scopes);
      const entry = entries[key] ?? {};
      for (const group of [entry.dependencies, entry.optionalDependencies, entry.peerDependencies]) {
        for (const dependency of Object.keys(group ?? {})) {
          const next = resolveEntry(entries, key, dependency);
          if (next !== undefined && isInstalled(next)) {
            queue.push(next);
          }
        }
      }
    }
  }

  /** @type {Map<string, Set<string>>} */
  const byPackage = new Map();
  for (const [key, scopes] of byKey) {
    const entry = entries[key] ?? {};
    const id = `${realName(key, entry)}@${entry.version ?? ''}`;
    const merged = byPackage.get(id) ?? new Set();
    for (const scope of scopes) {
      merged.add(scope);
    }
    byPackage.set(id, merged);
  }
  return new Map([...byPackage].map(([id, scopes]) => [id, [...scopes].sort(compareText)]));
}

/**
 * The registry scope of every npm entry of one manifest folder (docs/dependencies.json), keyed by package name.
 * @param {unknown} registry
 * @param {string} manifest
 * @returns {Map<string, string>}
 */
export function registryScopes(registry, manifest) {
  const packages = /** @type {{ packages?: unknown }} */ (
    typeof registry === 'object' && registry !== null ? registry : {}
  ).packages;
  /** @type {Map<string, string>} */
  const scopes = new Map();
  for (const entry of Array.isArray(packages) ? /** @type {unknown[]} */ (packages) : []) {
    const record = /** @type {Record<string, unknown>} */ (typeof entry === 'object' && entry !== null ? entry : {});
    if (record.kind === 'npm' && record.manifest === manifest && isText(record.id) && isText(record.scope)) {
      scopes.set(record.id, record.scope);
    }
  }
  return scopes;
}
