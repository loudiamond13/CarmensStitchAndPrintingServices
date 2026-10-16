// @vitest-environment node
// Pins `npm run e2e` (QUAL-04, D-30, CLAUDE.md shared machine): a busy port 5199 is refused with a wait message and
// nothing runs; otherwise the run is the guarded CSPS_E2E seed, the e2e build, then Playwright, each spawned
// as a real executable (never a .cmd shim, L-22). The exclusive run lock makes a second run wait, then give up.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  acquireLock,
  E2E_CONNECTION_VARIABLE,
  e2eConnection,
  executeSteps,
  LOCK_MAX_AGE_MS,
  LOCK_PATH,
  LOCK_TIMEOUT_MS,
  LOCALDB_E2E_CONNECTION,
  lockTimeoutMessage,
  planSteps,
  PORT_BUSY_MESSAGE,
  PREFLIGHT_SCRIPT,
  REPO_ROOT,
  WEB_DIRECTORY,
} from './e2e.mjs';

const webDirectory = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

const containerConnection =
  'Server=127.0.0.1,1433;Database=CSPS_E2E;User Id=sa;Password=s3cret-Value;TrustServerCertificate=true';

interface SpawnCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: unknown;
  readonly stdio: unknown;
}

/** A fake spawnSync that answers each call with the next planned exit status and records what was run. */
function fakeSpawner(statuses: readonly (number | null)[]) {
  const calls: SpawnCall[] = [];
  const spawn = (command: string, args: readonly string[], options: { cwd?: unknown; stdio?: unknown }) => {
    calls.push({ command, args, cwd: options.cwd, stdio: options.stdio });
    const status = statuses[calls.length - 1];
    return { status: status === undefined ? 0 : status };
  };
  return { calls, spawn };
}

describe('planSteps', () => {
  it('refuses with a single wait message when port 5199 is busy, and never plans a kill', () => {
    const steps = planSteps({ portBusy: true });

    expect(steps).toEqual([{ kind: 'refuse', name: 'port-busy', message: PORT_BUSY_MESSAGE, exitCode: 1 }]);
    expect(PORT_BUSY_MESSAGE).toBe(
      'Port 5199 is in use by another process. Wait for it to finish; this script never stops other processes.',
    );
  });

  // The shared-machine preflight is a wait gate in main(), before planning (shared-machine.mjs, TOOL-WR-08).
  it('runs the CSPS_E2E seed, the e2e build and Playwright, in that order, when the port is free', () => {
    const steps = planSteps({ portBusy: false });

    expect(steps.map((step) => step.name)).toEqual(['seed', 'build', 'playwright']);
    expect(steps.every((step) => step.kind === 'run')).toBe(true);
  });

  it('re-exports the shared preflight path for the other run scripts', () => {
    expect(PREFLIGHT_SCRIPT).toBe('C:\\Work\\dev-tools\\preflight.ps1');
  });

  it('seeds only CSPS_E2E, through the guarded dev-seed tool, from the repository root', () => {
    const seed = planSteps({ portBusy: false })[0];

    expect(seed).toEqual({
      kind: 'run',
      name: 'seed',
      command: 'dotnet',
      args: ['run', '--project', 'tools/Csps.DevSeed', '--', '--database', 'CSPS_E2E'],
      cwd: repoRoot,
    });
  });

  it('builds --mode e2e with this Node binary and the vite JS entry, in web/', () => {
    const build = planSteps({ portBusy: false })[1];

    expect(build).toEqual({
      kind: 'run',
      name: 'build',
      command: process.execPath,
      args: ['node_modules/vite/bin/vite.js', 'build', '--mode', 'e2e'],
      cwd: webDirectory,
    });
  });

  it('runs playwright test with this Node binary and passes the extra arguments through', () => {
    const playwright = planSteps({ portBusy: false, extraArgs: ['--grep', '@smoke', '--project', 'webkit'] })[2];

    expect(playwright).toEqual({
      kind: 'run',
      name: 'playwright',
      command: process.execPath,
      args: ['node_modules/@playwright/test/cli.js', 'test', '--grep', '@smoke', '--project', 'webkit'],
      cwd: webDirectory,
    });
  });

  it('never spawns a .cmd or .bat shim, npm or npx (L-22)', () => {
    for (const step of planSteps({ portBusy: false, extraArgs: ['--grep', '@smoke'] })) {
      expect(step.kind).toBe('run');
      if (step.kind === 'run') {
        expect(step.command).not.toMatch(/\.(cmd|bat)$|^(npm|npx)$/i);
        expect(step.args.some((arg) => /\.(cmd|bat)$/i.test(arg))).toBe(false);
      }
    }
  });

  it('resolves the web folder and the repository root from the script location', () => {
    expect(WEB_DIRECTORY).toBe(webDirectory);
    expect(REPO_ROOT).toBe(repoRoot);
  });
});

