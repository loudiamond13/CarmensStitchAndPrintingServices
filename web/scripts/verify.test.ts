// @vitest-environment node
// Pins the order of the one static gate (QUAL-02): typecheck, lint, format, tests with coverage, then the build. The
// pipeline stops at the first failing step and returns that step's exit code.
import { describe, expect, it, vi } from 'vitest';
import { run, STEPS } from './verify.mjs';

interface SpawnCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly stdio: unknown;
}

/** A fake spawnSync that answers each call with the next planned exit status and records what was run. */
function fakeSpawner(statuses: readonly (number | null)[]) {
  const calls: SpawnCall[] = [];
  const spawn = (command: string, args: readonly string[], options: { stdio?: unknown }) => {
    calls.push({ command, args, stdio: options.stdio });
    return { status: statuses[calls.length - 1] ?? 0 };
  };
  return { calls, spawn };
}

const npmCli = 'C:/tools/npm/bin/npm-cli.js';

describe('verify pipeline', () => {
  it('runs typecheck, lint, format:check, test:coverage and build in that order', () => {
    expect(STEPS).toEqual(['typecheck', 'lint', 'format:check', 'test:coverage', 'build']);
  });

  it('runs every step through node and npm-cli.js with inherited output, and returns 0 when all pass', () => {
    const { calls, spawn } = fakeSpawner([0, 0, 0, 0, 0]);

    expect(run(spawn, { npm_execpath: npmCli })).toBe(0);

    expect(calls.map((c) => c.args)).toEqual(STEPS.map((step) => [npmCli, 'run', step]));
    expect(calls.every((c) => c.command === process.execPath && c.stdio === 'inherit')).toBe(true);
  });

  it('stops at the first failing step and returns its exit code', () => {
    const { calls, spawn } = fakeSpawner([0, 3, 0, 0, 0]);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(run(spawn, { npm_execpath: npmCli })).toBe(3);

    expect(calls.map((c) => c.args[2])).toEqual(['typecheck', 'lint']);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('lint failed with exit code 3'));
  });

  it('treats a step killed by a signal (no exit status) as a failure', () => {
    const { calls, spawn } = fakeSpawner([null]);
    vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(run(spawn, { npm_execpath: npmCli })).toBe(1);
    expect(calls).toHaveLength(1);
  });

  it('fails with a clear message and runs nothing when it is not started through npm run verify', () => {
    const { calls, spawn } = fakeSpawner([0]);
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    expect(run(spawn, {})).toBe(1);

    expect(calls).toEqual([]);
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('npm run verify'));
  });
});
