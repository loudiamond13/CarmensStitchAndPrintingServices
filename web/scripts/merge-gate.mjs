// @ts-check
// The process merge gate (OPS-01, D-08). GitHub's ruleset on main enforces the checks, but it cannot read the Definition of Done list, so the one
// supported merge command (tools/scripts/Merge-PullRequest.ps1) runs this first and merges only when it prints `head=<sha>`.
//
// A pull request may merge only when it is open, targets main, is not a draft, is 0 commits behind main, has no merge
// conflicts, has a passing `gate (full)` or `gate (docs)` check on its head commit, has no check that failed, is still
// running or was cancelled, and every task-list item under the Definition of Done heading in its body is ticked. Every
// rule fails closed (T-03-10): zero checks, only `gate (fast)`, a missing section, or gh output that cannot be read all
// refuse.
//
// `--local-gate` (D-16, for months when the free CI minutes run out) swaps the green-check rule for a "Local full gate"
// section in the body that lists the five local commands, each on a line that says `exit 0`. Every other rule, including
// the refusal of a failed check, still applies, and a loud warning goes to stderr.
//
// The /gsd-ship `[ci skip]` ship note (owner ruling "parent-rule", 2026-10-15T22:05-05:00, T-03-12): GitHub runs no checks
// on a commit whose message has a skip token. A head commit with a skip token that changes nothing outside `.planning/`
// and has exactly one parent is judged by that parent instead, which must have a passing gate check and nothing failed or
// running. Any other skip-token head is refused until a commit without a skip token runs CI.
//
// The merge command also takes the squash commit subject and body from this gate. They are built from the PR title
// (`<title> (#<n>)`), never GitHub's default of every commit message, and the gate refuses a title that holds a skip
// marker, a double quote or a control character.
//
// Node built-ins only, and the preinstalled GitHub CLI (gh.exe is spawned directly; it is not a .cmd shim). This file
// never merges anything: it only reads.
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** The tokens GitHub reads in a commit message to skip workflow runs. */
export const SKIP_TOKENS = Object.freeze([
  '[skip ci]',
  '[ci skip]',
  '[no ci]',
  '[skip actions]',
  '[actions skip]',
  'skip-checks: true',
]);
/** The job names that count as the green gate: the full pipeline, or the documentation-only pipeline. */
export const GATE_CHECKS = Object.freeze(['gate (full)', 'gate (docs)']);
/** The PR body heading whose task-list items must all be ticked (shared text contract with the PR template, plan 03-05). */
export const DOD_HEADING = '## Definition of Done';
/** The PR body heading for the pasted local gate output (D-16, shared text contract with the PR template). */
export const LOCAL_GATE_HEADING = '## Local full gate';
/** The five D-16 commands, as substrings matched against the lines of the Local full gate section. */
export const LOCAL_GATE_COMMANDS = Object.freeze([
  'dotnet build Csps.slnx',
  'dotnet test --solution Csps.slnx',
  'Invoke-CoverageGate.ps1',
  'npm --prefix web run verify',
  'npm --prefix web run e2e',
]);
export const LOCAL_GATE_WARNING =
  'WARNING: merging on the local full gate (D-16) because the free CI minutes are used up. CI did not check this PR.';

const FAST_CHECK = 'gate (fast)';
const BASE_BRANCH = 'main';
const PLANNING_FOLDER = '.planning';
/** GitHub lists at most 300 files for one commit, so a list this long may be cut off and proves nothing. */
const FILE_LIST_LIMIT = 300;
const MAX_GH_BYTES = 16 * 1024 * 1024;
const COMMIT_ID = /^[0-9a-f]{40}$/;
const REPOSITORY = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHIP_NOTE_PREFIX = 'Ship note rule: ';
const OK_CONCLUSIONS = new Set(['success', 'skipped', 'neutral']);
const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
/** Any skip marker GitHub reads, in any letter case and with spaces inside the brackets. */
const SKIP_MARKER = /\[\s*(?:skip\s*ci|ci\s*skip|no\s*ci|skip\s*actions|actions\s*skip)\s*\]|skip-checks\s*:\s*true/gi;
const USAGE = 'Usage: node web/scripts/merge-gate.mjs <pull-request-number> [--local-gate]';