describe('CSPS_E2E_CONNECTION (CI override)', () => {
  it('names the variable and keeps the LocalDB literal as the default', () => {
    expect(E2E_CONNECTION_VARIABLE).toBe('CSPS_E2E_CONNECTION');
    expect(LOCALDB_E2E_CONNECTION).toBe('Server=(localdb)\\MSSQLLocalDB;Database=CSPS_E2E;Integrated Security=true');
    expect(e2eConnection({})).toBe(LOCALDB_E2E_CONNECTION);
  });

  it('returns the override as is when it is set', () => {
    expect(e2eConnection({ CSPS_E2E_CONNECTION: containerConnection })).toBe(containerConnection);
  });

  it.each(['', '   ', '\t\n'])('treats a blank override (%j) as unset', (blank) => {
    expect(e2eConnection({ CSPS_E2E_CONNECTION: blank })).toBe(LOCALDB_E2E_CONNECTION);
  });

  it('seeds through --database CSPS_E2E when no override is set', () => {
    const seed = planSteps({ portBusy: false, env: {} })[0];

    expect(seed).toMatchObject({
      name: 'seed',
      args: ['run', '--project', 'tools/Csps.DevSeed', '--', '--database', 'CSPS_E2E'],
    });
  });

  it('seeds through --connection with the exact override, and no --database, when it is set', () => {
    const seed = planSteps({ portBusy: false, env: { CSPS_E2E_CONNECTION: containerConnection } })[0];

    expect(seed).toMatchObject({
      name: 'seed',
      args: ['run', '--project', 'tools/Csps.DevSeed', '--', '--connection', containerConnection],
    });
    expect(seed?.kind === 'run' && seed.args.includes('--database')).toBe(false);
  });

  it('keeps --database CSPS_E2E for a blank override', () => {
    const seed = planSteps({ portBusy: false, env: { CSPS_E2E_CONNECTION: '  ' } })[0];

    expect(seed?.kind === 'run' && seed.args.slice(-2)).toEqual(['--database', 'CSPS_E2E']);
  });

  it('leaves the build and Playwright steps the same with an override', () => {
    const plain = planSteps({ portBusy: false, env: {} });
    const overridden = planSteps({ portBusy: false, env: { CSPS_E2E_CONNECTION: containerConnection } });

    expect(overridden.slice(1)).toEqual(plain.slice(1));
  });

  it('reports a failing seed by step name and exit code only, never the connection value (CWE-532)', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { spawn } = fakeSpawner([1, 0, 0]);

    expect(executeSteps(planSteps({ portBusy: false, env: { CSPS_E2E_CONNECTION: containerConnection } }), spawn)).toBe(
      1,
    );

    expect(stderr).toHaveBeenCalledWith('e2e: seed failed with exit code 1.\n');
    const written = stderr.mock.calls.map((call) => String(call[0])).join('');
    expect(written).not.toContain('s3cret-Value');
    expect(written).not.toContain('127.0.0.1');
  });

  it('reads process.env when no env is passed', () => {
    vi.stubEnv('CSPS_E2E_CONNECTION', containerConnection);
    try {
      expect(e2eConnection()).toBe(containerConnection);
      const seed = planSteps({ portBusy: false })[0];
      expect(seed?.kind === 'run' && seed.args.at(-1)).toBe(containerConnection);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe('executeSteps', () => {
  it('runs every step with its cwd and inherited output, and returns 0 when all pass', () => {
    const steps = planSteps({ portBusy: false });
    const { calls, spawn } = fakeSpawner([0, 0, 0]);

    expect(executeSteps(steps, spawn)).toBe(0);

    expect(calls).toEqual(
      steps.map((step) =>
        step.kind === 'run' ? { command: step.command, args: step.args, cwd: step.cwd, stdio: 'inherit' } : step,
      ),
    );
  });

  it('stops at the first failing step and returns its exit code', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { calls, spawn } = fakeSpawner([2, 0, 0]);

    expect(executeSteps(planSteps({ portBusy: false }), spawn)).toBe(2);

    expect(calls).toHaveLength(1);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('seed failed with exit code 2'));
  });

  it('treats a step killed by a signal (no exit status) as a failure', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { calls, spawn } = fakeSpawner([0, 0, null]);

    expect(executeSteps(planSteps({ portBusy: false }), spawn)).toBe(1);
    expect(calls).toHaveLength(3);
  });

  it('prints the refusal and spawns nothing when the port is busy', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { calls, spawn } = fakeSpawner([0]);

    expect(executeSteps(planSteps({ portBusy: true }), spawn)).toBe(1);

    expect(calls).toEqual([]);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining(PORT_BUSY_MESSAGE));
  });
});

