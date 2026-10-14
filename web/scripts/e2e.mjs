// @ts-check
// `npm run e2e` (QUAL-04, D-30, research Pattern 11): the only supported way to run the Playwright suite.
//   1. Takes the exclusive run lock web/.locks/e2e.lock (shared with the parity and Lighthouse runs, which start the same
//      host). A second run waits for it, up to 15 minutes, then exits 1 asking you to wait and retry.
//   2. Waits while the shared machine is busy (shared-machine.mjs reads the shared preflight report: one of this
//      project's ports in use by another program, or another project's test processes listed), up to 15 minutes, then
//      exits 1. It never stops any process (CLAUDE.md shared machine).
//   3. Refuses to start when port 5199 is in use.
//   4. Migrates and seeds CSPS_E2E on (localdb)\CSPS through the guarded dev-seed tool (idempotent).
//   5. Builds the e2e bundle into web/.e2e-dist (vite build --mode e2e).
//   6. Runs `playwright test` with this script's arguments (for example --grep @smoke --project webkit).
// Every child inherits this terminal's environment unchanged; nothing is set at User or Machine level. The API host's
// own variables are set on that one process by playwright.config.ts. Windows cannot spawn .cmd shims without a shell,
// so Node tools run on this Node binary with their JS entry (L-22).
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  closeSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeSync,
} from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PREFLIGHT_SCRIPT, waitForSharedMachine } from './shared-machine.mjs';

export { PREFLIGHT_SCRIPT };
export const E2E_PORT = 5199;
export const PORT_BUSY_MESSAGE = `Port ${String(E2E_PORT)} is in use by another process. Wait for it to finish; this script never stops other processes.`;
export const WEB_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));
export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const LOCK_PATH = path.join(WEB_DIRECTORY, '.locks', 'e2e.lock');
export const LOCK_TIMEOUT_MS = 15 * 60 * 1000;
/** A lock older than this is stale even when its pid looks alive (a pid can be reused); a full run takes ~30 minutes. */
export const LOCK_MAX_AGE_MS = 3 * 60 * 60 * 1000;

const LOCK_POLL_MS = 2000;

/**
 * @typedef {{ readonly kind: 'run', readonly name: 'seed' | 'build' | 'playwright', readonly command: string, readonly args: readonly string[], readonly cwd: string }} RunStep
 * @typedef {{ readonly kind: 'refuse', readonly name: 'port-busy', readonly message: string, readonly exitCode: 1 }} RefuseStep
 * @typedef {RunStep | RefuseStep} Step
 * @typedef {(command: string, args: readonly string[], options: { cwd: string, stdio: 'inherit' }) => { status: number | null }} Spawner
 */

/**
 * The run as data, so the order and the exact commands are unit-tested without starting anything.
 * @param {{ portBusy: boolean, extraArgs?: readonly string[] }} options
 * @returns {readonly Step[]}
 */
export function planSteps({ portBusy, extraArgs = [] }) {
  if (portBusy) {
    return [{ kind: 'refuse', name: 'port-busy', message: PORT_BUSY_MESSAGE, exitCode: 1 }];
  }
  /** @type {RunStep[]} */
  const steps = [];
  steps.push(
    // DevSeedTargetGuard refuses anything but CSPS_Dev/CSPS_E2E on (localdb)\CSPS before any connection opens (T-02-24).
    {
      kind: 'run',
      name: 'seed',
      command: 'dotnet',
      args: ['run', '--project', 'tools/Csps.DevSeed', '--', '--database', 'CSPS_E2E'],
      cwd: REPO_ROOT,
    },
    {
      kind: 'run',
      name: 'build',
      command: process.execPath,
      args: ['node_modules/vite/bin/vite.js', 'build', '--mode', 'e2e'],
      cwd: WEB_DIRECTORY,
    },
    {
      kind: 'run',
      name: 'playwright',
      command: process.execPath,
      args: ['node_modules/@playwright/test/cli.js', 'test', ...extraArgs],
      cwd: WEB_DIRECTORY,
    },
  );
  return steps;
}