/**
 * @typedef {{ number: number, state: string, isDraft: boolean, baseRefName: string, headRefOid: string, title: string, body: string, mergeable: string }} PullRequest
 * @typedef {{ name: string, bucket: string }} PrCheck
 * @typedef {{ message: string, parents: readonly string[], files: readonly string[] }} HeadCommit
 * @typedef {{ name: string, status: string, conclusion: string | null }} CheckRun
 * @typedef {{ pr: PullRequest, checks: readonly PrCheck[], behindBy: number | null, headCommit?: HeadCommit | undefined, parentChecks?: readonly CheckRun[] | undefined, localGate?: boolean | undefined }} GateInput
 * @typedef {{ allowed: boolean, reasons: string[] }} Verdict
 * @typedef {{ subject: string, body: string }} SquashMessage
 * @typedef {{ status: number | null, stdout?: string | null, stderr?: string | null }} RunResult
 * @typedef {(command: string, args: readonly string[]) => RunResult} GhRun
 * @typedef {{ run?: GhRun, log?: (line: string) => void, error?: (line: string) => void }} Deps
 */

/** A gh answer that is missing, unreadable or incomplete. The gate refuses with the message, which never repeats gh output. */
export class GateInputError extends Error {}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {string} message */
function hasSkipToken(message) {
  return SKIP_TOKENS.some((token) => message.includes(token));
}

/**
 * Every skip marker in the text, as written.
 * @param {string} text
 * @returns {string[]}
 */
export function skipMarkersIn(text) {
  return [...text.matchAll(SKIP_MARKER)].map((match) => match[0]);
}

/**
 * The squash commit message: the PR title and a fixed one-line body. The PR body and the commit log never enter it.
 * @param {PullRequest} pr
 * @returns {SquashMessage}
 */
export function squashMessage(pr) {
  const number = String(pr.number);
  return {
    subject: `${pr.title.trim()} (#${number})`,
    body: `Merged from pull request #${number} at head commit ${pr.headRefOid} by tools/scripts/Merge-PullRequest.ps1.`,
  };
}

/**
 * @param {string} text
 * @returns {boolean}
 */
function hasControlCharacter(text) {
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x1f || code === 0x7f) {
      return true;
    }
  }
  return false;
}

/**
 * Why the squash message cannot be used: an empty title, a character that would split the gh arguments, or a skip marker
 * that would stop every workflow on main.
 * @param {PullRequest} pr
 * @returns {string[]}
 */
function squashMessageReasons(pr) {
  const title = pr.title.trim();
  /** @type {string[]} */
  const reasons = [];
  if (title === '') {
    reasons.push('The pull request title is empty. Give it a title first.');
  }
  if (title.includes('"')) {
    reasons.push(
      'The pull request title has a double quote ("), which the merge command cannot pass to gh safely. Remove it from the title.',
    );
  }
  if (hasControlCharacter(title)) {
    reasons.push('The pull request title has a control character. Remove it from the title.');
  }
  const message = squashMessage(pr);
  const text = [message.subject, message.body].join('\n');
  for (const match of skipMarkersIn(text)) {
    reasons.push(
      `The squash commit message would contain the GitHub skip marker "${match}", so no workflow would run on main after the merge. Remove it from the pull request title.`,
    );
  }
  return reasons;
}

/**
 * True for a git path inside `.planning/`. Backslashes, empty, `.` and `..` segments are never accepted, so a path cannot
 * climb out of the folder or hide behind a lookalike name.
 * @param {string} filePath
 * @returns {boolean}
 */
function isPlanningPath(filePath) {
  if (filePath.includes('\\')) {
    return false;
  }
  const segments = filePath.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    return false;
  }
  return segments[0] === PLANNING_FOLDER && segments.length > 1;
}

/**
 * The ship-note test: the commit carries a skip token, has exactly one parent, and every path it touches (both paths of
 * a rename) is under `.planning/`. An empty or possibly cut-off file list proves nothing, so it does not qualify.
 * @param {HeadCommit | undefined} headCommit
 * @returns {boolean}
 */