describe('acquireLock', () => {
  let directory: string | undefined;

  afterEach(() => {
    if (directory !== undefined) {
      rmSync(directory, { recursive: true, force: true });
      directory = undefined;
    }
  });

  function lockFile(): string {
    directory = mkdtempSync(path.join(tmpdir(), 'csps-e2e-lock-'));
    return path.join(directory, '.locks', 'e2e.lock');
  }

  it('is web/.locks/e2e.lock and waits up to 15 minutes', () => {
    expect(LOCK_PATH).toBe(path.join(webDirectory, '.locks', 'e2e.lock'));
    expect(LOCK_TIMEOUT_MS).toBe(15 * 60 * 1000);
  });

  it('creates the lock file (and its folder) and removes it on release', async () => {
    const file = lockFile();

    const release = await acquireLock(file);

    expect(release).not.toBeNull();
    expect(existsSync(file)).toBe(true);
    release?.();
    expect(existsSync(file)).toBe(false);
  });

  it('makes a second run wait while the lock is held, then give up after the timeout', async () => {
    const file = lockFile();
    const first = await acquireLock(file);
    let clock = 0;
    const waits: number[] = [];
    const onWait = vi.fn();

    const second = await acquireLock(file, {
      timeoutMs: 10_000,
      pollMs: 4_000,
      now: () => clock,
      sleep: (ms: number) => {
        waits.push(ms);
        clock += ms;
        return Promise.resolve();
      },
      onWait,
    });

    expect(second).toBeNull();
    expect(waits).toEqual([4_000, 4_000, 2_000]);
    expect(onWait).toHaveBeenCalledTimes(1);
    expect(existsSync(file)).toBe(true);
    first?.();
  });

  it('lets the waiting run in as soon as the holder releases the lock', async () => {
    const file = lockFile();
    const first = await acquireLock(file);
    let polls = 0;

    const second = await acquireLock(file, {
      pollMs: 1,
      sleep: () => {
        polls += 1;
        first?.();
        return Promise.resolve();
      },
      onWait: () => undefined,
    });

    expect(polls).toBe(1);
    expect(second).not.toBeNull();
    expect(existsSync(file)).toBe(true);
    second?.();
    expect(existsSync(file)).toBe(false);
  });

  it('never removes a lock file that another run owns now', async () => {
    const file = lockFile();
    const release = await acquireLock(file);
    writeFileSync(file, 'someone else\n');

    release?.();

    expect(readFileSync(file, 'utf8')).toBe('someone else\n');
  });

  it('releases only once', async () => {
    const file = lockFile();
    const release = await acquireLock(file);
    release?.();
    const next = await acquireLock(file);

    release?.();

    expect(existsSync(file)).toBe(true);
    next?.();
  });

  it('explains the timeout as wait and retry, naming the lock file and how to clear a stale one', () => {
    expect(lockTimeoutMessage(LOCK_PATH)).toBe(
      `Another E2E, parity or Lighthouse run has held ${LOCK_PATH} for 15 minutes. Wait for it to finish, then run this again. ` +
        `If no such run is going on (for example after a crash or a closed terminal), delete ${LOCK_PATH} and run this again.`,
    );
  });

  // TOOL-WR-09: a run killed hard (Task Manager, taskkill /F, a closed console, a power loss) leaves its lock behind.
  it('takes over a lock whose run is no longer running, at once and without waiting', async () => {
    const file = lockFile();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `424242 ${'0'.repeat(36)} 2026-10-13T00:00:00.000Z\n`);
    const onWait = vi.fn();
    const stale: string[] = [];

    const release = await acquireLock(file, {
      isAlive: (pid: number) => pid !== 424242,
      onWait,
      onStale: (reason: string) => stale.push(reason),
    });

    expect(release).not.toBeNull();
    expect(onWait).not.toHaveBeenCalled();
    expect(stale).toEqual([expect.stringContaining('pid 424242')]);
    expect(readFileSync(file, 'utf8')).toMatch(new RegExp(`^${String(process.pid)} `));
    expect(readdirSync(path.dirname(file))).toEqual(['e2e.lock']);
    release?.();
  });

  it('keeps waiting for a lock whose run is still alive and younger than the ceiling', async () => {
    const file = lockFile();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `424242 x ${new Date().toISOString()}\n`);

    const release = await acquireLock(file, {
      timeoutMs: 1,
      pollMs: 1,
      isAlive: () => true,
      onWait: () => undefined,
      onStale: () => {
        throw new Error('must not take over');
      },
    });

    expect(release).toBeNull();
    expect(readFileSync(file, 'utf8')).toContain('424242');
  });

  it('takes over a lock older than the ceiling even when its pid looks alive (pid reuse)', async () => {
    const file = lockFile();
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, 'garbage without a pid\n');
    const later = Date.now() + LOCK_MAX_AGE_MS + 60_000;
    const stale: string[] = [];

    const release = await acquireLock(file, {
      now: () => later,
      isAlive: () => true,
      onWait: () => undefined,
      onStale: (reason: string) => stale.push(reason),
    });

    expect(LOCK_MAX_AGE_MS).toBe(3 * 60 * 60 * 1000);
    expect(release).not.toBeNull();
    expect(stale).toEqual([expect.stringContaining('older than 3 hours')]);
    release?.();
  });
});

describe('e2e.mjs source (T-02-23)', () => {
  it('contains no process-stopping command', () => {
    const source = readFileSync(fileURLToPath(new URL('./e2e.mjs', import.meta.url)), 'utf8');

    expect(source).not.toMatch(/taskkill|Stop-Process|kill\(/i);
  });

  it('releases its lock on SIGHUP (a closed terminal) as well as SIGINT and SIGTERM', () => {
    const source = readFileSync(fileURLToPath(new URL('./e2e.mjs', import.meta.url)), 'utf8');

    expect(source).toContain("process.once('SIGHUP', onSignal)");
  });
});