/**
 * Runs the steps in order with inherited output and stops at the first failure.
 * @param {readonly Step[]} steps
 * @param {Spawner} [spawn]
 * @returns {number} 0 when every step passed, otherwise the failing step's exit code (1 for a signal or a refusal).
 */
export function executeSteps(steps, spawn = spawnSync) {
  for (const step of steps) {
    if (step.kind === 'refuse') {
      process.stderr.write(`e2e: ${step.message}\n`);
      return step.exitCode;
    }
    const status = spawn(step.command, step.args, { cwd: step.cwd, stdio: 'inherit' }).status ?? 1;
    if (status !== 0) {
      process.stderr.write(`e2e: ${step.name} failed with exit code ${String(status)}.\n`);
      return status;
    }
  }
  return 0;
}

/**
 * @param {string} file
 * @returns {string}
 */
export function lockTimeoutMessage(file) {
  return (
    `Another E2E, parity or Lighthouse run has held ${file} for 15 minutes. Wait for it to finish, then run this again. ` +
    `If no such run is going on (for example after a crash or a closed terminal), delete ${file} and run this again.`
  );
}

/**
 * True when a process with this pid is running. Read-only: it lists processes (tasklist on Windows, ps elsewhere) and
 * never signals one. When the check itself fails, the process counts as alive, so the run waits instead of taking a
 * lock that may still be held.
 * @param {number} pid
 * @returns {boolean}
 */
export function processIsAlive(pid) {
  if (process.platform === 'win32') {
    const result = spawnSync('tasklist', ['/FI', `PID eq ${String(pid)}`, '/NH', '/FO', 'CSV'], { encoding: 'utf8' });
    return result.error !== undefined || result.status !== 0 || result.stdout.includes(`"${String(pid)}"`);
  }
  const result = spawnSync('ps', ['-p', String(pid)], { encoding: 'utf8' });
  return result.error !== undefined || result.status === 0;
}

/**
 * Why the lock held in `file` (with `token`) is stale, or null when it may still be held: its run is no longer
 * running, or the lock is older than `maxAgeMs` (TOOL-WR-09).
 * @param {string} file
 * @param {string} token
 * @param {{ now: () => number, isAlive: (pid: number) => boolean, maxAgeMs: number }} options
 * @returns {string | null}
 */
function staleReason(file, token, { now, isAlive, maxAgeMs }) {
  const pid = Number(token.split(' ')[0]);
  if (Number.isSafeInteger(pid) && pid > 0 && pid !== process.pid && !isAlive(pid)) {
    return `its run (pid ${String(pid)}) is no longer running`;
  }
  let modified;
  try {
    modified = statSync(file).mtimeMs;
  } catch {
    return null;
  }
  return now() - modified > maxAgeMs ? `it is older than ${String(maxAgeMs / 3_600_000)} hours` : null;
}

/**
 * Removes a stale lock without ever removing a newer one: the file is renamed aside first, and when the renamed file
 * is not the stale token (another run replaced it meanwhile), it is linked back, which fails if a third lock exists.
 * @param {string} file
 * @param {string} token the stale lock's contents
 * @returns {boolean} true when the stale lock is gone.
 */
function removeStaleLock(file, token) {
  const aside = `${file}.stale-${randomUUID()}`;
  try {
    renameSync(file, aside);
  } catch {
    return false;
  }
  if (readOrNull(aside) !== token) {
    try {
      linkSync(aside, file);
    } catch {
      // A third run already holds the lock; the renamed file was never ours to keep.
    }
  }
  rmSync(aside, { force: true });
  return true;
}

