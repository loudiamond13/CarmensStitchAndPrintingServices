// @ts-check
// D-16 drift check: regenerates the API types from the committed OpenAPI snapshot into a temporary file, with the same
// openapi-typescript CLI that `npm run generate` runs, and fails when the committed web/src/types/api.generated.ts
// differs. It never writes the committed file. The chain it closes: live API -> OpenApiSnapshotTests -> snapshot ->
// this check -> committed types (docs/web/api.md).
//
// Usage: node check.mjs [--snapshot <path>] [--generated <path>]
//   Exit 0: the types match. Exit 1: they differ, or the types file is missing. Exit 2: bad arguments.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultSnapshot = fileURLToPath(new URL('./openapi.v1.json', import.meta.url));
const defaultGenerated = fileURLToPath(new URL('../../web/src/types/api.generated.ts', import.meta.url));
const cli = fileURLToPath(new URL('./node_modules/openapi-typescript/bin/cli.js', import.meta.url));
const refreshHint = 'Run npm --prefix tools/openapi-gen run generate and commit the result (docs/web/api.md).';
const endOfFile = '(end of file)';
const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));

/** @param {string} file a repository-relative name with forward slashes, or the absolute path outside the repository */
const display = (file) => {
  const inside = relative(repositoryRoot, file);
  return inside.startsWith('..') || isAbsolute(inside) ? file : inside.replaceAll('\\', '/');
};

/** @param {string} text */
const normalize = (text) => text.replace(/\r\n/g, '\n');

/** @param {string} text normalized text; a final newline ends the last line instead of starting another */
const lines = (text) => (text === '' ? [] : (text.endsWith('\n') ? text.slice(0, -1) : text).split('\n'));

/** @param {string} text */
const ending = (text) => (text.endsWith('\n') ? '(final newline)' : '(no final newline)');

/**
 * Finds the first line where the committed types and the freshly generated types differ (CRLF counts as LF).
 * @param {string} committed
 * @param {string} generated
 * @returns {{ line: number, committed: string, generated: string } | null}
 */
export function firstDifference(committed, generated) {
  const before = normalize(committed);
  const after = normalize(generated);
  const left = lines(before);
  const right = lines(after);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    if (left[index] !== right[index]) {
      return { line: index + 1, committed: left[index] ?? endOfFile, generated: right[index] ?? endOfFile };
    }
  }
  // Same lines: only the final newline can still differ.
  return before === after ? null : { line: left.length, committed: ending(before), generated: ending(after) };
}

/**
 * Runs the openapi-typescript CLI on `snapshot` into a temporary folder and returns the text it wrote.
 * @param {string} snapshot
 * @returns {string}
 */
function generate(snapshot) {
  const folder = mkdtempSync(join(tmpdir(), 'csps-openapi-check-'));
  try {
    const output = join(folder, 'api.generated.ts');
    const result = spawnSync(process.execPath, [cli, snapshot, '-o', output], { encoding: 'utf8' });
    if (result.status !== 0) {
      throw new Error(`openapi-typescript failed on ${snapshot}:\n${result.stderr}`);
    }
    return readFileSync(output, 'utf8');
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/**
 * @param {readonly string[]} args
 * @returns {{ snapshot: string, generated: string }}
 */
function parseArgs(args) {
  const options = { snapshot: defaultSnapshot, generated: defaultGenerated };
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if ((name !== '--snapshot' && name !== '--generated') || value === undefined) {
      throw new TypeError(`Unknown argument ${String(name)}. Usage: node check.mjs [--snapshot <path>] [--generated <path>]`);
    }
    options[name === '--snapshot' ? 'snapshot' : 'generated'] = resolve(value);
  }
  return options;
}

/**
 * @param {readonly string[]} args
 * @returns {number} the exit code
 */
function main(args) {
  /** @type {{ snapshot: string, generated: string }} */
  let options;
  try {
    options = parseArgs(args);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }

  if (!existsSync(options.generated)) {
    console.error(`${display(options.generated)} is missing. ${refreshHint}`);
    return 1;
  }

  const difference = firstDifference(readFileSync(options.generated, 'utf8'), generate(options.snapshot));
  if (difference !== null) {
    console.error(
      [
        `Generated API types are out of date: ${display(options.generated)} differs from what`,
        `${display(options.snapshot)} generates.`,
        `First difference at line ${String(difference.line)}:`,
        `- committed: ${difference.committed}`,
        `+ generated: ${difference.generated}`,
        refreshHint,
      ].join('\n'),
    );
    return 1;
  }

  console.log(`Generated API types match ${display(options.snapshot)}.`);
  return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2));
}
