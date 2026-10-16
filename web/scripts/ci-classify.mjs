// @ts-check
// Decides each CI run's mode in one tested place (OPS-02, D-14) and writes `mode=<value>` to $GITHUB_OUTPUT:
//   fast     a draft pull request
//   docs     a ready pull request whose changed files are all documentation
//   full     every other ready pull request, and any run this script cannot be sure about
//   package  a push to main whose tree already passed `gate (full)` on its pull request (research Pattern 9)
// Every rule fails toward `full`, because a wrong `docs` answer would skip real checks. Node built-ins only: the classify
// job runs this file without `npm ci`. Inputs arrive through env (never inline in the workflow): GITHUB_EVENT_NAME,
// PR_DRAFT, BASE_SHA, HEAD_SHA, GITHUB_SHA, GITHUB_REPOSITORY, GH_TOKEN, GITHUB_OUTPUT.
import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MODES = Object.freeze({ docs: 'docs', fast: 'fast', full: 'full', package: 'package' });

/** Top-level folders whose markdown still counts as code: tests read it, or the build and workflows live there. */
const CODE_FOLDERS = new Set(['src', 'web', 'tests', 'tools', '.github']);
const COMMIT_ID = /^[0-9a-f]{7,64}$/i;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
/** The job name of the full gate, which is also the name of its check run. */
const GATE_CHECK = 'gate (full)';
const MAX_DIFF_BYTES = 16 * 1024 * 1024;

/**
 * @typedef {{ status: number | null, stdout?: string | null }} SpawnResult
 * @typedef {(command: string, args: readonly string[], options: { encoding: 'utf8', maxBuffer: number }) => SpawnResult} Spawner
 * @typedef {{ spawn?: Spawner, appendOutput?: (file: string, text: string) => void, log?: (line: string) => void, error?: (line: string) => void }} Deps
 * @typedef {(args: readonly string[]) => SpawnResult} GhRunner
 * @typedef {{ mode: string, reason: string }} Decision
 */

/**
 * True for a path that cannot change behaviour: anything under `.planning/`, or a `.md` file outside the code folders.
 * Windows separators and a leading `./` are read as git writes them; any `..` or empty segment is never documentation.
 * @param {string} filePath
 * @returns {boolean}
 */
export function isDocsPath(filePath) {
  const segments = filePath
    .replaceAll('\\', '/')
    .replace(/^(\.\/)+/, '')
    .split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return false;
  }
  if (segments[0] === '.planning' && segments.length > 1) {
    return true;
  }
  const first = (segments[0] ?? '').toLowerCase();
  return /\.md$/i.test(segments.join('/')) && !CODE_FOLDERS.has(first);
}

/**
 * The mode for one run. An empty or missing file list is never `docs`, and only a proven tree becomes `package`.
 * @param {{ event: string, draft?: boolean, changedFiles?: readonly string[], treeProven?: boolean }} input
 * @returns {string}
 */