/**
 * Takes the exclusive run lock. The file is created with the `wx` flag, so exactly one run holds it; the others poll
 * until it is gone or the timeout passes. The returned release removes the file only while it still holds this run's
 * token, so a run never deletes a lock another run owns. A stale lock (its run is no longer running, or it is older than
 * LOCK_MAX_AGE_MS) is taken over at once (TOOL-WR-09).
 * @param {string} file
 * @param {{ timeoutMs?: number, pollMs?: number, now?: () => number, sleep?: (ms: number) => Promise<void>, onWait?: () => void,
 *   isAlive?: (pid: number) => boolean, maxAgeMs?: number, onStale?: (reason: string) => void }} [options]
 * @returns {Promise<(() => void) | null>} the release function, or null when the lock stayed taken until the timeout.
 */
export async function acquireLock(file, options = {}) {
  const {
    timeoutMs = LOCK_TIMEOUT_MS,
    pollMs = LOCK_POLL_MS,
    now = Date.now,
    sleep = (ms) =>
      new Promise((resolve) => {
        setTimeout(resolve, ms);
      }),
    onWait = () => {
      process.stdout.write(`e2e: another run holds ${file}; waiting for it (up to 15 minutes).\n`);
    },
    isAlive = processIsAlive,
    maxAgeMs = LOCK_MAX_AGE_MS,
    onStale = (reason) => {
      process.stdout.write(`e2e: ${file} was left behind (${reason}); taking it over.\n`);
    },
  } = options;
  mkdirSync(path.dirname(file), { recursive: true });
  const token = `${String(process.pid)} ${randomUUID()} ${new Date().toISOString()}\n`;
  const deadline = now() + timeoutMs;
  let announced = false;
  for (;;) {
    if (tryCreate(file, token)) {
      let released = false;
      return () => {
        if (released) {
          return;
        }
        released = true;
        if (readOrNull(file) === token) {
          rmSync(file, { force: true });
        }
      };
    }
    const held = readOrNull(file);
    const reason = held === null ? null : staleReason(file, held, { now, isAlive, maxAgeMs });
    if (held !== null && reason !== null && removeStaleLock(file, held)) {
      onStale(reason);
      continue;
    }
    const remaining = deadline - now();
    if (remaining <= 0) {
      return null;
    }
    if (!announced) {
      announced = true;
      onWait();
    }
    await sleep(Math.min(pollMs, remaining));
  }
}

/**
 * @param {string} file
 * @param {string} token
 * @returns {boolean} true when this call created the file.
 */
function tryCreate(file, token) {
  let descriptor;
  try {
    descriptor = openSync(file, 'wx');
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === 'EEXIST') {
      return false;
    }
    throw error;
  }
  try {
    writeSync(descriptor, token);
  } finally {
    closeSync(descriptor);
  }
  return true;
}

/**
 * @param {string} file
 * @returns {string | null}
 */
function readOrNull(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/**
 * True when something accepts a TCP connection on the E2E port at this address.
 * @param {string} host
 * @returns {Promise<boolean>}
 */
function somethingAnswers(host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port: E2E_PORT, host });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

/** @returns {Promise<boolean>} true when port 5199 answers on the IPv4 or the IPv6 loopback. */
async function portIsBusy() {
  for (const host of ['127.0.0.1', '::1']) {
    if (await somethingAnswers(host)) {
      return true;
    }
  }
  return false;
}

/**
 * @param {readonly string[]} argv the arguments after `npm run e2e --`.
 * @returns {Promise<number>}
 */
async function main(argv) {
  const release = await acquireLock(LOCK_PATH);
  if (release === null) {
    process.stderr.write(`e2e: ${lockTimeoutMessage(LOCK_PATH)}\n`);
    return 1;
  }
  // Ctrl+C reaches the children too; the lock goes as soon as control returns here.
  const onSignal = () => {
    release();
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  process.once('SIGHUP', onSignal);
  process.once('exit', release);
  try {
    // TOOL-WR-08: wait while another project uses this machine (shared-machine.mjs); never stop anything.
    const busy = await waitForSharedMachine({ label: 'e2e' });
    if (busy !== null) {
      process.stderr.write(`${busy}\n`);
      return 1;
    }
    const steps = planSteps({ portBusy: await portIsBusy(), extraArgs: argv });
    return executeSteps(steps);
  } finally {
    release();
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
