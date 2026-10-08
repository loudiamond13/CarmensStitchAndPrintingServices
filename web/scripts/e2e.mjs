// @ts-check
// `npm run e2e` (QUAL-04, D-30, research Pattern 11): the only supported way to run the Playwright suite.
//   1. Takes the exclusive run lock web/.locks/e2e.lock (shared with the parity and Lighthouse runs, which start the same
//      host). A second run waits for it, up to 15 minutes, then exits 1 asking you to wait and retry.
//   2. Refuses to start when port 5199 is in use. It never stops any process (CLAUDE.md shared machine).
//   3. Runs the shared-machine preflight report.
//   4. Migrates and seeds CSPS_E2E on (localdb)\CSPS through the guarded dev-seed tool (idempotent).
//   5. Builds the e2e bundle into web/.e2e-dist (vite build --mode e2e).
//   6. Runs `playwright test` with this script's arguments (for example --grep @smoke --project webkit).
// Every child inherits this terminal's environment unchanged; nothing is set at User or Machine level. The API host's
// own variables are set on that one process by playwright.config.ts. Windows cannot spawn .cmd shims without a shell,
// so Node tools run on this Node binary with their JS entry (L-22).
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const E2E_PORT = 5199;
export const PREFLIGHT_SCRIPT = 'C:\\Work\\dev-tools\\preflight.ps1';
export const PORT_BUSY_MESSAGE = `Port ${String(E2E_PORT)} is in use by another process. Wait for it to finish; this script never stops other processes.`;
export const WEB_DIRECTORY = fileURLToPath(new URL('..', import.meta.url));
export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const LOCK_PATH = path.join(WEB_DIRECTORY, '.locks', 'e2e.lock');
export const LOCK_TIMEOUT_MS = 15 * 60 * 1000;

const LOCK_POLL_MS = 2000;

/**
 * @typedef {{ readonly kind: 'run', readonly name: 'preflight' | 'seed' | 'build' | 'playwright', readonly command: string, readonly args: readonly string[], readonly cwd: string }} RunStep
 * @typedef {{ readonly kind: 'refuse', readonly name: 'port-busy', readonly message: string, readonly exitCode: 1 }} RefuseStep
 * @typedef {RunStep | RefuseStep} Step
 * @typedef {(command: string, args: readonly string[], options: { cwd: string, stdio: 'inherit' }) => { status: number | null }} Spawner
 */

/**
 * The run as data, so the order and the exact commands are unit-tested without starting anything.
 * @param {{ portBusy: boolean, extraArgs?: readonly string[], preflightAvailable?: boolean }} options
 * @returns {readonly Step[]}
 */
export function planSteps({ portBusy, extraArgs = [], preflightAvailable = true }) {
  if (portBusy) {
    return [{ kind: 'refuse', name: 'port-busy', message: PORT_BUSY_MESSAGE, exitCode: 1 }];
  }
  /** @type {RunStep[]} */
  const steps = [];
  if (preflightAvailable) {
    // A read-only report of this project's ports, other projects' test processes and LocalDB (CLAUDE.md).
    steps.push({
      kind: 'run',
      name: 'preflight',
      command: 'powershell',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PREFLIGHT_SCRIPT, '-Ports', '5180,5115,7028,5199'],
      cwd: REPO_ROOT,
    });
  }
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
  return `Another E2E, parity or Lighthouse run has held ${file} for 15 minutes. Wait for it to finish, then run this again.`;
}

/**
 * Takes the exclusive run lock. The file is created with the `wx` flag, so exactly one run holds it; the others poll
 * until it is gone or the timeout passes. The returned release removes the file only while it still holds this run's
 * token, so a run never deletes a lock another run owns.
 * @param {string} file
 * @param {{ timeoutMs?: number, pollMs?: number, now?: () => number, sleep?: (ms: number) => Promise<void>, onWait?: () => void }} [options]
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
  process.once('exit', release);
  try {
    const steps = planSteps({
      portBusy: await portIsBusy(),
      extraArgs: argv,
      preflightAvailable: existsSync(PREFLIGHT_SCRIPT),
    });
    return executeSteps(steps);
  } finally {
    release();
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
