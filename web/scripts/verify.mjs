// @ts-check
// The one static gate (QUAL-02): `npm run verify` runs each step below in order and stops at the first failure with
// that step's exit code. Plans 02-06 and 02-33 append their steps to STEPS.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** npm script names, run in this order. */
export const STEPS = Object.freeze(['typecheck', 'lint', 'format:check', 'test:coverage', 'build']);

/**
 * @typedef {(command: string, args: readonly string[], options: { stdio: 'inherit' }) => { status: number | null }} Spawner
 */

/**
 * Runs every step through `node <npm-cli.js> run <step>`. Windows cannot spawn the npm .cmd shim without a shell
 * (L-22), so the step runs on this Node binary with npm's own JS entry, which npm passes in npm_execpath.
 * @param {Spawner} [spawn]
 * @param {Readonly<Record<string, string | undefined>>} [env]
 * @returns {number} 0 when every step passed, otherwise the exit code of the first failing step (1 for a signal).
 */
export function run(spawn = spawnSync, env = process.env) {
  const npmCli = env.npm_execpath;
  if (npmCli === undefined || npmCli === '') {
    process.stderr.write('verify: npm_execpath is not set. Start the pipeline with `npm run verify`.\n');
    return 1;
  }
  for (const step of STEPS) {
    const result = spawn(process.execPath, [npmCli, 'run', step], { stdio: 'inherit' });
    const status = result.status ?? 1;
    if (status !== 0) {
      process.stderr.write(`verify: ${step} failed with exit code ${String(status)}.\n`);
      return status;
    }
  }
  return 0;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && path.resolve(invokedPath) === fileURLToPath(import.meta.url)) {
  process.exitCode = run();
}
