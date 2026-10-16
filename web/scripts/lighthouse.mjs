// @ts-check
// `npm run lighthouse` (PERF-02, research Pattern 13): scores the production public shell on the real host.
//   1. Takes the exclusive run lock web/.locks/e2e.lock, shared with `npm run e2e`, because both start the host on 5199.
//      It never shares a server with a Playwright run.
//   2. Waits while the shared machine is busy (shared-machine.mjs reads the shared preflight report), up to 15
//      minutes, then exits 1 (TOOL-WR-08). It never stops another process (CLAUDE.md shared machine).
//   3. Refuses to start when port 5199 is in use.
//   4. Builds production into src/Csps.Server/wwwroot (`vite build`; the budget gate runs inside it, plan 02-33).
//   5. Starts the real ASP.NET Core host on https://localhost:5199 serving that wwwroot, with ASPNETCORE_ENVIRONMENT set
//      on that one child only, and waits for /health.
//   6. Runs lighthouse 13.5.0 (owner-approved, D-25) on https://localhost:5199/ with the default mobile profile and error
//      reporting off. The JSON report goes to the git-ignored artifacts/lighthouse/report.json and is never uploaded.
//   7. Stops the host it started (that child and its own children, nothing else) and checks the report with
//      assertReport (scripts/lighthouse-assert.mjs): every category >= 0.95, LCP < 2000 ms, CLS < 0.05, TBT < 200 ms.
// Node tools run on this Node binary with their JS entry, because Windows cannot spawn .cmd shims without a shell (L-22).
// Lighthouse drives the Chromium build of the pinned Playwright version when it is installed (CHROME_PATH on that child
// only), so the score does not move with the machine's own Chrome updates. Guide: docs/web/release-gates.md.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertReport, layoutShiftCulprits } from './lighthouse-assert.mjs';
import { acquireLock, E2E_PORT, LOCK_PATH, lockTimeoutMessage, PORT_BUSY_MESSAGE, WEB_DIRECTORY } from './e2e.mjs';
import { waitForSharedMachine } from './shared-machine.mjs';

export const SERVER_PROJECT = fileURLToPath(new URL('../../src/Csps.Server', import.meta.url));
export const WWWROOT = fileURLToPath(new URL('../../src/Csps.Server/wwwroot', import.meta.url));
export const ORIGIN = `https://localhost:${String(E2E_PORT)}`;
export const HEALTH_URL = `${ORIGIN}/health`;
export const LIGHTHOUSE_URL = `${ORIGIN}/`;
export const REPORT_PATH = fileURLToPath(new URL('../../artifacts/lighthouse/report.json', import.meta.url));
export const HEALTH_TIMEOUT_MS = 120_000;

const HEALTH_POLL_MS = 1000;

/**
 * @typedef {{ readonly kind: 'run', readonly name: 'build' | 'lighthouse', readonly command: string, readonly args: readonly string[], readonly cwd: string, readonly env?: Readonly<Record<string, string>> }} RunStep
 * @typedef {{ readonly kind: 'host', readonly name: 'host', readonly command: string, readonly args: readonly string[], readonly cwd: string, readonly env: Readonly<Record<string, string>>, readonly healthUrl: string }} HostStep
 * @typedef {{ readonly kind: 'assert', readonly name: 'assert', readonly reportPath: string }} AssertStep
 * @typedef {{ readonly kind: 'refuse', readonly name: 'port-busy', readonly message: string, readonly exitCode: 1 }} RefuseStep
 * @typedef {RunStep | HostStep | AssertStep | RefuseStep} Step
 * @typedef {{ stop(): Promise<void> }} RunningHost
 * @typedef {{ run(step: RunStep): number, startHost(step: HostStep): Promise<RunningHost>, readReport(file: string): unknown, log(line: string): void }} Deps
 */

/**
 * The run as data, so the order and the exact commands are unit-tested without starting anything.
 * @param {{ portBusy: boolean, chromePath?: string, noSandbox?: boolean }} options
 * @returns {readonly Step[]}
 */
export function planSteps({ portBusy, chromePath, noSandbox = false }) {
  if (portBusy) {
    return [{ kind: 'refuse', name: 'port-busy', message: PORT_BUSY_MESSAGE, exitCode: 1 }];
  }
  /** @type {Step[]} */
  const steps = [];
  steps.push(
    {
      kind: 'run',
      name: 'build',
      command: process.execPath,
      args: ['node_modules/vite/bin/vite.js', 'build'],
      cwd: WEB_DIRECTORY,
    },
    {
      kind: 'host',
      name: 'host',
      command: 'dotnet',
      args: ['run', '--project', SERVER_PROJECT, '--no-launch-profile', '--', '--urls', ORIGIN, '--webroot', WWWROOT],
      cwd: SERVER_PROJECT,
      // Development reads the JWT key and the Data Protection certificate from user-secrets; set on this child only.
      env: { ASPNETCORE_ENVIRONMENT: 'Development' },
      healthUrl: HEALTH_URL,
    },
    {
      kind: 'run',
      name: 'lighthouse',
      command: process.execPath,
      args: [
        'node_modules/lighthouse/cli/index.js',
        LIGHTHOUSE_URL,
        '--output=json',
        `--output-path=${REPORT_PATH}`,
        '--quiet',
        // Lighthouse never sends crash reports anywhere (T-02-75).
        '--no-enable-error-reporting',
        '--form-factor=mobile',
        // The host uses the ASP.NET Core development certificate.
        `--chrome-flags=--headless=new --ignore-certificate-errors${noSandbox ? ' --no-sandbox' : ''}`,
      ],
      cwd: WEB_DIRECTORY,
      env: chromePath === undefined ? {} : { CHROME_PATH: chromePath },
    },
    { kind: 'assert', name: 'assert', reportPath: REPORT_PATH },
  );
  return steps;
}