export function classify({ event, draft, changedFiles, treeProven }) {
  if (event === 'pull_request') {
    if (draft === true) {
      return MODES.fast;
    }
    const onlyDocs = changedFiles !== undefined && changedFiles.length > 0 && changedFiles.every(isDocsPath);
    return onlyDocs ? MODES.docs : MODES.full;
  }
  if (event === 'push') {
    return treeProven === true ? MODES.package : MODES.full;
  }
  return MODES.full;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {string} repo */
function isRepositoryName(repo) {
  const parts = repo.split('/');
  return REPOSITORY.test(repo) && parts.every((part) => part !== '.' && part !== '..');
}

/**
 * One `gh api` call whose answer must be valid JSON. The reason never repeats gh's output or error text.
 * @param {GhRunner} gh
 * @param {string} endpoint
 * @param {string} label
 * @returns {{ ok: true, value: unknown } | { ok: false, reason: string }}
 */
function ghJson(gh, endpoint, label) {
  /** @type {SpawnResult} */
  let result;
  try {
    result = gh(['api', endpoint]);
  } catch {
    return { ok: false, reason: `gh could not run for ${label}` };
  }
  if (result.status !== 0) {
    return { ok: false, reason: `gh failed for ${label}` };
  }
  try {
    return { ok: true, value: JSON.parse(result.stdout ?? '') };
  } catch {
    return { ok: false, reason: `gh returned invalid JSON for ${label}` };
  }
}

/**
 * @param {GhRunner} gh
 * @param {string} repo
 * @param {string} commit
 * @returns {{ ok: true, tree: string } | { ok: false, reason: string }}
 */
function treeOf(gh, repo, commit) {
  const answer = ghJson(gh, `repos/${repo}/git/commits/${commit}`, 'the commit tree lookup');
  if (!answer.ok) {
    return answer;
  }
  const tree = isRecord(answer.value) && isRecord(answer.value.tree) ? answer.value.tree.sha : undefined;
  return typeof tree === 'string' && tree !== ''
    ? { ok: true, tree }
    : { ok: false, reason: 'a commit answer has no tree id' };
}

/**
 * Pattern 9: a commit pushed to main may skip the heavy suite only when the pull request that produced it already passed
 * it on the identical tree. Proven means all of: exactly one merged PR claims the commit as its merge commit, that PR's
 * head commit has the same git tree id, and the head has a completed, successful `gate (full)` run. Any missing data,
 * mismatch or API failure is not proven.
 * @param {{ sha: string, repo: string, gh: GhRunner }} input
 * @returns {{ proven: boolean, reason: string }}
 */
export function findProvenTree({ sha, repo, gh }) {
  /** @param {string} reason */
  const unproven = (reason) => ({ proven: false, reason });
  if (!COMMIT_ID.test(sha)) {
    return unproven('GITHUB_SHA is missing or not a commit id');
  }
  if (!isRepositoryName(repo)) {
    return unproven('GITHUB_REPOSITORY is missing or not owner/name');
  }

  const pulls = ghJson(gh, `repos/${repo}/commits/${sha}/pulls`, 'the pull request lookup');
  if (!pulls.ok) {
    return unproven(pulls.reason);
  }
  if (!Array.isArray(pulls.value)) {
    return unproven('the pull request lookup did not return a list');
  }
  /** @type {unknown[]} */
  const answers = pulls.value;
  const claimants = answers.filter(
    (pr) => isRecord(pr) && typeof pr.merged_at === 'string' && pr.merged_at !== '' && pr.merge_commit_sha === sha,
  );
  if (claimants.length === 0) {
    return unproven('no merged pull request produced this commit');
  }
  const [pr] = claimants;
  if (claimants.length > 1 || !isRecord(pr)) {
    return unproven('more than one merged pull request claims this commit');
  }
  const headSha = isRecord(pr.head) ? pr.head.sha : undefined;
  if (typeof headSha !== 'string' || !COMMIT_ID.test(headSha)) {
    return unproven('the merged pull request has no head commit id');
  }

  const pushedTree = treeOf(gh, repo, sha);
  if (!pushedTree.ok) {
    return unproven(pushedTree.reason);
  }
  const headTree = treeOf(gh, repo, headSha);
  if (!headTree.ok) {
    return unproven(headTree.reason);
  }
  if (pushedTree.tree !== headTree.tree) {
    return unproven('the pushed tree differs from the pull request head tree');
  }

  const checks = ghJson(gh, `repos/${repo}/commits/${headSha}/check-runs?per_page=100`, 'the check run lookup');
  if (!checks.ok) {
    return unproven(checks.reason);
  }
  const runList = isRecord(checks.value) ? checks.value.check_runs : undefined;
  if (!Array.isArray(runList)) {
    return unproven('the check run lookup did not return a list');
  }
  /** @type {unknown[]} */
  const runs = runList;
  const gateRuns = runs.filter((run) => isRecord(run) && run.name === GATE_CHECK);
  if (gateRuns.length === 0) {
    return unproven(`the pull request head has no ${GATE_CHECK} run`);
  }
  const allPassed = gateRuns.every(
    (run) => isRecord(run) && run.status === 'completed' && run.conclusion === 'success',
  );
  if (!allPassed) {
    return unproven(`the ${GATE_CHECK} run on the pull request head did not succeed`);
  }
  return {
    proven: true,
    reason: `tree ${pushedTree.tree.slice(0, 12)} already passed ${GATE_CHECK} on the pull request`,
  };
}

/**
 * @param {string} reason
 * @returns {Decision}
 */
function fullBecause(reason) {
  return { mode: MODES.full, reason };
}

/**
 * The files changed between the pull request's merge base and its head. `--no-renames` lists both paths of a move, so
 * moving code into a documentation folder cannot hide the code path.
 * @param {Spawner} spawn
 * @param {string} base
 * @param {string} head
 * @returns {{ ok: true, files: string[] } | { ok: false, reason: string }}
 */
function changedFilesBetween(spawn, base, head) {
  /** @type {SpawnResult} */
  let result;
  try {
    result = spawn('git', ['diff', '--name-only', '--no-renames', `${base}...${head}`], {
      encoding: 'utf8',
      maxBuffer: MAX_DIFF_BYTES,
    });
  } catch {
    return { ok: false, reason: 'git diff failed to run, so the full gate runs' };
  }
  if (result.status !== 0) {
    const detail = result.status === null ? 'did not finish' : `exited with ${String(result.status)}`;
    return { ok: false, reason: `git diff failed (${detail}), so the full gate runs` };
  }
  const files = (result.stdout ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  return { ok: true, files };
}

/**
 * @param {Readonly<Record<string, string | undefined>>} env
 * @param {Spawner} spawn
 * @returns {Decision}
 */
function decide(env, spawn) {
  const event = env.GITHUB_EVENT_NAME?.trim() ?? '';
  if (event === 'pull_request') {
    if (env.PR_DRAFT === 'true') {
      return { mode: classify({ event, draft: true }), reason: 'draft pull request' };
    }
    const base = env.BASE_SHA?.trim() ?? '';
    const head = env.HEAD_SHA?.trim() ?? '';
    if (!COMMIT_ID.test(base) || !COMMIT_ID.test(head)) {
      return fullBecause('the base or head commit id is missing or not a commit id, so the full gate runs');
    }
    const diff = changedFilesBetween(spawn, base, head);
    if (!diff.ok) {
      return fullBecause(diff.reason);
    }
    if (diff.files.length === 0) {
      return fullBecause('no changed files were found, so the full gate runs');
    }
    const mode = classify({ event, draft: false, changedFiles: diff.files });
    const count = String(diff.files.length);
    return {
      mode,
      reason:
        mode === MODES.docs
          ? `${count} changed files, all documentation`
          : `${count} changed files include more than documentation`,
    };
  }
  if (event === 'push') {
    const proven = findProvenTree({
      sha: env.GITHUB_SHA?.trim() ?? '',
      repo: env.GITHUB_REPOSITORY?.trim() ?? '',
      gh: (args) => spawn('gh', args, { encoding: 'utf8', maxBuffer: MAX_DIFF_BYTES }),
    });
    return proven.proven
      ? { mode: classify({ event, treeProven: true }), reason: proven.reason }
      : fullBecause(`${proven.reason}, so the full gate runs`);
  }
  return fullBecause(`${event === '' ? 'unknown' : event} event runs the full gate`);
}

/**
 * Writes exactly one `mode=<value>` line to the file named by GITHUB_OUTPUT.
 * @param {Readonly<Record<string, string | undefined>>} [env]
 * @param {Deps} [deps]
 * @returns {number} 0 when the mode was written, 2 when GITHUB_OUTPUT is missing or cannot be written.
 */
export function main(env = process.env, deps = {}) {
  /** @type {Spawner} */
  const spawn = deps.spawn ?? ((command, args, options) => spawnSync(command, args, options));
  const appendOutput =
    deps.appendOutput ??
    ((file, text) => {
      appendFileSync(file, text);
    });
  const log = deps.log ?? ((line) => process.stdout.write(`${line}\n`));
  const error = deps.error ?? ((line) => process.stderr.write(`${line}\n`));

  const outputFile = env.GITHUB_OUTPUT?.trim() ?? '';
  if (outputFile === '') {
    error('ci-classify: GITHUB_OUTPUT is not set, so the mode has nowhere to go.');
    return 2;
  }
  const { mode, reason } = decide(env, spawn);
  try {
    appendOutput(outputFile, `mode=${mode}\n`);
  } catch {
    error('ci-classify: could not write the mode to GITHUB_OUTPUT.');
    return 2;
  }
  log(`ci-classify: mode=${mode} (${reason})`);
  return 0;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
