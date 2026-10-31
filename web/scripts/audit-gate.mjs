// @ts-check
// npm audit gate (OPS-03, 07.1 D-46). Runs `npm audit --json` for web/ and tools/openapi-gen/ at every severity and fails
// on any advisory the owner has not accepted in npmAuditExceptions of docs/audit-exceptions.json, on an acceptance past
// its review date, and on an acceptance no advisory needs. Start it with `npm run audit:check` in web/ (npm passes its own
// JS entry in npm_execpath, which Windows needs because it cannot spawn the npm .cmd shim without a shell, L-22).
// `--report <file>` (repeatable) reads saved reports instead of running npm, and `--today` fixes the date; both are for tests.
// Never widen the exceptions file to make the gate pass: report the advisory to the owner instead.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { advisoriesOf, evaluateAudit, validateAuditExceptions } from './audit-policy.mjs';

/** @typedef {import('./audit-policy.mjs').AuditException} AuditException */

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(webRoot, '..');
const trees = [webRoot, path.join(repoRoot, 'tools', 'openapi-gen')];

const { values } = parseArgs({
  options: {
    exceptions: { type: 'string', default: path.join(repoRoot, 'docs', 'audit-exceptions.json') },
    report: { type: 'string', multiple: true },
    today: { type: 'string', default: new Date().toISOString().slice(0, 10) },
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
 * npm audit exits 1 when it finds anything, so only the JSON decides.
 * @param {string} cwd
 * @returns {unknown}
 */
function audit(cwd) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) throw new Error('npm_execpath is not set. Start the gate with `npm run audit:check`.');
  const result = spawnSync(process.execPath, [npmCli, 'audit', '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  return /** @type {unknown} */ (JSON.parse(result.stdout || '{}'));
}

/** @type {unknown[]} */
const reports = values.report ? values.report.map(readJson) : trees.map(audit);
const list = /** @type {Record<string, unknown>} */ (readJson(values.exceptions)).npmAuditExceptions;

let problems = validateAuditExceptions(list);
/** @type {string[]} */
let accepted = [];
if (problems.length === 0) {
  try {
    const result = evaluateAudit(reports.flatMap(advisoriesOf), /** @type {AuditException[]} */ (list), values.today);
    problems = result.problems;
    accepted = result.accepted;
  } catch (error) {
    problems = [error instanceof Error ? error.message : String(error)];
  }
}

for (const line of accepted) console.log(`Accepted: ${line}`);
if (problems.length > 0) {
  for (const line of problems) console.error(line);
  process.exit(1);
}
console.log('npm audit gate: no unaccepted advisories.');