/**
 * Runs the steps in order. The host is stopped as soon as lighthouse has finished, whether it passed or not, and on any
 * failure after it started.
 * @param {readonly Step[]} steps
 * @param {Deps} deps
 * @returns {Promise<number>} 0 when the report passed; otherwise the failing step's exit code (1 for a refusal, a host that
 *   never became healthy, or a report that misses a threshold).
 */
export async function executeSteps(steps, deps) {
  /** @type {RunningHost | null} */
  let host = null;
  const stopHost = async () => {
    if (host !== null) {
      const running = host;
      host = null;
      await running.stop();
    }
  };
  try {
    for (const step of steps) {
      switch (step.kind) {
        case 'refuse':
          deps.log(`lighthouse: ${step.message}`);
          return step.exitCode;
        case 'host':
          try {
            host = await deps.startHost(step);
          } catch (error) {
            deps.log(`lighthouse: ${error instanceof Error ? error.message : String(error)}`);
            return 1;
          }
          break;
        case 'run': {
          const status = deps.run(step);
          if (step.name === 'lighthouse') {
            await stopHost();
          }
          if (status !== 0) {
            deps.log(`lighthouse: ${step.name} failed with exit code ${String(status)}.`);
            return status;
          }
          break;
        }
        case 'assert': {
          const report = deps.readReport(step.reportPath);
          const result = assertReport(report);
          for (const line of result.lines) {
            deps.log(`lighthouse: ${line}`);
          }
          for (const failure of result.failures) {
            deps.log(`lighthouse: ${failure}`);
          }
          if (!result.passed) {
            for (const line of layoutShiftCulprits(report)) {
              deps.log(`lighthouse: ${line}`);
            }
          }
          deps.log(
            result.passed
              ? `lighthouse: passed (report: ${step.reportPath})`
              : `lighthouse: ${String(result.failures.length)} threshold(s) missed (report: ${step.reportPath})`,
          );
          return result.passed ? 0 : 1;
        }
      }
    }
    return 0;
  } finally {
    await stopHost();
  }
}

/**
 * True when GET url answers 200. The host uses the development certificate, so this one localhost probe skips the
 * certificate check.
 * @param {string} url
 * @returns {Promise<boolean>}
 */
function answersOk(url) {
  return new Promise((resolve) => {
    const request = https.get(url, { rejectUnauthorized: false, timeout: 2000 }, (response) => {
      response.resume();
      resolve(response.statusCode === 200);
    });
    request.once('timeout', () => {
      request.destroy();
      resolve(false);
    });
    request.once('error', () => {
      resolve(false);
    });
  });
}

/**
 * The pids of the hosts this process started that have not exited yet (TOOL-WR-10).
 * @type {Set<number>}
 */
const runningHosts = new Set();

/**
 * Stops one host this process started, synchronously, so a signal handler can call it before process.exit. On Windows
 * it ends that child's own tree by its pid (taskkill /T /F); on Linux and macOS, where the host runs in its own process
 * group (the terminal's Ctrl+C never reaches it), it sends SIGTERM to that group and SIGKILL after the grace period.
 * Nothing else is ever signalled.
 * @param {number} pid the host child's pid
 * @param {{ platform?: string, kill?: (pid: number, signal: string) => void, taskkill?: (pid: number) => void,
 *   isGone?: (pid: number) => boolean, sleepSync?: (ms: number) => void, graceMs?: number }} [tools]
 */
export function stopHostSync(pid, tools = {}) {
  const {
    platform = process.platform,
    kill = (target, signal) => {
      process.kill(target, signal);
    },
    taskkill = (target) => {
      spawnSync('taskkill', ['/pid', String(target), '/T', '/F'], { stdio: 'ignore' });
    },
    isGone = (target) => {
      try {
        process.kill(target, 0);
        return false;
      } catch {
        return true;
      }
    },
    sleepSync = (ms) => {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
    },
    graceMs = 3000,
  } = tools;
  if (platform === 'win32') {
    taskkill(pid);
    return;
  }
  try {
    kill(-pid, 'SIGTERM');
  } catch {
    return;
  }
  for (let waited = 0; waited < graceMs; waited += 100) {
    if (isGone(-pid)) {
      return;
    }
    sleepSync(100);
  }
  if (!isGone(-pid)) {
    try {
      kill(-pid, 'SIGKILL');
    } catch {
      // Gone between the check and the signal.
    }
  }
}