export function isPlanningOnlySkipHead(headCommit) {
  if (headCommit === undefined) {
    return false;
  }
  return (
    hasSkipToken(headCommit.message) &&
    headCommit.parents.length === 1 &&
    headCommit.files.length > 0 &&
    headCommit.files.length < FILE_LIST_LIMIT &&
    headCommit.files.every(isPlanningPath)
  );
}

/**
 * The lines under every heading equal to `heading`, up to the next heading of level 1 or 2. Fenced code blocks are skipped,
 * so a sample heading or checkbox inside one counts for nothing.
 * @param {string} body
 * @param {string} heading
 * @returns {string[][]}
 */
function sectionsUnder(body, heading) {
  /** @type {string[][]} */
  const sections = [];
  /** @type {string[] | null} */
  let current = null;
  /** @type {string | null} */
  let fence = null;
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const marker = /^\s*(```|~~~)/.exec(line)?.[1];
    if (marker !== undefined) {
      if (fence === null) {
        fence = marker;
      } else if (fence === marker) {
        fence = null;
      }
      continue;
    }
    if (fence !== null) {
      continue;
    }
    if (/^#{1,2}\s/.test(line)) {
      current = line === heading ? [] : null;
      if (current !== null) {
        sections.push(current);
      }
      continue;
    }
    current?.push(line);
  }
  return sections;
}

/**
 * @param {string} line
 * @returns {{ ticked: boolean, text: string } | null}
 */
function taskItem(line) {
  const match = /^\s*[-*+]\s+\[([ xX])\]\s*(.*)$/.exec(line);
  if (match === null) {
    return null;
  }
  const text = (match[2] ?? '').trim();
  return { ticked: match[1] !== ' ', text: text === '' ? '(no text)' : text.slice(0, 120) };
}

/**
 * @param {string} body
 * @returns {string[]}
 */
function definitionOfDoneReasons(body) {
  const sections = sectionsUnder(body, DOD_HEADING);
  if (sections.length === 0) {
    return [`The pull request body has no "${DOD_HEADING}" section.`];
  }
  const items = sections.flatMap((section) => section.map(taskItem).filter((item) => item !== null));
  if (items.length === 0) {
    return [`The "${DOD_HEADING}" section has no task-list items.`];
  }
  return items.filter((item) => !item.ticked).map((item) => `Definition of Done item not ticked: ${item.text}`);
}

/**
 * True when every exit code written on the line is 0, and at least one is written. "exit 01" and "exit 10" are not 0.
 * @param {string} line
 * @returns {boolean}
 */
function saysExitZero(line) {
  const codes = [...line.matchAll(/\bexit\s+(\d+)\b/gi)].map((match) => match[1]);
  return codes.length > 0 && codes.every((code) => code === '0');
}

/**
 * D-16: the body must hold a Local full gate section with a line for each of the five commands, and one of those lines
 * must say exit 0. A fenced code block or another section does not count.
 * @param {string} body
 * @returns {string[]}
 */
function localGateReasons(body) {
  const sections = sectionsUnder(body, LOCAL_GATE_HEADING);
  if (sections.length === 0) {
    return [`The pull request body has no "${LOCAL_GATE_HEADING}" section.`];
  }
  const lines = sections.flat();
  return LOCAL_GATE_COMMANDS.flatMap((command) => {
    const matching = lines.filter((line) => line.includes(command));
    if (matching.length === 0) {
      return [`The "${LOCAL_GATE_HEADING}" section has no line for "${command}".`];
    }
    return matching.some(saysExitZero)
      ? []
      : [`The "${LOCAL_GATE_HEADING}" line for "${command}" does not say exit 0.`];
  });
}

/**
 * @param {string} bucket
 * @returns {string}
 */
function describeBucket(bucket) {
  switch (bucket) {
    case 'fail':
      return 'failed';
    case 'pending':
      return 'is still running';
    case 'cancel':
      return 'was cancelled';
    default:
      return `has an unknown result ("${bucket}")`;
  }
}

/**
 * The ship-note rule: the parent must have a passing gate check, with nothing failed, cancelled or still running.
 * @param {readonly CheckRun[] | undefined} parentChecks
 * @returns {string[]}
 */
function parentReasons(parentChecks) {
  if (parentChecks === undefined) {
    return [`${SHIP_NOTE_PREFIX}the checks on the commit before the ship note could not be read.`];
  }
  /** @type {string[]} */
  const reasons = [];
  for (const checkRun of parentChecks) {
    if (checkRun.status !== 'completed') {
      reasons.push(`${SHIP_NOTE_PREFIX}the check "${checkRun.name}" on the commit before it is still running.`);
    } else if (checkRun.conclusion === null || !OK_CONCLUSIONS.has(checkRun.conclusion)) {
      reasons.push(
        `${SHIP_NOTE_PREFIX}the check "${checkRun.name}" on the commit before it did not succeed (${String(checkRun.conclusion)}).`,
      );
    }
  }
  const gatePassed = parentChecks.some(
    (checkRun) =>
      GATE_CHECKS.includes(checkRun.name) && checkRun.status === 'completed' && checkRun.conclusion === 'success',
  );
  if (!gatePassed && reasons.length === 0) {
    return [`${SHIP_NOTE_PREFIX}the commit before the ship note has no passing "gate (full)" or "gate (docs)" check.`];
  }
  return reasons;
}

/**
 * The green-gate rule for a head commit that has no passing gate check of its own.
 * @param {GateInput} input
 * @returns {string[]}
 */
function missingGateReasons({ pr, checks, headCommit, parentChecks }) {
  const sha = pr.headRefOid.slice(0, 7);
  if (isPlanningOnlySkipHead(headCommit)) {
    return parentReasons(parentChecks);
  }
  if (headCommit !== undefined && hasSkipToken(headCommit.message)) {
    return [
      `The newest commit (${sha}) has a skip token but is not a planning-only note, so CI did not check it. Push a commit without a skip token so CI runs.`,
    ];
  }
  if (checks.length === 0) {
    return [`No checks have run on the newest commit (${sha}).`];
  }
  if (checks.some((checkRun) => checkRun.name === FAST_CHECK)) {
    return [
      `Only "${FAST_CHECK}" ran on the newest commit (${sha}). Mark the pull request ready for review so the full gate runs.`,
    ];
  }
  return [`Neither "gate (full)" nor "gate (docs)" ran on the newest commit (${sha}).`];
}

/**
 * The merge decision, pure over the data gh returned. Reasons come in a fixed order: pull request state, base branch,
 * draft, behind, conflicts, the green gate (or, with `localGate`, the Local full gate section), other checks, the
 * Definition of Done, then the squash commit message.
 * @param {GateInput} input
 * @returns {Verdict}
 */
export function decide(input) {
  const { pr, checks, behindBy, localGate = false } = input;
  const body = typeof pr.body === 'string' ? pr.body : '';
  /** @type {string[]} */
  const reasons = [];

  if (pr.state !== 'OPEN') {
    reasons.push(`The pull request is not open (it is ${pr.state.toLowerCase()}).`);
  }
  if (pr.baseRefName !== BASE_BRANCH) {
    reasons.push(`The pull request targets "${pr.baseRefName}", not ${BASE_BRANCH}.`);
  }
  if (pr.isDraft) {
    reasons.push('The pull request is a draft. Mark it ready for review first.');
  }
  if (behindBy === null || !Number.isInteger(behindBy) || behindBy < 0) {
    reasons.push(`Could not tell how far the branch is behind ${BASE_BRANCH}. Try again.`);
  } else if (behindBy > 0) {
    reasons.push(
      `The branch is ${String(behindBy)} commit${behindBy === 1 ? '' : 's'} behind ${BASE_BRANCH}. Update it first.`,
    );
  }
  if (pr.mergeable === 'CONFLICTING') {
    reasons.push(`The branch has merge conflicts with ${BASE_BRANCH}. Resolve them first.`);
  } else if (pr.mergeable !== 'MERGEABLE') {
    reasons.push(
      'GitHub has not finished checking whether the branch can merge. Wait a moment and run the command again.',
    );
  }

  if (localGate) {
    reasons.push(...localGateReasons(body));
  } else {
    const gateRuns = checks.filter((checkRun) => GATE_CHECKS.includes(checkRun.name));
    const gatePassed = gateRuns.some((checkRun) => checkRun.bucket === 'pass');
    const gateBad = gateRuns.some((checkRun) => checkRun.bucket !== 'pass' && checkRun.bucket !== 'skipping');
    if (!gatePassed && !gateBad) {
      reasons.push(...missingGateReasons(input));
    }
  }

  for (const checkRun of checks) {
    if (checkRun.bucket !== 'pass' && checkRun.bucket !== 'skipping') {
      reasons.push(`The check "${checkRun.name}" ${describeBucket(checkRun.bucket)}.`);
    }
  }

  reasons.push(...definitionOfDoneReasons(body));
  reasons.push(...squashMessageReasons(pr));

  return { allowed: reasons.length === 0, reasons };
}

/**
 * @param {GhRun} run
 * @param {readonly string[]} args
 * @param {string} label
 * @returns {RunResult}
 */
function callGh(run, args, label) {
  try {
    return run('gh', args);
  } catch {
    throw new GateInputError(`gh could not start while reading ${label}. Is the GitHub CLI installed?`);
  }
}

/**
 * @param {string | null | undefined} text
 * @param {string} label
 * @returns {unknown}
 */
function parseJson(text, label) {
  try {
    return JSON.parse(text ?? '');
  } catch {
    throw new GateInputError(`The answer for ${label} is not valid JSON.`);
  }
}

/**
 * One gh call whose answer must be valid JSON. The message never repeats gh's output or error text (CWE-532).
 * @param {GhRun} run
 * @param {readonly string[]} args
 * @param {string} label
 * @returns {unknown}
 */
function readJson(run, args, label) {
  const result = callGh(run, args, label);
  if (result.status !== 0) {
    throw new GateInputError(`gh failed while reading ${label}. Run "gh auth status" to check you are signed in.`);
  }
  return parseJson(result.stdout, label);
}

/** @param {string} label */
function unusable(label) {
  return new GateInputError(`The answer for ${label} is not usable.`);
}

/**
 * @param {GhRun} run
 * @returns {string}
 */
function readRepository(run) {
  const label = 'the repository';
  const answer = readJson(run, ['repo', 'view', '--json', 'nameWithOwner'], label);
  const slug = isRecord(answer) ? answer.nameWithOwner : undefined;
  if (
    typeof slug !== 'string' ||
    !REPOSITORY.test(slug) ||
    slug.split('/').some((part) => part === '.' || part === '..')
  ) {
    throw unusable(label);
  }
  return slug;
}

/**
 * @param {GhRun} run
 * @param {string} slug
 * @param {number} prNumber
 * @returns {PullRequest}
 */
function readPullRequest(run, slug, prNumber) {
  const label = 'the pull request';
  const answer = readJson(
    run,
    [
      'pr',
      'view',
      String(prNumber),
      '--repo',
      slug,
      '--json',
      'number,state,isDraft,baseRefName,headRefOid,title,body,mergeable',
    ],
    label,
  );
  if (
    !isRecord(answer) ||
    typeof answer.number !== 'number' ||
    typeof answer.state !== 'string' ||
    typeof answer.isDraft !== 'boolean' ||
    typeof answer.baseRefName !== 'string' ||
    typeof answer.headRefOid !== 'string' ||
    !COMMIT_ID.test(answer.headRefOid) ||
    typeof answer.title !== 'string' ||
    (typeof answer.body !== 'string' && answer.body !== null) ||
    typeof answer.mergeable !== 'string'
  ) {
    throw unusable(label);
  }
  return {
    number: answer.number,
    state: answer.state,
    isDraft: answer.isDraft,
    baseRefName: answer.baseRefName,
    headRefOid: answer.headRefOid,
    title: answer.title,
    body: answer.body ?? '',
    mergeable: answer.mergeable,
  };
}

/**
 * `gh pr checks` prints its JSON and then exits 1 for a failing check or 8 for a pending one. With no checks at all it
 * prints "no checks reported" and exits 1, which is an empty list.
 * @param {GhRun} run
 * @param {string} slug
 * @param {number} prNumber
 * @returns {PrCheck[]}
 */
function readChecks(run, slug, prNumber) {
  const label = 'the check list';
  const result = callGh(
    run,
    ['pr', 'checks', String(prNumber), '--repo', slug, '--json', 'name,state,bucket,workflow'],
    label,
  );
  if (result.status !== 0 && result.status !== 1 && result.status !== 8) {
    throw new GateInputError(`gh failed while reading ${label}. Run "gh auth status" to check you are signed in.`);
  }
  /** @type {unknown} */
  let answer;
  try {
    answer = JSON.parse(result.stdout ?? '');
  } catch {
    if (/no checks reported/i.test(`${result.stdout ?? ''}\n${result.stderr ?? ''}`)) {
      return [];
    }
    throw new GateInputError(`The answer for ${label} is not valid JSON.`);
  }
  if (!Array.isArray(answer)) {
    throw unusable(label);
  }
  /** @type {unknown[]} */
  const items = answer;
  return items.map((item) => {
    if (!isRecord(item) || typeof item.name !== 'string' || typeof item.bucket !== 'string') {
      throw unusable(label);
    }
    return { name: item.name, bucket: item.bucket };
  });
}

/**
 * Without branch protection `mergeStateStatus` does not report BEHIND reliably, so ask the compare API.
 * @param {GhRun} run
 * @param {string} slug
 * @param {string} headSha
 * @returns {number}
 */
function readBehindBy(run, slug, headSha) {
  const label = 'the commits behind main';
  const result = callGh(run, ['api', `repos/${slug}/compare/${BASE_BRANCH}...${headSha}`, '--jq', '.behind_by'], label);
  if (result.status !== 0) {
    throw new GateInputError(`gh failed while reading ${label}. Run "gh auth status" to check you are signed in.`);
  }
  const text = (result.stdout ?? '').trim();
  if (!/^\d+$/.test(text)) {
    throw unusable(label);
  }
  return Number(text);
}

/**
 * @param {GhRun} run
 * @param {string} slug
 * @param {string} sha
 * @returns {HeadCommit}
 */
function readHeadCommit(run, slug, sha) {
  const label = 'the head commit';
  const answer = readJson(run, ['api', `repos/${slug}/commits/${sha}`], label);
  if (!isRecord(answer) || !isRecord(answer.commit) || typeof answer.commit.message !== 'string') {
    throw unusable(label);
  }
  if (!Array.isArray(answer.parents) || !Array.isArray(answer.files)) {
    throw unusable(label);
  }
  /** @type {unknown[]} */
  const parentList = answer.parents;
  /** @type {unknown[]} */
  const fileList = answer.files;
  const parents = parentList.map((parent) => {
    if (!isRecord(parent) || typeof parent.sha !== 'string' || !COMMIT_ID.test(parent.sha)) {
      throw unusable(label);
    }
    return parent.sha;
  });
  // Both paths of a rename are listed, so moving code into .planning cannot hide where it came from.
  const files = fileList.flatMap((file) => {
    if (!isRecord(file) || typeof file.filename !== 'string') {
      throw unusable(label);
    }
    return typeof file.previous_filename === 'string' ? [file.filename, file.previous_filename] : [file.filename];
  });
  return { message: answer.commit.message, parents, files };
}

/**
 * @param {GhRun} run
 * @param {string} slug
 * @param {string} sha
 * @returns {CheckRun[]}
 */
function readCheckRuns(run, slug, sha) {
  const label = 'the commit before the ship note';
  const answer = readJson(run, ['api', `repos/${slug}/commits/${sha}/check-runs?per_page=100`], label);
  if (!isRecord(answer) || !Array.isArray(answer.check_runs) || typeof answer.total_count !== 'number') {
    throw unusable(label);
  }
  /** @type {unknown[]} */
  const runs = answer.check_runs;
  if (answer.total_count > runs.length) {
    throw new GateInputError(
      'The commit before the ship note has more check runs than could be read at once, so it cannot be judged.',
    );
  }
  return runs.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.name !== 'string' ||
      typeof item.status !== 'string' ||
      (typeof item.conclusion !== 'string' && item.conclusion !== null)
    ) {
      throw unusable(label);
    }
    return { name: item.name, status: item.status, conclusion: item.conclusion };
  });
}

/**
 * Reads everything `decide` needs through gh. The parent commit's check runs are read only when the ship-note rule needs
 * them: the head is a planning-only skip-token commit with no passing gate check of its own.
 * @param {number} prNumber
 * @param {GhRun} run
 * @returns {GateInput}
 */
export function collect(prNumber, run) {
  const slug = readRepository(run);
  const pr = readPullRequest(run, slug, prNumber);
  const checks = readChecks(run, slug, prNumber);
  const behindBy = readBehindBy(run, slug, pr.headRefOid);
  const headCommit = readHeadCommit(run, slug, pr.headRefOid);
  const headPassed = checks.some((checkRun) => GATE_CHECKS.includes(checkRun.name) && checkRun.bucket === 'pass');
  const parent = headCommit.parents[0];
  const parentChecks =
    !headPassed && isPlanningOnlySkipHead(headCommit) && parent !== undefined
      ? readCheckRuns(run, slug, parent)
      : undefined;
  return { pr, checks, behindBy, headCommit, parentChecks };
}

/** @type {GhRun} */
function spawnGh(command, args) {
  return spawnSync(command, args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: MAX_GH_BYTES });
}

/**
 * @param {readonly string[]} argv
 * @returns {{ prNumber: number, localGate: boolean } | null}
 */
function parseArguments(argv) {
  let localGate = false;
  /** @type {string[]} */
  const numbers = [];
  for (const arg of argv) {
    if (arg === '--local-gate') {
      if (localGate) {
        return null;
      }
      localGate = true;
    } else {
      numbers.push(arg);
    }
  }
  const [first] = numbers;
  if (numbers.length !== 1 || first === undefined || !/^[1-9]\d*$/.test(first)) {
    return null;
  }
  return { prNumber: Number(first), localGate };
}

/**
 * The CLI: exit 0 and print `head=<sha>` and the base64 squash subject and body when the merge is allowed, exit 1 and
 * print each reason when it is refused, exit 2
 * for bad arguments.
 * @param {readonly string[]} argv
 * @param {Deps} [deps]
 * @returns {number}
 */
export function main(argv, deps = {}) {
  const run = deps.run ?? spawnGh;
  const log = deps.log ?? ((/** @type {string} */ line) => process.stdout.write(`${line}\n`));
  const error = deps.error ?? ((/** @type {string} */ line) => process.stderr.write(`${line}\n`));

  const parsed = parseArguments(argv);
  if (parsed === null) {
    error(USAGE);
    return 2;
  }
  const { prNumber, localGate } = parsed;
  if (localGate) {
    error(LOCAL_GATE_WARNING);
  }

  /** @type {Verdict} */
  let verdict;
  /** @type {GateInput} */
  let data;
  try {
    data = collect(prNumber, run);
    verdict = decide({ ...data, localGate });
  } catch (caught) {
    if (!(caught instanceof GateInputError)) {
      throw caught;
    }
    error(`Merge gate refuses pull request #${String(prNumber)}:`);
    error(`- ${caught.message}`);
    return 1;
  }
  if (!verdict.allowed) {
    error(`Merge gate refuses pull request #${String(prNumber)}:`);
    for (const reason of verdict.reasons) {
      error(`- ${reason}`);
    }
    return 1;
  }
  log(`Merge gate allows pull request #${String(prNumber)}.`);
  const message = squashMessage(data.pr);
  log(`Squash commit subject: ${message.subject}`);
  log(`head=${data.pr.headRefOid}`);
  log(`subject-base64=${Buffer.from(message.subject, 'utf8').toString('base64')}`);
  log(`body-base64=${Buffer.from(message.body, 'utf8').toString('base64')}`);
  return 0;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
