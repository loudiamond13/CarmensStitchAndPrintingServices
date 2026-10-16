// @ts-check
// Conventional Commits check (OPS-01). The pull request title (it becomes the squash commit on main) and every non-merge
// commit subject in BASE_SHA..HEAD_SHA must read `type(scope)!: summary`, or be a git `Revert "..."` subject. Inputs arrive
// through env (never inline in the workflow, CWE-77): PR_TITLE, BASE_SHA, HEAD_SHA. Node built-ins only: the job runs this
// file without `npm ci`. Exit 0 all good, 1 an offending subject, 2 the range could not be read.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CONVENTIONAL_TYPES = Object.freeze([
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
]);

const SHAPE = /^([^\s(!:]*)(?:\(([^)]*)\))?(!)?:(.*)$/;
const SCOPE = /^[a-z0-9./-]+$/;
const COMMIT_ID = /^[0-9a-f]{7,64}$/i;
const GIT_REVERT = /^Revert ".+"$/;
const MAX_LOG_BYTES = 16 * 1024 * 1024;

/**
 * @typedef {{ status: number | null, stdout?: string | null }} SpawnResult
 * @typedef {(command: string, args: readonly string[], options: { encoding: 'utf8', maxBuffer: number }) => SpawnResult} Spawner
 * @typedef {{ spawn?: Spawner, log?: (line: string) => void, error?: (line: string) => void }} Deps
 */

/**
 * @param {string} subject
 * @returns {{ ok: boolean, reason: string }}
 */
export function checkSubject(subject) {
  if (subject.trim() === '') {
    return { ok: false, reason: 'is empty' };
  }
  if (GIT_REVERT.test(subject)) {
    return { ok: true, reason: '' };
  }
  const shape = SHAPE.exec(subject);
  if (shape === null) {
    return { ok: false, reason: 'does not read type(scope): summary' };
  }
  const [, type = '', scope, , rest = ''] = shape;
  if (!CONVENTIONAL_TYPES.includes(type)) {
    const hint = CONVENTIONAL_TYPES.includes(type.toLowerCase()) ? ' (types are lower case)' : '';
    return { ok: false, reason: `type "${type}" is not one of ${CONVENTIONAL_TYPES.join(', ')}${hint}` };
  }
  if (scope !== undefined && !SCOPE.test(scope)) {
    return { ok: false, reason: 'scope must be lower case letters, digits, dots, slashes or dashes, and not empty' };
  }
  if (!/^ \S/.test(rest)) {
    return { ok: false, reason: 'needs one space and then a summary after the colon' };
  }
  return { ok: true, reason: '' };
}

/**
 * @param {Readonly<Record<string, string | undefined>>} [env]
 * @param {Deps} [deps]
 * @returns {number}
 */
export function main(env = process.env, deps = {}) {
  /** @type {Spawner} */
  const spawn = deps.spawn ?? ((command, args, options) => spawnSync(command, args, options));
  const log = deps.log ?? ((line) => process.stdout.write(`${line}\n`));
  const error = deps.error ?? ((line) => process.stderr.write(`${line}\n`));

  const base = env.BASE_SHA?.trim() ?? '';
  const head = env.HEAD_SHA?.trim() ?? '';
  for (const { name, value } of [
    { name: 'BASE_SHA', value: base },
    { name: 'HEAD_SHA', value: head },
  ]) {
    if (!COMMIT_ID.test(value)) {
      error(`commit-lint: ${name} is missing or not a commit id, so no commit could be checked.`);
      return 2;
    }
  }

  /** @type {SpawnResult} */
  let result;
  try {
    result = spawn('git', ['log', '--no-merges', '--format=%s', `${base}..${head}`], {
      encoding: 'utf8',
      maxBuffer: MAX_LOG_BYTES,
    });
  } catch {
    error('commit-lint: git log could not run, so no commit could be checked.');
    return 2;
  }
  if (result.status !== 0) {
    error('commit-lint: git log failed, so no commit could be checked.');
    return 2;
  }
  const subjects = (result.stdout ?? '').split('\n').filter((line) => line.trim() !== '');

  /** @type {{ label: string, subject: string }[]} */
  const checked = [
    { label: 'PR title', subject: env.PR_TITLE ?? '' },
    ...subjects.map((subject) => ({ label: 'commit', subject })),
  ];
  const offenders = checked
    .map((entry) => ({ ...entry, verdict: checkSubject(entry.subject) }))
    .filter((entry) => !entry.verdict.ok);
  for (const { label, subject, verdict } of offenders) {
    error(`commit-lint: ${label} "${subject}" ${verdict.reason}.`);
  }
  if (offenders.length > 0) {
    error(
      'Use "type(scope): summary", for example "feat(03): add the deploy gate". The PR title becomes the commit on main.',
    );
    return 1;
  }
  log(`commit-lint: the PR title and ${String(subjects.length)} commit subjects follow Conventional Commits.`);
  return 0;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
