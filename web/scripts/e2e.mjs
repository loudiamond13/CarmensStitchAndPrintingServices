// @ts-check
// `npm run e2e` (QUAL-04, D-30, research Pattern 11): the only supported way to run the Playwright suite.
//   1. Runs the shared-machine preflight and prints its report (CLAUDE.md).
//   2. Refuses to start when port 5199 is in use. It never stops or kills any process.
//   3. Migrates CSPS_E2E on (localdb)\CSPS through the guarded dev-seed tool (idempotent).
//   4. Builds the e2e bundle into web/.e2e-dist (vite build --mode e2e).
//   5. Runs `playwright test` with this script's arguments and exits with Playwright's exit code.
// Every child process inherits this terminal's environment unchanged. Nothing is set at User or Machine level; the
// host's own variables are set on that one process by playwright.config.ts.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const E2E_PORT = 5199;
const PREFLIGHT = 'C:\\Work\\dev-tools\\preflight.ps1';
const webDirectory = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

/**
 * Runs a command with inherited stdio and returns its exit code (1 when it could not start).
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @returns {number}
 */
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  if (result.error !== undefined) {
    console.error(`Could not start ${command}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

/**
 * True when nothing accepts a connection on the port at this address.
 * @param {string} host
 * @returns {Promise<boolean>}
 */
function nothingAnswers(host) {
  return new Promise((resolve) => {
    const socket = net.connect({ port: E2E_PORT, host });
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(true);
    });
  });
}

/**
 * True when this process can briefly listen on the port at this address. An address this machine does not have
 * (for example no IPv6 loopback) counts as free.
 * @param {string} host
 * @returns {Promise<boolean>}
 */
function canListen(host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', (/** @type {NodeJS.ErrnoException} */ error) => {
      resolve(error.code === 'EADDRNOTAVAIL' || error.code === 'EAFNOSUPPORT');
    });
    server.listen({ port: E2E_PORT, host, exclusive: true }, () => {
      server.close(() => {
        resolve(true);
      });
    });
  });
}

async function portIsFree() {
  for (const host of ['127.0.0.1', '::1']) {
    if (!(await nothingAnswers(host)) || !(await canListen(host))) {
      return false;
    }
  }
  return true;
}

if (existsSync(PREFLIGHT)) {
  console.log(`Preflight: ${PREFLIGHT}`);
  // Read-only report. If another project holds a port or runs its tests, wait and run this again later.
  run(
    'powershell',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PREFLIGHT, '-Ports', '5180,5115,7028,5199'],
    repoRoot,
  );
} else {
  console.log(`Preflight script not found (${PREFLIGHT}); continuing with the port check only.`);
}

if (!(await portIsFree())) {
  console.error(`Port ${String(E2E_PORT)} is in use; wait for it to be free (never kill another project's process).`);
  process.exit(1);
}

const seedExit = run('dotnet', ['run', '--project', 'tools/Csps.DevSeed', '--', '--database', 'CSPS_E2E'], repoRoot);
if (seedExit !== 0) {
  console.error(`The CSPS_E2E migration (dev-seed) failed with exit code ${String(seedExit)}.`);
  process.exit(seedExit);
}

const viteExit = run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--mode', 'e2e'], webDirectory);
if (viteExit !== 0) {
  console.error(`The e2e build failed with exit code ${String(viteExit)}.`);
  process.exit(viteExit);
}

process.exit(
  run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', ...process.argv.slice(2)], webDirectory),
);
