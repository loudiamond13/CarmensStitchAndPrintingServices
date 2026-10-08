// @ts-check
// npm license gate (D-00 free only, D-18, D-26 + addendum). Run from the repository root or anywhere:
//   node web/scripts/license-gate.mjs        (or `npm run license:check` in web/)
// Rule 1. The production tree of web/ (what ships to the browser) may use only docs/allowed-licenses.json, plus OFL-1.1
//         for the @fontsource fonts. No exception ever applies to it.
// Rule 2. The dev/build/tool trees of web/ and tools/openapi-gen/ may also use the owner-approved license-level
//         exceptions in npmLicenseExceptions of docs/license-exceptions.json, each only for the scopes it lists (why a
//         package is installed comes from the docs/dependencies.json scope of the direct dependencies that pull it in).
//         An exception, or a listed scope, that no package needs fails the gate as stale.
// Exits 1 on any problem and prints a plain table. Reads only the installed node_modules folders, the lockfiles and the
// docs/ policy files, so no network access is needed.
// `--allowed <path>` and `--exceptions <path>` replace the two policy files; use them only to prove the gate fails on a
// stricter policy. Never widen either file to make the gate pass: report the package to the owner instead.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { evaluateTree, registryScopes, validateNpmExceptions } from './license-policy.mjs';
import { readScopes, readTree, withScopes } from './npm-tree.mjs';

/** @typedef {import('./license-policy.mjs').NpmPackage} NpmPackage */
/** @typedef {import('./license-policy.mjs').LicenseException} LicenseException */

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');
const openApiGenRoot = path.join(repoRoot, 'tools', 'openapi-gen');

const { values } = parseArgs({
  options: {
    allowed: { type: 'string', default: path.join(repoRoot, 'docs', 'allowed-licenses.json') },
    exceptions: { type: 'string', default: path.join(repoRoot, 'docs', 'license-exceptions.json') },
  },
});

/**
 * @param {string} file
 * @returns {unknown}
 */
function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function stringList(value) {
  return Array.isArray(value) ? /** @type {unknown[]} */ (value).filter((item) => typeof item === 'string') : [];
}

/**
 * Keeps one copy of each name@version (the trees share packages) and merges their scopes.
 * @param {readonly NpmPackage[]} packages
 * @returns {NpmPackage[]}
 */
function unique(packages) {
  /** @type {Map<string, NpmPackage>} */
  const seen = new Map();
  for (const item of packages) {
    const key = `${item.name}@${item.version}`;
    const scopes = new Set([...(seen.get(key)?.scopes ?? []), ...(item.scopes ?? [])]);
    seen.set(key, { ...item, scopes: [...scopes].sort() });
  }
  return [...seen.values()];
}

const allowed = stringList(readJson(values.allowed));
const exceptionsDocument = /** @type {Record<string, unknown>} */ (readJson(values.exceptions));
const npmExceptions = exceptionsDocument.npmLicenseExceptions;
const registry = readJson(path.join(repoRoot, 'docs', 'dependencies.json'));

/** @type {LicenseException[]} */
const exceptions = Array.isArray(npmExceptions)
  ? /** @type {unknown[]} */ (npmExceptions).flatMap((entry) => {
      const record = /** @type {Record<string, unknown>} */ (typeof entry === 'object' && entry !== null ? entry : {});
      return typeof record.license === 'string' ? [{ license: record.license, scopes: stringList(record.scopes) }] : [];
    })
  : [];

const [production, webAll, toolAll] = await Promise.all([
  readTree(webRoot, true),
  readTree(webRoot, false),
  readTree(openApiGenRoot, false),
]);
const development = unique([
  ...withScopes(webAll, readScopes(webRoot, registryScopes(registry, 'web'))),
  ...withScopes(toolAll, readScopes(openApiGenRoot, registryScopes(registry, 'tools/openapi-gen'))),
]);

/** @type {string[]} */
const problems = [];
if (allowed.length === 0) {
  problems.push(`[policy] ${values.allowed}: the allow-list is empty or not a JSON list of license ids.`);
}
problems.push(...validateNpmExceptions(npmExceptions, allowed, development).map((problem) => `[policy] ${problem}`));
const productionResult = evaluateTree(production, { allowed, exceptions: [] });
const developmentResult = evaluateTree(development, { allowed, exceptions });
problems.push(...productionResult.problems.map((problem) => `[production web] ${problem}`));
problems.push(...developmentResult.problems.map((problem) => `[dev/build/tool] ${problem}`));

const rows = [
  ['Tree', 'Packages', 'Licenses accepted', 'Problems'],
  [
    'production web/',
    String(production.length),
    'allow-list + OFL-1.1 (@fontsource)',
    String(productionResult.problems.length),
  ],
  [
    'dev/build/tool web/ + tools/openapi-gen/',
    String(development.length),
    `allow-list + ${exceptions.map((item) => `${item.license} (${item.scopes.join('/')})`).join(', ') || 'no exceptions'}`,
    String(developmentResult.problems.length),
  ],
];
const widths = rows[0]?.map((_, column) => Math.max(...rows.map((row) => row[column]?.length ?? 0))) ?? [];
for (const row of rows) {
  console.log(row.map((cell, column) => cell.padEnd(widths[column] ?? 0)).join(' | '));
}

const guessed = [...new Set([...productionResult.guessed, ...developmentResult.guessed])].sort();
if (guessed.length > 0) {
  console.log(`Guessed licenses (checked without the '*'): ${guessed.join(', ')}`);
}

if (problems.length > 0) {
  console.error(`License gate failed with ${String(problems.length)} problem(s):`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error(
    'Never widen the allow-list or the exceptions to pass this gate; report the package to the owner (D-00, D-26).',
  );
  process.exitCode = 1;
} else {
  console.log('License gate passed.');
}