/** Stops every host this process started and has not seen exit; for signal handlers (TOOL-WR-10). */
export function stopRunningHostsSync() {
  for (const pid of runningHosts) {
    stopHostSync(pid);
  }
  runningHosts.clear();
}

/**
 * Starts the host and waits for /health. Rejects when the host exits first (for example because something else took the
 * port) or when /health does not answer within two minutes; in both cases the child is stopped first. Shared with
 * the owner review run (scripts/owner-review.mjs, plan 02-36).
 * @param {HostStep} step
 * @returns {Promise<RunningHost>}
 */
export async function startHost(step) {
  const child = spawn(step.command, [...step.args], {
    cwd: step.cwd,
    env: { ...process.env, ...step.env },
    stdio: 'inherit',
    // Its own process group on Linux and macOS, so stopping it reaches `dotnet run`'s app process too.
    detached: process.platform !== 'win32',
  });
  /** @type {{ exited: boolean, code: number | null }} */
  const state = { exited: false, code: null };
  const pid = child.pid;
  if (pid !== undefined) {
    runningHosts.add(pid);
  }
  const exitPromise = new Promise((resolve) => {
    child.once('exit', (code) => {
      state.exited = true;
      state.code = code;
      if (pid !== undefined) {
        runningHosts.delete(pid);
      }
      resolve(undefined);
    });
  });
  const stop = async () => {
    if (state.exited || child.pid === undefined) {
      return;
    }
    if (process.platform === 'win32') {
      // The tree of this one child (`dotnet run` and the app it started), by its own PID; nothing else.
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGTERM');
    }
    await exitPromise;
  };

  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  for (;;) {
    if (state.exited) {
      throw new Error(`the host exited with code ${String(state.code)} before ${step.healthUrl} answered.`);
    }
    if (await answersOk(step.healthUrl)) {
      return { stop };
    }
    if (Date.now() > deadline) {
      await stop();
      throw new Error(`the host did not answer ${step.healthUrl} within ${String(HEALTH_TIMEOUT_MS / 1000)} s.`);
    }
    await new Promise((resolve) => {
      setTimeout(resolve, HEALTH_POLL_MS);
    });
  }
}

/**
 * @param {RunStep} step
 * @returns {number}
 */
function runStep(step) {
  if (step.name === 'lighthouse') {
    // A report left by an earlier run must never be read as this run's result.
    mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    rmSync(REPORT_PATH, { force: true });
  }
  const result = spawnSync(step.command, [...step.args], {
    cwd: step.cwd,
    env: { ...process.env, ...step.env },
    stdio: 'inherit',
  });
  return result.status ?? 1;
}

/**
 * True when something accepts a TCP connection on port 5199 at this address.
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
export async function portIsBusy() {
  for (const host of ['127.0.0.1', '::1']) {
    if (await somethingAnswers(host)) {
      return true;
    }
  }
  return false;
}

/** @returns {Promise<string | undefined>} the pinned Playwright Chromium, when it is installed. */
async function playwrightChromium() {
  try {
    const { chromium } = await import('@playwright/test');
    const executable = chromium.executablePath();
    return existsSync(executable) ? executable : undefined;
  } catch {
    return undefined;
  }
}

/** @returns {Promise<number>} */
async function main() {
  const release = await acquireLock(LOCK_PATH);
  if (release === null) {
    process.stderr.write(`lighthouse: ${lockTimeoutMessage(LOCK_PATH)}\n`);
    return 1;
  }
  const onSignal = () => {
    // TOOL-WR-10: process.exit skips every finally, so the host this run started is stopped here first.
    stopRunningHostsSync();
    release();
    process.exit(130);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);
  process.once('SIGHUP', onSignal);
  process.once('exit', release);
  try {
    // TOOL-WR-08: wait while another project uses this machine (shared-machine.mjs); never stop anything.
    const busy = await waitForSharedMachine({ label: 'lighthouse' });
    if (busy !== null) {
      process.stderr.write(`${busy}\n`);
      return 1;
    }
    const chromePath = await playwrightChromium();
    const steps = planSteps({
      portBusy: await portIsBusy(),
      ...(chromePath === undefined ? {} : { chromePath }),
      // The ubuntu CI runner blocks Chrome's sandbox; a developer machine keeps it.
      noSandbox: process.platform === 'linux' && process.env.CI === 'true',
    });
    return await executeSteps(steps, {
      run: runStep,
      startHost,
      readReport: (file) => (existsSync(file) ? /** @type {unknown} */ (JSON.parse(readFileSync(file, 'utf8'))) : null),
      log: (line) => {
        process.stdout.write(`${line}\n`);
      },
    });
  } finally {
    release();
  }
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
