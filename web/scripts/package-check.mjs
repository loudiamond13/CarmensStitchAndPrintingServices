// @ts-check
// Fail-closed content check of the deploy package (OPS-05, T-03-44, T-03-45). Usage: node web/scripts/package-check.mjs <dir>
// Refuses logs, an app_offline.htm, environment settings files, key material, secrets and env files, and refuses a
// package that lacks what the host needs to start. Exit 0 clean, 1 problems found, 2 bad usage. Node built-ins only.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED = Object.freeze(['web.config', 'wwwroot/index.html', 'Csps.Server.dll']);
const KEY_EXTENSIONS = Object.freeze(['.pfx', '.pem', '.key']);
const IN_PROCESS = /hostingModel\s*=\s*"inprocess"/i;
const ENVIRONMENT_SETTINGS = /^appsettings\..+\.json$/i;

/**
 * @typedef {{ log?: (line: string) => void, error?: (line: string) => void, exists?: (dir: string) => boolean, listFiles?: (dir: string) => string[], readText?: (dir: string, file: string) => string }} Deps
 */

/**
 * Checks the relative file list of a package. Separators of either kind are read as `/`.
 * @param {readonly string[]} entries Files relative to the package root.
 * @param {(file: string) => string} readText Reads one package file as text (only web.config is read).
 * @returns {string[]} One message per problem; empty when the package is clean.
 */
export function checkPackage(entries, readText) {
  const files = entries.map((entry) => entry.replaceAll('\\', '/').replace(/^\.\//, ''));
  /** @type {string[]} */
  const problems = [];

  for (const file of files) {
    const segments = file.split('/');
    const name = (segments.at(-1) ?? '').toLowerCase();
    const extension = path.posix.extname(name);
    if (segments.slice(0, -1).some((segment) => segment.toLowerCase() === 'logs')) {
      problems.push(`${file}: a logs folder must never be deployed`);
    }
    if (segments.length === 1 && name === 'app_offline.htm') {
      problems.push(`${file}: app_offline.htm would take the site offline`);
    }
    if (ENVIRONMENT_SETTINGS.test(name)) {
      problems.push(`${file}: only appsettings.json may be deployed, not an environment settings file`);
    }
    if (KEY_EXTENSIONS.includes(extension)) {
      problems.push(`${file}: a ${extension} key or certificate file must stay on the server`);
    }
    if (name === 'secrets.json') {
      problems.push(`${file}: secrets.json must stay on the server`);
    }
    if (name === '.env' || name.startsWith('.env.')) {
      problems.push(`${file}: a .env file must stay on the server`);
    }
  }

  for (const required of REQUIRED) {
    if (!files.includes(required)) {
      problems.push(`${required}: required by the host but missing`);
    }
  }
  if (files.includes('web.config') && !IN_PROCESS.test(readText('web.config'))) {
    problems.push('web.config: hostingModel="inprocess" is required');
  }
  return problems;
}

/**
 * @param {string} root
 * @param {string} [relative]
 * @returns {string[]}
 */
function walk(root, relative = '') {
  /** @type {string[]} */
  const files = [];
  for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const child = relative === '' ? entry.name : `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      files.push(...walk(root, child));
    } else {
      files.push(child);
    }
  }
  return files;
}

/**
 * @param {readonly string[]} [args] The command line after the script name.
 * @param {Deps} [deps]
 * @returns {number} 0 when clean, 1 when problems were found, 2 when the folder is missing or not given.
 */
export function main(args = process.argv.slice(2), deps = {}) {
  const log = deps.log ?? ((line) => process.stdout.write(`${line}\n`));
  const error = deps.error ?? ((line) => process.stderr.write(`${line}\n`));
  const exists = deps.exists ?? existsSync;
  const listFiles = deps.listFiles ?? walk;
  const readText = deps.readText ?? ((dir, file) => readFileSync(path.join(dir, file), 'utf8'));

  const [dir] = args;
  if (dir === undefined || dir === '') {
    error('package-check: give the package folder, for example artifacts/package/site.');
    return 2;
  }
  if (!exists(dir)) {
    error(`package-check: folder not found: ${dir}`);
    return 2;
  }
  const files = listFiles(dir);
  const problems = checkPackage(files, (file) => readText(dir, file));
  if (problems.length > 0) {
    for (const problem of problems) {
      error(`package-check: ${problem}`);
    }
    error(`package-check: ${String(problems.length)} problem(s); the package is refused.`);
    return 1;
  }
  log(`Package check passed: ${String(files.length)} files.`);
  return 0;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
