// @ts-check
// `npm run parity` (WEB-02, D-33): the only supported way to run the look-equality proof.
//   1. Takes the exclusive run lock web/.locks/parity.lock, so two runs never build into the same folders at once. A
//      second run waits for it, up to 15 minutes, then exits 1 asking you to wait and retry.
//   2. Runs the shared-machine preflight report (read-only).
//   3. Extracts the pinned spec appendices (plan 02-38). A pin mismatch exits non-zero and stops the run before
//      anything is built, so the reference never compiles an unreviewed copy of the approved design.
//   4. Builds the reference app into web/.reference-dist (visual/vite.reference.config.ts).
//   5. Runs the visual Playwright suite with this script's arguments (for example --grep @reference --project webkit).
// The suite opens no port: both sides are served by page.route (visual/serve.ts). Windows cannot spawn .cmd shims
// without a shell, so Node tools run on this Node binary with their JS entry (L-22). Nothing is set at User or Machine
// level, and no other process is ever stopped (CLAUDE.md shared machine).
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireLock, lockTimeoutMessage, PREFLIGHT_SCRIPT, REPO_ROOT, WEB_DIRECTORY } from './e2e.mjs';

export { PREFLIGHT_SCRIPT, REPO_ROOT, WEB_DIRECTORY };

export const PARITY_LOCK_PATH = path.join(WEB_DIRECTORY, '.locks', 'parity.lock');

/**
 * @typedef {{ readonly name: 'preflight' | 'extract' | 'build' | 'build-app' | 'playwright', readonly command: string, readonly args: readonly string[], readonly cwd: string }} Step
 * @typedef {(command: string, args: readonly string[], options: { cwd: string, stdio: 'inherit' }) => { status: number | null }} Spawner
 */

/**
 * The run as data, so the order and the exact commands are unit-tested without starting anything.
 * @param {{ extraArgs?: readonly string[], preflightAvailable?: boolean }} options
 * @returns {readonly Step[]}
 */
export function planSteps({ extraArgs = [], preflightAvailable = true }) {
  /** @type {Step[]} */
  const steps = [];
  if (preflightAvailable) {
    // A read-only report of this project's ports, other projects' test processes and LocalDB (CLAUDE.md).
    steps.push({
      name: 'preflight',
      command: 'powershell',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PREFLIGHT_SCRIPT, '-Ports', '5180,5115,7028,5199'],
      cwd: REPO_ROOT,
    });
  }
  steps.push(
    // Plan 02-38's extraction. It never gets --repin: re-pinning is a manual, owner-reviewed step.
    { name: 'extract', command: process.execPath, args: ['visual/reference/extract-spec.mjs'], cwd: WEB_DIRECTORY },
    {
      name: 'build',
      command: process.execPath,
      args: ['node_modules/vite/bin/vite.js', 'build', '--config', 'visual/vite.reference.config.ts'],
      cwd: WEB_DIRECTORY,
    },
    {
      name: 'playwright',
      command: process.execPath,
      args: [
        'node_modules/@playwright/test/cli.js',
        'test',
        '--config',
        'visual/playwright.visual.config.ts',
        ...extraArgs,
      ],
      cwd: WEB_DIRECTORY,
    },
  );
  return steps;
}

/**
 * Runs the steps in order with inherited output and stops at the first failure.
 * @param {readonly Step[]} steps
 * @param {Spawner} [spawn]
 * @returns {number} 0 when every step passed, otherwise the failing step's exit code (1 for a signal).
 */
export function executeSteps(steps, spawn = spawnSync) {
  for (const step of steps) {
    const status = spawn(step.command, step.args, { cwd: step.cwd, stdio: 'inherit' }).status ?? 1;
    if (status !== 0) {
      process.stderr.write(`parity: ${step.name} failed with exit code ${String(status)}.\n`);
      return status;
    }
  }
  return 0;
}

/**
 * @param {readonly string[]} argv the arguments after `npm run parity --`.
 * @returns {Promise<number>}
 */
async function main(argv) {
  const release = await acquireLock(PARITY_LOCK_PATH, {
    onWait: () => {
      process.stdout.write(`parity: another run holds ${PARITY_LOCK_PATH}; waiting for it (up to 15 minutes).\n`);
    },
  });
  if (release === null) {
    process.stderr.write(`parity: ${lockTimeoutMessage(PARITY_LOCK_PATH)}\n`);
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
    return executeSteps(planSteps({ extraArgs: argv, preflightAvailable: existsSync(PREFLIGHT_SCRIPT) }));
  } finally {
    release();
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
