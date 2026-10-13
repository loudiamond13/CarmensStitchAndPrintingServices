// @vitest-environment node
// Pins `npm run parity` (WEB-02, D-33): the run is the shared-machine preflight, the 02-38 spec extraction, the
// reference build, then the visual Playwright run with the caller's arguments. Every Node tool runs on this Node binary
// with its JS entry (never a .cmd shim, L-22), and a failing extraction (a pin mismatch) stops the run before anything
// is built.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { executeSteps, PARITY_LOCK_PATH, planSteps, PREFLIGHT_SCRIPT, REPO_ROOT, WEB_DIRECTORY } from './parity.mjs';

const webDirectory = fileURLToPath(new URL('..', import.meta.url));
const repoRoot = fileURLToPath(new URL('../..', import.meta.url));

interface SpawnCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd: unknown;
}

/** A fake spawnSync that answers each call with the next planned exit status and records what was run. */
function fakeSpawner(statuses: readonly (number | null)[]) {
  const calls: SpawnCall[] = [];
  const spawn = (command: string, args: readonly string[], options: { cwd?: unknown }) => {
    calls.push({ command, args, cwd: options.cwd });
    const status = statuses[calls.length - 1];
    return { status: status === undefined ? 0 : status };
  };
  return { calls, spawn };
}

describe('planSteps', () => {
  it('runs the preflight, the spec extraction, the reference build, the implementation build and Playwright, in that order', () => {
    const steps = planSteps({});

    expect(steps.map((step) => step.name)).toEqual(['preflight', 'extract', 'build', 'build-app', 'playwright']);
  });

  it('runs the read-only shared-machine preflight with this project ports from the repository root', () => {
    const [preflight] = planSteps({});

    expect(preflight).toEqual({
      name: 'preflight',
      command: 'powershell',
      args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', PREFLIGHT_SCRIPT, '-Ports', '5180,5115,7028,5199'],
      cwd: REPO_ROOT,
    });
    expect(PREFLIGHT_SCRIPT).toBe('C:\\Work\\dev-tools\\preflight.ps1');
    expect(path.resolve(REPO_ROOT)).toBe(path.resolve(repoRoot));
  });

  it('skips the preflight when the preflight script is not on this machine (CI)', () => {
    const steps = planSteps({ preflightAvailable: false });

    expect(steps.map((step) => step.name)).toEqual(['extract', 'build', 'build-app', 'playwright']);
  });

  it('runs every Node tool on this Node binary with its JS entry from the web folder (L-22)', () => {
    const tools = planSteps({}).filter((step) => step.name !== 'preflight');

    expect(tools).toHaveLength(4);
    for (const step of tools) {
      expect(step.command).toBe(process.execPath);
      expect(step.args[0]).toMatch(/\.(?:m?js)$/);
      expect(path.resolve(step.cwd)).toBe(path.resolve(webDirectory));
    }
    expect(path.resolve(WEB_DIRECTORY)).toBe(path.resolve(webDirectory));
  });

  it('extracts the pinned spec appendices with the 02-38 script and never re-pins', () => {
    const extract = planSteps({}).find((step) => step.name === 'extract');

    expect(extract?.args).toEqual(['visual/reference/extract-spec.mjs']);
    for (const step of planSteps({ extraArgs: ['--repin'] })) {
      if (step.name !== 'playwright') {
        expect(step.args).not.toContain('--repin');
      }
    }
  });

  it('builds the reference app with its own Vite config', () => {
    const build = planSteps({}).find((step) => step.name === 'build');

    expect(build?.args).toEqual([
      'node_modules/vite/bin/vite.js',
      'build',
      '--config',
      'visual/vite.reference.config.ts',
    ]);
  });

  it('builds the implementation side in the parity mode (dev routes and parity.html in; output .parity-dist)', () => {
    const buildApp = planSteps({}).find((step) => step.name === 'build-app');

    // vite.config.ts sends the parity mode to its own .parity-dist folder (build-config.node.test.ts pins it).
    expect(buildApp?.args).toEqual(['node_modules/vite/bin/vite.js', 'build', '--mode', 'parity']);
    // Never the E2E host's folder: a parity run must not overwrite a build an E2E run may be serving.
    expect(buildApp?.args).not.toContain('.e2e-dist');
  });

  it('builds the implementation after the extraction and before Playwright, still under the one parity lock', () => {
    const names = planSteps({}).map((step) => step.name);

    expect(names.indexOf('build-app')).toBeGreaterThan(names.indexOf('extract'));
    expect(names.indexOf('build-app')).toBeLessThan(names.indexOf('playwright'));
  });

  it('runs the visual Playwright config and passes --grep and --project through unchanged', () => {
    const extraArgs = ['--grep', '@reference', '--project', 'webkit'];
    const playwright = planSteps({ extraArgs }).find((step) => step.name === 'playwright');

    expect(playwright?.args).toEqual([
      'node_modules/@playwright/test/cli.js',
      'test',
      '--config',
      'visual/playwright.visual.config.ts',
      ...extraArgs,
    ]);
  });
});

describe('executeSteps', () => {
  it('runs every step in order and returns 0 when all pass', () => {
    const { calls, spawn } = fakeSpawner([0, 0, 0, 0, 0]);

    expect(executeSteps(planSteps({}), spawn)).toBe(0);
    expect(calls.map((call) => call.args[0])).toEqual([
      '-NoProfile',
      'visual/reference/extract-spec.mjs',
      'node_modules/vite/bin/vite.js',
      'node_modules/vite/bin/vite.js',
      'node_modules/@playwright/test/cli.js',
    ]);
  });

  it('stops at a failing extraction (a pin mismatch) before anything is built, with its exit code', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { calls, spawn } = fakeSpawner([0, 1]);

    expect(executeSteps(planSteps({}), spawn)).toBe(1);
    expect(calls.map((call) => call.args[0])).toEqual(['-NoProfile', 'visual/reference/extract-spec.mjs']);
    expect(stderr).toHaveBeenCalledWith('parity: extract failed with exit code 1.\n');
  });

  it('returns 1 when a step ends on a signal (no exit status)', () => {
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { calls, spawn } = fakeSpawner([null]);

    expect(executeSteps(planSteps({ preflightAvailable: false }), spawn)).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it('returns the Playwright exit code, so a failing or empty visual run fails npm run parity', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { spawn } = fakeSpawner([0, 0, 0, 0, 1]);

    expect(executeSteps(planSteps({}), spawn)).toBe(1);
    expect(stderr).toHaveBeenCalledWith('parity: playwright failed with exit code 1.\n');
  });

  it('stops at a failing implementation build before Playwright runs', () => {
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const { calls, spawn } = fakeSpawner([0, 0, 0, 2]);

    expect(executeSteps(planSteps({}), spawn)).toBe(2);
    expect(calls).toHaveLength(4);
    expect(stderr).toHaveBeenCalledWith('parity: build-app failed with exit code 2.\n');
  });
});

describe('the parity run lock and the shared-machine rules', () => {
  it('uses its own exclusive lock file under web/.locks', () => {
    expect(path.resolve(PARITY_LOCK_PATH)).toBe(path.resolve(webDirectory, '.locks', 'parity.lock'));
  });

  it('never stops another process', () => {
    const source = readFileSync(new URL('./parity.mjs', import.meta.url), 'utf8');

    expect(source).not.toMatch(/taskkill|Stop-Process|process\.kill|\.kill\(/i);
  });
});
