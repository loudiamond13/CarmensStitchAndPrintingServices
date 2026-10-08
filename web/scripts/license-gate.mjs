// @ts-check
// npm license gate (D-00 free only, D-18, D-26). Run from the repository root or anywhere:
//   node web/scripts/license-gate.mjs
// 1. The production tree of web/ (what ships to the browser) may use only docs/allowed-licenses.json, plus OFL-1.1
//    for the @fontsource fonts. No exception ever applies to it.
// 2. The whole dev/build tree of web/ and tools/openapi-gen/ may additionally use the license-level exceptions in
//    npmLicenseExceptions of docs/license-exceptions.json. An exception that no package needs fails the gate (stale).
// Exits 1 on any problem. Reads only the installed node_modules folders, so no network access is needed.
// `--allowed <path>` and `--exceptions <path>` replace the two policy files; use them only to prove the gate fails.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { evaluateTree, validateNpmExceptions } from './license-policy.mjs';
import { readTree } from './npm-tree.mjs';

/** @typedef {import('./license-policy.mjs').NpmPackage} NpmPackage */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = resolve(webRoot, '..');
const openApiGenRoot = resolve(repoRoot, 'tools', 'openapi-gen');

const { values } = parseArgs({
  options: {
    allowed: { type: 'string', default: resolve(repoRoot, 'docs', 'allowed-licenses.json') },
    exceptions: { type: 'string', default: resolve(repoRoot, 'docs', 'license-exceptions.json') },
  },
});

/**
 * @param {string} path
 * @returns {unknown}
 */
function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function stringList(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  /** @type {unknown[]} */
  const list = value;
  return list.filter((item) => typeof item === 'string');
}

/**
 * Keeps one copy of each name@version (the two dev trees share many packages).
 * @param {readonly NpmPackage[]} packages
 * @returns {NpmPackage[]}
 */
function unique(packages) {
  /** @type {Map<string, NpmPackage>} */
  const seen = new Map();
  for (const item of packages) {
    seen.set(`${item.name}@${item.version}`, item);
  }
  return [...seen.values()];
}

const allowed = stringList(readJson(values.allowed));
const exceptionsDocument = /** @type {Record<string, unknown>} */ (readJson(values.exceptions));
const npmExceptions = exceptionsDocument.npmLicenseExceptions;

/** @type {string[]} */
const problems = [];
if (allowed.length === 0) {
  problems.push(`${values.allowed}: the allow-list is empty or not a JSON list of license ids.`);
}
problems.push(...validateNpmExceptions(npmExceptions, allowed).map((problem) => `[policy] ${problem}`));
const exceptions = Array.isArray(npmExceptions)
  ? /** @type {unknown[]} */ (npmExceptions).flatMap((entry) => {
      const license = /** @type {Record<string, unknown>} */ (entry).license;
      return typeof license === 'string' ? [{ license }] : [];
    })
  : [];

const production = await readTree(webRoot, true);
const development = unique([...(await readTree(webRoot, false)), ...(await readTree(openApiGenRoot, false))]);

const productionResult = evaluateTree(production, { allowed, exceptions: [] });
const developmentResult = evaluateTree(development, { allowed, exceptions });
problems.push(...productionResult.problems.map((problem) => `[production web] ${problem}`));
problems.push(...developmentResult.problems.map((problem) => `[dev/build web + tools/openapi-gen] ${problem}`));

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
  console.log(
    `License gate passed: production web tree ${String(production.length)} packages (allow-list and OFL fonts only); ` +
      `dev/build tree ${String(development.length)} packages (exceptions: ${exceptions.map((item) => item.license).join(', ') || 'none'}).`,
  );
}
