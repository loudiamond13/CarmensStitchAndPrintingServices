// @ts-check
// The shared-machine gate (CLAUDE.md "Shared machine", TOOL-WR-08). Another project (TheBETSLLC) is developed on this
// machine at the same time. Before a run that starts a host, a browser or a full build (e2e, Lighthouse, owner review,
// parity), this gate runs the read-only shared preflight report (C:\Work\dev-tools\preflight.ps1, which belongs to
// both projects and is never edited here), reads it, and WAITS while one of this project's ports is in use by another
// program or another project's dev/test processes are listed. After 15 minutes it refuses with a plain message. It never
// stops, signals or changes anything outside this run.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const PREFLIGHT_SCRIPT = 'C:\\Work\\dev-tools\\preflight.ps1';
/** This project's ports (CLAUDE.md): Vite 5180, API 5115/7028, Playwright E2E host 5199. */
export const PREFLIGHT_PORTS = '5180,5115,7028,5199';
export const PREFLIGHT_ARGS = Object.freeze([
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  PREFLIGHT_SCRIPT,
  '-Ports',
  PREFLIGHT_PORTS,
]);
export const SHARED_MACHINE_TIMEOUT_MS = 15 * 60 * 1000;
export const SHARED_MACHINE_POLL_MS = 30_000;

/** A process line or port owner that belongs to TheBETSLLC: its folder, or its BetsLLC.* executables. */
export const OTHER_PROJECT = /TheBETSLLC|(?:^|[\s\\/"])BetsLLC\./i;
/** A port owner that belongs to this project: its folder, or its Csps.* executables. */
export const THIS_PROJECT = /CarmensStitchAndPrintingServices|(?:^|[\s\\/"])Csps\./i;
/** Editor helpers an open TheBETSLLC folder keeps running; they are not test or dev runs, so they never block. */
export const EDITOR_HELPER = /tsserver|typingsInstaller|language-?server|eslintServer|[\\/]\.vscode[\\/]/i;

const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));

/**
 * The reasons to wait in one preflight report: a port of this project in use by a program that is not this project's,
 * or a listed dev/test process of another project. A report without its "== Ports" section is a reason too, so a
 * changed or broken report never passes as clear.
 * @param {string} report the preflight's standard output
 * @returns {string[]}
 */
export function findBlockers(report) {
  /** @type {string[]} */
  const blockers = [];
  let section = '';
  let sawPorts = false;
  for (const raw of report.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.startsWith('== ')) {
      section = line.slice(3);
      sawPorts ||= section.startsWith('Ports');
      continue;
    }
    if (section.startsWith('Ports')) {
      const busy = /^\s*(\d+)\s+IN USE by (.*)$/.exec(line);
      if (busy !== null && !THIS_PROJECT.test(busy[2] ?? '')) {
        blockers.push(`port ${busy[1] ?? '?'} is in use by ${(busy[2] ?? '').trim()}`);
      }
    } else if (section.startsWith('Dev/test processes') && OTHER_PROJECT.test(line) && !EDITOR_HELPER.test(line)) {
      blockers.push(`another project's process is running: ${line.trim()}`);
    }
  }
  if (!sawPorts) {
    blockers.push('the preflight report has no "== Ports" section, so the machine could not be checked');
  }
  return blockers;
}

/**
 * Runs the preflight once with its output captured, then echoes it.
 * @returns {{ status: number | null, stdout: string }}
 */
function runPreflight() {
  const result = spawnSync('powershell', [...PREFLIGHT_ARGS], { cwd: REPO_ROOT, encoding: 'utf8' });
  process.stdout.write(result.stdout);
  if (result.stderr !== '') {
    process.stderr.write(result.stderr);
  }
  return { status: result.status, stdout: result.stdout };
}

/**
 * Waits until the shared machine is clear for this run.
 * @param {{ label: string, available?: boolean, run?: () => { status: number | null, stdout: string },
 *   timeoutMs?: number, pollMs?: number, now?: () => number, sleep?: (ms: number) => Promise<void>,
 *   log?: (line: string) => void }} options `label` prefixes every line (`e2e`, `parity`, ...).
 * @returns {Promise<string | null>} null when the run may start, otherwise the refusal message.
 */
export async function waitForSharedMachine({
  label,
  available = existsSync(PREFLIGHT_SCRIPT),
  run = runPreflight,
  timeoutMs = SHARED_MACHINE_TIMEOUT_MS,
  pollMs = SHARED_MACHINE_POLL_MS,
  now = Date.now,
  sleep = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    }),
  log = (line) => {
    process.stdout.write(`${line}\n`);
  },
}) {
  if (!available) {
    log(
      `${label}: ${PREFLIGHT_SCRIPT} is not on this machine, so the shared-machine check is skipped (expected on CI).`,
    );
    return null;
  }
  const deadline = now() + timeoutMs;
  let previous = '';
  for (;;) {
    const result = run();
    const blockers =
      result.status === 0
        ? findBlockers(result.stdout)
        : [`the preflight report failed with exit code ${String(result.status)}`];
    if (blockers.length === 0) {
      return null;
    }
    const remaining = deadline - now();
    if (remaining <= 0) {
      return (
        `${label}: the shared machine is still busy after 15 minutes: ${blockers.join('; ')}. ` +
        'Wait for the other run to finish, then run this again. Nothing was stopped (CLAUDE.md shared machine).'
      );
    }
    const text = blockers.join('; ');
    if (text !== previous) {
      previous = text;
      log(`${label}: waiting for the shared machine (up to 15 minutes; nothing is stopped): ${text}.`);
    }
    await sleep(Math.min(pollMs, remaining));
  }
}
