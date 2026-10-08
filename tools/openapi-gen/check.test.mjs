// @ts-check
// D-16 drift check tests (plan 02-15). Run with `npm --prefix tools/openapi-gen test` (node:test, no extra package).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { firstDifference } from './check.mjs';

const checkScript = fileURLToPath(new URL('./check.mjs', import.meta.url));
const snapshot = fileURLToPath(new URL('./openapi.v1.json', import.meta.url));
const generated = fileURLToPath(new URL('../../web/src/types/api.generated.ts', import.meta.url));
const scratch = mkdtempSync(join(tmpdir(), 'csps-openapi-check-test-'));

after(() => {
  rmSync(scratch, { recursive: true, force: true });
});

/** @param {readonly string[]} args */
function runCheck(args) {
  const result = spawnSync(process.execPath, [checkScript, ...args], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('firstDifference', () => {
  it('returns null for equal texts, treating CRLF as LF', () => {
    assert.equal(firstDifference('a\nb\n', 'a\r\nb\r\n'), null);
  });

  it('names the first differing line with both sides', () => {
    assert.deepEqual(firstDifference('a\nb\nc\n', 'a\nB\nc\n'), { line: 2, committed: 'b', generated: 'B' });
  });

  it('reports the end of a shorter file', () => {
    assert.deepEqual(firstDifference('a\n', 'a\nb\n'), { line: 2, committed: '(end of file)', generated: 'b' });
    assert.deepEqual(firstDifference('a\nb', 'a'), { line: 2, committed: 'b', generated: '(end of file)' });
  });
});

describe('check.mjs (the D-16 drift check)', () => {
  it('exits 0 when the committed types match what the committed snapshot generates', () => {
    const result = runCheck([]);

    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Generated API types match tools\/openapi-gen\/openapi\.v1\.json\./);
  });

  it('exits 1 with the first difference when one property name in the snapshot changes', () => {
    const edited = join(scratch, 'renamed-property.json');
    const text = readFileSync(snapshot, 'utf8');
    assert.ok(text.includes('"locale": {'), 'the snapshot has a locale property to rename');
    writeFileSync(edited, text.replace('"locale": {', '"localeName": {'));

    const result = runCheck(['--snapshot', edited]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /Generated API types are out of date/);
    assert.match(result.stderr, /First difference at line \d+:/);
    assert.match(result.stderr, /^- committed: +locale: string;$/m);
    // The required list still names `locale`, so the renamed property generates as optional.
    assert.match(result.stderr, /^\+ generated: +localeName\?: string;$/m);
    assert.match(result.stderr, /npm --prefix tools\/openapi-gen run generate/);
  });

  it('exits 1 when the generated types file is missing', () => {
    const result = runCheck(['--generated', join(scratch, 'missing.ts')]);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /missing\.ts is missing/);
    assert.match(result.stderr, /npm --prefix tools\/openapi-gen run generate/);
  });

  it('writes nothing to the committed types file', () => {
    const before = readFileSync(generated, 'utf8');
    const edited = join(scratch, 'retitled.json');
    writeFileSync(edited, readFileSync(snapshot, 'utf8').replace('"Formatting locale."', '"Changed."'));

    assert.equal(runCheck(['--snapshot', edited]).status, 1);
    runCheck([]);

    assert.equal(readFileSync(generated, 'utf8'), before);
  });

  it('rejects an unknown argument with exit 2', () => {
    const result = runCheck(['--nope']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown argument --nope/);
  });
});
